// Тактический план: проверка цены, два последовательных действия и остановка при изменении условий.
// Исполнение использует ту же модель, что симулятор баланса, уроки и сюжетные дуэли.
(() => {
  G.tacticalGeometry=()=>{
    const sc=G.screen.scale||1,u=Math.ceil(46/sc),tab=Math.max(22,u),card=Math.max(28,Math.ceil(48/sc)),foot=Math.max(25,Math.ceil(48/sc)),info=u>30?64:44;
    const compact=info+tab*2+card*2+foot+34>G.screen.H-100;
    return {u,tab,card,foot,info,compact,per:compact?2:4,area:info+tab*(compact?1:2)+card*(compact?1:2)+foot+34};
  };
  const factory = G.scenes.registry.battle;
  const groups = [['move','Движение'],['tai','Удары'],['throw','Метание'],['tech','Техники'],['tool','Предметы'],['misc','Тактика']];
  G.scenes.register('battle', (options, onEnd) => {
    const b = factory(Object.assign({}, options, {tacticalUI:true}), onEnd);
    const baseUpdate=b.update, baseDraw=b.draw, baseTouch=b.touch;
    let group='move', page=0, selected=null, cursor=0, queue=[], running=false, note='', clock=0, help=false;
    const U=G.ui,F=G.font.small;
    const planner=b.planner={
      get queue(){return queue.map(x=>({...x}));}, get running(){return running;},
      select(g,label){group=g;selected=commands().find(x=>x.label===label)||null;return !!selected;},
      add(){return add();}, commit(){if(!queue.length)return false;running=true;selected=null;return true;},
      cancel(){queue=[];running=false;selected=null;},
      get buttons(){return hits.map(x=>({...x,act:undefined}));},
      get message(){return note;},
    };
    let hits=[];
    function predicted(){let p=b.P.pos;for(const q of queue){if(q.group!=='move')continue;const toward=Math.sign(b.E.pos-p)||1;const n=q.label==='Рывок'?2:1;const sign=q.label==='Назад'||q.label==='Отскок'?-1:1;for(let i=0;i<n;i++){const next=p+toward*sign;if(next<0||next>4||next===b.E.pos||b.tactical.object(next)==='water'&&!G.state.flags.tech_water)break;p=next;}}return p;}
    function commands(){return b.tactical.commands(group).filter(x=>!/^Пока нет|^Пусто/.test(x.label)).map(x=>group==='tai'&&Math.abs(predicted()-b.E.pos)>1?{...x,off:'Сначала запланируй сближение'}:x);}
    function fail(s){note=String(s);G.audio.sfx.error();return false;}
    function add(){
      if(!selected)return fail('Сначала выбери действие');
      if(queue.length>=2)return fail('В плане уже два действия');
      if(selected.off)return fail(selected.off);
      if(selected.label==='Сдаться'){
        G.scenes.push(G.scenes.make('pick',{title:'Завершить спарринг?',options:[{label:'Продолжить бой'},{label:'Сдаться'}]},i=>{if(i===1)b.sim.press('misc','Сдаться');}));return false;
      }
      queue.push({group,label:selected.label});note='План можно изменить до запуска';selected=null;G.audio.sfx.select();return true;
    }
    function execute(){
      if(!running||!queue.length||b.state!=='menu'||b.sim.menu()==='momentPick')return;
      const a=queue[0], cmd=b.tactical.commands(a.group).find(x=>x.label===a.label);
      const why=!cmd?'Действие больше недоступно':cmd.off||(a.group==='tai'&&b.tactical.distance()>1?'Враг далеко: сначала сблизься':null);
      if(why){running=false;queue=[];fail('План остановлен: '+why);return;}
      queue.shift();const before=b.state;
      if(!b.sim.press(a.group,a.label)){running=false;queue=[];fail('Условия изменились. Выбери новый план');return;}
      G.events.emit('tactic',a.group,a.label);
      if(b.state===before&&a.group!=='misc'){running=false;queue=[];note='Проверь дистанцию и ресурсы';}
      if(!queue.length)running=false;
    }
    function maskInput(fn){const I=G.input,press=I.pressed,tap=I.tapNow;I.pressed=()=>false;I.tapNow=null;try{fn();}finally{I.pressed=press;I.tapNow=tap;}}
    b.touch=()=>b.state==='menu'&&b.sim.menu()!=='momentPick'?{}:baseTouch();
    b.update=function(dt){
      clock+=dt;
      const plan=b.state==='menu'&&b.sim.menu()!=='momentPick';
      if(plan){
        if(!running){const I=G.input;
          if(I.tapNow){const p=I.tapNow,h=hits.find(h=>p.x>=h.x&&p.x<h.x+h.w&&p.y>=h.y&&p.y<h.y+h.h);if(h)h.act();}
          if(I.pressed('b')){if(help)help=false;else if(queue.length)queue.pop();else selected=null;}
          if(I.pressed('left'))cursor=Math.max(0,cursor-1);
          if(I.pressed('right'))cursor=Math.min(3,cursor+1);
          if(I.pressed('up'))cursor=Math.max(0,cursor-2);
          if(I.pressed('down'))cursor=Math.min(3,cursor+2);
          if(I.pressed('map')){group=groups[(groups.findIndex(x=>x[0]===group)+1)%groups.length][0];page=0;selected=null;}
          if(I.pressed('a')){if(queue.length)planner.commit();else if(selected)add();else selected=commands()[page*G.tacticalGeometry().per+cursor]||null;}
        }
        execute();
        maskInput(()=>baseUpdate.call(b,dt));
      }else baseUpdate.call(b,dt);
      if(b.state==='end'){queue=[];running=false;}
    };
    function button(ctx,x,y,w,h,label,state,act,sub){
      U.button(ctx,x,y,w,h,'',state||'normal');F.draw(ctx,label,x+w/2,y+(sub?5:Math.max(5,(h-8)/2)),{align:'center',maxW:w-8,color:state==='dis'?'#aa9d85':'#fff0d2',shadow:'#231710'});
      if(sub)F.draw(ctx,sub,x+w/2,y+h-11,{align:'center',maxW:w-8,color:'#e4c889'});
      hits.push({x,y,w,h,label,act});
    }
    function line(ctx,text,x,y,w,col){F.draw(ctx,text,x,y,{maxW:w,color:col||'#e8d6ad'});}
    b.draw=function(ctx){
      baseDraw.call(b,ctx);hits=[];
      const W=G.screen.W,H=G.screen.H,L=b.tactical.layout(),plan=b.state==='menu'&&b.sim.menu()!=='momentPick';
      if(!plan)return;
      const geo=G.tacticalGeometry(),top=H-geo.area+1,bh=H-top;
      U.panel(ctx,0,top,W,bh,'night');
      const health=Math.max(0,Math.round(b.P.hp/b.P.hpMax*100));
      line(ctx,'ТЫ '+health+'%  ЧАКРА '+Math.round(b.P.ch)+'  ДЫХ. '+b.P.br,7,top+5,W-14);
      const intent=b.tactical.intent();
      const danger=G.EACTS[b.E.shown]||G.EACTS.stand;
      line(ctx,'ВРАГ: '+intent.name,7,top+17,W-geo.u-12,'#ffbd8d');
      if(geo.info>50){const gw=Math.floor((W-geo.u-24)/2);U.gauge(ctx,7,top+35,gw,6,b.P.hp/b.P.hpMax,U.C.hp);U.gauge(ctx,14+gw,top+35,gw,6,b.P.ch/b.P.chMax,U.C.chakra);}
      button(ctx,W-geo.u-3,top+2,geo.u,geo.u,'?',help?'sel':'normal',()=>{help=!help;});
      const qy=top+geo.info-13;
      line(ctx,queue.length?queue.map((q,i)=>(i+1)+'. '+q.label).join(' / '):'План: выбери до двух действий',7,qy,W-14,'#b6d9d5');
      const ty=qy+13,tw=Math.floor((W-10)/3);
      if(geo.compact){const gi=groups.findIndex(x=>x[0]===group),shift=n=>{group=groups[(gi+n+groups.length)%groups.length][0];page=0;selected=null;};button(ctx,4,ty,geo.u,geo.tab,'<','normal',()=>shift(-1));button(ctx,6+geo.u,ty,W-2*geo.u-12,geo.tab,groups[gi][1],'sel',()=>shift(1));button(ctx,W-geo.u-4,ty,geo.u,geo.tab,'>','normal',()=>shift(1));}
      else groups.forEach(([id,title],i)=>button(ctx,4+(i%3)*(tw+1),ty+Math.floor(i/3)*geo.tab,tw,geo.tab-1,title,group===id?'sel':'normal',()=>{group=id;page=0;selected=null;cursor=0;}));
      const cy=ty+geo.tab*(geo.compact?1:2)+3,all=commands(),pages=Math.max(1,Math.ceil(all.length/geo.per));page%=pages;
      all.slice(page*geo.per,page*geo.per+geo.per).forEach((cmd,i)=>{
        const label=cmd.label.replace('Ловушка-пров.','Пров. ловушка').replace('Дым. бомба','Дымовая бомба');
        button(ctx,4+(i%2)*Math.floor((W-6)/2),cy+Math.floor(i/2)*geo.card,Math.floor((W-8)/2),geo.card-1,label,cmd.off?'dis':selected?.label===cmd.label?'sel':'normal',()=>{selected=cmd;note=cmd.off||cmd.desc||cmd.sub;cursor=i;},cmd.sub);
      });
      if(!all.length)line(ctx,group==='tech'?'Техники изучаются у Ируки':'Здесь пока нет действий',8,cy+15,W-16);
      const fy=H-geo.foot-3,dy=cy+geo.card*(geo.compact?1:2)+3;
      const desc=selected?(selected.off||selected.desc):note||'Выбери приём, затем добавь в план';
      F.wrap(desc,W-12).slice(0,Math.max(1,Math.floor((fy-dy-2)/10))).forEach((s,i)=>line(ctx,s,6,dy+i*10,W-12,selected?.off?'#ffb599':'#d5c9ad'));
      button(ctx,4,fy,Math.floor(W*.39),geo.foot,selected?'В план +':'В бой!',selected?'sel':queue.length?'sel':'dis',()=>{if(selected)add();else planner.commit();});
      button(ctx,7+Math.floor(W*.39),fy,Math.floor(W*.34),geo.foot,queue.length?'Убрать шаг':'Очистить','normal',()=>{queue.pop();selected=null;});
      button(ctx,W-Math.floor(W*.22)-3,fy,Math.floor(W*.22),geo.foot,pages>1?(page+1)+'/'+pages:'Ещё','normal',()=>{page=(page+1)%pages;selected=null;});
      // Прогноз расстояния и области угрозы остаётся над ареной.
      const ay=42;
      U.panel(ctx,5,ay,W-10,19,'tag');
      const range=danger.range?danger.range.join('-'):'?';
      line(ctx,'Дистанция '+b.tactical.distance()+' / атака врага '+range,10,ay+6,W-20,'#ffe2ad');
      const step=Math.min(52,Math.floor((W-48)/4)),baseX=W/2,ground=L.groundY;
      for(let i=0;i<5;i++){
        const x=baseX+(i-2)*step,threat=intent.range&&Math.abs(i-b.E.pos)>=intent.range[0]&&Math.abs(i-b.E.pos)<=intent.range[1];
        ctx.save();ctx.globalAlpha=.6;ctx.fillStyle=threat?'#db6b48':'#85bf8a';ctx.fillRect(x-step*.38,ground+2,step*.76,3);ctx.restore();
      }
      if(queue.some(q=>q.group==='move')){const px=baseX+(predicted()-2)*step;ctx.save();ctx.globalAlpha=.4;G.chars.draw(ctx,'hero',b.P.pos<b.E.pos?'right':'left',0,px,ground-1);ctx.restore();}
      if(help){
        U.panel(ctx,6,66,W-12,Math.max(72,top-72),'scroll');
        const text='1. Посмотри намерение врага. 2. Выбери действие и нажми «В план +». Можно добавить второе. 3. Нажми «В бой!». Враг тоже действует по шкале времени. Изменились условия - план остановится. Подмена и печати выполняются во время атаки. Клавиатура: стрелки, A, B; M - раздел.';
        F.wrap(text,W-30).slice(0,Math.floor((top-82)/11)).forEach((s,i)=>F.draw(ctx,s,15,76+i*11,{color:U.C.ink}));
      }
    };
    return b;
  });
})();
