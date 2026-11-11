// Экран «История»: последние реплики диалогов — можно вернуться и перечитать, что тебе сказали.
// Строки листаются ↑/↓ или касанием: верхняя половина листа — раньше, нижняя — позже; новые внизу.
G.scenes.register('log', () => {
  const F = G.font, In = G.input, U = G.ui;
  const ROW = 11, BOT = 26;
  const top = () => G.touch.header().height + 20;   // лист начинается под шапкой с кнопкой «Назад» и строкой подсказки
  let scroll = 0;   // сдвиг от конца: 0 — последние строки
  const lines = () => {
    const L = (G.state.dlgLog || []).slice();
    const W = G.screen.W - 16, out = [];
    for (const t of L) for (const ln of F.small.wrap(t, W)) out.push(ln);
    return out;
  };
  const rows = () => Math.max(1, Math.floor((G.screen.H - top() - BOT) / ROW));
  const maxScroll = () => Math.max(0, lines().length - rows());
  return {
    name: 'log',
    // без этого на телефоне с экрана было не выйти: клавиши B на сенсорном экране нет
    touch() { return { back: true, roomyBack: true }; },
    lines, rows, maxScroll,
    update(dt) {
      const I = In;
      if (I.pressed('b') || I.pressed('menu')) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
      if (I.repeat('up', dt)) { scroll = Math.min(maxScroll(), scroll + 1); G.audio.sfx.blip(); }
      if (I.repeat('down', dt)) { scroll = Math.max(0, scroll - 1); G.audio.sfx.blip(); }
      if (I.pressed('left')) { scroll = maxScroll(); G.audio.sfx.blip(); }
      if (I.pressed('right')) { scroll = 0; G.audio.sfx.blip(); }
      if (I.tapNow) {
        // касание листа: верхняя половина — на страницу раньше, нижняя — позже (раньше зоны были узкими полосками у краёв)
        const y = I.tapNow.y, mid = (top() + G.screen.H - BOT) / 2, page = Math.max(1, rows() - 1);
        if (y >= top() - 6 && y < mid) scroll = Math.min(maxScroll(), scroll + page);
        else if (y >= mid) scroll = Math.max(0, scroll - page);
      }
    },
    draw(ctx) {
      const W = G.screen.W, C = U.C, L = lines(), n = rows(), hd = G.touch.header(), TOP = top();
      U.backdrop(ctx);
      U.title(ctx, 'ИСТОРИЯ', hd.titleX, hd.titleY, 80);
      const hint = !L.length ? 'Пока никто ничего не сказал' : maxScroll() ? 'Верх листа — раньше, низ — позже' : 'Последние реплики';
      F.small.draw(ctx, hint, W / 2, hd.height, { align: 'center', color: '#f4e4bc', shadow: C.woodEdge, maxW: W - 10 });
      U.panel(ctx, 4, TOP - 6, W - 8, G.screen.H - TOP - BOT + 6, 'frame');
      const start = Math.max(0, L.length - n - scroll);
      for (let i = 0; i < n; i++) {
        const t = L[start + i]; if (!t) break;
        const last = start + i >= L.length - 2;
        F.small.draw(ctx, t, 9, TOP + i * ROW, { color: last ? C.ink : C.inkDim, maxW: W - 18 });
      }
      if (scroll > 0) F.small.draw(ctx, '▼ есть новее', W - 10, G.screen.H - BOT + 4, { align: 'right', color: '#f4d46a', shadow: C.woodEdge });
      if (scroll < maxScroll()) F.small.draw(ctx, '▲ есть раньше', 10, G.screen.H - BOT + 4, { color: '#f4d46a', shadow: C.woodEdge });
    },
  };
});
