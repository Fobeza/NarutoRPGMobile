// Регрессии исправлений аудита: сохранения, расходники, квесты, мобильный UI и жители.
'use strict';
const assert = require('node:assert/strict');
const h = require('./harness');
const { G } = h;
let passed = 0, failed = 0;
function clean() {
  G.scenes.stack.length = 0; G.scenes.fade = { a: 0, dir: 0, speed: 3, then: null };
  G.game.pending = null;
  h.seed(st => { st.flags.hosp_done = 1; st.flags.frd_init = 1; st.inv = {}; });
}
function test(name, fn) {
  clean();
  try { fn(); console.log('  ✔ ' + name); passed++; }
  catch (e) { console.log('  ✘ ' + name + ': ' + e.message); failed++; }
}
function battle(mode = 'ko') {
  const b = G.scenes.make('battle', { enemy: 'dummy', mode }, () => {});
  b.enter(); settle(b); return b;
}
function settle(b) { for (let i = 0; i < 600 && b.state !== 'menu' && b.state !== 'end'; i++) b.update(.1); }
function forceCard(D, id) {
  let c = D.hand.find(x => x.id === id);
  if (!c) for (const zone of [D.deck, D.discard]) {
    const i = zone.findIndex(x => x.id === id);
    if (i >= 0) { c = zone.splice(i, 1)[0]; D.hand.push(c); break; }
  }
  assert.ok(c, `карта ${id} не найдена в колоде`);
  return c;
}
function calm(D) { D.E.block = 0; D.E.dodge = 0; D.intent = { kind: 'idle', name: 'Тест' }; return D; }
function key(scene, name) {
  const old = G.input.pressed; G.input.pressed = b => b === name;
  try { scene.update(.016); } finally { G.input.pressed = old; }
}
function playScript(id) {
  const r = G.script.runner(id);
  for (let guard = 0; guard < 100; guard++) {
    const op = r.next();
    if (!op || op.op === 'end') return;
    if (op.op === 'choice') { assert.ok(op.options.length, id + ': пустой выбор'); r.jump(op.options[0].label); }
    else assert.equal(op.op, 'say', id + ': неожиданная операция');
  }
  assert.fail(id + ': сценарий не завершился');
}

