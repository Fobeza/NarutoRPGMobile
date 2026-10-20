// Короткие уличные истории и видимые следы выполненных поручений.
// Фоновые сцены не останавливают героя; разговор начинается только по действию игрока.
G.villageStories = (() => {
  const T=16;
  G.QUESTS.street_lantern={
    cat:'errand',title:'Свет у чайной',desc:'У чайной погас фонарь. Хозяйке нужен один моток проволоки, чтобы починить крепление.',
    steps:[
      {id:'wire',text:'Найти один моток проволоки',target:{building:'weapons'},have:{wire:1}},
      {id:'fix',text:'Починить фонарь у чайной',target:{obj:'broken_lamp',map:'konoha'},need:{wire:1},consume:true}
    ],reward:{money:45,text:'45 рё и светлая улица'}
  };
  G.script.parse(`
=== village_lantern
if qdone.street_lantern -> done
if quest.street_lantern -> work
: У чайной погас бумажный фонарь. Крепление разболталось, один моток проволоки поможет его закрепить.
? Помочь с фонарём?
* Взяться за дело -> start
* Вернуться позже -> no
# start
call quest start street_lantern
: Хозяйка оставила записку: «За помощь — 45 рё. Проволока продаётся в Оружейной». Сам фонарь стоит здесь, у чайной.
end
# work
if !has.wire -> need
? Закрепить фонарь одним мотком проволоки?
* Починить -> fix
* Пока не трогать -> no
# fix
call village_repair
if qdone.street_lantern -> fixed
-> need
# fixed
: Крепление держится прочно. Хозяйка зажигает фонарь и отдаёт обещанные 45 рё. Теперь здесь можно посидеть и после заката.
end
# need
: Нужен один моток проволоки. Он продаётся в Оружейной. Если проволока лежит дома в сундуке, её надо забрать с собой.
end
# done
: Починенный фонарь у чайной. Под ним снова собираются соседи. Светлая улица — тоже чья-то маленькая работа.
end
# no
end
=== village_market
merchant[Торговец]: За такую рыбу просят слишком много! Она ведь ещё вчера стоила дешевле.
villager_f[Покупательница]: Вчера ты говорил, что свежесть важнее цены. Сегодня очередь за твоими словами.
merchant[Торговец]: Ладно, договорились. Только корзину верни!
end
=== village_training
kid_m[Ученик]: Я попал в круг! Видела?
kid_f[Ученица]: Видела. Только круг был на соседней мишени.
kid_m[Ученик]: Значит, сегодня тренируем точность. Завтра — выбор мишени!
end
=== village_shelter
villager_f[Жительница]: Переждём под навесом. В такую погоду даже самый срочный свиток хочет остаться сухим.
merchant[Посыльный]: Печать целая, бумага сухая. А сандалии... сандалии высохнут.
end
=== village_shogi
villager_m[Сосед]: Не торопись с ходом. Я эту ловушку ещё до ужина придумал.
grandma[Соседка]: Тогда я успею выпить чай и придумать две свои.
end
`);
  function repair() {
    if(!G.quests.active('street_lantern'))return false;
    G.quests.check();
    if(G.quests.curStep('street_lantern')?.id!=='fix'||G.game.count('wire')<1)return false;
    return G.quests.step('street_lantern','fix');
  }
  G.script.actions.village_repair=repair;
  const effects=[
    {quest:'ino_flowers',tpl:'clan_hyuga',sprite:'vase',text:'Букет, который ты доставил Хинате. Цветы стоят на почётном месте.',npc:'hinata',reply:'Спасибо за букет. Я поставила его дома, чтобы каждое утро было немного теплее.'},
    {quest:'shogi',tpl:'clan_nara',sprite:'bookpile',text:'Набор шоги, который ты подарил Шикамару. Рядом лежат записи новой партии.',npc:'shikamaru',reply:'Твой набор пригодился. Отец уже придумал, как обыграть меня ещё быстрее. Сыграем как-нибудь.'},
    {quest:'courier_1',tpl:'library',sprite:'parcel',text:'Доставленные тобой свитки. В библиотеке появился новый архивный раздел.'},
    {quest:'courier_2',tpl:'weapons',sprite:'rack',text:'Доставленное снаряжение уже разобрано и готово к заточке.'},
    {quest:'courier_3',tpl:'pharmacy',sprite:'parcel',text:'Доставленные настойки расставлены у аптекарского шкафа.'},
    {quest:'courier_4',tpl:'flowers',sprite:'flowerbox',text:'Из доставленных тобой семян появились первые ростки.'},
    {quest:'courier_5',tpl:'ichiraku',sprite:'ramen_stack',text:'Из доставленной муки Теучи приготовил новую партию лапши.'},
    {quest:'courier_6',tpl:'teahouse',sprite:'basket',text:'Свежие чайные листья из твоей посылки. В чайной пахнет новым сбором.'},
    {quest:'courier_7',tpl:'hospital',sprite:'parcel',text:'Доставленные бинты и мази уже готовы для приёма пациентов.'},
    {quest:'courier_8',tpl:'books',sprite:'bookpile',text:'Новые тома из твоей посылки выставлены для читателей.'},
    {quest:'courier_9',tpl:'onsen',sprite:'basket',text:'Чистые полотенца, которые ты доставил. Хозяйка приготовила их для гостей.'},
    {quest:'courier_10',tpl:'dango',sprite:'dango_tray',text:'Первая партия данго из доставленного тобой риса.'},
    {quest:'night_patrol',tpl:'uchiha_police',sprite:'lamp',text:'После твоего обхода здесь оставили дополнительный фонарь.'}
  ];
  function done(id){return G.quests.done(id);}
  function rumors(){
    const lines=[];
    if(done('street_lantern'))lines.push('У чайной снова горит фонарь. Говорят, это ты помог его починить.');
    if(done('ino_flowers'))lines.push('Хината бережёт тот букет. Приятно, когда поручения делают с душой.');
    if(done('night_patrol'))lines.push('После твоего ночного обхода у квартала Учиха стало спокойнее.');
    if(effects.some(e=>e.quest.startsWith('courier_')&&done(e.quest)))lines.push('Горо хвалил нового помощника. Посылки приходят, и торговля идёт своим чередом.');
    return lines;
  }
  function news(){return ['Доска добрых дел Конохи.',...rumors(),...(rumors().length?[]:['Пока здесь только объявления. Твои поступки тоже могут стать новостями.'])];}
  function mark(m,kind,tx,ty,extra={}) {return m.addObject(kind,tx*T+8,ty*T+15,Object.assign({box:null,_consequence:true},extra));}
  const basePopulate=G.world.populateKonoha.bind(G.world);
  G.world.populateKonoha=function(m){
    basePopulate(m);
    const tea=m.buildings.find(b=>b.tplId==='teahouse'),market=m.buildings.find(b=>b.tplId==='market');
    if(tea){
      const spot=this.freeTile(m,tea.door.tx+3,tea.door.ty+2,true);
      if(spot){const o=mark(m,'broken_lamp',...spot,{_consequence:false,talk:'village_lantern',title:'Фонарь у чайной'});o._villageLamp=true;
        Object.defineProperty(o,'actionLabel',{get:()=>done('street_lantern')?'Осмотреть':G.quests.active('street_lantern')?'Починить':'Помочь'});}
    }
    if(market){const spot=this.freeTile(m,market.door.tx-4,market.door.ty+2,true);if(spot){
      const o=mark(m,'village_board',...spot,{_consequence:false,actionLabel:'Новости',title:'Доска добрых дел'});
      Object.defineProperty(o,'talk',{get:news});
    }}
    m.finalize();
  };
  function sync(map) {
    const signature=effects.map(e=>+done(e.quest)).join('')+Number(done('street_lantern'));
    if(map._villageSignature===signature)return;
    map._villageSignature=signature;map.objects=map.objects.filter(o=>!o._consequence);
    const lamp=map.objects.find(o=>o._villageLamp);
    if(lamp){const spr=G.tiles.object(done('street_lantern')?'lamp':'broken_lamp');lamp.kind=done('street_lantern')?'lamp':'broken_lamp';lamp.img=spr.img;}
    if(!map.outdoor){
      const tpl=map.building&&map.building.tplId;
      for(const e of effects.filter(e=>e.tpl===tpl&&done(e.quest))){
        const candidates=[];for(let y=2;y<map.h-1;y++)for(const x of [1,map.w-2,2,map.w-3])candidates.push([x,y]);
        const extra={box:null,layer:'floor',_consequence:true,requireReach:true,talk:[e.text],actionLabel:'Осмотреть',title:'Результат поручения'};
        if(!G.interiorDetails.freeAdd(map,e.sprite,candidates,extra))G.interiorDetails.freeAdd(map,'parcel',candidates,extra);
      }
    }else if(done('night_patrol')){
      const b=map.buildings.find(b=>b.tplId==='uchiha_police');
      if(b){const p=G.world.freeTile(map,b.door.tx+2,b.door.ty+2,true);if(p)mark(map,'lamp',...p,{talk:[effects.find(e=>e.quest==='night_patrol').text],title:'Патрульный фонарь'});}
    }
    map.finalize();
  }
  function greet(n,world){
    const tpl=world.map.building?.tplId;
    const e=effects.find(e=>done(e.quest)&&(e.npc?n.id===e.npc:e.tpl===tpl&&n.shop));
    if(!e)return false;
    const key='village_thanks_'+e.quest;if(G.state.flags[key])return false;
    G.state.flags[key]=1;
    world.talk([{who:n.id,name:n.name,text:e.reply||'Спасибо за доставку. '+e.text}]);return true;
  }
  const scenes=[
    {id:'market',tpl:'market',hours:[10,18],weather:'dry',actors:['merchant','villager_f'],names:['Торговец','Покупательница'],lines:['Свежая рыба!','А вчера было дешевле!','Ладно, договорились.'],script:'village_market'},
    {id:'training',tpl:'academy',hours:[13,18],weather:'dry',actors:['kid_m','kid_f'],names:['Ученик','Ученица'],lines:['Смотри, попал!','В соседнюю мишень!','Ещё одна попытка!'],script:'village_training'},
    {id:'shelter',tpl:'ichiraku',hours:[7,21],weather:'rain',actors:['villager_f','merchant'],names:['Жительница','Посыльный'],lines:['Переждём под навесом.','Свитки надо беречь.','Рамен в дождь вкуснее.'],script:'village_shelter'},
    {id:'shogi',tpl:'teahouse',hours:[17,22],weather:'dry',actors:['villager_m','grandma'],names:['Сосед','Соседка'],lines:['Твой ход.','Сначала допью чай.','Тихий вечер в Конохе.'],script:'village_shogi'}
  ];
  function eligible(s){const h=G.state.vars.min/60;return h>=s.hours[0]&&h<s.hours[1]&&((s.weather==='rain')===G.life.raining());}
  function actors(world){return world.map.outdoor&&world._streetScene&&world._streetScene.alpha>0.2?world._streetScene.actors:[];}
  function update(world,dt){
    sync(world.map);
    if(!world.map.outdoor){world._streetScene=null;return;}
    if(!G.state.started||(!G.state.flags.hosp_done&&!G.state.flags.day2_intro))return;
    let current=world._streetScene;
    if(current){
      current.leaving=!eligible(current.def)||Math.hypot(current.x-world.player.x,current.y-world.player.y)>210;
      current.alpha=G.util.clamp(current.alpha+(current.leaving?-dt*2:dt*2),0,1);
      if(!current.alpha)world._streetScene=current=null;
      else {for(const n of current.actors)n.anim+=dt;return;}
    }
    world._streetCheck=(world._streetCheck||0)-dt;if(world._streetCheck>0)return;world._streetCheck=1;
    for(const def of scenes){
      if(!eligible(def))continue;
      const b=world.map.buildings.find(b=>b.tplId===def.tpl);if(!b)continue;
      const x=b.door.tx*T+8,y=(b.door.ty+2)*T+12;
      if(Math.hypot(x-world.player.x,y-world.player.y)>150)continue;
      const points=[];
      for(const dx of [-3,3,-4,4,-2,2]){
        const pt=G.world.freeTile(world.map,b.door.tx+dx,b.door.ty+2);
        if(!pt||points.some(p=>Math.hypot(p[0]-pt[0],p[1]-pt[1])<1.5))continue;
        if(Math.hypot(pt[0]*T+8-world.player.x,pt[1]*T+12-world.player.y)<22)continue;
        points.push(pt);if(points.length===2)break;
      }
      if(points.length<2)continue;
      const people=points.map((pt,i)=>Object.assign(G.actors.make(def.actors[i],pt[0]*T+8,pt[1]*T+12,i?'left':'right'),
        {name:def.names[i],talk:def.script,_street:true,reach:18,_look:0}));
      people[0].dir=people[1].x>people[0].x?'right':'left';people[1].dir=people[0].x>people[1].x?'right':'left';
      world._streetScene={def,actors:people,x,y,alpha:0,leaving:false};break;
    }
  }
  function draw(ctx,world){
    if(!world.map.outdoor)return;
    const lamp=world.map.objects.find(o=>o._villageLamp);
    if(lamp&&G.state.started&&!done('street_lantern')){
      const icon=G.quests.active('street_lantern')&&G.game.count('wire')>0?'?':'!';
      G.font.draw(ctx,icon,lamp.x,lamp.y-41+Math.round(Math.sin(world.time*4)),{align:'center',color:icon==='?'?'#9dd9d4':'#f2cd79',outline:G.PAL.ink});
    }
    const scene=world._streetScene;if(!scene||scene.alpha<0.3)return;
    const index=Math.floor(world.time/3.8)%scene.def.lines.length,n=scene.actors[index%scene.actors.length];
    const text=scene.def.lines[index],F=G.font.small,w=F.measure(text)+12,x=n.x-w/2,y=n.y-39;
    ctx.save();ctx.globalAlpha*=scene.alpha;
    G.ui.panel(ctx,x,y,w,14,'tag');F.draw(ctx,text,n.x,y+3,{align:'center',color:'#f0e4bf'});ctx.restore();
  }
  G.events.on('quest',(type,id)=>{
    if(type!=='done')return;
    const e=effects.find(e=>e.quest===id);
    for(const map of Object.values(G.world.maps))sync(map);
    const world=G.scenes.stack.find(s=>s.name==='world');
    if(world&&world.showToast&&(e||id==='street_lantern'))world.showToast(id==='street_lantern'?'У чайной снова горит фонарь':'В деревне заметили твою помощь');
  });
  return {effects,scenes,eligible,update,draw,actors,sync,rumors,greet,repair};
})();
