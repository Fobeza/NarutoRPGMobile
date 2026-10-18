// Этапы 7 и 9: Академия (уроки и оценки), сюжет 8 недель, турнир, экзамен, финал, случайные события,
// доска поручений, календарь, секретные свитки, готовка и цветок дома.
const _H = 60;
const _dlg = (id, then) => { const w = G.scenes.stack.find((s) => s.name === 'world'); G.dialog.start(id, { bottom: 22, onEnd: () => { w && w.refreshNpcs(); then && then(); } }); };
const _say = (lines, then) => { const w = G.scenes.stack.find((s) => s.name === 'world'); G.dialog.say(lines.map((l) => typeof l === 'string' ? { text: l } : l), { bottom: 22, onEnd: () => { w && w.refreshNpcs(); then && then(); } }); };
const _world = () => G.scenes.stack.find((s) => s.name === 'world');
const _fmt = (t) => G.util.fmt(t, { name: G.state.hero.name });

// ───────────────────────── Календарь ─────────────────────────
G.calendar = {
  BDAY: { 9: 'kiba', 16: 'shino', 22: 'shikamaru', 23: 'sasuke', 27: 'hinata', 30: 'sakura', 34: 'iruka', 37: 'choji', 44: 'ino', 48: 'lee', 12: 'naruto' },
  EVENTS: {
    2: 'Первый урок', 3: 'Киба ищет соперника', 4: 'Наруто зовёт на крыши', 8: 'Урок: Каварими', 10: 'Наруто что-то задумал', 15: 'Урок: Хенге',
    17: 'Урок гендзюцу', 18: 'Кто-то в зелёном...', 21: 'Фестиваль (вечер)', 26: 'ТУРНИР АКАДЕМИИ', 29: 'Урок: хождение по дереву',
    38: 'Полевой выход', 43: 'Урок: Буншин', 47: 'Колокольчики', 54: 'ВЫПУСКНОЙ ЭКЗАМЕН',
  },
  birthday(day = G.state.vars.day) { return this.BDAY[day] || null; },
  upcoming(n = 8) {
    const d0 = G.state.vars.day, out = [];
    for (let d = d0; d <= 56 && out.length < n; d++) {
      if (this.EVENTS[d]) out.push({ d, text: this.EVENTS[d] });
      if (this.BDAY[d]) out.push({ d, text: 'ДР: ' + G.chars.nameOf(this.BDAY[d]) + ' ♥×2' });
      if (G.academy.isSchoolDay(d) && !this.EVENTS[d] && d === d0) out.push({ d, text: 'Уроки 8:00–13:00' });
    }
    return out.slice(0, n);
  },
};