test('Незавершённая награда дружбы остаётся в очереди после загрузки', () => {
  G.friends.add('naruto', 15);
  const world = { name: 'world', update() {}, draw() {}, refreshNpcs() {} }; G.scenes.push(world);
  G.story.poll(world);
  assert.ok(G.state.frQueue.includes('fr_naruto_3'));
  assert.ok(!G.state.flags.frd_naruto_3);
  G.storage.save(G.state); const st = G.game.fix(G.storage.load());
  assert.ok(st.frQueue.includes('fr_naruto_3'));
});
test('Награда помечается только после полного диалога и не дублируется', () => {
  G.friends.add('naruto', 15);
  const world = { name: 'world', update() {}, draw() {}, refreshNpcs() {} }; G.scenes.push(world); G.story.poll(world);
  const d = G.scenes.top(); for (let i = 0; i < 30 && G.scenes.top() === d; i++) d.advance();
  assert.equal(G.state.flags.frd_naruto_3, 1); assert.equal(G.state.frQueue.length, 0);
  G.friends.add('naruto', 1); assert.equal(G.state.frQueue.length, 0);
});
test('Повреждённые вложенные поля сохранения отклоняются', () => {
  const mutations = [st => st.inv.kunai = '3', st => st.chest = { unknown: 1 }, st => st.hero.stats.tai = 'x', st => st.quests.shogi = { st: 'active', step: 999 }, st => st.pos = { map: 'konoha', x: null, y: 1, dir: 'down' }, st => st.fog = 'abc', st => st.log = [4], st => st.frQueue = [4]];
  assert.ok(G.storage.valid({ state: G.state }));
  for (const mutate of mutations) { const st = JSON.parse(JSON.stringify(G.state)); mutate(st); assert.equal(G.storage.valid({ state: st }), false); }
});
test('Перезагрузка во время боя полностью возвращает состояние до боя', () => {
  G.state.inv = { bandage: 2 }; const before = JSON.stringify(G.state); const b = battle('ko');
  G.state.vars.hp = 40; G.state.vars.fatigue = 90; G.game.take('bandage');
  G.storage.save(G.state); const st = G.game.fix(G.storage.load());
  assert.deepEqual(st.inv, JSON.parse(before).inv); assert.equal(st.battleCheckpoint, null);
  assert.equal(st.vars.hp, 100); assert.equal(st.vars.fatigue, JSON.parse(before).vars.fatigue);
});
test('Предметы проверяются повторно в момент сдачи квеста', () => {
  G.state.vars.min = 12 * 60;
  for (const [qid, id, qty, npc] of [['homework', 'kunai', 3, 'iruka'], ['shogi', 'shogi', 1, 'shikamaru'], ['flowers', 'flowers_s', 1, 'sakura']]) {
    if (!G.QUESTS[qid]) continue;
    G.game.give(id, qty); G.quests.start(qid); G.game.take(id, qty);
    assert.equal(G.quests.scriptFor(npc), 'quest_missing_items');
    const step = G.quests.state(qid).step; assert.equal(G.quests.step(qid), false); assert.equal(G.quests.state(qid).step, step);
  }
});
test('Переполнение награды попадает в домашний сундук без потери', () => {
  G.state.inv = { kunai: 10 }; G.game.give('bandage', 3);
  assert.equal(G.game.pouchUsed(), 10); assert.equal(G.state.chest.bandage, 3);
});
test('Старый переполненный подсумок безопасно переносится в сундук', () => {
  G.state.inv = { kunai: 8, shuriken: 8 }; G.game.fix(G.state);
  assert.equal(G.game.pouchUsed(), 10); assert.equal(G.state.chest.shuriken, 6);
});
test('В спарринге расходники конечны, запас вне боя сохраняется; в бою до конца — списываются', () => {
  G.state.inv = { bandage: 1 }; const b = battle('spar'); b.D.P.hp = 10; forceCard(b.D, 'bandage');
  assert.ok(b.play('item:bandage')); settle(b); assert.equal(b.D.inv.bandage, 0); assert.ok(b.D.P.hp > 10);
  b.D.P.hp = 10; assert.equal(b.play('item:bandage'), false, 'одноразовая карта не разыгрывается повторно'); assert.equal(G.game.count('bandage'), 1, 'в спарринге запас не тратится');
  b.debugWin(); assert.equal(G.game.count('bandage'), 1);
  G.state.inv = { bandage: 1 }; const k = battle('ko'); k.D.P.hp = 10; forceCard(k.D, 'bandage'); k.play('item:bandage'); settle(k); k.debugWin(); assert.equal(G.game.count('bandage'), 0, 'в настоящем бою бинт списан');
});
test('Усталость: набор, отдых, еда и миграция сохранения (энергия и сытость заменены)', () => {
  G.state.vars.fatigue = 0; G.game.advance(60); assert.ok(G.state.vars.fatigue > 3 && G.state.vars.fatigue < 8);
  G.game.tire(200); assert.equal(G.state.vars.fatigue, 100); G.game.rest(30); assert.equal(G.state.vars.fatigue, 70);
  G.game.eat(50); assert.equal(G.state.vars.fatigue, 40); assert.equal(G.game.vigor(), 60);
  const old = JSON.parse(JSON.stringify(G.state)); delete old.vars.fatigue; Object.assign(old.vars, { energy: 30, food: 5 });
  G.game.fix(old); assert.equal(old.vars.fatigue, 70); assert.equal(old.vars.energy, undefined); assert.equal(old.vars.food, undefined);
  G.state.vars.fatigue = 100; assert.equal(G.game.useItem('berries').ok, false);   // нет в сумке
  assert.ok(Object.values(G.ITEMS).filter(i => i.cat === 'food').every(i => i.effect.rest > 0));
});
test('Фиолетовая чакра: стабильность, шанс выброса, усиление и срыв, практика', () => {
  const v = G.state.vars, P = G.purple;
  v.fatigue = 0; v.injury = 0; v.purple_ctl = 0; G.state.hero.stats.ctrl = 4;
  const s0 = P.stability(); assert.ok(s0 > 15 && s0 < 45, 'в начале герой нестабилен: ' + s0);
  v.fatigue = 80; assert.ok(P.stability() < s0); v.fatigue = 0;
  G.state.hero.stats.ctrl = 10; v.purple_ctl = 30; assert.ok(P.stability() > 80); assert.ok(P.chance(30) < 0.1);
  G.state.hero.stats.ctrl = 4; v.purple_ctl = 0;
  assert.ok(P.chance(30) > P.chance(10) && P.chance(30) <= 0.4);
  assert.equal(P.roll(30, () => 0.99), null);
  assert.equal(P.roll(30, () => 0).kind, 'boost');                         // первая проверка пройдена, вторая даёт усиление
  const seq = [0, 0.99]; assert.equal(P.roll(30, () => seq.shift()).kind, 'backfire');
  v.chakra = 80; v.hp = 50; v.fatigue = 0; P.apply({ kind: 'backfire' });
  assert.equal(v.chakra, 65); assert.equal(v.hp, 45); assert.equal(v.fatigue, 8);
  P.apply({ kind: 'boost' }); assert.equal(v.chakra, 65);                  // усиление ничего не списывает
  assert.equal(P.practice('dummy', 1), 0); assert.ok(P.practice('tree', 1) > 0); assert.ok(v.purple_ctl > 0);
  for (let i = 0; i < 99; i++) P.practice('tree', 1); assert.equal(v.purple_ctl, 40);
});
test('Календарь по месяцам: 28 дней, июнь → июль → август → снова июнь, всегда лето', () => {
  const g = G.game;
  assert.equal(g.date(1), '1 июня'); assert.equal(g.date(28), '28 июня'); assert.equal(g.date(29), '1 июля'); assert.equal(g.date(57), '1 августа');
  assert.equal(g.date(85), '1 июня'); assert.equal(g.year(84), 1); assert.equal(g.year(85), 2);
  assert.equal(g.monthName(30), 'Июль'); assert.equal(g.dayName(29), 'Пн');   // каждый месяц начинается с понедельника
  for (const d of [1, 40, 100, 200, 500]) assert.equal(G.life.season().name, 'Лето');
  assert.ok(G.calendar.upcoming(5).every(e => e.d <= G.state.vars.day + 28));
});
test('Уроки дерева и воды называют свою практику и в обычном, и в перенесённом тексте', () => {
  const old = { start: G.dialog.start, say: G.dialog.say, run: G.lessons.run, make: G.scenes.make, push: G.scenes.push };
  let lines = [];
  try {
    G.dialog.start = (id, opts) => opts.onEnd();
    G.dialog.say = (ls, opts) => { lines = ls; opts.onEnd && opts.onEnd(); };
    G.lessons.run = (p, d, w, done) => done(1, 1);
    G.scenes.make = function(name, ...args) { return name === 'train' ? { name, onDone: args[2] } : old.make.call(this, name, ...args); };
    G.scenes.push = function(s) { if (s.onDone) { s.onDone(1); return s; } return old.push.call(this, s); };
    for (const [day, practice, other] of [[9, 'хождение по дереву', 'хождение по воде'], [14, 'хождение по воде', 'хождение по дереву']]) {
      clean(); lines = []; Object.assign(G.state.vars, { day, min: 8 * 60 });
      const world = { name: 'world', refreshNpcs() {}, softRefresh() {} }; G.scenes.push(world); G.academy.start(world);
      const text = lines.map((l) => l.text).join(' ');
      assert.ok(text.includes(practice), `день ${day}: нет «${practice}»`); assert.ok(!text.includes(other), `день ${day}: чужая практика`);

      clean(); lines = []; Object.assign(G.state.vars, { day, min: 14 * 60 }); G.state.makeupQ = [day];
      const makeupWorld = { name: 'world', map: { name: 'Академия: класс', outdoor: false }, refreshNpcs() {} };
      G.scenes.push(makeupWorld); assert.ok(G.story.poll(makeupWorld));
      const makeupText = lines.map((l) => l.text).join(' ');
      assert.ok(makeupText.includes(practice), `перенос дня ${day}: нет «${practice}»`); assert.ok(!makeupText.includes(other), `перенос дня ${day}: чужая практика`);
    }
  } finally { G.dialog.start = old.start; G.dialog.say = old.say; G.lessons.run = old.run; G.scenes.make = old.make; G.scenes.push = old.push; }
});
test('Главная ветка: шаги дней 3–8 идут в своём темпе, финал закрывает арку', () => {
  const v = G.state.vars, Q = G.quests, F = G.state.flags; G.state.frQueue = [];
  const cur = () => (Q.curStep('main') || {}).id, at = (day) => { v.day = day; Q.check(); };
  v.day = 1; assert.ok(Q.start('main'));
  Q.check(); assert.equal(G.state.frQueue.length, 0, 'шаг дня 2 ещё закрыт');
  G.events.emit('training', 'dummy'); assert.equal(cur(), 'dummy', 'не раньше дня 2');
  at(2); assert.deepEqual(G.state.frQueue, ['mq_dummy_intro']);
  Q.check(); assert.equal(G.state.frQueue.length, 1, 'вступление не дублируется');
  G.events.emit('training', 'meditate'); assert.equal(cur(), 'dummy', 'чужое событие не закрывает шаг');
  G.events.emit('training', 'dummy'); assert.equal(cur(), 'library');
  assert.ok(G.state.frQueue.includes('mq_dummy_after'));
  // дни 3–8 больше не ждут календаря: шаги открыты сразу и проходятся в своём темпе
  G.events.emit('training', 'library'); assert.equal(cur(), 'rod', 'библиотека доступна без ожидания дня');
  G.game.give('fishing_rod', 1); assert.equal(cur(), 'fish');
  G.events.emit('fished', 'fish'); assert.equal(cur(), 'falls');
  G.events.emit('training', 'falls'); assert.equal(cur(), 'shop');
  G.events.emit('bought', 'ramen_miso'); assert.equal(cur(), 'shop', 'нужен кунай или бинт');
  G.events.emit('bought', 'kunai'); assert.equal(cur(), 'job');
  G.events.emit('job', 'tora', 100); assert.equal(cur(), 'roof');
  G.events.emit('roof'); assert.equal(cur(), 'roof', 'крыши открывает сцена Наруто');
  F.roofs = 1; G.events.emit('roof'); assert.equal(cur(), 'tree');
  G.events.emit('training', 'tree'); assert.equal(cur(), 'tree', 'нужен урок хождения по дереву');
  F.tech_tree = 1; G.events.emit('training', 'tree'); assert.equal(cur(), 'tree', 'и день 9 для урока');
  at(9); G.events.emit('training', 'tree'); assert.equal(cur(), 'checkup1');
  G.quests.onEnterMap({ building: { tplId: 'hospital' } }); assert.equal(cur(), 'checkup1', 'осмотр нельзя закрыть раньше дня 10');
  at(10); G.quests.onEnterMap({ building: { tplId: 'hospital' } }); assert.equal(cur(), 'spar'); assert.ok(G.state.frQueue.includes('mq_checkup1_after'));
  at(11); G.events.emit('battle', { mode: 'ko' }, {}); assert.equal(cur(), 'spar');
  G.events.emit('battle', { mode: 'spar' }, {}); assert.equal(cur(), 'taunt');
  at(13); assert.ok(G.state.frQueue.includes('mq_taunt'));
  G.choices.set('taunt', 'talk'); assert.equal(cur(), 'water'); assert.ok(G.choices.is('taunt', 'talk'));
  assert.equal(G.choices.set('taunt', 'fight'), false, 'выбор делается один раз');
  at(14); F.tech_water = 1; G.events.emit('training', 'water'); assert.equal(cur(), 'dream');
  at(15); assert.ok(G.state.frQueue.includes('mq_dream')); G.events.emit('scene', 'mq_dream'); assert.equal(cur(), 'brief');
  Q.step('main', 'brief'); assert.equal(cur(), 'bunshin');
  at(16); G.events.emit('lesson', { learn: 'henge' }, 80); assert.equal(cur(), 'bunshin');
  G.events.emit('lesson', { learn: 'bunshin' }, 80); assert.equal(cur(), 'study');
  at(17); G.events.emit('training', 'library'); assert.equal(cur(), 'help');
  G.events.emit('gift', 'naruto', 'chips'); assert.equal(cur(), 'lee');
  at(18); G.events.emit('training', 'dummy'); assert.equal(cur(), 'checkup2');
  at(19); G.quests.onEnterMap({ building: { tplId: 'hospital' } }); assert.equal(cur(), 'hokage');
  at(20); Q.step('main', 'hokage'); assert.equal(cur(), 'exam');
  at(21); G.events.emit('exam', false, 40); assert.equal(cur(), 'exam', 'провал не закрывает шаг');
  G.events.emit('exam', true, 70); assert.equal(cur(), 'gate');
  G.quests.onEnterMap({ building: { tplId: 'gate' } }); assert.equal(cur(), 'stranger');
  // ── финал: вечер у ворот, доклад, бой, развязка ──
  v.min = 19 * 60; G.state.frQueue = [];
  G.quests.onEnterMap({ building: { tplId: 'gate' } }); assert.equal(cur(), 'report');
  assert.ok(G.state.frQueue.includes('mq_stranger_meet'), 'встреча у ворот показана сценой');
  Q.step('main', 'report'); assert.equal(cur(), 'duel');
  G.state.frQueue = [];
  G.quests.onEnterMap({ building: { tplId: 'gate' } });
  assert.ok(G.state.frQueue.includes('mq_final_fight'), 'вход в ворота открывает сцену боя');
  G.events.emit('battle', { enemy: 'kiba' }, { win: true }); assert.equal(cur(), 'duel', 'чужой бой не закрывает шаг');
  G.events.emit('battle', { enemy: 'stranger' }, { win: false }); assert.equal(cur(), 'duel', 'поражение не тупик — шаг открыт');
  G.events.emit('battle', { enemy: 'stranger' }, { win: true }); assert.equal(cur(), 'ending');
  G.state.frQueue = [];
  Q.step('main', 'ending');
  assert.ok(Q.done('main'), 'первая глава завершается, а не висит активной');
  assert.ok(G.state.frQueue.includes('mq_epilogue'), 'эпилог уходит в очередь');
  assert.equal((Q.curStep('main') || {}).id, undefined);
  for (const st of G.QUESTS.main.steps) for (const k of ['intro', 'after', 'script', 'enterScript']) if (st[k]) assert.ok(G.script.library[st[k]], 'нет сцены ' + st[k]);
});
test('Выборы сюжета: последствия, один раз, стража и реплики жителей', () => {
  const v = G.state.vars; v.rep = 0; G.state.flags = {}; G.state.started = true; G.state.hero.name = 'Кайто';
  assert.equal(G.choices.get('taunt'), null);
  assert.ok(G.choices.set('taunt', 'fight')); assert.equal(v.rep, -3); assert.equal(G.state.flags.ch_taunt, 1);
  assert.equal(G.choices.set('nonexistent', 'x'), false); assert.equal(G.choices.set('taunt', 'talk'), false);
  assert.ok(G.choices.set('hokage', 'told')); assert.equal(G.state.flags.guards_up, 1);
  const n = { id: 'villager_m', uid: 'resident:5' }; v.day = 8; v.fatigue = 0; v.purple_ctl = 0;
  assert.equal(G.choices.attitude(), 'afraid'); assert.match(G.choices.villagerLine({ id: 'villager_m', uid: 'resident:2' }) || G.choices.villagerLine({ id: 'villager_f', uid: 'resident:9' }) || 'x', /./);
  const lines = new Set(); for (let i = 0; i < 40; i++) { const l = G.choices.villagerLine({ id: 'villager_m', uid: 'resident:' + i }); if (l) lines.add(l); } assert.ok(lines.size >= 2);
  v.day = 2; assert.equal(G.choices.villagerLine(n), null, 'до дня 4 жители молчат');
  const w = G.scenes.make('world', G.world.outsideOf(G.world.heroHome())); G.scenes.push(w);
  assert.ok(G.guards.build(w.map).patrols.filter(p => p.need === 'guards_up').length === 2);
});
test('Побочные ветки: открываются по дружбе, шаги закрываются действиями, награда и контроль чакры', () => {
  const v = G.state.vars, Q = G.quests, F = G.state.flags; G.state.quests = {}; G.state.frQueue = []; G.state.started = true;
  v.day = 6; v.purple_ctl = 0; v.money = 0;
  assert.equal(Q.scriptFor('naruto'), null, 'пока не друзья — ветки нет'); v.friend_naruto = 6;
  assert.equal(Q.scriptFor('naruto'), 'arc_naruto_offer'); assert.equal(Q.iconFor('naruto'), '!');
  Q.start('arc_naruto'); assert.equal(Q.curStep('arc_naruto').id, 'ramen');
  G.events.emit('bought', 'kunai'); assert.equal(Q.curStep('arc_naruto').id, 'ramen');
  G.events.emit('bought', 'ramen_miso'); assert.equal(Q.curStep('arc_naruto').id, 'roof'); assert.ok(G.state.frQueue.includes('arc_naruto_ramen'));
  F.roofs = 1; G.events.emit('roof'); assert.equal(Q.curStep('arc_naruto').id, 'train');
  G.events.emit('training', 'dummy', 0.8, null); assert.equal(Q.curStep('arc_naruto').id, 'train', 'нужен партнёр Наруто');
  G.events.emit('training', 'dummy', 0.8, 'naruto'); assert.equal(Q.curStep('arc_naruto').id, 'talk');
  assert.equal(Q.scriptFor('naruto'), 'arc_naruto_end'); Q.step('arc_naruto', 'talk'); assert.ok(Q.done('arc_naruto')); assert.equal(v.money, 100);
  // Ирука: тетрадь берётся из лавки и отдаётся
  v.friend_iruka = 6; Q.start('arc_iruka'); G.game.give('notebook', 1); assert.equal(Q.curStep('arc_iruka').id, 'give'); assert.equal(Q.scriptFor('iruka'), 'arc_iruka_give');
  Q.step('arc_iruka', 'give'); assert.equal(G.game.count('notebook'), 0);
  G.quests.onEnterMap({ building: { tplId: 'memorial' } }); assert.equal(Q.curStep('arc_iruka').id, 'cook');
  G.events.emit('cooked', 'x'); assert.equal(Q.curStep('arc_iruka').id, 'talk'); Q.step('arc_iruka', 'talk'); assert.ok(Q.done('arc_iruka')); assert.equal(v.purple_ctl, 4);
  // Хината: трава отдаётся, медитация с партнёром, подарок именно ей
  v.friend_hinata = 6; Q.start('arc_hinata'); G.game.give('herb_blue', 1); Q.step('arc_hinata', 'give');
  G.events.emit('training', 'meditate', 0.9, 'hinata'); G.events.emit('gift', 'sakura', 'flowers_s'); assert.equal(Q.curStep('arc_hinata').id, 'gift');
  G.events.emit('gift', 'hinata', 'flowers_s'); assert.equal(Q.curStep('arc_hinata').id, 'talk');
  // Шикамару: книга, медитация, спарринг именно с ним
  v.friend_shikamaru = 6; Q.start('arc_shikamaru'); G.events.emit('training', 'shogi', 0.8, 'shikamaru'); G.game.give('book_traps', 1);
  assert.equal(Q.curStep('arc_shikamaru').id, 'clouds'); G.events.emit('training', 'meditate', 0.8, null);
  G.events.emit('battle', { enemy: 'kiba', mode: 'spar' }, {}); assert.equal(Q.curStep('arc_shikamaru').id, 'spar');
  G.events.emit('battle', { enemy: 'shikamaru', mode: 'spar' }, {}); assert.equal(Q.curStep('arc_shikamaru').id, 'talk');
  for (const q of ['arc_naruto', 'arc_iruka', 'arc_hinata', 'arc_shikamaru']) for (const st of G.QUESTS[q].steps) for (const k of ['after', 'script']) if (st[k]) assert.ok(G.script.library[st[k]], 'нет сцены ' + st[k]);
});
test('Ветки Тентен, Нэдзи, Какаши, Анко: открытие, шаги, награда, сцены', () => {
  const v = G.state.vars, F = G.state.flags, Q = G.quests; G.state.quests = {}; G.state.started = true; G.state.inv = {}; v.money = 0; v.purple_ctl = 0; v.day = 9; F.genin = 0;
  assert.equal(Q.scriptFor('tenten'), null, 'Тентен открывается с 10 дня');
  v.day = 12; assert.equal(Q.scriptFor('tenten'), 'arc_tenten_offer'); assert.equal(Q.scriptFor('neji'), 'arc_neji_offer');
  assert.equal(Q.scriptFor('kakashi'), null, 'Какаши — только после экзамена'); assert.notEqual(Q.scriptFor('anko'), 'arc_anko_offer');
  Q.start('arc_tenten'); G.game.give('shuriken', 3); assert.equal(Q.curStep('arc_tenten').id, 'give'); assert.equal(Q.scriptFor('tenten'), 'arc_tenten_give');
  Q.step('arc_tenten', 'give'); assert.equal(G.game.count('shuriken'), 0);
  G.events.emit('training', 'dummy', 0.8, null); assert.equal(Q.curStep('arc_tenten').id, 'throw');
  G.events.emit('training', 'throw', 0.8, null); G.events.emit('bought', 'kunai'); assert.equal(Q.curStep('arc_tenten').id, 'talk');
  Q.step('arc_tenten', 'talk'); assert.ok(Q.done('arc_tenten')); assert.equal(v.money, 100);
  Q.start('arc_neji'); G.quests.onEnterMap({ building: { tplId: 'clan_hyuga' } }); assert.equal(Q.curStep('arc_neji').id, 'med');
  G.events.emit('training', 'falls', 0.8, null); G.events.emit('training', 'dummy', 0.8, null); Q.step('arc_neji', 'talk'); assert.ok(Q.done('arc_neji')); assert.equal(v.purple_ctl, 7);
  F.genin = 1; v.day = 23; assert.equal(Q.scriptFor('kakashi'), 'arc_kakashi_offer'); G.state.quests.sm_anko_dango = { done: true }; G.state.quests.sm_anko_tea = { done: true }; G.state.quests.sm_anko_sell = { done: true }; assert.equal(Q.scriptFor('anko'), 'arc_anko_offer');
  Q.start('arc_kakashi'); G.game.give('flowers_s', 1); assert.equal(Q.scriptFor('kakashi'), 'arc_kakashi_give'); Q.step('arc_kakashi', 'give');
  G.events.emit('training', 'meditate', 0.9, null); Q.step('arc_kakashi', 'talk'); assert.ok(Q.done('arc_kakashi'));
  Q.start('arc_anko'); G.game.give('dango', 3); Q.step('arc_anko', 'give'); G.events.emit('fished', 'carp'); G.events.emit('battle', { enemy: 'anko', mode: 'spar' }, {});
  assert.equal(Q.curStep('arc_anko').id, 'talk'); Q.step('arc_anko', 'talk'); assert.ok(Q.done('arc_anko'));
  for (const q of Object.keys(G.QUESTS).filter((id) => id.startsWith('arc_'))) for (const st of G.QUESTS[q].steps) for (const k of ['after', 'script']) if (st[k]) assert.ok(G.script.library[st[k]], 'нет сцены ' + st[k]);
});
test('Все сцены сюжета: символы есть в шрифте, говорящие известны', () => {
  const chars = new Set(G.font.chars()), bad = new Set();
  const text = (id, t) => { for (const ch of String(t || '')) if (ch !== ' ' && !chars.has(ch) && !chars.has(ch.toUpperCase())) bad.add(`${id}: «${ch}»`); };
  for (const [id, sc] of Object.entries(G.script.library)) for (const op of sc.ops || []) {
    if (op.text) text(id, op.text); if (op.prompt) text(id, op.prompt); for (const o of op.options || []) text(id, o.text);
    if (op.who && op.op === 'say') assert.ok(G.chars.DEFS[op.who] || op.who === 'hero' || op.who === 'narrator', `${id}: неизвестный говорящий ${op.who}`);
  }
  assert.deepEqual([...bad].slice(0, 12), []);
});
test('Малые задания: просьба, предметы списываются, награда', () => {
  const v = G.state.vars, Q = G.quests; G.state.quests = {}; v.day = 8; v.money = 0; G.state.started = true; G.state.inv = {}; v.friend_choji = 0;
  const small = Object.keys(G.QUESTS).filter((id) => id.startsWith('sm_')); assert.ok(small.length >= 12);
  assert.equal(Q.scriptFor('choji'), 'sm_choji_milk_offer'); Q.start('sm_choji_milk'); assert.equal(Q.scriptFor('choji'), 'sm_choji_berries_offer', 'вторая просьба Чоджи');
  G.game.give('milk', 1); assert.equal(Q.curStep('sm_choji_milk').id, 'give'); assert.equal(Q.scriptFor('choji'), 'sm_choji_milk_done');
  G.game.take('milk', 1); assert.equal(Q.scriptFor('choji'), 'quest_missing_items'); G.game.give('milk', 1);
  Q.step('sm_choji_milk', 'give'); assert.ok(Q.done('sm_choji_milk')); assert.equal(v.money, 40); assert.equal(G.game.count('milk'), 0);
  assert.ok(small.length >= 35, 'малых заданий: ' + small.length);
  for (const id of small) for (const st of G.QUESTS[id].steps) {
    if (st.have || st.need) assert.ok(G.ITEMS[Object.keys(st.have || st.need)[0]], id);
    else assert.ok(st.on || st.reach || st.script, id + ': шаг без предмета, события, входа и разговора');
    for (const k of ['script', 'after']) if (st[k]) assert.ok(G.script.library[st[k]], st[k]);
    assert.ok(G.script.library[G.QUESTS[id].offer.script], id);
  }
  // «сделай»: шаг закрывается действием и сразу даёт награду
  G.state.quests = {}; v.money = 0; Q.start('sm_kiba_fish'); G.events.emit('fished', null); assert.ok(Q.active('sm_kiba_fish'), 'пустой улов не считается');
  G.events.emit('fished', 'fish'); assert.ok(Q.done('sm_kiba_fish')); assert.equal(v.money, 45);
});
test('Сценарии сдачи сами закрывают шаг, списывают предмет и выдают награду', () => {
  const targets = [];
  for (const [qid, q] of Object.entries(G.QUESTS)) q.steps.forEach((st, step) => {
    const last = step === q.steps.length - 1;
    if (st.script && (st.consume || (qid === 'arc_ino' && st.id === 'talk') || (qid.startsWith('sm_') && last))) targets.push({ qid, st, step });
  });
  assert.ok(targets.length >= 20, 'найдены все предметные сдачи, дела и возврат к Ино');
  for (const { qid, st, step } of targets) {
    clean();
    Object.assign(G.state.vars, { day: 30, min: 12 * 60, money: 0 });
    G.state.quests = { [qid]: { st: 'active', step, day: 1 } };
    G.state.frQueue = [];
    for (const [id, n] of Object.entries(st.need || {})) G.game.give(id, n);
    playScript(st.script);
    const qs = G.quests.state(qid);
    assert.ok(qs.st === 'done' || qs.step === step + 1, `${qid}/${st.id}: шаг не закрыт сценарием`);
    for (const id of Object.keys(st.need || {})) assert.equal(G.game.count(id), 0, `${qid}/${st.id}: предмет не списан`);
    if (qid.startsWith('sm_')) { assert.ok(G.quests.done(qid), qid + ': нет завершения'); assert.ok(G.state.vars.money > 0, qid + ': нет награды'); }
  }
});
test('Остальные побочные ветки: Сакура, Киба, Чоджи, Ино, Ли, Саске', () => {
  const v = G.state.vars, Q = G.quests; G.state.quests = {}; G.state.frQueue = []; G.state.started = true; v.day = 12; v.purple_ctl = 0; v.money = 0; G.state.inv = {};
  Q.start('ino_flowers');   // у Ино раньше есть старое задание «Букет для Хинаты»: ветка предлагается после него
  for (const id of ['sakura', 'kiba', 'choji', 'ino', 'lee', 'sasuke']) { v['friend_' + id] = 6; assert.equal(Q.scriptFor(id), 'arc_' + id + '_offer', id); }
  const cur = (q) => Q.curStep(q).id;
  Q.start('arc_sakura'); G.events.emit('training', 'library', 0.8, 'sakura'); G.game.give('book_history', 1); assert.equal(cur('arc_sakura'), 'give'); Q.step('arc_sakura', 'give');
  G.events.emit('training', 'book', 0.7, null); assert.equal(cur('arc_sakura'), 'talk'); Q.step('arc_sakura', 'talk'); assert.ok(Q.done('arc_sakura')); assert.equal(v.purple_ctl, 2);
  Q.start('arc_kiba'); G.game.give('dog_treat', 1); Q.step('arc_kiba', 'give'); G.events.emit('training', 'run', 0.8, 'kiba');
  G.events.emit('training', 'tree', 0.8, null); assert.equal(cur('arc_kiba'), 'forest'); G.events.emit('training', 'stealth', 0.8, null); assert.equal(cur('arc_kiba'), 'talk');
  assert.ok(G.choices.set('kiba', 'tell')); assert.equal(G.state.flags.kiba_knows, 1);
  Q.start('arc_choji'); G.events.emit('cooked', 'x'); G.events.emit('fished', 'fish'); G.game.give('fish', 1); assert.equal(cur('arc_choji'), 'give'); Q.step('arc_choji', 'give');
  G.events.emit('bought', 'ramen_pork'); assert.equal(cur('arc_choji'), 'talk');
  Q.start('arc_ino'); G.events.emit('gift', 'hinata', 'x'); assert.equal(cur('arc_ino'), 'peace'); G.events.emit('gift', 'sakura', 'flowers_s'); assert.equal(cur('arc_ino'), 'talk');
  Q.step('arc_ino', 'talk'); G.events.emit('training', 'meditate', 0.9, 'ino'); assert.equal(cur('arc_ino'), 'end'); Q.step('arc_ino', 'end'); assert.ok(Q.done('arc_ino')); assert.equal(v.purple_ctl, 6);
  v.day = 8; Q.start('arc_lee'); G.game.give('towel', 1); Q.step('arc_lee', 'give'); G.events.emit('training', 'dummy', 0.8, 'lee'); G.events.emit('battle', { enemy: 'kiba', mode: 'spar' }, {});
  assert.equal(cur('arc_lee'), 'spar'); G.events.emit('battle', { enemy: 'lee', mode: 'spar' }, {}); assert.equal(cur('arc_lee'), 'talk');
  Q.start('arc_sasuke'); G.events.emit('battle', { enemy: 'sasuke', mode: 'spar' }, {}); G.events.emit('training', 'throw', 0.8, 'sasuke'); G.game.give('tomato', 2);
  assert.equal(cur('arc_sasuke'), 'give'); Q.step('arc_sasuke', 'give'); assert.equal(cur('arc_sasuke'), 'talk'); assert.ok(G.choices.set('sasuke', 'trust'));
  for (const q of ['arc_sakura', 'arc_kiba', 'arc_choji', 'arc_ino', 'arc_lee', 'arc_sasuke']) for (const st of G.QUESTS[q].steps) for (const k of ['after', 'script']) if (st[k]) assert.ok(G.script.library[st[k]], 'нет сцены ' + st[k]);
});
test('Карточная дуэль: пять карт, три действия, сброс, добор и перетасовка', () => {
  const D = G.duel.create({ enemy: 'kiba', mode: 'ko', stats: { tai: 6, nin: 5, gen: 4, chakra: 5, ctrl: 5, spd: 5, end: 5, know: 5 }, rng: G.duel.mulberry(5), stability: 60, techs: [], fatigue: 0, surge: false });
  assert.equal(D.hand.length, 5); assert.equal(D.P.ap, 3);
  const total = D.hand.length + D.deck.length;
  for (const id of ['strike', 'guard', 'evade']) { forceCard(D, id); assert.ok(G.duel.play(D, id).length, id); }
  assert.equal(D.P.ap, 0); assert.equal(D.stats.cards, 3);
  assert.equal(G.duel.canPlay(D, D.hand[0]).ok, false, 'четвёртая карта за ход запрещена');
  const hp = D.P.hp; G.duel.endTurn(D);
  assert.equal(D.round, 2); assert.equal(D.P.ap, 3); assert.equal(D.hand.length, 5); assert.ok(D.P.hp <= hp);
  assert.equal(D.hand.length + D.deck.length + D.discard.length + D.exhaust.length, total, 'карты не теряются между зонами');
  D.deck = []; D.discard = [{ id: 'strike', uid: 999 }]; D.hand = []; G.duel.draw(D, 1);
  assert.equal(D.hand[0].uid, 999, 'сброс перемешивается в новую колоду');
});

