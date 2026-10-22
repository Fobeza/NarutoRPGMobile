// Повседневная жизнь Конохи. Занятия используют существующих жителей; животные не блокируют проходы.
G.villageDaily = (() => {
  const D=G.VILLAGE_DAILY,T=16,plants=new Set(['flowerpot','flowerbox','planter','pots','flowerbed','lavender','sunflower','bonsai']);
  const active=w=>w.map.id==='konoha'&&G.state.started&&!!(G.state.flags.hosp_done||G.state.flags.day2_intro);
  const fx=()=>G.storage.settings.fx!==false;
  const animalScale=a=>a.type==='cat'?.5:a.type==='dog'?.55:1;
  const hash=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))>>>0;return h;};
  const generic=n=>!!n.uid&&!n.shop&&!G.SCHED[n.id]&&!G.FRIENDS[n.id]&&['villager_m','villager_f','kid_m','kid_f','grandma'].includes(n.id);
  function clear(w){w._dailyLife=null;}
  function safe(m,x,y){return !m.blockedRect({x:x-5,y:y-5,w:10,h:5});}
  function visibleSpot(m,x,y){
    const r={x:x-8,y:y-14,w:16,h:16};
    return !m.query(r).some(o=>(o.isBuilding||['tree','pine','sakura','maple','ginkgo','bush','planter'].includes(o.kind))&&o.sortY>=y&&G.util.rectsOverlap(r,m.drawRect(o)));
  }
  function ensure(w){
    if(!active(w)){clear(w);return null;}
    const m=w.map;
    if(!m._dailyLife||m._dailyLife.owner!==G.state){
      const state={owner:G.state,animals:[],greet:2,chat:4,workTalk:2.5,sound:7,tracks:[],weather:null};let index=0;
      for(const def of D.animals){
        const b=m.buildings.find(b=>b.tplId===def.tpl)||m.spots?.[def.tpl];if(!b)continue;
        for(let i=0;i<(def.count||1);i++){
          const p=G.world.freeTile(m,b.tx+def.dx+i%2,b.ty+b.th+def.dy+Math.floor(i/2));if(!p)continue;
          let x=p[0]*T+8,y=p[1]*T+12;
          // зверь не садится на жителя: в плотных кварталах у лавок всегда кто-то стоит
          const crowded=(qx,qy)=>m.npcs.some(n=>Math.hypot(n.x-qx,n.y-qy)<36);
          if(def.type!=='bird'&&(!visibleSpot(m,x,y)||crowded(x,y))){
            search:for(let pass=0;pass<2;pass++)for(let r=1;r<=4;r++)for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++){
              if(Math.abs(dx)+Math.abs(dy)!==r)continue;const nx=(p[0]+dx)*T+8,ny=(p[1]+dy)*T+12;
              if(safe(m,nx,ny)&&visibleSpot(m,nx,ny)&&(pass||!crowded(nx,ny))&&G.nav.path(m,x,y,nx,ny,160)?.length){x=nx;y=ny;break search;}
            }
          }
          const a={...def,x,y,home:{x,y},serial:index++,dir:'right',timer:1+i*.5,alpha:0,moving:false,path:[],anim:0,pet:0,flight:null,_dailyAnimal:true};
          state.animals.push(a);
        }
      }
      m._dailyLife=state;
    }
    return w._dailyLife=m._dailyLife;
  }
  function animalTarget(w,a,away=false){
    const m=w.map,p=w.player,seed=G.util.rng(a.serial*131+Math.floor(w.time*3)+71),candidates=[];
    for(let i=0;i<18;i++){
      const x=a.home.x+seed.int(-4,4)*T,y=a.home.y+seed.int(-3,3)*T;
      if(!safe(m,x,y)||Math.hypot(x-a.x,y-a.y)<12)continue;
      const score=away?Math.hypot(x-p.x,y-p.y):seed()*100;
      candidates.push({x,y,score});
    }
    candidates.sort((a,b)=>b.score-a.score);
    for(const q of candidates){const path=G.nav.path(m,a.x,a.y,q.x,q.y,500);if(path&&path.length>1)return{...q,path:path.slice(1)};}
    return null;
  }
  function awakeNow(a){const hour=G.state.vars.min/60;return a.type==='bird'?!G.life.raining()&&hour>=6&&hour<19:hour>=6&&hour<23;}
  function updateAnimal(w,a,dt){
    const rain=G.life.raining(),bird=a.type==='bird',awake=awakeNow(a);
    a.alpha=G.util.clamp(a.alpha+(awake?dt*1.7:-dt*1.4),0,1);a.pet=Math.max(0,a.pet-dt);
    if(!a.alpha)return;
    if(a.flight){const j=a.flight;j.t=Math.min(j.dur,j.t+dt);const k=j.t/j.dur;a.x=j.x0+(j.x1-j.x0)*k;a.y=j.y0+(j.y1-j.y0)*k;if(k===1){a.flight=null;a.timer=3;}return;}
    if(bird&&awake&&Math.hypot(w.player.x-a.x,w.player.y-a.y)<30&&!w.player.roof&&!w.player.jump){
      const dst=animalTarget(w,a,true);if(dst){a.flight={x0:a.x,y0:a.y,x1:dst.x,y1:dst.y,t:0,dur:1.1+a.serial%3*.15,h:24+a.serial%3*7};a.dir=dst.x>a.x?'right':'left';}return;
    }
    if(rain){a.path=[];a.moving=false;return;}
    if(a.pet>0&&a.type!=='bird'){a.moving=false;return;}
    if(a.path.length){
      const q=a.path[0],x=q[0]*T+8,y=q[1]*T+12,dx=x-a.x,dy=y-a.y,d=Math.hypot(dx,dy),sp=(bird?10:a.type==='dog'?24:18)*dt;
      if(d<1){a.path.shift();if(!a.path.length){a.timer=3+a.serial%5;a.moving=false;}return;}
      const nx=a.x+dx/d*Math.min(d,sp),ny=a.y+dy/d*Math.min(d,sp);
      if(safe(w.map,nx,ny)&&!w.others.some(n=>Math.hypot(n.x-nx,n.y-ny)<10)){a.x=nx;a.y=ny;a.moving=true;a.anim+=dt*(bird?5:8);a.dir=dx>=0?'right':'left';}
      else {a.path=[];a.moving=false;a.timer=2;}
    }else{
      a.moving=false;a.timer-=dt;
      if(a.timer<=0){const q=animalTarget(w,a);a.path=q?q.path:[];a.timer=3;}
    }
  }
  function daily(n){if(!n._daily||n._daily.owner!==G.state){const seed=hash(n.uid);n._daily={owner:G.state,seed,cooldown:.6+(seed%30)/10,busy:0,role:'parcel',phase:0,path:[],center:{x:n.x,y:n.y}};}return n._daily;}
  const kid=n=>n.id==='kid_m'||n.id==='kid_f';
  // свободный сосед рядом: стоит, не занят, не идёт по делам, той же «породы» (ребёнок к ребёнку, взрослый к взрослому)
  function partnerFor(w,n,maxD){
    return w.npcs.find(o=>o!==n&&generic(o)&&kid(o)===kid(n)&&!o.moving&&!o._routePath?.length&&!(o._daily?.busy>0)&&!o._daily?.path?.length
      &&Math.hypot(o.x-n.x,o.y-n.y)<maxD&&Math.hypot(o.x-n.x,o.y-n.y)>12&&Math.abs(o.y-n.y)<24);
  }
  // парное занятие: оба заняты одинаково долго и смотрят друг на друга
  function pair(w,n,o,role){
    const a=daily(n),b=daily(o),busy=role==='chat'?8+a.seed%5:9+a.seed%4;
    a.partner=o;b.partner=n;a.lead=true;b.lead=false;a.busy=b.busy=busy;b.role=role;b.phase=0;b.path=[];o.moving=false;o.path=null;
    n.dir=n.x<o.x?'right':'left';o.dir=o.x<n.x?'right':'left';
    if(role==='chat'&&G.worldMotion){G.worldMotion.gesture(w,n,'talk',busy);G.worldMotion.gesture(w,o,'talk',busy);}
    return role;
  }
  function roleFor(w,n,seed){
    const hour=G.state.vars.min/60,d=n._daily;d.partner=null;d.lead=false;
    if(kid(n)){
      const o=partnerFor(w,n,52);
      if(o)return pair(w,n,o,seed%2?'catch':'tag');   // мяч или догонялки — вдвоём
      return'play';
    }
    if(hour<8&&seed%2)return'exercise';                      // утренняя зарядка во дворе
    const plant=w.map.query({x:n.x-26,y:n.y-26,w:52,h:52}).find(o=>plants.has(o.kind)&&Math.hypot(o.x-n.x,o.y-n.y)<27);
    if(plant&&!G.life.raining()){d.plant=plant;return'water';}
    if(seed%3===0){const o=partnerFor(w,n,40);if(o)return pair(w,n,o,'chat');}   // соседи заговорились у калитки
    if(hour>=15&&hour<18&&seed%4===1)return'tea';
    return hour<11?'sweep':['sweep','read','parcel'][seed%3];
  }
  function tickNpc(w,n,dt){
    if(!active(w)||!generic(n))return false;
    const d=daily(n);d.phase+=dt;
    if(n._routePath?.length){d.busy=0;d.path=[];return false;}
    const hour=G.state.vars.min/60;
    if(G.life.raining()||hour<6||hour>=20){if(d.path.length){n.moving=false;n.anim=0;}d.busy=0;d.path=[];return false;}
    // пара распалась (партнёр ушёл или уступил дорогу герою) — занятие заканчивается
    if(d.partner&&d.busy>0&&!(d.partner._daily?.busy>0)){d.busy=0;d.path=[];d.partner=null;n.moving=false;d.cooldown=2;return true;}
    if(d.role==='tag'&&d.busy>0&&d.path.length){d.busy=Math.max(0,d.busy-dt);if(!d.busy){d.path=[];n.moving=false;d.cooldown=3;return true;}}
    if(d.path.length){
      const q=d.path[0],x=q[0]*T+8,y=q[1]*T+12,dx=x-n.x,dy=y-n.y,distance=Math.hypot(dx,dy),speed=(n.id.startsWith('kid_')?42:24)*dt;
      if(distance<1){d.path.shift();if(!d.path.length){n.moving=false;d.cooldown=1;d.wantWalk=false;}return true;}
      n.dir=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';
      const before={x:n.x,y:n.y};G.actors.move(w.map,n,dx/distance*Math.min(speed,distance),dy/distance*Math.min(speed,distance),w.others);
      n.moving=Math.hypot(n.x-before.x,n.y-before.y)>.01;n.anim+=dt*(n.id.startsWith('kid_')?9:6);
      d.stuck=n.moving?0:(d.stuck||0)+dt;if(d.stuck>1){d.path=[];d.cooldown=3;n.moving=false;}
      return true;
    }
    if(d.busy>0){
      // На тесной тропе житель сразу уступает герою и продолжает свой обычный путь.
      if(Math.hypot(w.player.x-n.x,w.player.y-n.y)<18){d.busy=0;d.cooldown=.3;d.wantWalk=true;return false;}
      d.busy=Math.max(0,d.busy-dt);n.moving=false;n.anim=0;
      if(!d.busy){d.cooldown=4+d.seed%5;d.wantWalk=true;n.aiT=0;return true;}
      // догонялки: ведущий убегает на пару клеток, второй бежит к нему
      if(d.role==='tag'&&d.partner&&!d.path.length&&d.phase>.4){
        d.phase=0;const o=d.partner,rng=G.util.rng(d.seed+Math.floor(d.busy*10));
        const goal=d.lead?{x:d.center.x+rng.int(-2,2)*T,y:d.center.y+rng.int(-1,1)*T}:{x:o.x,y:o.y};
        if(safe(w.map,goal.x,goal.y)&&Math.hypot(goal.x-n.x,goal.y-n.y)>8){const path=G.nav.path(w.map,n.x,n.y,goal.x,goal.y,300);if(path&&path.length>1&&path.length<8)d.path=path.slice(1);}
      }
      return true;
    }
    d.cooldown-=dt;if(d.cooldown>0||n.moving||n.path?.length)return false;
    if(d.wantWalk){
      const rng=G.util.rng(d.seed+Math.floor(d.phase)*13),points=[];
      for(let i=0;i<8;i++){const x=d.center.x+rng.int(-3,3)*T,y=d.center.y+rng.int(-2,2)*T;if(!safe(w.map,x,y)||Math.hypot(x-n.x,y-n.y)<18||w.map.warps.some(v=>Math.hypot(v.rect.x-x,v.rect.y-y)<25))continue;points.push({x,y,d:Math.hypot(x-w.player.x,y-w.player.y)});}
      points.sort((a,b)=>b.d-a.d);
      for(const p of points){const path=G.nav.path(w.map,n.x,n.y,p.x,p.y,500);if(path&&path.length>1&&path.length<12){d.path=path.slice(1);d.stuck=0;return true;}}
      d.wantWalk=false;
    }
    // Двери и узкие коридоры остаются свободными даже во время короткой работы.
    const tx=n.x/T|0,ty=n.y/T|0,free=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>safe(w.map,(tx+dx)*T+8,(ty+dy)*T+12)).length;
    if(free<3||w.map.warps.some(v=>Math.hypot(v.rect.x-n.x,v.rect.y-n.y)<28)){d.cooldown=6;return false;}
    d.busy=4+d.seed%4;d.phase=0;d.role=roleFor(w,n,d.seed);n.moving=false;n.path=null;
    if(n._em)n._em.t=0;
    if(d.role==='water'&&d.plant)n.dir=d.plant.x>=n.x?'right':'left';
    return true;
  }
  function travelling(n){if(n._daily){n._daily.busy=0;n._daily.path=[];n._daily.center={x:n.x,y:n.y};n._daily.cooldown=2;}}
  function bubble(w,people,lines,duration=6){
    const s=ensure(w);if(!s||s.bubble)return false;
    for(const n of people)if(n._em)n._em.t=0;
    if(G.worldMotion)for(const n of people)G.worldMotion.gesture(w,n,duration<=3?'wave':'talk',Math.min(3,duration));
    s.bubble={people,lines,t:0,duration};return true;
  }
  function update(w,dt){
    const s=ensure(w);if(!s)return;
    for(const a of s.animals){
      if(Math.abs(a.x-w.player.x)<340&&Math.abs(a.y-w.player.y)<340||a.flight)updateAnimal(w,a,dt);
      else if(a.alpha&&!awakeNow(a))a.alpha=0;   // вдали от героя ночью или в дождь зверь сразу уходит, без угасания
    }
    if(s.bubble){s.bubble.t+=dt;if(s.bubble.t>s.bubble.duration||s.bubble.people.some(n=>!w.npcs.includes(n)))s.bubble=null;}
    if(fx()&&G.life.raining()){
      for(const n of [w.player,...w.npcs]){
        if(!n.moving||n.roof||n.jump)continue;const last=n._dailyFoot;
        if(!last||Math.hypot(n.x-last.x,n.y-last.y)>12){n._dailyFoot={x:n.x,y:n.y};s.tracks.push({x:n.x,y:n.y,dir:n.dir,t:4});}
      }
    }
    for(const q of s.tracks)q.t-=dt;s.tracks=s.tracks.filter(q=>q.t>0).slice(-44);
    s.greet-=dt;s.chat-=dt;s.workTalk-=dt;
    if(!s.bubble&&(!w._streetScene||w._streetScene.alpha<.3)&&!w.player.roof&&!w.player.jump){
      const nearby=w.npcs.filter(n=>generic(n)&&Math.hypot(n.x-w.player.x,n.y-w.player.y)<68&&!G.quests.iconFor(n.id));
      if(s.workTalk<=0){const n=nearby.find(n=>n._daily?.busy>1);s.workTalk=9;if(n){const lines=D.jobs[n._daily.role].lines;bubble(w,[n],[lines[(n._daily.seed+G.state.vars.day)%lines.length]],3.5);}}
      if(s.greet<=0){
        s.greet=14;
        const personal=w.npcs.filter(n=>G.streetLife?.reaction(n)&&!G.quests.iconFor(n.id));
        const n=[...personal,...nearby].find(n=>Math.hypot(n.x-w.player.x,n.y-w.player.y)<34&&(!n._dailyGreet||w.time-n._dailyGreet>90)&&!G.state.daily['street_greet_'+(n.uid||n.id)]);
        if(n){n._dailyGreet=w.time;const h=G.state.vars.min/60,key=G.life.raining()?'rain':h<11?'morning':h>=18?'evening':'day',pool=D.greetings[key];const reply=G.streetLife?.reaction(n);bubble(w,[n],[reply||pool[(hash(n.uid)+G.state.vars.day)%pool.length]],reply?5:3);if(reply)G.state.daily['street_greet_'+(n.uid||n.id)]=1;}
      }
      if(!s.bubble&&s.chat<=0){
        s.chat=13;
        for(const a of nearby){if(a.moving)continue;const b=nearby.find(b=>b!==a&&!b.moving&&Math.hypot(b.x-a.x,b.y-a.y)>14&&Math.hypot(b.x-a.x,b.y-a.y)<40);if(!b)continue;
          a.dir=a.x<b.x?'right':'left';b.dir=b.x<a.x?'right':'left';bubble(w,[a,b],D.conversations[(hash(a.uid)+G.state.vars.day)%D.conversations.length],8);break;}
      }
    }
  }
  function label(n){const d=n._daily;return d?.busy>0&&(d.role==='water'||d.role==='sweep')&&!G.state.daily['daily_help_'+n.uid]?'Помочь':null;}
  function help(n,w){
    const d=n._daily,key='daily_help_'+n.uid;
    if(!active(w)||!w.npcs.includes(n)||!d||d.busy<=0||!['water','sweep'].includes(d.role)||G.state.daily[key])return false;
    G.state.streetLife.helped[n.uid]=1;
    G.state.daily[key]=1;G.game.advance(3);d.busy=0;d.cooldown=20;
    G.game.note('Помог соседу: '+D.jobs[d.role].label.toLowerCase());return true;
  }
  function talk(n,w){
    const d=n._daily;if(!active(w)||!generic(n)||!d||d.busy<=0)return false;
    const job=D.jobs[d.role];
    const conversation=()=> (G.DAILY_DIALOGUES[d.role]||[job.talk]).map(line=>typeof line==='string'?{who:n.id,name:n.name,text:line}:{...line});
    if(!label(n)){w.talk(conversation());return true;}
    G.scenes.push(G.scenes.make('pick',{title:n.name||'Сосед',text:job.lines[0],options:[{label:'Помочь на минутку',desc:'Три игровые минуты. Сосед будет рад.'},{label:'Поболтать'}]},i=>{
      if(i===0){if(help(n,w)){w.talk([{who:n.id,name:n.name,text:d.role==='water'?'Спасибо. Теперь хватит воды и этому горшку у края. Я всё боялся про него забыть.':'Спасибо! До поворота уже чисто. Соседке сегодня не придётся обходить по дороге.'},{text:job.help}]);w.savePos();G.storage.save(G.state);}}
      else if(i===1)w.talk(conversation());
    }));return true;
  }
  function actors(w){return active(w)&&w._dailyLife?w._dailyLife.animals.filter(a=>a.alpha>.02&&!a.flight&&Math.abs(a.x-w.player.x)<360&&Math.abs(a.y-w.player.y)<360):[];}
  function probe(w){
    if(!active(w)||w.player.roof||w.player.jump)return null;
    const p=w.player,v=G.actors.DIRV[p.dir],x=p.x+v[0]*10,y=p.y+v[1]*10;
    const a=actors(w).filter(a=>a.type!=='bird'&&Math.hypot(a.x-x,a.y-y)<18).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
    if(!a)return null;
    const s=animalScale(a);return{show:true,label:'Погладить',title:a.name,targetRect:{x:a.x-9*s,y:a.y-14*s,w:19*s,h:16*s},run:()=>pet(w,a)};
  }
  function pet(w,a){
    if(!active(w)||a.type==='bird'||a.alpha<.2||Math.hypot(w.player.x-a.x,w.player.y-a.y)>32)return false;
    a.path=[];a.moving=false;a.pet=5;a.timer=6;
    if(!G.state.daily.daily_pet){G.state.daily.daily_pet=1;}
    if(a.type==='dog')G.audio.sfx.bark();else G.audio.sfx.meow();
    w.showToast(a.type==='dog'?'Пёс радостно виляет хвостом':'Кошка щурится и тихонько мурчит');return true;
  }
  function lift(n,time){return fx()&&n._daily?.busy>0&&n._daily.role==='play'?Math.max(0,Math.sin(time*4+n._daily.seed))*2.5:0;}
  // Груз принадлежит занятию, а не кадру ходьбы: остановка его не скрывает.
  function drawCargo(ctx,w,n,behind=false){
    if(w.map.id!=='konoha'||!generic(n)||n._daily?.role!=='parcel'||n.id.startsWith('kid_')||(n.dir==='up')!==behind)return;
    const x=n.dir==='left'?-6:n.dir==='right'?6:0;
    const bob=fx()&&n.moving?Math.abs(Math.sin(n.anim*Math.PI))*.65:0;
    ctx.save();ctx.translate(n.x+x,n.y-bob);
    ctx.fillStyle='#62462f';ctx.fillRect(-5,-12,10,8);
    ctx.fillStyle='#a7794e';ctx.fillRect(-4,-11,8,6);
    ctx.fillStyle='#dec38d';ctx.fillRect(-4,-11,8,1);ctx.fillRect(-1,-11,2,6);
    // Руки держат коробку по краям, а не оставляют её висеть сбоку.
    if(!behind){ctx.fillStyle='#e5bd95';ctx.fillRect(-5,-8,2,2);ctx.fillRect(3,-8,2,2);}
    ctx.restore();
  }
  function drawActorExtras(ctx,w,n){
    if(w.map.id!=='konoha')return;
    const d=n._daily,t=w.time,side=n.dir==='left'?-1:1;
    ctx.save();ctx.translate(n.x,n.y-(fx()&&n.moving?Math.sin(n.anim*2)*.7:0));
    if(G.life.raining()&&generic(n)&&!kid(n)){   // под дождём у каждого взрослого свой зонт
      ctx.fillStyle='#70583e';ctx.fillRect(5,-30,1,20);ctx.fillStyle=['#b89877','#738d88','#9b6e73'][hash(n.uid)%3];
      ctx.beginPath();ctx.moveTo(-8,-25);ctx.quadraticCurveTo(1,-42,13,-25);ctx.closePath();ctx.fill();ctx.fillStyle='#d8c8a4';ctx.fillRect(1,-32,1,7);ctx.fillRect(0,-34,3,1);
    }
    const waving=fx()&&n._gesture?.kind==='wave'&&n._gesture.until>t;
    if(d?.busy>0&&!waving){
      const phase=Math.sin(t*7+d.seed);
      if(d.role==='sweep'){const x=side*(8+phase*3);ctx.strokeStyle='#8d633c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(side*4,-11);ctx.lineTo(x,0);ctx.stroke();ctx.fillStyle='#d4b56f';ctx.fillRect(x-3,0,6,2);if(fx()){ctx.fillStyle='rgba(211,187,132,.45)';ctx.fillRect(x+4+phase*2,1,2,1);}}
      if(d.role==='water'){const x=side*8;ctx.fillStyle='#66979a';ctx.fillRect(x-3,-8,6,6);ctx.fillRect(x+side*4-1,-6,4,1);ctx.strokeStyle='#cad3ba';ctx.beginPath();ctx.arc(x,-8,3,3.1,6.3);ctx.stroke();if(fx()){ctx.fillStyle='#9bcbd8';for(let i=0;i<3;i++)ctx.fillRect(x+side*(6+i*2),-5+(t*10+i*2)%7,1,1);}}
      if(d.role==='read'){ctx.fillStyle='#ead8a3';ctx.fillRect(-5,-8,10,5);ctx.fillStyle='#805c42';ctx.fillRect(-1,-8,1,5);ctx.fillStyle='#a99872';ctx.fillRect(-4,-6,2,1);ctx.fillRect(1,-6,3,1);if(fx()){const p=(t+d.seed)%3;if(p<.7){ctx.fillStyle='#fff1c9';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(4-10*p,-9-Math.sin(p/.7*Math.PI));ctx.lineTo(4-10*p,-5);ctx.lineTo(0,-3);ctx.fill();}}}

      if(d.role==='play'){const bounce=fx()?Math.abs(Math.sin(t*4+d.seed)):0,y=-3-bounce*9;ctx.save();ctx.globalAlpha*=.3;ctx.fillStyle='#4a5140';ctx.fillRect(8,2,7-bounce*2,1);ctx.restore();ctx.fillStyle='#d8944f';ctx.fillRect(9,y,5,5);ctx.fillStyle='#f4d8a2';ctx.fillRect(10,y+1,2,1);}
      if(d.role==='catch'&&d.lead&&d.partner){   // мяч летит дугой от одного к другому
        const o=d.partner,k=fx()?(t*.8+d.seed%7/7)%1:0,back=Math.floor(t*.8+d.seed%7/7)%2,f=back?1-k:k;
        const bx=(o.x-n.x)*f+side*4*(1-2*f),by=(o.y-n.y)*f-14-Math.sin(Math.PI*f)*16;
        ctx.save();ctx.globalAlpha*=.25;ctx.fillStyle='#3a3a2a';ctx.fillRect(bx-2,(o.y-n.y)*f,4,1);ctx.restore();
        ctx.fillStyle='#e05a3a';ctx.fillRect(bx-2,by-2,4,4);ctx.fillStyle='#fff3d8';ctx.fillRect(bx-1,by-2,1,1);
      }
      if(d.role==='exercise'){const up=fx()?Math.sin(t*3+d.seed)>0:true;ctx.fillStyle='#efd9b2';
        if(up){ctx.fillRect(-7,-30,2,8);ctx.fillRect(5,-30,2,8);}else{ctx.fillRect(-10,-19,4,2);ctx.fillRect(6,-19,4,2);}}
      if(d.role==='tea'){const x=side*6;ctx.fillStyle='#d9d0bb';ctx.fillRect(x-2,-12,4,3);ctx.fillStyle='#6f8a5a';ctx.fillRect(x-2,-12,4,1);
        if(fx()){ctx.fillStyle='rgba(235,235,225,.45)';const sy=(t*6+d.seed)%6;ctx.fillRect(x-1+Math.sin(t*2)*1,-15-sy,1,2);}}
      if(d.role==='warm'){const rub=fx()?Math.sin(t*15)*1.2:0;ctx.fillStyle='#efd9b2';ctx.fillRect(-4+rub,-10,4,2);ctx.fillRect(-rub,-9,4,2);if(fx()){ctx.fillStyle='rgba(220,237,228,.4)';ctx.fillRect(4,-16+(t*3)%4,3,1);}}
    }
    ctx.restore();
  }
  function drawAnimal(ctx,w,a,airborne=false){
    if(a.alpha<=.02)return;
    const j=a.flight,k=j?j.t/j.dur:0,lift=j?Math.sin(Math.PI*k)*j.h:0,t=w.time;
    ctx.save();ctx.globalAlpha*=a.alpha;
    const size=animalScale(a);G.shade.shadow(ctx,a.x,a.y,airborne?2.5:4*size,Math.max(.5,size),airborne?.12:.22);ctx.translate(Math.round(a.x),Math.round(a.y-lift));ctx.scale(size,size);
    if(a.dir==='left')ctx.scale(-1,1);
    if(a.type==='bird'){
      const peck=fx()&&!j&&!a.moving&&Math.sin(t*3+a.serial)>.7;
      if(fx()&&!j&&a.moving)ctx.translate(0,-Math.max(0,Math.sin(a.anim*2))*1.5);
      ctx.fillStyle='#8a7765';ctx.fillRect(-3,-4,6,3);ctx.fillStyle='#d8cdb3';ctx.fillRect(-2,-2,4,2);ctx.fillStyle='#5d5149';ctx.fillRect(1,peck?-3:-6,3,3);ctx.fillStyle='#ddb679';ctx.fillRect(4,peck?-1:-4,2,1);
      if(j){const h=Math.sin(t*24+a.serial)*4;ctx.fillStyle='#b3a28c';ctx.fillRect(-3,-5-h,5,2);ctx.fillRect(-2,-4+h,4,1);}else{ctx.fillStyle='#a08562';ctx.fillRect(-1,0,1,1);ctx.fillRect(2,0,1,1);}
    }else if(!G.worldMotion||!G.worldMotion.animal(ctx,w,a)){
      const cat=a.type==='cat',coat=(cat?['#cf965a','#d7d4c4','#5a6170']:['#b68a62'])[a.coat||0],dark=cat?'#786454':'#73543d',step=a.moving?Math.sin(a.anim*2)*1.5:0;
      ctx.fillStyle='#55564d';ctx.fillRect(-7,-8,13,8);ctx.fillRect(1,-12,8,8);
      if(cat){ctx.fillRect(1,-14,3,4);ctx.fillRect(6,-14,3,4);}
      ctx.fillStyle=coat;ctx.fillRect(-6,-7,11,6);ctx.fillRect(2,-11,6,6);
      if(cat){ctx.fillRect(2,-13,2,3);ctx.fillRect(6,-13,2,3);}else{ctx.fillStyle=dark;ctx.fillRect(1,-11,2,5);ctx.fillRect(7,-10,2,4);ctx.fillStyle='#dfc3a1';ctx.fillRect(6,-7,4,2);}
      ctx.fillStyle=coat;ctx.fillRect(-5,-2+step,2,3);ctx.fillRect(2,-2-step,2,3);
      ctx.strokeStyle=coat;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-6,-4);ctx.quadraticCurveTo(-11,-4,-10+Math.sin(t*(a.pet?10:3))*2,-9);ctx.stroke();
      ctx.fillStyle=Math.sin(t*1.7+a.serial)>.96||a.pet?'#7c6d61':'#242e2b';ctx.fillRect(4,-9,1,1);ctx.fillRect(7,-8,1,1);ctx.fillStyle='#b57975';ctx.fillRect(8,-7,1,1);
      if(a.coat===0&&cat){ctx.fillStyle=dark;ctx.fillRect(-2,-7,1,3);ctx.fillRect(1,-7,1,2);}
    }
    ctx.restore();if(a.pet>0)G.font.small.draw(ctx,'♥',a.x,a.y-14*size-6+Math.sin(t*3),{align:'center',color:'#ec9d9b',outline:'#3c3833'});
  }
  function drawUnder(ctx,w){
    if(!active(w)||!fx()||!w._dailyLife)return;
    if(G.worldMotion)G.worldMotion.ground(ctx,w);
    for(const q of w._dailyLife.tracks){ctx.save();ctx.globalAlpha=q.t/4*.28;ctx.fillStyle='#516577';const vertical=q.dir==='up'||q.dir==='down';ctx.fillRect(q.x-2,q.y-2,vertical?1:3,vertical?3:1);ctx.fillRect(q.x+2,q.y,vertical?1:3,vertical?3:1);ctx.restore();}
  }
  function drawObject(ctx,w,o,img){
    if(G.worldMotion&&G.worldMotion.object(ctx,w,o,img))return true;
    if(w.map.id!=='konoha'||!fx()||!['laundry','banner'].includes(o.kind))return false;
    const x=o.x+o.ox,y=o.y+o.oy,t=w.time,phase=t*(G.life.raining()?3:1.8)+o.x*.01;
    if(o.kind==='laundry'){
      ctx.drawImage(img,0,0,4,o.h,x,y,4,o.h);ctx.drawImage(img,o.w-3,0,3,o.h,x+o.w-3,y,3,o.h);ctx.drawImage(img,4,0,o.w-7,5,x+4,y,o.w-7,5);
      for(let sy=5;sy<o.h;sy+=2){const hh=Math.min(2,o.h-sy),dx=Math.sin(phase+sy*.25)*Math.min(1.5,(sy-4)*.12);ctx.drawImage(img,4,sy,o.w-7,hh,x+4+dx,y+sy,o.w-7,hh);}
    }else{
      ctx.drawImage(img,0,0,3,o.h,x,y,3,o.h);
      for(let sy=0;sy<o.h;sy+=2){const hh=Math.min(2,o.h-sy),dx=Math.sin(phase+sy*.2)*Math.min(1.4,sy*.08);ctx.drawImage(img,3,sy,o.w-3,hh,x+3+dx,y+sy,o.w-3,hh);}
    }
    return true;
  }
  function draw(ctx,w,vis){
    if(!active(w))return;
    const s=w._dailyLife;if(!s)return;
    if(fx())for(const b of vis){
      if(!b.isBuilding||!G.SHOPS[b.tplId]||!b.door)continue;
      const shop=G.SHOPS[b.tplId],min=G.state.vars.min,open=min>=shop.hours[0]&&min<shop.hours[1],x=b.door.tx*T-3,y=b.door.ty*T-5;
      ctx.fillStyle='#5b4a38';ctx.fillRect(x-3,y-3,7,6);ctx.fillStyle=open?'#9cb987':'#a47d6b';ctx.fillRect(x-2,y-2,5,4);
      if(open&&['ichiraku','dango','teahouse','yakiniku','onsen'].includes(b.tplId)){
        for(let i=0;i<5;i++){const k=(w.time*.22+i*.21)%1;ctx.save();ctx.globalAlpha=(1-k)*.25;ctx.fillStyle='#f0ebd7';ctx.beginPath();ctx.ellipse(x+10+Math.sin(w.time+i)*3,y+9-k*26,2+k*3,1.3+k*2,0,0,7);ctx.fill();ctx.restore();}
      }
    }
    for(const a of s.animals)if(a.flight)drawAnimal(ctx,w,a,true);
    const b=s.bubble;if(!b||w._streetScene?.alpha>.3)return;
    const i=Math.min(b.lines.length-1,Math.floor(b.t/2.5)),n=b.people[i%b.people.length];if(n.moving&&b.people.length>1)return;
    const F=G.font.small,text=b.lines[i],max=Math.min(156,G.screen.W/(w.z||1)-14),lines=F.wrap(text,max-12).slice(0,2),bw=Math.min(max,Math.max(...lines.map(s=>F.measure(s)))+12),bh=lines.length*11+6;
    const x=G.util.clamp(n.x-bw/2,w.cam.x+4,w.cam.x+G.screen.W/(w.z||1)-bw-4),y=n.y-32-bh;
    ctx.save();ctx.globalAlpha=Math.min(1,b.t*4,(b.duration-b.t)*3);G.ui.panel(ctx,x,y,bw,bh,'tag');lines.forEach((ln,j)=>F.draw(ctx,ln,x+6,y+4+j*11,{color:'#f0e5c7'}));ctx.restore();
  }
  return{ensure,clear,update,tickNpc,travelling,actors,probe,pet,label,talk,help,lift,drawCargo,drawActorExtras,drawAnimal,drawUnder,drawObject,draw,generic,animalScale};
})();
