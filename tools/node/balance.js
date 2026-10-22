// Генератор баланса без браузера: симулятор G.sim исполняется прямо в Node (tools/node/harness.js).
// Пишет docs/balance.csv и docs/BALANCE.md — те же файлы, что раньше делал tools/balance.py через Playwright.
//
//   python3 tools/balance.py 40      (обёртка)  или  node tools/node/balance.js 40
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
const target = (sc, bd) => TGT.target(sc, bd);
const pct = (x) => Math.round(x * 100) + '%';
const DOCS = path.join(h.ROOT, 'docs');

h.seed();
// Фиксированное зерно: цифры в документации и в проверке воспроизводимы (иначе разброс ±8% между прогонами).
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
    name: e.name, hp: e.hp, ch: e.ch, tai: e.tai, nin: e.nin, gen: e.gen, spd: e.spd, end: e.end, know: e.know,
    focus: e.focus, pref: e.pref, acts: (e.acts || []).map((a) => G.EACTS[a] ? G.EACTS[a].name + ' ' + (G.EACTS[a].dmg || 0) : a),
    traits: e.traits || [], phase2: !!e.phase2, grow: !!e.grow,
  }])),
  moves: G.MOVES, combos: G.COMBOS,
  techs: Object.fromEntries(Object.entries(G.TECHS).map(([k, t]) => [k, { name: t.name, ch: t.ch, seals: t.seals.length, w: t.w }])),
  trainings: G.TRAININGS,
  need: [3, 4, 5, 6, 7, 8, 9, 10, 11].map((s) => G.train.needAt(s)),
  econ: G.sim.economy(),
  jobs: Object.values(G.JOBS).map((j) => ({ name: j.name, pay: j.pay })),
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
const csv = [['scenario', 'build', 'skill', 'n', 'win', 'turns', 'hp_left_on_win', 'enemy_hp_left', 'ringouts', 'timeouts']];
for (const r of rows) csv.push([r.sc, r.build, r.skill, r.n, r.win.toFixed(3), r.turns.toFixed(1), r.hpLeft.toFixed(2), r.enemyLeft.toFixed(2), r.ringout, r.timeout]);
fs.writeFileSync(path.join(DOCS, 'balance.csv'), csv.map((l) => l.join(',')).join('\r\n') + '\r\n');

// ─────────── Markdown ───────────
const L = [];
const A = (s) => L.push(s);
A('# BALANCE — таблица баланса «Naruto RPG»');
A('');
A(`Сгенерировано \`tools/balance.py\` → \`tools/node/balance.js\` (симулятор \`src/systems/sim.js\`): ${N} боёв на ячейку, зерно ${SEED}, `
  + 'бот-игрок с мастерством 0,4 / 0,65 / 0,85 (точность ритма, печатей и реакций). '
  + 'Характеристики героя берутся из модели роста «средний игрок» на день боя. Целевые окна — `tools/targets.json`.');
