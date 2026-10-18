// Node-харнес: исполняет собранный index.html без браузера (заглушки DOM, Canvas, localStorage, Web Audio).
// Нужен для быстрых проверок (tools/check_node.py) и для поиска регрессий при рефакторинге (tools/node/golden.js).
//
//   const h = require('./harness.js');        // загрузить игру
//   h.G.world.konoha();                       // дальше доступен весь G, как в консоли браузера
//   h.seed();                                 // состояние «день 2, герой готов» — как tools/tlib.py: seed()
//   h.rng(12345);                             // детерминированный Math.random (для сравнения «до/после»)
//   const ctx = h.recordingCtx();             // контекст, который пишет все вызовы рисования в ctx.log
//
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');

// ─────────── Canvas 2D ───────────
class CanvasRenderingContext2D {}
const NOOP = function () {};
CanvasRenderingContext2D.prototype.drawImage = NOOP;

let uid = 0;
function makeCtx(canvas, log) {
  const base = Object.create(CanvasRenderingContext2D.prototype);
  Object.assign(base, {
    canvas,
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, globalCompositeOperation: 'source-over',
    font: '10px sans-serif', textAlign: 'left', textBaseline: 'top', lineCap: 'butt', lineJoin: 'miter',
    imageSmoothingEnabled: false, shadowBlur: 0, shadowColor: 'transparent', filter: 'none',
    measureText: (t) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: NOOP }),
    createRadialGradient: () => ({ addColorStop: NOOP }),
    createPattern: () => null,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w | 0, height: h | 0 }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w | 0, height: h | 0 }),
    putImageData: NOOP,
  });
  // log — массив: пишем каждый вызов метода рисования, чтобы можно было сравнить отрисовку «до/после» правки
  return new Proxy(base, {
    get(t, k) {
      if (k in t) return t[k];
      if (!log) return NOOP;
      return (...a) => { log.push(k + '(' + a.map(fmtArg).join(',') + ')'); };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function fmtArg(a) {
  if (typeof a === 'number') return Number.isFinite(a) ? String(Math.round(a * 1000) / 1000) : 'NaN';
  if (typeof a === 'string') return a.length > 24 ? a.slice(0, 24) + '…' : a;
  if (a && a._uid != null) return 'c' + a.width + 'x' + a.height;   // холст — по размеру (устойчиво к порядку создания)
  if (a && typeof a === 'object') return a.addColorStop ? 'grad' : 'obj';
  return String(a);
}

// ─────────── DOM-элемент ───────────
const elements = new Map();
function makeEl(tag = 'div', id = '') {
  const el = {
    tagName: String(tag).toUpperCase(), id, style: {}, dataset: {}, children: [], _ctx: null, _uid: ++uid,
    width: 300, height: 150, clientWidth: 393, clientHeight: 600, offsetWidth: 393, offsetHeight: 600,
    textContent: '', innerHTML: '', value: '', hidden: false, disabled: false, checked: false,
    addEventListener: NOOP, removeEventListener: NOOP, dispatchEvent: () => true,
    appendChild(c) { this.children.push(c); return c; }, removeChild(c) { return c; }, remove: NOOP,
    querySelector: () => makeEl('div'), querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 393, bottom: 600, width: 393, height: 600, x: 0, y: 0 }),
    getContext(type, opts) { if (!this._ctx) this._ctx = makeCtx(this, this._log); return this._ctx; },
    setAttribute: NOOP, getAttribute: () => null, removeAttribute: NOOP, hasAttribute: () => false,
    classList: { add: NOOP, remove: NOOP, toggle: NOOP, contains: () => false },
    focus: NOOP, blur: NOOP, click: NOOP, scrollIntoView: NOOP, closest: () => null,
    toDataURL: () => 'data:image/png;base64,',
    get firstChild() { return this.children[0] || null; },
  };
  return el;
}
// холст, который записывает все вызовы рисования в .log
function recordingCanvas(w = 320, h = 480) {
  const el = makeEl('canvas');
  el.width = w; el.height = h; el._log = [];
  el.getContext();
  return el;
}
function recordingCtx(w = 320, h = 480) {
  const el = recordingCanvas(w, h);
  const ctx = el.getContext('2d');
  ctx.log = el._log;
  return ctx;
}

// ─────────── хранилище ───────────
const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

// ─────────── window / document ───────────
const document = {
  documentElement: makeEl('html'), body: makeEl('body'), head: makeEl('head'),
  visibilityState: 'visible', hidden: false, readyState: 'complete',
  getElementById(id) { if (!elements.has(id)) elements.set(id, makeEl('div', id)); return elements.get(id); },
  createElement: (t) => makeEl(t), createElementNS: (ns, t) => makeEl(t),
  querySelector: () => makeEl('div'), querySelectorAll: () => [],
  addEventListener: NOOP, removeEventListener: NOOP, dispatchEvent: () => true,
  fonts: { ready: Promise.resolve(), load: NOOP },
};

const g = globalThis;
// в новых Node часть глобалов (navigator, performance) только для чтения — ставим через defineProperty
function def(name, value) {
  try { g[name] = value; if (g[name] === value) return; } catch (_) {}
  try { Object.defineProperty(g, name, { value, configurable: true, writable: true, enumerable: true }); } catch (_) {}
}
def('window', g); def('self', g);
def('document', document);
def('localStorage', localStorage); def('sessionStorage', localStorage);
def('CanvasRenderingContext2D', CanvasRenderingContext2D);
def('HTMLCanvasElement', function HTMLCanvasElement() {});
def('devicePixelRatio', 3); def('innerWidth', 393); def('innerHeight', 852);
def('visualViewport', { width: 393, height: 852, offsetLeft: 0, offsetTop: 0, addEventListener: NOOP, removeEventListener: NOOP });
// ключи serviceWorker/audioSession НЕ объявляем: игра проверяет их через `'x' in navigator`,
// а свойство со значением undefined уже считается существующим
def('navigator', { userAgent: 'node-harness', language: 'ru', maxTouchPoints: 5, vibrate: NOOP });
g.addEventListener = NOOP; g.removeEventListener = NOOP; g.dispatchEvent = () => true;
def('requestAnimationFrame', () => 0);            // игровой цикл не запускаем: кадр вызываем сами
def('cancelAnimationFrame', NOOP);
def('matchMedia', () => ({ matches: false, addEventListener: NOOP, addListener: NOOP }));
def('location', { protocol: 'http:', hostname: 'localhost', href: 'http://localhost:8765/index.html', search: '', hash: '' });
g.name = '';
def('btoa', (s) => Buffer.from(s, 'binary').toString('base64'));
def('atob', (s) => Buffer.from(s, 'base64').toString('binary'));
def('getComputedStyle', () => ({ getPropertyValue: () => '' }));
def('AudioContext', undefined); def('webkitAudioContext', undefined);   // звук не нужен
if (!g.performance || !g.performance.now) def('performance', { now: () => Date.now() });

// ─────────── загрузка бандла ───────────
const warns = [];
function load(file = 'index.html') {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (!scripts.length) throw new Error('в ' + file + ' нет <script> — сначала python3 build.py');
  const ow = console.warn;
  console.warn = (...a) => warns.push(a.map(String).join(' '));
  const t0 = Date.now();
  try {
    vm.runInThisContext(scripts.join('\n'), { filename: file });
  } finally { console.warn = ow; }
  return { ms: Date.now() - t0, warns };
}
const loaded = load();
const G = g.G;
if (!G) throw new Error('бандл загрузился, но G не появился');

// ─────────── детерминированный Math.random ───────────
const realRandom = Math.random;
function rng(seed) {
  let s = seed >>> 0;
  Math.random = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngOff() { Math.random = realRandom; }

// ─────────── состояние героя (как tools/tlib.py: seed) ───────────
function seed(extra) {
  const st = G.game.newState();
  st.started = true; st.hero.name = 'Кайто';
  st.hero.stats = { tai: 6, nin: 5, gen: 4, chakra: 5, ctrl: 5, spd: 6, end: 5, know: 4 };
  st.hero.skills = ['eagle_eye', 'diligent'];
  Object.assign(st.flags, { enrolled: 1, naruto_invited: 1, ramen_done: 1, treated_naruto: 1, day2_intro: 1,
    met_naruto: 1, met_iruka: 1, met_sakura: 1, met_sasuke: 1, met_hinata: 1 });
  st.quests.day1 = { st: 'done', step: 99, day: 1 };
  st.vars.day = 2; st.vars.min = 7 * 60;
  st.inv = { kunai: 6, shuriken: 8, bandage: 2, smoke_bomb: 1, wire: 1 };
  if (extra) extra(st);
  return st;
}

// ─────────── прокрутить сцену: update + draw ───────────
function frames(scene, n = 1, ctx = null) {
  const c = ctx || recordingCtx(G.screen.W, G.screen.H);
  for (let i = 0; i < n; i++) { scene.update && scene.update(1 / 60); scene.draw && scene.draw(c); }
  return c;
}

module.exports = { G, ROOT, BUILD: g.BUILD, warns, loaded, seed, rng, rngOff, frames, recordingCtx, recordingCanvas, document, localStorage, store, elements, makeEl };
