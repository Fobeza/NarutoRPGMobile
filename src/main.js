// Точка входа: инициализация и игровой цикл.
(function main() {
  G.storage.loadSettings();
  G.audio.enabled = G.storage.settings.sound;
  G.screen.init();
  G.input.init();
  G.debug.init();

  G.scenes.replace(G.scenes.make('title'));

  // Цикл с ограничением dt (после сворачивания не «прыгаем» на секунды вперёд).
  // Кадр обёрнут в try/catch: исключение в update/draw больше не останавливает requestAnimationFrame
  // (раньше любой сбой сцены означал полное зависание игры — приходилось перезагружать страницу).
  let last = performance.now();
  let errStreak = 0;          // сколько кадров подряд падаем
  let errBanner = null;       // { msg, t } — полоса с текстом ошибки на несколько секунд

  function drawBanner(ctx, dt) {
    if (!errBanner) return;
    errBanner.t -= dt;
    if (errBanner.t <= 0) { errBanner = null; return; }
    ctx.fillStyle = '#600'; ctx.fillRect(0, 0, G.screen.W, 34);
    G.font.draw(ctx, 'СБОЙ:', 3, 2, { color: '#fff' });
    G.font.wrap(errBanner.msg, G.screen.W - 6).slice(0, 2)
      .forEach((l, i) => G.font.draw(ctx, l, 3, 12 + i * 10, { color: '#fcc' }));
  }

  function frameError(e) {
    errStreak++;
    const msg = (e && e.message) || String(e);
    errBanner = { msg: String(msg), t: 4 };
    if (G.debug && G.debug.on) console.warn('Кадр:', (e && e.stack) || e);
    // Падаем подряд — значит, верхняя сцена битая (например, оборванный диалог). Снимаем её и продолжаем.
    if (errStreak >= 2) {
      errStreak = 0;
      if (G.scenes.stack.length > 1) { try { G.scenes.pop(); } catch (_) { G.scenes.stack.pop(); } }
      G.scenes.fade = { a: 0, dir: 0, speed: 3, then: null };   // зависшее затемнение — сбрасываем
    }
  }

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    try {
      G.input.poll();
      G.debug.tick(dt);
      G.scenes.update(dt);
      const ctx = G.screen.ctx;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, G.screen.W, G.screen.H);
      G.scenes.draw(ctx);
      G.touch.draw(ctx);
      G.debug.draw(ctx);
      drawBanner(ctx, dt);
      errStreak = 0;
    } catch (e) {
      frameError(e);
    }
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
    G.audio.wake();
    const top = G.scenes.top();
    if (G.state.started && top && top.name === 'world') G.scenes.push(G.scenes.make('pause'));
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); else resume(); });
  window.addEventListener('pagehide', suspend);

  // Service Worker: офлайн после первого запуска (только по https или localhost)
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW:', e));
  }

  // Ошибки вне игрового цикла (обработчики ввода, сохранение) — тоже на экран, чтобы видеть их на телефоне
  window.addEventListener('error', (e) => {
    errBanner = { msg: String(e.message || 'ошибка'), t: 4 };
    if (G.debug && G.debug.on) console.warn('Ошибка:', e.error || e.message);
  });
})();
