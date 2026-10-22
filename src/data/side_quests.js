// Большие побочные ветки: одна история на персонажа (4–5 шагов), открываются по дружбе. Категория «friend».
// Формат шагов — как у главной ветки (data/main_quest.js). Сцены — data/side_story.js. Порядок приоритета и идеи — docs/STORY.md.
const _lvl = (id, n) => () => G.state.started && G.friends.level(id) >= n;
const _partner = (who, ...ids) => ['training', (id, score, partner) => partner === who && (!ids.length || ids.includes(id))];
Object.assign(G.QUESTS, {
  // ───────────── Наруто: «Первый друг» ─────────────
  arc_naruto: {
    cat: 'friend', title: 'Первый друг',
    desc: 'Наруто почти всегда один. Он первый принял тебя без страха. Пора ответить тем же.',
    offer: { npc: 'naruto', script: 'arc_naruto_offer', when: () => _lvl('naruto', 1)() && G.state.vars.day >= 3 },
    steps: [
      { id: 'ramen', text: 'Угостить Наруто рамэном в Ичираку', target: { building: 'ichiraku' }, on: ['bought', (id) => /^ramen_/.test(id)], after: 'arc_naruto_ramen' },
      { id: 'roof', text: 'Побегать с Наруто по крышам', target: { building: 'academy' }, on: ['roof'], when: () => !!G.state.flags.roofs, after: 'arc_naruto_roof' },
      { id: 'train', text: 'Потренироваться вместе с Наруто (меню общения)', target: { npc: 'naruto' }, on: _partner('naruto'), after: 'arc_naruto_train' },
      { id: 'talk', text: 'Поговорить с Наруто у качелей', target: { npc: 'naruto' }, script: 'arc_naruto_end' },
    ],
    reward: { money: 100, vars: { friend_naruto: 3 }, text: 'Первый настоящий друг' },
  },
  // ───────────── Ирука: «Прошлое наставника» ─────────────
  arc_iruka: {
    cat: 'friend', title: 'Прошлое наставника',
    desc: 'Ирука знает, каково быть чужим. Узнай, почему он так за тебя переживает.',
    offer: { npc: 'iruka', in: 'academy', script: 'arc_iruka_offer', when: () => _lvl('iruka', 1)() && G.state.vars.day >= 5 },
    steps: [
      { id: 'notebook', text: 'Купить Ируке тетрадь в книжной лавке', target: { building: 'books' }, have: { notebook: 1 } },
      { id: 'give', text: 'Отдать тетрадь Ируке в Академии', target: { npc: 'iruka', in: 'academy' }, need: { notebook: 1 }, consume: true, script: 'arc_iruka_give' },
      { id: 'memorial', text: 'Сходить к мемориалу', target: { building: 'memorial' }, reach: true, after: 'arc_iruka_memorial' },
      { id: 'cook', text: 'Приготовить обед на кухне (дома или в Ичираку)', target: { building: 'hero_home' }, on: ['cooked'], after: 'arc_iruka_cook' },
      { id: 'talk', text: 'Поговорить с Ирукой в Академии', target: { npc: 'iruka', in: 'academy' }, script: 'arc_iruka_end' },
    ],
    reward: { money: 120, vars: { friend_iruka: 3, purple_ctl: 4 }, text: 'Урок наставника: контроль чакры +4' },
  },
  // ───────────── Хината: «Дыхание» ─────────────
  arc_hinata: {
    cat: 'friend', title: 'Дыхание',
    desc: 'Хината знает, как успокаивать чакру. Попроси её научить тебя дышать ровно.',
    offer: { npc: 'hinata', script: 'arc_hinata_offer', when: () => _lvl('hinata', 1)() && G.state.vars.day >= 4 },
    steps: [
      { id: 'herb', text: 'Найти голубую траву для Хинаты (поляны за деревней и лес)', target: { building: 'pharmacy' }, have: { herb_blue: 1 } },
      { id: 'give', text: 'Отдать траву Хинате', target: { npc: 'hinata' }, need: { herb_blue: 1 }, consume: true, script: 'arc_hinata_give' },
      { id: 'meditate', text: 'Помедитировать вместе с Хинатой (меню общения)', target: { npc: 'hinata' }, on: _partner('hinata'), after: 'arc_hinata_med' },
      { id: 'gift', text: 'Подарить Хинате цветы или другой подарок', target: { npc: 'hinata' }, on: ['gift', (id) => id === 'hinata'], after: 'arc_hinata_gift' },
      { id: 'talk', text: 'Поговорить с Хинатой', target: { npc: 'hinata' }, script: 'arc_hinata_end' },
    ],
    reward: { money: 80, vars: { friend_hinata: 3, purple_ctl: 6 }, text: 'Дыхание Хьюга: контроль чакры +6' },
  },
  // ───────────── Шикамару: «Облака и тактика» ─────────────
  arc_shikamaru: {
    cat: 'friend', title: 'Облака и тактика',
    desc: 'Шикамару ленив, но видит на ходы вперёд. Может, и тебе пригодится его способ думать.',
    offer: { npc: 'shikamaru', in: 'academy', script: 'arc_shikamaru_offer', when: () => _lvl('shikamaru', 1)() && G.state.vars.day >= 4 },
    steps: [
      { id: 'shogi', text: 'Сыграть с Шикамару в шоги (меню общения)', target: { npc: 'shikamaru' }, on: _partner('shikamaru', 'shogi'), after: 'arc_shika_shogi' },
      { id: 'book', text: 'Купить книгу о ловушках в книжной лавке', target: { building: 'books' }, have: { book_traps: 1 } },
      { id: 'clouds', text: 'Помедитировать: Шикамару советует смотреть на облака', target: { building: 'training_ground' }, on: ['training', (id) => id === 'meditate' || id === 'falls'], after: 'arc_shika_clouds' },
      { id: 'spar', text: 'Провести спарринг с Шикамару', target: { npc: 'shikamaru' }, on: ['battle', (a) => a && a.enemy === 'shikamaru'], after: 'arc_shika_spar' },
      { id: 'talk', text: 'Поговорить с Шикамару', target: { npc: 'shikamaru' }, script: 'arc_shika_end' },
    ],
    reward: { money: 100, vars: { friend_shikamaru: 3, purple_ctl: 3 }, text: 'Тактика Шикамару' },
  },
});
