// ВНЕШНОСТЬ ВСЕХ ПЕРСОНАЖЕЙ — в одном месте.
// Как добавить персонажа: docs/CONTENT_GUIDE.md → «Новый персонаж».
//
// DEFS[id] = { name, hair, band?, marks?, skin?: [кожа, тень], colors }
//   hair:   short | spiky | duck | long | pony | bob | bowl | ino | bun | buns | lowpony | sage | bald
//   colors: h/H — волосы и блик, t/T — верх и его тень, a — акцент (пояс, отделка), p/P — низ, f — обувь,
//           e — глаза, b/B — металл и ткань протектора (если band: true)
// STY[id]  = { top, sleeve, ex, hair?, body?, kid?, eye?, inner?, shorts?, cat?, dog? }
//   top:    plain | jacket | vest | dress | robe | apron       sleeve: long | short | mesh
//   ex:     детали — goggles, swirl, whiskers, hcollar, fan, wraps, ribbon, circle, blush, fluff, scar, hood, fang,
//           swirlcheek, scarfc, shades, brows, warmers, belt, teeth, stache, hokagehat, wrinkle, scowl, mask, hoodcloth,
//           beard, glasses, bun, band, cap, chef, sedge, scarf, satchel, eyeband, midriff, skirt, lines, plaster,
//           senbon, redline, scarbig, dzeye, purpleeyes
//   body: 'fat' — полный; kid: 1 — ребёнок (румянец); eye: 'pale' — глаза Хьюга; cat/dog: 1 — животное
(() => {
  const P = G.PAL;
  const D = G.chars.DEFS;
  const def = (id, name, hair, c, extra) => { D[id] = Object.assign({ name, hair, colors: Object.assign({ e: P.ink }, c) }, extra || {}); };

  // ── основные персонажи ──
  Object.assign(D, {
    hero: {
      name: '{name}', hair: 'short',
      colors: { h: '#3a2a2a', H: '#5a4040', t: '#3a5a8a', T: '#2a4066', a: P.orange, p: '#2e2e44', P: '#22223a', f: '#3a4a7a', e: P.ink },
    },
    naruto: {
      name: 'Наруто', hair: 'spiky', marks: 'whiskers',
      colors: { h: P.yellow, H: '#fff08a', t: P.orange, T: P.orangeDark, a: P.blue, p: P.orange, P: P.orangeDark, f: P.blue, e: '#2a5ac8' },
    },
    sasuke: {
      name: 'Саске', hair: 'duck',
      colors: { h: P.hairBlack, H: P.hairBlackHi, t: P.navy, T: '#121a30', a: P.navy, p: '#e8e4dc', P: '#b8b4ac', f: P.navy, e: P.ink },
    },
    sakura: {
      name: 'Сакура', hair: 'long',
      colors: { h: P.pink, H: '#ffc8dc', t: P.red, T: P.redDark, a: '#e8e4dc', p: '#3a3a4a', P: '#2a2a36', f: P.blue, e: '#2a8a4a' },
    },
    iruka: {
      name: 'Ирука', hair: 'pony', band: true, marks: 'scar',
      skin: ['#d8a070', '#b47a4e'],
      colors: { h: P.brown, H: '#8a5a36', t: P.vest, T: P.vestDark, a: P.navy, p: P.navy, P: '#121a30', f: P.navy, e: P.ink, b: '#c8ccd8', B: P.navy },
    },
    hinata: {
      name: 'Хината', hair: 'bob',
      colors: { h: '#2a2a5a', H: '#46468a', t: '#d8d0e8', T: '#a8a0c0', a: '#a8a0c0', p: P.navy, P: '#121a30', f: P.navy, e: '#e8e4f8' },
    },
    shikamaru: {
      name: 'Шикамару', hair: 'pony',
      colors: { h: P.hairBlack, H: P.hairBlackHi, t: '#7a7a6a', T: '#5a5a4a', a: '#4a6a3a', p: '#6a4a2e', P: '#4a321e', f: P.navy, e: P.ink },
    },
    teuchi: {
      name: 'Теучи', hair: 'short', band: true,
      colors: { h: '#4a3a2a', H: '#6a5a44', t: '#f0ece0', T: '#c8c0b0', a: '#f0ece0', p: '#3a3a4a', P: '#2a2a36', f: '#2a2a2a', e: P.ink, b: '#f4f0e8', B: '#d0c8b8' },
    },
    ayame: {
      name: 'Аяме', hair: 'long', band: true,
      colors: { h: '#6a3a24', H: '#8a5a3a', t: '#f0ece0', T: '#c8c0b0', a: '#e88aa0', p: '#5a5a6a', P: '#44444e', f: '#3a2a1a', e: P.ink, b: '#f4f0e8', B: '#d0c8b8' },
    },
    ino: {
      name: 'Ино', hair: 'pony',
      colors: { h: '#f0d870', H: '#fff0a8', t: '#7a4a9a', T: '#5a3a7a', a: '#e8e4dc', p: '#7a4a9a', P: '#5a3a7a', f: '#3a3a4a', e: '#5a8ad8' },
    },
    kiba: {
      name: 'Киба', hair: 'spiky',
      colors: { h: '#4a3020', H: '#6a4830', t: '#8a8a96', T: '#6a6a76', a: '#8a8a96', p: '#3a3a4a', P: '#2a2a36', f: '#2a2a2a', e: P.ink },
    },
    choji: {
      name: 'Чоджи', hair: 'spiky',
      colors: { h: '#a0502a', H: '#c8703a', t: '#3a7a4a', T: '#26543a', a: '#e8e4dc', p: '#7a2a2a', P: '#5a1a1a', f: '#2a2a2a', e: P.ink },
    },
    shino: {
      name: 'Шино', hair: 'short',
      colors: { h: '#3a3a30', H: '#5a5a46', t: '#6a7a6a', T: '#4a5a4a', a: '#6a7a6a', p: '#3a3a4a', P: '#2a2a36', f: '#2a2a2a', e: '#1a1a1a' },
    },
    lee: {
      name: 'Рок Ли', hair: 'bob', band: true,
      colors: { h: '#14121c', H: '#2a2a3a', t: '#3a9a3a', T: '#2a7a2a', a: '#3a9a3a', p: '#3a9a3a', P: '#2a7a2a', f: '#e8621a', e: P.ink, b: '#c8401c', B: '#8a2a10' },
    },
    guy: {
      name: 'Майто Гай', hair: 'bob', band: true,
      colors: { h: '#14121c', H: '#2a2a3a', t: '#3a9a3a', T: '#2a7a2a', a: P.vest, p: '#3a9a3a', P: '#2a7a2a', f: '#e8621a', e: P.ink, b: '#c8401c', B: '#8a2a10' },
    },
    mizuki: {
      name: 'Мизуки', hair: 'long', band: true,
      colors: { h: '#c8d8e8', H: '#e8f0f8', t: P.vest, T: P.vestDark, a: P.navy, p: P.navy, P: '#121a30', f: P.navy, e: P.ink, b: '#c8ccd8', B: P.navy },
    },
    bully: {
      name: 'Хулиган', hair: 'bald',
      colors: { h: '#5a3a1a', H: '#7a5a3a', t: '#7a2a2a', T: '#5a1a1a', a: '#3a3a3a', p: '#3a3a4a', P: '#2a2a36', f: '#2a2a2a', e: P.ink },
    },
    thief: {
      name: 'Вор', hair: 'short',
      colors: { h: '#1a1a24', H: '#2a2a3a', t: '#2a2a3a', T: '#1a1a24', a: '#2a2a3a', p: '#2a2a3a', P: '#1a1a24', f: '#1a1a24', e: '#e8e4dc' },
    },
    hokage: {
      name: 'Третий Хокаге', hair: 'short',
      colors: { h: '#d8d8d8', H: '#f0f0f0', t: '#f0ece0', T: '#c8c0b0', a: '#c8401c', p: '#f0ece0', P: '#c8c0b0', f: '#3a2a1a', e: P.ink },
    },
    villager_m: {
      name: 'Житель', hair: 'short',
      colors: { h: '#5a3a1a', H: '#7a5a3a', t: '#8a6a4a', T: '#6a4e34', a: '#4a3424', p: '#4a4a5a', P: '#36364a', f: '#3a2a1a', e: P.ink },
    },
    villager_f: {
      name: 'Жительница', hair: 'long',
      colors: { h: '#3a2a1a', H: '#5a4a3a', t: '#a85a6a', T: '#844252', a: '#e8d8b8', p: '#a85a6a', P: '#844252', f: '#3a2a1a', e: P.ink },
    },
});

  // ── жители и новые персонажи ──
  def('cart', 'Картограф', 'bald', { h: '#d8d8d8', H: '#fff', t: '#4a6a5a', T: '#34503f', a: '#d8c890', p: '#4a4a5a', P: '#36364a', f: '#3a2a1a' });
  def('grandma', 'Бабушка', 'bob', { h: '#c8c8d0', H: '#e8e8f0', t: '#8a5a7a', T: '#6a4060', a: '#e8d8b8', p: '#8a5a7a', P: '#6a4060', f: '#3a2a1a' });
  def('kid_m', 'Мальчик', 'spiky', { h: '#7a4a2a', H: '#9a6a4a', t: '#3a8a4a', T: '#2a6a36', a: '#e8d8b8', p: '#4a4a5a', P: '#36364a', f: '#3a2a1a' });
  def('kid_f', 'Девочка', 'pony', { h: '#2a2a3a', H: '#4a4a5a', t: '#e8a0b0', T: '#c0788a', a: '#fff', p: '#e8a0b0', P: '#c0788a', f: '#3a2a1a' });
  def('chunin', 'Чунин', 'short', { h: '#3a2a2a', H: '#5a4040', t: '#3a5a3a', T: '#2a4028', a: '#2a2a44', p: '#2a2a44', P: '#22223a', f: '#22223a' });
  def('merchant', 'Торговец', 'bald', { h: '#5a3a1a', H: '#7a5a3a', t: '#b8803a', T: '#8a5e28', a: '#e8d8b8', p: '#5a4a3a', P: '#3a2e22', f: '#2a1a0a' });
  def('cook', 'Повар', 'short', { h: '#3a2a1a', H: '#5a4a3a', t: '#e8e4dc', T: '#bcb8b0', a: '#e8e4dc', p: '#4a4a5a', P: '#36364a', f: '#3a2a1a' });
  def('fisher', 'Рыбак', 'short', { h: '#6a5a3a', H: '#8a7a5a', t: '#5a7a9a', T: '#3a5a7a', a: '#d8c890', p: '#5a5a4a', P: '#3a3a2e', f: '#3a2a1a' });
  def('konohamaru', 'Конохамару', 'spiky', { h: '#5a3a1a', H: '#7a5a3a', t: '#e8d040', T: '#b09820', a: '#2a8aca', p: '#3a3a6a', P: '#2a2a50', f: '#2a2a50' });
  def('anko', 'Анко', 'pony', { h: '#5a3a6a', H: '#7a5a8a', t: '#d8c8a0', T: '#a89870', a: '#8a5a3a', p: '#8a5a3a', P: '#6a4228', f: '#22223a' });
  def('courier', 'Рассыльный', 'short', { h: '#3a2a1a', H: '#5a4a3a', t: '#c8402a', T: '#98301e', a: '#e8d8b8', p: '#3a3a4a', P: '#2a2a38', f: '#2a1a0a' });
  def('tora', 'Тора', 'bald', { h: '#d08030', H: '#e8a050', t: '#d08030', T: '#a86020', a: '#d08030', p: '#d08030', P: '#a86020', f: '#6a3a10' });
  def('kakashi', 'Какаши', 'spiky', { h: '#c8c8d0', H: '#e8e8f0', t: '#2a3a5a', T: '#1a2640', a: '#3a5a3a', p: '#2a3a5a', P: '#1a2640', f: '#22223a' });
  def('asuma', 'Асума', 'short', { h: '#2a2a1a', H: '#4a4a3a', t: '#3a5a3a', T: '#2a4028', a: '#2a2a44', p: '#2a2a44', P: '#22223a', f: '#22223a' });


  const vest = { t: P.vest, T: P.vestDark, a: P.navy, p: P.navy, P: '#121a30', f: P.navy, b: '#c8ccd8', B: P.navy };

  def('tenten', 'Тентен', 'buns', { h: '#6a3a1e', H: '#8a5a36', t: '#e87a9a', T: '#b85674', a: '#f0e8d0', p: '#4a6a4a', P: '#34503a', f: '#3a2a1a', e: '#6a3a1e' });
  def('neji', 'Нэдзи', 'lowpony', { h: '#4a2e1e', H: '#6a4a34', t: '#e8e4dc', T: '#bcb8b0', a: '#8a6a4a', p: '#e8e4dc', P: '#bcb8b0', f: '#2a2a3a', e: '#e8e4f8', b: '#c8ccd8', B: '#e8e4dc' });
  def('akamaru', 'Акамару', 'bald', { t: '#f4f0e8', T: '#c8c0b0' });
  def('hanabi', 'Ханаби', 'bob', { h: '#4a3a3a', H: '#6a5a5a', t: '#d8d0e8', T: '#a8a0c0', a: '#a8a0c0', p: '#4a4a6a', P: '#34344e', f: '#2a2a3a', e: '#e8e4f8' });
  def('kurenai', 'Куренай', 'long', { h: '#2a2230', H: '#4a3a52', t: '#f0ece0', T: '#c8c0b0', a: '#c83a3a', p: '#f0ece0', P: '#c8c0b0', f: '#3a2a2a', e: '#c82a2a' });
  def('ebisu', 'Эбису', 'short', Object.assign({ h: '#3a2a2a', H: '#5a4040', e: P.ink }, vest, { a: '#e8d8b8' }));
  def('izumo', 'Идзумо', 'short', Object.assign({ h: '#2a2a3a', H: '#4a4a5a', e: P.ink }, vest));
  def('kotetsu', 'Котэцу', 'spiky', Object.assign({ h: '#3a2a22', H: '#5a4438', e: P.ink }, vest));
  def('shizune', 'Сидзуне', 'bob', { h: '#1a1a24', H: '#3a3a4a', t: '#1e1e2e', T: '#12121e', a: '#f0ece0', p: '#1e1e2e', P: '#12121e', f: '#2a2a3a', e: P.ink });
  def('genma', 'Гэнма', 'spiky', Object.assign({ h: '#4a3a2a', H: '#6a5a44', e: P.ink }, vest));
  def('ibiki', 'Ибики', 'bald', { t: '#2a2a30', T: '#1a1a20', a: '#c8a050', p: '#2a2a30', P: '#1a1a20', f: '#1a1a20', e: P.ink, b: '#c8ccd8', B: '#2a2a30' });
  def('shikaku', 'Шикаку', 'pony', Object.assign({ h: '#1a1a24', H: '#3a3a4a', e: P.ink }, vest, { t: '#7a7a6a', T: '#5a5a4a' }));
  def('inoichi', 'Иноичи', 'pony', Object.assign({ h: '#f0d870', H: '#fff0a8', e: '#5a8ad8' }, vest, { t: '#7a4a9a', T: '#5a3a7a' }));
  def('choza', 'Тёдза', 'spiky', { h: '#a0502a', H: '#c8703a', t: '#8a3a2a', T: '#5a2418', a: '#d8c890', p: '#4a3a2a', P: '#32281c', f: '#2a2a2a', e: P.ink });
  def('fugaku', 'Фугаку', 'short', { h: '#1a1a24', H: '#3a3a4a', t: '#1e2a4a', T: '#121a30', a: '#e8e4dc', p: '#2a2a44', P: '#1a1a30', f: '#1a1a24', e: P.ink });
  def('mikoto', 'Микото', 'long', { h: '#1a1a24', H: '#3a3a4a', t: '#8a6a9a', T: '#664a78', a: '#e8d8b8', p: '#8a6a9a', P: '#664a78', f: '#3a2a2a', e: P.ink });
  def('itachi', 'Итачи', 'lowpony', Object.assign({ h: '#1a1a24', H: '#3a3a4a', e: P.ink }, vest, { t: '#3a3a44', T: '#26262e', a: '#c8ccd8', B: '#2a2a3a' }));
  def('jiraiya', 'Джирайя', 'sage', { h: '#e8e8f0', H: '#ffffff', t: '#3a7a4a', T: '#26543a', a: '#c83a3a', p: '#5a3a2a', P: '#3a281c', f: '#2a2a2a', e: P.ink, b: '#c8ccd8', B: '#2a2a3a' });
  def('orochimaru', 'Орочимару', 'long', { h: '#14121c', H: '#2a2a3a', t: '#d8d0e0', T: '#a8a0b8', a: '#7a4a9a', p: '#d8d0e0', P: '#a8a0b8', f: '#3a3a4a', e: '#e8c840' }, { skin: ['#ece4da', '#c8bcae'] });
  def('homura', 'Хомура', 'short', { h: '#b8b8c0', H: '#e0e0e8', t: '#c8b898', T: '#a09074', a: '#8a6a4a', p: '#c8b898', P: '#a09074', f: '#3a2a1a', e: P.ink });
  def('koharu', 'Кохару', 'bun', { h: '#c8c8d0', H: '#f0f0f8', t: '#7a6a8a', T: '#584a68', a: '#e8d8b8', p: '#7a6a8a', P: '#584a68', f: '#3a2a1a', e: P.ink });
  def('danzo', 'Данзо', 'short', { h: '#3a3a40', H: '#5a5a62', t: '#b8a888', T: '#8a7c62', a: '#2a2a30', p: '#b8a888', P: '#8a7c62', f: '#3a2a1a', e: P.ink });


  // ── стили одежды и детали ──
  Object.assign(G.chars.STY, {
    hero: { top: 'plain', sleeve: 'short', ex: ['collar'] },
    naruto: { top: 'jacket', sleeve: 'long', inner: '#2a3870', ex: ['goggles', 'swirl', 'whiskers'] },
    sasuke: { top: 'plain', sleeve: 'short', ex: ['hcollar', 'fan', 'wraps'], shorts: true },
    sakura: { top: 'dress', sleeve: 'short', ex: ['ribbon', 'circle', 'blush'], shorts: true },
    hinata: { top: 'jacket', sleeve: 'long', inner: '#4a4a7a', ex: ['fluff', 'blush'], eye: 'pale' },
    iruka: { top: 'vest', sleeve: 'long', inner: '#1e2a4a', ex: ['scar'] },
    shikamaru: { top: 'vest', sleeve: 'mesh', inner: '#5a5a4a', ex: [] },
    ino: { hair: 'ino', top: 'plain', sleeve: 'short', ex: ['midriff', 'skirt', 'blush'] },
    kiba: { top: 'jacket', sleeve: 'long', inner: '#4a4a56', ex: ['hood', 'fang'] },
    choji: { top: 'plain', sleeve: 'short', body: 'fat', ex: ['swirlcheek', 'scarfc'] },
    shino: { top: 'jacket', sleeve: 'long', inner: '#3a4a3a', ex: ['hcollar', 'shades'] },
    lee: { top: 'plain', sleeve: 'long', ex: ['brows', 'warmers', 'belt'] },
    guy: { top: 'vest', sleeve: 'long', inner: '#2a7a2a', ex: ['brows', 'warmers', 'teeth'] },
    mizuki: { top: 'vest', sleeve: 'long', inner: '#1e2a4a', ex: [] },
    teuchi: { top: 'apron', sleeve: 'short', ex: ['stache'] },
    ayame: { top: 'apron', sleeve: 'short', ex: ['blush'] },
    hokage: { top: 'robe', sleeve: 'long', ex: ['hokagehat', 'wrinkle'] },
    bully: { top: 'plain', sleeve: 'short', body: 'fat', ex: ['scowl'] },
    thief: { top: 'plain', sleeve: 'long', ex: ['mask', 'hoodcloth'] },
    villager_m: { top: 'plain', sleeve: 'long', ex: [] },
    villager_f: { top: 'dress', sleeve: 'long', ex: ['skirt', 'blush'] },
    cart: { top: 'robe', sleeve: 'long', ex: ['beard', 'glasses'] },
    grandma: { hair: 'bun', top: 'robe', sleeve: 'long', ex: ['bun', 'wrinkle'] },
    kid_m: { top: 'plain', sleeve: 'short', ex: [], kid: 1 },
    kid_f: { top: 'dress', sleeve: 'short', ex: ['blush'], kid: 1 },
    chunin: { top: 'vest', sleeve: 'long', inner: '#2a2a44', ex: ['band'] },
    merchant: { top: 'vest', sleeve: 'long', inner: '#e8d8b8', ex: ['stache', 'cap'] },
    cook: { top: 'apron', sleeve: 'short', ex: ['chef'] },
    fisher: { top: 'vest', sleeve: 'short', inner: '#d8c890', ex: ['sedge'] },
    konohamaru: { top: 'plain', sleeve: 'short', ex: ['goggles', 'scarf'], kid: 1 },
    anko: { top: 'jacket', sleeve: 'mesh', inner: '#6a4a8a', ex: ['skirt', 'band'] },
    courier: { top: 'vest', sleeve: 'short', inner: '#e8d8b8', ex: ['cap', 'satchel'] },
    tora: { cat: 1 },
    akamaru: { dog: 1 },
    tenten: { top: 'plain', sleeve: 'short', ex: ['blush'], hair: 'buns' },
    neji: { top: 'robe', sleeve: 'long', ex: ['band'], eye: 'pale', hair: 'lowpony' },
    hanabi: { top: 'jacket', sleeve: 'long', inner: '#6a6a9a', ex: ['blush'], eye: 'pale', kid: 1, hair: 'bob' },
    kurenai: { top: 'dress', sleeve: 'mesh', ex: ['blush'], hair: 'long' },
    ebisu: { top: 'vest', sleeve: 'long', inner: '#1e2a4a', ex: ['shades', 'hcollar'] },
    izumo: { top: 'vest', sleeve: 'long', inner: '#1e2a4a', ex: ['band'] },
    kotetsu: { top: 'vest', sleeve: 'long', inner: '#1e2a4a', ex: ['plaster', 'band'] },
    shizune: { top: 'dress', sleeve: 'long', ex: ['blush'], hair: 'bob' },
    genma: { top: 'vest', sleeve: 'long', inner: '#1e2a4a', ex: ['senbon', 'band'] },
    ibiki: { top: 'robe', sleeve: 'long', ex: ['scarbig', 'band'] },
    shikaku: { top: 'vest', sleeve: 'long', inner: '#3a3a4a', ex: ['scar'] },
    inoichi: { top: 'vest', sleeve: 'long', inner: '#4a2a6a', ex: ['stache'], hair: 'ino' },
    choza: { top: 'plain', sleeve: 'short', body: 'fat', ex: ['stache', 'swirl'] },
    fugaku: { top: 'jacket', sleeve: 'long', inner: '#2a3a5a', ex: ['lines', 'hcollar', 'fan'] },
    mikoto: { top: 'dress', sleeve: 'long', ex: ['blush'], hair: 'long' },
    itachi: { top: 'vest', sleeve: 'long', inner: '#1e1e2a', ex: ['lines', 'band'], hair: 'lowpony' },
    jiraiya: { top: 'robe', sleeve: 'long', ex: ['redline', 'band'], hair: 'sage' },
    orochimaru: { top: 'robe', sleeve: 'long', ex: ['purpleeyes'], hair: 'long' },
    homura: { top: 'robe', sleeve: 'long', ex: ['glasses', 'wrinkle'] },
    koharu: { top: 'robe', sleeve: 'long', ex: ['glasses', 'wrinkle'], hair: 'bun' },
    danzo: { top: 'robe', sleeve: 'long', ex: ['dzeye', 'wrinkle', 'wraps'] },
    kakashi: { top: 'vest', sleeve: 'long', inner: '#2a3a5a', ex: ['mask', 'eyeband'] },
    asuma: { top: 'vest', sleeve: 'long', inner: '#2a2a44', ex: ['stache', 'band'] },
});
})();
