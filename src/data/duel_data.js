// Данные карточной «Дуэли»: техники и их печати для тренировок, противники со стилями, арены. Правила — systems/duel.js, docs/COMBAT.md.
G.SEALS = ['Крыса', 'Бык', 'Тигр', 'Заяц', 'Дракон', 'Змея', 'Лошадь', 'Овца', 'Обезьяна', 'Птица', 'Собака', 'Кабан'];
G.SEAL_COL = ['#9a9aa8', '#a8683a', '#e8a03a', '#e8dcc0', '#4a8ad0', '#6ab04a', '#c87a4a', '#f4ecd8', '#c8a050', '#f0a0c0', '#b0a090', '#8a5a3a'];
const _S = (names) => names.map((n) => G.SEALS.indexOf(n));

// Техники ниндзюцу/гендзюцу. ch — стоимость чакры, seals — последовательность печатей.
G.TECHS = {
  kawarimi: { name: 'Каварими',       seals: _S(['Овца', 'Кабан', 'Бык', 'Собака', 'Змея']), ch: 8,  desc: 'Замена поленом в ответ на атаку и контрудар из-за спины.' },
  henge:    { name: 'Хенге',          seals: _S(['Собака', 'Кабан', 'Овца']),                ch: 8,  desc: 'Превращение сбивает врага с толку: он пропускает действие в конце хода.' },
  fear:     { name: 'Ложный страх',   seals: _S(['Тигр', 'Змея', 'Крыса', 'Птица']),         ch: 12, gen: true, desc: 'Гендзюцу: кошмар ослабляет атаки врага на два действия и снимает его блок.' },
  bunshin:  { name: 'Буншин',         seals: _S(['Овца', 'Змея', 'Тигр']),                   ch: 14, desc: 'Два иллюзорных клона принимают удары на себя.' },
  sexy:     { name: 'Секси-дзюцу',    seals: _S(['Овца']),                                   ch: 6,  desc: 'Подарок Наруто. Противник-мужчина в нокдауне. Позор.' },
  shunshin: { name: 'Шуншин',         seals: _S(['Тигр']),                                   ch: 15, desc: 'Мгновенный удар от Скорости и полное уклонение от ответной атаки.' },
};
G.TECH_ORDER = ['henge', 'fear', 'bunshin', 'sexy', 'shunshin'];
// Первая боевая техника ниндзюцу: выстрел чакрой (урок Ируки в день 2)
G.TECHS.chakra_shot = { name: 'Выстрел чакры', seals: _S(['Тигр', 'Заяц']), ch: 10, desc: 'Сгусток чакры бьёт на расстоянии и не даёт уклониться; усиливается меткой куная.' };
G.TECH_ORDER.unshift('chakra_shot');


// Связки (награды дружбы Ли открывают бонус к цепочке успешных ударов)
G.COMBOS = {
  academy: { name: 'Связка Академии', bonus: 0.04, desc: 'Цепочка ударов Ируки.' },
  air:     { name: 'Воздушное комбо', bonus: 0.04, desc: 'Подбросить и добить в прыжке (Гай).' },
  whirl:   { name: 'Вихрь Листа',     bonus: 0.06, desc: 'Коноха Сэнпу! (Рок Ли).' },
};

