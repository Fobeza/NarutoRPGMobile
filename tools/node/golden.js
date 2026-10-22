// «Золотые» отпечатки отрисовки и логики — для безопасного рефакторинга.
//
//   node tools/node/golden.js > /tmp/before.txt      # до правки
//   ...рефакторим...  && python3 build.py
//   node tools/node/golden.js > /tmp/after.txt       # после
//   diff /tmp/before.txt /tmp/after.txt              # пусто = поведение не изменилось
//
// Отпечаток = хэш последовательности вызовов рисования (update+draw) при детерминированном Math.random.
// Ловит случайные изменения в отрисовке и логике, которые не видны ни в тестах, ни в симуляторе баланса.
'use strict';
const h = require('./harness.js');
const { G } = h;

function fnv(str) {
  let x = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
  return x.toString(16).padStart(8, '0');
}
const line = (name, log, extra) => console.log(`${fnv(log.join('|')).padEnd(9)} ${String(log.length).padStart(7)} вызовов  ${name}${extra ? '  ' + extra : ''}`);

// ─────────── бои: полный цикл update+draw до конца ───────────
function traceBattle(sc, build, seed) {
  h.rng(seed);
  const ctx = h.recordingCtx(G.screen.W, G.screen.H);
  const B = G.sim.BUILDS[build];
  const g = G.sim.growth(build, 54);
  const key = Object.keys(g).map(Number).filter((k) => k <= sc.day).pop();
  const cfg = Object.assign({}, sc, {
    stats: g[key], skills: B.skills.slice(), build, skill: 0.65,
    techs: G.sim.techsAt(sc.day), combos: G.sim.combosAt(sc.day), inv: G.sim.invAt(sc.day),
    uses: Math.max(0, Math.round((sc.day - 8) * 0.5)),
  });
  const st = G.state, snap = JSON.stringify(st);
  const snd = G.audio.enabled; G.audio.enabled = false;
  let res = null, turns = 0, it = 0;
  try {
    st.hero.stats = Object.assign({}, cfg.stats); st.hero.skills = cfg.skills.slice();
    for (const k of Object.keys(st.flags)) if (/^(tech_|combo_)/.test(k)) delete st.flags[k];
    for (const t of cfg.techs) { st.flags['tech_' + t] = 1; st.vars['use_' + t] = cfg.uses; }
    for (const c of cfg.combos) st.flags['combo_' + c] = 1;
    st.flags.tactic = 0;
    st.inv = Object.assign({}, cfg.inv); st.vars.day = cfg.day; st.vars.hp = 100; st.vars.chakra = 100;
    const S = G.scenes.make('battle', { enemy: cfg.enemy, mode: cfg.mode, terrain: cfg.terrain, turns: cfg.turns, story: cfg.story, allies: cfg.allies, will: cfg.will }, (r) => { res = r; });
    G.scenes.stack.length = 0; G.scenes.push(S);
    while (it++ < 20000) {
      const s = S.state;
      if (s === 'end') { res = res || S.sim.result(); break; }
      if (s === 'menu') { turns++; if (!G.sim.decide(S, cfg)) S.sim.press('misc', 'Защита'); }
      else if (s === 'rhythm') S.sim.rhythm('ok');
      else if (s === 'seals') S.sim.seals('ok');
      else if (s === 'react') G.sim.react(S, 0.65);
      else if (s === 'target') S.sim.target(0.34);
      else if (s === 'moment') S.sim.moment();
      S.update(0.1);
      S.draw(ctx);
    }
    G.scenes.stack.length = 0;
  } finally {
    const back = JSON.parse(snap);
    for (const k of Object.keys(G.state)) delete G.state[k];
    Object.assign(G.state, back);
    G.audio.enabled = snd; h.rngOff();
  }
  return { ctx, res, turns };
}

console.log('# золотые отпечатки (хэш, число вызовов рисования, что)');
console.log('## бои');
for (const sc of G.sim.SCEN) {
  for (const build of ['tai', 'nin', 'gen', 'bal']) {
    const t = traceBattle(sc, build, 1234 + sc.day);
    line(`battle ${sc.id}/${build}`, t.ctx.log, `ходов ${t.turns} победа ${t.res ? !!t.res.win : 'таймаут'}`);
  }
}

console.log('## мир и экраны');
function traceScene(name, make, n = 6, seed = 7) {
  h.rng(seed);
  G.scenes.stack.length = 0;
  const ctx = h.recordingCtx(G.screen.W, G.screen.H);
  try {
    const s = make();
    G.scenes.push(s);
    for (let i = 0; i < n; i++) { s.update && s.update(1 / 60); s.draw && s.draw(ctx); }
    s.exit && s.exit();
  } catch (e) { console.log('  ОШИБКА ' + name + ': ' + e.message); }
  G.scenes.stack.length = 0; h.rngOff();
  line(name, ctx.log);
}
h.seed();
traceScene('title', () => G.scenes.make('title'), 3);
for (const [n, min, day] of [['world утро', 8 * 60, 5], ['world вечер', 19 * 60, 5], ['world ночь', 22 * 60, 5], ['world полдень', 12 * 60, 6]]) {
  traceScene(n, () => { G.state.vars.min = min; G.state.vars.day = day; return G.scenes.make('world', null); }, 5);
}
for (const id of ['in:1', 'in:2', 'in:4', 'in:8', 'in:24', 'in:25', 'in:33']) traceScene('комната ' + id, () => G.scenes.make('world', { map: id, entry: true }), 4);
traceScene('menu', () => G.scenes.make('menu'));
traceScene('mapview', () => G.scenes.make('mapview', G.scenes.make('world', null)));
traceScene('status', () => G.scenes.make('status'));
traceScene('bag', () => G.scenes.make('bag'));
traceScene('calendar', () => G.scenes.make('calendar'));
traceScene('journal', () => G.scenes.make('journal'));
traceScene('gallery', () => G.scenes.make('gallery'));
traceScene('shop ichiraku', () => G.scenes.make('shop', 'ichiraku'));
traceScene('shop weapons', () => G.scenes.make('shop', 'weapons'));
traceScene('charcreate', () => G.scenes.make('charcreate', () => {}));
traceScene('daysum', () => G.scenes.make('daysum', { day: 5, dayName: 'Пятница', spent: 120, log: ['Урок', 'Тренировка'], money: 400, bed: 22 * 60, wakeFatigue: 10, wake: 5 * 60, mood: 70, weather: 'sun' }, () => {}));
for (const kind of ['throw', 'log', 'seals', 'run', 'meditate', 'tree', 'cook', 'shogi', 'quiz', 'cat', 'sort']) traceScene('train ' + kind, () => G.scenes.make('train', kind, {}, () => {}), 5);