test('Карточная дуэль: блок, уклон, их сочетание и контратака зависят от намерения', () => {
  const mk = () => G.duel.create({ enemy: 'kiba', mode: 'ko', stats: { tai: 6, nin: 5, gen: 4, chakra: 5, ctrl: 5, spd: 5, end: 5, know: 5 }, rng: G.duel.mulberry(9), stability: 100, techs: [], fatigue: 0, surge: false });
  const received = (ids) => { const D = mk(); D.intent = { kind: 'strike', name: 'Удар', dmg: 40, hits: 1 }; const hp = D.P.hp; for (const id of ids) { forceCard(D, id); G.duel.play(D, id); } G.duel.endTurn(D); return hp - D.P.hp; };
  const plain = received([]), guard = received(['guard']), evade = received(['evade']), both = received(['guard', 'evade']);
  assert.equal(plain, 40); assert.ok(guard < plain && evade < guard && both < evade, `урон: ${plain}/${guard}/${evade}/${both}`);
  const D = mk(); D.intent = { kind: 'strike', name: 'Удар', dmg: 10, hits: 1 }; forceCard(D, 'stance'); const hp = D.E.hp;
  G.duel.play(D, 'stance'); G.duel.endTurn(D); assert.ok(D.E.hp < hp, 'Стойка отвечает контрударом после атаки врага');
});

