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
      const W = G.screen.W, H = G.screen.H, F = G.font, P = G.PAL;
      ctx.fillStyle = '#0e0c16'; ctx.fillRect(0, 0, W, H);
      // звёзды
      for (let i = 0; i < 40; i++) {
        const x = (i * 53) % W, y = (i * 37) % Math.round(H * 0.45);
        ctx.fillStyle = (Math.sin(t * 2 + i) > 0.6) ? '#ffffff' : '#7a7aa0';
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.fillStyle = '#f4e8b0'; ctx.beginPath(); ctx.arc(W - 30, 30, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#0e0c16'; ctx.beginPath(); ctx.arc(W - 26, 27, 8, 0, 7); ctx.fill();


      const rows = [];
      for (const l of summary.log) rows.push(['✔ ' + l, P.white]);
      const met = friends.filter(([id]) => G.state.flags['met_' + id]).map(([, n]) => n);
      if (met.length) rows.push(['Знакомые: ' + met.join(', '), P.light]);
      const best = Object.keys(G.FRIENDS).filter((id) => G.friends.pts(id) > 0).sort((a, b) => G.friends.pts(b) - G.friends.pts(a))[0];
      if (best) rows.push([`Лучший друг: ${G.chars.nameOf(best)} ` + ('♥'.repeat(G.friends.level(best)) || '·'), '#f08aa0']);
      if (summary.day < 54) rows.push([`До выпускного экзамена: ${54 - summary.day} дн.`, '#9ab0ff']);
      if (summary.mood != null) rows.push(['Настроение: ' + G.game.moodName(summary.mood).toLowerCase(), '#d080e0']);
      rows.push([`Потрачено: ${summary.spent} рё · осталось ${summary.money} рё`, P.yellow]);
      if (summary.bed != null) {
        const late = summary.bed > 23 * 60;
        rows.push([summary.faint ? `Уснул без сил в ${G.game.clock(summary.bed)}` : `Отбой в ${G.game.clock(summary.bed)}${late ? ' — поздно' : ''}`, summary.faint || late ? '#ff9a7a' : '#9ab0ff']);
        const wt = G.life.WEATHER[summary.weather];
        rows.push([`Подъём ${G.game.clock(summary.wake)} · энергия ${summary.wakeEnergy} · ${wt.icon} ${wt.name.toLowerCase()}`, '#8ac85a']);
      }
      const h = 14 + rows.reduce((s, [txt]) => s + F.wrap(txt, W - 28).length * 11, 0);
      const y0 = Math.max(30, Math.min(82, H - h - 30));   // длинный список — поднимаем окно и заголовок
      F.draw(ctx, 'ИТОГИ ДНЯ', W / 2, y0 - 30, { align: 'center', color: P.orange });
      F.draw(ctx, `День ${summary.day} · ${summary.dayName}`, W / 2, y0 - 17, { align: 'center', color: P.light });
      G.gfx.window(ctx, 6, y0, W - 12, h, 'dark');
      let y = y0 + 7;
      for (const [txt, col] of rows) for (const ln of F.wrap(txt, W - 28)) { F.draw(ctx, ln, 14, y, { color: col }); y += 11; }

      F.draw(ctx, 'Игра сохранена', W / 2, y0 + h + 10, { align: 'center', color: '#8ac85a' });
      if (t > 0.6 && Math.floor(t * 2) % 2 === 0) F.draw(ctx, 'Нажми A', W / 2, H - 24, { align: 'center', color: P.light });
    },
  };
});
