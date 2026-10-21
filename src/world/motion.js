// Анимации прогулки: меняется рисунок, координаты, коллизии и сохранение остаются прежними.
G.worldMotion = (() => {
  const trees=new Set(['tree','pine','sakura','maple','ginkgo','bamboo','bush']);
  const flowers=new Set(['flowerbox','flowerpot','flowerbed','lavender','sunflower','pots','bonsai']);
  const enabled=w=>G.storage.settings.fx!==false&&w.map.id==='konoha';
  const phase=(t,seed=0,period=1)=>((t+seed)%period+period)%period/period;
  function gesture(w,n,kind,duration){
    n._gesture={kind,until:w.time+duration};
    if(kind==='wave'&&!n.moving){const dx=w.player.x-n.x,dy=w.player.y-n.y;n.dir=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';}
  }
  function actor(ctx,w,n,frame,lift){
    if(G.storage.settings.fx===false||n.roof||n.jump)return false;
    ctx.save();
    const sheet=G.chars.sheet(n.id,n._look),sy=G.chars.DIRS.indexOf(n.dir)*20,sx=frame*16;
    // Редкий короткий жест свободного жителя; занятие и разговор важнее.
    const idle=phase(w.time,n.x*.17+n.y*.09,19);
    const spontaneous=enabled(w)&&n!==w.player&&!n.moving&&!n._street&&!n._daily?.busy&&idle<.075;
    const g=n._gesture,gesturing=g&&g.until>w.time&&!n.moving&&(!n._daily?.busy||g.kind==='wave')&&n.dir!=='up';
    const wave=gesturing&&g.kind==='wave'&&n.dir==='down'&&['villager_m','villager_f'].includes(n.id);
    const stride=n.moving?Math.abs(Math.sin(n.anim*Math.PI))*.65:0;
    const breath=!n.moving&&!n._street?Math.sin(w.time*2.4+(n._daily?.seed||n.x))*.45:0;
    const x=Math.round(n.x-8),y=Math.round(n.y-19-lift);
    if(wave){
      // Поворачиваем собственную руку спрайта вместе с рукавом. В исходной позе её не оставляем.
      const arm=G.chars.STY[n.id]?.body==='fat'?12:11;
      ctx.drawImage(sheet,sx,sy,16,11,x,y,16,11);
      ctx.drawImage(sheet,sx,sy+11,arm,6,x,y+11,arm,6);
      if(arm+3<16)ctx.drawImage(sheet,sx+arm+3,sy+11,16-arm-3,6,x+arm+3,y+11,16-arm-3,6);
      ctx.drawImage(sheet,sx,sy+17,16,3,x,y+17,16,3);
      ctx.save();ctx.translate(x+arm+1,y+11);ctx.rotate(-1.9+Math.sin(w.time*8)*.18);ctx.drawImage(sheet,sx+arm,sy+11,3,6,-1,0,3,6);ctx.restore();
    }else{
      // В профиль и у детей используем небольшое движение из их собственного листа кадров.
      const upper=gesturing||spontaneous?G.chars.WALK[Math.floor(w.time*4)%4]*16:sx;
      ctx.drawImage(sheet,upper,sy,16,16,x,y-breath-stride,16,16+breath+stride);
      ctx.drawImage(sheet,sx,sy+16,16,4,x,y+16,16,4);
    }
    if(enabled(w)&&n.moving&&!n._street){
      const rain=G.life.raining(),id=w.map.get(n.x/16|0,n.y/16|0),p=phase(n.anim,0,2);
      if(rain){ctx.strokeStyle='rgba(188,213,220,.5)';ctx.lineWidth=.6;ctx.beginPath();ctx.ellipse(n.x,n.y-1,1+p*5,.5+p*1.7,0,0,Math.PI*2);ctx.stroke();}
      else if([G.tiles.ID.PATH,G.tiles.ID.DIRT,G.tiles.ID.SAND].includes(id)){
        ctx.save();ctx.globalAlpha*=.4*(1-p);ctx.fillStyle='#dbc399';ctx.fillRect(n.x-5-p*3,n.y-p*3,2,1);ctx.fillRect(n.x+3+p*2,n.y-2-p*2,1,1);ctx.restore();
      }
    }
    ctx.restore();return true;
  }
  function petPose(w,a){
    if(a.pet>0)return'happy';if(a.moving)return'walk';
    const p=phase(w.time,a.serial*3.7,12);
    return a.type==='cat'?(p<.2?'groom':p<.38?'stretch':p<.65?'sit':'look'):(p<.32?'sniff':p<.5?'scratch':'look');
  }
  function animal(ctx,w,a){
    if(!enabled(w)||a.type==='bird')return false;
    const cat=a.type==='cat',pose=petPose(w,a),t=w.time,ink='#4b5049';
    const coat=cat?['#cf965a','#d7d4c4','#5a6170'][a.coat||0]:'#b68a62',dark=cat?'#786454':'#73543d';
    const stretch=pose==='stretch',sit=pose==='sit'||pose==='groom'||pose==='scratch',sniff=pose==='sniff';
    const breathe=Math.sin(t*3+a.serial)*.4,bx=stretch?-8:sit?-4:-6,bw=stretch?15:sit?7:11,by=(stretch?-5:sit?-9:-7)+breathe;
    const hx=stretch?6:sniff?4:2,hy=(stretch?-8:sniff?-7:-11)+breathe;
    ctx.fillStyle=ink;ctx.fillRect(bx-1,by-1,bw+2,sit?10:8);ctx.fillRect(hx-1,hy-1,8,7);
    ctx.fillStyle=coat;ctx.fillRect(bx,by,bw,sit?8:6);ctx.fillRect(hx,hy,6,5);
    ctx.fillStyle=dark;ctx.fillRect(bx+1,by+(sit?6:4),bw-2,2);
    ctx.fillStyle=cat?(a.coat===2?'#7a8290':'#ead2ac'):'#d9b08a';ctx.fillRect(bx+1,by,bw-2,1);ctx.fillRect(hx+1,hy,4,1);
    if(cat){ctx.fillStyle=ink;ctx.fillRect(hx-1,hy-3,3,4);ctx.fillRect(hx+4,hy-3,3,4);ctx.fillStyle=coat;ctx.fillRect(hx,hy-2,2,3);ctx.fillRect(hx+4,hy-2,2,3);}
    else{ctx.fillStyle=dark;ctx.fillRect(hx-1,hy,2,5);ctx.fillRect(hx+5,hy+1,2,4);ctx.fillStyle='#dfc3a1';ctx.fillRect(hx+4,hy+4,4,2);}
    const step=a.moving?Math.sin(a.anim*2)*1.5:0;
    ctx.fillStyle=coat;ctx.fillRect(stretch?-7:-4,-2+step,2,3);ctx.fillRect(stretch?8:2,-2-step,2,3);
    ctx.fillStyle=dark;ctx.fillRect(stretch?-7:-4,step,2,1);ctx.fillRect(stretch?8:2,-step,2,1);
    ctx.fillStyle=cat?'#d7c2a3':'#ead1b4';ctx.fillRect(hx+4,hy+3,3,2);if(!cat)ctx.fillRect(bx+2,by+2,2,2);
    if(pose==='groom'||pose==='scratch'){ctx.fillStyle=coat;ctx.fillRect(3+Math.sin(t*12)*2,-7,2,4);ctx.fillRect(3,-9+Math.sin(t*12),3,2);}
    ctx.strokeStyle=dark;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(bx,-3);ctx.quadraticCurveTo(bx-5,-4,bx-4+Math.sin(t*(pose==='happy'?13:3))*2,cat?-9:-6+Math.sin(t*10)*3);ctx.stroke();
    ctx.fillStyle=pose==='happy'||pose==='groom'?'#7c6d61':'#242e2b';ctx.fillRect(hx+2,hy+2,1,1);ctx.fillStyle='#b57975';ctx.fillRect(hx+6,hy+4,1,1);
    if(!cat&&pose==='happy')ctx.fillRect(hx+5,hy+6+Math.sin(t*10)*.5,2,2);
    if(a.coat===0&&cat){ctx.fillStyle=dark;ctx.fillRect(bx+3,by,1,3);ctx.fillRect(bx+6,by,1,2);}
    return true;
  }
  function object(ctx,w,o,img){
    if(!enabled(w)||o.isBuilding)return false;
    const x=o.x+o.ox,y=o.y+o.oy,t=w.time,wind=Math.sin(t*1.7+o.x*.017)+Math.sin(t*2.6+o.y*.02)*.3;
    const flower=flowers.has(o.kind)||o.kind?.startsWith('fl_');
    if(trees.has(o.kind)||flower){
      const crown=Math.max(2,Math.floor(o.h*(trees.has(o.kind)?.68:.55))),step=trees.has(o.kind)?5:2;
      ctx.drawImage(img,0,crown,o.w,o.h-crown,x,y+crown,o.w,o.h-crown);
      for(let row=0;row<crown;row+=step){const h=Math.min(step,crown-row),dx=wind*(1-row/crown)*(trees.has(o.kind)?1.25:.8);ctx.drawImage(img,0,row,o.w,h,x+dx,y+row,o.w,h);}
      const hour=G.state.vars.min/60;
      if(flower&&hour>=8&&hour<18&&!G.life.raining()&&G.adventure.season().name!=='Зима'&&G.util.hash2(o.x,o.y,21)>.65){
        const q=t*.9+o.x,bx=o.x+Math.sin(q)*11,by=y-6+Math.sin(q*1.7)*4,wing=Math.sin(t*22)>0?3:1;
        ctx.fillStyle='#eac47d';ctx.fillRect(bx-wing,by,wing,2);ctx.fillStyle='#b5c9e0';ctx.fillRect(bx+1,by-1,wing,2);ctx.fillStyle='#705442';ctx.fillRect(bx,by,1,3);
      }
      return true;
    }
    if(o.kind==='redlantern'||o.kind==='lamp'){
      const head=o.kind==='lamp'?11:10;
      ctx.drawImage(img,0,head,o.w,o.h-head,x,y+head,o.w,o.h-head);ctx.save();ctx.translate(x+o.w/2,y+head);ctx.rotate(wind*.035);ctx.drawImage(img,0,0,o.w,head,-o.w/2,-head,o.w,head);ctx.restore();return true;
    }
    if(o.kind==='pond'){
      ctx.drawImage(img,x,y);ctx.fillStyle='#2a6aa8';ctx.fillRect(x+9,y+9,4,2);ctx.fillRect(x+19,y+12,4,2);
      const p=phase(t,o.x*.1,3.6);ctx.save();ctx.globalAlpha*=.65*(1-p);ctx.strokeStyle='#c7e6db';ctx.lineWidth=.65;ctx.beginPath();ctx.ellipse(x+17,y+10,1+p*7,.5+p*3,0,0,Math.PI*2);ctx.stroke();ctx.restore();
      const q=t*.55+o.x;ctx.fillStyle='#f08a3a';ctx.fillRect(x+14+Math.sin(q)*6,y+8+Math.cos(q)*2,3,1.5);ctx.fillStyle='#f4ecd8';ctx.fillRect(x+14+Math.sin(q+2)*7,y+11+Math.cos(q+2)*2,3,1.5);return true;
    }
    return false;
  }
  function ground(ctx,w){
    if(!enabled(w))return;
    const t=w.time,rain=G.life.raining(),water=G.tiles.ID.WATER,cx=w.cam.x,cy=w.cam.y,W=G.screen.W/(w.z||1),H=w.viewH()/(w.z||1);let count=0;
    for(let ty=Math.max(0,Math.floor(cy/32)*2);ty<Math.min(w.map.h,(cy+H)/16+1);ty+=2)for(let tx=Math.max(0,Math.floor(cx/32)*2);tx<Math.min(w.map.w,(cx+W)/16+1);tx+=2){
      const seed=G.util.hash2(tx,ty,82),isWater=w.map.get(tx,ty)===water;
      if(seed<.65||(!isWater&&(!rain||w.map.solidTile(tx,ty)))||++count>24)continue;
      const p=phase(t,seed*4,rain?1.1:3.5),x=tx*16+8,y=ty*16+10;
      if(isWater&&!rain&&seed>.87){const q=t*.8+seed*12,fishX=x+Math.sin(q)*4,fishY=y+Math.cos(q)*2;ctx.save();ctx.globalAlpha*=.65;ctx.fillStyle=seed>.94?'#e0cdb0':'#dd9c66';ctx.fillRect(fishX,fishY,3,1);ctx.fillRect(fishX+(Math.cos(q)>0?-1:3),fishY+Math.sin(t*9),1,1);ctx.restore();}
      ctx.save();ctx.globalAlpha*=Math.sin(p*Math.PI)*(isWater?.32:.4);ctx.strokeStyle=isWater?'#d5ece4':'#becbd0';ctx.lineWidth=.65;ctx.beginPath();ctx.ellipse(x,y,1+p*5,.5+p*2,0,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
  }
  // Частицы привязаны к объектам, а не к камере: при прогулке не скачут.
  // Только видимые объекты и фиксированный бюджет — без накопления в сохранении.
  function atmosphere(ctx,w,vis){
    if(!enabled(w))return;
    const t=w.time,rain=G.life.raining(),hour=G.state.vars.min/60;
    const night=hour>=19||hour<5,season=G.adventure.season().name;
    let budget=36;
    for(const o of vis){
      if(budget<=0)break;
      const seed=G.util.hash2(o.x,o.y,143),x=o.x+(o.ox||0),y=o.y+(o.oy||0);
      if(o.spr?.chimney&&hour>=5&&hour<23){
        const c=o.spr.chimney;
        for(let i=0;i<3&&budget>0;i++,budget--){
          const p=phase(t,seed*5+i*1.6,4.8),size=2+p*4;
          ctx.save();ctx.globalAlpha*=Math.sin(p*Math.PI)*(rain?.12:.24);
          ctx.fillStyle='#d7d5d0';ctx.beginPath();
          ctx.ellipse(x+c.x+p*(rain?19:10)+Math.sin(t+p*4),y+c.y-p*24,size,size*.65,0,0,Math.PI*2);ctx.fill();ctx.restore();
        }
      }
      if(rain||season==='Зима')continue;
      if(night&&['bush','pond','lavender','flowerbed'].includes(o.kind)){
        for(let i=0;i<2&&budget>0;i++,budget--){
          const q=t*.8+seed*30+i*3,xp=o.x+Math.sin(q)*12,yp=y+5+Math.cos(q*.7)*6;
          const glow=Math.max(0,Math.sin(t*1.8+seed*20+i*2));
          ctx.save();ctx.globalAlpha*=glow*.18;ctx.fillStyle='#cde88b';ctx.fillRect(xp-2,yp-2,5,5);
          ctx.globalAlpha*=4;ctx.fillStyle='#eef5ab';ctx.fillRect(xp,yp,1,1);ctx.restore();
        }
      }else if(!night&&['tree','sakura','maple','ginkgo'].includes(o.kind)){
        for(let i=0;i<2&&budget>0;i++,budget--){
          const p=phase(t,seed*9+i*4.5,9),xp=x+o.w*.45+p*20+Math.sin(t*1.8+seed*10+i)*4,yp=y+8+p*Math.max(16,o.h-8);
          ctx.save();ctx.globalAlpha*=Math.sin(p*Math.PI)*.8;
          ctx.fillStyle=o.kind==='sakura'?'#efb6ca':season==='Осень'?'#cf9652':'#9dbb69';
          ctx.fillRect(xp,yp,Math.sin(t*5+i)>0?3:1,1);ctx.fillRect(xp+1,yp+1,1,1);ctx.restore();
        }
      }
    }
  }
  return{enabled,gesture,actor,petPose,animal,object,ground,atmosphere};
})();
