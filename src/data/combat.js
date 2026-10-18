// Данные боя «Дуэль шиноби» (план §4): печати, техники, приёмы, противники, арены.
G.SEALS = ['Крыса', 'Бык', 'Тигр', 'Заяц', 'Дракон', 'Змея', 'Лошадь', 'Овца', 'Обезьяна', 'Птица', 'Собака', 'Кабан'];
G.SEAL_COL = ['#9a9aa8', '#a8683a', '#e8a03a', '#e8dcc0', '#4a8ad0', '#6ab04a', '#c87a4a', '#f4ecd8', '#c8a050', '#f0a0c0', '#b0a090', '#8a5a3a'];
const _S = (names) => names.map((n) => G.SEALS.indexOf(n));

// Техники ниндзюцу/гендзюцу. learn — флаг, открывающий технику. ch — чакра, w — вес на шкале ходов.
G.TECHS = {
  kawarimi: { name: 'Каварими',       seals: _S(['Овца', 'Кабан', 'Бык', 'Собака', 'Змея']), ch: 8,  w: 0,  reaction: true, desc: 'Реакция: вместо тебя полено, ты — за спиной врага.' },
  henge:    { name: 'Хенге',          seals: _S(['Собака', 'Кабан', 'Овца']),                ch: 8, w: 9,  desc: 'Превратиться в камень: враг теряет тебя, засада ×2.' },
  fear:     { name: 'Ложный страх',   seals: _S(['Тигр', 'Змея', 'Крыса', 'Птица']),         ch: 12, w: 10, gen: true, desc: 'Гендзюцу: враг видит кошмар и теряет ходы.' },
  bunshin:  { name: 'Буншин',         seals: _S(['Овца', 'Змея', 'Тигр']),                   ch: 14, w: 10, desc: 'Два иллюзорных клона принимают удары на себя.' },
  sexy:     { name: 'Секси-дзюцу',    seals: _S(['Овца']),                                   ch: 6,  w: 6,  desc: 'Подарок Наруто. Противник-мужчина в нокдауне. Позор.' },
  shunshin: { name: 'Шуншин',         seals: _S(['Тигр']),                                   ch: 15, w: 2,  desc: 'Мгновенный шаг в любую точку и ход вне очереди.' },
};
G.TECH_ORDER = ['henge', 'fear', 'bunshin', 'sexy', 'shunshin'];

// Тайдзюцу: приёмы цепочки (каждый −1 дыхание)
G.MOVES = {
  punch:  { name: 'Удар',     dmg: 5, desc: 'Быстрый и надёжный.' },
  kick:   { name: 'Пинок',    dmg: 7, push: true, desc: 'Сильнее. Крит отбрасывает назад.' },
  sweep:  { name: 'Подсечка', dmg: 3, down: true, desc: 'Сбивает с ног: враг теряет время.' },
  upper:  { name: 'Апперкот', dmg: 6, desc: 'После подсечки — ×1,5.' },
};
G.COMBOS = {
  academy: { name: 'Связка Академии', seq: ['punch', 'punch', 'kick'], mul: 1.15, desc: 'Базовая связка Ируки.' },
  air:     { name: 'Воздушное комбо', seq: ['sweep', 'upper', 'punch'], mul: 1.28, down: true, desc: 'Подбросить и добить в прыжке (Гай).' },
  whirl:   { name: 'Вихрь Листа',     seq: ['kick', 'kick', 'sweep'],   mul: 1.38, push: 2, desc: 'Коноха Сэнпу! (Рок Ли).' },
};

