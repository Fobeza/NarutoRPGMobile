// Быстрые проверки игры без браузера: python3 tools/check_node.py (или node tools/node/checks.js).
// Прогоняет собранный index.html в Node (tools/node/harness.js) и проверяет:
//   1) загрузку бандла и предупреждения сценариев   2) целостность данных и сценариев
//   3) исполнение всех сценариев при разных флагах  4) генерацию деревни на нескольких сидах
//   5) интерьеры (проходимость, наложения, доступность NPC)  6) покрытие пиксельного шрифта
//   7) update+draw всех сцен без исключений          8) симуляцию боёв и целевые окна баланса
//   9) сохранения (save/load/экспорт/импорт)
// Выход: 0 — всё зелёное, 1 — есть ✘. Строки с ✘ понимает tools/check_all.py.
'use strict';
const fs = require('fs');
const path = require('path');
const h = require('./harness.js');
const { G } = h;

const N_BATTLE = Number(process.env.N || 12);          // боёв на ячейку баланса
const SEEDS = (process.env.SEEDS || '7,13,42').split(',').map(Number);
let fails = 0, oks = 0;
const say = (s) => process.stdout.write(s + '\n');
function check(cond, msg) { say((cond ? '  ✔ ' : '  ✘ ') + msg); cond ? oks++ : fails++; }
function section(name) { say('== ' + name); }

// ─────────── 1. загрузка ───────────
section('ЗАГРУЗКА БАНДЛА');
check(!!G && Object.keys(G).length > 50, `G собран: ${Object.keys(G).length} модулей, ${h.loaded.ms} мс`);
check(h.warns.length === 0, `предупреждений при загрузке: ${h.warns.length}${h.warns.length ? ' → ' + h.warns.slice(0, 5).join(' | ') : ''}`);
check(G.scenes.stack.length === 1 && G.scenes.top().name === 'title', 'стартовая сцена — title');
const scriptProblems = G.script.problems || [];
check(scriptProblems.length === 0, `ошибок разбора сценариев: ${scriptProblems.length}${scriptProblems.length ? ' → ' + scriptProblems.slice(0, 5).join(' | ') : ''}`);

// ─────────── 2. целостность данных и сценариев ───────────
section('ЦЕЛОСТНОСТЬ ДАННЫХ');
const L = G.script.library, ITEMS = G.ITEMS, QUESTS = G.QUESTS, ENEMIES = G.ENEMIES;
const ARENAS = G.ARENAS, TECHS = G.TECHS, COMBOS = G.COMBOS, TRAIN = G.TRAININGS;
const FRIENDS = G.FRIENDS, DEFS = G.chars.DEFS, DRAFT = G.KONOHA_DRAFT;
const bad = [];
const draftTpls = new Set((DRAFT.buildings || []).map((b) => b.tpl));
const texts = [];
const OK_MODES = ['ko', 'spar', 'bells', 'scroll', 'survive', 'ringout'];

