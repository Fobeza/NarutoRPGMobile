// Малые задания (категория «errand»): 1–2 шага, «принеси предмет» от известных жителей. Деньги, иногда дружба.
// Таблица: [id, кто, где (интерьер), название, просьба, предмет, штук, награда рё, друг+, благодарность, с какого дня]
(() => {
  const T = [
    ['sm_teuchi_fish', 'teuchi', 'ichiraku', 'Рыба для бульона', 'Теучи: Бульон кончается, а свежей рыбы нет. Принесёшь пару рыбин? Заплачу.', 'fish', 2, 70, null, 'Отличная рыба! Бульон выйдет на славу.', 3],
    ['sm_ayame_eggs', 'ayame', 'ichiraku', 'Яйца для Аяме', 'Аяме: Папа забыл купить яйца для омлета. Сбегаешь на рынок?', 'eggs', 2, 50, null, 'Спасибо! Омлет будет вовремя.', 3],
    ['sm_choji_milk', 'choji', null, 'Молоко для Чоджи', 'Чоджи: У меня горло пересохло после чипсов. Принесёшь молока?', 'milk', 1, 40, 'choji', 'Хрум... спасибо! Ты настоящий друг.', 4],
    ['sm_kiba_treat', 'kiba', null, 'Лакомство для Акамару', 'Киба: Акамару заслужил награду. Сгоняй в лавку Инузука, возьми лакомства?', 'dog_treat', 2, 60, 'kiba', 'Гав! Акамару в восторге. Держи.', 4],
    ['sm_lee_weights', 'lee', null, 'Утяжелители для Ли', 'Ли: Мои утяжелители стали слишком лёгкими! Достань новые, и я покажу, как работает сила юности!', 'weights', 1, 100, 'lee', 'Сила юности растёт! Спасибо!', 6],
    ['sm_ino_blue', 'ino', 'flowers', 'Голубая трава для Ино', 'Ино: Для особого букета нужна голубая трава. Найдёшь для меня?', 'herb_blue', 1, 90, 'ino', 'То, что надо! Букет будет сказочный.', 5],
    ['sm_sakura_notebook', 'sakura', null, 'Блокнот для Сакуры', 'Сакура: Мои конспекты не помещаются в тетради. Принеси блокнот из книжной лавки?', 'notebook', 1, 40, 'sakura', 'Ого, как раз то, что нужно!', 4],
    ['sm_sasuke_tomato', 'sasuke', null, 'Томаты для Саске', 'Саске: ...Нужны томаты. Не спрашивай зачем. Принесёшь пару?', 'tomato', 2, 60, 'sasuke', '...Хм. Спасибо.', 6],
    ['sm_anko_dango', 'anko', null, 'Данго для Анко', 'Анко: Данго! Мне срочно нужны три палочки данго. Беги в лавку!', 'dango', 3, 120, null, 'Хррум... Ты мой любимый ученик!', 7],
    ['sm_ayame_mochi', 'ayame', 'ichiraku', 'Моти для Аяме', 'Аяме: Хочу угостить подругу. Принесёшь рисовые лепёшки?', 'mochi', 1, 45, null, 'Мягкие, как надо! Спасибо.', 6],
    ['sm_anko_tea', 'anko', null, 'Чай для Анко', 'Анко: К данго нужен сладкий чай. Принесёшь?', 'sweet_tea', 1, 40, null, 'Идеально! Теперь можно жить.', 8],
    ['sm_shino_herb', 'shino', null, 'Травы для насекомых', 'Шино: Моим жукам нужны свежие травы. Принесёшь две?', 'herb', 2, 55, 'shino', 'Спасибо. Жуки довольны.', 7],
    ['sm_choji_berries', 'choji', null, 'Ягоды для Чоджи', 'Чоджи: Хочу ягод к чаю. Найдёшь три?', 'berries', 3, 40, 'choji', 'Хрум! Кисло-сладко, как надо.', 8],
    ['sm_sasuke_kunai', 'sasuke', null, 'Кунаи для Саске', 'Саске: Мне нужны три кунаи. Не спрашивай, зачем.', 'kunai', 3, 60, 'sasuke', '...Спасибо.', 10],
    ['sm_ayame_tea', 'ayame', 'ichiraku', 'Чай для посетителей', 'Аяме: Зелёный чай закончился. Купишь пачку?', 'green_tea', 1, 40, null, 'Спасибо! Клиенты довольны.', 4],
  ];
  // [id, кто, где, название, просьба, событие, фильтр, награда рё, друг+, реплика после, с какого дня]
  const D = [
    ['sm_teuchi_big', 'teuchi', 'ichiraku', 'Попробуй большую порцию', 'Теучи: Хочу узнать, осилишь ли ты большую порцию. Попробуешь?', 'bought', (id) => id === 'ramen_big', 50, null, 'Ха-ха! Осилил! Приходи ещё.', 6],
    ['sm_ayame_cook', 'ayame', 'ichiraku', 'Свой обед', 'Аяме: Говорят, ты неплохо готовишь. Приготовишь себе обед сам?', 'cooked', null, 40, null, 'Молодец! Теперь ты почти шеф.', 5],
    ['sm_choji_cook', 'choji', null, 'Приготовь что-нибудь', 'Чоджи: Ты умеешь готовить? Давай приготовь что-нибудь, мне интересно.', 'cooked', null, 45, 'choji', 'Хрум... Неплохо. Очень неплохо!', 6],
    ['sm_kiba_fish', 'kiba', null, 'Рыба для Акамару', 'Киба: Акамару захотел рыбы. Поймаешь?', 'fished', (id) => !!id, 45, 'kiba', 'Гав-гав! Спасибо за улов!', 7],
    ['sm_lee_dummy', 'lee', null, 'Удары по манекену', 'Ли: Отдай тысячу ударов манекену! Покажи, что ты не сдаёшься!', 'training', (id) => id === 'dummy' || id === 'log', 60, 'lee', 'Сила юности растёт! Молодец!', 9],
    ['sm_anko_sell', 'anko', null, 'Продай улов', 'Анко: Рыбу можно продавать на рынке. Поймай и продай, получишь рё.', 'sold', null, 50, null, 'Видишь? Мозги работают! Держи премию.', 8],
    ['sm_sasuke_throw', 'sasuke', null, 'Метание', 'Саске: Покажи, как ты метаешь. Поработай на полигоне.', 'training', (id) => id === 'throw', 55, 'sasuke', '...Хм. Не плохо.', 8],
    ['sm_shikamaru_med', 'shikamaru', 'academy', 'Минутка тишины', 'Шикамару: Помедитируй где-нибудь. Тихо. Хлопотно, но полезно.', 'training', (id) => id === 'meditate' || id === 'falls', 45, 'shikamaru', 'Тишина... Хорошо.', 7],
    ['sm_sakura_read', 'sakura', null, 'Прочитай книгу', 'Сакура: Ты читаешь вообще? Давай, сходи в библиотеку.', 'training', (id) => id === 'library' || id === 'book', 45, 'sakura', 'Видишь, не так страшно!', 6],
    ['sm_hinata_gift', 'hinata', null, 'Подарок другу', 'Хината: Мне кажется... надо дарить друзьям подарки. Подаришь кому-нибудь?', 'gift', null, 40, 'hinata', 'Эт-это хорошо. Спасибо.', 7],
    ['sm_naruto_roof', 'naruto', null, 'Прыжок на крышу', 'Наруто: Давай ты запрыгнешь на крышу, а я посмотрю! Спорим, у тебя получится?', 'roof', null, 50, 'naruto', 'Круто! Это было классно!', 8],
    ['sm_iruka_job', 'iruka', 'academy', 'Первая подработка', 'Ирука: Попробуй взять поручение на доске. Это полезный опыт.', 'job', null, 60, 'iruka', 'Молодец. Ответственность — это важно.', 7],
    ['sm_shino_bug', 'shino', null, 'Тишина леса', 'Шино: Пойди в Лес Нара и потренируй скрытность. Насекомые там любят тишину.', 'training', (id) => id === 'stealth', 55, 'shino', 'Насекомые довольны.', 10],
    ['sm_guy_run', 'guy', null, 'Пробежка по крышам', 'Гай: Пробеги по улицам, юноша! Сила юности требует движения!', 'training', (id) => id === 'run', 70, 'lee', 'Прекрасно! Вот это энергия!', 10],
    ['sm_teuchi_gift', 'teuchi', 'ichiraku', 'Подарок от души', 'Теучи: Хочешь стать настоящим другом? Подари что-нибудь другу, не жалей.', 'gift', null, 40, null, 'Правильно. Дружба стоит дороже рё.', 6],
  ];
  // ── Дела (категория errand): не «принеси», а действие в мире с окном по времени и 2–3 шагами.
  // Шаг закрывается событием мира (on), входом в здание (reach) или разговором (script).
  const M = [
    {
      id: 'sm_patrol', npc: 'iruka', in: 'academy', day: 7, pay: 90, friend: 'iruka',
      title: 'Ночной обход', desc: 'Ирука просит пройтись по деревне с наступлением темноты и проверить, всё ли спокойно.',
      ask: 'Ирука: Вечером нужен обход: фонари, ворота, дворы. Пройдёшься по крышам и посмотришь, всё ли тихо?',
      thanks: 'Ирука: Спасибо. Пока ученики следят за деревней, деревня спит спокойно.',
      steps: [
        { id: 'come', text: 'Прийти в Академию вечером (после 18:00)', target: { building: 'academy' }, reach: true, time: [18 * 60, 23 * 60] },
        { id: 'round', text: 'Пройти по крышам: прыжок на крышу (A у стены)', target: { building: 'academy' }, on: ['roof'], time: [18 * 60, 24 * 60] },
        { id: 'report', text: 'Доложить Ируке', target: { npc: 'iruka', in: 'academy' }, script: 'sm_patrol_report', time: [18 * 60, 25 * 60] },
      ],
    },
    {
      id: 'sm_cat', npc: 'ino', in: 'flowers', day: 6, pay: 80, friend: 'ino',
      title: 'Кошка с рынка', desc: 'У Ино пропала кошка: просит проследить за ней у лавки и привести домой.',
      ask: 'Ино: Моя кошка сбежала к рынку и ворует рыбу у торговцев. Поможешь её найти? Только приходи днём.',
      thanks: 'Ино: Нашёл! Смотри, какая довольная. Ты просто волшебник.',
      steps: [
        { id: 'look', text: 'Поискать кошку у цветочной лавки днём', target: { building: 'flowers' }, reach: true, time: [10 * 60, 17 * 60] },
        { id: 'catch', text: 'Поймать кошку: принести рыбу', target: { building: 'market' }, have: { fish: 1 }, time: [10 * 60, 18 * 60], intro: 'sm_cat_intro' },
        { id: 'back', text: 'Вернуть кошку Ино', target: { npc: 'ino', in: 'flowers' }, script: 'sm_cat_back', need: { fish: 0 }, time: [10 * 60, 18 * 60] },
      ],
    },
    {
      id: 'sm_kitchen', npc: 'ayame', in: 'ichiraku', day: 5, pay: 100, friend: null,
      title: 'Заказ на кухне', desc: 'Аяме просит приготовить обед для посетителей: не принести, а сделать своими руками.',
      ask: 'Аяме: У нас сегодня много гостей, а папа ушёл за рыбой. Приготовишь что-нибудь на кухне?',
      thanks: 'Аяме: Пахнет как у папы! Гости будут довольны.',
      steps: [
        { id: 'ask', text: 'Прийти в Ичираку и поговорить с Аяме', target: { npc: 'ayame', in: 'ichiraku' }, reach: true, time: [10 * 60, 19 * 60] },
        { id: 'cook', text: 'Приготовить блюдо (дома или в Ичираку)', target: { building: 'ichiraku' }, on: ['cooked'], time: [10 * 60, 22 * 60] },
        { id: 'serve', text: 'Отнести обед Аяме', target: { npc: 'ayame', in: 'ichiraku' }, script: 'sm_kitchen_report', time: [10 * 60, 22 * 60] },
      ],
    },
    {
      id: 'sm_delivery', npc: 'iruka', in: 'academy', day: 8, pay: 120, friend: null,
      title: 'Срочная доставка', desc: 'Пакет с бумагами нужно донести до Резиденции Хокаге до закрытия — опоздание не принимается.',
      ask: 'Ирука: Нужно отнести бумаги в Резиденцию Хокаге. До вечера, иначе канцелярия закроется. Успеешь?',
      thanks: 'Ирука: Вовремя! Канцелярия как раз закрывалась. Это и есть ответственность.',
      steps: [
        { id: 'take', text: 'Забрать пакет у Ируки', target: { npc: 'iruka', in: 'academy' }, script: 'sm_delivery_take', time: [8 * 60, 15 * 60] },
        { id: 'run', text: 'Отнести пакет в Резиденцию Хокаге до 19:00', target: { building: 'hokage_tower' }, reach: true, time: [8 * 60, 19 * 60], after: 'sm_delivery_done' },
      ],
    },
    {
      id: 'sm_hospital', npc: 'shizune', in: 'hospital', day: 9, pay: 90, friend: null,
      title: 'Помощь в больнице', desc: 'Шизуне нужны лишние руки: разложить бинты, проводить больных, пройти осмотр самому.',
      ask: 'Шизуне: У нас завал. Поможешь до вечера: бинты по ящикам, больные по палатам. И сам осмотр пройди, кстати.',
      thanks: 'Шизуне: Без тебя мы бы не успели. Заходи, когда захочешь — руки всегда нужны.',
      steps: [
        { id: 'come', text: 'Прийти в больницу до вечера', target: { building: 'hospital' }, reach: true, time: [8 * 60, 18 * 60], intro: 'sm_hospital_intro' },
        { id: 'help', text: 'Помочь по палатам: пройти осмотр', target: { building: 'hospital' }, on: ['checkup'], time: [8 * 60, 19 * 60] },
        { id: 'report', text: 'Доложить Шизуне', target: { npc: 'shizune', in: 'hospital' }, script: 'sm_hospital_report', time: [8 * 60, 19 * 60] },
      ],
    },
    {
      id: 'sm_shogi', npc: 'shikamaru', in: 'academy', day: 7, pay: 70, friend: 'shikamaru',
      title: 'Урок шоги', desc: 'Шикамару не отдаёт подарок просто так: сначала партия и тренировка, потом разговор.',
      ask: 'Шикамару: Хочешь сыграть? Только не «просто поговорить»: сначала партия, потом тренировка ума. Хлопотно, но полезно.',
      thanks: 'Шикамару: Неплохо. Из тебя выйдет толк... если не будешь лениться, как я.',
      steps: [
        { id: 'come', text: 'Прийти к Шикамару днём', target: { npc: 'shikamaru', in: 'academy' }, reach: true, time: [9 * 60, 17 * 60] },
        { id: 'play', text: 'Сыграть партию и потренировать ум: чтение или медитация', target: { building: 'academy' }, on: ['training', (id) => id === 'shogi' || id === 'library' || id === 'meditate'], time: [9 * 60, 21 * 60] },
        { id: 'talk', text: 'Поговорить с Шикамару после партии', target: { npc: 'shikamaru', in: 'academy' }, script: 'sm_shogi_report', time: [9 * 60, 21 * 60] },
      ],
    },
  ];
  let src = '';
  for (const [id, npc, inB, title, ask, item, n, pay, friend, thanks, day] of T) {
    const name = G.chars.nameOf(npc);
    const reward = { money: pay, text: pay + ' рё' };
    if (friend) reward.vars = { ['friend_' + friend]: 1 };
    G.QUESTS[id] = {
      cat: 'errand', title, desc: ask.replace(/^[^:]+: /, ''),
      offer: { npc, in: inB || undefined, script: id + '_offer', when: () => G.state.started && G.state.vars.day >= day },
      steps: [
        { id: 'get', text: 'Принести: ' + G.ITEMS[item].name + (n > 1 ? ' ×' + n : ''), target: { npc, in: inB || undefined }, have: { [item]: n } },
        { id: 'give', text: 'Отдать: ' + name, target: { npc, in: inB || undefined }, need: { [item]: n }, consume: true, script: id + '_done' },
      ],
      reward,
    };
    src += `=== ${id}_offer\n${ask.replace(/^[^:]+: /, npc + ': ')}\n? Поможешь?\n* Да -> yes\n* Потом -> no\n# yes\ncall quest start ${id}\nend\n# no\nend\n=== ${id}_done\n${npc}: ${thanks}\ncall step ${id} give\nend\n`;
  }
  for (const [id, npc, inB, title, ask, ev, flt, pay, friend, thanks, day] of D) {
    const reward = { money: pay, text: pay + ' рё' };
    if (friend) reward.vars = { ['friend_' + friend]: 1 };
    G.QUESTS[id] = {
      cat: 'errand', title, desc: ask.replace(/^[^:]+: /, ''),
      offer: { npc, in: inB || undefined, script: id + '_offer', when: () => G.state.started && G.state.vars.day >= day },
      steps: [{ id: 'do', text: title, target: { npc, in: inB || undefined }, on: flt ? [ev, flt] : [ev], after: id + '_done' }],
      reward,
    };
    src += `=== ${id}_offer\n${ask.replace(/^[^:]+: /, npc + ': ')}\n? Возьмёшься?\n* Да -> yes\n* Потом -> no\n# yes\ncall quest start ${id}\nend\n# no\nend\n=== ${id}_done\n${npc}: ${thanks}\nend\n`;
  }
  for (const q of M) {
    const name = G.chars.nameOf(q.npc), inB = q.in || undefined;
    const reward = { money: q.pay, text: q.pay + ' рё' };
    if (q.friend) reward.vars = { ['friend_' + q.friend]: 1 };
    G.QUESTS[q.id] = {
      cat: 'errand', title: q.title, desc: q.desc,
      deadline: q.deadline || null,
      offer: { npc: q.npc, in: inB, script: q.id + '_offer', when: () => G.state.started && G.state.vars.day >= q.day },
      steps: q.steps,
      reward,
    };
    src += `=== ${q.id}_offer\n${q.ask.replace(/^[^:]+: /, q.npc + ': ')}\n? Возьмёшься?\n* Да -> yes\n* Потом -> no\n# yes\ncall quest start ${q.id}\nend\n# no\nend\n`;
    const said = (text) => `${q.npc}[${name}]: ${String(text).replace(/^[^:]+:\s*/, '')}`;
    for (const st of q.steps) if (st.script) {
      const line = ['report', 'back', 'serve', 'talk'].includes(st.id) ? said(q.thanks) : said('Хорошо. Жду.');
      src += `=== ${st.script}\n${line}\ncall step ${q.id} ${st.id}\nend\n`;
    }
  }
  // сцены входов/подсказок для дел
  src += `=== sm_cat_intro\n: Кошка сидит на бочках у рынка и смотрит на тебя без всякого страха.\n: Рыба в сумке — единственный аргумент, который она понимает.\nend\n`;
  src += `=== sm_hospital_intro\n: В больнице пахнет травами и спиртом. Шизуне раскладывает бинты и что-то бормочет про отчёты.\nshizune[Шизуне]: О, ты вовремя. Бери ящик и не путай бинты с компрессами.\nend\n`;
  src += `=== sm_delivery_take\niruka[Ирука]: Вот, держи. Пакет запечатан, не открывай. И не беги через рынок — там сегодня давка.\n: Пакет лёгкий, но почему-то кажется тяжёлым.\ncall step sm_delivery take\nend\n`;
  src += `=== sm_delivery_done\n: Канцелярия гудит ульем. Чиновник принимает пакет, ставит печать и кивает: «Вовремя».\n: На улице ты выдыхаешь. Успел.\nend\n`;
  G.script.parse(src);
})();