// Противники. hp — здоровье в новой шкале; tai/nin/gen/spd/end/know — характеристики (как у героя);
// style: dummy (стоит), rush (напирает), counter (отвечает на последнее действие героя), reader (читает частоту действий),
// turtle (защищается), trickster (ослабляет следующий ход иллюзиями), brute (готовит тяжёлый удар каждые три хода);
// tech — коронный приём: kind dmg (урон), drain (крадёт чакру), bind (запрещает обычный уклон), fear (−1 карта и действие); cost — чакра.
G.ENEMIES = {
  dummy: {name:'Манекен',spr:'dummy',male:false,grow:false,dmg:0,hp:25,ch:0,tai:1,nin:0,gen:0,spd:1,end:1,know:0,style:'dummy',lines:{start:'...',hurt:'*скрип*'}},
  dummy2: {name:'Манекен Ируки',spr:'dummy',male:false,grow:false,dmg:4,hp:30,ch:0,tai:2,nin:0,gen:0,spd:2,end:2,know:0,style:'dummy',lines:{start:'*скрип-скрип*'}},
  kiba: {name:'Киба',spr:'kiba',male:true,grow:false,dmg:17.5,hp:55,ch:34,tai:7,nin:3,gen:1,spd:6,end:5,know:2,style:'rush',tech:{name:'Гацуга',power:1.8,kind:'dmg',cost:16},lines:{start:'Новенький? Мы с Акамару тебя мигом уделаем!',hurt:'Акамару, это ничего!',low:'Чёрт... да ты не так прост!',win:'Ха! Сила стаи!',lose:'Ладно-ладно... в следующий раз!'}},
  naruto: {name:'Наруто',spr:'naruto',male:true,grow:false,dmg:20.5,hp:70,ch:80,tai:6,nin:4,gen:1,spd:7,end:10,know:1,style:'rush',tech:{name:'Теневые клоны',power:1.6,kind:'dmg',cost:20},lines:{start:'Даттебайо! Покажу тебе стиль будущего Хокаге!',hurt:'Ай-ай! Это нечестно!',low:'Я никогда не сдаюсь!',win:'Ура! Видел?!',lose:'Эх... ты крутой! Ещё раз!'}},
  sasuke: {name:'Саске',spr:'sasuke',male:true,grow:false,dmg:38.9,hp:128,ch:60,tai:8,nin:6,gen:3,spd:8,end:8,know:5,style:'counter',tech:{name:'Огненный шар',power:2.2,kind:'dmg',cost:22},lines:{start:'Хм. Посмотрим, чего ты стоишь.',hurt:'Тц.',low:'Не может быть...',win:'Ты слабак.',lose:'...Неплохо. В следующий раз я не проиграю.'}},
  shikamaru: {name:'Шикамару',spr:'shikamaru',male:true,grow:false,dmg:58.4,hp:135,ch:50,tai:3,nin:5,gen:2,spd:4,end:4,know:9,style:'reader',tech:{name:'Теневая ловушка',power:0.65,kind:'bind',cost:18},lines:{start:'Как же это всё хлопотно...',hurt:'Ох...',low:'Ладно, сдаюсь... почти.',win:'Сто ходов вперёд, как в шоги.',lose:'Хлопотно. Сдаюсь.'}},
  hinata: {name:'Хината',spr:'hinata',male:false,grow:false,dmg:31,hp:95,ch:60,tai:6,nin:5,gen:2,spd:6,end:5,know:5,style:'turtle',tech:{name:'Мягкий кулак',power:1.2,kind:'drain',cost:16},lines:{start:'Я... я постараюсь! Прости заранее!',hurt:'Н-ничего...',low:'Я не отступлю... как Наруто!',win:'Ой! Ты в порядке?!',lose:'Ты очень сильный...'}},
  choji: {name:'Чоджи',spr:'choji',male:true,grow:false,dmg:29,hp:144,ch:50,tai:11,nin:6,gen:1,spd:2,end:11,know:2,style:'brute',tech:{name:'Баика',power:2.4,kind:'dmg',cost:20},lines:{start:'После боя — чипсы! Ням!',hurt:'Уф!',low:'Я не толстый! Я широкой кости!!!',win:'Хрум! Победные чипсы!',lose:'Пойду поем...'}},
  ino: {name:'Ино',spr:'ino',male:false,grow:false,dmg:50.2,hp:84,ch:55,tai:4,nin:4,gen:7,spd:5,end:4,know:5,style:'trickster',tech:{name:'Иллюзия Яманака',power:0,kind:'fear',cost:18},lines:{start:'Быстренько закончим — мне ещё к Саске!',hurt:'Эй, причёска!',low:'Как ты смеешь?!',win:'Красота — тоже сила!',lose:'Хмф! Повезло тебе.'}},
  lee: {name:'Рок Ли',spr:'lee',male:true,grow:false,dmg:32.5,hp:70,ch:0,tai:10,nin:0,gen:0,spd:11,end:11,know:2,style:'rush',tech:{name:'Коноха Сэнпу',power:2,kind:'dmg',cost:14},lines:{start:'Сила юности! Покажи мне свою!',hurt:'Отличный удар!',low:'Гай-сенсей, я не подведу!',win:'Тренируйся! 500 кругов вокруг деревни!',lose:'Великолепно! Ты — мой соперник!'}},
  bully: {name:'Хулиган',spr:'bully',male:true,grow:true,dmg:19.1,hp:50,ch:20,tai:4,nin:1,gen:0,spd:3,end:4,know:1,style:'rush',tech:{name:'Бросок кунаев',power:1.3,kind:'dmg',cost:10},lines:{start:'Эй, мелкий! Гони деньги!',hurt:'Ах ты!',win:'Ха, слабак!',lose:'Б-бежим отсюда!'}},
  senior: {name:'Старшеклассник',spr:'bully',male:true,grow:false,dmg:25,hp:80,ch:40,tai:7,nin:4,gen:2,spd:8,end:9,know:8,style:'counter',tech:{name:'Бросок кунаев',power:1.5,kind:'dmg',cost:12},lines:{start:'Свиток? Попробуй отними, малявка!',hurt:'Тц, шустрый!',low:'Да кто ты такой?!',win:'Свиток останется у нас.',lose:'Ладно-ладно, забирай!'}},
  thief: {name:'Ночной вор',spr:'thief',male:true,grow:true,dmg:29,hp:50,ch:30,tai:4,nin:2,gen:2,spd:7,end:4,know:4,style:'trickster',tech:{name:'Дымовая завеса',power:0,kind:'fear',cost:12},lines:{start:'Ученичок? Не мешай работать.',hurt:'Шустрый...',win:'Сладких снов.',lose:'Сдаюсь! Отдам всё!'}},
  dog: {name:'Бродячий пёс',spr:'dog',male:false,grow:true,dmg:21.5,hp:40,ch:0,tai:5,nin:0,gen:0,spd:7,end:3,know:0,style:'rush',tech:{name:'Рывок',power:1.3,kind:'dmg',cost:0},lines:{start:'Р-р-р-гав!',lose:'Скуль-скуль...'}},
  iruka: {name:'Ирука',spr:'iruka',male:true,grow:false,dmg:45.9,hp:113,ch:70,tai:7,nin:6,gen:4,spd:7,end:7,know:8,style:'counter',tech:{name:'Приём сенсея',power:1.6,kind:'dmg',cost:16},lines:{start:'Колокольчик у меня на поясе. Сорви его — и тест пройден!',hurt:'Хорошо! Вот так!',low:'Ты вырос, {name}.',win:'Ещё рано. Тренируйся!',lose:'Молодец! Я горжусь тобой.'}},
  shino: {name:'Шино',spr:'shino',male:true,grow:false,dmg:30,hp:90,ch:70,tai:3,nin:6,gen:2,spd:4,end:5,know:8,style:'reader',tech:{name:'Жуки-разрушители',power:1,kind:'drain',cost:18},lines:{start:'Мои жуки уже в пути. Сдавайся — это логично.',hurt:'Интересно.',low:'Колония слабеет... но я не отступлю.',win:'Расчёт был верным.',lose:'Невероятно. Жуки... ошиблись.'}},
  anko: {name:'Анко',spr:'anko',male:false,grow:false,dmg:28,hp:85,ch:80,tai:7,nin:7,gen:3,spd:8,end:6,know:6,style:'trickster',tech:{name:'Змеиная хватка',power:0.55,kind:'bind',cost:18},lines:{start:'Покажи, на что способен, малявка!',hurt:'Ха! Неплохо!',low:'Даже не думала, что придётся вспотеть!',win:'Мало данго ты ешь, парень.',lose:'Ладно-ладно... ты меня удивил.'}},
  asuma: {name:'Асума',spr:'asuma',male:true,grow:false,dmg:30,hp:90,ch:90,tai:8,nin:7,gen:2,spd:7,end:8,know:8,style:'counter',tech:{name:'Клинки чакры',power:1.9,kind:'dmg',cost:20},lines:{start:'Шикамару твердит, что ты упрямый. Проверим.',hurt:'Хм, неплохо!',low:'Ладно, хватит играть.',win:'Вырастешь — станешь опасным.',lose:'Вот это да. Респект, малыш.'}},
  stranger: {name:'Незнакомец в плаще',spr:'thief',male:true,grow:false,dmg:44,hp:118,ch:80,tai:8,nin:7,gen:6,spd:8,end:7,know:9,style:'reader',tech:{name:'Печать подавления',power:1.7,kind:'dmg',cost:18},lines:{start:'Покажи, чего стоит твоя фиолетовая. Или уходи, пока цел.',hurt:'...Значит, не пустой звук.',low:'Держишься. Уже интересно.',win:'Слабо. Но не безнадёжно.',lose:'...Вот как это — когда держит кто-то, кроме страха.'}},
  konohamaru: {name:'Конохамару',spr:'konohamaru',male:true,grow:false,dmg:12,hp:45,ch:30,tai:3,nin:2,gen:1,spd:5,end:3,know:1,style:'trickster',tech:{name:'Проделка',power:1.2,kind:'dmg',cost:10},lines:{start:'Босс сказал, нужно сначала победить тебя! Сексуальное дзюцу-у-у!',hurt:'Ай! Я же внук Хокаге!',win:'Я круче всех!',lose:'Погоди... я вырасту и вернусь!'}},

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


// ── Стихийные техники (изучаются у наставников) ──
Object.assign(G.TECHS, {
  katon:   { name: 'Катон: Огненный шар', seals: _S(['Змея', 'Овца', 'Обезьяна', 'Кабан', 'Лошадь', 'Тигр']), ch: 22, el: 'fire',  desc: 'Огненный шар: мощный урон, слабее по мокрым.' },
  suiton:  { name: 'Суйтон: Водяная пуля', seals: _S(['Бык', 'Заяц', 'Дракон']),                            ch: 14, el: 'water', desc: 'Струя воды: умеренный урон, враг промокает (молния ×1,6).' },
  raiton:  { name: 'Райтон: Разряд',       seals: _S(['Бык', 'Заяц', 'Обезьяна']),                           ch: 18, el: 'bolt',  desc: 'Электрический разряд, может оглушить. По мокрым ×1,6.' },
  fuuton:  { name: 'Футон: Порыв',         seals: _S(['Тигр', 'Дракон', 'Заяц']),                            ch: 15, el: 'wind',  desc: 'Ветер снимает защиту, ослабляет ответную атаку и позволяет взять карту.' },
});
G.TECH_ORDER.push('katon', 'suiton', 'raiton', 'fuuton');
