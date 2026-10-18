// Статус героя (меню → «Статус»): нужды, характеристики, навыки, дружба, день и погода.
G.scenes.register('status', () => {
  const FRIENDS = Object.keys(G.FRIENDS);
  return {
    name: 'status',
    update() {
      const I = G.input;
      if (I.pressed('b') || I.pressed('a') || I.pressed('menu') || I.tapNow) { G.audio.sfx.cancel(); G.scenes.pop(); }
    },
    draw(ctx) {
      const W = G.screen.W, H = G.screen.H, F = G.font, P = G.PAL, g = G.game, v = g.v;
      ctx.fillStyle = G.UI.deep; ctx.fillRect(0, 0, W, H);
      F.draw(ctx, 'СТАТУС', W / 2, 4, { align: 'center', color: P.orange });
      let y = 16;
      G.gfx.window(ctx, 2, y, W - 4, 34, 'paper');
      F.draw(ctx, G.state.hero.name || 'Герой', 8, y + 5, { color: G.UI.text });
      F.draw(ctx, `Неделя ${g.week()}`, W - 8, y + 5, { align: 'right', color: P.gray });
      const wt = G.life.WEATHER[G.life.weather()];
      F.draw(ctx, `${g.dayName()}, день ${v.day} · ${g.clock()} · ${G.life.period()}`, 8, y + 16, { color: P.gray });
      F.draw(ctx, wt.icon + ' ' + wt.name, W - 8, y + 16, { align: 'right', color: '#5a6a8a' });
      y += 37;
      // нужды
      const bars = [['Здоровье', v.hp, '#e04a4a'], ['Чакра', v.chakra, '#4a8ae0'], ['Сытость', v.food, '#e8a03a'], ['Энергия', v.energy, '#8ac85a'], ['Настроение', v.mood, '#d080e0']];
      G.gfx.window(ctx, 2, y, W - 4, bars.length * 10 + 8, 'dark');
      bars.forEach(([nm, val, col], i) => {
        const yy = y + 5 + i * 10;
        F.draw(ctx, nm, 8, yy, { color: P.light });
        const bw = Math.max(80, W - 70 - 60);
        ctx.fillStyle = '#0c0a12'; ctx.fillRect(70, yy + 1, bw, 5);
        ctx.fillStyle = col; ctx.fillRect(71, yy + 2, Math.round((bw - 2) * Math.max(0, Math.min(100, val)) / 100), 3);
        F.draw(ctx, i === 4 ? g.moodName() : String(Math.round(val)), W - 8, yy, { align: 'right', color: val < 20 ? '#ff7a6a' : P.white });
      });
      y += bars.length * 10 + 11;
      // характеристики
      G.gfx.window(ctx, 2, y, W - 4, 48, 'dark');
      if (!G.hero.ready()) F.draw(ctx, 'Вступительный тест ещё не пройден', W / 2, y + 20, { align: 'center', color: P.gray });
      else G.STATS.forEach((s, i) => {
        const cw = Math.floor((W - 16) / 2), x = 8 + (i % 2) * cw, yy = y + 5 + Math.floor(i / 2) * 10;
        F.draw(ctx, s.id === 'ctrl' ? 'Контроль' : s.name, x, yy, { color: P.light });
        F.draw(ctx, String(G.hero.stat(s.id)), x + cw - 10, yy, { align: 'right', color: P.yellow });
      });
      y += 51;
      // навыки
      const sk = (G.state.hero.skills || []).map((id) => (G.SKILLS.find((s) => s.id === id) || {}).name).filter(Boolean);
      F.draw(ctx, 'Навыки: ' + (sk.join(', ') || '—'), 6, y, { color: '#ff9a5a', maxW: W - 12 });
      y += 12;
      // Академия
      const A = G.academy, vv = G.state.vars;
      F.draw(ctx, `Оценки ${A.avg() || '—'} · посещ. ${A.attendance()}% · реп. ${vv.rep || 0}`, 6, y, { color: '#9ab0ff', maxW: W - 12 });
      y += 10;
      F.draw(ctx, `Неделя ${G.game.week()}/8 · экзамен через ${Math.max(0, 54 - vv.day)} дн. · свитки ${vv.scrolls || 0}`, 6, y, { color: P.light, maxW: W - 12 });
      y += 12;
      // дружба
      const met = FRIENDS.filter((id) => G.state.flags['met_' + id]);
      F.draw(ctx, 'Дружба', 6, y, { color: P.light });
      y += 10;
      if (!met.length) F.draw(ctx, 'Пока ни с кем не знаком', 6, y, { color: P.gray });
      met.forEach((id, i) => {
        const cw = Math.floor((W - 12) / 2), x = 6 + (i % 2) * cw, yy = y + Math.floor(i / 2) * 10;
        if (yy > H - 22) return;
        const n = G.friends.level(id);
        F.draw(ctx, G.chars.nameOf(id), x, yy, { color: P.white });
        const hn = Math.max(0, Math.min(5, n));
        F.draw(ctx, '♥'.repeat(hn), x + cw - 10 - F.measure('·'.repeat(5 - hn)), yy, { align: 'right', color: '#f08aa0' });
        F.draw(ctx, '·'.repeat(5 - hn), x + cw - 10, yy, { align: 'right', color: '#5a5068' });
      });
      F.draw(ctx, 'Любая кнопка — назад', W / 2, H - 12, { align: 'center', color: P.gray });
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
    const W = G.screen.W, H = G.screen.H, F = G.font, P = G.PAL;
    ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    G.gfx.window(ctx, W / 2 - 60, H / 2 - 24, 120, 44, 'paper');
    F.draw(ctx, 'ПАУЗА', W / 2, H / 2 - 17, { align: 'center', color: P.orange });
    F.draw(ctx, `${G.game.dayName()}, ${G.game.clock()}`, W / 2, H / 2 - 5, { align: 'center', color: P.gray });
    if (Math.floor(this.t * 2) % 2 === 0) F.draw(ctx, 'Нажми A', W / 2, H / 2 + 7, { align: 'center', color: G.UI.text });
  },
}));
