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
      const W = G.screen.W, H = G.screen.H, U = G.ui, C = U.C, F = G.font;
      U.backdrop(ctx);
      U.title(ctx, 'ГАЛЕРЕЯ', W / 2, 3, 90);
      const id = ids[idx];
      U.panel(ctx, 4, 21, W - 8, 24, 'frame');
      F.draw(ctx, '‹', 16, 28, { color: C.red }); F.draw(ctx, '›', W - 20, 28, { color: C.red });
      F.draw(ctx, G.chars.nameOf(id), W / 2, 28, { align: 'center', color: C.redDark });

      // крупно ×4: ходьба по кругу направлений на траве
      U.panel(ctx, 4, 50, 98, 98, 'well');
      ctx.fillStyle = '#5aa046'; ctx.fillRect(7, 110, 92, 35);
      const dir = DIRS[Math.floor(t / 1.6) % 4];
      const frame = G.chars.WALK[Math.floor(t * 7) % 4];
      const s = G.chars.sheet(id);
      const di = G.chars.DIRS.indexOf(dir);
      ctx.drawImage(s, frame * 16, di * 20, 16, 20, 20, 62, 64, 80);
      // портрет
      U.panel(ctx, 108, 50, 50, 50, 'plank');
      ctx.fillStyle = '#120a05'; ctx.fillRect(110, 52, 46, 46);
      ctx.drawImage(G.chars.portrait(id), 117, 59);
      F.small.draw(ctx, 'портрет', 133, 104, { align: 'center', color: '#f4e4bc' });

      // все 4 направления × 3 кадра
      U.panel(ctx, 4, 154, W - 8, 32, 'well');
      for (let r = 0; r < 4; r++) for (let f = 0; f < 3; f++)
        ctx.drawImage(s, f * 16, r * 20, 16, 20, 10 + (r * 3 + f) * ((W - 24) / 12), 160, 16, 20);

      // все персонажи в ряд: выбранный подсвечен красной карточкой
      const perRow = Math.max(6, Math.floor((W - 16) / 18)), top = 194;
      U.panel(ctx, 4, top, W - 8, H - top - 4, 'frame');
      ids.forEach((cid, i) => {
        const x = 17 + (i % perRow) * 18, y = top + 30 + Math.floor(i / perRow) * 26;
        if (y > H - 10) return;
        if (cid === id) U.card(ctx, x - 9, y - 22, 18, 25, true);
        G.chars.draw(ctx, cid, 'down', G.chars.WALK[Math.floor(t * 4 + i) % 4], x, y);
      });
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
      const W = G.screen.W, C = G.ui.C;
      G.ui.backdrop(ctx);
      G.ui.panel(ctx, 4, 4, W - 8, G.screen.H - 8, 'frame');
      let y = 14;
      const line = (t, col = C.ink, F = G.font) => { F.wrap(t, W - 28).forEach((l) => { F.draw(ctx, l, 14, y, { color: col }); y += F.LINE_H; }); };
      line('ШРИФТ: проверка', C.redDark);
      line('АБВГДЕЁЖЗИЙКЛМНОП РСТУФХЦЧШЩЪЫЬЭЮЯ');
      line('абвгдеёжзийклмноп рстуфхцчшщъыьэюя');
      line('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      line('abcdefghijklmnopqrstuvwxyz');
      line('0123456789 .,!?:;-—+=()[]«»"/%*…<>№');
      line('♥ ★ ▶ ▼ ▲ ● ✔ 📍🌙⏰❓🍜🍃💬👤🔥📘📜');
      y += 4;
      line('Съешь же ещё этих мягких французских булок, да выпей чаю!', C.inkDim, G.font.small);
      line('Наруто: «Я стану Хокаге, даттебайо!»', C.redDark);
      line('Каварими, Хенге, Буншин — техники Академии.', C.ok);
      y += 4;
      line('Коснись экрана', C.inkFaint, G.font.small);
    },
  };
});
