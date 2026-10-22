// Генератор баланса без браузера: симулятор G.sim (бои «Дуэли», src/systems/sim.js) исполняется прямо в Node (tools/node/harness.js).
// Пишет docs/balance.csv и docs/BALANCE.md.
//
//   python3 tools/balance.py 120      (обёртка)  или  node tools/node/balance.js 120
//
// Целевые окна побед — tools/targets.json (общие для генератора и для tools/node/checks.js).
'use strict';
const fs = require('fs');
const path = require('path');
const h = require('./harness.js');
const { G } = h;

const N = Number(process.argv[2] || process.env.N || 40);
const SKILLS = [[0.4, 'новичок'], [0.65, 'средний'], [0.85, 'опытный']];
const BUILDS = ['tai', 'nin', 'gen', 'bal'];
const STAT_IDS = ['tai', 'nin', 'gen', 'chakra', 'ctrl', 'spd', 'end', 'know'];
const TGT = require('./targets.js');
const pct = (x) => Math.round(x * 100) + '%';
const DOCS = path.join(h.ROOT, 'docs');

h.seed();
// Фиксированное зерно: цифры в документации и в проверке воспроизводимы.
const SEED = Number(process.env.SEED || 20260518);
h.rng(SEED);

// ─────────── мета (всё из данных игры) ───────────
const meta = {
  builds: Object.fromEntries(Object.entries(G.sim.BUILDS).map(([k, v]) => [k, {
    name: v.name,
    skills: v.skills.map((s) => (G.SKILLS.find((x) => x.id === s) || {}).name || s),
    focus: v.focus.map((t) => (G.TRAININGS[t] || {}).name || t),
  }])),
  scen: G.sim.SCEN.map((s) => ({ id: s.id, label: s.label, enemy: s.enemy, mode: s.mode })),
  growth: Object.fromEntries(BUILDS.map((k) => [k, G.sim.growth(k)])),
  enemies: Object.fromEntries(Object.entries(G.ENEMIES).map(([k, e]) => [k, {
    name: e.name, hp: e.hp, dmg: e.dmg, style: e.style, tech: e.tech ? `${e.tech.name} (${e.tech.kind}, ×${e.tech.power}, ${e.tech.cost} ч)` : '—', grow: !!e.grow,
  }])),
  techs: Object.fromEntries(Object.entries(G.TECHS).map(([k, t]) => [k, { name: t.name, ch: t.ch, seals: t.seals.length }])),
  need: [3, 4, 5, 6, 7, 8, 9, 10, 11].map((s) => G.train.needAt(s)),
  econ: G.sim.economy(),
  trainings: G.TRAININGS,
};

// ─────────── прогон боёв ───────────
const t0 = Date.now();
const rows = [];
const errs = [];
for (const sc of meta.scen) {
  for (const bd of BUILDS) for (const [sk] of SKILLS) {
    try { rows.push(G.sim.run(sc.id, bd, sk, N)); }
    catch (e) { errs.push(`${sc.id}/${bd}/${sk}: ${e.message}`); }
  }
  const cells = rows.slice(-12).map((r) => pct(r.win));
  console.log('  ' + sc.label.padEnd(30) + cells.join(' '));
}
console.log(`боёв: ${rows.length * N}, ${((Date.now() - t0) / 1000).toFixed(1)} с, ошибок: ${errs.length}`);
for (const e of errs.slice(0, 5)) console.log('   ✘ ' + e);

// ─────────── CSV ───────────
const csv = [['scenario', 'build', 'skill', 'n', 'win', 'rounds', 'hp_left_on_win', 'stability', 'timeouts']];
for (const r of rows) csv.push([r.sc, r.build, r.skill, r.n, r.win.toFixed(3), r.turns.toFixed(1), r.hpLeft.toFixed(2), r.stability, r.timeout]);
fs.writeFileSync(path.join(DOCS, 'balance.csv'), csv.map((l) => l.join(',')).join('\r\n') + '\r\n');

