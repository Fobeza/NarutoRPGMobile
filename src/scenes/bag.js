// Сумка (из меню): цель, деньги, нужды, подсумок и прочие вещи. Стиль «Свитки и дерево» (G.ui).
G.scenes.register('bag', () => {
  let idx = 0, msg = '', msgT = 0;
  const list = () => Object.entries(G.state.inv)
    .filter(([id, n]) => n > 0 && G.ITEMS[id])
    .map(([id, n]) => Object.assign({ id, n }, G.ITEMS[id]))
    .sort((a, b) => (a.pouch ? 0 : 1) - (b.pouch ? 0 : 1) || a.name.localeCompare(b.name));
  const CARD_W = 62;
  const dims = () => G.screen.H < 300 ? { info: 32, desc: 80, card: 44, foot: 16, icon: 36 } : { info: 52, desc: 92, card: 56, foot: 24, icon: 48 };

  return {
    name: 'bag',
    cols() { return Math.max(2, Math.floor((G.screen.W - 22) / CARD_W)); },
    gridTop() { return 24 + dims().info; },
    rows() { const d = dims(); return Math.max(1, Math.floor((G.screen.H - this.gridTop() - d.desc - d.foot - 8) / d.card)); },
    grid() {
      const cols = this.cols(), rows = this.rows(), W = G.screen.W;
      const w = W - 8, cw = Math.floor((w - 12) / cols);
      const d = dims();
      return { x: 4, y: this.gridTop(), w, h: rows * d.card + d.foot, cols, rows, cardW: cw, cardH: d.card, per: rows * cols };
    },
    update(dt) {
      const I = G.input, L = list();
      msgT = Math.max(0, msgT - dt);
      if (I.pressed('b') || I.pressed('menu')) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
      if (!L.length) return;
      const cols = this.cols();
      if (I.repeat('up', dt)) { idx = (idx - cols + L.length) % L.length; G.audio.sfx.select(); }
      if (I.repeat('down', dt)) { idx = (idx + cols) % L.length; G.audio.sfx.select(); }
      if (I.repeat('left', dt)) { idx = (idx + L.length - 1) % L.length; G.audio.sfx.select(); }
      if (I.repeat('right', dt)) { idx = (idx + 1) % L.length; G.audio.sfx.select(); }
      idx = Math.min(idx, L.length - 1);
      if (I.pressed('a') || (I.tapNow && I.tapNow.y >= G.screen.H - 27)) {
        const result = G.game.useItem(L[idx].id); msg = result.text; msgT = 2;
        if (result.ok) G.audio.sfx.confirm(); else G.audio.sfx.error();
        return;
      }
      if (I.tapNow) {
        const g = this.grid(), t = I.tapNow, per = g.per;
        const pg = Math.floor(idx / per), pages = Math.ceil(L.length / per);
        if (t.x >= g.x + g.w - 22 && t.y >= g.y && t.y < g.y + 16 && pg > 0) { idx = (pg - 1) * per; G.audio.sfx.select(); return; }            // ▲ страница назад
        if (t.x >= g.x + g.w - 22 && t.y >= g.y + g.h - 18 && t.y < g.y + g.h && pg + 1 < pages) { idx = (pg + 1) * per; G.audio.sfx.select(); return; }   // ▼ вперёд
        if (t.x > g.x && t.x < g.x + g.w && t.y > g.y && t.y < g.y + g.h) {
          const k = Math.floor((t.y - g.y - 6) / g.cardH) * g.cols + Math.floor((t.x - g.x - 6) / g.cardW);
          const i = Math.floor(idx / per) * per + k;
          if (i >= 0 && i < L.length) { idx = i; G.audio.sfx.select(); }
        }
      }
    },
    draw(ctx) {
      const W = G.screen.W, H = G.screen.H, F = G.font, U = G.ui, C = U.C, v = G.state.vars, g = G.game;
      const D = dims();
      U.backdrop(ctx);
      U.title(ctx, 'СУМКА', W / 2, 3, 70);

      // цель и состояние
      U.panel(ctx, 4, 20, W - 8, D.info, 'frame');
      F.small.draw(ctx, `${g.dayName()}, ${v.day} · ${g.clock()}`, 12, 27, { color: C.inkDim, maxW: W - 36 - F.small.measure(`${v.money} рё`) });
      F.small.draw(ctx, `${v.money} рё`, W - 12, 27, { align: 'right', color: '#8a5a10' });
      F.small.draw(ctx, 'Цель: ' + (g.goalText() || '—'), 12, 40, { color: C.redDark, maxW: W - 24 });
      if (D.info > 40) [['Сытость', v.food, C.food], ['Энергия', v.energy, C.energy]].forEach(([nm, val, col], i) => {
        const x = 12 + i * ((W - 24) / 2);
        F.small.draw(ctx, nm, x, 53, { color: C.inkDim });
        U.gauge(ctx, x + 54, 55, Math.round((W - 24) / 2) - 62, 6, val / 100, col);
      });

      // вещи — сетка карточек с иконками
      const L = list(), gr = this.grid();
      U.panel(ctx, gr.x, gr.y, gr.w, gr.h, 'well');
      if (!L.length) F.draw(ctx, 'Пусто. Загляни в лавки!', gr.x + 10, gr.y + 10, { color: C.inkDim });
      idx = Math.min(idx, Math.max(0, L.length - 1));
      const page = Math.floor(idx / gr.per) * gr.per;
      for (let k = 0; k < gr.per; k++) {
        const i = page + k;
        if (i >= L.length) break;
        const it = L[i];
        const cx = gr.x + 6 + (k % gr.cols) * gr.cardW, cy = gr.y + 6 + Math.floor(k / gr.cols) * gr.cardH;
        U.card(ctx, cx, cy, gr.cardW - 3, gr.cardH - 3, i === idx);
        G.icons.draw(ctx, it.id, cx + Math.floor((gr.cardW - 3 - D.icon) / 2), cy + 1, D.icon, D.icon);
        F.small.draw(ctx, '×' + it.n, cx + gr.cardW - 7, cy + gr.cardH - 17, { align: 'right', color: '#f8eed0', outline: C.woodEdge });
      }
      F.small.draw(ctx, `${g.pouchUsed()}/${g.pouchMax()}`, gr.x + 10, gr.y + gr.h - 11, { color: C.inkDim });
      if (page > 0) F.small.draw(ctx, '▲', gr.x + gr.w - 12, gr.y + 5, { color: C.red });
      if (page + gr.per < L.length) F.small.draw(ctx, '▼', gr.x + gr.w - 12, gr.y + gr.h - 14, { color: C.red });
      // описание: имя вещи + текст
      const dy = H - D.desc - 4;
      U.panel(ctx, 4, dy, W - 8, D.desc, 'frame');
      if (L[idx]) {
        F.draw(ctx, L[idx].name, 14, dy + 8, { color: C.redDark, maxW: W - 28 });
        F.small.wrap(msgT ? msg : L[idx].desc || '', W - 28).slice(0, 2).forEach((ln, i) => F.small.draw(ctx, ln, 14, dy + 24 + i * 12, { color: C.ink }));
        U.button(ctx, 8, H - 27, W - 16, 22, L[idx].cat === 'food' ? 'Съесть' : 'Применить', g.usable(L[idx].id) ? 'sel' : 'dis');
      }
    },
  };
});
