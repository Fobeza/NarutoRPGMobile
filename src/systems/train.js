// Тренировки, опыт и рост характеристик (план §5.5, §7). Без уровней: XP копится в каждой характеристике.
G.TRAININGS = {
  cook:     { name: 'Готовка в Ичираку',   mg: 'cook',     stats: { ctrl: 3, know: 2, end: 1 }, fatigue: 10, minutes: 60, place: 'Ичираку', pay: 70 },
  shogi:    { name: 'Шоги с Шикамару',     mg: 'shogi',    stats: { know: 5, ctrl: 2 },  fatigue: 4,  minutes: 40, place: 'Академия, крыши' },
  throw:    { name: 'Метание по мишеням',   mg: 'throw',    stats: { tai: 5, spd: 4 },     fatigue: 12, minutes: 60, place: 'Полигон' },
  dummy:    { name: 'Удары по манекену',    mg: 'log',      stats: { tai: 8, end: 3 },     fatigue: 14, minutes: 60, place: 'Полигон, додзё' },
  log:      { name: 'Ритм-удары по бревну', mg: 'log',      stats: { tai: 5, end: 6 },     fatigue: 14, minutes: 60, place: 'Полигон №3' },
  meditate: { name: 'Медитация',            mg: 'meditate', stats: { chakra: 9, gen: 2 },  fatigue: 4,  minutes: 60, place: 'Дом, водопад' },
  falls:    { name: 'Медитация у водопада', mg: 'meditate', stats: { chakra: 12, ctrl: 3 }, fatigue: 6, minutes: 60, place: 'Водопад' },
  tree:     { name: 'Хождение по дереву',   mg: 'tree',     stats: { ctrl: 10, chakra: 3 }, fatigue: 14, minutes: 60, place: 'Полигон №3', req: 'tech_tree', reqText: 'Сначала нужен урок контроля чакры (неделя 5).' },
  water:    { name: 'Хождение по воде',     mg: 'tree',     stats: { ctrl: 12, chakra: 5 }, fatigue: 16, minutes: 60, place: 'Озеро', req: 'tech_water', reqText: 'Хождению по воде пока никто не учил.' },
  seals:    { name: 'Печати на скорость',   mg: 'seals',    stats: { nin: 8, ctrl: 3 },    fatigue: 8,  minutes: 60, place: 'Любое тихое место' },
  library:  { name: 'Чтение в библиотеке',  mg: 'quiz',     stats: { know: 9, gen: 4 },    fatigue: 5,  minutes: 90, place: 'Библиотека' },
  book:     { name: 'Чтение дома',          mg: 'quiz',     stats: { know: 10, gen: 2 },   fatigue: 4,  minutes: 90, place: 'Дом', item: 'book_history' },
  run:      { name: 'Пробежка по крышам',   mg: 'run',      stats: { spd: 8, end: 5 },     fatigue: 16, minutes: 60, place: 'Улицы' },
  stealth:  { name: 'Скрытность в Лесу Нара', mg: 'run',    stats: { spd: 4, gen: 7 },     fatigue: 12, minutes: 60, place: 'Лес Нара' },
};
G.STAT_CAP = 12;

