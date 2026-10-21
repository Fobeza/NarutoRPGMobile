// Бытовые детали у фасадов: только свободные места, без новых коллизий.
G.villageDetails = (() => {
  const home = [
    ['flowerpot', 'Горшок с цветами. Земля ещё влажная: хозяева поливали их утром.'],
    ['basket', 'Корзина с яблоками. Сверху лежит записка: «Для соседей».'],
    ['pots', 'Глиняные горшки сушатся после мытья. Каждый немного отличается от остальных.'],
    ['sacks', 'Мешочки риса для домашней кухни. На узелках завязаны цветные нитки.'],
  ];
  const shops = {
    ichiraku: [['basket', 'Свежие овощи для бульона. Теучи забрал их на рынке ещё до рассвета.'], ['crate', 'Ящик с мисками. На крышке написано: «Осторожно, посуда».']],
    dango: [['basket', 'Продукты для сладких данго. От лавки пахнет поджаренным тестом.']],
    teahouse: [['pots', 'Кувшины с водой для чая. Рядом остались следы от мокрых чашек.']],
    pharmacy: [['herb_bundle', 'Связки лекарственных трав перевязаны нитками разных цветов.']],
    flowers: [['flowerpot', 'Молодые цветы ждут новых хозяев. На горшке нарисовано маленькое солнце.']],
    books: [['bookpile', 'Книги для обмена. Между страницами одной из них засох кленовый лист.']],
    library: [['bookpile', 'Возвращённые учебники. Кто-то оставил закладку на главе о контроле чакры.']],
    academy: [['bookpile', 'Чьи-то конспекты с урока. На полях нарисованы кунаи и смешной Ирука.']],
    weapons: [['crate', 'Ящик тренировочных мишеней. Все кунаи уже убрали в мастерскую.']],
    market: [['basket', 'Последние яблоки с утреннего привоза. Самые румяные оставили сверху.'], ['sacks', 'Мешки с рисом. Счёт за доставку прижат маленьким камешком.']],
    inuzuka_shop: [['basket', 'Корзинка с игрушками для нинкенов. Мячик уже основательно погрызен.']],
  };
  function safe(m, r) {
    if(r.x<16||r.y<16||r.x+r.w>(m.w-1)*16||r.y+r.h>(m.h-1)*16)return false;
    // Проверяем весь рисунок, а не только точку опоры предмета.
    for(let y=Math.floor(r.y/16);y<=Math.floor((r.y+r.h-1)/16);y++)for(let x=Math.floor(r.x/16);x<=Math.floor((r.x+r.w-1)/16);x++){
      if(m.solidTile(x,y)||[G.tiles.ID.MAINROAD,G.tiles.ID.PATH,G.tiles.ID.BRIDGE].includes(m.get(x,y)))return false;
    }
    if(m.warps.some(w=>G.util.rectsOverlap(r,{x:w.rect.x-24,y:w.rect.y-16,w:w.rect.w+48,h:w.rect.h+40})))return false;
    if(m.npcs.some(n=>G.util.rectsOverlap(r,{x:n.x-14,y:n.y-20,w:28,h:28})))return false;
    return !m.objects.some(o=>G.util.rectsOverlap(r,{x:o.x+o.ox-2,y:o.y+o.oy-2,w:o.w+4,h:o.h+4}));
  }
  function populate(m) {
    if(m._villageDetails||m.id!=='konoha')return;
    m._villageDetails=true;
    let count=0;
    for(const b of m.buildings){
      if(count>=100)break;
      const pool=shops[b.tplId]||(b.tplDef.cat==='house'?home:null);
      if(!pool||!b.door)continue;
      const seed=Math.floor(G.util.hash2(b.tx,b.ty,301)*1000);
      const [kind,text]=pool[seed%pool.length],spr=G.tiles.object(kind);
      const left=b.x+6,right=b.x+b.tw*16-6,bottom=b.y+b.th*16;
      const points=[[left,bottom+18],[right,bottom+18],[left-14,bottom-4],[right+14,bottom-4]];
      if(seed%2)points.reverse();
      for(const [x,y] of points){
        const r={x:x+spr.ox,y:y+spr.oy,w:spr.w,h:spr.h};
        if(!safe(m,r))continue;
        m.addObject(kind,x,y,{box:null,talk:[text],_villageDetail:true});count++;break;
      }
    }
  }
  return {populate,safe};
})();