// ───────────────────────── Академия ─────────────────────────
G.academy = {
  SUBJ: { hist: 'История', throw: 'Метание', nin: 'Ниндзюцу', tai: 'Тайдзюцу', prac: 'Практика' },
  isSchoolDay(d = G.state.vars.day) { return d >= 2 && d < 54 && (d - 1) % 7 < 5 && d !== 26 && d !== 38; },
  inClass() { const w = _world(); return w && w.map && w.map.name === 'Академия: класс'; },
  lessonNow() { const v = G.state.vars; return this.isSchoolDay() && v.min >= 7 * _H + 30 && v.min < 9 * _H + 30 && !G.state.daily.lesson; },
  grade(s) { const v = G.state.vars, n = v['gn_' + s] || 0; return n ? Math.round(v['gs_' + s] / n) : 0; },
  avg() { const ks = Object.keys(this.SUBJ).filter((k) => G.state.vars['gn_' + k]); return ks.length ? Math.round(ks.reduce((a, k) => a + this.grade(k), 0) / ks.length) : 0; },
  mark(p) { return p >= 85 ? 'отлично' : p >= 65 ? 'хорошо' : p >= 45 ? 'удовл.' : 'плохо'; },
  addGrade(s, p) { const v = G.state.vars; v['gs_' + s] = (v['gs_' + s] || 0) + p; v['gn_' + s] = (v['gn_' + s] || 0) + 1; },
  attendance() { const v = G.state.vars, a = v.att || 0, m = v.miss || 0; return a + m ? Math.round(a / (a + m) * 100) : 100; },
  // план урока по дню
  plan(d) {
    const wd = (d - 1) % 7, week = Math.floor((d - 1) / 7) + 1;
    const special = {
      2: { s: 'prac', intro: 'les_first', battle: 'dummy' },
      8: { s: 'nin', intro: 'les_kawarimi', battle: 'dummy2', learn: 'kawarimi' },
      15: { s: 'nin', intro: 'les_henge', mg: 'seals', learn: 'henge' },
      17: { s: 'nin', intro: 'les_genjutsu', mg: 'meditate', learn: 'fear' },
      29: { s: 'prac', intro: 'les_tree', mg: 'tree', learnFlag: 'tech_tree' },
      43: { s: 'nin', intro: 'les_bunshin', mg: 'seals', learn: 'bunshin' },
    }[d];
    if (special) return special;
    const mates = ['kiba', 'choji', 'ino', 'shikamaru', 'hinata', 'naruto', 'sasuke'];
    return [
      { s: 'hist', intro: 'les_hist', mg: 'quiz' },
      { s: 'throw', intro: 'les_throw', mg: 'throw' },
      { s: 'nin', intro: 'les_nin', mg: 'seals' },
      { s: 'tai', intro: 'les_tai', battle: week === 1 ? 'dummy2' : mates[(week - 2) % mates.length] },
      { s: 'prac', intro: 'les_prac', mg: week >= 5 && G.state.flags.tech_tree ? 'tree' : week % 2 ? 'meditate' : 'log' },
    ][wd];
  },
  start(world) {
    const v = G.state.vars, d = v.day, p = this.plan(d);
    G.state.daily.lesson = 1; G.state.daily.lessonRun = 1;   // lessonRun снимается, когда оценка записана (см. G.story.recover)
    const late = v.min > 8 * _H + 10;
    let qz = null;
    const go = () => {
      const done = (score) => {
        delete G.state.daily.lessonRun;
        let pts = Math.round(score * 100); if (qz != null) pts = Math.round(pts * 0.6 + qz * 100 * 0.4); if (late) pts = Math.max(0, pts - 10);
        this.addGrade(p.s, pts); v.att = (v.att || 0) + 1;
        const xpMap = { hist: { know: 6 }, throw: { tai: 4, spd: 3 }, nin: { nin: 5, ctrl: 2 }, tai: { tai: 6, end: 2 }, prac: { chakra: 4, ctrl: 3 } }[p.s];
        for (const [k, n] of Object.entries(xpMap)) G.train.addXp(k, n * (0.5 + score));
        if (p.learn && !G.state.flags['tech_' + p.learn]) { G.state.flags['tech_' + p.learn] = 1; G.game.note('Изучена техника: ' + G.TECHS[p.learn].name); }
        if (p.learnFlag) G.state.flags[p.learnFlag] = 1;
        if (pts >= 80) G.friends.add('iruka', 1);
        G.game.advanceTo('13:00'); v.energy = Math.max(0, v.energy - 10); v.food = Math.max(0, v.food - 10);
        G.game.note(`Урок «${this.SUBJ[p.s]}»: ${this.mark(pts)}`);
        const learned = p.learn ? ` Ты выучил технику «${G.TECHS[p.learn].name}»!` : p.learnFlag ? ' Теперь можно тренировать хождение по дереву!' : '';
        _say([{ who: 'iruka', text: `${pts >= 85 ? 'Превосходно' : pts >= 65 ? 'Хорошо' : pts >= 45 ? 'Неплохо, но можешь лучше' : 'Нужно больше стараться'}, {name}! Оценка: ${this.mark(pts)} (${pts}).${learned}` }, { text: 'Уроки окончены. Время — 13:00.' }]
          .map((l) => Object.assign(l, { text: _fmt(l.text) })), () => world.softRefresh && world.softRefresh());
      };
      if (p.battle) {
        G.flow.battle({ enemy: p.battle, mode: 'spar', terrain: 'yard', onEnd: (res) => done(res.win ? Math.max(0.5, Math.min(1, 0.7 + 0.3 * (1 - res.turns / 20))) : 0.35) }, world);
      } else {
        G.scenes.push(G.scenes.make('train', p.mg, { title: 'Урок: ' + this.SUBJ[p.s], n: 4 }, done));
      }
    };
    if (late) G.friends.add('iruka', -0.5);
    const lecture = () => G.lessons.run(p, d, world, (ratio, test) => { qz = ratio; go(); });
    _dlg(G.script.library[p.intro] ? p.intro : 'les_generic', lecture);
  },
  // проверка прогула (раз в день в 9:30)
  checkSkip() {
    const v = G.state.vars, d = G.state.daily;
    if (this.isSchoolDay() && v.min >= 9 * _H + 30 && v.min < 13 * _H && !d.lesson && !d.missed) {
      d.missed = 1; v.miss = (v.miss || 0) + 1; G.friends.add('iruka', -1);
      const w = _world(); w && w.showToast && w.showToast('Ты прогулял урок! Ирука недоволен.');
      G.game.note('Прогул урока');
      const p = this.plan(v.day);
      if (p.learn || p.learnFlag) {   // технику объяснят после уроков: очередь, чтобы пропуски не затирали друг друга
        const q = G.state.makeupQ || (G.state.makeupQ = []);
        if (!q.includes(v.day)) q.push(v.day);
        if (w && w.showToast) setTimeout(() => w.showToast('Техника: зайди в класс после 13:00'), 2400);
      }
    }
  },
};

