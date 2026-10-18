// Сумка (из меню): цель, деньги, нужды, подсумок и прочие вещи.
// Полный дневник, статус и техники — на следующих этапах.
G.scenes.register('bag', () => {
  let idx = 0, top = 0;
  const CAT = { tool: 'Подсумок', med: 'Подсумок', gift: 'Подарки', book: 'Книги', misc: 'Вещи' };
  const list = () => Object.entries(G.state.inv)
    .filter(([id, n]) => n > 0 && G.ITEMS[id])
    .map(([id, n]) => Object.assign({ id, n }, G.ITEMS[id]))
    .sort((a, b) => (a.pouch ? 0 : 1) - (b.pouch ? 0 : 1) || a.name.localeCompare(b.name));

  return {
    name: 'bag',
    // сетка карточек: колонки по ширине экрана, карточка под иконку 64×64
    cols() { return Math.max(2, Math.floor((G.screen.W - 8) / 70)); },
    update(dt) {
      const I = G.input, L = list();
      if (I.pressed('b') || I.pressed('menu') || (I.tapNow && I.tapNow.y > G.screen.H - 20)) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
      if (!L.length) return;
      const cols = this.cols(), rows = this.rows(), per = rows * cols;
      if (I.repeat('up', dt)) { idx = (idx - cols + L.length) % L.length; G.audio.sfx.select(); }
      if (I.repeat('down', dt)) { idx = (idx + cols) % L.length; G.audio.sfx.select(); }
      if (I.repeat('left', dt)) { idx = (idx + L.length - 1) % L.length; G.audio.sfx.select(); }
      if (I.repeat('right', dt)) { idx = (idx + 1) % L.length; G.audio.sfx.select(); }
      idx = Math.min(idx, L.length - 1);
      if (I.tapNow) {
        const g = this.grid();
        const t = I.tapNow;
        if (t.x > g.x && t.x < g.x + g.w && t.y > g.y && t.y < g.y + g.h) {
          const k = Math.floor((t.y - g.y - 4) / g.cardH) * cols + Math.floor((t.x - g.x - 4) / g.cardW);
          const i = Math.floor(idx / per) * per + k;
          if (i >= 0 && i < L.length) { idx = i; G.audio.sfx.select(); }
        }
      }
    },
    rows() { return Math.max(1, Math.floor((G.screen.H - 20 - 46 - 80 - 10) / 70)); },
    grid() {
      const cols = this.cols(), rows = this.rows();
      const cardW = Math.floor((G.screen.W - 8) / cols);
      return { x: 2, y: 80, w: G.screen.W - 4, h: rows * 70 + 8, cols, rows, cardW, cardH: 70, per: rows * cols };
    },
    draw(ctx) {
      const W = G.screen.W, H = G.screen.H, F = G.font, P = G.PAL, v = G.state.vars, g = G.game;
      ctx.fillStyle = '#1e1a28'; ctx.fillRect(0, 0, W, H);
      F.draw(ctx, 'СУМКА', W / 2, 5, { align: 'center', color: P.orange });

      // цель и состояние
      G.gfx.window(ctx, 2, 18, W - 4, 58, 'paper');
      F.draw(ctx, `${g.dayNameFull()}, день ${v.day} · ${g.clock()}`, 8, 23, { color: G.UI.text });
      F.draw(ctx, `${v.money} рё`, W - 8, 23, { align: 'right', color: '#b07a10' });
      const goal = g.goalText();
      F.wrap('Цель: ' + (goal || '—'), W - 16).slice(0, 2).forEach((ln, i) => F.draw(ctx, ln, 8, 35 + i * 11, { color: '#8a3a1a' }));
      const bars = [['Сытость', v.food, '#e8a03a'], ['Энергия', v.energy, '#8ac85a']];
      bars.forEach(([nm, val, col], i) => {
        const x = 8 + i * 92, y = 61;
        F.draw(ctx, nm, x, y, { color: P.gray });
        ctx.fillStyle = '#3a3040'; ctx.fillRect(x + 44, y + 2, 40, 5);
        ctx.fillStyle = col; ctx.fillRect(x + 45, y + 3, Math.round(38 * val / 100), 3);
      });

      // вещи — сетка карточек с иконками 64×64
      const L = list();
      const gr = this.grid();
      G.gfx.window(ctx, gr.x, gr.y, gr.w, gr.h, 'paper');
      F.draw(ctx, `${g.pouchUsed()}/${g.pouchMax()}`, W - 8, gr.y + 5, { align: 'right', color: P.gray });
      if (!L.length) F.draw(ctx, 'Пусто. Загляни в лавки!', 8, gr.y + 5, { color: P.gray });
      idx = Math.min(idx, Math.max(0, L.length - 1));
      const page = Math.floor(idx / gr.per) * gr.per;
      for (let k = 0; k < gr.per; k++) {
        const i = page + k;
        if (i >= L.length) break;
        const it = L[i];
        const cx = gr.x + 4 + (k % gr.cols) * gr.cardW, cy = gr.y + 4 + Math.floor(k / gr.cols) * gr.cardH;
        if (i === idx) {
          ctx.fillStyle = G.UI.sel; ctx.fillRect(cx, cy, gr.cardW - 4, gr.cardH - 4);
          ctx.fillStyle = G.UI.edge;
          ctx.fillRect(cx, cy, gr.cardW - 4, 1); ctx.fillRect(cx, cy + gr.cardH - 5, gr.cardW - 4, 1);
          ctx.fillRect(cx, cy, 1, gr.cardH - 4); ctx.fillRect(cx + gr.cardW - 5, cy, 1, gr.cardH - 4);
        }
        G.assets.draw(ctx, 'icon_' + it.id, cx + Math.floor((gr.cardW - 4 - 64) / 2), cy + 2, 64, 64);
        F.draw(ctx, '×' + it.n, cx + gr.cardW - 7, cy + 3, { align: 'right', color: G.UI.text, outline: '#000' });
      }
      // описание: имя вещи + текст
      const dy = H - 20 - 44;
      G.gfx.window(ctx, 2, dy, W - 4, 42, 'paper');
      if (L[idx]) {
        F.draw(ctx, L[idx].name, 8, dy + 4, { color: G.UI.selText });
        F.wrap(L[idx].desc || '', W - 16).slice(0, 2).forEach((ln, i) => F.draw(ctx, ln, 8, dy + 16 + i * 11, { color: G.UI.text }));
      }
      G.gfx.window(ctx, 2, H - 19, W - 4, 17, 'dark');
      F.draw(ctx, '(B) Назад', W / 2, H - 14, { align: 'center', color: P.light });
    },
  };
});