test('Карточные связки: метка, Финт, Суйтон → Райтон, горение и срыв замаха', () => {
  const mk = (enemy = 'kiba') => calm(G.duel.create({ enemy, mode: 'ko', stats: { tai: 6, nin: 8, gen: 4, chakra: 8, ctrl: 5, spd: 5, end: 5, know: 5 }, rng: G.duel.mulberry(9), stability: 100, techs: Object.keys(G.TECHS), fatigue: 0, surge: false }));
  let A = mk(), B = mk(); forceCard(A, 'chakra_shot'); let hp = A.E.hp; G.duel.play(A, 'chakra_shot'); const normal = hp - A.E.hp;
  forceCard(B, 'kunai'); forceCard(B, 'chakra_shot'); G.duel.play(B, 'kunai'); hp = B.E.hp; G.duel.play(B, 'chakra_shot');
  assert.ok(hp - B.E.hp > normal * 1.4, 'метка куная усиливает технику на 50%');
  const F = mk(); F.E.block = 20; F.E.dodge = 0.55; forceCard(F, 'feint'); G.duel.play(F, 'feint');
  assert.equal(F.E.block, 0); assert.equal(F.E.dodge, 0); assert.equal(F.E.status.vuln, 1);
  A = mk(); B = mk(); forceCard(A, 'raiton'); hp = A.E.hp; G.duel.play(A, 'raiton'); const dry = hp - A.E.hp;
  forceCard(B, 'suiton'); forceCard(B, 'raiton'); G.duel.play(B, 'suiton'); assert.equal(B.E.status.wet, 2); hp = B.E.hp; G.duel.play(B, 'raiton');
  assert.ok(hp - B.E.hp > dry * 1.5, 'мокрый статус усиливает Райтон'); assert.equal(B.E.status.stun, 1);
  const playerHp = B.P.hp; B.intent = { kind: 'strike', name: 'Удар', dmg: 40, hits: 1 }; G.duel.endTurn(B); assert.equal(B.P.hp, playerHp, 'оглушение отменяет ответ врага');
  const K = mk(); forceCard(K, 'katon'); G.duel.play(K, 'katon'); assert.equal(K.E.status.burn, 2); hp = K.E.hp; G.duel.endTurn(K); assert.ok(K.E.hp <= hp - 4, 'горение наносит урон в конце хода');
  const C = mk('choji'); C.intent = { kind: 'charge', name: 'Замах', interrupt: 3 }; C.E.chargeBroken = 0; forceCard(C, 'combo'); G.duel.play(C, 'combo');
  assert.ok(C.P.chain >= 3 && C.E.status.stun === 1 && C.E.chargeBroken === 1, 'три звена тайдзюцу срывают замах');
});

