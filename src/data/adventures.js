// «Дороги Листа»: задания, учебные программы, архив и рецепты дополнения.
G.ADVENTURES = {
  clans: [
    { id:'nara', name:'Нара', gift:'shogi', perk:'Свиток тактики: +1 фокус в новых миссиях' },
    { id:'hyuga', name:'Хьюга', gift:'herb_blue', perk:'Дыхательная практика: +10 чакры перед вылазкой' },
    { id:'inuzuka', name:'Инузука', gift:'dog_treat', perk:'Следопыты отмечают тайник в лесу' },
    { id:'yamanaka', name:'Яманака', gift:'flowers_m', perk:'Семейный рецепт цветочного чая' },
    { id:'aburame', name:'Абураме', gift:'bug_jar', perk:'Жуки находят безопасный обход дозорного' },
    { id:'akimichi', name:'Акимичи', gift:'chips', perk:'Секретный рецепт походных онигири' },
  ],
  mentors: [
    { id:'iruka', name:'Ирука', stat:'ctrl', mg:'tree', lesson:'Контроль чакры и водная техника', flag:'adv_wallrun', tech:'suiton' },
    { id:'lee', name:'Рок Ли', stat:'spd', mg:'run', lesson:'Ритм прыжков и Вихрь Листа', flag:'adv_runner', grant:'combo_whirl' },
    { id:'shikamaru', name:'Шикамару', stat:'know', mg:'quiz', lesson:'Чтение намерений', flag:'adv_tactician', grant:'tactic' },
    { id:'asuma', name:'Асума', stat:'nin', mg:'seals', lesson:'Футон: Порыв', flag:'adv_wind', tech:'fuuton' },
    { id:'anko', name:'Анко', stat:'nin', mg:'seals', lesson:'Катон: Огненный шар', flag:'adv_fire', tech:'katon' },
    { id:'kakashi', name:'Какаши', stat:'ctrl', mg:'seals', lesson:'Райтон: Разряд', flag:'adv_lightning', tech:'raiton' },
  ],
  books: [
    { id:'watch', title:'Дневник дозорного', text:'Мост смыло весенним паводком. Мы привязали проволоку к двум столбам: так можно перебраться даже без водной техники. Запас оставили у лесного поста.', map:'adv:forest', x:9, y:8 },
    { id:'seal', title:'Письмо хранителю', text:'Три печати хранят архив. Сначала приходит Вода, затем над лесом поднимается Ветер, и лишь потом загорается Огонь. Силой барьер не открыть.', map:'adv:tower2', x:3, y:3 },
    { id:'clans', title:'Соглашение кланов', text:'Кланы доверяют делам. Помощь каравану сближает с Яманака и Нара; спасение людей у реки ценят Хьюга и Инузука. Подарок сам по себе не заменит службу.', map:'adv:cellar', x:4, y:3 },
    { id:'genin', title:'Полевые записи команды', text:'Генин отвечает за возвращение всей команды. Перед миссией изучи следы, подготовь инструменты и договорись о сигналах. Враг, с которым удалось поговорить, тоже может стать союзником.', map:'adv:outpost', x:24, y:6 },
  ],
  recipes: [
    { id:'adv_onigiri', name:'Походные онигири', need:{rice:2,vegetables:1}, flag:'adv_recipe_onigiri', effect:{food:55,energy:15}, friend:'choji' },
    { id:'adv_flower_tea', name:'Цветочный чай', need:{herb:2,herb_blue:1}, flag:'adv_recipe_tea', effect:{energy:25,chakra:20,mood:10}, friend:'ino' },
    { id:'adv_tomato_rice', name:'Рис с томатами', need:{rice:1,tomato:2}, flag:'adv_recipe_rice', effect:{food:40,hp:15}, friend:'sasuke' },
  ],
  seasons: [
    { name:'Весна', color:'#edb6c8', gather:'herb', text:'Цветение. В лесу удобно собирать лечебные травы.' },
    { name:'Лето', color:'#85b457', gather:'berries', text:'Созрели ягоды. Длинные светлые вечера на реке.' },
    { name:'Осень', color:'#d99852', gather:'vegetables', text:'Листопад. У поста делятся свежим урожаем.' },
    { name:'Зима', color:'#c2dce9', gather:'herb_blue', text:'На тропах снег. У реки остались морозные лотосы.' },
  ],
};

