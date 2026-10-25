// Каменное мощение и кромки. Всё запекается в чанки, без изменения клеток/коллизий.
G.streetArt=(()=>{
  const cache=new Map(),pixels=new Map(),PERIOD=64,TAU=Math.PI*2;
  const mod=(v,n)=>((v%n)+n)%n;
  const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
  function category(id,ID){
    if([ID.STONE,ID.MAINROAD,ID.COBBLE,ID.PLAZA].includes(id))return 'street';
    if([ID.GRASS,ID.GRASS2,ID.FLOWERS,ID.CLOVER,ID.DARKGRASS,ID.MOSS].includes(id))return 'grass';
    if(id===ID.PATH||id===ID.DIRT)return 'earth';
    return null;
  }
  function source(name){
    if(!pixels.has(name)){
      const im=G.environmentArt.image('ground-'+name);
      pixels.set(name,{w:im.width,h:im.height,data:im.getContext('2d').getImageData(0,0,im.width,im.height).data});
    }
    return pixels.get(name);
  }
  // Кромка: переход шире и с дизерингом по мировому шуму, поэтому мостовая не «приклеена» к траве линейкой.
  function axis(v,dith=0){
    const cell=Math.floor(v/16),f=mod(v,16);
    const t=(x)=>Math.max(0,Math.min(1,x+dith));
    if(f<5){return [[cell-1,1-t(smooth((f+5)/10))],[cell,t(smooth((f+5)/10))]];}
    if(f>11){return [[cell,1-t(smooth((f-11)/10))],[cell+1,t(smooth((f-11)/10))]];}
    return [[cell,1]];
  }
  function draw(ctx,map,tx,ty,x,y,ID){
    if(!map.outdoor)return false;
    const center=map.get(tx,ty),kind=category(center,ID);
    if(!kind)return false;
    const neighbors=[];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)neighbors.push(map.get(tx+dx,ty+dy));
    if(kind!=='street'&&!neighbors.some(id=>category(id,ID)==='street'))return false;
    // Фаза текстуры И неровной кромки общая: результат не зависит от порядка чанков.
    const key=mod(tx,4)+','+mod(ty,4)+':'+neighbors.join(',');
    let c=cache.get(key);
    if(!c){
      c=G.gfx.canvas(16,16);const cc=c.getContext('2d'),im=cc.createImageData(32,32);
      for(let py=0;py<32;py++)for(let px=0;px<32;px++){
        const wx=tx*16+(px+.5)/2,wy=ty*16+(py+.5)/2;
        const nx=mod(wx,PERIOD),ny=mod(wy,PERIOD);
        const jx=1.7*Math.sin(TAU*(nx+2*ny)/PERIOD)+.8*Math.sin(TAU*(3*nx-ny)/PERIOD);
        const jy=1.7*Math.sin(TAU*(ny-2*nx)/PERIOD)+.8*Math.sin(TAU*(nx+3*ny)/PERIOD);
        const dith=(G.util.hash2(Math.floor(nx*2),Math.floor(ny*2),771)-.5)*.5;
        const xs=axis(wx+jx,dith),ys=axis(wy+jy,dith),rgb=[0,0,0];
        for(const [cx,xw] of xs)for(const [cy,yw] of ys){
          let id=neighbors[(cy-ty+1)*3+cx-tx+1],type=category(id,ID);
          // У воды, стен и внутри зданий оставляем прежнюю обработку границы.
          if(!type){id=center;type=kind;}
          const a=source(type),i=(Math.floor(mod(wy*2,a.h))*a.w+Math.floor(mod(wx*2,a.w)))*4;
          const shade=id===ID.DARKGRASS?.3:id===ID.MOSS?.12:0,weight=xw*yw;
          for(let k=0;k<3;k++)rgb[k]+=(a.data[i+k]*(1-shade)+[20,55,32][k]*shade)*weight;
        }
        const p=(py*32+px)*4;im.data[p]=rgb[0];im.data[p+1]=rgb[1];im.data[p+2]=rgb[2];im.data[p+3]=255;
      }
      cc.putImageData(im,0,0);if(cache.size>=512)cache.delete(cache.keys().next().value);cache.set(key,c);
    }
    ctx.drawImage(c,x,y);return true;
  }
  return {draw,category,clear(){cache.clear();}};
})();
