// Уличные события: только добровольное действие A. Прогресс переживает сон и загрузку.
G.streetLife = (() => {
  const active=w=>w.map.id==='konoha'&&G.state.started&&!!(G.state.flags.hosp_done||G.state.flags.day2_intro);
  const state=()=>G.state.streetLife;
  const progress=id=>state().events[id]||0;
  function save(w){w._actionKey=null;w.savePos();G.storage.save(G.state);}
  function lines(def,stage){
    return (G.STREET_DIALOGUES[def.id]?.[stage]||[def.thanks]).map(line=>typeof line==='string'?{who:def.who,name:def.name,text:line}:{...line});
  }
  function finish(w,def){
    if(progress(def.id)===9)return false;
    state().events[def.id]=9;G.state.vars.money+=def.reward;
    G.game.note('Помощь в деревне: '+def.title);save(w);
    w.talk([...lines(def,'complete'),{text:'Награда: '+def.reward+' рё.'}]);return true;
  }
  function point(m,tpl,dx,dy,used){
    const b=m.buildings.find(b=>b.tplId===tpl);if(!b?.door)return null;
    const origin=G.world.outsideOf(b);
    for(let r=0;r<=8;r++)for(let ox=-r;ox<=r;ox++)for(let oy=-r;oy<=r;oy++){
      if(Math.abs(ox)+Math.abs(oy)!==r)continue;
      const x=(b.door.tx+dx+ox)*16+8,y=(b.door.ty+dy+oy)*16+12;
      if(m.blockedRect({x:x-8,y:y-5,w:16,h:6}))continue;
      if(used.some(q=>Math.hypot(q.x-x,q.y-y)<20))continue;
      if(m.warps.some(q=>Math.hypot(q.rect.x+8-x,q.rect.y-y)<30))continue;
      if(m.npcs.some(q=>Math.hypot(q.x-x,q.y-y)<18))continue;
      if(m.query({x:x-8,y:y-20,w:16,h:22}).some(o=>o.sortY>=y&&G.util.rectsOverlap(m.drawRect(o),{x:x-8,y:y-20,w:16,h:22})))continue;
      const path=G.nav.path(m,origin.x,origin.y,x,y,6000);
      if(!path?.length)continue;
      const q={x,y};used.push(q);return q;
    }
    return null;
  }
  function ensure(w){
    if(!active(w))return [];
    if(w._streetEvents?.map===w.map)return w._streetEvents.nodes;
    const nodes=[],used=[];
    for(const def of G.STREET_EVENTS){
      const start=point(w.map,def.tpl,-3,3,used);if(!start)continue;
      const group=[];
      const npc=(p,id,name,part)=>Object.assign(G.actors.make(id,p.x,p.y),{name,_look:0,_streetEvent:def.id,part,ai:'none'});
      group.push(npc(start,def.who,def.name,'start'));
      if(def.id==='apples')for(let i=0;i<3;i++){
        const p=point(w.map,def.tpl,i*2-3,5,used);if(!p)continue;
        const img=G.gfx.canvas(8,8),c=img.getContext('2d');
        c.fillStyle='#743b30';c.fillRect(2,2,5,5);c.fillStyle='#cf5b45';c.fillRect(1,3,6,3);c.fillStyle='#f6bb79';c.fillRect(2,3,2,1);c.fillStyle='#8caa61';c.fillRect(4,0,3,2);
        group.push({...p,img,ox:-4,oy:-7,w:8,h:8,sortY:p.y,kind:'street_apple',_streetEvent:def.id,part:'apple',index:i});
      }
      if(def.id==='notebook'){
        const p=point(w.map,'academy',3,3,used);if(p)group.push(npc(p,'kid_f','Дежурная ученица','delivery'));
      }
      if(def.id==='practice'){
        const p=point(w.map,def.tpl,-1,3,used);if(p)group.push(npc(p,'kid_f','Ученица у додзё','start'));
      }
      // Событие не появляется, если нельзя безопасно поставить все его точки.
      if(group.length===(def.id==='apples'?4:2))nodes.push(...group);
    }
    w._streetEvents={map:w.map,nodes};return nodes;
  }
  function visible(n){
    const p=progress(n._streetEvent);
    if(n.part==='apple')return p>0&&p<9&&!(state().apples&(1<<n.index));
    if(n.part==='delivery')return p===1||p===9;
    return true;
  }
  function actors(w){return ensure(w).filter(n=>visible(n)&&Math.abs(n.x-w.player.x)<320&&Math.abs(n.y-w.player.y)<320);}
  function interact(w,n){
    if(!active(w)||!ensure(w).includes(n)||!visible(n)||Math.hypot(w.player.x-n.x,w.player.y-n.y)>34)return false;
    const def=G.STREET_EVENTS.find(d=>d.id===n._streetEvent),p=progress(def.id);
    if(p===9){w.talk(lines(def,n.part==='delivery'?'deliveryAfter':'after'));return true;}
    if(n.part==='apple'){
      state().apples|=1<<n.index;
      if(state().apples===7)finish(w,def);else{save(w);w.showToast('Собрано яблок: '+[1,2,4].filter(b=>state().apples&b).length+' из 3');}
      return true;
    }
    if(n.part==='delivery'){finish(w,def);return true;}
    if(p===1){w.talk([{who:def.who,name:def.name,text:def.id==='apples'?'Яблоки лежат рядом. Осталось собрать: '+(3-[1,2,4].filter(b=>state().apples&b).length)+'.':'Дежурная ученица ждёт возле Академии. Конспект у тебя, в сумку его класть не нужно.'}]);return true;}
    const quiz=def.id==='practice';
    G.scenes.push(G.scenes.make('pick',{title:def.title,text:def.intro,options:quiz?
      [{label:'Сначала контроль'},{label:'Сразу всю чакру'},{label:'Пока не вмешиваться'},{label:G.STREET_DIALOGUES[def.id].question}]:
      [{label:def.task,desc:'Без срока и штрафов. Награда: '+def.reward+' рё.'},{label:'Может быть, позже'},{label:G.STREET_DIALOGUES[def.id].question}]},i=>{
      if(!active(w)||progress(def.id)!==0)return;
      if(i===0){if(quiz)finish(w,def);else{state().events[def.id]=1;G.game.note('Уличное событие: '+def.title+' — '+def.task);save(w);w.talk(lines(def,'accept'));w.showToast(def.id==='apples'?'Собери три яблока рядом с торговцем':'Отнеси конспект дежурной у Академии');}}
      else if(quiz&&i===1)w.talk(lines(def,'wrong'));
      else if(i===(quiz?3:2))w.talk(lines(def,'explain'));
      else if(i===(quiz?2:1))w.talk(lines(def,'decline'));
    }));return true;
  }
  function probe(w){
    if(!active(w)||w.player.roof||w.player.jump)return null;
    const p=w.player,v=G.actors.DIRV[p.dir],fx=p.x+v[0]*12,fy=p.y+v[1]*12;
    const n=actors(w).filter(n=>Math.hypot(n.x-fx,n.y-fy)<18).sort((a,b)=>Math.hypot(a.x-fx,a.y-fy)-Math.hypot(b.x-fx,b.y-fy))[0];
    if(!n)return null;
    return {show:true,label:n.part==='apple'?'Поднять':n.part==='delivery'&&progress(n._streetEvent)!==9?'Вернуть':'Говорить',title:n.name||'Упавшее яблоко',targetRect:{x:n.x-8,y:n.y-20,w:16,h:22},run:()=>interact(w,n)};
  }
  function draw(ctx,w){
    for(const n of actors(w)){
      if(n.part==='apple'||progress(n._streetEvent)===9)continue;
      const def=G.STREET_EVENTS.find(d=>d.id===n._streetEvent);
      G.font.small.draw(ctx,progress(def.id)?'?':'!',n.x,n.y-33+Math.round(Math.sin(w.time*3)),{align:'center',color:'#f2cd79',outline:G.PAL.ink});
    }
  }
  function reaction(n){
    const name=G.state.hero.name||'сосед',mem=state().helped[n.uid];
    if(mem)return name+', спасибо за помощь! Во дворе теперь гораздо уютнее.';
    if(n.id==='iruka'&&Object.keys(G.state.learning).some(k=>k.startsWith('tr_')&&G.state.learning[k]))return name+', я вижу, ты не бросаешь упражнения. Продолжай в том же духе!';
    const vl=G.choices&&G.choices.villagerLine(n);if(vl)return vl;
    const friendship=G.state.vars['friend_'+n.id]||0;
    if(friendship>=5)return (G.STREET_REACTIONS[n.id]||'Привет, {name}! Рад снова тебя видеть.').replace('{name}',name);
    if(G.state.flags['met_'+n.id])return 'Привет, '+name+'! Удачного дня!';
    return null;
  }
  return {active,ensure,actors,probe,interact,draw,reaction,progress,lines};
})();
