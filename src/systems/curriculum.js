// Постепенные задания. Результат проверяется по действиям и сохранённым достижениям.
G.learning = (() => {
  const V=()=>G.state.vars,F=()=>G.state.flags,L=()=>G.state.learning||(G.state.learning={});
  const world=()=>G.scenes.stack.find(x=>x.name==='world');
  const done=id=>G.quests.done(id),used=id=>(V()['use_'+id]||0)>0;
  const entries=[];
  function task(id,day,title,place,text,test,extra={}){
    const e={id:'learn_'+id,day,title,place,text,test,...extra};entries.push(e);
    const target=place==='lake'?{tile:[138,104],label:'Берег озера'}:{building:place==='mission_board'?'hokage_tower':place};
    G.QUESTS[e.id]={cat:extra.optional?'errand':'academy',title,desc:text,steps:[{id:'practice',text,target}],reward:{text:'Упражнение освоено',vars:{rep:1}}};
  }
  task('route',1,'Новый адрес','academy','Найди Академию по карте и поговори с Ирукой.',()=>!!F().enrolled);
  task('rest',1,'Рамен после неприятностей','hero_home','Поужинай и переночуй дома. Во сне игра сохраняется.',()=>V().day>=2);
  task('fight',2,'Покажи, что умеешь','academy','Пройди первый учебный бой. В плане можно выбрать до двух действий.',()=>V().battles>0);
  task('kunai',3,'Три куная к уроку','weapons','Купи недостающие кунаи в оружейной. Проверь сумку и её вместимость.',()=>G.game.count('kunai')>=3);
  task('job',4,'Первые заработанные рё','mission_board','Выполни поручение с доски или доставку Юты и получи оплату.',()=>V().jobs>0||done('promise_parcels'));
  task('train',5,'Твой полигон','training_ground','Подойди к мишеням на полигоне и выполни тренировку метания.',()=>!!L().tr_throw,{train:'throw'});
  task('friend',6,'После уроков','academy','Потренируйся вместе с другом через меню общения.',()=>!!L().partner);
  task('kawa',8,'Полено вместо тебя','academy','Изучи Каварими у Ируки и выполни подмену в бою.',()=>used('kawarimi'),{tech:'kawarimi',mg:'seals'});
  task('roofs',10,'Короткая дорога','academy','После урока Наруто поднимись на крышу у стены и пересеки проулок.',()=>!!L().roof);
  task('henge',15,'Камень, который дышит','academy','Разучи Хенге и примени превращение в учебном бою.',()=>used('henge'),{tech:'henge',mg:'seals'});
  task('read',17,'Посмотри, прежде чем бить','academy','Примени Анализ в бою и разучи Ложный страх у Ируки.',()=>!!L().analyze&&F().tech_fear,{tech:'fear',mg:'meditate'});
  task('combo',18,'Удары в связке','training_ground','Занятие с Ли открывает воздушное комбо. Примени связку в спарринге.',()=>!!L().combo,{combo:'air',mg:'log'});
  task('tools',23,'Не только кунай','weapons','Используй дымовую бомбу или вспышку в учебном бою.',()=>!!L().tool);
  task('tourney',26,'Первый турнир','academy','Участвуй в турнире Академии. Важен опыт, а не занятое место.',()=>V().title_t>0);
  task('tree',29,'Чакра под ногами','training_ground','Пройди урок Ируки, затем потренируй хождение по дереву на полигоне №3.',()=>!!L().tr_tree,{train:'tree',grant:'tech_tree',mg:'tree'});
  task('water',31,'На другой берег','lake','Изучи удержание на воде у Ируки, затем выполни тренировку у озера.',()=>!!L().tr_water,{train:'water',grant:'tech_water',mg:'tree'});
  task('trap',33,'Ловушка для торопливого','training_ground','Получи учебник у Ируки, затем поставь ловушку в спарринге.',()=>!!L().trap,{supply:{book_traps:1,wire:2}});
  task('bunshin',43,'Пуф - и нас трое','academy','Изучи Буншин, затем создай клонов в учебном бою.',()=>used('bunshin'),{tech:'bunshin',mg:'seals'});
  task('tactics',46,'Один приём дважды','academy','Примени Финт и Анализ: проверь привычки противника и смени тактику.',()=>!!L().feint&&!!L().analyze);
  task('will',48,'Держись, я рядом','academy','В учебном бою накопи Волю Огня и используй её.',()=>!!L().will);
  task('prepare',50,'План спасения','hero_home','Подготовь дымовую бомбу, бинт и хотя бы один кунай.',()=>['smoke_bomb','bandage','kunai'].every(id=>G.game.count(id)>0));
  task('exam',54,'Готов к выпуску','academy','Пройди выпускной экзамен: тест, метание и Буншин.',()=>V().exam!=null);
  task('promise',54,'Первое обещание','mission_board','Спаси Юту и рабочих. Останови Гэндо у склада.',()=>!!F().mizuki_beaten);
  task('fish',9,'Удочка для терпеливого','souvenir','Купи удочку, подойди к воде и вытащи первый улов.',()=>V().fished>0,{optional:true});
  task('herbs',11,'Аптечка своими руками','hero_home','Собери травы и приготовь лекарство за домашним столом.',()=>!!L().crafted,{optional:true});
  task('gift',12,'Подарок со смыслом','flowers','Выбери подарок другу в меню общения. Любимые подарки и дни рождения помогают сблизиться.',()=>!!L().gift,{optional:true});
  task('books',14,'Ответ в книге','library','Выполни занятие в библиотеке или прочитай книгу дома.',()=>!!L().tr_library||!!L().tr_book,{optional:true,train:'library'});
  task('secret',16,'Секрет под камнем','waterfall','Осматривай предметы вне дороги и найди один секретный свиток.',()=>V().scrolls>0,{optional:true});
  task('storage',3,'Собирайся налегке','hero_home','Положи один лишний предмет в домашний сундук. Его можно забрать перед вылазкой.',()=>!!L().storage,{optional:true});
  task('heal',5,'Сначала перевязка','hospital','После спарринга получи бинт в аптеке и примени его в сумке, когда нужно лечение.',()=>!!L().heal,{optional:true});
  task('cook',7,'Обед на завтра','hero_home','Купи продукты на рынке и приготовь еду на домашней кухне.',()=>!!L().cook,{optional:true});
  task('sell',10,'Лишний улов','market','Продай одну рыбу на рынке или траву в аптеке. Остальное можно оставить для готовки.',()=>!!L().sold,{optional:true});
  task('flower',6,'Цветок на подоконнике','hero_home','Полей цветок у себя дома. Возвращайся, чтобы увидеть рост.',()=>V().flower_n>0,{optional:true});
  const practices=[['dummy',3,'Манекен и стойка','training_ground'],['log',6,'Ритм ударов','training_ground'],['meditate',7,'Тихая минута','hero_home'],['seals',8,'Ловкие пальцы','hero_home'],['run',11,'Быстрые ноги','academy'],['shogi',13,'Ход Шикамару','academy'],['book',15,'Чтение дома','hero_home'],['falls',20,'Голос водопада','waterfall'],['stealth',24,'Тихий лес','clan_nara'],['cook',9,'Помощник Аяме','ichiraku']];
  for(const [id,day,title,place]of practices)task('practice_'+id,day,title,place,G.TRAININGS[id].name+'. Занятие: '+G.TRAININGS[id].minutes+' мин, энергия '+G.TRAININGS[id].energy+'.',()=>!!L()['tr_'+id],{optional:true,train:id});
  function practiceTarget(e){
    if(!e.train||!['run','falls','stealth','tree','water','throw','dummy','log'].includes(e.train))return null;
    const o=G.world.konoha().objects.find(o=>o.talk==='train_'+e.train);return o?{tile:[Math.floor(o.x/16),Math.floor(o.y/16)],label:G.TRAININGS[e.train].name}:null;
  }
  function save(){const w=world();if(w)w.savePos();if(G.state.started)G.storage.save(G.state);}
  function poll(w){
    if(!G.state.started||!F().enrolled||!G.hero.ready())return;
    for(const e of entries){if(G.quests.active(e.id)&&e.test()){G.quests.step(e.id,'practice');save();}}
    const active=entries.some(e=>!e.optional&&G.quests.active(e.id));
    if(!active&&L().offeredDay!==V().day){const e=entries.find(e=>!e.optional&&e.day<=V().day&&!G.quests.state(e.id));if(e){L().offeredDay=V().day;G.quests.start(e.id);}}
    if(w?.player?.roof)L().roof=1;
  }
  function go(e){if(!G.quests.state(e.id))G.quests.start(e.id);G.quests.track(e.id);const target=practiceTarget(e)||G.QUESTS[e.id].steps[0].target,b=G.world.konoha().buildings.find(b=>b.tplId===(e.place==='mission_board'?'hokage_tower':e.place));if(target.tile)G.state.marker={x:target.tile[0],y:target.tile[1],label:e.title};else if(b)G.state.marker={x:b.tx+Math.floor(b.tw/2),y:b.ty+b.th,label:e.title};save();world()?.showToast('Маршрут отмечен: '+e.title);}
  function near(w,tpl){if(tpl==='lake')return w?.map?.outdoor&&Math.hypot(w.player.x-138*16,w.player.y-104*16)<110;return w?.map?.building?.tplId===tpl||w?.map?.outdoor&&w.map.buildings?.some(b=>b.tplId===tpl&&Math.hypot(w.player.x-(b.x+b.tw*8),w.player.y-(b.y+b.th*16))<100);}
  function lesson(e){
    const w=world();if(!w)return;
    if(V().day<e.day)return G.dialog.say([{text:'Этот урок откроется с дня '+e.day+'. Пока выполняй текущие задания.'}]);
    if(e.grant==='tech_water'&&!F().tech_tree)return G.dialog.say([{text:'Сначала пройди урок хождения по дереву. Он учит удерживать чакру под ногами.'}]);
    const teacher=e.combo?'training_ground':'academy';if(!near(w,teacher))return G.dialog.say([{text:'Сначала найди учителя: '+(teacher==='academy'?'Ирука в Академии':'Ли на полигоне')+'. Кнопка пути поможет.'}]);
    if(V().min<13*60||V().min>=19*60)return G.dialog.say([{text:'Занятия с наставником: с 13:00 до 19:00. Вернись после уроков.'}]);
    if(V().energy<8)return G.dialog.say([{text:'Отдохни или поешь. Для занятия нужно 8 энергии.'}]);
    if(e.supply&&!L()['sup_'+e.id]){for(const [id,n]of Object.entries(e.supply))if(G.game.count(id)<n)G.game.give(id,n-G.game.count(id));L()['sup_'+e.id]=1;save();return G.dialog.say([{text:'Учебник и припасы получены. Поставь ловушку в безопасном спарринге.'}]);}
    G.scenes.push(G.scenes.make('train',e.mg||'seals',{title:e.title,n:3},score=>{
      G.game.advance(25);V().energy=Math.max(0,V().energy-6);
      if(score>=.3){if(e.tech)F()['tech_'+e.tech]=1;if(e.grant)F()[e.grant]=1;if(e.combo)F()['combo_'+e.combo]=1;G.train.addXp('ctrl',3);save();G.dialog.say([{text:'Приём разучен. '+e.text+' Объяснение остаётся в разделе Обучение.'}]);}
      else G.dialog.say([{text:'Попробуем ещё раз. Дыши ровнее и следи за подсказкой. Занятие можно повторить.'}]);
    }));
  }
  function show(e){
    const target=practiceTarget(e);if(target)G.QUESTS[e.id].steps[0].target=target;
    const w=world(),learned=e.tech?F()['tech_'+e.tech]:e.grant?F()[e.grant]:e.combo?F()['combo_'+e.combo]:false;
    const rows=[{label:'Показать путь',act:()=>go(e)},{label:'Объяснить ещё раз',act:()=>G.dialog.say([{text:e.text},{text:'Урок открывает приём. Тренировка повышает характеристики. Применение повышает мастерство техники.'}])}];
    if(e.tech||e.grant||e.combo||e.supply)rows.push({label:learned?'Повторить занятие':'Занятие с наставником',act:()=>lesson(e)});
    if(e.train){const at=target?w?.map?.outdoor&&Math.hypot(w.player.x-target.tile[0]*16,w.player.y-target.tile[1]*16)<65:near(w,e.place);rows.push({label:'Начать тренировку',off:!at?'Сначала приди к месту тренировки':null,act:()=>G.train.start(e.train,w)});}
    if((e.tech&&learned)||e.combo||e.supply)rows.push({label:'Учебный спарринг',off:!near(w,'academy')&&!near(w,'training_ground')?'Приди к Ируке или на полигон':null,act:()=>{
      if(V().energy<8)return G.dialog.say([{text:'Сначала восстанови силы.'}]);
      if(e.tech==='kawarimi')G.flow.battle({enemy:'dummy2',mode:'spar',will:0},w);
      else G.flow.battle({enemy:'dummy2',mode:'spar',will:e.id==='learn_will'?100:0},w);
    }});
    G.scenes.push(G.scenes.make('pick',{title:e.title,text:e.text,options:rows},i=>{if(i>=0&&!rows[i].off)rows[i].act();}));
  }
  function menu(){
    const rows=[['Основные задания',e=>!e.optional],['Техники и приёмы',e=>e.tech||e.grant||e.combo||e.supply],['Места тренировок',e=>!!e.train],['Свободные занятия',e=>!!e.optional]];
    G.scenes.push(G.scenes.make('pick',{title:'ОБУЧЕНИЕ',text:'Новые занятия открываются постепенно. Любой урок можно повторить.',options:rows.map(([label])=>({label}))},i=>{
      if(i<0)return;const es=entries.filter(e=>rows[i][1](e)&&e.day<=V().day);
      const opts=es.map(e=>({label:(done(e.id)?'✔ ':'')+e.title,desc:e.text,sub:e.tech?'мастерство '+G.combat.mastery(e.tech)+'/3':''}));
      G.scenes.push(G.scenes.make('pick',{title:rows[i][0],options:opts.length?opts:[{label:'Новые уроки появятся позже'}]},n=>{if(n>=0&&es[n])show(es[n]);}));
    }));
  }
  G.events.on('training',(id,score,partner)=>{L()['tr_'+id]=1;if(partner)L().partner=1;});
  G.events.on('tactic',(g,label)=>{if(label==='Анализ')L().analyze=1;if(label==='Финт')L().feint=1;if(g==='tai'&&Object.values(G.COMBOS).some(c=>c.name===label))L().combo=1;if(g==='tool')L().tool=1;if(/^Ловушка/.test(label))L().trap=1;if(label==='Воля Огня!')L().will=1;});
  const gift=G.friends.gift;G.friends.gift=function(...a){const r=gift.apply(this,a);L().gift=1;return r;};
  G.events.on('crafted',()=>{L().crafted=1;});
  G.events.on('storage',()=>{L().storage=1;});G.events.on('sold',()=>{L().sold=1;});G.events.on('cooked',()=>{L().cook=1;});G.events.on('item-used',id=>{if(['bandage','ointment'].includes(id))L().heal=1;});
  const makeWorld=G.scenes.registry.world;G.scenes.register('world',pos=>{const w=makeWorld(pos),update=w.update;w.update=function(dt){update.call(w,dt);if(G.scenes.top()===w&&!G.scenes.busy)poll(w);};return w;});
  return {entries,menu,poll,lesson,show,go};
})();
