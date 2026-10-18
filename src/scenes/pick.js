// Универсальное меню выбора поверх мира: G.scenes.make('pick', { title, text, who, options: [{ label, sub, off, desc }] }, (index|-1) => {})
G.scenes.register('pick', (o, cb) => {
  const W = G.screen.W, F = G.font, P = G.PAL;
  let focus = 0, scroll = 0;
  const opts = o.options;
  const ROW = 14;
  const S = {
    name: 'pick', transparent: true,
    choose(i) { G.scenes.pop(); cb && cb(i); },
    rows() { return Math.min(opts.length, Math.max(3, Math.floor((G.screen.H - 110) / ROW))); },
    geom() {
      const n = this.rows(), h = n * ROW + 30 + (o.text ? 22 : 0), y = G.screen.H - h - 26;
      return { n, h, y, x: 6, w: W - 12, ly: y + 22 + (o.text ? 22 : 0) };
    },
    update() {
      const I = G.input, g = this.geom();
      if (I.repeat('up', 1 / 60)) { focus = (focus + opts.length - 1) % opts.length; G.audio.sfx.blip(); }
      if (I.repeat('down', 1 / 60)) { focus = (focus + 1) % opts.length; G.audio.sfx.blip(); }
      if (focus < scroll) scroll = focus; if (focus >= scroll + g.n) scroll = focus - g.n + 1;
      let go = I.pressed('a');
      if (I.tapNow) {
        const t = I.tapNow; const i = Math.floor((t.y - g.ly) / ROW);
        if (t.y >= g.ly && i >= 0 && i < g.n && scroll + i < opts.length) { focus = scroll + i; go = true; }
        else if (t.y < g.y) { G.audio.sfx.cancel(); return this.choose(-1); }
      }
      if (go) { const op = opts[focus]; if (op.off) { G.audio.sfx.error(); this.err = op.off; this.errT = 1.5; return; } G.audio.sfx.confirm(); return this.choose(focus); }
      if (I.pressed('b')) { G.audio.sfx.cancel(); return this.choose(-1); }
      if (this.errT) this.errT = Math.max(0, this.errT - 1 / 60);
    },
    draw(ctx) {
      const g = this.geom();
      G.gfx.window(ctx, g.x, g.y, g.w, g.h, 'dark');
      F.draw(ctx, o.title || 'Выбор', g.x + 8, g.y + 6, { color: P.orange, maxW: g.w - 16 });
      if (o.text) F.wrap(o.text, g.w - 16).slice(0, 2).forEach((l, i) => F.draw(ctx, l, g.x + 8, g.y + 18 + i * 10, { color: P.light }));
      for (let i = 0; i < g.n; i++) {
        const k = scroll + i, op = opts[k]; if (!op) break;
        const y = g.ly + i * ROW;
        if (k === focus) { ctx.fillStyle = '#3a3548'; ctx.fillRect(g.x + 4, y - 2, g.w - 8, ROW - 1); }
        F.draw(ctx, (k === focus ? '▶ ' : '  ') + op.label, g.x + 8, y, { color: op.off ? '#6c6680' : k === focus ? P.yellow : P.white, maxW: g.w - 14 - (op.sub ? F.measure(op.sub) + 8 : 0) });
        if (op.sub) F.draw(ctx, op.sub, g.x + g.w - 8, y, { align: 'right', color: op.off ? '#6c6680' : P.gray });
      }
      if (scroll > 0) F.draw(ctx, '▲', g.x + g.w - 10, g.ly - 12, { color: P.gray });
      if (scroll + g.n < opts.length) F.draw(ctx, '▼', g.x + g.w - 10, g.y + g.h - 10, { color: P.gray });
      const op = opts[focus];
      const foot = this.errT ? 'x ' + this.err : op && (op.off ? 'x ' + op.off : op.desc);
      if (foot) {
        const fl = F.wrap(foot, g.w - 16).slice(0, 3);
        G.gfx.window(ctx, g.x, g.y + g.h + 1, g.w, 12 + fl.length * 10, 'dark');
        fl.forEach((l, i) => F.draw(ctx, l, g.x + 8, g.y + g.h + 7 + i * 10, { color: this.errT || (op && op.off) ? '#ff9a7a' : P.light }));
      }
    },
  };
  return S;
});
