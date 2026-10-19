// Нарисованные здания (данные — gfx/house_art_data.js, его делает tools/import_art.py из art/ и tools/art_catalog.json).
// Картинки хранятся палитрой и строкой повторов («a12.b3»: знак — цвет, число — сколько подряд, точка — прозрачность)
// и раскодируются при первом обращении — без ожидания загрузки файлов.
//   G.houseArt.spec(name)           → размеры пятна и дверь картинки { w, h, dx, ox, wall, kind, ... } или null
//   G.houseArt.sprite(name, tpl)    → спрайт здания { img, glow, ox, oy, w, h, wh, art }; tpl — шаблон (даёт высоту пятна)
//   G.houseArt.free(name)           → [[cx, cy], …] клетки пятна без стены (картинка там прозрачная)
// У «уникальных» шаблонов (kind unique) размеры в G.BUILDINGS подменяются размерами картинки при загрузке.
G.houseArt = (() => {
  const SYM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&*+-/:;<=>?@^_';
  const data = G.HOUSE_ART || { bitmaps: [], art: {} };
  const decoded = new Map(), sprites = new Map();

  function decode(v) {
    if (decoded.has(v)) return decoded.get(v);
    const c = G.gfx.canvas(v.lw, v.lh), ctx = c.getContext('2d');
    const dw = v.lw * G.gfx.HI, dh = v.lh * G.gfx.HI;
    const img = ctx.createImageData(dw, dh), d = img.data;
    const pal = v.pal.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    const s = v.rle;
    let i = 0, p = 0;
    while (i < s.length) {
      const ch = s[i++];
      let n = 0;
      while (i < s.length) { const k = s.charCodeAt(i); if (k < 48 || k > 57) break; n = n * 10 + k - 48; i++; }
      if (!n) n = 1;
      if (ch !== '.') {
        const col = pal[SYM.indexOf(ch)];
        for (let k = 0; k < n; k++) { const o = (p + k) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255; }
      }
      p += n;
    }
    ctx.putImageData(img, 0, 0);
    decoded.set(v, c);
    return c;
  }

  // уникальные здания: пятно и дверь — по картинке
  for (const [name, a] of Object.entries(data.art)) {
    const tpl = a.kind === 'unique' && G.BUILDINGS[a.tpl];
    if (tpl) { tpl.w = a.w; tpl.h = a.h; tpl.door = tpl.door ? [a.dx, a.h - 1] : tpl.door; }
  }

  return {
    has: (name) => !!data.art[name],
    free: (name) => (data.art[name] && data.art[name].fr) || [],   // клетки пятна, где картинка пуста: там не стена
    spec: (name) => data.art[name] || null,
    names: (kind, clan) => Object.keys(data.art).filter((n) => data.art[n].kind === kind && (!clan || data.art[n].clan === clan)),
    sprite(name, tpl) {
      const a = data.art[name];
      if (!a) return null;
      const key = name + ':' + (tpl ? tpl.h : a.h);
      if (sprites.has(key)) return sprites.get(key);
      const bm = data.bitmaps[a.b], HF = (tpl ? tpl.h : a.h) * G.CONFIG.TILE;
      // низ картинки — по низу пятна здания; вверх она выступает как крыша
      const s = { img: decode(bm), ox: a.ox, oy: HF - bm.lh, w: bm.lw, h: bm.lh, wh: a.wall, art: name };
      if (a.g && a.g.length) {   // окна ночью: прямоугольники из import_art.py (px ×2), тёплый цвет + блик сверху
        const g = G.gfx.canvas(bm.lw, bm.lh), gc = g.getContext('2d');
        gc.fillStyle = '#ffb860'; for (const [x, y, w, h] of a.g) gc.fillRect(x / 2, y / 2, w / 2, h / 2);
        gc.fillStyle = '#ffe8a8'; for (const [x, y, w] of a.g) gc.fillRect(x / 2 + 0.5, y / 2 + 0.5, Math.max(0.5, w / 2 - 1), 1);
        s.glow = g;
      }
      sprites.set(key, s);
      return s;
    },
  };
})();
