// Универсальное меню выбора поверх мира: G.scenes.make('pick', { title, text, who, options: [{ label, sub, off, desc }] }, (index|-1) => {})
// Окно — пергамент в деревянной раме с красной лентой-заголовком; выбранная строка — мазок кисти.
G.scenes.register('pick', (o, cb) => {
  const W = G.screen.W, F = G.font, U = G.ui, C = U.C;
  let focus = 0, scroll = 0;
  const opts = o.options;
  const ROW = 18;
  const hasDesc = opts.some((x) => x.desc || x.off);
  const S = {
    name: 'pick', transparent: true,
    choose(i) { G.scenes.pop(); cb && cb(i); },
    rows() { return Math.min(opts.length, Math.max(3, Math.floor((G.screen.H - 190) / ROW))); },
    geom() {
      const n = this.rows(), textH = o.text ? F.small.wrap(o.text, W - 36).slice(0, 2).length * 12 + 6 : 0;
      const h = n * ROW + 24 + textH, footH = hasDesc ? 44 : 0, y = G.screen.H - h - footH - 30;
      return { n, h, y, x: 5, w: W - 10, ly: y + 15 + textH, textH, footH };
    },
    update() {
      const I = G.input, g = this.geom();
      if (I.repeat('up', 1 / 60)) { focus = (focus + opts.length - 1) % opts.length; G.audio.sfx.blip(); }
      if (I.repeat('down', 1 / 60)) { focus = (focus + 1) % opts.length; G.audio.sfx.blip(); }
      if (focus < scroll) scroll = focus; if (focus >= scroll + g.n) scroll = focus - g.n + 1;
      let go = I.pressed('a');
      if (I.tapNow) {
        const t = I.tapNow; const i = Math.floor((t.y - g.ly) / ROW);
        if (t.x >= g.x + g.w - 26 && t.y >= g.y && t.y < g.y + 16 && scroll > 0) { focus = Math.max(0, focus - g.n); G.audio.sfx.blip(); return; }    // ▲
        if (t.x >= g.x + g.w - 26 && t.y >= g.y + g.h - 14 && t.y < g.y + g.h && scroll + g.n < opts.length) { focus = Math.min(opts.length - 1, focus + g.n); G.audio.sfx.blip(); return; }   // ▼
        if (t.y >= g.ly && i >= 0 && i < g.n && scroll + i < opts.length) { focus = scroll + i; go = true; }
        else if (t.y < g.y - 8) { G.audio.sfx.cancel(); return this.choose(-1); }
      }
      if (go) { const op = opts[focus]; if (op.off) { G.audio.sfx.error(); this.err = op.off; this.errT = 1.5; return; } G.audio.sfx.confirm(); return this.choose(focus); }
      if (I.pressed('b')) { G.audio.sfx.cancel(); return this.choose(-1); }
      if (this.errT) this.errT = Math.max(0, this.errT - 1 / 60);
    },
    draw(ctx) {
      const g = this.geom();
      U.panel(ctx, g.x, g.y, g.w, g.h, 'frame');
      U.title(ctx, o.title || 'Выбор', W / 2, g.y - 7, 0);
      if (o.text) F.small.wrap(o.text, g.w - 24).slice(0, 2).forEach((l, i) => F.small.draw(ctx, l, g.x + 12, g.y + 14 + i * 12, { color: C.inkDim }));
      for (let i = 0; i < g.n; i++) {
        const k = scroll + i, op = opts[k]; if (!op) break;
        const y = g.ly + i * ROW, sel = k === focus;
        U.row(ctx, g.x + 6, y - 1, g.w - 12, ROW - 2, sel);
        const col = op.off ? C.inkFaint : sel ? '#f8eed0' : C.ink;
        F.draw(ctx, op.label, g.x + 14, y + 2, { color: col, shadow: sel && !op.off ? '#5a1408' : null, maxW: g.w - 30 - (op.sub ? F.small.measure(op.sub) + 8 : 0) });
        if (op.sub) F.small.draw(ctx, op.sub, g.x + g.w - 14, y + 4, { align: 'right', color: op.off ? C.inkFaint : sel ? '#f4d46a' : C.inkDim });
      }
      if (scroll > 0) F.small.draw(ctx, '▲', g.x + g.w - 12, g.y + 4, { color: C.red });
      if (scroll + g.n < opts.length) F.small.draw(ctx, '▼', g.x + g.w - 12, g.y + g.h - 12, { color: C.red });
      const op = opts[focus];
      const foot = this.errT ? this.err : op && (op.off ? op.off : op.desc);
      if (foot) {
        const fl = F.small.wrap(foot, g.w - 24).slice(0, 3);
        U.panel(ctx, g.x, g.y + g.h + 4, g.w, 14 + fl.length * 12, 'night');
        fl.forEach((l, i) => F.small.draw(ctx, l, g.x + 12, g.y + g.h + 10 + i * 12, { color: this.errT || (op && op.off) ? '#ff9a7a' : '#e8d8b0' }));
      }
    },
  };
  return S;
});
