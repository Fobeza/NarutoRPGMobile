// Глобальное пространство имён игры. Все модули добавляют себя в G.
const G = (typeof window !== 'undefined' ? window : globalThis).G = {};

G.CONFIG = {
  TILE: 16,           // размер тайла в пикселях
  VIEW_W: 192,        // внутренняя ширина экрана (12 тайлов)
  MIN_H: 200,         // минимальная внутренняя высота
  MAX_H: 560,         // максимальная внутренняя высота
  PAD_H: 140,         // высота геймпада в CSS-пикселях
  WALK_SPEED: 56,     // пикс/сек
  RUN_SPEED: 96,
};

// ---------- Утилиты ----------
G.util = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  sign: (v) => (v > 0 ? 1 : v < 0 ? -1 : 0),
  dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
  rectsOverlap: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,

  // Детерминированный генератор случайных чисел (mulberry32) — для карт и декора
  rng(seed) {
    let s = seed >>> 0;
    const f = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.chance = (p) => f() < p;
    return f;
  },

  // Хэш двух координат → число (для «случайного» декора без хранения)
  hash2(x, y, seed = 0) {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  },

  // Подстановка {name} и других переменных в текст
  fmt(text, vars) {
    return text.replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? vars[k] : m));
  },
};

// Простая шина событий
G.events = {
  _h: {},
  on(name, fn) { (this._h[name] = this._h[name] || []).push(fn); return fn; },
  off(name, fn) { const a = this._h[name]; if (a) this._h[name] = a.filter((f) => f !== fn); },
  emit(name, ...args) { (this._h[name] || []).slice().forEach((f) => f(...args)); },
};

// Состояние игры (то, что попадёт в сохранение). Заполняется в main/creation.
G.state = {
  started: false,       // true после создания персонажа — только тогда работает автосейв
  hero: { name: '' },
  flags: {},
  vars: {},
};
