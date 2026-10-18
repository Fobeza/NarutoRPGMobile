// Чит-меню (только в режиме отладки): деньги, время, телепорт, сброс сюжета.
G.scenes.register('cheats', () => {
  let idx = 0, toast = null, toastT = 0;
  const world = () => G.scenes.stack.find((s) => s.name === 'world');
  const tp = (tpl) => {
    const w = world(); if (!w) return;
    const b = G.world.konoha().buildings.find((x) => x.tplId === tpl);
    if (!b) return;
    G.scenes.stack.splice(G.scenes.stack.indexOf(w) + 1); // закрыть меню
    w.goTo(G.world.outsideOf(b));
  };
  const RH = 13;
  const say = (t) => { toast = t; toastT = 1.4; };
  const items = [
    { label: '+1000 рё', act: () => { G.game.earn(1000); say('+1000 рё'); } },
    { label: 'Время +1 час', act: () => { G.game.advance(60); say(G.game.clock()); } },
    { label: 'Вечер (19:00)', act: () => { G.game.advanceTo('19:00'); say(G.game.clock()); } },
    { label: 'Сытость и энергия 100', act: () => { G.state.vars.food = 100; G.state.vars.energy = 100; say('Готово'); } },
    { label: 'Кунаи ×5, бинты ×3', act: () => { G.game.give('kunai', 5); G.game.give('bandage', 3); say('Выдано'); } },
    { label: '> Дом героя', act: () => tp('hero_home') },
    { label: '> Академия', act: () => tp('academy') },
    { label: '> Ичираку', act: () => tp('ichiraku') },
    { label: '> Главные ворота', act: () => tp('gate') },
    { label: 'Сюжет: после Ируки', act: () => { const f = G.state.flags; f.enrolled = 1; f.met_iruka = 1; G.game.advanceTo('12:30'); G.quests.start('day1'); G.quests.step('day1', 'iruka'); G.quests.start('homework'); say('Цель: Наруто'); } },
    { label: 'День +1 (утро 7:00)', act: () => { const v = G.state.vars; v.day = Math.min(56, v.day + 1); v.min = 7 * 60; G.state.daily = {}; say('День ' + v.day); } },
    { label: 'День +7', act: () => { const v = G.state.vars; v.day = Math.min(54, v.day + 7); v.min = 7 * 60; G.state.daily = {}; say('День ' + v.day); } },
    { label: 'Все техники', act: () => { for (const t of Object.keys(G.TECHS)) G.state.flags['tech_' + t] = 1; G.state.flags.tech_tree = 1; say('Все техники выучены'); } },
    { label: 'Статы +2', act: () => { const s = G.state.hero.stats; for (const k in s) s[k] = Math.min(G.STAT_CAP, s[k] + 2); say('Статы +2'); } },
    { label: 'Дружба всем +5', act: () => { for (const id of Object.keys(G.FRIENDS)) G.friends.add(id, 5); say('Дружба +5'); } },
    { label: 'Бой: тест (Саске)', act: () => { G.scenes.pop(); G.scenes.pop(); G.game.pending = { type: 'battle', enemy: 'sasuke', mode: 'spar', terrain: 'field' }; } },
    { label: 'Карта: открыть всю', act: () => { G.state.fog = '1'.repeat(G.nav.fogSize().bw * G.nav.fogSize().bh); say('Туман убран'); } },
    { label: 'Сбросить сюжет дня 1', act: () => {
      const f = G.state.flags; for (const k of ['enrolled', 'naruto_invited', 'ramen_done', 'met_naruto', 'met_iruka']) delete f[k];
      Object.assign(G.state.vars, { day: 1, min: 480, friend_naruto: 0 }); G.state.goal = null; G.state.log = [];
      G.state.quests = {}; G.state.tracked = null; G.state.marker = null; G.quests.start('day1'); say('Сброшено');
    } },
  ];
  return {
    name: 'cheats',
    transparent: true,
    rect() { const w = Math.min(G.screen.W - 8, 170), h = items.length * RH + 26; return { x: Math.round((G.screen.W - w) / 2), y: Math.max(22, Math.min(G.screen.H - h - 22, Math.round((G.screen.H - h) / 2))), w, h }; },
    update(dt) {
      const I = G.input, n = items.length;
      if (toastT > 0) { toastT -= dt; if (toastT <= 0) toast = null; }
      if (I.repeat('up', dt)) { idx = (idx + n - 1) % n; G.audio.sfx.select(); }
      if (I.repeat('down', dt)) { idx = (idx + 1) % n; G.audio.sfx.select(); }
      if (I.pressed('b') || I.pressed('menu')) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
      if (I.tapNow) {
        const r = this.rect(), i = Math.floor((I.tapNow.y - r.y - 17) / 12);
        if (i >= 0 && i < n && I.tapNow.x > r.x && I.tapNow.x < r.x + r.w) { idx = i; G.audio.sfx.confirm(); items[i].act(); }
        return;
      }
      if (I.pressed('a')) { G.audio.sfx.confirm(); items[idx].act(); }
    },
    draw(ctx) {
      const r = this.rect(), FS = G.font.small, U = G.ui, C = U.C;
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#0a0604'; ctx.fillRect(0, 0, G.screen.W, G.screen.H); ctx.globalAlpha = 1;
      U.panel(ctx, r.x, r.y, r.w, r.h, 'frame');
      U.title(ctx, 'ЧИТЫ (отладка)', r.x + r.w / 2, r.y - 7, 0);
      items.forEach((it, i) => {
        const y = r.y + 15 + i * RH, sel = i === idx;
        U.row(ctx, r.x + 6, y - 1, r.w - 12, RH, sel);
        FS.draw(ctx, it.label, r.x + 12, y + 2, { color: sel ? '#f8eed0' : C.ink, shadow: sel ? '#5a1408' : null, maxW: r.w - 24 });
      });
      if (toast) {
        const w = FS.measure(toast) + 20;
        U.panel(ctx, Math.round((G.screen.W - w) / 2), r.y + r.h + 4, w, 17, 'night');
        FS.draw(ctx, toast, G.screen.W / 2, r.y + r.h + 9, { align: 'center', color: '#f8eed0' });
      }
    },
  };
});
