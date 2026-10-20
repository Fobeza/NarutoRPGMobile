// Календарь (месяц = 4 недели, 2 страницы за игру) и расписания персонажей.
G.scenes.register('calendar', () => {
  const F = G.font, P = G.PAL;
  const STORY_NAMES = { tora: 'Пропал кот Тора', konohamaru: 'Мелкий Коноханамару', iruka_story: 'Вечер с Ирукой', hinata_rain: 'Дождь и Хината', ino_sakura: 'Ино и Сакура',
    sasuke_sunset: 'Закат с Саске', clouds: 'Шикамару и облака', anko: 'Анко и данго', will_fire: 'Воля Огня', mizuki1: 'Подозрительный Мизуки', mizuki2: 'Мизуки и свиток',
    kiba: 'Киба', roofs: 'Крыши с Наруто', prank: 'Шалость Наруто', lee: 'Рок Ли', festival: 'Фестиваль', night: 'Ночь экзамена' };
  const WEATHER = { sun: 'ясно', cloud: 'облачно', rain: 'дождь' };
  let tab = 0, sel = G.state.vars.day, ci = 0, wk = true, scroll = 0;
  const ids = G.schedule.who();
  const page = () => Math.floor((sel - 1) / 28);

  function dayItems(d) {
    const out = [];
    const ev = G.calendar.EVENTS[d];
    if (ev) out.push({ c: '#c8581a', t: ev });
    for (const e of G.STORY) if (e.day === d && STORY_NAMES[e.id] && ev !== STORY_NAMES[e.id]) out.push({ c: '#c8581a', t: STORY_NAMES[e.id] });
    if (G.calendar.BDAY[d]) out.push({ c: '#c89010', t: 'День рождения: ' + G.chars.nameOf(G.calendar.BDAY[d]) });
    if (G.academy.isSchoolDay(d)) out.push({ c: '#3a62a0', t: 'Уроки 8:00–13:00. Вход 7:30–9:30' + ((d - 1) % 7 === 4 ? ' · тест' : '') });
    else if (d < 54) out.push({ c: '#8a7a60', t: (d - 1) % 7 >= 5 ? 'Выходной' : d === 1 ? 'Первый день в деревне' : 'Нет уроков' });
    const Q = G.state.quests || {};
    for (const id of Object.keys(Q)) if (Q[id].st === 'active' && Q[id].due === d && G.QUESTS[id]) out.push({ c: '#b8321c', t: 'Срок: ' + G.QUESTS[id].title });
    out.push({ c: '#6a5238', t: 'Погода: ' + WEATHER[G.life.weather(d)] });
    return out;
  }
  function marks(d) {
    const m = [];
    if (G.calendar.EVENTS[d] || G.STORY.some((e) => e.day === d && STORY_NAMES[e.id])) m.push('#c8581a');
    if (G.calendar.BDAY[d]) m.push('#c89010');
    const Q = G.state.quests || {};
    if (Object.keys(Q).some((id) => Q[id].st === 'active' && Q[id].due === d)) m.push('#b8321c');
    return m;
  }
  const GY = 62, CH = 30;   // верх сетки дней и высота ячейки
  const hh = (a, b) => String(a).padStart(2, '0') + '–' + String(b).padStart(2, '0');

  return {
    name: 'calendar',
    update(dt) {
      const I = G.input, W = G.screen.W;
      if (I.pressed('b') || I.pressed('menu')) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
      if (I.tapNow) {
        const t = I.tapNow;
        if (t.y >= 20 && t.y < 42) { const nt = t.x < W / 2 ? 0 : 1; if (nt !== tab) { tab = nt; G.audio.sfx.select(); } return; }
        if (tab === 0) {
          const cw = (W - 14) / 7, col = Math.floor((t.x - 7) / cw), row = Math.floor((t.y - GY) / CH);
          if (col >= 0 && col < 7 && row >= 0 && row < 4) { sel = page() * 28 + row * 7 + col + 1; G.audio.sfx.select(); }
          else if (t.y >= 42 && t.y < GY) { sel = t.x < W / 2 ? Math.max(1, sel - 28) : Math.min(56, sel + 28); G.audio.sfx.select(); }
        } else {
          if (t.y < 68) { ci = (ci + (t.x < W / 2 ? ids.length - 1 : 1)) % ids.length; scroll = 0; G.audio.sfx.select(); }
          else if (t.y < 90) { wk = !wk; scroll = 0; G.audio.sfx.select(); }
        }
        return;
      }
      if (I.pressed('a')) { tab = 1 - tab; G.audio.sfx.select(); return; }
      if (tab === 0) {
        if (I.repeat('left', dt)) { sel = Math.max(1, sel - 1); G.audio.sfx.select(); }
        if (I.repeat('right', dt)) { sel = Math.min(56, sel + 1); G.audio.sfx.select(); }
        if (I.repeat('up', dt)) { sel = Math.max(1, sel - 7); G.audio.sfx.select(); }
        if (I.repeat('down', dt)) { sel = Math.min(56, sel + 7); G.audio.sfx.select(); }
      } else {
        if (I.repeat('left', dt)) { ci = (ci + ids.length - 1) % ids.length; scroll = 0; G.audio.sfx.select(); }
        if (I.repeat('right', dt)) { ci = (ci + 1) % ids.length; scroll = 0; G.audio.sfx.select(); }
        if (I.pressed('up') || I.pressed('down')) { wk = !wk; scroll = 0; G.audio.sfx.select(); }
      }
    },
    draw(ctx) {
      const W = G.screen.W, H = G.screen.H, V = G.state.vars, U = G.ui;
      U.backdrop(ctx);
      U.title(ctx, 'КАЛЕНДАРЬ', W / 2, 3, 100);
      ['Дни', 'Расписание'].forEach((t, i) => U.tab(ctx, 4 + i * (W / 2 - 2), 21, W / 2 - 6, 20, t, i === tab));
      if (tab === 0) this.drawDays(ctx, W, H, V); else this.drawSched(ctx, W, H, V);
    },
    drawDays(ctx, W, H, V) {
      const U = G.ui, C = U.C, pg = page(), cw = (W - 14) / 7;
      U.panel(ctx, 4, 44, W - 8, GY + 4 * CH - 40, 'frame');
      for (let c = 0; c < 7; c++) F.small.draw(ctx, ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][c], 7 + c * cw + cw / 2, 49, { align: 'center', color: c > 4 ? C.red : C.inkDim });
      for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) {
        const d = pg * 28 + r * 7 + c + 1;
        if (d > 56) continue;
        const x = Math.round(7 + c * cw), y = GY + r * CH, w = Math.round(cw) - 2;
        U.card(ctx, x, y, w, CH - 3, d === sel);
        if (d === V.day) { ctx.fillStyle = C.ok; ctx.fillRect(x + 3, y + 3, 5, 5); }
        F.small.draw(ctx, String(d), x + 5 + (d === V.day ? 5 : 0), y + 3, { color: d < V.day ? C.inkFaint : c > 4 ? C.red : C.ink });
        marks(d).slice(0, 3).forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(x + 4 + i * 6, y + CH - 11, 5, 5); });
        if (G.academy.isSchoolDay(d)) { ctx.fillStyle = '#3a62a0'; ctx.fillRect(x + w - 8, y + 4, 5, 5); }
      }
      // подробности выбранного дня
      const dy = GY + 4 * CH + 8;
      U.panel(ctx, 4, dy, W - 8, H - dy - 4, 'well');
      let y = dy + 8;
      F.draw(ctx, `День ${sel} · ${G.game.dayNameFull(sel)}`, 12, y, { color: C.redDark }); y += 16;
      for (const it of dayItems(sel)) {
        if (y > H - 20) break;
        ctx.fillStyle = it.c; ctx.fillRect(12, y + 3, 4, 4);
        for (const ln of F.small.wrap(it.t, W - 36)) { if (y > H - 20) break; F.small.draw(ctx, ln, 21, y, { color: C.ink }); y += 12; }
        y += 2;
      }
    },
    drawSched(ctx, W, H, V) {
      const U = G.ui, C = U.C, id = ids[ci], s = G.SCHED[id];
      U.panel(ctx, 4, 44, W - 8, H - 50, 'frame');
      F.draw(ctx, '‹', 16, 53, { color: C.red }); F.draw(ctx, '›', W - 20, 53, { color: C.red });
      F.draw(ctx, G.chars.nameOf(id), W / 2, 53, { align: 'center', color: C.redDark });
      const known = V.day >= s.since;
      if (!known) { F.draw(ctx, 'Пока не знакомы', W / 2, 96, { align: 'center', color: C.inkDim }); F.small.draw(ctx, `(появится с дня ${s.since})`, W / 2, 112, { align: 'center', color: C.inkDim }); return; }
      F.small.draw(ctx, 'Сейчас: ' + G.schedule.label(id), 12, 72, { color: C.redDark, maxW: W - 24 });
      U.row(ctx, 10, 87, W - 20, 17, true);
      F.draw(ctx, wk ? 'БУДНИ' : 'ВЫХОДНЫЕ', W / 2, 90, { align: 'center', color: '#f8eed0', shadow: '#5a1408' });
      F.small.draw(ctx, '⇅', W - 20, 91, { color: '#f4d46a' });
      const rows = G.schedule.rowsFor(id, wk ? 36 : 41);
      let y = 112;
      for (const r of rows) {
        const now = G.schedule.at(id) === r;
        F.small.draw(ctx, hh(r[1], r[2]), 12, y, { color: now ? C.red : C.inkDim });
        const lines = F.small.wrap(r[3], W - 66);
        lines.forEach((ln, i) => F.small.draw(ctx, ln, 54, y + i * 12, { color: now ? C.red : C.ink }));
        y += Math.max(1, lines.length) * 12 + 6;
        if (y > H - 20) break;
      }
      if (!rows.length) F.small.draw(ctx, 'Нет данных', 12, y, { color: C.inkDim });
    },
  };
});
