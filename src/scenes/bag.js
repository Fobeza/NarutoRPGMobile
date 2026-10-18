// Сумка (из меню): цель, деньги, нужды, подсумок и прочие вещи. Стиль «Свитки и дерево» (G.ui).
G.scenes.register('bag', () => {
  let idx = 0;
  const list = () => Object.entries(G.state.inv)
    .filter(([id, n]) => n > 0 && G.ITEMS[id])
    .map(([id, n]) => Object.assign({ id, n }, G.ITEMS[id]))
    .sort((a, b) => (a.pouch ? 0 : 1) - (b.pouch ? 0 : 1) || a.name.localeCompare(b.name));
  const INFO_H = 52, DESC_H = 64, CARD_W = 62, CARD_H = 56;

  return {
    name: 'bag',
    cols() { return Math.max(2, Math.floor((G.screen.W - 22) / CARD_W)); },
    gridTop() { return 16 + INFO_H + 8; },
    rows() { return Math.max(1, Math.floor((G.screen.H - this.gridTop() - DESC_H - 18) / CARD_H)); },
    grid() {
      const cols = this.cols(), rows = this.rows(), W = G.screen.W;
      const w = W - 8, cw = Math.floor((w - 12) / cols);
      return { x: 4, y: this.gridTop(), w, h: rows * CARD_H + 12, cols, rows, cardW: cw, cardH: CARD_H, per: rows * cols };
    },
    update(dt) {
      const I = G.input, L = list();
      if (I.pressed('b') || I.pressed('menu')) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
      if (!L.length) return;
      const cols = this.cols();
      if (I.repeat('up', dt)) { idx = (idx - cols + L.length) % L.length; G.audio.sfx.select(); }
      if (I.repeat('down', dt)) { idx = (idx + cols) % L.length; G.audio.sfx.select(); }
      if (I.repeat('left', dt)) { idx = (idx + L.length - 1) % L.length; G.audio.sfx.select(); }
      if (I.repeat('right', dt)) { idx = (idx + 1) % L.length; G.audio.sfx.select(); }
      idx = Math.min(idx, L.length - 1);
      if (I.tapNow) {
        const g = this.grid(), t = I.tapNow, per = g.per;
        if (t.x > g.x && t.x < g.x + g.w && t.y > g.y && t.y < g.y + g.h) {
          const k = Math.floor((t.y - g.y - 6) / g.cardH) * g.cols + Math.floor((t.x - g.x - 6) / g.cardW);
          const i = Math.floor(idx / per) * per + k;
          if (i >= 0 && i < L.length) { idx = i; G.audio.sfx.select(); }
        }
      }
    },
    draw(ctx) {
      const W = G.screen.W, H = G.screen.H, F = G.font, U = G.ui, C = U.C, v = G.state.vars, g = G.game;
      U.backdrop(ctx);
      U.title(ctx, 'СУМКА', W / 2, 3, 70);

      // цель и состояние
      U.panel(ctx, 4, 20, W - 8, INFO_H, 'frame');
      F.small.draw(ctx, `${g.dayNameFull()}, день ${v.day} · ${g.clock()}`, 12, 27, { color: C.inkDim });
      F.small.draw(ctx, `${v.money} рё`, W - 12, 27, { align: 'right', color: '#8a5a10' });
      F.small.wrap('Цель: ' + (g.goalText() || '—'), W - 24).slice(0, 1).forEach((ln, i) => F.small.draw(ctx, ln, 12, 40 + i * 12, { color: C.redDark, maxW: W - 24 }));
      [['Сытость', v.food, C.food], ['Энергия', v.energy, C.energy]].forEach(([nm, val, col], i) => {
        const x = 12 + i * ((W - 24) / 2);
        F.small.draw(ctx, nm, x, 53, { color: C.inkDim });
        U.gauge(ctx, x + 54, 55, Math.round((W - 24) / 2) - 62, 6, val / 100, col);
      });

      // вещи — сетка карточек с иконками
      const L = list(), gr = this.grid();
      U.panel(ctx, gr.x, gr.y, gr.w, gr.h, 'well');
      F.small.draw(ctx, `${g.pouchUsed()}/${g.pouchMax()}`, gr.x + gr.w - 8, gr.y + gr.h - 14, { align: 'right', color: C.inkDim });
      if (!L.length) F.draw(ctx, 'Пусто. Загляни в лавки!', gr.x + 10, gr.y + 10, { color: C.inkDim });
      idx = Math.min(idx, Math.max(0, L.length - 1));
      const page = Math.floor(idx / gr.per) * gr.per;
      for (let k = 0; k < gr.per; k++) {
        const i = page + k;
        if (i >= L.length) break;
        const it = L[i];
        const cx = gr.x + 6 + (k % gr.cols) * gr.cardW, cy = gr.y + 6 + Math.floor(k / gr.cols) * gr.cardH;
        U.card(ctx, cx, cy, gr.cardW - 3, gr.cardH - 3, i === idx);
        G.icons.draw(ctx, it.id, cx + Math.floor((gr.cardW - 3 - 48) / 2), cy + 1, 48, 48);
        F.small.draw(ctx, '×' + it.n, cx + gr.cardW - 7, cy + gr.cardH - 17, { align: 'right', color: '#f8eed0', outline: C.woodEdge });
      }
      if (page > 0) F.small.draw(ctx, '▲', gr.x + gr.w - 12, gr.y + 5, { color: C.red });
      if (page + gr.per < L.length) F.small.draw(ctx, '▼', gr.x + gr.w - 12, gr.y + gr.h - 14, { color: C.red });
      // описание: имя вещи + текст
      const dy = H - DESC_H - 4;
      U.panel(ctx, 4, dy, W - 8, DESC_H, 'frame');
      if (L[idx]) {
        F.draw(ctx, L[idx].name, 14, dy + 9, { color: C.redDark });
        F.small.wrap(L[idx].desc || '', W - 28).slice(0, 3).forEach((ln, i) => F.small.draw(ctx, ln, 14, dy + 26 + i * 12, { color: C.ink }));
      }
    },
  };
});