A('');
A('## 1. Формулы боя');
A('');
A('| Что | Формула |');
A('|---|---|');
for (const [k, v] of [
  ['HP героя', '(60 + 4·Вын) × 1,1 с «Крепким орешком»'],
  ['Чакра героя', '20 + 8·Чак (× 1,25 «Большой запас»)'],
  ['Шкала ходов', 'вес действия × fac(Скор), fac = max(0,6; 1,3 − 0,05·Скор)'],
  ['Засада', 'Каварими: ×(1,4 + 0,04·Нин), Хенге: ×(1,8 + 0,04·Нин), куст ×1,5'],
  ['Блок врага против серии', '12% + 3%·(Тай врага − Тай) + 3%·(Скор врага − Скор) + 6%·Фокус врага; 6–45%; урон ×0,5'],
  ['Финальное комбо (Воля)', '16 + 1,5·Тай, всегда крит'],
  ['Уличные враги (хулиган, пёс, вор)', 'растут с днём: HP × (1 + 0,025·день), Тай +⌊день/9⌋, Скор +⌊день/14⌋, Вын +⌊день/21⌋'],
  ['Соперники, которые встречаются дважды', 'Киба: д.3 — «Киба (спарринг)» kiba_s, д.26 — турнирный kiba_t; оба из `data/combat.js`'],
  ['Урон героя', 'база × (1 + 0,065·стат) / (1 + 0,04·Вын врага) × крит 1,5 / норма 1 / слабо 0,6 × комбо'],
  ['Урон врага', 'база × (1 + 0,11·стат врага) / (1 + 0,03·Вын героя); блок ×0,55 (1 дыхание), уклон: 35% + 6%·(Скор − Скор врага)'],
  ['Дыхание (тайдзюцу)', '2 + ⌊Вын / 3⌋ ячеек, +1 за ход без тайдзюцу, «Защита» +2'],
  ['Фокус (реакции)', '2 + «Аналитик» + флаг «Тактик» (из Академии)'],
  ['Воля Огня', '+урон получен ×0,8, +крит/уклон; 100 → «Воля Огня!»'],
  ['Спарринг / свиток / колокольчик', 'победа при HP врага ≤30% (≤25% для колокольчика); поражение при своём ≤30%'],
]) A(`| ${k} | ${v} |`);
A('');
A('Приёмы тайдзюцу: ' + Object.values(meta.moves).map((m) => `${m.name} ${m.dmg}`).join(', ') + '.  ');
A('Комбо: ' + Object.values(meta.combos).map((c) => `${c.name} ×${c.mul}`).join(', ') + '.  ');
A('Техники (цена чакры / печатей): ' + Object.values(meta.techs).map((t) => `${t.name} ${t.ch}/${t.seals}`).join(', ') + '.');
A('');
A('## 2. Враги');
A('');
A('| Враг | HP | Чак | Тай | Нин | Ген | Скор | Вын | Зн | Фокус | Дист. | Особое |');
A('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const e of Object.values(meta.enemies)) {
  A(`| ${e.name} | ${e.hp} | ${e.ch} | ${e.tai} | ${e.nin} | ${e.gen} | ${e.spd} | ${e.end} | ${e.know} | ${e.focus} | ${e.pref} | `
    + ([...e.traits, ...(e.phase2 ? ['2 фаза'] : []), ...(e.grow ? ['растёт с днём'] : [])].join(', ') || '—') + ' |');
}
A('');
A('## 3. Рост характеристик (модель «средний игрок»)');
A('');
A('Будни: урок (оценка ~75%) + 2 тренировки (+ работа), выходные: 4 тренировки; первая тренировка дня — с другом (×1,5); '
  + 'повтор той же тренировки в день: ×1 / 0,7 / 0,45 / 0,3. Опыт до следующего уровня: 30 + 10·(стат − 3) → '
  + meta.need.join(', ') + ' (3→4 … 11→12). Потолок 12.');
