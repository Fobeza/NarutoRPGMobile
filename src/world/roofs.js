// Слой крыш: герой запрыгивает на крышу (A у стены дома), бегает по крышам, перепрыгивает проулки
// (до ~4 клеток) и спрыгивает вниз (A на краю). Открывается сценой с Наруто (флаг roofs).
G.roofs = {
  JUMP: 64,          // максимальный прыжок между крышами, px
  SPEED: 1.25,       // на крышах быстрее
  XP_DAY: 6,         // опыт Скорости за день от бега по крышам (максимум)
  wallH(id, tpl) { return G.buildgfx.wallH(tpl, id); },
  rects(m) {
    if (m._roofs) return m._roofs;
    const T = G.CONFIG.TILE, out = [];
    for (const b of m.buildings) {
      if (b.sortY < 0 || b.tplId === 'gate' || !b.tplDef || !b.spr) continue;
      const HF = b.th * T, OV = -b.oy, wh = this.wallH(b.tplId, b.tplDef);
      const top = b.ty * T - OV + 7;
      let bottom = b.ty * T + HF - wh + 3;
      if (bottom - top < 14) bottom = top + 14;
      out.push({ x: b.tx * T + 4, y: top, w: b.tw * T - 8, h: bottom - top, b });
    }
    return (m._roofs = out);
  },
  at(m, x, y) { for (const r of this.rects(m)) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r; return null; },
  of(m, b) { return this.rects(m).find((r) => r.b === b); },
  unlocked() { return !!G.state.flags.roofs; },
  canClimb(world, b) { const p = world.player; return this.unlocked() && world.map.outdoor && !p.roof && !p.jump && !!this.of(world.map, b); },
  clampIn(r, x, y) { return [Math.max(r.x + 5, Math.min(r.x + r.w - 5, x)), Math.max(r.y + 6, Math.min(r.y + r.h - 2, y))]; },
  climb(world, b) {
    const p = world.player, r = this.of(world.map, b), v = G.actors.DIRV[p.dir];
    const [x, y] = this.clampIn(r, p.x + v[0] * 20, p.dir === 'up' ? r.y + r.h - 4 : p.y + v[1] * 20 - (p.y - (r.y + r.h)) * 0.5);
    this.startJump(p, x, y, true);
    if (!G.state.flags.tip_roofs) { G.state.flags.tip_roofs = 1; world.showToast('На крыше: A у края — спрыгнуть'); }
  },
  startJump(p, x1, y1, toRoof) {
    const d = Math.hypot(x1 - p.x, y1 - p.y);
    p.jump = { t: 0, dur: 0.28 + d / 260, x0: p.x, y0: p.y, x1, y1, toRoof, h: 10 + Math.min(16, d / 4) };
    p.roof = false; p.moving = false;
    G.audio.tone ? G.audio.tone(700, 0.08, 'triangle', 0.06, 1100) : G.audio.sfx.blip();
  },
  updateJump(world, dt) {
    const p = world.player, j = p.jump; if (!j) return;
    j.t += dt; const k = Math.min(1, j.t / j.dur);
    p.x = j.x0 + (j.x1 - j.x0) * k; p.y = j.y0 + (j.y1 - j.y0) * k;
    if (k >= 1) { p.jump = null; p.roof = j.toRoof; G.audio.sfx.step(); }
  },
  // движение по крышам; true — обработано
  move(world, p, ax, speed) {
    if (!p.roof) return false;
    const m = world.map, sp = speed * this.SPEED;
    const dx = ax.x * sp, dy = ax.y * sp;
    const ok = (x, y) => !!this.at(m, x, y);
    const x0 = p.x, y0 = p.y;
    if (ok(p.x + dx, p.y + dy)) { p.x += dx; p.y += dy; }
    else if (dx && ok(p.x + dx, p.y)) p.x += dx;
    else if (dy && ok(p.x, p.y + dy)) p.y += dy;
    else {
      // край: ищем крышу впереди в пределах прыжка
      const cur = this.at(m, p.x, p.y), len = Math.hypot(ax.x, ax.y) || 1, ux = ax.x / len, uy = ax.y / len;
      for (let s = 8; s <= this.JUMP; s += 4) {
        const r = this.at(m, p.x + ux * s, p.y + uy * s);
        if (r && r !== cur) { const [x, y] = this.clampIn(r, p.x + ux * (s + 8), p.y + uy * (s + 8)); this.startJump(p, x, y, true); return true; }
      }
      if (!world._edgeTip) { world._edgeTip = 1; world.showToast('Край крыши. A — спрыгнуть'); }
    }
    // опыт Скорости за пробежку по крышам
    const moved = Math.hypot(p.x - x0, p.y - y0), v = G.state.vars, d = G.state.daily;
    p.roofRun = (p.roofRun || 0) + moved;
    if (p.roofRun > 320) { p.roofRun = 0; if ((d.roofxp || 0) < this.XP_DAY) { d.roofxp = (d.roofxp || 0) + 0.5; G.train.addXp('spd', 0.5); } v.roofdist = (v.roofdist || 0) + 1; }
    return true;
  },
  // A на крыше — спрыгнуть
  interact(world) {
    const p = world.player; if (!p.roof) return false;
    const m = world.map, r = this.at(m, p.x, p.y); if (!r) { p.roof = false; return true; }
    const T = G.CONFIG.TILE, b = r.b, v = G.actors.DIRV[p.dir];
    const gy = b.ty * T + (p.y - r.y) / r.h * b.th * T;     // проекция на землю
    let x = p.x, y = gy;
    if (p.dir === 'down') y = (b.ty + b.th) * T + 8;
    else if (p.dir === 'up') y = b.ty * T - 4;
    else if (p.dir === 'left') x = b.tx * T - 8;
    else x = (b.tx + b.tw) * T + 8;
    for (const [ox, oy] of [[0, 0], [0, 6], [0, -6], [6, 0], [-6, 0], [0, 12], [12, 0], [-12, 0], [0, -12], [v[0] * 10, v[1] * 10]]) {
      const fx = x + ox, fy = y + oy;
      if (!m.blockedRect(G.actors.feet(p, fx, fy)) && !this.inFootprint(m, fx, fy)) { this.startJump(p, fx, fy, false); return true; }
    }
    world.showToast('Отсюда не спрыгнуть'); G.audio.sfx.error();
    return true;
  },
  inFootprint(m, x, y) { const T = G.CONFIG.TILE; return m.buildings.some((b) => b.sortY >= 0 && x >= b.tx * T && x < (b.tx + b.tw) * T && y >= b.ty * T && y < (b.ty + b.th) * T); },
  drawPlayer(ctx, world) {
    const p = world.player, j = p.jump;
    const lift = j ? Math.sin(Math.PI * Math.min(1, j.t / j.dur)) * j.h : 0;
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
    ctx.fillRect(Math.round(p.x - 5 + lift * 0.1), Math.round(p.y - 2), 10, 3);
    ctx.globalAlpha = 1;
    const frame = p.moving ? G.chars.WALK[Math.floor(p.anim) % 4] : j ? 1 : 0;
    G.chars.draw(ctx, p.id, p.dir, frame, p.x, Math.round(p.y - lift));
  },
};
