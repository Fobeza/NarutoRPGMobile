// Пиксельный шрифт интерфейса V10 (кириллица + латиница + значки), пропорциональный.
// Данные глифов — gfx/font_data.js (генерирует tools/make_font.py из растрового шрифта Terminus; значки нарисованы вручную).
//   G.font       — основной шрифт (Terminus 8×16 жирный): заглавная 10 px, строка 14 px
//   G.font.small — мелкий (Terminus 6×12 жирный): заглавная 8 px, строка 12 px — для плотных мест (шапка, подписи)
//   draw(ctx, text, x, y, { color, outline, shadow, align: 'left'|'center'|'right', maxW, max })
//   y — верх заглавной буквы (значки и «Й», «Ё» могут выступать выше), measure(text), wrap(text, maxW) → строки
G.font = (() => {
  function makeFace(data, o) {
    const SPACE_W = o.space, GAP = 1;
    const H = data.h, BASE = data.base, CAP = data.cap, TOP = BASE - CAP;   // TOP — сколько строк глифа выше заглавной
    const glyphs = {};
    let atlas = null;
    const tinted = {};

    function build() {
      const list = Object.keys(data.glyphs).map((ch) => {
        const rows = data.glyphs[ch].split('|');
        return { ch, rows, w: Math.max(...rows.map((r) => r.length)) };
      });
      const totalW = list.reduce((s, g) => s + g.w + 1, 0);
      atlas = document.createElement('canvas');
      atlas.width = totalW; atlas.height = H;
      const c = atlas.getContext('2d');
      c.fillStyle = '#fff';
      let x = 0;
      for (const g of list) {
        g.rows.forEach((row, y) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') c.fillRect(x + i, y, 1, 1); });
        glyphs[g.ch] = { w: g.w, x };
        x += g.w + 1;
      }
    }
    function atlasFor(color) {
      if (!atlas) build();
      if (tinted[color]) return tinted[color];
      const t = document.createElement('canvas');
      t.width = atlas.width; t.height = atlas.height;
      const c = t.getContext('2d');
      c.drawImage(atlas, 0, 0);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = color;
      c.fillRect(0, 0, t.width, t.height);
      tinted[color] = t;
      return t;
    }
    function glyph(ch) {
      if (!atlas) build();
      return glyphs[ch] || glyphs[ch.toUpperCase()] || glyphs['?'];
    }
    const charW = (ch) => (ch === ' ' ? SPACE_W : glyph(ch).w);
    function measure(text) {
      let w = 0;
      for (const ch of text) w += charW(ch) + GAP;
      return Math.max(0, w - GAP);
    }
    function draw(ctx, text, x, y, opts = {}) {
      const color = opts.color || G.PAL.ink;
      if (opts.maxW && measure(text) > opts.maxW) { const ch = [...text]; while (ch.length && measure(ch.join('') + '…') > opts.maxW) ch.pop(); text = ch.join('').trimEnd() + '…'; }
      if (opts.align === 'center') x = Math.round(x - measure(text) / 2);
      else if (opts.align === 'right') x = Math.round(x - measure(text));
      if (opts.shadow) draw(ctx, text, x + 1, y + 1, { color: opts.shadow });
      if (opts.outline) {
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) draw(ctx, text, x + dx, y + dy, { color: opts.outline });
      }
      const a = atlasFor(color);
      let cx = Math.round(x);
      const gy = Math.round(y) - TOP;
      let n = 0;
      for (const ch of text) {
        if (opts.max != null && n >= opts.max) break;
        n++;
        if (ch === ' ') { cx += SPACE_W + GAP; continue; }
        const g = glyph(ch);
        ctx.drawImage(a, g.x, 0, g.w, H, cx, gy, g.w, H);
        cx += g.w + GAP;
      }
      return cx;
    }
    // Перенос по словам в пределах ширины maxW → массив строк
    function wrap(text, maxW) {
      const out = [];
      for (const para of text.split('\n')) {
        const words = para.split(' ');
        let line = '';
        for (const w of words) {
          const test = line ? line + ' ' + w : w;
          if (measure(test) <= maxW || !line) line = test;
          else { out.push(line); line = w; }
        }
        out.push(line);
      }
      return out;
    }
    return { draw, measure, wrap, LINE_H: o.line, CAP, chars: () => { if (!atlas) build(); return Object.keys(glyphs); } };
  }

  const body = makeFace(G.FONT_DATA.body, { line: 14, space: 5 });
  body.small = makeFace(G.FONT_DATA.small, { line: 12, space: 4 });
  return body;
})();
