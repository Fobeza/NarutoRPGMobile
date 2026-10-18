// Спрайты из строк: каждая строка — ряд пикселей, символ → цвет по карте.
// '.' и ' ' — прозрачный пиксель.
// Графика в «32-пиксельном» качестве: все холсты в 2 раза подробнее логической сетки (тайл 16 → 32 пикселя).
// Код рисования по-прежнему работает в логических координатах; холст хранит HI×HI точек на клетку,
// а drawImage умеет рисовать такие холсты в логическом размере (см. патч ниже).
G.gfx = {
  HI: 2,
  canvas(w, h, lo) {
    const c = document.createElement('canvas');
    const k = lo ? 1 : this.HI;
    c.width = w * k; c.height = h * k;
    if (!lo) { c.hi = true; c.lw = w; c.lh = h; }
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if (!lo) ctx.scale(k, k);
    return c;
  },

  // Scale2x: сглаживает ступеньки диагоналей и скругляет углы, одиночные пиксели остаются как есть.
  // Работает по логическим пикселям холста (изначально это блоки 2×2 одного цвета).
  smooth(c) {
    if (!c.hi) return c;
    const H = this.HI, w = c.lw, h = c.lh, W2 = c.width;
    const ctx = c.getContext('2d');
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const u = new Uint32Array(img.data.buffer), out = new Uint32Array(u);
    const at = (x, y) => u[(y * H) * W2 + x * H];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const P = at(x, y);
      const A = y > 0 ? at(x, y - 1) : P, D = y < h - 1 ? at(x, y + 1) : P;
      const C = x > 0 ? at(x - 1, y) : P, B = x < w - 1 ? at(x + 1, y) : P;
      if (A === D || C === B) continue;
      const i = (y * H) * W2 + x * H;
      if (C === A && C !== D && A !== B) out[i] = A;
      if (A === B && A !== C && B !== D) out[i + 1] = B;
      if (D === C && D !== B && C !== A) out[i + W2] = C;
      if (B === D && B !== A && D !== C) out[i + W2 + 1] = D;
    }
    img.data.set(new Uint8ClampedArray(out.buffer));
    ctx.putImageData(img, 0, 0);
    return c;
  },

  // Нарисовать строковый спрайт на контекст
  paint(ctx, rows, colors, ox = 0, oy = 0) {
    for (let y = 0; y < rows.length; y++) {
      const r = rows[y];
      for (let x = 0; x < r.length; x++) {
        const ch = r[x];
        if (ch === '.' || ch === ' ') continue;
        const col = colors[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  },

  fromStrings(rows, colors) {
    const w = Math.max(...rows.map((r) => r.length));
    const c = this.canvas(w, rows.length);
    this.paint(c.getContext('2d'), rows, colors);
    return c;
  },

  mirror(src) {
    const sw = src.lw || src.width, sh = src.lh || src.height;
    const c = this.canvas(sw, sh);
    const ctx = c.getContext('2d');
    ctx.translate(sw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
    return c;
  },

  // Белый силуэт (для вспышки при ударе) или тень
  silhouette(src, color) {
    const sw = src.lw || src.width, sh = src.lh || src.height;
    const c = this.canvas(sw, sh);
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, sw, sh);
    return c;
  },

  // Рамка окна интерфейса в пиксельном стиле
  window(ctx, x, y, w, h, style = 'paper') {
    // Тема «Б. Лак и сталь»: чёрная тень, стальная кромка, лаковое тело,
    // светлая кромка сверху и тень снизу — панель читается как металл в смоле.
    const U = G.UI;
    const st = style === 'dark'
      ? { bg: U.deep, hi: U.deepHi, lo: U.deepLo, edge: U.edgeDim }
      : { bg: U.panel, hi: U.panelHi, lo: U.panelLo, edge: U.edge };
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 1, y, w - 2, h);
    ctx.fillRect(x, y + 1, w, h - 2);
    ctx.fillStyle = st.edge;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = st.bg;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = st.hi;
    ctx.fillRect(x + 2, y + 2, w - 4, 1);
    ctx.fillStyle = st.lo;
    ctx.fillRect(x + 2, y + h - 3, w - 4, 1);
  },
};

// drawImage для «подробных» холстов: размер и источник задаются в логических пикселях
(() => {
  const orig = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
    if (img && img.hi) {
      if (a.length === 2) return orig.call(this, img, a[0], a[1], img.lw, img.lh);
      if (a.length === 8) { const k = G.gfx.HI; return orig.call(this, img, a[0] * k, a[1] * k, a[2] * k, a[3] * k, a[4], a[5], a[6], a[7]); }
    }
    return orig.call(this, img, ...a);
  };
})();
