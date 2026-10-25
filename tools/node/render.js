// Программный рендер кадров интерфейса: софтверный растер вместо браузера.
//   node tools/node/render.js /tmp/out
// Рисует набор сцен в PNG (×2 для читаемости), чтобы-theme-правки видеть глазами.
// Поддержано: fillRect/пути/clip/transform/drawImage (offscreen-холсты и data-URI PNG).
'use strict';
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const h = require('./harness.js');
const { G } = h;

// ─────────── PNG: декодер ───────────
const pngCache = new Map();
function decodePng(buf) {
  let pos = 8, idat = [], plte = null, trns = null, w = 0, hgt = 0, ct = 0, bd = 0, inter = 0;
  while (pos < buf.length) {
    const ln = buf.readUInt32BE(pos); const tag = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + ln); pos += 12 + ln;
    if (tag === 'IHDR') { w = data.readUInt32BE(0); hgt = data.readUInt32BE(4); bd = data[8]; ct = data[9]; inter = data[12]; }
    else if (tag === 'PLTE') plte = data;
    else if (tag === 'tRNS') trns = data;
    else if (tag === 'IDAT') idat.push(data);
    else if (tag === 'IEND') break;
  }
  if (bd !== 8 || inter) throw new Error('png: только 8 бит без чересстрочности');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
  const stride = w * ch;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(hgt * stride);
  let p = 0;
  for (let y = 0; y < hgt; y++) {
    const f = raw[p++];
    const line = Buffer.from(raw.subarray(p, p + stride)); p += stride;
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[i] = v & 255;
    }
    line.copy(out, y * stride);
  }
  const px = Buffer.alloc(w * hgt * 4);
  for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) {
    const i = y * stride + x * ch, o = (y * w + x) * 4;
    if (ct === 6) { px[o] = out[i]; px[o + 1] = out[i + 1]; px[o + 2] = out[i + 2]; px[o + 3] = out[i + 3]; }
    else if (ct === 2) { px[o] = out[i]; px[o + 1] = out[i + 1]; px[o + 2] = out[i + 2]; px[o + 3] = 255; }
    else if (ct === 0) { px[o] = px[o + 1] = px[o + 2] = out[i]; px[o + 3] = 255; }
    else if (ct === 4) { px[o] = px[o + 1] = px[o + 2] = out[i]; px[o + 3] = out[i + 1]; }
    else { const j = out[i] * 3; px[o] = plte[j]; px[o + 1] = plte[j + 1]; px[o + 2] = plte[j + 2]; px[o + 3] = trns && trns[out[i]] !== undefined ? trns[out[i]] : 255; }
  }
  return { w, h: hgt, px };
}

