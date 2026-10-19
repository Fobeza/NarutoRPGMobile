// Генератор карты Конохи из данных (районы, дороги, ключевые здания из G.KONOHA_DRAFT).
// Результат детерминирован: одинаковые данные + seed → одинаковая деревня.
//   1) земля по типам районов  2) дороги  3) ключевые здания  4) автозастройка жилых кварталов
//   5) декор: лес, деревья, фонари, лотки, заборы кланов  6) точки появления жителей
G.mapgen = (() => {
  const T = G.CONFIG.TILE;
  const H = G.util.hash2;

  function noise(x, y, s, scale) {
    const gx = x / scale, gy = y / scale, x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const a = H(x0, y0, s), b = H(x0 + 1, y0, s), c = H(x0, y0 + 1, s), d = H(x0 + 1, y0 + 1, s);
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }

  const SHOP_NAMES = ['Хозяйственная лавка', 'Лавка тканей', 'Гончарная лавка', 'Чайная лавка', 'Лавка свитков', 'Рыбная лавка', 'Лавка сладостей', 'Мастерская'];
  function nameOf(id, tpl, seed) {
    if (id === 'shop_generic' || id === 'shop_s') return SHOP_NAMES[Math.abs(seed) % SHOP_NAMES.length];
    if (tpl.cat === 'house' && !tpl.unique) return 'Жилой дом';
    if (id === 'uchiha_house' || id === 'uchiha_small') return 'Дом клана Учиха';
    return tpl.name;
  }

  // Клетки дороги-ломаной (сглаженная кривая, ширина w); те же формулы использует tools/plan_konoha.py
  function polyTiles(pts, w) {
    const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    const out = [], seen = new Set();
    const add = (sx, sy) => {
      const x0 = Math.floor(sx - w / 2 + 0.5), y0 = Math.floor(sy - w / 2 + 0.5);
      for (let y = y0; y < y0 + w; y++) for (let x = x0; x < x0 + w; x++) { const k = y * 4096 + x; if (!seen.has(k)) { seen.add(k); out.push([x, y]); } }
    };
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], d = pts[Math.min(pts.length - 1, i + 2)];
      for (let t = 0; t < 1 - 1e-9; t += 0.04) add(cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t));
    }
    add(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    return out;
  }
  function roadRect(r) {
    if (r.tiles || r.pts) {
      const t = r.tiles || (r._t = r._t || polyTiles(r.pts, G.ROADS[r.type].w));
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (const [x, y] of t) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
      return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }
    const w = G.ROADS[r.type].w;
    const x = Math.min(r.x1, r.x2), y = Math.min(r.y1, r.y2);
    if (r.y1 === r.y2) return { x, y: r.y1, w: Math.abs(r.x2 - r.x1) + 1, h: w };
    return { x: r.x1, y, w, h: Math.abs(r.y2 - r.y1) + 1 };
  }

  // Какой интерьер у здания
  function interiorKind(id, tpl) {
    if (tpl.interior) return tpl.interior;
    if (id === 'uchiha_house' || id === 'uchiha_small') return 'abandoned';
    if (id === 'shop_generic') return 'shop';
    if (id === 'dojo') return 'dojo';
    if (id === 'guard_post') return null;
    if (tpl.cat === 'house') return 'house';
    return null;
  }

  function konoha(layout, seed = 7) {
    const ID = G.tiles.ID;
    const W = layout.size.w, HH = layout.size.h;
    const EXPL = !!layout.explicit;   // здания заданы списком (tools/plan_konoha.py): автозастройка и переулки не нужны
    const m = new G.WorldMap('konoha', W, HH, { outdoor: true, name: 'Коноха', bg: '#2e5a2e' });
    const rnd = G.util.rng(seed);
    // занятость клеток: 0 свободно, 1 дорога, 2 здание, 3 непроходимая местность, 4 резерв (двор/крыльцо), 5 декор
    const occ = new Uint8Array(W * HH);
    const O = (x, y) => (x >= 0 && y >= 0 && x < W && y < HH ? occ[y * W + x] : 3);
    const setO = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < HH) occ[y * W + x] = v; };
    const grassy = (x, y) => G.tiles.GRASSY.has(m.get(x, y));
    // 6 — мягкое кольцо у автодомов (можно пристроить вплотную); keep — дорожки и крыльца (не застраивать, без декора)
    const keep = new Uint8Array(W * HH);
    const KP = (x, y) => (x >= 0 && y >= 0 && x < W && y < HH ? keep[y * W + x] : 0);
    const setK = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < HH) keep[y * W + x] = 1; };
    const bAt = new Int16Array(W * HH);   // индекс здания + 1 по клеткам пятна

    // ---------- 1. Земля ----------
    for (let y = 0; y < HH; y++) for (let x = 0; x < W; x++) m.set(x, y, H(x, y, seed) < 0.14 ? ID.GRASS2 : ID.GRASS);
    m.districts = layout.districts.map((d) => Object.assign({}, d));

    const each = (d, fn) => { for (let y = d.y; y < d.y + d.h; y++) for (let x = d.x; x < d.x + d.w; x++) if (m.inside(x, y)) fn(x, y); };
    for (const d of layout.districts) {
      switch (d.type) {
        case 'water': each(d, (x, y) => { m.set(x, y, ID.WATER); setO(x, y, 3); }); break;
        case 'cliff': each(d, (x, y) => { m.set(x, y, y >= d.y + d.h - 5 ? ID.CLIFF : ID.CLIFFTOP); setO(x, y, 3); }); break;
        case 'wall': each(d, (x, y) => { m.set(x, y, ID.VWALL); setO(x, y, 3); }); break;
        case 'forest': each(d, (x, y) => m.set(x, y, noise(x, y, 11, 5) > 0.35 ? ID.DARKGRASS : ID.GRASS2)); break;
        case 'park': each(d, (x, y) => { const n = noise(x, y, 12, 3); if (n > 0.72) m.set(x, y, ID.FLOWERS); else if (n < 0.25) m.set(x, y, ID.CLOVER); }); break;
        case 'training': each(d, (x, y) => { const n = noise(x, y, 13, 4); if (n > 0.62) m.set(x, y, ID.DIRT); else if (n < 0.22) m.set(x, y, ID.GRAVEL); }); break;
        case 'official': each(d, (x, y) => m.set(x, y, noise(x, y, 17, 6) > 0.7 ? ID.BRICK : ID.STONE)); break;
        case 'market': each(d, (x, y) => m.set(x, y, ID.STONE)); break;
        case 'uchiha': each(d, (x, y) => m.set(x, y, noise(x, y, 18, 4) > 0.66 ? ID.MOSS : ID.DARKGRASS)); break;
        case 'residential': case 'clan': each(d, (x, y) => { const n = noise(x, y, 19, 5); if (n > 0.74) m.set(x, y, ID.CLOVER); else if (n < 0.12) m.set(x, y, ID.FLOWERS); }); break;
        default: break;
      }
    }


    // ---------- 1б. Форма деревни по карте из аниме: круглая стена, горы и лес вокруг, круговые комплексы, озёра ----------
    const SH = layout.shape;
    const inRect = (x, y) => x >= 0 && y >= 0 && x < W && y < HH;
    const fillO = (x, y, v) => { if (inRect(x, y)) occ[y * W + x] = v; };
    if (SH) {
      const sup = (x, y, a, b) => Math.pow(Math.abs(x + 0.5 - SH.cx) / a, SH.p) + Math.pow(Math.abs(y + 0.5 - SH.cy) / b, SH.p);
      const wallT = SH.wall || 2.4, mount = new Uint8Array(W * HH);
      const outside = (x, y) => y >= 14 && sup(x, y, SH.a, SH.b) > 1;
      for (let y = 14; y < HH; y++) for (let x = 0; x < W; x++) if (outside(x, y) && y < SH.cy - 8 && noise(x, y, 41, 6) > 0.4) mount[y * W + x] = 1;
      for (let y = 14; y < HH; y++) for (let x = 0; x < W; x++) {
        if (y >= 14 && sup(x, y, SH.a, SH.b) <= 1) {
          if (sup(x, y, SH.a - wallT, SH.b - wallT) > 1) { m.set(x, y, ID.VWALL); setO(x, y, 3); }
        } else if (mount[y * W + x]) { m.set(x, y, mount[(y + 1) * W + x] ? ID.CLIFFTOP : ID.CLIFF); setO(x, y, 3); }
        else if (outside(x, y)) {
          m.set(x, y, noise(x, y, 42, 4) > 0.5 ? ID.GRASS2 : ID.DARKGRASS); setO(x, y, 3);
          if (x % 2 === 0 && y % 2 === 0 && H(x, y, 43) > 0.38 && x > 0 && x < W - 1) m.addObject(H(x, y, 44) > 0.4 ? 'pine' : 'tree', x * T + 8, y * T + 15);
        }
      }
      // круглые комплексы (резиденция Хокаге, арена): стена-кольцо, внутри площадь, проёмы заданы прямоугольниками
      for (const rg of SH.rings || []) {
        const floor = ID[rg.floor || 'PLAZA'];
        for (let y = Math.floor(rg.cy - rg.r) - 1; y <= rg.cy + rg.r + 1; y++) for (let x = Math.floor(rg.cx - rg.r) - 1; x <= rg.cx + rg.r + 1; x++) {
          const d = Math.hypot(x + 0.5 - rg.cx, y + 0.5 - rg.cy);
          if (d > rg.r || !m.inside(x, y) || O(x, y) === 3) continue;
          const gap = (rg.gaps || []).some((g) => x >= g[0] && x <= g[2] && y >= g[1] && y <= g[3]);
          if (d > rg.r - 1.7 && !gap) { m.set(x, y, ID.VWALL); setO(x, y, 3); }
          else { m.set(x, y, floor); setO(x, y, 4); }
        }
      }
      // озёра (с островком)
      for (const lk of SH.lakes || []) {
        for (let y = Math.floor(lk.cy - lk.ry) - 1; y <= lk.cy + lk.ry + 1; y++) for (let x = Math.floor(lk.cx - lk.rx) - 1; x <= lk.cx + lk.rx + 1; x++) {
          if (!m.inside(x, y) || O(x, y) === 3) continue;
          const e = Math.pow((x + 0.5 - lk.cx) / lk.rx, 2) + Math.pow((y + 0.5 - lk.cy) / lk.ry, 2);
          if (e <= 1) { m.set(x, y, ID.WATER); setO(x, y, 3); }
          else if (e <= 1.35 && grassy(x, y)) m.set(x, y, ID.SAND);
        }
        if (lk.isle) {
          const il = lk.isle;
          for (let y = Math.floor(il.cy - il.ry) - 1; y <= il.cy + il.ry + 1; y++) for (let x = Math.floor(il.cx - il.rx) - 1; x <= il.cx + il.rx + 1; x++) {
            if (Math.pow((x + 0.5 - il.cx) / il.rx, 2) + Math.pow((y + 0.5 - il.cy) / il.ry, 2) <= 1) { m.set(x, y, ID.GRASS); setO(x, y, 3); }
          }
          m.addObject('sakura', Math.floor(il.cx) * T + 8, Math.floor(il.cy) * T + 15);
        }
      }
    }

    // ---------- 2. Дороги ----------
    const roadTile = { main: ID.MAINROAD, street: ID.PATH, path: ID.DIRT };
    for (const r of layout.roads) {
      if (r.tiles || r.pts) {
        for (const [x, y] of r.tiles || (r._t = r._t || polyTiles(r.pts, G.ROADS[r.type].w))) {
          if (!m.inside(x, y) || O(x, y) === 3) continue;
          m.set(x, y, roadTile[r.type]); setO(x, y, 1);
        }
        continue;
      }
      const rr = roadRect(r);
      for (let y = rr.y; y < rr.y + rr.h; y++) for (let x = rr.x; x < rr.x + rr.w; x++) {
        if (!m.inside(x, y) || O(x, y) === 3) continue;
        m.set(x, y, roadTile[r.type]); setO(x, y, 1);
      }
    }


    // ---------- 2б. Реки: плавные кривые; где дорога пересекает реку — мост ----------
    for (const rv of layout.rivers || []) {
      const P = rv.pts, cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
      const line = [];
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], d = P[Math.min(P.length - 1, i + 2)];
        for (let t = 0; t < 1; t += 0.04) line.push([cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t)]);
      }
      line.push(P[P.length - 1]);
      const wet = new Set();
      for (const [sx, sy] of line) {
        const r = rv.w / 2;
        for (let y = Math.floor(sy - r) - 1; y <= sy + r + 1; y++) for (let x = Math.floor(sx - r) - 1; x <= sx + r + 1; x++) if (Math.hypot(x + 0.5 - sx, y + 0.5 - sy) <= r) wet.add(y * W + x);
      }
      for (const i of wet) {
        const x = i % W, y = (i / W) | 0; if (!m.inside(x, y) || O(x, y) === 3) continue;
        if (O(x, y) === 1) { m.set(x, y, ID.PLANKS); continue; }
        m.set(x, y, ID.WATER); setO(x, y, 3);
      }
      // набережная: булыжник вдоль воды
      for (const i of wet) {
        const x = i % W, y = (i / W) | 0;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ax, ny = y + ay; if (m.inside(nx, ny) && !wet.has(ny * W + nx) && O(nx, ny) !== 3 && O(nx, ny) !== 1 && grassy(nx, ny)) m.set(nx, ny, ID.COBBLE); }
      }
    }

    // ---------- 3. Здания ----------
    let bseed = 0;
    const isRoad = (x, y) => O(x, y) === 1 || G.tiles.ROADY.has(m.get(x, y));

    function addBuildingTiles(id, tpl, tx, ty, opts = {}) {
      const spr = G.buildgfx.make(id, tpl, opts.seed != null ? opts.seed : ++bseed, opts.art);
      const b = m.addBuilding({ tplId: id, tplDef: tpl, tx, ty, tw: tpl.w, th: tpl.h, spr, name: opts.name || nameOf(id, tpl, tx * 7 + ty * 13) });
      // клетки, где на картинке пусто (картинка сдвинута от пятна), не блокируем — иначе там невидимая стена
      const an = opts.art || (tpl.unique && G.houseArt.has(id) ? id : null);
      const hole = new Set(an ? G.houseArt.free(an).map(([cx, cy]) => cy * tpl.w + cx) : []);
      for (let y = ty; y < ty + tpl.h; y++) for (let x = tx; x < tx + tpl.w; x++) {
        if (!hole.has((y - ty) * tpl.w + (x - tx))) m.setBlock(x, y, 1);
        setO(x, y, 2); if (m.inside(x, y)) bAt[y * W + x] = m.buildings.length;
      }
      // кольцо вокруг: у ключевых зданий — резерв (4), у автодомов — мягкое (6), к ним можно пристроиться вплотную
      const ring = opts.soft ? 6 : 4;
      for (let y = ty - 1; y <= ty + tpl.h; y++) for (let x = tx - 1; x <= tx + tpl.w; x++) if (O(x, y) === 0 || (ring === 4 && O(x, y) === 6)) setO(x, y, ring);
      if (tpl.door) {
        const dx = tx + tpl.door[0], dy = ty + tpl.door[1];
        b.door = { tx: dx, ty: dy };
        const kind = interiorKind(id, tpl);
        if (kind) {
          b.interior = { id: 'in:' + (m.buildings.length - 1), kind, name: b.name, seed: (dx * 131 + dy * 17) | 0, tplId: id };
          m.warps.push({
            rect: { x: dx * T + 1, y: (dy + 1) * T - 2, w: T - 2, h: 4 }, dir: 'up', building: b,
            to: { map: b.interior.id, entry: true },
          });
        } else b.locked = true;
        // крыльцо
        if (m.inside(dx, dy + 1) && O(dx, dy + 1) !== 1) { if (grassy(dx, dy + 1)) m.set(dx, dy + 1, ID.PATH); setO(dx, dy + 1, 4); setK(dx, dy + 1); }
      }
      return b;
    }

    // Дорожка от крыльца вниз до дороги (для ключевых зданий)
    function walkwayDown(x, y, maxLen = 12) {
      const path = [];
      for (let i = 0; i < maxLen; i++) {
        const yy = y + i;
        if (!m.inside(x, yy)) return;
        if (isRoad(x, yy) && i > 0) break;
        if (O(x, yy) === 2 || O(x, yy) === 3) return;
        path.push(yy);
        if (i === maxLen - 1) return;
      }
      for (const yy of path) { if (grassy(x, yy)) m.set(x, yy, ID.PATH); if (O(x, yy) !== 1) setO(x, yy, 4); }
    }

    function place(id, tx, ty, ent = {}) {
      let tpl = G.BUILDINGS[id];
      if (!tpl) return;
      // у здания с нарисованной картинкой свои размеры пятна и дверь (gfx/house_art.js)
      const sp = ent.art && G.houseArt.spec(ent.art);
      if (sp) tpl = Object.assign({}, tpl, { w: sp.w, h: sp.h, door: tpl.door ? [sp.dx, sp.h - 1] : tpl.door });
      const bo = { art: ent.art, name: ent.name, soft: !!ent.art && !tpl.unique };
      const cx = tx * T, cy = ty * T;
      // ориентиры без зданий (водопад, пристань, колодец…) — для карты и заданий
      if (tpl.cat === 'landmark' || tpl.cat === 'training') (m.spots || (m.spots = {}))[id] = { tplId: id, tplDef: tpl, tx, ty, tw: tpl.w, th: tpl.h, name: tpl.name, spot: true };
      switch (id) {
        case 'hokage_rock': {
          const cl = layout.districts.find((d) => d.type === 'cliff' && tx >= d.x && tx < d.x + d.w);
          const bottom = cl ? cl.y + cl.h : ty + tpl.h;
          const spr = G.buildgfx.make(id, tpl, 0);
          m.addBuilding({ tplId: id, tplDef: tpl, tx, ty: bottom - tpl.h, tw: tpl.w, th: tpl.h, spr, sortY: -1, name: nameOf(id, tpl, tx * 7 + bottom) });
          return;
        }
        case 'training_3': case 'training_ground': {
          for (let y = ty; y < ty + tpl.h; y++) for (let x = tx; x < tx + tpl.w; x++) {
            const corner = (x === tx || x === tx + tpl.w - 1) && (y === ty || y === ty + tpl.h - 1);
            if (!corner && O(x, y) !== 1) { m.set(x, y, ID.DIRT); setO(x, y, 4); }
          }
          if (id === 'training_3') {
            [[3, 3], [5, 2], [7, 3]].forEach(([dx, dy]) => m.addObject('post', cx + dx * T + 8, cy + dy * T + 15, { talk: ['Деревянный столб, исцарапанный кунаями. Сюда привязывают провинившихся учеников.'] }));
            m.addObject('stump', cx + 2 * T + 8, cy + 6 * T + 15); m.addObject('log', cx + 7 * T, cy + 6 * T + 12);
          } else {
            for (let i = 0; i < 3; i++) m.addObject('target', cx + (1 + i * 2) * T + 8, cy + 1 * T + 15, { talk: ['Мишень для метания. Сюрикенов пока нет — их можно будет купить в оружейной.'] });
            m.addObject('dummy', cx + 2 * T + 8, cy + 4 * T + 15); m.addObject('dummy', cx + 5 * T + 8, cy + 4 * T + 15);
            m.addObject('log', cx + 4 * T, cy + 6 * T + 10);
          }
          return;
        }
        case 'memorial':
          m.addObject('memorial', cx + 16, cy + 31, { talk: ['Мемориальный камень. На нём высечены имена шиноби, погибших за деревню.', 'Где-то здесь есть и имена твоих родителей...'] });
          for (let y = ty - 1; y <= ty + 2; y++) for (let x = tx - 1; x <= tx + 2; x++) if (O(x, y) === 0) setO(x, y, 4);
          return;
        case 'swing_tree':
          m.addObject('tree', cx + 8, cy + T + 15);
          m.addObject('swing', cx + 2 * T + 16, cy + T + 15, { talk: ['Старые качели у Академии. Наруто часто сидит здесь один.'] });
          for (let y = ty - 1; y <= ty + 2; y++) for (let x = tx - 1; x <= tx + 4; x++) if (O(x, y) !== 1 && O(x, y) !== 2) setO(x, y, 4);
          return;
        case 'pier':
          for (let y = ty; y < ty + tpl.h; y++) for (let x = tx; x < tx + tpl.w; x++) { m.set(x, y, ID.PLANKS); setO(x, y, 4); }
          return;
        case 'waterfall': {
          for (let y = ty; y < ty + tpl.h; y++) for (let x = tx; x < tx + tpl.w; x++) { m.set(x, y, ID.CLIFF); setO(x, y, 3); }
          const o = m.addObject('rock', cx, cy, { box: null, anim: 'waterfall', fw: tpl.w * T, fh: tpl.h * T });
          o.ox = 0; o.oy = 0; o.w = tpl.w * T; o.h = tpl.h * T; o.sortY = cy; o.img = null;
          return;
        }
        case 'well': m.addObject('well', cx + 8, cy + 15, { talk: ['Старый колодец. Вода холодная и чистая.'] }); setO(tx, ty, 5); return;
        case 'stall': m.addObject('stall', cx + 16, cy + 15); setO(tx, ty, 5); setO(tx + 1, ty, 5); return;
        case 'night_alley':
          for (let y = ty; y < ty + tpl.h; y++) for (let x = tx; x < tx + tpl.w; x++) { m.set(x, y, ID.DARKSTONE); setO(x, y, 4); }
          m.addObject('crate', cx + 6, cy + T + 14); m.addObject('barrel', cx + T + 10, cy + 3 * T + 14);
          m.addObject('lamp', cx + T + 8, cy + 15, { talk: ['Тёмный переулок. Говорят, по ночам здесь торгует странный человек в капюшоне.'] });
          return;
        case 'gate': {
          const b = addBuildingTiles(id, tpl, tx, ty, { seed: 0 });
          // проход между столбами открыт, створки внизу закрыты
          for (let y = ty; y < ty + tpl.h - 1; y++) for (let x = tx + 1; x < tx + tpl.w - 1; x++) { m.setBlock(x, y, 0); setO(x, y, 1); }
          b.talk = ['Главные ворота «А» и «УН» закрыты.', 'Ученикам Академии выходить из деревни нельзя.'];
          return;
        }
        default: addBuildingTiles(id, tpl, tx, ty, bo);
      }
    }
    for (const b of layout.buildings) place(b.tpl, b.x, b.y, b);

    // ---------- 4. Плотная застройка (как в аниме: дома почти вплотную, узкие переулки) ----------
    // Дорожка от клетки (sx, sy) до ближайшей дороги поиском в ширину. foot — будущее пятно здания.
    // Нельзя идти по клеткам, спрятанным за крышей здания ниже (или будущего здания), и через декор.
    function findPath(sx, sy, maxLen, foot) {
      const inFoot = (x, y) => foot && x >= foot.x && x < foot.x + foot.w && y >= foot.y && y < foot.y + foot.h;
      const ok = (x, y) => {
        if (!m.inside(x, y) || inFoot(x, y)) return false;
        const o = O(x, y);
        if (o === 1) return true;
        if (o !== 0 && o !== 4 && o !== 6) return false;
        if (o === 4 && !KP(x, y) && m.get(x, y) === ID.DIRT) return false;      // площадки полигонов с мишенями
        if (O(x, y + 1) === 2 || inFoot(x, y + 1)) return false;                // за крышей не видно
        return true;
      };
      if (!ok(sx, sy)) return null;
      if (O(sx, sy) === 1) return [];
      const prev = new Map(), start = sy * W + sx;
      prev.set(start, -1);
      let front = [start];
      for (let dd = 0; dd < maxLen && front.length; dd++) {
        const next = [];
        for (const i of front) {
          const x = i % W, y = (i / W) | 0;
          for (const [ax, ay] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) {
            const nx = x + ax, ny = y + ay, j = ny * W + nx;
            if (prev.has(j) || !ok(nx, ny)) continue;
            prev.set(j, i);
            if (O(nx, ny) === 1) { const path = []; let k = i; while (k !== -1) { path.push(k); k = prev.get(k); } return path; }
            next.push(j);
          }
        }
        front = next;
      }
      return null;
    }
    function markPath(path, dtype) {
      for (const i of path) {
        const x = i % W, y = (i / W) | 0;
        if (grassy(x, y)) m.set(x, y, dtype === 'residential' && path.length > 2 ? ID.STEPS : dtype === 'uchiha' ? ID.DARKSTONE : ID.PATH);
        else if (m.get(x, y) === ID.STONE && dtype === 'official') m.set(x, y, ID.PLAZA);
        setO(x, y, 4); setK(x, y);
      }
    }

    // 4a. Площадки перед ключевыми зданиями и дорожки от их дверей
    const keyB = m.buildings.filter((b) => b.door && b.tplDef.unique && b.tplId !== 'gate');
    for (const b of keyB) {
      const rows = b.tplDef.cat === 'official' ? 3 : 2;
      for (let y = b.ty + b.th; y < b.ty + b.th + rows; y++) for (let x = b.tx - 1; x <= b.tx + b.tw; x++) {
        const o = O(x, y);
        if (o !== 0 && o !== 4 && o !== 6) continue;
        if (m.get(x, y) === ID.STONE && b.tplDef.cat === 'official') m.set(x, y, ID.PLAZA);
        setO(x, y, 4); setK(x, y);
      }
    }
    for (const b of keyB) { const p = findPath(b.door.tx, b.door.ty + 1, 40, null); if (p) markPath(p, 'key'); }
    // явная раскладка: проход от двери каждого дома до дороги (tools/plan_konoha.py проверял его теми же правилами)
    if (EXPL) {
      for (const b of m.buildings) {
        if (!b.door || b.tplDef.unique || b.tplId === 'gate') continue;
        const d = m.districtAt(b.door.tx, b.door.ty), p = findPath(b.door.tx, b.door.ty + 1, 34, null);
        if (p) { markPath(p, d && d.type === 'uchiha' ? 'uchiha' : 'residential'); } else b.noPath = true;
      }
    }

    // 4b. Переулки: горизонтальные ряды через каждые STEP клеток от дороги сверху + поперечные проходы
    const lane = new Uint8Array(W * HH);
    const laneOk = (x, y) => { const o = O(x, y); return (o === 0 || o === 4 || o === 6) && m.get(x, y) !== ID.WATER; };
    const LANES = { residential: [7, 13], uchiha: [9, 0], clan: [0, 0] };
    for (const d of EXPL ? [] : layout.districts) {
      const L = LANES[d.type]; if (!L || !L[0]) continue;
      for (let x = d.x; x < d.x + d.w; x++) {
        let last = null;
        for (let y = d.y - 4; y < d.y + d.h; y++) {
          if (O(x, y) === 1) { last = y; continue; }
          if (last == null || y < d.y) continue;
          const k = y - last;
          if (k < L[0] || k % L[0]) continue;
          let nb = 0; while (nb < 6 && y + nb + 1 < d.y + d.h && O(x, y + nb + 1) !== 1) nb++;
          if (nb >= 4 && laneOk(x, y)) lane[y * W + x] = 1;
        }
      }
      if (L[1]) for (let y = d.y; y < d.y + d.h; y++) {
        let last = null;
        for (let x = d.x - 4; x < d.x + d.w; x++) {
          if (O(x, y) === 1) { last = x; continue; }
          if (last == null || x < d.x) continue;
          const k = x - last;
          if (k < L[1] || k % L[1]) continue;
          let nr = 0; while (nr < 6 && x + nr + 1 < d.x + d.w && O(x + nr + 1, y) !== 1) nr++;
          if (nr >= 5 && laneOk(x, y)) lane[y * W + x] = 2;
        }
      }
    }
    // связные куски переулков, касающиеся дороги, становятся булыжной мостовой
    {
      const seen = new Uint8Array(W * HH);
      for (let i = 0; i < W * HH; i++) {
        if (!lane[i] || seen[i]) continue;
        const comp = [i], touch = { v: false }; seen[i] = 1;
        for (let qi = 0; qi < comp.length; qi++) {
          const x = comp[qi] % W, y = (comp[qi] / W) | 0;
          for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + ax, ny = y + ay; if (!m.inside(nx, ny)) continue;
            const j = ny * W + nx;
            if (O(nx, ny) === 1) touch.v = true;
            // горизонтальные клетки соединяются по горизонтали, поперечные — по вертикали, на пересечениях — все
            if (lane[j] && !seen[j] && (lane[j] === lane[comp[qi]] ? (lane[j] === 1 ? ay === 0 : ax === 0) : true)) { seen[j] = 1; comp.push(j); }
          }
        }
        if (!touch.v || comp.length < 4) continue;
        for (const k of comp) { const x = k % W, y = (k / W) | 0; m.set(x, y, ID.COBBLE); setO(x, y, 1); keep[k] = 0; }
      }
    }

    // садики с деревьями между домами (резерв до застройки)
    for (const d of EXPL ? [] : layout.districts) {
      if (d.type !== 'residential' && d.type !== 'market') continue;
      const n = Math.floor(d.w * d.h * (d.type === 'market' ? 0.002 : 0.005));
      for (let k = 0, got = 0; k < n * 6 && got < n; k++) {
        const x = d.x + 1 + Math.floor(rnd() * (d.w - 2)), y = d.y + 1 + Math.floor(rnd() * (d.h - 2));
        let ok = true;
        for (let yy = y - 1; yy <= y; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (O(xx, yy) !== 0 || KP(xx, yy)) ok = false;
        if (!ok || O(x, y + 1) === 1) continue;
        const h = H(x, y, 66);
        m.addObject(d.type === 'market' ? 'planter' : h > 0.7 ? 'sakura' : h > 0.5 ? 'maple' : h > 0.4 ? 'ginkgo' : 'tree', x * T + 8, y * T + 15);
        for (let yy = y - 1; yy <= y; yy++) for (let xx = x - 1; xx <= x + 1; xx++) setO(xx, yy, 5);
        got++;
      }
    }

    // 4c. Застройка: перебор клеток по рядам, шаблон — по весам района, проверка дорожки до дороги
    function fitsDense(tpl, tx, ty, d, maxPath) {
      if (tx < d.x || ty < d.y || tx + tpl.w > d.x + d.w || ty + tpl.h > d.y + d.h) return null;
      for (let y = ty; y < ty + tpl.h; y++) for (let x = tx; x < tx + tpl.w; x++) {
        const o = O(x, y);
        if ((o !== 0 && o !== 6) || KP(x, y)) return null;
      }
      for (let x = tx; x < tx + tpl.w; x++) {
        const a = O(x, ty - 1);                                   // ряд над домом скроется под его крышей
        if (a === 1 || a === 2 || KP(x, ty - 1)) return null;
        if ((tpl.ov || 16) > 16 && KP(x, ty - 2)) return null;
        if (O(x, ty + tpl.h) === 2) return null;                   // крыша дома ниже закрыла бы фасад
      }
      for (let y = ty; y < ty + tpl.h; y++) for (const x of [tx - 1, tx + tpl.w]) {
        if (O(x, y) === 2) { const nb = m.buildings[bAt[y * W + x] - 1]; if (!nb || !nb.auto) return null; }
      }
      const fx = tx + tpl.door[0], fy = ty + tpl.h;
      if (O(fx, fy + 1) === 2 && O(fx, fy) !== 1) return null;
      return findPath(fx, fy, maxPath, { x: tx, y: ty, w: tpl.w, h: tpl.h });
    }
    const FILL = {
      residential: { t: { house_s: 3, house_m: 2, house_xs: 2, house_n: 2, house_w: 2, house_t: 3, apartment_s: 1, tower_r: 1.2, apartment: 0.6, shop_s: 0.3 }, skip: 0.05, max: 400 },
      uchiha: { t: { uchiha_house: 2, uchiha_small: 2 }, skip: 0.25, max: 60 },
      clan: { t: { house_s: 2, house_xs: 2, house_m: 1 }, skip: 0.55, max: 6 },
      market: { t: { shop_s: 3, shop_generic: 2, house_n: 2, house_t: 2, house_xs: 1, tower_r: 0.6 }, skip: 0.08, max: 60 },
      official: { t: { office: 3, tower_r: 2, apartment_s: 1.5, house_w: 1, house_t: 1 }, skip: 0.3, max: 30 },
    };
    const pickW = (t) => { // перемешанный по весам список шаблонов
      const arr = Object.entries(t).map(([id, w]) => [id, -Math.log(rnd() + 1e-9) / w]);
      return arr.sort((a, b) => a[1] - b[1]).map((a) => a[0]);
    };
    for (const pass of [1, 9]) {
      for (const d of EXPL ? [] : layout.districts) {
        const rule = FILL[d.type]; if (!rule) continue;
        let placed = m.buildings.filter((b) => b.auto && b.district === d).length;
        for (let ty = d.y; ty < d.y + d.h; ty++) for (let tx = d.x; tx < d.x + d.w; tx++) {
          if (placed >= rule.max) break;
          if (O(tx, ty) !== 0 && O(tx, ty) !== 6) continue;
          if (rnd() < rule.skip) continue;
          for (const id of pickW(rule.t)) {
            const tpl = G.BUILDINGS[id];
            const path = fitsDense(tpl, tx, ty, d, pass);
            if (!path) continue;
            const b = addBuildingTiles(id, tpl, tx, ty, { soft: true });
            b.auto = true; b.district = d;
            markPath(path, d.type);
            placed++;
            break;
          }
        }
      }
    }

    // ---------- 5. Декор ----------
    const tryTree = (x, y, kind) => {
      for (let yy = y - 1; yy <= y; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (O(xx, yy) !== 0) return false;
      if (!grassy(x, y)) return false;
      m.addObject(kind, x * T + 8, y * T + 15);
      for (let yy = y - 1; yy <= y; yy++) for (let xx = x - 1; xx <= x + 1; xx++) setO(xx, yy, 5);
      return true;
    };
    const tryObj = (x, y, kind, extra, ok = (o) => o === 0) => {
      if (!ok(O(x, y)) || KP(x, y)) return false;
      m.addObject(kind, x * T + 8, y * T + 15, extra);
      setO(x, y, 5);
      return true;
    };

    // деревья вдоль стены деревни
    for (let y = 14; y < HH; y++) for (let x = 0; x < W; x++) {
      if (O(x, y) !== 0) continue;
      const nearWall = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => m.get(x + dx, y + dy) === ID.VWALL);
      if (nearWall && H(x, y, 21) > 0.35) tryTree(x, y, 'tree');
    }

    // мелочи у стен автодомов: бельё, дрова, бочки для воды, горшки, велосипеды
    const nearWallOk = (x, y) => {
      if (O(x, y) !== 6 || KP(x, y) || O(x, y + 1) === 2) return false;
      // не перекрываем проходы: по обе стороны (гориз. или верт.) не должно быть стены/дороги одновременно
      const solid = (xx, yy) => { const o = O(xx, yy); return o === 2 || o === 3 || o === 5; };
      if ((solid(x - 1, y) && solid(x + 1, y)) || (solid(x, y - 1) && solid(x, y + 1))) return false;
      let free = 0; for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const o = O(x + ax, y + ay); if (o === 0 || o === 6 || o === 1 || o === 4) free++; }
      return free >= 3;
    };
    const SMALL = { residential: ['pots', 'woodpile', 'raintank', 'laundry', 'bicycle', 'pots', 'mailbox', 'flowerbed', 'barrel'], market: ['crate', 'sacks', 'barrel', 'redlantern', 'banner', 'crate'],
      uchiha: ['stonelamp', 'woodpile', 'tallgrass', 'tallgrass'], official: ['pots', 'banner', 'raintank', 'bicycle'], clan: ['pots', 'woodpile', 'stonelamp'] };
    for (const d of layout.districts) {
      const list = SMALL[d.type]; if (!list) continue;
      for (let y = d.y; y < d.y + d.h; y++) for (let x = d.x; x < d.x + d.w; x++) {
        if (H(x, y, 61) > (d.type === 'residential' ? 0.14 : 0.1) || !nearWallOk(x, y)) continue;
        const kind = list[Math.floor(H(x, y, 62) * list.length)];
        if (kind === 'laundry' && !(O(x + 1, y) === 6 && nearWallOk(x + 1, y))) continue;
        tryObj(x, y, kind, null, (o) => o === 6);
        if (kind === 'laundry') setO(x + 1, y, 5);
      }
    }

    for (const d of layout.districts) {
      const sample = (density, fn) => {
        const n = Math.floor(d.w * d.h * density);
        for (let i = 0; i < n * 3 && n > 0; i++) {
          const x = d.x + Math.floor(rnd() * d.w), y = d.y + Math.floor(rnd() * d.h);
          fn(x, y);
        }
      };
      switch (d.type) {
        case 'forest':
          for (let y = d.y; y < d.y + d.h; y++) for (let x = d.x; x < d.x + d.w; x++) {
            if (noise(x, y, 31, 6) > 0.32 && H(x, y, 32) > 0.25) tryTree(x, y, H(x, y, 33) > 0.35 ? 'pine' : 'tree');
          }
          for (let i = 0; i < 5; i++) sample(0.002, (x, y) => tryObj(x, y, 'deer', { talk: ['Олень клана Нара. Смотрит на тебя спокойно и без страха.'] }));
          sample(0.004, (x, y) => tryObj(x, y, 'rock'));
          break;
        case 'park':
          sample(0.05, (x, y) => tryTree(x, y, H(x, y, 5) > 0.55 ? 'sakura' : 'tree'));
          sample(0.004, (x, y) => tryObj(x, y, 'tallgrass'));
          sample(0.002, (x, y) => tryTree(x, y, 'bamboo'));
          sample(0.006, (x, y) => tryObj(x, y, 'bench'));
          sample(0.01, (x, y) => tryObj(x, y, 'bush'));
          break;
        case 'residential':
          sample(0.03, (x, y) => { const h = H(x, y, 6); tryTree(x, y, h > 0.8 ? 'sakura' : h > 0.65 ? 'maple' : h > 0.58 ? 'ginkgo' : h > 0.52 ? 'watertower' : 'tree'); });
          sample(0.02, (x, y) => tryObj(x, y, H(x, y, 7) > 0.6 ? 'hedge' : 'bush'));
          sample(0.004, (x, y) => tryObj(x, y, 'shrine', { talk: ['Маленькое святилище. Кто-то оставил рисовый колобок и свежие цветы.'] }));
          sample(0.006, (x, y) => tryObj(x, y, 'tallgrass'));
          sample(0.006, (x, y) => tryObj(x, y, H(x, y, 3) > 0.5 ? 'flowerbox' : 'barrel'));
          sample(0.002, (x, y) => tryObj(x, y, 'well', { talk: ['Колодец во дворе. Рядом сушится бельё.'] }));
          break;
        case 'training':
          sample(0.03, (x, y) => tryTree(x, y, H(x, y, 8) > 0.75 ? 'maple' : 'tree'));
          sample(0.01, (x, y) => tryObj(x, y, 'tallgrass'));
          sample(0.006, (x, y) => tryObj(x, y, 'rock'));
          sample(0.004, (x, y) => tryObj(x, y, 'stump'));
          break;
        case 'uchiha':
          sample(0.012, (x, y) => tryTree(x, y, H(x, y, 9) > 0.6 ? 'bamboo' : 'tree'));
          sample(0.01, (x, y) => tryObj(x, y, 'tallgrass'));
          sample(0.004, (x, y) => tryObj(x, y, 'stonelamp'));
          break;
        case 'official':
          for (let y = d.y + 1; y < d.y + d.h - 1; y += 5) for (let x = d.x + 2; x < d.x + d.w - 1; x += 6) {
            if (H(x, y, 41) > 0.45) tryObj(x, y, H(x, y, 43) > 0.6 ? 'sakura' : 'planter');
            else if (H(x, y, 42) > 0.6) tryObj(x, y, 'stonelamp');
          }
          sample(0.004, (x, y) => tryObj(x, y, 'bench'));
          break;
        case 'market':
          sample(0.02, (x, y) => {
            if (O(x, y) !== 0 || O(x + 1, y) !== 0 || O(x, y - 1) === 2) return;
            m.addObject('stall', x * T + 16, y * T + 15); setO(x, y, 5); setO(x + 1, y, 5);
          });
          sample(0.01, (x, y) => tryObj(x, y, H(x, y, 4) > 0.5 ? 'barrel' : 'crate'));
          sample(0.005, (x, y) => tryObj(x, y, H(x, y, 5) > 0.5 ? 'redlantern' : 'banner'));
          break;
        case 'clan':
          // забор по верхнему краю квартала
          if (d.fence !== false) for (let x = d.x; x < d.x + d.w; x++) if (O(x, d.y) === 0) { m.addObject('clanwall', x * T + 8, d.y * T + 15); setO(x, d.y, 5); }
          sample(0.02, (x, y) => tryTree(x, y, H(x, y, 10) > 0.7 ? 'maple' : 'tree'));
          sample(0.008, (x, y) => tryObj(x, y, 'stonelamp'));
          sample(0.004, (x, y) => tryObj(x, y, 'pond', null, (o) => o === 0 && O(x - 1, y) === 0 && O(x + 1, y) === 0 && O(x, y - 1) === 0 && O(x - 1, y - 1) === 0 && O(x + 1, y - 1) === 0) && [[-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1]].forEach(([a, b]) => setO(x + a, y + b, 5)));
          sample(0.006, (x, y) => tryObj(x, y, 'bamboofence'));
          break;
      }
    }

    // ---------- 5б. Россыпь мелкой природы: цветы (пятнами), кусты, камни, папоротники, грибы, камыш ----------
    {
      const FL = ['red', 'yellow', 'white', 'blue', 'pink', 'purple', 'orange'];
      const FP = { park: 0.1, residential: 0.05, clan: 0.05, uchiha: 0.018, official: 0.022, market: 0, forest: 0.012, training: 0.008 };
      const small = new Uint8Array(W * HH);
      const near = (x, y, f) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => f(m.get(x + a, y + b)));
      for (let y = 14; y < HH - 1; y++) for (let x = 1; x < W - 1; x++) {
        if (!grassy(x, y) || KP(x, y)) continue;
        const o = O(x, y); if (o !== 0 && o !== 6) continue;
        const d = m.districtAt(x, y), dt = d ? d.type : 'residential';
        const dark = m.get(x, y) === ID.DARKGRASS || dt === 'forest' || dt === 'uchiha';
        const r = H(x, y, 701), r2 = H(x, y, 702);
        const jx = Math.floor(H(x, y, 703) * 7) - 3, jy = Math.floor(H(x, y, 704) * 3);
        const put = (kind, blocks) => {
          if (blocks && o !== 0) return false;
          m.addObject(kind, x * T + 8 + jx, y * T + 13 + jy, blocks ? undefined : { box: null });
          small[y * W + x] = 1; if (blocks) setO(x, y, 5);
          return true;
        };
        // цветочные поляны: шум задаёт пятна и их цвет
        const n = noise(x, y, 91, 7), fam = FL[Math.floor(noise(x, y, 92, 11) * FL.length) % FL.length];
        const fp = (FP[dt] != null ? FP[dt] : 0.02) * (n > 0.62 ? 4.5 : 1);
        if (!small[y * W + x] && r < fp) { put('fl_' + (n > 0.62 ? fam : FL[Math.floor(r2 * FL.length)]), false); continue; }
        if (dt === 'market') continue;
        const q = H(x, y, 705);
        if (dark && q < 0.035) { put(q < 0.012 ? 'mushroom' : 'fern', false); continue; }
        if (q < 0.012 && o === 0) { put(['bush_pink', 'bush_white', 'bush_red', 'bush_yellow'][Math.floor(r2 * 4)], true); continue; }
        if (q < 0.03 && o === 0) { put(r2 > 0.5 ? 'bush3' : 'bush', true); continue; }
        if (q < 0.045) { put(r2 > 0.6 ? 'shrub' : r2 > 0.3 ? 'lavender' : 'sunflower', false); continue; }
        if (q < 0.058) { put('pebbles', false); continue; }
        if (q < 0.064 && o === 0) { put('rock3', true); continue; }
        if (q < 0.0655 && o === 0 && dt !== 'residential') { put('rock2', true); continue; }
        if (q < 0.072 && (dt === 'park' || dt === 'forest')) { put('leafpile', false); continue; }
        if (near(x, y, (t) => t === ID.WATER) && r < 0.35) { put('reeds', false); continue; }
      }
    }

    // фонари вдоль главных улиц
    for (const r of layout.roads) {
      if (r.type !== 'main') continue;
      if (r.pts) {   // ломаная: фонарь через каждые ~7 клеток по обе стороны
        const tl = r._t || polyTiles(r.pts, 3), mid = tl.filter((_, i) => i % 3 === 1);
        for (let i = 2; i < mid.length; i += 7) {
          const [x, y] = mid[i];
          for (const [lx, ly] of [[x - 2, y], [x + 2, y]]) if (!KP(lx, ly) && (O(lx, ly) === 0 || (O(lx, ly) === 4 && m.get(lx, ly) === ID.STONE && O(lx, ly - 1) !== 2 && O(lx, ly + 1) !== 2))) tryObj(lx, ly, 'lamp', null, () => true);
        }
        continue;
      }
      const rr = roadRect(r);
      const horiz = r.y1 === r.y2;
      const len = horiz ? rr.w : rr.h;
      for (let i = 2; i < len; i += 7) {
        const a = horiz ? [rr.x + i, rr.y - 1] : [rr.x - 1, rr.y + i];
        const b = horiz ? [rr.x + i, rr.y + rr.h] : [rr.x + rr.w, rr.y + i];
        for (const [x, y] of [a, b]) if (!KP(x, y) && (O(x, y) === 0 || (O(x, y) === 4 && m.get(x, y) === ID.STONE && O(x, y - 1) !== 2 && O(x, y + 1) !== 2))) tryObj(x, y, 'lamp', null, () => true);
      }
    }

    // таблички-указатели
    const signs = layout.signs || [
      [77, 47, ['▲ Академия, резиденция Хокаге, Скала Хокаге', '< Квартал кланов   Квартал Учиха >', '▼ Жилые кварталы, полигоны, главные ворота']],
      [81, 61, ['Жилой квартал. Дом героя — к востоку отсюда.', 'Мимо квартиры Наруто ночью лучше не шуметь.']],
      [74, 119, ['Главные ворота Конохи. Посты стражи: Изумо и Котецу.']],
      [27, 43, ['Лес клана Нара. Без разрешения не входить. Не кормить оленей!']],
      [131, 61, ['Квартал Учиха. После трагедии здесь живёт только Саске.']],
    ];
    for (let [x, y, talk] of signs) {
      const bad = (xx, yy) => O(xx, yy) === 2 || O(xx, yy) === 3 || O(xx, yy) === 1 || O(xx, yy) === 5 || KP(xx, yy);
      if (bad(x, y)) { const alt = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0]].find(([a, b]) => !bad(x + a, y + b)); if (!alt) continue; x += alt[0]; y += alt[1]; }
      m.addObject('sign', x * T + 8, y * T + 15, { talk });
      setO(x, y, 5);
    }

    // недостижимые «карманы» (дворы за домами без прохода) делаем непроходимыми
    m.finalize();
    pockets(m, ...(layout.start || [78, 50]));
    // декор с репликами (святилища, колодцы), оказавшийся в недоступном дворе, убираем: до него не дойти
    if (EXPL) {
      const near = (o) => { const tx = Math.floor(o.x / T), ty = Math.floor((o.y - 1) / T); return [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]].some(([a, b]) => m.reach[(ty + b) * W + tx + a]); };
      m.objects = m.objects.filter((o) => !(o.talk && (o.kind === 'shrine' || o.kind === 'well') && !near(o)));
    }

    // ---------- 6. Точки появления ----------
    m.spawnPoints = [];
    if (EXPL) {   // явная раскладка: равномерная россыпь по достижимым клеткам у дорог и дорожек
      const crowd = layout.crowd || 96, sp = [];
      for (let k = 0; k < 9000 && sp.length < crowd; k++) {
        const x = 4 + Math.floor(rnd() * (W - 8)), y = 16 + Math.floor(rnd() * (HH - 20));
        if (!m.inside(x, y) || !m.reach || !m.reach[y * W + x] || m.solidTile(x, y) || O(x, y) === 5 || O(x, y) === 2 || O(x, y) === 3) continue;
        if (O(x, y) !== 1 && !(KP(x, y) || O(x + 1, y) === 1 || O(x - 1, y) === 1 || O(x, y + 1) === 1 || O(x, y - 1) === 1)) continue;
        if (sp.some((q) => Math.abs(q[0] - x) + Math.abs(q[1] - y) < 5)) continue;
        sp.push([x, y]);
      }
      for (const [x, y] of sp) { const d = m.districtAt(x, y); m.spawnPoints.push({ x: x * T + 8, y: y * T + 12, district: d ? d.type : 'residential' }); }
    }
    for (const d of EXPL ? [] : layout.districts) {
      if (!['residential', 'market', 'official', 'park', 'clan', 'training'].includes(d.type)) continue;
      const n = { market: 8, official: 6, residential: 7, park: 3, clan: 2, training: 2 }[d.type];
      let tries = 0, got = 0;
      while (got < n && tries++ < 200) {
        const x = d.x + Math.floor(rnd() * d.w), y = d.y + Math.floor(rnd() * d.h);
        if (m.solidTile(x, y) || O(x, y) === 5 || O(x, y) === 2) continue;
        m.spawnPoints.push({ x: x * T + 8, y: y * T + 12, district: d.type });
        got++;
      }
    }

    // ключевые точки (для NPC и телепорта)
    m.landmarks = {};
    for (const b of m.buildings) if (b.tplDef.unique) m.landmarks[b.tplId] = b;
    m.spots = m.spots || {};
    for (const b of m.buildings) delete m.spots[b.tplId];   // у кого есть здание — это не «точка»
    m.occ = occ; m.keep = keep;
    m.roads = layout.roads.map((r) => Object.assign({ rect: roadRect(r) }, r));
    m.finalize();
    return m;
  }

  // Заливка от главной улицы: всё проходимое, куда нельзя дойти, становится непроходимым,
  // чтобы NPC, травы, свитки и места прыжка с крыш не оказывались в замкнутых дворах.
  function pockets(m, sx = 78, sy = 50) {
    const T = G.CONFIG.TILE, W = m.w, HH = m.h;
    const free = new Uint8Array(W * HH), seen = new Uint8Array(W * HH);
    for (let y = 0; y < HH; y++) for (let x = 0; x < W; x++) free[y * W + x] = m.blockedRect({ x: x * T + 3, y: y * T + 7, w: 10, h: 5 }) ? 0 : 1;
    const q = [sy * W + sx]; seen[q[0]] = 1;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % W, y = (i / W) | 0;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ax, ny = y + ay; if (nx < 0 || ny < 0 || nx >= W || ny >= HH) continue;
        const j = ny * W + nx; if (seen[j] || !free[j]) continue;
        seen[j] = 1; q.push(j);
      }
    }
    let n = 0;
    for (let i = 0; i < W * HH; i++) if (free[i] && !seen[i]) { m.setBlock(i % W, (i / W) | 0, 1); n++; }
    m.reach = seen; m.pocketTiles = n;
    m._walk = null;
    return n;
  }

  return { konoha, roadRect, noise, pockets };
})();
