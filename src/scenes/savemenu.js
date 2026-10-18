// Меню «Сохранение» (этап 4): сохранить, экспорт и импорт кода, восстановить утреннюю копию.
G.scenes.register('savemenu', () => {
  let idx = 0, toast = null, toastT = 0;
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
      { label: bi ? `Резервная копия: день ${bi.day}, ${G.game.clock(bi.min)}` : 'Резервной копии нет', act: () => {
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
        const r = this.rect(), i = Math.floor((I.tapNow.y - r.y - 18) / 13);
        if (I.tapNow.x > r.x && I.tapNow.x < r.x + r.w && i >= 0 && i < list.length) { idx = i; G.audio.sfx.confirm(); list[i].act(); }
        return;
      }
      if (I.pressed('a')) { G.audio.sfx.confirm(); list[idx].act(); }
    },
    rect() {
      const n = items().length, w = 170, h = n * 13 + 26;
      return { x: Math.round((G.screen.W - w) / 2), y: Math.round((G.screen.H - h) / 2) - 10, w, h };
    },
    draw(ctx) {
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.screen.W, G.screen.H); ctx.globalAlpha = 1;
      const r = this.rect(), F = G.font, P = G.PAL;
      G.gfx.window(ctx, r.x, r.y, r.w, r.h, 'paper');
      F.draw(ctx, 'СОХРАНЕНИЕ', r.x + r.w / 2, r.y + 5, { align: 'center', color: P.orange });
      items().forEach((it, i) => {
        const y = r.y + 18 + i * 13, sel = i === idx;
        if (sel) { ctx.fillStyle = G.UI.sel; ctx.fillRect(r.x + 4, y - 2, r.w - 8, 12); F.draw(ctx, '▶', r.x + 7, y, { color: P.orange }); }
        F.draw(ctx, it.label, r.x + 15, y, { color: sel ? G.UI.selText : G.UI.dim, maxW: r.w - 20 });
      });
      if (toast) {
        const w = F.measure(toast) + 12;
        G.gfx.window(ctx, Math.round((G.screen.W - w) / 2), r.y + r.h + 4, w, 16, 'dark');
        F.draw(ctx, toast, G.screen.W / 2, r.y + r.h + 8, { align: 'center', color: P.white });
      }
    },
  };
});
