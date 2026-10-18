// Галерея персонажей («бумажная кукла») и проверка шрифта — служебные экраны этапа 0.
G.scenes.register('gallery', () => {
  const ids = Object.keys(G.chars.DEFS);
  let idx = 0, t = 0;
  const DIRS = ['down', 'right', 'up', 'left'];

  return {
    name: 'gallery',
    update(dt) {
      t += dt;
      const I = G.input;
      if (I.repeat('left', dt)) { idx = (idx + ids.length - 1) % ids.length; G.audio.sfx.select(); }
      if (I.repeat('right', dt)) { idx = (idx + 1) % ids.length; G.audio.sfx.select(); }
      if (I.tapNow) { idx = (idx + (I.tapNow.x < G.screen.W / 2 ? ids.length - 1 : 1)) % ids.length; G.audio.sfx.select(); }
      if (I.pressed('b') || I.pressed('menu')) { G.audio.sfx.cancel(); G.scenes.pop(); }
    },
    draw(ctx) {
      const W = G.screen.W, H = G.screen.H, P = G.PAL;
      ctx.fillStyle = '#2a2638'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#5aa046'; ctx.fillRect(0, 104, W, 28);
      G.font.draw(ctx, 'ГАЛЕРЕЯ ПЕРСОНАЖЕЙ', W / 2, 4, { align: 'center', color: P.orange });
      const id = ids[idx];
      G.font.draw(ctx, `◀  ${G.chars.nameOf(id)}  ▶`.replace('◀', '<').replace('▶', '>'), W / 2, 18, { align: 'center', color: P.white });

      // крупно ×4: ходьба по кругу направлений
      const dir = DIRS[Math.floor(t / 1.6) % 4];
      const frame = G.chars.WALK[Math.floor(t * 7) % 4];
      const s = G.chars.sheet(id);
      const di = G.chars.DIRS.indexOf(dir);
      ctx.drawImage(s, frame * 16, di * 20, 16, 20, 20, 44, 64, 80);
      // портрет
      ctx.fillStyle = G.UI.edge; ctx.fillRect(110, 40, 36, 36);
      ctx.drawImage(G.chars.portrait(id), 112, 42);
      G.font.draw(ctx, 'портрет', 128, 79, { align: 'center', color: P.light });
      G.font.draw(ctx, '', 128, 89, { align: 'center', color: P.gray });

      // все 4 направления × 3 кадра
      for (let r = 0; r < 4; r++) for (let f = 0; f < 3; f++)
        ctx.drawImage(s, f * 16, r * 20, 16, 20, 4 + (r * 3 + f) * 15.5, 140, 16, 20);

      // все персонажи в ряд
      ids.forEach((cid, i) => {
        const x = 12 + (i % 10) * 18, y = 186 + Math.floor(i / 10) * 24;
        if (cid === id) { ctx.fillStyle = P.orange; ctx.fillRect(x - 9, y - 21, 18, 23); }
        G.chars.draw(ctx, cid, 'down', G.chars.WALK[Math.floor(t * 4 + i) % 4], x, y);
      });
      G.font.draw(ctx, 'Крестовина ◀▶ — выбор,  B — назад'.replace('◀▶', '<>'), W / 2, H - 12, { align: 'center', color: P.gray });
    },
  };
});

G.scenes.register('fonttest', () => {
  return {
    name: 'fonttest',
    update() {
      const I = G.input;
      if (I.pressed('b') || I.pressed('a') || I.pressed('menu') || I.tapNow) { G.audio.sfx.cancel(); G.scenes.pop(); }
    },
    draw(ctx) {
      const W = G.screen.W, P = G.PAL;
      ctx.fillStyle = P.paper; ctx.fillRect(0, 0, W, G.screen.H);
      let y = 4;
      const line = (t, col = G.UI.text) => { G.font.wrap(t, W - 8).forEach((l) => { G.font.draw(ctx, l, 4, y, { color: col }); y += 11; }); };
      line('ШРИФТ: проверка', P.orange);
      line('АБВГДЕЁЖЗИЙКЛМНОП РСТУФХЦЧШЩЪЫЬЭЮЯ');
      line('абвгдеёжзийклмноп рстуфхцчшщъыьэюя');
      line('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      line('abcdefghijklmnopqrstuvwxyz');
      line('0123456789 .,!?:;-—+=()[]«»"/%*…<>№');
      line('♥ ★ ▶ ▼ ▲ ● ✔');
      y += 4;
      line('Съешь же ещё этих мягких французских булок, да выпей чаю!', P.blue);
      line('Наруто: «Я стану Хокаге, даттебайо!»', P.redDark);
      line('Каварими, Хенге, Буншин — техники Академии.', P.greenDark);
      line('Тигр → Кабан → Бык → Собака → Змея'.replace(/→/g, '>'));
      y += 4;
      line('Нажми любую кнопку', P.gray);
    },
  };
});
