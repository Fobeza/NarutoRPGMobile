// Мир: кэш карт (Коноха + интерьеры), персонажи и их движение.
G.actors = {
  make(id, x, y, dir = 'down') {
    return { id, x, y, dir, moving: false, anim: 0, ai: 'none', aiT: 1 + Math.random() * 2, vx: 0, vy: 0, stepT: 0, home: { x, y } };
  },
  feet(a, x = a.x, y = a.y) { return { x: x - 5, y: y - 5, w: 10, h: 5 }; },

  blocked(map, a, nx, ny, others) {
    const b = this.feet(a, nx, ny);
    if (map.blockedRect(b)) return true;
    if (others) for (const o of others) {
      if (o === a || o.roof || o.jump || Math.abs(o.x - nx) > 12 || Math.abs(o.y - ny) > 7) continue;
      if (G.util.rectsOverlap(b, this.feet(o))) return true;
    }
    return false;
  },

  // Шаг на 1 пиксель по осям, со «скольжением» вокруг углов
  step(map, a, dx, dy, others) {
    let moved = false;
    const sgn = G.util.sign;
    if (this.blocked(map, a, a.x, a.y, null)) { a.x += dx; a.y += dy; return true; } // застрял — выпускаем
    if (dx) {
      if (!this.blocked(map, a, a.x + dx, a.y, others)) { a.x += dx; moved = true; }
      else if (!dy) for (const n of [1, -1, 2, -2, 3, -3, 4, -4]) {
        if (!this.blocked(map, a, a.x, a.y + n, others) && !this.blocked(map, a, a.x + dx, a.y + n, others)) { a.y += sgn(n); moved = true; break; }
      }
    }
    if (dy) {
      if (!this.blocked(map, a, a.x, a.y + dy, others)) { a.y += dy; moved = true; }
      else if (!dx) for (const n of [1, -1, 2, -2, 3, -3, 4, -4]) {
        if (!this.blocked(map, a, a.x + n, a.y, others) && !this.blocked(map, a, a.x + n, a.y + dy, others)) { a.x += sgn(n); moved = true; break; }
      }
    }
    return moved;
  },

  // Плавное движение с накоплением дробной части
  move(map, a, vx, vy, others) {
    a.vx += vx; a.vy += vy;
    const sx = Math.trunc(a.vx), sy = Math.trunc(a.vy);
    a.vx -= sx; a.vy -= sy;
    let any = false;
    const n = Math.max(Math.abs(sx), Math.abs(sy));
    for (let i = 0; i < n; i++) {
      if (this.step(map, a, i < Math.abs(sx) ? Math.sign(sx) : 0, i < Math.abs(sy) ? Math.sign(sy) : 0, others)) any = true;
    }
    return any || n === 0;
  },

  DIRV: { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] },
  OPP: { up: 'down', down: 'up', left: 'right', right: 'left' },
};

