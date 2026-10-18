// Применение расписания: персонажи переходят от места к месту в течение дня + запросы для календаря.
G.schedule = (() => {
  const H = 60;
  const match = (d, day) => d === 'all' || (d === 'wd') === G.life.weekday(day);
  function rowsFor(id, day = G.state.vars.day) {
    const s = G.SCHED[id];
    if (!s || day < s.since) return [];
    return s.rows.filter((r) => match(r[0], day)).sort((a, b) => a[1] - b[1]);
  }
  function at(id, day = G.state.vars.day, min = G.state.vars.min) {
    const h = min / 60;
    return rowsFor(id, day).find((r) => h >= r[1] && h < r[2]) || null;
  }
  function label(id, day, min) {
    const r = at(id, day, min);
    if (r) return r[3];
    const h = ((min ?? G.state.vars.min) / 60) % 24;
    return h < 6 || h >= 22 ? 'Спит дома' : 'Занят своими делами';
  }
  function who() { return Object.keys(G.SCHED).filter((id) => !['chunin'].includes(id)); }

  // перемещение уличных персонажей: окна sched заменяются окнами всех уличных строк, место — по текущей строке
  const basePop = G.world.populateKonoha.bind(G.world);
  G.world.populateKonoha = function (m) {
    basePop(m);
    const T = G.CONFIG.TILE;
    const L = (tpl) => G.KONOHA_DRAFT.buildings.find((b) => b.tpl === tpl);
    for (const n of m.npcs) {
      const s = G.SCHED[n.id];
      if (!s || n.shop || n.route) continue;
      const rows = s.rows.filter((r) => r[4]);
      if (!rows.length || (n.id === 'chunin')) continue;
      const home = { x: n.x, y: n.y };
      n.route = rows.map((r) => {
        let spot = null;
        if (r[4] === '@') spot = home;
        else { const b = L(r[4]); const p = b && this.freeTile(m, b.x + r[5], b.y + r[6]); if (p) spot = { x: p[0] * T + 8, y: p[1] * T + 12 }; }
        return { w: [r[1] * H, r[2] * H, r[0] === 'wd' ? 'wd' : r[0] === 'we' ? 'we' : undefined], spot };
      }).filter((s2) => s2.spot);
      if (!n.route.length) { n.route = null; continue; }
      n.sched = n.route.map((s2) => s2.w);
    }
  };
  // вызывается из refreshNpcs/softRefresh мира: переносит NPC на место текущего окна (не на глазах у героя)
  function sync(world) {
    const m = world.map;
    if (!m || m.outdoor === false) return;
    const cam = world.cam;
    for (const n of m.npcs) {
      if (!n.route) continue;
      const i = n.route.findIndex((s2) => G.life.inWindow(s2.w));
      if (i < 0 || i === n._stop) continue;
      const onScr = cam && n._stop !== undefined && n.x > cam.x - 16 && n.x < cam.x + G.screen.W + 16 && n.y > cam.y - 8 && n.y < cam.y + G.screen.H + 40;
      if (onScr) continue;
      const sp = n.route[i].spot;
      n._stop = i; n.x = sp.x; n.y = sp.y; n.home = { x: sp.x, y: sp.y }; n.path = null; n._snap = 0; n.moving = false;
    }
  }
  return { sync, rowsFor, at, label, who };
})();
