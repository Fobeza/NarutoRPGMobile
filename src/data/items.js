// Предметы и лавки (план §5.4).
// cat: food — съедается сразу; tool/med — в подсумок (pouch); gift, book, misc — в сумку; service — услуга на месте.
// effect: { rest (усталость −n), hp, minutes } — применяется при покупке еды и услуг.
G.ITEMS = {
  // ── Ичираку ──
  ramen_miso:   { name: 'Мисо-рамен',        price: 40,  cat: 'food', ramen: true, effect: { rest: 21, minutes: 20 }, desc: 'Фирменный рамен Теучи. Сытно и тепло.' },
  ramen_pork:   { name: 'Свиной рамен',      price: 50,  cat: 'food', ramen: true, effect: { rest: 27, minutes: 20 }, desc: 'Густой бульон и много чашу.' },
  ramen_big:    { name: 'Большая порция',    price: 80,  cat: 'food', ramen: true, effect: { rest: 52, minutes: 30 }, desc: 'Огромная миска. Наруто съедает три.' },
  // ── Якинику Q ──
  yakiniku_one: { name: 'Сет на одного',     price: 150, cat: 'food', effect: { rest: 48, minutes: 45 }, desc: 'Жаришь мясо сам. Дорого, но вкусно.' },
  // ── Данго и чайная ──
  dango:        { name: 'Данго',             price: 20,  cat: 'food', effect: { rest: 6, minutes: 10 }, desc: 'Три шарика на палочке. Любимое лакомство Анко.' },
  sweet_tea:    { name: 'Сладкий чай',       price: 15,  cat: 'food', effect: { rest: 5, minutes: 10 }, desc: 'Тёплый и сладкий.' },
  green_tea:    { name: 'Зелёный чай',       price: 15,  cat: 'food', effect: { rest: 6, minutes: 15 }, desc: 'Бодрит немного.' },
  mochi:        { name: 'Рисовые лепёшки',   price: 25,  cat: 'food', effect: { rest: 12, minutes: 15 }, desc: 'Мягкие моти с бобовой пастой.' },
  // ── Оружейная ──
  kunai:        { name: 'Кунай',             price: 15,  cat: 'tool', pouch: true, desc: 'Бросок или ближний бой. Основа арсенала шиноби.' },
  shuriken:     { name: 'Сюрикен',           price: 10,  cat: 'tool', pouch: true, desc: 'Быстрый бросок. Урон меньше, чем у куная.' },
  wire:         { name: 'Проволока',         price: 40,  cat: 'tool', pouch: true, desc: 'Для ловушек и связок с кунаем.' },
  smoke_bomb:   { name: 'Дымовая бомба',     price: 50,  cat: 'tool', pouch: true, desc: 'Скрывает тебя от противника на ход.' },
  flash_bomb:   { name: 'Световая бомба',    price: 60,  cat: 'tool', pouch: true, desc: 'Ослепляет противника.' },
  tag_explosive:{ name: 'Взрывная печать',   price: 120, cat: 'tool', pouch: true, week: 6, desc: 'Мощный взрыв. Только с разрешения Ируки.' },
  // ── Аптека ──
  bandage:      { name: 'Бинт',              price: 20,  cat: 'med', pouch: true, effect: { hp: 25 }, desc: 'Здоровье +25%. Применить в сумке или в бою.' },
  ointment:     { name: 'Мазь',              price: 50,  cat: 'med', pouch: true, effect: { injury: 1, hp: 10 }, desc: 'Снимает день травмы, здоровье +10%. Применить в сумке.' },
  chakra_pill:  { name: 'Пилюля чакры',      price: 80,  cat: 'med', pouch: true, effect: { chakra: 50 }, desc: 'Чакра +50%. Применить в сумке или в бою.' },
  antidote:     { name: 'Противоядие',       price: 40,  cat: 'med', pouch: true, effect: { poison: 1 }, desc: 'Снимает отравление. Применить в сумке.' },
  herb_tea:     { name: 'Травяной чай',      price: 30,  cat: 'misc', effect: { sleep: 1 }, desc: 'Перед сном: усталость снимается, чакра полностью, здоровье +50%.' },
  // ── Книжная лавка ──
  book_history: { name: 'История Конохи',    price: 80,  cat: 'book', desc: 'Книга для чтения дома за столом (+Знания).' },
  book_traps:   { name: 'Теория ловушек',    price: 200, cat: 'book', desc: 'Свиток о ловушках. Без него в бою нельзя ставить ловушки.' },
  map_secrets:  { name: 'Карта с секретами', price: 100, cat: 'book', desc: 'Отмечает тайные места на карте.' },
  // ── Подарки ──
  flowers_s:    { name: 'Букет ромашек',     price: 20,  cat: 'gift', desc: 'Скромный, но милый подарок.' },
  flowers_m:    { name: 'Букет роз',         price: 40,  cat: 'gift', desc: 'Красивый букет.' },
  flowers_l:    { name: 'Большой букет',     price: 60,  cat: 'gift', desc: 'Лучший букет в лавке Яманака.' },
  dog_food:     { name: 'Собачий корм',      price: 30,  cat: 'gift', desc: 'Для нинкенов клана Инузука.' },
  dog_treat:    { name: 'Лакомство',         price: 50,  cat: 'gift', desc: 'Акамару будет в восторге. И кошка Тора тоже...' },
  shogi:        { name: 'Набор шоги',        price: 90,  cat: 'gift', desc: 'Шикамару точно оценит.' },
  chips:        { name: 'Чипсы',             price: 15,  cat: 'gift', desc: 'Любимая еда Чоджи.' },
  hairpin:      { name: 'Заколка',           price: 35,  cat: 'gift', desc: 'Украшение для волос.' },
  tomato:       { name: 'Помидоры',          price: 12,  cat: 'gift', desc: 'Саске их обожает. Тайно.' },
  bug_jar:      { name: 'Банка с жуками',    price: 30,  cat: 'gift', desc: 'Редкие жуки-светлячки. Для ценителя.' },
  weights:      { name: 'Утяжелители',       price: 120, cat: 'gift', desc: 'Для тренировок. Рок Ли будет в восторге.' },
  charm:        { name: 'Амулет на удачу',   price: 45,  cat: 'gift', desc: 'Говорят, помогает на экзаменах.' },
  // ── Рынок ──
  rice:         { name: 'Рис',               price: 10,  cat: 'misc', desc: 'Для готовки дома (этап 7).' },
  fish:         { name: 'Рыба',              price: 25,  cat: 'misc', desc: 'Для готовки дома (этап 7).' },
  vegetables:   { name: 'Овощи',             price: 15,  cat: 'misc', desc: 'Для готовки дома (этап 7).' },
  eggs:         { name: 'Яйца',              price: 12,  cat: 'misc', desc: 'Для готовки дома (этап 7).' },
  milk:         { name: 'Молоко',            price: 10,  cat: 'misc', desc: 'Свежее! Не как у Наруто дома.' },
  // ── Обычные лавки ──
  parcel:       { name: 'Посылка',           price: 0,   cat: 'misc', desc: 'Курьерская посылка. Доставь по адресу в срок.' },
  fishing_rod:  { name: 'Удочка',            price: 80,  cat: 'tool', desc: 'Рыбалка у озера, реки и пристани. Подойди к воде и нажми A.' },
  carp:         { name: 'Золотой карп',      price: 120, cat: 'gift', desc: 'Редкий улов! Можно подарить или продать на рынке.' },
  eel:          { name: 'Угорь',             price: 50,  cat: 'misc', desc: 'Для унаги-дона на домашней кухне.' },
  boot:         { name: 'Старый сапог',      price: 2,   cat: 'misc', desc: 'Улов так себе. Рынок купит за гроши.' },
  herb:         { name: 'Лечебная трава',    price: 12,  cat: 'misc', desc: 'Из трав дома можно сделать мазь, чай или пилюлю.' },
  herb_blue:    { name: 'Голубой лотос',     price: 45,  cat: 'gift', desc: 'Редкий цветок у воды. Для пилюль чакры — или в подарок.' },
  berries:      { name: 'Лесные ягоды',      price: 6,   cat: 'food', effect: { rest: 4, minutes: 2 }, desc: 'Кисло-сладкие, прямо с куста.' },
  candy:        { name: 'Леденцы',           price: 5,   cat: 'food', effect: { rest: 1, minutes: 2 }, desc: 'Кисло-сладкие.' },
  towel:        { name: 'Полотенце',         price: 20,  cat: 'misc', desc: 'Пригодится после тренировки.' },
  notebook:     { name: 'Тетрадь',           price: 10,  cat: 'misc', desc: 'Для конспектов на уроках Ируки.' },
  // ── Для заданий ──
  bouquet_ino:  { name: 'Букет для Хинаты',  price: 0,   cat: 'misc', quest: true, desc: 'Букет от Ино. Нужно отнести Хинате к особняку Хьюга.' },
  // ── Услуги ──
  onsen_bath:   { name: 'Искупаться',        price: 30,  cat: 'service', effect: { rest: 100, minutes: 60 }, desc: 'Горячий источник: усталость снимается полностью.' },
};

