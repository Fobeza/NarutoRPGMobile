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
  cycleDensity() {
    const i = this.DENSITY.indexOf(this.density());
    G.storage.settings.density = this.DENSITY[(i + 1) % this.DENSITY.length].id;
    G.storage.saveSettings(); this.resize();
  },

  resize() {
    const wrap = document.getElementById('screen-wrap');
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const devW = Math.floor(wrap.clientWidth * dpr);
    const devH = Math.floor(wrap.clientHeight * dpr);
    const target = this.density().w;
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
