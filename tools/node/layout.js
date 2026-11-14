// Проверка вёрстки без браузера: текст не налезает на текст, не уходит за экран и не обрезается многоточием.
// Перехватывает G.font.draw / G.font.small.draw, ведёт свой стек преобразований (translate/scale) и собирает
// прямоугольники всех надписей кадра. Экраны — на трёх размерах: «крупно» (196 точек), «мелко» (294) и iPhone SE (320).
//
//   node tools/node/layout.js            все экраны, код выхода 1 при находках
//   node tools/node/layout.js -v         ещё и список надписей с многоточием, которые разрешены
'use strict';
const h = require('./harness.js'), { G } = h;
const VERBOSE = process.argv.includes('-v');

// Надписи, которым многоточие разрешено: содержимое, а не подпись интерфейса (имена, описания, реплики).
const ELLIPSIS_OK = [
  /^log$/, /^deckview$/, /^shop$/, /^bag$/, /^status$/, /^calendar$/, /^gallery$/,   // списки с названиями и описаниями
];

function tracker(W, H) {
  const ctx = h.recordingCtx(W, H);
  let m = { sx: 1, sy: 1, tx: 0, ty: 0 }; const stack = [];
  ctx.save = () => { stack.push(Object.assign({}, m)); };
  ctx.restore = () => { if (stack.length) m = stack.pop(); };
  ctx.translate = (x, y) => { m.tx += x * m.sx; m.ty += y * m.sy; };
  ctx.scale = (x, y) => { m.sx *= x; m.sy *= y; };
  ctx.setTransform = (a, b, c, d, e, f) => { m = { sx: a, sy: d, tx: e, ty: f }; };
  ctx.resetTransform = () => { m = { sx: 1, sy: 1, tx: 0, ty: 0 }; };
  return { ctx, at: () => m };
}

function capture(scene, W, H) {
  const T = tracker(W, H), out = [];
  const faces = [G.font, G.font.small], olds = faces.map((f) => f.draw);
  let depth = 0;
  faces.forEach((face, i) => {
    face.draw = function (ctx, text, x, y, opts = {}) {
      if (depth === 0 && ctx === T.ctx && String(text).trim()) {
        let s = String(text), cut = false;
        if (opts.maxW && face.measure(s) > opts.maxW) { cut = true; const ch = [...s]; while (ch.length && face.measure(ch.join('') + '…') > opts.maxW) ch.pop(); s = ch.join('').trimEnd() + '…'; }
        const w = face.measure(s), m = T.at();
        let lx = x; if (opts.align === 'center') lx = Math.round(x - w / 2); else if (opts.align === 'right') lx = Math.round(x - w);
        out.push({ text: s, cut, x: lx * m.sx + m.tx, y: y * m.sy + m.ty, w: w * m.sx, h: face.CAP * m.sy, alpha: ctx.globalAlpha });
      }
      depth++; try { return olds[i].call(this, ctx, text, x, y, opts); } finally { depth--; }
    };
  });
  try { scene.update && scene.update(1 / 60); scene.draw(T.ctx); if (scene.touch || G.touch.BACK.has(scene.name)) G.touch.draw(T.ctx); }
  finally { faces.forEach((f, i) => { f.draw = olds[i]; }); }
  return out;
}

function problems(name, items, W, H) {
  const bad = [];
  for (const a of items) {
    if (a.x < -1 || a.x + a.w > W + 1 || a.y < -3 || a.y + a.h > H + 2) bad.push(`за экраном: «${a.text}» x=${Math.round(a.x)}..${Math.round(a.x + a.w)} y=${Math.round(a.y)} (экран ${W}×${H})`);
    if (a.cut && !ELLIPSIS_OK.some((r) => r.test(name))) bad.push(`обрезано: «${a.text}»`);
    else if (a.cut && VERBOSE) console.log(`     · ${name}: «${a.text}»`);
  }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.text === b.text && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2) continue;   // та же надпись дважды (контур)
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox > 2 && oy > 2) bad.push(`наложение: «${a.text}» и «${b.text}» (${Math.round(ox)}×${Math.round(oy)} точек)`);
  }
  return bad;
}

