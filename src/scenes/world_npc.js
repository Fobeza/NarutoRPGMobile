// Сцена мира, часть «Жители»: проходимость клеток для NPC, выбор пути и шаг блуждающего жителя.
// Методы подмешиваются в объект сцены (scenes/world.js: G.worldParts); this — сама сцена.
// K — общие константы сцены: тайл, высота шапки и нижней полосы, объекты, за которыми герой просвечивает.
G.worldParts = G.worldParts || [];
G.worldParts.push(({ T, HUD_H, STRIP_H, FADE_BEHIND }) => ({
    // --- навигация NPC по клеткам: никаких шагов в стены ---
    npcWalk(tx, ty) {
      const T = G.CONFIG.TILE, m = this.map;
      const c = m._wk || (m._wk = new Map()), k = tx * 4096 + ty;
      let v = c.get(k);
      if (v === undefined) {
        v = tx >= 1 && ty >= 1 && tx < m.w - 1 && ty < m.h - 1 && !m.blockedRect({ x: tx * T + 2, y: ty * T + 7, w: 12, h: 7 });
        if (v && m.outdoor) { const id = m.get(tx, ty); v = id !== G.tiles.ID.WATER && id !== G.tiles.ID.DEEP; }
        c.set(k, v);
      }
      return v;
    },
    snapNpc(n) {
      const T = G.CONFIG.TILE, x0 = Math.floor(n.x / T), y0 = Math.floor(n.y / T);
      if (this.npcWalk(x0, y0)) return;
      for (let r = 1; r <= 4; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
        if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue;
        if (this.npcWalk(x0 + a, y0 + b)) { n.x = (x0 + a) * T + 8; n.y = (y0 + b) * T + 12; n.home = { x: n.x, y: n.y }; return; }
      }
    },
    planPath(n) {
      const T = G.CONFIG.TILE, sx = Math.floor(n.x / T), sy = Math.floor(n.y / T);
      const R = Math.max(2, Math.min(12, Math.round(n.wanderR / T) + 1)), hx = n.home.x, hy = n.home.y;
      const prev = new Map([[sx * 4096 + sy, null]]), dist = new Map([[sx * 4096 + sy, 0]]), q = [[sx, sy]], cand = [];
      for (let i = 0; i < q.length; i++) {
        const [x, y] = q[i], d = dist.get(x * 4096 + y);
        if (d >= 2 && Math.hypot(x * T + 8 - hx, y * T + 12 - hy) <= n.wanderR + 4) cand.push([x, y]);
        if (d >= R) continue;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + a, ny = y + b, k = nx * 4096 + ny;
          if (dist.has(k) || !this.npcWalk(nx, ny)) continue;
          dist.set(k, d + 1); prev.set(k, [x, y]); q.push([nx, ny]);
        }
      }
      if (!cand.length) return null;
      let t = cand[Math.floor(Math.random() * cand.length)];
      const path = [];
      while (t && !(t[0] === sx && t[1] === sy)) { path.unshift(t); t = prev.get(t[0] * 4096 + t[1]); }
      return path;
    },

    updateNpc(n, dt) {
      if (G.residents && G.residents.tick(this, n, dt)) {if(G.villageDaily)G.villageDaily.travelling(n);return;}
      if (G.villageDaily && G.villageDaily.tickNpc(this,n,dt)) return;
      n.aiT -= dt;
      if (G.life2) G.life2.npcTick(this, n, dt);
      if (n.ai === 'wander') {
        if (!n._snap) { n._snap = 1; this.snapNpc(n); }
        if (!n.path || !n.path.length) {
          n.moving = false; n.anim = 0;
          if (n.aiT <= 0) {
            n.path = this.planPath(n);
            n.aiT = n.path && n.path.length ? 0 : 1 + Math.random() * 2.5;
            if (!n.path || !n.path.length) { n.path = null; if (Math.random() < 0.5) n.dir = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)]; }
            n.stuck = 0;
          }
        } else {
          const T = G.CONFIG.TILE, [tx, ty] = n.path[0];
          const px = tx * T + 8, py = ty * T + 12, dx = px - n.x, dy = py - n.y;
          if (Math.abs(dx) < 1.2 && Math.abs(dy) < 1.2) { n.path.shift(); if (!n.path.length) { n.aiT = 1 + Math.random() * 3; n.moving = false; } }
          else {
            const sp = (n.speed || 30) * dt, ax = Math.abs(dx) > 1.2;
            n.dir = ax ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
            const step = Math.min(sp, ax ? Math.abs(dx) : Math.abs(dy));
            const b = n.x + n.y * 10000;
            const v = G.actors.DIRV[n.dir];
            G.actors.move(this.map, n, v[0] * step, v[1] * step, this.others);
            n.moving = true; n.anim += dt * 6;
            if (n.x + n.y * 10000 === b) { n.stuck = (n.stuck || 0) + dt; if (n.stuck > 0.8) { n.path = null; n.moving = false; n.aiT = 0.5 + Math.random(); } } else n.stuck = 0;
          }
        }
      } else if (n.ai === 'idle' && n.aiT <= 0) {
        n.aiT = 2 + Math.random() * 4;
        if (Math.random() < 0.35) n.dir = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
      }
    },
}));
