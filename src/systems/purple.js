// Фиолетовая чакра героя: её много и она сильная, но управлять ею трудно.
// «Стабильность» (0–100) считается из Контроля чакры, практики, усталости и ран. Любое действие с чакрой
// может дать выброс: чем ниже стабильность и больше затраты, тем выше шанс. Выброс случайный —
// усиление приёма (×1,5) или срыв (усталость, потеря чакры, лёгкий урон). Бой и тренировки вызывают G.purple.roll.
G.purple = (() => {
  const V = () => G.state.vars;
  const COLOR = '#a050e0', CHANCE_CAP = 0.4, PRACTICE_CAP = 40;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const PRACTICE = ['meditate', 'falls', 'tree', 'water', 'seals'];   // тренировки, где герой учится держать чакру

  function stability() {
    const v = V();
    return Math.round(clamp(10 + (G.hero.stat('ctrl') - 1) * 7 + (v.purple_ctl || 0) - (v.fatigue || 0) * 0.3 - (v.injury || 0) * 5, 5, 100));
  }
  // шанс выброса при затратах cost (в «пунктах чакры»: ~30 — обычная тренировка или приём)
  function chance(cost) { return clamp((1 - stability() / 100) * cost / 40, 0, CHANCE_CAP); }
  // выброс: null | { kind: 'boost' | 'backfire' }
  function roll(cost, rng = Math.random) {
    if (rng() >= chance(cost)) return null;
    const pBoost = 0.35 + stability() * 0.004;
    return { kind: rng() < pBoost ? 'boost' : 'backfire' };
  }
  // последствия срыва; усиление ничего не списывает — множитель применяет вызывающий (BOOST)
  function apply(out, world) {
    if (!out) return;
    const v = V(), w = world || G.scenes.stack.find((s) => s.name === 'world');
    if (w) G.purple.flashUntil = (w.time || 0) + 0.9;
    if (out.kind === 'backfire') {
      G.game.tire(8); v.chakra = Math.max(0, v.chakra - 15); v.hp = Math.max(5, v.hp - 5);
      v.purple_ctl = Math.max(0, (v.purple_ctl || 0) - 1);
      if (w && w.showToast) w.showToast('Фиолетовая чакра сорвалась! Усталость растёт');
      G.game.note('Срыв фиолетовой чакры');
    } else if (w && w.showToast) w.showToast('Фиолетовая чакра вспыхнула: приём усилен');
  }
  // практика: каждая тренировка по контролю чакры приближает стабильность
  function practice(trainId, score) {
    if (!PRACTICE.includes(trainId)) return 0;
    const v = V(), add = Math.round(1.5 * score * 10) / 10;
    v.purple_ctl = Math.min(PRACTICE_CAP, (v.purple_ctl || 0) + add);
    return add;
  }
  // сила ауры 0..1: ярче при полной чакре
  function aura() { return clamp(((V().chakra || 0) - 50) / 50, 0, 1); }
  // искры вокруг героя; вспышка после выброса
  function drawAura(ctx, world, a) {
    if (G.storage.settings.fx === false || !G.state.started) return;
    const t = world.time || 0, k = aura(), flash = clamp(((G.purple.flashUntil || 0) - t) / 0.9, 0, 1);
    const n = Math.round(k * 7) + (flash > 0 ? 8 : 0);
    if (n <= 0) return;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const ang = t * 1.4 + i * 2.1, r = 7 + Math.sin(t * 2 + i) * 2 + flash * 5, up = (t * 9 + i * 5) % 12;
      ctx.globalAlpha = (0.45 + 0.45 * Math.abs(Math.sin(t * 3 + i))) * (flash > 0 ? 1 : 0.85);
      ctx.fillStyle = i % 3 === 0 ? '#e0b8ff' : COLOR;
      ctx.fillRect(Math.round(a.x + Math.cos(ang) * r), Math.round(a.y - 6 + Math.sin(ang) * r * 0.7 - up), 2, 2);
    }
    ctx.restore();
  }
  return { COLOR, PRACTICE, stability, chance, roll, apply, practice, aura, drawAura, BOOST: 1.5, flashUntil: 0 };
})();