// Лавки: id совпадает с шаблоном здания (tplId). keeper — кто стоит за прилавком.
// hours: [открытие, закрытие] в минутах. stock — список id предметов.
G.SHOPS = {
  ichiraku:     { keeper: { who: 'teuchi' }, greet: 'Добро пожаловать в Ичираку! Что будешь?', hours: [9 * 60, 23 * 60], stock: ['ramen_miso', 'ramen_pork', 'ramen_big'] },
  yakiniku:     { keeper: { who: 'villager_m', name: 'Повар' }, greet: 'Якинику Q! Мясо жарим прямо за столом.', hours: [11 * 60, 23 * 60], stock: ['yakiniku_one', 'green_tea'] },
  dango:        { keeper: { who: 'villager_f', name: 'Продавщица' }, greet: 'Сладкие данго! Анко-сан берёт сразу дюжину.', hours: [9 * 60, 20 * 60], stock: ['dango', 'sweet_tea'] },
  teahouse:     { keeper: { who: 'villager_f', name: 'Хозяйка' }, greet: 'Зелёный чай и тишина. Здесь хорошо думается.', hours: [8 * 60, 21 * 60], stock: ['green_tea', 'mochi'] },
  weapons:      { keeper: { who: 'villager_m', name: 'Оружейник' }, greet: 'Заходи, ученик! Кунаи, сюрикены — всё для Академии.', hours: [8 * 60, 19 * 60], stock: ['kunai', 'shuriken', 'wire', 'smoke_bomb', 'flash_bomb', 'tag_explosive', 'weights'] },
  pharmacy:     { keeper: { who: 'villager_f', name: 'Аптекарь' }, greet: 'Пилюли, бинты и мази. Поранишься — сначала ко мне.', hours: [8 * 60, 20 * 60], stock: ['bandage', 'ointment', 'chakra_pill', 'antidote', 'herb_tea'], buys: ['herb', 'herb_blue'] },
  books:        { keeper: { who: 'villager_m', name: 'Книжник' }, greet: 'Свитки, учебники, романы... «Ича-Ича»? Тебе рано, малец.', hours: [9 * 60, 19 * 60], stock: ['book_history', 'book_traps', 'map_secrets', 'notebook'] },
  flowers:      { keeper: { who: 'ino' }, greet: 'Добро пожаловать в «Цветы Яманака»! Ищешь подарок?', hours: [8 * 60, 19 * 60], stock: ['flowers_s', 'flowers_m', 'flowers_l'] },
  inuzuka_shop: { keeper: { who: 'villager_f', name: 'Продавщица' }, greet: 'Корм и лакомства для нинкенов. Клан Инузука плохого не продаёт!', hours: [8 * 60, 19 * 60], stock: ['dog_food', 'dog_treat'] },
  souvenir:     { keeper: { who: 'villager_m', name: 'Торговец' }, greet: 'Сувениры! Отличные подарки для друзей.', hours: [9 * 60, 20 * 60], stock: ['shogi', 'chips', 'hairpin', 'charm', 'candy', 'bug_jar', 'fishing_rod'] },
  night:        { keeper: { who: 'thief', name: 'Ночной торговец' }, greet: 'Тс-с... Редкий товар. Не спрашивай, откуда.', hours: [21 * 60, 26 * 60], stock: ['map_secrets', 'chakra_pill', 'smoke_bomb', 'flash_bomb', 'tag_explosive', 'weights'] },
  market:       { keeper: { who: 'villager_f', name: 'Торговка' }, greet: 'Свежие овощи, рис, рыба!', hours: [7 * 60, 18 * 60], stock: ['rice', 'fish', 'vegetables', 'eggs', 'milk', 'tomato'], buys: ['fish', 'carp', 'eel', 'boot', 'berries'] },
  shop_generic: { keeper: { who: 'villager_m', name: 'Лавочник' }, greet: 'Заходи, смотри! Цены честные.', hours: [8 * 60, 19 * 60], stock: ['candy', 'towel', 'notebook', 'chips'] },
  onsen:        { keeper: { who: 'villager_f', name: 'Хозяйка онсена' }, greet: 'Горячие источники восстанавливают силы. Мужская половина — направо.', hours: [10 * 60, 23 * 60], stock: ['onsen_bath'] },
};
