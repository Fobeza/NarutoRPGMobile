// Состояние дополнения хранится в числовых vars/flags: старые сохранения остаются совместимыми.
G.adventure = (() => {
  const D=G.ADVENTURES, V=()=>G.state.vars, F=()=>G.state.flags;
  const wld=()=>G.scenes.stack.find(s=>s.name==='world');
  function save(){const w=wld();if(w)w.savePos();if(G.state.started)G.storage.save(G.state);}
  function say(text,then){G.dialog.say((Array.isArray(text)?text:[text]).map(t=>typeof t==='string'?{text:t}:t),{bottom:24,onEnd:then});}
  function choose(title,text,rows){G.scenes.push(G.scenes.make('pick',{title,text,options:rows.map(r=>({label:r.label,sub:r.sub,desc:r.desc,off:r.off}))},i=>{if(i>=0&&!rows[i].off)rows[i].act();}));}
  function step(id,key){return G.quests.curStep(id)?.id===key&&G.quests.step(id,key);}
  function once(key,fn){if(F()[key])return false;F()[key]=1;fn();return true;}
  function missing(need){return Object.entries(need).filter(([id,n])=>G.game.count(id)<n).map(([id,n])=>G.ITEMS[id].name+' '+G.game.count(id)+'/'+n).join(', ');}
  function spend(need){if(missing(need))return false;for(const [id,n]of Object.entries(need))G.game.take(id,n);return true;}
  function trust(id,n){V()['adv_clan_'+id]=Math.max(0,Math.min(10,(V()['adv_clan_'+id]||0)+n));unlockClan(id);}
  function unlockClan(id){
    if((V()['adv_clan_'+id]||0)<6)return;
    F()['adv_clan_'+id]=1;
    if(id==='yamanaka')F().adv_recipe_tea=1;
    if(id==='akimichi')F().adv_recipe_onigiri=1;
  }
  function active(id){if(!G.quests.active(id))return false;return true;}
  function start(id){
    if(id.startsWith('adv_genin')&&!F().game_clear)return false;
    const n=Number(id.slice(-1));if(id.startsWith('adv_genin')&&n>1&&!G.quests.done('adv_genin'+(n-1)))return false;
    const ok=G.quests.start(id);if(ok){G.quests.track(id);save();}return ok;
  }
  function report(id){
    if(id.startsWith('adv_genin')&&wld()?.map.id!=='adv:outpost')return false;
    if(!step(id,'report'))return false;
    if(id==='adv_cargo'){F().adv_service=1;trust('yamanaka',3);trust('nara',F().adv_cargo_peace?4:2);}
    if(id==='adv_rescue'){F().adv_service=1;trust('hyuga',4);trust('inuzuka',3);F().adv_recipe_onigiri=1;}
    if(id==='adv_archive'){trust('aburame',3);F().tech_doton=1;}
    if(id==='adv_genin3')F().adv_chunin_entry=1;
    save();return true;
  }
  function missionMenu(teamOnly=false){
    const ids=teamOnly?['adv_genin1','adv_genin2','adv_genin3']:['adv_cargo','adv_rescue','adv_archive','adv_dispute'];
    choose(teamOnly?'КОМАНДНЫЕ МИССИИ':'ДОСКА ЭКСПЕДИЦИЙ',teamOnly?teamText():'Разведка, подготовка, решение и отчёт. Выбор влияет на доверие.',ids.map(id=>{
      const q=G.quests.state(id),d=G.QUESTS[id],cur=G.quests.curStep(id),n=Number(id.slice(-1));
      return {label:d.title,sub:q?.st==='done'?'Готово':cur?.id==='report'?'Отчёт':q?'В работе':'Новое',desc:cur?.text||d.desc,
        off:q?.st==='done'?'Задание завершено':teamOnly&&!F().game_clear?'Откроется после сюжетного выпуска':teamOnly&&n>1&&!G.quests.done('adv_genin'+(n-1))?'Сначала заверши предыдущую миссию':null,
        act:()=>{if(!q){start(id);say(d.desc);return;}if(cur?.id==='report'){if(!report(id)){say('Доложи команде на пограничном посту.');return;}say(id==='adv_genin3'?'Команда получила направление на экзамен чунина. Три первые миссии генинов завершены.':'Отчёт принят. Награда и изменения отношений сохранены.');return;}
          G.quests.track(id);if(id==='adv_dispute')dispute();else say(cur.text+'\nПуть: меню «Приключения» — «Территории».');}
      };
    }));
  }
  function teamNumber(){return [7,8,10].find(n=>F()['team_'+n])||G.friends.team();}
  function teamIds(){return {7:['naruto','sasuke','sakura'],8:['hinata','kiba','shino'],10:['shikamaru','choji','ino']}[teamNumber()];}
  function teamText(){const team=teamNumber();return 'Команда '+team+'. '+({7:'Наруто, Саске и Сакура',8:'Хината, Киба и Шино',10:'Шикамару, Чоджи и Ино'}[team])+'. '+(F().adv_chunin_entry?'Допуск к экзамену получен.':'Три миссии после выпуска.');}
  function travel(key,world=wld()){
    if(!world)return false;
    if(key!=='konoha'&&(!G.hero.ready()||!F().enrolled)){say('Сначала заверши вступительный тест у Ируки. Затем тебе разрешат самостоятельные вылазки.');return false;}
    if(key==='cellar'&&!F().adv_seal_open){say('Спуск закрыт барьером. Письмо на втором этаже подскажет порядок печатей.');return false;}
    if(key==='cave'&&!F().adv_vines){say('Вход скрывают корни на лесной тропе. Их можно срезать кунаем.');return false;}
    if(key==='parkour'){courseMenu();return true;}
    if(world._course)world._course=null;
    G.game.advance(10);
    const pos=key==='konoha'?G.world.outsideOf(G.world.konoha().landmarks.academy||G.world.heroHome()):{map:'adv:'+key,entry:true};
    if(key!=='konoha'&&!G.frontier.titles[key])return false;
    world.goTo(pos);return true;
  }
  function territories(){
    choose('ТЕРРИТОРИИ',season().name+'. '+season().text,[...['forest','river','outpost','tower'].map(key=>({label:G.frontier.titles[key],desc:{forest:'Следы, дозорный, тайный проход и сезонная поляна.',river:'Переправа, спасение и сопровождение обоза.',outpost:'Командные миссии, полевая кухня и испытание.',tower:'Два этажа, балкон и запечатанный подвал.'}[key],act:()=>travel(key)})),{label:'Вернуться в Коноху',act:()=>travel('konoha')}]);
  }
  function menu(){
    if(!G.hero.ready()||!F().enrolled){say('Сначала заверши вступительный тест у Ируки. Доска экспедиций станет доступна после зачисления.');return;}
    choose('ДОРОГИ ЛИСТА',season().name+' · '+(F().game_clear?'Жизнь генина':'Вылазки учеников'),[
      {label:'Миссии и отчёты',desc:'Четыре истории с выбором и последствиями.',act:()=>missionMenu()},
      {label:'Территории',act:territories},
      {label:'Друзья и встречи',act:friendsMenu},
      {label:'Доверие кланов',act:clansMenu},
      {label:'Выбрать наставника',act:mentorsMenu},
      {label:'Паркур и погоня',act:courseMenu},
      {label:'Настроить техники',act:techMenu},
      {label:'Архив и рецепты',act:libraryMenu},
      {label:'Миссии после выпуска',desc:teamText(),act:()=>missionMenu(true)},
      {label:'Как играть',act:()=>say(['У новых указателей, лестниц, следов и предметов нажимай A. Указатель над предметом отмечает доступное действие.','Задания записаны в обычном журнале. Кнопка «Цель» ведёт к нужному переходу между новыми картами.','На крышах двигайся к соседнему дому: на краю герой перепрыгнет зазор. Погоня и испытание считают время только в мире.','Дымовая бомба, проволока и кунай полезны вне боя. Каждый путь и нужные припасы указаны перед выбором.'])},
    ]);
  }
  function prepare(kind){
    if(!['talk','smoke','lure','fight'].includes(kind))return false;
    if(G.quests.curStep('adv_cargo')?.id!=='prepare')return false;
    if(kind==='smoke'&&!spend({smoke_bomb:1}))return false;
    if(kind==='lure'&&!spend({kunai:1}))return false;
    V().adv_approach={talk:1,smoke:2,lure:3,fight:4}[kind]||1;
    F().adv_distracted=kind==='smoke'||kind==='lure'?1:0;
    step('adv_cargo','prepare');save();return true;
  }
  function cargo(method,world=wld()){
    if(G.quests.curStep('adv_cargo')?.id!=='cargo')return false;
    if(method==='peace'&&(V().adv_approach!==1&&!(F().adv_clan_aburame)))return false;
    if(method==='quiet'&&!F().adv_distracted&&!F().adv_clan_aburame)return false;
    const finish=peace=>{if(!step('adv_cargo','cargo'))return;F().adv_cargo_peace=peace?1:0;save();say(peace?'Дозорный сверяет печать на накладной и возвращает груз. Вы договорились.':'Груз возвращён. Осталось доложить на доске экспедиций.');};
    if(method==='fight'){fight('adv_guard','forest',res=>{if(res.win)finish(false);else say('Дозорный удержал груз. Можно подготовиться и попробовать снова.');});return true;}
    finish(method==='peace');return true;
  }
  function fight(enemy,terrain,cb){const world=wld();if(!world)return;const teamMission=['adv_genin1','adv_genin2','adv_genin3'].some(id=>G.quests.active(id));G.flow.battle({enemy,mode:'ko',terrain,advanced:true,allies:teamMission?teamIds():null,onEnd:res=>{cb(res);save();}},world);}
  function bridge(){
    if(G.quests.curStep('adv_rescue')?.id!=='bridge')return false;
    if(!spend({wire:1}))return false;
    F().adv_bridge=1;step('adv_rescue','bridge');G.frontier.patch(G.world.get('adv:river'));save();return true;
  }
  function rescue(order){
    if(!['people','cargo'].includes(order))return false;
    if(G.quests.curStep('adv_rescue')?.id!=='people'||!F().adv_bridge)return false;
    V().adv_rescue_order=order==='people'?1:2;
    if(order==='people'){G.friends.add('hinata',2);trust('hyuga',1);}
    else {G.game.earn(35);trust('hyuga',-1);}
    step('adv_rescue','people');save();return true;
  }
  function readBook(id){
    const b=D.books.find(b=>b.id===id);if(!b)return false;
    once('adv_book_'+id,()=>{G.train.addXp('know',2);G.game.note('Архив: '+b.title);});
    if(id==='seal')step('adv_archive','letter');
    if(id==='clans')F().adv_recipe_rice=1;
    save();say(b.text);return true;
  }
  function sealInput(el){
    if(G.quests.curStep('adv_archive')?.id!=='seal')return false;
    const seq=['water','wind','fire'],i=V().adv_seal_progress||0;
    if(el!==seq[i]){V().adv_seal_progress=0;return false;}
    V().adv_seal_progress=i+1;
    if(i===2){F().adv_seal_open=1;step('adv_archive','seal');save();}
    return true;
  }
  function sealMenu(){
    if(F().adv_seal_open)return say('Три печати светятся. Спуск в архив открыт справа.');
    if(G.quests.curStep('adv_archive')?.id!=='seal')return say('Здесь три знака. Сначала прочитай письмо на втором этаже и возьми задание об архиве.');
    choose('ТРИ ПЕЧАТИ','Верных печатей: '+(V().adv_seal_progress||0)+'/3. Подсказка — в письме.',[['water','Вода'],['fire','Огонь'],['wind','Ветер']].map(([id,label])=>({label,act:()=>{const ok=sealInput(id);if(F().adv_seal_open)say('Барьер погас. Открылась лестница в архив.');else if(!ok)say('Печати сбросились. Вспомни порядок из письма.',sealMenu);else sealMenu();}})));
  }
  function guardian(peace){
    if(G.quests.curStep('adv_archive')?.id!=='guardian')return false;
    if(peace){if(!F().adv_book_clans||!F().adv_book_genin)return false;F().adv_guardian_peace=1;step('adv_archive','guardian');save();say('Ты цитируешь соглашение кланов и клятву команды. Хранитель принимает твой ответ и опускает оружие.');}
    else fight('adv_keeper','field',res=>{if(res.win){step('adv_archive','guardian');save();say('Три стойки пройдены. Хранитель доверяет тебе архив.');}else say('Хранитель предлагает потренироваться и вернуться. Архив останется открыт.');});
    return true;
  }
  function teamAction(){
    if(!F().game_clear)return say('Командный стенд предназначен для выпускников. Пока доступны ученические экспедиции.');
    const id=['adv_genin1','adv_genin2','adv_genin3'].find(id=>G.quests.active(id));
    if(id&&G.quests.curStep(id)?.id==='brief'){
      step(id,'brief');if(F().adv_clan_hyuga)V().chakra=Math.min(100,V().chakra+10);save();
      return say(teamText()+'\n'+G.quests.curStep(id).text);
    }
    missionMenu(true);
  }
  function mentorsMenu(){
    choose('НАСТАВНИК','Занятие: 35 минут и 8 энергии. Две успешные тренировки открывают особый навык.',D.mentors.map((m,i)=>({label:m.name,sub:(V()['adv_lessons_'+m.id]||0)+'/2',desc:m.lesson+(F()[m.flag]?' · навык изучен':''),act:()=>choose(m.name.toUpperCase(),m.lesson,[
      {label:'Стать учеником',act:()=>{V().adv_mentor=i+1;save();say(m.name+' будет вести твою подготовку. Другие программы можно выбрать позже.');}},
      {label:'Пройти занятие',off:V().adv_mentor!==i+1?'Сначала выбери этого наставника':V().energy<8?'Нужно 8 энергии':G.state.daily['adv_lesson_'+m.id]?'Сегодня занятие уже пройдено':null,act:()=>G.scenes.push(G.scenes.make('train',m.mg,{title:m.lesson,n:4},score=>mentorResult(i,score)))},
    ])})));
  }
  function mentorResult(i,score){
    if(!Number.isFinite(score)||score<0||score>1)return false;
    const m=D.mentors[i];if(!m||V().adv_mentor!==i+1||G.state.daily['adv_lesson_'+m.id])return false;
    G.game.advance(35);V().energy=Math.max(0,V().energy-8);
    if(score<.5){save();say('Попытка завершена. Для зачёта нужна половина верных действий. Можно повторить занятие.');return false;}
    G.state.daily['adv_lesson_'+m.id]=1;V()['adv_lessons_'+m.id]=(V()['adv_lessons_'+m.id]||0)+1;G.train.addXp(m.stat,4);
    const learned=V()['adv_lessons_'+m.id]>=2;if(learned){F()[m.flag]=1;if(m.id==='iruka')F().roofs=1;if(m.tech)F()['tech_'+m.tech]=1;if(m.grant)F()[m.grant]=1;}
    save();say(learned?'Программа освоена: '+m.lesson+'. Приём доступен в бою.':'Занятие зачтено. Ещё одна тренировка в другой день — и навык твой.');return true;
  }
  function clansMenu(){choose('КЛАНЫ','Доверие 6/10 открывает семейный навык. Без выполненной экспедиции подарки дают максимум 4.',D.clans.map(c=>({label:c.name,sub:(V()['adv_clan_'+c.id]||0)+'/10',desc:c.perk,act:()=>choose('КЛАН '+c.name.toUpperCase(),c.perk,[
    {label:'Передать подарок',desc:G.ITEMS[c.gift].name+' · доверие +1',off:!G.game.count(c.gift)?'Нужно: '+G.ITEMS[c.gift].name:G.state.daily['adv_gift_'+c.id]?'Один подарок клану в день':!F().adv_service&&(V()['adv_clan_'+c.id]||0)>=4?'Сначала помоги в экспедиции':null,act:()=>{if(!spend({[c.gift]:1}))return;G.state.daily['adv_gift_'+c.id]=1;trust(c.id,1);save();say('Семья благодарит за подарок. Доверие: '+V()['adv_clan_'+c.id]+'/10.');}},
    {label:'Узнать о помощи',act:()=>say(['Нара и Яманака ценят мирное возвращение потерянного груза. Хьюга и Инузука ждут помощи на переправе. Абураме интересуется знаниями закрытого архива.','После первой завершённой экспедиции доверие можно поднять подарками до семейного навыка.'])},
  ])})));}
  function season(day=V().day){return D.seasons[Math.floor((day-1)/28)%4];}
  function syncSeason(m){if(!m.outdoor)return;const s=season();if(m._advSeason!==s.name){m._advSeason=s.name;m.chunks.clear();}}
  function gather(){if(G.state.daily.adv_gather)return false;G.state.daily.adv_gather=1;G.game.give(season().gather,2);G.game.advance(5);save();return true;}
  function friendsMenu(){choose('ДРУЗЬЯ И ВСТРЕЧИ',appointmentText(),[
    {label:'Назначить встречу',act:()=>choose('С КЕМ ВСТРЕТИТЬСЯ','Завтра, на 90 минут. Встреча видна в календаре.',Object.keys(G.FRIENDS).map((id,i)=>({label:G.chars.nameOf(id),act:()=>choose('МЕСТО И ВРЕМЯ','Выбери удобное место.',[['teahouse','Чайная, 16:00',960],['river','Переправа, 17:00',1020],['outpost','Пост, 18:00',1080]].map(([place,label,min])=>({label,act:()=>{scheduleMeeting(id,place,V().day+1,min);say('Встреча назначена: '+appointmentText());}})))})))},
    {label:'Текущая встреча',desc:appointmentText(),act:()=>say(appointmentText())},
    {label:'Отменить встречу',off:!V().adv_meet_day?'Встреча не назначена':null,act:()=>{clearMeeting();save();say('Встреча отменена. Можно выбрать новое время.');}},
    {label:'Дни рождения',act:birthdaysMenu},
    {label:'Помирить Ино и Сакуру',act:()=>{if(!G.quests.state('adv_dispute'))start('adv_dispute');dispute();}},
    {label:'Партия мини-шоги',desc:'В доме экспедиций есть игровая доска. Короткая версия 3 на 4 клетки.',act:()=>{const w=wld();if(w?.map.id==='adv:tower')G.scenes.push(G.scenes.make('shogi'));else say('Доска стоит в доме экспедиций. Зайди туда через пограничный пост или меню территорий.');}},
  ]);}
  const friendIds=Object.keys(G.FRIENDS),places=['teahouse','river','outpost'];
  function scheduleMeeting(id,place,day,min){if(!friendIds.includes(id)||!places.includes(place)||day<=V().day||!Number.isInteger(day)||day>9999||![960,1020,1080].includes(min))return false;V().adv_meet_friend=friendIds.indexOf(id)+1;V().adv_meet_place=places.indexOf(place)+1;V().adv_meet_day=day;V().adv_meet_min=min;F().adv_meet_attended=0;save();return true;}
  function clearMeeting(){for(const k of ['friend','place','day','min'])V()['adv_meet_'+k]=0;F().adv_meet_attended=0;}
  function meeting(){const v=V(),id=friendIds[v.adv_meet_friend-1],place=places[v.adv_meet_place-1];return id&&place&&v.adv_meet_day?{id,place,day:v.adv_meet_day,min:v.adv_meet_min}:null;}
  function appointmentText(){const a=meeting();return a?'День '+a.day+', '+G.game.clock(a.min)+': '+G.chars.nameOf(a.id)+', '+({teahouse:'чайная Конохи',river:'старая переправа',outpost:'пограничный пост'}[a.place])+(F().adv_meet_attended?' · встреча состоялась':''):'Встреча пока не назначена.';}
  function meetingNow(){const a=meeting();return a&&a.day===V().day&&V().min>=a.min&&V().min<a.min+90?a:null;}
  function meetingPoint(a){if(a.place==='teahouse'){const b=G.world.konoha().buildings.find(b=>b.tplId==='teahouse'),p=G.world.outsideOf(b),spot=G.world.freeTile(G.world.konoha(),Math.floor(p.x/16)+2,Math.floor(p.y/16)+1);return{map:'konoha',x:spot[0]*16+8,y:spot[1]*16+12};}return {map:'adv:'+a.place,x:a.place==='river'?11*16+8:8*16+8,y:a.place==='river'?18*16+12:13*16+12};}
  function attend(){const a=meetingNow();if(!a||F().adv_meet_attended)return false;F().adv_meet_attended=1;G.friends.add(a.id,3);G.game.mood(8);save();return true;}
  function appointmentMenu(){const a=meetingNow();if(!a)return;attend();choose(G.chars.nameOf(a.id).toUpperCase(),'Рад тебя видеть. Чем займёмся? ',[
    {label:'Совместная тренировка',off:G.state.daily.adv_meet_activity?'Сегодня уже позанимались':null,act:()=>{G.state.daily.adv_meet_activity=1;G.scenes.push(G.scenes.make('train',G.FRIENDS[a.id].train==='library'?'quiz':'run',{title:'Тренировка с другом',n:4},score=>{G.game.advance(25);G.train.addXp('spd',score*3);save();say('Спасибо за компанию. Увидимся!');}));}},
    {label:'Поговорить',act:()=>say([{who:a.id,text:(G.FRIEND_LINES[a.id]?.[1]||['Хороший день для встречи.'])[0]}])},
  ]);}
  function birthdaysMenu(){const today=G.calendar.birthday(),days=Object.entries(G.calendar.BDAY).map(([day,id])=>({day:Number(day),id})).filter(b=>b.day>=((V().day-1)%112)+1).slice(0,4);
    choose('ДНИ РОЖДЕНИЯ',today?'Сегодня: '+G.chars.nameOf(today):'Ближайшие праздники игрового календаря.',[
      {label:'Приготовить сюрприз сегодня',off:!today?'Сегодня нет дня рождения':F()['adv_party_'+V().day]?'Сюрприз уже подарен':null,desc:'Любимый подарок + рис + молоко. Дружба +4.',act:()=>{if(!birthdaySurprise())return say('Нужны рис, молоко и любимый подарок именинника. Продукты продаются на рынке.');say([{who:today,text:'Ты это всё приготовил для меня? Спасибо! Я запомню этот день.'},'У чайной появился праздничный стол. Можно прийти к друзьям до конца дня.']);}},
      ...days.map(b=>({label:'День '+b.day+': '+G.chars.nameOf(b.id),act:()=>say('Любимые подарки: '+(G.FRIENDS[b.id]?.love||[]).map(id=>G.ITEMS[id].name).join(', ')+'. Сюрприз готовится в день рождения через это меню.')})),
    ]);
  }
  function birthdaySurprise(){const today=G.calendar.birthday();if(!today||F()['adv_party_'+V().day])return false;const gift=G.FRIENDS[today]?.love.find(id=>!id.startsWith('adv_')&&G.game.count(id));if(!gift)return false;const need={rice:1,milk:1};need[gift]=(need[gift]||0)+1;if(!spend(need))return false;F()['adv_party_'+V().day]=1;V().adv_party_friend=friendIds.indexOf(today)+1;V().adv_party_day=V().day;G.friends.add(today,4);G.game.advance(30);save();return true;}
  function dispute(){
    const s=G.quests.curStep('adv_dispute');if(!s)return say('История завершена. '+(F().adv_reconciled?'Подруги снова общаются.':'Подругам нужно время.'));
    if(s.id==='sakura')return say([{who:'sakura',text:'Я оставила букет для больницы у чайной. Ино унесла его и даже не спросила. Мне обидно.'}],()=>{step('adv_dispute','sakura');save();dispute();});
    if(s.id==='ino')return say([{who:'ino',text:'Ливень начался! Я отнесла букет в лавку, чтобы он не промок. А Сакура решила, будто я его украла...'}],()=>{step('adv_dispute','ino');save();dispute();});
    choose('ПРИМИРЕНИЕ','Теперь известны обе стороны. Что предложишь?',[
      {label:'Объяснить и отнести букет вместе',desc:'Обе подруги получают поддержку.',act:()=>resolveDispute('both')},
      {label:'Поддержать только Сакуру',desc:'Сакура +2, Ино -1.',act:()=>resolveDispute('sakura')},
      {label:'Поддержать только Ино',desc:'Ино +2, Сакура -1.',act:()=>resolveDispute('ino')},
    ]);
  }
  function resolveDispute(choice){if(!['both','sakura','ino'].includes(choice)||!step('adv_dispute','resolve'))return false;F().adv_reconciled=choice==='both'?1:0;G.friends.add('sakura',choice==='both'?3:choice==='sakura'?2:-1);G.friends.add('ino',choice==='both'?3:choice==='ino'?2:-1);if(choice==='both')F().adv_recipe_tea=1;save();say(choice==='both'?'Сакура и Ино договариваются: сначала спрашивать, потом обижаться. Вместе вы относите букет в больницу. Ино делится рецептом чая.':'Ты высказался. Одна подруга благодарна, другая пока держится в стороне.');return true;}
  function techProfile(id){const n=V()['adv_tech_'+id]||0;return [{name:'Обычная',ch:1,w:1,dmg:1},{name:'Экономная',ch:.75,w:1,dmg:.85},{name:'Быстрая',ch:1.2,w:.75,dmg:1}][n]||{name:'Обычная',ch:1,w:1,dmg:1};}
  function techMenu(){choose('НАСТРОЙКА ТЕХНИК','Меняется расход чакры и темп. Настройка сохраняется.',G.TECH_ORDER.filter(id=>G.TECHS[id].el).map(id=>({label:G.TECHS[id].name,sub:techProfile(id).name,off:!G.combat.knows(id)?'Сначала изучи технику':null,act:()=>choose('ФОРМА ТЕХНИКИ',G.TECHS[id].name,[['Обычная','Исходные свойства.'],['Экономная','Чакра -25%, урон -15%.'],['Быстрая','Вес хода -25%, чакра +20%.']].map(([label,desc],n)=>({label,desc,act:()=>{V()['adv_tech_'+id]=n;save();say('Выбрана форма: '+label+'.');}})))})));}
  function cookRecipe(id){const r=D.recipes.find(r=>r.id===id);if(!r||!F()[r.flag]||!spend(r.need))return false;G.game.give(id);G.game.advance(20);G.train.addXp('ctrl',1);save();return true;}
  function recipeMenu(){choose('СЕМЕЙНЫЕ РЕЦЕПТЫ','Готовые блюда остаются в сумке: их можно съесть или подарить.',D.recipes.map(r=>({label:r.name,desc:Object.entries(r.need).map(([id,n])=>G.ITEMS[id].name+' x'+n).join(', '),off:!F()[r.flag]?{adv_onigiri:'Помоги на переправе или заслужи доверие Акимичи',adv_flower_tea:'Помири подруг или заслужи доверие Яманака',adv_tomato_rice:'Прочитай соглашение кланов в архиве'}[r.id]:missing(r.need)?'Нужно: '+missing(r.need):null,act:()=>{if(cookRecipe(r.id))say('Приготовлено: '+r.name+'. Блюдо в сумке.');}})));}
  function libraryMenu(){choose('АРХИВ И РЕЦЕПТЫ','Найдено записей: '+D.books.filter(b=>F()['adv_book_'+b.id]).length+'/'+D.books.length,[
    ...D.books.map(b=>({label:b.title,off:!F()['adv_book_'+b.id]?'Найди запись: '+G.frontier.titles[b.map.slice(4)]:null,act:()=>say(b.text)})),
    {label:'Семейные рецепты',act:()=>{const w=wld();if(w?.map.building?.tplId==='hero_home'||w?.map.id==='adv:outpost')recipeMenu();else say('Готовить можно на домашней кухне или на пограничном посту.');}},
  ]);}
  function courseMenu(){choose('КРЫШИ УЧЕБНОГО КВАРТАЛА','Шесть крыш. Двигайся вправо; прыжки с края автоматические. Пауза останавливает часы.',[
    {label:'Испытание на время',desc:'Золото до 18 с, серебро до 28 с, бронза до 45 с. Награда за первую медаль.',act:()=>startCourse(false)},
    {label:'Погоня за посыльным',desc:'Посыльный бежит впереди. Догони его после второй отметки за 24 с.',act:()=>startCourse(true)},
    {label:'Мои результаты',act:()=>say('Лучшее время: '+(V().adv_course_best?V().adv_course_best.toFixed(1)+' с':'нет')+'. Медаль: '+(['нет','бронза','серебро','золото'][V().adv_course_medal||0])+'. Погонь выиграно: '+(V().adv_chases||0)+'.')},
  ]);}
  function startCourse(chase){const w=wld();if(!w)return;F().roofs=1;w.setMap({map:'adv:parkour',x:72,y:144,dir:'right',roof:1});w.banner=null;w._course={chase,t:0,next:0,runner:{x:104,y:144,dir:'right',anim:0,moving:true,leg:0,roof:true}};w.showToast(chase?'Догони посыльного после второй отметки':'Пройди шесть золотых отметок');}
  function courseResult(seconds,chase,won){
    if(!won)return false;
    if(chase){V().adv_chases=(V().adv_chases||0)+1;once('adv_chase_reward',()=>G.game.earn(60));}
    else {V().adv_course_best=Math.min(V().adv_course_best||999,seconds);const medal=seconds<=18?3:seconds<=28?2:seconds<=45?1:0;V().adv_course_medal=Math.max(V().adv_course_medal||0,medal);if(medal)once('adv_course_reward',()=>G.game.earn(40));}
    save();return true;
  }
  function courseTick(w,dt){
    const c=w._course;if(!c||w.map.id!=='adv:parkour')return;
    c.t+=dt;const rects=G.roofs.rects(w.map),p=w.player;
    if(!p.roof&&!p.jump){w._course=null;say('Ты спустился на землю. Забег завершён. Начни заново через меню паркура.');return;}
    const r=rects[c.next];if(r&&!p.jump&&p.roof&&Math.hypot(p.x-(r.x+r.w/2),p.y-(r.y+r.h/2))<28)c.next++;
    if(c.chase){const a=c.runner;a.anim+=dt*10;if(a.jump){const j=a.jump;j.t+=dt;const k=Math.min(1,j.t/j.dur);a.x=j.x0+(j.x1-j.x0)*k;a.y=j.y0+(j.y1-j.y0)*k;if(k===1){a.jump=null;a.roof=true;a.leg++;}}
      else if(a.leg<5){const cur=rects[a.leg],nxt=rects[a.leg+1],edge=cur.x+cur.w-5;if(a.x<edge)a.x=Math.min(edge,a.x+50*dt);else {const target={x:nxt.x+6,y:nxt.y+nxt.h/2};G.roofs.startJump(a,target.x,target.y,true);}}
    }
    const caught=c.chase&&c.next>=2&&!p.jump&&!c.runner.jump&&Math.hypot(p.x-c.runner.x,p.y-c.runner.y)<22;
    const done=c.chase?caught:c.next>=rects.length,won=done&&(!c.chase||c.t<=24),timeout=c.chase?c.t>24:c.t>60;
    if(done||timeout){w._course=null;courseResult(c.t,c.chase,won);say(won?(c.chase?'Посыльный догнан!':'Маршрут пройден!')+' Время: '+c.t.toFixed(1)+' с.':'Время вышло. Можно повторить забег.');}
  }
  function probe(world){
    const p=world.player;if(p.jump)return null;
    const ap=world._appointment;if(ap&&Math.hypot(ap.x-p.x,ap.y-p.y)<30)return {show:true,label:'Встреча',title:G.chars.nameOf(ap.id),targetRect:{x:ap.x-8,y:ap.y-23,w:16,h:24},run:appointmentMenu};
    if(p.roof)return null;
    const v=G.actors.DIRV[p.dir],fx=p.x+v[0]*12,fy=p.y-3+v[1]*12;
    const near=world.map.query({x:fx-22,y:fy-22,w:44,h:44}).filter(o=>o.adv&&Math.hypot(o.x-fx,o.y-7-fy)<21).sort((a,b)=>Math.hypot(a.x-fx,a.y-fy)-Math.hypot(b.x-fx,b.y-fy));
    const o=near[0];if(!o)return null;
    return {show:true,label:o.actionLabel||'Осмотреть',title:o.title,targetRect:world.map.drawRect(o),run:()=>interact(o.adv,world)};
  }
  function interact(id,world=wld()){
    if(id.startsWith('travel:'))return travel(id.slice(7),world);
    if(id.startsWith('book:'))return readBook(id.slice(5));
    if(id==='hub')return menu();
    if(id==='team')return teamAction();
    if(id==='archive_start'){if(!G.quests.state('adv_archive'))start('adv_archive');return say('Старый архив закрыт. Письмо на втором этаже подскажет, как снять барьер на балконе.');}
    if(id==='tracks'){if(!active('adv_cargo'))return say('Колеи ведут к лесному дозорному. На доске экспедиций есть поручение о пропавшем грузе.');if(step('adv_cargo','scout')){once('adv_supply',()=>{G.game.give('wire',1);G.game.give('smoke_bomb',1);G.game.give('kunai',1);});save();}return say('На колее печать торговцев. Дозорный принял повозку за контрабанду. У ящиков впереди выбери способ действий. Получены учебные припасы.');}
    if(id==='prepare')return choose('ПОДХОД К ДОЗОРНОМУ','Каждый путь ведёт к грузу. Сначала изучи следы.',[
      {label:'Сверить накладную и поговорить',act:()=>{if(prepare('talk'))say('Ты готов объяснить ошибку. Подойди к дозорному.');else say('Сейчас этот этап недоступен. Проверь журнал.');}},
      ...[['smoke','Дымовая завеса','smoke_bomb'],['lure','Ложный звук кунаем','kunai']].map(([k,label,it])=>({label,desc:'Расход: '+G.ITEMS[it].name+' x1. Дозорный отвлечётся.',off:missing({[it]:1})?'Нужно: '+G.ITEMS[it].name:null,act:()=>{if(prepare(k))say('Дозорный покинул пост. Теперь можно забрать груз без боя.');}})),
      {label:'Подготовиться к дуэли',act:()=>{if(prepare('fight'))say('Ты выбрал силовой путь. Подойди к грузу.');}},
    ]);
    if(id==='cargo')return choose('ДОЗОРНЫЙ','Дозорный охраняет ошибочно задержанную повозку.',[
      {label:'Убедить по накладной',off:V().adv_approach!==1&&!F().adv_clan_aburame?'Подготовь мирный подход у ящиков':null,act:()=>{if(!cargo('peace'))say('Сначала выполни предыдущие шаги задания.');}},
      {label:'Пройти мимо отвлечённого дозорного',off:!F().adv_distracted&&!F().adv_clan_aburame?'Нужны дымовая завеса или приманка':null,act:()=>{if(!cargo('quiet'))say('Проверь текущую цель задания.');}},
      {label:'Вызвать на дуэль',act:()=>{if(!cargo('fight'))say('Сначала осмотри следы и подготовь подход.');}},
    ]);
    if(id==='survey'){if(step('adv_rescue','survey')){once('adv_rescue_wire',()=>G.game.give('wire',1));save();}return say('Люди держатся на островке, а ниже по течению застрял груз. Страховка из проволоки позволит пересечь воду. Один моток приготовлен у столбов.');}
    if(id==='bridge')return say(bridge()?'Страховка натянута. Деревянные настилы теперь соединяют берега.':'Нужно задание о спасении, осмотр берега и один моток проволоки. Внизу есть длинный обход.');
    if(id==='rescue')return choose('СПАСЕНИЕ','Люди в опасности, часть груза уже уплывает. Реши, что спасать первым.',[
      {label:'Сначала вытащить людей',desc:'Доверие Хьюга и благодарность Хинаты.',act:()=>{if(rescue('people'))say('Все люди на берегу. Несколько ящиков унесло, но пост поможет с припасами.');else say('Сначала осмотри берег и подготовь страховку.');}},
      {label:'Сначала закрепить ценный груз',desc:'+35 рё за груз. Люди выберутся позже с патрулём; доверие снизится.',act:()=>{if(rescue('cargo'))say('Груз сохранён. Людей забрал прибывший патруль, но они долго ждали помощи.');else say('Сначала подготовь переправу.');}},
    ]);
    if(id==='seal')return sealMenu();
    if(id==='cellar_door')return travel('cellar',world);
    if(id==='guardian')return choose('ХРАНИТЕЛЬ','У архива есть испытание силы и путь доверия.',[
      {label:'Сослаться на соглашение и записи',off:!F().adv_book_clans||!F().adv_book_genin?'Прочитай соглашение в подвале и записи на посту':null,act:()=>{if(!guardian(true))say('Сначала открой архив по заданию.');}},
      {label:'Пройти три стойки в бою',desc:'Фазы: защита, натиск, стихии. Враг запоминает повторяемые действия.',act:()=>{if(!guardian(false))say('Сейчас испытание не требуется.');}},
    ]);
    if(id==='vines'){
      if(F().adv_vines)return travel('cave',world);
      return choose('ПРОХОД ПОД КОРНЯМИ','За корнями видна пещера.',[{label:'Срезать корни кунаем',off:!G.game.count('kunai')?'Нужен кунай':null,act:()=>{if(spend({kunai:1})){F().adv_vines=1;save();say('Проход открыт. Осмотри щель ещё раз, чтобы войти.');}}}]);
    }
    if(id==='cave_cache'){if(once('adv_cave_cache',()=>{G.game.earn(70);G.game.give('herb_blue',2);G.train.addXp('know',3);})){save();return say('В старом сундуке: 70 рё и два лотоса. На стене вырезаны имена прежних дозорных.');}return say('Сундук пуст. Имена дозорных всё ещё видны на стене.');}
    if(id==='clan_cache'){if(!F().adv_clan_inuzuka)return say('Следы уводят под корни. Инузука помогут найти тайник, когда доверие достигнет 6.');if(once('adv_clan_cache',()=>{G.game.give('chakra_pill',2);G.game.earn(40);})){save();return say('Следопыты нашли спрятанные припасы: две пилюли чакры и 40 рё.');}return say('Тайник уже открыт.');}
    if(id==='season')return say(gather()?'Собрано: '+G.ITEMS[season().gather].name+' x2. '+season().text:'Сегодня на поляне уже собрали всё спелое.');
    if(id==='signal'){if(step('adv_genin1','scout')){save();return say('Команда обнаружила обрыв сигнальной нити и восстановила связь. Вернитесь на пост.');}return say('Сигнальный столб связывает пост с Конохой.');}
    if(id==='escort')return choose('ОХРАНА ОБОЗА','Налётчик требует плату за проход. Есть три способа.',[
      {label:'Объяснить условия мирного прохода',desc:'Доступно после мирного возвращения груза или доверия Нара.',off:!F().adv_cargo_peace&&!F().adv_clan_nara?'Нужна репутация переговорщика':null,act:()=>escort('peace')},
      {label:'Прикрыть обоз дымом',off:!G.game.count('smoke_bomb')?'Нужна дымовая бомба':null,act:()=>escort('smoke')},
      {label:'Сразиться с налётчиком',act:()=>escort('fight')},
    ]);
    if(id==='trial'){if(G.quests.curStep('adv_genin3')?.id!=='trial')return say('Сначала получи миссию допуска у командного стенда.');return fight('adv_trial','ring',r=>{if(r.win){step('adv_genin3','trial');save();say('Испытание пройдено. Вернись к командному стенду за направлением.');}else say('Экзаменатор предлагает повторить после подготовки.');});}
    if(id==='recipes')return recipeMenu();
    if(id==='shogi')return G.scenes.push(G.scenes.make('shogi'));
    if(id==='detour')return say('Нижний мост сохранился. Можно обойти реку, но для спасательной операции нужна короткая страховочная переправа.');
  }
  function escort(method){
    if(!['peace','smoke','fight'].includes(method))return false;
    if(G.quests.curStep('adv_genin2')?.id!=='escort')return false;
    if(method==='peace'&&!F().adv_cargo_peace&&!F().adv_clan_nara)return false;
    if(method==='smoke'&&!spend({smoke_bomb:1}))return false;
    const done=()=>{if(step('adv_genin2','escort')){V().adv_escort_method={peace:1,smoke:2,fight:3}[method];save();say('Обоз прошёл. Команда возвращается с докладом на пост.');}};
    if(method==='fight')fight('adv_guard','river',r=>{if(r.win)done();else say('Обоз ждёт на безопасном берегу. Можно попробовать ещё раз.');});else done();return true;
  }
  function update(world,dt){
    syncSeason(world.map);G.frontier.patch(world.map);courseTick(world,dt);
    const a=meeting(),now=meetingNow();world._appointment=null;
    if(a&&(V().day>a.day||V().day===a.day&&V().min>=a.min+90)){G.game.note(F().adv_meet_attended?'Встреча с '+G.chars.nameOf(a.id)+' состоялась.':'Встреча с '+G.chars.nameOf(a.id)+' пропущена. Можно назначить новую.');clearMeeting();save();}
    if(now){const p=meetingPoint(now);if(p.map===world.map.id)world._appointment={id:now.id,...p,dir:'down',anim:0,_appointment:true};}
    if(now&&world.npcs.some(n=>n.id===now.id)){world.npcs=world.npcs.filter(n=>n.id!==now.id);world.others=[world.player,...world.npcs];}
  }
  function draw(ctx,world){
    const p=world.player,m=world.map,now=world.time;
    for(const o of m._advMarkers||(m._advMarkers=m.objects.filter(o=>o.adv)))if(Math.abs(o.x-p.x)<220&&Math.abs(o.y-p.y)<220){G.font.small.draw(ctx,o.adv.startsWith('travel:')?'>':'!',o.x,o.y-24+Math.sin(now*3),{align:'center',color:'#f4d46a',outline:'#24362e'});}
    if(m.id==='adv:forest'&&!G.state.flags.q_adv_cargo_cargo){const x=F().adv_distracted?23*16+Math.sin(now)*8:26*16-14;G.chars.draw(ctx,'chunin',F().adv_distracted?'left':'down',F().adv_distracted?G.chars.WALK[Math.floor(now*5)%4]:0,x,13*16+12);}
    if(m.id==='adv:river'&&!G.state.flags.q_adv_rescue_people){G.chars.draw(ctx,'villager_f','left',0,25*16+8,11*16+12);G.chars.draw(ctx,'kid_m','left',0,26*16+8,12*16+12);}
    if(m.id==='adv:outpost'&&G.state.flags.q_adv_rescue_people){G.chars.draw(ctx,'villager_f','down',0,12*16+8,8*16+12);G.chars.draw(ctx,'kid_m','down',0,13*16+8,8*16+12);}
    if(m.id==='adv:outpost'&&F().game_clear)teamIds().forEach((id,i)=>{G.chars.draw(ctx,id,'down',0,(9+i*2)*16+8,14*16+12);});
    if(m.id==='konoha'&&V().adv_party_day===V().day){const b=m.buildings.find(b=>b.tplId==='teahouse'),a=G.world.outsideOf(b),id=friendIds[V().adv_party_friend-1];if(id){ctx.fillStyle='#c89559';ctx.fillRect(a.x+18,a.y+10,26,8);G.chars.draw(ctx,id,'down',0,a.x+28,a.y+3);G.font.small.draw(ctx,'С праздником!',a.x+30,a.y-27,{align:'center',color:'#f4d46a',outline:'#24362e'});}}
    if(world._appointment){const a=world._appointment;G.chars.draw(ctx,a.id,a.dir,0,a.x,a.y);G.font.small.draw(ctx,'Встреча',a.x,a.y-30,{align:'center',color:'#f4d46a',outline:'#24362e'});}
    const c=world._course;if(c){const rs=G.roofs.rects(m);rs.forEach((r,i)=>{ctx.strokeStyle=i<c.next?'#76b48b':'#f4d46a';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(r.x+r.w/2,r.y+r.h/2,12,5,0,0,7);ctx.stroke();G.font.small.draw(ctx,String(i+1),r.x+r.w/2,r.y+r.h/2-18,{align:'center',color:'#fff2c3',outline:'#24362e'});});
      if(c.chase){const a=c.runner,j=a.jump,lift=j?Math.sin(Math.PI*Math.min(1,j.t/j.dur))*j.h:0;G.chars.draw(ctx,'thief','right',G.chars.WALK[Math.floor(a.anim)%4],a.x,a.y-lift);}
    }
    if(m.outdoor&&G.storage.settings.fx!==false){const s=season(),winter=s===D.seasons[3];if(s!==D.seasons[1]){ctx.fillStyle=s.color;for(let i=0;i<20;i++){const x=world.cam.x+((i*43+now*(winter?5:12))%220),y=world.cam.y+((i*31+now*15)%270);ctx.globalAlpha=.65;ctx.fillRect(x,y,winter?1:2,1);}ctx.globalAlpha=1;}}
  }
  function drawHud(ctx,world){const c=world._course;if(!c)return;G.ui.panel(ctx,6,33,G.screen.W-12,24,'night');G.font.small.draw(ctx,(c.chase?'ПОГОНЯ':'ПАРКУР')+' '+c.t.toFixed(1)+' с · '+Math.min(6,c.next)+'/6',12,41,{color:'#f4d46a'});}
  const oldVisible=G.life.visible.bind(G.life);
  G.life.visible=function(n){const a=meetingNow(),party=V().adv_party_day===V().day&&friendIds[V().adv_party_friend-1],team=F().game_clear&&wld()?.map?.id==='adv:outpost'&&teamIds().includes(n.id);if((a&&n.id===a.id||party&&n.id===party||team)&&!n._appointment)return false;return oldVisible(n);};
  const seasonalImages=new WeakMap(),seasonalKinds=new Set(['tree','pine','maple','ginkgo','sakura','bush','bush3','hedge','fern']);
  function seasonalImage(o,m){const s=season(),winter=s===D.seasons[3];if(!m.outdoor||!seasonalKinds.has(o.kind)||s!==D.seasons[2]&&!winter)return o.img;let cache=seasonalImages.get(o.img);if(!cache){cache={};seasonalImages.set(o.img,cache);}if(!cache[s.name]){const img=G.gfx.canvas(o.w,o.h),c=img.getContext('2d');c.drawImage(o.img,0,0);c.globalCompositeOperation='source-atop';c.globalAlpha=winter?.65:.36;c.fillStyle=winter?'#e6ece6':'#db8b42';c.fillRect(0,0,o.w,Math.max(1,o.h-10));cache[s.name]=img;}return cache[s.name];}
  const oldRender=G.tiles.renderTile;
  G.tiles.renderTile=function(ctx,m,tx,ty,x,y){oldRender(ctx,m,tx,ty,x,y);if(!m.outdoor)return;const s=season(),t=m.get(tx,ty),h=G.util.hash2(tx,ty,917);if(G.tiles.GRASSY.has(t)){
    ctx.save();if(s===D.seasons[3]){ctx.fillStyle='#dde7df';ctx.globalAlpha=.8;ctx.fillRect(x,y,16,16);ctx.globalAlpha=1;ctx.fillStyle='#b9ced2';ctx.fillRect(x+h*11,y+12,4,1);}
    else if(s!==D.seasons[1]&&h>.55){ctx.fillStyle=s.color;for(let i=0;i<4;i++)ctx.fillRect(x+(h*17+i*7)%15,y+(h*13+i*5)%15,2,1);}ctx.restore();}};
  const birthday=G.calendar.birthday.bind(G.calendar);G.calendar.birthday=function(day=V().day){return birthday(((day-1)%112)+1);};
  for(const r of D.recipes)if(G.FRIENDS[r.friend])G.FRIENDS[r.friend].love.push(r.id);
  const baseCook=G.flow.cook;G.flow.cook=(a,w)=>choose('ДОМАШНЯЯ КУХНЯ','Приготовить обычную еду или семейное блюдо в сумку.',[{label:'Обычная готовка',act:()=>baseCook(a,w)},{label:'Семейные рецепты',act:recipeMenu}]);
  const baseResolve=G.nav.resolve.bind(G.nav);G.nav.resolve=function(t,s){if(t?.point)return {map:t.map,x:t.point[0],y:t.point[1],label:t.label||s.text,icon:'📍'};return baseResolve(t,s);};
  const baseHop=G.nav.hop.bind(G.nav);
  G.nav.hop=function(m,t){
    if(!t)return null;if(m.id===t.map)return{x:t.x,y:t.y,final:true};
    const graph={konoha:['forest'],forest:['konoha','river','outpost','cave'],river:['forest','outpost'],outpost:['forest','river','tower'],tower:['outpost','tower2'],tower2:['tower','balcony'],balcony:['tower2','cellar'],cellar:['balcony'],cave:['forest'],parkour:['konoha']};
    const from=m.id==='konoha'?'konoha':m.id.slice(4),to=t.map==='konoha'?'konoha':t.map.startsWith('adv:')?t.map.slice(4):'konoha';
    if((m.id==='konoha'||m.adv)&&(t.map.startsWith('adv:')||m.adv)){
      const q=[[from]],seen=new Set([from]);for(let i=0;i<q.length;i++){const path=q[i],last=path[path.length-1];if(last===to){const next=path[1],o=m.objects.find(o=>o.adv==='travel:'+next||(next==='cellar'&&o.adv==='cellar_door')||(next==='cave'&&o.adv==='vines'));if(o)return{x:o.x,y:o.y,exit:true};break;}for(const n of graph[last]||[])if(!seen.has(n)){seen.add(n);q.push([...path,n]);}}
    }
    return baseHop(m,t);
  };
  // Цели отчёта ведут к реальной доске, даже если генератор передвинул её на свободную клетку.
  const resolve=G.nav.resolve.bind(G.nav);G.nav.resolve=function(t,s){if(t?.point&&t.map==='konoha'){const b=G.world.konoha().objects.find(o=>o.adv==='hub');if(b)return{map:'konoha',x:b.x,y:b.y,label:s.text,icon:'📍'};}return resolve(t,s);};
  return {menu,missionMenu,territories,travel,start,report,step,prepare,cargo,bridge,rescue,readBook,sealInput,guardian,escort,trust,mentorResult,season,gather,scheduleMeeting,meeting,meetingNow,meetingPoint,appointmentText,attend,birthdaySurprise,resolveDispute,techProfile,cookRecipe,startCourse,courseResult,probe,interact,update,draw,drawHud,seasonalImage,syncSeason,save};
})();
