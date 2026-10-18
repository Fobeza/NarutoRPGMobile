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

  return {
    name: 'journal',
    update(dt) {
      const I = G.input;
      if (toastT > 0) { toastT -= dt; if (toastT <= 0) toast = null; }
      if (detail) {
        if (I.pressed('b') || I.pressed('menu')) { G.audio.sfx.cancel(); detail = null; return; }
        if (I.pressed('a') || (I.tapNow && I.tapNow.y > G.screen.H - 20 && I.tapNow.x < G.screen.W / 2)) {
          if (G.quests.active(detail)) { G.quests.track(detail); G.audio.sfx.confirm(); toast = 'Отслеживается ★'; toastT = 1.3; }
          else G.audio.sfx.error();
        } else if (I.tapNow && I.tapNow.y > G.screen.H - 20) { G.audio.sfx.cancel(); detail = null; }
        return;
      }
      const L = items();
      if (I.pressed('b') || I.pressed('menu')) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
      if (I.pressed('left') || I.pressed('right')) { tab = 1 - tab; idx = 0; top = 0; G.audio.sfx.select(); return; }
      if (I.tapNow) {
        const t = I.tapNow;
        if (t.y < 30 && t.y > 14) { const nt = t.x < G.screen.W / 2 ? 0 : 1; if (nt !== tab) { tab = nt; idx = 0; top = 0; G.audio.sfx.select(); } return; }
        if (t.y > G.screen.H - 20) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
        const i = top + Math.floor((t.y - 38) / 14);
        if (i >= 0 && i < L.length) { idx = i; detail = L[i]; G.audio.sfx.confirm(); }
        return;
      }
      if (!L.length) return;
      if (I.repeat('up', dt)) { idx = (idx + L.length - 1) % L.length; G.audio.sfx.select(); }
      if (I.repeat('down', dt)) { idx = (idx + 1) % L.length; G.audio.sfx.select(); }
      if (I.pressed('a')) { detail = L[idx]; G.audio.sfx.confirm(); }
    },

    draw(ctx) {
      const W = G.screen.W, H = G.screen.H, F = G.font, P = G.PAL;
      ctx.fillStyle = '#1e1a28'; ctx.fillRect(0, 0, W, H);
      F.draw(ctx, 'ЗАДАНИЯ', W / 2, 4, { align: 'center', color: P.orange });

      if (detail) return this.drawDetail(ctx, detail);

      // вкладки
      TABS.forEach((t, i) => {
        const x = i * (W / 2), sel = i === tab;
        ctx.fillStyle = sel ? '#3a3450' : '#24202e'; ctx.fillRect(x + 2, 15, W / 2 - 4, 14);
        F.draw(ctx, t, x + W / 4, 18, { align: 'center', color: sel ? P.white : P.gray });
      });
      const L = items();
      const rows = Math.floor((H - 20 - 36) / 14);
      if (idx < top) top = idx;
      if (idx >= top + rows) top = idx - rows + 1;
      if (!L.length) F.draw(ctx, tab === 0 ? 'Нет активных заданий' : 'Пока пусто', W / 2, 60, { align: 'center', color: P.gray });
      const tracked = G.quests.tracked();
      for (let r = 0; r < rows && top + r < L.length; r++) {
        const id = L[top + r], d = G.QUESTS[id], cat = G.QUEST_CATS[d.cat], s = G.quests.state(id);
        const y = 36 + r * 14, sel = top + r === idx;
        ctx.fillStyle = sel ? '#3a3450' : '#24202e'; ctx.fillRect(2, y, W - 4, 13);
        F.draw(ctx, cat.icon, 6, y + 3, { color: cat.color });
        let title = d.title;
        while (F.measure(title) > W - 44 && title.length > 4) title = title.slice(0, -2) + '…';
        F.draw(ctx, title, 17, y + 3, { color: s.st === 'failed' ? '#a05a50' : s.st === 'done' ? P.gray : P.white });
        const mark = id === tracked ? '★' : s.st === 'done' ? '✔' : s.st === 'failed' ? '×' : '';
        F.draw(ctx, mark, W - 7, y + 3, { align: 'right', color: id === tracked ? P.yellow : P.gray });
      }
      G.gfx.window(ctx, 2, H - 19, W - 4, 17, 'dark');
      F.draw(ctx, '< > вкладки  (A) открыть  (B) назад', W / 2, H - 14, { align: 'center', color: P.light });
    },

    drawDetail(ctx, id) {
      const W = G.screen.W, H = G.screen.H, F = G.font, P = G.PAL;
      const d = G.QUESTS[id], cat = G.QUEST_CATS[d.cat], s = G.quests.state(id);
      G.gfx.window(ctx, 2, 15, W - 4, H - 37, 'paper');
      let y = 20;
      F.draw(ctx, cat.icon + ' ' + cat.name, 8, y, { color: cat.color }); y += 11;
      for (const ln of F.wrap(d.title, W - 16)) { F.draw(ctx, ln, 8, y, { color: P.ink }); y += 11; }
      y += 2;
      for (const ln of F.wrap(d.desc, W - 16)) { F.draw(ctx, ln, 8, y, { color: P.gray }); y += 10; }
      y += 4;
      for (const v of stepsView(id)) {
        const txt = v.future ? '…' : v.st.text;
        const mark = v.done ? '✔' : v.cur ? '▶' : '·';
        const col = v.done ? '#5a8a4a' : v.cur ? P.ink : '#a89a80';
        const lines = F.wrap(txt, W - 30);
        F.draw(ctx, mark, 9, y, { color: v.done ? '#5a8a4a' : P.orange });
        lines.forEach((ln) => { F.draw(ctx, ln, 19, y, { color: col }); y += 10; });
        if (v.cur && v.st.time) {
          const ok = G.quests.timeOk(v.st);
          F.draw(ctx, `⏰ ${G.game.clock(v.st.time[0])}–${G.game.clock(v.st.time[1] % 1440)}${ok ? '' : ' (сейчас нельзя)'}`, 19, y, { color: ok ? '#5a7a9a' : '#b05a4a' }); y += 10;
        }
        y += 2;
      }
      y += 3;
      if (s.due != null && s.st === 'active') {
        const left = s.due - G.state.vars.day;
        F.draw(ctx, `Срок: до конца дня ${s.due} (${G.game.dayName(s.due)})${left === 0 ? ' — сегодня!' : ''}`, 8, y, { color: left === 0 ? '#c04a3a' : P.gray }); y += 11;
      }
      if (d.reward && d.reward.text) { F.draw(ctx, 'Награда: ' + d.reward.text, 8, y, { color: '#8a6a10' }); y += 11; }
      const st = { active: 'Активно', done: 'Выполнено ✔', failed: 'Провалено' }[s.st];
      F.draw(ctx, st + (G.quests.tracked() === id ? ' · ★ отслеживается' : ''), 8, H - 36, { color: s.st === 'failed' ? '#c04a3a' : '#5a8a4a' });
      G.gfx.window(ctx, 2, H - 19, W - 4, 17, 'dark');
      F.draw(ctx, s.st === 'active' ? '(A) Отслеживать   (B) Назад' : '(B) Назад', W / 2, H - 14, { align: 'center', color: P.light });
      if (toast) {
        const w = F.measure(toast) + 12;
        G.gfx.window(ctx, Math.round((W - w) / 2), H - 56, w, 16, 'dark');
        F.draw(ctx, toast, W / 2, H - 52, { align: 'center', color: P.yellow });
      }
    },
  };
});