// Действия противников
G.EACTS = {
  stand:    { name: 'Стоит',            range: [0, 9], w: 10, kind: 'idle' },
  swing:    { name: 'Качается',         range: [1, 1], w: 12, kind: 'tai', dmg: 3 },
  strike:   { name: 'Удар',             range: [1, 1], w: 8,  kind: 'tai', dmg: 7 },
  combo:    { name: 'Серия ударов',     range: [1, 1], w: 13, kind: 'tai', dmg: 4, hits: 3 },
  kunai:    { name: 'Кунай',            range: [2, 4], w: 7,  kind: 'throw', dmg: 7 },
  shuriken: { name: 'Сюрикены',         range: [2, 4], w: 6,  kind: 'throw', dmg: 4, hits: 2 },
  approach: { name: 'Сближается',       range: [2, 4], w: 6,  kind: 'move', dir: 1 },
  dash:     { name: 'Рывок',            range: [3, 4], w: 7,  kind: 'move', dir: 2 },
  retreat:  { name: 'Отходит',          range: [1, 2], w: 6,  kind: 'move', dir: -1 },
  guard:    { name: 'Защита',           range: [0, 9], w: 6,  kind: 'guard' },
  focus:    { name: 'Копит чакру',      range: [0, 9], w: 8,  kind: 'focus' },
  fang:     { name: 'Гацуга!',          range: [1, 3], w: 14, kind: 'tai', dmg: 15, lunge: true, jutsu: true },
  clones:   { name: 'Теневые клоны',    range: [0, 9], w: 10, kind: 'clones', jutsu: true },
  gentle:   { name: 'Мягкий кулак',     range: [1, 1], w: 10, kind: 'tai', dmg: 8, drain: 14, jutsu: true },
  baika:    { name: 'Техника увеличения', range: [1, 2], w: 18, kind: 'tai', dmg: 20, lunge: true, jutsu: true },
  mind:     { name: 'Иллюзия Яманака',  range: [1, 4], w: 12, kind: 'gen', jutsu: true },
  shadow:   { name: 'Теневая ловушка',  range: [1, 4], w: 12, kind: 'bind', jutsu: true },
  trap:     { name: 'Ставит ловушку',   range: [2, 4], w: 8,  kind: 'trap' },
  fireball: { name: 'Огненный шар!',    range: [2, 4], w: 15, kind: 'nin', dmg: 18, jutsu: true },
  whirl:    { name: 'Коноха Сэнпу!',    range: [1, 1], w: 11, kind: 'tai', dmg: 13, push: true },
  bite:     { name: 'Укус',             range: [1, 1], w: 6,  kind: 'tai', dmg: 5 },
  giant:    { name: 'Гигантский сюрикен', range: [2, 4], w: 14, kind: 'throw', dmg: 22, jutsu: true },
  taunt:    { name: 'Ложь',             range: [0, 9], w: 7,  kind: 'taunt' },
  rage:     { name: 'Ярость',           range: [1, 1], w: 12, kind: 'tai', dmg: 9, hits: 2 },
};

