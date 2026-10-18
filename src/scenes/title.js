// Титульный экран: ночная Коноха, Скала Хокаге, «Воля Огня».
G.scenes.register('title', () => {
  let t = 0;
  let idx = 0;
  let items = [];
  let bg = null;

  function buildBg() {
    const W = G.screen.W, H = G.screen.H;
    const c = G.gfx.canvas(W, H);
    const x = c.getContext('2d');
    // небо: градиент полосами
    const sky = ['#1a1430', '#221a3c', '#2c2048', '#3a2850', '#4a3050', '#6a3a4a', '#8a4a40'];
    const band = Math.ceil(H * 0.62 / sky.length);
    sky.forEach((col, i) => { x.fillStyle = col; x.fillRect(0, i * band, W, band); });
    // звёзды
    for (let i = 0; i < 40; i++) {
      x.fillStyle = i % 5 ? '#c8c0e8' : '#fff';
      x.fillRect(Math.floor(G.util.hash2(i, 1) * W), Math.floor(G.util.hash2(1, i) * H * 0.4), 1, 1);
    }
    // луна
    x.fillStyle = '#f8f0d0';
    for (let yy = -9; yy <= 9; yy++) for (let xx = -9; xx <= 9; xx++)
      if (xx * xx + yy * yy <= 85) x.fillRect(160 + xx, 84 + yy, 1, 1);
    x.fillStyle = '#e8dcb0'; x.fillRect(156, 81, 3, 2); x.fillRect(163, 87, 2, 2);
    // Скала Хокаге
    const rockY = Math.floor(H * 0.42);
    x.fillStyle = '#4a3a3a';
    for (let i = 0; i < W; i++) {
      const hgt = 26 + Math.floor(Math.sin(i * 0.07) * 4 + G.util.hash2(i, 3) * 3);
      x.fillRect(i, rockY - hgt + 26, 1, H);
    }
    // четыре лица (силуэты)
    for (let k = 0; k < 4; k++) {
      const fx = 22 + k * 42, fy = rockY + 2;
      x.fillStyle = '#5a4848'; x.fillRect(fx, fy, 22, 22);
      x.fillStyle = '#3a2c2c'; x.fillRect(fx + 5, fy + 8, 4, 2); x.fillRect(fx + 13, fy + 8, 4, 2);
      x.fillRect(fx + 9, fy + 15, 4, 2);
      x.fillStyle = '#6a5656'; x.fillRect(fx, fy, 22, 3);
    }
    // крыши деревни
    const roofY = Math.floor(H * 0.66);
    for (let i = 0; i < 14; i++) {
      const rx = i * 15 - 6 + Math.floor(G.util.hash2(i, 7) * 6);
      const rw = 18 + Math.floor(G.util.hash2(7, i) * 10);
      const ry = roofY + Math.floor(G.util.hash2(i, 9) * 14);
      x.fillStyle = '#2a1e2a'; x.fillRect(rx, ry, rw, H);
      x.fillStyle = '#3a2430'; x.fillRect(rx - 2, ry, rw + 4, 3);
      if (G.util.hash2(i, 11) > 0.35) { x.fillStyle = '#ffd27a'; x.fillRect(rx + 5, ry + 8, 3, 3); }
      if (G.util.hash2(i, 12) > 0.5) { x.fillStyle = '#ffb04a'; x.fillRect(rx + rw - 8, ry + 14, 3, 3); }
    }
    x.fillStyle = '#1a1220'; x.fillRect(0, H - 30, W, 30);
    return c;
  }

  return {
    name: 'title',
    enter() {
      bg = buildBg();
      items = G.storage.hasSave() ? ['Продолжить', 'Новая игра'] : ['Новая игра'];
      idx = 0;
      this._resize = G.events.on('resize', () => { bg = buildBg(); });
    },
    exit() { G.events.off('resize', this._resize); },

    update(dt) {
      t += dt;
      const I = G.input;
      if (I.repeat('up', dt) || I.repeat('down', dt)) { idx = (idx + 1) % items.length; G.audio.sfx.select(); }
      if (I.tapNow) {
        const H = G.screen.H;
        items.forEach((it, i) => { if (Math.abs(I.tapNow.y - (H - 62 + i * 14 + 4)) < 7) { idx = i; this.choose(); } });
        return;
      }
      if (I.pressed('a')) this.choose();
    },

    choose() {
      G.audio.sfx.confirm();
      const it = items[idx];
      if (it === 'Продолжить') {
        G.game.loadSaved();
      } else if (G.storage.hasSave()) {
        // перезапись сохранения — только после подтверждения
        G.dialog.start('confirm_new', { bottom: 30, onEnd: () => {
          if (G.state.flags._confirm) { G.game.newState(); G.scenes.fadeTo(G.scenes.make('nameinput')); }
          delete G.state.flags._confirm;
        } });
      } else {
        G.game.newState();
        G.scenes.fadeTo(G.scenes.make('nameinput'));
      }
    },

    draw(ctx) {
      const W = G.screen.W, H = G.screen.H;
      ctx.drawImage(bg, 0, 0);
      // логотип
      const ly = 26 + Math.round(Math.sin(t * 1.5) * 2);
      ctx.fillStyle = 'rgba(20,10,20,.55)';
      ctx.fillRect(16, ly - 6, W - 32, 44);
      G.font.draw(ctx, 'NARUTO RPG', W / 2, ly, { align: 'center', color: G.PAL.yellow, outline: G.PAL.ink });
      // крупный заголовок ×2
      const title = 'ВОЛЯ ОГНЯ';
      const tw = G.font.measure(title);
      const tmp = G.gfx.canvas(tw + 4, 12);
      G.font.draw(tmp.getContext('2d'), title, 1, 1, { color: G.PAL.orange, outline: G.PAL.ink });
      ctx.drawImage(tmp, Math.round(W / 2 - tmp.lw), ly + 12, tmp.lw * 2, tmp.lh * 2);
      // меню
      items.forEach((it, i) => {
        const y = H - 62 + i * 14;
        const sel = i === idx;
        if (sel && Math.floor(t * 3) % 2 === 0) G.font.draw(ctx, '▶', W / 2 - G.font.measure(it) / 2 - 10, y, { color: G.PAL.orange });
        G.font.draw(ctx, it, W / 2, y, { align: 'center', color: sel ? G.PAL.white : G.PAL.light, shadow: G.PAL.black });
      });
      G.font.draw(ctx, 'Нажми A', W / 2, H - 22, { align: 'center', color: Math.floor(t * 2) % 2 ? G.PAL.gray : G.PAL.light });
      G.font.draw(ctx, 'v' + BUILD.version, W - 3, H - 11, { align: 'right', color: G.PAL.gray });
    },
  };
});
