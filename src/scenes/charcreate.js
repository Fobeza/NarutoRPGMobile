// Вступительный тест у Ируки (план §3): распределить 12 очков по 8 характеристикам (база 3, максимум 7)
// и выбрать 2 стартовых навыка из 9. onDone() — продолжение сюжета.
G.scenes.register('charcreate', (onDone) => {
  const B = G.STAT_BASE, MAX = G.STAT_MAX_START;
  const vals = {}; for (const s of G.STATS) vals[s.id] = B;
  const picked = [];
  let page = 0, idx = 0, msg = null, msgT = 0, confirm = false;
  const left = () => G.STAT_POINTS - G.STATS.reduce((a, s) => a + vals[s.id] - B, 0);
  let ROW = 20;
  const TOP = 46;
  // высота строки подстраивается под экран: 10 строк + описание внизу должны поместиться и в «КРУПНО» на коротком экране
  const fit = () => { ROW = Math.max(15, Math.min(20, Math.floor((G.screen.H - TOP - 60) / Math.max(G.STATS.length + 2, G.SKILLS.length + 1)))); };
  const say = (t) => { msg = t; msgT = 1.6; };

  const S = {
    name: 'charcreate',
    // «Назад» есть только на втором шаге (на первом ему некуда возвращаться)
    touch() { return { back: page === 1 }; },
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
      fit();
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
        if (page === 0 && i < G.STATS.length) this.change(t.x > G.screen.W - 34 ? +1 : t.x > G.screen.W - 70 ? -1 : 0);
        else this.activate();
      }
    },

    draw(ctx) {
      const W = G.screen.W, H = G.screen.H, F = G.font, S = G.font.small, U = G.ui, C = U.C;
      fit();
      const narrow = W < 240;   // кружки и подписи уплотняются, чтобы не налезать на кнопки ±
      U.backdrop(ctx);
      if (narrow) U.title(ctx, 'ТЕСТ', W / 2, 3, 70); else U.title(ctx, 'ВСТУПИТЕЛЬНЫЙ ТЕСТ', W / 2, 3, 150);
      const bar = (txt, right, rcol) => { U.panel(ctx, 4, 22, W - 8, 20, 'frame'); S.draw(ctx, txt, 14, 28, { color: C.inkDim }); right && S.draw(ctx, right, W - 14, 28, { align: 'right', color: rcol }); };
      const rowBg = (y, sel) => { U.row(ctx, 6, y, W - 12, ROW - 3, sel); };
      if (page === 0) {
        const l = left();
        bar('Характеристики', `Очки: ${l}`, l ? '#8a5a10' : C.ok);
        U.panel(ctx, 4, TOP - 2, W - 8, (G.STATS.length + 2) * ROW + 6, 'frame');
        G.STATS.forEach((s, i) => {
          const y = TOP + 3 + i * ROW, sel = i === idx, v = vals[s.id];
          rowBg(y, sel);
          const step = narrow ? 4.5 : 9, x0 = W - 74 - MAX * step + step / 2;
          (narrow ? S : F).draw(ctx, s.name, 14, y + (narrow ? 4 : 2), { color: sel ? '#f8eed0' : C.ink, shadow: sel ? '#5a1408' : null, maxW: x0 - 18 });
          // кружки: база — тёмные, добавленные — красные, свободные — пустые
          for (let k = 0; k < MAX; k++) {
            const cx = x0 + k * step, cy = y + 7, rr = narrow ? 2 : 3;
            ctx.fillStyle = k < B ? '#6a5238' : k < v ? C.red : 'rgba(46,30,20,.28)';
            ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.fill();
            if (k < v && k >= B) { ctx.fillStyle = C.redHi; ctx.fillRect(cx - 1, cy - 2, 1, 1); }
          }
          U.button(ctx, W - 68, y - 1, 20, 16, '−', v > B ? 'normal' : 'dis');
          F.draw(ctx, String(v), W - 40, y + 2, { align: 'center', color: sel ? '#f4d46a' : C.redDark, shadow: sel ? '#5a1408' : null });
          U.button(ctx, W - 30, y - 1, 20, 16, '+', l > 0 && v < MAX ? 'normal' : 'dis');
        });
        const yb = TOP + 3 + G.STATS.length * ROW;
        [['Случайно', idx === G.STATS.length], [l > 0 ? `Далее (осталось ${l})` : 'Далее', idx === G.STATS.length + 1]].forEach(([t, sel], k) => {
          const y = yb + k * ROW;
          rowBg(y, sel);
          F.draw(ctx, t, W / 2, y + 2, { align: 'center', color: sel ? '#f8eed0' : C.redDark, shadow: sel ? '#5a1408' : null });
        });
        const st = G.STATS[idx];
        this.drawDesc(ctx, st ? st.desc : idx === G.STATS.length ? 'Распределить очки случайно.' : 'Перейти к выбору навыков.');
      } else {
        bar('Навыки: выбери 2', `${picked.length}/2`, picked.length === 2 ? C.ok : '#8a5a10');
        U.panel(ctx, 4, TOP - 2, W - 8, (G.SKILLS.length + 1) * ROW + 6, 'frame');
        G.SKILLS.forEach((s, i) => {
          const y = TOP + 3 + i * ROW, sel = i === idx, on = picked.includes(s.id);
          rowBg(y, sel);
          // чекбокс-печать
          ctx.fillStyle = sel ? '#f8eed0' : C.ink; ctx.fillRect(13, y + 3, 9, 9); ctx.fillStyle = sel ? C.red : '#ecdcb0'; ctx.fillRect(14, y + 4, 7, 7);
          if (on) { ctx.fillStyle = sel ? '#f8eed0' : C.red; ctx.fillRect(16, y + 6, 3, 3); }
          F.draw(ctx, s.name, 28, y + 2, { color: sel ? '#f8eed0' : on ? C.redDark : C.ink, shadow: sel ? '#5a1408' : null, maxW: W - 66 });
          if (s.now) F.draw(ctx, '★', W - 16, y + 2, { align: 'right', color: sel ? '#f4d46a' : '#8a5a10' });
        });
        const y = TOP + 3 + G.SKILLS.length * ROW, sel = idx === G.SKILLS.length;
        rowBg(y, sel);
        F.draw(ctx, 'Готово', W / 2, y + 2, { align: 'center', color: sel ? '#f8eed0' : C.redDark, shadow: sel ? '#5a1408' : null });
        const s = G.SKILLS[idx];
        this.drawDesc(ctx, s ? s.desc + (s.now ? '  ★ действует сразу' : '') : 'Закончить тест.');
      }
      if (msg) {
        const w = F.measure(msg) + 22;
        U.panel(ctx, Math.round((W - w) / 2), H / 2 - 10, w, 20, 'night');
        F.draw(ctx, msg, W / 2, H / 2 - 4, { align: 'center', color: '#f4d46a' });
      }
      if (confirm) {
        ctx.globalAlpha = 0.6; ctx.fillStyle = '#0a0604'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
        const bh = 112, by = Math.round(H / 2 - bh / 2);
        U.panel(ctx, 10, by, W - 20, bh, 'frame');
        F.draw(ctx, 'Всё верно?', W / 2, by + 11, { align: 'center', color: C.redDark });
        const line = G.STATS.map((s) => `${s.short} ${vals[s.id]}`).join(' · ');
        S.wrap(line, W - 44).forEach((ln, i) => S.draw(ctx, ln, W / 2, by + 30 + i * 12, { align: 'center', color: C.inkDim }));
        S.draw(ctx, picked.map((id) => G.SKILLS.find((s) => s.id === id).name).join(', '), W / 2, by + 56, { align: 'center', color: C.redDark, maxW: W - 44 });
        U.button(ctx, 20, by + bh - 34, Math.round((W - 52) / 2), 24, 'Да', 'sel');
        U.button(ctx, 32 + Math.round((W - 52) / 2), by + bh - 34, Math.round((W - 52) / 2), 24, 'Нет', 'normal');
      }
    },
    drawDesc(ctx, text) {
      const W = G.screen.W, H = G.screen.H, S = G.font.small;
      const lines = S.wrap(text, W - 32).slice(0, 3);
      const h = 18 + lines.length * 12;
      const y = H - h - 4;
      G.ui.panel(ctx, 4, y, W - 8, h, 'frame');
      lines.forEach((ln, i) => S.draw(ctx, ln, 14, y + 9 + i * 12, { color: G.ui.C.ink }));
    },
  };
  return S;
});