// Противники. spr — спрайт из G.chars (или особый), male — для Секси-дзюцу.
// pref — любимая дистанция, traits: kawarimi, deceive, lazy, climb, impulsive, smart, defensive
G.ENEMIES = {
  dummy:     { name: 'Манекен', spr: 'dummy', hp: 40, ch: 0, tai: 1, nin: 0, gen: 0, spd: 1, end: 1, know: 0, focus: 0, pref: 1,
               acts: ['stand'], lines: { start: '...', hurt: '*скрип*' } },
  dummy2:    { name: 'Манекен Ируки', spr: 'dummy', hp: 55, ch: 0, tai: 2, nin: 0, gen: 0, spd: 2, end: 2, know: 0, focus: 0, pref: 1,
               acts: ['swing', 'stand'], lines: { start: '*скрип-скрип*' } },
  kiba:      { name: 'Киба', spr: 'kiba', male: true, hp: 74, ch: 40, tai: 5, nin: 3, gen: 1, spd: 6, end: 5, know: 2, focus: 1, pref: 1,
               acts: ['strike', 'combo', 'fang', 'approach', 'dash'], traits: ['impulsive'],
               lines: { start: 'Новенький? Мы с Акамару тебя мигом уделаем!', hurt: 'Акамару, это ничего!', low: 'Чёрт... да ты не так прост!', win: 'Ха! Сила стаи!', lose: 'Ладно-ладно... в следующий раз!' } },
  naruto:    { name: 'Наруто', spr: 'naruto', male: true, hp: 115, ch: 80, tai: 5, nin: 4, gen: 1, spd: 5, end: 7, know: 1, focus: 1, pref: 1,
               acts: ['strike', 'combo', 'kunai', 'clones', 'approach'], traits: ['impulsive', 'clones'],
               lines: { start: 'Даттебайо! Покажу тебе стиль будущего Хокаге!', hurt: 'Ай-ай! Это нечестно!', low: 'Я никогда не сдаюсь!', win: 'Ура! Видел?!', lose: 'Эх... ты крутой! Ещё раз!' } },
  sasuke:    { name: 'Саске', spr: 'sasuke', male: true, hp: 130, ch: 60, tai: 7, nin: 6, gen: 3, spd: 8, end: 6, know: 6, focus: 2, pref: 2,
               acts: ['strike', 'combo', 'kunai', 'shuriken', 'fireball', 'retreat', 'approach'], traits: ['kawarimi', 'deceive', 'climb', 'smart'],
               lines: { start: 'Хм. Посмотрим, чего ты стоишь.', hurt: 'Тц.', low: 'Не может быть...', win: 'Ты слабак.', lose: '...Неплохо. В следующий раз я не проиграю.' } },
  shikamaru: { name: 'Шикамару', spr: 'shikamaru', male: true, hp: 80, ch: 50, tai: 3, nin: 5, gen: 2, spd: 4, end: 4, know: 9, focus: 1, pref: 3,
               acts: ['kunai', 'shadow', 'trap', 'retreat', 'strike'], traits: ['lazy', 'smart'],
               lines: { start: 'Как же это всё хлопотно...', hurt: 'Ох...', low: 'Ладно, сдаюсь... почти.', win: 'Сто ходов вперёд, как в шоги.', lose: 'Хлопотно. Сдаюсь.' } },
  hinata:    { name: 'Хината', spr: 'hinata', hp: 90, ch: 60, tai: 6, nin: 5, gen: 2, spd: 6, end: 5, know: 5, focus: 1, pref: 1,
               acts: ['gentle', 'strike', 'guard', 'approach'], traits: ['defensive'],
               lines: { start: 'Я... я постараюсь! Прости заранее!', hurt: 'Н-ничего...', low: 'Я не отступлю... как Наруто!', win: 'Ой! Ты в порядке?!', lose: 'Ты очень сильный...' } },
  choji:     { name: 'Чоджи', spr: 'choji', male: true, hp: 165, ch: 50, tai: 6, nin: 4, gen: 1, spd: 2, end: 8, know: 2, focus: 0, pref: 1,
               acts: ['strike', 'baika', 'approach', 'focus'], traits: [],
               lines: { start: 'После боя — чипсы! Ням!', hurt: 'Уф!', low: 'Я не толстый! Я широкой кости!!!', win: 'Хрум! Победные чипсы!', lose: 'Пойду поем...' } },
  ino:       { name: 'Ино', spr: 'ino', hp: 80, ch: 55, tai: 4, nin: 4, gen: 7, spd: 5, end: 4, know: 5, focus: 1, pref: 2,
               acts: ['kunai', 'mind', 'strike', 'retreat'], traits: ['smart'],
               lines: { start: 'Быстренько закончим — мне ещё к Саске!', hurt: 'Эй, причёска!', low: 'Как ты смеешь?!', win: 'Красота — тоже сила!', lose: 'Хмф! Повезло тебе.' } },
  lee:       { name: 'Рок Ли', spr: 'lee', male: true, hp: 130, ch: 0, tai: 10, nin: 0, gen: 0, spd: 11, end: 8, know: 3, focus: 2, pref: 1,
               acts: ['strike', 'combo', 'whirl', 'dash', 'approach'], traits: ['climb', 'impulsive'],
               lines: { start: 'Сила юности! Покажи мне свою!', hurt: 'Отличный удар!', low: 'Гай-сенсей, я не подведу!', win: 'Тренируйся! 500 кругов вокруг деревни!', lose: 'Великолепно! Ты — мой соперник!' } },
  bully:     { name: 'Хулиган', grow: true, spr: 'bully', male: true, hp: 75, ch: 20, tai: 4, nin: 1, gen: 0, spd: 3, end: 4, know: 1, focus: 0, pref: 1,
               acts: ['strike', 'kunai', 'approach'], traits: ['impulsive'],
               lines: { start: 'Эй, мелкий! Гони деньги!', hurt: 'Ах ты!', win: 'Ха, слабак!', lose: 'Б-бежим отсюда!' } },
  senior:    { name: 'Старшеклассник', spr: 'bully', male: true, hp: 95, ch: 40, tai: 6, nin: 4, gen: 2, spd: 6, end: 6, know: 4, focus: 1, pref: 2,
               acts: ['strike', 'combo', 'kunai', 'shuriken', 'approach', 'retreat'], traits: ['kawarimi'],
               lines: { start: 'Свиток? Попробуй отними, малявка!', hurt: 'Тц, шустрый!', low: 'Да кто ты такой?!', win: 'Свиток останется у нас.', lose: 'Ладно-ладно, забирай!' } },
  thief:     { name: 'Ночной вор', grow: true, spr: 'thief', male: true, hp: 85, ch: 30, tai: 4, nin: 2, gen: 2, spd: 7, end: 4, know: 4, focus: 1, pref: 3,
               acts: ['kunai', 'shuriken', 'retreat', 'strike'], traits: ['kawarimi'],
               lines: { start: 'Ученичок? Не мешай работать.', hurt: 'Шустрый...', win: 'Сладких снов.', lose: 'Сдаюсь! Отдам всё!' } },
  dog:       { name: 'Бродячий пёс', grow: true, spr: 'dog', hp: 55, ch: 0, tai: 5, nin: 0, gen: 0, spd: 7, end: 3, know: 0, focus: 0, pref: 1,
               acts: ['bite', 'approach', 'dash'], traits: ['impulsive'], lines: { start: 'Р-р-р-гав!', lose: 'Скуль-скуль...' } },
  iruka:     { name: 'Ирука', spr: 'iruka', male: true, hp: 140, ch: 70, tai: 7, nin: 6, gen: 4, spd: 7, end: 7, know: 8, focus: 3, pref: 2,
               acts: ['strike', 'kunai', 'shuriken', 'guard', 'retreat', 'approach'], traits: ['kawarimi', 'smart'],
               lines: { start: 'Колокольчик у меня на поясе. Сорви его — и тест пройден!', hurt: 'Хорошо! Вот так!', low: 'Ты вырос, {name}.', win: 'Ещё рано. Тренируйся!', lose: 'Молодец! Я горжусь тобой.' } },
  mizuki:    { name: 'Мизуки', spr: 'mizuki', male: true, hp: 210, ch: 90, tai: 8, nin: 7, gen: 5, spd: 7, end: 7, know: 7, focus: 2, pref: 3,
               acts: ['giant', 'kunai', 'combo', 'taunt', 'retreat', 'approach'], traits: ['kawarimi', 'deceive', 'climb', 'smart'], phase2: true,
               lines: { start: 'Ирука-сенсей тебе врал. Все тебе врали!', hurt: 'Щенок!', low: 'Довольно игр!', win: 'Свиток мой!', lose: 'Не... может... быть...' } },
};