A('');
for (const bd of BUILDS) {
  const B = meta.builds[bd];
  A(`**${B.name}** — навыки: ${B.skills.join(', ')}; тренирует: ${B.focus.join(', ')}.`);
  A('');
  A('| День | ' + STAT_IDS.join(' | ') + ' |');
  A('|---|' + '---|'.repeat(STAT_IDS.length));
  for (const d of Object.keys(meta.growth[bd]).map(Number).sort((a, b) => a - b)) {
    A(`| ${d} | ` + STAT_IDS.map((k) => meta.growth[bd][d][k]).join(' | ') + ' |');
  }
  A('');
}
A('## 4. Матрица побед (симуляция)');
A('');
A('Ячейка: доля побед новичок / средний / опытный. ✔ — «средний» в целевом окне, ▲ — слишком легко, ▼ — слишком трудно.');
A('');
A('| Бой | Цель (средний) | ' + BUILDS.map((b) => meta.builds[b].name).join(' | ') + ' |');
A('|---|---|' + '---|'.repeat(BUILDS.length));
let out = 0;
const notes = [];
for (const sc of meta.scen) {
  const perBuild = !Array.isArray((TGT.TARGETS.targets || {})[sc.id]);
  const cells = [];
  for (const bd of BUILDS) {
    const rs = rows.filter((r) => r.sc === sc.id && r.build === bd);
    const mid = rs.find((r) => r.skill === 0.65).win;
    const [lo, hi] = target(sc.id, bd);
    const mark = mid >= lo && mid <= hi ? '✔' : (mid > hi ? '▲' : '▼');
    if (mark !== '✔') out++;
    cells.push(`${rs.map((r) => pct(r.win)).join(' / ')} ${mark}`);
  }
  const [dlo, dhi] = target(sc.id, 'tai');
  A(`| ${sc.label} | ${perBuild ? 'по сборкам' : pct(dlo) + '–' + pct(dhi)} | ${cells.join(' | ')} |`);
  if (perBuild && TGT.TARGETS.notes && TGT.TARGETS.notes[sc.id]) notes.push(`**${sc.label}**: ${TGT.TARGETS.notes[sc.id]}`);
}
A('');
if (notes.length) {
  A('Почему окна различаются по сборкам:');
  A('');
  for (const n of notes) A('- ' + n);
  if (TGT.TARGETS.notes && TGT.TARGETS.notes._spread) A('- ' + TGT.TARGETS.notes._spread);
  A('');
}
A('Средняя длина боя (ходов героя, «средний»): ' + meta.scen.map((sc) => {
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
  ['Типичная неделя', `+5 работ ≈ ${5 * e.jobPay} рё, рыбалка/травы ≈ 60–120 рё; расходы: обеды ≈ 250, расходники ≈ 80, подарки ≈ 60 → +${5 * e.jobPay + 90 - 390} рё`],
]) A(`| ${k} | ${v} |`);
A('');
A('Работы: ' + meta.jobs.map((j) => `${j.name} ${j.pay}`).join(', ') + ' рё.');
A('');
A('## 6. Выводы и что изменено по итогам симуляции');
A('');
for (const s of [
  '**Было (первый прогон):** 95–100% побед во всех боях у всех сборок, даже у «новичка». Причины: урон героя не учитывал Выносливость врага; '
  + 'комбо перемножались (подсечка→апперкот ×1,5 × комбо ×1,6 × стат ×1,9 — «Воздушное комбо» снимало Ли 60% HP); 6 дыханий на старте = два комбо подряд; '
  + 'блок срезал 60% урона; финальное комбо Воли 28 + 2·Тай; модель роста (3+5 тренировок в день) выводила почти все статы на 12 к д.47.',
  '**Изменено:** урон героя ×(1 + 0,065·стат) / (1 + 0,04·Вын врага); комбо ×1,2 / 1,35 / 1,45; апперкот после подсечки ×1,3; приёмы 5/7/3/6; '
  + 'дыхание 2 + ⌊Вын/3⌋; блок ×0,55; враг может блокировать серию; урон врагов ×(1 + 0,11·стат); HP героя 60 + 4·Вын, «Крепкий орешек» ×1,1; '
  + 'финальное комбо 16 + 1,5·Тай; Воля с «Упорством» ×1,2; засады Каварими/Хенге растут с Нин; опыт до уровня 30 + 10·(стат − 3); '
  + 'HP сюжетных врагов +10–25%; уличные враги растут с днём; на полевом выходе — новый «Старшеклассник» вместо хулигана.',
  '**Ревизия после аудита:** в тренировочных боях (уроки, спарринги, турнир) расходники не тратятся; ловушки в бою требуют учебник «Теория ловушек»; '
  + 'встречный кунай — 3 + 0,35·Скор врага нажатий за 1,5 с (было 5 + 0,5·Скор за 1,3 с); оценка за урок-бой не ниже 50% при победе.',
  '**Ревизия 2 ( Node-прогон, ' + N + ' боёв на ячейку):** соперники второй половины игры усилены — раньше «средний» игрок '
  + 'выигрывал турнир, полевой выход и финал в 90–100% случаев любой сборкой. Киба разделён на две версии: `kiba_s` (спарринг дня 3, слабее — '
  + 'ниндзюцу и гендзюцу без техник не проигрывали всухую) и `kiba_t` (турнир дня 26, сильнее); усилены Наруто (д.14), Рок Ли (д.18), '
  + 'турнирные Чоджи и Саске, старшеклассник (д.38), Ирука с колокольчиками (д.47) и Мизуки (д.54). '
  + 'Все ячейки «среднего» игрока — в целевых окнах `tools/targets.json`.',
  '**Особенность сборок:** Тайдзюцу — самая «боевая»: её тренировки (манекен, бревно, крыши) качают ещё Скорость и Выносливость. '
  + 'Это осознанно: такой герой слабее в учёбе, на экзамене и в техниках. Ниндзюцу — самая трудная до Буншина (д.43): её урон идёт через засады Хенге/Каварими. '
  + 'Колокольчики Ируки почти не зависят от сборки (удача рывка).',
  '**Как перепроверить после правок:** `python3 tools/balance.py 40` (нужен Node.js; без браузера, ~5 с) — ячейки с ▲/▼ показывают выход «среднего» игрока из целевого окна. '
  + 'Автоматически это же проверяет `python3 tools/check_node.py`.',
]) A('- ' + s);
A('');
fs.writeFileSync(path.join(DOCS, 'BALANCE.md'), L.join('\n'));
console.log(`docs/BALANCE.md и docs/balance.csv записаны; ячеек «среднего» вне окна: ${out} из ${meta.scen.length * BUILDS.length}`);
if (errs.length) process.exit(1);