// ─────────── софтверный контекст ───────────
class Raster {
  constructor(canvas) {
    this.canvas = canvas; this.buf = null; this.w = this.hh = 0; this.mask = null;
    this.fillStyle = '#000'; this.globalAlpha = 1; this.globalCompositeOperation = 'source-over';
    this.m = [1, 0, 0, 1, 0, 0]; this.stack = []; this.clips = [];
    this.path = []; this.cur = null;
  }
  ensure() {
    const w = this.canvas.width | 0, hh = this.canvas.height | 0;
    if (!this.buf || this.w !== w || this.hh !== hh) { this.w = w; this.hh = hh; this.buf = Buffer.alloc(w * hh * 3); this.mask = Buffer.alloc(w * hh); }
  }
  parse(c) {
    if (typeof c !== 'string') return [0, 0, 0, 1];
    if (c[0] === '#') {
      if (c.length === 4) return [parseInt(c[1] + c[1], 16), parseInt(c[2] + c[2], 16), parseInt(c[3] + c[3], 16), 1];
      return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 1];
    }
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (m) { const p = m[1].split(',').map((s) => parseFloat(s)); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    return [0, 0, 0, 1];
  }
  tp(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  clipRect() { return this.clips.length ? this.clips[this.clips.length - 1] : [0, 0, this.w, this.hh]; }
  blend(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.hh) return;
    const cr = this.clipRect();
    if (x < cr[0] || y < cr[1] || x >= cr[2] || y >= cr[3]) return;
    const o = (y * this.w + x) * 3, p = y * this.w + x;
    const mode = this.globalCompositeOperation;
    if (mode === 'source-in') {                 // цвет ложится только на уже нарисованное (силуэты, тонировка шрифта)
      if (!this.mask[p]) return;
      this.buf[o] = r; this.buf[o + 1] = g; this.buf[o + 2] = b;
      return;
    }
    if (mode === 'destination-out') {           // стирание: чем плотнее цвет, тем прозрачнее
      const k = 1 - a;
      this.buf[o] *= k; this.buf[o + 1] *= k; this.buf[o + 2] *= k;
      this.mask[p] = Math.round(this.mask[p] * k);
      return;
    }
    if (mode === 'lighter') {                   // свет: сложение
      this.buf[o] = Math.min(255, this.buf[o] + r * a);
      this.buf[o + 1] = Math.min(255, this.buf[o + 1] + g * a);
      this.buf[o + 2] = Math.min(255, this.buf[o + 2] + b * a);
      this.mask[p] = Math.max(this.mask[p], Math.round(255 * a));
      return;
    }
    this.buf[o] = this.buf[o] + (r - this.buf[o]) * a;
    this.buf[o + 1] = this.buf[o + 1] + (g - this.buf[o + 1]) * a;
    this.buf[o + 2] = this.buf[o + 2] + (b - this.buf[o + 2]) * a;
    this.mask[p] = Math.max(this.mask[p], Math.round(255 * a));
  }
  fillRect(x, y, w, hh) {
    this.ensure();
    const [r, g, b, al] = this.parse(this.fillStyle); const a = al * this.globalAlpha; if (a <= 0) return;
    const m = this.m;
    if (m[1] === 0 && m[2] === 0) {
      const [x0, y0] = this.tp(x, y);
      const x1 = x0 + m[0] * w, y1 = y0 + m[3] * hh;
      const xa = Math.round(Math.min(x0, x1)), xb = Math.round(Math.max(x0, x1));
      const ya = Math.round(Math.min(y0, y1)), yb = Math.round(Math.max(y0, y1));
      for (let yy = ya; yy < yb; yy++) for (let xx = xa; xx < xb; xx++) this.blend(xx, yy, r, g, b, a);
      return;
    }
    this.poly([this.tp(x, y), this.tp(x + w, y), this.tp(x + w, y + hh), this.tp(x, y + hh)], r, g, b, a);
  }
  clearRect(x, y, w, hh) { const f = this.fillStyle; this.fillStyle = '#000'; this.globalAlpha = 1; this.fillRect(x, y, w, hh); this.fillStyle = f; }
  poly(pts, r, g, b, a) {
    let minY = 1e9, maxY = -1e9;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    minY = Math.max(0, Math.floor(minY)); maxY = Math.min(this.hh - 1, Math.ceil(maxY));
    for (let y = minY; y <= maxY; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
      xs.sort((u, v) => u - v);
      for (let i = 0; i + 1 < xs.length; i += 2)
        for (let x = Math.max(0, Math.round(xs[i])); x < Math.min(this.w, Math.round(xs[i + 1])); x++) this.blend(x, y, r, g, b, a);
    }
  }
  save() { this.stack.push({ m: this.m.slice(), clips: this.clips.slice(), alpha: this.globalAlpha, mode: this.globalCompositeOperation }); }
  restore() { const s = this.stack.pop(); if (s) { this.m = s.m; this.clips = s.clips; this.globalAlpha = s.alpha; this.globalCompositeOperation = s.mode; } }
  translate(x, y) { const m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
  scale(x, y) { const m = this.m; m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; }
  rotate(a) { const m = this.m, c = Math.cos(a), s = Math.sin(a);
    this.m = [m[0] * c + m[2] * s, m[1] * c + m[3] * s, m[0] * -s + m[2] * c, m[1] * -s + m[3] * c, m[4], m[5]]; }
  setTransform(a, b, c, d, e, f) { this.m = [a || 1, b || 0, c || 0, d || 1, e || 0, f || 0]; }
  beginPath() { this.path = []; this.cur = null; }
  moveTo(x, y) { this.cur = [this.tp(x, y)]; this.path.push(this.cur); }
  lineTo(x, y) { if (!this.cur) return this.moveTo(x, y); this.cur.push(this.tp(x, y)); }
  closePath() { this.cur = null; }
  rect(x, y, w, hh) { this.path.push([this.tp(x, y), this.tp(x + w, y), this.tp(x + w, y + hh), this.tp(x, y + hh)]); }
  // эллипс как путь (для мебели: сиденья, подушки, кроны) — приближение ломаной
  ellipse(cx, cy, rx, ry, rot = 0) {
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      pts.push(this.tp(cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)));
    }
    this.path.push(pts); this.cur = null;
  }
  arc(cx, cy, r, a0, a1) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = a0 + (a1 - a0) * (i / 16);
      pts.push(this.tp(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
    this.path.push(pts); this.cur = null;
  }
  quadraticCurveTo(cx, cy, x, y) { this.lineTo(cx, cy); this.lineTo(x, y); }
  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) { this.lineTo(c1x, c1y); this.lineTo(c2x, c2y); this.lineTo(x, y); }
  fill() {
    this.ensure();
    const [r, g, b, al] = this.parse(this.fillStyle); const a = al * this.globalAlpha;
    for (const sub of this.path) if (sub.length > 2) this.poly(sub, r, g, b, a);
  }
  stroke() { this.fill(); }
  clip() {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const sub of this.path) for (const p of sub) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    const cr = this.clipRect();
    this.clips.push([Math.max(cr[0], Math.floor(x0)), Math.max(cr[1], Math.floor(y0)), Math.min(cr[2], Math.ceil(x1)), Math.min(cr[3], Math.ceil(y1))]);
  }
  drawImage(img, ...a) {
    this.ensure();
    let sx = 0, sy = 0, sw, sh, dx, dy, dw, dh;
    if (a.length === 2) { [dx, dy] = a; sw = img.width; sh = img.height; dw = sw; dh = sh; }
    else if (a.length === 4) { [dx, dy, dw, dh] = a; sw = img.width; sh = img.height; sx = sy = 0; }
    else { [sx, sy, sw, sh, dx, dy, dw, dh] = a; }
    let src = null;
    if (img.__raster) {
      img.__raster.ensure();
      src = { w: img.__raster.w, h: img.__raster.hh, px: img.__raster.buf, mask: img.__raster.mask, ch: 3 };
      // «подробные» холсты игры (G.gfx.canvas, HI=2) задают источник в логических пикселях — как патч drawImage в gfx/sprites.js
      if (img.hi && img.lw) { const k = img.__raster.w / img.lw; sx *= k; sy *= k; sw *= k; sh *= k; }
    }
    else if (String(img._src || img.src || '').startsWith('data:image/png')) src = Object.assign({ ch: 4 }, this.imgBuf(img));
    if (!src) return;
    const m = this.m;
    const det = m[0] * m[3] - m[1] * m[2];
    if (!det) return;
    // Идём по пикселям холста и обратным преобразованием ищем точку источника:
    // так работают и повороты на 90° (материалы тайлов крутятся), и масштаб.
    const cs = [[dx, dy], [dx + dw, dy], [dx, dy + dh], [dx + dw, dy + dh]].map(([x, y]) => this.tp(x, y));
    const bx0 = Math.max(0, Math.floor(Math.min(...cs.map((p) => p[0])))), bx1 = Math.min(this.w, Math.ceil(Math.max(...cs.map((p) => p[0]))));
    const by0 = Math.max(0, Math.floor(Math.min(...cs.map((p) => p[1])))), by1 = Math.min(this.hh, Math.ceil(Math.max(...cs.map((p) => p[1]))));
    for (let py = by0; py < by1; py++) for (let pxx = bx0; pxx < bx1; pxx++) {
      const rx = pxx + 0.5 - m[4], ry = py + 0.5 - m[5];
      const u = (m[3] * rx - m[2] * ry) / det, v = (-m[1] * rx + m[0] * ry) / det;
      if (u < dx || v < dy || u >= dx + dw || v >= dy + dh) continue;
      const ux = Math.floor(sx + ((u - dx) / dw) * sw), uy = Math.floor(sy + ((v - dy) / dh) * sh);
      if (ux < 0 || uy < 0 || ux >= src.w || uy >= src.h) continue;
      const o = (uy * src.w + ux) * src.ch;
      const al = (src.ch === 4 ? src.px[o + 3] / 255 : (src.mask ? src.mask[uy * src.w + ux] / 255 : 1)) * this.globalAlpha;
      if (al <= 0) continue;
      this.blend(pxx, py, src.px[o], src.px[o + 1], src.px[o + 2], al);
    }
  }
  imgBuf(img) {
    const key = img._src || img.src;
    if (!pngCache.has(key)) pngCache.set(key, decodePng(Buffer.from(key.slice('data:image/png;base64,'.length), 'base64')));
    return pngCache.get(key);
  }
  measureText(t) { return { width: String(t).length * 6 }; }
  createLinearGradient() { return { addColorStop() {} }; }
  createRadialGradient() { return { addColorStop() {} }; }
  createPattern() { return null; }
  // Пиксельные операции: нужны разбору арта (decodeArt), перекраске одежды и тонировке земли.
  createImageData(w, hh) { return { data: new Uint8ClampedArray(Math.max(4, (w | 0) * (hh | 0) * 4)), width: w | 0, height: hh | 0 }; }
  getImageData(x, y, w, hh) {
    this.ensure();
    const out = this.createImageData(w, hh);
    for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
      const sx2 = (x | 0) + i, sy2 = (y | 0) + j;
      const o = (j * w + i) * 4;
      if (sx2 < 0 || sy2 < 0 || sx2 >= this.w || sy2 >= this.hh) { out.data[o + 3] = 0; continue; }
      const s = (sy2 * this.w + sx2) * 3;
      out.data[o] = this.buf[s]; out.data[o + 1] = this.buf[s + 1]; out.data[o + 2] = this.buf[s + 2]; out.data[o + 3] = this.mask[sy2 * this.w + sx2];
    }
    return out;
  }
  putImageData(img, x, y) {
    this.ensure();
    const d = img.data || img, w = img.width | 0, hh = img.height | 0;
    for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
      const o = (j * w + i) * 4, a = (d[o + 3] == null ? 255 : d[o + 3]) / 255;
      if (a <= 0) continue;
      this.blend((x | 0) + i, (y | 0) + j, d[o], d[o + 1], d[o + 2], a);
    }
  }
}

