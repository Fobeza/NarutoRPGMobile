// Иконки предметов V9 — рисуются кодом, как персонажи: формы → объём (свет сверху-слева, 5 ступеней)
// → контур по силуэту → мягкая тень. Холст 48×48 лог. px (96×96 тонких), кэш по id.
//   G.icons.canvas(id) → холст или null;  G.icons.draw(ctx, id, x, y, w, h) — по центру ячейки w×h
G.icons = (() => {
  const N = 48, K = 2;
  const INK = [30, 22, 36];
  const S = G.shade;
  const pack = (c) => ((255 << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0])) >>> 0;

  // ---------- формы (координаты 0..48) ----------
  const E = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const R = (x0, y0, x1, y1) => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
  const RR = (x0, y0, x1, y1, r) => (x, y) => {
    if (!(x >= x0 && x < x1 && y >= y0 && y < y1)) return false;
    const cx = Math.max(x0 + r, Math.min(x1 - r, x)), cy = Math.max(y0 + r, Math.min(y1 - r, y));
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  const PO = (pts) => (x, y) => {
    let ins = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  };
  // толстый отрезок (палочка, рукоять, леска)
  const LN = (x0, y0, x1, y1, r) => (x, y) => {
    const dx = x1 - x0, dy = y1 - y0, t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy)));
    return (x - x0 - dx * t) ** 2 + (y - y0 - dy * t) ** 2 <= r * r;
  };
  const OR = (...f) => (x, y) => f.some((g) => g(x, y));
  const AND = (a, b) => (x, y) => a(x, y) && b(x, y);
  const SUB = (a, b) => (x, y) => a(x, y) && !b(x, y);
  const ROT = (f, cx, cy, a) => { const c = Math.cos(-a), s = Math.sin(-a); return (x, y) => f(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c); };

  // ---------- буфер ----------
  function fill(B, pred, color, o = {}) {
    const { c, base } = B, w = B.w, h = B.h, m = new Uint8Array(w * h);
    // грубый проход через 1 лог. px находит рамку формы — точный проход только внутри неё (+запас)
    let gx0 = w, gx1 = -1, gy0 = h, gy1 = -1;
    for (let j = 1; j < h; j += K) for (let i = 1; i < w; i += K) if (pred(i / K, j / K)) { if (i < gx0) gx0 = i; if (i > gx1) gx1 = i; if (j < gy0) gy0 = j; if (j > gy1) gy1 = j; }
    const sx0 = gx1 < 0 ? 0 : Math.max(0, gx0 - 3 * K), sx1 = gx1 < 0 ? w - 1 : Math.min(w - 1, gx1 + 3 * K);
    const sy0 = gx1 < 0 ? 0 : Math.max(0, gy0 - 3 * K), sy1 = gx1 < 0 ? h - 1 : Math.min(h - 1, gy1 + 3 * K);
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let j = sy0; j <= sy1; j++) { const y = (j + 0.5) / K; for (let i = sx0; i <= sx1; i++) if (pred((i + 0.5) / K, y)) { m[j * w + i] = 1; if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; } }
    if (x1 < 0) return;
    const bc = S.rgb(color), bp = pack(bc);
    const LT = o.lit ?? 0.36, DK = o.dark ?? 0.42;
    const tones = [pack(S.tone(bc, -DK)), pack(S.tone(bc, -DK * 0.5)), bp, pack(S.tone(bc, LT * 0.5)), pack(S.tone(bc, LT))];
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, Nn = bw * bh;
    const dU = new Uint16Array(Nn), dD = new Uint16Array(Nn), dL = new Uint16Array(Nn), dR = new Uint16Array(Nn);
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) { const q = j * bw + i, on = m[(j + y0) * w + i + x0]; dU[q] = on ? (j ? dU[q - bw] : 0) + 1 : 0; dL[q] = on ? (i ? dL[q - 1] : 0) + 1 : 0; }
    for (let j = bh - 1; j >= 0; j--) for (let i = bw - 1; i >= 0; i--) { const q = j * bw + i, on = m[(j + y0) * w + i + x0]; dD[q] = on ? (j < bh - 1 ? dD[q + bw] : 0) + 1 : 0; dR[q] = on ? (i < bw - 1 ? dR[q + 1] : 0) + 1 : 0; }
    const seam = pack(S.mix(bc, INK, 0.5));
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      if (!m[j * w + i]) continue;
      let col = bp;
      if (!o.flat) {
        const q = (j - y0) * bw + (i - x0);
        const vy = (dD[q] - dU[q]) / (dD[q] + dU[q]), vx = (dR[q] - dL[q]) / (dR[q] + dL[q]);
        let v = vy * (o.vy ?? 0.95) + vx * (o.vx ?? 0.7);
        if (dD[q] <= 2 || dR[q] <= 2) v = Math.min(v, -1.2);
        else if (dU[q] <= 2 || dL[q] <= 2) v = Math.max(v, 1);
        col = tones[Math.max(-2, Math.min(2, Math.floor(v * 1.25 + 0.5 + (S.bayer(i, j) - 0.5) * 0.45))) + 2];
      }
      if (o.seam) for (const [a, b] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const ii = i + a, jj = j + b;
        if (ii >= 0 && jj >= 0 && ii < w && jj < h && !m[jj * w + ii] && c[jj * w + ii]) { col = seam; break; }
      }
      c[j * w + i] = col; base[j * w + i] = bp;
    }
  }
  const flat = (B, pred, color) => fill(B, pred, color, { flat: true });
  function outline(B, mixK = 0.75) {
    const { c, base } = B, w = B.w, hh = B.h, add = [];
    for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
      if (c[j * w + i]) continue;
      let nb = 0;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const ii = i + a, jj = j + b;
        if (ii >= 0 && jj >= 0 && ii < w && jj < hh && c[jj * w + ii]) { nb = base[jj * w + ii]; break; }
      }
      if (nb) add.push([j * w + i, nb]);
    }
    for (const [q, nb] of add) c[q] = pack(S.mix([nb & 255, (nb >> 8) & 255, (nb >> 16) & 255], INK, mixK));
  }

  // ---------- общие заготовки ----------
  function bowl(B, broth, o = {}) {
    const big = o.big ? 2 : 0;
    fill(B, E(24, 26, 19 + big, 7), broth, { lit: 0.25, dark: 0.3 });                       // бульон
    if (o.noodles) for (let i = 0; i < 5; i++) flat(B, AND(E(24, 26, 17, 5.5), LN(10 + i * 6, 23, 14 + i * 6, 29, 0.8)), '#f8dc8a');
    (o.top || []).forEach((f) => f());
    fill(B, SUB(E(24, 30, 20 + big, 13 + big), E(24, 26, 19 + big, 7)), o.col || '#c8401c', { vy: 0.5 });   // миска
    flat(B, AND(E(24, 30, 20 + big, 13 + big), R(4, 34, 44, 35)), '#f4ecd8');                     // поясок
    fill(B, RR(17, 41 + big, 31, 45 + big, 1.5), o.col ? S.toneHex(o.col, -0.25) : '#8a2a10');   // донце
  }
  const steam = (B, x) => { for (let i = 0; i < 3; i++) flat(B, LN(x + i * 7, 15, x + i * 7 + 2, 8, 0.8), '#ffffff'); };
  function cup(B, liquid, body) {
    fill(B, OR(RR(11, 18, 35, 40, 4), E(23, 40, 12, 3)), body, { vy: 0.4 });
    fill(B, E(23, 19, 12, 3.4), liquid, { lit: 0.3 });
    fill(B, SUB(E(37, 28, 6, 6), E(37, 28, 3, 3)), body);
  }
  function bouquet(B, cols, n) {
    fill(B, PO([[15, 24], [33, 24], [27, 45], [21, 45]]), '#5a9a3a', { vy: 0.3 });             // стебли
    fill(B, PO([[13, 28], [35, 28], [28, 43], [20, 43]]), '#f0e6d0');                          // обёртка
    flat(B, R(20, 36, 28, 38), '#d84a6a');
    const spots = [[24, 15], [16, 18], [32, 18], [20, 24], [29, 24], [12, 25], [36, 25], [24, 8], [17, 10], [31, 10]].slice(0, n);
    spots.forEach(([x, y], i) => { fill(B, E(x, y, 5, 5), cols[i % cols.length], { seam: true }); flat(B, E(x - 0.5, y - 0.5, 1.5, 1.5), '#f8e070'); });
  }
  function bag(B, col, label) {
    fill(B, PO([[11, 14], [37, 14], [40, 44], [8, 44]]), col, { seam: true });
    fill(B, R(13, 10, 35, 15), S.toneHex(col, -0.2));
    if (label) label();
  }
  function bottle(B, col, liquid) {
    fill(B, OR(RR(14, 18, 34, 44, 5), RR(19, 9, 29, 19, 1)), col);
    if (liquid) fill(B, RR(15, 27, 33, 43, 4), liquid);
    fill(B, RR(18, 5, 30, 10, 1.5), '#8a5a34');
  }
  function fish(B, body, belly, o = {}) {
    const L = o.long ? 1.3 : 1;
    fill(B, OR(E(22, 24, 15 * L, 8 * (o.long ? 0.6 : 1)), PO([[34 * (o.long ? 1.05 : 1), 24], [45, 15], [45, 33]])), body, { seam: true });
    flat(B, AND(E(22, 24, 15 * L, 8 * (o.long ? 0.6 : 1)), R(4, 26, 40, 40)), belly);
    flat(B, E(12, 22, 2, 2), '#ffffff'); flat(B, E(12, 22, 1, 1), '#14121c');
    if (!o.long) fill(B, PO([[20, 17], [28, 12], [29, 18]]), S.toneHex(body, -0.2));
  }
  function book(B, col, deco) {
    fill(B, RR(9, 8, 39, 42, 2), col, { seam: true });
    fill(B, R(13, 10, 38, 40), '#f4ecd8', { vy: 0.3 });
    fill(B, RR(9, 8, 15, 42, 2), S.toneHex(col, -0.15));
    if (deco) deco();
  }
  function scroll(B, paper, ink) {
    fill(B, R(10, 13, 38, 35), paper, { vy: 0.4 });
    for (let i = 0; i < 4; i++) flat(B, R(14, 17 + i * 4, 33 - (i % 2) * 6, 18 + i * 4), ink);
    fill(B, RR(7, 9, 41, 15, 3), '#a8683a'); fill(B, RR(7, 33, 41, 39, 3), '#a8683a');
    fill(B, E(6, 12, 2.5, 3.5), '#c8401c'); fill(B, E(42, 12, 2.5, 3.5), '#c8401c'); fill(B, E(6, 36, 2.5, 3.5), '#c8401c'); fill(B, E(42, 36, 2.5, 3.5), '#c8401c');
  }
  function bomb(B, col, spark) {
    fill(B, E(23, 28, 13, 13), col);
    fill(B, RR(19, 12, 28, 17, 1), '#5a5a6a');
    flat(B, LN(24, 12, 30, 5, 0.9), '#8a6a3a');
    fill(B, E(31, 4.5, 3, 3), spark); flat(B, E(31, 4.5, 1.3, 1.3), '#fff8c0');
  }

  // ---------- рисунки ----------
  const DEF = {
    ramen_miso: (B) => { bowl(B, '#c8843a', { noodles: true, top: [() => fill(B, E(30, 24, 4, 2.5), '#f8f0d8'), () => flat(B, E(30, 24, 1.8, 1.2), '#f0b030'), () => fill(B, R(14, 21, 20, 25), '#3a6a2a')] }); steam(B, 16); },
    ramen_pork: (B) => { bowl(B, '#e8c890', { noodles: true, top: [() => fill(B, E(18, 24, 6, 3.5), '#c8786a'), () => fill(B, E(30, 25, 6, 3.5), '#c8786a'), () => flat(B, E(18, 24, 3, 1.5), '#f0c8b0')] }); steam(B, 16); },
    ramen_big: (B) => { bowl(B, '#d89a4a', { big: true, noodles: true, col: '#2a4a9a', top: [() => fill(B, E(17, 24, 5, 3), '#c8786a'), () => fill(B, E(31, 24, 5, 3), '#c8786a'), () => fill(B, E(24, 22, 4, 2.5), '#f8f0d8'), () => flat(B, E(24, 22, 1.6, 1.2), '#f0b030')] }); steam(B, 15); },
    yakiniku_one: (B) => {
      fill(B, E(24, 32, 21, 10), '#3a3a48'); flat(B, AND(E(24, 32, 18, 8), OR(...[0, 1, 2, 3, 4].map((i) => R(8 + i * 7, 22, 9 + i * 7, 42)))), '#6a6a7a');
      fill(B, E(17, 30, 7, 4), '#a84a3a', { seam: true }); fill(B, E(29, 28, 7, 4), '#b85a42', { seam: true }); fill(B, E(26, 35, 6, 3.5), '#983a2e', { seam: true });
      flat(B, LN(14, 30, 20, 29, 0.5), '#e8a080'); flat(B, LN(26, 28, 32, 27, 0.5), '#e8a080'); steam(B, 14);
    },
    dango: (B) => {
      fill(B, LN(10, 42, 40, 6, 1.4), '#c8a060');
      fill(B, E(15, 35, 6.5, 6.5), '#9ad070', { seam: true }); fill(B, E(23, 25, 6.5, 6.5), '#f8f0e0', { seam: true }); fill(B, E(31, 15, 6.5, 6.5), '#f4a0b8', { seam: true });
    },
    sweet_tea: (B) => { cup(B, '#b86a32', '#f0e6d0'); flat(B, R(18, 26, 28, 33), '#c8401c'); steam(B, 15); },
    green_tea: (B) => { cup(B, '#7aa83a', '#5a8a4a'); flat(B, R(13, 30, 33, 32), '#3a5a2a'); steam(B, 15); },
    herb_tea: (B) => { cup(B, '#c89a4a', '#e8dcc0'); fill(B, ROT(E(22, 30, 6, 3), 22, 30, -0.6), '#4a9a3a'); steam(B, 15); },
    mochi: (B) => {
      fill(B, E(24, 38, 20, 6), '#a8683a');
      fill(B, E(15, 29, 8, 7), '#f8f4ec', { seam: true }); fill(B, E(32, 29, 8, 7), '#f0d8e0', { seam: true }); fill(B, E(24, 22, 8, 7), '#e0ecd0', { seam: true });
      flat(B, E(24, 21, 2, 1), '#8a4a3a');
    },
    berries: (B) => {
      fill(B, PO([[18, 8], [30, 6], [26, 14]]), '#4a9a3a');
      [[17, 22], [28, 21], [22, 31], [33, 31], [13, 33], [26, 40]].forEach(([x, y], i) => { fill(B, E(x, y, 6, 6), i % 2 ? '#6a2a6a' : '#8a2a5a', { seam: true }); flat(B, E(x - 2, y - 2, 1.3, 1.3), '#f8d0f0'); });
    },
    candy: (B) => {
      fill(B, PO([[6, 16], [14, 22], [14, 30], [6, 36]]), '#f0c040'); fill(B, PO([[42, 16], [34, 22], [34, 30], [42, 36]]), '#f0c040');
      fill(B, E(24, 26, 12, 9), '#e84a6a'); flat(B, AND(E(24, 26, 12, 9), OR(LN(16, 20, 22, 34, 1.3), LN(25, 18, 31, 34, 1.3))), '#ffffff');
    },
    bandage: (B) => {
      fill(B, OR(E(18, 26, 12, 14), R(18, 12, 38, 40)), '#f4f0e8', { vy: 0.6 }); fill(B, E(38, 26, 5, 14), '#e8e0d0');
      fill(B, E(38, 26, 2.5, 7), '#c8c0b0'); flat(B, R(22, 24, 30, 28), '#e84a3a'); flat(B, R(24, 22, 28, 30), '#e84a3a');
    },
    ointment: (B) => {
      fill(B, RR(10, 20, 38, 42, 4), '#e8dcc8'); fill(B, RR(9, 12, 39, 21, 3), '#3a8a5a');
      flat(B, R(14, 27, 34, 36), '#f4ecd8'); flat(B, R(22, 28, 26, 35), '#3a8a5a'); flat(B, R(20, 30, 28, 33), '#3a8a5a');
    },
    chakra_pill: (B) => {
      fill(B, E(18, 28, 9, 9), '#4a7ad0'); fill(B, E(31, 22, 8, 8), '#6a9ae8'); fill(B, E(29, 36, 7, 7), '#3a62b8');
      flat(B, E(15, 25, 2, 2), '#e0f0ff'); flat(B, E(29, 19, 1.8, 1.8), '#e0f0ff');
    },
    antidote: (B) => {
      fill(B, OR(E(24, 32, 12, 11), R(20, 10, 28, 24)), '#d8ecf0'); fill(B, AND(E(24, 32, 11, 10), R(0, 28, 48, 48)), '#6ac05a');
      fill(B, RR(18, 6, 30, 11, 1), '#8a5a34'); flat(B, E(19, 28, 2, 3), '#ffffff');
    },
    onsen_bath: (B) => {
      fill(B, OR(RR(8, 22, 40, 42, 4)), '#a8683a', { seam: true }); flat(B, R(8, 28, 40, 30), '#5a3a24'); flat(B, R(8, 36, 40, 38), '#5a3a24');
      fill(B, E(24, 22, 16, 3.5), '#7ac0f0'); for (let i = 0; i < 3; i++) flat(B, LN(14 + i * 9, 18, 17 + i * 9, 6, 1), '#ffffff');
    },
    herb: (B) => {
      flat(B, LN(24, 44, 24, 18, 1), '#3a6a2a');
      [[-0.7, 16, 20], [0.7, 32, 20], [-0.5, 17, 31], [0.5, 31, 31], [0, 24, 11]].forEach(([a, x, y]) => fill(B, ROT(E(x, y, 8, 4), x, y, a), '#4aa04a', { seam: true }));
      flat(B, LN(14, 20, 22, 21, 0.4), '#2e6a2e'); flat(B, LN(26, 21, 34, 20, 0.4), '#2e6a2e');
    },
    herb_blue: (B) => {
      fill(B, E(24, 38, 16, 5), '#2e6a32');
      [[-0.9, 14], [-0.4, 19], [0, 24], [0.4, 29], [0.9, 34]].forEach(([a, x]) => fill(B, ROT(E(x, 26, 4, 10), x, 34, a), a ? '#6a9ae8' : '#8ab8ff', { seam: true }));
      fill(B, E(24, 32, 4, 3), '#f0d040');
    },
    kunai: (B) => {
      fill(B, ROT(PO([[24, 2], [30, 14], [27, 26], [21, 26], [18, 14]]), 24, 24, 0.75), '#c8ccd8', { vx: 0.9 });
      fill(B, ROT(R(22, 26, 26, 38), 24, 24, 0.75), '#3a3a4a'); flat(B, ROT(OR(R(22, 29, 26, 30), R(22, 33, 26, 34)), 24, 24, 0.75), '#8a6a4a');
      fill(B, ROT(SUB(E(24, 42, 4.5, 4.5), E(24, 42, 2.2, 2.2)), 24, 24, 0.75), '#6a6a7a');
    },
    shuriken: (B) => {
      const star = OR(...[0, 1, 2, 3].map((i) => ROT(PO([[24, 3], [28, 20], [20, 20]]), 24, 24, i * Math.PI / 2 + 0.3)), E(24, 24, 8, 8));
      fill(B, SUB(star, E(24, 24, 3, 3)), '#a8acbc', { vx: 0.9 });
    },
    wire: (B) => {
      for (let i = 0; i < 4; i++) fill(B, SUB(E(24, 24 + i * 0.5, 17 - i * 3, 13 - i * 2.4), E(24, 24 + i * 0.5, 15.5 - i * 3, 11.5 - i * 2.4)), '#b8bccc');
      flat(B, LN(38, 30, 45, 40, 0.8), '#b8bccc');
    },
    smoke_bomb: (B) => { bomb(B, '#6a6a7a', '#ff8a3a'); for (let i = 0; i < 3; i++) fill(B, E(36 + i * 3, 36 - i * 7, 4, 3.5), '#d8d8e4'); },
    flash_bomb: (B) => { bomb(B, '#f0c040', '#ffffff'); flat(B, OR(LN(40, 20, 46, 18, 0.7), LN(40, 28, 46, 30, 0.7), LN(38, 12, 43, 8, 0.7)), '#fff8a0'); },
    tag_explosive: (B) => {
      fill(B, ROT(R(15, 4, 33, 44), 24, 24, 0.12), '#f0e2b0', { vy: 0.3 });
      flat(B, ROT(OR(R(22, 10, 26, 36), R(18, 16, 30, 19), R(17, 26, 31, 29), LN(19, 33, 23, 38, 1), LN(29, 33, 25, 38, 1)), 24, 24, 0.12), '#c8281c');
      flat(B, ROT(R(15, 4, 33, 7), 24, 24, 0.12), '#c8281c');
    },
    fishing_rod: (B) => {
      fill(B, LN(6, 44, 36, 6, 1.6), '#a8683a'); fill(B, LN(6, 44, 13, 35, 2.4), '#5a3a24');
      fill(B, SUB(E(14, 34, 4, 4), E(14, 34, 2, 2)), '#8a8a98');
      flat(B, LN(36, 6, 40, 30, 0.4), '#e8e8f0'); fill(B, E(40, 33, 3, 3), '#e84a3a'); flat(B, R(37, 33, 43, 34), '#ffffff');
    },
    book_history: (B) => book(B, '#2a4a9a', () => { flat(B, E(26, 22, 6, 6), '#c8a040'); flat(B, E(26, 22, 3, 3), '#f4ecd8'); flat(B, R(18, 32, 34, 34), '#8a7a6a'); }),
    book_traps: (B) => scroll(B, '#f0e2b0', '#5a4a3a'),
    map_secrets: (B) => {
      fill(B, PO([[6, 10], [18, 6], [30, 10], [42, 6], [42, 38], [30, 42], [18, 38], [6, 42]]), '#e8d8a8', { vy: 0.3, vx: 0.3 });
      flat(B, OR(R(18, 6, 19, 38), R(30, 10, 31, 42)), '#c8b080');
      flat(B, OR(LN(10, 34, 16, 26, 0.6), LN(16, 26, 24, 28, 0.6), LN(24, 28, 30, 18, 0.6)), '#8a5a3a');
      flat(B, OR(LN(30, 14, 36, 20, 1), LN(36, 14, 30, 20, 1)), '#d8281c');
    },
    notebook: (B) => {
      fill(B, RR(10, 6, 40, 44, 2), '#e8621a', { seam: true }); fill(B, R(15, 14, 36, 24), '#f4ecd8');
      for (let i = 0; i < 6; i++) fill(B, E(10, 9 + i * 6.5, 2.5, 2), '#8a8a98');
      flat(B, R(18, 17, 33, 18), '#8a7a6a'); flat(B, R(18, 20, 30, 21), '#8a7a6a');
    },
    rice: (B) => {
      bag(B, '#e8dcc0', () => { flat(B, E(24, 30, 7, 7), '#c8401c'); flat(B, R(21, 29, 27, 31), '#f4ecd8'); });
      fill(B, E(24, 12, 10, 3), '#ffffff');
    },
    fish: (B) => fish(B, '#6a8aa8', '#dce4ea'),
    carp: (B) => { fish(B, '#f0a020', '#ffe8a0'); flat(B, OR(E(20, 21, 2.5, 2), E(27, 25, 2.5, 2)), '#ffd860'); },
    eel: (B) => fish(B, '#3a4a3a', '#8a9a7a', { long: true }),
    vegetables: (B) => {
      fill(B, E(30, 30, 12, 11), '#7ac04a', { seam: true }); flat(B, OR(LN(30, 20, 30, 40, 0.6), LN(30, 30, 38, 24, 0.5), LN(30, 33, 22, 26, 0.5)), '#c8e8a0');
      fill(B, ROT(PO([[10, 12], [18, 12], [14, 40]]), 14, 26, -0.4), '#f08a2a', { seam: true });
      fill(B, ROT(PO([[10, 4], [14, 12], [18, 4], [16, 13], [12, 13]]), 14, 26, -0.4), '#4aa04a');
    },
    eggs: (B) => { fill(B, E(17, 28, 8, 10), '#f4ecd8', { seam: true }); fill(B, E(31, 30, 8, 10), '#e8d0a8', { seam: true }); fill(B, E(24, 38, 18, 5), '#a8683a'); },
    milk: (B) => { bottle(B, '#e8f0f4', '#ffffff'); flat(B, R(17, 31, 31, 37), '#4a7ad0'); },
    parcel: (B) => {
      fill(B, R(8, 16, 40, 42), '#c8925a', { seam: true }); fill(B, PO([[8, 16], [14, 8], [46, 8], [40, 16]]), '#e0aa70');
      fill(B, PO([[40, 16], [46, 8], [46, 34], [40, 42]]), '#a8763e');
      flat(B, OR(R(22, 16, 25, 42), PO([[22, 16], [25, 16], [31, 8], [28, 8]])), '#e84a3a');
    },
    boot: (B) => {
      fill(B, OR(R(14, 6, 28, 34), RR(12, 28, 42, 42, 4)), '#6a5a3a', { seam: true });
      fill(B, R(12, 40, 42, 44), '#3a2a1a'); flat(B, R(14, 10, 28, 12), '#4a3a2a');
      fill(B, E(38, 12, 4, 3), '#4a8a5a');
    },
    towel: (B) => {
      fill(B, RR(6, 14, 42, 36, 4), '#7ac0e0', { vy: 0.7 }); fill(B, RR(6, 24, 42, 36, 4), '#5aa0d0');
      flat(B, OR(R(6, 30, 42, 31), R(6, 33, 42, 34)), '#f4f8fa');
    },
    flowers_s: (B) => bouquet(B, ['#ffffff', '#f8f4e8'], 5),
    flowers_m: (B) => bouquet(B, ['#d82a4a', '#e84a5a'], 7),
    flowers_l: (B) => bouquet(B, ['#d82a4a', '#f4a0c0', '#f0d040', '#ffffff', '#a86ad0'], 10),
    bouquet_ino: (B) => bouquet(B, ['#a86ad0', '#7a5aa0', '#f4a0c0', '#ffffff'], 9),
    dog_food: (B) => bag(B, '#c8401c', () => { fill(B, OR(E(18, 31, 3, 3), E(30, 31, 3, 3), R(18, 29, 30, 33)), '#f4ecd8'); flat(B, E(24, 22, 4, 3), '#f4ecd8'); }),
    dog_treat: (B) => {
      const bone = OR(LN(12, 30, 36, 18, 3.5), E(10, 27, 4, 4), E(13, 34, 4, 4), E(35, 14, 4, 4), E(38, 21, 4, 4));
      fill(B, bone, '#f0e2c0');
    },
    shogi: (B) => {
      fill(B, PO([[4, 30], [24, 20], [44, 30], [24, 40]]), '#e0b060');
      fill(B, PO([[4, 30], [24, 40], [24, 44], [4, 34]]), '#a8763e'); fill(B, PO([[44, 30], [24, 40], [24, 44], [44, 34]]), '#8a5a2e');
      for (let i = 1; i < 4; i++) flat(B, OR(LN(4 + i * 5, 30 - i * 2.5, 24 + i * 5, 40 - i * 2.5, 0.3), LN(24 - i * 5, 20 + i * 2.5 + 0, 44 - i * 5, 30 + i * 2.5, 0.3)), '#8a5a2e');
      fill(B, PO([[20, 10], [24, 6], [28, 10], [29, 22], [19, 22]]), '#f0dca0'); flat(B, R(22, 13, 26, 15), '#2a1e18');
    },
    chips: (B) => bag(B, '#f0a020', () => { fill(B, E(24, 30, 8, 6), '#ffd860'); flat(B, R(15, 20, 33, 22), '#c8401c'); }),
    hairpin: (B) => {
      fill(B, LN(8, 42, 34, 14, 1.2), '#c8ccd8');
      [[0, 34, 9], [1.26, 41, 13], [2.5, 39, 20], [3.77, 32, 20], [5, 30, 13]].forEach(([, x, y]) => fill(B, E(x, y, 4.2, 4.2), '#f4a0c0', { seam: true }));
      fill(B, E(35, 15, 3, 3), '#f0d040');
    },
    tomato: (B) => {
      fill(B, E(18, 29, 10, 10), '#d8281c'); fill(B, E(31, 31, 9, 9), '#e83a2a');
      fill(B, PO([[13, 19], [18, 22], [23, 19], [18, 17]]), '#3a8a2a'); fill(B, PO([[27, 22], [31, 25], [35, 22], [31, 20]]), '#3a8a2a');
    },
    bug_jar: (B) => {
      fill(B, RR(11, 12, 37, 44, 6), '#c8e0e8', { lit: 0.3 }); fill(B, RR(13, 6, 35, 13, 2), '#8a5a34');
      [[18, 24], [28, 20], [24, 32], [30, 36], [17, 37]].forEach(([x, y]) => { fill(B, E(x, y, 3.2, 3.2), '#e8f080', { flat: true }); flat(B, E(x, y, 1.4, 1.4), '#ffffff'); });
      flat(B, R(14, 16, 16, 34), '#ffffff');
    },
    weights: (B) => {
      for (const y of [16, 34]) { fill(B, RR(6, y - 6, 42, y + 6, 4), '#3a5a8a', { seam: true }); flat(B, OR(...[0, 1, 2, 3].map((i) => R(12 + i * 7, y - 5, 13 + i * 7, y + 5))), '#2a3a5a'); fill(B, RR(18, y - 3, 30, y + 3, 1), '#c8ccd8'); }
    },
    // знак Листа (не предмет): лист со спиралью
    emblem: (B) => {
      fill(B, OR(E(22, 24, 15, 14), PO([[30, 14], [44, 4], [36, 22]])), '#f0b030', { seam: true });
      flat(B, SUB(E(21, 25, 9, 8.5), E(21, 25, 6.5, 6)), '#5a3418');
      flat(B, SUB(E(22, 26, 4.5, 4), E(22, 26, 2.2, 2)), '#5a3418');
      flat(B, OR(LN(29, 25, 38, 13, 1.3), LN(14, 32, 8, 40, 1.4)), '#5a3418');
      flat(B, AND(E(22, 24, 15, 14), R(0, 0, 48, 30)), '#f0b030');
      flat(B, SUB(AND(E(21, 25, 9, 8.5), R(0, 0, 48, 30)), E(21, 25, 6.5, 6)), '#5a3418');
      flat(B, SUB(E(22, 26, 4.5, 4), E(22, 26, 2.2, 2)), '#5a3418');
    },
    charm: (B) => {
      fill(B, RR(13, 14, 35, 44, 5), '#c8281c', { seam: true }); fill(B, RR(17, 22, 31, 36, 2), '#f0c040');
      flat(B, OR(R(23, 24, 25, 34), R(19, 27, 29, 29)), '#c8281c');
      fill(B, SUB(E(24, 10, 5, 6), E(24, 10, 2.5, 3.5)), '#f0c040');
    },
  };

  const cache = {};
  function canvas(id) {
    if (id in cache) return cache[id];
    const fn = DEF[id] || (G.ITEMS && G.ITEMS[id] ? (B) => bag(B, '#8a6a4a', () => flat(B, E(24, 28, 4, 4), '#f0c040')) : null);
    if (!fn) return (cache[id] = null);
    const c = raster(N, N, (B) => { fn(B); outline(B); }, (ctx) => S.shadow(ctx, 25, 44, 15, 3, 0.3));   // мягкая тень под предметом
    return (cache[id] = c);
  }
  // растеризатор форм на холст w×h лог. px: fn(B) рисует формами (fill / flat / outline), under(ctx) — подложка
  function raster(w, h, fn, under) {
    const B = { w: w * K, h: h * K, c: new Uint32Array(w * K * h * K), base: new Uint32Array(w * K * h * K) };
    fn(B);
    const c = G.gfx.canvas(w, h), ctx = c.getContext('2d');
    if (under) under(ctx);
    const t = document.createElement('canvas'); t.width = B.w; t.height = B.h;
    const tc = t.getContext('2d'), img = tc.createImageData(B.w, B.h);
    new Uint32Array(img.data.buffer).set(B.c); tc.putImageData(img, 0, 0);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(t, 0, 0); ctx.restore();
    return c;
  }
  // в ячейку w×h — по центру, родным размером (48), если помещается
  function draw(ctx, id, x, y, w, h) {
    const c = canvas(id); if (!c) return false;
    const s = Math.min(N, w, h);
    ctx.drawImage(c, Math.round(x + (w - s) / 2), Math.round(y + (h - s) / 2), s, s);
    return true;
  }
  return { canvas, draw, raster, fill, flat, outline, shapes: { E, R, RR, PO, LN, OR, AND, SUB, ROT } };
})();
