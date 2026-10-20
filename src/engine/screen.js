// Экран: canvas с маленьким внутренним разрешением и целочисленным масштабом.
// Ширина 192–300 px (настройка «Плотность пикселей»), высота подстраивается под свободное место.
G.screen = {
  canvas: null,
  ctx: null,
  W: G.CONFIG.VIEW_W,
  H: 256,
  scale: 2,

  init() {
    this.canvas = document.getElementById('screen');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.resize());
  },

  // Плотность пикселей: целевая внутренняя ширина. Масштаб целый в ФИЗИЧЕСКИХ пикселях
  // (dpr 3 на iPhone), поэтому пиксели остаются чёткими при любой ширине.
  DENSITY: [{ id: 'big', name: 'КРУПНО', w: 192 }, { id: 'mid', name: 'СРЕДНЕ', w: 240 }, { id: 'fine', name: 'МЕЛКО', w: 300 }],
  density() { const id = (G.storage && G.storage.settings.density) || 'fine'; return this.DENSITY.find((d) => d.id === id) || this.DENSITY[2]; },
  densityOptions() {
    const seen = new Set();
    return this.DENSITY.filter((d) => { const g = this.geometry(d.w), key = g.w + ':' + g.h; if (seen.has(key)) return false; seen.add(key); return true; });
  },
  cycleDensity() {
    const options = this.densityOptions();
    if (options.length < 2) return;
    const current = this.geometry(this.density().w);
    const i = options.findIndex((d) => { const g = this.geometry(d.w); return g.w === current.w && g.h === current.h; });
    G.storage.settings.density = options[(i + 1) % options.length].id;
    G.storage.saveSettings(); this.resize();
  },

  geometry(target) {
    const wrap = document.getElementById('screen-wrap');
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const devW = Math.floor(wrap.clientWidth * dpr);
    const devH = Math.floor(wrap.clientHeight * dpr);
    // на iPhone 15 Pro: 393·3 = 1179 физ. px → 1179/300 ≈ 4 → ширина 294
    // холст в 2 раза подробнее логической сетки, поэтому масштаб — чётное число физических пикселей на логический
    const HI = G.gfx.HI;
    let scale = Math.max(HI, Math.round(devW / target / HI) * HI);
    while (scale > HI && Math.floor(devW / scale) < G.CONFIG.VIEW_W) scale -= HI;
    let w = Math.floor(devW / scale);
    let h = Math.floor(devH / scale);
    while (scale > HI && h < G.CONFIG.MIN_H) { scale -= HI; w = Math.floor(devW / scale); h = Math.floor(devH / scale); }
    w = Math.max(G.CONFIG.VIEW_W, w - (w % 2));
    h = G.util.clamp(h, G.CONFIG.MIN_H, G.CONFIG.MAX_H);
    h -= h % 2;
    return { w, h, scale, dpr };
  },

  resize() {
    const { w, h, scale, dpr } = this.geometry(this.density().w), HI = G.gfx.HI;

    this.scale = scale / dpr;          // CSS-пикселей на игровой пиксель
    this.devScale = scale;             // физических пикселей на игровой пиксель
    this.W = w; this.H = h;
    this.canvas.width = this.W * HI;
    this.canvas.height = this.H * HI;
    this.canvas.style.width = (this.W * scale / dpr) + 'px';
    this.canvas.style.height = (this.H * scale / dpr) + 'px';
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.setTransform(HI, 0, 0, HI, 0, 0);
    G.events.emit('resize', this.W, this.H);
  },

  clear(color = '#000') {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.W, this.H);
  },

  // Перевод координат касания (CSS) во внутренние пиксели
  toLocal(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * this.W, y: ((clientY - r.top) / r.height) * this.H };
  },
};