// ─────────── экраны ───────────
function state() {
  h.seed((st) => {
    st.vars.day = 12; st.vars.min = 10 * 60; st.vars.wins = 4; st.vars.battles = 6; st.vars.use_strike = 11;
    Object.assign(st.flags, { tech_henge: 1, tech_chakra_shot: 1, tech_bunshin: 1, tech_kawarimi: 1, card_duel_tip: 1 });
    st.inv = { kunai: 4, bandage: 2, dango: 2, fish: 1, herb: 3 };
    st.dlgLog = []; for (let i = 0; i < 30; i++) st.dlgLog.push('Наруто: Реплика номер ' + i + ' — достаточно длинная, чтобы перенестись.');
  });
  G.storage.wipe(); G.storage.save(G.state, { slot: 0 }); G.storage.save(G.state, { slot: 1, backup: true });
  G.scenes.stack.length = 0; G.scenes.fade = { a: 0, dir: 0, speed: 3, then: null };
  G.input.pressed = () => false; G.input.held = () => false; G.input.tapNow = null;
}
const world = () => { const w = G.scenes.make('world', G.state.pos); G.scenes.push(w); return w; };
const SCENES = {
  title: () => G.scenes.make('title'),
  menu: () => G.scenes.make('menu'),
  settings: () => G.scenes.make('settings'),
  mapsettings: () => G.scenes.make('mapsettings'),
  savemenu: () => G.scenes.make('savemenu'),
  status: () => G.scenes.make('status'),
  bag: () => G.scenes.make('bag'),
  journal: () => G.scenes.make('journal'),
  calendar: () => G.scenes.make('calendar'),
  deckview: () => G.scenes.make('deckview'),
  log: () => G.scenes.make('log'),
  gallery: () => G.scenes.make('gallery'),
  ending: () => G.scenes.make('ending'),
  shop: () => G.scenes.make('shop', 'ichiraku', { title: 'Ичираку', onClose() {} }),
  pick: () => { const w = world(); return G.scenes.make('pick', w.waitSpec(), () => {}); },
  battle: () => { h.rng(5); const b = G.scenes.make('battle', { enemy: 'sasuke', mode: 'spar' }, () => {}); for (let i = 0; i < 60 && b.state !== 'menu'; i++) b.update(0.1); return b; },
  battle_names: () => {   // рука из карт с самыми длинными именами: перенос по слогам и соседние клетки
    for (const id of Object.keys(G.TECHS)) G.state.flags['tech_' + id] = 1;
    h.rng(7); const b = G.scenes.make('battle', { enemy: 'choji', mode: 'ko' }, () => {}); for (let i = 0; i < 60 && b.state !== 'menu'; i++) b.update(0.1);
    const ids = Object.keys(G.CARDS).sort((x, y) => G.CARDS[y].name.length - G.CARDS[x].name.length).slice(0, 5);
    b.D.hand = ids.map((id, i) => ({ id, uid: 900 + i })); b.update(0.016);
    return b;
  },
  battle_first: () => { delete G.state.flags.card_duel_tip; h.rng(6); const b = G.scenes.make('battle', { enemy: 'kiba', mode: 'ko' }, () => {}); for (let i = 0; i < 60 && b.state !== 'menu'; i++) b.update(0.1); return b; },
};
const SIZES = [['крупно 196', 393, 759, 2, 'big'], ['мелко 294', 393, 759, 3, 'fine'], ['SE 320', 320, 568, 2, null]];

const wrap = h.document.getElementById('screen-wrap');
const keep = [wrap.clientWidth, wrap.clientHeight, globalThis.devicePixelRatio, G.storage.settings.density];
let fails = 0, checked = 0;
for (const [label, cw, chh, dpr, density] of SIZES) {
  wrap.clientWidth = cw; wrap.clientHeight = chh; globalThis.devicePixelRatio = dpr;
  if (density) G.storage.settings.density = density; else delete G.storage.settings.density;
  G.screen.resize();
  for (const [name, make] of Object.entries(SCENES)) {
    state();
    let bad;
    try { const sc = make(); if (!G.scenes.stack.includes(sc)) G.scenes.push(sc); const items = capture(sc, G.screen.W, G.screen.H); bad = problems(name.replace(/_.*/, ''), items, G.screen.W, G.screen.H); bad.count = items.length; }
    catch (e) { bad = ['исключение: ' + e.message]; }
    checked++; if (VERBOSE) console.log('   ' + name + ' · ' + label + ': надписей ' + (bad.count || 0));
    if (bad.length) { fails += bad.length; console.log(`✘ ${name} · ${label}`); for (const b of [...new Set(bad)].slice(0, 8)) console.log('     ' + b); }
  }
}
[wrap.clientWidth, wrap.clientHeight, globalThis.devicePixelRatio] = keep; if (keep[3]) G.storage.settings.density = keep[3]; else delete G.storage.settings.density; G.screen.resize();
h.rngOff();
console.log(`ИТОГ вёрстки: экранов ${checked}, находок ${fails}`);
process.exitCode = fails ? 1 : 0;
