// Стража Конохи на земле: пары патрульных ходят по маршрутам между ориентирами (ворота — резиденция, рынок, кварталы).
// Днём патрулей больше; ночью — меньше, зато с бумажными фонарями, свет которых виден в темноте.
// Патрульные — декорация, как шиноби на крышах (world/roof_patrol.js): не мешают проходу и не попадают в сохранение.
G.guards = (() => {
  const T = 16;
  const ROUTES = [   // [откуда, куда, днём, ночью]
    ['gate', 'hokage_tower', true, true], ['market', 'teahouse', true, false], ['clan_hyuga', 'uchiha_police', true, true],
    ['academy', 'hospital', true, false], ['night_alley', 'hero_home', false, true], ['clan_inuzuka', 'clan_akimichi', true, true],
    ['hero_home', 'academy', true, true, 'guards_up'],   // добавляется после рассказа Хокаге о незнакомце (выбор hokage)
  ];
  function point(map, tpl) {
    const b = map.buildings.find((x) => x.tplId === tpl) || (map.spots && map.spots[tpl]);
    if (!b) return null;
    const p = b.door ? G.world.outsideOf(b) : { x: (b.tx + 1) * T + 8, y: (b.ty + b.th + 1) * T + 12 };
    const f = G.world.freeTile(map, p.x / T | 0, (p.y / T | 0) + 1);
    return f ? { x: f[0] * T + 8, y: f[1] * T + 12 } : null;
  }
  function build(map) {
    if (map._guards) return map._guards;
    const patrols = [];
    ROUTES.forEach(([a, b, day, night, need], i) => {
      const A = point(map, a), B = point(map, b);
      if (!A || !B) return;
      const path = G.nav.path(map, A.x, A.y, B.x, B.y, 60000);
      if (!path || path.length < 8) return;
      const pts = path.map(([x, y]) => ({ x: x * T + 8, y: y * T + 12 }));
      for (let k = 0; k < 2; k++) patrols.push({ id: 'chunin', name: 'Стража', pts, i: Math.max(0, 10 * i % pts.length - k * 2), step: 1, x: pts[0].x, y: pts[0].y,
        dir: 'down', anim: 0, moving: true, day, night, need, serial: i * 2 + k, wait: k * 0.45, _guard: true });
    });
    return (map._guards = { patrols });
  }
  const night = () => { const m = G.state.vars.min % 1440; return m >= 20 * 60 || m < 6 * 60; };
  const onDuty = (p) => (!p.need || G.state.flags[p.need]) && (night() ? p.night : p.day);
  function update(world, dt) {
    if (!world.map || world.map.id !== 'konoha') return;
    for (const p of build(world.map).patrols) {
      if (!onDuty(p)) continue;
      if (p.wait > 0) { p.wait -= dt; p.moving = false; continue; }
      const q = p.pts[p.i], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy), sp = 26 * dt;
      if (d <= sp) {
        p.x = q.x; p.y = q.y; p.i += p.step;
        if (p.i >= p.pts.length || p.i < 0) { p.step = -p.step; p.i = Math.max(0, Math.min(p.pts.length - 1, p.i + 2 * p.step)); p.wait = 2.5; }   // у ориентира — короткая остановка, потом обратно
        continue;
      }
      p.x += dx / d * sp; p.y += dy / d * sp; p.moving = true; p.anim += dt * 6;
      p.dir = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up';
    }
  }
  // кто сейчас на экране — для общей сортировки по глубине вместе с жителями
  function actors(world) {
    if (!world.map || world.map.id !== 'konoha') return [];
    const c = world.cam, W = G.screen.W / (world.z || 1), H = world.viewH() / (world.z || 1);
    return build(world.map).patrols.filter((p) => onDuty(p) && p.x > c.x - 24 && p.x < c.x + W + 24 && p.y > c.y - 8 && p.y < c.y + H + 30);
  }
  // бумажный фонарь в руке ночью (рисуется вместе с патрульным)
  function lantern(ctx, a) {
    if (!a._guard || !night()) return;
    const side = a.dir === 'left' ? -1 : 1, x = Math.round(a.x + side * 7), y = Math.round(a.y - 12 + (a.moving ? Math.sin(a.anim * 2) : 0));
    ctx.fillStyle = '#5a3a24'; ctx.fillRect(x, y - 6, 1, 4);
    ctx.fillStyle = '#e8a040'; ctx.fillRect(x - 2, y - 2, 5, 6); ctx.fillStyle = '#ffd890'; ctx.fillRect(x - 1, y - 1, 3, 4);
    ctx.fillStyle = '#7a2a20'; ctx.fillRect(x - 2, y - 2, 5, 1); ctx.fillRect(x - 2, y + 3, 5, 1);
  }
  // тёплое пятно света вокруг фонаря — поверх ночного затемнения
  function glow(ctx, world) {
    if (!night() || G.storage.settings.fx === false) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const a of actors(world)) {
      const x = a.x + (a.dir === 'left' ? -7 : 7), y = a.y - 10, g = ctx.createRadialGradient(x, y, 1, x, y, 30);
      g.addColorStop(0, 'rgba(255,190,100,0.35)'); g.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 30, y - 30, 60, 60);
    }
    ctx.restore();
  }
  return { build, update, actors, lantern, glow };
})();