for (const id of Object.keys(L)) {
  const s = L[id];
  for (const op of s.ops) {
    if (op.op === 'say') { texts.push(op.text); if (op.name) texts.push(op.name); if (op.who && !DEFS[op.who]) bad.push(`${id}: говорящий «${op.who}» не в chars.DEFS`); }
    if (op.op === 'choice') { if (op.prompt) texts.push(op.prompt); for (const o of op.options) { texts.push(o.text); cond(id, o.cond); } }
    if (op.op === 'if') cond(id, op.cond);
    if (op.op === 'call') call(id, op);
  }
}
function cond(id, c) {
  if (!c) return;
  const s = String(c).replace(/^!/, '').trim();
  let m;
  if (/^(flag|var)\.\w+/.test(s)) return;
  if ((m = s.match(/^has\.(\w+)/))) return void (ITEMS[m[1]] || bad.push(`${id}: условие «${c}» — нет предмета «${m[1]}»`));
  if ((m = s.match(/^qdone\.(\w+)$/))) return void (QUESTS[m[1]] || bad.push(`${id}: условие «${c}» — нет задания «${m[1]}»`));
  if ((m = s.match(/^quest\.(\w+)(?:\.(\w+))?$/))) {
    const q = QUESTS[m[1]];
    if (!q) return void bad.push(`${id}: условие «${c}» — нет задания «${m[1]}»`);
    if (m[2] && !q.steps.some((st) => st.id === m[2])) bad.push(`${id}: условие «${c}» — в задании «${m[1]}» нет шага «${m[2]}»`);
    return;
  }
  if ((m = s.match(/^choice\.(\w+)\.(\w+)$/))) return void ((G.CHOICES[m[1]] || []).includes(m[2]) || bad.push(`${id}: условие «${c}» — нет выбора «${m[1]}.${m[2]}»`));
  if (/^stab\.\d+$/.test(s)) return;
  if (/^(cooldown\.\w+|weekday|rain|skill\.\w+)$/.test(s)) {
    if (s.startsWith('skill.') && !G.SKILLS.some((sk) => sk.id === s.slice(6))) bad.push(`${id}: условие «${c}» — нет навыка «${s.slice(6)}»`);
    return;
  }
  bad.push(`${id}: непонятное условие «${c}»`);
}
function call(id, op) {
  const a = op.args;
  if (!G.script.actions[op.name]) return void bad.push(`${id}: неизвестное действие «call ${op.name}»`);
  const script = (x) => x && x !== '-' && !L[x] && !G.cine.defs[x];
  switch (op.name) {
    case 'give': case 'take': if (a[0] && !ITEMS[a[0]]) bad.push(`${id}: call ${op.name} — нет предмета «${a[0]}»`); break;
    case 'quest': if (a[0] === 'start' && a[1] && !QUESTS[a[1]]) bad.push(`${id}: call quest start — нет задания «${a[1]}»`); break;
    case 'step':
      if (a[0] && !QUESTS[a[0]]) bad.push(`${id}: call step — нет задания «${a[0]}»`);
      else if (a[0] && a[1] && !QUESTS[a[0]].steps.some((st) => st.id === a[1])) bad.push(`${id}: call step — в задании «${a[0]}» нет шага «${a[1]}»`);
      break;
    case 'qfail': if (a[0] && !QUESTS[a[0]]) bad.push(`${id}: call qfail — нет задания «${a[0]}»`); break;
    case 'learn': if (a[0] && !TECHS[a[0]]) bad.push(`${id}: call learn — нет техники «${a[0]}»`); break;
    case 'combo': if (a[0] && !COMBOS[a[0]]) bad.push(`${id}: call combo — нет комбо «${a[0]}»`); break;
    case 'train': if (a[0] && !TRAIN[a[0]]) bad.push(`${id}: call train — нет тренировки «${a[0]}»`); break;
    case 'friend': case 'rep': if (op.name === 'friend' && a[0] && !FRIENDS[a[0]]) bad.push(`${id}: call friend — «${a[0]}» не в FRIENDS (дружба не начислится)`); break;
    case 'met': if (a[0] && !DEFS[a[0]]) bad.push(`${id}: call met — нет персонажа «${a[0]}»`); break;
    case 'goal': if (a[0] && a[0] !== 'none' && !G.game.GOALS[a[0]]) bad.push(`${id}: call goal — нет цели «${a[0]}»`); break;
    case 'sfx': if (a[0] && !G.audio.sfx[a[0]]) bad.push(`${id}: call sfx — нет звука «${a[0]}»`); break;
    case 'battle': {
      const [enemy, mode, arena, win, lose] = a;
      if (enemy && !ENEMIES[enemy]) bad.push(`${id}: call battle — нет врага «${enemy}»`);
      if (mode && !OK_MODES.includes(mode)) bad.push(`${id}: call battle — режим «${mode}»`);
      if (arena && !ARENAS[arena]) bad.push(`${id}: call battle — нет арены «${arena}»`);
      if (script(win)) bad.push(`${id}: call battle — нет скрипта победы «${win}»`);
      if (script(lose)) bad.push(`${id}: call battle — нет скрипта поражения «${lose}»`);
      break;
    }
  }
}
for (const [sid, sh] of Object.entries(G.SHOPS)) {
  for (const it of sh.stock || []) if (!ITEMS[it]) bad.push(`лавка ${sid}: нет предмета «${it}»`);
  if (sh.keeper && sh.keeper.who && !DEFS[sh.keeper.who]) bad.push(`лавка ${sid}: продавец «${sh.keeper.who}» не в DEFS`);
  if (sh.hours && !(sh.hours[0] < sh.hours[1])) bad.push(`лавка ${sid}: часы ${JSON.stringify(sh.hours)}`);
}
for (const [iid, it] of Object.entries(ITEMS)) { texts.push(it.name); if (it.desc) texts.push(it.desc); if (it.price == null) bad.push(`предмет ${iid}: нет цены`); }
for (const [qid, q] of Object.entries(QUESTS)) {
  texts.push(q.title); texts.push(q.desc);
  for (const st of q.steps || []) {
    texts.push(st.text);
    if (st.script && !L[st.script]) bad.push(`задание ${qid}/${st.id}: нет сценария «${st.script}»`);
    if (st.script && L[st.script] && !L[st.script].ops.some((op) => op.op === 'call' && op.name === 'step' && op.args[0] === qid && op.args[1] === st.id)) {
      bad.push(`задание ${qid}/${st.id}: сценарий «${st.script}» не вызывает call step ${qid} ${st.id}`);
    }
    const t = st.target || {};
    if (t.npc && !DEFS[t.npc]) bad.push(`задание ${qid}/${st.id}: NPC «${t.npc}» не в DEFS`);
    if (t.building && !draftTpls.has(t.building)) bad.push(`задание ${qid}/${st.id}: здания «${t.building}» нет в раскладке`);
    if (t.in && !draftTpls.has(t.in)) bad.push(`задание ${qid}/${st.id}: «in: ${t.in}» нет в раскладке`);
    if (!t.building && !t.npc && !t.obj && !t.tile && !t.point) bad.push(`задание ${qid}/${st.id}: у шага нет цели`);
    if(t.point){
      if(!Array.isArray(t.point)||t.point.length!==2||t.point.some(n=>!Number.isFinite(n)||n<0))bad.push(`задание ${qid}/${st.id}: неверные координаты`);
      if(t.map!=='konoha')bad.push(`задание ${qid}/${st.id}: неизвестная карта`);
    }
    for (const i of [...Object.keys(st.have || {}), ...Object.keys(st.need || {})]) if (!ITEMS[i]) bad.push(`задание ${qid}/${st.id}: нет предмета «${i}»`);
  }
  if (q.offer) {
    if (q.offer.script && !L[q.offer.script]) bad.push(`задание ${qid}: нет сценария предложения «${q.offer.script}»`);
    if (q.offer.npc && !DEFS[q.offer.npc]) bad.push(`задание ${qid}: NPC предложения «${q.offer.npc}» не в DEFS`);
  }
}
for (const [eid, e] of Object.entries(ENEMIES)) {
  texts.push(e.name);
  if (!['dummy', 'rush', 'counter', 'reader', 'turtle', 'trickster', 'brute'].includes(e.style)) bad.push(`враг ${eid}: неизвестный стиль «${e.style}»`);
  if (e.tech && !['dmg', 'drain', 'bind', 'fear'].includes(e.tech.kind)) bad.push(`враг ${eid}: неизвестный вид приёма «${e.tech.kind}»`);
  if (e.tech) texts.push(e.tech.name);
  if (!(e.hp > 0)) bad.push(`враг ${eid}: hp = ${e.hp}`);
  if (e.style !== 'dummy' && !(e.dmg > 0)) bad.push(`враг ${eid}: нет урона dmg`);
}
for (const [cid, c] of Object.entries(COMBOS)) texts.push(c.name);
for (const [tid, t] of Object.entries(TECHS)) { texts.push(t.name); texts.push(t.desc); if (!t.seals || !t.seals.length) bad.push(`техника ${tid}: нет печатей`); }
for (const [cid, s] of Object.entries(G.SCHED)) {
  if (!DEFS[cid]) bad.push(`расписание: «${cid}» не в chars.DEFS`);
  for (const r of s.rows || []) {
    texts.push(r[3]);
    if (!(r[1] < r[2])) bad.push(`расписание ${cid}: окно ${r[1]}–${r[2]} («${r[3]}»)`);
    if (r[4] && r[4] !== '@' && !draftTpls.has(r[4])) bad.push(`расписание ${cid}: место «${r[4]}» («${r[3]}») нет в раскладке — точка маршрута потеряется`);
  }
  for (const d of ['wd', 'we']) {
    const rows = (s.rows || []).filter((r) => r[0] === d || r[0] === 'all').sort((a, b) => a[1] - b[1]);
    for (let i = 1; i < rows.length; i++) if (rows[i][1] < rows[i - 1][2]) bad.push(`расписание ${cid}/${d}: окна пересекаются — «${rows[i - 1][3]}» и «${rows[i][3]}»`);
  }
}
for (const e of G.STORY || []) {
  if (e.script && !L[e.script] && !G.cine.defs[e.script]) bad.push(`сюжет ${e.id} (день ${e.day}): нет сценария «${e.script}»`);
  if (e.from != null && e.to != null && !(e.from < e.to)) bad.push(`сюжет ${e.id}: окно ${e.from}–${e.to}`);
  if (!(e.day >= 1 && e.day <= 56)) bad.push(`сюжет ${e.id}: день ${e.day} вне 1–56`);
}
for (const [fid, f] of Object.entries(FRIENDS)) {
  if (!DEFS[fid]) bad.push(`друг «${fid}» не в DEFS`);
  for (const i of [...(f.love || []), ...(f.like || []), ...(f.hate || [])]) if (!ITEMS[i]) bad.push(`друг ${fid}: нет предмета «${i}»`);
  if (f.spar && !ENEMIES[f.spar]) bad.push(`друг ${fid}: нет противника для спарринга «${f.spar}»`);
  if (f.train && !TRAIN[f.train]) bad.push(`друг ${fid}: нет тренировки «${f.train}»`);
}
for (const [tid, t] of Object.entries(TRAIN)) { texts.push(t.name); if (t.desc) texts.push(t.desc); for (const k of Object.keys(t.stats || {})) if (!G.STATS.some((s) => s.id === k)) bad.push(`тренировка ${tid}: неизвестная характеристика «${k}»`); }
for (const s of G.STATS) texts.push(s.name);
for (const sk of G.SKILLS) { texts.push(sk.name); if (sk.desc) texts.push(sk.desc); }
for (const c of Object.values(DEFS)) if (c.name) texts.push(c.name);
check(bad.length === 0, `битых ссылок в данных и сценариях: ${bad.length}`);
for (const b of bad.slice(0, 15)) say('     - ' + b);
if (bad.length > 15) say(`     … ещё ${bad.length - 15}`);

