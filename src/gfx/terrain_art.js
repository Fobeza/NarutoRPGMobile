// Новые материалы земли; дороги, проходимость и раскладка клеток не меняются.
G.terrainArt=(()=>{
  const cache=new Map();
  function tile(name,turn=0){
    const key=name+turn;if(cache.has(key))return cache.get(key);
    const img=G.environmentArt.image('ground-'+name),c=G.gfx.canvas(16,16),ctx=c.getContext('2d');
    ctx.translate(8,8);ctx.rotate(turn*Math.PI/2);ctx.drawImage(img,-8,-8,16,16);
    cache.set(key,c);return c;
  }
  function paintAtlas(ctx,ID,VAR){
    const grass=tile('grass'),earth=tile('earth');
    // Свободные столбцы второй строки атласа отдаём повёрнутому материалу: сетка повторов травы слабее.
    let next=0;
    for(const k in VAR)for(const c of VAR[k])next=Math.max(next,c+1);
    const spare=Object.keys(ID).length;
    for(const id of [ID.GRASS,ID.GRASS2,ID.CLOVER,ID.MOSS,ID.DARKGRASS]){
      if(next>=spare)break;
      const turn=1+((next-1)%3);
      const material=tile('grass',turn);
      const col=next++;
      const draw=(x,y)=>{ctx.drawImage(material,x,y);if(id===ID.DARKGRASS||id===ID.MOSS){ctx.fillStyle=id===ID.DARKGRASS?'rgba(20,55,32,.3)':'rgba(20,55,32,.12)';ctx.fillRect(x,y,16,16);}};
      draw(col*16,16);
      (VAR[id]||(VAR[id]=[])).push(col);
    }
    for(const id of [ID.GRASS,ID.GRASS2,ID.FLOWERS,ID.CLOVER,ID.MOSS,ID.DARKGRASS,ID.PATH,ID.DIRT]){
      const material=id===ID.PATH||id===ID.DIRT?earth:grass;
      const draw=(x,y)=>{ctx.drawImage(material,x,y);if(id===ID.DARKGRASS||id===ID.MOSS){ctx.fillStyle=id===ID.DARKGRASS?'rgba(20,55,32,.3)':'rgba(20,55,32,.12)';ctx.fillRect(x,y,16,16);}};
      draw(id*16,0);for(const col of VAR[id]||[])draw(col*16,16);
    }
  }
  function shape(map,tx,ty,ID,GRASSY){
    if(!map.outdoor||map.get(tx,ty)!==ID.PATH)return null;
    const dirs=[[0,-1,'N'],[1,0,'E'],[0,1,'S'],[-1,0,'W']];
    let mask='';
    for(const [dx,dy,s] of dirs){
      const id=map.get(tx+dx,ty+dy);
      if(id===ID.PATH){
        // Не сужаем край многоклеточной дороги и подходы к перекрёстку.
        if(dirs.filter(([a,b])=>map.get(tx+dx+a,ty+dy+b)===ID.PATH).length>2)return null;
        mask+=s;
      }else if(!GRASSY.has(id))return null;
    }
    const shapes={NS:['01-straight',0],EW:['01-straight',1],NW:['02-corner-left-up',0],NE:['02-corner-left-up',1],ES:['02-corner-left-up',2],SW:['02-corner-left-up',3],N:['04-up',0],S:['03-down',0],E:['04-up',1],W:['04-up',3]};
    return shapes[mask]||null;
  }
  function draw(ctx,map,tx,ty,x,y,ID,GRASSY){
    const s=shape(map,tx,ty,ID,GRASSY);if(!s)return false;
    ctx.drawImage(tile(...s),x,y);return true;
  }
  return {tile,paintAtlas,shape,draw};
})();
