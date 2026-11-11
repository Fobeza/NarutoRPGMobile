// Экран «Колода»: слева карты, которые есть у героя, справа — что взято в бой.
// ←/→ — колонка, ↑/↓ — карта, A или второе касание — переложить. B или «Назад» — закрыть.
// Правила колоды — systems/deck.js (10–20 карт, до трёх копий, техники добавляются сами).
G.scenes.register('deckview', () => {
  let W = G.screen.W;
  const F = G.font, AU = G.audio, In = G.input, D = () => G.deck;
  const ROW = 17;
  // Раскладка от шапки с кнопкой «Назад» (G.touch.header): панели колонок, их заголовок и первая строка списка.
  const top = () => { const hh = G.touch.header().height; return { info: hh - 1, panel: hh + 27, rows: hh + 46 }; };
  let col = 0, sel = [0, 0], scroll = [0, 0], msg = '', msgT = 0;

  // Колонка 0 — «Есть» (можно положить), колонка 1 — «В колоде» (можно убрать)
  const lists = () => {
    const all = D().list();
    const free = [], inDeck = [];
    for (const c of all) {
      for (let i = c.inDeck; i < c.owned; i++) free.push(c);
      for (let i = 0; i < c.inDeck; i++) inDeck.push(c);
    }
    return [free.map((c) => c.id), inDeck.map((c) => c.id)];
  };

  const S = {
    name: 'deckview',
    // без этого на телефоне с экрана было не выйти: «Назад» рисует G.touch, клавиши B на сенсорном экране нет
    touch() { return { back: true, roomyBack: true }; },
    lists,   // для автотеста: [лежит вне колоды, лежит в колоде]
    move(fromCol, id) {   // переложить одну карту (и для автотеста)
      if (!id) return false;
      if (fromCol === 0) {
        if (!D().add(id)) { msg = D().size() >= D().MAX ? 'Колода заполнена (20 карт)' : 'Больше копий нет'; msgT = 1.6; AU.sfx.error(); return false; }
      } else if (!D().remove(id)) { msg = 'В колоде должно остаться минимум 10 карт'; msgT = 1.8; AU.sfx.error(); return false; }
      msg = (fromCol === 0 ? 'В колоду: ' : 'Из колоды: ') + (G.CARDS[id] || {}).name; msgT = 1.2;
      AU.sfx.select(); return true;
    },
    update(dt) {
      W = G.screen.W;
      if (msgT > 0) msgT -= dt;
      const L = lists(), rows = this.rows(), TOP = top().rows;
      if (In.pressed('b') || In.pressed('menu')) { AU.sfx.cancel(); G.scenes.pop(); return; }
      if (In.pressed('left') || In.pressed('right')) { col = 1 - col; AU.sfx.blip(); }
      const n = L[col].length;
      if (In.repeat('up', dt) && n) { sel[col] = (sel[col] + n - 1) % n; AU.sfx.blip(); }
      if (In.repeat('down', dt) && n) { sel[col] = (sel[col] + 1) % n; AU.sfx.blip(); }
      if (In.tapNow) {
        const tp = In.tapNow, c = tp.x < W / 2 ? 0 : 1, li = Math.floor((tp.y - TOP) / ROW), i = li + scroll[c];
        const px = c * (W / 2) + 4 + (W / 2 - 7) - 18, bot = TOP + rows * ROW;
        if (tp.x >= px && tp.y >= top().panel - 4 && tp.y < TOP - 2 && scroll[c] > 0) { col = c; sel[c] = Math.max(0, sel[c] - rows); AU.sfx.blip(); }
        else if (tp.x >= px && tp.y >= bot - 6 && tp.y < bot + 8 && scroll[c] + rows < L[c].length) { col = c; sel[c] = Math.min(L[c].length - 1, sel[c] + rows); AU.sfx.blip(); }
        else if (tp.y > TOP - 2 && li >= 0 && li < rows && tp.y < bot && i >= 0 && i < L[c].length) { col = c; if (sel[c] === i) this.move(c, L[c][i]); sel[c] = i; }
      } else if (In.pressed('a') && n) this.move(col, L[col][Math.min(sel[col], n - 1)]);
      for (const c of [0, 1]) {
        const m = lists()[c].length; if (sel[c] >= m) sel[c] = Math.max(0, m - 1);
        if (sel[c] < scroll[c]) scroll[c] = sel[c]; if (sel[c] >= scroll[c] + rows) scroll[c] = sel[c] - rows + 1;
      }
    },
    rows() { return Math.max(3, Math.floor((G.screen.H - top().rows - 66) / ROW)); },
    draw(ctx) {
      W = G.screen.W;
      const H = G.screen.H, L = lists(), rows = this.rows(), U = G.ui, C = U.C;
      const hd = G.touch.header(), g = top(), TOP = g.rows;
      U.backdrop(ctx);
      U.title(ctx, 'КОЛОДА', hd.titleX, hd.titleY, 80);
      F.small.draw(ctx, `${D().size()}/${D().MAX} карт · минимум ${D().MIN}`, W / 2, g.info, { align: 'center', color: '#f4e4bc', shadow: C.woodEdge });
      const techs = D().techs();
      // строка на тёмном дереве: чернильный цвет здесь не читался
      F.small.draw(ctx, techs.length ? 'Техники: ' + techs.join(', ') : 'Техник пока нет', W / 2, g.info + 13, { align: 'center', color: '#d8c8a0', shadow: C.woodEdge, maxW: W - 10 });
      for (const c of [0, 1]) {
        const x = c * (W / 2) + 4, w = W / 2 - 7, h = TOP + rows * ROW + 8 - g.panel;
        U.panel(ctx, x, g.panel, w, h, 'frame');
        const head = c ? 'В колоде' : 'Свои карты';   // на узком экране крупный заголовок вылезал за рамку
        (F.measure(head) > w - 14 ? F.small : F).draw(ctx, head, x + w / 2, g.panel + 5, { align: 'center', color: c === col ? C.redDark : C.inkFaint });
        if (!L[c].length) F.small.draw(ctx, c ? 'Пусто' : 'Всё в колоде', x + w / 2, TOP + 6, { align: 'center', color: C.inkDim });
        if (scroll[c] > 0) F.small.draw(ctx, '▲', x + w - 12, g.panel + 5, { color: C.red });
        if (scroll[c] + rows < L[c].length) F.small.draw(ctx, '▼', x + w - 12, TOP + rows * ROW - 2, { color: C.red });
        for (let i = 0; i < rows; i++) {
          const k = scroll[c] + i, id = L[c][k]; if (!id) break;
          const y = TOP + i * ROW, on = c === col && k === sel[c], def = G.CARDS[id];
          U.row(ctx, x + 5, y - 1, w - 10, ROW - 1, on);
          F.small.draw(ctx, def.name, x + 9, y + 2, { color: on ? '#f8eed0' : C.ink, shadow: on ? '#5a1408' : null, maxW: w - 34 });
          const cnt = c ? D().count(id) : D().own(id);
          F.small.draw(ctx, '×' + cnt, x + w - 9, y + 2, { align: 'right', color: on ? '#f4d46a' : C.inkDim });
        }
      }
      const cur = L[col][sel[col]];
      const iy = H - 58;
      U.panel(ctx, 4, iy, W - 8, 54, 'frame');
      const hint = msgT > 0 ? msg : cur ? (col ? 'Коснись ещё раз — убрать' : 'Коснись ещё раз — в колоду') : 'Слева — свои, справа — колода';
      F.small.draw(ctx, hint, 12, iy + 9, { color: C.redDark, maxW: W - 24 });
      if (cur) {
        F.small.draw(ctx, `${G.CARDS[cur].name} · в колоде ${D().count(cur)}, всего ${D().own(cur)}`, 12, iy + 24, { color: C.ink, maxW: W - 24 });
        F.small.wrap(G.CARDS[cur].text || '', W - 24).slice(0, 1).forEach((ln, i) => F.small.draw(ctx, ln, 12, iy + 36 + i * 10, { color: C.inkDim }));
      }
    },
  };
  return S;
});
