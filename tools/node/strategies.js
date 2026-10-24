// Проверка разнообразия карточной дуэли: 21 осмысленный план должен реально победить одного противника.
// Для связок проверяется не только наличие карт, но и их порядок в истории победного боя.
'use strict';
const assert = require('node:assert/strict');
const h = require('./harness.js');
const { G } = h;

const PLANS = [
  { name: 'Тай-серия', prefer: ['strike', 'combo', 'guard'], need: ['strike', 'combo'] },
  { name: 'Финт и серия', prefer: ['feint', 'combo', 'strike'], need: ['feint', 'combo'], ordered: true },
  { name: 'Метка и Выстрел', prefer: ['kunai', 'chakra_shot', 'focus'], need: ['kunai', 'chakra_shot'], ordered: true },
  { name: 'Фокус и Выстрел', prefer: ['focus', 'chakra_shot', 'kunai'], need: ['focus', 'chakra_shot'], ordered: true },
  { name: 'Анализ и Выстрел', prefer: ['analyze', 'chakra_shot', 'kunai'], need: ['analyze', 'chakra_shot'], ordered: true },
  { name: 'Контрстойка', prefer: ['stance', 'guard', 'strike'], need: ['stance', 'guard'] },
  { name: 'Каварими', prefer: ['kawarimi', 'strike', 'combo'], need: ['kawarimi'] },
  { name: 'Клоновый заслон', prefer: ['bunshin', 'combo', 'strike'], need: ['bunshin'] },
  { name: 'Хенге и натиск', prefer: ['henge', 'chakra_shot', 'combo'], need: ['henge'] },
  { name: 'Вспышка и натиск', prefer: ['flash_bomb', 'combo', 'strike'], need: ['flash_bomb'] },
  { name: 'Дым и натиск', prefer: ['smoke_bomb', 'combo', 'strike'], need: ['smoke_bomb'] },
  { name: 'Ложный страх', prefer: ['fear', 'combo', 'strike'], need: ['fear'] },
  { name: 'Секси-дзюцу', prefer: ['sexy', 'combo', 'strike'], need: ['sexy'] },
  { name: 'Шуншин', prefer: ['shunshin', 'feint', 'strike'], need: ['shunshin'] },
  { name: 'Горение и защита', prefer: ['katon', 'guard', 'stance'], need: ['katon', 'guard'], ordered: true },
  { name: 'Вода и молния', prefer: ['suiton', 'raiton', 'focus'], need: ['suiton', 'raiton'], ordered: true },
  { name: 'Футон и серия', prefer: ['fuuton', 'combo', 'strike'], need: ['fuuton', 'combo'], ordered: true },
  { name: 'Метка и Катон', prefer: ['kunai', 'katon', 'focus'], need: ['kunai', 'katon'], ordered: true },
  { name: 'Фиолетовый выброс', prefer: ['focus', 'release', 'kunai'], need: ['focus', 'release'], ordered: true },
  { name: 'Живучесть', prefer: ['bandage', 'breath', 'guard'], need: ['bandage', 'breath'] },
  { name: 'Пилюля и стихия', prefer: ['chakra_pill', 'katon', 'focus'], need: ['chakra_pill', 'katon'], ordered: true },
];

function inOrder(sequence, need) {
  let at = 0;
  for (const id of sequence) if (id === need[at]) at++;
  return at === need.length;
}

h.seed();
const stats = { tai: 10, nin: 10, gen: 9, chakra: 10, ctrl: 9, spd: 9, end: 9, know: 9 };
const techs = Object.keys(G.TECHS);
const findings = [];
for (const plan of PLANS) {
  let found = null;
  for (let seed = 1; seed <= 100 && !found; seed++) {
    const r = G.duel.simulate({ enemy: 'sasuke', mode: 'ko', day: 19, stats, skills: ['tough', 'big_chakra'], techs,
      stability: 75, fatigue: 5, hp: 100, chakra: 100,
      inv: { bandage: 3, smoke_bomb: 2, flash_bomb: 2, chakra_pill: 2 }, rng: G.duel.mulberry(seed), surge: true,
    }, 1, { prefer: plan.prefer });
    if (!r.win || !plan.need.every((id) => r.used[id])) continue;
    if (plan.ordered && !inOrder(r.sequence, plan.need)) continue;
    found = { seed, rounds: r.rounds, cards: r.cards, hp: r.hp };
  }
  assert.ok(found, `План не привёл к характерной победе за 100 сидов: ${plan.name}`);
  assert.ok(found.rounds < 40 && found.cards >= plan.need.length, plan.name);
  findings.push({ plan: plan.name, ...found });
  console.log(`  ✔ ${plan.name}: победа, сид ${found.seed}, ходов ${found.rounds}, карт ${found.cards}`);
}
assert.ok(PLANS.length >= 20);
console.log(`ИТОГ тактик: ${findings.length}; противник один — Саске; все планы завершились характерной победой.`);
