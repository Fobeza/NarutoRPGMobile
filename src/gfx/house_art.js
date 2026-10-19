// Нарисованные дома (данные — gfx/house_art_data.js, его делает tools/import_houses.py из art/houses/).
// Картинки хранятся палитрой и строкой повторов («a12.b3»: знак — цвет, число — сколько подряд, точка — прозрачность)
// и раскодируются сразу при первом обращении — без ожидания загрузки файлов.
//   G.houseArt.sprite(id, tpl, seed) → спрайт здания { img, ox, oy, w, h, wh } или null (тогда дом рисует buildgfx кодом)
G.houseArt = (() => {
  const SYM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&*+-/:;<=>?@^_';
  const decoded = new Map();

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

  return {
    has: (id) => !!(G.HOUSE_ART && G.HOUSE_ART.tpl[id]),
    sprite(id, tpl, seed) {
      const list = G.HOUSE_ART && G.HOUSE_ART.tpl[id];
      if (!list || !list.length || tpl.unique) return null;
      const v = list[Math.floor(G.util.hash2(seed, 29, 7) * list.length) % list.length], bm = G.HOUSE_ART.bitmaps[v.b];
      const HF = tpl.h * G.CONFIG.TILE;
      // низ картинки — по низу пятна здания; вверх она выступает как крыша
      return { img: decode(bm), ox: v.ox, oy: HF - bm.lh, w: bm.lw, h: bm.lh, wh: v.wall, art: bm.src };
    },
  };
})();
