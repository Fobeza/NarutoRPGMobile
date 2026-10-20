// Учебные мини-шоги 3×4: король, ладья, слон и пешка; взятые фигуры возвращаются на доску.
G.miniShogi = (() => {
  const names={K:'Король',R:'Ладья',B:'Слон',P:'Пешка',G:'Золото'},value={K:1000,R:5,B:4,P:2,G:5};
  function initial(){return{board:[{s:-1,k:'B'},{s:-1,k:'K'},{s:-1,k:'R'},null,{s:-1,k:'P'},null,null,{s:1,k:'P'},null,{s:1,k:'R'},{s:1,k:'K'},{s:1,k:'B'}],hands:{'1':[],'-1':[]},turn:1,ply:0,winner:0};}
  function clone(s){return{...s,board:s.board.map(p=>p?{...p}:null),hands:{'1':[...s.hands[1]],'-1':[...s.hands[-1]]}};}
  function dirs(p){const f=-p.s;return p.k==='K'?[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]:p.k==='R'?[[1,0],[-1,0],[0,1],[0,-1]]:p.k==='B'?[[1,1],[-1,1],[1,-1],[-1,-1]]:p.k==='G'?[[1,0],[-1,0],[0,1],[0,-1],[1,f],[-1,f]]:[[0,f]];}
  function attacked(s,at,side){return s.board.some((p,i)=>p&&p.s===side&&dirs(p).some(([dx,dy])=>i%3+dx===at%3&&Math.floor(i/3)+dy===Math.floor(at/3)));}
  function apply(s,m){const n=clone(s),p=m.drop?{s:s.turn,k:m.drop}:n.board[m.from],target=n.board[m.to];
    if(m.drop){const i=n.hands[s.turn].indexOf(m.drop);if(i<0)return null;n.hands[s.turn].splice(i,1);}else n.board[m.from]=null;
    if(target){if(target.k==='K')n.winner=s.turn;else n.hands[s.turn].push(target.k==='G'?'P':target.k);}
    n.board[m.to]=p;
    if(p.k==='P'&&Math.floor(m.to/3)===(p.s===1?0:3))p.k='G';
    if(p.k==='K'&&Math.floor(m.to/3)===(p.s===1?0:3)&&!attacked(n,m.to,-p.s))n.winner=p.s;
    n.turn=-s.turn;n.ply++;return n;
  }
  function moves(s){if(s.winner)return[];const out=[];
    s.board.forEach((p,i)=>{if(!p||p.s!==s.turn)return;for(const [dx,dy]of dirs(p)){const x=i%3+dx,y=Math.floor(i/3)+dy;if(x<0||x>2||y<0||y>3)continue;const to=y*3+x;if(s.board[to]?.s!==p.s)out.push({from:i,to});}});
    for(const k of new Set(s.hands[s.turn]))for(let i=0;i<12;i++)if(!s.board[i]&&!(k==='P'&&Math.floor(i/3)===(s.turn===1?0:3)))out.push({drop:k,to:i});
    return out.filter(m=>{const n=apply(s,m),king=n.board.findIndex(p=>p?.s===s.turn&&p.k==='K');return king>=0&&!attacked(n,king,-s.turn);});
  }
  function evaluate(s){if(s.winner)return s.winner*10000;let score=0;for(let i=0;i<12;i++){const p=s.board[i];if(p)score+=p.s*(value[p.k]+(p.s===1?3-Math.floor(i/3):Math.floor(i/3))*.15);}for(const side of [1,-1])for(const k of s.hands[side])score+=side*value[k]*.8;return score;}
  function search(s,depth,alpha=-Infinity,beta=Infinity){const list=moves(s);if(depth===0||s.winner||!list.length)return s.winner?evaluate(s):!list.length?-s.turn*9000:evaluate(s);let best=s.turn===1?-Infinity:Infinity;for(const m of list){const v=search(apply(s,m),depth-1,alpha,beta);if(s.turn===1){best=Math.max(best,v);alpha=Math.max(alpha,v);}else{best=Math.min(best,v);beta=Math.min(beta,v);}if(beta<=alpha)break;}return best;}
  function ai(s){let best=Infinity,pick=null;for(const m of moves(s)){const score=search(apply(s,m),2);if(score<best){best=score;pick=m;}}return pick;}
  return{initial,moves,apply,ai,attacked,names};
})();