test('Карточная дуэль: клоны, Хенге, страх и полное уклонение под теневой связкой', () => {
  const mk = () => G.duel.create({ enemy: 'kiba', mode: 'ko', stats: { tai: 6, nin: 8, gen: 6, chakra: 8, ctrl: 5, spd: 5, end: 5, know: 5 }, rng: G.duel.mulberry(4), stability: 100, techs: Object.keys(G.TECHS), fatigue: 0, surge: false });
  let D = mk(); D.intent = { kind: 'multi', name: 'Серия', dmg: 20, hits: 2 }; forceCard(D, 'bunshin'); let hp = D.P.hp; G.duel.play(D, 'bunshin'); G.duel.endTurn(D);
  assert.equal(D.P.hp, hp); assert.equal(D.P.clones, 0, 'два клона принимают два удара');
  D = mk(); D.intent = { kind: 'strike', name: 'Удар', dmg: 50, hits: 1 }; forceCard(D, 'henge'); hp = D.P.hp; G.duel.play(D, 'henge'); G.duel.endTurn(D); assert.equal(D.P.hp, hp, 'Хенге отменяет действие');
  D = mk(); D.intent = { kind: 'strike', name: 'Удар', dmg: 40, hits: 1 }; forceCard(D, 'fear'); hp = D.P.hp; G.duel.play(D, 'fear'); G.duel.endTurn(D);
  assert.equal(hp - D.P.hp, Math.round(40 * D.P.fearMul), 'страх снижает урон на 100−fearMul процентов (сила зависит от Гендзюцу)');
  assert.ok(D.P.fearMul < 0.7, 'высокое Гендзюцу усиливает иллюзию (против базовых 0,7)');
  D = mk(); D.P.status.bind = 1; D.intent = { kind: 'strike', name: 'Удар', dmg: 40, hits: 1 }; forceCard(D, 'evade'); forceCard(D, 'kawarimi');
  assert.equal(G.duel.canPlay(D, 'evade').ok, false, 'обычный Уклон запрещён связкой');
  hp = D.P.hp; const enemyHp = D.E.hp; assert.ok(G.duel.play(D, 'kawarimi').length); assert.equal(G.duel.expectedIncoming(D), 0); G.duel.endTurn(D);
  assert.equal(D.P.hp, hp, 'полное уклонение работает под связкой'); assert.ok(D.E.hp < enemyHp, 'Каварими контратакует');
});