G.train = {
  needAt(v) { return 30 + (v - 3) * 10; },   // баланс: BALANCE.md §3
  need(stat) { return this.needAt(G.hero.stat(stat)); },
  // Добавить опыт; возвращает список выросших характеристик
  addXp(stat, n, quiet) {
    const v = G.state.vars, s = G.state.hero.stats;
    if (!s || s[stat] == null) return [];
    const ups = [];
    v['xp_' + stat] = (v['xp_' + stat] || 0) + n;
    while (s[stat] < G.STAT_CAP && v['xp_' + stat] >= this.need(stat)) {
      v['xp_' + stat] -= this.need(stat); s[stat]++; ups.push(stat);
      const name = G.STATS.find((x) => x.id === stat).name;
      G.game.note(`${name} выросла до ${s[stat]}!`);
      G.events.emit('statup', stat, s[stat]);
    }
    if (s[stat] >= G.STAT_CAP) v['xp_' + stat] = 0;
    return ups;
  },
  mult(id, partner) {
    const v = G.state.vars, d = G.state.daily || (G.state.daily = {});
    const n = d['tr_' + id] || 0;
    let m = [1, 0.7, 0.45, 0.3][Math.min(3, n)];
    if (G.hero.has('diligent')) m *= 1.25;
    if (partner) m *= 1.5;
    if ((v.fatigue ?? 10) > 80) m *= 0.7;
    if (v.injury) m *= 0.7;
    if (d.bento) m *= 1.1;
    return m;
  },
  // Начать тренировку (из мира)
  start(id, world, opts = {}) {
    const t = G.TRAININGS[id]; const v = G.state.vars;
    if (!t) return;
    const say = (txt) => world.talk([{ text: txt }]);
    if (t.req && !G.state.flags[t.req]) return say(t.reqText);
    if (t.item && !G.game.count(t.item)) return say('Нечего читать. Книги продаются в книжной лавке.');
    if (G.game.vigor() < t.fatigue) return say('Ты слишком устал для тренировки. Отдохни или поешь.');
    const lessonDue = G.academy && G.academy.lessonNow && G.academy.lessonNow();
    // тренировка затянется за 9:30 — урок будет прогулян: спросим
    if (lessonDue && !opts.skipWarn && v.min + t.minutes >= 9 * 60 + 30) {
      const go = () => this.start(id, world, Object.assign({}, opts, { skipWarn: true }));
      G.scenes.push(G.scenes.make('pick', { title: 'Скоро урок!', text: 'Тренировка займёт ' + t.minutes + ' мин. Урок начнётся в 8:00–9:30 в классе Академии — иначе прогул.',
        options: [{ label: 'Всё равно тренироваться', desc: 'Прогул: Ирука недоволен, посещаемость падает.' }, { label: 'Отмена' }] }, (i) => { if (i === 0) go(); }));
      return;
    }
    G.scenes.push(G.scenes.make('train', t.mg, { title: t.name, partner: opts.partner }, (score) => {
      const m = this.mult(id, opts.partner) * (0.35 + 0.65 * score);
      const gained = [];
      for (const [st, base] of Object.entries(t.stats)) { const x = Math.round(base * m * 10) / 10; gained.push([st, x]); this.addXp(st, x); }
      const d = G.state.daily; d['tr_' + id] = (d['tr_' + id] || 0) + 1;
      if (t.mg === 'seals') for (const tid of Object.keys(G.TECHS)) if (G.combat.knows(tid)) v['use_' + tid] = (v['use_' + tid] || 0) + 1;
      G.game.advance(t.minutes, { work: true });
      G.game.tire(t.fatigue * (opts.partner ? 0.8 : 1));
      v.trainings = (v.trainings || 0) + 1;
      G.events.emit('training', id, score, opts.partner || null);
      if (opts.partner) { d['trw_' + opts.partner] = 1; G.friends && G.friends.add(opts.partner, 2, 'train'); }   // попытка дня тратится только на состоявшуюся тренировку
      const rate = Math.round(score * 100);
      const lines = gained.map(([st, x]) => { const S = G.STATS.find((q) => q.id === st); return `${S.name} +${x} опыта (${G.state.vars['xp_' + st] | 0}/${this.need(st)})`; });
      const tip = (d['tr_' + id] >= 3) ? ' Одно и то же надоедает — чередуй тренировки!' : '';
      let payTxt = '';
      if (t.pay && d['tr_' + id] <= 2) { const pay = Math.round(t.pay * score); if (pay > 0) { G.game.earn(pay); payTxt = ` Заработано: ${pay} рё.`; } }
      world.talk([{ text: `${t.name}: результат ${rate}%.${tip}${payTxt}` }, { text: lines.join('. ') + '.' }]);
      world.softRefresh && world.softRefresh();
    }));
  },
};
G.events.on('statup', (stat, val) => {
  const w = G.scenes.stack.find((s) => s.name === 'world');
  const S = G.STATS.find((q) => q.id === stat);
  if (w && w.showToast) w.showToast(`★ ${S.name} ${val}!`);
});

G.script.actions.train = (a) => { G.game.pending = { type: 'train', id: a[0], partner: a[1] || null }; };
G.flow.train = (a, world) => G.train.start(a.id, world, { partner: a.partner });
