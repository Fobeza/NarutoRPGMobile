// Меню паузы (кнопка МЕНЮ): задания, календарь, статус, сумка, персонажи, настройки (scenes/settings.js), сохранение.
// Окно — свиток «Свитки и дерево» (G.ui.menu).
G.scenes.register('menu', () => {
  let idx = 0;
  const W = 156;
  const items = () => [
    { label: 'Продолжить', act: () => G.scenes.pop() },
    { label: 'Задания', act: () => G.scenes.push(G.scenes.make('journal')) },
    { label: 'Календарь', act: () => G.scenes.push(G.scenes.make('calendar')) },
    { label: 'Статус', act: () => G.scenes.push(G.scenes.make('status')) },
    { label: 'Сумка', act: () => G.scenes.push(G.scenes.make('bag')) },
    { label: 'Персонажи', act: () => G.scenes.push(G.scenes.make('gallery')) },
    { label: 'Настройки', act: () => G.scenes.push(G.scenes.make('settings')) },
    { label: 'Сохранение', act: () => G.scenes.push(G.scenes.make('savemenu')) },
    { label: 'В главное меню', act: () => G.scenes.fadeTo(G.scenes.make('title')) },
  ];

  return {
    name: 'menu',
    transparent: true,
    update(dt) {
      const I = G.input;
      const list = items();
      if (I.repeat('up', dt)) { idx = (idx + list.length - 1) % list.length; G.audio.sfx.select(); }
      if (I.repeat('down', dt)) { idx = (idx + 1) % list.length; G.audio.sfx.select(); }
      if (I.pressed('b') || I.pressed('menu')) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
      if (I.tapNow) {
        const i = G.ui.menu.hit(I.tapNow, list.length, W);
        if (i >= 0) { idx = i; G.audio.sfx.confirm(); list[i].act(); }
        return;
      }
      if (I.pressed('a')) { G.audio.sfx.confirm(); list[idx].act(); }
    },
    draw(ctx) { G.ui.menu.draw(ctx, 'МЕНЮ', items(), idx, W); },
  };
});
