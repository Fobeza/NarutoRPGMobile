// Журнал заданий (§2.6): вкладки «Активные / Выполненные», подробности, выбор отслеживаемого.
G.scenes.register('journal', () => {
  let tab = 0, idx = 0, top = 0, detail = null, toast = null, toastT = 0;
  const TABS = ['Активные', 'Завершённые'];

  const items = () => {
    const Qs = G.quests;
    if (tab === 0) return Qs.activeList();
    return Qs.list().filter((id) => !Qs.active(id)).reverse();
  };

  function stepsView(id) {
    const d = G.QUESTS[id], s = G.quests.state(id);
    return d.steps.map((st, i) => ({ st, done: i < s.step || s.st === 'done', cur: s.st === 'active' && i === s.step, future: s.st === 'active' && i > s.step }));
  }

  const offset=()=>G.touch.header().height-20;
  const buttonH=()=>Math.max(26,Math.ceil(44/(G.screen.scale||1)));
  const ROW = 18, LIST_Y = 44;
  const listH = () => G.screen.H - offset() - LIST_Y - 6;
  const rowsN = () => Math.floor((listH() - 12) / ROW);
  const btnRects = () => { const W = G.screen.W, H = G.screen.H-offset(), bh=buttonH(), bw = Math.round((W - 14) / 2); return { track: { x: 4, y: H - bh - 4, w: bw, h: bh }, back: { x: 4 + bw + 6, y: H - bh - 4, w: bw, h: bh } }; };
  const inR = (t, r) => t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.h;

  return {
    name: 'journal',touch(){return {back:true,roomyBack:true};},
    update(dt) {
      const I = G.input, tap=I.tapNow&&{x:I.tapNow.x,y:I.tapNow.y-offset()};
      if (toastT > 0) { toastT -= dt; if (toastT <= 0) toast = null; }
      if (detail) {
        const B = btnRects();
        const track = () => { if (G.quests.active(detail)) { G.quests.track(detail); G.audio.sfx.confirm(); toast = 'Отслеживается ★'; toastT = 1.3; } else G.audio.sfx.error(); };
        if (I.pressed('b') || I.pressed('menu')) { G.audio.sfx.cancel(); detail = null; return; }
        if (I.pressed('a')) { track(); return; }
        if (I.tapNow) { if (inR(tap, B.track)) track(); else if (inR(tap, B.back)) { G.audio.sfx.cancel(); detail = null; } }
        return;
      }
      const L = items();
      if (I.pressed('b') || I.pressed('menu')) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
      if (I.pressed('left') || I.pressed('right')) { tab = 1 - tab; idx = 0; top = 0; G.audio.sfx.select(); return; }
      if (I.tapNow) {
        const t = tap;
        if (t.y < LIST_Y - 2 && t.y > 18) { const nt = t.x < G.screen.W / 2 ? 0 : 1; if (nt !== tab) { tab = nt; idx = 0; top = 0; G.audio.sfx.select(); } return; }
        const i = top + Math.floor((t.y - LIST_Y - 6) / ROW);
        if (t.y > LIST_Y + 4 && i >= 0 && i < L.length) { idx = i; detail = L[i]; G.audio.sfx.confirm(); }
        return;
      }
      if (!L.length) return;
      if (I.repeat('up', dt)) { idx = (idx + L.length - 1) % L.length; G.audio.sfx.select(); }
      if (I.repeat('down', dt)) { idx = (idx + 1) % L.length; G.audio.sfx.select(); }
      if (I.pressed('a')) { detail = L[idx]; G.audio.sfx.confirm(); }
    },

    draw(ctx) {
      const W = G.screen.W, H = G.screen.H-offset(), F = G.font, U = G.ui, C = U.C;
      U.backdrop(ctx);
      const g=G.touch.header();U.title(ctx, 'ЗАДАНИЯ', g.titleX, g.titleY, 90);
      ctx.save();ctx.translate(0,offset());
      if (detail) {this.drawDetail(ctx, detail);ctx.restore();return;}

      // вкладки
      TABS.forEach((t, i) => U.tab(ctx, 4 + i * (W / 2 - 2), 21, W / 2 - 6, 20, t, i === tab));
      const L = items(), rows = rowsN();
      U.panel(ctx, 4, LIST_Y, W - 8, listH(), 'frame');
      if (idx < top) top = idx;
      if (idx >= top + rows) top = idx - rows + 1;
      if (!L.length) F.draw(ctx, tab === 0 ? 'Нет активных заданий' : 'Пока пусто', W / 2, LIST_Y + 24, { align: 'center', color: C.inkDim });
      const tracked = G.quests.tracked();
      for (let r = 0; r < rows && top + r < L.length; r++) {
        const id = L[top + r], d = G.QUESTS[id], cat = G.QUEST_CATS[d.cat], s = G.quests.state(id);
        const y = LIST_Y + 7 + r * ROW, sel = top + r === idx;
        U.row(ctx, 9, y, W - 18, ROW - 2, sel);
        F.draw(ctx, cat.icon, 14, y + 3, { color: sel ? '#f8eed0' : C.redDark });
        const col = sel ? '#f8eed0' : s.st === 'failed' ? '#a05a50' : s.st === 'done' ? C.inkFaint : C.ink;
        F.draw(ctx, d.title, 28, y + 3, { color: col, shadow: sel ? '#5a1408' : null, maxW: W - 66 });
        const mark = id === tracked ? '★' : s.st === 'done' ? '✔' : s.st === 'failed' ? '×' : '';
        F.draw(ctx, mark, W - 16, y + 3, { align: 'right', color: id === tracked ? '#f4d46a' : C.inkFaint, shadow: sel ? '#5a1408' : null });
      }
      if (top > 0) F.small.draw(ctx, '▲', W - 18, LIST_Y + 9, { color: C.red });
      if (top + rows < L.length) F.small.draw(ctx, '▼', W - 18, LIST_Y + listH() - 18, { color: C.red });
      ctx.restore();
    },

    drawDetail(ctx, id) {
      const W = G.screen.W, H = G.screen.H-offset(), F = G.font, U = G.ui, C = U.C;
      const d = G.QUESTS[id], cat = G.QUEST_CATS[d.cat], s = G.quests.state(id);
      U.panel(ctx, 4, 22, W - 8, H - buttonH() - 32, 'frame');
      const x0 = 14, tw = W - 28;
      let y = 32;
      F.draw(ctx, cat.icon + ' ' + cat.name, x0, y, { color: C.redDark }); y += 15;
      for (const ln of F.wrap(d.title, tw)) { F.draw(ctx, ln, x0, y, { color: C.ink }); y += 14; }
      y += 2;
      for (const ln of F.small.wrap(d.desc, tw)) { F.small.draw(ctx, ln, x0, y, { color: C.inkDim }); y += 12; }
      y += 6;
      for (const v of stepsView(id)) {
        const txt = v.future ? '…' : v.st.text;
        const mark = v.done ? '✔' : v.cur ? '▶' : '·';
        const col = v.done ? C.ok : v.cur ? C.ink : C.inkFaint;
        F.small.draw(ctx, mark, x0, y, { color: v.done ? C.ok : C.red });
        F.small.wrap(txt, tw - 16).forEach((ln) => { F.small.draw(ctx, ln, x0 + 14, y, { color: col }); y += 12; });
        if (v.cur && v.st.time) {
          const ok = G.quests.timeOk(v.st);
          F.small.draw(ctx, `⏰ ${G.game.clock(v.st.time[0])}–${G.game.clock(v.st.time[1] % 1440)}${ok ? '' : ' (сейчас нельзя)'}`, x0 + 14, y, { color: ok ? '#3a62a0' : '#b8321c' }); y += 12;
        }
        y += 3;
      }
      y += 3;
      if (s.due != null && s.st === 'active') {
        const left = s.due - G.state.vars.day;
        F.small.draw(ctx, `Срок: до конца дня ${s.due} (${G.game.dayName(s.due)})${left === 0 ? ' — сегодня!' : ''}`, x0, y, { color: left === 0 ? C.err : C.inkDim }); y += 13;
      }
      if (d.reward && d.reward.text) { F.small.draw(ctx, 'Награда: ' + d.reward.text, x0, y, { color: '#8a5a10', maxW: tw }); y += 13; }
      const st = { active: 'Активно', done: 'Выполнено ✔', failed: 'Провалено' }[s.st];
      F.small.draw(ctx, st + (G.quests.tracked() === id ? ' · ★ отслеживается' : ''), x0, H - buttonH() - 22, { color: s.st === 'failed' ? C.err : C.ok });
      const B = btnRects();
      U.button(ctx, B.track.x, B.track.y, B.track.w, B.track.h, 'Отслеживать', s.st === 'active' ? 'sel' : 'dis');
      U.button(ctx, B.back.x, B.back.y, B.back.w, B.back.h, 'Назад', 'normal');
      if (toast) {
        const w = F.measure(toast) + 22;
        U.panel(ctx, Math.round((W - w) / 2), H - buttonH() - 52, w, 19, 'night');
        F.draw(ctx, toast, W / 2, H - buttonH() - 47, { align: 'center', color: '#f4d46a' });
      }
    },
  };
});
