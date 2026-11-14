// Экран «Итоги главы»: открывается после эпилога первой главы и из меню паузы, пока идёт свободная жизнь.
// Показывает, чем закончились три недели, и даёт выбор: остаться в деревне или начать заново с тем,
// что герой действительно вынес из этого прохождения, — картами и их мастерством («Новая игра+»).
G.ending = {
  // Строки итога: [подпись, значение]. Отдельной функцией — её же читают проверки.
  summary() {
    const st = G.state, v = st.vars, f = st.flags;
    const friends = Object.keys(G.FRIENDS).filter((id) => G.friends.level(id) > 0).sort((a, b) => G.friends.pts(b) - G.friends.pts(a));
    const quests = Object.values(st.quests || {}).filter((q) => q.st === 'done').length;
    const cards = Object.keys(G.CARDS).filter((id) => G.combat.mastery(id) > 0).length;
    const stars = Object.keys(G.CARDS).reduce((n, id) => n + G.combat.mastery(id), 0);
    return [
      ['Прожито дней', String(v.day)],
      ['Экзамен', f.genin ? 'сдан — генин' : 'не сдан'],
      ['У ворот', f.mq_won ? 'победа' : 'выстоял'],
      ['Бои', `${v.wins || 0} побед из ${v.battles || 0}`],
      ['Учёба', G.academy.avg() ? `${G.academy.avg()} · посещ. ${G.academy.attendance()}%` : '—'],
      ['Задания', String(quests)],
      ['Друзья', friends.length ? friends.slice(0, 3).map((id) => G.chars.nameOf(id) + ' ' + '♥'.repeat(G.friends.level(id))).join(', ') : '—'],
      ['Освоено карт', cards ? `${cards} (${'★'.repeat(Math.min(3, stars))}${stars > 3 ? ' ×' + stars : ''})` : '—'],
      ['Стабильность', String(G.purple.stability())],
    ];
  },
  // Что переносится в «Новую игру+»: свои карты, колода, мастерство карт и счётчик прохождений.
  carry() {
    const st = G.state, uses = {};
    for (const [k, n] of Object.entries(st.vars)) if (k.startsWith('use_')) uses[k] = n;
    return { cardOwned: JSON.parse(JSON.stringify(st.cardOwned || null)), deck: (st.deck || []).slice(), uses, ngplus: (st.vars.ngplus || 0) + 1 };
  },
  newGamePlus() {
    const c = this.carry();
    const st = G.game.newState();
    if (c.cardOwned) { st.cardOwned = c.cardOwned; st.deck = c.deck; }
    Object.assign(st.vars, c.uses, { ngplus: c.ngplus });
    G.deck.ensure(st);
    G.scenes.fadeTo(G.scenes.make('prologue'));
  },
};

G.scenes.register('ending', (onDone) => {
  const F = G.font, FS = G.font.small, U = G.ui, C = U.C;
  let t = 0, focus = 0;
  const rows = G.ending.summary();
  const geo = () => {
    const W = G.screen.W, H = G.screen.H, bh = Math.max(22, Math.ceil(44 / (G.screen.scale || 1))), bw = Math.floor((W - 20) / 2);
    const ph = 40 + rows.length * 13 + 10, py = Math.max(30, Math.round((H - ph - bh - 14) / 2));
    return { W, H, bh, bw, ph, py, by: py + ph + 8, b: [{ x: 8, w: bw }, { x: 12 + bw, w: bw }] };
  };
  const stay = () => { G.audio.sfx.confirm(); G.scenes.pop(); onDone && onDone(); };
  const again = () => {
    G.scenes.push(G.scenes.make('pick', { title: 'НОВАЯ ИГРА+', text: 'Начать историю заново. С тобой останутся карты, колода и их мастерство.',
      options: [{ label: 'Нет, остаться', desc: 'Свободная жизнь в деревне продолжается.' }, { label: 'Да, начать заново', desc: 'Текущее сохранение останется в своём слоте до первой записи новой игры.' }] }, (i) => {
      if (i === 1) G.ending.newGamePlus();
    }));
  };
  return {
    name: 'ending',
    touch() { return {}; },
    summary: () => rows,
    update(dt) {
      t += dt;
      const I = G.input, g = geo();
      if (t < 0.6) return;
      if (I.pressed('left') || I.pressed('right')) { focus = 1 - focus; G.audio.sfx.blip(); }
      if (I.tapNow) {
        const p = I.tapNow, i = g.b.findIndex((b) => p.x >= b.x && p.x < b.x + b.w && p.y >= g.by && p.y < g.by + g.bh);
        if (i === 0) stay(); else if (i === 1) again();
        return;
      }
      if (I.pressed('b')) return stay();
      if (I.pressed('a')) (focus ? again : stay)();
    },
    draw(ctx) {
      const g = geo(), W = g.W;
      ctx.fillStyle = '#0e0c16'; ctx.fillRect(0, 0, W, g.H);
      for (let i = 0; i < 50; i++) { ctx.fillStyle = Math.sin(t * 2 + i) > 0.6 ? '#ffffff' : '#7a7aa0'; ctx.fillRect((i * 53) % W, (i * 37) % g.H, 1, 1); }
      U.panel(ctx, 6, g.py, W - 12, g.ph, 'frame');
      U.title(ctx, 'ГЛАВА ПРОЙДЕНА', W / 2, g.py - 7, 0);
      F.draw(ctx, G.state.hero.name || 'Герой', W / 2, g.py + 14, { align: 'center', color: C.redDark });
      FS.draw(ctx, (G.state.vars.ngplus ? `Прохождение ${G.state.vars.ngplus + 1} · ` : '') + '«Воля Огня», глава первая', W / 2, g.py + 28, { align: 'center', color: C.inkDim, maxW: W - 28 });
      rows.forEach(([k, val], i) => {
        const y = g.py + 42 + i * 13;
        FS.draw(ctx, k, 16, y, { color: C.inkDim });
        FS.draw(ctx, val, W - 16, y, { align: 'right', color: C.ink, maxW: W - 40 - FS.measure(k) });
      });
      ['Остаться', 'Новая игра+'].forEach((label, i) => {
        const b = g.b[i];
        U.button(ctx, b.x, g.by, b.w, g.bh, '', i === focus ? 'sel' : 'normal');
        FS.draw(ctx, label, b.x + b.w / 2, g.by + Math.round(g.bh / 2) - 4, { align: 'center', color: '#f8eed0', shadow: '#160c06', maxW: b.w - 6 });
      });
    },
  };
});
// call ending — показать итоги главы после реплик (эпилог)
G.script.actions.ending = () => { G.game.pending = { type: 'ending' }; };
G.flow.ending = (a, world) => G.scenes.push(G.scenes.make('ending'));