G.scenes.register('shogi',()=>{
  const M=G.miniShogi;let state=M.initial(),selected=null,hand=null,cursor=10,wait=.4,result='',rewarded=false;const repeats=new Map();
  function geom(){const size=Math.min(52,Math.floor((G.screen.W-36)/3),Math.floor((G.screen.H-180)/4)),x=(G.screen.W-size*3)/2;return{size,x,y:65};}
  function finish(text,win){result=text;if(!rewarded){rewarded=true;G.game.advance(15);if(win&&!G.state.daily.adv_shogi){G.state.daily.adv_shogi=1;G.friends.add('shikamaru',2);G.train.addXp('know',3);}G.adventure.save();}}
  function play(m){const legal=M.moves(state).find(a=>a.to===m.to&&a.from===m.from&&a.drop===m.drop);if(!legal)return false;state=M.apply(state,legal);selected=null;hand=null;wait=.45;
    if(state.winner)finish(state.winner===1?'Победа! Шикамару одобрительно кивает.':'Шикамару выиграл. Попробуй другую тактику.',state.winner===1);
    else if(!M.moves(state).length)finish(state.turn===1?'Нет допустимых ходов. Шикамару победил.':'У соперника нет ходов. Ты победил!',state.turn===-1);
    else {const key=JSON.stringify([state.board,state.hands,state.turn]),n=(repeats.get(key)||0)+1;repeats.set(key,n);if(n>=3||state.ply>=100)finish('Ничья. Позиция повторилась или достигнут лимит ходов.',false);}return true;}
  function select(i){if(result||state.turn!==1)return;if(hand){play({drop:hand,to:i});return;}if(state.board[i]?.s===1){selected=i;return;}if(selected!=null)play({from:selected,to:i});}
  function rules(){G.dialog.say([{text:'Учебные мини-шоги: доска 3 на 4. Все фигуры ходят на одну клетку. Король — во все стороны; ладья — прямо; слон — по диагонали; пешка — вперёд.'},{text:'На дальнем ряду пешка становится золотом: прямо, вбок, назад и по диагонали вперёд. Взятые фигуры можно выставлять на пустую клетку кнопками под доской.'},{text:'Победи, взяв короля или безопасно доведя своего на дальний ряд. Нельзя оставлять короля под ударом. A выбирает фигуру и клетку, стрелки двигают курсор. B — выйти.'}],{bottom:20});}
  return{name:'shogi',touch:()=>({back:true}),state:()=>state,play,
    update(dt){const I=G.input,g=geom();if(I.pressed('b')||I.pressed('menu')){G.scenes.pop();return;}
      if(!result&&state.turn===-1){wait-=dt;if(wait<=0){const m=M.ai(state);if(m)play(m);else finish('У соперника нет ходов. Ты победил!',true);}return;}
      if(I.repeat('left',dt))cursor=cursor%3?cursor-1:cursor+2;if(I.repeat('right',dt))cursor=cursor%3<2?cursor+1:cursor-2;if(I.repeat('up',dt))cursor=(cursor+9)%12;if(I.repeat('down',dt))cursor=(cursor+3)%12;
      if(I.pressed('a'))select(cursor);
      if(I.tapNow){const t=I.tapNow,x=Math.floor((t.x-g.x)/g.size),y=Math.floor((t.y-g.y)/g.size);if(x>=0&&x<3&&y>=0&&y<4){cursor=y*3+x;select(cursor);}
        else if(t.y>g.y+4*g.size+4&&t.y<g.y+4*g.size+32){const hs=[...new Set(state.hands[1])],j=Math.floor((t.x-8)/((G.screen.W-16)/Math.max(1,hs.length)));if(hs[j]){hand=hs[j];selected=null;}}
        else if(t.y>G.screen.H-40){if(t.x<G.screen.W/2)rules();else{state=M.initial();result='';rewarded=false;selected=hand=null;repeats.clear();}}
      }
      if(I.pressed('goal')){const hs=[...new Set(state.hands[1])];if(hs.length){hand=hs[(hs.indexOf(hand)+1)%hs.length];selected=null;}}
    },
    draw(ctx){const U=G.ui,F=G.font.small,W=G.screen.W,H=G.screen.H,g=geom();U.backdrop(ctx);U.title(ctx,'МИНИ-ШОГИ',W/2,9,112);
      F.draw(ctx,result?'Партия завершена':state.turn===1?'Твой ход · выбери фигуру':'Шикамару думает...',W/2,42,{align:'center',color:'#f4d46a'});
      const targets=M.moves(state).filter(m=>hand?m.drop===hand:m.from===selected).map(m=>m.to);
      for(let i=0;i<12;i++){const x=g.x+i%3*g.size,y=g.y+Math.floor(i/3)*g.size,p=state.board[i];U.card(ctx,x,y,g.size-2,g.size-2,i===selected||i===cursor);if(targets.includes(i)){ctx.fillStyle='#518d70';ctx.beginPath();ctx.arc(x+g.size/2,y+g.size/2,3,0,7);ctx.fill();}
        if(p){ctx.save();ctx.translate(x+g.size/2,y+g.size/2);if(p.s===-1)ctx.rotate(Math.PI);ctx.fillStyle=p.s===1?'#e4c888':'#c49d6b';ctx.beginPath();ctx.moveTo(0,-g.size*.34);ctx.lineTo(g.size*.3,-g.size*.2);ctx.lineTo(g.size*.34,g.size*.3);ctx.lineTo(-g.size*.34,g.size*.3);ctx.lineTo(-g.size*.3,-g.size*.2);ctx.closePath();ctx.fill();G.font.draw(ctx,{K:'К',R:'Л',B:'С',P:'П',G:'З'}[p.k],0,-4,{align:'center',color:p.k==='G'?'#a32b24':'#302119'});ctx.restore();}}
      const by=g.y+4*g.size+6,hs=[...new Set(state.hands[1])];if(hs.length)hs.forEach((k,i)=>{const bw=(W-16)/hs.length;U.button(ctx,8+i*bw,by,bw-3,24,M.names[k]+' '+state.hands[1].filter(a=>a===k).length,hand===k?'sel':'normal');});else F.draw(ctx,'Взятые фигуры появятся здесь',W/2,by+7,{align:'center',color:'#cfbc93'});
      if(result)F.wrap(result,W-24).slice(0,2).forEach((l,i)=>F.draw(ctx,l,12,by+35+i*12,{color:'#f4d46a'}));
      else F.draw(ctx,hand?'Выставить: '+M.names[hand]:'G — выбрать взятую фигуру',W/2,by+36,{align:'center',color:'#cfbc93'});
      U.button(ctx,8,H-30,W/2-12,23,'Правила');U.button(ctx,W/2+4,H-30,W/2-12,23,'Заново');
    },
  };
});