// ─────────── 3. исполнение сценариев ───────────
section('ПРОГОН СЦЕНАРИЕВ');
// действия с побочными эффектами (открывают сцены, бой) — глушим, чтобы проверять только поток скрипта
const originals = {};
for (const name of Object.keys(G.script.actions)) { originals[name] = G.script.actions[name]; G.script.actions[name] = () => {}; }
const flagNames = new Set(), varNames = new Set();
for (const id of Object.keys(L)) for (const op of L[id].ops) {
  if (op.op === 'set') (op.kind === 'flag' ? flagNames : varNames).add(op.key);
  const conds = op.op === 'if' ? [op.cond] : op.op === 'choice' ? op.options.map((o) => o.cond) : [];
  for (const c of conds.filter(Boolean)) { const m = String(c).replace(/^!/, '').match(/^(flag|var)\.(\w+)/); if (m) (m[1] === 'flag' ? flagNames : varNames).add(m[2]); }
}
const allFlags = Object.fromEntries([...flagNames].map((k) => [k, 1]));
const allVars = Object.fromEntries([...varNames].map((k) => [k, 5]));
const CFGS = [
  { name: 'чистое', flags: {}, vars: {}, skills: [], pick: 0 },
  { name: 'все флаги', flags: allFlags, vars: allVars, skills: [], pick: 0 },
  { name: 'все флаги, 2-й вариант', flags: allFlags, vars: allVars, skills: [], pick: 1 },
  { name: 'все флаги + навыки', flags: allFlags, vars: allVars, skills: G.SKILLS.map((s) => s.id), pick: 1 },
];
function runScript(id, cfg) {
  const st = G.game.newState();
  st.started = true; st.hero.name = 'Кайто'; st.hero.skills = cfg.skills.slice();
  Object.assign(st.flags, cfg.flags);
  Object.assign(st.vars, { day: 20, min: 720, money: 500 }, cfg.vars);
  const before = (G.script.problems || []).length;
  let r;
  try { r = G.script.runner(id); } catch (e) { return 'runner: ' + e.message; }
  for (let guard = 0; guard < 500; guard++) {
    let op;
    try { op = r.next(); } catch (e) { return e.message; }
    if (!op || op.op === 'end') break;
    if (op.op === 'say') continue;
    if (op.op === 'choice') {
      if (!op.options.length) return 'выбор без доступных вариантов';
      try { r.jump(op.options[Math.min(cfg.pick, op.options.length - 1)].label); } catch (e) { return e.message; }
      continue;
    }
    return 'неожиданная операция ' + op.op;
  }
  const newProblems = (G.script.problems || []).slice(before);
  if (newProblems.length) return newProblems[0];
  return null;
}
let runs = 0; const scriptFails = [];
for (const id of Object.keys(L)) for (const cfg of CFGS) { runs++; const err = runScript(id, cfg); if (err) scriptFails.push(`${id} [${cfg.name}]: ${err}`); }
for (const [k, v] of Object.entries(originals)) G.script.actions[k] = v;
check(scriptFails.length === 0, `прогонов ${runs} (${Object.keys(L).length} сценариев × ${CFGS.length} состояний), падений: ${scriptFails.length}`);
for (const f of scriptFails.slice(0, 10)) say('     - ' + f);

