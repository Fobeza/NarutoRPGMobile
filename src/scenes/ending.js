// Концовка: результат экзамена, стиль ниндзя, команда (эпилог), статистика, титры.
G.scenes.register('ending', () => {
  const W = G.screen.W, F = G.font, P = G.PAL;
  const st = G.state, v = st.vars, f = st.flags, name = st.hero.name;
  const fmt = (t) => G.util.fmt(t, { name });
  const s = st.hero.stats || {};
  const cats = [['tai', 'Мастер тайдзюцу'], ['nin', 'Ниндзюцу-специалист'], ['gen', 'Иллюзионист'], ['know', 'Тактик']].map(([k, n]) => [s[k] || 3, n]).sort((a, b) => b[0] - a[0]);
  const style = cats[0][0] - cats[3][0] <= 1 ? 'Универсал' : cats[0][1];
  const team = G.friends.team();
  const kind = f.best ? 'best' : f.graduated ? 'grad' : 'redeem';
  const TEAMS = {
    7: ['КОМАНДА 7', 'Наруто, Саске, Сакура — и ты.', 'Сенсей опаздывает на три часа. Наконец в дверь заглядывает седой джонин с книжкой: «Хм. Моё первое впечатление... вы мне не нравитесь». Это Какаши Хатаке.', 'Наруто: «Четвёртый — это ты?! Даттебайо! Мы непобедимы!»'],
    8: ['КОМАНДА 8', 'Хината, Киба, Шино — и ты.', 'Куренай Юхи улыбается: «Команда следопытов. Ваша сила — в том, чтобы видеть то, чего не видят другие».', 'Киба: «Ха! Стая стала больше!» — Акамару радостно лает. Хината тихо улыбается.'],
    10: ['КОМАНДА 10', 'Шикамару, Чоджи, Ино — и ты.', 'Асума Сарутоби закуривает и смеётся: «Ино-Шика-Чо и четвёртый. Будет интересно».', 'Шикамару: «Четверо — значит, мне можно работать на четверть меньше. Хлопотно... но я рад».'],
  };
  const T = TEAMS[team];
  const top = Object.keys(G.FRIENDS).sort((a, b) => G.friends.pts(b) - G.friends.pts(a)).slice(0, 3).map((id) => (G.chars.nameOf(id) + ' ' + '♥'.repeat(G.friends.level(id))).trim());
  const pages = [
    { title: { best: 'ЛУЧШИЙ ВЫПУСКНИК', grad: 'ВЫПУСКНИК', redeem: 'ИСКУПЛЕНИЕ' }[kind], col: P.yellow, lines: {
      best: ['Утром тебя вызывают в Резиденцию.', 'Третий Хокаге лично повязывает тебе протектор.', fmt('«Ты защитил Наруто и свиток, {name}. В тебе горит Воля Огня. Твои родители гордились бы тобой».')],
      grad: ['Утром Ирука-сенсей находит тебя у качелей.', 'На твоём лбу — протектор Листа. Ты — генин.', '«Прошлой ночью ты доказал, что достоин его вдвойне», — говорит Ирука.'],
      redeem: ['Экзамен провален... но прошлой ночью ты спас Наруто и Запретный свиток.', 'Ирука снимает свой протектор и повязывает его тебе.', '«Ты сдал главный экзамен, {name}. Поздравляю с выпуском!»'].map(fmt),
    }[kind] },
    { title: 'СТИЛЬ НИНДЗЯ', col: P.orange, lines: [`«${style}»`, `Тайдзюцу ${s.tai} · Ниндзюцу ${s.nin} · Гендзюцу ${s.gen}`, `Чакра ${s.chakra} · Контроль ${s.ctrl} · Скорость ${s.spd}`, `Выносливость ${s.end} · Знания ${s.know}`, v.title_t === 4 ? 'Чемпион турнира Академии' : v.title_t ? 'Участник турнира Академии' : '', (v.rival || 0) >= 3 ? 'Саске признал тебя соперником' : '', f.told_iruka ? 'Ирука услышал твоё предупреждение о Мизуки' : ''] },
    { title: 'РАСПРЕДЕЛЕНИЕ ПО КОМАНДАМ', col: '#8ae070', lines: ['Через неделю всех выпускников собирают в классе.', 'Ирука зачитывает списки...', `${T[0]}: ${T[1]}`, '«Четвёртый член команды — по особому решению Хокаге».'] },
    { title: T[0], col: '#8ae070', lines: [T[2], T[3]] },
    { title: 'ТВОИ 8 НЕДЕЛЬ', col: P.light, lines: [`Дней прожито: ${v.day} · Боёв: ${v.battles || 0}, побед: ${v.wins || 0}`, `Тренировок: ${v.trainings || 0} · Поручений: ${v.jobs || 0}`, `Секретных свитков: ${v.scrolls || 0}/20 · Репутация: ${v.rep || 0}`, `Экзамен: ${v.exam || 0} баллов · Посещаемость: ${G.academy.attendance()}%`, 'Лучшие друзья: ' + top.join(', ')] },
    { title: 'ВОЛЯ ОГНЯ', col: P.orange, lines: ['Фан-игра по мотивам «Наруто» Масаси Кисимото.', 'Сделано для личного использования.', '', 'Спасибо, что играл!', '', 'ПРОДОЛЖЕНИЕ СЛЕДУЕТ...'] },
  ];
  let i = 0, t = 0;
  f.game_clear = 1; f['end_' + kind] = 1; f['team_' + team] = 1;
  // «Продолжить» после титров возвращает в свободное утро дома, а не в ночной лес после финала
  if (v.day < 55) v.day = 55;
  v.min = G.hero.wakeMin(); v.hp = 100; v.chakra = 100; v.energy = 100; v.food = Math.max(v.food, 60);
  st.daily = {}; st.log = [];
  try { st.pos = { map: G.world.heroHome().interior.id, x: 3 * 16 + 8, y: 4 * 16 + 4, dir: 'down' }; } catch (_) {}
  G.storage.save(G.state);
  return {
    name: 'ending',
    update(dt) {
      t += dt; const I = G.input;
      if (t > 0.8 && (I.pressed('a') || I.tapNow)) { G.audio.sfx.confirm(); i++; t = 0; if (i >= pages.length) G.scenes.fadeTo(G.scenes.make('title')); }
    },
    draw(ctx) {
      const H = G.screen.H, p = pages[Math.min(i, pages.length - 1)];
      ctx.fillStyle = '#0e0c16'; ctx.fillRect(0, 0, W, H);
      for (let k = 0; k < 50; k++) { ctx.fillStyle = (Math.sin(t * 2 + k) > 0.5) ? '#fff' : '#5a5a80'; ctx.fillRect((k * 53) % W, (k * 29) % Math.round(H * 0.4), 1, 1); }
      // протектор
      ctx.fillStyle = '#2a3a6a'; ctx.fillRect(W / 2 - 40, 26, 80, 18); ctx.fillStyle = '#c8ccd8'; ctx.fillRect(W / 2 - 22, 28, 44, 14);
      ctx.strokeStyle = '#5a5a6a'; ctx.beginPath(); ctx.arc(W / 2, 35, 4, 0.5, 5.8); ctx.stroke(); ctx.beginPath(); ctx.moveTo(W / 2 + 3, 33); ctx.lineTo(W / 2 + 10, 30); ctx.stroke();
      if (kind === 'redeem' && i === 0) { ctx.fillStyle = '#a07050'; ctx.fillRect(W / 2 - 40, 44, 80, 1); }
      const a = Math.min(1, t * 2); ctx.globalAlpha = a;
      F.draw(ctx, p.title, W / 2, 58, { align: 'center', color: p.col });
      let y = 76;
      for (const l of p.lines) for (const w of F.wrap(l, W - 20)) { F.draw(ctx, w, W / 2, y, { align: 'center', color: P.white }); y += 11; }
      ctx.globalAlpha = 1;
      F.draw(ctx, `${i + 1}/${pages.length}`, W - 6, H - 12, { align: 'right', color: P.gray });
      if (t > 0.8) F.draw(ctx, 'Нажми A', W / 2, H - 14, { align: 'center', color: Math.sin(t * 5) > 0 ? P.gray : '#4a4660' });
    },
  };
});
