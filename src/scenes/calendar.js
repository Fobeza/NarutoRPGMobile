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
    if (ev) out.push({ c: P.orange, t: ev });
    for (const e of G.STORY) if (e.day === d && STORY_NAMES[e.id] && ev !== STORY_NAMES[e.id]) out.push({ c: P.orange, t: STORY_NAMES[e.id] });
    if (G.calendar.BDAY[d]) out.push({ c: P.yellow, t: 'День рождения: ' + G.chars.nameOf(G.calendar.BDAY[d]) });
    if (G.academy.isSchoolDay(d)) out.push({ c: '#7ab0e8', t: 'Уроки 8:00–13:00' + ((d - 1) % 7 === 4 ? ' · тест' : '') });
    else if (d < 54) out.push({ c: P.gray, t: (d - 1) % 7 >= 5 ? 'Выходной' : d === 1 ? 'Первый день в деревне' : 'Нет уроков' });
    const Q = G.state.quests || {};
    for (const id of Object.keys(Q)) if (Q[id].st === 'active' && Q[id].due === d && G.QUESTS[id]) out.push({ c: '#e87a7a', t: 'Срок: ' + G.QUESTS[id].title });
    out.push({ c: P.light, t: 'Погода: ' + WEATHER[G.life.weather(d)] });
    return out;
  }
  function marks(d) {
    const m = [];
    if (G.calendar.EVENTS[d] || G.STORY.some((e) => e.day === d && STORY_NAMES[e.id])) m.push(P.orange);
    if (G.calendar.BDAY[d]) m.push(P.yellow);
    const Q = G.state.quests || {};
    if (Object.keys(Q).some((id) => Q[id].st === 'active' && Q[id].due === d)) m.push('#e87a7a');
    return m;
  }
  const hh = (a, b) => String(a).padStart(2, '0') + '–' + String(b).padStart(2, '0');

  return {
    name: 'calendar',
    update(dt) {
      const I = G.input, W = G.screen.W;
      if (I.pressed('b') || I.pressed('menu')) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
      if (I.tapNow) {
        const t = I.tapNow;
        if (t.y > G.screen.H - 16) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
        if (t.y >= 13 && t.y < 27) { const nt = t.x < W / 2 ? 0 : 1; if (nt !== tab) { tab = nt; G.audio.sfx.select(); } return; }
        if (tab === 0) {
          const cw = (W - 8) / 7, col = Math.floor((t.x - 4) / cw), row = Math.floor((t.y - 40) / 24);
          if (col >= 0 && col < 7 && row >= 0 && row < 4) { sel = page() * 28 + row * 7 + col + 1; G.audio.sfx.select(); }
          else if (t.y >= 28 && t.y < 40) { sel = t.x < W / 2 ? Math.max(1, sel - 28) : Math.min(56, sel + 28); G.audio.sfx.select(); }
        } else {
          if (t.y < 52) { ci = (ci + (t.x < W / 2 ? ids.length - 1 : 1)) % ids.length; scroll = 0; G.audio.sfx.select(); }
          else if (t.y < 66) { wk = !wk; scroll = 0; G.audio.sfx.select(); }
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
      const W = G.screen.W, H = G.screen.H, V = G.state.vars;
      ctx.fillStyle = '#1e1a28'; ctx.fillRect(0, 0, W, H);
      F.draw(ctx, 'КАЛЕНДАРЬ', W / 2, 3, { align: 'center', color: P.orange });
      ['Дни', 'Расписание'].forEach((t, i) => {
        const x = i * (W / 2), s = i === tab;
        ctx.fillStyle = s ? '#3a3450' : '#24202e'; ctx.fillRect(x + 2, 14, W / 2 - 4, 13);
        F.draw(ctx, t, x + W / 4, 17, { align: 'center', color: s ? P.white : P.gray });
      });
      if (tab === 0) this.drawDays(ctx, W, H, V); else this.drawSched(ctx, W, H, V);
      F.draw(ctx, '(A) вкладка  (B) назад', W / 2, H - 12, { align: 'center', color: P.light });
    },
    drawDays(ctx, W, H, V) {
      const pg = page(), cw = (W - 8) / 7;
      for (let c = 0; c < 7; c++) F.draw(ctx, ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][c], 4 + c * cw + cw / 2, 31, { align: 'center', color: c > 4 ? '#e87a7a' : P.gray });
      for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) {
        const d = pg * 28 + r * 7 + c + 1;
        if (d > 56) continue;
        const x = 4 + c * cw, y = 40 + r * 24;
        ctx.fillStyle = d === sel ? '#5a4a80' : d === V.day ? '#3a5a3a' : c > 4 ? '#2c2438' : '#262034';
        ctx.fillRect(x + 1, y, cw - 2, 22);
        if (d === sel) { ctx.strokeStyle = P.yellow; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, y + 0.5, cw - 3, 21); }
        F.draw(ctx, String(d), x + 3, y + 3, { color: d < V.day ? P.gray : P.white });
        marks(d).slice(0, 3).forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(x + 3 + i * 5, y + 15, 4, 4); });
        if (G.academy.isSchoolDay(d)) { ctx.fillStyle = '#7ab0e8'; ctx.fillRect(x + cw - 7, y + 3, 4, 4); }
      }
      let y = 140;
      F.draw(ctx, `День ${sel} · ${G.game.dayNameFull(sel)}  (сегодня ${V.day})`, 6, y, { color: P.yellow }); y += 13;
      for (const it of dayItems(sel)) {
        if (y > H - 24) break;
        ctx.fillStyle = it.c; ctx.fillRect(6, y + 2, 3, 3);
        for (const ln of F.wrap(it.t, W - 22)) { if (y > H - 24) break; F.draw(ctx, ln, 13, y, { color: P.white }); y += 11; }
        y += 2;
      }
    },
    drawSched(ctx, W, H, V) {
      const id = ids[ci], s = G.SCHED[id];
      F.draw(ctx, '<  ' + G.chars.nameOf(id) + '  >', W / 2, 32, { align: 'center', color: P.white });
      const known = V.day >= s.since;
      if (!known) { F.draw(ctx, 'Пока не знакомы', W / 2, 70, { align: 'center', color: P.gray }); F.draw(ctx, `(появится с дня ${s.since})`, W / 2, 82, { align: 'center', color: P.gray }); return; }
      F.draw(ctx, 'Сейчас: ' + G.schedule.label(id), 6, 43, { color: P.orangeLight, maxW: W - 12 });
      ctx.fillStyle = '#3a3450'; ctx.fillRect(2, 55, W - 4, 11);
      F.draw(ctx, wk ? 'БУДНИ  (вверх/вниз: смена)' : 'ВЫХОДНЫЕ  (вверх/вниз: смена)', W / 2, 57, { align: 'center', color: P.white });
      const rows = G.schedule.rowsFor(id, wk ? 36 : 41);
      let y = 74;
      for (const r of rows) {
        const now = G.schedule.at(id) === r;
        F.draw(ctx, hh(r[1], r[2]), 6, y, { color: now ? P.yellow : P.light });
        const lines = F.wrap(r[3], W - 46);
        lines.forEach((ln, i) => F.draw(ctx, ln, 40, y + i * 10, { color: now ? P.yellow : P.white }));
        y += Math.max(1, lines.length) * 10 + 5;
        if (y > H - 24) break;
      }
      if (!rows.length) F.draw(ctx, 'Нет данных', 6, y, { color: P.gray });
    },
  };
});