G.world = {
  maps: {},
  SEED: 7,

  konoha() {
    if (!this.maps.konoha) {
      const t0 = performance.now();
      const m = G.mapgen.konoha(G.KONOHA_DRAFT, this.SEED);
      this.populateKonoha(m);
      m.finalize();
      G.mapgen.pockets(m);
      this.maps.konoha = m;
      this.genMs = Math.round(performance.now() - t0);
    }
    return this.maps.konoha;
  },

  get(id) {
    if (id === 'konoha') return this.konoha();
    if (this.maps[id]) return this.maps[id];
    const k = this.konoha();
    const n = Number(String(id).split(':')[1]);
    const b = k.buildings[n];
    if (!b || !b.interior) return k;
    const m = G.interiors.build(b.interior);
    m.building = b;
    // проход от точки появления до коврика всегда свободен
    const ex = m.warps[0] && m.warps[0].rect;
    if (ex) {
      const lane = { x: m.spawn.x - 9, y: m.spawn.y - 12, w: 18, h: ex.y + ex.h - (m.spawn.y - 12) };
      const before = m.objects.length;
      m.objects = m.objects.filter((o) => !(o.box && G.util.rectsOverlap(o.box, lane)));
      if (m.objects.length !== before) m.finalize();
    }
    m.npcs = m.npcs.map((s) => this.makeNpc(s));
    this.maps[id] = m;
    return m;
  },

  // Позиция перед дверью здания (снаружи)
  outsideOf(b) {
    const T = G.CONFIG.TILE;
    return { map: 'konoha', x: b.door.tx * T + 8, y: (b.door.ty + 1) * T + 11, dir: 'down' };
  },

  heroHome() { return this.konoha().landmarks.hero_home; },
  startPos() {
    const b = this.heroHome();
    const m = this.get(b.interior.id);
    return { map: m.id, x: 3 * 16 + 8, y: 4 * 16 + 4, dir: 'down' };
  },

  makeNpc(s) {
    const a = G.actors.make(s.id, s.x, s.y, s.dir || 'down');
    Object.assign(a, { ai: s.ai || 'idle', talk: s.talk, reach: s.reach, wanderR: s.wanderR || 32, mark: s.mark, name: s.name, cond: s.cond, shop: s.shop, shopTitle: s.shopTitle,
      sched: s.sched, keep: s.keep, dryOnly: s.dryOnly });
    return a;
  },

  populateKonoha(m) {
    const T = G.CONFIG.TILE;
    const L = (tpl) => G.KONOHA_DRAFT.buildings.find((b) => b.tpl === tpl);
    const at = (tx, ty) => ({ x: tx * T + 8, y: ty * T + 12 });
    const list = [];
    const sw = L('swing_tree'), fl = L('flowers'), pier = L('pier'), hy = L('clan_hyuga'), ac = L('academy');
    const H = 60, day1 = () => G.state.vars.day === 1;
    // Расписание (этап 4): sched — окна [от, до, дни], keep — «держать» ради сюжета.
    // В будни до обеда одноклассники в Академии (interiors.js), после — в своих местах.
    if (sw) list.push({ id: 'naruto', ...at(sw.x + 2, sw.y + 3), dir: 'down', talk: 'naruto_konoha', mark: 'naruto',
      cond: () => !G.state.flags.naruto_invited || G.state.flags.ramen_done,
      keep: () => day1() && !G.state.flags.naruto_invited,
      sched: [[12 * H, 18 * H, 'wd'], [9 * H, 18 * H, 'we']] });
    if (fl) list.push({ id: 'sakura', ...at(fl.x + 3, fl.y + 5), dir: 'down', talk: 'sakura_konoha', mark: 'sakura', ai: 'wander', wanderR: 20,
      sched: [[13 * H, 19 * H, 'wd'], [10 * H, 18 * H, 'we']], dryOnly: true });
    if (pier) list.push({ id: 'sasuke', ...at(pier.x + 1, pier.y + 3), dir: 'down', talk: 'sasuke_konoha', mark: 'sasuke',
      sched: [[13 * H, 20 * H, 'wd'], [6 * H, 12 * H, 'we'], [15 * H, 20 * H, 'we']] });
    if (hy) list.push({ id: 'hinata', ...at(hy.x + 7, hy.y + 9), dir: 'left', talk: 'hinata_konoha', mark: 'hinata',
      sched: [[14 * H, 19 * H, 'wd'], [9 * H, 18 * H, 'we']] });
    // Шикамару после уроков смотрит на облака на лужайке за Академией
    if (ac) {
      const spot = this.freeTile(m, ac.x + 12, ac.y + 2);
      if (spot) list.push({ id: 'shikamaru', ...at(spot[0], spot[1]), dir: 'up', talk: 'shikamaru_clouds',
        sched: [[13 * H, 18 * H, 'wd'], [10 * H, 18 * H, 'we']], dryOnly: true });
    }
    // Ночной патруль чунинов на перекрёстке главных улиц (комендантский час для учеников — с 23:00)
    const cr = G.KONOHA_DRAFT.cross || [78, 45], cross = this.freeTile(m, cr[0], cr[1]);
    if (cross) list.push({ id: 'villager_m', ...at(cross[0], cross[1]), dir: 'down', name: 'Чунин-патрульный', talk: 'patrol_warn',
      ai: 'wander', wanderR: 40, sched: [[22 * H, 30 * H]] });
    // массовка
    const rnd = G.util.rng(99);
    for (const sp of m.spawnPoints) {
      const id = rnd.chance(0.5) ? 'villager_m' : 'villager_f';
      const line = G.interiors.VILLAGER_LINES[Math.floor(rnd() * G.interiors.VILLAGER_LINES.length)];
      // ночью улицы пустеют (§2.5): большинство жителей гуляет с 6 до 22, часть прячется от дождя
      const night = rnd.chance(0.15), dry = rnd.chance(0.5);
      list.push({ id, x: sp.x, y: sp.y, dir: rnd.pick(['up', 'down', 'left', 'right']), ai: 'wander', wanderR: 56, talk: [{ who: id, name: id === 'villager_m' ? 'Житель' : 'Жительница', text: line }],
        sched: night ? null : [[6 * 60 + (sp.x % 7) * 10, 21 * 60 + (sp.y % 7) * 10]], dryOnly: dry && !night });
    }
    m.npcs = list.map((s) => this.makeNpc(s));
    // секрет: камень у водопада
    const wf = m.spots.waterfall;
    if (wf) { m.secretRock = m.addObject('rock', (wf.tx - 1) * T + 8, (wf.ty + wf.th) * T + 2, { talk: 'secret_waterfall' }); m.finalize(); }
  },

  // Ближайшая свободная клетка улицы (для расстановки NPC)
  // strict: клетка не в узком проходе (свободно ≥3 соседей) и достижима от главной улицы
  freeTile(m, tx, ty, obstacle) {
    const T = G.CONFIG.TILE;
    const free = (x, y) => !m.blockedRect({ x: x * T + 2, y: y * T + 4, w: 12, h: 10 }) && !(m.reach && !m.reach[y * m.w + x]);
    for (const strict of [true, false]) for (let r = 0; r <= 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = tx + dx, y = ty + dy;
      if (!free(x, y)) continue;
      if (strict && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => free(x + a, y + b)).length < 3) continue;
      if (strict && m.keep && m.keep[y * m.w + x] && m.occ[y * m.w + x] !== 1) continue;   // не на крыльце и не на узкой дорожке
      if (obstacle && m.occ && (m.occ[y * m.w + x] === 1 || (m.keep && m.keep[y * m.w + x]))) continue;   // предметы — не на дорогах и дорожках
      return [x, y];
    }
    return null;
  },

  // Анимированные объекты (водопад)
  drawAnim(ctx, o, time) {
    if (o.anim === 'waterfall') {
      const x = o.x, y = o.y, w = o.fw, h = o.fh;
      ctx.fillStyle = '#5aa0e0'; ctx.fillRect(x + 6, y, w - 12, h);
      ctx.fillStyle = '#9ad0f8';
      for (let i = 0; i < 8; i++) {
        const sx = x + 8 + ((i * 7) % (w - 16));
        const sy = (time * 60 + i * 13) % h;
        ctx.fillRect(sx, y + sy, 1, 6);
      }
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) ctx.fillRect(x + 4 + ((i * 11 + Math.floor(time * 8)) % (w - 8)), y + h - 3 + (i % 2), 3, 2);
    }
  },
};
