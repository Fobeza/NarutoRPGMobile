// Вступительный тест у Ируки (план §3): распределить 12 очков по 8 характеристикам (база 3, максимум 7)
// и выбрать 2 стартовых навыка из 9. onDone() — продолжение сюжета.
G.scenes.register('charcreate', (onDone) => {
  const B = G.STAT_BASE, MAX = G.STAT_MAX_START;
  const vals = {}; for (const s of G.STATS) vals[s.id] = B;
  const picked = [];
  let page = 0, idx = 0, msg = null, msgT = 0, confirm = false;
  const left = () => G.STAT_POINTS - G.STATS.reduce((a, s) => a + vals[s.id] - B, 0);
  const ROW = 13, TOP = 30;
  const say = (t) => { msg = t; msgT = 1.6; };

  const S = {
    name: 'charcreate',
    // для автотеста и кнопки «Случайно»
    finish(stats, skills) {
      G.state.hero.stats = Object.assign({}, vals, stats || {});
      G.state.hero.skills = (skills || picked).slice(0, 2);
      G.game.note('Вступительный тест пройден');
      G.scenes.pop();
      onDone && onDone();
    },
    randomize() {
      for (const s of G.STATS) vals[s.id] = B;
      let n = G.STAT_POINTS;
      while (n > 0) { const s = G.STATS[Math.floor(Math.random() * G.STATS.length)]; if (vals[s.id] < MAX) { vals[s.id]++; n--; } }
    },
    rows() { return page === 0 ? G.STATS.length + 2 : G.SKILLS.length + 1; },

    change(d) {
      const s = G.STATS[idx];
      if (!s) return;
      if (d > 0 && (left() <= 0 || vals[s.id] >= MAX)) { G.audio.sfx.error(); say(left() <= 0 ? 'Очки закончились' : `Максимум на старте — ${MAX}`); return; }
      if (d < 0 && vals[s.id] <= B) { G.audio.sfx.error(); return; }
      vals[s.id] += d; G.audio.sfx.blip();
    },
    activate() {
      if (page === 0) {
        if (idx < G.STATS.length) { this.change(+1); return; }
        if (idx === G.STATS.length) { this.randomize(); G.audio.sfx.puff(); return; }
        if (left() > 0) { G.audio.sfx.error(); say(`Осталось очков: ${left()}`); return; }
        page = 1; idx = 0; G.audio.sfx.confirm(); return;
      }
      if (idx < G.SKILLS.length) {
        const id = G.SKILLS[idx].id, i = picked.indexOf(id);
        if (i >= 0) { picked.splice(i, 1); G.audio.sfx.cancel(); }
        else if (picked.length >= 2) { G.audio.sfx.error(); say('Можно выбрать только 2 навыка'); }
        else { picked.push(id); G.audio.sfx.select(); }
        return;
      }
      if (picked.length < 2) { G.audio.sfx.error(); say('Выбери 2 навыка'); return; }
      confirm = true; G.audio.sfx.confirm();
    },

    update(dt) {
      const I = G.input;
      if (msgT > 0) { msgT -= dt; if (msgT <= 0) msg = null; }
      if (confirm) {
        if (I.pressed('a') || (I.tapNow && I.tapNow.x < G.screen.W / 2)) { G.audio.sfx.confirm(); this.finish(); }
        else if (I.pressed('b') || I.tapNow) { confirm = false; G.audio.sfx.cancel(); }
        return;
      }
      const n = this.rows();
      if (I.repeat('up', dt)) { idx = (idx + n - 1) % n; G.audio.sfx.select(); }
      if (I.repeat('down', dt)) { idx = (idx + 1) % n; G.audio.sfx.select(); }
      if (page === 0 && I.repeat('right', dt)) this.change(+1);
      if (page === 0 && I.repeat('left', dt)) this.change(-1);
      if (I.pressed('b') && page === 1) { page = 0; idx = G.STATS.length + 1; G.audio.sfx.cancel(); return; }
      if (I.pressed('a')) this.activate();
      if (I.tapNow) {
        const t = I.tapNow, i = Math.floor((t.y - TOP) / ROW);
        if (i < 0 || i >= n) return;
        idx = i;
        if (page === 0 && i < G.STATS.length) this.change(t.x > G.screen.W - 40 ? +1 : t.x > G.screen.W - 70 ? -1 : 0);
        else this.activate();
      }
    },

    draw(ctx) {
      const W = G.screen.W, H = G.screen.H, F = G.font, P = G.PAL;
      ctx.fillStyle = '#1e1a28'; ctx.fillRect(0, 0, W, H);
      F.draw(ctx, 'ВСТУПИТЕЛЬНЫЙ ТЕСТ', W / 2, 4, { align: 'center', color: P.orange });
      if (page === 0) {
        const l = left();
        F.draw(ctx, 'Характеристики', 4, 17, { color: P.light });
        F.draw(ctx, `Очки: ${l}`, W - 4, 17, { align: 'right', color: l ? P.yellow : '#8ac85a' });
        G.STATS.forEach((s, i) => {
          const y = TOP + i * ROW, sel = i === idx, v = vals[s.id];
          ctx.fillStyle = sel ? '#3a3450' : '#24202e'; ctx.fillRect(2, y, W - 4, ROW - 1);
          F.draw(ctx, s.name, 6, y + 3, { color: sel ? P.white : P.light });
          // кружки: база — серые, добавленные — оранжевые
          for (let k = 0; k < MAX; k++) {
            const x = 88 + k * 7;
            F.draw(ctx, k < v ? '●' : '○', x, y + 3, { color: k < B ? '#9a92a8' : k < v ? '#ff8a3a' : '#4a4458' });
          }
          F.draw(ctx, '−', W - 52, y + 3, { color: v > B ? P.white : '#4a4458' });
          F.draw(ctx, String(v), W - 34, y + 3, { align: 'center', color: P.yellow });
          F.draw(ctx, '+', W - 16, y + 3, { color: l > 0 && v < MAX ? P.white : '#4a4458' });
        });
        const yb = TOP + G.STATS.length * ROW;
        [['Случайно', idx === G.STATS.length], [l > 0 ? `Далее (осталось ${l})` : 'Далее ▶', idx === G.STATS.length + 1]].forEach(([t, sel], k) => {
          const y = yb + k * ROW;
          ctx.fillStyle = sel ? '#3a3450' : '#24202e'; ctx.fillRect(2, y, W - 4, ROW - 1);
          F.draw(ctx, t, W / 2, y + 3, { align: 'center', color: sel ? P.yellow : P.gray });
        });
        const s = G.STATS[idx];
        const desc = s ? s.desc : idx === G.STATS.length ? 'Распределить очки случайно.' : 'Перейти к выбору навыков.';
        this.drawDesc(ctx, desc, '< > изменить  (A) +1');
      } else {
        F.draw(ctx, 'Навыки: выбери 2', 4, 17, { color: P.light });
        F.draw(ctx, `${picked.length}/2`, W - 4, 17, { align: 'right', color: picked.length === 2 ? '#8ac85a' : P.yellow });
        G.SKILLS.forEach((s, i) => {
          const y = TOP + i * ROW, sel = i === idx, on = picked.includes(s.id);
          ctx.fillStyle = sel ? '#3a3450' : '#24202e'; ctx.fillRect(2, y, W - 4, ROW - 1);
          F.draw(ctx, on ? '■' : '□', 6, y + 3, { color: on ? '#ff8a3a' : P.gray });
          F.draw(ctx, s.name, 16, y + 3, { color: on ? P.yellow : sel ? P.white : P.light });
          if (s.now) F.draw(ctx, '★', W - 8, y + 3, { align: 'right', color: '#8ac85a' });
        });
        const y = TOP + G.SKILLS.length * ROW, sel = idx === G.SKILLS.length;
        ctx.fillStyle = sel ? '#3a3450' : '#24202e'; ctx.fillRect(2, y, W - 4, ROW - 1);
        F.draw(ctx, 'Готово ▶', W / 2, y + 3, { align: 'center', color: sel ? P.yellow : P.gray });
        const s = G.SKILLS[idx];
        this.drawDesc(ctx, s ? s.desc : 'Закончить тест.', '(A) выбрать (B) назад ★ сразу');
      }
      if (msg) {
        const w = F.measure(msg) + 12;
        G.gfx.window(ctx, Math.round((W - w) / 2), H / 2 - 8, w, 16, 'dark');
        F.draw(ctx, msg, W / 2, H / 2 - 4, { align: 'center', color: P.yellow });
      }
      if (confirm) {
        ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
        const bh = 74, by = Math.round(H / 2 - bh / 2);
        G.gfx.window(ctx, 10, by, W - 20, bh, 'paper');
        F.draw(ctx, 'Всё верно?', W / 2, by + 6, { align: 'center', color: G.UI.text });
        const line = G.STATS.map((s) => `${s.short} ${vals[s.id]}`).join(' · ');
        F.wrap(line, W - 36).forEach((ln, i) => F.draw(ctx, ln, W / 2, by + 18 + i * 10, { align: 'center', color: P.gray }));
        F.draw(ctx, picked.map((id) => G.SKILLS.find((s) => s.id === id).name).join(', '), W / 2, by + 40, { align: 'center', color: '#8a3a1a' });
        F.draw(ctx, '(A) Да      (B) Нет', W / 2, by + 56, { align: 'center', color: G.UI.text });
      }
    },
    drawDesc(ctx, text, hint) {
      const W = G.screen.W, H = G.screen.H, F = G.font, P = G.PAL;
      const lines = F.wrap(text, W - 16).slice(0, 3);
      const h = 10 + lines.length * 10 + 10;
      const y = H - h - 2;
      G.gfx.window(ctx, 2, y, W - 4, h, 'dark');
      lines.forEach((ln, i) => F.draw(ctx, ln, 8, y + 5 + i * 10, { color: P.white }));
      F.draw(ctx, hint, W / 2, y + h - 12, { align: 'center', color: '#8a8498', max: 99 });
    },
  };
  return S;
});