// Арены: объекты на 5 позициях
G.ARENAS = {
  yard:   { name: 'Двор Академии', sky: ['#8ac8f0', '#cfe8f8'], ground: '#c8a26a', far: '#6a9a5a', obj: { 0: 'tree', 4: 'logs' } },
  field:  { name: 'Полигон', sky: ['#8ac8f0', '#d8eef8'], ground: '#7cb05a', far: '#3e7a34', obj: { 0: 'tree', 2: 'bush', 4: 'rock' } },
  forest: { name: 'Лес', sky: ['#4a7a5a', '#8ab08a'], ground: '#4e7a3a', far: '#1e4a26', obj: { 0: 'tree', 1: 'bush', 3: 'bush', 4: 'tree' } },
  night:  { name: 'Ночной лес', sky: ['#0e0c26', '#2a2a4a'], ground: '#2a3a2a', far: '#141e1a', obj: { 0: 'tree', 1: 'bush', 3: 'tree', 4: 'rock' }, dark: true },
  river:  { name: 'Берег реки', sky: ['#8ac8f0', '#d8eef8'], ground: '#9ac06a', far: '#3e7a34', obj: { 0: 'tree', 2: 'water', 4: 'rock' } },
  street: { name: 'Улица', sky: ['#f0b070', '#f8d8a8'], ground: '#b8945a', far: '#8a5a3a', obj: { 4: 'rock' } },
  ring:   { name: 'Арена турнира', sky: ['#8ac8f0', '#e8f4f8'], ground: '#d8b67a', far: '#a8683a', obj: {}, ring: true },
};

G.combat = {
  // мастерство техники 0..3 (от количества применений)
  mastery(t) { const u = G.state.vars['use_' + t] || 0; return u >= 18 ? 3 : u >= 10 ? 2 : u >= 4 ? 1 : 0; },
  knows(t) { return !!G.state.flags['tech_' + t]; },
  knowsCombo(c) { return c === 'academy' || !!G.state.flags['combo_' + c]; },
};

