// Катсцены: актёры сами идут по деревне, камера следует за ними, герой замирает, сверху и снизу — чёрные полосы.
// Определение: G.cine.defs[id] = (world) => [шаги]; позиции — в клетках относительно героя.
//   { spawn:'k', id:'naruto', at:[dx,dy], dir }   { walk:'k', to:[dx,dy], speed, par:true }   { say:'script_id' }
//   { wait: сек }   { emote:'k', ch:'!' }   { face:'k', dir }   { cam:'k'|'player' }   { hero:'dir' }   { flag:'name' }
G.cine = (() => {
  const T = 16;
  const defs = {};
  let C = null;

  const walkable = (w, tx, ty) => w.npcWalk(tx, ty);
  function nearWalk(w, tx, ty) {
    if (walkable(w, tx, ty)) return [tx, ty];
    for (let r = 1; r <= 8; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (Math.max(Math.abs(a), Math.abs(b)) === r && walkable(w, tx + a, ty + b)) return [tx + a, ty + b];
    return [tx, ty];
  }
  function bfs(w, sx, sy, tx, ty) {
    const key = (x, y) => x * 4096 + y, prev = new Map([[key(sx, sy), null]]), q = [[sx, sy]];
    for (let i = 0; i < q.length && i < 5000; i++) {
      const [x, y] = q[i];
      if (x === tx && y === ty) break;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + a, ny = y + b, k = key(nx, ny);
        if (prev.has(k) || !walkable(w, nx, ny) || Math.abs(nx - sx) > 40 || Math.abs(ny - sy) > 40) continue;
        prev.set(k, [x, y]); q.push([nx, ny]);
      }
    }
    if (!prev.has(key(tx, ty))) return null;
    const path = []; let t = [tx, ty];
    while (t && !(t[0] === sx && t[1] === sy)) { path.unshift(t); t = prev.get(key(t[0], t[1])); }
    return path;
  }
  function play(id, world, onEnd) {
    const def = defs[id]; if (!def || C) return false;
    const steps = def(world);
    C = { id, world, steps, i: -1, t: 0, actors: {}, wait: null, bars: 0, running: [], onEnd, cam: null, camPos: null };
    world.cine = C;
    return true;
  }
  const hero = () => C.world.player;
  function tilePos(dx, dy) {
    const p = hero(), w = C.world;
    return nearWalk(w, Math.floor(p.x / T) + dx, Math.floor(p.y / T) + dy);
  }
  function next() {
    C.i++;
    if (C.i >= C.steps.length) return finish();
    const s = C.steps[C.i], w = C.world;
    if (s.spawn) {
      const [tx, ty] = tilePos(s.at[0], s.at[1]);
      const a = G.world.makeNpc({ id: s.id, name: s.name, x: tx * T + 8, y: ty * T + 12, dir: s.dir || 'down', ai: 'none' });
      a._cine = 1; C.actors[s.spawn] = a; w.npcs.push(a); w.others.push(a);
      return next();
    }
    if (s.walk) {
      const a = C.actors[s.walk], tx0 = Math.floor(a.x / T), ty0 = Math.floor(a.y / T);
      const [tx, ty] = tilePos(s.to[0], s.to[1]);
      const path = bfs(w, tx0, ty0, tx, ty) || [[tx, ty]];
      const job = { a, path, speed: s.speed || 40 };
      if (s.par) { C.running.push(job); return next(); }
      C.running.push(job); C.wait = { walk: job }; return;
    }
    if (s.say) { C.wait = { say: true }; G.dialog.start(s.say, { bottom: 22, onEnd: () => { C.wait = null; } }); return; }
    if (s.wait) { C.wait = { t: s.wait }; return; }
    if (s.emote) { const a = C.actors[s.emote]; a._em = { t: 1.6, cd: 99, ch: s.ch || '!' }; return next(); }
    if (s.face) { C.actors[s.face].dir = s.dir; return next(); }
    if (s.hero) { hero().dir = s.hero; return next(); }
    if (s.cam) { C.cam = s.cam === 'player' ? null : C.actors[s.cam]; return next(); }
    if (s.flag) { G.state.flags[s.flag] = 1; return next(); }
    if (s.sfx) { const f = G.audio.sfx[s.sfx]; f && f(); return next(); }
    return next();
  }
  function finish() {
    const w = C.world;
    w.npcs = w.npcs.filter((n) => !n._cine); w.others = w.others.filter((n) => !n._cine);
    w.cine = null; const cb = C.onEnd; C = null;
    w.updateCamera(); w.camPos = null;
    cb && cb();
  }
  function update(world, dt) {
    if (!C) return;
    C.bars = Math.min(1, C.bars + dt * 3);
    // движение актёров
    for (const j of C.running) {
      const a = j.a;
      if (!j.path.length) { a.moving = false; a.anim = 0; j.done = true; continue; }
      const [tx, ty] = j.path[0], px = tx * T + 8, py = ty * T + 12, dx = px - a.x, dy = py - a.y;
      if (Math.abs(dx) < 1.2 && Math.abs(dy) < 1.2) { j.path.shift(); continue; }
      const ax = Math.abs(dx) > 1.2, st = Math.min(j.speed * dt, ax ? Math.abs(dx) : Math.abs(dy));
      if (ax) { a.x += Math.sign(dx) * st; a.dir = dx > 0 ? 'right' : 'left'; } else { a.y += Math.sign(dy) * st; a.dir = dy > 0 ? 'down' : 'up'; }
      a.moving = true; a.anim += dt * (j.speed > 50 ? 10 : 6);
    }
    C.running = C.running.filter((j) => !j.done);
    for (const a of Object.values(C.actors)) if (a._em && a._em.t > 0) a._em.t -= dt;
    const w = C.wait;
    if (!w) return next();
    if (w.t != null) { w.t -= dt; if (w.t <= 0) { C.wait = null; next(); } }
    else if (w.walk) { if (w.walk.done) { C.wait = null; next(); } }
    else if (w.say && !C.wait) next();
  }
  // положение камеры (мягко едет за целью)
  function camTarget() {
    if (!C || !C.cam) return null;
    return { x: C.cam.x, y: C.cam.y };
  }
  function drawBars(ctx, HUD_H, VH, W) {
    if (!C) return;
    const bh = Math.round(C.bars * 16);
    ctx.fillStyle = '#000'; ctx.fillRect(0, HUD_H, W, bh); ctx.fillRect(0, HUD_H + VH - bh, W, bh);
  }
  return { defs, play, update, camTarget, drawBars, get active() { return !!C; } };
})();
