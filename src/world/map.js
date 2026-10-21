// Карта локации: тайлы земли, проходимость, объекты, здания, переходы, NPC.
// Земля запекается кусками (чанками) 32×32 тайла в offscreen-canvas; рисуется только видимое.
// Объекты и здания разложены по «корзинам» 8×8 тайлов — для быстрого поиска при отрисовке и коллизиях.
G.WorldMap = class {
  constructor(id, w, h, opts = {}) {
    this.id = id;
    this.w = w; this.h = h;
    this.name = opts.name || id;
    this.outdoor = !!opts.outdoor;
    this.bg = opts.bg || '#000';
    this.ground = new Uint8Array(w * h);
    this.block = new Uint8Array(w * h);   // 1 — непроходимо (здания и т.п. поверх тайла)
    this.objects = [];                    // {kind, x, y, box, talk, layer, img?, ox, oy}
    this.buildings = [];                  // {tpl, id, tx, ty, w, h, spr, door, name, interior}
    this.warps = [];                      // {rect, to:{map,x,y,dir}, dir:'up'|'down', building}
    this.npcs = [];
    this.districts = [];                  // для названия места
    this.spawn = null;                    // точка появления по умолчанию {x,y,dir}
    this.BK = 8;                          // размер корзины в тайлах
    this.buckets = new Map();
    this.chunks = new Map();
    this.CH = 32;
    this._stamp = 1;
  }

  idx(tx, ty) { return ty * this.w + tx; }
  inside(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }
  get(tx, ty) { return this.inside(tx, ty) ? this.ground[ty * this.w + tx] : -1; }
  set(tx, ty, id) { if (this.inside(tx, ty)) this.ground[ty * this.w + tx] = id; }
  setBlock(tx, ty, v = 1) { if (this.inside(tx, ty)) this.block[ty * this.w + tx] = v; }

  solidTile(tx, ty) {
    if (!this.inside(tx, ty)) return true;
    const i = ty * this.w + tx;
    return this.block[i] === 1 || !!G.tiles.SOLID[this.ground[i]];
  }

  // ---------- Объекты ----------
  addObject(kind, x, y, extra) {
    extra = extra || {};
    const spr = G.tiles.object(kind, G.util.hash2(Math.round(x), Math.round(y), 771));
    const o = Object.assign({ kind, x, y, ox: spr.ox, oy: spr.oy, img: spr.img, layer: spr.layer, w: spr.w, h: spr.h }, extra);
    o.box = extra.box !== undefined ? extra.box : spr.box ? { x: x + spr.box.x, y: y + spr.box.y, w: spr.box.w, h: spr.box.h } : null;
    o.sortY = y;
    this.objects.push(o);
    return o;
  }

  addBuilding(b) {
    // b: {tpl, id, tx, ty, spr, ...}; рисуется как объект с сортировкой по нижней кромке
    const T = G.CONFIG.TILE;
    b.x = b.tx * T; b.y = b.ty * T;
    b.isBuilding = true;
    b.img = b.spr.img; b.ox = b.spr.ox; b.oy = b.spr.oy; b.w = b.spr.w; b.h = b.spr.h;
    if (b.sortY == null) b.sortY = (b.ty + b.th) * T - 1;
    this.buildings.push(b);
    this.objects.push(b);
    return b;
  }

  drawRect(o) { return { x: o.x + o.ox, y: o.y + o.oy, w: o.w, h: o.h }; }

  finalize() {
    const T = G.CONFIG.TILE, S = this.BK * T;
    this.buckets.clear();
    const add = (o, r) => {
      const x0 = Math.floor(r.x / S), x1 = Math.floor((r.x + r.w - 1) / S);
      const y0 = Math.floor(r.y / S), y1 = Math.floor((r.y + r.h - 1) / S);
      for (let by = y0; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) {
        const k = by * 1000 + bx;
        let arr = this.buckets.get(k);
        if (!arr) this.buckets.set(k, (arr = []));
        if (arr[arr.length - 1] !== o) arr.push(o);
      }
    };
    for (const o of this.objects) {
      const r = this.drawRect(o);
      if (o.box) { // объединённый прямоугольник отрисовки и коллизии
        const x = Math.min(r.x, o.box.x), y = Math.min(r.y, o.box.y);
        add(o, { x, y, w: Math.max(r.x + r.w, o.box.x + o.box.w) - x, h: Math.max(r.y + r.h, o.box.y + o.box.h) - y });
      } else add(o, r);
    }
    this.chunks.clear();
    delete this._atlas;
  }

  // Объекты, чей прямоугольник может пересекать r
  query(r, out = []) {
    const T = G.CONFIG.TILE, S = this.BK * T;
    const st = ++this._stamp;
    const x0 = Math.floor(r.x / S), x1 = Math.floor((r.x + r.w - 1) / S);
    const y0 = Math.floor(r.y / S), y1 = Math.floor((r.y + r.h - 1) / S);
    for (let by = y0; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) {
      const arr = this.buckets.get(by * 1000 + bx);
      if (!arr) continue;
      for (const o of arr) if (o._st !== st) { o._st = st; out.push(o); }
    }
    return out;
  }

  // Прямоугольник (в пикселях) упирается в стену/объект?
  blockedRect(b) {
    const T = G.CONFIG.TILE;
    if (b.x < 0 || b.y < 0 || b.x + b.w > this.w * T || b.y + b.h > this.h * T) return true;
    const x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 1) / T);
    const y0 = Math.floor(b.y / T), y1 = Math.floor((b.y + b.h - 1) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solidTile(tx, ty)) return true;
    const near = this.query(b, this._q || (this._q = []));
    let hit = false;
    for (const o of near) if (o.box && G.util.rectsOverlap(b, o.box)) { hit = true; break; }
    near.length = 0;
    return hit;
  }

  districtAt(tx, ty) {
    for (let i = this.districts.length - 1; i >= 0; i--) {
      const d = this.districts[i];
      if (tx >= d.x && ty >= d.y && tx < d.x + d.w && ty < d.y + d.h) return d;
    }
    return null;
  }

  // ---------- Отрисовка земли ----------
  chunk(cx, cy) {
    const k = cy * 100 + cx;
    let c = this.chunks.get(k);
    if (c) { this.chunks.delete(k); this.chunks.set(k, c); return c; } // LRU: в конец
    const T = G.CONFIG.TILE, CH = this.CH;
    const tw = Math.min(CH, this.w - cx * CH), th = Math.min(CH, this.h - cy * CH);
    c = G.gfx.canvas(tw * T, th * T);
    const ctx = c.getContext('2d');
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      G.tiles.renderTile(ctx, this, cx * CH + x, cy * CH + y, x * T, y * T);
    }
    if (!this.outdoor) this.roomLight(c, cx * CH, cy * CH, tw, th);
    else this.groundLight(c, cx * CH, cy * CH, tw, th);
    G.gfx.smooth(c);
    this.chunks.set(k, c);
    if (this.chunks.size > 12) this.chunks.delete(this.chunks.keys().next().value);
    return c;
  }

  // V9: плавные пятна света и тени на земле — гладкий шум в мировых координатах (швов между тайлами и чанками нет),
  // трава заметнее, дороги и камень — едва; ступени между оттенками размыты дизерингом.
  groundLight(c, gx, gy, tw, th) {
    const T = G.CONFIG.TILE, ID = G.tiles.ID, S = G.shade, Hh = G.util.hash2;
    const GR = G.tiles.GRASSY, RD = G.tiles.ROADY;
    const lat = (ix, iy, sd) => Hh(ix, iy, 900 + sd);
    const vn = (x, y, wl, sd) => {            // билинейный шум с плавным сглаживанием
      const fx = x / wl, fy = y / wl, ix = Math.floor(fx), iy = Math.floor(fy);
      let u = fx - ix, v = fy - iy; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
      const a = lat(ix, iy, sd), b = lat(ix + 1, iy, sd), cc = lat(ix, iy + 1, sd), d = lat(ix + 1, iy + 1, sd);
      return a + (b - a) * u + (cc - a) * v + (a - b - cc + d) * u * v;
    };
    S.tint(c, 0, 0, tw * T, th * T, (u, v) => {
      const wx = gx * T + u * tw * T, wy = gy * T + v * th * T;
      const tile = this.get(Math.floor(wx / T), Math.floor(wy / T));
      const grass = GR.has(tile);
      if (!grass && !RD.has(tile)) return 0;
      const n = (vn(wx, wy, 56, 1) - 0.5) * 0.7 + (vn(wx, wy, 22, 2) - 0.5) * 0.3;   // −0.5…+0.5
      return n * (grass ? 0.2 : 0.07);
    }, { steps: 40, keepInk: false });
  }

  // V9: свет в комнате — пол у стены в мягкой тени (стена заслоняет свет), к дальним углам чуть темнее
  roomLight(c, gx, gy, tw, th) {
    const T = G.CONFIG.TILE, ID = G.tiles.ID, S = G.shade;
    const wallish = (tx, ty) => { const v = this.get(tx, ty); return v < 0 || v === ID.IWALL || v === ID.VOID || v === ID.VWALL; };
    S.defer(c);
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const tx = gx + x, ty = gy + y;
      if (wallish(tx, ty)) continue;
      if (wallish(tx, ty - 1)) S.tint(c, x * T, y * T, T, 8, (u, v) => -0.42 * (1 - v) ** 1.5);          // тень под стеной
      if (wallish(tx - 1, ty)) S.tint(c, x * T, y * T, 5, T, (u) => -0.28 * (1 - u) ** 1.5);          // у левой стены
      if (wallish(tx + 1, ty)) S.tint(c, x * T + 11, y * T, 5, T, (u) => -0.2 * u ** 1.5);             // у правой стены
      // общий свет комнаты: от окон сверху-слева к дальнему углу
      const fx = (tx + 0.5) / this.w, fy = (ty + 0.5) / this.h;
      S.tint(c, x * T, y * T, T, T, (u, v) => 0.06 - 0.22 * Math.max(0, ((fx + u / this.w) - 0.25) * 0.8 + ((fy + v / this.h) - 0.3)));
    }
    S.flush(c);
  }

  drawGround(ctx, camX, camY, vw, vh, time) {
    const T = G.CONFIG.TILE, CP = this.CH * T;
    const cx0 = Math.max(0, Math.floor(camX / CP)), cx1 = Math.min(Math.ceil(this.w / this.CH) - 1, Math.floor((camX + vw - 1) / CP));
    const cy0 = Math.max(0, Math.floor(camY / CP)), cy1 = Math.min(Math.ceil(this.h / this.CH) - 1, Math.floor((camY + vh - 1) / CP));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) ctx.drawImage(this.chunk(cx, cy), cx * CP, cy * CP);
    // анимация воды
    const W = G.tiles.ID.WATER;
    const tx0 = Math.max(0, Math.floor(camX / T)), tx1 = Math.min(this.w - 1, Math.floor((camX + vw) / T));
    const ty0 = Math.max(0, Math.floor(camY / T)), ty1 = Math.min(this.h - 1, Math.floor((camY + vh) / T));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (this.ground[ty * this.w + tx] === W) G.tiles.waterOverlay(ctx, tx * T, ty * T, tx, ty, time);
    }
  }

  // Картинка для обзорной карты (1 пиксель = 1 тайл)
  overview() {
    if (this._ov) return this._ov;
    const c = G.gfx.canvas(this.w, this.h, true), ctx = c.getContext('2d');
    const img = ctx.createImageData(this.w, this.h);
    const cache = {};
    const rgb = (hex) => cache[hex] || (cache[hex] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);
    for (let i = 0; i < this.w * this.h; i++) {
      const col = rgb(G.tiles.MAPCOL[this.ground[i]] || '#888888');
      img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    for (const o of this.objects) {
      if (o.isBuilding) {
        if (!o.tplDef || o.tplDef.cat === 'landmark' && !o.tplDef.door) continue;
        ctx.fillStyle = '#2a1e18'; ctx.fillRect(o.tx, o.ty, o.tw, o.th);
        ctx.fillStyle = o.tplDef.unique ? o.tplDef.color : '#b8a088'; ctx.fillRect(o.tx, o.ty, o.tw, o.th - 1);
      } else if (o.kind === 'tree' || o.kind === 'pine') {
        ctx.fillStyle = '#2e6a32'; ctx.fillRect(Math.floor(o.x / 16) - 1, Math.floor(o.y / 16) - 1, 2, 2);
      }
    }
    this._ov = c;
    return c;
  }
};
