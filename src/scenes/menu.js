// Меню паузы (кнопка МЕНЮ): задания, календарь, статус, сумка, персонажи, настройки (scenes/settings.js), сохранение.
G.scenes.register('menu', () => {
  let idx = 0;
  const items = () => [
    { label: 'Продолжить', act: () => G.scenes.pop() },
    { label: 'Задания', act: () => G.scenes.push(G.scenes.make('journal')) },
    { label: 'Календарь', act: () => G.scenes.push(G.scenes.make('calendar')) },
    { label: 'Статус', act: () => G.scenes.push(G.scenes.make('status')) },
    { label: 'Сумка', act: () => G.scenes.push(G.scenes.make('bag')) },
    { label: 'Персонажи', act: () => G.scenes.push(G.scenes.make('gallery')) },
    { label: 'Настройки  ▸', act: () => G.scenes.push(G.scenes.make('settings')) },
    { label: 'Сохранение…', act: () => G.scenes.push(G.scenes.make('savemenu')) },
    { label: 'В главное меню', act: () => G.scenes.fadeTo(G.scenes.make('title')) },
  ];
  let toast = null, toastT = 0;

  return {
    name: 'menu',
    transparent: true,
    update(dt) {
      const I = G.input;
      const list = items();
      if (toastT > 0) { toastT -= dt; if (toastT <= 0) toast = null; }
      if (I.repeat('up', dt)) { idx = (idx + list.length - 1) % list.length; G.audio.sfx.select(); }
      if (I.repeat('down', dt)) { idx = (idx + 1) % list.length; G.audio.sfx.select(); }
      if (I.pressed('b') || I.pressed('menu')) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
      if (I.tapNow) {
        const r = this.rect();
        const i = Math.floor((I.tapNow.y - r.y - 18) / 13);
        if (I.tapNow.x > r.x && I.tapNow.x < r.x + r.w && i >= 0 && i < list.length) { idx = i; G.audio.sfx.confirm(); list[i].act(); }
        return;
      }
      if (I.pressed('a')) { G.audio.sfx.confirm(); list[idx].act(); }
    },
    rect() {
      const n = items().length;
      const w = 112, h = n * 13 + 26;
      return { x: Math.round((G.screen.W - w) / 2), y: Math.round((G.screen.H - h) / 2) - 10, w, h };
    },
    draw(ctx) {
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.screen.W, G.screen.H); ctx.globalAlpha = 1;
      const r = this.rect();
      G.gfx.window(ctx, r.x, r.y, r.w, r.h, 'paper');
      G.font.draw(ctx, 'МЕНЮ', r.x + r.w / 2, r.y + 5, { align: 'center', color: G.PAL.orange });
      items().forEach((it, i) => {
        const y = r.y + 18 + i * 13;
        const sel = i === idx;
        if (sel) { ctx.fillStyle = G.UI.sel; ctx.fillRect(r.x + 4, y - 2, r.w - 8, 12); }
        if (sel) G.font.draw(ctx, '▶', r.x + 7, y, { color: G.PAL.orange });
        G.font.draw(ctx, it.label, r.x + 15, y, { color: sel ? G.UI.selText : G.UI.dim });
      });
      if (toast) {
        const w = G.font.measure(toast) + 12;
        G.gfx.window(ctx, Math.round((G.screen.W - w) / 2), r.y + r.h + 4, w, 16, 'dark');
        G.font.draw(ctx, toast, G.screen.W / 2, r.y + r.h + 8, { align: 'center', color: G.PAL.white });
      }
    },
  };
});