// ─────────── 4. мир ───────────
section('МИР (КОНОХА)');
let worldOk = true;
for (const seed of SEEDS) {
  let info = '', ok = true;
  try {
    const m = G.mapgen.konoha(G.KONOHA_DRAFT, seed);
    G.world.populateKonoha(m);
    m.finalize();
    G.mapgen.pockets(m);
    const badDoors = m.buildings.filter((b) => b.door && b.interior && !m.reach[(b.door.ty + 1) * m.w + b.door.tx]);
    const badTalk = m.objects.filter((o) => o.talk && !o.isBuilding).filter((o) => {
      const tx = Math.floor(o.x / 16), ty = Math.floor((o.y - 1) / 16);
      return ![[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]].some(([a, b]) => m.reach[(ty + b) * m.w + tx + a]);
    });
    ok = !badDoors.length && !badTalk.length;
    info = `${m.buildings.length} зданий, ${m.objects.length} объектов, ${m.npcs.length} NPC; двери вне доступа: ${badDoors.length}, объекты: ${badTalk.length}`;
  } catch (e) { ok = false; info = 'ОШИБКА: ' + e.message; }
  if (!ok) worldOk = false;
  say(`     сид ${seed}: ${ok ? '✔' : '✘'} ${info}`);
}
check(worldOk, `генерация деревни на сидах ${SEEDS.join(', ')} без недостижимых дверей и объектов`);
const K = G.world.konoha();
check(K.buildings.length > 150 && K.objects.length > 1000, `основная карта: ${K.w}×${K.h} тайлов, ${K.buildings.length} зданий, ${K.objects.length} объектов, ${K.npcs.length} NPC`);

