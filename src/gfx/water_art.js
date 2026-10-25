// Спокойная вода: общий мировой рисунок, глубина от реального берега, декор без коллизий.
// Палитра приглушённая: глубокое русло холодное, у берега светлое мелководье в 4 ступени с дизерингом.
G.waterArt=(()=>{
  let tile=null;
  const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
  // Глубина и мелководье: разница ступеней держится в пределах ±20, чтобы вода не спорила с травой.
  const DEEP=[40,88,108], SHALLOW=[46,106,118];
  function banks(map,tx,ty,ID){
    const out=[];
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      const id=map.get(tx+dx,ty+dy);
      if(id<0||id===ID.WATER||id===ID.VOID)continue;
      out.push({x:(tx+dx)*16,y:(ty+dy)*16,natural:G.tiles.GRASSY.has(id)||[ID.SAND,ID.DIRT,ID.PATH].includes(id)});
    }
    return out;
  }
  function nearest(list,x,y){
    let distance=32,natural=false;
    for(const b of list){
      const dx=Math.max(b.x-x,0,x-b.x-16),dy=Math.max(b.y-y,0,y-b.y-16),d=Math.hypot(dx,dy);
      if(d<distance){distance=d;natural=b.natural;}
    }
    return {distance,natural};
  }
  // Цвет точки: мелководье у берега (до 5 px), длинные гребни с общей мировой фазой, зерно.
  function sample(list,x,y){
    const d=nearest(list,x,y).distance;
    const grain=G.util.hash2(Math.floor(x),Math.floor(y),903);
    // Кромка: четыре уровня с лёгким пиксельным дизерингом вместо размытого ореола.
    // Шум в расстоянии рвёт ровную полосу мелководья на неровные языки.
    const k=Math.floor((1-smooth((d+(grain-.5)*2.2)/5.4))*4+grain)/4;
    // Широкие ломаные гребни: фаза общая для всей карты, поэтому швов между тайлами нет.
    const gx=Math.floor(x/32),gy=Math.floor(y/14),seed=G.util.hash2(gx,gy,931);
    const lx=x-gx*32,ly=y-gy*14,start=2+Math.floor(seed*8),len=9+Math.floor(seed*12);
    const row=3+Math.floor(G.util.hash2(gx,gy,932)*6)+Math.round(Math.sin((lx-start)*.36+seed*6));
    const span=lx>=start&&lx<start+len;
    const crest=span&&Math.floor(ly)===row;
    // Вторая семья коротких гребней со своим шагом: рябь не складывается в один ритм.
    const gx2=Math.floor(x/23),gy2=Math.floor(y/11),seed2=G.util.hash2(gx2,gy2,936);
    const lx2=x-gx2*23,ly2=y-gy2*11,st2=3+Math.floor(seed2*9),ln2=5+Math.floor(seed2*8);
    const crest2=lx2>=st2&&lx2<st2+ln2&&Math.floor(ly2)===2+Math.floor(seed2*5);
    const trough=span&&Math.floor(ly)===row+2;          // тень под гребнем — волна читается объёмнее
    const ends=span?Math.min(1,(lx-start+1)/3,(start+len-lx)/3):0;
    const band=Math.round((Math.sin(x*.031+y*.019)+Math.sin(y*.055-x*.014))*2)*2;
    const grainTone=Math.floor(grain*3)-1;
    const light=crest?Math.round(19*ends):trough?-6:crest2?5:0;
    const wetLine=d<0.9?-7:0;                            // у самой суши вода темнее — линия контакта
    return [
      Math.round(DEEP[0]+(SHALLOW[0]-DEEP[0])*k)+band+grainTone+light+wetLine,
      Math.round(DEEP[1]+(SHALLOW[1]-DEEP[1])*k)+band+grainTone+light+wetLine,
      Math.round(DEEP[2]+(SHALLOW[2]-DEEP[2])*k)+band+grainTone+light+wetLine,
    ];
  }
  // Тёмная тень моста на воде: доска перекрывает свет, у края настила — блик от воды.
  function bridgeShade(c,map,tx,ty,ID){
    const sides=[[0,-1,'N'],[0,1,'S'],[-1,0,'W'],[1,0,'E']].filter(([dx,dy])=>map.get(tx+dx,ty+dy)===ID.PLANKS);
    if(!sides.length)return;
    for(const [dx,dy,side] of sides){
      for(let i=0;i<16;i++){
        for(let n=0;n<4;n++){
          const a=[.34,.2,.11,.05][n];
          c.globalAlpha=a;c.fillStyle='#12303c';
          if(side==='N')c.fillRect(i,n,1,1);
          else if(side==='S')c.fillRect(i,15-n,1,1);
          else if(side==='W')c.fillRect(n,i,1,1);
          else c.fillRect(15-n,i,1,1);
        }
        // отражение настила: рваный светлый штрих в 2 px от моста
        if(G.util.hash2(tx*16+i,ty,929)>.55){
          c.globalAlpha=.16;c.fillStyle='#b8b0a0';
          if(side==='N')c.fillRect(i,4,1,1);else if(side==='S')c.fillRect(i,11,1,1);
          else if(side==='W')c.fillRect(4,i,1,1);else c.fillRect(11,i,1,1);
        }
      }
      c.globalAlpha=1;
      // Свая: опора настила уходит в воду, под ней — дрожащее отражение.
      const ph=G.util.hash2(tx+dx,ty+dy,933), at=2+Math.floor(ph*9);
      c.globalAlpha=.9;c.fillStyle='#4a2e17';
      if(side==='N')c.fillRect(at,0,2,5);else if(side==='S')c.fillRect(at,11,2,5);
      else if(side==='W')c.fillRect(0,at,5,2);else c.fillRect(11,at,5,2);
      c.globalAlpha=.55;c.fillStyle='#8a5a30';
      if(side==='N')c.fillRect(at,0,1,4);else if(side==='S')c.fillRect(at+1,12,1,4);
      else if(side==='W')c.fillRect(0,at,4,1);else c.fillRect(12,at+1,4,1);
      c.globalAlpha=.18;c.fillStyle='#1a3038';
      if(side==='N')c.fillRect(at-1,6,4,2);else if(side==='S')c.fillRect(at-1,8,4,2);
      else if(side==='W')c.fillRect(6,at-1,2,4);else c.fillRect(8,at-1,2,4);
      c.globalAlpha=1;
      // Сваи под настилом: две опоры у самой кромки и дрожащее отражение ниже.
      if(G.util.hash2(tx+dx,ty+dy,934)>.35){
        const a=3+Math.floor(G.util.hash2(tx,ty,935)*9);
        c.globalAlpha=.92;c.fillStyle='#3f2711';
        if(side==='N')c.fillRect(a,0,2,4);else if(side==='S')c.fillRect(a,12,2,4);
        else if(side==='W')c.fillRect(0,a,4,2);else c.fillRect(12,a,4,2);
        c.globalAlpha=.5;c.fillStyle='#6d4620';
        if(side==='N')c.fillRect(a,0,1,3);else if(side==='S')c.fillRect(a+1,13,1,3);
        else if(side==='W')c.fillRect(0,a,3,1);else c.fillRect(13,a+1,3,1);
        c.globalAlpha=.22;c.fillStyle='#7d5730';
        if(side==='N')c.fillRect(a-1,4,4,3);else if(side==='S')c.fillRect(a-1,10,4,3);
        else if(side==='W')c.fillRect(4,a-1,3,4);else c.fillRect(10,a-1,3,4);
        c.globalAlpha=1;
      }
    }
  }
  function draw(ctx,map,tx,ty,x,y,ID){
    if(!map.outdoor||map.get(tx,ty)!==ID.WATER)return false;
    const list=banks(map,tx,ty,ID);
    if(!tile)tile=G.gfx.canvas(16,16);
    const c=tile.getContext('2d'),im=c.createImageData(32,32);
    for(let py=0;py<32;py++)for(let px=0;px<32;px++){
      const wx=tx*16+(px+.5)/2,wy=ty*16+(py+.5)/2,p=(py*32+px)*4;
      const color=sample(list,wx,wy);
      for(let z=0;z<3;z++)im.data[p+z]=color[z];
      im.data[p+3]=255;
    }
    c.putImageData(im,0,0);
    // Редкие приметы только природной кромки: камень в воде и камыш. В карту/сохранение ничего не добавляем.
    const h=G.util.hash2(tx,ty,917);
    if(h>.79){
      const options=[[8,7,8],[8,14,4],[2,10,4],[13,10,4]];
      const p=options.find(([a,b,reach])=>{const n=nearest(list,tx*16+a,ty*16+b);return n.natural&&n.distance<reach;});
      if(p){const [a,b]=p;
        if(h>.92){
          // валун: мокрый тёмный ободок и светлая шапка
          c.fillStyle='#2c4a50';c.fillRect(a-2,b+1,5,2);
          c.fillStyle='#617a70';c.fillRect(a-2,b,5,2);
          c.fillStyle='#93a99b';c.fillRect(a-1,b-1,3,1);c.fillStyle='#c0cdbe';c.fillRect(a,b-2,2,1);
        }else{
          // камыш: три стебля разной высоты, чуть наклонённые
          c.fillStyle='#536e52';c.fillRect(a-2,b-5,1,6);c.fillRect(a,b-7,1,8);c.fillRect(a+2,b-4,1,5);
          c.fillStyle='#929b66';c.fillRect(a-2,b-5,1,2);c.fillRect(a,b-7,1,3);c.fillRect(a+2,b-4,1,2);
          c.fillStyle='#716347';c.fillRect(a,b-8,1,2);
        }
      }
    }
    bridgeShade(c,map,tx,ty,ID);
    ctx.drawImage(tile,x,y);return true;
  }
  // Живая вода: две ломаные ряби плывут по течению, у берега мерцает пена. Рисуется поверх запечённого чанка.
  function overlay(ctx,x,y,tx,ty,time){
    if(G.storage.settings.fx===false)return;
    const seed=G.util.hash2(tx,ty,923);
    ctx.save();
    // 1. Рябь: длинный блик, ползущий вправо; фаза своя у каждой клетки, но движение общее.
    for(let i=0;i<2;i++){
      const s=G.util.hash2(tx,ty,924+i);
      const speed=.35+i*.18;
      const ph=((time*speed+s*4)%1);
      const yy=3+i*6+Math.floor(G.util.hash2(tx,ty,926+i)*4);
      const len=4+Math.floor(s*5), xx=Math.round(-len+ph*(16+len));
      const rise=Math.sin(ph*Math.PI);                    // блик разгорается и гаснет
      ctx.globalAlpha=(.05+.08*rise)*(seed>.35?1:0);
      ctx.fillStyle=i?'#cfe2dc':'#a9cbc9';
      ctx.fillRect(x+Math.max(0,xx),y+yy,Math.min(len,16-Math.max(0,xx)),1);
    }
    // 2. Пена у берега: редкие короткие штрихи, мерцающие с той же фазой, что и гребни.
    if(seed>.5){
      const ph=time*.5+seed*Math.PI*2, edge=Math.sin(ph)>.1;
      if(edge){
        ctx.globalAlpha=.09+.04*Math.sin(ph*2);
        ctx.fillStyle='#dff0e8';
        const xx=2+Math.floor(G.util.hash2(tx,ty,925)*11),yy=1+Math.floor(G.util.hash2(ty,tx,928)*13);
        ctx.fillRect(x+xx,y+yy,seed>.82?3:2,1);
      }
    }
    ctx.restore();
  }
  return {draw,overlay,sample};
})();