// ─────────── Markdown ───────────
const L = [];
const A = (s) => L.push(s);
A('# BALANCE — таблица баланса «Naruto RPG»');
A('');
A(`Сгенерировано \`tools/balance.py\` → \`tools/node/balance.js\` (симулятор \`src/systems/sim.js\`, ядро боя \`src/systems/duel.js\`): ${N} боёв на ячейку, зерно ${SEED}, `
  + 'бот-игрок с мастерством 0,4 / 0,65 / 0,85 (как часто верит намёку противника и попадает в тайминг). '
  + 'Характеристики героя берутся из модели роста «средний игрок» на день боя. Целевые окна — `tools/targets.json` (общие с проверкой `tools/node/checks.js`). Файл генерируется, руками его не правят.');
A('');
A('## 1. Правила боя «Дуэль»');
A('');
A('| Что | Формула |');
A('|---|---|');
for (const [k, v] of [
  ['Раунд', 'герой и противник одновременно выбирают действие: Удар, Блок, Уклон, Приём. Блок бьёт Удар, Удар бьёт Уклон, Уклон бьёт Блок. Приём пробивает Блок (70%), но промахивается по Уклону'],
  ['HP героя', '(60 + 5·Вын) × 1,1 с «Крепким орешком»'],
  ['Чакра героя', '30 + 10·Чак (× 1,25 «Большой запас»)'],
  ['Удар героя', '(6 + 1,5·Тай) × (0,75…1,25 по таймингу) × (1 + 8%·цепочка успешных ударов); × 0,85 при усталости > 70'],
  ['Приём героя', 'сила × (6 + 1,8·Нин) × (0,75…1,25 по печатям); × 1,5 при усилении фиолетовой чакры'],
  ['Урон врага', '`dmg` из данных (удар); приём врага = dmg × сила приёма; клон принимает один удар'],
  ['Блок', 'от удара остаётся 20% урона; идеальный блок (тайминг > 0,8): 0% и контрудар 50%'],
  ['Намёк о ходе врага', 'точность = 20% + 4%·Зн + 1,5%·Скор (+10% «Аналитик», −20% у обманщиков); 15–90%'],
  ['Усталость', '+2,5 за раунд (медленнее с Вын) и +2 за приём; шире окно тайминга при малой усталости; > 70 — урон × 0,85'],
  ['Накал', '+7 за раунд, +5 при ударе по герою; от 60 доступен «Выброс» (25 чакры, мощный приём с отдачей)'],
  ['Фиолетовый срыв', 'шанс = (1 − стабильность) × затраты / 40, не больше 40%; 35% + 0,4%·стабильность — усиление ×1,5, иначе отдача 25% урона'],
  ['Спарринг / survive', 'спарринг — до 30% здоровья одного из бойцов; survive — N раундов; ko — до нуля'],
]) A(`| ${k} | ${v} |`);
A('');
A('Техники (цена чакры / печатей): ' + Object.values(meta.techs).map((t) => `${t.name} ${t.ch}/${t.seals}`).join(', ') + '.');
A('');
A('## 2. Враги');
A('');
A('| Враг | HP | Урон удара | Стиль | Коронный приём | Особое |');
A('|---|---|---|---|---|---|');
for (const e of Object.values(meta.enemies)) A(`| ${e.name} | ${e.hp} | ${e.dmg} | ${e.style} | ${e.tech} | ${e.grow ? 'растёт с днём' : '—'} |`);
A('');
A('Стили: dummy — стоит; rush — напирает; counter — отвечает на последнее действие героя; reader — читает частоту действий; turtle — защищается; trickster — путает намёки; brute — копит тяжёлый удар.');
A('');
A('## 3. Рост характеристик (модель «средний игрок»)');
A('');
A('Будни: урок (оценка ~75%) + 2 тренировки, выходные: 4 тренировки; первая тренировка дня — с дружбой (×1,5); '
  + 'повтор той же тренировки в день: ×1 / 0,7 / 0,45 / 0,3. Опыт до следующего уровня: 30 + 10·(стат − 3) → '
  + meta.need.join(', ') + ' (3→4 … 11→12). Потолок 12.');
