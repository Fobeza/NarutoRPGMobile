// Сумка: общая геометрия рисования и касаний, без изменения правил использования вещей.
G.scenes.register('bag', () => {
  let idx=0,msg='',msgT=0;
  const list=()=>Object.entries(G.state.inv).filter(([id,n])=>n>0&&G.ITEMS[id])
    .map(([id,n])=>Object.assign({id,n},G.ITEMS[id]))
    .sort((a,b)=>(a.pouch?0:1)-(b.pouch?0:1)||a.name.localeCompare(b.name));
  const hit=(t,r)=>t&&t.x>=r.x&&t.x<r.x+r.w&&t.y>=r.y&&t.y<r.y+r.h;
  function layout(){
    const W=G.screen.W,H=G.screen.H,sc=G.screen.scale||1,z=sc<1.25?2:1;
    const bh=Math.max(22,Math.ceil(44/sc)),infoY=bh+8,infoH=48*z;
    const apply={x:8,y:H-bh-8,w:W-16,h:bh};
    const desc={x:4,y:apply.y-48*z-8,w:W-8,h:48*z+bh+12};
    const py=desc.y-bh-4,bw=Math.floor((W-20)/3);
    const cols=Math.max(1,Math.floor((W-20)/Math.max(62,Math.ceil(44/sc)+3)));
    const cardW=Math.floor((W-20)/cols),cardH=Math.max(56,Math.ceil(44/sc)+3),gy=infoY+infoH+4;
    const rows=Math.max(1,Math.floor((py-gy-10-14*z)/cardH));
    const grid={x:4,y:gy,w:W-8,h:rows*cardH+12+14*z,cols,rows,cardW,cardH,per:cols*rows};
    const n=list().length,selected=Math.min(idx,Math.max(0,n-1));
    return {z,bh,infoY,infoH,grid,desc,apply,back:{x:4,y:4,w:58*z,h:bh},
      prev:{x:8,y:py,w:bw,h:bh},next:{x:W-8-bw,y:py,w:bw,h:bh},
      page:Math.floor(selected/grid.per),pages:Math.max(1,Math.ceil(n/grid.per)),selected};
  }
  function cards(g,L){return L.slice(g.page*g.grid.per,(g.page+1)*g.grid.per).map((it,k)=>({
    ...it,index:g.page*g.grid.per+k,x:g.grid.x+6+(k%g.grid.cols)*g.grid.cardW,
    y:g.grid.y+6+Math.floor(k/g.grid.cols)*g.grid.cardH,w:g.grid.cardW-3,h:g.grid.cardH-3}));}
  function text(ctx,s,x,y,z,small=false,opts={}){
    ctx.save();ctx.translate(x,y);ctx.scale(z,z);(small?G.font.small:G.font).draw(ctx,s,0,0,opts);ctx.restore();
  }
  function button(ctx,r,label,z,state){
    G.ui.button(ctx,r.x,r.y,r.w,r.h,'',state);
    text(ctx,label,r.x+r.w/2,r.y+Math.floor((r.h-G.font.CAP*z)/2),z,false,
      {align:'center',color:state==='dis'?'#ae9b80':'#f8eed0',shadow:'#160c06',maxW:(r.w-8)/z});
  }
  return {
    name:'bag',touch(){return {back:false};},layout,
    grid(){return layout().grid;},cols(){return this.grid().cols;},rows(){return this.grid().rows;},gridTop(){return this.grid().y;},
    visibleCards(){return cards(layout(),list());},
    update(dt){
      const I=G.input,L=list(),g=layout();msgT=Math.max(0,msgT-dt);
      if(I.pressed('b')||I.pressed('menu')||hit(I.tapNow,g.back)){G.audio.sfx.cancel();G.scenes.pop();return;}
      idx=g.selected;if(!L.length)return;
      for(const [key,step]of [['up',-g.grid.cols],['down',g.grid.cols],['left',-1],['right',1]]){
        if(I.repeat(key,dt)){idx=((idx+step)%L.length+L.length)%L.length;G.audio.sfx.select();}
      }
      if(I.pressed('a')||(hit(I.tapNow,g.apply)&&G.game.usable(L[idx].id))){
        const result=G.game.useItem(L[idx].id);msg=result.text;msgT=2;
        if(result.ok)G.audio.sfx.confirm();else G.audio.sfx.error();return;
      }
      if(!I.tapNow)return;
      if(hit(I.tapNow,g.prev)||hit(I.tapNow,g.next)){
        const page=g.page+(hit(I.tapNow,g.prev)?-1:1);
        if(page>=0&&page<g.pages){idx=page*g.grid.per;msgT=0;G.audio.sfx.select();}return;
      }
      const card=cards(g,L).find(r=>hit(I.tapNow,r));
      if(card){idx=card.index;msgT=0;G.audio.sfx.select();}
    },
    draw(ctx){
      const W=G.screen.W,U=G.ui,C=U.C,v=G.state.vars,game=G.game,g=layout(),z=g.z,L=list();
      U.backdrop(ctx);button(ctx,g.back,'Назад',z,'normal');
      ctx.save();ctx.translate(g.back.x+g.back.w+(W-g.back.x-g.back.w)/2,4+(g.bh-16*z)/2);ctx.scale(z,z);U.title(ctx,'СУМКА',0,0,70);ctx.restore();
      U.panel(ctx,4,g.infoY,W-8,g.infoH,'frame');
      text(ctx,`${game.dayName()}, ${v.day} · ${game.clock()}`,12,g.infoY+5*z,z,true,{color:C.inkDim,maxW:(W-24)/z-G.font.small.measure(`${v.money} рё`)-8});
      text(ctx,`${v.money} рё`,W-12,g.infoY+5*z,z,true,{align:'right',color:'#8a5a10'});
      text(ctx,'Цель: '+(game.goalText()||'—'),12,g.infoY+18*z,z,true,{color:C.redDark,maxW:(W-24)/z});
      [['Сытость',v.food,C.food],['Энергия',v.energy,C.energy]].forEach(([nm,val,col],i)=>{
        const x=12+i*(W-24)/2;text(ctx,nm,x,g.infoY+31*z,z,true,{color:C.inkDim});
        U.gauge(ctx,x+54*z,g.infoY+33*z,Math.floor((W-24)/2)-54*z-4,6*z,val/100,col);
      });
      const gr=g.grid;U.panel(ctx,gr.x,gr.y,gr.w,gr.h,'well');
      cards(g,L).forEach(r=>{
        U.card(ctx,r.x,r.y,r.w,r.h,r.index===g.selected);
        const icon=Math.min(r.w-6,r.h-6,48*z);G.icons.draw(ctx,r.id,r.x+Math.floor((r.w-icon)/2),r.y+2,icon,icon);
        text(ctx,'×'+r.n,r.x+r.w-4,r.y+r.h-12*z,z,true,{align:'right',color:'#f8eed0',outline:C.woodEdge});
      });
      text(ctx,`Подсумок: ${game.pouchUsed()}/${game.pouchMax()}`,gr.x+8,gr.y+gr.h-12*z,z,true,{color:C.inkDim});
      if(!L.length){
        text(ctx,'Сумка пуста',W/2,gr.y+12*z,z,false,{align:'center',color:C.inkDim});
        text(ctx,'Загляни в лавки!',W/2,gr.y+28*z,z,true,{align:'center',color:C.inkDim});
      }
      button(ctx,g.prev,'▲',z,g.page>0?'normal':'dis');button(ctx,g.next,'▼',z,g.page+1<g.pages?'normal':'dis');
      text(ctx,`${L.length?g.page+1:0}/${L.length?g.pages:0}`,W/2,g.prev.y+(g.bh-G.font.CAP*z)/2,z,false,{align:'center',color:C.paper});
      U.panel(ctx,g.desc.x,g.desc.y,g.desc.w,g.desc.h,'frame');
      const it=L[g.selected];
      text(ctx,it?it.name:'Нет предметов',14,g.desc.y+6*z,z,false,{color:C.redDark,maxW:(W-28)/z});
      const detail=it?(msgT?msg:it.desc||''):`Подсумок: ${game.pouchUsed()}/${game.pouchMax()}`;
      G.font.small.wrap(detail,(W-28)/z).slice(0,2).forEach((ln,i)=>text(ctx,ln,14,g.desc.y+(22+i*12)*z,z,true,{color:C.ink}));
      button(ctx,g.apply,it?(it.cat==='food'?'Съесть':'Применить'):'Применить',z,it&&game.usable(it.id)?'sel':'dis');
    },
  };
});
