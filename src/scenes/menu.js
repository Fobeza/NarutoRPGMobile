// Меню паузы (кнопка МЕНЮ): задания, календарь, статус, сумка, персонажи, настройки (scenes/settings.js), сохранение.
// Окно — свиток «Свитки и дерево» (G.ui.menu).
G.scenes.register('menu', () => {
  let idx = 0;
  let first = 0;
  // Размер строки считается в CSS-пикселях, а не в точках игрового холста.
  function layout() {
    const sc=G.screen.scale||1,z=sc<1.25?2:1,row=Math.max(22,Math.ceil(44/sc));
    const header=24*z,n=items().length,available=G.screen.H-header-24;
    const paged=n*row>available,rows=Math.max(1,Math.min(n,Math.floor(available/row)-(paged?1:0)));
    const w=Math.min(G.screen.W-12,Math.max(156*z,Math.ceil(280/sc))),h=header+rows*row+(paged?row:0)+12;
    const x=Math.floor((G.screen.W-w)/2),y=Math.max(12,Math.floor((G.screen.H-h)/2));
    return {x,y,w,h,row,rows,z,top:y+header,paged};
  }
  function reveal(g){first=G.util.clamp(first,Math.max(0,idx-g.rows+1),idx);first=Math.min(first,items().length-g.rows);}
  const items = () => [
    { label: 'Продолжить', act: () => G.scenes.pop() },
    { label: 'Задания', act: () => G.scenes.push(G.scenes.make('journal')) },
    { label: 'Календарь', act: () => G.scenes.push(G.scenes.make('calendar')) },
    { label: 'Статус', act: () => G.scenes.push(G.scenes.make('status')) },
    { label: 'Колода', act: () => G.scenes.push(G.scenes.make('deckview')) },
    { label: 'История', act: () => G.scenes.push(G.scenes.make('log')) },
    { label: 'Сумка', act: () => G.scenes.push(G.scenes.make('bag')) },
    { label: 'Колода', act: () => G.scenes.push(G.scenes.make('deckview')) },
    { label: 'Персонажи', act: () => G.scenes.push(G.scenes.make('gallery')) },
    { label: 'Жители и дома', act: () => { G.scenes.pop(); const w = G.scenes.top(); G.residents.menu(w); } },
    { label: 'Настройки', act: () => G.scenes.push(G.scenes.make('settings')) },
    { label: 'Сохранение', act: () => G.scenes.push(G.scenes.make('savemenu')) },
    { label: 'В главное меню', act: () => {
      // «Продолжить» грузит слот — без сохранения тут пропали бы последние награды и позиция
      const w = G.scenes.stack.find((q) => q.name === 'world');
      if (w && w.savePos) w.savePos();
      if (G.state.started) G.storage.save(G.state);
      G.scenes.fadeTo(G.scenes.make('title'));
    } },
  ];

  return {
    name: 'menu',
    transparent: true,
    labels() { return items().map((x) => x.label); },
    layout,
    visibleRows() { const g=layout();reveal(g);return items().slice(first,first+g.rows).map((it,i)=>({label:it.label,index:first+i,x:g.x+6,y:g.top+i*g.row,w:g.w-12,h:g.row})); },   // для тестов: выбор пункта по подписи, а не по счёту
    update(dt) {
      const I = G.input;
      const list = items();
      if (I.repeat('up', dt)) { idx = (idx + list.length - 1) % list.length; G.audio.sfx.select(); }
      if (I.repeat('down', dt)) { idx = (idx + 1) % list.length; G.audio.sfx.select(); }
      if (I.pressed('b') || I.pressed('menu')) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
      if (I.tapNow) {
        const g=layout();reveal(g);const t=I.tapNow;
        const hit=this.visibleRows().find(r=>t.x>=r.x&&t.x<r.x+r.w&&t.y>=r.y&&t.y<r.y+r.h);
        if(hit){idx=hit.index;G.audio.sfx.confirm();list[idx].act();}
        else if(g.paged&&t.x>=g.x+6&&t.x<g.x+g.w-6&&t.y>=g.top+g.rows*g.row&&t.y<g.top+(g.rows+1)*g.row){
          idx=G.util.clamp(idx+(t.x<g.x+g.w/2?-g.rows:g.rows),0,list.length-1);reveal(g);G.audio.sfx.select();
        }
        return;
      }
      if (I.pressed('a')) { G.audio.sfx.confirm(); list[idx].act(); }
    },
    draw(ctx) {
      const U=G.ui,g=layout();reveal(g);
      ctx.save();ctx.globalAlpha*=.65;ctx.fillStyle='#0a0604';ctx.fillRect(0,0,G.screen.W,G.screen.H);ctx.restore();
      U.panel(ctx,g.x,g.y,g.w,g.h,'frame');U.title(ctx,'МЕНЮ',G.screen.W/2,g.y-7,0);
      this.visibleRows().forEach(r=>{
        const selected=r.index===idx;U.row(ctx,r.x,r.y+1,r.w,r.h-2,selected);
        ctx.save();ctx.translate(r.x+8,r.y+Math.floor((r.h-G.font.CAP*g.z)/2));ctx.scale(g.z,g.z);
        G.font.draw(ctx,r.label,0,0,{color:selected?'#f8eed0':U.C.ink,shadow:selected?'#5a1408':null,maxW:(r.w-16)/g.z});ctx.restore();
      });
      if(g.paged){const y=g.top+g.rows*g.row,bw=(g.w-14)/2;
        U.button(ctx,g.x+6,y,bw,g.row,'▲ Выше',first>0?'normal':'dis');
        U.button(ctx,g.x+8+bw,y,bw,g.row,'▼ Ниже',first+g.rows<items().length?'normal':'dis');
      }
    },
  };
});