A('');
for (const bd of BUILDS) {
  const B = meta.builds[bd];
  A(`**${B.name}** — навыки: ${B.skills.join(', ')}; тренирует: ${B.focus.join(', ')}.`);
  A('');
  A('| День | ' + STAT_IDS.join(' | ') + ' |');
  A('|---|' + '---|'.repeat(STAT_IDS.length));
  for (const d of Object.keys(meta.growth[bd]).map(Number).sort((a, b) => a - b)) A(`| ${d} | ` + STAT_IDS.map((k) => meta.growth[bd][d][k]).join(' | ') + ' |');
  A('');
}
A('## 4. Матрица побед (симуляция)');
A('');
A('Ячейка: доля побед новичок / средний / опытный. ✔ — «средний» в целевом окне, ▲ — слишком легко, ▼ — слишком трудно.');
A('');
A('| Бой | ' + BUILDS.map((b) => meta.builds[b].name).join(' | ') + ' |');
A('|---|' + '---|'.repeat(BUILDS.length));
let out = 0;
for (const sc of meta.scen) {
  const cells = [];
  for (const bd of BUILDS) {
    const rs = rows.filter((r) => r.sc === sc.id && r.build === bd);
    const mid = rs.find((r) => r.skill === 0.65).win;
    const [lo, hi] = TGT.target(sc.id, bd);
    const mark = mid >= lo && mid <= hi ? '✔' : (mid > hi ? '▲' : '▼');
    if (mark !== '✔') out++;
    cells.push(`${rs.map((r) => pct(r.win)).join(' / ')} ${mark}`);
  }
  A(`| ${sc.label} | ${cells.join(' | ')} |`);
}
A('');
A('Средняя длина боя (раундов, «средний»): ' + meta.scen.map((sc) => {
  const rs = rows.filter((r) => r.sc === sc.id && r.skill === 0.65);
  return `${sc.label.split(' (')[0]} — ${(rs.reduce((a, r) => a + r.turns, 0) / rs.length).toFixed(1)}`;
}).join('; ') + '.');
A('');
A('## 5. Экономика');
A('');
const e = meta.econ;
A('| Статья | Значение |');
A('|---|---|');
for (const [k, v] of [
  ['Старт', '300 рё'],
  ['Работа с доски (средняя ставка / выплата при 80%)', `${e.avgJob} / ${e.jobPay} рё`],
  ['Усталость: набор за сутки бодрствования', `~${e.fatiguePerDay}; рис дома бесплатно (−${e.riceRest} усталости)`],
  ['Рамен (мисо)', `${e.ramen} рё`],
  ['Продажа: рыба / карп / трава', `${e.fishSell} / ${e.carpSell} / ${e.herbSell} рё`],
  ['Кунай / бинт / пилюля / удочка', `${e.kunai} / ${e.bandage} / ${e.pill} / ${e.rod} рё`],
]) A(`| ${k} | ${v} |`);
A('');
A('## 6. Тренировки');
A('');
A('| Тренировка | Опыт | Усталость | Минут |');
A('|---|---|---|---|');
for (const t of Object.values(meta.trainings)) A(`| ${t.name} | ${Object.entries(t.stats).map(([k, v]) => k + ' ' + v).join(', ')} | ${t.fatigue} | ${t.minutes} |`);
A('');
fs.writeFileSync(path.join(DOCS, 'BALANCE.md'), L.join('\n'));
console.log(`docs/BALANCE.md и docs/balance.csv записаны; ячеек «среднего» вне окна: ${out} из ${meta.scen.length * BUILDS.length}`);
process.exitCode = out ? 1 : 0;
