// Тайлы и объекты окружения: встроенные рисунки и процедурные запасные варианты.
// Тайл 16×16. Объекты (деревья, фонари, мебель) — отдельные спрайты, сортируются по Y вместе с персонажами.
G.tiles = (() => {
  const T = G.CONFIG.TILE;
  const P = G.PAL;
  const H = G.util.hash2;

  // ---------- id тайлов земли ----------
  const ID = {
    GRASS: 0, GRASS2: 1, FLOWERS: 2, PATH: 3, WATER: 4, SAND: 5, PLANKS: 6, STONE: 7,
    DARKGRASS: 8, DIRT: 9, CLIFF: 10, CLIFFTOP: 11, VWALL: 12, FLOOR: 13, TATAMI: 14,
    IWALL: 15, VOID: 16, MAINROAD: 17, DARKSTONE: 18, MAT: 19, TILEFLOOR: 20, DUSTFLOOR: 21, RUG: 22,
    COBBLE: 23, BRICK: 24, GRAVEL: 25, CLOVER: 26, STEPS: 27, PLAZA: 28, MOSS: 29,
  };
  const COUNT = 30;
  const SOLID = {};
  for (const k of ['WATER', 'CLIFF', 'CLIFFTOP', 'VWALL', 'IWALL', 'VOID']) SOLID[ID[k]] = true;

  const GRASSY = new Set([ID.GRASS, ID.GRASS2, ID.FLOWERS, ID.DARKGRASS, ID.CLOVER, ID.MOSS]);
  const ROADY = new Set([ID.PATH, ID.DIRT, ID.MAINROAD, ID.STONE, ID.DARKSTONE, ID.SAND, ID.COBBLE, ID.BRICK, ID.GRAVEL, ID.PLAZA]);
  const LAND = (id) => id !== ID.WATER && id >= 0 && id !== ID.CLIFF && id !== ID.CLIFFTOP && id !== ID.VWALL;

  // Цвет тайла для обзорной карты
  const MAPCOL = {
    [ID.GRASS]: '#5aa046', [ID.GRASS2]: '#5aa046', [ID.FLOWERS]: '#6aac50', [ID.PATH]: '#b99a68',
    [ID.WATER]: '#3a8ad0', [ID.SAND]: '#e8d4a0', [ID.PLANKS]: '#a8683a', [ID.STONE]: '#c8c0b0',
    [ID.DARKGRASS]: '#3e7a34', [ID.DIRT]: '#b8946a', [ID.CLIFF]: '#7a6a5a', [ID.CLIFFTOP]: '#2e5a2e',
    [ID.VWALL]: '#6a5a4a', [ID.MAINROAD]: '#aaa69c', [ID.DARKSTONE]: '#5a5468',
    [ID.COBBLE]: '#b8ae9c', [ID.BRICK]: '#c08a68', [ID.GRAVEL]: '#a8a090', [ID.CLOVER]: '#58a048', [ID.STEPS]: '#5aa046',
    [ID.PLAZA]: '#d8d0c0', [ID.MOSS]: '#4a8a3c',
  };

  let atlas = null;

  function px(c, x, y, col, w = 1, h = 1) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function dots(c, ox, oy, n, seed, cols) {
    for (let i = 0; i < n; i++) {
      const x = Math.floor(H(i, seed, 1) * 16), y = Math.floor(H(seed, i, 2) * 16);
      px(c, ox + x, oy + y, cols[i % cols.length]);
    }
  }

  function grass(c, ox, oy, seed, tufts, base = P.grass, light = P.grassLight, dark = P.grassDark) {
    px(c, ox, oy, base, T, T);
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(H(i, seed, 1) * 16), y = Math.floor(H(seed, i, 2) * 16);
      px(c, ox + x, oy + y, H(i, i, seed) > 0.5 ? light : dark);
    }
    if (tufts) {
      for (let i = 0; i < 3; i++) {
        const x = 2 + Math.floor(H(i, seed, 7) * 11), y = 3 + Math.floor(H(seed, i, 8) * 10);
        px(c, ox + x, oy + y + 1, dark, 1, 2);
        px(c, ox + x + 2, oy + y + 1, dark, 1, 2);
        px(c, ox + x + 1, oy + y, dark, 1, 3);
        px(c, ox + x + 1, oy + y, light);
      }
    }
  }

  function flowers(c, ox, oy) {
    grass(c, ox, oy, 3, false);
    const cols = [P.white, P.yellow, P.pink, '#ff6a5a'];
    for (let i = 0; i < 5; i++) {
      const x = 2 + Math.floor(H(i, 9, 3) * 12), y = 2 + Math.floor(H(9, i, 4) * 12);
      const col = cols[i % cols.length];
      px(c, ox + x, oy + y - 1, col); px(c, ox + x - 1, oy + y, col); px(c, ox + x + 1, oy + y, col);
      px(c, ox + x, oy + y + 1, col); px(c, ox + x, oy + y, P.yellowDark);
    }
  }

  // натоптанная земляная тропа: плотный суглинок, редкие камешки и пробивающиеся травинки
  function path(c, ox, oy) {
    px(c, ox, oy, '#b99a68', T, T);
    dots(c, ox, oy, 16, 5, ['#a68a5a', '#c8aa78', '#9a7e52']);
    px(c, ox + 4, oy + 9, '#9a7e52', 2, 1); px(c, ox + 11, oy + 3, '#9a7e52', 2, 1);
    px(c, ox + 8, oy + 13, '#6a9a4a', 1, 2); px(c, ox + 2, oy + 2, '#6a9a4a', 1, 1);
  }

  function dirt(c, ox, oy) {
    px(c, ox, oy, '#b8946a', T, T);
    dots(c, ox, oy, 16, 12, ['#9a7650', '#c8a47a', '#a8845a']);
    px(c, ox + 3, oy + 5, '#9a7650', 3, 1); px(c, ox + 10, oy + 12, '#9a7650', 2, 1);
  }

  function water(c, ox, oy) {
    px(c, ox, oy, P.water, T, T);
    for (let i = 0; i < 3; i++) {
      const y = 2 + i * 5, x = Math.floor(H(i, 3, 9) * 10);
      px(c, ox + x, oy + y, P.waterDark, 4, 1);
    }
  }

  function sand(c, ox, oy) {
    px(c, ox, oy, '#e8d4a0', T, T);
    dots(c, ox, oy, 8, 2, ['#c8b480']);
  }

  function planks(c, ox, oy) {
    px(c, ox, oy, P.wood, T, T);
    for (let y = 0; y < 16; y += 4) px(c, ox, oy + y + 3, P.woodDark, T, 1);
    px(c, ox + 5, oy, P.woodDark, 1, 3); px(c, ox + 11, oy + 4, P.woodDark, 1, 3);
    px(c, ox + 3, oy + 8, P.woodDark, 1, 3); px(c, ox + 9, oy + 12, P.woodDark, 1, 3);
  }

  // мощёная площадь: плитка 8×8 со смещением
  function stone(c, ox, oy, base = '#cfc6b4', line = '#b8ae9a', hi = '#dad2c3') {
    if (base === '#cfc6b4') { G.environment.stone(c, ox, oy); return; }
    px(c, ox, oy, base, T, T);
    px(c, ox, oy + 7, line, T, 1); px(c, ox, oy + 15, line, T, 1);
    px(c, ox + 7, oy, line, 1, 7); px(c, ox + 15, oy, line, 1, 7);
    px(c, ox + 3, oy + 8, line, 1, 7); px(c, ox + 11, oy + 8, line, 1, 7);
    px(c, ox + 1, oy + 1, hi, 3, 1); px(c, ox + 9, oy + 9, hi, 2, 1);
  }

  // главная улица: крупные плиты
  function mainroad(c, ox, oy) {
    G.environment.stone(c, ox, oy, 0, true);
  }

  function darkstone(c, ox, oy) { stone(c, ox, oy, '#6a6478', '#4a4458', '#7c768a'); }

  function darkgrass(c, ox, oy) { grass(c, ox, oy, 8, true, P.grassDark, P.grass, P.leafDark); }

  // отвесная скала (лицевая сторона)
  function cliff(c, ox, oy) {
    px(c, ox, oy, '#8a7866', T, T);
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(H(i, 4, 31) * 14);
      px(c, ox + x, oy, '#6e5e4e', 1, T);
      px(c, ox + x + 1, oy, '#a08c78', 1, T);
    }
    px(c, ox, oy + 5, '#76665a', T, 1); px(c, ox, oy + 12, '#76665a', T, 1);
    dots(c, ox, oy, 8, 33, ['#5e5044', '#a8947e']);
  }

  // верх скалы: густые кроны (лес на горе)
  function clifftop(c, ox, oy) {
    px(c, ox, oy, P.leafDark, T, T);
    const blob = (x, y, r, col) => { c.fillStyle = col; for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) { const X = x + xx, Y = y + yy; if (X >= 0 && Y >= 0 && X < 16 && Y < 16) c.fillRect(ox + X, oy + Y, 1, 1); } };
    blob(4, 4, 4, P.leaf); blob(12, 10, 4, P.leaf); blob(12, 2, 3, '#3e8a42'); blob(3, 12, 3, '#3e8a42');
    px(c, ox + 3, oy + 2, '#5aaa5a', 2, 1); px(c, ox + 11, oy + 8, '#5aaa5a', 2, 1);
  }

  // стена деревни (лицевая и верх рисуются в renderTile по соседям)
  function vwall(c, ox, oy) {
    px(c, ox, oy, '#8a7a68', T, T);
    for (let y = 0; y < 16; y += 4) {
      px(c, ox, oy + y + 3, '#6a5a4a', T, 1);
      const off = (y / 4) % 2 ? 4 : 0;
      for (let x = off; x < 16; x += 8) px(c, ox + x, oy + y, '#6a5a4a', 1, 3);
    }
  }

  function floor(c, ox, oy) {
    G.environment.floor(c, ox, oy);
  }

  function tatami(c, ox, oy) {
    G.environment.tatami(c, ox, oy);
  }

  function iwall(c, ox, oy) {
    px(c, ox, oy, '#e8dcc0', T, T);
  }

  function voidT(c, ox, oy) { px(c, ox, oy, '#252922', T, T); }

  function mat(c, ox, oy) {
    floor(c, ox, oy);
    px(c, ox + 1, oy + 2, '#685645', 14, 13); px(c, ox + 2, oy + 3, '#b18962', 12, 11);
    for (let y = 4; y < 14; y += 2) px(c, ox + 3, oy + y, '#c5a378', 10, 0.5);
    px(c, ox + 2, oy + 3, '#6b8475', 1, 11); px(c, ox + 13, oy + 3, '#6b8475', 1, 11);
  }

  function tilefloor(c, ox, oy) {
    px(c, ox, oy, '#d3dfd2', T, T);
    px(c, ox, oy, '#f0edda', T, 0.5); px(c, ox, oy, '#f0edda', 0.5, T);
    px(c, ox, oy + 15.5, '#a5bcb1', T, 0.5); px(c, ox + 15.5, oy, '#a5bcb1', 0.5, T);
    px(c, ox + 2, oy + 2, '#e2e8d6', 5, 0.5); px(c, ox + 12, oy + 12, '#c9d7ca', 2, 0.5);
  }

  function dustfloor(c, ox, oy) {
    px(c, ox, oy, '#6e5a48', T, T);
    for (let y = 0; y < 16; y += 4) px(c, ox, oy + y + 3, '#5a4838', T, 1);
    dots(c, ox, oy, 10, 44, ['#8a7a6a', '#4a3a2e']);
  }

  function rug(c, ox, oy) {
    px(c, ox, oy, '#8f544c', T, T);
    for (let y = 1; y < 16; y += 2) px(c, ox, oy + y, '#995f53', T, 0.5);
    px(c, ox + 7, oy + 6, '#bd9a6e', 2, 4); px(c, ox + 6, oy + 7, '#bd9a6e', 4, 2);
  }

  // булыжная мостовая переулков
  function cobble(c, ox, oy, base = '#b0a690', st = '#cec4ae', ln = '#8a806c', moss = null) {
    px(c, ox, oy, ln, T, T);
    for (let r = 0; r < 4; r++) for (let k = -1; k < 4; k++) {
      const x = k * 5 + (r % 2 ? 2 : 0) + 1, y = r * 4 + 1;
      const w = 4, x0 = Math.max(0, x), x1 = Math.min(16, x + w);
      if (x1 <= x0) continue;
      const col = H(r, k, 71) > 0.7 ? base : st;
      px(c, ox + x0, oy + y, col, x1 - x0, 3);
      if (x0 === x) px(c, ox + x0, oy + y, '#e0d8c4', 1, 1);
      if (moss && H(k, r, 72) > 0.6) px(c, ox + x0, oy + y + 2, moss, Math.min(2, x1 - x0), 1);
    }
  }
  // кирпичная «ёлочка» площадей
  function brick(c, ox, oy) {
    px(c, ox, oy, '#c08a68', T, T);
    for (let y = 0; y < 16; y += 4) { px(c, ox, oy + y + 3, '#9a6a4e', T, 1); const off = (y / 4) % 2 ? 4 : 0; for (let x = off; x < 16; x += 8) px(c, ox + x, oy + y, '#9a6a4e', 1, 3); }
    px(c, ox + 1, oy + 0, '#d8a080', 3, 1); px(c, ox + 9, oy + 8, '#d8a080', 3, 1);
  }
  function gravel(c, ox, oy, seed = 81) {
    px(c, ox, oy, '#aaa292', T, T);
    dots(c, ox, oy, 30, seed, ['#8e8676', '#c4bcac', '#9a9282', '#d0c8b8']);
  }
  function clover(c, ox, oy) {
    grass(c, ox, oy, 4, false);
    for (let i = 0; i < 4; i++) { const x = 2 + Math.floor(H(i, 5, 9) * 11), y = 2 + Math.floor(H(5, i, 9) * 11); px(c, ox + x, oy + y, '#3e8a34', 2, 2); px(c, ox + x + 2, oy + y + 1, '#4e9a3e', 1, 1); }
    px(c, ox + 4, oy + 11, P.white); px(c, ox + 12, oy + 5, P.white);
  }
  // камни-ступеньки в траве (садовая дорожка)
  function steps(c, ox, oy) {
    grass(c, ox, oy, 6, false);
    px(c, ox + 3, oy + 3, '#8a8478', 10, 9); px(c, ox + 2, oy + 4, '#8a8478', 12, 7);
    px(c, ox + 3, oy + 4, '#c8c0b0', 10, 6); px(c, ox + 4, oy + 3, '#c8c0b0', 8, 1); px(c, ox + 4, oy + 4, '#dcd4c4', 4, 1);
  }
  // большие плиты площади с ромбом
  function plaza(c, ox, oy) {
    px(c, ox, oy, '#d4ccbc', T, T);
    px(c, ox, oy + 15, '#c6bead', T, 1); px(c, ox + 15, oy, '#c6bead', 1, T);
    px(c, ox, oy, '#dcd5c8', T, 1); px(c, ox, oy, '#dcd5c8', 1, T);
    for (let i = 0; i < 5; i++) { px(c, ox + 7 - i, oy + 3 + i, '#cdc5b5'); px(c, ox + 8 + i, oy + 3 + i, '#cdc5b5'); px(c, ox + 7 - i, oy + 12 - i, '#cdc5b5'); px(c, ox + 8 + i, oy + 12 - i, '#cdc5b5'); }
  }
  function moss(c, ox, oy) { grass(c, ox, oy, 9, true, '#4a8a3c', '#6aa858', '#2e6a2e'); }

  // Вариации тайлов (2-я строка атласа): рисуются вместо основного с вероятностью VAR_P
  const VAR = {};
  const VAR_P = 0.3;
  function buildVariants(c) {
    let col = 0;
    const add = (id, fn) => { (VAR[id] || (VAR[id] = [])).push(col); fn(col * T, T); col++; };
    add(ID.GRASS, (x, y) => { grass(c, x, y, 11, false); px(c, x + 5, y + 9, '#9a9a8a', 2, 1); px(c, x + 11, y + 4, '#aaa898', 1, 1); });
    add(ID.GRASS, (x, y) => { grass(c, x, y, 12, false); for (let i = 0; i < 3; i++) { const xx = 3 + Math.floor(H(i, 12, 3) * 10), yy = 3 + Math.floor(H(12, i, 3) * 10); px(c, x + xx, y + yy, P.yellow); } });
    add(ID.GRASS, (x, y) => { grass(c, x, y, 13, true, P.grass, P.grassLight, '#46863a'); px(c, x + 6, y + 6, '#4e9040', 4, 3); });
    add(ID.GRASS2, (x, y) => grass(c, x, y, 14, true));
    add(ID.GRASS2, (x, y) => { grass(c, x, y, 15, true); px(c, x + 9, y + 10, P.white); px(c, x + 3, y + 4, P.pink); });
    add(ID.DARKGRASS, (x, y) => grass(c, x, y, 16, true, P.grassDark, P.grass, P.leafDark));
    add(ID.STONE, (x, y) => { stone(c, x, y); px(c, x + 2, y + 2, '#a89e8a', 1, 3); px(c, x + 3, y + 4, '#a89e8a', 2, 1); px(c, x + 5, y + 5, '#a89e8a', 1, 2); });
    add(ID.STONE, (x, y) => { stone(c, x, y); px(c, x + 8, y + 14, '#7aa05a', 3, 1); px(c, x + 0, y + 6, '#7aa05a', 2, 1); px(c, x + 15, y + 2, '#7aa05a', 1, 2); });
    add(ID.STONE, (x, y) => stone(c, x, y, '#c8beac', '#a49a86', '#ddd4c4'));
    add(ID.PATH, (x, y) => { path(c, x, y); px(c, x + 3, y + 3, '#8e7448', 2, 2); px(c, x + 10, y + 11, '#8e7448', 2, 1); px(c, x + 12, y + 7, '#d8bc88', 1, 1); });
    add(ID.PATH, (x, y) => { path(c, x, y); px(c, x + 5, y + 4, '#8e7448', 4, 1); px(c, x + 6, y + 5, '#8e7448', 2, 1); px(c, x + 9, y + 10, '#c8aa78', 2, 2); });
    add(ID.MAINROAD, (x, y) => { mainroad(c, x, y); px(c, x + 4, y + 5, '#8f8b80', 1, 3); px(c, x + 9, y + 9, '#8f8b80', 2, 1); });
    add(ID.MAINROAD, (x, y) => { mainroad(c, x, y); px(c, x + 6, y + 13, '#7aa05a', 2, 1); px(c, x + 1, y + 6, '#cfcbc0', 2, 1); });
    add(ID.DIRT, (x, y) => { dirt(c, x, y); px(c, x + 6, y + 7, '#8a6a4a', 3, 2); px(c, x + 7, y + 6, '#c8a47a', 1, 1); });
    add(ID.COBBLE, (x, y) => cobble(c, x, y, '#a89e88', '#c4baa4', '#7e7462', '#6a9a4a'));
    add(ID.COBBLE, (x, y) => cobble(c, x, y, '#b8ae98', '#d6ccb6', '#928874'));
    add(ID.GRAVEL, (x, y) => gravel(c, x, y, 82));
    add(ID.PLAZA, (x, y) => { plaza(c, x, y); px(c, x + 2, y + 2, '#b0a898', 1, 3); });
    add(ID.DARKSTONE, (x, y) => { darkstone(c, x, y); px(c, x + 9, y + 3, '#4e7a3a', 2, 1); px(c, x + 2, y + 12, '#4e7a3a', 1, 2); });
    return col;
  }

  function build() {
    atlas = G.gfx.canvas(T * COUNT, T * 2);   // ×2: тонкие швы и фактуры, источник drawImage — в логических px
    const c = atlas.getContext('2d');
    const fns = [
      (x) => grass(c, x, 0, 1, false), (x) => grass(c, x, 0, 2, true), (x) => flowers(c, x, 0), (x) => path(c, x, 0),
      (x) => water(c, x, 0), (x) => sand(c, x, 0), (x) => planks(c, x, 0), (x) => stone(c, x, 0),
      (x) => darkgrass(c, x, 0), (x) => dirt(c, x, 0), (x) => cliff(c, x, 0), (x) => clifftop(c, x, 0),
      (x) => vwall(c, x, 0), (x) => floor(c, x, 0), (x) => tatami(c, x, 0), (x) => iwall(c, x, 0),
      (x) => voidT(c, x, 0), (x) => mainroad(c, x, 0), (x) => darkstone(c, x, 0), (x) => mat(c, x, 0),
      (x) => tilefloor(c, x, 0), (x) => dustfloor(c, x, 0), (x) => rug(c, x, 0),
      (x) => cobble(c, x, 0), (x) => brick(c, x, 0), (x) => gravel(c, x, 0), (x) => clover(c, x, 0),
      (x) => steps(c, x, 0), (x) => plaza(c, x, 0), (x) => moss(c, x, 0),
    ];
    fns.forEach((f, i) => f(i * T));
    buildVariants(c);
    G.terrainArt.paintAtlas(c,ID,VAR);
  }

  // Простой тайл без учёта соседей
  function drawTile(ctx, id, x, y, tx, ty) {
    if (!atlas) build();
    ctx.drawImage(atlas, id * T, 0, T, T, x, y, T, T);
  }

  // Приоритет поверхностей: у кого выше, тот «наползает» на соседей с меньшим приоритетом
  const RANK = {};
  [ID.STONE, ID.PLAZA, ID.MAINROAD, ID.BRICK, ID.DARKSTONE].forEach((k) => (RANK[k] = 1));
  RANK[ID.COBBLE] = 2; RANK[ID.PATH] = 3; RANK[ID.GRAVEL] = 3; RANK[ID.DIRT] = 4; RANK[ID.SAND] = 4;
  [ID.GRASS, ID.GRASS2, ID.CLOVER, ID.FLOWERS, ID.MOSS].forEach((k) => (RANK[k] = 6));
  RANK[ID.DARKGRASS] = 7;

  // гладкий одномерный шум вдоль границы (в мировых координатах, поэтому стыкуется между тайлами)
  function edgeNoise(g, line, seed) {
    const a = Math.floor(g / 3), f = (g % 3) / 3;
    const v0 = H(a, line, seed), v1 = H(a + 1, line, seed);
    return v0 + (v1 - v0) * f;
  }

  function blendEdges(ctx, map, tx, ty, x, y, id) {
    const r = RANK[id]; if (!r) return;
    const nbs = [[0, -1, 0], [0, 1, 1], [-1, 0, 2], [1, 0, 3]];
    const got = [0, 0, 0, 0];
    for (const [dx, dy, side] of nbs) {
      const nb = map.get(tx + dx, ty + dy), rn = RANK[nb];
      if (!rn || rn <= r || nb === id) continue;
      got[side] = nb;
      for (let i = 0; i < 16; i++) {
        const g = (side < 2 ? tx : ty) * 16 + i, line = side < 2 ? ty + dy : tx + dx;
        const v = edgeNoise(g, line, 600 + side);
        const d = 1 + Math.floor(v * 3.4);
        const dith = v > 0.25 && ((i + tx + ty) & 1) === 0 ? 1 : 0;
        const n = d + dith, nx = nb * T;
        if (side === 0) { ctx.drawImage(atlas, nx + i, 0, 1, n, x + i, y, 1, n); }
        else if (side === 1) { ctx.drawImage(atlas, nx + i, 16 - n, 1, n, x + i, y + 16 - n, 1, n); }
        else if (side === 2) { ctx.drawImage(atlas, nx, i, n, 1, x, y + i, n, 1); }
        else { ctx.drawImage(atlas, nx + 16 - n, i, n, 1, x + 16 - n, y + i, n, 1); }
      }
    }
    // углы: сосед по диагонали заходит небольшим пятном
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const nb = map.get(tx + dx, ty + dy), rn = RANK[nb];
      if (!rn || rn <= r || nb === id) continue;
      if (got[dy < 0 ? 0 : 1] === nb || got[dx < 0 ? 2 : 3] === nb) continue;
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        if (a + b > 2 || (a + b === 2 && H(tx * 3 + a, ty * 3 + b, 611) < 0.5)) continue;
        const sx = dx < 0 ? a : 15 - a, sy = dy < 0 ? b : 15 - b;
        ctx.drawImage(atlas, nb * T + sx, sy, 1, 1, x + sx, y + sy, 1, 1);
      }
    }
    // у воды: тёмная влажная кромка с неровным краем
    for (const [dx, dy, side] of nbs) {
      if (map.get(tx + dx, ty + dy) !== ID.WATER) continue;
      ctx.globalAlpha = 0.28; ctx.fillStyle = '#2a4a5a';
      for (let i = 0; i < 16; i++) {
        const v = edgeNoise((side < 2 ? tx : ty) * 16 + i, side < 2 ? ty + dy : tx + dx, 650 + side), d = 1 + Math.floor(v * 2.6);
        if (side === 0) ctx.fillRect(x + i, y, 1, d); else if (side === 1) ctx.fillRect(x + i, y + 16 - d, 1, d);
        else if (side === 2) ctx.fillRect(x, y + i, d, 1); else ctx.fillRect(x + 16 - d, y + i, d, 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  // Тайл с переходами по соседям (используется при запекании чанков карты)
  function renderTile(ctx, map, tx, ty, x, y) {
    if (!atlas) build();
    const id = map.get(tx, ty);
    if (id < 0) return;
    const vs = map.outdoor ? VAR[id] : null, hv = vs ? H(tx, ty, 555) : 1;
    const drawnPath=G.terrainArt.draw(ctx,map,tx,ty,x,y,ID,GRASSY);
    if(drawnPath){}
    else if (id === ID.FLOOR || id === ID.DUSTFLOOR) G.environment.floor(ctx, x, y, tx, ty, id === ID.DUSTFLOOR);
    else if (id === ID.TATAMI) G.environment.tatami(ctx, x, y, tx, ty);
    else if (id === ID.MAINROAD) G.environment.stone(ctx, x, y, Math.floor(tx / 2) + ty * 3, true);
    else if (hv < VAR_P) ctx.drawImage(atlas, vs[Math.floor(hv / VAR_P * vs.length)] * T, T, T, T, x, y, T, T);
    else ctx.drawImage(atlas, id * T, 0, T, T, x, y, T, T);
    const up = map.get(tx, ty - 1), dn = map.get(tx, ty + 1), lf = map.get(tx - 1, ty), rt = map.get(tx + 1, ty);
    const hh = (i, s) => H(tx * 16 + i, ty, s);
    // Окантовка ковра только по внешнему периметру, без полос на каждом тайле.
    if (id === ID.RUG) {
      if (up !== id) { px(ctx, x, y, '#59483d', 16, 1); px(ctx, x, y + 2, '#c0a579', 16, 1); }
      if (dn !== id) { px(ctx, x, y + 15, '#59483d', 16, 1); px(ctx, x, y + 13, '#c0a579', 16, 1); }
      if (lf !== id) { px(ctx, x, y, '#59483d', 1, 16); px(ctx, x + 2, y, '#c0a579', 1, 16); }
      if (rt !== id) { px(ctx, x + 15, y, '#59483d', 1, 16); px(ctx, x + 13, y, '#c0a579', 1, 16); }
    }

    // крупные пятна света и тени теперь — один плавный проход по всему чанку (map.groundLight), а не квадраты 4×4
    if (map.outdoor && G.mapgen && (GRASSY.has(id) || ROADY.has(id))) {
      const grass = GRASSY.has(id);
      if (grass && hh(1, 91) > 0.82) { // одиночные цветочки и камешки
        const fx = 2 + Math.floor(hh(2, 92) * 12), fy = 2 + Math.floor(hh(3, 93) * 12), r = hh(4, 94);
        if (r > 0.55) { const col = r > 0.85 ? '#ffffff' : r > 0.7 ? '#ffd84a' : '#f4a0c0'; px(ctx, x + fx, y + fy, col); px(ctx, x + fx, y + fy + 1, '#3e8a42'); }
        else { px(ctx, x + fx, y + fy, '#8a8a8a'); px(ctx, x + fx + 1, y + fy, '#b8b8b8'); }
      }
    }
    // плавные переходы: более «живая» поверхность соседа заходит рваным краем с дизерингом
    if(!drawnPath)blendEdges(ctx, map, tx, ty, x, y, id);
    // берег
    if (id === ID.WATER) {
      if (LAND(up) || up === ID.CLIFF) { px(ctx, x, y, P.waterDark, 16, 2); px(ctx, x, y + 2, P.waterLight, 16, 1); }
      if (LAND(dn)) px(ctx, x, y + 15, P.waterLight, 16, 1);
      if (LAND(lf)) px(ctx, x, y, P.waterLight, 1, 16);
      if (LAND(rt)) px(ctx, x + 15, y, P.waterLight, 1, 16);
    }
    // скала: кромка сверху и тень снизу
    if (id === ID.CLIFF) {
      if (up === ID.CLIFFTOP) { px(ctx, x, y, P.leafDark, 16, 3); for (let i = 0; i < 16; i += 2) if (hh(i, 5) > 0.4) px(ctx, x + i, y + 3, P.leafDark, 2, 1); px(ctx, x, y + 4, '#5e5044', 16, 1); }
      if (dn !== ID.CLIFF && dn !== ID.CLIFFTOP) px(ctx, x, y + 14, '#5e5044', 16, 2);
    }
    // стена деревни: лицевая сторона, если ниже не стена
    if (id === ID.VWALL) {
      if (dn === ID.VWALL || dn < 0) { px(ctx, x, y, '#a8987e', 16, 16); px(ctx, x, y, '#bcae94', 16, 2); dots(ctx, x, y, 5, 61, ['#988870']); }
      else { px(ctx, x, y, '#a8987e', 16, 3); px(ctx, x, y + 3, '#5a4a3a', 16, 1); px(ctx, x, y + 14, '#4a3a2e', 16, 2); }
      if (up !== ID.VWALL && up >= 0 && dn === ID.VWALL) px(ctx, x, y, '#5a4a3a', 16, 1);
    }
    // Штукатурка, деревянная обшивка и редкие несущие стойки; палитра зависит от комнаты.
    if (id === ID.IWALL) {
      G.environment.wall(ctx, map, tx, ty, x, y);
    }
    if (id === ID.VOID && !map.outdoor) {
      const open = (v) => v >= 0 && !SOLID[v];
      if (open(rt)) { px(ctx, x + 13, y, '#725640', 3, 16); px(ctx, x + 13, y, '#b59567', 0.5, 16); }
      if (open(lf)) { px(ctx, x, y, '#725640', 3, 16); px(ctx, x + 2, y, '#a58a60', 0.5, 16); }
      if (open(up)) { px(ctx, x, y, '#6d533e', 16, 4); px(ctx, x, y, '#b2986c', 16, 0.5); }
    }
    // тени у подножия скалы, стен и стен комнат
    if (!SOLID[id] && (up === ID.CLIFF || up === ID.VWALL || up === ID.IWALL)) {
      ctx.globalAlpha = 0.22; px(ctx, x, y, '#000', 16, 4); ctx.globalAlpha = 0.12; px(ctx, x, y + 4, '#000', 16, 2); ctx.globalAlpha = 1;
    }
    if (!SOLID[id] && id !== ID.WATER && (lf === ID.VOID || lf === ID.IWALL)) { ctx.globalAlpha = 0.15; px(ctx, x, y, '#000', 3, 16); ctx.globalAlpha = 1; }
  }

  // Анимированные блики на воде (рисуются поверх запечённого чанка)
  function waterOverlay(ctx, x, y, tx, ty, time) {
    const ph = time * 0.8 + H(tx, ty, 77) * 6;
    const k = Math.floor(ph) % 4;
    const xx = Math.floor(H(tx, ty, 78) * 10) + k;
    const yy = 4 + Math.floor(H(ty, tx, 79) * 8);
    ctx.fillStyle = P.waterLight;
    if (k < 3) ctx.fillRect(x + xx, y + yy, 3 - (k === 2 ? 1 : 0), 1);
    if (H(tx, ty, 80) > 0.6 && k !== 1) ctx.fillRect(x + ((xx + 7) % 13), y + ((yy + 6) % 14), 2, 1);
  }

  // ======================= ОБЪЕКТЫ =======================
  // Каждый объект: { img, ox, oy, box, layer }
  //   ox, oy — смещение левого верхнего угла от точки привязки (обычно — низ по центру)
  //   box — коллизия относительно точки привязки (null — проходимо)
  //   layer: 'floor' — рисуется под всеми (ковры, вещи на стене)
  const OBJ = {};
  function obj(name, w, h, drawFn, ox, oy, box, layer) {
    const c = G.gfx.canvas(w, h);
    const art=G.environmentArt.draw(c.getContext('2d'),name,w,h);
    if(!art){
      drawFn(c.getContext('2d'));
      G.gfx.smooth(c);
      if (layer !== 'floor' && !/tree|pine|sakura|maple|ginkgo|bush/.test(name)) G.shade.light(c, { r: Math.min(4, Math.max(2, Math.min(w, h) / 6)), vert: h > 20 ? 0.5 : 0.25 });
    }
    OBJ[name] = { img: c, ox, oy, box, layer: layer || null, w, h, art };
    const names=G.environmentArt.bindings[name];
    if(names?.length>1)OBJ[name].variants=names.map((asset,i)=>{
      if(i===0)return {...OBJ[name]};
      const img=G.gfx.canvas(w,h);G.environmentArt.draw(img.getContext('2d'),name,w,h,i);
      return {img,ox,oy,box,layer:layer||null,w,h,art:asset};
    });
  }
  const blob = (c, x, y, r, col) => {
    c.fillStyle = col;
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++)
      if (xx * xx + yy * yy <= r * r + r * 0.6) c.fillRect(x + xx, y + yy, 1, 1);
  };
  const outline = (c, x, y, w, h, fill, line = P.ink) => { px(c, x, y, line, w, h); px(c, x + 1, y + 1, fill, w - 2, h - 2); };

  function buildObjects() {
    for (const [name, spec] of Object.entries(G.environment.details)) obj(name, ...spec);
    // ---------- Природа ----------
    // V9: крона — гроздья листвы, каждая со сферическим светом (свет сверху-слева) и шумом листьев
    const crown = (c, cols, seed) => {
      const S = G.shade, dark = S.toneHex(cols[0], -0.45);
      S.ball(c, 16, 16, 14, 13, [dark, dark]);                                   // кайма-контур
      S.ball(c, 16, 16, 13, 12, [dark, cols[0], cols[0], cols[1]], { noise: 0.25, seed });
      const CL = [[9, 19, 6.5], [23, 19, 6.5], [16, 21, 6], [10, 11, 7], [22, 11, 6.5], [16, 7, 7], [15, 14, 7.5]];
      CL.forEach(([x, y, r], i) => S.ball(c, x + (H(i, seed, 3) - 0.5) * 2, y + (H(seed, i, 4) - 0.5) * 2, r, r * 0.92,
        [cols[0], cols[1], cols[1], cols[2], cols[3]], { noise: 0.5, grain: 1.5, seed: seed * 10 + i }));
      for (let i = 0; i < 10; i++) px(c, 6 + Math.floor(H(i, seed, 11) * 20), 5 + Math.floor(H(seed, i, 12) * 18), cols[3]);
    };
    // ствол — цилиндр: светлая полоса слева, тень справа, корни
    const trunk = (c) => {
      px(c, 12, 26, P.trunkDark, 8, 12); px(c, 13, 26, P.trunk, 5, 12); px(c, 13, 26, '#9a6a42', 2, 12);
      px(c, 17, 26, '#5a321a', 2, 12); px(c, 10, 36, P.trunkDark, 12, 2); px(c, 11, 35, P.trunk, 3, 1);
      c.globalAlpha = 0.45; px(c, 12, 26, '#1e1430', 8, 3); c.globalAlpha = 1;               // тень кроны на стволе
    };
    obj('tree', 32, 40, (c) => { trunk(c); crown(c, [P.leafDark, P.leaf, '#3e8a42', '#6ab85a'], 1); }, -16, -38, { x: -5, y: -6, w: 10, h: 6 });

    // Хвойное дерево (для леса Нара)
    obj('pine', 24, 40, (c) => {
      px(c, 10, 30, P.trunkDark, 4, 9); px(c, 11, 30, P.trunk, 2, 9);
      // V9: ярусы-конусы: свет слева, тень справа и под каждым ярусом
      for (let i = 0; i < 4; i++) {
        const y = 2 + i * 7, w = 8 + i * 4;
        for (let r = 0; r < 9; r++) {
          const ww = Math.round(w * (r + 1) / 9);
          px(c, 12 - ww, y + r, P.leafDark, ww * 2, 1);
          if (r < 7) px(c, 12 - ww + 1, y + r, i % 2 ? P.leaf : '#2e7a3a', ww * 2 - 3, 1);
        }
        G.shade.tint(c, 12 - w, y, w * 2, 9, (u, v) => 0.34 * (0.5 - u) * 1.6 + 0.12 - 0.42 * v * v);
      }
      px(c, 11, 2, '#6ab85a', 1, 3);
    }, -12, -38, { x: -4, y: -5, w: 8, h: 5 });

    obj('bush', 16, 14, (c) => {
      const S = G.shade, cols = [P.leafDark, P.leaf, '#3e8a42', '#6ab85a'];
      S.ball(c, 8, 8.5, 7.5, 5.8, [S.toneHex(P.leafDark, -0.4), P.leafDark]);
      S.ball(c, 5, 8.5, 4.2, 4, cols, { noise: 0.4, grain: 1.5, seed: 2 }); S.ball(c, 11, 8.5, 4.2, 4, cols, { noise: 0.4, grain: 1.5, seed: 3 });
      S.ball(c, 8, 6, 4.6, 4, cols, { noise: 0.4, grain: 1.5, seed: 4 });
    }, -8, -13, { x: -7, y: -6, w: 14, h: 6 });

    obj('rock', 16, 12, (c) => {
      c.fillStyle = P.stoneDark; c.fillRect(1, 3, 14, 9); c.fillRect(3, 1, 10, 11);
      c.fillStyle = P.stone; c.fillRect(2, 3, 11, 6); c.fillRect(4, 1, 8, 7);
      px(c, 5, 3, '#c8c8d4', 3, 1);
    }, -8, -11, { x: -7, y: -6, w: 14, h: 6 });

    obj('deer', 18, 18, (c) => { // олень клана Нара
      px(c, 3, 8, '#8a5a34', 11, 6); px(c, 4, 7, '#a8703e', 9, 5);
      px(c, 4, 13, '#5a3a24', 1, 5); px(c, 7, 13, '#5a3a24', 1, 5); px(c, 11, 13, '#5a3a24', 1, 5); px(c, 13, 13, '#5a3a24', 1, 5);
      px(c, 13, 4, '#a8703e', 4, 5); px(c, 16, 6, '#2a1e18', 1, 1);
      px(c, 13, 0, '#e8dcc0', 1, 4); px(c, 15, 0, '#e8dcc0', 1, 4); px(c, 12, 1, '#e8dcc0', 1, 1); px(c, 16, 1, '#e8dcc0', 1, 1);
      px(c, 6, 8, '#e8dcc0', 1, 1); px(c, 9, 9, '#e8dcc0', 1, 1);
    }, -9, -17, { x: -7, y: -4, w: 14, h: 4 });

    // ---------- Улица ----------
    obj('sign', 16, 18, G.environment.props.sign, -8, -17, { x: -6, y: -4, w: 12, h: 4 });

    obj('fence', 16, 14, G.environment.props.fence, -8, -13, { x: -8, y: -5, w: 16, h: 5 });

    // Забор клана (белая штукатурка, тёмная черепица) — горизонтальный сегмент
    obj('clanwall', 16, 20, G.environment.props.clanwall, -8, -19, { x: -8, y: -6, w: 16, h: 6 });

    obj('lamp', 12, 30, G.environment.props.lamp, -6, -29, { x: -3, y: -3, w: 6, h: 3 });

    obj('stonelamp', 14, 22, G.environment.props.stonelamp, -7, -21, { x: -5, y: -4, w: 10, h: 4 });

    obj('barrel', 12, 16, G.environment.props.barrel, -6, -15, { x: -5, y: -4, w: 10, h: 4 });

    obj('crate', 14, 14, G.environment.props.crate, -7, -13, { x: -7, y: -6, w: 14, h: 6 });

    obj('stall', 32, 28, G.environment.props.stall, -16, -27, { x: -15, y: -6, w: 30, h: 6 });

    obj('well', 18, 22, G.environment.props.well, -9, -21, { x: -8, y: -7, w: 16, h: 7 });

    obj('bench', 26, 12, G.environment.props.bench, -13, -11, { x: -12, y: -4, w: 24, h: 4 });

    obj('planter', 20, 30, G.environment.props.planter, -10, -29, { x: -8, y: -7, w: 16, h: 7 });

    obj('flowerbox', 16, 10, G.environment.props.flowerbox, -8, -9, { x: -8, y: -4, w: 16, h: 4 });

    obj('swing', 32, 30, (c) => { // качели у Академии (место Наруто)
      px(c, 2, 0, P.trunkDark, 28, 3); px(c, 2, 0, P.trunk, 28, 2);
      px(c, 2, 0, P.trunkDark, 3, 30); px(c, 27, 0, P.trunkDark, 3, 30);
      px(c, 11, 3, P.ink, 1, 18); px(c, 20, 3, P.ink, 1, 18);
      px(c, 9, 20, P.woodDark, 14, 3); px(c, 9, 20, P.wood, 14, 2);
    }, -16, -29, { x: -15, y: -4, w: 30, h: 4 });

    // ---------- Тренировки ----------
    obj('post', 12, 24, (c) => { // деревянный столб (полигон №3)
      outline(c, 2, 2, 8, 22, P.wood); px(c, 3, 3, '#c8945a', 2, 20);
      px(c, 2, 0, P.ink, 8, 3); px(c, 3, 1, '#d8a870', 6, 1);
      px(c, 3, 10, '#d8d0b0', 6, 3);
    }, -6, -23, { x: -5, y: -5, w: 10, h: 5 });

    obj('target', 16, 22, (c) => {
      px(c, 7, 12, '#5a3a24', 2, 10);
      blob(c, 8, 7, 6, P.ink); blob(c, 8, 7, 5, '#f4ecd8'); blob(c, 8, 7, 3, '#d84a3a'); blob(c, 8, 7, 1, '#f4ecd8');
    }, -8, -21, { x: -3, y: -3, w: 6, h: 3 });

    obj('dummy', 14, 24, (c) => { // соломенный манекен
      px(c, 6, 14, '#5a3a24', 2, 10); px(c, 0, 9, '#5a3a24', 14, 2);
      outline(c, 3, 6, 8, 12, '#d8c070'); px(c, 4, 9, '#b8a050', 6, 1); px(c, 4, 13, '#b8a050', 6, 1);
      blob(c, 7, 3, 3, P.ink); blob(c, 7, 3, 2, '#d8c070');
    }, -7, -23, { x: -4, y: -4, w: 8, h: 4 });

    obj('log', 28, 12, (c) => {
      outline(c, 0, 2, 28, 10, P.wood); px(c, 1, 3, '#c8945a', 26, 2);
      blob(c, 24, 7, 3, '#d8b07a'); px(c, 24, 7, '#8e5e34', 1, 1);
    }, -14, -11, { x: -14, y: -5, w: 28, h: 5 });

    obj('stump', 14, 10, (c) => {
      outline(c, 1, 3, 12, 7, P.wood); px(c, 1, 1, P.ink, 12, 4); px(c, 2, 2, '#d8b07a', 10, 2); px(c, 6, 2, '#8e5e34', 2, 1);
    }, -7, -9, { x: -6, y: -4, w: 12, h: 4 });

    obj('memorial', 26, 26, (c) => { // Мемориальный камень
      px(c, 1, 22, '#5a5a6a', 24, 4);
      outline(c, 5, 2, 16, 21, '#8a8a9a'); px(c, 6, 3, '#a8a8b8', 4, 18);
      for (let i = 0; i < 6; i++) px(c, 11, 5 + i * 3, '#5a5a6a', 7, 1);
      px(c, 3, 23, '#e84a6a', 2, 2); px(c, 21, 23, '#f0d040', 2, 2);
    }, -13, -25, { x: -10, y: -6, w: 20, h: 6 });

    // ---------- Мебель ----------
    obj('futon', 18, 30, G.environment.props.futon, -9, -29, { x: -9, y: -28, w: 18, h: 28 });

    obj('table', 32, 22, G.environment.props.table, -16, -21, { x: -14, y: -14, w: 28, h: 12 });

    obj('shelf', 16, 28, G.environment.props.shelf, -8, -27, { x: -8, y: -6, w: 16, h: 6 });

    obj('kitchen', 32, 28, G.environment.props.kitchen, -16, -27, { x: -16, y: -8, w: 32, h: 8 });

    obj('chest', 16, 14, G.environment.props.chest, -8, -13, { x: -8, y: -6, w: 16, h: 6 });

    obj('desk', 26, 18, G.environment.props.desk, -13, -17, { x: -12, y: -8, w: 24, h: 8 });

    obj('bigdesk', 48, 22, (c) => { // стол Хокаге с бумагами
      outline(c, 0, 4, 48, 14, '#7a4a2a'); px(c, 1, 5, '#9a5e34', 46, 3);
      for (let i = 0; i < 4; i++) { px(c, 4 + i * 4, 0 + (i % 2), '#f4ecd8', 6, 6); px(c, 4 + i * 4, 1 + (i % 2), '#d8cbb0', 6, 1); }
      px(c, 34, 2, '#c84a3a', 6, 5); px(c, 2, 18, '#5a3a24', 3, 4); px(c, 43, 18, '#5a3a24', 3, 4);
    }, -24, -21, { x: -24, y: -10, w: 48, h: 10 });

    obj('stool', 10, 10, G.environment.props.stool, -5, -9, { x: -3, y: -2, w: 6, h: 2 });

    obj('counter', 16, 20, G.environment.props.counter, -8, -19, { x: -8, y: -12, w: 16, h: 12 });

    obj('bed', 18, 30, G.environment.props.bed, -9, -29, { x: -9, y: -28, w: 18, h: 28 });

    obj('pillar', 14, 36, (c) => {
      outline(c, 2, 0, 10, 36, '#a8402a'); px(c, 3, 1, '#c85a3a', 3, 34); px(c, 0, 32, '#5a3a24', 14, 4);
    }, -7, -35, { x: -6, y: -5, w: 12, h: 5 });

    obj('plant', 14, 22, G.environment.props.plant, -7, -21, { x: -4, y: -4, w: 8, h: 4 });

    obj('flowerpot', 12, 16, G.environment.props.flowerpot, -6, -15, { x: -4, y: -3, w: 8, h: 3 });

    obj('rack', 26, 26, G.environment.props.rack, -13, -25, { x: -13, y: -5, w: 26, h: 5 });

    obj('screen', 24, 26, G.environment.props.screen, -12, -25, { x: -12, y: -4, w: 24, h: 4 });

    obj('cups', 16, 8, G.environment.props.cups, -8, -7, null, 'floor');

    // вещи на стене (рисуются под всеми, без коллизий)
    obj('blackboard', 64, 22, (c) => {
      outline(c, 0, 0, 64, 20, '#2e5a3a', '#7a4a2a'); px(c, 2, 2, '#3a6a46', 60, 1);
      G.font.draw(c, 'Хенге', 32, 3, { color: '#e8f0e0', align: 'center' });
      px(c, 8, 15, '#c8d8c0', 14, 1); px(c, 26, 15, '#c8d8c0', 8, 1); px(c, 38, 15, '#c8d8c0', 16, 1);
      px(c, 2, 20, '#7a4a2a', 60, 2); px(c, 50, 19, '#f4ecd8', 4, 1);
    }, -32, -21, null, 'floor');

    obj('window', 16, 12, G.environment.props.window, -8, -11, null, 'floor');

    obj('scroll', 10, 18, (c) => {
      px(c, 0, 0, '#5a3a24', 10, 2); px(c, 1, 2, '#f4ecd8', 8, 14); px(c, 0, 16, '#5a3a24', 10, 2);
      px(c, 3, 4, P.ink, 4, 1); px(c, 4, 6, P.ink, 2, 6); px(c, 3, 9, P.ink, 4, 1);
    }, -5, -17, null, 'floor');

    // Травы (сбор): растущая, срезанная, голубой лотос у воды
    obj('herb', 14, 12, (c) => {
      px(c, 6, 4, '#2e6a32', 2, 8); px(c, 2, 6, '#3e8a42', 4, 3); px(c, 8, 5, '#3e8a42', 4, 3); px(c, 4, 2, '#5aaa5a', 3, 3); px(c, 8, 1, '#5aaa5a', 3, 3);
      px(c, 5, 1, '#f0f0a0', 1, 1); px(c, 9, 0, '#f0f0a0', 1, 1); px(c, 3, 5, '#f8f4ec', 1, 1); px(c, 11, 4, '#f8f4ec', 1, 1);
    }, -7, -11, null);
    obj('herb_cut', 14, 12, (c) => { px(c, 5, 8, '#3e7a34', 1, 3); px(c, 7, 9, '#3e7a34', 1, 2); px(c, 9, 8, '#3e7a34', 1, 3); }, -7, -11, null);
    obj('herb_blue', 14, 12, (c) => {
      px(c, 2, 8, '#2e6a32', 10, 3); px(c, 6, 3, '#5a8ae8', 2, 6); px(c, 3, 4, '#7aa8f8', 3, 4); px(c, 8, 4, '#7aa8f8', 3, 4); px(c, 6, 2, '#b8d4ff', 2, 2); px(c, 6, 6, '#f0d040', 2, 1);
    }, -7, -11, null);

    obj('calendar', 12, 14, (c) => {
      outline(c, 0, 0, 12, 14, '#f4ecd8'); px(c, 1, 1, '#d84a3a', 10, 3);
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) px(c, 2 + x * 3, 6 + y * 3, '#8a7a6a', 2, 1);
    }, -6, -13, null, 'floor');

    obj('poster', 14, 16, (c) => { // плакат «Хокаге!» у Наруто
      outline(c, 0, 0, 14, 16, '#f0c040'); px(c, 3, 3, '#e8621a', 8, 8); px(c, 5, 5, '#f4ecd8', 4, 4);
    }, -7, -15, null, 'floor');

    // ---------- Разнообразие улиц (плотная застройка) ----------
    const TREEBOX = { x: -5, y: -6, w: 10, h: 6 };
    obj('sakura', 32, 40, (c) => { trunk(c); crown(c, ['#b85a7a', '#e88aa8', '#f4b0c8', '#ffe0ea'], 3); }, -16, -38, TREEBOX);
    obj('maple', 32, 40, (c) => { trunk(c); crown(c, ['#8a2a1a', '#d8502a', '#f08a3a', '#f8c060'], 5); }, -16, -38, TREEBOX);
    obj('ginkgo', 32, 40, (c) => { trunk(c); crown(c, ['#9a7a1a', '#d8b030', '#f0d050', '#fff0a0'], 7); }, -16, -38, TREEBOX);
    obj('bamboo', 18, 38, (c) => {
      for (const [x, h, col] of [[3, 34, '#5a9a3a'], [8, 37, '#6aaa4a'], [13, 32, '#4a8a2e']]) {
        px(c, x, 38 - h, col, 2, h); for (let y = 38 - h + 5; y < 38; y += 6) px(c, x, y, '#2e5a1e', 2, 1);
        px(c, x - 3, 38 - h + 2, '#3e8a34', 4, 1); px(c, x + 2, 38 - h + 6, '#3e8a34', 4, 1); px(c, x - 2, 38 - h + 10, '#5aaa4a', 3, 1);
      }
    }, -9, -37, { x: -7, y: -4, w: 14, h: 4 });
    obj('laundry', 32, 24, (c) => {
      px(c, 1, 2, '#5a3a24', 2, 22); px(c, 29, 2, '#5a3a24', 2, 22); px(c, 2, 4, '#c8c0b0', 28, 1);
      const cols = ['#f4f4f4', '#4a7ad0', '#d84a3a', '#f0c040', '#7ac04a'];
      for (let i = 0; i < 4; i++) { const x = 5 + i * 6; px(c, x, 5, cols[(i + 1) % 5], 5, 7 + (i % 2) * 3); px(c, x, 5, '#ffffff', 5, 1); }
    }, -16, -23, { x: -16, y: -3, w: 4, h: 3 });
    obj('woodpile', 18, 14, (c) => {
      for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - (r === 2 ? 1 : 0); k++) { const x = 1 + k * 4 + (r === 2 ? 2 : 0), y = 9 - r * 4; px(c, x, y, '#5a3a24', 4, 4); px(c, x + 1, y + 1, '#c8945a', 2, 2); }
    }, -9, -13, { x: -8, y: -5, w: 16, h: 5 });
    obj('pots', 16, 14, (c) => {
      for (const [x, h, f] of [[0, 4, '#e84a6a'], [6, 5, '#f0d040'], [11, 4, '#7ac04a']]) { px(c, x, 14 - h, '#a8583a', 5, h); px(c, x, 14 - h, '#c8703a', 5, 1); px(c, x, 6 - (h - 4), '#3e8a42', 5, 4); px(c, x + 1, 5 - (h - 4), f, 2, 2); }
    }, -8, -13, { x: -7, y: -4, w: 14, h: 4 });
    obj('raintank', 12, 18, (c) => { outline(c, 1, 3, 10, 15, '#4a7a9a'); px(c, 2, 4, '#6a9aba', 8, 2); px(c, 1, 9, '#2e4a6a', 10, 1); px(c, 3, 0, '#7a8088', 2, 4); }, -6, -17, { x: -5, y: -4, w: 10, h: 4 });
    obj('shrine', 18, 24, (c) => { // маленькое святилище хокора
      px(c, 3, 20, '#8a8a98', 12, 4); px(c, 4, 10, P.ink, 10, 11); px(c, 5, 11, '#a8703e', 8, 9); px(c, 7, 13, '#f4ecd8', 4, 5);
      px(c, 1, 6, P.ink, 16, 5); px(c, 2, 7, '#c8402a', 14, 3); px(c, 6, 4, P.ink, 6, 2);
      px(c, 2, 20, '#e84a3a', 1, 3); px(c, 15, 20, '#e84a3a', 1, 3);
    }, -9, -23, { x: -7, y: -5, w: 14, h: 5 }, null);
    obj('hedge', 16, 14, (c) => { px(c, 0, 3, P.leafDark, 16, 11); px(c, 0, 3, '#3e8a42', 16, 7); px(c, 0, 3, '#5aaa5a', 16, 1); for (let i = 0; i < 5; i++) px(c, 1 + i * 3, 5 + (i % 2) * 2, P.leaf, 2, 2); }, -8, -13, { x: -8, y: -5, w: 16, h: 5 });
    obj('bamboofence', 16, 16, (c) => { for (let x = 0; x < 16; x += 3) { px(c, x, 2, '#a89a5a', 2, 14); px(c, x, 2, '#d8c880', 1, 14); } px(c, 0, 5, '#5a4a2a', 16, 1); px(c, 0, 11, '#5a4a2a', 16, 1); }, -8, -15, { x: -8, y: -5, w: 16, h: 5 });
    obj('sacks', 16, 12, (c) => { for (const [x, y] of [[0, 4], [7, 4], [3, 0]]) { px(c, x + 1, y, '#8a7a5a', 7, 8); px(c, x, y + 2, '#8a7a5a', 9, 6); px(c, x + 1, y + 2, '#d8c8a0', 7, 5); px(c, x + 3, y + 1, '#6a5a3a', 3, 1); } }, -8, -11, { x: -7, y: -4, w: 14, h: 4 });
    obj('redlantern', 10, 26, (c) => { px(c, 4, 9, '#3a2a20', 2, 17); px(c, 2, 24, '#3a2a20', 6, 2); px(c, 1, 1, P.ink, 8, 9); px(c, 2, 2, '#d83a2a', 6, 7); px(c, 2, 4, '#f0c040', 6, 1); px(c, 3, 0, '#3a2a20', 4, 1); }, -5, -25, { x: -3, y: -3, w: 6, h: 3 });
    obj('banner', 10, 32, (c) => { px(c, 1, 0, '#5a3a24', 2, 32); px(c, 3, 2, P.ink, 7, 22); px(c, 4, 3, '#e8621a', 5, 20); px(c, 5, 6, '#f4ecd8', 3, 3); px(c, 5, 12, '#f4ecd8', 3, 1); px(c, 5, 15, '#f4ecd8', 3, 1); px(c, 3, 1, '#5a3a24', 7, 1); }, -2, -31, { x: -1, y: -3, w: 4, h: 3 });
    obj('bicycle', 22, 14, (c) => { for (const x of [4, 17]) { px(c, x - 3, 7, P.ink, 7, 1); px(c, x - 3, 13, P.ink, 7, 1); px(c, x - 4, 8, P.ink, 1, 5); px(c, x + 3, 8, P.ink, 1, 5); } px(c, 5, 6, '#c8402a', 11, 1); px(c, 8, 4, '#c8402a', 1, 6); px(c, 15, 3, '#c8402a', 1, 5); px(c, 6, 3, P.ink, 4, 1); px(c, 14, 2, P.ink, 3, 1); }, -11, -13, { x: -9, y: -3, w: 18, h: 3 });
    obj('watertower', 22, 40, (c) => { // бак на опорах — фирменный силуэт Конохи
      for (const x of [3, 17]) px(c, x, 16, '#5a5a6a', 2, 24); px(c, 5, 26, '#5a5a6a', 12, 1); px(c, 5, 34, '#5a5a6a', 12, 1);
      px(c, 1, 3, P.ink, 20, 15); px(c, 2, 4, '#b8c0c8', 18, 13); px(c, 2, 4, '#d8e0e8', 18, 3); px(c, 2, 12, '#98a0a8', 18, 1);
      px(c, 4, 0, P.ink, 14, 4); px(c, 5, 1, '#e8eef2', 12, 2);
    }, -11, -39, { x: -9, y: -4, w: 18, h: 4 });
    obj('pond', 32, 20, (c) => {
      px(c, 3, 2, '#7a7a88', 26, 17); px(c, 1, 5, '#7a7a88', 30, 11);
      px(c, 4, 3, '#2a6aa8', 24, 15); px(c, 2, 6, '#2a6aa8', 28, 9); px(c, 5, 4, '#4a8ac8', 10, 1);
      px(c, 9, 9, '#f08a3a', 4, 2); px(c, 19, 12, '#f4ecd8', 4, 2); px(c, 20, 12, '#e84a3a', 2, 1); px(c, 24, 6, '#3e8a42', 3, 3);
    }, -16, -19, { x: -15, y: -15, w: 30, h: 15 });
    obj('tallgrass', 14, 10, (c) => { for (let i = 0; i < 6; i++) { const x = 1 + i * 2; px(c, x, 3 + (i % 3), i % 2 ? '#3e7a34' : '#5aa046', 1, 7 - (i % 3)); } }, -7, -9, null);
    obj('flowerbed', 16, 8, (c) => { px(c, 0, 2, '#5a3a24', 16, 6); px(c, 1, 3, '#7a5034', 14, 4); for (let i = 0; i < 5; i++) { px(c, 2 + i * 3, 2, '#3e8a42', 1, 3); px(c, 1 + i * 3, 1, ['#e84a6a', '#f0d040', '#f4ecd8', '#a86ae8', '#ff8a3a'][i], 2, 2); } }, -8, -7, null);
    obj('mailbox', 8, 18, (c) => { px(c, 3, 8, '#3a2a20', 2, 10); outline(c, 0, 1, 8, 8, '#c8402a'); px(c, 2, 4, P.ink, 4, 1); }, -4, -17, { x: -2, y: -2, w: 4, h: 2 });

    // ---------- Больше природы: цветы, кусты, камни ----------
    const FLOWER_COLS = { red: ['#e8344a', '#ff8a96'], yellow: ['#f4d03a', '#fff08a'], white: ['#f4f4ee', '#ffffff'], blue: ['#4a7ae0', '#a0c4ff'], pink: ['#f08ab8', '#ffc4de'], purple: ['#9a5ac8', '#d4a8f4'], orange: ['#f08a2a', '#ffc870'] };
    for (const [k, [col, hi]] of Object.entries(FLOWER_COLS)) {
      obj('fl_' + k, 12, 10, (c) => {
        px(c, 1, 8, '#2e7a3a', 10, 2); px(c, 2, 7, '#4a9a4a', 3, 1); px(c, 7, 7, '#4a9a4a', 3, 1);
        [[2, 4], [6, 2], [9, 5], [4, 6]].forEach(([x, y], i) => {
          px(c, x, y + 2, '#3e8a42', 1, 6 - y);
          px(c, x - 1, y, col, 3, 1); px(c, x, y - 1, col, 1, 3); px(c, x, y, i % 2 ? '#f4d03a' : hi);
        });
      }, -6, -9, null);
    }
    obj('lavender', 10, 12, (c) => { for (let i = 0; i < 4; i++) { px(c, 1 + i * 2, 5, '#4a8a4a', 1, 7); px(c, 1 + i * 2, 1 + (i % 2), i % 2 ? '#8a5ac8' : '#a67ae0', 1, 4); } }, -5, -11, null);
    obj('sunflower', 10, 22, (c) => { px(c, 4, 8, '#3e8a42', 2, 14); px(c, 1, 14, '#4a9a4a', 3, 2); px(c, 6, 11, '#4a9a4a', 3, 2); blob(c, 5, 5, 4, '#f4c42a'); blob(c, 5, 5, 2, '#6a4a1a'); }, -5, -21, null);
    const BCOL = { pink: ['#f088b4', '#ffd0e4'], white: ['#f4f4f0', '#ffffff'], red: ['#e04a5a', '#ff9aa4'], yellow: ['#f0cc3a', '#fff29a'] };
    for (const [k, [col, hi]] of Object.entries(BCOL)) {
      obj('bush_' + k, 18, 14, (c) => {
        c.fillStyle = P.leafDark; c.fillRect(1, 5, 16, 9); c.fillRect(3, 2, 12, 12);
        c.fillStyle = P.leaf; c.fillRect(2, 5, 14, 7); c.fillRect(4, 3, 10, 9);
        for (let i = 0; i < 9; i++) { const x = 3 + Math.floor(H(i, k.length, 71) * 12), y = 3 + Math.floor(H(k.length, i, 72) * 8); px(c, x, y, col); px(c, x + 1, y, hi); }
      }, -9, -13, { x: -8, y: -6, w: 16, h: 6 });
    }
    obj('bush3', 14, 13, (c) => {
      blob(c, 7, 7, 6, P.leafDark); blob(c, 7, 6, 5, P.leaf); blob(c, 5, 4, 2, '#5aaa5a'); px(c, 9, 7, '#3a8a46', 3, 1);
    }, -7, -12, { x: -6, y: -5, w: 12, h: 5 });
    obj('shrub', 10, 8, (c) => { blob(c, 5, 4, 3, P.leafDark); blob(c, 5, 4, 2, P.leaf); px(c, 4, 2, '#5aaa5a', 2, 1); }, -5, -7, null);
    obj('fern', 12, 10, (c) => { for (let i = 0; i < 5; i++) { const a = i - 2; px(c, 6 + a, 9 - Math.abs(a) * 1, '#2e7a3a'); for (let j = 0; j < 7 - Math.abs(a) * 1; j++) px(c, 6 + a + Math.round(a * j * 0.5), 8 - j, j % 2 ? '#3e9a4a' : '#2e7a3a'); } }, -6, -9, null);
    obj('mushroom', 8, 8, (c) => { px(c, 3, 4, '#f4ecd8', 2, 3); blob(c, 4, 3, 2, '#d83a3a'); px(c, 3, 2, '#ffffff'); px(c, 5, 3, '#ffffff'); px(c, 0, 6, '#f4ecd8', 2, 2); px(c, 0, 5, '#b8803a', 2, 1); }, -4, -7, null);
    obj('pebbles', 12, 6, (c) => { [[1, 3, 3], [5, 1, 2], [8, 3, 3], [4, 4, 2]].forEach(([x, y, w], i) => { px(c, x, y, i % 2 ? '#8a8a96' : '#a8a8b4', w, 2); px(c, x, y + 2, '#6a6a76', w, 1); px(c, x, y, '#c8c8d4', 1, 1); }); }, -6, -5, null);
    obj('rock3', 12, 9, (c) => { c.fillStyle = P.stoneDark; c.fillRect(1, 3, 10, 6); c.fillRect(3, 1, 6, 8); c.fillStyle = P.stone; c.fillRect(2, 3, 7, 4); c.fillRect(4, 1, 4, 5); px(c, 4, 2, '#d0d0dc', 2, 1); }, -6, -8, { x: -5, y: -4, w: 10, h: 4 });
    obj('rock2', 22, 16, (c) => {
      c.fillStyle = P.stoneDark; c.fillRect(1, 5, 20, 11); c.fillRect(4, 2, 14, 14); c.fillRect(8, 0, 7, 8);
      c.fillStyle = P.stone; c.fillRect(2, 5, 16, 7); c.fillRect(5, 2, 10, 9); c.fillRect(9, 0, 4, 6);
      px(c, 6, 3, '#d0d0dc', 4, 1); px(c, 3, 6, '#c8c8d4', 3, 1);
      px(c, 12, 12, '#4a8a3c', 5, 2); px(c, 3, 13, '#4a8a3c', 4, 2); px(c, 10, 11, '#6aaa4a', 2, 1);   // мох
    }, -11, -15, { x: -10, y: -7, w: 20, h: 7 });
    obj('reeds', 10, 18, (c) => { for (let i = 0; i < 4; i++) { px(c, 1 + i * 2, 4 + (i % 2) * 2, '#4a8a4a', 1, 14 - (i % 2) * 2); if (i % 2 === 0) { px(c, 1 + i * 2, 1 + i, '#6a4a2a', 1, 4); } } px(c, 0, 16, '#2e6a32', 10, 2); }, -5, -17, null);
    obj('leafpile', 12, 6, (c) => { for (let i = 0; i < 9; i++) px(c, 1 + Math.floor(H(i, 5, 81) * 9), 1 + Math.floor(H(5, i, 82) * 4), ['#d8783a', '#e8a83a', '#b84a2a', '#c8601a'][i % 4], 2, 1); }, -6, -5, null);

    // ---------- Больше мебели и декора для интерьеров ----------
    obj('cushion', 14, 8, G.environment.props.cushion, -7, -7, null, 'floor');
    obj('cushion_b', 14, 8, G.environment.props.cushion_b, -7, -7, null, 'floor');
    obj('lowtable', 28, 16, G.environment.props.lowtable, -14, -15, { x: -13, y: -7, w: 26, h: 7 });
    obj('tansu', 20, 30, G.environment.props.tansu, -10, -29, { x: -10, y: -6, w: 20, h: 6 });
    obj('andon', 12, 22, G.environment.props.andon, -6, -21, { x: -4, y: -3, w: 8, h: 3 });
    obj('vase', 10, 18, G.environment.props.vase, -5, -17, { x: -3, y: -3, w: 6, h: 3 });
    obj('bonsai', 14, 18, G.environment.props.bonsai, -7, -17, { x: -4, y: -3, w: 8, h: 3 });
    obj('cat', 14, 12, (c) => { // кошка (сидит)
      blob(c, 7, 8, 3, '#e8a860'); px(c, 4, 9, '#e8a860', 7, 3); blob(c, 7, 4, 3, '#e8a860'); px(c, 4, 1, '#e8a860', 2, 2); px(c, 9, 1, '#e8a860', 2, 2);
      px(c, 5, 4, '#2a1e18'); px(c, 9, 4, '#2a1e18'); px(c, 7, 5, '#f08a8a'); px(c, 3, 9, '#c8803a', 1, 3); px(c, 11, 9, '#e8a860', 3, 1); px(c, 6, 7, '#c8803a', 2, 1);
    }, -7, -11, null);
    obj('bookpile', 12, 10, (c) => { px(c, 1, 6, P.ink, 10, 4); px(c, 2, 7, '#c84a3a', 8, 2); px(c, 2, 3, P.ink, 8, 4); px(c, 3, 4, '#4a7ac8', 6, 2); px(c, 3, 1, P.ink, 6, 3); px(c, 4, 2, '#e8c040', 4, 1); }, -6, -9, { x: -5, y: -3, w: 10, h: 3 });
    obj('basket', 12, 12, (c) => { outline(c, 1, 5, 10, 7, '#c8a050'); for (let i = 0; i < 4; i++) px(c, 2, 6 + i * 2, '#a07830', 8, 1); px(c, 2, 2, '#c8a050', 1, 4); px(c, 9, 2, '#c8a050', 1, 4); px(c, 2, 2, '#c8a050', 8, 1); px(c, 4, 4, '#d84a3a', 3, 2); px(c, 7, 4, '#7ac04a', 2, 2); }, -6, -11, { x: -5, y: -3, w: 10, h: 3 });
    obj('shoes', 12, 6, (c) => { px(c, 1, 2, '#5a3a24', 4, 3); px(c, 2, 1, '#8a5a34', 2, 1); px(c, 7, 3, '#3a3a4a', 4, 2); px(c, 7, 2, '#5a5a6a', 2, 1); }, -6, -5, null, 'floor');
    obj('hibachi', 16, 14, (c) => { outline(c, 1, 4, 14, 10, '#6a4a30'); px(c, 3, 5, '#3a2a20', 10, 3); px(c, 5, 5, '#f08a2a', 2, 1); px(c, 9, 6, '#e84a2a', 2, 1); px(c, 2, 12, '#4a3220', 12, 2); }, -8, -13, { x: -7, y: -4, w: 14, h: 4 });
    obj('wardrobe', 20, 32, G.environment.props.wardrobe, -10, -31, { x: -10, y: -6, w: 20, h: 6 });
    obj('rug_red', 32, 20, G.environment.props.rug_red, -16, -19, null, 'floor');
    obj('rug_blue', 32, 20, G.environment.props.rug_blue, -16, -19, null, 'floor');
    obj('rug_round', 26, 18, (c) => { blob(c, 13, 9, 9, '#4a2a18'); blob(c, 13, 9, 8, '#e8c878'); blob(c, 13, 9, 6, '#a84a3a'); blob(c, 13, 9, 3, '#e8c878'); }, -13, -17, null, 'floor');
    // на стену
    obj('painting', 16, 14, (c) => { outline(c, 0, 0, 16, 14, '#e8dcc0', '#5a3a24'); px(c, 2, 2, '#9ac8e8', 12, 5); px(c, 2, 7, '#6aa05a', 12, 5); px(c, 9, 3, '#f4ecd8', 3, 3); px(c, 3, 8, '#4a8a3a', 4, 3); }, -8, -13, null, 'floor');
    obj('mirror', 12, 20, (c) => { outline(c, 0, 0, 12, 20, '#c8a050', '#5a3a24'); px(c, 2, 2, '#c8e0f0', 8, 16); px(c, 3, 3, '#f0f8ff', 2, 6); }, -6, -19, null, 'floor');
    obj('wallshelf', 20, 12, (c) => { px(c, 0, 6, '#5a3a24', 20, 3); px(c, 1, 7, '#8a5a34', 18, 1); px(c, 3, 1, '#f4ecd8', 4, 5); px(c, 9, 3, '#c8402a', 3, 3); px(c, 14, 2, '#4a7ac8', 3, 4); px(c, 2, 9, '#3a2418', 2, 3); px(c, 16, 9, '#3a2418', 2, 3); }, -10, -11, null, 'floor');
    obj('chochin', 10, 16, (c) => { px(c, 4, 0, P.ink, 2, 3); outline(c, 1, 3, 8, 10, '#e84a3a', '#5a3a24'); px(c, 2, 5, '#ff8a6a', 6, 1); px(c, 4, 7, '#f4ecd8', 2, 3); px(c, 3, 13, P.ink, 4, 1); px(c, 4, 14, '#c8402a', 2, 2); }, -5, -15, null, 'floor');

    obj('emblem', 16, 16, (c) => { // знак Листа на стене
      blob(c, 8, 8, 7, '#5a3a24'); blob(c, 8, 8, 6, '#e8c040');
      px(c, 5, 6, '#5a3a24', 6, 1); px(c, 8, 6, '#5a3a24', 1, 5); px(c, 6, 10, '#5a3a24', 4, 1); px(c, 10, 4, '#5a3a24', 1, 3);
    }, -8, -15, null, 'floor');
  }

  function object(name, variation=0) {
    if (!OBJ.tree) buildObjects();
    const base=OBJ[name];
    return base?.variants?base.variants[Math.floor(variation*base.variants.length)%base.variants.length]:base;
  }

  return { ID, COUNT, SOLID, GRASSY, ROADY, MAPCOL, drawTile, renderTile, waterOverlay, object };
})();
