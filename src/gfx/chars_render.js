// Персонажи 2.0: процедурная отрисовка в удвоенном разрешении (кадр 32×40 «тонких» пикселей на 16×20 логических).
// Каждая деталь — геометрическая форма со светотенью (свет сверху-слева), автоматическим контуром и швами между частями.
// Подменяет G.chars.sheet / draw / portrait; описание персонажей (G.chars.DEFS) остаётся прежним: hair, band, marks, skin, colors.
(() => {
  const FW = 16, FH = 20, FWH = 32, FHH = 40;
  const P = G.PAL;
  const DARKT = [38, 28, 70], LITET = [255, 244, 200], INK = [30, 22, 36];

  // ---------- цвет ----------
  const rgb = (h) => { if (Array.isArray(h)) return h; h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const pack = (c) => ((255 << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0])) >>> 0;
  const dk = (c, t = 0.32) => mix(rgb(c), DARKT, t), lt = (c, t = 0.3) => mix(rgb(c), LITET, t);

  // ---------- формы ----------
  const E = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const R = (x0, y0, x1, y1) => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
  const RR = (x0, y0, x1, y1, r) => (x, y) => {
    if (!(x >= x0 && x < x1 && y >= y0 && y < y1)) return false;
    const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x, cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
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
  const TRI = (cx, by, tx, ty, hw) => PO([[cx - hw, by], [cx + hw, by], [tx, ty]]);
  const OR = (...f) => (x, y) => f.some((g) => g(x, y));
  const AND = (a, b) => (x, y) => a(x, y) && b(x, y);
  const SUB = (a, b) => (x, y) => a(x, y) && !b(x, y);
  const MIR = (f, cx = 16) => (x, y) => f(2 * cx - x, y);          // зеркало формы относительно вертикали x = cx
  const SH = (f, dx, dy) => (x, y) => f(x - dx, y - dy);            // сдвиг формы

  // ---------- холст пикселей ----------
  function makeBuf(k) { const w = FWH * k, h = FHH * k; return { k, w, h, c: new Uint32Array(w * h), base: new Uint32Array(w * h) }; }

  // fill: форма → пиксели; светотень по краям формы (верх-лево светлее, низ-право темнее), seam — тёмный шов у соседних частей
  function fill(B, pred, color, o = {}) {
    const { k, w, h, c, base } = B, m = new Uint8Array(w * h);
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let j = 0; j < h; j++) { const y = (j + 0.5) / k; for (let i = 0; i < w; i++) if (pred((i + 0.5) / k, y)) { m[j * w + i] = 1; if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; } }
    if (x1 < 0) return;
    const bc = rgb(color), bp = pack(bc), seam = pack(mix(bc, INK, 0.5));
    const LT = o.lit ?? 0.34, DK = o.dark ?? 0.38;
    // V9: пять ступеней оттенка (−2…+2): тени холоднее, света теплее
    const tones = [pack(dk(bc, DK)), pack(dk(bc, DK * 0.5)), bp, pack(lt(bc, LT * 0.5)), pack(lt(bc, LT))];
    const r = Math.max(1, Math.round((o.rim ?? 1.25) * k));
    const out = (i, j) => i < 0 || j < 0 || i >= w || j >= h || !m[j * w + i];
    // расстояния до края формы по четырём направлениям → объём (свет сверху-слева)
    let dU, dD, dL, dR;
    if (!o.flat) {
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, N = bw * bh;
      dU = new Uint16Array(N); dD = new Uint16Array(N); dL = new Uint16Array(N); dR = new Uint16Array(N);
      for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
        const q = j * bw + i, on = m[(j + y0) * w + i + x0];
        dU[q] = on ? (j ? dU[q - bw] : 0) + 1 : 0; dL[q] = on ? (i ? dL[q - 1] : 0) + 1 : 0;
      }
      for (let j = bh - 1; j >= 0; j--) for (let i = bw - 1; i >= 0; i--) {
        const q = j * bw + i, on = m[(j + y0) * w + i + x0];
        dD[q] = on ? (j < bh - 1 ? dD[q + bw] : 0) + 1 : 0; dR[q] = on ? (i < bw - 1 ? dR[q + 1] : 0) + 1 : 0;
      }
    }
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      if (!m[j * w + i]) continue;
      let col = bp;
      if (!o.flat) {
        const q = (j - y0) * (x1 - x0 + 1) + (i - x0);
        const vy = (dD[q] - dU[q]) / (dD[q] + dU[q]), vx = (dR[q] - dL[q]) / (dR[q] + dL[q]);
        let v = vy * 0.95 + vx * 0.7;                               // −1.65…+1.65
        if (out(i, j + r) || out(i + r, j)) v = Math.min(v, -1.2);  // кромка к тени — всегда тёмная
        else if (out(i - r, j) || out(i, j - r)) v = Math.max(v, 1); // кромка к свету — блик
        const lv = Math.max(-2, Math.min(2, Math.floor(v * 1.25 + 0.5 + (G.shade.bayer(i, j) - 0.5) * 0.45)));   // дизер — только на стыке ступеней
        col = tones[lv + 2];
      }
      if (o.seam) {
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = i + a * k, jj = j + b * k;
          if (ii >= 0 && jj >= 0 && ii < w && jj < h && !m[jj * w + ii] && c[jj * w + ii]) { col = seam; break; }
        }
      }
      c[j * w + i] = col; base[j * w + i] = bp;
    }
  }
  // flat: плоская заливка без светотени (детали лица, узоры)
  const flat = (B, pred, color) => fill(B, pred, color, { flat: true });

  // контур по силуэту: прозрачный пиксель рядом с непрозрачным → тёмный оттенок цвета соседа
  function outline(B) {
    const { k, w, h, c, base } = B, add = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (c[j * w + i]) continue;
      let nb = 0;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + a * k, jj = j + b * k;
        for (let s = 0; s < k && !nb; s++) {
          const i2 = a ? ii : i + s, j2 = b ? jj : j + s;
          if (i2 >= 0 && j2 >= 0 && i2 < w && j2 < h && c[j2 * w + i2]) nb = base[j2 * w + i2];
        }
        if (nb) break;
      }
      if (nb) add.push([j * w + i, nb]);
    }
    for (const [idx, nb] of add) { const bc = [nb & 255, (nb >> 8) & 255, (nb >> 16) & 255]; c[idx] = pack(mix(bc, INK, 0.72)); }
  }

  // ---------- стили персонажей (поверх DEFS) ----------
  // top: jacket | vest | dress | robe | apron | plain; sleeve: long | short | mesh; ex: набор деталей; body: fat | slim
  // стили одежды и детали — G.chars.STY (data/characters.js)


  // ---------- причёски ----------
  // Для каждого стиля: FP — окно лица спереди (кожа, не закрытая волосами), spikes — торчащие пряди, back — волосы позади головы/тела
  const FRINGE = {
    short: [[9.2, 13.4], [12, 12.2], [14.5, 13.4], [16, 12.6], [19.5, 12.4], [22.8, 13.4]],
    spiky: [[9.2, 13.2], [10.6, 11.2], [12.6, 13.6], [14.6, 10.6], [16.8, 13.4], [19, 10.8], [21, 13.4], [22.8, 12.4]],
    duck: [[9.2, 12], [10.4, 17.5], [12.4, 13.2], [16, 12.8], [19.6, 13.2], [21.6, 17.5], [22.8, 12]],
    long: [[10.4, 12.2], [12.4, 12.8], [16, 11.6], [19.6, 12.8], [21.6, 12.2]],
    bob: [[10.2, 12.6], [16, 12.2], [21.8, 12.6]],
    bowl: [[9.4, 12.4], [16, 12.4], [22.6, 12.4]],
    pony: [[9.2, 13.4], [12, 12.4], [16, 13.2], [20, 12.4], [22.8, 13.4]],
    ino: [[9.2, 13.6], [12, 12.6], [14, 13.4], [16.6, 17.5], [20, 13], [22.8, 13.6]],
    bun: [[9.2, 13.4], [16, 12.2], [22.8, 13.4]],
    buns: [[9.2, 13.4], [12, 12.2], [14.5, 13.4], [16, 12.6], [19.5, 12.4], [22.8, 13.4]],
    lowpony: [[9.6, 12.6], [12.6, 13.6], [16, 12.4], [19.4, 13.6], [22.4, 12.6]],
    sage: [[9.2, 13.2], [10.6, 11.2], [12.6, 13.6], [14.6, 10.6], [16.8, 13.4], [19, 10.8], [21, 13.4], [22.8, 12.4]],
    none: [],
  };
  const SPIKES = {
    spiky: [[8.4, 8, 4.6, 5, 2.4], [11, 6.5, 8.8, 1.2, 2.4], [14.4, 5.4, 14, 0.4, 2.4], [17.8, 5.4, 19, 0.6, 2.4], [21.2, 6.5, 24.4, 1.4, 2.4], [23.8, 8, 28, 5.2, 2.2]],
    duck: [[19, 5.4, 23, 2.2, 2.2]],
    sage: [[8.4, 8, 3.8, 3, 2.6], [11, 6.5, 8, -1, 2.6], [14.4, 5.4, 13.6, -2, 2.6], [17.8, 5.4, 19, -1.6, 2.6], [21.2, 6.5, 25, -0.6, 2.6], [23.8, 8, 28.6, 3.4, 2.4]],
    pony: [],
  };

  function mkHair(B, def, st, dir, b, col, o) {
    const hs = st.hair || def.hair || 'short';
    if (hs === 'bald') return;
    const hc = col.h;
    const longish = hs === 'long' || hs === 'bob' || hs === 'ino' || hs === 'sage';
    if (dir === 'down') {
      const fr = FRINGE[hs] || FRINGE.short;
      const pts = [[8.4, 24 + b], ...(hs === 'long' || hs === 'bob' ? [[10, 21 + b]] : [[8.6, 17 + b]]), ...fr.map(([x, y]) => [x, y + b]), ...(hs === 'long' || hs === 'bob' ? [[22, 21 + b]] : [[23.4, 17 + b]]), [23.6, 24 + b]];
      const FP = PO(pts);
      const cap = hs === 'bowl' ? E(16, 11.6 + b, 10.6, 9) : E(16, 11.8 + b, 10.2, 9.3);
      let hair = OR(SUB(cap, FP), ...((SPIKES[hs] || []).map(([cx, by, tx, ty, hw]) => TRI(cx, by + b, tx, ty + b, hw))));
      if (hs === 'duck') hair = OR(hair, SUB(RR(8, 8 + b, 24, 15 + b, 3), FP));
      if (longish) hair = OR(hair, SUB(OR(RR(6.4, 11 + b, 11, 26 + b, 2.4), RR(21, 11 + b, 25.6, 26 + b, 2.4)), R(0, 0, 0, 0)));
      if (hs === 'bowl') hair = OR(hair, SUB(RR(6.6, 11 + b, 25.4, 18 + b, 2.4), PO([[9.6, 18 + b], [9.6, 12.6 + b], [22.4, 12.6 + b], [22.4, 18 + b]])));
      if (hs === 'pony') hair = OR(hair, TRI(16, 6 + b, 16, 0.2 + b, 2.6), E(16, 4.2 + b, 2.8, 2.8));
      if (hs === 'ino') hair = OR(hair, E(25.4, 17 + b, 2.2, 3.4));
      if (hs === 'bun') hair = OR(hair, E(16, 3.6 + b, 4, 3.2));
      if (hs === 'buns') hair = OR(hair, E(8.4, 4.8 + b, 3.2, 3.2), E(23.6, 4.8 + b, 3.2, 3.2));
      if (hs === 'lowpony') hair = OR(hair, RR(7, 12 + b, 9.8, 22 + b, 1), RR(22.2, 12 + b, 25, 22 + b, 1));
      fill(B, hair, hc, { seam: true });
      flat(B, AND(hair, E(14, 7 + b, 5.5, 1.6)), col.H || lt(hc));
      if (hs === 'long' || hs === 'bob') flat(B, AND(hair, E(8.2, 17 + b, 0.9, 5)), col.H || lt(hc));
    } else if (dir === 'up') {
      let hair = E(16, 13.2 + b, 10.2, 9.8);
      if (SPIKES[hs]) hair = OR(hair, ...SPIKES[hs].map(([cx, by, tx, ty, hw]) => TRI(cx, by + b, tx, ty + b, hw)));
      if (hs === 'duck') hair = OR(hair, TRI(14, 9 + b, 12, 2 + b, 3), TRI(18, 9 + b, 21, 2.4 + b, 3), TRI(16, 8 + b, 16, 0.6 + b, 2.6), E(16, 18.5 + b, 8, 3.6));
      if (longish) hair = OR(hair, RR(6.4, 11 + b, 25.6, 27 + b, 3));
      if (hs === 'bowl') hair = OR(hair, E(16, 14 + b, 10.8, 8.6));
      if (hs === 'pony') hair = OR(hair, TRI(16, 6 + b, 16, 0.2 + b, 2.6), E(16, 4.2 + b, 2.8, 2.8));
      if (hs === 'ino') hair = OR(hair, RR(13, 12 + b, 19, 31 + b, 3));
      if (hs === 'bun') hair = OR(hair, E(16, 3.6 + b, 4, 3.2));
      if (hs === 'buns') hair = OR(hair, E(8.4, 4.8 + b, 3.2, 3.2), E(23.6, 4.8 + b, 3.2, 3.2));
      if (hs === 'lowpony') hair = OR(hair, RR(14, 12 + b, 18, 33 + b, 1.8));
      fill(B, hair, hc, { seam: true });
      if (hs === 'lowpony') flat(B, R(14, 17.6 + b, 18, 19 + b), '#c8ccd8');
      flat(B, AND(hair, E(14, 8 + b, 6, 1.8)), col.H || lt(hc));
    } else { // left (смотрит влево)
      const fr = hs === 'bowl' ? 12.2 : hs === 'long' || hs === 'bob' ? 12.4 : 13.2;
      const FPs = PO([[5, 23 + b], [5, fr + b], [9.4, fr + 0.4 + b], [11.2, fr + b], [11.6, 19 + b], [12.4, 23 + b]]);
      let hair = SUB(E(16.6, 11.8 + b, 9.9, 9.3), FPs);
      if (hs === 'spiky' || hs === 'sage') hair = OR(hair, ...[[9, 8, 5, 4.4, 2.4], [12, 6.2, 9.6, 0.8, 2.4], [15.6, 5.2, 16, 0.2, 2.4], [19.2, 5.8, 22, 0.8, 2.4], [22.4, 8, 27.6, 5, 2.4]].map(([cx, by, tx, ty, hw]) => TRI(cx, by + b, tx, ty + b, hw)));
      if (hs === 'duck') hair = OR(hair, TRI(17, 8 + b, 24, 1.4 + b, 3), TRI(20, 9 + b, 28, 5 + b, 3), SUB(E(20.6, 17 + b, 5, 5), FPs));
      if (hs === 'pony') hair = OR(hair, E(22.5, 5 + b, 3, 3.4), TRI(22, 7 + b, 29, 12 + b, 2.6), TRI(22, 5 + b, 24, 0.6 + b, 2));
      if (longish) hair = OR(hair, RR(15, 11 + b, 25.4, 26 + b, 3), SUB(RR(9.6, 12 + b, 14, 22 + b, 2), FPs));
      if (hs === 'ino') hair = OR(hair, RR(20.5, 10 + b, 24.6, 28 + b, 2.4));
      if (hs === 'bowl') hair = OR(hair, RR(8.2, 11 + b, 25, 17.6 + b, 2.6));
      if (hs === 'bun') hair = OR(hair, E(21, 4.4 + b, 3.6, 3.2));
      if (hs === 'buns') hair = OR(hair, E(17.4, 3.6 + b, 3.6, 3.4));
      if (hs === 'lowpony') hair = OR(hair, RR(21, 12 + b, 25.4, 31 + b, 1.8), TRI(23, 31 + b, 23, 34 + b, 1.6));
      fill(B, hair, hc, { seam: true });
      flat(B, AND(hair, E(14, 7.4 + b, 5.5, 1.6)), col.H || lt(hc));
    }
  }

  // ---------- главная сборка кадра ----------
  // dir: down | up | left; f: 0 стойка, 1/2 шаги; opt.k — масштаб суперсэмплинга
  function renderFrame(def, id, dir, f, k) {
    const B = makeBuf(k);
    const col = Object.assign({ s: P.skin, S: P.skinShade, e: P.ink, b: '#c8ccd8', B: P.navy, m: '#8a5a3a' }, def.colors);
    if (def.skin) { col.s = def.skin[0]; col.S = def.skin[1]; }
    const st = G.chars.STY[id] || { top: 'plain', sleeve: 'long', ex: [] };
    if (st.cat) { renderCat(B, dir, f, col); outline(B); return B; }
    if (st.dog) { renderDog(B, dir, f, col); outline(B); return B; }
    const ex = new Set(st.ex || []);
    const b = f === 0 ? 0 : 1;                      // покачивание при ходьбе
    const fat = st.body === 'fat';
    const sk = col.s, kid = st.kid;
    const swing = f === 1 ? 1 : f === 2 ? -1 : 0;   // качание рук/ног
    const tx0 = fat ? 8 : 10, tx1 = fat ? 24 : 22;  // ширина торса
    const torsoBot = 33 + (fat ? 1 : 0);
    const TORSO = RR(tx0, 21.4 + b, tx1, torsoBot + b, fat ? 4.5 : 2.6);

    // ----- задний план: капюшон/плащ/волосы позади -----
    if (dir === 'down' || dir === 'up') {
      if (ex.has('hood')) fill(B, E(16, 12.5 + b, 11.6, 10.6), col.t, { seam: true });
      if (ex.has('hoodcloth')) fill(B, E(16, 13 + b, 10.8, 10), col.t);
      if (st.top === 'robe') fill(B, RR(8.6, 21.4 + b, 23.4, 37, 2.4), col.t);
    }

    // ----- ноги -----
    const legCol = col.p, shoeCol = col.f;
    const L1 = dir === 'left' ? legsSide(f) : legsFront(f);
    for (const lg of L1) {
      fill(B, RR(lg.x0, 31.4, lg.x1, lg.y1, 1.2), legCol, { seam: true });
      if (ex.has('warmers')) fill(B, RR(lg.x0 - 0.3, lg.y1 - 4.4, lg.x1 + 0.3, lg.y1 - 0.4, 1), col.f, { seam: true });
      if (st.top === 'robe') { /* ноги скрыты подолом */ }
      fill(B, SH(RR(lg.x0 - (dir === 'left' ? 1.8 : 0.6), lg.y1 - 1.9, lg.x1 + 0.6, lg.y1 + 0.2 + (lg.y1 < 38.5 ? 0.6 : 1.2), 1.2), 0, 0), shoeCol, { seam: true });
    }

    // ----- нижняя часть: юбка / подол -----
    if (ex.has('skirt') && dir !== 'left') fill(B, PO([[10.2, 31 + b], [21.8, 31 + b], [24, 36.4 + b], [8, 36.4 + b]]), col.p === col.t ? col.T : col.a, { seam: true });
    if (ex.has('skirt') && dir === 'left') fill(B, PO([[10.6, 31 + b], [21.4, 31 + b], [23.4, 36.2 + b], [9, 36.2 + b]]), col.a, { seam: true });
    if (st.top === 'dress' && !ex.has('skirt')) fill(B, dir === 'left' ? PO([[11, 31 + b], [21, 31 + b], [22.4, 35 + b], [9.6, 35 + b]]) : PO([[10, 31 + b], [22, 31 + b], [24, 35.6 + b], [8, 35.6 + b]]), col.t, { seam: true });
    if (st.top === 'robe') fill(B, dir === 'left' ? PO([[11, 30 + b], [21, 30 + b], [23, 37.2], [9, 37.2]]) : PO([[9.6, 30 + b], [22.4, 30 + b], [24.6, 37.4], [7.4, 37.4]]), col.t, { seam: true });

    // ----- дальняя рука (вид сбоку) -----
    if (dir === 'left') fill(B, RR(14.4 - swing * -1.6 * 0, 22.6 + b, 18.4, 31 + b, 1.7), mix(rgb(col.t), DARKT, 0.28), { seam: true });

    // ----- торс -----
    const torsoCol = st.top === 'dress' ? col.t : col.t;
    if (dir === 'left') fill(B, RR(11.2, 21.4 + b, 20.8, torsoBot + b, 2.6), torsoCol, { seam: true });
    else fill(B, TORSO, torsoCol, { seam: true });
    if (fat && dir !== 'left') fill(B, E(16, 28.6 + b, 9.6, 5.6), torsoCol, { seam: true });
    if (fat && dir === 'left') fill(B, E(14.2, 28.6 + b, 6.4, 5.6), torsoCol, { seam: true });
    // детали одежды по типам
    drawTop(B, st, ex, col, dir, b, fat, torsoBot);

    // ----- руки -----
    drawArms(B, st, ex, col, dir, b, swing, fat);

    // ----- шея, воротник за головой -----
    if (ex.has('hcollar') || ex.has('hood') || ex.has('fluff') || st.top === 'jacket') {
      const cc = ex.has('hcollar') ? col.t : st.top === 'jacket' ? (ex.has('fluff') ? col.a : col.T) : col.t;
      if (dir === 'down') { fill(B, PO([[9.6, 22.4 + b], [11.6, 18 + b], [14.6, 22.4 + b]]), cc, { seam: true }); fill(B, PO([[22.4, 22.4 + b], [20.4, 18 + b], [17.4, 22.4 + b]]), cc, { seam: true }); }
      if (dir === 'up') fill(B, RR(9, 19 + b, 23, 23.8 + b, 1.6), cc, { seam: true });
      if (dir === 'left') fill(B, RR(11, 19 + b, 21.6, 23.6 + b, 1.6), cc, { seam: true });
    }

    // ----- голова -----
    if (dir === 'down') drawHeadFront(B, def, st, ex, col, b);
    else if (dir === 'up') fill(B, E(16, 13.5 + b, 9.3, 8.6), sk, { seam: true });
    else drawHeadSide(B, def, st, ex, col, b);

    // ----- волосы, повязка, головные уборы -----
    if (ex.has('hood') && dir === 'down') { /* капюшон: мех по краю лица */
      fill(B, SUB(E(16, 13 + b, 10.6, 9.6), E(16, 14.4 + b, 8.8, 7.8)), '#d8d0bc', { seam: true });
    }
    mkHair(B, def, st, dir, b, col, ex);
    if (ex.has('hood') && dir !== 'down') fill(B, dir === 'up' ? E(16, 13 + b, 11, 10) : SUB(E(17, 13 + b, 10.4, 9.6), PO([[4, 24], [4, 12.8 + b], [12, 12.8 + b], [12, 24]])), col.t, { seam: true });
    if (def.band || ex.has('band')) drawBand(B, col, dir, b);
    drawHeadwear(B, st, ex, col, def, dir, b);
    // косметика после волос: лицо
    if (dir === 'down') drawFaceFront(B, def, st, ex, col, b);
    else if (dir === 'left') drawFaceSide(B, def, st, ex, col, b);

    outline(B);
    return B;
  }

  function legsFront(f) {
    const a = f === 1 ? -1.2 : 0, c = f === 2 ? -1.2 : 0;   // поднятая нога короче
    return [{ x0: 10.8, x1: 15.4, y1: 38.4 + a }, { x0: 16.6, x1: 21.2, y1: 38.4 + c }];
  }
  function legsSide(f) {
    if (f === 0) return [{ x0: 12.4, x1: 17, y1: 38.4 }, { x0: 15, x1: 19.4, y1: 38.4 }];
    if (f === 1) return [{ x0: 10.2, x1: 14.6, y1: 38.4 }, { x0: 17.2, x1: 21.6, y1: 37.2 }];
    return [{ x0: 15.8, x1: 20.2, y1: 38.4 }, { x0: 10.8, x1: 15.2, y1: 37.2 }];
  }

  function drawTop(B, st, ex, col, dir, b, fat, torsoBot) {
    const t = col.t, T = col.T, a = col.a;
    const cx = 16;
    if (dir === 'down') {
      if (st.top === 'jacket') {
        fill(B, R(15.2, 22.6 + b, 16.8, torsoBot - 1 + b), T, { flat: true });                  // молния
        fill(B, PO([[13.6, 21.8 + b], [18.4, 21.8 + b], [16, 26.2 + b]]), st.inner || T, { flat: true }); // вырез
        flat(B, R(15.6, 26 + b, 16.4, torsoBot - 1 + b), lt(t, 0.35));
        if (!fat) { flat(B, R(10, 29.4 + b, 22, 30.4 + b), T); }
      } else if (st.top === 'vest') {
        fill(B, PO([[13.4, 21.8 + b], [18.6, 21.8 + b], [16, 25.4 + b]]), st.inner || T, { flat: true });
        const vc = mix(rgb(t), [255, 255, 255], 0);
        fill(B, RR(10.6, 24.4 + b, 14.8, 28.6 + b, 0.8), T, { seam: true }); fill(B, RR(17.2, 24.4 + b, 21.4, 28.6 + b, 0.8), T, { seam: true });
        flat(B, R(15.4, 25.6 + b, 16.6, torsoBot - 1 + b), T);
      } else if (st.top === 'apron') {
        fill(B, RR(11.2, 25 + b, 20.8, 34.2 + b, 1.2), a, { seam: true });
        flat(B, R(12, 27.4 + b, 20, 28 + b), lt(a, 0.1));
      } else if (st.top === 'robe') {
        fill(B, PO([[13, 21.8 + b], [19, 21.8 + b], [16, 28 + b]]), '#f0ece0', { flat: true });
        flat(B, R(15.4, 28 + b, 16.6, 37), a);
        flat(B, PO([[10, 22 + b], [13, 21.8 + b], [16, 28 + b], [14.4, 28 + b]]), a); flat(B, PO([[22, 22 + b], [19, 21.8 + b], [16, 28 + b], [17.6, 28 + b]]), a);
      } else if (st.top === 'dress') {
        flat(B, R(15.6, 22 + b, 16.4, 31 + b), lt(t, 0.25));
      }
      if (ex.has('swirl') && false) { /* спираль Узумаки только на спине */ }
      if (ex.has('midriff')) { fill(B, RR(10.6, 27 + b, 21.4, 33.2 + b, 1), sk2(col), { seam: true }); flat(B, E(16, 30.4 + b, 0.5, 0.5), dk(col.s, 0.6)); }
      if (ex.has('scarfc')) fill(B, RR(9.4, 21 + b, 22.6, 24 + b, 1.2), '#e8e4dc', { seam: true });
      // пояс
      if (st.top !== 'apron' && st.top !== 'robe' && st.top !== 'dress') { fill(B, R(tx(fat, 0), 31.6 + b, tx(fat, 1), 33 + b), a, { seam: true }); flat(B, R(15, 31.6 + b, 17, 33 + b), lt(a, 0.5)); }
      if (st.top === 'dress') { fill(B, R(10, 30.6 + b, 22, 31.8 + b), a, { seam: true }); }
      if (ex.has('circle')) { /* спереди ничего */ }
      if (ex.has('fluff')) fill(B, RR(9.6, 21 + b, 22.4, 23.4 + b, 1.2), '#f0ece8', { seam: true });
      if (ex.has('belt')) { flat(B, R(10, 31.2 + b, 22, 32.4 + b), '#e8621a'); }
    } else if (dir === 'up') {
      if (st.top === 'vest') { fill(B, RR(10.6, 22.4 + b, 21.4, 32 + b, 1), T, { seam: true }); }
      if (ex.has('swirl')) { fill(B, E(16, 27 + b, 4.2, 4.2), '#f0e8d0', { flat: true }); flat(B, E(16, 27 + b, 2.6, 2.6), '#d65410'); flat(B, E(16.4, 27 + b, 1.2, 1.2), '#f0e8d0'); }
      if (ex.has('fan')) { fill(B, E(16, 26.6 + b, 3.6, 3.6), '#e8e4dc', { flat: true }); flat(B, SUB(E(16, 27.2 + b, 3.6, 3.6), E(16, 26 + b, 3, 3)), '#c82a2a'); }
      if (ex.has('circle')) { fill(B, E(16, 27 + b, 3.6, 3.6), '#f0ece0', { flat: true }); flat(B, SUB(E(16, 27 + b, 3.6, 3.6), E(16, 27 + b, 2.4, 2.4)), '#c83a3a'); flat(B, E(16, 27 + b, 1.4, 1.4), '#f0ece0'); }
      if (st.top === 'robe') { flat(B, R(15.4, 22 + b, 16.6, 37), a); }
      if (st.top !== 'apron' && st.top !== 'robe' && st.top !== 'dress') fill(B, R(tx(fat, 0), 31.6 + b, tx(fat, 1), 33 + b), a, { seam: true });
      if (ex.has('satchel')) fill(B, RR(11, 28 + b, 21, 34 + b, 1.2), '#7a5a3a', { seam: true });
    } else {
      if (st.top === 'jacket') { flat(B, R(11.2, 29.4 + b, 20.8, 30.2 + b), T); }
      if (st.top === 'vest') { fill(B, RR(13.4, 24.4 + b, 18.2, 28.6 + b, 0.8), T, { seam: true }); }
      if (st.top === 'apron') fill(B, RR(11.4, 25 + b, 15.6, 34 + b, 1.2), a, { seam: true });
      if (st.top !== 'apron' && st.top !== 'robe' && st.top !== 'dress') fill(B, R(11.2, 31.6 + b, 20.8, 33 + b), a, { seam: true });
      if (st.top === 'dress') fill(B, R(11.2, 30.6 + b, 20.8, 31.8 + b), a, { seam: true });
    }
  }
  const tx = (fat, i) => (fat ? [8, 24] : [10, 22])[i];
  const sk2 = (col) => col.s;

  function drawArms(B, st, ex, col, dir, b, swing, fat) {
    const sl = st.sleeve, sc = col.t, hand = col.s;
    const ay = (s) => b + s * 1.1;
    const mk = (x0, x1, dy) => {
      const y0 = 22.4 + b + dy, y1 = 31.4 + b + dy;
      if (sl === 'short') { fill(B, RR(x0, y0, x1, y0 + 4.8, 1.6), sc, { seam: true }); fill(B, RR(x0 + 0.4, y0 + 3.6, x1 - 0.4, y1, 1.4), hand, { seam: true }); }
      else if (sl === 'mesh') { fill(B, RR(x0, y0, x1, y1, 1.6), hand, { seam: true }); for (let yy = y0 + 1; yy < y1; yy += 1.4) flat(B, R(x0 + 0.3, yy, x1 - 0.3, yy + 0.5), dk(hand, 0.5)); fill(B, RR(x0, y0, x1, y0 + 3.4, 1.6), sc, { seam: true }); }
      else fill(B, RR(x0, y0, x1, y1 - 2, 1.6), sc, { seam: true });
      if (ex.has('wraps')) fill(B, RR(x0, y0 + 5.4, x1, y1 - 0.2, 1), '#e8e4dc', { seam: true });
      if (sl === 'long') fill(B, RR(x0, y1 - 3.4, x1, y1 - 1.6, 0.6), dk(sc, 0.2), { flat: true });
      // кисть
      fill(B, E((x0 + x1) / 2, y1 + 0.2, 1.9, 1.7), hand, { seam: true });
    };
    if (dir === 'down' || dir === 'up') {
      const lx = fat ? 5 : 6.4, rx = fat ? 23.6 : 21.7;
      mk(lx, lx + 3.9, swing * -1.3); mk(rx, rx + 3.9, swing * 1.3);
    } else {
      const sx = 14.4 + (-swing) * 2.2;
      mk(sx, sx + 3.9, 0);
    }
  }

  function drawHeadFront(B, def, st, ex, col, b) {
    fill(B, E(16, 13.5 + b, 9.3, 8.6), col.s, { seam: true });
    fill(B, E(6.9, 14.6 + b, 1.5, 2), col.s, { seam: true }); fill(B, E(25.1, 14.6 + b, 1.5, 2), col.s, { seam: true });   // уши
    flat(B, E(6.9, 14.8 + b, 0.5, 0.9), col.S); flat(B, E(25.1, 14.8 + b, 0.5, 0.9), col.S);
  }
  function drawHeadSide(B, def, st, ex, col, b) {
    fill(B, E(15.6, 13.5 + b, 8.8, 8.6), col.s, { seam: true });
    fill(B, E(6.6, 16.2 + b, 1.3, 1.1), col.s, { seam: true });             // нос
    fill(B, E(17.4, 14.8 + b, 1.5, 2), col.s, { seam: true });              // ухо
    flat(B, E(17.4, 15 + b, 0.5, 0.9), col.S);
  }

  function eye(B, cx, cy, col, st, side) {
    const pale = st.eye === 'pale';
    flat(B, E(cx, cy, 1.55, 2.1), pale ? '#b8b4d8' : '#fff');
    flat(B, E(cx + (side || 0) * 0.15, cy + 0.15, 1.2, 1.7), pale ? '#e8e4fa' : col.e);
    if (pale) flat(B, E(cx, cy + 0.5, 0.45, 0.9), '#8a86b8');
    if (!pale) flat(B, E(cx + (side || 0) * 0.15, cy + 0.35, 0.65, 1.1), INK);
    flat(B, E(cx - 0.5, cy - 0.7, 0.42, 0.42), '#fff');
    flat(B, R(cx - 1.7, cy - 2.3, cx + 1.7, cy - 1.6), INK);                // веко
  }
  function drawFaceFront(B, def, st, ex, col, b) {
    const y = 14.8 + b;
    // брови
    const bh = col.h || '#222';
    const thick = ex.has('brows');
    if (ex.has('purpleeyes')) { flat(B, R(9.6, y - 3.4, 15, y - 1.2), '#8a4a9a'); flat(B, R(17, y - 3.4, 22.4, y - 1.2), '#8a4a9a'); }
    if (!ex.has('shades')) {
      flat(B, R(10, y - 3.6, 14.4, y - (thick ? 2 : 2.8)), dk(bh, 0.3));
      flat(B, R(17.6, y - 3.6, 22, y - (thick ? 2 : 2.8)), dk(bh, 0.3));
      eye(B, 12.4, y, col, st, 0); eye(B, 19.6, y, col, st, 0);
    } else {
      flat(B, E(12.2, y, 3.2, 2.7), '#14121c'); flat(B, E(19.8, y, 3.2, 2.7), '#14121c'); flat(B, R(14.6, y - 0.8, 17.4, y + 0.4), '#14121c');
      flat(B, R(10.4, y - 1.6, 11.6, y - 0.6), '#5a5a7a'); flat(B, R(18, y - 1.6, 19.2, y - 0.6), '#5a5a7a');
    }
    if (ex.has('blush') || st.kid) { flat(B, E(10.2, y + 3.2, 1.5, 0.8), '#f09a8a'); flat(B, E(21.8, y + 3.2, 1.5, 0.8), '#f09a8a'); }
    // нос и рот
    flat(B, R(15.5, y + 2.4, 16.6, y + 3.2), dk(col.s, 0.28));
    if (!(ex.has('mask') || ex.has('hcollar') && false)) {
      if (ex.has('teeth')) { flat(B, R(13.6, y + 4.6, 18.6, y + 6), '#a0483c'); flat(B, R(14.2, y + 4.6, 18, y + 5.2), '#fff'); }
      else if (ex.has('scowl')) flat(B, R(13.8, y + 5, 18.4, y + 5.8), '#6a3a2a');
      else flat(B, R(14.4, y + 5, 17.6, y + 5.7), '#a0583c');
    }
    // метки
    if (ex.has('whiskers')) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) flat(B, R(s < 0 ? 7.8 : 22, y + 1.4 + i * 1.5 - 1.4, s < 0 ? 10.2 : 24.2, y + 1.4 + i * 1.5 - 0.9), '#8a4a2a');
    if (ex.has('scar')) flat(B, R(10.6, y + 2.4, 21.4, y + 3.2), '#b0603c');
    if (ex.has('lines')) { flat(B, R(10.4, y + 2.6, 13.8, y + 3.2), dk(col.s, 0.5)); flat(B, R(18.2, y + 2.6, 21.6, y + 3.2), dk(col.s, 0.5)); }
    if (ex.has('plaster')) { flat(B, R(12.4, y + 1.6, 19.6, y + 3), '#f0e8d8'); flat(B, R(15.6, y + 1.6, 16.4, y + 3), '#c8b8a0'); }
    if (ex.has('senbon')) flat(B, R(16, y + 5.4, 24, y + 6), '#d8d8e0');
    if (ex.has('redline')) { flat(B, R(11.6, y + 2, 12.4, y + 7.4), '#c83a3a'); flat(B, R(19.6, y + 2, 20.4, y + 7.4), '#c83a3a'); }
    if (ex.has('scarbig')) { flat(B, PO([[9.4, y - 2], [10.6, y - 2.6], [22.6, y + 4.4], [21.4, y + 5]]), '#a85a4a'); flat(B, PO([[22.6, y - 2], [21.4, y - 2.6], [9.4, y + 4.4], [10.6, y + 5]]), '#a85a4a'); }
    if (ex.has('dzeye')) { fill(B, E(12.4, y, 3.8, 4), '#ece8dc', { seam: true }); fill(B, RR(6.8, y - 5.4, 17.6, y - 3, 1), '#ece8dc', { seam: true }); flat(B, R(8, y - 4.6, 17, y - 4.1), '#c8c0b0'); flat(B, R(11.6, y - 1, 13.4, y + 1), '#c8c0b0'); }
    if (ex.has('fang')) for (const s of [-1, 1]) flat(B, PO([[s < 0 ? 8.8 : 21.4, y + 1.8], [s < 0 ? 10.6 : 23.2, y + 1.8], [s < 0 ? 9.7 : 22.3, y + 5.2]]), '#c82a2a');
    if (ex.has('swirlcheek')) for (const s of [-1, 1]) { flat(B, E(s < 0 ? 9.6 : 22.4, y + 3, 1.6, 1.6), '#d8402a'); flat(B, E(s < 0 ? 9.6 : 22.4, y + 3, 0.7, 0.7), col.s); }
    if (ex.has('wrinkle')) { flat(B, R(10.4, y + 3.4, 12, y + 3.9), dk(col.s, 0.4)); flat(B, R(20, y + 3.4, 21.6, y + 3.9), dk(col.s, 0.4)); }
    if (ex.has('stache')) fill(B, PO([[11.4, y + 4.4], [16, y + 3.6], [20.6, y + 4.4], [19.4, y + 5.8], [16, y + 4.8], [12.6, y + 5.8]]), dk(col.h, 0.1), { seam: true });
    if (ex.has('beard')) fill(B, PO([[9.6, y + 3], [22.4, y + 3], [21, y + 8.4], [16, y + 10], [11, y + 8.4]]), '#e8e8f0', { seam: true });
    if (ex.has('mask')) fill(B, PO([[9, y + 1.2], [23, y + 1.2], [22, y + 7.4], [16, y + 9], [10, y + 7.4]]), ex.has('hoodcloth') ? '#2a2a3a' : col.t, { seam: true });
    if (ex.has('glasses')) { flat(B, SUB(E(12.2, y, 3.2, 2.7), E(12.2, y, 2.3, 1.9)), '#5a4a3a'); flat(B, SUB(E(19.8, y, 3.2, 2.7), E(19.8, y, 2.3, 1.9)), '#5a4a3a'); flat(B, R(15, y - 0.4, 17, y + 0.2), '#5a4a3a'); }
    if (ex.has('hcollar')) fill(B, RR(9.6, y + 5.2, 22.4, y + 8.6, 1.4), col.t, { seam: true });
    if (ex.has('eyeband')) { /* повязка набок: рисуется в headwear */ }
  }
  function drawFaceSide(B, def, st, ex, col, b) {
    const y = 14.8 + b;
    flat(B, R(8.4, y - 3.6, 12.6, y - (ex.has('brows') ? 2 : 2.8)), dk(col.h || '#222', 0.3));
    if (ex.has('purpleeyes')) flat(B, R(8.2, y - 3.4, 13.4, y - 1.2), '#8a4a9a');
    if (ex.has('shades')) { flat(B, E(10.8, y, 2.8, 2.7), '#14121c'); flat(B, R(7.2, y - 1, 9, y + 0.3), '#14121c'); }
    else eye(B, 10.8, y, col, st, -1);
    if (ex.has('dzeye')) fill(B, E(10.8, y, 3.6, 4), '#ece8dc', { seam: true });
    flat(B, R(7.6, y + 4.8, 10.4, y + 5.5), '#a0583c');
    if (ex.has('blush') || st.kid) flat(B, E(12.4, y + 3.2, 1.5, 0.8), '#f09a8a');
    if (ex.has('whiskers')) for (let i = 0; i < 3; i++) flat(B, R(9.6, y + 0.2 + i * 1.5, 12, y + 0.7 + i * 1.5), '#8a4a2a');
    if (ex.has('scar')) flat(B, R(8.6, y + 2.4, 13, y + 3.2), '#b0603c');
    if (ex.has('lines')) flat(B, R(9.6, y + 2.6, 13.2, y + 3.2), dk(col.s, 0.5));
    if (ex.has('plaster')) flat(B, R(7.4, y + 1.6, 12, y + 3), '#f0e8d8');
    if (ex.has('senbon')) flat(B, R(3.4, y + 5.4, 9.6, y + 6), '#d8d8e0');
    if (ex.has('redline')) flat(B, R(10, y + 2, 10.8, y + 7.4), '#c83a3a');
    if (ex.has('scarbig')) flat(B, PO([[7.8, y - 2], [9, y - 2.6], [14.4, y + 4.4], [13.2, y + 5]]), '#a85a4a');
    if (ex.has('fang')) flat(B, PO([[10, y + 1.8], [12, y + 1.8], [11, y + 5.2]]), '#c82a2a');
    if (ex.has('swirlcheek')) { flat(B, E(11.2, y + 3, 1.6, 1.6), '#d8402a'); flat(B, E(11.2, y + 3, 0.7, 0.7), col.s); }
    if (ex.has('stache')) fill(B, PO([[6.4, y + 4.4], [11, y + 3.8], [11.6, y + 5.6], [7.4, y + 5.8]]), dk(col.h, 0.1), { seam: true });
    if (ex.has('beard')) fill(B, PO([[6.6, y + 3.6], [12.6, y + 3], [14.6, y + 8.4], [9.6, y + 9.6]]), '#e8e8f0', { seam: true });
    if (ex.has('mask')) fill(B, PO([[6.6, y + 1.8], [14.6, y + 1.2], [15, y + 7.4], [9.4, y + 8.6]]), ex.has('hoodcloth') ? '#2a2a3a' : col.t, { seam: true });
    if (ex.has('hcollar')) fill(B, RR(8.4, y + 5.2, 18.4, y + 8.6, 1.4), col.t, { seam: true });
    if (ex.has('glasses')) { flat(B, SUB(E(10.8, y, 3, 2.7), E(10.8, y, 2.1, 1.9)), '#5a4a3a'); }
  }

  function drawBand(B, col, dir, b) {
    const bc = col.B || P.navy, mc = col.b || '#c8ccd8';
    if (dir === 'down') {
      fill(B, PO([[6.2, 9.8 + b], [25.8, 9.8 + b], [25.4, 12.6 + b], [6.6, 12.6 + b]]), bc, { seam: true });
      fill(B, RR(10.2, 9 + b, 21.8, 13 + b, 1.2), mc, { seam: true });
      flat(B, R(13.6, 10.6 + b, 18.4, 11.3 + b), '#8a90a4'); flat(B, E(16, 11 + b, 1.2, 1.2), '#6a7088');
    } else if (dir === 'up') {
      fill(B, PO([[6.2, 9.8 + b], [25.8, 9.8 + b], [25.4, 12.6 + b], [6.6, 12.6 + b]]), bc, { seam: true });
      fill(B, TRI(16, 12.4 + b, 12, 20.6 + b, 2), bc, { seam: true }); fill(B, TRI(16, 12.4 + b, 21, 19.6 + b, 2), bc, { seam: true });
    } else {
      fill(B, PO([[6.4, 9.8 + b], [24.6, 9.8 + b], [24.6, 12.6 + b], [6.6, 12.6 + b]]), bc, { seam: true });
      fill(B, RR(6.6, 9 + b, 13, 13 + b, 1.2), mc, { seam: true });
      flat(B, E(9.8, 11 + b, 1.2, 1.2), '#6a7088');
      fill(B, TRI(25, 11.2 + b, 29.6, 18.4 + b, 1.8), bc, { seam: true });
    }
  }

  function drawHeadwear(B, st, ex, col, def, dir, b) {
    if (ex.has('goggles')) {
      const gc = st.top === 'jacket' ? '#c8501a' : '#3a5a9a';
      if (dir === 'down') { fill(B, RR(7, 6.6 + b, 25, 10.4 + b, 1.6), '#7a5a3a', { seam: true }); fill(B, E(12, 8.2 + b, 3, 2.6), gc, { seam: true }); fill(B, E(20, 8.2 + b, 3, 2.6), gc, { seam: true }); flat(B, E(12.2, 8 + b, 1.6, 1.4), '#7ac0f0'); flat(B, E(19.8, 8 + b, 1.6, 1.4), '#7ac0f0'); flat(B, R(11, 7 + b, 12, 7.6 + b), '#fff'); flat(B, R(19, 7 + b, 20, 7.6 + b), '#fff'); }
      else if (dir === 'up') fill(B, RR(6.6, 7 + b, 25.4, 10.2 + b, 1.4), '#7a5a3a', { seam: true });
      else { fill(B, RR(7, 6.6 + b, 24, 10.2 + b, 1.4), '#7a5a3a', { seam: true }); fill(B, E(11.4, 8.4 + b, 3, 2.6), gc, { seam: true }); flat(B, E(11.6, 8.2 + b, 1.6, 1.4), '#7ac0f0'); }
    }
    if (ex.has('ribbon')) {
      if (dir === 'down') { fill(B, PO([[6.4, 6.8 + b], [11.4, 8.2 + b], [6.8, 11.2 + b]]), '#d83a3a', { seam: true }); fill(B, PO([[14, 6 + b], [17, 6.4 + b], [14.6, 9.4 + b]]), '#d83a3a', { seam: true }); }
      else if (dir === 'up') fill(B, RR(9, 8 + b, 23, 10.4 + b, 1), '#d83a3a', { seam: true });
      else fill(B, RR(8, 8 + b, 20, 10.4 + b, 1), '#d83a3a', { seam: true });
    }
    if (ex.has('goggles') === false && ex.has('scarf')) { /* шарф рисуется ниже */ }
    if (ex.has('scarf')) {
      if (dir === 'left') { fill(B, RR(11, 21 + b, 21.6, 24 + b, 1.2), '#2a8aca', { seam: true }); fill(B, PO([[20, 22 + b], [27, 24 + b], [26, 28 + b], [19.6, 25 + b]]), '#2a8aca', { seam: true }); }
      else { fill(B, RR(9.4, 21 + b, 22.6, 24 + b, 1.2), '#2a8aca', { seam: true }); if (dir === 'down') fill(B, RR(18, 23 + b, 21.4, 31 + b, 1.2), '#2a8aca', { seam: true }); }
    }
    if (ex.has('cap')) {
      const cc = col.t;
      if (dir === 'down') { fill(B, SUB(E(16, 9 + b, 10.4, 6.6), R(0, 12.4 + b, 32, 40)), cc, { seam: true }); fill(B, RR(8, 10.8 + b, 24, 12.8 + b, 1), dk(cc, 0.3), { seam: true }); }
      else if (dir === 'up') fill(B, SUB(E(16, 9.6 + b, 10.4, 7.4), R(0, 14.2 + b, 32, 40)), cc, { seam: true });
      else { fill(B, SUB(E(16, 9 + b, 10.4, 6.6), R(0, 12.4 + b, 32, 40)), cc, { seam: true }); fill(B, RR(3, 10.8 + b, 14, 12.6 + b, 1), dk(cc, 0.3), { seam: true }); }
    }
    if (ex.has('chef')) { fill(B, RR(8.4, 3 + b, 23.6, 11 + b, 3.4), '#f4f0e8', { seam: true }); flat(B, R(9, 8.8 + b, 23, 9.4 + b), '#c8c0b0'); }
    if (ex.has('sedge')) { fill(B, PO([[2.4, 11 + b], [16, 1.6 + b], [29.6, 11 + b], [24, 12.6 + b], [8, 12.6 + b]]), '#d8c070', { seam: true }); flat(B, R(7, 10.6 + b, 25, 11.2 + b), '#a88a3a'); }
    if (ex.has('hokagehat')) {
      if (dir === 'down') { fill(B, PO([[6.8, 11 + b], [9, 3.4 + b], [23, 3.4 + b], [25.2, 11 + b]]), '#e8e4dc', { seam: true }); fill(B, R(7.6, 8.6 + b, 24.4, 11 + b), '#c83a2a', { seam: true }); flat(B, RR(14, 4.4 + b, 18, 7.8 + b, 0.5), '#c83a2a'); }
      else fill(B, PO([[6.8, 11 + b], [9, 3.4 + b], [23, 3.4 + b], [25.2, 11 + b]]), dir === 'up' ? '#e8e4dc' : '#e8e4dc', { seam: true });
    }
    if (ex.has('eyeband') && dir !== 'up') {
      if (dir === 'down') { fill(B, PO([[6.4, 11 + b], [25.6, 11 + b], [25.4, 14 + b], [6.6, 14 + b]]), '#1e2a4a', { seam: true }); fill(B, RR(10, 10.6 + b, 22, 14 + b, 1.2), '#c8ccd8', { seam: true }); fill(B, PO([[18, 14 + b], [24, 14 + b], [24, 19.4 + b], [20, 19.4 + b]]), '#1e2a4a', { seam: true }); }
    }
    if (ex.has('bun') && false) { /* пучок в mkHair */ }
  }

  function renderCat(B, dir, f, col) {
    const c = col.t, d = col.T, w = f === 0 ? 0 : 1;
    if (dir === 'down') {
      fill(B, E(16, 32, 9, 6), c, { seam: true });
      fill(B, E(10.6, 36.6 + w * -0.6, 2.6, 2), c, { seam: true }); fill(B, E(21.4, 36.6 + w * 0.6, 2.6, 2), c, { seam: true });
      fill(B, E(16, 22.6, 8.2, 7), c, { seam: true });
      fill(B, TRI(10.6, 18, 9, 11, 2.6), c, { seam: true }); fill(B, TRI(21.4, 18, 23, 11, 2.6), c, { seam: true });
      flat(B, TRI(10.6, 17.4, 9.8, 13.4, 1.2), '#f0a0a0'); flat(B, TRI(21.4, 17.4, 22.2, 13.4, 1.2), '#f0a0a0');
      for (let i = 0; i < 3; i++) { flat(B, R(15.4, 16.4 + i * 1.4, 16.6, 17.2 + i * 1.4), d); }
      flat(B, E(12.4, 22, 1.5, 1.9), '#e8d040'); flat(B, E(19.6, 22, 1.5, 1.9), '#e8d040'); flat(B, E(12.4, 22.2, 0.5, 1.3), INK); flat(B, E(19.6, 22.2, 0.5, 1.3), INK);
      flat(B, TRI(16, 24.6, 16, 26.4, 0.9), '#f08a8a'); flat(B, R(13, 27.2, 19, 27.6), '#fff');
      flat(B, R(8, 24.6, 12, 25), '#fff'); flat(B, R(20, 24.6, 24, 25), '#fff');
    } else if (dir === 'up') {
      fill(B, E(16, 31, 9, 6.4), c, { seam: true });
      fill(B, E(16, 22.6, 8.2, 7), c, { seam: true });
      fill(B, TRI(10.6, 18, 9, 11, 2.6), c, { seam: true }); fill(B, TRI(21.4, 18, 23, 11, 2.6), c, { seam: true });
      fill(B, RR(14.6, 22, 17.4, 36, 1.4), d, { seam: true }); fill(B, E(16, 22, 1.6, 1.6), d);
      fill(B, E(11, 37, 2.6, 2), c, { seam: true }); fill(B, E(21, 37, 2.6, 2), c, { seam: true });
    } else {
      fill(B, E(18.4, 31, 9, 5.4), c, { seam: true });
      fill(B, SH(E(0, 0, 3, 5), 25.4, 25 + (f ? -1 : 0)), c, { seam: true });
      const lg = f === 0 ? [[10, 0], [14, 0], [21, 0], [25, 0]] : f === 1 ? [[8, 0], [15, -1], [19, -1], [26, 0]] : [[12, -1], [13, 0], [22, 0], [24, -1]];
      for (const [x, y] of lg) fill(B, RR(x - 1.4, 33 + y, x + 1.6, 38.6 + y, 1), c, { seam: true });
      fill(B, E(9, 24.4, 6.2, 5.6), c, { seam: true });
      fill(B, TRI(9.2, 21, 8, 14.6, 2.4), c, { seam: true }); fill(B, TRI(13.4, 21, 14.6, 15, 2.2), c, { seam: true });
      flat(B, E(7.6, 24, 1.4, 1.7), '#e8d040'); flat(B, E(7.4, 24.2, 0.5, 1.2), INK); flat(B, E(3.7, 25.6, 0.9, 0.7), '#f08a8a');
      for (let i = 0; i < 3; i++) flat(B, R(15 + i * 3, 27 - (i === 1 ? 0 : 0), 16.4 + i * 3, 29.4), d);
    }
  }

  function renderDog(B, dir, f, col) {
    const c = col.t, d = col.T, w = f === 0 ? 0 : 1;
    if (dir === 'down') {
      fill(B, E(16, 33.4, 7, 5.2), c, { seam: true });
      fill(B, E(11.6, 37.6 + w * -0.6, 2.4, 1.9), c, { seam: true }); fill(B, E(20.4, 37.6 + w * 0.6, 2.4, 1.9), c, { seam: true });
      fill(B, E(16, 26, 7.4, 6.4), c, { seam: true });
      fill(B, E(9, 24.4, 2.6, 4), d, { seam: true }); fill(B, E(23, 24.4, 2.6, 4), d, { seam: true });
      flat(B, E(12.6, 25, 1, 1.3), INK); flat(B, E(19.4, 25, 1, 1.3), INK); flat(B, E(12.3, 24.5, 0.35, 0.35), '#fff'); flat(B, E(19.1, 24.5, 0.35, 0.35), '#fff');
      fill(B, E(16, 28.6, 3.4, 2.4), '#fff8f0', { seam: true }); flat(B, E(16, 27.6, 1.3, 0.9), INK); flat(B, R(15.7, 28.4, 16.3, 29.6), INK);
      flat(B, TRI(16, 29.4, 16, 31, 1), '#f08a8a');
      flat(B, TRI(8, 28, 8.6, 31, 1.2), '#d83a3a'); flat(B, TRI(24, 28, 23.4, 31, 1.2), '#d83a3a');
    } else if (dir === 'up') {
      fill(B, E(16, 32.4, 7.4, 6), c, { seam: true });
      fill(B, E(16, 26, 7.4, 6.4), c, { seam: true });
      fill(B, E(9, 24.4, 2.6, 4), d, { seam: true }); fill(B, E(23, 24.4, 2.6, 4), d, { seam: true });
      fill(B, E(16, 30, 2, 3.4), d, { seam: true });
      fill(B, E(12, 37.6, 2.4, 1.9), c, { seam: true }); fill(B, E(20, 37.6, 2.4, 1.9), c, { seam: true });
    } else {
      fill(B, E(18.6, 32.6, 8.6, 4.8), c, { seam: true });
      fill(B, E(26.6, 27.4 + (f ? -0.8 : 0), 1.8, 4.4), c, { seam: true });
      const lg = f === 0 ? [[12, 0], [15, 0], [22, 0], [25, 0]] : f === 1 ? [[10, 0], [16, -1], [20, -1], [27, 0]] : [[14, -1], [14.6, 0], [23, 0], [24, -1]];
      for (const [x, y] of lg) fill(B, RR(x - 1.3, 35 + y, x + 1.5, 38.6 + y, 1), c, { seam: true });
      fill(B, E(10, 27.6, 5.6, 5), c, { seam: true });
      fill(B, E(5.4, 29.8, 3, 2.2), '#fff8f0', { seam: true }); flat(B, E(3, 29, 1.1, 0.9), INK);
      fill(B, E(13.4, 25.6, 2.2, 3.6), d, { seam: true });
      flat(B, E(8.4, 26.2, 1, 1.2), INK); flat(B, E(8.1, 25.8, 0.35, 0.35), '#fff');
      flat(B, TRI(9.6, 30.6, 10, 33.6, 1.1), '#d83a3a');
    }
  }

  // ---------- листы и портреты ----------
  const SHEETS = {}, PORTRAITS = {};
  const DIRS = ['down', 'left', 'right', 'up'];
  function blit(ctx, B, ox, oy, flip) {
    const w = B.w, h = B.h, img = ctx.createImageData(w, h), u = new Uint32Array(img.data.buffer);
    if (flip) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) u[j * w + i] = B.c[j * w + (w - 1 - i)]; }
    else u.set(B.c);
    ctx.putImageData(img, ox, oy);
  }
  function sheet(id) {
    if (SHEETS[id]) return SHEETS[id];
    const def = G.chars.DEFS[id];
    const c = G.gfx.canvas(FW * 3, FH * 4), ctx = c.getContext('2d');
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let di = 0; di < 4; di++) {
      const dir = DIRS[di], srcDir = dir === 'right' ? 'left' : dir;
      for (let f = 0; f < 3; f++) {
        const B = renderFrame(def, id, srcDir, f, 1);
        blit(ctx, B, f * FWH, di * FHH, dir === 'right');
      }
    }
    ctx.restore();
    SHEETS[id] = c;
    return c;
  }
  function draw(ctx, id, dir, frame, x, y) {
    const s = sheet(id), di = DIRS.indexOf(dir);
    ctx.drawImage(s, frame * FW, di * FH, FW, FH, Math.round(x - FW / 2), Math.round(y - FH + 1), FW, FH);
  }
  // портрет 32×32 (голова и плечи): рендер на удвоенной сетке и обрезка
  function portrait(id) {
    if (PORTRAITS[id]) return PORTRAITS[id];
    const def = G.chars.DEFS[id], k = 3;
    const B = renderFrame(def, id, 'down', 0, k);
    const c = G.gfx.canvas(32, 32), ctx = c.getContext('2d');
    const full = document.createElement('canvas'); full.width = B.w; full.height = B.h;
    const fctx = full.getContext('2d'), img = fctx.createImageData(B.w, B.h);
    new Uint32Array(img.data.buffer).set(B.c); fctx.putImageData(img, 0, 0);
    // V9: фон — тёплый дизерный градиент со светом слева сверху
    G.shade.grad(c, 0, 0, 32, 32, ['#fbf2dc', '#eadcbc', '#cdb890', '#b09a74'], { dir: 'r', cx: 9, cy: 7, r: 36, steps: 3 });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    // область: x 2..30, y 0.5..28.5 (голова + плечи), масштаб в 64 физ. пикселя
    const sx = 2 * k, sy = ((G.chars.STY[id] || {}).dog ? 15 : 0.5) * k, sw = 28 * k, sh = 28 * k;
    // мягкая тень фигуры на фоне — вправо-вниз
    const sil = G.gfx.silhouette(full, '#3a2c3a');
    ctx.globalAlpha = 0.22; ctx.drawImage(sil, sx, sy, sw, sh, 5, 5, c.width - 4, c.height - 4);
    ctx.globalAlpha = 0.14; ctx.drawImage(sil, sx, sy, sw, sh, 7, 7, c.width - 4, c.height - 4);
    ctx.globalAlpha = 1;
    ctx.drawImage(full, sx, sy, sw, sh, 2, 2, c.width - 4, c.height - 4);
    ctx.restore();
    PORTRAITS[id] = c;
    return c;
  }

  Object.assign(G.chars, { sheet, draw, portrait, renderFrame, _reset() { for (const k in SHEETS) delete SHEETS[k]; for (const k in PORTRAITS) delete PORTRAITS[k]; } });
})();
