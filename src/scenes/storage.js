// Сундук-хранилище дома: слева сумка, справа сундук. ←/→ — колонка, ↑/↓ — предмет, A — переложить 1, B — закрыть.
G.scenes.register('storage', () => {
  const W = G.screen.W, F = G.font, P = G.PAL, AU = G.audio, In = G.input;
  let col = 0, sel = [0, 0], scroll = [0, 0], msg = '', msgT = 0;
  const chest = () => G.outdoor.chest();
  const lists = () => [
    Object.keys(G.state.inv).filter((k) => G.ITEMS[k] && !G.ITEMS[k].quest && G.state.inv[k] > 0 && G.ITEMS[k].cat !== 'service').sort(),
    Object.keys(chest()).filter((k) => chest()[k] > 0).sort(),
  ];
  const ROW = 17, TOP = 66;
  const S = {
    name: 'storage',
    move(fromCol, id) {   // переложить одну штуку (и для автотеста)
      if (fromCol === 0) {
        if (!G.game.count(id)) return false;
        G.game.give(id, -1); chest()[id] = (chest()[id] || 0) + 1;
      } else {
        if (!chest()[id]) return false;
        if (G.ITEMS[id].pouch && G.game.pouchUsed() >= G.game.pouchMax()) { msg = 'Подсумок полон!'; msgT = 1.5; AU.sfx.error(); return false; }
        chest()[id]--; if (chest()[id] <= 0) delete chest()[id]; G.game.give(id, 1);
      }
      AU.sfx.select(); return true;
    },
    update(dt) {
      if (msgT > 0) msgT -= dt;
      const L = lists(), rows = this.rows();
      if (In.pressed('b')) { AU.sfx.cancel(); G.scenes.pop(); return; }
      if (In.pressed('left') || In.pressed('right')) { col = 1 - col; AU.sfx.blip(); }
      const n = L[col].length;
      if (In.repeat('up', dt) && n) { sel[col] = (sel[col] + n - 1) % n; AU.sfx.blip(); }
      if (In.repeat('down', dt) && n) { sel[col] = (sel[col] + 1) % n; AU.sfx.blip(); }
      if (In.tapNow) {
        const tp = In.tapNow, c = tp.x < W / 2 ? 0 : 1, i = Math.floor((tp.y - TOP) / ROW) + scroll[c];
        if (tp.y > TOP - 2 && i >= 0 && i < L[c].length) { col = c; if (sel[c] === i) this.move(c, L[c][i]); sel[c] = i; }
      } else if (In.pressed('a') && n) this.move(col, L[col][Math.min(sel[col], n - 1)]);
      for (const c of [0, 1]) {
        const m = lists()[c].length; if (sel[c] >= m) sel[c] = Math.max(0, m - 1);
        if (sel[c] < scroll[c]) scroll[c] = sel[c]; if (sel[c] >= scroll[c] + rows) scroll[c] = sel[c] - rows + 1;
      }
    },
    rows() { return Math.floor((G.screen.H - TOP - 66) / ROW); },
    draw(ctx) {
      const H = G.screen.H, L = lists(), rows = this.rows(), U = G.ui, C = U.C;
      U.backdrop(ctx);
      U.title(ctx, 'СУНДУК', W / 2, 3, 90);
      F.small.draw(ctx, `Подсумок ${G.game.pouchUsed()}/${G.game.pouchMax()}`, W / 2, 24, { align: 'center', color: '#f4e4bc', shadow: C.woodEdge });
      for (const c of [0, 1]) {
        const x = c * (W / 2) + 4, w = W / 2 - 7, h = TOP + rows * ROW + 8 - 38;
        U.panel(ctx, x, 38, w, h, 'frame');
        F.draw(ctx, c ? 'Сундук' : 'Сумка', x + w / 2, 45, { align: 'center', color: c === col ? C.redDark : C.inkFaint });
        if (!L[c].length) F.small.draw(ctx, 'пусто', x + w / 2, TOP + 6, { align: 'center', color: C.inkDim });
        for (let i = 0; i < rows; i++) {
          const k = scroll[c] + i, id = L[c][k]; if (!id) break;
          const y = TOP + i * ROW, on = c === col && k === sel[c];
          U.row(ctx, x + 5, y - 1, w - 10, ROW - 1, on);
          const cnt = c ? chest()[id] : G.state.inv[id];
          F.small.draw(ctx, G.ITEMS[id].name, x + 9, y + 2, { color: on ? '#f8eed0' : C.ink, shadow: on ? '#5a1408' : null, maxW: w - 34 });
          F.small.draw(ctx, '×' + cnt, x + w - 9, y + 2, { align: 'right', color: on ? '#f4d46a' : C.inkDim });
        }
      }
      const cur = L[col][sel[col]];
      const iy = H - 58;
      U.panel(ctx, 4, iy, W - 8, 54, 'frame');
      F.small.draw(ctx, msgT > 0 ? msg : cur ? (col ? 'Коснись ещё раз — взять в сумку' : 'Коснись ещё раз — положить в сундук') : 'Выбери вещь в сумке или в сундуке', 12, iy + 9, { color: msgT > 0 ? C.err : C.redDark, maxW: W - 24 });
      if (cur) F.small.wrap(G.ITEMS[cur].desc || '', W - 24).slice(0, 2).forEach((ln, i) => F.small.draw(ctx, ln, 12, iy + 24 + i * 12, { color: C.ink }));
    },
  };
  return S;
});
