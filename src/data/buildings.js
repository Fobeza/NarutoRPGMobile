// Шаблоны зданий, районов и дорог. Общие для игры (генератор карты, этап 2) и редактора карты.
// Размеры — в тайлах. door: [dx, dy] — клетка двери относительно левого верхнего угла.
G.BUILDINGS = {
  // ---------- Жильё ----------
  house_s:     { name: 'Дом малый',          w: 4, h: 4, cat: 'house', color: '#c8a878', door: [1, 3] },
  house_m:     { name: 'Дом средний',        w: 5, h: 5, cat: 'house', color: '#c09868', door: [2, 4] },
  apartment:   { name: 'Многоэтажка',        w: 6, h: 6, cat: 'house', color: '#b8a088', door: [2, 5] },
  // плотная застройка (автогенератор): разные размеры и силуэты
  house_xs:    { name: 'Домик',              w: 3, h: 3, cat: 'house', color: '#c8a878', door: [1, 2] },
  house_n:     { name: 'Узкий дом',          w: 3, h: 4, cat: 'house', color: '#c8a878', door: [1, 3] },
  house_w:     { name: 'Широкий дом',        w: 6, h: 4, cat: 'house', color: '#c09868', door: [2, 3] },
  house_t:     { name: 'Двухэтажный дом',    w: 4, h: 5, cat: 'house', color: '#c09868', door: [1, 4], floors: 2 },
  apartment_s: { name: 'Малоэтажка',         w: 5, h: 5, cat: 'house', color: '#b8a088', door: [2, 4], multi: true, ov: 24 },
  tower_r:     { name: 'Круглый дом',        w: 4, h: 5, cat: 'house', color: '#d8c8a8', door: [1, 4], style: 'round', ov: 20 },
  hero_home:   { name: 'Дом героя',          w: 4, h: 4, cat: 'house', color: '#e8a050', door: [1, 3], unique: true, interior: 'hero_home' },
  naruto_flat: { name: 'Квартира Наруто',    w: 5, h: 6, cat: 'house', color: '#e8804a', door: [2, 5], unique: true, interior: 'naruto_flat' },

  // ---------- Еда ----------
  ichiraku:    { name: 'Ичираку рамен',      w: 4, h: 3, cat: 'food', color: '#e84a3a', door: [1, 2], unique: true, interior: 'ichiraku' },
  yakiniku:    { name: 'Якинику Q',          w: 6, h: 4, cat: 'food', color: '#c84a2a', door: [2, 3], unique: true, interior: 'yakiniku' },
  dango:       { name: 'Данго-лавка',        w: 4, h: 3, cat: 'food', color: '#f0a0b0', door: [1, 2], unique: true, interior: 'dango' },
  teahouse:    { name: 'Чайная',             w: 5, h: 4, cat: 'food', color: '#9a8a5a', door: [2, 3], unique: true, interior: 'teahouse' },
  market:      { name: 'Продуктовый рынок',  w: 8, h: 5, cat: 'food', color: '#d8b850', door: [3, 4], unique: true, interior: 'market' },

  // ---------- Лавки ----------
  weapons:     { name: 'Оружейная',          w: 5, h: 4, cat: 'shop', color: '#6a6a7a', door: [2, 3], unique: true, interior: 'weapons' },
  pharmacy:    { name: 'Аптека',             w: 4, h: 4, cat: 'shop', color: '#5aa07a', door: [1, 3], unique: true, interior: 'pharmacy' },
  books:       { name: 'Книжная лавка',      w: 4, h: 4, cat: 'shop', color: '#8a6aa0', door: [1, 3], unique: true, interior: 'books' },
  flowers:     { name: 'Цветы Яманака',      w: 4, h: 4, cat: 'shop', color: '#e870a0', door: [1, 3], unique: true, interior: 'flowers' },
  inuzuka_shop:{ name: 'Лавка Инузука',      w: 4, h: 3, cat: 'shop', color: '#a07a4a', door: [1, 2], unique: true, interior: 'inuzuka_shop' },
  souvenir:    { name: 'Сувенирная лавка',   w: 4, h: 3, cat: 'shop', color: '#d8a03a', door: [1, 2], unique: true, interior: 'souvenir' },
  shop_s:      { name: 'Лавочка',            w: 3, h: 3, cat: 'shop', color: '#9a7a5a', door: [1, 2] },
  office:      { name: 'Контора',            w: 6, h: 5, cat: 'official', color: '#a88a6a', door: [2, 4] },
  shop_generic:{ name: 'Лавка (шаблон)',     w: 4, h: 3, cat: 'shop', color: '#a88a6a', door: [1, 2] },

  // ---------- Официальные ----------
  hokage_tower:{ name: 'Резиденция Хокаге',  w: 10, h: 9, cat: 'official', color: '#d84a3a', door: [4, 8], unique: true, interior: 'hokage_hall' },
  academy:     { name: 'Академия',           w: 12, h: 8, cat: 'official', color: '#e8784a', door: [5, 7], unique: true, interior: 'academy_hall' },
  library:     { name: 'Библиотека',         w: 7, h: 6, cat: 'official', color: '#7a6a9a', door: [3, 5], unique: true, interior: 'library' },
  hospital:    { name: 'Больница',           w: 10, h: 8, cat: 'official', color: '#e8e8e8', door: [4, 7], unique: true, interior: 'hospital' },
  onsen:       { name: 'Онсен',              w: 8, h: 6, cat: 'official', color: '#6a9ac8', door: [3, 5], unique: true, interior: 'onsen' },
  gate:        { name: 'Главные ворота А-Ун',w: 8, h: 4, cat: 'official', color: '#5a8a4a', door: [3, 3], unique: true, onRoad: true },
  guard_post:  { name: 'Пост стражи',        w: 3, h: 2, cat: 'official', color: '#8a8a6a', door: [1, 1] },

  // ---------- Кланы ----------
  clan_hyuga:  { name: 'Особняк Хьюга',      w: 10, h: 8, cat: 'clan', color: '#c8c0d8', door: [4, 7], unique: true, interior: 'hyuga_hall' },
  clan_nara:   { name: 'Особняк Нара',       w: 8, h: 7, cat: 'clan', color: '#7a8a5a', door: [3, 6], unique: true, interior: 'nara_hall' },
  clan_akimichi:{name: 'Особняк Акимичи',    w: 8, h: 7, cat: 'clan', color: '#c8784a', door: [3, 6], unique: true, interior: 'akimichi_hall' },
  clan_inuzuka:{ name: 'Особняк Инузука',    w: 8, h: 7, cat: 'clan', color: '#8a6a4a', door: [3, 6], unique: true, interior: 'inuzuka_hall' },
  uchiha_house:{ name: 'Дом Учиха (пустой)', w: 5, h: 5, cat: 'clan', color: '#5a4a5a', door: [2, 4] },
  sasuke_home: { name: 'Дом Саске',          w: 6, h: 5, cat: 'clan', color: '#4a3a5a', door: [2, 4], unique: true, interior: 'sasuke_home' },
  uchiha_small:{ name: 'Дом Учиха (пустой)', w: 4, h: 4, cat: 'clan', color: '#5a4a5a', door: [1, 3] },
  uchiha_police:{name: 'Участок полиции Учиха', w: 6, h: 5, cat: 'clan', color: '#3a3a4a', door: [2, 4], unique: true },

  // ---------- Тренировки ----------
  training_3:  { name: 'Полигон №3',         w: 10, h: 8, cat: 'training', color: '#8ab05a', unique: true },
  training_ground:{ name: 'Полигон',         w: 8, h: 7, cat: 'training', color: '#9ab86a' },
  memorial:    { name: 'Мемориальный камень',w: 2, h: 2, cat: 'training', color: '#6a6a7a', unique: true },
  dojo:        { name: 'Додзё',              w: 6, h: 5, cat: 'training', color: '#b88a5a', door: [2, 4] },

  // ---------- Природа и ориентиры ----------
  hokage_rock: { name: 'Скала Хокаге',       w: 30, h: 10, cat: 'landmark', color: '#9a8a7a', unique: true },
  swing_tree:  { name: 'Качели (дерево)',    w: 2, h: 2, cat: 'landmark', color: '#5a8a3a', unique: true },
  pier:        { name: 'Пристань у озера',   w: 3, h: 4, cat: 'landmark', color: '#a8784a', unique: true },
  waterfall:   { name: 'Водопад',            w: 4, h: 3, cat: 'landmark', color: '#7ac0f0', unique: true },
  well:        { name: 'Колодец',            w: 1, h: 1, cat: 'landmark', color: '#8a8a9a' },
  stall:       { name: 'Уличный лоток',      w: 2, h: 1, cat: 'landmark', color: '#d8a86a' },
  night_alley: { name: 'Тёмный переулок',    w: 2, h: 4, cat: 'landmark', color: '#3a3448', unique: true },
};

// Типы районов (прямоугольные зоны застройки/природы)
G.DISTRICTS = {
  residential: { name: 'Жилой квартал',   color: '#e8d8a8' },
  market:      { name: 'Торговый район',  color: '#f0c878' },
  official:    { name: 'Центр',           color: '#f0a888' },
  clan:        { name: 'Квартал клана',   color: '#c8b8d8' },
  uchiha:      { name: 'Квартал Учиха',   color: '#8a7a8a' },
  park:        { name: 'Парк / сквер',    color: '#a8d888' },
  forest:      { name: 'Лес',             color: '#5a9a4a' },
  training:    { name: 'Полигоны',        color: '#b8d070' },
  water:       { name: 'Вода',            color: '#6aaae0' },
  cliff:       { name: 'Скала',           color: '#8a7a6a' },
  wall:        { name: 'Стена деревни',   color: '#6a5a4a' },
};

// Типы дорог (ширина в тайлах)
G.ROADS = {
  main:   { name: 'Главная улица', w: 3, color: '#d8b67a' },
  street: { name: 'Улица',         w: 2, color: '#e0c48a' },
  path:   { name: 'Тропа',         w: 1, color: '#c8a870' },
};

G.MAP_SIZE = { w: 160, h: 128 };
