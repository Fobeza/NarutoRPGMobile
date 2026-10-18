// Тайлы и объекты окружения, нарисованные кодом (без картинок).
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
    [ID.GRASS]: '#5aa046', [ID.GRASS2]: '#5aa046', [ID.FLOWERS]: '#6aac50', [ID.PATH]: '#e0c48a',
    [ID.WATER]: '#3a8ad0', [ID.SAND]: '#e8d4a0', [ID.PLANKS]: '#a8683a', [ID.STONE]: '#c8c0b0',
    [ID.DARKGRASS]: '#3e7a34', [ID.DIRT]: '#b8946a', [ID.CLIFF]: '#7a6a5a', [ID.CLIFFTOP]: '#2e5a2e',
    [ID.VWALL]: '#6a5a4a', [ID.MAINROAD]: '#d8c8a0', [ID.DARKSTONE]: '#5a5468',
    [ID.COBBLE]: '#b8ae9c', [ID.BRICK]: '#c08a68', [ID.GRAVEL]: '#a8a090', [ID.CLOVER]: '#58a048', [ID.STEPS]: '#5aa046',
    [ID.PLAZA]: '#d8d0c0', [ID.MOSS]: '#4a8a3c',
  };

  let atlas = null;

  // V8, волна 5: бесшовные текстуры поверхностей 64×64 из ассетов. Текстура семплится
  // кусками 16×16 по клеткам ((tx%4, ty%4)) — период 64 px, швов нет по построению.
  // Нет текстуры или ассеты выключены (?assets=0) — работаем процедурным атласом, как раньше.
  // Текстурами закрыты структурные поверхности (полы, стены, камень, мощение):
  // у них зеркальная бесшовность не читается. Трава/цветы/мох, дорога, тропа и земля
  // остаются процедурными: там зеркальность видна «бабочкой», а дорога с листа
  // вышла перспективной вместо плоской.
  const TEXID = {
    FLOOR: 'tex_floor', PLANKS: 'tex_planks', TATAMI: 'tex_tatami', MAT: 'tex_mat',
    TILEFLOOR: 'tex_tilefloor', DUSTFLOOR: 'tex_dustfloor',
    SAND: 'tex_sand', STONE: 'tex_stone', DARKSTONE: 'tex_darkstone',
    COBBLE: 'tex_cobble', BRICK: 'tex_brick', GRAVEL: 'tex_gravel',
    IWALL: 'tex_iwall', VWALL: 'tex_vwall',
  };
  const TEXBYID = {};
  for (const k of Object.keys(TEXID)) TEXBYID[ID[k]] = TEXID[k];
  let texc = null;
  function texCanvas(id) {
    const aid = TEXBYID[id];
    if (!aid || !G.assets || !G.assets.ready(aid)) return null;
    if (!texc) texc = {};
    if (!texc[id]) {
      const cv = G.gfx.canvas(64, 64, true);   // lo: 1× — семплирование texBlit идёт в логических px
      cv.getContext('2d').drawImage(G.assets.img(aid), 0, 0, 64, 64);
      texc[id] = cv;
    }
    return texc[id];
  }
  function texBlit(ctx, id, x, y, gx, gy) {
    const tc = texCanvas(id);
    if (!tc) return false;
    ctx.drawImage(tc, ((gx % 4) + 4) % 4 * T, ((gy % 4) + 4) % 4 * T, T, T, x, y, T, T);
    return true;
  }

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

  function path(c, ox, oy) {
    px(c, ox, oy, '#e0c48a', T, T);
    dots(c, ox, oy, 14, 5, [P.pathDark, '#c8a46a', P.pathLight]);
    px(c, ox + 4, oy + 9, P.pathDark, 2, 1); px(c, ox + 11, oy + 3, P.pathDark, 2, 1);
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
  function stone(c, ox, oy, base = '#cfc6b4', line = '#a89e8a', hi = '#e2dacb') {
    px(c, ox, oy, base, T, T);
    px(c, ox, oy + 7, line, T, 1); px(c, ox, oy + 15, line, T, 1);
    px(c, ox + 7, oy, line, 1, 7); px(c, ox + 15, oy, line, 1, 7);
    px(c, ox + 3, oy + 8, line, 1, 7); px(c, ox + 11, oy + 8, line, 1, 7);
    px(c, ox + 1, oy + 1, hi, 3, 1); px(c, ox + 9, oy + 9, hi, 2, 1);
  }

  // главная улица: крупные плиты
  function mainroad(c, ox, oy) {
    px(c, ox, oy, '#d8c8a0', T, T);
    px(c, ox, oy + 15, '#b8a47a', T, 1); px(c, ox + 15, oy, '#b8a47a', 1, T);
    px(c, ox, oy, '#e8dab8', T, 1); px(c, ox, oy, '#e8dab8', 1, T);
    dots(c, ox, oy, 6, 21, ['#c4b48a', '#c4b48a', '#e4d6b0']);
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
    px(c, ox, oy, '#b8804a', T, T);
    for (let y = 0; y < 16; y += 4) px(c, ox, oy + y + 3, '#8e5e34', T, 1);
    px(c, ox + 6, oy, '#8e5e34', 1, 3); px(c, ox + 13, oy + 4, '#8e5e34', 1, 3);
    px(c, ox + 2, oy + 8, '#8e5e34', 1, 3); px(c, ox + 10, oy + 12, '#8e5e34', 1, 3);
    px(c, ox + 1, oy + 1, '#c8925a', 4, 1); px(c, ox + 8, oy + 9, '#c8925a', 4, 1);
  }

  function tatami(c, ox, oy) {
    px(c, ox, oy, '#c8c070', T, T);
    for (let y = 1; y < 16; y += 2) px(c, ox, oy + y, '#b8b062', T, 1);
    px(c, ox, oy, '#5a6a3a', T, 1); px(c, ox, oy + 15, '#5a6a3a', T, 1);
    px(c, ox, oy, '#5a6a3a', 1, T);
  }

  function iwall(c, ox, oy) {
    px(c, ox, oy, '#e8dcc0', T, T);
    px(c, ox, oy, '#cfc0a0', T, 1);
    px(c, ox + 7, oy, '#d8caa8', 1, T);
  }

  function voidT(c, ox, oy) { px(c, ox, oy, '#2a1e18', T, T); px(c, ox, oy, '#3a2a20', T, 2); }

  function mat(c, ox, oy) {
    floor(c, ox, oy);
    px(c, ox + 1, oy + 3, '#7a3a2a', 14, 12); px(c, ox + 2, oy + 4, '#a84a3a', 12, 10);
    px(c, ox + 3, oy + 6, '#c86a4a', 10, 1); px(c, ox + 3, oy + 11, '#c86a4a', 10, 1);
  }

  function tilefloor(c, ox, oy) {
    px(c, ox, oy, '#e8eef0', T, T);
    px(c, ox, oy + 7, '#c8d0d8', T, 1); px(c, ox, oy + 15, '#c8d0d8', T, 1);
    px(c, ox + 7, oy, '#c8d0d8', 1, T); px(c, ox + 15, oy, '#c8d0d8', 1, T);
  }

  function dustfloor(c, ox, oy) {
    px(c, ox, oy, '#6e5a48', T, T);
    for (let y = 0; y < 16; y += 4) px(c, ox, oy + y + 3, '#5a4838', T, 1);
    dots(c, ox, oy, 10, 44, ['#8a7a6a', '#4a3a2e']);
  }

  function rug(c, ox, oy) {
    px(c, ox, oy, '#a83a2a', T, T);
    px(c, ox + 1, oy, '#d8a83a', 1, T); px(c, ox + 14, oy, '#d8a83a', 1, T);
    px(c, ox + 3, oy, '#8a2a1e', 1, T); px(c, ox + 12, oy, '#8a2a1e', 1, T);
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
    px(c, ox, oy, '#d8d0c0', T, T);
    px(c, ox, oy + 15, '#b0a898', T, 1); px(c, ox + 15, oy, '#b0a898', 1, T);
    px(c, ox, oy, '#e8e2d4', T, 1); px(c, ox, oy, '#e8e2d4', 1, T);
    for (let i = 0; i < 5; i++) { px(c, ox + 7 - i, oy + 3 + i, '#c4bcac'); px(c, ox + 8 + i, oy + 3 + i, '#c4bcac'); px(c, ox + 7 - i, oy + 12 - i, '#c4bcac'); px(c, ox + 8 + i, oy + 12 - i, '#c4bcac'); }
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
    add(ID.PATH, (x, y) => { path(c, x, y); px(c, x + 3, y + 3, '#b89a6a', 2, 2); px(c, x + 10, y + 11, '#b89a6a', 2, 1); px(c, x + 12, y + 7, '#f0dcaa', 1, 1); });
    add(ID.PATH, (x, y) => { path(c, x, y); px(c, x + 5, y + 4, '#c8a46a', 2, 3); px(c, x + 9, y + 10, '#c8a46a', 2, 3); });
    add(ID.MAINROAD, (x, y) => { mainroad(c, x, y); px(c, x + 4, y + 5, '#b8a47a', 1, 4); px(c, x + 5, y + 8, '#b8a47a', 3, 1); });
    add(ID.MAINROAD, (x, y) => { mainroad(c, x, y); px(c, x + 3, y + 3, '#8a8478', 10, 10); px(c, x + 4, y + 4, '#a8a294', 8, 8); for (let i = 0; i < 3; i++) px(c, x + 5, y + 5 + i * 3, '#8a8478', 6, 1); });
    add(ID.DIRT, (x, y) => { dirt(c, x, y); px(c, x + 6, y + 7, '#8a6a4a', 3, 2); px(c, x + 7, y + 6, '#c8a47a', 1, 1); });
    add(ID.COBBLE, (x, y) => cobble(c, x, y, '#a89e88', '#c4baa4', '#7e7462', '#6a9a4a'));
    add(ID.COBBLE, (x, y) => cobble(c, x, y, '#b8ae98', '#d6ccb6', '#928874'));
    add(ID.GRAVEL, (x, y) => gravel(c, x, y, 82));
    add(ID.PLAZA, (x, y) => { plaza(c, x, y); px(c, x + 2, y + 2, '#b0a898', 1, 3); });
    add(ID.DARKSTONE, (x, y) => { darkstone(c, x, y); px(c, x + 9, y + 3, '#4e7a3a', 2, 1); px(c, x + 2, y + 12, '#4e7a3a', 1, 2); });
    return col;
  }

  function build() {
    atlas = G.gfx.canvas(T * COUNT, T * 2, true);   // lo: 1× — drawImage(atlas, …) берёт источник в логических px
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
  }

  // Простой тайл без учёта соседей
  function drawTile(ctx, id, x, y, tx, ty) {
    if (!atlas) build();
    const gx = tx === undefined ? Math.floor(x / T) : tx;
    const gy = ty === undefined ? Math.floor(y / T) : ty;
    if (texBlit(ctx, id, x, y, gx, gy)) return;
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
    if (texCanvas(id)) return;   // текстуры не смешиваем с процедурными кромками
    const nbs = [[0, -1, 0], [0, 1, 1], [-1, 0, 2], [1, 0, 3]];
    const got = [0, 0, 0, 0];
    for (const [dx, dy, side] of nbs) {
      const nb = map.get(tx + dx, ty + dy), rn = RANK[nb];
      if (!rn || rn <= r || nb === id || texCanvas(nb)) continue;
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
    if (!texBlit(ctx, id, x, y, tx, ty)) {
      if (hv < VAR_P) ctx.drawImage(atlas, vs[Math.floor(hv / VAR_P * vs.length)] * T, T, T, T, x, y, T, T);
      else ctx.drawImage(atlas, id * T, 0, T, T, x, y, T, T);
    }
    const up = map.get(tx, ty - 1), dn = map.get(tx, ty + 1), lf = map.get(tx - 1, ty), rt = map.get(tx + 1, ty);
    const hh = (i, s) => H(tx * 16 + i, ty, s);

    // крупные пятна света и тени: земля перестаёт быть однотонной заливкой
    if (map.outdoor && G.mapgen && (GRASSY.has(id) || ROADY.has(id))) {
      const grass = GRASSY.has(id);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const n = G.mapgen.noise(tx * 4 + i, ty * 4 + j, 77, grass ? 9 : 5);
        if (n > 0.6) { ctx.globalAlpha = Math.min(grass ? 0.2 : 0.1, (n - 0.6) * 0.7); ctx.fillStyle = grass ? '#e6f59a' : '#fff4d0'; ctx.fillRect(x + i * 4, y + j * 4, 4, 4); }
        else if (n < 0.34) { ctx.globalAlpha = Math.min(grass ? 0.2 : 0.1, (0.34 - n) * 0.7); ctx.fillStyle = grass ? '#12402a' : '#6a4a2a'; ctx.fillRect(x + i * 4, y + j * 4, 4, 4); }
      }
      ctx.globalAlpha = 1;
      if (grass && hh(1, 91) > 0.82) { // одиночные цветочки и камешки
        const fx = 2 + Math.floor(hh(2, 92) * 12), fy = 2 + Math.floor(hh(3, 93) * 12), r = hh(4, 94);
        if (r > 0.55) { const col = r > 0.85 ? '#ffffff' : r > 0.7 ? '#ffd84a' : '#f4a0c0'; px(ctx, x + fx, y + fy, col); px(ctx, x + fx, y + fy + 1, '#3e8a42'); }
        else { px(ctx, x + fx, y + fy, '#8a8a8a'); px(ctx, x + fx + 1, y + fy, '#b8b8b8'); }
      }
    }
    // плавные переходы: более «живая» поверхность соседа заходит рваным краем с дизерингом
    blendEdges(ctx, map, tx, ty, x, y, id);
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
    // стена интерьера: верхняя часть — балка, нижняя — панель
    if (id === ID.IWALL) {
      if (up !== ID.IWALL) { px(ctx, x, y, '#5a3a24', 16, 4); px(ctx, x, y + 4, '#3a2416', 16, 1); }
      else { px(ctx, x, y + 9, '#8e5e34', 16, 7); px(ctx, x, y + 9, '#a8703e', 16, 1); px(ctx, x, y + 15, '#5a3a24', 16, 1); }
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
    drawFn(c.getContext('2d'));
    G.gfx.smooth(c);
    OBJ[name] = { img: c, ox, oy, box, layer: layer || null, w, h };
  }
  const blob = (c, x, y, r, col) => {
    c.fillStyle = col;
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++)
      if (xx * xx + yy * yy <= r * r + r * 0.6) c.fillRect(x + xx, y + yy, 1, 1);
  };
  const outline = (c, x, y, w, h, fill, line = P.ink) => { px(c, x, y, line, w, h); px(c, x + 1, y + 1, fill, w - 2, h - 2); };

  function buildObjects() {
    // ---------- Природа ----------
    obj('tree', 32, 40, (c) => {
      px(c, 13, 26, P.trunkDark, 6, 12); px(c, 14, 26, P.trunk, 3, 12);
      px(c, 10, 37, P.trunkDark, 12, 2);
      blob(c, 16, 16, 13, P.leafDark);
      blob(c, 16, 14, 12, P.leaf);
      blob(c, 11, 10, 6, '#3e8a42'); blob(c, 21, 12, 5, '#3e8a42');
      blob(c, 10, 8, 2, '#5aaa5a'); blob(c, 20, 9, 2, '#5aaa5a'); blob(c, 15, 18, 2, '#5aaa5a');
      for (let i = 0; i < 18; i++) px(c, 5 + Math.floor(H(i, 1, 11) * 22), 4 + Math.floor(H(1, i, 12) * 22), P.leafDark);
    }, -16, -38, { x: -5, y: -6, w: 10, h: 6 });

    // Хвойное дерево (для леса Нара)
    obj('pine', 24, 40, (c) => {
      px(c, 10, 30, P.trunkDark, 4, 9); px(c, 11, 30, P.trunk, 2, 9);
      for (let i = 0; i < 4; i++) {
        const y = 2 + i * 7, w = 8 + i * 4;
        for (let r = 0; r < 9; r++) {
          const ww = Math.round(w * (r + 1) / 9);
          px(c, 12 - ww, y + r, P.leafDark, ww * 2, 1);
          if (r < 7) px(c, 12 - ww + 1, y + r, i % 2 ? P.leaf : '#2e7a3a', ww * 2 - 3, 1);
        }
      }
      px(c, 11, 2, '#5aaa5a', 1, 3);
    }, -12, -38, { x: -4, y: -5, w: 8, h: 5 });

    obj('bush', 16, 14, (c) => {
      c.fillStyle = P.leafDark; c.fillRect(1, 4, 14, 10); c.fillRect(3, 2, 10, 12);
      c.fillStyle = P.leaf; c.fillRect(2, 4, 12, 8); c.fillRect(4, 2, 8, 9);
      px(c, 5, 4, '#5aaa5a', 2, 1); px(c, 10, 6, '#5aaa5a', 2, 1);
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
    obj('sign', 16, 18, (c) => {
      px(c, 7, 9, P.trunkDark, 2, 9);
      px(c, 1, 1, P.woodDark, 14, 9); px(c, 2, 2, P.wood, 12, 7);
      px(c, 4, 4, P.woodDark, 8, 1); px(c, 4, 6, P.woodDark, 6, 1);
    }, -8, -17, { x: -6, y: -4, w: 12, h: 4 });

    obj('fence', 16, 14, (c) => {
      px(c, 0, 4, P.woodDark, 16, 3); px(c, 0, 9, P.woodDark, 16, 3);
      px(c, 0, 4, P.wood, 16, 2); px(c, 0, 9, P.wood, 16, 2);
      px(c, 2, 1, P.woodDark, 3, 13); px(c, 11, 1, P.woodDark, 3, 13);
      px(c, 2, 1, P.wood, 2, 12); px(c, 11, 1, P.wood, 2, 12);
    }, -8, -13, { x: -8, y: -5, w: 16, h: 5 });

    // Забор клана (белая штукатурка, тёмная черепица) — горизонтальный сегмент
    obj('clanwall', 16, 20, (c) => {
      px(c, 0, 6, '#e8e0d0', 16, 14); px(c, 0, 18, '#a89e8a', 16, 2);
      px(c, 0, 2, '#3a3a4a', 16, 5); px(c, 0, 2, '#5a5a6a', 16, 1); px(c, 0, 6, '#2a2a3a', 16, 1);
      px(c, 0, 9, '#d0c8b8', 16, 1);
    }, -8, -19, { x: -8, y: -6, w: 16, h: 6 });

    obj('lamp', 12, 30, (c) => { // фонарь на столбе с бумажным абажуром
      px(c, 5, 10, '#3a2a20', 2, 19); px(c, 3, 28, '#3a2a20', 6, 2);
      px(c, 2, 1, P.ink, 8, 10); px(c, 3, 2, '#f0e0b0', 6, 8); px(c, 3, 4, '#e8c878', 6, 1); px(c, 3, 7, '#e8c878', 6, 1);
      px(c, 4, 0, '#3a2a20', 4, 1); px(c, 4, 10, '#3a2a20', 4, 1);
    }, -6, -29, { x: -3, y: -3, w: 6, h: 3 });

    obj('stonelamp', 14, 22, (c) => { // каменный фонарь торо
      px(c, 2, 20, '#6a6a7a', 10, 2); px(c, 5, 12, '#8a8a98', 4, 8);
      px(c, 3, 7, '#8a8a98', 8, 5); px(c, 5, 8, '#f0d070', 4, 3);
      px(c, 1, 4, '#6a6a7a', 12, 3); px(c, 4, 1, '#6a6a7a', 6, 3); px(c, 6, 0, '#6a6a7a', 2, 1);
    }, -7, -21, { x: -5, y: -4, w: 10, h: 4 });

    obj('barrel', 12, 16, (c) => {
      outline(c, 1, 2, 10, 14, P.wood); px(c, 1, 5, P.woodDark, 10, 1); px(c, 1, 11, P.woodDark, 10, 1);
      px(c, 2, 0, P.ink, 8, 3); px(c, 3, 1, '#7a5a3a', 6, 1);
    }, -6, -15, { x: -5, y: -4, w: 10, h: 4 });

    obj('crate', 14, 14, (c) => {
      outline(c, 0, 0, 14, 14, '#c8945a'); px(c, 1, 6, '#8e5e34', 12, 1); px(c, 6, 1, '#8e5e34', 1, 12);
      px(c, 2, 2, '#e0b07a', 3, 1);
    }, -7, -13, { x: -7, y: -6, w: 14, h: 6 });

    obj('stall', 32, 28, (c) => { // уличный лоток с полосатым навесом
      px(c, 2, 8, '#3a2a20', 2, 20); px(c, 28, 8, '#3a2a20', 2, 20);
      outline(c, 1, 16, 30, 10, P.wood); px(c, 2, 17, '#c8945a', 28, 2);
      // товар
      for (let i = 0; i < 6; i++) { px(c, 4 + i * 4, 14, ['#e84a3a', '#f0c040', '#7ac04a'][i % 3], 3, 3); }
      for (let i = 0; i < 8; i++) px(c, i * 4, 2, i % 2 ? '#f4ecd8' : '#d84a3a', 4, 7);
      px(c, 0, 1, P.ink, 32, 1); px(c, 0, 9, P.ink, 32, 1);
      for (let i = 0; i < 8; i++) px(c, i * 4 + 1, 10, i % 2 ? '#f4ecd8' : '#d84a3a', 2, 1);
    }, -16, -27, { x: -15, y: -6, w: 30, h: 6 });

    obj('well', 18, 22, (c) => {
      outline(c, 1, 12, 16, 10, '#8a8a98'); px(c, 3, 13, '#2a3a5a', 12, 3);
      px(c, 2, 2, '#5a3a24', 2, 12); px(c, 14, 2, '#5a3a24', 2, 12);
      px(c, 0, 0, '#8a3226', 18, 3); px(c, 8, 3, P.ink, 1, 7); px(c, 7, 9, '#a8683a', 3, 3);
    }, -9, -21, { x: -8, y: -7, w: 16, h: 7 });

    obj('bench', 26, 12, (c) => {
      px(c, 2, 7, '#3a2a20', 2, 5); px(c, 22, 7, '#3a2a20', 2, 5);
      outline(c, 0, 3, 26, 5, P.wood); px(c, 1, 0, P.woodDark, 24, 3);
    }, -13, -11, { x: -12, y: -4, w: 24, h: 4 });

    obj('planter', 20, 30, (c) => { // дерево в каменной кадке (площадь)
      outline(c, 2, 22, 16, 8, '#b8b0a0'); px(c, 3, 23, '#5a3a24', 14, 2);
      px(c, 9, 14, P.trunk, 2, 9);
      blob(c, 10, 10, 8, P.leafDark); blob(c, 10, 9, 7, P.leaf); blob(c, 7, 6, 3, '#3e8a42'); px(c, 6, 5, '#5aaa5a', 2, 1);
    }, -10, -29, { x: -8, y: -7, w: 16, h: 7 });

    obj('flowerbox', 16, 10, (c) => {
      outline(c, 0, 4, 16, 6, P.woodDark);
      for (let i = 0; i < 5; i++) { px(c, 1 + i * 3, 1 + (i % 2), ['#e84a6a', '#f0d040', '#f4ecd8'][i % 3], 2, 2); px(c, 2 + i * 3, 3, P.leaf, 1, 2); }
    }, -8, -9, { x: -8, y: -4, w: 16, h: 4 });

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
    obj('futon', 18, 30, (c) => {
      outline(c, 0, 0, 18, 30, '#f4ecd8'); px(c, 1, 9, '#5a7ac8', 16, 20); px(c, 1, 9, '#7a9ae0', 16, 2);
      outline(c, 3, 2, 12, 6, '#ffffff'); for (let y = 13; y < 29; y += 4) px(c, 1, y, '#4a64a8', 16, 1);
    }, -9, -29, { x: -9, y: -28, w: 18, h: 28 });

    obj('table', 32, 22, (c) => { // низкий столик + подушки
      px(c, 2, 0, '#c86a4a', 8, 5); px(c, 22, 0, '#c86a4a', 8, 5);
      outline(c, 2, 5, 28, 12, '#8e5e34'); px(c, 3, 6, '#a8703e', 26, 2);
      px(c, 4, 17, '#5a3a24', 2, 3); px(c, 26, 17, '#5a3a24', 2, 3);
      px(c, 12, 7, '#f4ecd8', 4, 3); px(c, 18, 8, '#7ac0f0', 3, 2);
    }, -16, -21, { x: -14, y: -14, w: 28, h: 12 });

    obj('shelf', 16, 28, (c) => { // книжный шкаф у стены
      outline(c, 0, 0, 16, 28, '#7a4a2a');
      for (let r = 0; r < 3; r++) {
        px(c, 1, 8 + r * 9, '#5a3a24', 14, 1);
        for (let i = 0; i < 6; i++) px(c, 2 + i * 2, 2 + r * 9, ['#c84a3a', '#4a7ac8', '#e8c040', '#5aa05a', '#a85ac8', '#f4ecd8'][(i + r) % 6], 2, 6);
      }
    }, -8, -27, { x: -8, y: -6, w: 16, h: 6 });

    obj('kitchen', 32, 28, (c) => {
      outline(c, 0, 8, 32, 20, '#d8cbb0'); px(c, 1, 9, '#e8dcc0', 30, 3);
      px(c, 4, 9, '#3a3a4a', 8, 3); blob(c, 8, 6, 3, '#5a5a6a'); px(c, 6, 3, '#7a7a8a', 5, 1);
      px(c, 18, 9, '#8ab0c8', 10, 3); px(c, 2, 15, '#a89e8a', 28, 1);
      px(c, 6, 18, '#8a7a6a', 1, 4); px(c, 22, 18, '#8a7a6a', 1, 4);
    }, -16, -27, { x: -16, y: -8, w: 32, h: 8 });

    obj('chest', 16, 14, (c) => {
      outline(c, 0, 2, 16, 12, '#a8683a'); px(c, 1, 3, '#c88a4a', 14, 3); px(c, 0, 6, P.ink, 16, 1);
      px(c, 7, 6, '#f0d040', 2, 3);
    }, -8, -13, { x: -8, y: -6, w: 16, h: 6 });

    obj('desk', 26, 18, (c) => { // письменный стол / парта
      outline(c, 0, 2, 26, 10, '#a8703e'); px(c, 1, 3, '#c88a4a', 24, 2);
      px(c, 2, 12, '#5a3a24', 2, 6); px(c, 22, 12, '#5a3a24', 2, 6);
      px(c, 5, 4, '#f4ecd8', 6, 4); px(c, 15, 4, '#c84a3a', 3, 5);
    }, -13, -17, { x: -12, y: -8, w: 24, h: 8 });

    obj('bigdesk', 48, 22, (c) => { // стол Хокаге с бумагами
      outline(c, 0, 4, 48, 14, '#7a4a2a'); px(c, 1, 5, '#9a5e34', 46, 3);
      for (let i = 0; i < 4; i++) { px(c, 4 + i * 4, 0 + (i % 2), '#f4ecd8', 6, 6); px(c, 4 + i * 4, 1 + (i % 2), '#d8cbb0', 6, 1); }
      px(c, 34, 2, '#c84a3a', 6, 5); px(c, 2, 18, '#5a3a24', 3, 4); px(c, 43, 18, '#5a3a24', 3, 4);
    }, -24, -21, { x: -24, y: -10, w: 48, h: 10 });

    obj('stool', 10, 10, (c) => {
      blob(c, 5, 3, 3, P.ink); blob(c, 5, 3, 2, '#c84a3a'); px(c, 4, 6, '#3a3a4a', 2, 4);
    }, -5, -9, { x: -3, y: -2, w: 6, h: 2 });

    obj('counter', 16, 20, (c) => { // сегмент прилавка
      px(c, 0, 4, P.ink, 16, 16); px(c, 0, 5, '#8e5e34', 16, 14); px(c, 0, 4, '#c8945a', 16, 4); px(c, 0, 8, '#5a3a24', 16, 1);
      px(c, 0, 12, '#7a4a2a', 16, 1);
    }, -8, -19, { x: -8, y: -12, w: 16, h: 12 });

    obj('bed', 18, 30, (c) => { // больничная койка
      outline(c, 0, 0, 18, 30, '#c8d0d8'); px(c, 1, 9, '#f4f8fa', 16, 20); px(c, 1, 9, '#d8e0e8', 16, 1);
      outline(c, 3, 2, 12, 6, '#ffffff'); px(c, 0, 28, '#8a9aa8', 18, 2);
    }, -9, -29, { x: -9, y: -28, w: 18, h: 28 });

    obj('pillar', 14, 36, (c) => {
      outline(c, 2, 0, 10, 36, '#a8402a'); px(c, 3, 1, '#c85a3a', 3, 34); px(c, 0, 32, '#5a3a24', 14, 4);
    }, -7, -35, { x: -6, y: -5, w: 12, h: 5 });

    obj('plant', 14, 22, (c) => {
      outline(c, 3, 14, 8, 8, '#c86a4a');
      blob(c, 7, 8, 5, P.leafDark); blob(c, 7, 7, 4, P.leaf); px(c, 5, 5, '#5aaa5a', 2, 1);
    }, -7, -21, { x: -4, y: -4, w: 8, h: 4 });

    obj('flowerpot', 12, 16, (c) => { // цветок в горшке (дом героя)
      outline(c, 2, 9, 8, 7, '#c86a4a'); px(c, 5, 4, P.leaf, 2, 6); px(c, 3, 6, P.leaf, 2, 2); px(c, 7, 5, P.leaf, 2, 2);
      blob(c, 6, 2, 2, '#f0d040'); px(c, 6, 2, '#e8621a', 1, 1);
    }, -6, -15, { x: -4, y: -3, w: 8, h: 3 });

    obj('rack', 26, 26, (c) => { // стойка с оружием
      px(c, 1, 2, '#5a3a24', 2, 24); px(c, 23, 2, '#5a3a24', 2, 24); px(c, 1, 2, '#7a4a2a', 24, 2); px(c, 1, 14, '#7a4a2a', 24, 2);
      for (let i = 0; i < 4; i++) { px(c, 6 + i * 4, 4, '#b8c0c8', 1, 9); px(c, 5 + i * 4, 12, '#3a3a4a', 3, 2); }
      for (let i = 0; i < 3; i++) { blob(c, 8 + i * 5, 20, 2, '#8a8a9a'); px(c, 8 + i * 5, 20, '#3a3a4a', 1, 1); }
    }, -13, -25, { x: -13, y: -5, w: 26, h: 5 });

    obj('screen', 24, 26, (c) => { // ширма
      for (let i = 0; i < 3; i++) { outline(c, i * 8, 0, 8, 26, '#f4ecd8', '#5a3a24'); px(c, i * 8 + 2, 6, '#c8b898', 4, 1); px(c, i * 8 + 2, 14, '#c8b898', 4, 1); }
    }, -12, -25, { x: -12, y: -4, w: 24, h: 4 });

    obj('cups', 16, 8, (c) => { // пустые стаканчики рамена (квартира Наруто)
      for (let i = 0; i < 3; i++) { px(c, 1 + i * 5, 2 + (i % 2), '#f4ecd8', 4, 5); px(c, 1 + i * 5, 3 + (i % 2), '#e84a3a', 4, 1); }
    }, -8, -7, null, 'floor');

    // вещи на стене (рисуются под всеми, без коллизий)
    obj('blackboard', 64, 22, (c) => {
      outline(c, 0, 0, 64, 20, '#2e5a3a', '#7a4a2a'); px(c, 2, 2, '#3a6a46', 60, 1);
      G.font.draw(c, 'Хенге', 32, 3, { color: '#e8f0e0', align: 'center' });
      px(c, 8, 15, '#c8d8c0', 14, 1); px(c, 26, 15, '#c8d8c0', 8, 1); px(c, 38, 15, '#c8d8c0', 16, 1);
      px(c, 2, 20, '#7a4a2a', 60, 2); px(c, 50, 19, '#f4ecd8', 4, 1);
    }, -32, -21, null, 'floor');

    obj('window', 16, 12, (c) => {
      outline(c, 0, 0, 16, 12, '#9ad0f0', '#5a3a24'); px(c, 7, 1, '#5a3a24', 2, 10); px(c, 1, 5, '#5a3a24', 14, 1);
      px(c, 2, 2, '#d8f0ff', 3, 1);
    }, -8, -11, null, 'floor');

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
    const crown = (c, cols, seed) => { // крона лиственного дерева в заданных цветах
      blob(c, 16, 16, 13, cols[0]); blob(c, 16, 14, 12, cols[1]);
      blob(c, 11, 10, 6, cols[2]); blob(c, 21, 12, 5, cols[2]);
      blob(c, 10, 8, 2, cols[3]); blob(c, 20, 9, 2, cols[3]); blob(c, 15, 18, 2, cols[3]);
      for (let i = 0; i < 18; i++) px(c, 5 + Math.floor(H(i, seed, 11) * 22), 4 + Math.floor(H(seed, i, 12) * 22), cols[0]);
    };
    const trunk = (c) => { px(c, 13, 26, P.trunkDark, 6, 12); px(c, 14, 26, P.trunk, 3, 12); px(c, 10, 37, P.trunkDark, 12, 2); };
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
    obj('cushion', 14, 8, (c) => { outline(c, 1, 1, 12, 6, '#c8402a'); px(c, 2, 2, '#e8705a', 10, 1); px(c, 6, 3, '#f0c040', 2, 2); }, -7, -7, null, 'floor');
    obj('cushion_b', 14, 8, (c) => { outline(c, 1, 1, 12, 6, '#3a6ac8'); px(c, 2, 2, '#6a9ae8', 10, 1); px(c, 6, 3, '#f4ecd8', 2, 2); }, -7, -7, null, 'floor');
    obj('lowtable', 28, 16, (c) => { // низкий столик с чайным набором
      outline(c, 0, 3, 28, 9, '#8a5a34'); px(c, 1, 4, '#b0804a', 26, 2); px(c, 2, 12, '#5a3a24', 2, 4); px(c, 24, 12, '#5a3a24', 2, 4);
      px(c, 5, 1, '#f4ecd8', 4, 3); px(c, 6, 0, '#7ac07a', 2, 1); px(c, 12, 2, '#f4ecd8', 3, 2); px(c, 17, 2, '#f4ecd8', 3, 2); px(c, 21, 1, '#c8402a', 3, 3);
    }, -14, -15, { x: -13, y: -7, w: 26, h: 7 });
    obj('tansu', 20, 30, (c) => { // комод-тансу
      outline(c, 0, 0, 20, 30, '#8a5a34');
      for (let r = 0; r < 4; r++) { px(c, 2, 2 + r * 7, '#a87a48', 16, 5); px(c, 2, 6 + r * 7, '#5a3a24', 16, 1); px(c, 8, 4 + r * 7, '#f0d040', 4, 1); }
      px(c, 1, 28, '#5a3a24', 18, 2);
    }, -10, -29, { x: -10, y: -6, w: 20, h: 6 });
    obj('andon', 12, 22, (c) => { // бумажный напольный фонарь
      px(c, 5, 16, '#5a3a24', 2, 6); px(c, 2, 20, '#5a3a24', 8, 2); outline(c, 1, 2, 10, 14, '#f4e0a0', '#5a3a24'); px(c, 2, 3, '#fff6cc', 8, 12); px(c, 6, 3, '#8a6a3a', 1, 12); px(c, 1, 8, '#8a6a3a', 10, 1);
    }, -6, -21, { x: -4, y: -3, w: 8, h: 3 });
    obj('vase', 10, 18, (c) => { outline(c, 2, 9, 6, 8, '#4a7ac8'); px(c, 3, 10, '#8ab0f0', 1, 5); px(c, 5, 3, '#6a4a2a', 1, 7); px(c, 3, 5, '#6a4a2a', 1, 5); blob(c, 5, 2, 2, '#f4a0c0'); blob(c, 2, 4, 1, '#f4a0c0'); blob(c, 8, 5, 1, '#f4a0c0'); }, -5, -17, { x: -3, y: -3, w: 6, h: 3 });
    obj('bonsai', 14, 18, (c) => { outline(c, 3, 12, 8, 6, '#a8683a'); px(c, 7, 6, '#5a3a24', 1, 7); px(c, 5, 8, '#5a3a24', 2, 1); blob(c, 7, 4, 3, P.leafDark); blob(c, 7, 3, 2, P.leaf); blob(c, 3, 7, 2, P.leaf); blob(c, 11, 8, 2, P.leaf); }, -7, -17, { x: -4, y: -3, w: 8, h: 3 });
    obj('cat', 14, 12, (c) => { // кошка (сидит)
      blob(c, 7, 8, 3, '#e8a860'); px(c, 4, 9, '#e8a860', 7, 3); blob(c, 7, 4, 3, '#e8a860'); px(c, 4, 1, '#e8a860', 2, 2); px(c, 9, 1, '#e8a860', 2, 2);
      px(c, 5, 4, '#2a1e18'); px(c, 9, 4, '#2a1e18'); px(c, 7, 5, '#f08a8a'); px(c, 3, 9, '#c8803a', 1, 3); px(c, 11, 9, '#e8a860', 3, 1); px(c, 6, 7, '#c8803a', 2, 1);
    }, -7, -11, null);
    obj('bookpile', 12, 10, (c) => { px(c, 1, 6, P.ink, 10, 4); px(c, 2, 7, '#c84a3a', 8, 2); px(c, 2, 3, P.ink, 8, 4); px(c, 3, 4, '#4a7ac8', 6, 2); px(c, 3, 1, P.ink, 6, 3); px(c, 4, 2, '#e8c040', 4, 1); }, -6, -9, { x: -5, y: -3, w: 10, h: 3 });
    obj('basket', 12, 12, (c) => { outline(c, 1, 5, 10, 7, '#c8a050'); for (let i = 0; i < 4; i++) px(c, 2, 6 + i * 2, '#a07830', 8, 1); px(c, 2, 2, '#c8a050', 1, 4); px(c, 9, 2, '#c8a050', 1, 4); px(c, 2, 2, '#c8a050', 8, 1); px(c, 4, 4, '#d84a3a', 3, 2); px(c, 7, 4, '#7ac04a', 2, 2); }, -6, -11, { x: -5, y: -3, w: 10, h: 3 });
    obj('shoes', 12, 6, (c) => { px(c, 1, 2, '#5a3a24', 4, 3); px(c, 2, 1, '#8a5a34', 2, 1); px(c, 7, 3, '#3a3a4a', 4, 2); px(c, 7, 2, '#5a5a6a', 2, 1); }, -6, -5, null, 'floor');
    obj('hibachi', 16, 14, (c) => { outline(c, 1, 4, 14, 10, '#6a4a30'); px(c, 3, 5, '#3a2a20', 10, 3); px(c, 5, 5, '#f08a2a', 2, 1); px(c, 9, 6, '#e84a2a', 2, 1); px(c, 2, 12, '#4a3220', 12, 2); }, -8, -13, { x: -7, y: -4, w: 14, h: 4 });
    obj('wardrobe', 20, 32, (c) => { outline(c, 0, 0, 20, 32, '#7a4a2a'); px(c, 2, 2, '#a07040', 7, 26); px(c, 11, 2, '#a07040', 7, 26); px(c, 9, 2, P.ink, 2, 26); px(c, 7, 14, '#f0d040', 1, 3); px(c, 12, 14, '#f0d040', 1, 3); px(c, 0, 29, '#5a3a24', 20, 3); }, -10, -31, { x: -10, y: -6, w: 20, h: 6 });
    obj('rug_red', 32, 20, (c) => { px(c, 0, 0, '#5a2018', 32, 20); px(c, 1, 1, '#a8382a', 30, 18); px(c, 3, 3, '#d8604a', 26, 14); px(c, 4, 4, '#a8382a', 24, 12); for (let x = 7; x < 26; x += 4) px(c, x, 8, '#f0c040', 2, 4); px(c, 0, 0, '#f4ecd8', 32, 1); px(c, 0, 19, '#f4ecd8', 32, 1); }, -16, -19, null, 'floor');
    obj('rug_blue', 32, 20, (c) => { px(c, 0, 0, '#1a2a58', 32, 20); px(c, 1, 1, '#2f4a98', 30, 18); px(c, 3, 3, '#5a82d0', 26, 14); px(c, 4, 4, '#2f4a98', 24, 12); for (let x = 7; x < 26; x += 4) px(c, x, 8, '#f4ecd8', 2, 4); }, -16, -19, null, 'floor');
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

  function object(name) {
    if (!OBJ.tree) buildObjects();
    return OBJ[name];
  }

  return { ID, COUNT, SOLID, GRASSY, ROADY, MAPCOL, drawTile, renderTile, waterOverlay, object };
})();
