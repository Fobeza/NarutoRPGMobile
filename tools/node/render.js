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
    this.canvas = canvas; this.buf = null; this.w = this.hh = 0;
    this.fillStyle = '#000'; this.globalAlpha = 1;
    this.m = [1, 0, 0, 1, 0, 0]; this.stack = []; this.clips = [];
    this.path = []; this.cur = null;
  }
  ensure() {
    const w = this.canvas.width | 0, hh = this.canvas.height | 0;
    if (!this.buf || this.w !== w || this.hh !== hh) { this.w = w; this.hh = hh; this.buf = Buffer.alloc(w * hh * 3); }
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
    const o = (y * this.w + x) * 3;
    this.buf[o] = this.buf[o] + (r - this.buf[o]) * a;
    this.buf[o + 1] = this.buf[o + 1] + (g - this.buf[o + 1]) * a;
    this.buf[o + 2] = this.buf[o + 2] + (b - this.buf[o + 2]) * a;
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
  save() { this.stack.push({ m: this.m.slice(), clips: this.clips.slice(), alpha: this.globalAlpha }); }
  restore() { const s = this.stack.pop(); if (s) { this.m = s.m; this.clips = s.clips; this.globalAlpha = s.alpha; } }
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
    if (img.__raster) { img.__raster.ensure(); src = { w: img.__raster.w, h: img.__raster.hh, px: img.__raster.buf, ch: 3 }; }
    else if (String(img._src || img.src || '').startsWith('data:image/png')) src = Object.assign({ ch: 4 }, this.imgBuf(img));
    if (!src) return;
    const m = this.m;
    if (m[1] !== 0 || m[2] !== 0) return;   // только осевые преобразования
    const [ox, oy] = this.tp(dx, dy);
    const sX = m[0] * dw / dw, sY = m[3];
    for (let y = 0; y < Math.round(dh * sY); y++) for (let x = 0; x < Math.round(dw * sX); x++) {
      const ux = Math.floor(sx + (x / (dw * sX)) * sw), uy = Math.floor(sy + (y / (dh * sY)) * sh);
      if (ux < 0 || uy < 0 || ux >= src.w || uy >= src.h) continue;
      const o = (uy * src.w + ux) * src.ch;
      const al = (src.ch === 4 ? src.px[o + 3] / 255 : 1) * this.globalAlpha;
      if (al <= 0) continue;
      this.blend(Math.round(ox + x), Math.round(oy + y), src.px[o], src.px[o + 1], src.px[o + 2], al);
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
  getImageData(x, y, w, hh) { return { data: new Uint8ClampedArray(w * hh * 4), width: w, height: hh }; }
  putImageData() {}
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
const W = 240, H = 300;
G.screen.W = W; G.screen.H = H;
h.seed();
const screen = { width: W, height: H };
const ctx = new Raster(screen);

function frame(name, setup, bg) {
  try {
    G.scenes.stack.length = 0;
    setup();
    for (let i = 0; i < 6; i++) for (const s of G.scenes.stack.slice()) s.update && s.update(0.05);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.clips = []; ctx.stack = [];
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (bg) bg();   // подложка «мира» рисуется после очистки, под прозрачные сцены
    for (const s of G.scenes.stack.slice()) s.draw && s.draw(ctx);
    // ×2 для глаз
    const big = Buffer.alloc(W * 2 * H * 2 * 3);
    ctx.ensure();
    for (let y = 0; y < H * 2; y++) for (let x = 0; x < W * 2; x++) {
      const o = ((y >> 1) * W + (x >> 1)) * 3, d = (y * W * 2 + x) * 3;
      big[d] = ctx.buf[o]; big[d + 1] = ctx.buf[o + 1]; big[d + 2] = ctx.buf[o + 2];
    }
    fs.writeFileSync(path.join(OUT, name + '.png'), encodePng(W * 2, H * 2, big));
    console.log('  ✓', name);
  } catch (e) { console.log('  ✗', name, e.message, '|', (e.stack || '').split('\n')[1]); }
}

// подложка «мира» вместо сцены world: для прозрачных панелей важен фон, а не карта
function backdrop() {
  ctx.fillStyle = '#181420'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#221c2c'; ctx.fillRect(0, 180, W, 120);
  ctx.fillStyle = '#2e6a32'; ctx.fillRect(0, 176, W, 6);
}
frame('ui_world_menu', () => { G.scenes.push(G.scenes.make('menu')); }, backdrop);
frame('ui_bag', () => {
  G.state.inv = { kunai: 3, ramen_miso: 2, bandage: 1, book_history: 1, flowers_s: 2, shuriken: 5 };
  G.scenes.push(G.scenes.make('bag')); }, backdrop);
frame('ui_status', () => { G.scenes.push(G.scenes.make('status')); });
frame('ui_journal', () => { G.scenes.push(G.scenes.make('journal')); });
frame('ui_shop', () => { G.scenes.push(G.scenes.make('shop', 'ichiraku')); }, backdrop);
frame('ui_title', () => { G.scenes.push(G.scenes.make('title')); });
console.log('кадры в', OUT);
