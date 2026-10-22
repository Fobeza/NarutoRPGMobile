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
function settle(b) { for (let i = 0; i < 600 && b.state !== 'menu'; i++) b.update(.1); }
function key(scene, name) {
  const old = G.input.pressed; G.input.pressed = b => b === name;
  try { scene.update(.016); } finally { G.input.pressed = old; }
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
  G.state.inv = { kunai: 3 }; const before = JSON.stringify(G.state); const b = battle();
  assert.ok(b.sim.press('throw', 'Кунай')); assert.equal(G.game.count('kunai'), 2);
  G.storage.save(G.state); const st = G.game.fix(G.storage.load());
  assert.deepEqual(st.inv, JSON.parse(before).inv); assert.equal(st.battleCheckpoint, null);
  assert.equal(st.vars.hp, 100);
});
test('Предметы проверяются повторно в момент сдачи квеста', () => {
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
test('В спарринге расходники конечны, запас вне боя сохраняется', () => {
  G.state.inv = { bandage: 1 }; const b = battle('spar'); b.P.hp = 10;
  assert.ok(b.sim.press('tool', 'Бинт')); settle(b); b.P.hp = 10;
  assert.equal(b.sim.press('tool', 'Бинт'), false); assert.equal(G.game.count('bandage'), 1);
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
test('Главная ветка: шаги по дням, закрываются событиями мира, сцены уходят в очередь', () => {
  const v = G.state.vars, Q = G.quests, F = G.state.flags; G.state.frQueue = [];
  const cur = () => Q.curStep('main').id, at = (day) => { v.day = day; Q.check(); };
  v.day = 1; assert.ok(Q.start('main'));
  Q.check(); assert.equal(G.state.frQueue.length, 0, 'шаг дня 2 ещё закрыт');
  G.events.emit('training', 'dummy'); assert.equal(cur(), 'dummy', 'не раньше дня 2');
  at(2); assert.deepEqual(G.state.frQueue, ['mq_dummy_intro']);
  Q.check(); assert.equal(G.state.frQueue.length, 1, 'вступление не дублируется');
  G.events.emit('training', 'meditate'); assert.equal(cur(), 'dummy', 'чужое событие не закрывает шаг');
  G.events.emit('training', 'dummy'); assert.equal(cur(), 'library');
  assert.ok(G.state.frQueue.includes('mq_dummy_after'));
  at(4); G.events.emit('training', 'library'); assert.equal(cur(), 'rod');
  G.game.give('fishing_rod', 1); assert.equal(cur(), 'fish');
  G.events.emit('fished', 'fish'); assert.equal(cur(), 'falls');
  at(5); G.events.emit('training', 'falls'); assert.equal(cur(), 'shop');
  G.events.emit('bought', 'ramen_miso'); assert.equal(cur(), 'shop', 'нужен кунай или бинт');
  at(6); G.events.emit('bought', 'kunai'); assert.equal(cur(), 'job');
  at(7); G.events.emit('job', 'tora', 100); assert.equal(cur(), 'roof');
  at(8); G.events.emit('roof'); assert.equal(cur(), 'roof', 'крыши открывает сцена Наруто');
  F.roofs = 1; G.events.emit('roof'); assert.equal(cur(), 'tree');
  at(9); G.events.emit('training', 'tree'); assert.equal(cur(), 'tree', 'нужен урок хождения по дереву');
  F.tech_tree = 1; G.events.emit('training', 'tree'); assert.equal(cur(), 'checkup1');
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
  G.quests.onEnterMap({ building: { tplId: 'gate' } }); assert.equal(cur(), 'more');
  at(99); assert.ok(Q.active('main'), 'ветка не завершается сама');
  for (const st of G.QUESTS.main.steps) for (const k of ['intro', 'after', 'script']) if (st[k]) assert.ok(G.script.library[st[k]], 'нет сцены ' + st[k]);
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
  const b = battle(); assert.equal(b.sim.press('tool', 'Пилюля'), false); assert.equal(G.game.count('chakra_pill'), 1);
});
test('На клетку противника нельзя потратить ловушку', () => {
  G.state.inv = { book_traps: 1, wire: 1 }; const b = battle(); b.E.pos = b.P.pos + 1;
  assert.equal(b.sim.press('tool', 'Ловушка-пров.'), false); assert.equal(G.game.count('wire'), 1);
});
test('Покупка после закрытия не списывает деньги', () => {
  const s = G.scenes.make('shop', 'pharmacy'); const before = G.game.v.money;
  G.game.v.min = 20 * 60; key(s, 'a'); assert.equal(G.game.v.money, before); assert.deepEqual(G.state.inv, {});
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
console.log(`ИТОГ регрессий: ✔ ${passed}  ✘ ${failed}`);
process.exitCode = failed ? 1 : 0;