// ───────────────────────── Сюжетные события ─────────────────────────
// where: 'out' — на улице, 'any', 'class' — в классе; from/to — время; script — диалог, run — функция
G.STORY = [
  { id: 'kiba', day: 3, from: 13 * _H, to: 21 * _H, where: 'out', script: 'st_kiba' },
  { id: 'roofs', day: 4, from: 14 * _H, to: 20 * _H, where: 'out', script: 'st_roofs', must: true },
  { id: 'prank', day: 10, from: 17 * _H, to: 22 * _H, where: 'out', script: 'st_prank' },
  { id: 'lee', day: 18, from: 15 * _H, to: 21 * _H, where: 'out', script: 'st_lee' },
  { id: 'festival', day: 21, from: 18 * _H, to: 23 * _H, where: 'out', script: 'st_festival' },
  { id: 'tourney', day: 26, from: 7 * _H, to: 20 * _H, where: 'any', script: 'st_tourney', must: true, place: 'academy' },
  { id: 'mizuki1', day: 31, from: 20 * _H, to: 23 * _H, where: 'out', script: 'st_mizuki1' },
  { id: 'mizuki2', day: 33, from: 13 * _H, to: 19 * _H, where: 'out', script: 'st_mizuki2' },
  { id: 'field', day: 38, from: 7 * _H, to: 20 * _H, where: 'any', script: 'st_field', place: 'academy' },
  { id: 'bells', day: 47, from: 13 * _H, to: 21 * _H, where: 'any', script: 'st_bells', place: 'academy' },
  { id: 'exam', day: 54, from: 7 * _H, to: 20 * _H, where: 'any', script: 'st_exam', must: true, place: 'academy' },
  { id: 'night', day: 54, from: 20 * _H, to: 30 * _H, where: 'any', script: 'st_night', after: 'exam', must: true, place: 'forest' },
];
G.story = {
  // Событие помечается «было» (st_<id>) в момент начала. Если вкладку Safari выгрузили посреди боя или экзамена,
  // в сохранении остаётся флаг без результата, и без этой починки игру нельзя пройти. Вызывается из G.game.fix().
  recover(st) {
    const f = st.flags || {}, v = st.vars || {}, d = st.daily || {};
    const fixes = [];
    const undo = (flag, why) => { if (f[flag]) { delete f[flag]; fixes.push(why); } };
    if (f.st_night && !f.mizuki_beaten) undo('st_night', 'ночь Мизуки');
    if (f.st_exam && v.exam == null) undo('st_exam', 'экзамен');
    if (f.st_tourney && v.tourney == null) undo('st_tourney', 'турнир');
    if (f.st_field && !f.field_done && v.day <= 38) undo('st_field', 'полевой выход');
    if (f.st_bells && !f.bells_done && v.day <= 47) undo('st_bells', 'колокольчики');
    // экзамен оценён, но диалог с результатом не дошёл до «выпускник»
    if (v.exam != null && v.exam_pass && !f.graduated) { f.graduated = 1; if (v.exam >= 80) f.best = 1; fixes.push('результат экзамена'); }
    if (d.lessonRun) { delete d.lesson; delete d.lessonRun; fixes.push('урок'); }
    if (fixes.length) console.info('Восстановлено после прерывания:', fixes.join(', '));
    return fixes;
  },
  // вызывается из мира каждый кадр, когда он свободен
  poll(world) {
    const st = G.state, v = st.vars, f = st.flags;
    if (!st.started || !f.day2_intro || G.scenes.top() !== world || G.scenes.busy) return false;
    while (st.frQueue && st.frQueue.length && !G.script.library[st.frQueue[0]]) st.frQueue.shift();
    if (st.frQueue && st.frQueue.length) { _dlg(st.frQueue.shift()); return true; }
    const m = world.map;
    // урок
    if (G.academy.lessonNow() && G.academy.inClass()) { G.academy.start(world); return true; }
    if (v.makeup) { (st.makeupQ = st.makeupQ || []).push(v.makeup); v.makeup = 0; }   // старые сохранения
    if (st.makeupQ && st.makeupQ.length && v.min >= 13 * _H && v.min < 18 * _H && m && m.outdoor === false && G.academy.inClass()) {
      const d = st.makeupQ.shift(), p = G.academy.plan(d);
      if (p.learn && !f['tech_' + p.learn]) { f['tech_' + p.learn] = 1; G.game.note('Изучена техника: ' + G.TECHS[p.learn].name); _say([{ who: 'iruka', text: _fmt(`{name}, ты пропустил урок. Ладно, объясню после уроков: техника «${G.TECHS[p.learn].name}».`) }, { text: 'Ты выучил технику, но Ирука вздыхает.' }]); return true; }
      if (p.learnFlag && !f[p.learnFlag]) { f[p.learnFlag] = 1; _say([{ who: 'iruka', text: _fmt('{name}, ты пропустил урок. Ладно, объясню после уроков хождение по дереву.') }, { text: 'Теперь можно тренировать хождение по дереву, но Ирука вздыхает.' }]); return true; }
    }
    // события находят героя сами
    for (const e of G.STORY) {
      if (f['st_' + e.id] || v.day < e.day || (v.day > e.day && !e.must)) continue;
      if (e.after && !f['st_' + e.after]) continue;
      const late = v.day > e.day;   // обязательное событие пропущено (проспал) — случится при первой возможности
      if (!late && (v.min < e.from || v.min >= e.to)) continue;
      if (late && v.min < (e.from >= 20 * _H ? e.from : 7 * _H)) continue;
      if (e.where === 'out' && !(m && m.outdoor)) continue;
      f['st_' + e.id] = 1;
      if (e.place) {   // перенос на место события
        const K = G.world.konoha(), T = G.CONFIG.TILE;
        if (e.place === 'forest') { if (m.id !== 'konoha' || Math.hypot(world.player.x - 10 * T, world.player.y - 116 * T) > 200) world.setMap({ map: 'konoha', x: 10 * T + 8, y: 117 * T + 8, dir: 'up' }); }
        else { const b = K.landmarks[e.place]; if (b && b.interior && m.id !== b.interior.id) world.setMap({ map: b.interior.id, entry: true }); }
      }
      if (G.cine && G.cine.defs[e.script]) G.cine.play(e.script, world, () => world.refreshNpcs && world.refreshNpcs()); else _dlg(e.script);
      return true;
    }
    // пропущенный обязательный сюжет (если проспал): турнир/экзамен — переносится на следующее утро
    return false;
  },
  // ── турнир академии: 3 боя на вылет ──
  tournament() {
    const v = G.state.vars;
    const rounds = [['choji', 'Первый круг: Чоджи Акимичи!'], ['kiba', 'Полуфинал: Киба Инузука!'], ['sasuke', 'ФИНАЛ: Саске Учиха!']];
    let r = 0;
    const next = () => {
      if (r >= rounds.length) { v.tourney = 4; return end(); }
      const [en, title] = rounds[r];
      _say([{ who: 'iruka', text: title }], () => {
        G.flow.battle({ enemy: en, mode: 'ringout', terrain: 'ring', story: r === 2, storyLine: 'Я не проиграю! Не здесь!', onEnd: (res) => {
          G.state.vars.hp = 100;
          if (res.win) { r++; G.friends.add(en, 1); next(); } else { v.tourney = r + 1; end(); }
        } }, _world());
      });
    };
    const end = () => {
      const place = v.tourney;
      const prize = { 4: [300, 'Чемпион Академии', 5], 3: [150, 'Финалист', 3], 2: [80, 'Полуфиналист', 0], 1: [30, 'Участник турнира', 0] }[place];
      G.game.earn(prize[0]); v.pouch_plus = (v.pouch_plus || 0) + prize[2]; v.title_t = place;
      if (place === 4) { v.rival = (v.rival || 0) + 2; v.rep = (v.rep || 0) + 5; }
      G.game.advanceTo('16:00');
      _dlg(place === 4 ? 'st_tourney_win' : 'st_tourney_lose', () => {
        _say([`Приз: ${prize[0]} рё${prize[2] ? ', подсумок +' + prize[2] + ' мест' : ''}. Титул: «${prize[1]}».`]);
      });
      G.game.note(`Турнир Академии: ${prize[1]}`);
    };
    next();
  },
  // ── выпускной экзамен ──
  exam() {
    const v = G.state.vars, res = {};
    const step3 = () => {
      // Буншин
      if (!G.combat.knows('bunshin')) { res.bun = 0; return fin(); }
      G.scenes.push(G.scenes.make('train', 'seals', { title: 'Экзамен: Буншин' }, (s) => { res.bun = Math.min(1, s * 0.7 + G.combat.mastery('bunshin') * 0.12 + G.hero.stat('nin') * 0.02); fin(); }));
    };
    const step2 = () => _say([{ who: 'iruka', text: 'Вторая часть: метание. Восемь бросков!' }], () => G.scenes.push(G.scenes.make('train', 'throw', { title: 'Экзамен: метание' }, (s) => { res.thr = Math.min(1, s * 0.85 + G.hero.stat('tai') * 0.015); _say([{ who: 'iruka', text: 'И последнее: создай трёх клонов. Техника Буншин!' }], step3); })));
    const fin = () => {
      const g = G.academy.avg() / 100, att = G.academy.attendance() / 100, ir = G.friends.level('iruka') / 5;
      const total = Math.round(res.wr * 22 + res.thr * 18 + res.bun * 25 + g * 20 + att * 10 + ir * 5);
      v.exam = total; v.exam_pass = total >= 55 && res.bun > 0.3 ? 1 : 0;
      G.game.advanceTo('15:00');
      G.game.note(`Экзамен: ${total} баллов — ${v.exam_pass ? 'сдан' : 'не сдан'}`);
      _say([
        { text: `Письменный тест: ${Math.round(res.wr * 100)}%. Метание: ${Math.round(res.thr * 100)}%. Буншин: ${Math.round(res.bun * 100)}%.` },
        { text: `Оценки за 8 недель: ${G.academy.avg()}. Посещаемость: ${G.academy.attendance()}%. Итог: ${total} из 100.` },
      ], () => _dlg(v.exam_pass ? (total >= 80 ? 'st_exam_best' : 'st_exam_pass') : 'st_exam_fail'));
    };
    G.scenes.push(G.scenes.make('train', 'quiz', { title: 'Экзамен: письменный тест', n: 5 }, (s) => { res.wr = Math.min(1, s * 0.8 + G.hero.stat('know') * 0.02); step2(); }));
  },
  // ── финальный бой и концовка ──
  finale() {
    const go = () => G.flow.battle({ enemy: 'mizuki', mode: 'ko', terrain: 'night', story: true, allies: ['iruka', 'naruto'], storyLine: 'Я защищу их! Это и есть Воля Огня!', will: 30 + (G.state.flags.told_iruka ? 10 : 0), onEnd: (res) => {
      G.state.vars.hp = Math.max(G.state.vars.hp, 40);
      if (res.win) { G.state.flags.mizuki_beaten = 1; _dlg('st_mizuki_win', () => G.scenes.fadeTo(G.scenes.make('ending'))); }
      else _dlg('st_mizuki_lose', go);   // повтор с чекпоинта
    } }, _world());
    go();
  },
};