// ─────────── 5. интерьеры ───────────
section('ИНТЕРЬЕРЫ');
const T = 16;
const roomIssues = [];
let rooms = 0;
const roomReport = auditRooms();
for (const r of roomReport) { rooms++; for (const i of r.iss) roomIssues.push(`${r.key}: ${i}`); }
check(roomIssues.length === 0, `комнат проверено: ${rooms}, проблем: ${roomIssues.length}`);
for (const i of roomIssues.slice(0, 15)) say('     - ' + i);

// все виды комнат (включая неиспользуемые) должны строиться
const kinds = Object.keys(G.interiors.KINDS);
let kindsOk = true;
for (const k of kinds) { try { const m = G.interiors.build({ kind: k, id: 'test:' + k, tplId: k }); if (!m.spawn) kindsOk = false; } catch (e) { kindsOk = false; say(`     - ${k}: ${e.message}`); } }
check(kindsOk, `все ${kinds.length} видов комнат строятся`);

function auditRooms() {
  const out = [];
  const seen = new Set();
  for (const b of K.buildings) {
    if (!b.interior) continue;
    const key = b.interior.kind + '/' + b.tplId;
    if (seen.has(key)) continue;
    seen.add(key);
    const m = G.world.get(b.interior.id);
    if (!m) { out.push({ key, iss: ['нет карты'] }); continue; }
    const iss = auditRoom(m, key);
    out.push({ key, iss });
  }
  return out;
}

// Общая проверка комнаты (её же использует tools/audit_rooms.py в браузере).
// Замкнутый декоративный пол (например, кухня за стойкой) проблемой не считается:
// он окружён непроходимыми тайлами и игроку не нужен.
function auditRoom(m, key) {
  const iss = [];
  const walk = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && !m.blockedRect({ x: x * T + 3, y: y * T + 7, w: 10, h: 5 });
  const sx = Math.floor(m.spawn.x / T), sy = Math.floor(m.spawn.y / T);
  const R = new Set(); const q = [[sx, sy]];
  if (!walk(sx, sy)) iss.push('точка входа заблокирована'); else R.add(sx * 999 + sy);
  while (q.length) {
    const [x, y] = q.pop();
    for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + a, ny = y + c, k = nx * 999 + ny;
      if (!R.has(k) && walk(nx, ny)) { R.add(k); q.push([nx, ny]); }
    }
  }
  const at = (x, y) => R.has(x * 999 + y);
  let dead = 0, deadOpen = 0;
  for (let y = 2; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
    if (!walk(x, y) || at(x, y)) continue;
    dead++;
    // клетка граничит с доступной → это не «закрытый декор», а настоящая дыра в проходимости
    if (at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1)) deadOpen++;
  }
  if (deadOpen) iss.push('недоступных клеток пола рядом с проходом: ' + deadOpen);
  const fronts = [];
  for (const k of R) {
    const x = Math.floor(k / 999), y = k % 999, px = x * T + 8, py = y * T + 12;
    for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) fronts.push([px + a * 12, py - 3 + c * 12]);
  }
  const npcOk = (n) => fronts.some(([fx, fy]) => Math.hypot(n.x - fx, n.y - 3 - fy) < (n.reach || 15));
  const objOk = (o) => { const b = o.box || { x: o.x - 8, y: o.y - 14, w: 16, h: 14 }; const ex = { x: b.x - 6, y: b.y - 10, w: b.w + 12, h: b.h + 16 }; return fronts.some(([fx, fy]) => fx >= ex.x && fx <= ex.x + ex.w && fy >= ex.y && fy <= ex.y + ex.h); };
  for (const n of m.npcs) {
    const f = { x: n.x - 5, y: n.y - 5, w: 10, h: 5 };
    const inside = m.objects.find((o) => o.box && G.util.rectsOverlap(f, o.box));
    if (inside) iss.push(`NPC ${n.id} стоит в объекте ${inside.kind}`);
    if (!npcOk(n)) iss.push(`NPC ${n.id} недоступен для разговора`);
  }
  for (const o of m.objects) if (o.talk && !objOk(o)) iss.push(`объект ${o.kind} (talk) недоступен`);
  const sol = m.objects.filter((o) => o.box);
  for (let i = 0; i < sol.length; i++) for (let j = i + 1; j < sol.length; j++) {
    const a = sol[i].box, c = sol[j].box;
    if (Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x) > 2 && Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y) > 2) iss.push(`наложение: ${sol[i].kind} × ${sol[j].kind}`);
  }
  for (const o of m.objects) { const r = m.drawRect(o); if (r.x < T - 2 || r.x + r.w > (m.w - 1) * T + 2 || r.y + r.h > (m.h - 1) * T + 4) iss.push(`объект ${o.kind} вылезает за стены`); }
  const ex = m.exit || (m.warps && m.warps[0]);
  if (ex && ex.tx != null && !at(ex.tx, ex.ty - 1)) iss.push('выход недоступен');
  return iss;
}

