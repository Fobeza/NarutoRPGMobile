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
    update(dt) {
      const I = G.input, L = list();
      if (I.pressed('b') || I.pressed('menu') || (I.tapNow && I.tapNow.y > G.screen.H - 20)) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
      if (!L.length) return;
      if (I.repeat('up', dt)) { idx = (idx + L.length - 1) % L.length; G.audio.sfx.select(); }
      if (I.repeat('down', dt)) { idx = (idx + 1) % L.length; G.audio.sfx.select(); }
      idx = Math.min(idx, L.length - 1);
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

      // вещи
      const L = list();
      const ly = 80, rows = Math.max(3, Math.floor((H - 20 - 46 - ly - 8) / 12));
      G.gfx.window(ctx, 2, ly, W - 4, rows * 12 + 8, 'paper');
      F.draw(ctx, `${g.pouchUsed()}/${g.pouchMax()}`, W - 8, ly + 5, { align: 'right', color: P.gray });
      if (!L.length) F.draw(ctx, 'Пусто. Загляни в лавки!', 8, ly + 5, { color: P.gray });
      if (idx < top) top = idx;
      if (idx >= top + rows - 1) top = idx - rows + 2;
      let lastCat = null, r = 0;
      for (let i = top; i < L.length && r < rows; i++) {
        const it = L[i], cat = CAT[it.cat] || 'Вещи';
        if (cat !== lastCat && r < rows) {
          if (r > 0 || i === top) { F.draw(ctx, cat, 8, ly + 5 + r * 12, { color: P.orange }); r++; }
          lastCat = cat;
          if (r >= rows) break;
        }
        const y = ly + 5 + r * 12, sel = i === idx;
        if (sel) { ctx.fillStyle = G.UI.sel; ctx.fillRect(6, y - 2, W - 12, 12); F.draw(ctx, '▶', 8, y, { color: P.orange }); }
        F.draw(ctx, it.name, 17, y, { color: sel ? G.UI.selText : G.UI.dim });
        F.draw(ctx, '×' + it.n, W - 8, y, { align: 'right', color: G.UI.text });
        r++;
      }
      // описание
      const dy = H - 20 - 44;
      G.gfx.window(ctx, 2, dy, W - 4, 42, 'paper');
      if (L[idx]) F.wrap(L[idx].desc || '', W - 16).slice(0, 3).forEach((ln, i) => F.draw(ctx, ln, 8, dy + 5 + i * 11, { color: G.UI.text }));
      G.gfx.window(ctx, 2, H - 19, W - 4, 17, 'dark');
      F.draw(ctx, '(B) Назад', W / 2, H - 14, { align: 'center', color: P.light });
    },
  };
});
