// Меню «Сохранение» (этап 4): сохранить, экспорт и импорт кода, восстановить утреннюю копию.
G.scenes.register('savemenu', () => {
  let idx = 0, toast = null, toastT = 0;
  const W = 236;
  const say = (t) => { toast = t; toastT = 1.8; };
  const world = () => G.scenes.stack.find((s) => s.name === 'world');

  const openBox = (o) => G.codeBox.open(o), hintErr = (t) => G.codeBox.hintErr(t);

  const items = () => {
    const bi = G.storage.backupInfo();
    return [
      { label: 'Сохранить сейчас', act: () => { const w = world(); w && w.savePos(); say(G.storage.save(G.state) ? 'Сохранено ✔' : 'Не удалось сохранить! Память браузера полна?'); } },
      { label: 'Экспорт кода', act: () => {
        const w = world(); w && w.savePos(); G.storage.save(G.state);
        openBox({ title: 'Код сохранения', text: G.storage.exportCode(), readonly: true, okLabel: 'КОПИРОВАТЬ',
          hint: 'Сохрани код в Заметках — по нему можно восстановить игру',
          onOk: (ta, close) => {
            ta.select();
            const done = () => { document.getElementById('cb-hint').textContent = 'Скопировано ✔'; };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, () => { document.execCommand('copy'); done(); });
            else { document.execCommand('copy'); done(); }
          } });
      } },
      { label: 'Импорт кода', act: () => {
        openBox({ title: 'Вставь код сохранения', text: '', readonly: false, okLabel: 'ЗАГРУЗИТЬ',
          hint: 'Текущая игра уйдёт в резервную копию',
          onOk: (ta, close) => {
            if (!G.storage.importCode(ta.value)) { hintErr('Код не подходит. Проверь, что он скопирован целиком'); G.audio.sfx.error(); return; }
            close(); G.audio.sfx.confirm(); G.game.loadSaved();
          } });
      } },
      { label: bi ? 'Резервная копия' : 'Резервной копии нет', value: bi ? `день ${bi.day}, ${G.game.clock(bi.min)}` : null, dis: !bi, act: () => {
        if (!bi) { G.audio.sfx.error(); return; }
        if (G.storage.restoreBackup()) { G.audio.sfx.confirm(); G.game.loadSaved(); }
      } },
      { label: 'Назад', act: () => G.scenes.pop() },
    ];
  };

  return {
    name: 'savemenu',
    transparent: true,
    openBox, // для автотеста
    get boxOpen() { return G.codeBox.isOpen; },
    update(dt) {
      if (G.codeBox.isOpen) return;
      const I = G.input, list = items();
      if (toastT > 0) { toastT -= dt; if (toastT <= 0) toast = null; }
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
    draw(ctx) {
      const list = items();
      const r = G.ui.menu.draw(ctx, 'СОХРАНЕНИЕ', list, idx, W);
      if (toast) {
        const F = G.font, w = F.measure(toast) + 22;
        G.ui.panel(ctx, Math.round((G.screen.W - w) / 2), r.y + r.h + 6, w, 19, 'night');
        F.draw(ctx, toast, G.screen.W / 2, r.y + r.h + 11, { align: 'center', color: '#f4d46a' });
      }
    },
  };
});
