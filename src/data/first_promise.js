// «Первое обещание»: новая история собственного героя. Старые ключи финала сохраняют совместимость сейвов.
(() => {
  const clone=(id,from,name)=>{G.chars.DEFS[id]={...G.chars.DEFS[from],name};G.chars.STY[id]={...G.chars.STY[from]};if(G.CHAR_ART[from])G.CHAR_ART[id]=G.CHAR_ART[from];};
  clone('yuta','courier','Юта');clone('gendo','merchant','Гэндо');
  G.ENEMIES.gendo={...G.ENEMIES.mizuki,name:'Гэндо',spr:'gendo',grow:false,lines:{start:'Ты полез не в своё дело, ученик.',low:'Груз всё равно будет моим!',lose:'Как вы успели?..'}};
  G.ITEMS.promise_parcel={name:'Посылка Гэндо',cat:'misc',quest:true,price:0,desc:'Три адреса: рынок, цветочная лавка и больница. На обёртке служебная печать.'};
  G.QUESTS.day1.desc='Ты приехал в Коноху и поступаешь в выпускной класс. До экзамена восемь недель. Познакомься с Ирукой и одноклассниками.';
  G.QUESTS.promise_parcels={cat:'story',title:'Маленькие поручения',desc:'Юта предложил подработку у торговца Гэндо. Доставь три посылки и вернись за оплатой.',offer:{npc:'yuta',script:'promise_offer',when:()=>G.state.vars.day>=4&&!!G.state.flags.enrolled},steps:[
    {id:'market',text:'Отнести посылку на рынок',target:{building:'market'},reach:true,need:{promise_parcel:1},consume:true},
    {id:'flowers',text:'Отнести посылку в цветочную лавку',target:{building:'flowers'},reach:true,need:{promise_parcel:1},consume:true},
    {id:'hospital',text:'Отнести посылку в больницу',target:{building:'hospital'},reach:true,need:{promise_parcel:1},consume:true},
    {id:'pay',text:'Вернуться к Юте за оплатой',target:{npc:'yuta'},script:'promise_paid'},
  ],reward:{money:100,text:'100 рё и знакомство с Ютой'}};
  G.QUESTS.promise_case={cat:'story',title:'Печать на посылке',desc:'Из склада исчезли лекарства. Юта был последним курьером. Найди друга и разберись в случившемся.',steps:[
    {id:'yuta',text:'Найти Юту у рынка',target:{npc:'yuta'},script:'promise_confession'},
    {id:'iruka',text:'Рассказать Ируке о посылках',target:{npc:'iruka',in:'academy'},script:'promise_report'},
    {id:'forest',text:'Дождаться разведки с Ирукой (с дня 38)',target:{building:'academy'}},
    {id:'back',text:'Обсудить найденное с Ютой',target:{npc:'yuta'},script:'promise_reconcile'},
  ],reward:{vars:{rep:3},text:'Маршрут Гэндо раскрыт'}};
  G.QUESTS.promise_rescue={cat:'story',title:'Первое обещание',desc:'Юта не пришёл на встречу. Гэндо вывозит груз со склада. Ирука задержит сообщников, а ты выведешь людей.',steps:[{id:'people',text:'Удержать проход и вывести рабочих',target:{building:'hokage_tower'}},{id:'gendo',text:'Остановить Гэндо у склада',target:{building:'hokage_tower'}}],reward:{text:'Юта и рабочие спасены'}};
  G.STORY=G.STORY.filter(e=>!['memory','mizuki1','mizuki2'].includes(e.id));
  for(const e of G.STORY){if(e.id==='night'){e.script='promise_night';e.place='market';e.when=()=>G.quests.done('promise_case');}if(e.id==='field'){e.script='promise_field';e.must=true;e.after='promise_missing';e.when=()=>G.quests.curStep('promise_case')?.id==='forest';}}
  G.STORY.push({id:'promise_meet',day:4,from:13*60,to:21*60,where:'out',must:true,script:'promise_meet'},
    {id:'promise_mark',day:31,from:13*60,to:21*60,where:'out',must:true,script:'promise_mark'},
    {id:'promise_missing',day:33,from:13*60,to:21*60,where:'out',must:true,script:'promise_missing'});
  Object.assign(G.calendar.EVENTS,{4:'Знакомство с Ютой',31:'Знакомая печать',33:'Пропавшие лекарства',38:'Лесная разведка',54:'Экзамен и первое обещание'});
  G.script.parse(`
=== prologue_voices
: Колёса телеги гремят по дороге. За поворотом появляются ворота Конохи.
: Новый класс. Новый дом. До выпускного экзамена всего восемь недель.
: После долгой дороги тебя проводят в больницу: Сидзуне хочет убедиться, что ты можешь завтра заниматься.
: За дверью слышен голос: «Хокаге-сама, новенький уже здесь».
end
=== hosp_wake
shizune: Добро пожаловать в Коноху. С дороги нужно отдохнуть и поесть.
hokage: Я Сарутоби Хирузен. А как зовут нашего нового ученика?
call askname
end
=== hosp_after_name
call met iruka
hokage: {name}, мы получили бумаги о твоём переводе. В выпускном классе Академии есть место.
iruka: Я Умино Ирука. За восемь недель разберёмся, что ты умеешь, и подготовимся к экзамену.
? Готов начать?
* Постараюсь изо всех сил! -> go
* Я немного волнуюсь -> worry
# worry
iruka: Это нормально. Приходи за помощью, когда она нужна.
# go
hokage: Для тебя приготовили небольшой дом и деньги на первое время. Осваивайся.
set flag.hosp_done = 1
call begin
call quest start day1
: Двигайся джойстиком или стрелками. A - разговор и осмотр. Карта, Цель и журнал помогут найти Академию.
end
=== home_first
: Небольшая комната, татами, мешок риса и чистая постель. Здесь начинается твоя жизнь в Конохе.
end
=== iruka_class
if flag.enrolled -> enrolled
iruka: Вот и ты, {name}. Познакомимся после вступительного упражнения.
call charcreate
end
# enrolled
if quest.homework.show -> homework
iruka: Утром приходи на урок. После 13:00 можно повторить занятие. В меню есть раздел Обучение: учителя, места и путь к ним.
end
# homework
call run iruka_homework
end
=== iruka_after_test
set flag.enrolled = 1
iruka: Хорошо. Теперь ты ученик моего класса. Учебный день начинается утром, а после занятий остаётся время для практики.
iruka: Найди Наруто у качелей. Кажется, он снова кого-то ищет для своих затей.
call step day1 iruka
call quest start homework
end
=== day2_morning
: Первое утро в Конохе. Из окна слышны шаги учеников.
iruka: Приходи в Академию до 9:30. После уроков загляни на полигон. Раздел Обучение подскажет следующую задачу.
end
=== st_exam_fail
iruka: {name}, сегодня баллов не хватило. Мы разберём ошибки и позанимаемся ещё.
: У качелей сидит Наруто. Он тоже не сдал Буншин.
naruto: Слышишь? Мы всё равно справимся. Обещание действует.
end
=== st_bells_win
iruka: Дзинь! Молодец. Ты нашёл подходящий момент.
iruka: Помню твоё первое занятие. Ты многому научился, {name}. Горжусь тобой.
call friend iruka 4
call xp nin 10
set flag.bells_done = 1
end
=== promise_meet
: На повороте Наруто пытается поймать рыжую кошку. Ты отскакиваешь - и задеваешь тележку с овощами.
naruto: Ой. Мы ведь это быстро соберём, правда?
yuta: Если поможете, я даже не скажу торговке, кто перевернул её морковь.
: Пока вы собираете овощи, курьер представляется: Юта. Он знает все адреса Конохи и мечтает открыть службу доставки.
naruto: Слышишь, {name}? Мы оба станем генинами. И никто не останется один у этих качелей. Обещаешь?
? Что ответишь?
* Обещаю. Справимся вместе -> yes
* Только сначала поймай свою кошку -> joke
# joke
naruto: Она ещё получит своё! А обещание я всё равно запомнил.
-> finish
# yes
naruto: Вот! Я знал, что ты свой.
# finish
call friend naruto 2
yuta: Ищи меня у рынка после уроков. Есть работа у торговца Гэндо. Оплата честная, а путь я покажу.
end
=== promise_yuta
if quest.promise_case.yuta -> confess
if flag.q_promise_parcels -> later
yuta: Я разношу посылки по деревне. Хочешь подработать? У меня как раз три адреса.
call run promise_offer
end
# confess
call run promise_confession
end
# later
if flag.promise_confessed -> honest
yuta: Когда открою свою службу, тебе всегда найдётся работа. Как дела в Академии?
end
# honest
yuta: Я расскажу Ируке всё. Только... спасибо, что пришёл за мной.
end
=== promise_offer
yuta: Гэндо просит отнести посылки на рынок, в цветочную лавку и в больницу. Ничего сложного.
? Возьмёшься?
* Да, покажи адреса -> yes
* Позже -> later
# yes
call give promise_parcel 3
call quest start promise_parcels
yuta: Адреса записаны в журнале. Вернёшься - получишь сто рё. Бумажные печати не срывай: Гэндо говорит, это защита от воров.
end
# later
yuta: Я буду у рынка.
end
=== promise_paid
yuta: Все три? Быстро! Вот твои сто рё.
call step promise_parcels pay
: Юта аккуратно складывает оставшиеся накладные. На каждой - такой же знак, как на посылках.
end
=== promise_gendo
gendo: Делу нужны быстрые ноги. Юта расскажет, куда нести посылки.
end
=== promise_mark
: На занятии по печатям ты замечаешь знакомый знак на рисунке охранного барьера.
iruka: Служебные метки помогают отличать разрешённый груз. Их выдачу строго учитывают.
: Такой знак стоял на посылках Гэндо. Странно: зачем он нужен обычной доставке цветов?
set flag.promise_suspect = 1
end
=== promise_missing
: У рынка спорят торговцы. Из склада исчезли лекарства для больницы.
shizune: Последним груз забирал молодой курьер. Юта. Его сегодня никто не видел.
naruto: Мы его найдём. Но сначала выслушаем, ладно?
call quest start promise_case
end
=== promise_confession
: Юта прячется за ящиками у рынка. Увидев тебя, он перестаёт искать выход.
yuta: Я знал, что некоторые грузы чужие. Гэндо говорил: залежавшийся товар богатых торговцев. Никто не пострадает.
yuta: Я хотел помочь семье. Думал, ещё пара доставок - и всё. А теперь в больнице ждут лекарства...
? Что ты сделаешь?
* Пойдём к Ируке. Ты расскажешь всё сам -> honest
* Я помогу, но сначала вернём лекарства -> help
* Ты должен отвечать за это -> stern
# honest
set var.promise_trust += 2
yuta: Вместе? Хорошо. Пойдём.
-> end
# help
set var.promise_trust += 1
yuta: Я знаю лесной маршрут. Только без учителя туда нельзя.
-> end
# stern
yuta: Знаю. Я не стану убегать.
# end
set flag.promise_confessed = 1
call step promise_case yuta
end
=== promise_report
iruka: Спасибо, что пришли. Юта, ты ответишь за свою часть. Сейчас важно вернуть лекарства и остановить Гэндо.
iruka: На полевом выходе проверим лесную тропу. Задача учеников - наблюдать и сообщать. Самостоятельной погони не будет.
set flag.st_field = 0
call step promise_case iruka
end
=== promise_field
iruka: Сегодня лесная разведка. Изучи следы повозки, держись маршрута и возвращайся с донесением.
: За поворотом дозорный загораживает тропу. За его спиной - ящики с больничной печатью.
? Как поступить?
* Отвлечь его и взять накладную -> quiet
* Удержать его в учебной схватке -> fight
# quiet
if skill.charm -> peace
iruka: Я отвлеку дозорного. {name}, осмотри накладную у колеса.
-> evidence
# peace
: Ты показываешь учебный пропуск и просишь сверить накладную. Дозорный колеблется достаточно долго.
-> evidence
# fight
call battle senior scroll forest promise_field_win promise_field_lose 12
end
# evidence
call run promise_field_win
end
=== promise_field_win
: В накладной указаны служебные метки, которые вы разносили по Конохе. Они позволяли грузам обходить проверку.
iruka: Этого достаточно. Патруль проверит склад. Ты справился с разведкой.
call give book_traps
set flag.field_done = 1
set flag.promise_evidence = 1
call step promise_case forest
end
=== promise_field_lose
iruka: Отходим. Пока дозорный смотрел на тебя, я увидел печати на ящиках. Ты цел?
set flag.field_done = 1
set flag.promise_evidence = 1
call step promise_case forest
end
=== promise_reconcile
yuta: Последнюю отправку Гэндо готовит на ночь выпуска. Я покажу патрулю нужный склад.
call step promise_case back
end
=== promise_night
: Вечером после экзамена Юта не приходит на встречу. С рынка доносятся крики: склад закрыт, внутри остались люди.
iruka: Гэндо начал вывозить груз раньше. Юта попытался помешать и оказался внутри.
naruto: Мы обещали друг друга не бросать. Помнишь?
iruka: Я задержу сообщников у дороги. Вы прикроете выход и выведете рабочих. Действуйте по плану.
call quest start promise_rescue
call promiseFinale
end
=== promise_saved
: Последний рабочий выходит во двор. Юта держит дверь, пока ты отходишь от прохода.
yuta: Все вышли! Теперь и ты!
gendo: Груз останется со мной. Убирайтесь, ученики!
end
=== promise_won
: Гэндо больше не может сопротивляться. Со двора входит Ирука с патрулём.
yuta: Я расскажу всё. И отработаю каждый потерянный ящик. Спасибо, что вы за мной пришли.
naruto: Ты только на встречу больше не опаздывай. Нам ещё рамен есть!
set flag.promise_final = 1
set flag.mizuki_beaten = 1
call step promise_rescue gendo
end
`);
  function save(){const w=G.scenes.stack.find(s=>s.name==='world');if(w)w.savePos();G.storage.save(G.state);}
  G.script.actions.promiseFinale=()=>{G.game.pending={type:'promiseFinale'};};
  // Переход к другому диалогу выполняется после закрытия текущего окна.
  G.script.actions.run=a=>{G.game.pending={type:'dialogScript',id:a[0]};};
  G.flow.dialogScript=(a,w)=>w.talk(a.id);
  G.flow.promiseFinale=(a,w)=>{
    const boss=()=>{G.state.vars.hp=Math.max(80,G.state.vars.hp);G.state.vars.chakra=Math.max(80,G.state.vars.chakra);G.flow.battle({enemy:'gendo',mode:'ko',terrain:'night',story:true,allies:['iruka','naruto'],will:30,onEnd:r=>{
      G.state.vars.hp=Math.max(45,G.state.vars.hp);G.state.vars.chakra=Math.max(40,G.state.vars.chakra);
      if(r.win){G.state.flags.promise_final=1;G.state.flags.mizuki_beaten=1;G.quests.step('promise_rescue','gendo');save();G.dialog.start('promise_won',{onEnd:()=>G.scenes.fadeTo(G.scenes.make('ending'))});}
      else G.dialog.say([{who:'naruto',text:'Поднимайся! Юта и рабочие уже снаружи. Мы поможем!'}],{onEnd:boss});
    }},w);};
    if(G.state.flags.promise_people)return boss();
    const hold=()=>G.flow.battle({enemy:'thief',mode:'survive',terrain:'street',turns:6,story:true,allies:['naruto'],onEnd:r=>{
      G.state.vars.hp=Math.max(60,G.state.vars.hp);G.state.vars.chakra=Math.max(50,G.state.vars.chakra);
      if(r.win){G.state.flags.promise_people=1;G.quests.step('promise_rescue','people');save();G.dialog.start('promise_saved',{onEnd:boss});}
      else G.dialog.say([{text:'Ирука прикрывает тебя. Перегруппируйся и попробуй удержать проход ещё раз.'}],{onEnd:hold});
    }},w);hold();
  };
  const make=G.scenes.registry.world;
  G.scenes.register('world',pos=>{
    const w=make(pos),set=w.setMap;
    w.setMap=function(p){
      const m=G.world.get(p.map);
      if(m.outdoor&&m.id==='konoha')for(const [id,talk,tpl,offset]of [['yuta','promise_yuta','market',3],['gendo','promise_gendo','weapons',4]]){
        if(m.npcs.some(n=>n.id===id))continue;
        const b=m.buildings.find(b=>b.tplId===tpl);if(!b)continue;
        const a=G.world.outsideOf(b),pt=G.world.freeTile(m,Math.floor(a.x/16)+offset,Math.floor(a.y/16),true);if(!pt)continue;
        m.npcs.push(Object.assign(G.actors.make(id,pt[0]*16+8,pt[1]*16+12),{name:G.chars.nameOf(id),talk,keep:()=>true}));
      }
      return set.call(w,p);
    };return w;
  });
})();
