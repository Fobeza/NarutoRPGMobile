// Экран «Настройки»: открывается из главного меню (титульный экран) и из меню паузы. Окно — свиток (G.ui.menu).
G.scenes.register('settings', () => {
  let idx = 0;
  const S = G.storage.settings;
  const SPEED_NAMES = ['мгновенно', 'медленно', 'обычно', 'быстро'];
  const W = 214;
  const onoff = (v) => (v ? 'ВКЛ' : 'ВЫКЛ');
  const items = () => [
    { label: 'Звук', value: onoff(S.sound), act: () => { S.sound = !S.sound; G.audio.setEnabled(S.sound); G.storage.saveSettings(); } },
    { label: 'Текст', value: SPEED_NAMES[S.textSpeed], act: () => { S.textSpeed = (S.textSpeed + 1) % 4; G.storage.saveSettings(); } },
    { label: 'Мини-карта', value: onoff(S.minimap !== false), act: () => { S.minimap = S.minimap === false; G.storage.saveSettings(); } },
    { label: 'Эффекты', value: onoff(S.fx !== false), act: () => { S.fx = S.fx === false; G.storage.saveSettings(); } },
    { label: 'Подсказки', value: onoff(S.hints !== false), act: () => { S.hints = S.hints === false; G.storage.saveSettings(); } },
    { label: 'Реакция', value: S.reactSlow ? 'МЕДЛЕННО' : 'ОБЫЧНО', act: () => { S.reactSlow = !S.reactSlow; G.storage.saveSettings(); } },
    { label: 'Пиксели', value: G.screen.densityOptions().length > 1 ? G.screen.density().name : 'АВТО', dis: G.screen.densityOptions().length < 2, act: () => G.screen.cycleDensity() },
    { label: 'Отладка', value: onoff(G.debug.on), act: () => G.debug.toggle() },
    ...(G.debug.on ? [{ label: 'Читы', act: () => G.scenes.push(G.scenes.make('cheats')) }, { label: 'Шрифт', act: () => G.scenes.push(G.scenes.make('fonttest')) }] : []),
    { label: 'Назад', act: () => G.scenes.pop() },
  ];
  return {
    name: 'settings',
    transparent: true,
    update(dt) {
      const I = G.input, list = items();
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
    draw(ctx) { G.ui.menu.draw(ctx, 'НАСТРОЙКИ', items(), idx, W); },
  };
});
