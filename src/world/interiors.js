// Интерьеры: отдельные маленькие карты. Строятся по «виду» (kind) и seed здания.
// Комната: сверху две строки стены, по бокам и снизу — рамка, внизу по центру — коврик-выход.
G.interiors = (() => {
  const T = G.CONFIG.TILE;
  const VILLAGER_LINES = [
    'Чай будешь? Шучу, у меня самой заварка кончилась.',
    'Мой сын тоже учится в Академии. Говорит, Ирука-сенсей строгий, но добрый.',
    'Опять Наруто разрисовал Скалу Хокаге... Весь квартал смеялся.',
    'Говорят, этой осенью будет фестиваль. Надеюсь, погода не подведёт.',
    'Ты ведь тот новенький, что вернулся в деревню? Добро пожаловать домой.',
    'Ичираку — лучший рамен в деревне. Только не говори об этом хозяину Якинику Q.',
    'В квартал Учиха я бы ночью не ходил. Тихо там... слишком тихо.',
    'Тренируйся, пока молодой! Я вот в твои годы...',
    'Стучаться надо! Ну ладно, проходи, раз пришёл.',
    'Кошку Тору не видел? Жена даймё опять её ищет.',
  ];

  function room(id, name, w, h, floorId, opts = {}) {
    const ID = G.tiles.ID;
    const m = new G.WorldMap(id, w, h, { name, bg: '#140f0c' });
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let t = floorId;
      if (y < 2) t = ID.IWALL;
      else if (x === 0 || x === w - 1 || y === h - 1) t = ID.VOID;
      m.set(x, y, t);
    }
    const ex = opts.exitX != null ? opts.exitX : Math.floor(w / 2);
    m.set(ex, h - 1, ID.MAT);
    m.exit = { tx: ex, ty: h - 1 };
    m.warps.push({ rect: { x: ex * T + 1, y: (h - 1) * T + 6, w: T - 2, h: 10 }, dir: 'down', to: { back: true } });
    m.spawn = { x: ex * T + 8, y: (h - 2) * T + 12, dir: 'up' };
    return m;
  }

  // Поставить объект: (tx, ty) — клетка, привязка по низу; dx — сдвиг в пикселях (для широких)
  const put = (m, kind, tx, ty, extra, dx = 8) => m.addObject(kind, tx * T + dx, ty * T + 15, extra);
  const onWall = (m, kind, tx, extra, dx = 8) => m.addObject(kind, tx * T + dx, T + 13, Object.assign({ box: null }, extra));
  const npc = (m, id, tx, ty, dir, talk, extra = {}) => m.npcs.push(Object.assign({ id, x: tx * T + 8, y: ty * T + 12, dir, talk, ai: 'idle' }, extra));
  const rug = (m, x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.set(x, y, G.tiles.ID.RUG); };

  // ---------- Виды интерьеров ----------
  const KINDS = {
    hero_home(info) {
      const ID = G.tiles.ID;
      const m = room(info.id, 'Дом героя', 10, 8, ID.TATAMI, { exitX: 5 });
      put(m, 'futon', 1, 4, { talk: 'home_bed' }, 9);
      put(m, 'chest', 3, 2, { talk: ['Сундук. Здесь будут храниться вещи, которые не влезают в подсумок.'] });
      put(m, 'desk', 5, 2, { talk: ['Стол для учёбы. Учебник «История Конохи» открыт на главе про Первого Хокаге.'] }, 13);
      onWall(m, 'calendar', 4, { talk: 'home_calendar' });
      onWall(m, 'window', 6);
      put(m, 'kitchen', 7, 2, { talk: 'home_kitchen' }, 16);
      put(m, 'flowerpot', 8, 5, { talk: ['Цветок в горшке. Его надо поливать — как у Наруто.'] });
      put(m, 'table', 4, 5, null, 16);
      onWall(m, 'emblem', 2, { talk: ['Знак Листа. Его оставили тебе родители.'] });
      return m;
    },

    naruto_flat(info) {
      const ID = G.tiles.ID;
      const m = room(info.id, 'Квартира Наруто', 9, 7, ID.FLOOR, { exitX: 4 });
      put(m, 'futon', 1, 4, { talk: ['Неубранная постель. На подушке — ночной колпак с мордочкой.'] }, 9);
      put(m, 'cups', 4, 3); put(m, 'cups', 2, 5); put(m, 'cups', 7, 5);
      onWall(m, 'poster', 3, { talk: ['Самодельный плакат: «Я стану Хокаге!!!» Буквы кривые, зато крупные.'] });
      onWall(m, 'window', 6);
      put(m, 'kitchen', 6, 2, { talk: ['На полке — пирамида из лапши быстрого приготовления. И молоко... с истёкшим сроком.'] }, 16);
      put(m, 'table', 6, 4, null, 0);
      return m;
    },

    house(info) {
      const ID = G.tiles.ID;
      const r = G.util.rng(info.seed);
      const w = r.int(9, 11), h = r.int(7, 9);
      const m = room(info.id, info.name || 'Дом', w, h, r.chance(0.5) ? ID.TATAMI : ID.FLOOR);
      put(m, 'futon', 1, 4, null, 9);
      put(m, 'kitchen', w - 3, 2, null, 16);
      put(m, 'table', Math.floor(w / 2), Math.floor(h / 2) + 1, null, 0);
      if (r.chance(0.7)) put(m, 'shelf', 3, 2);
      if (r.chance(0.6)) put(m, 'plant', w - 2, h - 2);
      if (r.chance(0.5)) put(m, 'chest', w - 2, h - 3);
      onWall(m, 'window', 2); onWall(m, r.chance(0.5) ? 'scroll' : 'window', w - 5);
      const who = r.chance(0.5) ? 'villager_m' : 'villager_f';
      let nx = r.int(3, w - 4), ny = r.int(3, h - 3);
      for (let i = 0; i < 30; i++) {
        const f = { x: nx * T + 2, y: ny * T + 4, w: 12, h: 10 };
        if (!m.objects.some((o) => o.box && G.util.rectsOverlap(f, o.box))) break;
        nx = r.int(2, w - 3); ny = r.int(3, h - 3);
      }
      npc(m, who, nx, ny, 'down', [VILLAGER_LINES[r.int(0, VILLAGER_LINES.length - 1)]], { ai: 'wander' });
      return m;
    },

    shop(info) {
      const ID = G.tiles.ID;
      const id = info.tplId;
      const w = 10, h = 8;
      const m = room(info.id, info.name, w, h, ID.FLOOR);
      for (let x = 2; x <= w - 3; x++) put(m, 'counter', x, 3);
      const wares = {
        weapons: () => { put(m, 'rack', 2, 2, null, 0); put(m, 'rack', 8, 2, null, 0); put(m, 'barrel', 1, 5); put(m, 'crate', 8, 5); },
        pharmacy: () => { put(m, 'shelf', 1, 2); put(m, 'shelf', 8, 2); put(m, 'plant', 1, 5); put(m, 'plant', 8, 5); },
        books: () => { put(m, 'shelf', 1, 2); put(m, 'shelf', 8, 2); put(m, 'shelf', 1, 5); put(m, 'shelf', 8, 5); },
        flowers: () => { put(m, 'plant', 1, 2); put(m, 'plant', 8, 2); put(m, 'flowerbox', 1, 5); put(m, 'flowerbox', 8, 5); put(m, 'flowerpot', 2, 6); put(m, 'flowerpot', 7, 6); },
        market: () => { put(m, 'crate', 1, 5); put(m, 'crate', 2, 5); put(m, 'barrel', 8, 5); put(m, 'barrel', 7, 6); },
      }[id] || (() => { put(m, 'shelf', 1, 2); put(m, 'crate', 8, 5); put(m, 'barrel', 1, 5); });
      wares();
      onWall(m, 'scroll', 3); onWall(m, 'scroll', 6);
      const owner = {
        flowers: { id: 'villager_f', name: 'Ино', text: 'Добро пожаловать в «Цветы Яманака»! Я Ино. Если ищешь подарок — цветы подходят всегда!' },
        weapons: { id: 'villager_m', name: 'Оружейник', text: 'Кунаи, сюрикены, проволока, взрывные печати... Товар скоро завезут — заглядывай!' },
        pharmacy: { id: 'villager_f', name: 'Аптекарь', text: 'Пилюли, бинты и мази. Если поранишься на тренировке — сначала ко мне, потом в больницу.' },
        books: { id: 'villager_m', name: 'Книжник', text: 'Свитки техник, учебники, романы... «Ича-Ича»? Тебе рано, малец.' },
        inuzuka_shop: { id: 'villager_f', name: 'Продавщица', text: 'Корм для собак и лакомства для нинкенов. Клан Инузука плохого не продаёт!' },
        souvenir: { id: 'villager_m', name: 'Торговец', text: 'Сувениры! Брелоки, маски, открытки со Скалой Хокаге. Отличные подарки для друзей.' },
        market: { id: 'villager_f', name: 'Торговка', text: 'Свежие овощи, рис, рыба! Здесь же скупаю травы и улов.' },
      }[id] || { id: 'villager_m', name: 'Лавочник', text: 'Заходи, смотри! Цены честные, товар хороший.' };
      const shopId = G.SHOPS[id] ? id : 'shop_generic';
      const kw = G.SHOPS[shopId].keeper.who;
      npc(m, G.chars.DEFS[kw] ? kw : owner.id, Math.floor(w / 2), 2, 'down', null,
        { reach: 32, shop: shopId, shopTitle: shopId === 'shop_generic' ? info.name : null, name: owner.name });
      return m;
    },

    food(info) {
      const ID = G.tiles.ID;
      const id = info.tplId;
      const w = 10, h = 7;
      const m = room(info.id, info.name, w, h, ID.FLOOR);
      for (let x = 1; x <= w - 2; x++) put(m, 'counter', x, 3);
      for (let x = 2; x <= w - 3; x += 2) put(m, 'stool', x, 4);
      put(m, 'kitchen', 2, 2, null, 0); put(m, 'kitchen', 7, 2, null, 16);
      onWall(m, 'scroll', 4); onWall(m, 'scroll', 5);
      const owner = {
        ichiraku: { name: 'Теучи', text: 'Добро пожаловать в Ичираку! Мисо-рамен со свининой — фирменное блюдо. Наруто ест по три миски!' },
        yakiniku: { name: 'Повар', text: 'Якинику Q! Мясо жарим прямо за столом. Команда Асумы здесь частые гости.' },
        dango: { name: 'Продавщица', text: 'Сладкие данго! Анко-сан берёт сразу дюжину.' },
        teahouse: { name: 'Хозяйка', text: 'Зелёный чай и тишина. Здесь хорошо думается.' },
      }[id] || { name: 'Повар', text: 'Садись, угощайся!' };
      const oid = id === 'ichiraku' ? 'teuchi' : id === 'yakiniku' ? 'villager_m' : 'villager_f';
      npc(m, oid, Math.floor(w / 2), 2, 'down', null, { reach: 32, shop: G.SHOPS[id] ? id : 'teahouse', name: owner.name });
      if (id === 'ichiraku') {
        npc(m, 'ayame', 6, 2, 'down', 'ayame_talk', { reach: 32 });
        npc(m, 'naruto', 4, 4, 'up', 'naruto_ichiraku', { cond: () => G.state.flags.naruto_invited && G.state.vars.day === 1 });
        // со второго дня: вечером здесь ужинают Наруто и Ирука
        npc(m, 'naruto', 4, 4, 'up', 'naruto_ramen_eve', { sched: [[18 * 60, 20 * 60 + 30, 2]] });
        npc(m, 'iruka', 6, 4, 'up', 'iruka_ramen', { sched: [[18 * 60 + 30, 21 * 60, 2]] });
      }
      // готовка — у двух стоек перед кухней: сами кухонные объекты стоят за стойкой, до них не дотянуться
      if (id === 'ichiraku') for (const o of m.objects) if (o.kind === 'counter' && [2, 7].includes(Math.floor(o.x / T))) o.talk = 'ichiraku_cook';
      return m;
    },

    academy_hall(info) {
      const ID = G.tiles.ID;
      const w = 12, h = 11;
      const m = room(info.id, 'Академия: класс', w, h, ID.FLOOR, { exitX: 6 });
      onWall(m, 'blackboard', 6, { talk: ['На доске: «Хенге», «Каварими», «Буншин». Внизу мелкая приписка: «Наруто — дежурный!»'] }, 0);
      onWall(m, 'window', 1); onWall(m, 'window', 10); onWall(m, 'emblem', 2);
      put(m, 'desk', 6, 3, { talk: ['Учительский стол. Журнал посещаемости, красная ручка и... фото Ичираку?'] }, 0);
      // парты в три ряда колонок: у каждой — два места «за» партой (лицом к доске)
      for (const r of [5, 7]) for (const x of [1, 4, 7]) put(m, 'desk', x, r, null, 16);
      put(m, 'plant', 1, 3); put(m, 'plant', 10, 3); put(m, 'plant', 10, 8);
      const H = 60, day1 = () => G.state.vars.day === 1, cls = [[8 * H, 13 * H, 'wd']];
      m.seats = { hero: { tx: 5, ty: 8 } };
      npc(m, 'iruka', 4, 3, 'down', 'iruka_class', { sched: [[8 * H, 15 * H, 'wd']], keep: () => day1() || !G.state.flags.enrolled });
      const seat = (id, tx, ty, talk, extra = {}) => npc(m, id, tx, ty, 'up', talk, Object.assign({ sched: cls, cond: () => !day1() }, extra));
      seat('kiba', 1, 6, [{ who: 'kiba', text: 'Тс-с! Акамару спит у меня в капюшоне. Ирука-сенсей пока не заметил.' }]);
      seat('shino', 2, 6, [{ who: 'shino', text: 'Я веду конспект. Насекомые тоже слушают лекцию.' }]);
      seat('sakura', 4, 6, 'class_sakura');
      seat('sasuke', 5, 6, 'class_sasuke');
      seat('naruto', 7, 6, 'class_naruto', { sched: [[8 * H, 12 * H, 'wd']] });
      seat('hinata', 8, 6, 'class_hinata', { sched: [[8 * H, 14 * H, 'wd']], cond: () => true });
      seat('ino', 1, 8, [{ who: 'ino', text: 'Не толкай мою парту! Я пишу Саске записку... то есть конспект.' }]);
      seat('choji', 2, 8, [{ who: 'choji', text: 'Хрум... Это не обед. Это... учебный пончик.' }]);
      seat('shikamaru', 4, 8, 'shikamaru_class', { sched: cls, cond: () => true, keep: day1 });
      return m;
    },

    hokage_hall(info) {
      const ID = G.tiles.ID;
      const w = 12, h = 10;
      const m = room(info.id, 'Резиденция Хокаге', w, h, ID.FLOOR, { exitX: 6 });
      rug(m, 5, 4, 6, 8);
      put(m, 'bigdesk', 6, 3, { talk: ['Стол Хокаге. На нём гора бумаг: поручения D-ранга, отчёты, заявка «Найти кошку Тору» (снова).', 'Третьего Хокаге сейчас нет на месте.'] }, 0);
      put(m, 'pillar', 2, 4); put(m, 'pillar', 9, 4); put(m, 'pillar', 2, 7); put(m, 'pillar', 9, 7);
      put(m, 'shelf', 1, 2); put(m, 'shelf', 10, 2);
      onWall(m, 'emblem', 6, null, 0); onWall(m, 'scroll', 3); onWall(m, 'scroll', 8);
      put(m, 'plant', 1, 8); put(m, 'plant', 10, 8);
      // Ирука после уроков раздаёт поручения за столом миссий
      npc(m, 'iruka', 4, 5, 'down', 'iruka_mission', { sched: [[15 * 60, 18 * 60, 'wd']] });
      return m;
    },

    library(info) {
      const ID = G.tiles.ID;
      const w = 12, h = 10;
      const m = room(info.id, 'Библиотека', w, h, ID.FLOOR, { exitX: 6 });
      for (let x = 1; x <= 10; x++) if (x !== 5 && x !== 6) put(m, 'shelf', x, 2);
      for (const y of [5, 7]) for (const x of [2, 3, 8, 9]) put(m, 'shelf', x, y);
      put(m, 'desk', 6, 5, null, 0);
      npc(m, 'villager_f', 6, 4, 'down', [{ who: 'villager_f', name: 'Библиотекарь', text: 'Тише, пожалуйста. Здесь история деревни, теория чакры и основы гендзюцу.' }, { text: '(Учёба в библиотеке появится на этапе 7.)' }], { reach: 30 });
      return m;
    },

    hospital(info) {
      const ID = G.tiles.ID;
      const w = 12, h = 9;
      const m = room(info.id, 'Больница', w, h, ID.TILEFLOOR, { exitX: 6 });
      for (let x = 1; x <= 10; x += 3) put(m, 'bed', x, 3, null, 9);
      put(m, 'screen', 4, 5, null, 8); put(m, 'plant', 10, 6);
      onWall(m, 'window', 3); onWall(m, 'window', 8);
      npc(m, 'villager_f', 7, 6, 'down', [{ who: 'villager_f', name: 'Медсестра', text: 'Больница Конохи. Если получишь травму на тренировке — приходи, вылечим.' }, { text: 'Если денег нет — лечим бесплатно. Деревня заботится о своих учениках.' }]);
      return m;
    },

    onsen(info) {
      const ID = G.tiles.ID;
      const w = 12, h = 9;
      const m = room(info.id, 'Онсен', w, h, ID.FLOOR, { exitX: 3 });
      for (let y = 3; y <= 6; y++) for (let x = 6; x <= 10; x++) m.set(x, y, ID.WATER);
      for (let x = 1; x <= 4; x++) put(m, 'counter', x, 3);
      put(m, 'screen', 5, 7, null, 0); put(m, 'plant', 1, 6);
      onWall(m, 'scroll', 2);
      npc(m, 'villager_f', 2, 2, 'down', null, { reach: 32, shop: 'onsen', name: 'Хозяйка онсена' });
      return m;
    },

    hall(info) { // залы кланов
      const ID = G.tiles.ID;
      const w = 12, h = 9;
      const m = room(info.id, info.name, w, h, ID.TATAMI, { exitX: 6 });
      put(m, 'pillar', 2, 3); put(m, 'pillar', 9, 3); put(m, 'pillar', 2, 6); put(m, 'pillar', 9, 6);
      put(m, 'table', 6, 4, null, 0);
      onWall(m, 'scroll', 4); onWall(m, 'scroll', 7); onWall(m, 'emblem', 6, null, 0);
      put(m, 'plant', 1, 7); put(m, 'plant', 10, 7);
      const lines = {
        nara_hall: ['Дом клана Нара. Пахнет лекарственными травами из оленьих рогов.', 'Шикамару, наверное, опять спит на крыше.'],
        akimichi_hall: ['Дом клана Акимичи. С кухни доносится запах жареного мяса.', 'Чоджи где-то здесь — точно у холодильника.'],
        hyuga_hall: ['Главный дом клана Хьюга. Строго, чисто и очень тихо.', 'Во дворе слышны удары — кто-то тренирует Мягкий кулак.'],
        inuzuka_hall: ['Дом клана Инузука. Отовсюду лают собаки.', 'Киба и Акамару опять убежали гулять.'],
      }[info.kind] || ['Зал клана.'];
      const extra = {
        nara_hall: () => { put(m, 'deer', 4, 7, { talk: ['Олень клана Нара. Смотрит на тебя спокойно и немного лениво.'] }); put(m, 'herb', 8, 7, { box: null }); put(m, 'herb_blue', 7, 7, { box: null }); },
        akimichi_hall: () => { put(m, 'hibachi', 4, 7); put(m, 'pots', 8, 7); put(m, 'sacks', 3, 7); },
        hyuga_hall: () => { put(m, 'dummy', 4, 7, { talk: ['Манекен весь в точечных вмятинах — следы Мягкого кулака.'] }); put(m, 'bonsai', 8, 7); put(m, 'andon', 7, 7); },
        inuzuka_hall: () => { put(m, 'basket', 4, 7, { box: null, talk: ['Собачья лежанка. Вся в шерсти.'] }); put(m, 'basket', 8, 7, { box: null }); put(m, 'barrel', 3, 7); },
      }[info.kind];
      if (extra) extra();
      npc(m, 'villager_m', 6, 6, 'up', [{ who: 'villager_m', name: 'Член клана', text: lines[0] }, { text: lines[1] }]);
      return m;
    },

    sasuke_home(info) {
      const ID = G.tiles.ID;
      const m = room(info.id, 'Дом Саске', 10, 8, ID.FLOOR, { exitX: 5 });
      put(m, 'futon', 1, 4, null, 9); put(m, 'table', 5, 5, null, 0);
      put(m, 'shelf', 8, 2, { talk: ['На полке — фотография семьи. Лица родителей и старшего брата перечёркнуты? Нет... просто тень.'] });
      onWall(m, 'window', 3); onWall(m, 'scroll', 6, { talk: ['Свиток с гербом Учиха.'] });
      return m;
    },

    abandoned(info) {
      const ID = G.tiles.ID;
      const r = G.util.rng(info.seed);
      const m = room(info.id, 'Пустой дом Учиха', 9, 7, ID.DUSTFLOOR);
      put(m, 'crate', r.int(1, 3), r.int(3, 5), { talk: ['Пыль и тишина. Здесь давно никто не живёт.'] });
      put(m, 'barrel', r.int(5, 7), r.int(3, 5));
      onWall(m, 'scroll', 4, { talk: ['Выцветший свиток с гербом Учиха.'] });
      return m;
    },

    dojo(info) {
      const ID = G.tiles.ID;
      const w = 12, h = 9;
      const m = room(info.id, 'Додзё', w, h, ID.FLOOR, { exitX: 6 });
      put(m, 'rack', 2, 2, null, 0); put(m, 'rack', 10, 2, null, 0);
      put(m, 'dummy', 4, 5); put(m, 'dummy', 8, 5);
      put(m, 'log', 2, 7); put(m, 'barrel', 10, 7); put(m, 'cushion', 5, 7, { box: null }); put(m, 'cushion_b', 7, 7, { box: null });
      onWall(m, 'banner', 3); onWall(m, 'banner', 9);
      onWall(m, 'scroll', 6, { talk: ['Свиток: «Сила без контроля — ничто». Подпись: Майто Гай.'] });
      npc(m, 'villager_m', 6, 4, 'down', [{ who: 'villager_m', name: 'Мастер додзё', text: 'Тайдзюцу — основа всего. Без крепкого тела и техники не помогут!' }, { text: '(Тренировки появятся на этапе 7.)' }]);
      return m;
    },
  };
  // залы кланов → общий вид
  for (const k of ['nara_hall', 'akimichi_hall', 'hyuga_hall', 'inuzuka_hall']) KINDS[k] = (info) => KINDS.hall(Object.assign({}, info, { kind: k }));
  for (const k of ['weapons', 'pharmacy', 'books', 'flowers', 'inuzuka_shop', 'souvenir', 'market']) KINDS[k] = KINDS.shop;
  for (const k of ['ichiraku', 'yakiniku', 'dango', 'teahouse']) KINDS[k] = KINDS.food;

  // Дополнительный декор: настенные украшения, мебель вдоль стен, коврики и мелочи на полу
  function decorate(m, info) {
    const ID = G.tiles.ID, w = m.w, h = m.h, r = G.util.rng((info.seed || 1) * 7 + 13);
    const kind = info.kind || '';
    if (kind === 'abandoned' || kind === 'dojo' || kind === 'academy_hall') return;
    const cozy = !['academy_hall', 'hokage_hall', 'library', 'hospital'].includes(kind);
    const ex = m.exit ? m.exit.tx : Math.floor(w / 2);
    const used = new Set();
    // клетки, которые занимает рисунок объекта (с учётом смещения спрайта)
    const cells = (x, y, ox, oy, ow, oh) => {
      const out = [];
      const x0 = Math.floor((x + ox + 1) / T), x1 = Math.floor((x + ox + ow - 2) / T);
      const y0 = Math.max(2, Math.floor((y + oy + 1) / T)), y1 = Math.floor((y - 1) / T);
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) out.push([xx, yy]);
      return out;
    };
    const mark = (o) => { for (const [x, y] of cells(o.x, o.y, o.ox || 0, o.oy || 0, o.w || T, o.h || T)) used.add(x + ',' + y); if (o.box) for (let yy = Math.floor(o.box.y / T); yy <= Math.floor((o.box.y + o.box.h - 1) / T); yy++) for (let xx = Math.floor(o.box.x / T); xx <= Math.floor((o.box.x + o.box.w - 1) / T); xx++) used.add(xx + ',' + yy); };
    for (const o of m.objects) if (o.y !== T + 13) mark(o);
    for (const n of m.npcs) { const tx = Math.floor(n.x / T), ty = Math.floor(n.y / T); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) used.add((tx + a) + ',' + (ty + b)); }
    const floor = (x, y) => x >= 1 && x <= w - 2 && y >= 2 && y <= h - 2 && m.get(x, y) !== ID.VOID && m.get(x, y) !== ID.IWALL && m.get(x, y) !== ID.MAT && m.get(x, y) !== ID.WATER;
    const lane = (x, y) => y >= h - 3 && Math.abs(x - ex) <= 1;
    const free = (x, y) => floor(x, y) && !used.has(x + ',' + y) && !lane(x, y);
    const take = (x, y) => used.add(x + ',' + y);
    // поместится ли объект kind в клетку (x, y): все клетки рисунка — свободный пол
    const fits = (k, x, y, dx = 8) => { const s = G.tiles.object(k); return cells(x * T + dx, y * T + 15, s.ox, s.oy, s.w, s.h).every(([cx, cy]) => free(cx, cy)); };
    const place = (k, x, y, extra) => { const o = put(m, k, x, y, extra); mark(o); return o; };
    // мебель вдоль стен (до настенных украшений); высокая мебель занимает и стену
    const wallBusy = m.objects.filter((o) => o.y === T + 13 || (o.y + (o.oy || 0)) < 2 * T).map((o) => Math.floor(o.x / T));
    const solids = cozy ? ['tansu', 'wardrobe', 'hibachi', 'vase', 'bonsai', 'bookpile', 'lowtable'] : ['vase', 'bonsai', 'bookpile'];
    const spots = [];
    for (let x = 1; x <= w - 2; x++) spots.push([x, 2]);
    for (let y = 3; y <= h - 4; y++) { spots.push([1, y]); spots.push([w - 2, y]); }
    for (let i = spots.length - 1; i > 0; i--) { const j = r.int(0, i); [spots[i], spots[j]] = [spots[j], spots[i]]; }
    let ns = 0;
    for (const [x, y] of spots) {
      if (ns >= (cozy ? 3 : 2)) break;
      const k = solids[r.int(0, solids.length - 1)];
      if (!fits(k, x, y)) continue;
      // соседние клетки тоже свободны — между предметами остаётся проход
      let clear = true;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if ((a || b) && used.has((x + a) + ',' + (y + b))) clear = false;
      if (!clear) continue;
      if (y === 2 && wallBusy.some((bx) => Math.abs(bx - x) < 2)) continue;
      place(k, x, y); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) take(x + a, y + b); ns++;
      if (y === 2) wallBusy.push(x);
    }
    // настенные украшения — только на свободных участках стены
    const wallItems = ['painting', 'mirror', 'wallshelf', 'chochin'];
    for (let i = 0, n = 0; i < 14 && n < (cozy ? 2 : 1); i++) {
      const x = r.int(1, w - 2);
      if (wallBusy.some((b) => Math.abs(b - x) < 2)) continue;
      onWall(m, r.pick(wallItems), x); wallBusy.push(x); n++;
    }
    // коврики и мелочи на полу (проходимые)
    const soft = ['cushion', 'cushion_b', 'basket', 'cat', 'shoes', 'rug_red', 'rug_blue', 'rug_round'];
    let nf = 0;
    for (let i = 0; i < 40 && nf < (cozy ? 4 : 2); i++) {
      const x = r.int(1, w - 2), y = r.int(3, h - 2);
      const k = soft[r.int(0, soft.length - 1)];
      if (k === 'cat' && (!cozy || r() > 0.25 || m.objects.some((o) => o.kind === 'cat'))) continue;
      if (!fits(k, x, y)) continue;
      place(k, x, y, { box: null }); nf++;
    }
  }

  function build(info) {
    const fn = KINDS[info.kind] || KINDS.house;
    const m = fn(info);
    m.info = info;
    try { decorate(m, info); } catch (e) { console.warn('decorate', e); }
    m.finalize();
    return m;
  }

  return { build, KINDS, VILLAGER_LINES };
})();
