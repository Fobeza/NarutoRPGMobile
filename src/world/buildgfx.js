// Спрайты зданий, нарисованные кодом по шаблону из G.BUILDINGS.
// Вид 3/4: снизу — фасад (стена с дверью и окнами), выше — крыша. Крыша выступает на OV пикселей
// над «пятном» здания, поэтому персонаж, стоящий позади, частично скрыт (тогда здание полупрозрачно).
G.buildgfx = (() => {
  const T = G.CONFIG.TILE;
  const P = G.PAL;
  const H = G.util.hash2;
  const cache = {};
  let glowList = null;   // окна текущего здания (для ночного свечения)
  let eaves = null;      // V9: линии карнизов текущего здания — под ними ляжет мягкая тень

  function px(c, x, y, col, w = 1, h = 1) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function shade(hex, k) { // k < 0 — темнее, k > 0 — светлее
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
    return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
  }

  // Маленькие значки на вывесках 7×7
  const ICONS = {
    ramen: ['.......', 'o.o.o..', '.......', 'ooooooo', 'oyyyyyo', '.ooooo.', '..ooo..'],
    kunai: ['......o', '.....oo', '....oo.', '...oo..', '.ooo...', '.oo....', 'o.o....'],
    cross: ['..ooo..', '..ooo..', 'ooooooo', 'ooooooo', 'ooooooo', '..ooo..', '..ooo..'],
    book: ['.......', 'ooo.ooo', 'oyo.oyo', 'oyo.oyo', 'oyo.oyo', 'ooooooo', '.......'],
    flower: ['..o.o..', '.ooooo.', 'oooyooo', '.ooooo.', '..o.o..', '...o...', '...o...'],
    paw: ['.o...o.', '.o.o.o.', '.......', '..ooo..', '.ooooo.', '.ooooo.', '..o.o..'],
    gift: ['..o.o..', '...o...', 'ooooooo', 'oyyoyyo', 'oyyoyyo', 'oyyoyyo', 'ooooooo'],
    dango: ['......o', '..oo.o.', '.oooo..', '.oooo..', 'o.oo...', '.o.....', 'o......'],
    tea: ['.......', '..o.o..', '.......', 'ooooo..', 'oyyyooo', 'oyyyo.o', '.ooo...'],
    meat: ['.......', '..ooo..', '.ooyoo.', 'ooyyyoo', '.ooooo.', 'o.....o', '.......'],
    coin: ['..ooo..', '.oyyyo.', 'oyo.oyo', 'oy...yo', 'oyo.oyo', '.oyyyo.', '..ooo..'],
    onsen: ['.o.o.o.', 'o.o.o..', '.o.o.o.', '.......', 'o.....o', 'o.....o', '.ooooo.'],
    leaf: ['...oo..', '..oooo.', '.ooyoo.', '.oyooo.', '.ooooo.', '..ooo..', '...o...'],
    fire: ['...o...', '.o.o.o.', '.o.o.o.', '...o...', '..ooo..', '.o...o.', 'o.....o'],
  };
  const TPL_ICON = {
    ichiraku: 'ramen', weapons: 'kunai', pharmacy: 'cross', books: 'book', flowers: 'flower',
    inuzuka_shop: 'paw', souvenir: 'gift', dango: 'dango', teahouse: 'tea', yakiniku: 'meat',
    shop_generic: 'coin', onsen: 'onsen', hospital: 'cross', library: 'book', market: 'coin',
  };
  function icon(c, name, x, y, col, col2 = '#ffffff') {
    const rows = ICONS[name]; if (!rows) return;
    rows.forEach((r, yy) => [...r].forEach((ch, xx) => { if (ch === 'o') px(c, x + xx, y + yy, col); else if (ch === 'y') px(c, x + xx, y + yy, col2); }));
  }

  // Кандзи «火» 11×11
  const KANJI_FIRE = [
    '.....o.....', '.o...o...o.', '.o...o...o.', 'o....o...o.', 'o...ooo....',
    '....o.o....', '...o...o...', '..o.....o..', '.o.......o.', 'o.........o', '...........',
  ];
  function kanji(c, x, y, col, scale = 1) {
    KANJI_FIRE.forEach((r, yy) => [...r].forEach((ch, xx) => { if (ch === 'o') px(c, x + xx * scale, y + yy * scale, col, scale, scale); }));
  }

  // Знак Учиха (веер) 9×11
  function uchihaFan(c, x, y) {
    const rows = ['..ooooo..', '.orrrrro.', 'orrrrrrro', 'orrrrrrro', 'owwwwwwwo', 'owwwwwwwo', '.owwwwwo.', '..ooooo..', '....o....', '....o....', '....o....'];
    rows.forEach((r, yy) => [...r].forEach((ch, xx) => { const col = { o: '#2a1e18', r: '#d83a2a', w: '#f4ecd8' }[ch]; if (col) px(c, x + xx, y + yy, col); }));
  }

  // ---------- Части здания ----------
  function roofGable(c, x, y, w, h, col) {
    const dk = shade(col, -0.35), lt = shade(col, 0.18);
    px(c, x, y, P.ink, w, h);
    px(c, x + 1, y + 1, col, w - 2, h - 2);
    for (let yy = y + 4; yy < y + h - 4; yy += 4) {
      px(c, x + 1, yy, dk, w - 2, 1);
      const off = ((yy - y) / 4) % 2 ? 3 : 0;
      for (let xx = x + 2 + off; xx < x + w - 2; xx += 6) {
        px(c, xx, yy - 3, lt, 1, 2);
        const k = H(xx, yy, w + h);
        if (k > 0.9) px(c, xx + 1, yy - 3, dk, 3, 2);                   // тёмная выгоревшая черепица
        else if (k < 0.07) px(c, xx + 1, yy - 2, shade(col, 0.3), 3, 2); // новая светлая черепица
        else if (k > 0.84 && yy > y + h - 14) px(c, xx, yy - 2, '#5a8a48', 3, 1);   // мох у карниза
      }
    }
    // конёк
    const ry = y + Math.max(3, Math.floor(h * 0.18));
    px(c, x + 3, ry - 2, P.ink, w - 6, 4); px(c, x + 4, ry - 1, lt, w - 8, 1);
    // карниз
    px(c, x, y + h - 4, P.ink, w, 4); px(c, x + 1, y + h - 4, dk, w - 2, 2);
    // загнутые края
    px(c, x - 1, y + h - 6, P.ink, 2, 3); px(c, x + w - 1, y + h - 6, P.ink, 2, 3);
    roofLight(c, x, y, w, h);
  }
  // V9: свет на скате — у конька светлее, к карнизу плавно темнее, правый край чуть в тени
  function roofLight(c, x, y, w, h, k = 1) {
    G.shade.tint(c, x + 1, y + 1, w - 2, h - 2, (u, v) => k * (0.26 - 0.7 * v * v - 0.12 * (u - 0.5)));
    if (eaves && c.canvas.hi && c.canvas === eaves.cv) eaves.list.push([x, y + h, w]);
  }

  function roofFlat(c, x, y, w, h, col, seed, tank = true) {
    const top = shade(col, 0.45), edge = shade(col, -0.25);
    px(c, x, y, P.ink, w, h);
    px(c, x + 1, y + 1, top, w - 2, h - 2);
    px(c, x + 1, y + 1, shade(top, 0.25), w - 2, 2);       // парапет
    px(c, x + 3, y + 3, shade(top, -0.06), w - 6, h - 9);   // крыша
    px(c, x + 1, y + h - 5, edge, w - 2, 4);                // фасадная полоса
    px(c, x + 1, y + h - 5, col, w - 2, 1);
    if (tank && w >= 40) { // водяной бак — фирменная деталь Конохи
      const tx = x + 6 + Math.floor(H(seed, 1, 5) * (w - 26)), ty = y + 4;
      px(c, tx, ty + 2, P.ink, 14, 12); px(c, tx + 1, ty + 3, '#b8c0c8', 12, 10);
      px(c, tx + 1, ty + 3, '#d8e0e8', 12, 2); px(c, tx + 3, ty + 6, '#98a0a8', 1, 6);
      px(c, tx + 2, ty, P.ink, 10, 3); px(c, tx + 3, ty + 1, '#e8eef2', 8, 1);
    }
    // мелочи на плоской крыше: вентиляция, горшки, сушилка
    if (h > 18) {
      const k = H(seed, 4, 7);
      if (k > 0.3) { const vx = x + w - 12 - Math.floor(H(seed, 5, 2) * 8); px(c, vx, y + h - 12, P.ink, 6, 5); px(c, vx + 1, y + h - 11, '#9aa0a8', 4, 3); }
      if (k > 0.6 && w >= 40) for (let i = 0; i < 3; i++) { px(c, x + 5 + i * 5, y + h - 10, '#a8683a', 3, 3); px(c, x + 5 + i * 5, y + h - 12, '#4a8a3a', 3, 2); }
      else if (k < 0.2 && w >= 40) { px(c, x + 6, y + 5, '#5a4a3a', 1, 8); px(c, x + w - 7, y + 5, '#5a4a3a', 1, 8); px(c, x + 6, y + 5, '#d8d0c0', w - 12, 1); for (let i = 0; i < 4; i++) px(c, x + 9 + i * Math.floor((w - 20) / 4), y + 6, ['#e8f0f8', '#d84a3a', '#4a7ad0', '#f0c040'][i], 4, 5); }
    }
    if (H(seed, 2, 6) > 0.5 && w >= 64) { const ax = x + w - 12; px(c, ax, y + 3, '#5a5a6a', 1, 8); px(c, ax - 3, y + 5, '#5a5a6a', 7, 1); }
    // V9: плоская крыша — мягкий свет слева-сверху, фасадная полоса в тени
    G.shade.tint(c, x + 1, y + 1, w - 2, h - 2, (u, v) => (v > 1 - 5 / h ? -0.18 : 0.16 - 0.3 * v - 0.14 * u));
    if (eaves && c.canvas === eaves.cv) eaves.list.push([x, y + h, w]);
  }

  // Вальмовая крыша: скаты с торцов темнее, черепица рядами
  function roofHip(c, x, y, w, h, col) {
    const dk = shade(col, -0.35), sd = shade(col, -0.16), lt = shade(col, 0.2);
    const rid = Math.max(4, Math.floor(h * 0.32)), side = Math.max(6, Math.floor(w * 0.16));
    for (let yy = 0; yy < h - 3; yy++) {
      const ins = yy < rid ? Math.round((rid - yy) * 1.3) : 0;
      px(c, x + ins, y + yy, P.ink, w - ins * 2, 1);
      if (yy === 0) continue;
      px(c, x + ins + 1, y + yy, (yy % 4 === 0) ? dk : col, w - ins * 2 - 2, 1);
      const sw = Math.max(0, Math.min(side, Math.round(side * yy / (h - 3))) - ins);
      if (sw > 0) { px(c, x + ins + 1, y + yy, (yy % 4 === 0) ? shade(sd, -0.2) : sd, sw, 1); px(c, x + w - ins - 1 - sw, y + yy, (yy % 4 === 0) ? shade(sd, -0.2) : sd, sw, 1); }
      if (yy % 4 === 2) for (let xx = x + ins + side + 2 + (yy % 8 === 2 ? 3 : 0); xx < x + w - ins - side - 2; xx += 6) px(c, xx, y + yy, lt, 1, 1);
    }
    px(c, x + Math.round(rid * 1.3), y, lt, Math.max(2, w - Math.round(rid * 2.6)), 1);
    px(c, x, y + h - 4, P.ink, w, 4); px(c, x + 1, y + h - 4, dk, w - 2, 2);
    roofLight(c, x, y, w, h);
  }

  // ---------- Силуэты крыш (разнообразие домов) ----------
  // Рисуем обычную крышу на временном холсте и вырезаем по строкам нужный силуэт (spanFn(y) → [l, r]), затем обводим.
  function maskRows(c, tile, w, h, spanFn, x0 = 0, y0 = 0) {
    const t = G.gfx.canvas(w, h).getContext('2d'); tile(t, 0, 0, w, h);
    let pl = 0, pr = 0, started = false;
    for (let y = 0; y < h; y++) {
      const [l, r] = spanFn(y); if (r < l) continue;
      c.drawImage(t.canvas, l, y, r - l + 1, 1, x0 + l, y0 + y, r - l + 1, 1);
      if (!started) { px(c, x0 + l, y0 + y, P.ink, r - l + 1, 1); started = true; }
      else {
        px(c, x0 + l, y0 + y, P.ink, Math.max(1, pl - l + 1), 1);
        px(c, x0 + Math.min(r, pr), y0 + y, P.ink, Math.max(1, r - pr + 1), 1);
      }
      pl = l; pr = r;
    }
  }
  // «Буханка»: плавно закруглённая крыша (дома-«пузыри», как на карте Конохи)
  function roofCurved(c, x, y, w, h, col, seed, multi) {
    const drop = Math.max(8, Math.min(h - 8, Math.round(h * 0.62))), minF = 0.34 + H(seed, 22, 4) * 0.2;
    const tile = multi ? (cc, a, b, ww, hh) => roofFlat(cc, a, b, ww, hh, col, seed, false) : (cc, a, b, ww, hh) => roofGable(cc, a, b, ww, hh, col);
    maskRows(c, tile, w, h, (yy) => {
      if (yy >= drop) return [0, w - 1];
      const u = (drop - yy) / drop, half = (w / 2) * (minF + (1 - minF) * Math.sqrt(Math.max(0, 1 - u * u)));
      return [Math.round(w / 2 - half), Math.round(w / 2 + half) - 1];
    }, x, y);
    // блик по дуге
    const dk = shade(col, -0.25);
    px(c, x + Math.round(w * 0.2), y + Math.round(drop * 0.35), shade(col, 0.4), Math.round(w * 0.14), 1);
    px(c, x + 2, y + h - 6, dk, w - 4, 1);
  }
  // Фронтон: острая «пентагональная» крыша с круглым чердачным окном
  function roofFront(c, x, y, w, h, col, seed) {
    const apex = Math.round(h * 0.62);
    maskRows(c, (cc, a, b, ww, hh) => roofGable(cc, a, b, ww, hh, col), w, h, (yy) => {
      const half = yy >= apex ? w / 2 : (w / 2) * (0.1 + 0.9 * (yy / apex));
      return [Math.round(w / 2 - half), Math.round(w / 2 + half) - 1];
    }, x, y);
    const cx = x + Math.floor(w / 2), wy = y + Math.round(apex * 0.42);
    px(c, cx - 5, wy + 1, P.ink, 10, 8); px(c, cx - 4, wy, P.ink, 8, 10); px(c, cx - 3, wy + 1, '#f0e6d0', 6, 8);
    px(c, cx - 3, wy + 2, '#8ac0e0', 6, 6); px(c, cx - 1, wy + 2, '#4a3020', 1, 6); px(c, cx - 3, wy + 4, '#4a3020', 6, 1);
    px(c, cx - 2, wy + 2, '#c8e8f8', 1, 1);
  }
  // Двухъярусная пагода с загнутыми углами и золотым навершием
  function roofPagoda(c, x, y, w, h, col, seed) {
    const top = Math.round(h * 0.36), uw = Math.round(w * 0.58), ux = x + Math.floor((w - uw) / 2), uh = Math.round(h * 0.52);
    roofHip(c, x, y + top, w, h - top, col);
    px(c, x - 1, y + h - 7, P.ink, 2, 4); px(c, x + w - 1, y + h - 7, P.ink, 2, 4);
    px(c, x + 1, y + top + 1, shade(col, 0.28), w - 2, 1);
    // стенка-фонарь между ярусами
    px(c, ux + 2, y + uh - 2, P.ink, uw - 4, 6); px(c, ux + 3, y + uh - 1, '#e8dcc0', uw - 6, 4);
    for (let wx = ux + 6; wx < ux + uw - 8; wx += 8) px(c, wx, y + uh, '#4a3020', 3, 3);
    roofHip(c, ux, y, uw, uh, shade(col, -0.05));
    px(c, ux - 1, y + uh - 7, P.ink, 2, 4); px(c, ux + uw - 1, y + uh - 7, P.ink, 2, 4);
    const cx = x + Math.floor(w / 2); px(c, cx - 1, y, P.ink, 3, 3); px(c, cx, y, '#f0c040', 1, 2);
  }
  // Г-образный дом: высокое крыло с двускатной крышей и низкое с плоской
  function roofWing(c, x, y, w, h, col, seed) {
    const split = Math.round(w * (0.52 + H(seed, 23, 3) * 0.12)), flip = H(seed, 24, 2) > 0.5, top2 = Math.round(h * 0.38);
    const col2 = ROOFS[Math.floor(H(seed, 25, 6) * ROOFS.length)];
    const lowX = flip ? x : x + split - 4, lowW = w - split + 4, hiX = flip ? x + w - split - 2 : x, hiW = split + 2;
    roofFlat(c, lowX, y + top2, lowW, h - top2, col2, seed, false);
    roofGable(c, hiX, y, hiW, h, col);
    const sx = flip ? hiX : hiX + hiW - 1;
    px(c, sx, y + 3, P.ink, 1, h - 7);
  }

  // Общий выбор крыши
  function drawRoof(c, o, style, h, col, ex = {}) {
    const { W, seed } = o;
    if (style === 'flat') roofFlat(c, 0, 0, W, h, col, seed, ex.tank !== false);
    else if (style === 'hip') roofHip(c, 0, 0, W, h, col);
    else if (style === 'curved') roofCurved(c, 0, 0, W, h, col, seed, ex.multi);
    else if (style === 'front') roofFront(c, 0, 0, W, h, col, seed);
    else if (style === 'pagoda') roofPagoda(c, 0, 0, W, h, col, seed);
    else if (style === 'wing') roofWing(c, 0, 0, W, h, col, seed);
    else roofGable(c, 0, 0, W, h, col);
  }

  // Трубы с дымком и слуховые окна — только на скатных крышах
  function roofExtras(c, o, style, h) {
    const { W, seed } = o;
    if (!['gable', 'hip', 'front', 'wing'].includes(style)) return;
    if (H(seed, 26, 4) > 0.5 && W >= 40) {
      const cx = style === 'front' ? Math.round(W * 0.72) : 6 + Math.floor(H(seed, 27, 2) * (W * 0.3));
      const cy = Math.max(9, Math.round(h * 0.22));
      px(c, cx - 1, cy - 1, P.ink, 9, 2); px(c, cx, cy + 1, P.ink, 7, 11); px(c, cx + 1, cy + 1, '#a85a42', 5, 10); px(c, cx + 1, cy + 1, '#c8806a', 5, 1);
      px(c, cx + 1, cy + 5, '#8a4a38', 5, 1);
      c.globalAlpha = 0.75; px(c, cx + 2, cy - 4, '#eceef4', 3, 3); px(c, cx + 4, cy - 7, '#eceef4', 3, 3); px(c, cx + 3, cy - 10, '#eceef4', 2, 2); c.globalAlpha = 1;
    } else if (W >= 64 && h >= 50 && (style === 'gable' || style === 'hip') && H(seed, 28, 5) > 0.35) {
      dormer(c, Math.round(W * (0.18 + H(seed, 29, 3) * 0.4)), Math.round(h * 0.3), shade('#b8a888', 0));
    }
  }
  function dormer(c, x, y, wallCol) {
    for (let i = 0; i < 6; i++) px(c, x + 7 - i, y + i, P.ink, 2 * i + 2, 1);
    px(c, x + 2, y + 6, P.ink, 12, 10); px(c, x + 3, y + 6, '#9a6a3a', 10, 2); px(c, x + 3, y + 8, '#f0e6d0', 10, 7);
    px(c, x + 5, y + 8, '#4a3020', 6, 6); px(c, x + 6, y + 9, '#8ac0e0', 4, 4); px(c, x + 8, y + 9, '#4a3020', 1, 4);
  }

  // Круглый дом Конохи: цилиндр с плоской крышей-диском, конической крышей или куполом
  function roundHouse(c, o, plaster, roofCol, rstyle = 'round') {
    const { W, HF, OV, seed, tpl, id } = o;
    const wh = wallH(tpl, id), wy = OV + HF - wh, cx = W / 2;
    for (let x = 1; x < W - 1; x++) {
      const t = Math.abs((x - cx) / (cx - 1));
      const col = t > 0.85 ? shade(plaster, -0.28) : t > 0.6 ? shade(plaster, -0.12) : t < 0.2 ? shade(plaster, 0.12) : plaster;
      const cut = t > 0.92 ? 3 : t > 0.8 ? 1 : 0;
      px(c, x, wy + cut, col, 1, wh - cut * 2);
    }
    px(c, 0, wy + 3, P.ink, 1, wh - 6); px(c, W - 1, wy + 3, P.ink, 1, wh - 6);
    px(c, 2, OV + HF - 4, P.ink, W - 4, 2); px(c, 3, OV + HF - 5, '#8a8a98', W - 6, 1);
    const band = shade(roofCol, -0.1);
    for (let f = 0; f < 2; f++) {
      const yy = wy + 6 + f * 14;
      for (let x = 7; x + 9 < W - 6; x += 14) roundWindow(c, x, yy);
      px(c, 3, yy + 12, band, W - 6, 1);
    }
    const dx = tpl.door[0] * T + 2;
    px(c, dx - 1, OV + HF - 22, P.ink, 14, 22); px(c, dx, OV + HF - 21, '#7a4a2a', 12, 21); px(c, dx + 2, OV + HF - 13, '#f0c040', 1, 2);
    px(c, dx - 3, OV + HF - 24, P.ink, 18, 3); px(c, dx - 2, OV + HF - 23, roofCol, 16, 1);
    // крыша-диск
    const rh = wy + 5;
    if (rstyle === 'cone' || rstyle === 'dome') {
      const dk = shade(roofCol, -0.3);
      for (let y = 0; y < rh; y++) {
        const t = y / (rh - 1);
        const k = rstyle === 'cone' ? 0.05 + 0.95 * Math.min(1, t / 0.9) : 0.14 + 0.86 * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
        const half = y >= rh - 4 ? Math.floor(W / 2) : Math.max(1, Math.floor((W / 2) * k));
        px(c, cx - half, y, P.ink, half * 2, 1);
        if (y >= rh - 1) continue;
        const base = y >= rh - 4 ? dk : (y % 5 === 4 ? shade(roofCol, -0.18) : roofCol);
        px(c, cx - half + 1, y, base, half * 2 - 2, 1);
        if (y < rh - 4) {
          px(c, cx - half + 1, y, shade(base, 0.22), Math.max(1, Math.floor(half * 0.3)), 1);
          px(c, cx + Math.floor(half * 0.35), y, shade(base, -0.2), Math.max(1, Math.ceil(half * 0.65) - 1), 1);
        }
      }
      px(c, cx - 1, 0, '#f0c040', 2, 3);
      return;
    }
    for (let y = 0; y < rh; y++) {
      const t = y / rh, half = Math.floor((W / 2) * (t < 0.3 ? 0.75 + t * 0.8 : 1));
      px(c, cx - half, y, P.ink, half * 2, 1);
      if (y > 0 && y < rh - 1) px(c, cx - half + 1, y, y > rh - 6 ? shade(roofCol, -0.3) : y < 3 ? shade(roofCol, 0.3) : roofCol, half * 2 - 2, 1);
    }
    if (H(seed, 3, 3) > 0.35) { const tx = Math.floor(cx - 6); px(c, tx, 2, P.ink, 12, 10); px(c, tx + 1, 3, '#b8c0c8', 10, 8); px(c, tx + 1, 3, '#d8e0e8', 10, 2); px(c, tx + 3, 0, P.ink, 6, 3); }
  }

  // Мелкие детали фасада: водосток, кондиционер, горшки, фонарик, бельё
  function facadeDetails(c, o, wy, wh, dx, plaster) {
    const { W, HF, OV, seed } = o;
    const r = (k) => H(seed, k, 57);
    const by = OV + HF;
    if (r(1) > 0.45) { const x = r(2) > 0.5 ? 1 : W - 3; px(c, x, wy + 2, '#7a8088', 2, wh - 5); px(c, x, by - 4, '#5a6068', 3, 1); }
    if (r(3) > 0.5 && W >= 48) {
      let ax = 4 + Math.floor(r(4) * (W - 18));
      if (dx != null && ax + 10 > dx - 2 && ax < dx + 14) ax = dx + 16 < W - 12 ? dx + 16 : Math.max(3, dx - 14);
      const ay = wy + Math.floor(wh * 0.55);
      px(c, ax, ay, P.ink, 10, 7); px(c, ax + 1, ay + 1, '#d8dce0', 8, 5); for (let i = 0; i < 3; i++) px(c, ax + 2 + i * 2, ay + 2, '#8a9098', 1, 3);
    }
    if (dx != null) {
      if (r(5) > 0.4) { const px0 = dx + 13 < W - 6 ? dx + 13 : dx - 7; px(c, px0, by - 8, '#a8583a', 5, 4); px(c, px0 - 1, by - 13, '#3e8a42', 7, 5); px(c, px0 + 1, by - 14, '#5aaa5a', 2, 2); }
      if (r(6) > 0.72) { const lx = dx - 6 > 2 ? dx - 6 : dx + 14; px(c, lx, by - 21, P.ink, 5, 8); px(c, lx + 1, by - 20, '#e84a3a', 3, 6); px(c, lx + 1, by - 18, '#f0d040', 3, 1); }
      if (r(7) > 0.6) { px(c, dx + 3, by - 25, P.ink, 7, 4); px(c, dx + 4, by - 24, '#e8dcc0', 5, 2); }
    }
    if (r(8) > 0.7 && wh >= 28) { // бельё на верёвке под карнизом
      const ly = wy + 4, x0 = 4, x1 = W - 5;
      px(c, x0, ly, '#5a4a3a', x1 - x0, 1);
      for (let x = x0 + 3; x < x1 - 4; x += 7) { if (dx != null && x + 5 > dx && x < dx + 12) continue; px(c, x, ly + 1, ['#f4f4f4', '#d84a3a', '#4a7ad0', '#f0c040', '#7ac04a'][Math.floor(H(x, seed, 9) * 5)], 5, 5 + (x % 3)); }
    }
  }

  function wall(c, x, y, w, h, col, beam) {
    px(c, x, y, P.ink, w, h);
    px(c, x + 1, y, col, w - 2, h - 1);
    // фактура штукатурки: светлые и тёмные крапинки, подтёки
    for (let i = 0; i < w * h / 26; i++) {
      const rx = 1 + Math.floor(H(i, w + h, 31) * (w - 3)), ry = Math.floor(H(i, x + w, 32) * (h - 6));
      c.globalAlpha = 0.09; px(c, x + rx, y + ry, H(i, h, 33) > 0.5 ? '#ffffff' : '#000000', 1 + (i % 3 === 0 ? 1 : 0), 1); c.globalAlpha = 1;
    }
    // цоколь из каменных блоков
    px(c, x + 1, y + h - 4, shade(col, -0.22), w - 2, 3);
    for (let bx = x + 1; bx < x + w - 1; bx += 5) { const k = H(bx, y, 34); px(c, bx, y + h - 4, k > 0.5 ? '#9a9aa8' : '#8a8a98', 4, 2); px(c, bx + 4, y + h - 4, '#6a6a78', 1, 3); }
    px(c, x + 1, y + h - 2, '#6a6a78', w - 2, 1);
    if (beam) {
      px(c, x + 1, y, beam, 2, h - 4); px(c, x + w - 3, y, beam, 2, h - 4);
      for (let bx = x + 48; bx < x + w - 24; bx += 48) px(c, bx, y, beam, 2, h - 4);
    }
    // V9: свет слева, затемнение у цоколя (тень от карниза кладёт make() поверх всего)
    G.shade.tint(c, x + 1, y, w - 2, h - 1, (u, v) => {
      const py = v * (h - 1);
      return 0.07 - 0.17 * u - (py > h - 9 ? 0.14 * (py - h + 9) / 9 : 0);
    });
  }

  function windowAt(c, x, y, lit) {
    if (glowList) glowList.push([x + 1, y + 1, 8, 7]);
    px(c, x, y, '#4a3020', 10, 9); px(c, x + 1, y + 1, lit ? '#f0d890' : '#8ac0e0', 8, 7);
    px(c, x + 5, y + 1, '#4a3020', 1, 7); px(c, x + 1, y + 4, '#4a3020', 8, 1);
    px(c, x + 1, y + 1, lit ? '#fff0c0' : '#c8e8f8', 2, 1);
    const k = H(x, y, 41);
    px(c, x + 1, y + 6, 'rgba(255,255,255,0.28)', 3, 1);                 // блик на стекле
    if (k > 0.55 && k < 0.8) { px(c, x + 1, y + 1, '#e8b0b8', 2, 4); px(c, x + 7, y + 1, '#e8b0b8', 2, 4); }   // занавески
    px(c, x - 1, y + 9, '#e4d8bc', 12, 1); px(c, x - 1, y + 10, 'rgba(60,40,20,0.22)', 12, 1);                // подоконник и тень под ним
    px(c, x - 1, y - 1, '#7a5a3a', 12, 1);                                                                      // перемычка
    if (k >= 0.8) { // цветочный ящик
      px(c, x - 1, y + 9, '#7a4a2a', 12, 2); px(c, x, y + 10, '#5a3418', 10, 1);
      for (let i = 0; i < 5; i++) { px(c, x + i * 2, y + 8, i % 2 ? '#e84a6a' : '#f4d84a'); px(c, x + i * 2, y + 7, '#3e8a42'); }
    }
  }
  function roundWindow(c, x, y) {
    if (glowList) glowList.push([x + 2, y + 2, 6, 6]);
    px(c, x + 2, y, '#4a3020', 6, 10); px(c, x, y + 2, '#4a3020', 10, 6); px(c, x + 1, y + 1, '#4a3020', 8, 8);
    px(c, x + 2, y + 2, '#8ac0e0', 6, 6); px(c, x + 3, y + 1, '#8ac0e0', 4, 8); px(c, x + 1, y + 3, '#8ac0e0', 8, 4);
    px(c, x + 4, y + 1, '#4a3020', 1, 8); px(c, x + 3, y + 3, '#c8e8f8', 1, 1);
  }

  function door(c, x, y, h, kind, col) {
    if (kind === 'noren') { // занавеска норэн
      px(c, x - 1, y, P.ink, 14, h); px(c, x, y + 1, '#2a1e18', 12, h - 1);
      px(c, x - 2, y, '#5a3a24', 16, 2);
      for (let i = 0; i < 3; i++) px(c, x + i * 4, y + 2, col, 3, Math.floor(h * 0.55));
      px(c, x, y + 2 + Math.floor(h * 0.55), shade(col, -0.3), 12, 1);
    } else if (kind === 'big') {
      px(c, x - 3, y, P.ink, 18, h); px(c, x - 2, y + 1, '#7a4a2a', 16, h - 1);
      px(c, x + 5, y + 1, P.ink, 2, h - 1); px(c, x - 2, y + 1, '#9a6038', 16, 2);
      px(c, x + 3, y + h / 2, '#f0d040', 1, 2); px(c, x + 8, y + h / 2, '#f0d040', 1, 2);
    } else if (kind === 'arch') { // дверь с круглой аркой
      px(c, x, y + 3, P.ink, 12, h - 3); px(c, x + 1, y + 1, P.ink, 10, 2); px(c, x + 3, y, P.ink, 6, 1);
      px(c, x + 1, y + 4, '#8a5a34', 10, h - 4); px(c, x + 2, y + 2, '#8a5a34', 8, 2); px(c, x + 3, y + 1, '#8a5a34', 6, 1);
      px(c, x + 6, y + 2, '#5a3a20', 1, h - 2); px(c, x + 2, y + 5, '#a8703e', 3, 1); px(c, x + 8, y + Math.floor(h / 2), '#f0c040', 1, 2);
      px(c, x - 1, y + h - 2, '#8a8a98', 14, 2);
    } else { // раздвижная дверь седзи
      px(c, x, y, P.ink, 12, h); px(c, x + 1, y + 1, '#f0e6cc', 10, h - 1);
      px(c, x + 6, y + 1, '#5a3a24', 1, h - 1);
      for (let yy = y + 4; yy < y + h; yy += 4) px(c, x + 1, yy, '#b8a888', 10, 1);
      px(c, x + 3, y + 1, '#b8a888', 1, h - 1); px(c, x + 9, y + 1, '#b8a888', 1, h - 1);
    }
  }

  function signboard(c, x, y, w, col, iconName) {
    px(c, x, y, P.ink, w, 11); px(c, x + 1, y + 1, col, w - 2, 9);
    px(c, x + 1, y + 1, shade(col, 0.25), w - 2, 1);
    if (iconName) icon(c, iconName, x + Math.floor((w - 7) / 2), y + 2, '#f4ecd8', shade(col, -0.2));
  }

  // ---------- Основная функция ----------
  // tpl — объект шаблона, id — ключ, seed — для вариаций.
  // art — имя нарисованной картинки (gfx/house_art.js); у уникальных зданий — по id; нет картинки — рисуем кодом
  function make(id, tpl, seed = 0, art = null) {
    const key = id + ':' + seed + ':' + (art || '');
    if (cache[key]) return cache[key];
    const an = art || (tpl.unique && G.houseArt.has(id) ? id : null);
    const sp = an && G.houseArt.sprite(an, tpl);
    if (sp) return (cache[key] = sp);
    const W = tpl.w * T, HF = tpl.h * T;
    let OV = tpl.ov || 16;
    if (id === 'hokage_tower') OV = 28;
    if (id === 'apartment' || id === 'naruto_flat') OV = 24;
    const style = pickStyle(id, tpl, seed);
    if (style) OV += EXTRA_OV[style] || 0;
    const c = G.gfx.canvas(W, HF + OV).getContext('2d');
    const draw = SPECIAL[id] || GENERIC[tpl.cat] || GENERIC.house;
    glowList = []; eaves = { cv: c.canvas, list: [] };
    G.shade.defer(c);   // V9: свет и тени копятся и ложатся за одно чтение пикселей
    draw(c, { id, tpl, W, HF, OV, seed, col: tpl.color, style });
    // V9: мягкая тень под карнизами — ложится на стену, окна и двери, сходит на нет за 9 px
    for (const [ex, ey, ew] of eaves.list) G.shade.tint(c, ex + 1, ey, ew - 2, 9, (u, v) => -0.6 * (1 - v) ** 1.6);
    G.shade.flush(c);
    eaves = null;
    G.gfx.smooth(c.canvas);
    const res = { img: c.canvas, ox: 0, oy: -OV, w: W, h: HF + OV };
    if (glowList.length) {
      const g = G.gfx.canvas(W, HF + OV), gc = g.getContext('2d');
      gc.fillStyle = '#ffb860'; for (const [x, y, w, h] of glowList) gc.fillRect(x, y, w, h);
      gc.fillStyle = '#ffe8a8'; for (const [x, y, w] of glowList) gc.fillRect(x + 1, y + 1, Math.max(1, w - 4), 2);
      res.glow = g;
    }
    glowList = null;
    cache[key] = res;
    return res;
  }

  // Разные силуэты крыш для типовых домов и лавок: у каждого шаблона свой набор
  const STYLE_POOL = {
    house_xs: ['gable', 'front', 'curved', 'hip', 'flat'],
    house_n: ['front', 'pagoda', 'flat', 'gable', 'curved'],
    house_s: ['gable', 'hip', 'flat', 'curved', 'front', 'pagoda'],
    house_m: ['gable', 'hip', 'flat', 'curved', 'front', 'pagoda', 'wing'],
    house_w: ['wing', 'curved', 'gable', 'hip', 'pagoda', 'flat'],
    house_t: ['pagoda', 'hip', 'front', 'gable', 'curved'],
    apartment_s: ['flat', 'curved', 'flat', 'hip'],
    tower_r: ['round', 'cone', 'dome'],
    shop_s: ['gable', 'hip', 'curved', 'pagoda'],
  };
  const EXTRA_OV = { front: 6, pagoda: 8, curved: 2, wing: 4 };
  function pickStyle(id, tpl, seed) {
    const pool = STYLE_POOL[id];
    if (!pool || tpl.unique) return null;
    return pool[Math.floor(H(seed, 17, 5) * pool.length)];
  }

  // Высота фасада
  function wallH(tpl, id, spr) {
    if (spr && spr.wh) return spr.wh;           // у нарисованного дома своя высота стены
    if (tpl.wh) return tpl.wh;
    if (id === 'apartment' || id === 'naruto_flat' || tpl.multi) return tpl.h * T - 20;
    if (tpl.floors === 2 || tpl.style === 'round') return tpl.h * T - 30;
    return tpl.h >= 7 ? 44 : tpl.h >= 5 ? 36 : tpl.h >= 4 ? 30 : 26;
  }

  // Окна по фасаду с пропуском двери
  function windowsRow(c, o, wy, doorX, opts = {}) {
    const { W, seed } = o;
    for (let x = 6; x + 10 < W - 4; x += 16) {
      if (doorX != null && x + 10 > doorX - 4 && x < doorX + 16) continue;
      if (opts.every && ((x / 16) | 0) % opts.every) continue;
      if (o.shut) { px(c, x - 2, wy, o.shut, 2, 9); px(c, x + 10, wy, o.shut, 2, 9); px(c, x - 2, wy + 2, shade(o.shut, -0.3), 2, 1); px(c, x + 10, wy + 2, shade(o.shut, -0.3), 2, 1); }
      if (opts.round && H(x, seed, 3) > 0.6) roundWindow(c, x, wy); else windowAt(c, x, wy, false);
    }
  }

  const PLASTER = ['#f0e6d0', '#e8dcc0', '#f4ecd8', '#e0d4bc', '#ece0c8', '#f0dcc8', '#dce4d4', '#d8dce6', '#f0e0b0', '#e8d0c0', '#f2d8d0', '#d4e8d8', '#d0e0ee', '#f4d8b0'];
  const SHOPCOL = ['#a88a6a', '#3a7aa0', '#c8503a', '#5a9a5a', '#a05a8a', '#d89a3a', '#6a6aa8'];
  const WOODS = ['#b08058', '#a07048', '#c09068'];
  const ROOFS = ['#b84a3a', '#c86a3a', '#4a6a9a', '#5a8a5a', '#8a5a3a', '#a84a5a', '#6a5a8a', '#3a7a8a', '#9a8a5a', '#d8783a', '#5a6a7a', '#3a8a6a', '#c85a8a', '#7a8a3a'];

  const GENERIC = {
    house(c, o) {
      const { W, HF, OV, seed, tpl, id } = o;
      const r = (k) => H(seed, k, 91);
      const wh = wallH(tpl, id), wy = OV + HF - wh;
      const multi = id === 'apartment' || id === 'naruto_flat' || !!tpl.multi;
      const auto = !tpl.unique;
      const plaster = auto && !multi && r(2) > 0.8 ? WOODS[Math.floor(r(4) * WOODS.length)] : PLASTER[Math.floor(H(seed, 7, 1) * PLASTER.length)];
      const wooden = WOODS.includes(plaster);
      const roofCol = id === 'hero_home' ? '#d87a3a' : ROOFS[Math.floor(H(seed, 8, 2) * ROOFS.length)];
      let style = tpl.style || (multi ? 'flat' : id === 'hero_home' ? 'gable' : ['gable', 'flat', 'hip', 'flat', 'gable', 'hip', 'flat'][Math.floor(r(1) * 7)]);
      if (id === 'house_s' || id === 'house_m' || id === 'apartment') style = tpl.style || (multi ? 'flat' : H(seed, 9, 3) > 0.45 ? 'flat' : r(1) > 0.5 ? 'hip' : 'gable');
      if (o.style) style = o.style;
      if (style === 'round' || style === 'cone' || style === 'dome') { roundHouse(c, o, plaster, roofCol, style); return; }
      if (auto && !multi && r(31) > 0.62) o.shut = ['#4a8a6a', '#a84a3a', '#4a6aa0', '#8a6a3a'][Math.floor(r(32) * 4)];
      wall(c, 0, wy, W, wh, plaster, (style === 'gable' || style === 'wing') && !wooden ? '#7a4a2a' : null);
      if (wooden) for (let yy = wy + 4; yy < wy + wh - 4; yy += 4) px(c, 1, yy, shade(plaster, -0.2), W - 2, 1);
      const dx = tpl.door ? tpl.door[0] * T + 2 : null;
      if (multi) {
        const floors = Math.floor((wh - 8) / 14), balc = auto && r(5) > 0.35;
        for (let f = 0; f < floors; f++) {
          const yy = wy + 5 + f * 14;
          windowsRow(c, o, yy, f === floors - 1 ? dx : null);
          px(c, 1, yy + 11, shade(plaster, -0.12), W - 2, 1);
          if (balc && f < floors - 1) { // балконы с перилами и бельём
            px(c, 3, yy + 9, P.ink, W - 6, 4); px(c, 4, yy + 10, '#9aa0a8', W - 8, 1);
            for (let x = 5; x < W - 5; x += 3) px(c, x, yy + 10, '#6a7078', 1, 2);
            if (H(f, seed, 4) > 0.5) for (let x = 8; x < W - 8; x += 9) px(c, x, yy + 5, ['#f4f4f4', '#d84a3a', '#4a7ad0', '#f0c040'][Math.floor(H(x, f + seed, 5) * 4)], 4, 5);
          }
        }
        if (id === 'naruto_flat') { icon(c, 'leaf', W - 12, wy + 4, '#e8621a', '#f0c040'); }
      } else if (tpl.floors === 2) {
        windowsRow(c, o, wy + 5, null, { round: r(6) > 0.5 });
        px(c, 0, wy + 17, P.ink, W, 3); px(c, 1, wy + 17, shade(roofCol, -0.1), W - 2, 1);   // навес между этажами
        windowsRow(c, o, wy + 23, dx);
      } else {
        windowsRow(c, o, wy + Math.max(4, Math.floor((wh - 16) / 2)), dx, { round: true });
      }
      if (dx != null) {
        const dk = id === 'hero_home' ? 'shoji' : ['shoji', 'shoji', 'wood', 'noren', 'arch'][Math.floor(r(9) * 5)];
        if (dk === 'wood') { px(c, dx, OV + HF - 20, P.ink, 12, 20); px(c, dx + 1, OV + HF - 19, shade('#8a5a34', r(10) * 0.3 - 0.15), 10, 19); px(c, dx + 1, OV + HF - 19, '#a8703e', 10, 1); px(c, dx + 8, OV + HF - 10, '#f0c040', 1, 2); }
        else door(c, dx, OV + HF - 20, 20, dk, ROOFS[Math.floor(r(11) * ROOFS.length)]);
      }
      if (auto) facadeDetails(c, o, wy, wh, dx, plaster);
      drawRoof(c, o, style, wy + 4, roofCol, { multi, tank: multi || r(12) > 0.35 });
      if (auto) roofExtras(c, o, style, wy + 4);
      if (id === 'hero_home') { px(c, dx + 1, OV + HF - 25, P.ink, 10, 4); px(c, dx + 2, OV + HF - 24, '#f0c040', 8, 2); }
    },

    shop(c, o) {
      const { W, HF, OV, seed, tpl, id } = o;
      const col = tpl.unique ? tpl.color : SHOPCOL[Math.floor(H(seed, 13, 4) * SHOPCOL.length)];
      const wh = wallH(tpl, id), wy = OV + HF - wh;
      const plaster = PLASTER[Math.floor(H(seed, 7, 1) * PLASTER.length)];
      wall(c, 0, wy, W, wh, plaster, '#7a4a2a');
      const dx = tpl.door[0] * T + 2;
      // витрина
      for (let x = 5; x + 12 < W - 3; x += 16) {
        if (x + 12 > dx - 3 && x < dx + 15) continue;
        px(c, x, wy + 10, '#4a3020', 13, 11); px(c, x + 1, wy + 11, '#8ac0e0', 11, 9);
        for (let i = 0; i < 3; i++) px(c, x + 2 + i * 4, wy + 16, [col, '#f0c040', '#e84a3a'][i], 2, 3);
      }
      door(c, dx, OV + HF - 18, 18, 'noren', col);
      // навес
      const ay = wy - 1;
      for (let x = 0; x < W; x += 6) px(c, x, ay, (x / 6) % 2 ? '#f4ecd8' : col, 6, 6);
      px(c, 0, ay + 6, P.ink, W, 1);
      if (o.style && ['curved', 'pagoda'].includes(o.style)) drawRoof(c, o, o.style, wy, shade(col, -0.3));
      else if (!tpl.unique && (o.style === 'hip' || (!o.style && H(seed, 14, 2) > 0.55))) roofHip(c, 0, 0, W, wy, shade(col, -0.35)); else roofGable(c, 0, 0, W, wy, shade(col, -0.3));
      signboard(c, Math.floor(W / 2) - 9, wy - 14, 18, col, TPL_ICON[id] || 'coin');
    },

    food(c, o) {
      const { W, HF, OV, tpl, id } = o;
      const wh = wallH(tpl, id), wy = OV + HF - wh;
      wall(c, 0, wy, W, wh, '#e8d8b8', '#5a3a24');
      // широкие норэн во весь фасад (как у Ичираку)
      const ny = wy + 3;
      px(c, 2, ny - 1, '#5a3a24', W - 4, 2);
      const n = Math.floor((W - 6) / 9);
      for (let i = 0; i < n; i++) {
        const x = 3 + i * 9;
        px(c, x, ny + 1, P.ink, 8, 13); px(c, x + 1, ny + 1, tpl.color, 6, 12);
        if (i === Math.floor(n / 2)) icon(c, TPL_ICON[id] || 'coin', x, ny + 3, '#f4ecd8', shade(tpl.color, -0.3));
      }
      // стойка
      px(c, 1, OV + HF - 10, P.ink, W - 2, 7); px(c, 2, OV + HF - 9, '#a8703e', W - 4, 5); px(c, 2, OV + HF - 9, '#c88a4a', W - 4, 1);
      roofGable(c, 0, 0, W, wy + 3, shade(tpl.color, -0.25));
      // фонари
      for (const lx of [3, W - 9]) { px(c, lx, wy - 2, P.ink, 6, 9); px(c, lx + 1, wy - 1, '#e84a3a', 4, 7); px(c, lx + 1, wy + 1, '#f0d040', 4, 1); }
    },

    official(c, o) {
      const { W, HF, OV, seed, tpl, id } = o;
      const wh = wallH(tpl, id), wy = OV + HF - wh;
      const offPl = tpl.unique ? '#e8dcc0' : PLASTER[Math.floor(H(seed, 17, 1) * PLASTER.length)];
      wall(c, 0, wy, W, wh, id === 'hospital' ? '#f4f8fa' : offPl, id === 'hospital' || !tpl.unique ? null : '#7a4a2a');
      const dx = tpl.door[0] * T + 2;
      windowsRow(c, o, wy + 8, dx);
      if (!tpl.unique) facadeDetails(c, o, wy, wh, null, offPl);
      if (wh > 36) windowsRow(c, o, wy + 22, dx, { every: 2 });
      door(c, dx, OV + HF - 22, 22, 'big');
      const flat = id === 'hospital' || (!tpl.unique && H(seed, 15, 2) > 0.5);
      if (flat) roofFlat(c, 0, 0, W, wy + 4, id === 'hospital' ? '#c8d0d8' : ROOFS[Math.floor(H(seed, 16, 1) * ROOFS.length)], seed, id !== 'hospital');
      else roofGable(c, 0, 0, W, wy + 4, shade(tpl.color, -0.2));
      if (id === 'hospital') {
        const cx = W / 2, cy = (wy + 4) / 2;
        px(c, cx - 3, cy - 9, '#d83a2a', 6, 18); px(c, cx - 9, cy - 3, '#d83a2a', 18, 6);
        icon(c, 'cross', dx + 3, wy + 2, '#d83a2a');
      }
      if (TPL_ICON[id] && id !== 'hospital') signboard(c, Math.floor(W / 2) - 9, wy - 13, 18, tpl.color, TPL_ICON[id]);
    },

    clan(c, o) {
      const { W, HF, OV, seed, tpl, id } = o;
      const wh = wallH(tpl, id), wy = OV + HF - wh;
      const uchiha = id.startsWith('uchiha') || id === 'sasuke_home';
      wall(c, 0, wy, W, wh, uchiha ? '#d8d0c8' : '#e8e0d0', '#3a2a20');
      const dx = tpl.door ? tpl.door[0] * T + 2 : null;
      for (let x = 6; x + 10 < W - 4; x += 16) {
        if (dx != null && x + 10 > dx - 4 && x < dx + 16) continue;
        px(c, x, wy + 8, '#3a2a20', 11, 10); px(c, x + 1, wy + 9, '#f0e6cc', 9, 8);
        px(c, x + 5, wy + 9, '#3a2a20', 1, 8); px(c, x + 1, wy + 12, '#c8b898', 9, 1);
      }
      if (dx != null) door(c, dx, OV + HF - 22, 22, uchiha ? 'shoji' : 'noren', tpl.color);
      roofGable(c, 0, 0, W, wy + 4, uchiha ? '#3a3a4a' : '#4a4a5a');
      if (uchiha) {
        uchihaFan(c, dx != null ? dx + 1 : W / 2 - 4, wy + 1);
        if (id === 'uchiha_house') { // заброшенность: доски на окнах
          for (let x = 6; x + 10 < W - 4; x += 32) { px(c, x - 1, wy + 11, '#7a5a3a', 13, 2); px(c, x - 1, wy + 15, '#7a5a3a', 13, 2); }
        }
      } else {
        // клановый знак на крыше
        const cx = Math.floor(W / 2) - 6, cy = Math.floor((wy + 4) / 2) - 4;
        px(c, cx, cy, P.ink, 13, 11); px(c, cx + 1, cy + 1, tpl.color, 11, 9);
        icon(c, { clan_inuzuka: 'paw', clan_akimichi: 'meat', clan_nara: 'leaf', clan_hyuga: 'onsen' }[id] || 'leaf', cx + 3, cy + 2, '#f4ecd8', '#2a1e18');
      }
    },

    training(c, o) { GENERIC.clan(c, o); },
    landmark(c, o) { GENERIC.house(c, o); },
  };

  // ---------- Уникальные здания ----------
  const SPECIAL = {
    // Резиденция Хокаге: красная круглая башня с кандзи «火» на крыше
    hokage_tower(c, o) {
      const { W, HF, OV } = o;
      const wh = 56, wy = OV + HF - wh;
      const red = '#c8402a', redD = '#8a2a1a', redL = '#e05a3a';
      // корпус со скруглёнными боками
      px(c, 6, wy, P.ink, W - 12, wh); px(c, 2, wy + 4, P.ink, W - 4, wh - 8);
      px(c, 7, wy, red, W - 14, wh - 1); px(c, 3, wy + 4, red, W - 6, wh - 9);
      px(c, 3, wy + wh - 9, redD, W - 6, 5); px(c, 7, wy + wh - 5, redD, W - 14, 4);
      for (let x = 10; x < W - 14; x += 14) px(c, x, wy + 4, redL, 2, wh - 12);
      // окна поясом
      for (let row = 0; row < 2; row++) for (let x = 12; x < W - 20; x += 14) {
        if (x > W / 2 - 22 && x < W / 2 + 12 && row === 1) continue;
        windowAt(c, x, wy + 8 + row * 18, false);
      }
      // вход
      const dx = o.tpl.door[0] * T + 2;
      door(c, dx, OV + HF - 22, 22, 'big');
      px(c, dx - 6, OV + HF - 30, P.ink, 24, 6); px(c, dx - 5, OV + HF - 29, '#f0c040', 22, 4);
      // крыша-купол
      const rh = wy + 6, cx = W / 2;
      for (let y = 0; y < rh; y++) {
        const t = 1 - Math.pow((y - rh * 0.55) / (rh * 0.6), 2);
        const half = Math.max(8, Math.floor((W / 2 - 2) * Math.sqrt(Math.max(0.1, t))));
        px(c, cx - half - 1, y, P.ink, half * 2 + 2, 1);
        px(c, cx - half, y, y % 6 < 1 ? redD : red, half * 2, 1);
        px(c, cx - half, y, redL, 3, 1);
      }
      px(c, 0, rh - 4, P.ink, W, 4); px(c, 1, rh - 4, redD, W - 2, 2);
      // белый круг и кандзи
      const r = 15, ky = Math.floor(rh * 0.5);
      for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) px(c, cx + xx, ky + yy, xx * xx + yy * yy > (r - 2) * (r - 2) ? P.ink : '#f4ecd8');
      kanji(c, cx - 11, ky - 11, P.ink, 2);
    },

    // Академия: широкое оранжевое здание, большая вывеска с листом
    academy(c, o) {
      const { W, HF, OV, seed, tpl } = o;
      const wh = 48, wy = OV + HF - wh;
      wall(c, 0, wy, W, wh, '#f0d8b0', '#a84a2a');
      const dx = tpl.door[0] * T + 2;
      windowsRow(c, o, wy + 8, null);
      windowsRow(c, o, wy + 24, dx);
      door(c, dx, OV + HF - 22, 22, 'big');
      roofGable(c, 0, 0, W, wy + 4, '#d8623a');
      // вывеска «火» в круге на фронтоне
      const cx = W / 2, cy = Math.floor((wy + 4) * 0.52);
      const r = 13;
      for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) px(c, cx + xx, cy + yy, xx * xx + yy * yy > (r - 2) * (r - 2) ? P.ink : '#f0d040');
      kanji(c, cx - 11, cy - 11, '#c8402a', 2);
      // часы/табличка над дверью
      const tw = G.font.measure('Академия') + 8;
      px(c, dx + 6 - tw / 2, wy + 1, P.ink, tw, 11); px(c, dx + 7 - tw / 2, wy + 2, '#f4ecd8', tw - 2, 9);
      G.font.draw(c, 'Академия', dx + 6, wy + 1, { align: 'center', color: P.ink, max: 99 });
    },

    library(c, o) {
      const { W, HF, OV, tpl } = o;
      const wh = 40, wy = OV + HF - wh;
      wall(c, 0, wy, W, wh, '#d8d0c0', null);
      for (let x = 4; x < W - 4; x += 14) { px(c, x, wy + 2, P.ink, 6, wh - 6); px(c, x + 1, wy + 2, '#f0eadc', 4, wh - 7); }
      const dx = tpl.door[0] * T + 2;
      door(c, dx, OV + HF - 22, 22, 'big');
      roofGable(c, 0, 0, W, wy + 4, '#6a5a8a');
      signboard(c, W / 2 - 9, wy - 13, 18, tpl.color, 'book');
    },

    onsen(c, o) {
      const { W, HF, OV, tpl } = o;
      const wh = 36, wy = OV + HF - wh;
      wall(c, 0, wy, W, wh, '#c8a878', '#5a3a24');
      for (let x = 2; x < W - 2; x += 3) px(c, x, wy + 2, '#a8885a', 1, wh - 7);
      const dx = tpl.door[0] * T + 2;
      door(c, dx, OV + HF - 20, 20, 'noren', '#3a6ac8');
      roofGable(c, 0, 0, W, wy + 4, '#3a4a6a');
      signboard(c, W / 2 - 9, wy - 13, 18, '#3a6ac8', 'onsen');
      // пар
      for (let i = 0; i < 3; i++) { px(c, W - 20 + i * 4, 2 + i, '#ffffff', 2, 3); }
    },

    market(c, o) { // открытые ряды под полосатыми навесами
      const { W, HF, OV, tpl } = o;
      const ay = OV + HF - 34;
      px(c, 0, OV + HF - 14, P.ink, W, 12); px(c, 1, OV + HF - 13, '#a8703e', W - 2, 10);
      for (let x = 4; x < W - 6; x += 7) {
        const cols = ['#e84a3a', '#f0c040', '#7ac04a', '#e87a3a', '#f4ecd8'];
        for (let k = 0; k < 2; k++) px(c, x + k * 3, OV + HF - 17, cols[(x + k) % 5], 3, 3);
      }
      for (let x = 0; x < W; x += 8) { px(c, x + 2, ay + 10, '#3a2a20', 2, 22); }
      roofGable(c, 0, 0, W, ay + 4, '#c8a040');
      for (let x = 0; x < W; x += 6) px(c, x, ay + 4, (x / 6) % 2 ? '#f4ecd8' : '#d84a3a', 6, 7);
      px(c, 0, ay + 11, P.ink, W, 1);
      signboard(c, W / 2 - 9, ay - 8, 18, tpl.color, 'coin');
    },

    // Главные ворота «А» и «УН»: два столба, балка с табличкой, зелёные створки
    gate(c, o) {
      const { W, HF, OV } = o;
      const g = '#4a8a4a', gD = '#2e5a2e', gL = '#6aaa5a';
      // створки (внизу, закрыты)
      px(c, 16, OV + HF - 24, P.ink, W - 32, 24);
      px(c, 17, OV + HF - 23, g, (W - 34) / 2 - 1, 23); px(c, W / 2 + 1, OV + HF - 23, g, (W - 34) / 2 - 1, 23);
      for (let x = 20; x < W - 20; x += 8) px(c, x, OV + HF - 23, gD, 1, 23);
      px(c, W / 2 - 1, OV + HF - 23, P.ink, 2, 23);
      G.font.draw(c, 'А', W / 2 - 18, OV + HF - 18, { color: '#f4ecd8', max: 9 });
      G.font.draw(c, 'УН', W / 2 + 8, OV + HF - 18, { color: '#f4ecd8', max: 9 });
      // столбы
      for (const x of [0, W - 16]) { px(c, x, 6, P.ink, 16, OV + HF - 6); px(c, x + 1, 7, g, 14, OV + HF - 8); px(c, x + 2, 7, gL, 3, OV + HF - 8); px(c, x + 1, OV + HF - 6, gD, 14, 5); }
      // балка
      px(c, 0, 0, P.ink, W, 12); px(c, 1, 1, g, W - 2, 10); px(c, 1, 1, gL, W - 2, 2);
      px(c, W / 2 - 22, 2, P.ink, 44, 9); px(c, W / 2 - 21, 3, '#f4ecd8', 42, 7);
      G.font.draw(c, 'Коноха', W / 2, 1, { align: 'center', color: '#c8402a', max: 99 });
    },

    guard_post(c, o) {
      const { W, HF, OV } = o;
      const wy = OV + HF - 20;
      wall(c, 0, wy, W, 20, '#d8c8a8', '#5a3a24');
      px(c, 6, wy + 4, '#4a3020', W - 12, 8); px(c, 7, wy + 5, '#8ac0e0', W - 14, 6);
      roofGable(c, 0, 0, W, wy + 3, '#4a6a4a');
    },

    // Скала Хокаге: четыре лица на отвесной скале (рисуется в пятне шаблона)
    hokage_rock(c, o) {
      const { W, HF, OV } = o;
      const baseY = OV + HF; // низ спрайта = подножие скалы
      const faces = [
        { x: W * 0.14, hair: 'long' }, { x: W * 0.38, hair: 'short' },
        { x: W * 0.62, hair: 'old' }, { x: W * 0.86, hair: 'spiky' },
      ];
      const rock = '#a8947e', rockD = '#7a6a58', rockL = '#c4b098';
      for (const f of faces) {
        const cx = Math.round(f.x), top = baseY - 74, fw = 40, fh = 56;
        // волосы/силуэт
        c.fillStyle = rockD;
        if (f.hair === 'long') { c.fillRect(cx - 24, top - 2, 48, fh + 10); }
        if (f.hair === 'short') { c.fillRect(cx - 22, top - 4, 44, 22); for (let i = 0; i < 5; i++) c.fillRect(cx - 20 + i * 9, top - 9, 5, 6); }
        if (f.hair === 'old') { c.fillRect(cx - 21, top + 2, 42, 16); }
        if (f.hair === 'spiky') { c.fillRect(cx - 23, top - 2, 46, 22); for (let i = 0; i < 6; i++) { c.fillRect(cx - 24 + i * 9, top - 8, 6, 8); } c.fillRect(cx - 26, top + 10, 6, 26); c.fillRect(cx + 20, top + 10, 6, 26); }
        // лицо
        px(c, cx - fw / 2, top + 8, P.ink, fw, fh - 10); px(c, cx - fw / 2 + 2, top + 10, P.ink, fw - 4, fh - 6);
        px(c, cx - fw / 2 + 1, top + 9, rock, fw - 2, fh - 12); px(c, cx - fw / 2 + 3, top + 11, rock, fw - 6, fh - 9);
        px(c, cx - fw / 2 + 1, top + 9, rockL, 4, fh - 14);
        // глаза, нос, рот
        px(c, cx - 12, top + 22, rockD, 9, 3); px(c, cx + 3, top + 22, rockD, 9, 3);
        px(c, cx - 10, top + 25, P.ink, 5, 2); px(c, cx + 5, top + 25, P.ink, 5, 2);
        px(c, cx - 1, top + 26, rockD, 2, 10); px(c, cx - 3, top + 35, rockD, 6, 2);
        px(c, cx - 7, top + 41, rockD, 14, 2);
        if (f.hair === 'old') { px(c, cx - 4, top + 45, rockD, 8, 6); px(c, cx - 14, top + 30, rockD, 2, 8); px(c, cx + 12, top + 30, rockD, 2, 8); }
        if (f.hair !== 'old') { px(c, cx - fw / 2 + 2, top + 14, '#8a9aa8', fw - 4, 4); px(c, cx - 4, top + 14, '#c8d0d8', 8, 4); } // протектор
      }
    },
  };

  return { make, shade, icon, kanji, wallH };
})();
