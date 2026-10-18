// Точка входа: инициализация и игровой цикл.
(function main() {
  G.storage.loadSettings();
  G.audio.enabled = G.storage.settings.sound;
  G.screen.init();
  G.input.init();
  G.debug.init();

  G.scenes.replace(G.scenes.make('title'));

  // Цикл с ограничением dt (после сворачивания не «прыгаем» на секунды вперёд)
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    G.input.poll();
    G.debug.tick(dt);
    G.scenes.update(dt);
    const ctx = G.screen.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, G.screen.W, G.screen.H);
    G.scenes.draw(ctx);
    G.debug.draw(ctx);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Автосейв при сворачивании Safari (iOS может выгрузить вкладку)
  const suspend = () => {
    if (G.state.started) G.storage.save(G.state);
    G.events.emit('suspend');
  };
  // При возвращении в игру — пауза (время в мире не идёт, пока игрок не нажмёт A)
  const resume = () => {
    last = performance.now();
    const top = G.scenes.top();
    if (G.state.started && top && top.name === 'world') G.scenes.push(G.scenes.make('pause'));
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); else resume(); });
  window.addEventListener('pagehide', suspend);

  // Service Worker: офлайн после первого запуска (только по https или localhost)
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW:', e));
  }

  // Ошибки — на экран, чтобы видеть их на телефоне
  window.addEventListener('error', (e) => {
    const ctx = G.screen.ctx;
    ctx.fillStyle = '#600'; ctx.fillRect(0, 0, G.screen.W, 34);
    G.font.draw(ctx, 'ОШИБКА:', 3, 2, { color: '#fff' });
    G.font.wrap(String(e.message), G.screen.W - 6).slice(0, 2).forEach((l, i) => G.font.draw(ctx, l, 3, 12 + i * 10, { color: '#fcc' }));
  });
})();