// ─────────── 6. шрифт ───────────
section('ШРИФТ');
const glyphs = new Set(G.font.chars());
const missing = new Map();
for(const job of Object.values(G.VILLAGE_DAILY.jobs)){texts.push(job.label,job.verb,job.talk,job.help,...job.lines);}
texts.push(...G.VILLAGE_DAILY.conversations.flat(),...Object.values(G.VILLAGE_DAILY.greetings).flat(),...G.VILLAGE_DAILY.animals.map(a=>a.name));
for (const t of texts) {
  if (typeof t !== 'string') continue;
  for (const ch of t.replace(/\{\w+\}/g, '')) {          // {name} подставляется до отрисовки
    if (ch === ' ' || ch === '\n') continue;
    if (!glyphs.has(ch) && !glyphs.has(ch.toUpperCase())) missing.set(ch, (missing.get(ch) || 0) + 1);
  }
}
check(missing.size === 0, `глифов ${glyphs.size}, строк контента ${texts.length}, непокрытых символов: ${missing.size}`);
for (const [ch, n] of [...missing].slice(0, 10)) say(`     - «${ch}» U+${ch.codePointAt(0).toString(16).toUpperCase()} × ${n} (нарисуется «?») `);

// ─────────── 7. сцены: update + draw ───────────
section('СЦЕНЫ (update + draw без исключений)');
h.seed();
const sceneFails = [];
function smoke(name, make, n = 3) {
  G.scenes.stack.length = 0;
  try {
    const s = make();
    if (typeof s.update !== 'function' || typeof s.draw !== 'function') throw new Error('сцене нужны методы update и draw');
    G.scenes.push(s);
    const ctx = h.recordingCtx(G.screen.W, G.screen.H);
    for (let i = 0; i < n; i++) { s.update(1 / 60); s.draw(ctx); }
    if (!ctx.log.length) sceneFails.push(`${name}: ничего не нарисовал`);
    s.exit && s.exit();
  } catch (e) { sceneFails.push(`${name}: ${e.message}`); }
  G.scenes.stack.length = 0;
}
const world = () => G.scenes.make('world', null);
smoke('title', () => G.scenes.make('title'), 2);
smoke('world', world, 4);
smoke('world (ночь)', () => { G.state.vars.min = 22 * 60; return G.scenes.make('world', null); }, 3);
smoke('world (дождь)', () => { G.state.vars.min = 12 * 60; G.state.vars.day = 5; return G.scenes.make('world', null); }, 3);
for (const id of ['in:1', 'in:2', 'in:4', 'in:24', 'in:33']) smoke('комната ' + id, () => G.scenes.make('world', { map: id, entry: true }), 3);
smoke('menu', () => G.scenes.make('menu'));
smoke('bag', () => G.scenes.make('bag'));
smoke('status', () => G.scenes.make('status'));
smoke('calendar', () => G.scenes.make('calendar'));
smoke('journal', () => G.scenes.make('journal'));
smoke('gallery', () => G.scenes.make('gallery'));
smoke('fonttest', () => G.scenes.make('fonttest'));
smoke('savemenu', () => G.scenes.make('savemenu'));
smoke('storage', () => G.scenes.make('storage'));
smoke('cheats', () => G.scenes.make('cheats'));
smoke('nameinput', () => G.scenes.make('nameinput'));
smoke('pause', () => G.scenes.make('pause'));
// mapview открывается из живого мира — поэтому мир сначала enter()
(() => {
  G.scenes.stack.length = 0;
  try {
    const w = G.scenes.make('world', null);
    G.scenes.push(w);
    const mv = G.scenes.make('mapview', w);
    G.scenes.push(mv);
    const ctx = h.recordingCtx(G.screen.W, G.screen.H);
    for (let i = 0; i < 3; i++) { mv.update && mv.update(1 / 60); mv.draw && mv.draw(ctx); }
    if (!ctx.log.length) sceneFails.push('mapview: ничего не нарисовал');
  } catch (e) { sceneFails.push('mapview: ' + e.message); }
  G.scenes.stack.length = 0;
})();
smoke('charcreate', () => G.scenes.make('charcreate', () => {}));
smoke('daysum', () => G.scenes.make('daysum', G.game.sleep(), () => {}));
smoke('pick', () => G.scenes.make('pick', { title: 'Тест', options: [{ label: 'Один' }, { label: 'Два' }] }, () => {}));
smoke('fishing', () => G.scenes.make('fishing', { spot: 'river', left: () => 3 }, () => {}, () => {}));
for (const sid of Object.keys(G.SHOPS)) smoke('shop ' + sid, () => G.scenes.make('shop', sid));
for (const kind of ['throw', 'log', 'meditate', 'tree', 'seals', 'run', 'quiz', 'cook', 'shogi', 'cat', 'sort']) smoke('train ' + kind, () => G.scenes.make('train', kind, {}, () => {}), 2);
for (const sc of G.sim.SCEN) {
  smoke('battle ' + sc.id, () => {
    const s = G.scenes.make('battle', { enemy: sc.enemy, mode: sc.mode, terrain: sc.terrain, turns: sc.turns, allies: sc.allies, will: sc.will, story: sc.story }, () => {});
    s.enter && 0;
    return s;
  }, 4);
}
check(sceneFails.length === 0, `сцен проверено: ${43 + Object.keys(G.SHOPS).length + 11 + G.sim.SCEN.length}, падений: ${sceneFails.length}`);
for (const f of sceneFails.slice(0, 12)) say('     - ' + f);

