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

Object.assign(G.QUESTS, {
  // ───────────── Сакура: «Книги и конспекты» ─────────────
  arc_sakura: {
    cat: 'friend', title: 'Книги и конспекты',
    desc: 'Сакура учится лучше всех. Её способ учёбы может пригодиться тебе перед экзаменом.',
    offer: { npc: 'sakura', script: 'arc_sakura_offer', when: () => _lvl('sakura', 1)() && G.state.vars.day >= 4 },
    steps: [
      { id: 'library', text: 'Позаниматься с Сакурой (меню общения: тренировка)', target: { npc: 'sakura' }, on: _partner('sakura'), after: 'arc_sakura_study' },
      { id: 'book', text: 'Купить «Историю Конохи» в книжной лавке', target: { building: 'books' }, have: { book_history: 1 } },
      { id: 'give', text: 'Отдать книгу Сакуре', target: { npc: 'sakura' }, need: { book_history: 1 }, consume: true, script: 'arc_sakura_give' },
      { id: 'read', text: 'Прочитать что-нибудь самому: дома или в библиотеке', target: { building: 'library' }, on: ['training', (id) => id === 'library' || id === 'book'], after: 'arc_sakura_read' },
      { id: 'talk', text: 'Поговорить с Сакурой', target: { npc: 'sakura' }, script: 'arc_sakura_end' },
    ],
    reward: { money: 80, vars: { friend_sakura: 3, purple_ctl: 2 }, text: 'Способ учёбы Сакуры' },
  },
  // ───────────── Киба: «Следопыт» ─────────────
  arc_kiba: {
    cat: 'friend', title: 'Следопыт',
    desc: 'У Кибы и Акамару лучший нюх в классе. Они могут помочь понять, кто интересуется тобой.',
    offer: { npc: 'kiba', script: 'arc_kiba_offer', when: () => _lvl('kiba', 1)() && G.state.vars.day >= 4 },
    steps: [
      { id: 'treat', text: 'Купить лакомство для Акамару в лавке Инузука', target: { building: 'inuzuka_shop' }, have: { dog_treat: 1 } },
      { id: 'give', text: 'Отдать лакомство Кибе', target: { npc: 'kiba' }, need: { dog_treat: 1 }, consume: true, script: 'arc_kiba_give' },
      { id: 'run', text: 'Побегать с Кибой (меню общения)', target: { npc: 'kiba' }, on: _partner('kiba'), after: 'arc_kiba_run' },
      { id: 'forest', text: 'Потренировать скрытность в Лесу Нара', target: { building: 'clan_nara' }, on: ['training', (id) => id === 'stealth'], after: 'arc_kiba_forest' },
      { id: 'talk', text: 'Поговорить с Кибой', target: { npc: 'kiba' }, script: 'arc_kiba_end' },
    ],
    reward: { money: 90, vars: { friend_kiba: 3 }, text: 'Нюх Акамару' },
  },
  // ───────────── Чоджи: «Всё о еде» ─────────────
  arc_choji: {
    cat: 'friend', title: 'Всё о еде',
    desc: 'Чоджи знает о еде всё. Еда снимает усталость, а усталость мешает контролю.',
    offer: { npc: 'choji', script: 'arc_choji_offer', when: () => _lvl('choji', 1)() && G.state.vars.day >= 4 },
    steps: [
      { id: 'cook', text: 'Приготовить что-нибудь на кухне', target: { building: 'hero_home' }, on: ['cooked'], after: 'arc_choji_cook' },
      { id: 'fish', text: 'Поймать рыбу (река или пирс)', target: { building: 'pier' }, on: ['fished', (id) => !!id] },
      { id: 'give', text: 'Отдать рыбу Чоджи', target: { npc: 'choji' }, need: { fish: 1 }, consume: true, script: 'arc_choji_give' },
      { id: 'ramen', text: 'Поесть рамена с Чоджи в Ичираку', target: { building: 'ichiraku' }, on: ['bought', (id) => /^ramen_/.test(id)], after: 'arc_choji_ramen' },
      { id: 'talk', text: 'Поговорить с Чоджи', target: { npc: 'choji' }, script: 'arc_choji_end' },
    ],
    reward: { money: 60, vars: { friend_choji: 3 }, text: 'Секрет Акимичи' },
  },
  // ───────────── Ино: «Цветы и сплетни» ─────────────
  arc_ino: {
    cat: 'friend', title: 'Цветы и сплетни',
    desc: 'Ино знает все новости деревни. Она слышала что-то о тебе.',
    offer: { npc: 'ino', in: 'flowers', script: 'arc_ino_offer', when: () => _lvl('ino', 1)() && G.state.vars.day >= 4 },
    steps: [
      { id: 'peace', text: 'Подарить Сакуре цветок, чтобы помирить её с Ино', target: { npc: 'sakura' }, on: ['gift', (id) => id === 'sakura'], after: 'arc_ino_peace' },
      { id: 'talk', text: 'Рассказать Ино, как всё прошло', target: { npc: 'ino', in: 'flowers' }, script: 'arc_ino_gossip' },
      { id: 'med', text: 'Помедитировать вместе с Ино (меню общения)', target: { npc: 'ino' }, on: _partner('ino', 'meditate'), after: 'arc_ino_med' },
      { id: 'end', text: 'Поговорить с Ино', target: { npc: 'ino', in: 'flowers' }, script: 'arc_ino_end' },
    ],
    reward: { money: 90, vars: { friend_ino: 3, purple_ctl: 4 }, text: 'Упражнение клана Яманака: контроль +4' },
  },
  // ───────────── Ли: «Сила через труд» ─────────────
  arc_lee: {
    cat: 'friend', title: 'Сила через труд',
    desc: 'Ли ничего не умеет, кроме тайдзюцу, и всё равно идёт вперёд. Это стоит увидеть.',
    offer: { npc: 'lee', script: 'arc_lee_offer', when: () => _lvl('lee', 1)() && G.state.vars.day >= 8 },
    steps: [
      { id: 'towel', text: 'Купить полотенце для Ли', target: { building: 'shop_generic' }, have: { towel: 1 } },
      { id: 'give', text: 'Отдать полотенце Ли', target: { npc: 'lee' }, need: { towel: 1 }, consume: true, script: 'arc_lee_give' },
      { id: 'train', text: 'Потренироваться вместе с Ли (меню общения)', target: { npc: 'lee' }, on: _partner('lee'), after: 'arc_lee_train' },
      { id: 'spar', text: 'Провести спарринг с Ли', target: { npc: 'lee' }, on: ['battle', (a) => a && a.enemy === 'lee'], after: 'arc_lee_spar' },
      { id: 'talk', text: 'Поговорить с Гаем у полигона', target: { npc: 'guy' }, script: 'arc_lee_end' },
    ],
    reward: { money: 100, vars: { friend_lee: 3 }, text: 'Сила юности' },
  },
  // ───────────── Саске: «Соперник» ─────────────
  arc_sasuke: {
    cat: 'friend', title: 'Соперник',
    desc: 'Саске не любит слабых. Но ему тоже одиноко. Постарайся стать ему настоящим соперником.',
    offer: { npc: 'sasuke', script: 'arc_sasuke_offer', when: () => _lvl('sasuke', 1)() && G.state.vars.day >= 6 },
    steps: [
      { id: 'spar', text: 'Провести спарринг с Саске', target: { npc: 'sasuke' }, on: ['battle', (a) => a && a.enemy === 'sasuke'], after: 'arc_sasuke_spar' },
      { id: 'throw', text: 'Побросать сюрикены вместе с Саске', target: { npc: 'sasuke' }, on: _partner('sasuke', 'throw'), after: 'arc_sasuke_throw' },
      { id: 'tomato', text: 'Купить томаты для Саске', target: { building: 'market' }, have: { tomato: 2 } },
      { id: 'give', text: 'Отдать томаты Саске', target: { npc: 'sasuke' }, need: { tomato: 2 }, consume: true, script: 'arc_sasuke_give' },
      { id: 'talk', text: 'Поговорить с Саске', target: { npc: 'sasuke' }, script: 'arc_sasuke_end' },
    ],
    reward: { money: 100, vars: { friend_sasuke: 3, rival: 1 }, text: 'Признание соперника' },
  },
});