// offscreen-холсты игры → тоже растер
const origCreate = h.document.createElement;
h.document.createElement = (t) => {
  const el = origCreate(String(t));
  if (String(t).toLowerCase() === 'canvas') {
    el.getContext = () => { if (!el.__raster) { el.__raster = new Raster(el); } return el.__raster; };
  }
  return el;
};

// ─────────── PNG: кодер ───────────
function encodePng(w, hh, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * hh);
  for (let y = 0; y < hh; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const chunk = (tag, data) => {
    const b = Buffer.alloc(8 + data.length + 4);
    b.writeUInt32BE(data.length, 0); b.write(tag, 4, 'latin1'); data.copy(b, 8);
    b.writeUInt32BE(crc(Buffer.concat([Buffer.from(tag, "latin1"), data])), 8 + data.length);
    return b;
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(hh, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
let CRC_T = null;
function crc(buf) {
  if (!CRC_T) { CRC_T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_T[n] = c >>> 0; } }
  let c = 0xffffffff;
  for (const b of buf) c = CRC_T[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ─────────── кадры ───────────
const OUT = process.argv[2] || '/tmp';
fs.mkdirSync(OUT, { recursive: true });
const W = 240, H = 300;
G.screen.W = W; G.screen.H = H;
h.seed();
const screen = { width: W, height: H };
const ctx = new Raster(screen);

function frame(name, setup, bg, sz) {
  try {
    G.scenes.stack.length = 0;
    const FW = sz ? sz[0] : W, FH = sz ? sz[1] : H;
    screen.width = FW; screen.height = FH; ctx.ensure();
    setup();
    for (let i = 0; i < 6; i++) for (const s of G.scenes.stack.slice()) s.update && s.update(0.05);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.clips = []; ctx.stack = [];
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, FW, FH);
    if (bg) bg();   // подложка «мира» рисуется после очистки, под прозрачные сцены
    for (const s of G.scenes.stack.slice()) s.draw && s.draw(ctx);
    // ×2 для глаз
    const big = Buffer.alloc(FW * 2 * FH * 2 * 3);
    for (let y = 0; y < FH * 2; y++) for (let x = 0; x < FW * 2; x++) {
      const o = ((y >> 1) * FW + (x >> 1)) * 3, d = (y * FW * 2 + x) * 3;
      big[d] = ctx.buf[o]; big[d + 1] = ctx.buf[o + 1]; big[d + 2] = ctx.buf[o + 2];
    }
    fs.writeFileSync(path.join(OUT, name + '.png'), encodePng(FW * 2, FH * 2, big));
    console.log('  ✓', name);
  } catch (e) { console.log('  ✗', name, e.message, '|', (e.stack || '').split('\n')[1]); }
}

// подложка «мира» вместо сцены world: для прозрачных панелей важен фон, а не карта
function backdrop() {
  ctx.fillStyle = '#181420'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#221c2c'; ctx.fillRect(0, 180, W, 120);
  ctx.fillStyle = '#2e6a32'; ctx.fillRect(0, 176, W, 6);
}

function battleFrame(name, enemy, terrain) {
  frame(name, () => {
    const sc = G.scenes.make('battle', { enemy, mode: 'spar', terrain }, () => {});
    G.scenes.stack.length = 0;
    G.scenes.push(sc);
    sc.enter && sc.enter();
    for (let i = 0; i < 40; i++) sc.update(.05);
  }, null, [240, 320]);
}

// ---------- набор кадров: всё в main(), чтобы файл можно было подключать из других скриптов ----------
// Комната и улица: рисуем карту целиком (земля + объекты + персонаж), а не только тайлы —
// так видно мебель, пропы и масштаб. Карта собирается тем же кодом, что в игре.
function worldFrame(name, setup) {
  frame(name, () => {
    const m = G.world.get('konoha');
    G.scenes.push({ name, draw(c) {
      c.fillStyle = '#101018'; c.fillRect(0, 0, W, H);
      const cam = setup(m);
      const T = G.CONFIG.TILE;
      // renderTile, а не drawTile: видны вода, тропинки, мост и переходы — как в игре
      for (let y = 0; y < Math.ceil(H / T) + 1; y++) for (let x = 0; x < Math.ceil(W / T) + 1; x++) {
        const tx = cam.tx + x, ty = cam.ty + y;
        G.tiles.renderTile(c, m, tx, ty, x * T, y * T);
      }
      const objs = m.objects.filter((o) => o.img).sort((a, b) => a.sortY - b.sortY);
      c.save(); c.translate(-cam.tx * T, -cam.ty * T);
      for (const o of objs) if (o.layer === 'floor') c.drawImage(o.img, o.x + o.ox, o.y + o.oy);
      for (const o of objs) if (o.layer !== 'floor') c.drawImage(o.img, o.x + o.ox, o.y + o.oy);
      if (cam.npc) G.chars.draw(c, cam.npc, 'down', 0, cam.npcX, cam.npcY);
      c.restore();
    } });
  });
}

function roomFrame(name, id) {
  frame(name, () => {
    const b = G.world.konoha().landmarks[id] || G.world.konoha().buildings[0];
    const m = G.interiors.build(b.interior);
    G.scenes.push({ name, draw(c) {
      c.fillStyle = '#101018'; c.fillRect(0, 0, W, H);
      const T = G.CONFIG.TILE;
      const tx0 = Math.max(0, Math.floor((m.w - W / T) / 2)), ty0 = Math.max(0, Math.floor((m.h - H / T) / 2));
      // маленькая комната — по центру кадра, чтобы было видно всю
      c.save();
      c.translate(Math.round(Math.max(0, (W - (Math.min(m.w, W / T)) * T) / 2)), Math.round(Math.max(0, (H - (Math.min(m.h, H / T)) * T) / 2)));
      for (let y = 0; y < Math.ceil(H / T) + 1; y++) for (let x = 0; x < Math.ceil(W / T) + 1; x++) {
        const tx = tx0 + x, ty = ty0 + y;
        G.tiles.renderTile(c, m, tx, ty, x * T, y * T);
      }
      c.translate(-tx0 * T, -ty0 * T);
      const objs = m.objects.filter((o) => o.img).sort((a, b) => a.sortY - b.sortY);
      for (const o of objs) if (o.layer === 'floor') c.drawImage(o.img, o.x + o.ox, o.y + o.oy);
      for (const o of objs) if (o.layer !== 'floor') c.drawImage(o.img, o.x + o.ox, o.y + o.oy);
      c.restore();
    } });
  });
}

function main() {
frame('ui_world_menu', () => { G.scenes.push(G.scenes.make('menu')); }, backdrop);
frame('ui_bag', () => {
  G.state.inv = { kunai: 3, ramen_miso: 2, bandage: 1, book_history: 1, flowers_s: 2, shuriken: 5 };
  G.scenes.push(G.scenes.make('bag')); }, backdrop);
frame('ui_status', () => { G.scenes.push(G.scenes.make('status')); });
frame('ui_journal', () => { G.scenes.push(G.scenes.make('journal')); });
frame('ui_shop', () => { G.scenes.push(G.scenes.make('shop', 'ichiraku')); }, backdrop);
frame('ui_title', () => { G.scenes.push(G.scenes.make('title')); });
// ---------- бой: настоящая сцена, чтобы видеть фоны арен с бойцами и интерфейсом ----------
battleFrame('battle_yard', 'sasuke', 'yard');
battleFrame('battle_field', 'sasuke', 'field');
battleFrame('battle_ring', 'sasuke', 'ring');
battleFrame('battle_night', 'sasuke', 'night');

// ---------- кадры окружения: контакты текстур, комната, улица ----------
const TEX = ['tex_floor','tex_planks','tex_tatami','tex_mat','tex_tilefloor','tex_dustfloor','tex_grass','tex_grass2',
  'tex_flowers','tex_path','tex_sand','tex_stone','tex_darkgrass','tex_dirt','tex_mainroad','tex_darkstone',
  'tex_cobble','tex_brick','tex_gravel','tex_clover','tex_plaza','tex_moss','tex_iwall','tex_vwall'];
{
  const cols = 6, PS = 64, GP = 8;
  const CW = cols * (PS + GP) + GP, CH = Math.ceil(TEX.length / cols) * (PS + GP) + GP;
  frame('ui_tex_contact', () => {
    const IDS = G.tiles.ID;
    G.scenes.push({ name: 'texcontact', draw(c) {
      c.fillStyle = '#101018'; c.fillRect(0, 0, CW, CH);
      TEX.forEach((t, n) => {
        const id = IDS[t.slice(4).toUpperCase()];
        const bx = GP + (n % cols) * (PS + GP), by = GP + Math.floor(n / cols) * (PS + GP);
        for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++)
          G.tiles.drawTile(c, id, bx + tx * 16, by + ty * 16, tx, ty);
      });
    } });
  }, null, [CW, CH]);
}
// дом героя: интерьер собирается тем же кодом, что в игре (G.interiors.build)
// Настоящая карта деревни: река и мостки, тропинки, площадь. Видно землю так, как её видит игрок.
worldFrame('map_river', (m) => ({ tx: 118, ty: 34 }));
worldFrame('map_bridge', (m) => ({ tx: 124, ty: 48 }));
worldFrame('map_paths', (m) => ({ tx: 52, ty: 47 }));
roomFrame('ui_room', 'hero_home');
roomFrame('ui_room_academy', 'academy');
roomFrame('ui_room_shop', 'ichiraku');
frame('ui_room_tiles', () => {
  const ID = G.tiles.ID;
  G.scenes.stack.length = 0;
  G.scenes.push({ name: 'room', draw(c) {
    for (let ty = 0; ty < 12; ty++) for (let tx = 0; tx < 15; tx++) {
      let id = ID.FLOOR;
      if (ty < 2) id = ID.IWALL;
      else if (tx >= 4 && tx < 10 && ty >= 4 && ty < 8) id = ID.TATAMI;
      else if (tx >= 11 && tx < 14 && ty >= 8 && ty < 11) id = ID.MAT;
      G.tiles.drawTile(c, id, tx * 16, ty * 16, tx, ty);
    }
  } });
});
frame('ui_street', () => {
  const ID = G.tiles.ID;
  G.scenes.stack.length = 0;
  G.scenes.push({ name: 'street', draw(c) {
    for (let ty = 0; ty < 12; ty++) for (let tx = 0; tx < 15; tx++) {
      let id = ID.GRASS;
      if (ty < 2) id = ID.VWALL;
      else if (ty >= 4 && ty <= 6) id = ID.MAINROAD;
      else if (tx >= 6 && tx <= 8 && ty > 6) id = ID.PATH;
      else if (tx < 3 && ty > 7) id = ID.COBBLE;
      else if (tx > 11 && ty > 7) id = ID.PLAZA;
      G.tiles.drawTile(c, id, tx * 16, ty * 16, tx, ty);
    }
  } });
});
console.log('кадры в', OUT);

}
if (require.main === module) main();
module.exports = { main, frame, worldFrame, roomFrame, battleFrame, Raster, encodePng, G, OUT, W, H };
