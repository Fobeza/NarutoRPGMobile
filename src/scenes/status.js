// Статус героя (меню → «Статус»): нужды, характеристики, навыки, дружба, день и погода.
G.scenes.register('status', () => {
  const FRIENDS = Object.keys(G.FRIENDS);
  let scroll = 0;
  let buffer = null;
  const contentH = () => Math.max(G.screen.H - 24, 330 + Math.ceil(FRIENDS.filter((id) => G.state.flags['met_' + id]).length / 2) * 16);
  const maxScroll = () => Math.max(0, contentH() - G.screen.H + 24);
  return {
    name: 'status',
    update(dt) {
      const I = G.input;
      if (I.pressed('b') || I.pressed('a') || I.pressed('menu')) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
      if (I.repeat('up', dt)) scroll -= 48;
      if (I.repeat('down', dt)) scroll += 48;
      if (I.tapNow && I.tapNow.y >= G.screen.H - 24) scroll += I.tapNow.x < G.screen.W / 2 ? -80 : 80;
      scroll = G.util.clamp(scroll, 0, maxScroll());
    },
    draw(ctx) {
      const W = G.screen.W, H = G.screen.H, U = G.ui;
      scroll = G.util.clamp(scroll, 0, maxScroll());
      if (!buffer || buffer.lw !== W || buffer.lh !== contentH()) buffer = G.gfx.canvas(W, contentH());
      const c = buffer;
      this.drawContent(c.getContext('2d'), contentH());
      U.backdrop(ctx);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 20, W, H - 44); ctx.clip(); ctx.drawImage(c, 0, -scroll); ctx.restore();
      U.title(ctx, 'СТАТУС', W / 2, 3, 80);
      U.button(ctx, 4, H - 23, (W - 12) / 2, 20, '▲ Выше', scroll > 0 ? 'normal' : 'dis');
      U.button(ctx, W / 2 + 2, H - 23, (W - 12) / 2, 20, '▼ Ниже', scroll < maxScroll() ? 'normal' : 'dis');
    },
    drawContent(ctx, H) {
      const W = G.screen.W, F = G.font, S = G.font.small, U = G.ui, C = U.C, g = G.game, v = g.v;
      U.backdrop(ctx);
      U.title(ctx, 'СТАТУС', W / 2, 3, 80);
      let y = 20;
      // герой, неделя, дата и погода
      U.panel(ctx, 4, y, W - 8, 44, 'frame');
      F.draw(ctx, G.state.hero.name || 'Герой', 14, y + 9, { color: C.redDark, maxW: W - 34 - S.measure(`Неделя ${g.week()}`) });
      S.draw(ctx, `Неделя ${g.week()}`, W - 14, y + 11, { align: 'right', color: C.inkDim });
      const wt = G.life.WEATHER[G.life.weather()];
      // узкий экран («крупно»): время суток не влезает — без него, а не с обрезанным «У…»
      const when = [`${g.dayName()}, день ${v.day} · ${g.clock()} · ${G.life.period()}`, `${g.dayName()}, день ${v.day} · ${g.clock()}`].find((t) => S.measure(t) <= W - 90);
      S.draw(ctx, when || `${g.dayName()}, день ${v.day} · ${g.clock()}`, 14, y + 28, { color: C.inkDim, maxW: W - 90 });
      S.draw(ctx, wt.icon + ' ' + wt.name, W - 14, y + 28, { align: 'right', color: '#3a62a0' });
      y += 48;
      // нужды: бамбуковые шкалы
      const bars = [['Здоровье', v.hp, C.hp], ['Чакра', v.chakra, C.chakra], ['Сытость', v.food, C.food], ['Энергия', v.energy, C.energy], ['Настроение', v.mood, '#a860c0']];
      U.panel(ctx, 4, y, W - 8, bars.length * 16 + 12, 'frame');
      bars.forEach(([nm, val, col], i) => {
        const yy = y + 9 + i * 16;
        S.draw(ctx, nm, 14, yy, { color: C.ink });
        const bw = W - 8 - 14 * 2 - 82 - 62;
        U.gauge(ctx, 14 + 82, yy + 1, bw, 7, Math.max(0, Math.min(100, val)) / 100, col);
        S.draw(ctx, i === 4 ? g.moodName() : String(Math.round(val)), W - 14, yy, { align: 'right', color: val < 20 ? C.err : C.ink });
      });
      y += bars.length * 16 + 16;
      // характеристики
      const rows = Math.ceil(G.STATS.length / 2);
      U.panel(ctx, 4, y, W - 8, rows * 15 + 14, 'well');
      if (!G.hero.ready()) S.draw(ctx, 'Вступительный тест ещё не пройден', W / 2, y + 12, { align: 'center', color: C.inkDim });
      else G.STATS.forEach((st, i) => {
        const cw = Math.floor((W - 24) / 2), x = 12 + (i % 2) * cw, yy = y + 8 + Math.floor(i / 2) * 15;
        const sn = st.id === 'ctrl' ? 'Контроль' : st.name;
        S.draw(ctx, S.measure(sn) > cw - 30 && st.id === 'end' ? 'Выносл.' : sn, x, yy, { color: C.ink, maxW: cw - 30 });
        F.draw(ctx, String(G.hero.stat(st.id)), x + cw - 12, yy - 2, { align: 'right', color: C.redDark });
      });
      y += rows * 15 + 18;
      // навыки, Академия, дружба
      U.panel(ctx, 4, y, W - 8, H - y - 4, 'frame');
      let ty = y + 9;
      const sk = (G.state.hero.skills || []).map((id) => (G.SKILLS.find((s) => s.id === id) || {}).name).filter(Boolean);
      for (const ln of S.wrap('Навыки: ' + (sk.join(', ') || '—'), W - 24)) { S.draw(ctx, ln, 12, ty, { color: C.redDark }); ty += 12; }
      const A = G.academy, vv = G.state.vars;
      S.draw(ctx, `Оценки ${A.avg() || '—'} · посещ. ${A.attendance()}% · реп. ${vv.rep || 0}`, 12, ty, { color: '#3a62a0', maxW: W - 24 }); ty += 12;
      S.draw(ctx, `Экзамен через ${Math.max(0, 54 - vv.day)} дн. · свитки ${vv.scrolls || 0}`, 12, ty, { color: C.inkDim, maxW: W - 24 }); ty += 15;
      const met = FRIENDS.filter((id) => G.state.flags['met_' + id]);
      F.draw(ctx, 'Дружба', 12, ty, { color: C.redDark }); ty += 16;
      if (!met.length) S.draw(ctx, 'Пока ни с кем не знаком', 12, ty, { color: C.inkDim });
      met.forEach((id, i) => {
        const cw = Math.floor((W - 24) / 2), x = 12 + (i % 2) * cw, yy = ty + Math.floor(i / 2) * 13;
        if (yy > H - 18) return;
        const hn = Math.max(0, Math.min(5, G.friends.level(id)));
        S.draw(ctx, G.chars.nameOf(id), x, yy, { color: C.ink, maxW: cw - 44 });
        S.draw(ctx, '♥'.repeat(hn), x + cw - 12 - S.measure('·'.repeat(5 - hn)), yy, { align: 'right', color: C.red });
        S.draw(ctx, '·'.repeat(5 - hn), x + cw - 12, yy, { align: 'right', color: C.inkFaint });
      });
    },
  };
});

// Пауза при возвращении в игру после сворачивания Safari
G.scenes.register('pause', () => ({
  name: 'pause',
  transparent: true,
  t: 0,
  update(dt) {
    this.t += dt;
    const I = G.input;
    if (this.t > 0.3 && (I.pressed('a') || I.pressed('b') || I.pressed('menu') || I.tapNow)) { G.audio.sfx.confirm(); G.scenes.pop(); }
  },
  draw(ctx) {
    const W = G.screen.W, H = G.screen.H, F = G.font, U = G.ui, C = U.C;
    ctx.globalAlpha = 0.6; ctx.fillStyle = '#0a0604'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    U.panel(ctx, W / 2 - 70, H / 2 - 34, 140, 66, 'frame');
    F.draw(ctx, 'ПАУЗА', W / 2, H / 2 - 22, { align: 'center', color: C.redDark });
    F.small.draw(ctx, `${G.game.dayName()}, ${G.game.clock()}`, W / 2, H / 2 - 5, { align: 'center', color: C.inkDim });
    if (Math.floor(this.t * 2) % 2 === 0) F.small.draw(ctx, 'Коснись экрана', W / 2, H / 2 + 11, { align: 'center', color: C.ink });
  },
}));
