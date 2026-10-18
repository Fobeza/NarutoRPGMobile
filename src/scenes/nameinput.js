// Ввод имени героя: Ирука спрашивает, игрок вводит имя (реальный <input> → клавиатура iOS).
G.scenes.register('nameinput', () => {
  const el = () => document.getElementById('text-entry');
  const inp = () => document.getElementById('te-input');
  const hint = () => document.getElementById('te-hint');
  let stage = 'ask'; // ask → typing → confirm
  let onOk = null, onKey = null;
  let t = 0;

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
    enter() {
      stage = 'ask';
      G.dialog.start('ask_name_tmp', { bottom: 30, onEnd: () => this.openEntry() });
    },
    resume() {},

    openEntry() {
      stage = 'typing';
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
        stage = 'confirm';
        G.dialog.start('intro_name_confirm', {
          bottom: 30,
          onEnd: () => {
            if (G.state.flags.name_ok) {
              G.state.started = true;
              G.storage.save(G.state);
              G.scenes.fadeTo(G.scenes.make('world', Object.assign(G.world.startPos(), { intro: 'home_wake' })));
            } else this.openEntry();
          },
        });
      };
      onOk = (e) => { e.preventDefault(); submit(); };
      onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
      document.getElementById('te-ok').onpointerdown = onOk;
      i.onkeydown = onKey;
    },

    exit() { el().classList.add('hidden'); },

    update(dt) { t += dt; },

    draw(ctx) {
      const W = G.screen.W, H = G.screen.H, U = G.ui;
      // класс Академии: деревянный пол, доска в раме
      U.backdrop(ctx);
      U.wood(ctx, 0, 90, W, H - 90, '#8a5a36', false, 11);
      U.panel(ctx, 14, 12, W - 28, 64, 'plank');
      ctx.fillStyle = '#1f3a2e'; ctx.fillRect(18, 16, W - 36, 56);
      G.shade.tint(ctx, 18, 16, W - 36, 56, (u, v) => 0.1 - 0.25 * v, { keepInk: false, steps: 10 });
      G.font.draw(ctx, 'Вступительный тест', W / 2, 26, { align: 'center', color: '#e8f0e0' });
      G.font.small.draw(ctx, 'Академия Конохи', W / 2, 48, { align: 'center', color: '#b8d0b8' });
      // Ирука у доски
      G.shade.shadow(ctx, W / 2 + 1, 100, 8, 2, 0.35);
      G.chars.draw(ctx, 'iruka', 'down', 0, W / 2, 100);
    },
  };
});

G.script.parse(`
=== ask_name_tmp
iruka: Так-так, новенький! Я Умино Ирука, твой учитель.
iruka: Для начала — как тебя зовут?
end
`);
