// Ввод имени героя: в больнице Хокаге спрашивает, как зовут очнувшегося (скрипт hosp_wake → `call askname`);
// игрок вводит имя (реальный <input> → клавиатура iOS). onDone() — продолжение разговора.
G.scenes.register('nameinput', (onDone) => {
  const el = () => document.getElementById('text-entry');
  const inp = () => document.getElementById('te-input');
  const hint = () => document.getElementById('te-hint');
  let onOk = null, onKey = null;

  // Разрешены буквы, которые есть в пиксельном шрифте, пробел и дефис
  const ALLOWED = /^[A-Za-zА-Яа-яЁё\- ]+$/;

  function validate(v) {
    const s = v.replace(/\s+/g, ' ').trim();
    if (!s) return { err: 'Введи имя' };
    if ([...s].length > 12) return { err: 'Не больше 12 символов' };
    if (!ALLOWED.test(s)) return { err: 'Только буквы, пробел и дефис' };
    return { ok: s };
  }

  return {
    name: 'nameinput',
    enter() { this.openEntry(); },
    resume() {},

    openEntry() {
      const box = el();
      box.classList.remove('hidden');
      const i = inp();
      i.value = G.state.hero.name || '';
      hint().textContent = '1–12 символов';
      hint().classList.remove('err');
      setTimeout(() => { i.focus(); }, 50);
      const submit = () => {
        const r = validate(i.value);
        if (r.err) { hint().textContent = r.err; hint().classList.add('err'); G.audio.sfx.error(); return; }
        i.blur();
        box.classList.add('hidden');
        G.state.hero.name = r.ok;
        G.audio.sfx.confirm();
        G.scenes.pop();
        onDone && onDone();
      };
      onOk = (e) => { e.preventDefault(); submit(); };
      onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
      document.getElementById('te-ok').onpointerdown = onOk;
      i.onkeydown = onKey;
    },

    exit() { el().classList.add('hidden'); },

    // Менеджер сцен вызывает update у верхней сцены напрямую, даже если ей не нужна анимация.
    update() {},

    draw(ctx) {
      const W = G.screen.W, H = G.screen.H, U = G.ui;
      // палата: светлый пол, табличка с вопросом, Хокаге ждёт ответа
      U.backdrop(ctx);
      U.wood(ctx, 0, 90, W, H - 90, '#c8c0a8', false, 11);
      U.panel(ctx, 14, 12, W - 28, 64, 'plank');
      ctx.fillStyle = '#1f3a2e'; ctx.fillRect(18, 16, W - 36, 56);
      G.shade.tint(ctx, 18, 16, W - 36, 56, (u, v) => 0.1 - 0.25 * v, { keepInk: false, steps: 10 });
      G.font.draw(ctx, 'Как тебя зовут?', W / 2, 26, { align: 'center', color: '#e8f0e0' });
      G.font.small.draw(ctx, 'Больница Конохи', W / 2, 48, { align: 'center', color: '#b8d0b8' });
      G.shade.shadow(ctx, W / 2 + 1, 100, 8, 2, 0.35);
      G.chars.draw(ctx, 'hokage', 'down', 0, W / 2, 100);
    },
  };
});
