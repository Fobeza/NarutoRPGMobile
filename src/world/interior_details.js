// Узнаваемые планировки. Размеры комнат и двери сохранены для старых сохранений.
G.interiorDetails = (() => {
  const T = 16, ID = G.tiles.ID, K = G.interiors.KINDS;
  const add = (m, kind, x, y, extra = {}) => m.addObject(kind, x*T+8, y*T+15, extra);
  const wall = (m, kind, x, text) => m.addObject(kind,x*T+8,29,{box:null,talk:text?[text]:null});
  const remove = (m, test) => { m.objects = m.objects.filter(o => !test(o)); };
  const patch = (kind, change) => {
    const base = K[kind];
    K[kind] = info => { const m=base(info);m.authored=true;change(m,info);return m; };
  };
  function area(m,x0,y0,x1,y1,id) { for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)m.set(x,y,id); }
  function replace(m, o, kind, extra={}) {
    remove(m,x=>x===o);return m.addObject(kind,o.x,o.y,Object.assign({talk:o.talk},extra));
  }
  // Предмет ставится только там, где рисунок и коллизия не закрывают NPC, мебель и вход.
  function freeAdd(m, kind, candidates, extra={}) {
    const spr=G.tiles.object(kind);
    const {requireReach,...objectExtra}=extra,fronts=[];
    if(requireReach){
      const grid=G.nav.walkGrid(m),start=Math.floor(m.spawn.y/T)*m.w+Math.floor(m.spawn.x/T),seen=new Set([start]),queue=[start];
      for(let i=0;i<queue.length;i++){
        const k=queue[i],x=k%m.w,y=Math.floor(k/m.w);
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
          fronts.push([x*T+8+dx*12,y*T+9+dy*12]);
          const nx=x+dx,ny=y+dy,n=ny*m.w+nx;
          if(nx>=0&&ny>=0&&nx<m.w&&ny<m.h&&grid[n]&&!seen.has(n)){seen.add(n);queue.push(n);}
        }
      }
    }
    for(const [tx,ty] of candidates) {
      const x=tx*T+8,y=ty*T+15,r={x:x+spr.ox,y:y+spr.oy,w:spr.w,h:spr.h};
      if(r.x<T||r.x+r.w>(m.w-1)*T||r.y<32||r.y+r.h>(m.h-1)*T+1)continue;
      if(ty>=m.h-3&&Math.abs(tx-m.exit.tx)<1.5)continue;
      if(m.objects.some(o=>o.y!==29&&G.util.rectsOverlap(r,m.drawRect(o))))continue;
      if(m.npcs.some(n=>G.util.rectsOverlap(r,{x:n.x-7,y:n.y-7,w:14,h:8})))continue;
      if(requireReach&&!fronts.some(([fx,fy])=>fx>=x-14&&fx<=x+14&&fy>=y-24&&fy<=y+6))continue;
      return add(m,kind,tx,ty,objectExtra);
    }
    return null;
  }
  patch('hero_home',m=>{
    area(m,1,6,8,6,ID.FLOOR);
    // Зона учёбы, спальня и деревянный проход у входа читаются отдельно.
    wall(m,'herb_bundle',8);
  });
  patch('naruto_flat',m=>{
    freeAdd(m,'ramen_stack',[[3,3],[4,2]],{talk:['Запас лапши на неделю. Наруто уверен, что на два дня.']});
    freeAdd(m,'laundry_bundle',[[3,4],[2,5]],{talk:['Сложенная кучей тренировочная одежда. Под ней нашёлся ещё один стаканчик рамена.'],box:null});
    const bed=m.objects.find(o=>o.kind==='futon');if(bed)bed.talk=['Постель Наруто. Одеяло кое-как заправлено, а на подушке лежит ночной колпак.'];
  });
  patch('sasuke_home',m=>{
    remove(m,o=>o.kind==='table');
    area(m,1,2,3,5,ID.TATAMI);
    add(m,'desk',7,5,{talk:['Кунай тщательно вычищен. Рядом аккуратные записи о тренировках.']});
    wall(m,'family_photo',5,'Семейная фотография Учиха. Стекло протёрто, хотя в комнате почти ничего нет.');
    freeAdd(m,'rack',[[6,2]],{talk:['Оружие разложено по размеру. Саске проверяет снаряжение каждый вечер.']});
  });
  for(const kind of ['weapons','pharmacy','books','flowers','market','souvenir','inuzuka_shop','shop'])patch(kind,(m,info)=>{
    const id=info.tplId;
    if(id==='pharmacy') {
      area(m,1,2,8,6,ID.TILEFLOOR);
      for(const o of m.objects.filter(o=>o.kind==='shelf'))replace(m,o,'medicine_case',{talk:['Подписанные настойки, бинты и аптекарские весы.']});
      remove(m,o=>o.kind==='scroll');wall(m,'herb_bundle',3);wall(m,'herb_bundle',6);
    } else if(id==='weapons') {
      area(m,2,4,7,5,ID.DARKSTONE);
      remove(m,o=>o.kind==='crate');
      freeAdd(m,'desk',[[7,5]],{talk:['Верстак оружейника: заточной камень, проволока и разобранная рукоять куная.']});
    } else if(id==='flowers') {
      area(m,1,4,8,6,ID.STONE);area(m,3,4,6,5,ID.PLANKS);
      remove(m,o=>o.kind==='counter'&&[2,7].includes(Math.floor(o.x/T)));
      wall(m,'herb_bundle',4,'Сухие цветы для зимних букетов.');
    } else if(id==='books') {
      const shelf=m.objects.find(o=>o.kind==='shelf'&&o.y>70&&o.x>80);if(shelf)remove(m,o=>o===shelf);
      freeAdd(m,'desk',[[7,5]],{talk:['Уголок для чтения. На полях учебника кто-то нарисовал смешного Буншина.']});
    } else if(id==='market') {
      add(m,'produce_tray',3,3,{box:null});add(m,'produce_tray',6,3,{box:null});
      area(m,1,4,8,6,ID.STONE);
    } else if(id==='inuzuka_shop') {
      freeAdd(m,'dog_bed',[[2,5],[7,5]],{talk:['Лежанка для нинкена. Рядом аккуратно сложены лакомства.'],box:null});
      remove(m,o=>o.kind==='scroll');wall(m,'crest_inuzuka',4);wall(m,'crest_inuzuka',6);
    } else if(id==='souvenir') {
      remove(m,o=>o.kind==='scroll');wall(m,'poster',3);wall(m,'family_photo',6);
      freeAdd(m,'vase',[[2,5]],{talk:['Расписная керамика с осенней ярмарки.']});
    }
  });
  for(const kind of ['ichiraku','teahouse','dango','yakiniku'])patch(kind,m=>{
    if(kind==='ichiraku') {
      add(m,'dango_tray',4,3,{box:null});
      // Кухня и места Наруто и Ируки остаются доступны сюжетным сценам.
      freeAdd(m,'ramen_stack',[[1,5],[8,5]],{talk:['Лапша для вечерней смены. Теучи всегда оставляет запас для Наруто.']});
    } else if(kind==='teahouse') {
      remove(m,o=>o.kind==='kitchen'||o.kind==='stool'||(o.kind==='counter'&&(o.x<64||o.x>112)));
      area(m,1,4,8,5,ID.TATAMI);
      add(m,'lowtable',2,4,{talk:['Чайный столик у окна. На подносе тёплые чашки.']});
      add(m,'shogi_table',7,4,{talk:['Шоги. На доске осталась непростая партия.']});
      remove(m,o=>o.kind==='scroll');wall(m,'window',2);wall(m,'painting',7);
    } else if(kind==='yakiniku') {
      remove(m,o=>o.kind==='stool');
      add(m,'bbq_table',2,4,{talk:['Стол с решёткой для мяса. От углей ещё идёт тепло.']});
      add(m,'bbq_table',7,4,{talk:['Большой стол команды Асумы. Здесь всегда заказывают много.']});
      area(m,1,4,8,5,ID.BRICK);
    } else {
      remove(m,o=>o.kind==='stool');
      add(m,'bench',2,5);add(m,'bench',7,5);
      add(m,'dango_tray',3,3,{box:null});add(m,'dango_tray',6,3,{box:null});
      remove(m,o=>o.kind==='scroll');wall(m,'poster',4);wall(m,'chochin',6);
    }
  });
  const clans=['nara','akimichi','hyuga','inuzuka','aburame','senju','sarutobi','yamanaka','uchiha'];
  for(const clan of clans)patch(clan+'_hall',m=>{
    remove(m,o=>o.kind==='emblem');wall(m,'crest_'+clan,6,'Семейный знак клана. У каждого дома Конохи своя история.');
    if(clan==='nara') {
      remove(m,o=>o.kind==='pillar'||o.kind==='table');
      add(m,'shogi_table',4,4,{talk:['Партия Нара. Одно спокойное решение может изменить весь ход игры.']});
      wall(m,'herb_bundle',2);wall(m,'herb_bundle',9);
    } else if(clan==='hyuga') {
      remove(m,o=>o.kind==='table'||(o.kind==='pillar'&&o.y>80));
      area(m,1,2,10,7,ID.FLOOR);area(m,3,3,8,6,ID.TATAMI);
      freeAdd(m,'screen',[[8,2]],{talk:['Ширма закрывает семейную часть дома. В тренировочном зале безупречный порядок.']});
    } else if(clan==='akimichi') {
      const table=m.objects.find(o=>o.kind==='table');if(table)replace(m,table,'bbq_table',{talk:['Семейный стол Акимичи. Сначала накорми гостя, потом расспрашивай.']});
      area(m,4,3,7,5,ID.RUG);freeAdd(m,'produce_tray',[[8,2]],{box:null});
    } else if(clan==='inuzuka') {
      remove(m,o=>o.kind==='pillar'&&o.y>80);
      add(m,'dog_bed',2,5,{box:null});add(m,'dog_bed',9,5,{box:null});
      area(m,1,6,10,7,ID.FLOOR);
    } else if(clan==='aburame') {
      remove(m,o=>o.kind==='pillar'||o.kind==='table');
      add(m,'insect_case',3,3,{talk:['Террариум с ветками и жуками-кикайчу. Двигайся спокойно: здесь не любят резких звуков.']});
      add(m,'insect_case',8,4,{talk:['Записи о колониях насекомых. Каждая стеклянная секция подписана.']});
      area(m,1,2,10,7,ID.FLOOR);freeAdd(m,'shelf',[[1,2]]);
    } else if(clan==='senju') {
      remove(m,o=>o.kind==='pillar'||o.kind==='table');
      add(m,'lowtable',7,4);add(m,'shelf',2,3);wall(m,'family_photo',3);
      area(m,1,2,10,7,ID.FLOOR);area(m,5,3,8,5,ID.TATAMI);
    } else if(clan==='sarutobi') {
      remove(m,o=>o.kind==='pillar'||o.kind==='table');
      add(m,'lowtable',7,4);add(m,'tansu',2,3);wall(m,'window',3);wall(m,'window',9);
      freeAdd(m,'hibachi',[[2,5]],{talk:['Очаг и чай. Даже Хокаге нужен тихий вечер дома.']});
    } else if(clan==='yamanaka') {
      remove(m,o=>o.kind==='pillar'||o.kind==='table');
      add(m,'lowtable',4,4);add(m,'flowerbox',4,4,{box:null});
      for(const [x,y] of [[2,3],[9,3],[2,6],[9,6]])add(m,'flowerpot',x,y);
      area(m,1,2,10,7,ID.FLOOR);area(m,3,3,6,5,ID.TATAMI);
    } else {
      remove(m,o=>o.kind==='table');area(m,1,2,10,7,ID.FLOOR);area(m,5,3,6,7,ID.RUG);
      freeAdd(m,'family_photo',[[1,4]],{talk:['Старая фотография клана Учиха. В большом зале слышны собственные шаги.'],box:null});
    }
  });
  return { freeAdd };
})();
