// Интерфейс V10 «Свитки и дерево Конохи»: панели из тёмного дерева с пергаментом, свитки с валиками,
// деревянные плашки и кнопки, бамбуковые шкалы, красные шнуры и печати. Всё рисуется кодом (gfx/shade.js:
// свет сверху-слева, дизеринг) и запекается в кэш по размеру, так что кадр стоит одного drawImage.
//
//   G.ui.panel(ctx, x, y, w, h, kind)  — kind: 'frame' (дерево+пергамент), 'scroll' (свиток с валиками),
//                                         'plank' (дерево), 'night' (тёмное лакированное), 'well' (углубление-бумага), 'tag' (красная плашка)
//   G.ui.inner(kind, x, y, w, h)       — прямоугольник содержимого внутри панели
//   G.ui.row(ctx, x, y, w, h, sel)     — строка списка: выделенная — мазок красной кисти
//   G.ui.button(ctx, x, y, w, h, label, state)   — state: 'normal' | 'sel' | 'dis' | 'on'
//   G.ui.gauge(ctx, x, y, w, h, frac, color)     — бамбуковая шкала
//   G.ui.title(ctx, text, cx, y, w)    — заголовок окна: красная лента с текстом
//   G.ui.tab(ctx, x, y, w, h, label, active)
//   G.ui.scrollbar(ctx, x, y, h, pos, size)
//   G.ui.icon(ctx, name, x, y, color)  — значки 11×11: menu map goal back heart drop bowl bolt coin leaf cross check
G.ui = (() => {
  const S = G.shade, Hh = G.util.hash2;
  // ---------- палитра ----------
  const C = {
    wood: '#6a4228', woodHi: '#8a5a36', woodLo: '#3e2616', woodDeep: '#241408', woodEdge: '#160c06',
    paper: '#ecdcb0', paperHi: '#f8eed0', paperLo: '#d4bf8a', paperEdge: '#a8885a', fiber: '#c8b078',
    ink: '#2e1e14', inkDim: '#6a5238', inkFaint: '#9c8662',
    red: '#b8321c', redDark: '#7a1e10', redHi: '#e0562e', seal: '#e8621a', gold: '#d8a020', goldHi: '#f4d46a',
    ok: '#4a8a3a', err: '#c8281c', hp: '#c8401c', chakra: '#3a7ad0', food: '#e8a020', energy: '#5aa046',
    night: '#201510', nightHi: '#34231a',
  };
  const cache = {};
  const px = (c, x, y, col, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const mixHex = (a, b, t) => S.hex(S.mix(S.rgb(a), S.rgb(b), t));
  const tone = (col, k) => S.toneHex(col, k);

  // ---------- заготовки материалов ----------
  // дерево: светлее сверху, тёмные прожилки вдоль волокон, плотная кромка
  function wood(c, x, y, w, h, base = C.wood, vertical = false, seed = 1) {
    px(c, x, y, base, w, h);
    S.tint(c, x, y, w, h, (u, v) => (vertical ? 0.14 - 0.28 * u : 0.16 - 0.3 * v), { keepInk: false, steps: 12 });
    const n = vertical ? w : h;
    for (let i = 1; i < n; i += 1 + Math.floor(Hh(i, seed, 3) * 3)) {
      const len = 6 + Math.floor(Hh(i, seed, 4) * (vertical ? h : w) * 0.8), off = Math.floor(Hh(seed, i, 5) * ((vertical ? h : w) - len + 1));
      c.globalAlpha = 0.16 + Hh(i, i, seed) * 0.16;
      px(c, vertical ? x + i : x + off, vertical ? y + off : y + i, tone(base, -0.5), vertical ? 1 : len, vertical ? len : 1);
      c.globalAlpha = 0.1;
      px(c, vertical ? x + i + 1 : x + off + 1, vertical ? y + off + 1 : y + i + 1, tone(base, 0.4), vertical ? 1 : Math.max(1, len - 2), vertical ? Math.max(1, len - 2) : 1);
    }
    c.globalAlpha = 1;
  }
  // пергамент: тёплый центр, потемнение к краям, волокна
  function paper(c, x, y, w, h, base = C.paper, seed = 2) {
    px(c, x, y, base, w, h);
    S.tint(c, x, y, w, h, (u, v) => {
      const e = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2;
      return 0.1 - 0.1 * (u + v) * 0.5 - 0.22 * e * e * e;
    }, { keepInk: false, steps: 14 });
    c.globalAlpha = 0.22;
    for (let i = 0; i < w * h / 55; i++) {
      const fx = x + Math.floor(Hh(i, seed, 6) * w), fy = y + Math.floor(Hh(seed, i, 7) * h), l = 1 + Math.floor(Hh(i, i, 8) * 3);
      px(c, fx, fy, Hh(i, 3, seed) > 0.5 ? C.fiber : C.paperHi, l, 1);
    }
    c.globalAlpha = 1;
  }
  // тень вокруг панели: ядро + полутень (на тонких пикселях)
  function dropShadow(ctx, x, y, w, h, a = 0.35) {
    const img = shadowOf(w, h);
    ctx.globalAlpha = a / 0.35;
    ctx.drawImage(img, x - 2, y);
    ctx.globalAlpha = 1;
  }
  function shadowOf(w, h) {
    const key = 'sh:' + w + 'x' + h;
    if (cache[key]) return cache[key];
    const img = S.soft(w + 4, h + 5, (px_, py) => S.box(px_, py, 2, 3, w + 2, h + 3, 3), 0.35, '#0a0604');
    return (cache[key] = img);
  }
  // кнопка-заклёпка на углах
  function stud(c, x, y, col = C.gold) {
    px(c, x, y, C.woodEdge, 3, 3); px(c, x + 1, y, col, 1, 1); px(c, x, y + 1, col, 1, 1); px(c, x + 1, y + 1, tone(col, -0.3), 2, 2);
    px(c, x + 1, y + 1, tone(col, 0.4), 1, 1);
  }
  // красный шнур-узел (угловой акцент)
  function knot(c, x, y) {
    px(c, x, y, C.woodEdge, 5, 5); px(c, x + 1, y + 1, C.red, 3, 3); px(c, x + 1, y + 1, C.redHi, 1, 1); px(c, x + 2, y + 2, C.redDark, 2, 2);
  }

  // ---------- панели ----------
  // каждая запекается в канвас размера (w+4)×(h+6) с тенью; возвращает холст и смещение рисования
  function bake(kind, w, h) {
    const key = kind + ':' + w + 'x' + h;
    if (cache[key]) return cache[key];
    const c0 = G.gfx.canvas(w + 4, h + 6), c = c0.getContext('2d');
    const ox = 2, oy = 0;
    if (kind !== 'well' && kind !== 'tag') c.drawImage(shadowOf(w, h), 0, 0);
    if (kind === 'frame') {
      // деревянная рама 3 px + пергамент + угловые заклёпки
      wood(c, ox, oy, w, h, C.wood, false, w + h);
      px(c, ox, oy, C.woodEdge, w, 1); px(c, ox, oy + h - 1, C.woodEdge, w, 1); px(c, ox, oy, C.woodEdge, 1, h); px(c, ox + w - 1, oy, C.woodEdge, 1, h);
      px(c, ox + 1, oy + 1, C.woodHi, w - 2, 1); px(c, ox + 1, oy + 1, C.woodHi, 1, h - 2);
      px(c, ox + 1, oy + h - 2, C.woodLo, w - 2, 1); px(c, ox + w - 2, oy + 1, C.woodLo, 1, h - 2);
      px(c, ox + 3, oy + 3, C.woodEdge, w - 6, h - 6);
      paper(c, ox + 4, oy + 4, w - 8, h - 8);
      px(c, ox + 4, oy + 4, C.paperLo, w - 8, 1); px(c, ox + 4, oy + 4, C.paperLo, 1, h - 8);     // внутренняя тень рамы на бумаге
      px(c, ox + 5, oy + 5, '#c8b27c', w - 10, 1);
      stud(c, ox + 1, oy + 1); stud(c, ox + w - 4, oy + 1); stud(c, ox + 1, oy + h - 4); stud(c, ox + w - 4, oy + h - 4);
    } else if (kind === 'scroll') {
      // свиток: бумага между верхним и нижним валиками
      const R = 7;
      paper(c, ox + 2, oy + R - 2, w - 4, h - 2 * R + 4);
      px(c, ox + 2, oy + R - 1, C.paperEdge, w - 4, 1); px(c, ox + 2, oy + h - R, C.paperEdge, w - 4, 1);
      for (const y0 of [oy, oy + h - R]) {
        wood(c, ox + 1, y0, w - 2, R, C.wood, false, y0 + w);
        px(c, ox + 1, y0, C.woodEdge, w - 2, 1); px(c, ox + 1, y0 + R - 1, C.woodEdge, w - 2, 1);
        px(c, ox + 2, y0 + 1, C.woodHi, w - 4, 1);
        px(c, ox + 2, y0 + R - 2, C.woodLo, w - 4, 1);
        // торцы валика — тёмные шляпки с красным кольцом
        for (const ex of [ox - 1, ox + w - 3]) { px(c, ex, y0 - 1, C.woodEdge, 4, R + 2); px(c, ex + 1, y0, C.woodLo, 2, R); px(c, ex + 1, y0 + 2, C.red, 2, 2); px(c, ex + 1, y0 + 2, C.redHi, 1, 1); }
      }
    } else if (kind === 'plank') {
      wood(c, ox, oy, w, h, C.wood, false, w * 3 + h);
      px(c, ox, oy, C.woodEdge, w, 1); px(c, ox, oy + h - 1, C.woodEdge, w, 1); px(c, ox, oy, C.woodEdge, 1, h); px(c, ox + w - 1, oy, C.woodEdge, 1, h);
      px(c, ox + 1, oy + 1, C.woodHi, w - 2, 1); px(c, ox + 1, oy + h - 2, C.woodLo, w - 2, 1);
    } else if (kind === 'night') {
      wood(c, ox, oy, w, h, C.night, false, w + 5 * h);
      px(c, ox, oy, C.woodEdge, w, 1); px(c, ox, oy + h - 1, C.woodEdge, w, 1); px(c, ox, oy, C.woodEdge, 1, h); px(c, ox + w - 1, oy, C.woodEdge, 1, h);
      px(c, ox + 1, oy + 1, '#5a3a24', w - 2, 1); px(c, ox + 1, oy + 1, '#5a3a24', 1, h - 2);
      px(c, ox + 2, oy + 2, '#120a05', w - 4, 1);
    } else if (kind === 'well') {
      // углубление: бумага темнее, тень от верхней и левой кромки
      paper(c, ox, oy, w, h, C.paperLo, w + h);
      px(c, ox, oy, '#8a6c44', w, 1); px(c, ox, oy, '#8a6c44', 1, h);
      px(c, ox, oy + h - 1, C.paperHi, w, 1); px(c, ox + w - 1, oy, C.paperHi, 1, h);
      c.globalAlpha = 0.3; px(c, ox + 1, oy + 1, '#5a4024', w - 2, 2); px(c, ox + 1, oy + 1, '#5a4024', 2, h - 2); c.globalAlpha = 1;
    } else if (kind === 'tag') {
      // красная лента с зазубренными концами
      px(c, ox, oy, C.redDark, w, h); px(c, ox + 1, oy + 1, C.red, w - 2, h - 2);
      S.tint(c, ox + 1, oy + 1, w - 2, h - 2, (u, v) => 0.18 - 0.4 * v, { keepInk: false, steps: 12 });
      px(c, ox + 1, oy + 1, C.redHi, w - 2, 1);
      px(c, ox, oy, C.woodEdge, w, 1); px(c, ox, oy + h - 1, C.woodEdge, w, 1);
      px(c, ox, oy + 1, C.goldHi, 1, h - 2); px(c, ox + w - 1, oy + 1, C.goldHi, 1, h - 2);
    }
    G.gfx.smooth(c0);
    return (cache[key] = c0);
  }
  function panel(ctx, x, y, w, h, kind = 'frame') {
    ctx.drawImage(bake(kind, w, h), x - 2, y);
  }
  // область содержимого внутри панели (отступы под раму/валики)
  function inner(kind, x, y, w, h) {
    if (kind === 'scroll') return { x: x + 6, y: y + 8, w: w - 12, h: h - 16 };
    if (kind === 'frame') return { x: x + 7, y: y + 7, w: w - 14, h: h - 14 };
    if (kind === 'well') return { x: x + 3, y: y + 3, w: w - 6, h: h - 6 };
    return { x: x + 3, y: y + 3, w: w - 6, h: h - 6 };
  }

  // ---------- элементы ----------
  // строка списка: выделение — мазок красной кисти с мягкими краями (рисуется под текстом)
  function row(ctx, x, y, w, h, sel) {
    if (!sel) return;
    const img = brush(w, h);
    ctx.drawImage(img, x, y);
  }
  function brush(w, h) {
    const key = 'br:' + w + 'x' + h;
    if (cache[key]) return cache[key];
    const c0 = G.gfx.canvas(w, h), c = c0.getContext('2d');
    px(c, 0, 0, C.red, w, h);
    S.tint(c, 0, 0, w, h, (u, v) => 0.24 - 0.42 * v, { keepInk: false, steps: 12 });
    px(c, 0, 0, C.redHi, w, 1); px(c, 0, h - 1, C.redDark, w, 1);
    // рваные кончики мазка: кромка слева и справа
    for (let j = 0; j < h; j++) {
      const l = Math.floor(Hh(j, w, 11) * 3), r = Math.floor(Hh(w, j, 12) * 3);
      c.clearRect(0, j, l, 1); c.clearRect(w - r, j, r, 1);
    }
    c.globalAlpha = 0.25; px(c, 2, 1, '#fff', Math.max(2, w - 6), 1); c.globalAlpha = 1;
    return (cache[key] = c0);
  }
  // кнопка-дощечка
  function button(ctx, x, y, w, h, label, state = 'normal') {
    const key = 'bt:' + state + ':' + w + 'x' + h;
    let img = cache[key];
    if (!img) {
      const c0 = G.gfx.canvas(w, h + 1), c = c0.getContext('2d');
      const base = state === 'sel' ? C.red : state === 'on' ? C.gold : state === 'dis' ? '#4a3a2e' : C.wood;
      wood(c, 0, 0, w, h, base, false, w + h);
      px(c, 0, 0, C.woodEdge, w, 1); px(c, 0, h - 1, C.woodEdge, w, 1); px(c, 0, 0, C.woodEdge, 1, h); px(c, w - 1, 0, C.woodEdge, 1, h);
      px(c, 1, 1, tone(base, 0.35), w - 2, 1); px(c, 1, h - 2, tone(base, -0.4), w - 2, 1);
      for (const [cx, cy] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) c.clearRect(cx, cy, 1, 1);
      px(c, 0, h, '#0a0604', w, 1);
      img = cache[key] = c0;
    }
    ctx.drawImage(img, x, y);
    const col = state === 'dis' ? '#8a7a66' : state === 'on' ? C.ink : '#f8eed0';
    G.font.draw(ctx, label, x + w / 2, y + Math.round((h - G.font.CAP) / 2), { align: 'center', color: col, shadow: state === 'on' ? null : '#160c06', maxW: w - 6 });
  }
  // бамбуковая шкала
  function gauge(ctx, x, y, w, h, frac, color) {
    frac = Math.max(0, Math.min(1, frac));
    px(ctx, x, y, C.woodEdge, w, h);
    px(ctx, x + 1, y + 1, '#120a05', w - 2, h - 2);
    const iw = Math.round((w - 2) * frac);
    if (iw > 0) {
      px(ctx, x + 1, y + 1, color, iw, h - 2);
      px(ctx, x + 1, y + 1, tone(color, 0.45), iw, 1);                         // блик
      if (h > 4) px(ctx, x + 1, y + h - 2, tone(color, -0.4), iw, 1);
    }
    // коленца бамбука
    for (let i = 8; i < w - 2; i += 8) { px(ctx, x + i, y + 1, '#120a05', 1, h - 2); }
    px(ctx, x, y, '#5a3a24', w, 1);
  }
  // заголовок окна: красная лента над краем панели
  function title(ctx, text, cx, y, w) {
    const tw = Math.max(w || 0, G.font.measure(text) + 20), h = 15;
    panel(ctx, Math.round(cx - tw / 2), y, tw, h, 'tag');
    G.font.draw(ctx, text, cx, y + 3, { align: 'center', color: C.goldHi, shadow: C.redDark });
  }
  // вкладка
  function tab(ctx, x, y, w, h, label, active) {
    button(ctx, x, y, w, h, label, active ? 'sel' : 'normal');
  }
  function scrollbar(ctx, x, y, h, pos, size) {
    px(ctx, x, y, C.woodLo, 3, h); px(ctx, x + 1, y, C.woodEdge, 1, h);
    const th = Math.max(6, Math.round(h * size)), ty = y + Math.round((h - th) * pos);
    px(ctx, x, ty, C.gold, 3, th); px(ctx, x, ty, C.goldHi, 3, 1); px(ctx, x + 2, ty, tone(C.gold, -0.35), 1, th);
  }

  // ---------- значки 11×11 (формы строками; 'o' основной цвет, 'x' тёмный контур, 'h' блик) ----------
  const ICONS = {
    menu: ['...........', '.ooooooooo.', '...........', '.ooooooooo.', '...........', '.ooooooooo.', '...........', '...........', '...........', '...........', '...........'],
    map: ['...........', '.ooo.ooo.o.', '.ooo.ooo.o.', '.ooo.ooo.o.', '.oo.ooo.oo.', '.oo.ooo.oo.', '.o.ooo.ooo.', '.o.ooo.ooo.', '...........', '...........', '...........'],
    goal: ['..o........', '..oooooo...', '..ooooooo..', '..oooooo...', '..o........', '..o........', '..o........', '..o........', '.ooo.......', '...........', '...........'],
    back: ['...........', '....o......', '...oo......', '..ooo......', '.oooooooo..', '..ooo...oo.', '...oo....o.', '....o....o.', '.........o.', '.....ooooo.', '...........'],
    heart: ['...........', '.oo...oo...', 'oooo.oooo..', 'ooooooooo..', 'ooooooooo..', '.ooooooo...', '..ooooo....', '...ooo.....', '....o......', '...........', '...........'],
    drop: ['....o......', '....o......', '...ooo.....', '...ooo.....', '..ooooo....', '.ooooooo...', '.ooooooo...', '.ooooooo...', '..ooooo....', '...ooo.....', '...........'],
    bowl: ['..o.o.o....', '...o.o.o...', '...........', 'ooooooooooo', 'ooooooooooo', '.ooooooooo.', '..ooooooo..', '...ooooo...', '...........', '...........', '...........'],
    bolt: ['.....oo....', '....oo.....', '...oo......', '..ooooo....', '....oo.....', '...oo......', '..oo.......', '..o........', '...........', '...........', '...........'],
    coin: ['...ooooo...', '..ooooooo..', '.oo.ooo.oo.', '.oo.....oo.', '.oo.ooo.oo.', '.oo.....oo.', '.oo.ooo.oo.', '..ooooooo..', '...ooooo...', '...........', '...........'],
    leaf: ['.......ooo.', '.....ooooo.', '...ooooooo.', '..oooooooo.', '..ooooooo..', '.oo.oooo...', '.o..ooo....', '....o......', '...o.......', '..o........', '...........'],
    cross: ['...........', '...........', '.o.......o.', '..o.....o..', '...o...o...', '....ooo....', '...o...o...', '..o.....o..', '.o.......o.', '...........', '...........'],
    check: ['...........', '...........', '........oo.', '.......oo..', '..o...oo...', '..oo.oo....', '...ooo.....', '....o......', '...........', '...........', '...........'],
    sun: ['.....o.....', '.o...o...o.', '..o.....o..', '...ooooo...', 'o.ooooooo.o', '..ooooooo..', '..ooooooo..', '...ooooo...', '..o..o..o..', '.o...o...o.', '.....o.....'],
    moon: ['...ooooo...', '..ooo......', '.ooo.......', '.ooo.......', '.ooo.......', '.oooo......', '..ooooooo..', '...ooooo...', '...........', '...........', '...........'],
  };
  function icon(ctx, name, x, y, color = C.ink) {
    const rows = ICONS[name]; if (!rows) return;
    ctx.fillStyle = color;
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === 'o') ctx.fillRect(x + i, y + j, 1, 1); });
  }

  // ---------- окно-меню: заголовок-лента, строки по 20 px, мазок кисти под выбранной ----------
  // items: [{ label, value?, dis? }]; rect() и hit() нужны сценам для касаний
  const ROW = 20;
  const menu = {
    ROW,
    rect(n, w, o = {}) {
      const h = 24 + n * ROW + 10 + (o.extra || 0);
      return { x: Math.round((G.screen.W - w) / 2), y: Math.round((G.screen.H - h) / 2) - 6, w, h };
    },
    rowY(r, i) { return r.y + 20 + i * ROW; },
    hit(p, n, w, o) {
      const r = menu.rect(n, w, o), i = Math.floor((p.y - r.y - 20) / ROW);
      return p.x > r.x && p.x < r.x + r.w && i >= 0 && i < n ? i : -1;
    },
    draw(ctx, title, items, idx, w, o = {}) {
      const r = menu.rect(items.length, w, o), F = G.font;
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#0a0604'; ctx.fillRect(0, 0, G.screen.W, G.screen.H); ctx.globalAlpha = 1;
      panel(ctx, r.x, r.y, r.w, r.h, 'frame');
      title && U_title(ctx, title, r.x + r.w / 2, r.y - 7, 0);
      items.forEach((it, i) => {
        const y = menu.rowY(r, i), sel = i === idx;
        row(ctx, r.x + 6, y - 1, r.w - 12, ROW - 2, sel);
        const col = it.dis ? C.inkFaint : sel ? '#f8eed0' : C.ink;
        F.draw(ctx, it.label, r.x + 14, y + 3, { color: col, shadow: sel && !it.dis ? '#5a1408' : null, maxW: r.w - 28 - (it.value ? F.measure(it.value) + 8 : 0) });
        if (it.value) F.draw(ctx, it.value, r.x + r.w - 14, y + 3, { align: 'right', color: sel ? '#f4d46a' : C.redDark, shadow: sel ? '#5a1408' : null });
      });
      return r;
    },
  };
  const U_title = (...a) => title(...a);

  // фон полноэкранных окон: тёмное лакированное дерево с вертикальными досками
  function backdrop(ctx) {
    const W = G.screen.W, H = G.screen.H, key = 'bd:' + W + 'x' + H;
    if (!cache[key]) {
      for (const k of Object.keys(cache)) if (k.startsWith('bd:')) delete cache[k];
      const c0 = G.gfx.canvas(W, H), c = c0.getContext('2d');
      wood(c, 0, 0, W, H, C.night, true, 7);
      for (let x = 34; x < W; x += 34 + Math.floor(Hh(x, 1, 2) * 16)) { px(c, x, 0, C.woodEdge, 1, H); px(c, x + 1, 0, '#3a2418', 1, H); }
      S.tint(c, 0, 0, W, H, (u, v) => -0.1 - 0.3 * Math.hypot(u - 0.5, v - 0.5), { keepInk: false, steps: 12 });
      cache[key] = c0;
    }
    ctx.drawImage(cache[key], 0, 0);
  }
  // карточка предмета/ячейка: светлая бумага; выбранная — красная лаковая рамка
  // (запекается: S.tint работает только с «подробными» холстами, не с экраном)
  function card(ctx, x, y, w, h, sel) {
    const key = 'cd:' + (sel ? 1 : 0) + ':' + w + 'x' + h;
    let img = cache[key];
    if (!img) {
      const c0 = G.gfx.canvas(w, h), c = c0.getContext('2d');
      px(c, 0, 0, sel ? C.redDark : '#a8885a', w, h);
      px(c, 1, 1, sel ? C.red : '#c8b27c', w - 2, h - 2);
      px(c, 2, 2, sel ? C.paperHi : '#e4d4a4', w - 4, h - 4);
      S.tint(c, 2, 2, w - 4, h - 4, (u, v) => 0.12 - 0.22 * v, { keepInk: false, steps: 10 });
      if (sel) px(c, 1, 1, C.redHi, w - 2, 1);
      img = cache[key] = c0;
    }
    ctx.drawImage(img, x, y);
  }

  return { C, panel, inner, row, button, gauge, title, tab, scrollbar, icon, menu, backdrop, card, wood, paper, dropShadow, stud, knot };
})();