// Координаты цели относятся к новой карте, а не к сетке Конохи.
const _advStep = (id,text,map,x,y) => ({id,text,target:{map,point:[x*16+8,y*16+12],label:text}});
Object.assign(G.QUESTS, {
  adv_cargo:{title:'Пропавший груз',cat:'errand',desc:'Разведай лесную тропу, выбери подход к дозорному и верни груз. Решение запомнят кланы.',steps:[
    _advStep('scout','Осмотри следы в лесу','adv:forest',13,14),
    _advStep('prepare','Подготовь подход у поста','adv:forest',18,14),
    _advStep('cargo','Верни груз у дозорного','adv:forest',26,13),
    _advStep('report','Доложи на доске экспедиций','konoha',0,0),
  ],reward:{money:100,text:'100 рё и доверие кланов'}},
  adv_rescue:{title:'Переправа после паводка',cat:'errand',desc:'Выбери порядок спасения людей и груза у реки. Сначала узнай, кто в опасности.',steps:[
    _advStep('survey','Изучи обстановку у реки','adv:river',10,11),
    _advStep('bridge','Натяни страховку через реку','adv:river',15,14),
    _advStep('people','Помоги людям на другом берегу','adv:river',25,12),
    _advStep('report','Доложи о спасении','konoha',0,0),
  ],reward:{money:120,text:'120 рё и помощь посту'}},
  adv_archive:{title:'Закрытый архив',cat:'secret',desc:'Найди подсказку о печатях, открой барьер и реши судьбу хранителя.',steps:[
    _advStep('letter','Прочитай письмо на втором этаже','adv:tower2',3,3),
    _advStep('seal','Открой барьер на балконе','adv:balcony',8,3),
    _advStep('guardian','Встреться с хранителем в подвале','adv:cellar',10,5),
    _advStep('report','Доложи об архиве','konoha',0,0),
  ],reward:{money:150,text:'150 рё и архивный свиток'}},
  adv_dispute:{title:'Сначала выслушать',cat:'friend',desc:'Сакура и Ино спорят из-за пропавшего букета. Выслушай обеих до решения.',steps:[
    _advStep('sakura','Выслушай Сакуру через доску встреч','konoha',0,0),
    _advStep('ino','Выслушай Ино через доску встреч','konoha',0,0),
    _advStep('resolve','Помоги подругам договориться','konoha',0,0),
  ],reward:{text:'Новое отношение подруг'}},
  adv_genin1:{title:'Генин: разведка границы',cat:'story',desc:'Первая командная миссия. Проверь пост, изучи донесение и доставь отчёт.',steps:[
    _advStep('brief','Получи инструктаж у командного стенда','adv:outpost',6,6),
    _advStep('scout','Проверь лесной сигнальный столб','adv:forest',29,7),
    _advStep('report','Верни отчёт командному стенду','adv:outpost',6,6),
  ],reward:{money:160,text:'160 рё, следующий ранг миссий'}},
  adv_genin2:{title:'Генин: охрана переправы',cat:'story',desc:'Команда сопровождает обоз. Подготовь переправу и выбери способ остановить налётчика.',steps:[
    _advStep('brief','Подготовь вылазку у командного стенда','adv:outpost',6,6),
    _advStep('escort','Защити обоз у реки','adv:river',27,20),
    _advStep('report','Доложи командному стенду','adv:outpost',6,6),
  ],reward:{money:190,text:'190 рё, командный опыт'}},
  adv_genin3:{title:'Генин: допуск к экзамену',cat:'story',desc:'Выдержи учебную дуэль с тремя фазами и получи направление на экзамен чунина.',steps:[
    _advStep('brief','Получи последнее задание на посту','adv:outpost',6,6),
    _advStep('trial','Пройди испытание у тренировочного знака','adv:outpost',22,18),
    _advStep('report','Забери направление на экзамен','adv:outpost',6,6),
  ],reward:{money:220,text:'Допуск к экзамену чунина'}},
});
for(const r of G.ADVENTURES.recipes)G.ITEMS[r.id]={name:r.name,price:0,cat:'food',effect:r.effect,desc:'Семейный рецепт. Приготовь дома из ингредиентов; можно подарить другу.'};

// Новые противники используют расширенные правила только в миссиях дополнения.
G.ENEMIES.adv_guard=Object.assign({},G.ENEMIES.thief,{name:'Лесной дозорный',grow:false,hp:85,tai:4,spd:5,traits:['smart','adaptive'],lines:{start:'Дальше нельзя. У меня приказ.',lose:'Хорошо. Давай разберёмся без угроз.'}});
G.ENEMIES.adv_keeper=Object.assign({},G.ENEMIES.iruka,{name:'Хранитель архива',spr:'chunin',hp:110,ch:80,tai:5,nin:5,spd:5,focus:2,phase2:false,traits:['smart','adaptive'],advPhases:true,lines:{start:'Покажи, что умеешь менять тактику.',low:'Следующая стойка!',lose:'Ты достоин хранить знания.'}});
G.ENEMIES.adv_trial=Object.assign({},G.ENEMIES.adv_keeper,{name:'Экзаменатор поста',hp:150,tai:7,nin:6,spd:7});
G.TECHS.doton={name:'Дотон: Земляной щит',seals:_S(['Змея','Бык','Собака']),ch:16,w:8,el:'earth',desc:'Земляное укрытие снижает урон двух атак на 40%.'};
G.TECH_ORDER.push('doton');
