// Экран «История»: последние реплики диалогов — можно вернуться и перечитать, что тебе сказали.
// Строки листаются ↑/↓ и перетаскиванием; новые внизу.
G.scenes.register('log', () => {
  const F = G.font, In = G.input, U = G.ui;
  const ROW = 11, TOP = 40, BOT = 26;
  let scroll = 0;   // сдвиг от конца: 0 — последние строки
  const lines = () => {
    const L = (G.state.dlgLog || []).slice();
    const W = G.screen.W - 16, out = [];
    for (const t of L) for (const ln of F.small.wrap(t, W)) out.push(ln);
    return out;
  };
  const rows = () => Math.floor((G.screen.H - TOP - BOT) / ROW);
  const maxScroll = () => Math.max(0, lines().length - rows());
  return {
    name: 'log',
    lines, rows, maxScroll,
    update(dt) {
      const I = In;
      if (I.pressed('b') || I.pressed('menu')) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
      if (I.repeat('up', dt)) { scroll = Math.min(maxScroll(), scroll + 1); G.audio.sfx.blip(); }
      if (I.repeat('down', dt)) { scroll = Math.max(0, scroll - 1); G.audio.sfx.blip(); }
      if (I.pressed('left')) { scroll = maxScroll(); G.audio.sfx.blip(); }
      if (I.pressed('right')) { scroll = 0; G.audio.sfx.blip(); }
      if (I.tapNow) {
        const y = I.tapNow.y;
        if (y < TOP) scroll = Math.min(maxScroll(), scroll + rows());
        else if (y > G.screen.H - BOT) scroll = Math.max(0, scroll - rows());
      }
    },
    draw(ctx) {
      const W = G.screen.W, C = U.C, L = lines(), n = rows();
      U.backdrop(ctx);
      U.title(ctx, 'ИСТОРИЯ', W / 2, 3, 90);
      F.small.draw(ctx, L.length ? 'Прокрутка: ↑/↓, ◀ — к началу' : 'Пока никто ничего не сказал', W / 2, 24, { align: 'center', color: '#f4e4bc', shadow: C.woodEdge });
      U.panel(ctx, 4, TOP - 6, W - 8, G.screen.H - TOP - BOT + 6, 'frame');
      const start = Math.max(0, L.length - n - scroll);
      for (let i = 0; i < n; i++) {
        const t = L[start + i]; if (!t) break;
        const last = start + i >= L.length - 2;
        F.small.draw(ctx, t, 9, TOP + i * ROW, { color: last ? C.ink : C.inkDim, maxW: W - 18 });
      }
      if (scroll > 0) F.small.draw(ctx, '▼ есть новее', W - 10, G.screen.H - BOT + 4, { align: 'right', color: C.red });
    },
  };
});