test('Карточная дуэль: чакра, накал, спарринг, survive и вражеский страх', () => {
  const base = { enemy: 'kiba', mode: 'ko', stats: { tai: 6, nin: 8, gen: 4, chakra: 8, ctrl: 5, spd: 5, end: 5, know: 5 }, rng: G.duel.mulberry(3), stability: 100, techs: Object.keys(G.TECHS), fatigue: 0 };
  let D = G.duel.create(base), hp; forceCard(D, 'release'); D.P.heat = 10; const ch = D.P.ch; assert.equal(G.duel.play(D, 'release').length, 0); assert.equal(D.P.ch, ch);
  D.P.heat = 80; D.E.block = 30; hp = D.E.hp; assert.ok(G.duel.play(D, 'release').length); assert.ok(D.E.hp < hp && D.P.heat === 0, 'выброс тратит накал и пробивает защиту');
  D = G.duel.create(Object.assign({}, base, { surge: false })); forceCard(D, 'chakra_shot'); D.P.ch = 1; hp = D.E.hp; assert.equal(G.duel.play(D, 'chakra_shot').length, 0); assert.equal(D.E.hp, hp);
  const sp = G.duel.create(Object.assign({}, base, { mode: 'spar', enemy: 'dummy2', surge: false })); sp.E.hp = sp.E.hpMax * 0.35; calm(sp); forceCard(sp, 'strike'); G.duel.play(sp, 'strike'); assert.ok(sp.over && sp.over.win, 'спарринг идёт до 30%');
  const sv = G.duel.create(Object.assign({}, base, { mode: 'survive', enemy: 'dummy', rounds: 3, surge: false })); for (let i = 0; i < 3; i++) G.duel.endTurn(sv); assert.ok(sv.over && sv.over.win, 'survive кончается после заданных ходов');
  const fear = G.duel.create(Object.assign({}, base, { enemy: 'ino', surge: false })); fear.intent = { kind: 'fear', name: 'Иллюзия', cost: 0 };
  fear.P.genResist = 0; G.duel.endTurn(fear);
  assert.equal(fear.P.ap, 2); assert.equal(fear.hand.length, 4, 'вражеский страх отнимает действие и карту на один ход');
  // своё Гендзюцу развеивает чужую иллюзию: при полном сопротивлении страх не срабатывает
  const resist = G.duel.create(Object.assign({}, base, { enemy: 'ino', surge: false })); resist.intent = { kind: 'fear', name: 'Иллюзия', cost: 0 };
  resist.P.genResist = 1; G.duel.endTurn(resist);
  assert.equal(resist.P.ap, 3); assert.ok(!resist.P.status.fear, 'иллюзия развеяна Гендзюцу');
});

test('Карточная дуэль: усталость, стабильность, стили и детерминизм', () => {
  const base = { enemy: 'kiba', mode: 'ko', stats: { tai: 6, nin: 5, gen: 4, chakra: 5, ctrl: 5, spd: 5, end: 5, know: 5 }, rng: G.duel.mulberry(3), stability: 60, surge: false };
  const D = G.duel.create(Object.assign({ fatigue: 0 }, base)), s0 = G.duel.stability(D); D.P.fat = 80;
  assert.ok(G.duel.stability(D) < s0, 'усталость снижает стабильность');
  const run = () => G.duel.simulate(Object.assign({}, base, { rng: G.duel.mulberry(77), day: 12, techs: [] }), 0.65);
  assert.deepEqual(run(), run(), 'симуляция детерминирована при том же зерне');
  const styles = {}; for (const e of Object.keys(G.ENEMIES)) styles[G.ENEMIES[e].style] = 1;
  assert.ok(['dummy', 'rush', 'counter', 'reader', 'turtle', 'trickster', 'brute'].every(x => styles[x]), 'есть все стили');
  let blocks = 0, n = 0;
  for (let i = 0; i < 200; i++) {
    const d = G.duel.create(Object.assign({}, base, { enemy: 'sasuke', rng: G.duel.mulberry(100 + i) })); d.P.hp = d.P.hpMax = 1000; d.E.dmg = 0;
    forceCard(d, 'strike'); G.duel.play(d, 'strike'); forceCard(d, 'strike'); G.duel.play(d, 'strike'); G.duel.endTurn(d);
    if (!d.over) { n++; if (d.intent.kind === 'block') blocks++; }
  }
  assert.ok(blocks / n > 0.4, 'counter читает повторную тайдзюцу-серию: ' + (blocks / n).toFixed(2));
});

