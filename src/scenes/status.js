// Статус героя (меню → «Статус»): нужды, характеристики, навыки, дружба, день и погода.
G.scenes.register('status', () => {
  const FRIENDS = Object.keys(G.FRIENDS);
  let scroll = 0;
  let buffer = null;
  const header=()=>G.touch.header();
  const compact = () => G.screen.W < 260;
  const footer = () => Math.max(24,Math.ceil(44/(G.screen.scale||1)))+4;
  const contentH = () => {
    const skills=(G.state.hero.skills||[]).map(id=>G.SKILLS.find(s=>s.id===id)?.name).filter(Boolean).join(', ')||'—';
    const extra=Math.max(0,G.font.small.wrap('Навыки: '+skills,G.screen.W-24).length-1)*12;
    return Math.max(G.screen.H-footer(),330+header().height-20+(compact()?60:0)+extra+Math.ceil(FRIENDS.filter(id=>G.state.flags['met_'+id]).length/2)*16);
  };
  const maxScroll = () => Math.max(0, contentH() - G.screen.H + footer());
  return {
    name: 'status',touch(){return {back:true,roomyBack:true};},
    layout() { return {footer:footer(),maxScroll:maxScroll(),scroll,gaugeWidth:compact()?G.screen.W-28:G.screen.W-180}; },
    update(dt) {
      const I = G.input;
      if (I.pressed('b') || I.pressed('a') || I.pressed('menu')) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
      if (I.repeat('up', dt)) scroll -= 48;
      if (I.repeat('down', dt)) scroll += 48;
      if (I.tapNow && I.tapNow.y >= G.screen.H-footer() && maxScroll()>0) { scroll += I.tapNow.x < G.screen.W/2 ? -80 : 80;G.audio.sfx.select(); }
      scroll = G.util.clamp(scroll, 0, maxScroll());
    },
    draw(ctx) {
      const W = G.screen.W, H = G.screen.H, U = G.ui;
      scroll = G.util.clamp(scroll, 0, maxScroll());
      if (!buffer || buffer.lw !== W || buffer.lh !== contentH()) buffer = G.gfx.canvas(W, contentH());
      const c = buffer;
      this.drawContent(c.getContext('2d'), contentH());
      U.backdrop(ctx);
      ctx.save(); ctx.beginPath(); ctx.rect(0, header().height, W, H - header().height - footer()); ctx.clip(); ctx.drawImage(c, 0, -scroll); ctx.restore();
      U.title(ctx, 'СТАТУС', header().titleX, header().titleY, 80);
      if(maxScroll()>0){
        U.button(ctx,4,H-footer()+2,(W-12)/2,footer()-4,'▲ Выше',scroll>0?'normal':'dis');
        U.button(ctx,W/2+2,H-footer()+2,(W-12)/2,footer()-4,'▼ Ниже',scroll<maxScroll()?'normal':'dis');
        U.scrollbar(ctx,W-5,header().height+4,H-header().height-4-footer(),scroll/maxScroll(),Math.min(1,(H-header().height-footer())/(contentH()-header().height)));
      }else G.font.small.draw(ctx,'Все сведения',W/2,H-footer()/2-4,{align:'center',color:U.C.paperHi});
    },
    drawContent(ctx, H) {
      const W = G.screen.W, F = G.font, S = G.font.small, U = G.ui, C = U.C, g = G.game, v = g.v;
      U.backdrop(ctx);
      U.title(ctx, 'СТАТУС', header().titleX, header().titleY, 80);
      let y = header().height;
      // герой, неделя, дата и погода
      U.panel(ctx, 4, y, W - 8, 44, 'frame');
      F.draw(ctx, G.state.hero.name || 'Герой', 14, y + 9, { color: C.redDark, maxW: W - 34 - S.measure(`Неделя ${g.week()}`) });
      S.draw(ctx, `Неделя ${g.week()}`, W - 14, y + 11, { align: 'right', color: C.inkDim });
      const wt = G.life.WEATHER[G.life.weather()];
      // узкий экран («крупно»): время суток не влезает — без него, а не с обрезанным «У…»
      const when = [`${g.dayName()}, день ${v.day} · ${g.clock()} · ${G.life.period()}`, `${g.dayName()}, день ${v.day} · ${g.clock()}`].find((t) => S.measure(t) <= W - 90);
      S.draw(ctx, when || `${g.dayName()}, день ${v.day} · ${g.clock()}`, 14, y + 28, { color: C.inkDim, maxW: W - 90 });
      S.draw(ctx, wt.icon + ' ' + wt.name, W - 14, y + 28, { align: 'right', color: '#3a62a0' });
      y += 48;
      // нужды: бамбуковые шкалы
      const bars = [['Здоровье', v.hp, C.hp], ['Чакра', v.chakra, C.chakra], ['Усталость', v.fatigue, C.fatigue], ['Стабильность', G.purple.stability(), G.purple.COLOR]];
      const barRow=compact()?28:16;
      U.panel(ctx, 4, y, W - 8, bars.length * barRow + 12, 'frame');
      bars.forEach(([nm, val, col], i) => {
        const yy = y + 9 + i * barRow;
        S.draw(ctx, nm, 14, yy, { color: C.ink });
        const bw = compact()?W-28:W-180;
        U.gauge(ctx, compact()?14:96, yy + (compact()?12:1), bw, 7, Math.max(0, Math.min(100, val)) / 100, col);
        S.draw(ctx, String(Math.round(val)), W - 14, yy, { align: 'right', color: (i === 2 ? val > 80 : i === 3 ? false : val < 20) ? C.err : C.ink });
      });
      y += bars.length * barRow + 16;
      // характеристики
      const rows = Math.ceil(G.STATS.length / 2);
      U.panel(ctx, 4, y, W - 8, rows * 15 + 14, 'well');
      if (!G.hero.ready()) S.draw(ctx, 'Вступительный тест ещё не пройден', W / 2, y + 12, { align: 'center', color: C.inkDim });
      else G.STATS.forEach((st, i) => {
        const cw = Math.floor((W - 24) / 2), x = 12 + (i % 2) * cw, yy = y + 8 + Math.floor(i / 2) * 15;
        const sn = st.id === 'ctrl' ? 'Контроль' : st.name;
        S.draw(ctx, S.measure(sn) > cw - 30 && st.id === 'end' ? 'Выносл.' : sn, x, yy, { color: C.ink, maxW: cw - 30 });
        F.draw(ctx, String(G.hero.stat(st.id)), x + cw - 12, yy - 2, { align: 'right', color: C.redDark });
      });
      y += rows * 15 + 18;
      // навыки, Академия, дружба
      U.panel(ctx, 4, y, W - 8, H - y - 4, 'frame');
      let ty = y + 9;
      const sk = (G.state.hero.skills || []).map((id) => (G.SKILLS.find((s) => s.id === id) || {}).name).filter(Boolean);
      for (const ln of S.wrap('Навыки: ' + (sk.join(', ') || '—'), W - 24)) { S.draw(ctx, ln, 12, ty, { color: C.redDark }); ty += 12; }
      const A = G.academy, vv = G.state.vars;
      S.draw(ctx, `Оценки ${A.avg() || '—'} · посещ. ${A.attendance()}% · реп. ${vv.rep || 0}`, 12, ty, { color: '#3a62a0', maxW: W - 24 }); ty += 12;
      S.draw(ctx, `Экзамен через ${Math.max(0, 54 - vv.day)} дн. · свитки ${vv.scrolls || 0}`, 12, ty, { color: C.inkDim, maxW: W - 24 }); ty += 15;
      const met = FRIENDS.filter((id) => G.state.flags['met_' + id]);
      F.draw(ctx, 'Дружба', 12, ty, { color: C.redDark }); ty += 16;
      if (!met.length) S.draw(ctx, 'Пока ни с кем не знаком', 12, ty, { color: C.inkDim });
      met.forEach((id, i) => {
        const cw = Math.floor((W - 24) / 2), x = 12 + (i % 2) * cw, yy = ty + Math.floor(i / 2) * 13;
        if (yy > H - 18) return;
        const hn = Math.max(0, Math.min(5, G.friends.level(id)));
        S.draw(ctx, G.chars.nameOf(id), x, yy, { color: C.ink, maxW: cw - 44 });
        S.draw(ctx, '♥'.repeat(hn), x + cw - 12 - S.measure('·'.repeat(5 - hn)), yy, { align: 'right', color: C.red });
        S.draw(ctx, '·'.repeat(5 - hn), x + cw - 12, yy, { align: 'right', color: C.inkFaint });
      });
    },
  };
});

// Пауза при возвращении в игру после сворачивания Safari
G.scenes.register('pause', () => ({
  name: 'pause',
  transparent: true,
  t: 0,
  update(dt) {
    this.t += dt;
    const I = G.input;
    if (this.t > 0.3 && (I.pressed('a') || I.pressed('b') || I.pressed('menu') || I.tapNow)) { G.audio.sfx.confirm(); G.scenes.pop(); }
  },
  draw(ctx) {
    const W = G.screen.W, H = G.screen.H, F = G.font, U = G.ui, C = U.C;
    ctx.globalAlpha = 0.6; ctx.fillStyle = '#0a0604'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    U.panel(ctx, W / 2 - 70, H / 2 - 34, 140, 66, 'frame');
    F.draw(ctx, 'ПАУЗА', W / 2, H / 2 - 22, { align: 'center', color: C.redDark });
    F.small.draw(ctx, `${G.game.dayName()}, ${G.game.clock()}`, W / 2, H / 2 - 5, { align: 'center', color: C.inkDim });
    if (Math.floor(this.t * 2) % 2 === 0) F.small.draw(ctx, 'Коснись экрана', W / 2, H / 2 + 11, { align: 'center', color: C.ink });
  },
}));
