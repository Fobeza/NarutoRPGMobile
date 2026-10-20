// Задания (план §2.6). Категории: story 🔥, academy 📘, errand 📜, friend 🍃, secret ❓.
//
// Шаг: { id, text, target, reach?, have?, time?, script? }
//   target: { building: tplId }            — место (стрелка ведёт к двери)
//           { npc: id, in?: tplId }        — персонаж (in — внутри какого здания)
//           { obj: kind, in: tplId }       — предмет в интерьере
//           { tile: [x, y], label }        — точка на улице
//   reach: true      — шаг выполняется, когда входишь в здание target.building
//   have: { id: n }  — шаг выполняется, когда в сумке есть предметы
//   time: [от, до]   — в какие часы шаг доступен (минуты от полуночи, до может быть > 1440)
//   script           — сценарий, который запускается при разговоре с target.npc на этом шаге
// offer: { npc, script, when() } — кто и когда предлагает задание (над ним «!»)
// deadline: n — срок в днях от начала (до конца дня start+n)
// reward: { money, vars: { friend_x: n }, text }
G.QUESTS = {
  day1: {
    cat: 'story', title: 'Первый день в Конохе',
    desc: 'Тебя нашли у ворот без сознания и без памяти. Хокаге решил: ты станешь учеником Академии. Пора зачислиться и освоиться.',
    steps: [
      { id: 'academy', text: 'Дойти до Академии', target: { building: 'academy' }, reach: true },
      { id: 'iruka', text: 'Поговорить с Ирукой-сенсеем', target: { npc: 'iruka', in: 'academy' } },
      { id: 'naruto', text: 'Найти Наруто у качелей', target: { npc: 'naruto' } },
      { id: 'ramen', text: 'Поужинать с Наруто в Ичираку', target: { npc: 'teuchi', in: 'ichiraku' }, icon: '🍜' },
      { id: 'sleep', text: 'Вернуться домой и лечь спать', target: { obj: 'futon', in: 'hero_home' }, time: [18 * 60, 30 * 60] },
    ],
    reward: { text: 'Начало пути шиноби' },
  },

  homework: {
    cat: 'academy', title: 'Снаряжение к уроку',
    desc: 'Ирука-сенсей велел прийти на урок метания со своими кунаями. Оружейная — на Главной улице.',
    deadline: 1,
    steps: [
      { id: 'buy', text: 'Купить 3 куная в Оружейной', target: { building: 'weapons' }, have: { kunai: 3 }, time: [8 * 60, 19 * 60] },
      { id: 'show', text: 'Показать кунаи Ируке', target: { npc: 'iruka', in: 'academy' }, need: { kunai: 3 }, script: 'iruka_homework' },
    ],
    reward: { vars: { friend_iruka: 1 }, text: 'Ирука-сенсей доволен' },
  },

  ino_flowers: {
    cat: 'errand', title: 'Букет для Хинаты',
    desc: 'Ино собрала букет по заказу клана Хьюга. Сама отойти от прилавка не может.',
    offer: { npc: 'ino', in: 'flowers', script: 'ino_offer', when: () => G.state.vars.day >= 1 },
    steps: [
      { id: 'deliver', text: 'Отнести букет Хинате к особняку Хьюга', target: { npc: 'hinata' }, need: { bouquet_ino: 1 }, consume: true, script: 'hinata_flowers' },
      { id: 'return', text: 'Вернуться к Ино за наградой', target: { npc: 'ino', in: 'flowers' }, script: 'ino_reward', time: [8 * 60, 19 * 60] },
    ],
    reward: { money: 60, vars: { friend_ino: 1, friend_hinata: 1 }, text: '60 рё' },
  },

  shogi: {
    cat: 'friend', title: 'Скучающий стратег',
    desc: 'Шикамару жалуется, что в классе не с кем сыграть в шоги. Набор продают в Сувенирной лавке.',
    offer: { npc: 'shikamaru', in: 'academy', script: 'shikamaru_offer', when: () => G.state.flags.met_shikamaru },
    steps: [
      { id: 'buy', text: 'Купить набор шоги', target: { building: 'souvenir' }, have: { shogi: 1 } },
      { id: 'give', text: 'Отдать шоги Шикамару', target: { npc: 'shikamaru', in: 'academy' }, need: { shogi: 1 }, consume: true, script: 'shikamaru_shogi' },
    ],
    reward: { vars: { friend_shikamaru: 2 }, text: 'Дружба с Шикамару' },
  },

  waterfall_scroll: {
    cat: 'secret', title: 'Свиток за водопадом', hidden: true,
    desc: 'За струями водопада кто-то спрятал старый свиток.',
    steps: [{ id: 'find', text: 'Найти свиток за водопадом', target: { building: 'waterfall' } }],
    reward: { money: 100, text: '100 рё и записи о технике' },
  },
};

G.QUEST_CATS = {
  story: { name: 'Сюжет', icon: '🔥', color: '#e8621a' },
  academy: { name: 'Академия', icon: '📘', color: '#4a8ae0' },
  errand: { name: 'Поручения', icon: '📜', color: '#c8a050' },
  friend: { name: 'Дружба', icon: '🍃', color: '#6ab04a' },
  secret: { name: 'Секреты', icon: '❓', color: '#a070d0' },
};
