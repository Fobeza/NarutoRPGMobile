// Фоновые шиноби живут на слое крыш: бегут к краю, перепрыгивают проулок и продолжают маршрут.
// Это отдельные патрульные, поэтому они не дублируют сюжетных жителей и не мешают проходу на земле.
G.roofPatrol = (() => {
  function connection(a,b) {
    const inset=r=>({x0:r.x+5,x1:r.x+r.w-5,y0:r.y+6,y1:r.y+r.h-2});
    const A=inset(a),B=inset(b),clamp=G.util.clamp;
    const ax=clamp((B.x0+B.x1)/2,A.x0,A.x1),ay=clamp((B.y0+B.y1)/2,A.y0,A.y1);
    const bx=clamp(ax,B.x0,B.x1),by=clamp(ay,B.y0,B.y1);
    const x=clamp(bx,A.x0,A.x1),y=clamp(by,A.y0,A.y1),d=Math.hypot(x-bx,y-by);
    return d>=8&&d<=G.roofs.JUMP?{from:{x,y},to:{x:bx,y:by},distance:d}:null;
  }
  function build(map) {
    if(map._roofLife)return map._roofLife;
    const roofs=G.roofs.rects(map),graph=roofs.map(()=>[]);
    for(let i=0;i<roofs.length;i++)for(let j=i+1;j<roofs.length;j++){
      const link=connection(roofs[i],roofs[j]);if(!link)continue;
      graph[i].push({next:j,...link});graph[j].push({next:i,from:link.to,to:link.from,distance:link.distance});
    }
    const patrols=[],used=new Set(),anchors=['academy','market','hero_home','hokage_tower','clan_hyuga','ichiraku','teahouse','sasuke_home'];
    for(let i=0;i<anchors.length;i++){
      const landmark=map.buildings.find(b=>b.tplId===anchors[i]);if(!landmark)continue;
      const candidates=roofs.map((r,n)=>({r,n,d:Math.hypot(r.x-landmark.x,r.y-landmark.y)}))
        .filter(v=>graph[v.n].length&&!used.has(v.n)).sort((a,b)=>a.d-b.d);
      if(!candidates.length)continue;
      const {r,n}=candidates[0];used.add(n);
      patrols.push({id:'chunin',name:'Патрульный',x:r.x+r.w/2,y:r.y+r.h/2,dir:'right',anim:0,node:n,previous:-1,wait:0.3+i*0.45,serial:i,moving:false});
    }
    return map._roofLife={roofs,graph,patrols};
  }
  function update(world,dt) {
    if(!world.map.outdoor)return;
    const life=build(world.map);
    for(const p of life.patrols){
      if(p.jump){
        const j=p.jump;j.t=Math.min(j.dur,j.t+dt);const k=j.t/j.dur;
        p.x=j.x0+(j.x1-j.x0)*k;p.y=j.y0+(j.y1-j.y0)*k;
        if(k>=1){p.jump=null;p.previous=p.node;p.node=p.route.next;p.route=null;p.wait=0.3;}
        continue;
      }
      if(p.wait>0){p.wait-=dt;p.moving=false;continue;}
      if(!p.route){
        const all=life.graph[p.node],options=all.filter(n=>n.next!==p.previous);
        const pool=options.length?options:all;if(!pool.length)continue;
        p.route=pool[(p.serial+Math.floor(world.time/7))%pool.length];
      }
      const r=p.route,dx=r.from.x-p.x,dy=r.from.y-p.y,d=Math.hypot(dx,dy),speed=82*dt;
      p.dir=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';
      if(d<=Math.max(1,speed)){
        p.x=r.from.x;p.y=r.from.y;
        const jdx=r.to.x-p.x,jdy=r.to.y-p.y;p.dir=Math.abs(jdx)>Math.abs(jdy)?jdx>0?'right':'left':jdy>0?'down':'up';
        p.jump={t:0,dur:0.32+r.distance/310,x0:p.x,y0:p.y,x1:r.to.x,y1:r.to.y,h:12+r.distance*0.18};
      }else{p.x+=dx/d*speed;p.y+=dy/d*speed;p.moving=true;p.anim+=dt*11;}
    }
  }
  function draw(ctx,world,cx,cy,w,h) {
    if(!world.map.outdoor)return;
    const life=build(world.map),night=G.game.isNight();
    for(const p of life.patrols){
      if(night&&p.serial%2)continue;
      if(p.x<cx-24||p.x>cx+w+24||p.y<cy-40||p.y>cy+h+40)continue;
      const j=p.jump,lift=j?Math.sin(Math.PI*j.t/j.dur)*j.h:0;
      G.shade.shadow(ctx,p.x+1,p.y-1,5,1.5,0.28);
      if(j){ctx.fillStyle='rgba(228,237,214,0.35)';for(let i=1;i<4;i++)ctx.fillRect(p.x-(j.x1-j.x0)*0.03*i-2,p.y-lift-(j.y1-j.y0)*0.03*i-8,3,0.5);}
      G.chars.draw(ctx,p.id,p.dir,j?1:p.moving?G.chars.WALK[Math.floor(p.anim)%4]:0,p.x,p.y-lift);
    }
  }
  return {build,connection,update,draw};
})();
