// Сундук-хранилище дома: слева сумка, справа сундук. ←/→ — колонка, ↑/↓ — предмет, A — переложить 1, B — закрыть.
G.scenes.register('storage', () => {
  const W = G.screen.W, F = G.font, P = G.PAL, AU = G.audio, In = G.input;
  let col = 0, sel = [0, 0], scroll = [0, 0], msg = '', msgT = 0;
  const chest = () => G.outdoor.chest();
  const lists = () => [
    Object.keys(G.state.inv).filter((k) => G.ITEMS[k] && !G.ITEMS[k].quest && G.state.inv[k] > 0 && G.ITEMS[k].cat !== 'service').sort(),
    Object.keys(chest()).filter((k) => chest()[k] > 0).sort(),
  ];
  const ROW = 11;
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
        const tp = In.tapNow, c = tp.x < W / 2 ? 0 : 1, i = Math.floor((tp.y - 40) / ROW) + scroll[c];
        if (tp.y > 40 && i >= 0 && i < L[c].length) { col = c; if (sel[c] === i) this.move(c, L[c][i]); sel[c] = i; }
      } else if (In.pressed('a') && n) this.move(col, L[col][Math.min(sel[col], n - 1)]);
      for (const c of [0, 1]) {
        const m = lists()[c].length; if (sel[c] >= m) sel[c] = Math.max(0, m - 1);
        if (sel[c] < scroll[c]) scroll[c] = sel[c]; if (sel[c] >= scroll[c] + rows) scroll[c] = sel[c] - rows + 1;
      }
    },
    rows() { return Math.floor((G.screen.H - 80) / ROW); },
    draw(ctx) {
      const H = G.screen.H, L = lists(), rows = this.rows();
      ctx.fillStyle = '#1a1624'; ctx.fillRect(0, 0, W, H);
      F.draw(ctx, 'Сундук-хранилище', W / 2, 6, { align: 'center', color: P.orange });
      F.draw(ctx, `Подсумок ${G.game.pouchUsed()}/${G.game.pouchMax()}`, W / 2, 18, { align: 'center', color: P.gray });
      for (const c of [0, 1]) {
        const x = c * (W / 2) + 3, w = W / 2 - 6;
        G.gfx.window(ctx, x, 28, w, H - 56, c === col ? 'dark' : 'dark');
        if (c === col) { ctx.strokeStyle = P.yellow; ctx.strokeRect(x + 0.5, 28.5, w - 1, H - 57); }
        F.draw(ctx, c ? 'Сундук' : 'Сумка', x + w / 2, 32, { align: 'center', color: c === col ? P.yellow : P.light });
        if (!L[c].length) F.draw(ctx, 'пусто', x + w / 2, 50, { align: 'center', color: P.gray });
        for (let i = 0; i < rows; i++) {
          const k = scroll[c] + i, id = L[c][k]; if (!id) break;
          const y = 44 + i * ROW, on = c === col && k === sel[c];
          if (on) { ctx.fillStyle = '#3a3548'; ctx.fillRect(x + 3, y - 1, w - 6, ROW - 1); }
          const cnt = c ? chest()[id] : G.state.inv[id];
          F.draw(ctx, G.ITEMS[id].name, x + 5, y, { color: on ? P.yellow : P.white, maxW: w - 28 });
          F.draw(ctx, 'x' + cnt, x + w - 5, y, { align: 'right', color: P.gray });
        }
      }
      const cur = L[col][sel[col]];
      F.draw(ctx, msgT > 0 ? msg : cur ? (col ? 'A — взять в сумку' : 'A — положить в сундук') + ' · B — закрыть' : '←/→ — сумка/сундук · B — закрыть', W / 2, H - 22, { align: 'center', color: msgT > 0 ? '#ff9a7a' : P.light, maxW: W - 8 });
      if (cur) F.draw(ctx, G.ITEMS[cur].desc || '', W / 2, H - 11, { align: 'center', color: P.gray, maxW: W - 8 });
    },
  };
  return S;
});
