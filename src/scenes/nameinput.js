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
      const W = G.screen.W, H = G.screen.H;
      // фон: класс Академии (упрощённо)
      ctx.fillStyle = '#c8a878'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#a8885a';
      for (let y = 0; y < H; y += 8) ctx.fillRect(0, y, W, 1);
      ctx.fillStyle = '#2a4a3a'; ctx.fillRect(16, 14, W - 32, 50);   // доска
      ctx.fillStyle = '#7a4a2a'; ctx.fillRect(14, 12, W - 28, 2); ctx.fillRect(14, 64, W - 28, 3);
      G.font.draw(ctx, 'Вступительный тест', W / 2, 24, { align: 'center', color: '#e8f0e0' });
      G.font.draw(ctx, 'Академия Конохи', W / 2, 40, { align: 'center', color: '#b8d0b8' });
      // Ирука у доски
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
