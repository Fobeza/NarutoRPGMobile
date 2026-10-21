// Спокойная вода: общий мировой рисунок, глубина от реального берега, декор без коллизий.
G.waterArt=(()=>{
  let tile=null;
  const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
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
  // Общая холодная палитра: смена типа ближайшего берега не меняет цвет воды.
  function sample(list,x,y){
    const d=nearest(list,x,y).distance;
    const grain=G.util.hash2(Math.floor(x),Math.floor(y),903);
    // Узкая кромка, четыре уровня с лёгким пиксельным дизерингом вместо размытого ореола.
    const k=Math.floor((1-smooth(d/5))*4+grain)/4;
    const gx=Math.floor(x/11),gy=Math.floor(y/7),seed=G.util.hash2(gx,gy,931);
    const lx=x-gx*11,ly=y-gy*7;
    const ripple=seed>.42&&Math.floor(ly)===1+Math.floor(seed*4)&&lx>=1+Math.floor(seed*3)&&lx<4+Math.floor(seed*5);
    const texture=ripple?5:Math.floor(grain*3)-1;
    return [61+19*k+texture,123+19*k+texture,153+7*k+texture];
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
    // Редкие приметы только природной кромки. Не добавляем объекты в карту/сохранение.
    const h=G.util.hash2(tx,ty,917);
    if(h>.79){
      const options=[[8,7,8],[8,14,4],[2,10,4],[13,10,4]];
      const p=options.find(([a,b,reach])=>{const n=nearest(list,tx*16+a,ty*16+b);return n.natural&&n.distance<reach;});
      if(p){const [a,b]=p;
        if(h>.92){
          c.fillStyle='#617a70';c.fillRect(a-2,b,5,2);c.fillStyle='#a4aa8a';c.fillRect(a-1,b-1,3,2);c.fillStyle='#c0b99c';c.fillRect(a,b-1,2,1);
        }else{
          c.fillStyle='#536e52';c.fillRect(a-2,b-4,1,5);c.fillRect(a,b-6,1,7);c.fillRect(a+2,b-3,1,4);
          c.fillStyle='#929b66';c.fillRect(a-2,b-4,1,2);c.fillRect(a,b-6,1,3);
          c.fillStyle='#716347';c.fillRect(a,b-7,1,2);
        }
      }
    }
    ctx.drawImage(tile,x,y);return true;
  }
  function overlay(ctx,x,y,tx,ty,time){
    if(G.storage.settings.fx===false)return;
    const seed=G.util.hash2(tx,ty,923);if(seed<.64)return;
    const phase=time*.55+seed*Math.PI*2;
    const xx=3+Math.floor(G.util.hash2(tx,ty,924)*7+Math.sin(phase)*.8),yy=4+Math.floor(G.util.hash2(tx,ty,925)*8);
    ctx.save();ctx.globalAlpha*=.17+.09*Math.sin(phase);ctx.fillStyle='#c2d9d3';
    ctx.fillRect(x+xx,y+yy,seed>.9?4:3,1);ctx.restore();
  }
  return {draw,overlay,sample};
})();
