// Новые карты. Переходы — видимые указатели, лестницы и двери с тем же действием A, что и в деревне.
G.frontier = (() => {
  const T=16, ID=G.tiles.ID;
  const titles={forest:'Лесная тропа',river:'Старая переправа',outpost:'Пограничный пост',tower:'Дом экспедиций',tower2:'Дом экспедиций: второй этаж',balcony:'Балкон печатей',cellar:'Архив под домом',cave:'Пещера под корнями',parkour:'Крыши учебного квартала'};
  function obj(m,kind,x,y,id,title,label='Осмотреть',extra={}){
    return m.addObject(kind,x*T+8,y*T+14,{box:null,adv:id,title,actionLabel:label,...extra});
  }
  const transitionCache={};
  function transition(type){
    if(transitionCache[type])return transitionCache[type];
    const img=G.gfx.canvas(22,26),c=img.getContext('2d');
    if(type==='door'){
      c.fillStyle='#543c2c';c.fillRect(1,0,20,26);c.fillStyle='#b18d58';c.fillRect(3,2,16,24);c.fillStyle='#36565b';c.fillRect(5,4,12,19);
      c.fillStyle='#d7bc80';c.fillRect(10,4,1,19);c.fillRect(5,11,12,1);c.fillRect(13,16,2,2);c.fillStyle='#e7cf9b';c.fillRect(2,24,18,2);
    }else{
      c.fillStyle='#463d36';c.fillRect(1,2,20,24);for(let i=0;i<5;i++){const y=type==='up'?22-i*4:6+i*4,w=18-i*2;c.fillStyle=i%2?'#a78d68':'#c9b38b';c.fillRect(11-w/2,y,w,4);c.fillStyle='#e7d5ad';c.fillRect(11-w/2,y,w,1);}
      c.fillStyle='#d4b66d';c.fillRect(0,3,2,22);c.fillRect(20,3,2,22);
    }
    return transitionCache[type]={img,w:22,h:26,ox:-11,oy:-24};
  }
  function portal(m,x,y,to,title){const from=m.id.slice(4),inner=['tower','tower2','balcony','cellar'].includes(from),type=({'tower:tower2':'up','tower2:tower':'down','cellar:balcony':'up'})[from+':'+to]||'door';return obj(m,'sign',x,y,'travel:'+to,title,'Перейти',inner||to==='tower'?transition(type):{});}
  function base(key,w,h,outdoor,floor){
    const m=new G.WorldMap('adv:'+key,w,h,{name:titles[key],outdoor,bg:outdoor?'#283a2b':'#17141e'});
    m.adv=true;m.spawn={x:4*T+8,y:(h-4)*T+12,dir:'up'};
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)m.set(x,y,x===0||y<(!outdoor?2:1)||x===w-1||y===h-1?outdoor?ID.CLIFF:ID.IWALL:floor);
    m.districts.push({x:0,y:0,w,h,label:titles[key]});
    return m;
  }
  function path(m,x0,y0,x1,y1,t=ID.PATH){for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)m.set(x,y,t);}
  function scenery(m,key){
    const rnd=G.util.rng(key==='forest'?817:892),skip=m.objects.map(o=>({x:o.x,y:o.y}));
    for(let y=3;y<m.h-3;y+=3)for(let x=3;x<m.w-2;x+=3){
      const tx=x+rnd.int(-1,1),ty=y+rnd.int(-1,1),px=tx*T+rnd.int(4,12),py=ty*T+14;
      if(m.get(tx,ty)!==ID.GRASS||m.block[ty*m.w+tx]||skip.some(o=>Math.hypot(o.x-px,o.y-py)<44)||!rnd.chance(.8))continue;
      const roll=rnd(),kind=roll<.48?'tree':roll<.65?'pine':roll<.78?'maple':roll<.88?'fern':'bush';
      if(m.objects.some(o=>o.box&&Math.hypot(o.x-px,o.y-py)<27))continue;
      m.addObject(kind,px,py);
    }
  }
  function make(key){
    let m;
    if(key==='forest'){
      m=base(key,40,30,true,ID.GRASS);
      path(m,3,13,36,15);path(m,3,14,5,26);path(m,8,7,10,14);path(m,28,6,30,15);
      portal(m,4,25,'konoha','Вернуться в Коноху');portal(m,36,14,'river','К старой переправе');portal(m,30,6,'outpost','К пограничному посту');
      obj(m,'scroll',13,14,'tracks','Следы потерянной повозки','Изучить');
      obj(m,'crate',18,13,'prepare','Запасы перед дозорным','Подготовить');
      obj(m,'parcel',26,13,'cargo','Дозорный и потерянный груз','Решить');
      obj(m,'bush',12,20,'vines','Корни скрывают узкую щель','Срезать');path(m,11,15,13,21);
      obj(m,'flowerpot',9,22,'season','Сезонная поляна','Собрать');path(m,7,21,11,23);
      obj(m,'sign',29,7,'signal','Сигнальный столб границы','Проверить');
      obj(m,'chest',7,10,'clan_cache','Тайник следопытов','Открыть');path(m,6,9,10,11);
      scenery(m,key);
    }else if(key==='river'){
      m=base(key,40,28,true,ID.GRASS);
      path(m,2,13,37,16);path(m,8,9,11,16);path(m,24,10,27,22);
      for(let y=1;y<m.h-1;y++)path(m,16,y,21,y,ID.WATER);
      portal(m,3,15,'forest','Назад на лесную тропу');portal(m,36,15,'outpost','К пограничному посту');
      obj(m,'sign',10,11,'survey','Следы паводка','Оценить');obj(m,'crate',15,14,'bridge','Столбы страховки','Натянуть');
      obj(m,'laundry',25,12,'rescue','Люди на затопленном берегу','Спасти');
      obj(m,'parcel',27,20,'escort','Обоз у переправы','Защитить');
      path(m,13,23,24,24,ID.PLANKS);path(m,13,16,15,24);path(m,22,16,24,24);
      obj(m,'sign',13,22,'detour','Нижний мост: безопасный длинный обход','Осмотреть');scenery(m,key);
    }else if(key==='outpost'){
      m=base(key,34,26,true,ID.GRASS);path(m,3,5,30,8,ID.COBBLE);path(m,4,6,7,22,ID.PATH);path(m,6,17,28,20,ID.DIRT);path(m,23,6,26,19,ID.PATH);
      portal(m,4,22,'forest','На лесную тропу');portal(m,29,18,'river','К переправе');portal(m,15,6,'tower','В дом экспедиций');
      const tpl=G.BUILDINGS.house_t,spr=G.buildgfx.make('house_t',tpl,618);
      m.addBuilding({id:'adv-house',tplId:'house_t',tplDef:tpl,tx:14,ty:2,tw:tpl.w,th:tpl.h,spr,name:'Дом экспедиций',door:{tx:15,ty:6},interior:{id:'adv:tower'}});
      for(let y=2;y<=6;y++)for(let x=14;x<=17;x++)if(x!==15||y!==6)m.setBlock(x,y);
      obj(m,'village_board',6,6,'team','Командный стенд','Миссии');obj(m,'dummy',22,18,'trial','Испытание для генинов','Испытать');
      obj(m,'kitchen',10,7,'recipes','Полевая кухня','Рецепты');
      for(let x=11;x<26;x+=3)m.addObject('fence',x*T,4*T+14,{box:null});
      m.addObject('stall',18*T,9*T,{box:null});
      scenery(m,key);
    }else if(key==='parkour'){
      m=base(key,48,20,true,ID.GRAVEL);m._roofs=[];
      for(let i=0;i<6;i++){
        const x=48+i*112,y=110+(i%2?10:0),w=80,h=64;
        const b={tx:x/T,ty:(y+30)/T,tw:w/T,th:4,sortY:y+h+30};m._roofs.push({x,y,w,h,b});
        for(let ty=Math.floor((y+30)/T);ty<Math.ceil((y+h+24)/T);ty++)for(let tx=x/T;tx<(x+w)/T;tx++)m.setBlock(tx,ty);
        const img=G.gfx.canvas(w,h+32),c=img.getContext('2d');
        c.fillStyle='#b99766';c.fillRect(4,10,w-8,h+22);c.fillStyle='#624936';c.fillRect(3,h,w-6,3);
        for(let xx=12;xx<w-10;xx+=24){c.fillStyle='#e7d3a5';c.fillRect(xx-2,h+7,15,19);c.fillStyle='#4a6972';c.fillRect(xx,h+9,11,14);c.fillStyle='#ae9872';c.fillRect(xx+5,h+9,1,14);c.fillRect(xx,h+15,11,1);}
        c.fillStyle=['#5f7a78','#a56a4f','#667d66'][i%3];c.fillRect(0,0,w,h);
        for(let a=0;a<h;a+=8){c.fillStyle=a%16?'#79938a':'#476361';c.fillRect(0,a,w,1);for(let xx=(a%16?0:8);xx<w;xx+=16){c.fillStyle='#3f5959';c.fillRect(xx,a,1,8);}}
        c.fillStyle='#d5b77d';c.fillRect(0,0,w,3);c.fillRect(0,h-3,w,3);
        m.objects.push({kind:'course_roof',x,y,ox:0,oy:0,w,h:h+32,img,box:null,sortY:y+h+32});
      }
      m.spawn={x:72,y:144,dir:'right'};portal(m,3,17,'konoha','Выход из учебного квартала');
    }else if(['tower','tower2','balcony','cellar','cave'].includes(key)){
      m=base(key,16,12,key==='balcony',key==='cave'?ID.MOSS:key==='cellar'?ID.DARKSTONE:ID.FLOOR);
      if(key==='balcony')m.bg='#9fb8bf';
      m.spawn={x:4*T+8,y:8*T+12,dir:'up'};
      if(key==='tower'){
        portal(m,4,9,'outpost','На пограничный пост');portal(m,12,3,'tower2','Лестница на второй этаж');obj(m,'shelf',3,3,'archive_start','Карта закрытого архива','Задание');obj(m,'table',9,6,'shogi','Доска мини-шоги','Играть');
        m.addObject('window',5*T,25,{box:null});m.addObject('plant',13*T,8*T,{box:null});m.addObject('bonsai',2*T,7*T,{box:null});
        path(m,7,5,10,7,ID.RUG);m.addObject('cushion',8*T,7*T,{box:null});m.addObject('cushion',10*T,7*T,{box:null});m.addObject('bookpile',5*T,4*T,{box:null});
      }else if(key==='tower2'){
        portal(m,12,8,'tower','Лестница вниз');portal(m,8,3,'balcony','Дверь на балкон');m.addObject('futon',10*T,6*T,{box:null});m.addObject('desk',3*T,4*T,{box:null});
        path(m,9,4,12,6,ID.TATAMI);m.addObject('window',4*T,25,{box:null});m.addObject('window',11*T,25,{box:null});m.addObject('wardrobe',13*T,3*T,{box:null});m.addObject('family_photo',5*T,28,{box:null});m.addObject('bookpile',4*T,5*T,{box:null});m.addObject('cushion',3*T,5*T,{box:null});m.addObject('herb_bundle',13*T,7*T,{box:null});
      }else if(key==='balcony'){
        portal(m,4,9,'tower2','Вернуться на второй этаж');obj(m,'emblem',8,3,'seal','Барьер трёх печатей','Печати');obj(m,'chest',12,5,'cellar_door','Скрытый спуск в архив','Спуститься');
        for(let x=1;x<15;x++){m.addObject('fence',x*T,11*T-2,{box:null});m.addObject('fence',x*T,2*T+2,{box:null});}
        m.addObject('planter',2*T,4*T,{box:null});m.addObject('planter',13*T,8*T,{box:null});m.addObject('bench',6*T,8*T,{box:null});
      }else if(key==='cellar'){
        portal(m,4,9,'balcony','Подняться на балкон');obj(m,'scroll',10,5,'guardian','Хранитель архива','Говорить');m.addObject('shelf',12*T,3*T,{box:null});m.addObject('scroll',8*T,29,{box:null});
        for(const x of [2,6,9,13])m.addObject('shelf',x*T,3*T,{box:null});m.addObject('bigdesk',7*T,7*T,{box:null});m.addObject('bookpile',7*T,7*T,{box:null});m.addObject('andon',2*T,8*T,{box:null});m.addObject('andon',13*T,8*T,{box:null});
        m.npcs.push(G.world.makeNpc({id:'chunin',name:'Хранитель архива',x:10*T+8,y:5*T+14,dir:'down',talk:['Я храню знания прежних дозорных.']}));
      }else{
        portal(m,4,9,'forest','Вернуться из пещеры');obj(m,'chest',10,4,'cave_cache','Сундук под корнями','Открыть');
        for(let x=2;x<14;x+=3)m.addObject('rock',x*T,3*T,{box:null});
      }
    }else return null;
    for(const b of G.ADVENTURES.books)if(b.map===m.id)obj(m,'scroll',b.x,b.y,'book:'+b.id,b.title,'Читать');
    m.finalize();return m;
  }
  function patch(m){
    if(!m.adv)return;
    if(m.id==='adv:river'){
      const built=!!G.state.flags.adv_bridge;if(m._bridge!==built){m._bridge=built;path(m,16,14,21,15,built?ID.PLANKS:ID.WATER);m.finalize();delete m._walk;delete m._wk;delete m._ov;}
    }
    if(m.id==='adv:balcony'){const o=m.objects.find(o=>o.adv==='cellar_door');if(o&&G.state.flags.adv_seal_open&&!o._open){Object.assign(o,transition('down'));o._open=true;m.finalize();}else if(o&&!G.state.flags.adv_seal_open&&o._open){const spr=G.tiles.object('chest');Object.assign(o,{img:spr.img,w:spr.w,h:spr.h,ox:spr.ox,oy:spr.oy,_open:false});m.finalize();}}
  }
  const get=G.world.get.bind(G.world);
  G.world.get=function(id){if(String(id).startsWith('adv:')){const m=this.maps[id]||(this.maps[id]=make(id.slice(4)));if(m){patch(m);return m;}return this.konoha();}return get(id);};
  const pop=G.world.populateKonoha.bind(G.world);
  G.world.populateKonoha=function(m){
    pop(m);
    for(const [tpl,id,title,to,dx,dy]of [['academy','hub','Доска экспедиций',null,3,8],['gate','travel:forest','Тропа за воротами','forest',2,6]]){
      const b=m.buildings.find(b=>b.tplId===tpl)||m.buildings.find(b=>b.tplId==='academy');
      const spot=this.freeTile(m,(b?.tx||78)+dx,(b?.ty||45)+dy);if(spot)obj(m,'village_board',...spot,id,title,to?'Перейти':'Приключения');
    }
  };
  return {make,patch,titles,obj};
})();