// ───────────────────────── Случайные события и доска поручений ─────────────────────────
G.JOBS = {
  tora:     { name: 'Поймать кошку Тору',     pay: 150, mg: 'cat',  min: 90,  energy: 15, xp: { spd: 4 }, text: 'Кошка жены даймё снова сбежала!' },
  weed:     { name: 'Прополка огорода',       pay: 70,  mg: 'sort', min: 90,  energy: 14, xp: { end: 4 }, cats: ['Сорняк', 'Овощ'], text: 'Бабушка Тоё просит помочь в огороде.' },
  market:   { name: 'Разгрузка на рынке',     pay: 90,  mg: 'sort', min: 120, energy: 18, xp: { end: 3, tai: 2 }, cats: ['Рыба', 'Овощи'], text: 'Нужны крепкие руки!' },
  hospital: { name: 'Помощь в больнице',      pay: 80,  mg: 'sort', min: 90,  energy: 10, xp: { know: 4 }, cats: ['Травы', 'Бинты'], text: 'Рассортировать лекарства.' },
  delivery: { name: 'Доставка цветов Яманака', pay: 80, mg: 'run',  min: 60,  energy: 14, xp: { spd: 4 }, text: 'Букеты по всей деревне — бегом!' },
  river:    { name: 'Уборка реки',            pay: 60,  mg: 'sort', min: 90,  energy: 14, xp: { end: 4 }, cats: ['Мусор', 'Рыба'], text: 'Достать мусор, отпустить рыбу.' },
  scrolls:  { name: 'Разбор свитков в архиве', pay: 70, mg: 'quiz', min: 90,  energy: 6,  xp: { know: 5 }, text: 'Архив Резиденции просит помощи.' },
};
G.events = G.events || {};
G.life_events = {
  todayJobs() {
    const r = G.util.rng(G.state.vars.day * 31 + 7), ids = Object.keys(G.JOBS), out = [];
    while (out.length < 3) { const id = ids[Math.floor(r() * ids.length)]; if (!out.includes(id)) out.push(id); }
    return out;
  },
  board(world) {
    const v = G.state.vars, d = G.state.daily;
    if (v.min < 8 * _H || v.min >= 18 * _H) return world.talk([{ text: 'Доска поручений. Работа выдаётся с 8:00 до 18:00.' }]);
    const ids = this.todayJobs();
    const opts = ids.map((id) => { const j = G.JOBS[id]; return { label: j.name, sub: j.pay + ' рё', desc: `${j.text} ${j.min} мин, энергия −${j.energy}.`, off: d['job_' + id] ? 'Уже выполнено сегодня' : v.energy < j.energy ? 'Ты слишком устал' : null, id }; });
    G.scenes.push(G.scenes.make('pick', { title: 'Доска поручений', text: 'Неофициальные задания для учеников Академии.', options: opts }, (i) => {
      if (i < 0) return;
      const id = opts[i].id, j = G.JOBS[id];
      G.scenes.push(G.scenes.make('train', j.mg, { title: j.name, sortCats: j.cats }, (s) => {
        const pay = Math.round(j.pay * (0.4 + 0.6 * s));
        d['job_' + id] = 1; G.game.earn(pay); G.game.advance(j.min); v.energy = Math.max(0, v.energy - j.energy); v.food = Math.max(0, v.food - 6);
        v.rep = (v.rep || 0) + 1; v.jobs = (v.jobs || 0) + 1;
        for (const [k, n] of Object.entries(j.xp)) G.train.addXp(k, n * (0.5 + s));
        G.game.note(`Поручение «${j.name}»: +${pay} рё`);
        world.talk([{ text: `Готово! Ты заработал ${pay} рё. Репутация в деревне растёт.` }]);
      }));
    }));
  },
  // раз в игровой час на улице
  roll(world) {
    const v = G.state.vars, m = world.map;
    if (!m || !m.outdoor || v.day < 3 || v.day >= 54 || G.state.daily.ev >= 2) return;
    const night = v.min >= 21 * _H && v.min < 23 * _H + 30, day = v.min >= 9 * _H && v.min < 20 * _H;
    if (!(night || day) || Math.random() > (night ? 0.18 : 0.07)) return;
    G.state.daily.ev = (G.state.daily.ev || 0) + 1;
    const pool = night ? ['ev_thief'] : ['ev_bully', 'ev_child', 'ev_dog', 'ev_tile', 'ev_granny'];
    world.pendingTalk = pool[Math.floor(Math.random() * pool.length)];
  },
};

