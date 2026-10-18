// Живая деревня: новые персонажи, имена и реплики жителей, эмоции над головами, исследовательские задания.
G.life2 = (() => {
  const T = 16, H = 60;
  const P = G.PAL;
  // внешность новых жителей — data/characters.js

  // ── имена и реплики жителей ──
  const NAMES_M = ['Кента', 'Сэйдзи', 'Дайсукэ', 'Горо', 'Рэн', 'Такэси', 'Масару', 'Хироши', 'Сабуро', 'Юкио'];
  const NAMES_F = ['Мико', 'Юна', 'Эмико', 'Тамаки', 'Нодока', 'Харука', 'Сацуки', 'Аяка', 'Рэйко', 'Мидори'];
  const JOBS = ['торговец', 'плотник', 'рыбак', 'ткач', 'кузнец', 'повар', 'садовник', 'писарь', 'пекарь'];
  const GEN = [
    'Сегодня как-то особенно тихо. Только бы не к дождю.',
    'Видел Скалу Хокаге? Четыре лица, а Наруто всё равно хочет пятое — своё.',
    'Тренируйся, но не забывай отдыхать. Сон — тоже часть тренировки.',
    'Мой дед говорил: «Коноха растёт не стенами, а людьми».',
    'Хочешь совет? Заглядывай в Ичираку до обеда — очереди меньше.',
    'Скоро фестиваль! Уже вешают фонарики на главной улице.',
    'Дети Академии шумные, но смотри — вырастут настоящими героями.',
    'У нас тут мирно. И пусть так остаётся.',
    'Говорят, в лесу за деревней растут целебные травы. Но без разрешения не ходи.',
    'Ты слышал? На рынке привезли свежую рыбу из страны Воды.',
    'У моей жены лучший рисовый пирог в Конохе. Но она ни за что не раскроет секрет.',
    'Я двадцать лет работаю на этой улице. Каждая трещина в камне мне знакома.',
  ];
  const MORNING = ['Доброе утро! Позавтракал уже? Ирука-сенсей не любит голодных учеников.', 'Утро — лучшее время для тренировки. Воздух чист, голова светлая.', 'Опять торопишься в Академию? Не бегай, всё равно успеешь.'];
  const EVENING = ['Скоро стемнеет. Не гуляй допоздна — патруль строг.', 'Вечером на Главной улице так красиво, когда зажигают фонари.', 'Закат над Скалой Хокаге — любимое зрелище стариков.'];
  const RAIN = ['Ну и ливень! Зато травы наберутся сил.', 'Дождь — самое время посидеть дома с чаем.', 'Мои сандалии промокли насквозь...'];
  const DIST = {
    market: ['Свежие овощи! Лучшие в Стране Огня!', 'Цены кусаются, но качество того стоит.', 'Купишь что-нибудь? Для тебя скидка... в мыслях.'],
    park: ['Видишь цветы? Это Ино ухаживает за клумбой.', 'Здесь так спокойно, что даже дети не шумят. Почти.', 'Скамейка под сакурой — моё любимое место.'],
    residential: ['Соседи у нас дружные: чуть что — несут рис и суп.', 'Тут тихо, но иногда слышно, как Наруто убегает от Ируки.', 'Мои окна выходят на Скалу Хокаге. Каждое утро — как открытка.'],
    uchiha: ['В этом квартале слишком тихо. Мне здесь не по себе.', 'Раньше тут было людно и шумно. Теперь — только ветер.'],
    training: ['Не стой на линии мишеней — глаза береги!', 'Здесь всё время кто-то тренируется. Это вдохновляет.', 'Лучшее время для практики — на рассвете.'],
    clan: ['Кланы у нас древние. У каждого — свои традиции.', 'Говорят, у Хьюга глаза видят насквозь. Лучше не врать им.', 'Нара любят оленей. Акимичи — еду. Инудзука — собак.'],
    official: ['Бумаги, бумаги... Хокаге разбирает горы отчётов каждый день.', 'Не шуми, здесь работают.'],
    forest: ['В лесу лучше не задерживаться после заката.', 'Слышишь птиц? Значит, всё спокойно.'],
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function villagerTalk(n) {
    const V = G.state.vars, lines = [];
    const pool = GEN.slice();
    const h = V.min / 60;
    if (G.life.raining()) pool.push(...RAIN, ...RAIN);
    if (h < 10) pool.push(...MORNING, ...MORNING);
    if (h >= 18) pool.push(...EVENING, ...EVENING);
    if (n._dt && DIST[n._dt]) pool.push(...DIST[n._dt], ...DIST[n._dt]);
    if (G.academy && G.academy.avg && G.academy.avg() >= 80) pool.push('Слышала, ты первый в классе. Мои соседи только о тебе и говорят!');
    if ((V.miss || 0) > 1) pool.push('Говорят, ты прогуливал уроки? Ирука-сенсей уже в курсе, поверь.');
    if (V.day >= 50) pool.push('Экзамен на носу! Все в деревне за тебя болеют.');
    lines.push({ who: n.id, name: n.name, text: pick(pool) });
    if (Math.random() < 0.3) lines.push({ who: n.id, name: n.name, text: pick(['Если что — заходи ещё.', 'Ладно, не буду тебя задерживать.', 'Береги себя, ниндзя.', 'Передавай привет Ируке-сенсею.']) });
    return lines;
  }
  const NAMES = {};
  // ── расстановка жителей ──
  const basePop = G.world.populateKonoha.bind(G.world);
  G.world.populateKonoha = function (m) {
    basePop(m);
    // 1) персональные имена и свои реплики у массовки
    let mi = 0, fi = 0;
    for (const n of m.npcs) {
      if ((n.id === 'villager_m' || n.id === 'villager_f') && !n.name && !n.shop) {
        n.name = n.id === 'villager_m' ? NAMES_M[mi++ % NAMES_M.length] : NAMES_F[fi++ % NAMES_F.length];
        const d = m.districtAt(Math.floor(n.x / T), Math.floor(n.y / T)); n._dt = d ? d.type : 'residential';
        n._job = pick(JOBS);
        Object.defineProperty(n, 'talk', { configurable: true, get() { return villagerTalk(n); }, set() {} });
      }
    }
    // 2) новые характерные жители
    const L = (tpl) => G.KONOHA_DRAFT.buildings.find((b) => b.tpl === tpl);
    const add = (tx, ty, def2) => { const p = this.freeTile(m, tx, ty); if (!p) return null; const n = this.makeNpc(Object.assign({ x: p[0] * T + 8, y: p[1] * T + 12 }, def2)); m.npcs.push(n); return n; };
    const near = (tpl, dx, dy) => { const b = L(tpl); return b ? [b.x + dx, b.y + dy] : null; };
    const at = (tpl, dx, dy, d) => { const p = near(tpl, dx, dy); return p && add(p[0], p[1], d); };
    const cond = (a, b) => [[a * H, b * H]];
    // картограф у ворот
    at('gate', 6, -3, { id: 'cart', name: 'Старый картограф', dir: 'down', talk: 'cart_dialog', mark: 'cart', ai: 'idle', reach: 18 });
    // дети играют (бегают быстро)
    for (const [tpl, dx, dy, id] of [['swing_tree', -3, 4, 'kid_m'], ['swing_tree', 5, 4, 'kid_f'], ['academy', -3, 6, 'kid_m'], ['flowers', 4, 5, 'kid_f'], ['market', 0, 5, 'kid_m']]) {
      at(tpl, dx, dy, { id, name: id === 'kid_m' ? 'Мальчишка' : 'Девочка', dir: 'down', ai: 'wander', wanderR: 56, speed: 46, sched: cond(8, 19), talk: [{ who: id, name: id === 'kid_m' ? 'Мальчишка' : 'Девочка', text: pick(['Догоняй! Кто последний — тот Мизуки!', 'Я стану Хокаге! ...Ой, уже занято Наруто.', 'Мы играем в ниндзя! Не мешай!', 'Хи-хи! А ты не поймаешь!']) }] });
    }
    // рыбак и бабушка у воды
    at('pier', 2, 3, { id: 'fisher', name: 'Рыбак', dir: 'down', ai: 'idle', _fish: 1, sched: cond(6, 19), talk: [{ who: 'fisher', name: 'Рыбак', text: 'Клёв сегодня плохой. Но терпение — главное оружие рыбака... и шиноби.' }, { who: 'fisher', name: 'Рыбак', text: 'Наживка — червяки у берега. Просто держи удочку ровнее.' }] });
    at('market', 5, 5, { id: 'courier', name: 'Рассыльный Горо', dir: 'down', ai: 'idle', sched: cond(8, 19), talk: 'courier_talk' });
    at('market', -4, 3, { id: 'merchant', name: 'Торговец', dir: 'down', ai: 'idle', sched: cond(8, 19), talk: [{ who: 'merchant', name: 'Торговец', text: 'Редкие товары! Свитки, амулеты, камешки с Водопада... Всё берут нарасхват.' }] });
    at('hokage_tower', -4, 6, { id: 'chunin', name: 'Чунин-страж', dir: 'down', ai: 'wander', wanderR: 28, sched: cond(6, 22), talk: [{ who: 'chunin', name: 'Чунин-страж', text: 'Башня Хокаге — важный объект. Не шали рядом, парень.' }, { who: 'chunin', name: 'Чунин-страж', text: 'Хокаге принимает посетителей только по записи.' }] });
    at('ichiraku', 4, 5, { id: 'grandma', name: 'Бабушка Тика', dir: 'down', ai: 'wander', wanderR: 24, sched: cond(7, 19), talk: [{ who: 'grandma', name: 'Бабушка Тика', text: pick(['Милый, ты такой худой! Ешь рамен, пока горячий.', 'Раньше тут было всего пять лавок. А теперь — целая улица!', 'Мои внуки в Академии. Если встретишь — передай, пусть учат уроки.'])}] });
    at('dango', 3, 4, { id: 'anko', name: 'Анко', dir: 'down', ai: 'idle', cond: () => G.state.vars.day >= 30, sched: cond(12, 19), talk: 'anko_talk' });
    at('memorial', 3, 4, { id: 'kakashi', name: 'Какаши', dir: 'up', ai: 'idle', cond: () => G.state.vars.day >= 20, sched: cond(6, 11), talk: 'kakashi_talk' });
    at('hokage_tower', 6, 7, { id: 'asuma', name: 'Асума', dir: 'down', ai: 'idle', cond: () => G.state.vars.day >= 15, sched: cond(15, 21), talk: 'asuma_talk' });
    at('uchiha_police', -4, 4, { id: 'chunin', name: 'Страж квартала', dir: 'down', ai: 'wander', wanderR: 28, sched: cond(6, 22), talk: [{ who: 'chunin', name: 'Страж квартала', text: 'Квартал Учиха под наблюдением. Саске живёт здесь один — не беспокой его зря.' }] });
    // группы разговаривающих (пары лицом друг к другу)
    for (const [tpl, dx, dy, a, b] of [['market', 3, 6, 'villager_f', 'villager_m'], ['library', -3, 5, 'villager_m', 'villager_f'], ['teahouse', 4, 5, 'villager_f', 'villager_f']]) {
      const p = near(tpl, dx, dy); if (!p) continue;
      const n1 = add(p[0], p[1], { id: a, name: pick(a === 'villager_m' ? NAMES_M : NAMES_F), dir: 'right', ai: 'idle', sched: cond(8, 20) });
      const n2 = add(p[0] + 1, p[1], { id: b, name: pick(b === 'villager_m' ? NAMES_M : NAMES_F), dir: 'left', ai: 'idle', sched: cond(8, 20) });
      for (const n of [n1, n2]) if (n) { n._chat = 1; n._dt = 'market'; Object.defineProperty(n, 'talk', { configurable: true, get() { return villagerTalk(n); }, set() {} }); }
    }
    return;
  };
  // ── эмоции над головами ──
  const EMO = ['...', '!', '?', '♥', '*'];
  function npcTick(world, n, dt) {
    if (world.map && world.map.outdoor === false && !n._chat && n.ai !== 'idle') return;
    n._em = n._em || { t: 0, cd: 4 + Math.random() * 12, ch: '...' };
    const e = n._em;
    if (e.t > 0) { e.t -= dt; return; }
    e.cd -= dt;
    if (e.cd > 0) return;
    e.cd = 5 + Math.random() * 14;
    let ch = pick(EMO);
    if (n._fish) ch = pick(['...', '!', '~']);
    if (n.id === 'shikamaru' || n.id === 'choji') ch = pick(['Zz', '...']);
    if (n.id === 'sakura' || n.id === 'ino') ch = pick(['♥', '!', '...']);
    if (n.id === 'naruto') ch = pick(['!', '!!', '...']);
    if (n._chat) {
      // «разговор»: собеседник отвечает через секунду
      const other = world.npcs.find((o) => o !== n && o._chat && Math.abs(o.x - n.x) < 22 && Math.abs(o.y - n.y) < 10);
      if (other) { n.dir = n.x < other.x ? 'right' : 'left'; other.dir = other.x < n.x ? 'right' : 'left'; other._em = other._em || { t: 0, cd: 0 }; other._em.ch = pick(['...', '!', '?', '♥']); other._em.t = 1.6; other._em.cd = 2 + Math.random() * 4; other._em.delay = 0.9; }
    }
    e.ch = ch; e.t = 1.6; e.delay = 0;
  }
  function drawEmotes(ctx, world, cx, cy, W, VH) {
    for (const n of world.npcs) {
      const e = n._em;
      if (!e || e.t <= 0 || n.x < cx - 8 || n.x > cx + W + 8 || n.y < cy || n.y > cy + VH + 30) continue;
      if (e.delay > 0) { e.delay -= 0.016; continue; }
      const k = e.t > 1.4 ? (1.6 - e.t) / 0.2 : e.t < 0.3 ? e.t / 0.3 : 1, rise = (1 - k) * 4;
      const x = Math.round(n.x), y = Math.round(n.y - 25 - rise);
      const w = Math.max(11, G.font.width ? G.font.width(e.ch) + 6 : e.ch.length * 5 + 6);
      ctx.save(); ctx.globalAlpha = Math.min(1, k);
      ctx.fillStyle = '#fffaf0'; ctx.fillRect(x - Math.floor(w / 2), y - 5, w, 10); ctx.fillRect(x - 1, y + 5, 3, 2);
      ctx.fillStyle = P.ink; ctx.fillRect(x - Math.floor(w / 2), y - 6, w, 1); ctx.fillRect(x - Math.floor(w / 2), y + 5, w, 1);
      ctx.restore(); ctx.save(); ctx.globalAlpha = Math.min(1, k);
      G.font.draw(ctx, e.ch, x, y - 3, { color: e.ch === '♥' ? '#e8506a' : P.ink, align: 'center' });
      ctx.restore();
    }
  }
  // ── исследовательские задания ──
  const Q = G.QUESTS;
  const visit = (id, tpl, text, extra) => Object.assign({ id, text, target: { building: tpl }, visit: tpl }, extra || {});
  Q.map_tour = {
    cat: 'errand', title: 'Путеводитель по Конохе', desc: 'Старый картограф просит обойти ключевые места деревни и сверить его карту.',
    steps: [visit('gate', 'gate', 'Дойти до Главных ворот'), visit('market', 'market', 'Осмотреть рынок'), visit('tower', 'hokage_tower', 'Дойти до Башни Хокаге'), visit('library', 'library', 'Заглянуть к библиотеке'), visit('rock', 'hokage_rock', 'Увидеть Скалу Хокаге вблизи'),
      { id: 'report', text: 'Вернуться к картографу', target: { npc: 'cart' }, script: 'map_after' }],
    reward: { vars: { friend_naruto: 0 }, text: 'Карта и 150 рё' },
  };
  Q.clan_tour = {
    cat: 'errand', title: 'Кланы Листа', desc: 'Каждый клан Конохи по-своему особенный. Посети их кварталы.',
    steps: [visit('nara', 'clan_nara', 'Квартал Нара'), visit('aki', 'clan_akimichi', 'Квартал Акимичи'), visit('hyuga', 'clan_hyuga', 'Квартал Хьюга'), visit('inu', 'clan_inuzuka', 'Квартал Инудзука')],
    reward: { money: 120, text: '120 рё' },
  };
  Q.waters = {
    cat: 'secret', title: 'Реки и пруды', desc: 'В Конохе вода повсюду. Найди три самых красивых места у воды.',
    offer: { npc: 'fisher', script: 'fisher_offer', when: () => G.state.vars.day >= 2 },
    steps: [visit('pier', 'pier', 'Пирс'), visit('onsen', 'onsen', 'Горячие источники'), visit('fall', 'waterfall', 'Водопад'), { id: 'back', text: 'Рассказать рыбаку', target: { npc: 'fisher' }, script: 'fisher_done' }],
    reward: { money: 90, text: '90 рё и Суйтон' },
  };
  Q.memorial_visit = {
    cat: 'friend', title: 'Камень памяти', desc: 'Какаши иногда стоит у мемориала. Говорят, у него можно кое-что узнать.',
    offer: { npc: 'kakashi', script: 'kakashi_offer', when: () => G.state.vars.day >= 20 },
    steps: [visit('mem', 'memorial', 'Постоять у мемориала'), { id: 'talk', text: 'Поговорить с Какаши', target: { npc: 'kakashi' }, script: 'kakashi_done' }],
    reward: { vars: { friend_iruka: 1 }, money: 60, text: 'Урок памяти' },
  };
  Q.dango_run = {
    cat: 'errand', title: 'Данго для Анко', desc: 'Анко хочет данго, но очередь длинная. Принеси ей коробку.',
    offer: { npc: 'anko', script: 'anko_offer', when: () => G.state.vars.day >= 30 },
    steps: [{ id: 'buy', text: 'Купить данго', target: { building: 'dango' }, have: { dango: 1 } }, { id: 'give', text: 'Отдать Анко', target: { npc: 'anko' }, script: 'anko_done' }],
    reward: { money: 80, text: '80 рё' },
  };
  Q.night_patrol = {
    cat: 'academy', title: 'Ночной обход', desc: 'Страж просит помочь обойти опасные места после заката — убедиться, что всё тихо.',
    offer: { npc: 'chunin', script: 'patrol_offer', when: () => G.state.vars.day >= 5 },
    steps: [{ id: 'a', text: 'Дойти до Квартала Учиха', target: { building: 'uchiha_police' }, visit: 'uchiha_police', time: [20 * 60, 29 * 60] }, visit('b', 'night_alley', 'Заглянуть в ночной переулок', { time: [20 * 60, 29 * 60] }), visit('c', 'memorial', 'Дойти до мемориала', { time: [20 * 60, 29 * 60] })],
    reward: { money: 100, vars: { friend_iruka: 0.5 }, text: '100 рё' },
  };

  // ── курьерские поручения: посылка → адрес → оплата ──
  const ROUTES = [
    ['library', 'Библиотека', 60, 'Свитки для архива'], ['weapons', 'Оружейная', 70, 'Заточка кунаев'], ['pharmacy', 'Аптека', 65, 'Настойки'], ['flowers', 'Цветы Яманака', 55, 'Семена пионов'],
    ['ichiraku', 'Ичираку рамен', 75, 'Мешок муки'], ['teahouse', 'Чайная', 60, 'Листья зелёного чая'], ['hospital', 'Больница', 90, 'Бинты и мази'], ['books', 'Книжная лавка', 65, 'Новые тома'],
    ['onsen', 'Горячие источники', 95, 'Полотенца'], ['dango', 'Данго-лавка', 60, 'Мешок риса'],
  ];
  ROUTES.forEach(([tpl, name, pay, what], i) => {
    Q['courier_' + (i + 1)] = {
      cat: 'errand', title: 'Курьер: ' + name, desc: `Рассыльный Горо просит доставить «${what}» в «${name}». Оплата — на месте.`, deadline: 1,
      steps: [visitIn('deliver', tpl, 'Доставить посылку: ' + name)], reward: { money: pay, text: pay + ' рё' },
    };
  });
  function visitIn(id, tpl, text) { return { id, text, target: { building: tpl }, reach: true, time: [8 * 60, 21 * 60] }; }
  G.script.actions.courier = () => {
    const f = G.state.flags; f.courier_res = 0;
    const active = ROUTES.some((_, i) => G.quests.active('courier_' + (i + 1)));
    if (active) { f.courier_res = 2; return; }
    const left = ROUTES.map((_, i) => 'courier_' + (i + 1)).filter((id) => !G.state.quests || !G.state.quests[id]);
    if (!left.length) { f.courier_res = 3; return; }
    const id = left[Math.floor(Math.random() * left.length)]; G.quests.start(id); G.game.give('parcel', 1); f.courier_res = 1;
    f.courier_name = 0;
  };
  G.events.on('quest', (ev, id) => { if ((ev === 'done' || ev === 'fail') && String(id).startsWith('courier_')) { if (G.game.count('parcel') > 0) G.game.take('parcel', 1); } });
  G.script.parse(`
=== courier_talk
courier[Горо]: Привет! Я рассыльный Горо. Развожу посылки по деревне, а ног на всё не хватает.
call courier
if flag.courier_res == 2 -> busy
if flag.courier_res == 3 -> alldone
if flag.courier_res == 1 -> ok
end
# ok
courier[Горо]: Выручишь? Вот посылка. Открой журнал заданий — там адрес. Доставь до вечера, получишь оплату на месте.
end
# busy
courier[Горо]: Ты ещё не доставил прошлую посылку! Сначала её, потом новая.
end
# alldone
courier[Горо]: Ты разнёс всё, что у меня было! Лучший курьер в Конохе. Приходи позже, наберу заказов.
end

=== ichiraku_cook
teuchi[Теучи]: Хочешь помочь у плиты? Приготовишь миску — заплачу по качеству. Только следи за огнём!
? Что скажешь?
* Помогу! -> yes
* В другой раз -> no
# yes
teuchi[Теучи]: Отлично! Фартук там. Начинаем с лапши.
call train cook
end
# no
teuchi[Теучи]: Как знаешь. Приходи, если надумаешь.
end

=== cart_dialog
if qdone.map_tour -> done
if quest.map_tour -> inprog
-> offer
# offer
call quest start map_tour
cart[Картограф]: Вот уж кого не ждал! Молодой человек, ты как раз вовремя.
cart[Картограф]: Я составляю карту уже сорок лет. Хочешь помочь? Обойди ключевые места: Ворота, рынок, Башню Хокаге, библиотеку и Скалу.
cart[Картограф]: Вернёшься — получишь награду.
end
# inprog
cart[Картограф]: Ещё не всё обошёл? Загляни в журнал заданий — там все точки.
end
# done
cart[Картограф]: Моя карта точна, как никогда. Спасибо тебе, {name}!
end

=== map_after
cart[Картограф]: Ты прошёл все места! Вот твоя награда и ещё кое-что — старая карта тайных тропинок.
call money 150
call step map_tour report
end

=== fisher_offer
fisher[Рыбак]: Хочешь увидеть три красивейших места у воды в Конохе? Пирс, горячие источники и водопад. Загляни, не пожалеешь.
call quest start waters
end

=== fisher_done
fisher[Рыбак]: Видел, как струится вода? Держи секрет: Суйтон, водяная пуля. Вода слушает терпеливых.
set flag.tech_suiton = 1
call note Изучена техника: Суйтон: Водяная пуля
call step waters back
end

=== kakashi_offer
kakashi[Какаши]: А, ты? Заходил к мемориалу? Если хочешь — постой там немного. Это помогает собраться.
call quest start memorial_visit
end

=== kakashi_done
kakashi[Какаши]: Вот видишь. Иногда тишина учит лучше уроков.
kakashi[Какаши]: Держи подарок: Райтон — разряд. Не злоупотребляй, ладно?
set flag.tech_raiton = 1
call note Изучена техника: Райтон: Разряд
call friend iruka 1
call step memorial_visit talk
end

=== anko_offer
anko[Анко]: Эй! Сгоняй за данго, а? Очередь страшная, а я на задании.
call quest start dango_run
end

=== anko_done
anko[Анко]: Данго! О, да! Держи, заслужил.
call take dango 1
call step dango_run give
end

=== patrol_offer
chunin[Страж]: Ночью в деревне бывает неспокойно. Можешь пройтись по квартальному обходу после 20:00?
call quest start night_patrol
end
`);
  // ── проверка «приблизился к месту» для шагов visit ──
  let acc = 0;
  function poll(world, dt) {
    acc += dt; if (acc < 0.4) return; acc = 0;
    const m = world.map; if (!m || !m.outdoor) return;
    const p = world.player, tx = p.x / T, ty = p.y / T;
    for (const id of G.quests.activeList()) {
      const st = G.quests.curStep(id);
      if (!st || !st.visit || !G.quests.timeOk(st)) continue;
      const b = (m.buildings || []).find((x) => x.tplId === st.visit) || (m.spots && m.spots[st.visit]);
      if (!b) continue;
      const cx = (b.tx != null ? b.tx : b.x) + (b.tw || 1) / 2, cy = (b.ty != null ? b.ty : b.y) + (b.th || 1) / 2;
      if (Math.abs(tx - cx) < (b.tw || 1) / 2 + 5 && Math.abs(ty - cy) < (b.th || 1) / 2 + 5) {
        G.quests.step(id, st.id); world.showToast && world.showToast('Место найдено: ' + (b.name || st.text)); G.audio.sfx.confirm();
      }
    }
  }
  return { npcTick, drawEmotes, poll, villagerTalk };
})();