// ─────────── 8. бой и баланс ───────────
// Баланс меряется выборкой не меньше 120 боёв на ячейку: на 8–12 боях разброс ±15% и окна начинают «мигать».
// Прогон детерминирован (фиксированное зерно), но любое изменение кода боя перетасовывает последовательность
// случайных чисел, поэтому окна в tools/targets.json заданы с запасом ~10–15 п.п.
const N_BAL = Math.max(N_BATTLE, 120);
section('БОЙ И БАЛАНС (N=' + N_BAL + ' на ячейку)');
h.seed();
h.rng(Number(process.env.SEED || 20260518));   // то же зерно, что в tools/node/balance.js: проверка воспроизводима
const TGT = require('./targets.js');
let battles = 0, simErrs = [];
const rows = [];
const t0 = Date.now();
for (const sc of G.sim.SCEN) {
  for (const bd of ['tai', 'nin', 'gen', 'bal']) for (const sk of [0.4, 0.65, 0.85]) {
    try { rows.push(G.sim.run(sc.id, bd, sk, N_BAL)); battles += N_BAL; }
    catch (e) { simErrs.push(`${sc.id}/${bd}/${sk}: ${e.message}`); }
  }
}
check(simErrs.length === 0, `боёв сыграно: ${battles} за ${((Date.now() - t0) / 1000).toFixed(1)} с, ошибок: ${simErrs.length}`);
for (const e of simErrs.slice(0, 8)) say('     - ' + e);
const outOfWindow = [];
for (const sc of G.sim.SCEN) {
  for (const r of rows.filter((x) => x.sc === sc.id && x.skill === 0.65)) {
    const [lo, hi] = TGT.target(sc.id, r.build);
    if (!(r.win >= lo && r.win <= hi)) outOfWindow.push(`${sc.id}/${r.build}: ${(r.win * 100).toFixed(0)}% вне ${TGT.label(sc.id, r.build)}`);
  }
}
check(outOfWindow.length === 0, `целевые окна баланса («средний» игрок, ${G.sim.SCEN.length} боёв × 4 сборки): вне окна ${outOfWindow.length}`);
for (const o of outOfWindow.slice(0, 20)) say('     - ' + o);
const timeouts = rows.filter((r) => r.timeout > 0);
check(timeouts.length === 0, `боёв, не уложившихся в лимит ходов: ${timeouts.length}`);
// minTurns — защита от «финала в три хода»: бой обязан быть длинным, даже если сборка его выигрывает
const minTurns = TGT.TARGETS.minTurns || {};
const short = [];
for (const [id, min] of Object.entries(minTurns)) {
  const rs = rows.filter((x) => x.sc === id && x.skill === 0.65);
  if (!rs.length) continue;
  const avg = rs.reduce((a, r) => a + r.turns, 0) / rs.length;
  if (avg < min) short.push(`${id}: ${avg.toFixed(1)} ходов при минимуме ${min}`);
}
check(short.length === 0, `минимальная длина боя (средний игрок): нарушений ${short.length}`);
for (const o of short) say('     - ' + o);