// ── Новые приёмы и противники ──
Object.assign(G.EACTS, {
  bugs:    { name: 'Жуки-разрушители', range: [1, 3], w: 14, kind: 'tai', dmg: 5, drain: 18, jutsu: true, fx: 'bug' },
  bugwall: { name: 'Стена жуков',      range: [1, 3], w: 10, kind: 'bind', jutsu: true, fx: 'bug' },
  duo:     { name: 'Двойной Гацуга!',  range: [1, 3], w: 15, kind: 'tai', dmg: 9, hits: 2, lunge: true, jutsu: true, fx: 'duo' },
  snake:   { name: 'Змеиная хватка',   range: [1, 3], w: 13, kind: 'bind', jutsu: true, fx: 'snake' },
  blades:  { name: 'Клинки чакры',     range: [1, 1], w: 14, kind: 'tai', dmg: 8, hits: 2, jutsu: true, fx: 'blades' },
  smoke:   { name: 'Дымовая завеса',   range: [0, 9], w: 9,  kind: 'gen', jutsu: true, fx: 'smoke' },
  flame:   { name: 'Огненная пуля',    range: [2, 4], w: 14, kind: 'nin', dmg: 15, jutsu: true, fx: 'fire' },
  prank:   { name: 'Проделка!',        range: [1, 2], w: 10, kind: 'tai', dmg: 6, hits: 2, lunge: true, fx: 'duo' },
});
G.ENEMIES.shino = { name: 'Шино', spr: 'shino', male: true, hp: 95, ch: 70, tai: 3, nin: 6, gen: 2, spd: 4, end: 5, know: 8, focus: 2, pref: 3,
  acts: ['bugs', 'bugwall', 'kunai', 'retreat', 'guard', 'approach'], traits: ['defensive', 'smart'],
  lines: { start: 'Мои жуки уже в пути. Сдавайся — это логично.', hurt: 'Интересно.', low: 'Колония слабеет... но я не отступлю.', win: 'Расчёт был верным.', lose: 'Невероятно. Жуки... ошиблись.' } };
G.ENEMIES.anko = { name: 'Анко', spr: 'anko', hp: 150, ch: 80, tai: 7, nin: 7, gen: 3, spd: 8, end: 6, know: 6, focus: 2, pref: 2,
  acts: ['snake', 'kunai', 'combo', 'flame', 'approach', 'retreat'], traits: ['kawarimi', 'impulsive'],
  lines: { start: 'Покажи, на что способен, малявка!', hurt: 'Ха! Неплохо!', low: 'Даже не думала, что придётся вспотеть!', win: 'Мало данго ты ешь, парень.', lose: 'Ладно-ладно... ты меня удивил.' } };
G.ENEMIES.asuma = { name: 'Асума', spr: 'asuma', male: true, hp: 170, ch: 90, tai: 8, nin: 7, gen: 2, spd: 7, end: 8, know: 8, focus: 3, pref: 1,
  acts: ['blades', 'combo', 'strike', 'guard', 'flame', 'approach'], traits: ['smart', 'kawarimi'], phase2: true,
  lines: { start: 'Шикамару твердит, что ты упрямый. Проверим.', hurt: 'Хм, неплохо!', low: 'Ладно, хватит играть.', win: 'Вырастешь — станешь опасным.', lose: 'Вот это да. Респект, малыш.' } };
G.ENEMIES.konohamaru = { name: 'Конохамару', spr: 'konohamaru', male: true, hp: 60, ch: 30, tai: 3, nin: 2, gen: 1, spd: 5, end: 3, know: 1, focus: 1, pref: 1,
  acts: ['prank', 'strike', 'kunai', 'clones', 'approach'], traits: ['impulsive', 'clones'],
  lines: { start: 'Босс сказал, нужно сначала победить тебя! Сексуальное дзюцу-у-у!', hurt: 'Ай! Я же внук Хокаге!', win: 'Я круче всех!', lose: 'Погоди... я вырасту и вернусь!' } };
G.ENEMIES.kiba.acts = ['strike', 'combo', 'fang', 'duo', 'approach', 'dash'];

// ── Стихийные техники (изучаются у наставников) ──
Object.assign(G.TECHS, {
  katon:   { name: 'Катон: Огненный шар', seals: _S(['Змея', 'Овца', 'Обезьяна', 'Кабан', 'Лошадь', 'Тигр']), ch: 22, w: 11, el: 'fire',  desc: 'Огненный шар: мощный урон, слабее по мокрым.' },
  suiton:  { name: 'Суйтон: Водяная пуля', seals: _S(['Бык', 'Заяц', 'Дракон']),                            ch: 14, w: 9,  el: 'water', desc: 'Струя воды: умеренный урон, враг промокает (молния ×1,6).' },
  raiton:  { name: 'Райтон: Разряд',       seals: _S(['Бык', 'Заяц', 'Обезьяна']),                           ch: 18, w: 10, el: 'bolt',  desc: 'Электрический разряд, может оглушить. По мокрым ×1,6.' },
  fuuton:  { name: 'Футон: Порыв',         seals: _S(['Тигр', 'Дракон', 'Заяц']),                            ch: 15, w: 8,  el: 'wind',  desc: 'Ветер отбрасывает врага и сбивает его ритм.' },
});
G.TECH_ORDER.push('katon', 'suiton', 'raiton', 'fuuton');
