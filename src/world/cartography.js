// Единая подложка и знаки для большой карты и мини-карты. Отрисовка не меняет геометрию мира.
G.cartography=(()=>{
  const R=8,T=16,ink='#172d2a';
  const colors={hero:'#fff2cf',home:'#9ddb9d',quest:'#ffb65b',offer:'#ffdf73',shop:'#a8d8f0',food:'#efb18d',training:'#d7b4ec',friend:'#a4dfbd',place:'#ded3b7',target:'#ff8d6f'};
  function atlas(m){
    if(G.storage.settings.mapDetail==='simple')return m.overview();
    const season=G.adventure?.season().name||'',key=season;
    if(m._atlas?.key===key)return m._atlas.image;
    const c=G.gfx.canvas(m.w*R,m.h*R,true),ctx=c.getContext('2d'),ID=G.tiles.ID;
    for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++){
      const id=m.get(x,y);ctx.fillStyle=G.tiles.MAPCOL[id]||'#7d8569';ctx.fillRect(x*R,y*R,R,R);
      if([ID.PATH,ID.MAINROAD,ID.COBBLE,ID.STONE,ID.BRICK,ID.PLAZA].includes(id)){
        ctx.fillStyle='rgba(245,225,178,.19)';ctx.fillRect(x*R,y*R,R,1);ctx.fillStyle='rgba(71,65,48,.15)';ctx.fillRect(x*R+(y%2?1:3),y*R,1,R);
      }else if(id===ID.WATER){
        ctx.fillStyle='#a9d6d4';if(m.get(x,y-1)!==id)ctx.fillRect(x*R,y*R,R,1);if(m.get(x-1,y)!==id)ctx.fillRect(x*R,y*R,1,R);
        if((x+y*3)%7===0){ctx.fillStyle='#78b7cf';ctx.fillRect(x*R+1,y*R+2,2,1);}
      }else if(m.outdoor&&G.util.hash2(x,y,57)>.65){ctx.fillStyle=season==='Зима'?'#d9e2d0':'rgba(47,83,40,.18)';ctx.fillRect(x*R+1,y*R+2,1,1);}
    }
    // Те же крыши, деревья, ограды, цветы и мостки, которые игрок видит во время прогулки.
    const objects=m.objects.slice().sort((a,b)=>(a.layer==='floor'?-1e6:a.sortY??a.y)-(b.layer==='floor'?-1e6:b.sortY??b.y));
    for(const o of objects){
      if(o.img){const image=G.adventure?G.adventure.seasonalImage(o,m):o.img;ctx.drawImage(image,(o.x+o.ox)*R/T,(o.y+o.oy)*R/T,o.w*R/T,o.h*R/T);}
      else if(o.anim){ctx.save();ctx.scale(R/T,R/T);G.world.drawAnim(ctx,o,0);ctx.restore();}
    }
    m._atlas={key,image:c};return c;
  }
  function pin(ctx,x,y,kind,o={}){
    const small=!!o.small,s=small?1:(G.storage.settings.mapMarkerSize||1),r=small?2:5*s,col=o.closed?'#a5aba4':colors[kind]||colors.place;
    ctx.save();ctx.translate(Math.round(x),Math.round(y));
    if(kind==='hero'){
      const v=G.actors.DIRV[o.dir||'up'];ctx.rotate(Math.atan2(v[1],v[0])+Math.PI/2);ctx.fillStyle=ink;ctx.beginPath();ctx.moveTo(0,-r-2);ctx.lineTo(r+1,r+1);ctx.lineTo(0,r-1);ctx.lineTo(-r-1,r+1);ctx.closePath();ctx.fill();ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r-1,r-1);ctx.lineTo(0,r-2);ctx.lineTo(-r+1,r-1);ctx.closePath();ctx.fill();ctx.restore();return;
    }
    ctx.fillStyle=ink;ctx.beginPath();ctx.arc(0,0,r+1.5,0,Math.PI*2);ctx.fill();ctx.fillStyle=col;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
    if(small){ctx.fillStyle=ink;if(kind==='target'||kind==='quest')ctx.fillRect(-.5,-1.5,1,3);else if(kind==='home')ctx.fillRect(-1,0,2,1);ctx.restore();return;}
    ctx.scale(s,s);ctx.fillStyle=ink;ctx.strokeStyle=ink;ctx.lineWidth=1;
    if(kind==='quest'||kind==='offer'){ctx.fillRect(-.5,-3,1,3);ctx.fillRect(-.5,1.5,1,1);}
    else if(kind==='home'){ctx.beginPath();ctx.moveTo(-3,0);ctx.lineTo(0,-3);ctx.lineTo(3,0);ctx.closePath();ctx.fill();ctx.fillRect(-2,0,4,3);ctx.fillStyle=col;ctx.fillRect(-.5,1,1,2);}
    else if(kind==='shop'){ctx.strokeRect(-2.5,-1.5,5,4);ctx.beginPath();ctx.arc(0,-1.5,1.5,Math.PI,Math.PI*2);ctx.stroke();}
    else if(kind==='food'){ctx.beginPath();ctx.arc(0,-1,3,0,Math.PI);ctx.fill();ctx.fillRect(-2,2,4,1);ctx.fillRect(-2,-3,4,.7);}
    else if(kind==='friend'){ctx.beginPath();ctx.arc(0,-1.8,1.3,0,Math.PI*2);ctx.fill();ctx.fillRect(-2,.5,4,2);}
    else if(kind==='training'){ctx.fillRect(-.5,-3,1,6);ctx.fillRect(-3,-.5,6,1);ctx.fillRect(-1.5,-1.5,3,3);}
    else if(kind==='target'){ctx.strokeRect(-2.5,-2.5,5,5);ctx.fillRect(-.5,-.5,1,1);}
    else{ctx.fillRect(-2,-2,4,4);ctx.fillStyle=col;ctx.fillRect(-1,-1,2,2);}
    if(o.count>1){
      const digits=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'],d=digits[Math.min(9,o.count)];
      ctx.fillStyle=ink;ctx.fillRect(2,-9,7,8);ctx.fillStyle='#fff3d4';for(let i=0;i<15;i++)if(d[i]==='1')ctx.fillRect(4+i%3,-8+(i/3|0),1,1);
    }
    if(o.closed){ctx.strokeStyle='#6a6760';ctx.beginPath();ctx.moveTo(-4,4);ctx.lineTo(4,-4);ctx.stroke();}
    ctx.restore();
  }
  function cluster(points,radius=13){
    const out=[];
    for(const p of points.slice().sort((a,b)=>(b.priority||0)-(a.priority||0))){
      const near=out.find(q=>Math.hypot(q.x-p.x,q.y-p.y)<radius);
      if(near)near.items.push(p);else out.push({...p,items:[p]});
    }return out;
  }
  function minimap(ctx,w,W){
    if(G.storage.settings.minimap===false)return;
    const S=56,x0=W-S-4,y0=31,m=w.map,p=w.player;
    G.ui.panel(ctx,x0-3,y0-3,S+6,S+6,'plank');ctx.save();ctx.beginPath();ctx.rect(x0,y0,S,S);ctx.clip();ctx.fillStyle=ink;ctx.fillRect(x0,y0,S,S);
    const sc=m.outdoor?1.5:Math.max(1,Math.floor(Math.min((S-4)/m.w,(S-4)/m.h))),ox=m.outdoor?x0+S/2-p.x/T*sc:x0+(S-m.w*sc)/2,oy=m.outdoor?y0+S/2-p.y/T*sc:y0+(S-m.h*sc)/2;
    ctx.drawImage(atlas(m),Math.round(ox),Math.round(oy),m.w*sc,m.h*sc);
    const pos=(x,y)=>[Math.round(ox+x/T*sc),Math.round(oy+y/T*sc)],inside=(x,y)=>x>x0+3&&y>y0+3&&x<x0+S-3&&y<y0+S-3;
    if(w.trail){ctx.strokeStyle='#b4e9e6';ctx.lineWidth=1;ctx.beginPath();w.trail.pts.forEach(([x,y],i)=>{const [sx,sy]=pos(x*T+8,y*T+10);if(i)ctx.lineTo(sx,sy);else ctx.moveTo(sx,sy);});ctx.stroke();}
    const points=[];
    for(const b of m.buildings){const kind=b.tplId==='hero_home'?'home':G.SHOPS[b.tplId]?(b.tplDef?.cat==='food'?'food':'shop'):null;if(!b.door||!kind)continue;const [x,y]=pos(b.door.tx*T+8,(b.door.ty+1)*T);if(inside(x,y))points.push({x,y,kind,priority:kind==='home'?4:1});}
    for(const n of w.npcs){const ic=G.quests.iconFor(n.id),kind=ic?(ic==='!'?'offer':'quest'):(G.state.vars['friend_'+n.id]||0)>=2?'friend':null;if(!kind)continue;const [x,y]=pos(n.x,n.y);if(inside(x,y))points.push({x,y,kind,priority:3});}
    for(const q of cluster(points,6).slice(0,12))pin(ctx,q.x,q.y,q.kind,{small:true});
    const target=w.navHop();if(target){const [x,y]=pos(target.h.x,target.h.y),xx=G.util.clamp(x,x0+3,x0+S-4),yy=G.util.clamp(y,y0+3,y0+S-4);pin(ctx,xx,yy,'target',{small:true});if(xx!==x||yy!==y){ctx.fillStyle=colors.target;ctx.fillRect(xx+Math.sign(x-xx)*2,yy+Math.sign(y-yy)*2,1,1);}}
    const [px,py]=pos(p.x,p.y);pin(ctx,px,py,'hero',{small:true,dir:p.dir});ctx.restore();
    G.font.small.draw(ctx,'С',x0+S-5,y0+2,{color:'#f4e7c2',outline:ink,align:'center'});
  }
  return{atlas,pin,cluster,minimap,colors};
})();