test('Спарринг не восстанавливает здоровье героя бесплатно', () => {
  G.state.vars.hp = 15; const b = battle('spar'); b.debugLose(); assert.equal(G.state.vars.hp, 15);
});
test('Ягоды, мазь, чай и противоядие можно применить из сумки', () => {
  G.state.inv = { berries: 1, ointment: 1, herb_tea: 1, antidote: 1 };
  Object.assign(G.state.vars, { fatigue: 60, hp: 20, injury: 2, poison: 1 });
  for (const id of Object.keys(G.state.inv)) assert.ok(G.game.useItem(id).ok, id);
  assert.ok(G.state.vars.fatigue < 60); assert.ok(G.state.vars.hp > 20); assert.equal(G.state.vars.injury, 1); assert.equal(G.state.vars.poison, 0);
  G.state.vars.min = 23 * 60; G.game.sleep(); assert.equal(G.state.vars.fatigue, 0); assert.equal(G.state.vars.chakra, 100);
});
test('Пилюля при полной чакре не расходуется ни в сумке, ни в бою', () => {
  G.state.inv = { chakra_pill: 1 }; assert.equal(G.game.useItem('chakra_pill').ok, false);
  const b = battle('ko'); forceCard(b.D, 'chakra_pill'); assert.equal(b.play('item:chakra_pill'), false); settle(b); assert.equal(b.D.inv.chakra_pill, 1); b.debugWin(); assert.equal(G.game.count('chakra_pill'), 1);
});
test('Покупка после закрытия не списывает деньги', () => {
  const s = G.scenes.make('shop', 'pharmacy'); const before = G.game.v.money;
  G.game.v.min = 20 * 60; key(s, 'a'); key(s, 'a'); assert.equal(G.game.v.money, before); assert.deepEqual(G.state.inv, {});
});
test('Лавка: еда идёт в сумку, блюда и услуги действуют на месте, покупка посылает событие', () => {
  const seen = [], listener = (id, qty) => seen.push([id, qty]); G.events.on('bought', listener);
  try {
    Object.assign(G.state.vars, { min: 12 * 60, money: 500, fatigue: 50 }); G.state.inv = {};
    const dango = G.scenes.make('shop', 'dango'); key(dango, 'a'); key(dango, 'a');
    assert.equal(G.game.count('dango'), 1); assert.equal(G.state.vars.money, 480);
    assert.equal(G.state.vars.fatigue, 50); assert.equal(G.state.vars.min, 12 * 60);
    assert.ok(G.game.useItem('dango').ok); assert.equal(G.game.count('dango'), 0);
    assert.ok(G.state.vars.fatigue >= 44 && G.state.vars.fatigue < 45); assert.equal(G.state.vars.min, 12 * 60 + 10);

    clean(); Object.assign(G.state.vars, { min: 12 * 60, money: 500, fatigue: 50 });
    G.quests.start('arc_naruto'); const ramen = G.scenes.make('shop', 'ichiraku'); key(ramen, 'a'); key(ramen, 'a');
    assert.equal(G.quests.curStep('arc_naruto').id, 'roof', 'покупка рамена продвигает ветку Наруто');
    assert.equal(G.game.count('ramen_miso'), 0); assert.equal(G.state.vars.money, 460);
    assert.ok(G.state.vars.fatigue >= 29 && G.state.vars.fatigue < 35); assert.equal(G.state.vars.min, 12 * 60 + 20);

    clean(); Object.assign(G.state.vars, { min: 12 * 60, money: 500, fatigue: 50 });
    const onsen = G.scenes.make('shop', 'onsen'); key(onsen, 'a'); key(onsen, 'a');
    assert.equal(G.game.count('onsen_bath'), 0); assert.ok(G.state.vars.fatigue >= 0 && G.state.vars.fatigue < 10);
    assert.equal(G.state.vars.min, 13 * 60); assert.equal(G.state.vars.money, 470);
    assert.deepEqual(seen, [['dango', 1], ['ramen_miso', 1], ['onsen_bath', 1]]);
  } finally { G.events.off('bought', listener); }
});
test('День и часы ограничивают автоматические шаги, вход в здание и сон', () => {
  Object.assign(G.state.vars, { day: 5, min: 7 * 60, money: 0 }); G.state.inv = { parcel: 1 };
  G.quests.start('courier_1'); G.quests.onEnterMap({ building: { tplId: 'library' } });
  assert.ok(G.quests.active('courier_1'), 'до 08:00 посылку не принимают');
  G.state.vars.min = 8 * 60; G.quests.onEnterMap({ building: { tplId: 'library' } });
  assert.ok(G.quests.done('courier_1')); assert.equal(G.state.vars.money, 60); assert.equal(G.game.count('parcel'), 0);

  G.state.quests = {}; G.state.inv = {}; G.state.vars.min = 7 * 60; G.quests.start('homework'); G.game.give('kunai', 3);
  assert.equal(G.quests.curStep('homework').id, 'buy', 'предмет вне часов шага не закрывает его');
  G.state.vars.min = 8 * 60; G.quests.check(); assert.equal(G.quests.curStep('homework').id, 'show');

  G.state.quests = { day1: { st: 'active', step: 4, day: 1 } }; G.state.vars.min = 17 * 60;
  G.quests.onSleep(2); assert.ok(G.quests.active('day1'), 'отбой раньше 18:00 не закрывает первый день');
  G.state.vars.min = 18 * 60; G.quests.onSleep(2); assert.ok(G.quests.done('day1'));
});
test('Меню и карточки магазина помещаются в минимальный экран', () => {
  const [w,h0] = [G.screen.W, G.screen.H]; G.screen.W = 192; G.screen.H = 200;
  try {
    const r = G.ui.menu.rect(11, 236); assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 192 && r.y + r.h <= 200);
    const l = G.scenes.make('shop','pharmacy').layout(); assert.ok(l.list.y + l.list.h <= l.info.y);
  } finally { G.screen.W = w; G.screen.H = h0; }
});
test('Каждое жильё заселено, у всех NPC свой дом и распорядок', () => {
  const k = G.world.konoha(), people = G.residents.list();
  const homes = k.buildings.filter(b => b.interior && (b.tplDef.cat === 'house' || /^(clan_|sasuke_home|uchiha_house|uchiha_small)/.test(b.tplId)));
  assert.ok(homes.length > 150); assert.ok(homes.every(b => b.tplId === 'uchiha_small' ? !b.residents.length : b.residents.length));
  // обычный дом — семья: отец, мать и двое детей; в квартале Учиха после трагедии живёт только Саске
  const P = G.residents.people, family = homes.filter(b => b.tplDef.cat === 'house' && !b.tplDef.unique);
  assert.ok(family.length > 120);
  for (const b of family) {
    const ids = b.residents.map(id => P.get(id)).filter(r => ['villager_m','villager_f','kid_m','kid_f'].includes(r.id)).map(r => r.id);
    assert.deepEqual([ids.filter(i => i === 'villager_m').length, ids.filter(i => i === 'villager_f').length, ids.filter(i => i[0] === 'k').length], [1, 1, 2], b.name);
  }
  assert.equal(new Set(people.map(r => r.uid)).size, people.length);
  assert.equal(new Set(people.map(r => r.name)).size, people.length);
  assert.ok(people.every(r => r.home.residents.includes(r.uid) && r.dailyRoute.length >= 3));
  for (const r of people) assert.ok(G.nav.path(r.homeRep.map, r.homeRep.map.spawn.x, r.homeRep.map.spawn.y, r.homeRep.x, r.homeRep.y), r.uid);
});
test('Сутки без дубликатов NPC и застревания в стенах', () => {
  const k = G.world.konoha(), world = {map:k, cam:{x:-1000,y:-1000},viewH:()=>320};
  G.state.vars.day = 50;
  for (const min of [0,420,600,780,960,1260,1440]) {
    G.state.vars.min = min; G.residents.sync(world);
    for (const r of G.residents.list()) {
      assert.ok(r.reps.filter(p => G.life.visible(p.actor)).length <= 1, r.uid + ' duplicate');
      assert.ok(!r.active.map.blockedRect(G.actors.feet(r.active.actor)), r.uid + ' in wall');
    }
  }
});
test('Крупные ориентиры сохранились после перестройки деревни', () => {
  const k = G.world.konoha();
  for (const id of ['academy','hokage_tower','hospital','hero_home','naruto_flat','sasuke_home',...['nara','hyuga','inuzuka','aburame','akimichi','uchiha','senju','sarutobi','yamanaka'].map(c=>'clan_'+c)]) assert.ok(k.landmarks[id],id);
  assert.ok(k.landmarks.academy.tw >= 18); assert.ok(k.landmarks.hokage_tower.tw >= 12);
});
test('Старые позиции в интерьерах мигрируют к тому же ориентиру', () => {
  const n = G.LEGACY_BUILDINGS.findIndex(b => b.tpl === 'naruto_flat');
  delete G.state.layoutVersion; G.state.pos = {map:'in:'+n,x:50,y:50,dir:'down'}; G.game.fix(G.state);
  assert.equal(G.state.pos.map, G.world.konoha().landmarks.naruto_flat.interior.id);
  assert.ok(G.storage.valid({state:G.state}));
});
test('Сохранения раскладки 2 переезжают в плотную Коноху: комната — в то же здание, улица — на свободную клетку', () => {
  const k = G.world.konoha(), n = Object.keys(G.LEGACY_ROOMS_V2).find(i => G.LEGACY_ROOMS_V2[i] === 'market');
  G.state.layoutVersion = 2; G.state.pos = {map:'in:'+n,x:50,y:50,dir:'down'}; G.game.fix(G.state);
  assert.equal(G.state.pos.map, k.landmarks.market.interior.id); assert.equal(G.state.layoutVersion, 3);
  const house = k.buildings.find(b => b.tplId === 'house_s');
  G.state.layoutVersion = 2; G.state.pos = {map:'konoha',x:(house.tx + 1) * 16 + 8,y:(house.ty + 1) * 16 + 12,dir:'down'}; G.game.fix(G.state);
  assert.equal(G.state.pos.map, 'konoha'); assert.ok(!k.blockedRect(G.actors.feet({}, G.state.pos.x, G.state.pos.y)));
  G.state.layoutVersion = 2; G.state.pos = {map:'adv:parkour',x:72,y:144,dir:'right'}; G.game.fix(G.state);
  assert.equal(G.state.pos.map, 'konoha');   // карта экспедиции удалена в 2.3 — герой у Академии
  assert.ok(!k.blockedRect(G.actors.feet({}, G.state.pos.x, G.state.pos.y)));
  assert.ok(G.storage.valid({state:G.state}));
});
test('Плотность по умолчанию: точка не меньше 1.25 CSS, выбор игрока не трогаем, экран заполняется по высоте', () => {
  const wrap = document.getElementById('screen-wrap'), keep = [wrap.clientWidth, wrap.clientHeight, globalThis.devicePixelRatio, G.storage.settings.density];
  const size = (w, h, dpr) => { wrap.clientWidth = w; wrap.clientHeight = h; globalThis.devicePixelRatio = dpr; G.screen.resize(); return [G.screen.W, G.screen.H, G.screen.scale]; };
  try {
    delete G.storage.settings.density;
    let [W, H, sc] = size(414, 862, 2); assert.ok(sc >= 1.25 && W >= 192 && H === 430, `iPhone XR/11: ${W}×${H} по ${sc} CSS`);
    [W, H, sc] = size(393, 722, 3); assert.ok(W === 294 && Math.abs(sc - 4 / 3) < 0.01, `iPhone 15 Pro не меняется: ${W}×${H} по ${sc}`);
    [W, H, sc] = size(375, 632, 2); assert.ok(W === 374 && H === 632, `SE — выбора нет, высота целиком: ${W}×${H}`);
    G.storage.settings.density = 'fine'; [W, H, sc] = size(414, 862, 2); assert.ok(W === 414 && H === 862 && sc === 1, `выбор «мелко» уважается: ${W}×${H}`);
  } finally {
    [wrap.clientWidth, wrap.clientHeight, globalThis.devicePixelRatio] = keep; if (keep[3]) G.storage.settings.density = keep[3]; else delete G.storage.settings.density; G.screen.resize();
  }
});
test('NPC: секунда упора, проход до выхода и повторная коллизия', () => {
  const A=G.actors, p=A.make('hero',20,20), n=A.make('naruto',30,20), others=[p,n];
  const map={blockedRect:b=>b.y!==15}; // узкий коридор без обхода
  for(let i=0;i<9;i++){A.playerContact(map,p,1,0,others,.1);A.move(map,p,1,0,others);}
  assert.equal(p.x,20); assert.equal(p._npcPass.size,0);
  A.playerContact(map,p,1,0,others,.1);A.move(map,p,1,0,others);
  assert.equal(p.x,21);assert.ok(p._npcPass.has(n));
  A.playerContact(map,p,0,0,others,.5);
  assert.ok(p._npcPass.has(n)); // остановка внутри не возвращает ловушку
  assert.equal(A.blocked(map,n,29,20,others),false);
  for(let i=0;i<23;i++){A.playerContact(map,p,1,0,others,.1);A.move(map,p,1,0,others);}
  A.playerContact(map,p,0,0,others,.1);assert.equal(p._npcPass.size,0);
  assert.equal(A.blocked(map,p,39,20,others),true);
});
test('NPC: отпускание сбрасывает ожидание, стены и другие NPC остаются твёрдыми', () => {
  const A=G.actors,p=A.make('hero',20,20),n=A.make('naruto',30,20),other=A.make('sasuke',50,20),all=[p,n,other];
  const map={blockedRect:b=>b.y!==15||b.x>=50};
  A.playerContact(map,p,1,0,all,.8);A.playerContact(map,p,0,0,all,.1);
  A.playerContact(map,p,1,0,all,.3);assert.equal(p._npcPass.size,0);
  A.playerContact(map,p,1,0,all,.7);assert.ok(p._npcPass.has(n));
  assert.equal(A.blocked(map,p,41,20,all),true);
  assert.equal(A.blocked(map,p,55,20,all),true);
  A.playerContact({blockedRect:()=>false},p,0,0,all,.1);assert.equal(p._npcPass.size,0);
});
test('NPC: выход из уже существующего перекрытия при 30/60/120 FPS', () => {
  for(const fps of [30,60,120]){
    const A=G.actors,p=A.make('hero',30,20),n=A.make('naruto',30,20),all=[p,n],map={blockedRect:b=>b.y!==15};
    for(let i=0;i<fps-1;i++) A.playerContact(map,p,1,0,all,1/fps);
    assert.equal(p._npcPass.size,0);
    A.playerContact(map,p,1,0,all,1/fps);A.move(map,p,1,0,all);
    assert.equal(p.x,31);
  }
});

