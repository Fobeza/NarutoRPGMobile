// Светотень V9: «богатый пиксель-арт» кодом — без готовых картинок.
// Свет всегда сверху-слева. Плавность — ступенями оттенков и упорядоченным дизерингом (матрица Байера 4×4)
// на «тонких» пикселях холста (HI = 2), поэтому переходы мягкие, а пиксель остаётся чётким.
//   ramp(col, n)        — ступени оттенка: тени холоднее (к фиолетовому), света теплее
//   grad(c, …)          — дизерный градиент в прямоугольник холста (вертикальный / горизонтальный / радиальный)
//   light(c, o)         — объём по силуэту готового спрайта: блик на кромках к свету, тень у дальних, затемнение низа
//   shadow(ctx, …)      — мягкая статичная тень-эллипс (ядро + полутень с дизерингом)
G.shade = (() => {
  const DARK = [34, 26, 64], LITE = [255, 242, 204];
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

  // ---------- цвет ----------
  function rgb(h) {
    if (Array.isArray(h)) return h;
    h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // k < 0 — тень (холоднее), k > 0 — свет (теплее); |k| ≤ 1
  const tone = (c, k) => (k < 0 ? mix(rgb(c), DARK, -k) : mix(rgb(c), LITE, k));
  const toneHex = (c, k) => hex(tone(c, k));
  // ступени оттенка от тёмной к светлой; базовый цвет — в середине
  function ramp(c, n = 5, span = 0.55) {
    const out = [], m = (n - 1) / 2;
    for (let i = 0; i < n; i++) out.push(toneHex(c, ((i - m) / m) * span * (i < m ? 1 : 0.8)));
    return out;
  }

  // ---------- доступ к пикселям «подробного» холста ----------
  // r = [X0, Y0, X1, Y1] в тонких px — читать только этот кусок (чтение всего холста дорогое)
  function pix(c, r) {
    const k = c.hi ? G.gfx.HI : 1, ctx = c.getContext('2d');
    const ox = r ? Math.max(0, r[0]) : 0, oy = r ? Math.max(0, r[1]) : 0;
    const w = Math.max(1, (r ? Math.min(c.width, r[2]) : c.width) - ox), h = Math.max(1, (r ? Math.min(c.height, r[3]) : c.height) - oy);
    const img = ctx.getImageData(ox, oy, w, h);
    return { k, ctx, img, d: img.data, w, h, ox, oy, W: c.width, H: c.height, put() { ctx.putImageData(img, ox, oy); } };
  }

  // ---------- градиент с дизерингом ----------
  // stops: массив цветов (равномерно) или [[t, цвет], …]; o.dir: 'v' (сверху вниз) | 'h' | 'r' (радиальный из o.cx, o.cy);
  // o.alpha — непрозрачность (смешивание поверх), o.mask — рисовать только по непрозрачным пикселям
  function grad(c, x, y, w, h, stops, o = {}) {
    const kk = c.hi ? G.gfx.HI : 1;
    const P = pix(c, [Math.round(x * kk), Math.round(y * kk), Math.round((x + w) * kk), Math.round((y + h) * kk)]), k = P.k;
    const st = stops.map((s, i) => (Array.isArray(s) && typeof s[0] === 'number' && s.length === 2 && typeof s[1] !== 'number'
      ? [s[0], rgb(s[1])] : [i / Math.max(1, stops.length - 1), rgb(s)]));
    const X0 = Math.max(0, Math.round(x * k)), Y0 = Math.max(0, Math.round(y * k));
    const X1 = Math.min(P.W, Math.round((x + w) * k)), Y1 = Math.min(P.H, Math.round((y + h) * k));
    const dir = o.dir || 'v', A = o.alpha == null ? 1 : o.alpha, steps = o.steps || 0;
    const cx = (o.cx == null ? x + w / 2 : o.cx) * k, cy = (o.cy == null ? y + h / 2 : o.cy) * k;
    const rr = (o.r == null ? Math.max(w, h) / 2 : o.r) * k;
    const d = P.d;
    for (let j = Y0; j < Y1; j++) for (let i = X0; i < X1; i++) {
      const p = ((j - P.oy) * P.w + (i - P.ox)) * 4;
      if (o.mask && d[p + 3] === 0) continue;
      let t = dir === 'v' ? (j - Y0) / Math.max(1, Y1 - Y0 - 1) : dir === 'h' ? (i - X0) / Math.max(1, X1 - X0 - 1)
        : Math.hypot(i - cx, j - cy) / rr;
      if (t > 1) { if (dir === 'r' && o.clip) continue; t = 1; }
      // позиция между соседними стопами + порог Байера → выбираем один из двух цветов (дизеринг)
      let s = 0; while (s < st.length - 2 && t > st[s + 1][0]) s++;
      const a = st[s], b = st[Math.min(s + 1, st.length - 1)];
      let f = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 0;
      if (steps) f = Math.floor(f * steps + bayer(i, j)) / steps;           // ступени + дизер между ними
      const col = steps ? mix(a[1], b[1], Math.min(1, f)) : (f > bayer(i, j) ? b[1] : a[1]);
      const al = dir === 'r' && o.fade ? A * (1 - t) : A;
      if (al >= 1) { d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; d[p + 3] = 255; }
      else if (al > 0) {
        const q = o.ditherAlpha ? (al > bayer(i + 1, j + 2) ? 1 : 0) : al;
        if (!q) continue;
        d[p] += (col[0] - d[p]) * q; d[p + 1] += (col[1] - d[p + 1]) * q; d[p + 2] += (col[2] - d[p + 2]) * q;
        d[p + 3] = Math.max(d[p + 3], Math.round(255 * q));
      }
    }
    P.put();
  }

  // ---------- объём по силуэту ----------
  // Размытая маска непрозрачности даёт «нормаль» у кромок: кромки к свету (верх-лево) светлеют, дальние темнеют.
  // o.r — радиус размытия (лог. px), o.lit / o.dark — сила света и тени, o.vert — затемнение к низу силуэта,
  // o.steps — сколько ступеней (дизер между ними), o.keepInk — не трогать почти чёрные пиксели (контуры)
  function light(c, o = {}) {
    const P = pix(c), { w, h, d, k } = P, n = w * h;
    const R = Math.max(1, Math.round((o.r || 3) * k));
    const lit = o.lit == null ? 0.22 : o.lit, dark = o.dark == null ? 0.3 : o.dark;
    const vert = o.vert || 0, steps = o.steps || 4, keepInk = o.keepInk !== false;
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = d[i * 4 + 3] > 8 ? 1 : 0;
    // двойное размытие окном — приближение гауссова
    const tmp = new Float32Array(n), bl = new Float32Array(n);
    const box = (src, dst, horiz) => {
      const len = horiz ? w : h, lines = horiz ? h : w;
      for (let L = 0; L < lines; L++) {
        let acc = 0;
        const at = (q) => (horiz ? L * w + q : q * w + L);
        for (let q = -R; q <= R; q++) acc += src[at(Math.max(0, Math.min(len - 1, q)))];
        for (let q = 0; q < len; q++) {
          dst[at(q)] = acc / (2 * R + 1);
          acc += src[at(Math.min(len - 1, q + R + 1))] - src[at(Math.max(0, q - R))];
        }
      }
    };
    box(a, tmp, true); box(tmp, bl, false); box(bl, tmp, true); box(tmp, bl, false);
    // вертикальная протяжённость силуэта по столбцам (для затемнения низа)
    let top = null, bot = null;
    if (vert) {
      top = new Int32Array(w).fill(-1); bot = new Int32Array(w).fill(-1);
      for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) if (a[j * w + i]) { if (top[i] < 0) top[i] = j; bot[i] = j; }
    }
    const LX = -0.6, LY = -0.8, gain = 2.2;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const q = j * w + i; if (!a[q]) continue;
      const p = q * 4, r0 = d[p], g0 = d[p + 1], b0 = d[p + 2];
      if (keepInk && r0 + g0 + b0 < 120) continue;
      const gx = bl[q + (i < w - 1 ? 1 : 0)] - bl[q - (i > 0 ? 1 : 0)];
      const gy = bl[q + (j < h - 1 ? w : 0)] - bl[q - (j > 0 ? w : 0)];
      // наружная нормаль = −градиент; свет падает с (LX, LY)
      let v = (-gx * LX - gy * LY) * R * gain;
      if (vert && bot[i] > top[i]) v -= vert * Math.max(0, ((j - top[i]) / (bot[i] - top[i]) - 0.35) / 0.65);
      if (v > 1) v = 1; else if (v < -1) v = -1;
      const s = Math.floor(Math.abs(v) * steps + bayer(i, j) - 0.25) / steps;
      if (s <= 0) continue;
      const tgt = v > 0 ? LITE : DARK, f = (v > 0 ? lit : dark) * s;
      d[p] = r0 + (tgt[0] - r0) * f; d[p + 1] = g0 + (tgt[1] - g0) * f; d[p + 2] = b0 + (tgt[2] - b0) * f;
    }
    P.put();
    return c;
  }

  // ---------- тонировка участка ----------
  // fn(u, v) → k ∈ [−1, 1] по относительным координатам участка (0..1): k < 0 — тень, k > 0 — свет.
  // Меняются только непрозрачные пиксели; переход между ступенями — дизерингом на тонких пикселях.
  // o.keepInk — не трогать контуры; o.steps — ступеней на единицу k (по умолчанию 16).
  // Отложенный режим: defer(c) копит тонировки холста, flush(c) применяет их за одно чтение пикселей
  // (getImageData на каждый вызов дорог: на спрайт здания их было 3–4).
  const queued = new Map();
  function defer(c) { queued.set(c.canvas || c, []); }
  function flush(c) {
    c = c.canvas || c;
    const q = queued.get(c); queued.delete(c);
    if (!q || !q.length) return;
    const k = c.hi ? G.gfx.HI : 1, ctx = c.getContext('2d');
    const img = ctx.getImageData(0, 0, c.width, c.height);
    for (const a of q) tintData(img.data, c.width, c.height, 0, 0, k, ...a);
    ctx.putImageData(img, 0, 0);
  }
  function tint(c, x, y, w, h, fn, o = {}) {
    if (c.canvas) c = c.canvas;
    const q = queued.get(c);
    if (q) { q.push([x, y, w, h, fn, o]); return; }
    const k = c.hi ? G.gfx.HI : 1, ctx = c.getContext('2d');
    const X0 = Math.max(0, Math.round(x * k)), Y0 = Math.max(0, Math.round(y * k));
    const X1 = Math.min(c.width, Math.round((x + w) * k)), Y1 = Math.min(c.height, Math.round((y + h) * k));
    if (X1 <= X0 || Y1 <= Y0) return;
    const img = ctx.getImageData(X0, Y0, X1 - X0, Y1 - Y0);
    tintData(img.data, X1 - X0, Y1 - Y0, X0, Y0, k, x, y, w, h, fn, o);
    ctx.putImageData(img, X0, Y0);
  }
  // d — пиксели куска холста размером dw×dh (тонкие px), начинающегося с (ox, oy)
  function tintData(d, dw, dh, ox, oy, k, x, y, w, h, fn, o = {}) {
    const X0 = Math.max(ox, Math.round(x * k)), Y0 = Math.max(oy, Math.round(y * k));
    const X1 = Math.min(ox + dw, Math.round((x + w) * k)), Y1 = Math.min(oy + dh, Math.round((y + h) * k));
    const fw = Math.round((x + w) * k) - Math.round(x * k), fh = Math.round((y + h) * k) - Math.round(y * k);
    const bx = Math.round(x * k), by = Math.round(y * k);
    const steps = o.steps || 16, keepInk = o.keepInk !== false;
    // fn считаем раз на логический пиксель (k×k тонких) — дизер всё равно идёт по тонким
    const lw = Math.ceil(fw / k) + 1, row = new Float32Array(lw);
    let rowJ = -1;
    for (let J = Y0; J < Y1; J++) {
      const lj = Math.floor((J - by) / k);
      if (lj !== rowJ) { rowJ = lj; row.fill(NaN); }
      for (let I = X0; I < X1; I++) {
      const p = ((J - oy) * dw + (I - ox)) * 4;
      if (d[p + 3] < 8) continue;
      if (keepInk && d[p] + d[p + 1] + d[p + 2] < 120) continue;
      const li = Math.floor((I - bx) / k);
      let v = row[li];
      if (v !== v) v = row[li] = fn((li * k + k / 2) / fw, (lj * k + k / 2) / fh);
      if (!v) continue;
      const s = Math.floor(Math.abs(v) * steps + bayer(I, J)) / steps;
      if (s <= 0) continue;
      const t = v > 0 ? LITE : DARK, f = Math.min(1, s);
      d[p] += (t[0] - d[p]) * f; d[p + 1] += (t[1] - d[p + 1]) * f; d[p + 2] += (t[2] - d[p + 2]) * f;
      }
    }
  }

  // ---------- шар со светом ----------
  // Эллипс (cx, cy, rx, ry) в лог. px, цвет — по освещённости сферы из ступеней cols (тёмная → светлая).
  // o.noise — «листва»: шум яркости по зёрнам o.grain px; o.seed — для шума; o.rim — тёмная кайма снизу-справа
  function ball(c, cx, cy, rx, ry, cols, o = {}) {
    if (c.canvas) c = c.canvas;
    const kk = c.hi ? G.gfx.HI : 1;
    const P = pix(c, [Math.floor((cx - rx) * kk), Math.floor((cy - ry) * kk), Math.ceil((cx + rx) * kk), Math.ceil((cy + ry) * kk)]);
    const k = P.k, C = cols.map(rgb), n = C.length;
    const X0 = P.ox, X1 = P.ox + P.w, Y0 = P.oy, Y1 = P.oy + P.h;
    const LX = -0.48, LY = -0.62, LZ = 0.62, noise = o.noise || 0, gr = (o.grain || 2) * k, seed = o.seed || 0;
    const Hh = G.util.hash2;
    for (let j = Y0; j < Y1; j++) for (let i = X0; i < X1; i++) {
      const nx = ((i + 0.5) / k - cx) / rx, ny = ((j + 0.5) / k - cy) / ry, dd = nx * nx + ny * ny;
      if (dd > 1) continue;
      const nz = Math.sqrt(1 - dd);
      let lam = Math.max(0, nx * LX + ny * LY + nz * LZ);
      if (noise) lam += (Hh(Math.floor(i / gr) + seed * 7, Math.floor(j / gr), 1300 + seed) - 0.5) * noise;
      if (o.rim && dd > 0.78 && nx + ny > 0.2) lam = Math.min(lam, 0.1);
      const f = Math.max(0, Math.min(n - 1, Math.floor(lam * (n - 0.01) + (bayer(i, j) - 0.5) * 0.5)));
      const p = ((j - P.oy) * P.w + (i - P.ox)) * 4, col = C[f];
      P.d[p] = col[0]; P.d[p + 1] = col[1]; P.d[p + 2] = col[2]; P.d[p + 3] = 255;
    }
    P.put();
  }

  // ---------- мягкая статичная тень ----------
  // Ядро плотнее, к краю — полутень дизерингом (на тонких пикселях). Рисуется в логических координатах.
  // плотность 0..1 → одна из 4 ступеней прозрачности, между ступенями — дизеринг
  const level = (v, i, j) => (v <= 0 ? 0 : Math.min(1, Math.floor(v * 4 + bayer(i, j)) / 4));
  const shCache = {};
  function shadowImg(rx, ry, a, col) {
    const key = rx + ':' + ry + ':' + a + ':' + col;
    if (shCache[key]) return shCache[key];
    const c = G.gfx.canvas(rx * 2 + 2, ry * 2 + 2), P = pix(c), k = P.k, C = rgb(col);
    for (let j = 0; j < P.h; j++) for (let i = 0; i < P.w; i++) {
      const dx = (i + 0.5) / k - (rx + 1), dy = (j + 0.5) / k - (ry + 1);
      const t = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
      if (t >= 1) continue;
      const lv = level(t < 0.45 ? 1 : (1 - t) / 0.55, i, j);   // ядро → полутень ступенями
      if (!lv) continue;
      const p = (j * P.w + i) * 4;
      P.d[p] = C[0]; P.d[p + 1] = C[1]; P.d[p + 2] = C[2]; P.d[p + 3] = Math.round(255 * a * lv);
    }
    P.put();
    return (shCache[key] = c);
  }
  function shadow(ctx, cx, cy, rx, ry, a = 0.3, col = '#141032') {
    rx = Math.max(2, Math.round(rx)); ry = Math.max(1, Math.round(ry));
    ctx.drawImage(shadowImg(rx, ry, a, col), Math.round(cx - rx - 1), Math.round(cy - ry - 1));
  }

  // мягкая тень произвольной формы: dens(x, y) → 0..1 в логических px холста w×h (полутень — дизерингом)
  function soft(w, h, dens, a = 0.3, col = '#141032') {
    const c = G.gfx.canvas(w, h), P = pix(c), k = P.k, C = rgb(col), A = Math.round(255 * a);
    for (let j = 0; j < P.h; j++) for (let i = 0; i < P.w; i++) {
      const lv = level(dens((i + 0.5) / k, (j + 0.5) / k), i, j);
      if (!lv) continue;
      const p = (j * P.w + i) * 4;
      P.d[p] = C[0]; P.d[p + 1] = C[1]; P.d[p + 2] = C[2]; P.d[p + 3] = Math.round(A * lv);
    }
    P.put();
    return c;
  }
  // плотность внутри прямоугольника с мягким краем pen
  const box = (x, y, x0, y0, x1, y1, pen) => Math.max(0, Math.min(1, Math.min(x - x0, x1 - x, y - y0, y1 - y) / pen));

  return { rgb, hex, mix, tone, toneHex, ramp, bayer, pix, grad, tint, defer, flush, light, ball, shadow, shadowImg, soft, box, DARK, LITE };
})();
