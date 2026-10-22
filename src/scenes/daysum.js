// Экран «Итоги дня» после сна. summary — результат G.game.sleep().
G.scenes.register('daysum', (summary, onDone) => {
  let t = 0;
  const friends = [['naruto', 'Наруто'], ['sakura', 'Сакура'], ['sasuke', 'Саске'], ['hinata', 'Хината'], ['iruka', 'Ирука'], ['shikamaru', 'Шикамару']];
  return {
    name: 'daysum',
    update(dt) {
      t += dt;
      const I = G.input;
      if (t > 0.6 && (I.pressed('a') || I.pressed('b') || I.tapNow)) { G.audio.sfx.confirm(); onDone && onDone(); }
    },
    draw(ctx) {
      const W = G.screen.W, H = G.screen.H, F = G.font, S = G.font.small, U = G.ui, C = U.C;
      ctx.fillStyle = '#0e0c16'; ctx.fillRect(0, 0, W, H);
      // звёзды и месяц
      for (let i = 0; i < 40; i++) {
        const x = (i * 53) % W, y = (i * 37) % Math.round(H * 0.45);
        ctx.fillStyle = (Math.sin(t * 2 + i) > 0.6) ? '#ffffff' : '#7a7aa0';
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.fillStyle = '#f4e8b0'; ctx.beginPath(); ctx.arc(W - 30, 30, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#0e0c16'; ctx.beginPath(); ctx.arc(W - 26, 27, 8, 0, 7); ctx.fill();

      // строки итогов: цвета подобраны под чернила на пергаменте
      const rows = [];
      for (const l of summary.log) rows.push(['✔ ' + l, C.ink]);
      const met = friends.filter(([id]) => G.state.flags['met_' + id]).map(([, n]) => n);
      if (met.length) rows.push(['Знакомые: ' + met.join(', '), C.inkDim]);
      const best = Object.keys(G.FRIENDS).filter((id) => G.friends.pts(id) > 0).sort((a, b) => G.friends.pts(b) - G.friends.pts(a))[0];
      if (best) rows.push([`Лучший друг: ${G.chars.nameOf(best)} ` + ('♥'.repeat(G.friends.level(best)) || '·'), C.red]);
      if (summary.day < 54) rows.push([`До выпускного экзамена: ${54 - summary.day} дн.`, '#3a62a0']);
      rows.push([`Потрачено: ${summary.spent} рё · осталось ${summary.money} рё`, '#8a5a10']);
      if (summary.bed != null) {
        const late = summary.bed > 23 * 60;
        rows.push([summary.faint ? `Уснул без сил в ${G.game.clock(summary.bed)}` : `Отбой в ${G.game.clock(summary.bed)}${late ? ' — поздно' : ''}`, summary.faint || late ? C.err : '#3a62a0']);
        const wt = G.life.WEATHER[summary.weather];
        rows.push([`Подъём ${G.game.clock(summary.wake)} · усталость ${summary.wakeFatigue} · ${wt.icon} ${wt.name.toLowerCase()}`, C.ok]);
      }
      const tw = W - 52;
      const h = 30 + rows.reduce((n, [txt]) => n + S.wrap(txt, tw).length * 12 + 2, 0);
      const y0 = Math.max(46, Math.min(96, H - h - 56));
      U.title(ctx, 'ИТОГИ ДНЯ', W / 2, y0 - 36, 110);
      F.small.draw(ctx, `День ${summary.day} · ${summary.dayName}`, W / 2, y0 - 16, { align: 'center', color: '#d8c8a0' });
      U.panel(ctx, 8, y0, W - 16, h, 'scroll');
      let y = y0 + 15;
      for (const [txt, col] of rows) { for (const ln of S.wrap(txt, tw)) { S.draw(ctx, ln, 26, y, { color: col }); y += 12; } y += 2; }
      S.draw(ctx, 'Игра сохранена', W / 2, y0 + h + 8, { align: 'center', color: '#8ac85a' });
      if (t > 0.6 && Math.floor(t * 2) % 2 === 0) S.draw(ctx, 'Коснись экрана', W / 2, H - 24, { align: 'center', color: '#d8c8a0' });
    },
  };
});