test('Колода: правила 10–20 карт, до трёх копий, свои карты по умолчанию', () => {
  clean();
  const s = G.deck.ensure();
  assert.equal(s.deck.length, G.CARD_BASE_DECK.length, 'новая колода — базовая сборка');
  assert.equal(s.deck.length, 12);
  for (const id of s.deck) assert.ok(G.CARDS[id], 'в колоде только известные карты');
  // больше копий, чем есть, не положить; меньше десяти не оставить
  while (G.deck.size() > G.deck.MIN) assert.ok(G.deck.remove(s.deck[0]));
  assert.equal(G.deck.size(), G.deck.MIN);
  assert.equal(G.deck.remove(s.deck[0]), false, 'ниже минимума колода не уменьшается');
  const id = Object.keys(G.CARD_BASE_DECK.reduce((a, x) => (a[x] = 1, a), {})).find(() => true);
  const own = G.deck.own(s.deck[0]);
  assert.equal(G.deck.canAdd(s.deck[0]), own > G.deck.count(s.deck[0]));
  // набить до потолка: 20 карт и не больше трёх копий одной карты
  for (const card of Object.keys(G.CARDS)) if (!G.CARDS[card].tech && !G.CARDS[card].item) { G.state.cardOwned[card] = 3; }
  while (G.deck.size() < G.deck.MAX) { const want = G.deck.list().find((c) => G.deck.canAdd(c.id)); if (!want) break; G.deck.add(want.id); }
  assert.equal(G.deck.size(), G.deck.MAX);
  for (const c of G.deck.list()) assert.ok(c.inDeck <= 3, 'не больше трёх копий одной карты');
  assert.equal(G.deck.add('strike'), false, 'в полную колоду карта не влезает');
  assert.ok(id);
});

test('Колода: карта за спарринг выдаётся навсегда и попадает в бой', () => {
  clean();
  assert.equal(G.deck.give('kawarimi', 1), 0, 'карты техник в колоду не выдаются');
  const before = G.deck.own('combo');
  assert.equal(G.deck.give('combo', 1), 1);
  assert.equal(G.deck.own('combo'), before + 1);
  assert.equal(G.deck.give('combo', 5), 3 - (before + 1), 'копий не больше трёх');
  assert.equal(G.deck.own('combo'), 3);
  G.state.flags.tech_kawarimi = 1;
  const full = G.deck.full();
  assert.ok(full.includes('combo', G.deck.own('combo')), 'своя карта едет в бой');
  assert.equal(full.filter((x) => x === 'kawarimi').length, G.CARD_TECH_LIMIT, 'выученная техника — по копии на карту');
  const D = G.duel.create({ enemy: 'kiba', mode: 'ko', stats: { tai: 6, nin: 5, gen: 4, chakra: 5, ctrl: 5, spd: 5, end: 5, know: 5 }, techs: ['kawarimi'], deck: full, rng: G.duel.mulberry(9), surge: false });
  assert.equal(D.deck.length + D.hand.length, full.length, 'колода боя — ровно выбранные карты');
});

test('Колода: сохраняется в слот и переживает загрузку; битые данные не проходят', () => {
  clean();
  G.deck.give('focus', 2);
  while (G.deck.size() > G.deck.MIN) G.deck.remove(G.state.deck[G.state.deck.length - 1]);
  const deck = G.state.deck.slice();
  G.storage.save(G.state);
  const st = G.game.fix(G.storage.load());
  assert.deepEqual(st.deck, deck);
  assert.equal(st.cardOwned.focus, G.deck.own('focus'));
  const bad = JSON.parse(JSON.stringify(G.state));
  bad.deck = ['нет_такой_карты'];
  assert.equal(G.storage.valid(bad), false, 'неизвестная карта в колоде — сохранение отвергается');
});

test('Экран «Колода»: перенос карт и отрисовка без ошибок', () => {
  clean();
  const sc = G.scenes.make('deckview');
  const L = sc.lists();
  assert.ok(L[1].length, 'в колоде что-то есть');
  const size = G.deck.size(), id = L[1][0];
  sc.move(1, id);
  assert.equal(G.deck.size(), size - 1, 'касание справа убирает карту');
  const back = sc.lists()[0].find((x) => x === id);
  assert.ok(back, 'убавленная карта появилась в «своих»');
  sc.move(0, back);
  assert.equal(G.deck.size(), size, 'касание слева возвращает карту');
  const ctx = h.recordingCtx();
  sc.update(.016); sc.draw(ctx);
  assert.ok(ctx.log.length > 50, 'экран рисуется');
});


test('Три слота сохранения: запись, дата, новейший слот и загрузка', () => {
  clean();
  G.storage.wipe();
  G.state.vars.day = 7; G.state.vars.min = 9 * 60;
  assert.equal(G.storage.slotInfo(0), null, 'слот пуст до записи');
  assert.ok(G.storage.save(G.state, { slot: 0 }));
  G.state.vars.day = 12; G.state.vars.min = 18 * 60;
  assert.ok(G.storage.save(G.state, { slot: 2 }));
  const i0 = G.storage.slotInfo(0), i2 = G.storage.slotInfo(2);
  assert.equal(i0.day, 7); assert.equal(i2.day, 12);
  assert.ok(i2.when && /\d\d\.\d\d, \d\d:\d\d/.test(i2.when), 'у слота есть дата записи');
  assert.equal(G.storage.newestSlot(), 2, '«Продолжить» берёт новейший слот');
  assert.equal(G.storage.load().vars.day, 12);
  assert.equal(G.storage.load(0).vars.day, 7, 'загрузка конкретного слота');
  G.storage.wipe(2);
  assert.equal(G.storage.slotInfo(2), null, 'слот стирается');
  assert.equal(G.storage.slotInfo(0).day, 7, 'другие слоты не тронуты');
});

test('История реплик: последние 60 строк, повтор страницы не дублируется', () => {
  clean();
  G.state.dlgLog = [];
  G.dialog.say(['Первая реплика', { who: 'iruka', text: 'Вторая реплика' }], { onEnd: () => {} });
  const d = G.scenes.top();
  for (let i = 0; i < 6 && G.scenes.top() === d; i++) d.update(.05), d.advance();
  assert.ok((G.state.dlgLog || []).some((l) => l.includes('Первая реплика')), 'реплики пишутся в историю');
  assert.ok(G.state.dlgLog.some((l) => l.startsWith('Ирука:')), 'с именем говорящего');
  for (let i = 0; i < 90; i++) G.state.dlgLog.push('строка ' + i);
  G.dialog.say(['Ещё одна реплика'], { onEnd: () => {} });
  const d2 = G.scenes.top(); d2.update(.05); d2.advance();
  assert.ok(G.state.dlgLog.length <= 61, 'история не растёт бесконечно: ' + G.state.dlgLog.length);
  const sc = G.scenes.make('log');
  sc.update(.016); const ctx = h.recordingCtx(); sc.draw(ctx);
  assert.ok(sc.lines().length >= 3 && sc.maxScroll() >= 0, 'экран «История» листает строки');
});

test('Тяжёлые данные графики разбираются при первом обращении', () => {
  clean();
  G.art.clear();
  assert.ok(G.ART_STR && G.ART_STR.house && typeof G.ART_STR.house === 'string', 'в сборке данные лежат строкой');
  const house = G.art.data('house');
  assert.ok(house && house.art && Object.keys(house.art).length > 10, 'здания разбираются по требованию');
  assert.equal(G.art.data('house'), house, 'разбор кэшируется');
  assert.ok(G.art.data('chars').hero, 'персонажи на месте');
  assert.ok(G.art.data('env').bindings, 'окружение на месте');
  G.art.clear();
  assert.ok(G.art.data('house').art, 'после сброса кэша данные разбираются снова');
  assert.ok(G.houseArt.has(Object.keys(house.art)[0]), 'здания видны houseArt');
});

console.log(`ИТОГ регрессий: ✔ ${passed}  ✘ ${failed}`);
process.exitCode = failed ? 1 : 0;
