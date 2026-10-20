// Свет Конохи: силуэты объектов, направление солнца, локальные источники с преградами.
G.lighting = (() => {
  const silhouettes=new WeakMap(), pools=new Map();
  const enabled=()=>G.storage.settings.fx!==false;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function daylight(min){
    const h=(min%1440)/60,s=G.fx.sun(min%1440).sun;
    return {sun:s,x:clamp((12-h)/5,-1.5,1.5),length:.12+.4*Math.abs((h-12)/7),alpha:(.16+.16*s)*(G.life.raining()?.45:1)};
  }
  function silhouette(img){
    if(!img||!img.width||!img.height)return null;
    if(silhouettes.has(img))return silhouettes.get(img);
    const w=img.lw||img.width,h=img.lh||img.height,c=G.gfx.canvas(w,h),x=c.getContext('2d');x.drawImage(img,0,0);x.globalCompositeOperation='source-in';x.fillStyle='#17212e';x.fillRect(0,0,w,h);x.globalCompositeOperation='source-over';silhouettes.set(img,c);return c;
  }
  function cast(ctx,img,x,y,w,h,dx,dy,alpha){
    const mask=silhouette(img);if(!mask)return;
    ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.transform(1,0,-dx/Math.max(1,h),-dy/Math.max(1,h),0,0);ctx.drawImage(mask,0,-h,w,h);ctx.restore();
  }
  function ground(ctx,vis,map,min){
    if(!enabled())return;
    const d=daylight(min),outside=!!map.outdoor;
    for(const o of vis){
      if(!o.img||o.layer==='floor'||o.sortY<0||o.anim==='waterfall'||/water|puddle|carpet|rug|path/.test(o.kind||''))continue;
      const w=o.img.width/2||o.w,h=o.img.height/2||o.h;
      // Объекты хранят размеры уже в логических координатах, включая импортированные здания.
      const ww=o.w||w,hh=o.h||h,x=o.x+(o.ox||0),y=o.y+(o.oy||0)+hh;
      if(o.isBuilding&&o.tplId==='hokage_rock')continue;
      const k=o.isBuilding?.34:.7;
      const dx=outside?d.x*Math.min(hh,95)*d.length:4;
      const dy=outside?Math.max(3,Math.min(hh,95)*d.length*.42):3;
      if(outside&&d.sun>.05)cast(ctx,o.img,x,y,ww,hh,dx,dy,d.alpha*k);
      G.shade.shadow(ctx,x+ww*.5,y-1,Math.max(2,ww*.43),o.isBuilding?4:Math.max(1.4,Math.min(4,ww*.12)),outside?.2:.16);
    }
  }
  function actor(ctx,a,map,min){
    if(!enabled())return;
    const sheet=G.chars.sheet(a.id);if(!sheet)return;
    const d=daylight(min);if(map.outdoor&&d.sun<.05)return;
    const frame=a.moving?G.chars.WALK[Math.floor(a.anim)%4]:0,dirs=G.chars.DIRS||['down','left','right','up'];
    const di=Math.max(0,dirs.indexOf(a.dir));
    const key=a.id+':'+di+':'+frame;
    let c=pools.get(key);if(!c){c=G.gfx.canvas(16,20);c.getContext('2d').drawImage(sheet,frame*32,di*40,32,40,0,0,16,20);pools.set(key,c);}
    cast(ctx,c,a.x-8,a.y,16,20,map.outdoor?d.x*16*d.length:3,map.outdoor?8*d.length:2,map.outdoor?d.alpha*.7:.13);
  }
  function sources(vis,map,k){
    const out=[];
    for(const o of vis){
      if(o.kind==='lamp'||o.kind==='stonelamp')out.push({x:o.x,y:o.y-5,r:o.kind==='lamp'?49:33,p:map.outdoor?k:.38,bulbY:o.y-(o.kind==='lamp'?24:13)});
      else if(!map.outdoor&&/lantern|candle|fire|stove/.test(o.kind||''))out.push({x:o.x,y:o.y-6,r:37,p:.36,bulbY:o.y-8});
      else if(o.isBuilding&&o.spr?.glow&&G.util.hash2(o.tx,o.ty,77)>=.28){
        const box=o.box;if(box)out.push({x:box.x+box.w/2,y:box.y+box.h+2,r:22,p:k*.25,owner:o,bulbY:null});
      }
    }
    return out.filter(l=>l.p>.01).slice(0,32);
  }
  function blockLight(ctx,l,o){
    const r=o.box;if(!r||o===l.owner||(!o.isBuilding&&!/tree|pine|rock|wall/.test(o.kind||'')))return;
    if(l.x>r.x&&l.x<r.x+r.w&&l.y>r.y&&l.y<r.y+r.h)return;
    const corners=[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]];
    for(let i=0;i<4;i++){
      const a=corners[i],b=corners[(i+1)%4],extend=p=>{const dx=p[0]-l.x,dy=p[1]-l.y,d=Math.hypot(dx,dy)||1;return[p[0]+dx/d*l.r*3,p[1]+dy/d*l.r*3];};
      const aa=extend(a),bb=extend(b);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.lineTo(...bb);ctx.lineTo(...aa);ctx.closePath();ctx.fill();
    }
    ctx.fillRect(r.x,r.y,r.w,r.h);
  }
  let buffer=null,lightLayer=null,lightKey='';
  function draw(ctx,world,vis,cx,cy,W,VH){
    const L=G.game.light(),map=world.map,a=L?(map.outdoor?L[3]:L[3]*.35):0;
    if(L){ctx.save();ctx.fillStyle=`rgba(${L[0]|0},${L[1]|0},${L[2]|0},${a})`;ctx.fillRect(cx,cy,W,VH);ctx.restore();}
    if(!enabled())return;
    G.fx.windows(ctx,vis,map,(a-.12)/.3,world.time);
    const k=map.outdoor?clamp((a-.12)/.3,0,1):.45;
    const lights=sources(vis,map,k);if(!lights.length)return;
    const bw=Math.ceil(W),bh=Math.ceil(VH);
    if(!buffer||buffer.lw!==bw||buffer.lh!==bh)buffer=G.gfx.canvas(bw,bh);
    const key=[map.id,cx,cy,bw,bh,k.toFixed(2),lights.map(l=>[l.x,l.y,l.r,l.p.toFixed(2)].join(',')).join(';')].join(':');
    if(lightLayer&&lightKey===key){ctx.save();ctx.globalCompositeOperation='lighter';ctx.drawImage(lightLayer,cx,cy);ctx.restore();return;}
    const output=ctx;
    if(!lightLayer||lightLayer.lw!==bw||lightLayer.lh!==bh)lightLayer=G.gfx.canvas(bw,bh);
    ctx=lightLayer.getContext('2d');ctx.clearRect(0,0,bw,bh);ctx.save();ctx.translate(-cx,-cy);lightKey=key;
    const c=buffer.getContext('2d');
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(const l of lights){
      if(l.x+l.r<cx||l.x-l.r>cx+W||l.y+l.r<cy||l.y-l.r>cy+VH)continue;
      c.clearRect(0,0,bw,bh);c.save();c.translate(-cx,-cy);
      const gr=c.createRadialGradient(l.x,l.y,2,l.x,l.y,l.r);gr.addColorStop(0,`rgba(255,192,104,${l.p*.42})`);gr.addColorStop(.4,`rgba(244,156,69,${l.p*.17})`);gr.addColorStop(1,'rgba(255,160,70,0)');
      c.fillStyle=gr;c.fillRect(l.x-l.r,l.y-l.r,l.r*2,l.r*2);
      c.globalCompositeOperation='destination-out';c.fillStyle='#000';
      for(const o of vis){if(o.box&&Math.hypot(o.x-l.x,o.y-l.y)<l.r+Math.max(o.w||0,o.h||0))blockLight(c,l,o);}
      c.restore();ctx.drawImage(buffer,cx,cy);
      if(l.bulbY!=null){const g=ctx.createRadialGradient(l.x,l.bulbY,0,l.x,l.bulbY,7);g.addColorStop(0,`rgba(255,229,164,${l.p*.8})`);g.addColorStop(1,'rgba(255,187,87,0)');ctx.fillStyle=g;ctx.fillRect(l.x-7,l.bulbY-7,14,14);}
    }
    ctx.restore();
    ctx.restore();output.save();output.globalCompositeOperation='lighter';output.drawImage(lightLayer,cx,cy);output.restore();
  }
  G.fx.shadows=ground;
  return {ground,actor,draw,daylight,sources,enabled};
})();