// ───────────────────────── Действия для скриптов ─────────────────────────
Object.assign(G.script.actions, {
  learn: (a) => { G.state.flags['tech_' + a[0]] = 1; G.game.note('Изучена техника: ' + (G.TECHS[a[0]] ? G.TECHS[a[0]].name : a[0])); },
  combo: (a) => { G.state.flags['combo_' + a[0]] = 1; G.game.note('Новое комбо: ' + G.COMBOS[a[0]].name); },
  friend: (a) => G.friends.add(a[0], Number(a[1]) || 1),
  rep: (a) => { G.state.vars.rep = (G.state.vars.rep || 0) + (Number(a[0]) || 1); },
  earn: (a) => G.game.earn(Number(a[0]) || 0),
  xp: (a) => G.train.addXp(a[0], Number(a[1]) || 5),
  hurt: (a) => { G.state.vars.hp = Math.max(5, (G.state.vars.hp || 100) - (Number(a[0]) || 10)); },
  board: () => { G.game.pending = { type: 'board' }; },
  tourney: () => { G.game.pending = { type: 'tourney' }; },
  exam: () => { G.game.pending = { type: 'exam' }; },
  finale: () => { G.game.pending = { type: 'finale' }; },
  calendar: () => { G.game.pending = { type: 'calendar' }; },
  cook: () => { G.game.pending = { type: 'cook' }; },
  flower: () => { G.game.pending = { type: 'flower' }; },
  scroll: (a) => { G.game.pending = { type: 'scroll', i: Number(a[0]) }; },
  homemenu: () => { G.game.pending = { type: 'homemenu' }; },
});
Object.assign(G.flow, {
  board: (a, w) => G.life_events.board(w),
  tourney: () => G.story.tournament(),
  exam: () => G.story.exam(),
  finale: () => G.story.finale(),
  calendar: (a, w) => {
    const ev = G.calendar.upcoming(9);
    const opts = ev.map((e) => ({ label: `День ${e.d} (${G.game.dayName(e.d)})`, sub: '', desc: e.text }));
    opts.forEach((o, i) => { o.label = `${ev[i].d === G.state.vars.day ? 'Сегодня' : 'Д' + ev[i].d}: ${ev[i].text}`; o.desc = `День ${ev[i].d}, ${G.game.dayNameFull(ev[i].d)}. ${ev[i].text}${ev[i].text.startsWith('ДР') ? ' — подарок ценится вдвое.' : ''}`; });
    G.scenes.push(G.scenes.make('pick', { title: `Календарь · неделя ${G.game.week()} из 8`, text: `До экзамена: ${Math.max(0, 54 - G.state.vars.day)} дн.`, options: opts.length ? opts : [{ label: 'Ничего особенного' }] }, () => {}));
  },
  cook: (a, w) => {
    const c = (id) => G.game.count(id), d = G.state.daily;
    const recipes = [
      { label: 'Рис (из запасов)', need: {}, food: 25, mood: 0, off: G.state.vars.cd_rice && G.state.vars.cd_rice > G.life.absMin() ? 'Запасы риса закончились до вечера' : null, cd: true },
      { label: 'Бэнто: рис, рыба, овощи', need: { rice: 1, fish: 1, vegetables: 1 }, food: 55, mood: 6, bento: true, desc: 'Сытно. Тренировки сегодня +10%.' },
      { label: 'Омлет с рисом', need: { eggs: 1, rice: 1 }, food: 35, energy: 6, mood: 3 },
      { label: 'Мисо-суп с рыбой', need: { fish: 1, vegetables: 1 }, food: 30, energy: 4, mood: 4 },
      { label: 'Унаги-дон', need: { eel: 1, rice: 1 }, food: 60, energy: 10, mood: 10, desc: 'Угорь на рисе. Сытно и бодрит!' },
      { label: 'Жареная рыба', need: { fish: 1 }, food: 22, mood: 2 },
      { label: 'Молоко', need: { milk: 1 }, food: 8, mood: 2 },
    ];
    const opts = recipes.map((r) => {
      const miss = Object.entries(r.need).filter(([k, n]) => c(k) < n).map(([k]) => G.ITEMS[k].name);
      return { label: r.label, sub: Object.keys(r.need).length ? '' : 'бесплатно', desc: r.desc || ('Сытость +' + r.food), off: r.off || (miss.length ? 'Нужно: ' + miss.join(', ') + ' (рынок)' : null) };
    });
    G.scenes.push(G.scenes.make('pick', { title: 'Кухня', options: opts }, (i) => {
      if (i < 0) return;
      const r = recipes[i];
      for (const [k, n] of Object.entries(r.need)) G.game.give(k, -n);
      G.game.eat(r.food); G.game.mood(r.mood || 0); if (r.energy) G.game.rest(r.energy); if (r.bento) d.bento = 1;
      if (r.cd) G.state.vars.cd_rice = G.life.absMin() + 240;
      G.game.advance(20);
      w.talk([{ text: `${r.label}: готово и съедено! Сытость +${r.food}.` }]);
    }));
  },
  flower: (a, w) => {
    const v = G.state.vars, last = v.flower_last || 1, dry = v.day - last;
    if (v.flower_day === v.day) return w.talk([{ text: 'Цветок уже полит сегодня. Листья блестят.' }]);
    v.flower_day = v.day; v.flower_last = v.day; v.flower_n = (v.flower_n || 0) + 1; G.game.mood(dry >= 3 ? 1 : 3);
    w.talk([{ text: dry >= 3 ? 'Цветок совсем поник... Ты поливаешь его, и он медленно оживает.' : `Ты поливаешь цветок. ${v.flower_n >= 20 ? 'Он расцвёл яркими лепестками!' : v.flower_n >= 8 ? 'Появился бутон!' : 'Он тянется к солнцу.'}` }]);
  },
  scroll: (a, w) => {
    const v = G.state.vars, f = G.state.flags, k = 'scroll_' + a.i;
    if (f[k]) return w.talk([{ text: 'Здесь больше ничего нет.' }]);
    f[k] = 1; v.scrolls = (v.scrolls || 0) + 1;
    G.audio.sfx.confirm();
    const lines = [{ text: `Ты нашёл секретный свиток! (${v.scrolls}/20)` }];
    if (v.scrolls === 10) { lines.push({ text: 'Свитки складываются в подсказку: «Шаг, быстрый как мысль, начинается с одной печати...»' }); }
    if (v.scrolls >= 20 && !f.tech_shunshin) { f.tech_shunshin = 1; lines.push({ text: 'Все 20 свитков собраны! Ты постиг секретную технику: ШУНШИН — мгновенный шаг!' }); G.game.note('Изучена секретная техника: Шуншин'); }
    w.talk(lines);
  },
  homemenu: (a, w) => {
    const opts = [
      { label: 'Медитация', sub: '60 мин', act: 'meditate' },
      { label: 'Печати на скорость', sub: '60 мин', act: 'seals' },
      { label: 'Читать «Историю Конохи»', sub: '90 мин', act: 'book', off: G.game.count('book_history') ? null : 'Книги нет (книжная лавка)' },
      { label: 'Травничество', sub: 'мазь, чай, пилюли', act: 'craft' },
      { label: 'Календарь событий', act: 'cal' },
      { label: 'Ничего', act: 'no' },
    ];
    G.scenes.push(G.scenes.make('pick', { title: 'Стол для учёбы', options: opts }, (i) => {
      const x = i >= 0 ? opts[i].act : 'no';
      if (x === 'cal') G.flow.calendar(a, w); else if (x === 'craft') G.outdoor.craftMenu(w); else if (x !== 'no') G.train.start(x, w);
    }));
  },
});

// часы мира: уроки, прогулы, случайные события
G.events.on('time', () => {
  const w = _world(); if (!w || !G.state.started) return;
  G.academy.checkSkip();
  const v = G.state.vars;
  if (v.min % 60 === 0 && w.map && w.map.outdoor && G.scenes.top() === w) G.life_events.roll(w);
});