// ─────────── 9. сохранения ───────────
section('СОХРАНЕНИЯ');
h.seed((st) => { st.vars.day = 40; st.vars.money = 1234; st.inv.kunai = 9; st.log.push('Проверка'); });
G.storage.wipe();
check(G.storage.save(G.state, { backup: true }) === true, 'сохранение пишется');
const code = G.storage.exportCode();
check(code.startsWith('WOF1:') && code.length > 20, `код сохранения: ${code.length} символов`);
{ const info = G.storage.backupInfo(); check(!!info && info.day === 40, `резервная копия «утро дня»: ${info ? 'день ' + info.day : 'нет'}`); }
const loaded = G.storage.load();
check(loaded && loaded.vars.day === 40 && loaded.vars.money === 1234 && loaded.inv.kunai === 9, 'загрузка вернула то же состояние');
G.storage.wipe();
check(G.storage.importCode(code) === true && G.storage.load().vars.day === 40, 'импорт кода работает');
check(G.storage.importCode('мусор') === false, 'импорт мусора отклоняется');
const size = JSON.stringify({ v: 2, t: Date.now(), build: 'x', state: loaded }).length;
check(size < 32 * 1024, `размер сохранения: ${(size / 1024).toFixed(1)} КБ (< 32 КБ)`);
// резервная копия не перезаписывается обычным сохранением
G.storage.save(G.state);
check(G.storage.backupInfo().day === 40, 'резервная копия не затирается при автосейве');
G.storage.restoreBackup();
check(G.storage.load().vars.day === 40, 'восстановление из резервной копии');
// старое сохранение дополняется недостающими полями
const fixed = G.game.fix({ started: true, hero: { name: 'Старое' }, flags: {}, vars: { day: 5, min: 600 }, inv: {}, quests: {}, log: [] });
check(fixed.vars.money != null && fixed.fog != null && fixed.daily != null, 'G.game.fix() дополняет старое сохранение');

// аудит B03–B05: структура кода, независимые снимки в памяти, свежее состояние при отказе записи
check(G.storage.importCode('WOF1:' + Buffer.from(JSON.stringify({ v: 2, state: { vars: 'broken', hero: {} } })).toString('base64')) === false, 'импорт с неверными типами отклоняется');
check(G.storage.importCode('WOF1:' + Buffer.from(JSON.stringify({ v: 99, state: loaded })).toString('base64')) === false, 'импорт будущей версии отклоняется');
{
  G.storage.wipe();
  const st = JSON.parse(JSON.stringify(loaded));
  G.storage.save(st, { backup: true });
  st.vars.day = 50; st.vars.money = 1;
  check(G.storage.backupInfo().day === 40 && G.storage.load().vars.day === 40, 'снимок в памяти не меняется вместе с живым состоянием');
  G.storage.wipe();
}

// аудит B09/B10: награды дружбы за все пересечённые уровни, каждая один раз
{
  h.seed((st) => { st.vars.friend_naruto = 14; });
  G.state.frQueue = []; G.state.flags = {};
  G.friends.add('naruto', 8);
  const q1 = G.state.frQueue.filter((x) => x.startsWith('fr_naruto_')).length;
  G.state.vars.friend_naruto = 14; G.friends.add('naruto', 1); G.state.vars.friend_naruto = 14; G.friends.add('naruto', 1);
  const q2 = G.state.frQueue.filter((x) => x.startsWith('fr_naruto_')).length;
  check(G.state.frQueue.includes('fr_naruto_3') && q2 === q1, `дружба 14→22: награда пропущенного уровня 3 выдана, повторов нет (${q1}/${q2})`);
}

// аудит B08: сон на учебный день без урока — прогул
{
  h.seed((st) => { st.vars.day = 8; st.vars.min = 9 * 60; });
  G.state.started = true; G.state.daily = {}; G.state.vars.miss = 0;
  G.game.sleep();
  check(G.state.vars.miss === 1, 'сон вместо урока засчитывается как прогул');
}

// ─────────── итог ───────────
say('');
say(`ИТОГ: ✔ ${oks}  ✘ ${fails}`);
process.exit(fails ? 1 : 0);
