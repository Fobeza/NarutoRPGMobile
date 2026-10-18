// Фоны арен V9: небо, дальние планы, дымка и земля — кодом, со светом сверху-слева и дизерными переходами.
// Фон запекается один раз на размер арены (кэш по арене и размеру); облака плывут поверх каждый кадр.
//   G.battleBg.get(terrain, W, H) → холст W×H (лог. px); земля начинается на H − 14
//   G.battleBg.clouds(ctx, terrain, x0, y0, W, H, t) — облака с объёмом
//   G.battleBg.obj(kind, dark) → { img, ox, oy } — предметы на арене (дерево, куст, камень, брёвна, вода)
G.battleBg = (() => {
  const S = G.shade, Hh = G.util.hash2;
  const cache = {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // гладкий одномерный шум (сумма октав) — для хребтов и кромок
  function noise1(x, seed) {
    let v = 0, amp = 1, f = 1, tot = 0;
    for (let o = 0; o < 4; o++) {
      const xi = Math.floor(x * f), t = x * f - xi, s = t * t * (3 - 2 * t);
      const a = Hh(xi, seed + o * 13, 401), b = Hh(xi + 1, seed + o * 13, 401);
      v += (a + (b - a) * s) * amp; tot += amp; amp *= 0.5; f *= 2.1;
    }
    return v / tot;
  }

  // ---------- примитивы ----------
  // полупрозрачная заливка по столбцам: top(x) → верх, цвет — по высоте (0 у верха, 1 у низа) из ступеней cols
  function cols(c, top, bottom, colsArr, o = {}) {
    const P = S.pix(c), k = P.k, C = colsArr.map(S.rgb), n = C.length;
    const lit = o.lit != null ? o.lit : 0.3, litC = S.rgb(o.litCol || '#fff2cc'), rimC = o.rim ? S.rgb(o.rim) : null;
    for (let i = 0; i < P.w; i++) {
      const x = (i + 0.5) / k, y0 = top(x), y1 = bottom;
      const slope = top(x + 1.5) - top(x - 1.5);           // < 0 — склон смотрит влево, к свету
      const J0 = Math.max(0, Math.ceil(y0 * k)), J1 = Math.min(P.h, Math.round(y1 * k));
      for (let j = J0; j < J1; j++) {
        const f = (j - J0) / Math.max(1, J1 - J0);
        const q = clamp(Math.floor(f * (n - 0.01) + (S.bayer(i, j) - 0.5) * 0.9), 0, n - 1);
        let col = C[q];
        const depth = (j - J0) / k;
        if (rimC && depth < 1) col = rimC;
        else if (slope < -0.25 && depth < 6) {                 // освещённый склон: тёплый блик, к глубине гаснет
          const a = clamp(-slope * 0.35, 0, 1) * lit * (1 - depth / 6);
          if (a > S.bayer(i + 2, j) * 0.6) col = S.mix(col, litC, Math.min(0.6, a + 0.12));
        }
        const p = (j * P.w + i) * 4;
        P.d[p] = col[0]; P.d[p + 1] = col[1]; P.d[p + 2] = col[2]; P.d[p + 3] = 255;
      }
    }
    P.put();
  }
  // дымка: к низу полосы плотнее (атмосферная перспектива), сглаженно
  function haze(c, y0, y1, col, a0, a1) {
    const P = S.pix(c), k = P.k, C = S.rgb(col);
    for (let j = Math.max(0, Math.round(y0 * k)); j < Math.min(P.h, Math.round(y1 * k)); j++) {
      const f = (j / k - y0) / (y1 - y0), a = a0 + (a1 - a0) * f;
      for (let i = 0; i < P.w; i++) {
        const p = (j * P.w + i) * 4; if (!P.d[p + 3]) continue;
        const q = Math.floor(a * 8 + S.bayer(i, j)) / 8;
        P.d[p] += (C[0] - P.d[p]) * q; P.d[p + 1] += (C[1] - P.d[p + 1]) * q; P.d[p + 2] += (C[2] - P.d[p + 2]) * q;
      }
    }
    P.put();
  }
  // свечение (солнце, луна, фонарь): мягкое радиальное смешивание
  function glow(c, cx, cy, r, col, a) {
    S.grad(c, cx - r, cy - r, r * 2, r * 2, [col, col], { dir: 'r', cx, cy, r, alpha: a, fade: true, clip: true });
  }
  // лиственная гряда: ряд шаров листвы со светом
  function treeline(c, base, W, seed, pal, o = {}) {
    const step = o.step || 16, sz = o.size || 12;
    for (let x = -step; x < W + step; x += step * (0.7 + Hh(x, seed, 5) * 0.5)) {
      const r = sz * (0.75 + Hh(x, seed, 6) * 0.5), y = base - r * 0.6 - Hh(seed, x, 7) * sz * 0.5;
      if (o.trunk) { const ctx = c.getContext('2d'); ctx.fillStyle = o.trunk; ctx.fillRect(Math.round(x - 1), Math.round(y), 3, Math.ceil(base - y + 4)); }
      S.ball(c, x, y, r, r * 0.9, pal, { noise: 0.42, grain: 1.5, seed: seed + Math.round(x) });
      S.ball(c, x - r * 0.35, y - r * 0.3, r * 0.55, r * 0.5, pal.slice(1), { noise: 0.4, grain: 1.5, seed: seed + 7 + Math.round(x) });
    }
  }
  // земля: градиент от кромки вниз, кромка-блик, кочки травы и камешки
  function ground(c, y0, W, H, pal, o = {}) {
    S.grad(c, 0, y0, W, H - y0, pal, { dir: 'v', steps: 2 });
    const ctx = c.getContext('2d');
    ctx.fillStyle = o.edge || S.toneHex(pal[0], 0.25); ctx.fillRect(0, y0, W, 1);
    ctx.globalAlpha = 0.35; ctx.fillStyle = S.toneHex(pal[0], -0.5); ctx.fillRect(0, y0 + 1, W, 1); ctx.globalAlpha = 1;
    for (let i = 0; i < W / 5; i++) {
      const x = Math.floor(Hh(i, 3, 71) * W), y = y0 + 3 + Math.floor(Hh(3, i, 72) * (H - y0 - 4)), r = Hh(i, i, 73);
      if (o.tufts && r > 0.5) { ctx.fillStyle = o.tufts[0]; ctx.fillRect(x, y - 2, 1, 2); ctx.fillRect(x + 2, y - 1, 1, 1); ctx.fillStyle = o.tufts[1]; ctx.fillRect(x + 1, y - 3, 1, 3); }
      else { ctx.fillStyle = S.toneHex(pal[1], r > 0.25 ? 0.22 : -0.3); ctx.fillRect(x, y, r > 0.15 ? 2 : 1, 1); }
    }
  }

  // ---------- арены ----------
  const DRAW = {
    field(c, W, H, gy, s) {
      S.grad(c, 0, 0, W, gy + 2, ['#4a8ad8', '#7ab4ec', '#b4dcf6', '#e4f2f8'], { dir: 'v', steps: 3 });
      glow(c, W * 0.18, H * 0.12, 70, '#fff6d8', 0.55);
      const m1 = (x) => gy - (46 + noise1(x / 60, 3) * 40) * s;
      cols(c, m1, gy, ['#8aa8c8', '#9ab8d0', '#a8c4d8'], { lit: 0.45 });
      haze(c, gy - 90 * s, gy, '#d8ecf6', 0.1, 0.45);
      const m2 = (x) => gy - (22 + noise1(x / 38, 9) * 26) * s;
      cols(c, m2, gy, ['#4e8a5a', '#5a9a5e', '#6aa868'], { lit: 0.5 });
      haze(c, gy - 50 * s, gy, '#cfe6ee', 0, 0.3);
      treeline(c, gy, W, 21, ['#24502e', '#2e6a32', '#3e8a42', '#5aaa52', '#86c46a'], { step: 15, size: 9 });
      ground(c, gy, W, H, ['#7cb05a', '#5e9446', '#4a7a3a'], { tufts: ['#3e7a34', '#9ad070'] });
    },
    yard(c, W, H, gy, s) {
      S.grad(c, 0, 0, W, gy + 2, ['#5a9ae0', '#8ac2ee', '#c4e2f6', '#f0f2ea'], { dir: 'v', steps: 3 });
      glow(c, W * 0.15, H * 0.1, 80, '#fff4d0', 0.6);
      // Скала Хокаге вдали
      const rock = (x) => gy - (58 + noise1(x / 24, 5) * 14 + Math.max(0, 30 - Math.abs(x - W * 0.62) * 0.3)) * s;
      cols(c, rock, gy, ['#a89a8a', '#b8a896', '#c4b6a2'], { lit: 0.6 });
      haze(c, gy - 110 * s, gy, '#e4eef2', 0.15, 0.5);
      // ограда Академии и деревья
      treeline(c, gy - 6, W, 33, ['#2e5a32', '#3a7a3e', '#4e9a4a', '#72b85e', '#a0d07a'], { step: 26, size: 13, trunk: '#5a3a24' });
      const ctx = c.getContext('2d');
      for (let x = 2; x < W; x += 9) {
        ctx.fillStyle = '#6a4226'; ctx.fillRect(x, gy - 16, 3, 16); ctx.fillStyle = '#9a6a42'; ctx.fillRect(x, gy - 16, 1, 16);
        ctx.fillStyle = '#4a2a16'; ctx.fillRect(x + 2, gy - 16, 1, 16);
      }
      ctx.fillStyle = '#7a4a2a'; ctx.fillRect(0, gy - 13, W, 2); ctx.fillRect(0, gy - 7, W, 2);
      ctx.fillStyle = '#a8703e'; ctx.fillRect(0, gy - 13, W, 1); ctx.fillRect(0, gy - 7, W, 1);
      S.tint(c, 0, gy - 16, W, 16, (u, v) => 0.1 - 0.3 * u + (v > 0.8 ? -0.2 : 0));
      ground(c, gy, W, H, ['#d8b67a', '#c8a26a', '#a8824e'], { edge: '#ecd29a' });
    },
    forest(c, W, H, gy, s) {
      S.grad(c, 0, 0, W, gy + 2, ['#3a6a4a', '#5a8a62', '#8ab08a', '#a8c49a'], { dir: 'v', steps: 3 });
      const ctx = c.getContext('2d');
      // дальние стволы в дымке, ближние — темнее и с бликом слева
      for (const [n, wd, col, hk] of [[9, 6, '#4a6e52', 0.55], [6, 11, '#2e4a32', 0.2]]) {
        for (let i = 0; i < n; i++) {
          const x = Math.round((i + Hh(i, n, 3) * 0.6) * W / n), w = Math.round(wd * (0.8 + Hh(n, i, 4) * 0.5));
          ctx.fillStyle = col; ctx.fillRect(x, 0, w, gy + 2);
          S.tint(c, x, 0, w, gy + 2, (u) => 0.3 - u * 0.75);
        }
        haze(c, 0, gy, '#9ab894', hk * 0.5, hk);
      }
      // кроны сверху и лучи света
      for (let x = -10; x < W + 20; x += 22) S.ball(c, x, 6 + Hh(x, 1, 2) * 10, 22, 16, ['#14301c', '#1e4a26', '#2e6a32', '#4a8a3e'], { noise: 0.5, grain: 2, seed: x });
      for (let i = 0; i < 4; i++) {
        const x0 = W * (0.1 + i * 0.24), g = c.getContext('2d');
        g.save(); g.globalAlpha = 0.09; g.fillStyle = '#fff4c0';
        g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + 14, 0); g.lineTo(x0 + 54, gy); g.lineTo(x0 + 30, gy); g.fill(); g.restore();
      }
      treeline(c, gy + 2, W, 41, ['#14301c', '#1e4a26', '#2e6a32', '#3e8a42', '#5aa04a'], { step: 13, size: 7 });
      ground(c, gy, W, H, ['#4e7a3a', '#3a6a2e', '#2a4a22'], { tufts: ['#2a5a24', '#6a9a4a'] });
    },
    night(c, W, H, gy, s) {
      S.grad(c, 0, 0, W, gy + 2, ['#07061a', '#0e0c26', '#1c1a3c', '#2e2c50'], { dir: 'v', steps: 3 });
      const ctx = c.getContext('2d');
      for (let i = 0; i < 70; i++) {
        const x = Math.floor(Hh(i, 1, 81) * W), y = Math.floor(Hh(1, i, 82) * gy * 0.7), b = Hh(i, i, 83);
        ctx.fillStyle = b > 0.85 ? '#ffffff' : b > 0.5 ? '#c8c8f0' : '#7a7aa8'; ctx.fillRect(x, y, 1, 1);
        if (b > 0.94) { ctx.globalAlpha = 0.5; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); ctx.globalAlpha = 1; }
      }
      const mx = W * 0.22, my = H * 0.2;
      glow(c, mx, my, 46, '#8a90d0', 0.35);
      S.ball(c, mx, my, 10, 10, ['#c8c0a0', '#e4dcbc', '#f4ecd0', '#fffaf0']);
      ctx.fillStyle = '#c8bea0'; ctx.fillRect(mx - 3, my - 2, 3, 2); ctx.fillRect(mx + 3, my + 3, 2, 2);
      const m1 = (x) => gy - (36 + noise1(x / 50, 13) * 30) * s;
      cols(c, m1, gy, ['#1e2238', '#22263e', '#262a44'], { lit: 0.3, litCol: '#7a80b8' });
      haze(c, gy - 70 * s, gy, '#3a3a60', 0, 0.3);
      treeline(c, gy, W, 51, ['#080c10', '#0e1618', '#142024', '#1e3030', '#3a4a5a'], { step: 15, size: 10 });
      ground(c, gy, W, H, ['#2a3a2a', '#1e2c22', '#141e18'], { edge: '#3e5244', tufts: ['#1a2a1e', '#3e5a44'] });
    },
    river(c, W, H, gy, s) {
      S.grad(c, 0, 0, W, gy + 2, ['#4a8ad8', '#7ab8ec', '#bce0f6', '#e8f4f8'], { dir: 'v', steps: 3 });
      glow(c, W * 0.2, H * 0.12, 70, '#fff6d8', 0.5);
      const m1 = (x) => gy - (60 + noise1(x / 46, 17) * 44) * s;
      cols(c, m1, gy, ['#7a98bc', '#8aa8c8', '#9cb8d2'], { lit: 0.5 });
      haze(c, gy - 110 * s, gy, '#dceef6', 0.1, 0.5);
      treeline(c, gy - 26, W, 61, ['#2e5a3a', '#3e7a44', '#4e9a4e', '#6ab45e', '#94cc78'], { step: 14, size: 8 });
      // река: глубже к берегу, блики и отражения
      S.grad(c, 0, gy - 24, W, 22, ['#8ac4ec', '#4a90d0', '#2e6aa8'], { dir: 'v', steps: 3 });
      const ctx = c.getContext('2d');
      for (let i = 0; i < 26; i++) {
        const x = Math.floor(Hh(i, 2, 91) * W), y = gy - 22 + Math.floor(Hh(2, i, 92) * 18), w = 3 + Math.floor(Hh(i, 9, 93) * 10);
        ctx.fillStyle = Hh(i, i, 94) > 0.5 ? '#c8e8fa' : '#6aaee0'; ctx.fillRect(x, y, w, 1);
      }
      ctx.fillStyle = '#5a8a3a'; ctx.fillRect(0, gy - 3, W, 3);
      ground(c, gy, W, H, ['#9ac06a', '#7aa04e', '#5a7a3a'], { tufts: ['#4e7a34', '#b8dc84'] });
    },
    street(c, W, H, gy, s) {
      S.grad(c, 0, 0, W, gy + 2, ['#5a4a8a', '#c8708a', '#f0a070', '#f8d8a0'], { dir: 'v', steps: 3 });
      glow(c, W * 0.25, gy - 62 * s, 90, '#ffd890', 0.6);
      S.ball(c, W * 0.25, gy - 62 * s, 13, 13, ['#ffb860', '#ffd890', '#fff0c0']);
      const m1 = (x) => gy - (30 + noise1(x / 70, 23) * 30) * s;
      cols(c, m1, gy, ['#8a5a6a', '#9a6a70', '#a87a72'], { lit: 0.2 });
      haze(c, gy - 70 * s, gy, '#f0b88a', 0.1, 0.5);
      // силуэты домов Конохи: стены, крыши с загнутыми краями, тёплые окна
      const ctx = c.getContext('2d');
      let x = -6;
      while (x < W + 10) {
        const w = 26 + Math.floor(Hh(x, 1, 11) * 22), h = Math.round((22 + Math.floor(Hh(1, x, 12) * 24)) * s), y = gy - h;
        ctx.fillStyle = '#5a3a3a'; ctx.fillRect(x, y, w, h + 2);
        S.tint(c, x, y, w, h, (u, v) => 0.18 - u * 0.4 - v * 0.15);
        ctx.fillStyle = '#3a2430'; ctx.beginPath(); ctx.moveTo(x - 4, y + 1); ctx.lineTo(x + w / 2, y - 9); ctx.lineTo(x + w + 4, y + 1); ctx.fill();
        ctx.fillStyle = '#e8906a'; ctx.fillRect(x - 3, y, Math.round(w / 2), 1);           // тёплый блик заката на скате
        for (let wy = y + 5; wy < gy - 6; wy += 9) for (let wx = x + 4; wx < x + w - 5; wx += 8)
          if (Hh(wx, wy, 13) > 0.45) { ctx.fillStyle = '#ffc870'; ctx.fillRect(wx, wy, 3, 4); ctx.fillStyle = '#fff0b0'; ctx.fillRect(wx, wy, 1, 1); }
        x += w + 2;
      }
      haze(c, gy - 50 * s, gy, '#d88a6a', 0, 0.22);
      for (let i = 0; i < 4; i++) { const lx = W * (0.15 + i * 0.25); glow(c, lx, gy - 12, 10, '#ffc060', 0.35); ctx.fillStyle = '#e84a3a'; ctx.fillRect(lx - 2, gy - 15, 4, 5); ctx.fillStyle = '#ffd84a'; ctx.fillRect(lx - 2, gy - 13, 4, 1); }
      ground(c, gy, W, H, ['#b8945a', '#9a7848', '#7a5a36'], { edge: '#e0b878' });
    },
    ring(c, W, H, gy, s) {
      S.grad(c, 0, 0, W, gy + 2, ['#5a9ae0', '#8ac4ee', '#cce6f6', '#eef6f8'], { dir: 'v', steps: 3 });
      glow(c, W * 0.15, H * 0.1, 70, '#fff6d8', 0.5);
      const ctx = c.getContext('2d');
      // трибуны: ярусы каменных стен со зрителями-точками, флаги
      const tiers = [[gy - 10 - 68 * s, 22 * s, '#9a9aa8'], [gy - 10 - 46 * s, 23 * s, '#8a8a98'], [gy - 10 - 22 * s, 22 * s, '#7a7a8a']].map(([y, h, col]) => [Math.round(y), Math.ceil(h), col]);
      for (const [y, h, col] of tiers) {
        ctx.fillStyle = col; ctx.fillRect(0, y, W, h);
        S.tint(c, 0, y, W, h, (u, v) => 0.2 - v * 0.45 - u * 0.12);
        ctx.fillStyle = S.toneHex(col, 0.35); ctx.fillRect(0, y, W, 1);
        for (let x = 1; x < W; x += 3) if (Hh(x, y, 5) > 0.35) {
          ctx.fillStyle = ['#e8621a', '#2a4a9a', '#f0c040', '#c8401c', '#f4ecd8', '#3a7a4a'][Math.floor(Hh(y, x, 6) * 6)];
          ctx.fillRect(x, y + 3 + Math.floor(Hh(x, 2, y) * 3), 2, 2);
        }
      }
      for (let i = 0; i < 6; i++) {
        const fx = Math.round(W * (0.08 + i * 0.17)); const fy = Math.round(gy - 10 - 68 * s - 22); ctx.fillStyle = '#4a3a2a'; ctx.fillRect(fx, fy, 1, 24);
        ctx.fillStyle = i % 2 ? '#c8401c' : '#e8621a'; ctx.fillRect(fx + 1, fy, 9, 6); ctx.fillStyle = '#f4ecd8'; ctx.fillRect(fx + 4, fy + 2, 3, 2);
      }
      haze(c, gy - 10 - 100 * s, gy - 10, '#dceaf2', 0.25, 0.05);
      ctx.fillStyle = '#6a6a7a'; ctx.fillRect(0, gy - 10, W, 10); ctx.fillStyle = '#9a9aa8'; ctx.fillRect(0, gy - 10, W, 1);
      for (let x = 0; x < W; x += 12) { ctx.fillStyle = '#5a5a6a'; ctx.fillRect(x, gy - 9, 1, 9); }
      ground(c, gy, W, H, ['#e0c48a', '#d8b67a', '#b8945a'], { edge: '#f0dca8' });
    },
  };

  function get(terrain, W, H) {
    const t = DRAW[terrain] ? terrain : 'field', key = t + ':' + W + 'x' + H;
    if (cache[key]) return cache[key];
    const c = G.gfx.canvas(W, H);
    DRAW[t](c, W, H, H - 14, clamp(H / 190, 1, 2));   // s — растяжка высоты пейзажа под высокую арену
    for (const k of Object.keys(cache)) if (k.startsWith(t + ':')) delete cache[k];   // держим один размер на арену
    return (cache[key] = c);
  }

  // ---------- облака: запечённые спрайты с объёмом, плывут поверх фона ----------
  const CLOUD = { field: 1, yard: 1, river: 1, ring: 1, street: 0.6, forest: 0, night: 0.25 };
  const cloudCache = {};
  function cloudImg(i, dusk, night) {
    const key = i + ':' + dusk + ':' + night;
    if (cloudCache[key]) return cloudCache[key];
    const w = 34 + (i % 3) * 10, h = 14, c = G.gfx.canvas(w, h);
    const pal = night ? ['#2a2a4a', '#3a3a5a', '#4a4a6a'] : dusk ? ['#a8607a', '#e89a8a', '#ffd0a8', '#fff0d8'] : ['#b8c8dc', '#dde8f2', '#f4f8fc', '#ffffff'];
    S.ball(c, w * 0.5, h * 0.62, w * 0.48, h * 0.36, pal);
    S.ball(c, w * 0.36, h * 0.5, w * 0.2, h * 0.42, pal);
    S.ball(c, w * 0.6, h * 0.42, w * 0.18, h * 0.38, pal);
    return (cloudCache[key] = c);
  }
  function clouds(ctx, terrain, x0, y0, W, H, t) {
    const k = CLOUD[terrain] == null ? 1 : CLOUD[terrain]; if (!k) return;
    for (let i = 0; i < 5; i++) {
      const img = cloudImg(i, terrain === 'street', terrain === 'night'), sp = 2 + i * 1.3;
      const x = ((i * 83 + t * sp) % (W + img.lw + 40)) - img.lw - 20, y = y0 + 8 + ((i * 29) % Math.max(20, H * 0.4));
      ctx.globalAlpha = k * (0.75 + (i % 2) * 0.25); ctx.drawImage(img, Math.round(x0 + x), Math.round(y)); ctx.globalAlpha = 1;
    }
  }

  // ---------- предметы на арене ----------
  const objCache = {};
  function obj(kind, dark) {
    const key = kind + ':' + (dark ? 1 : 0);
    if (objCache[key]) return objCache[key];
    let r = null;
    const leaf = dark ? ['#0e1a14', '#162a1e', '#1e3a26', '#2a4a32', '#4a6070'] : ['#1e4a26', '#2e6a32', '#3e8a42', '#5aaa52', '#8ac86a'];
    if (kind === 'tree') {
      const c = G.gfx.canvas(40, 70), g = c.getContext('2d');
      g.fillStyle = '#4a2a16'; g.fillRect(16, 30, 8, 40); g.fillStyle = '#7a4a2a'; g.fillRect(17, 30, 4, 40); g.fillStyle = '#9a6a42'; g.fillRect(17, 30, 1, 40);
      g.fillStyle = '#3a2010'; g.fillRect(13, 67, 14, 3);
      S.ball(c, 20, 26, 19, 17, [S.toneHex(leaf[0], -0.4), leaf[0]]);
      S.ball(c, 20, 26, 18, 16, leaf.slice(0, 4), { noise: 0.4, seed: 5 });
      for (const [x, y, rr] of [[11, 30, 9], [29, 30, 8], [13, 18, 9], [27, 17, 8], [20, 11, 9], [20, 25, 10]])
        S.ball(c, x, y, rr, rr * 0.9, leaf, { noise: 0.5, grain: 1.5, seed: x * 3 + y });
      if (dark) S.tint(c, 0, 0, 40, 70, (u) => -0.15 + (u > 0.6 ? 0 : 0));
      r = { img: c, ox: -20, oy: -70 };
    } else if (kind === 'bush') {
      const c = G.gfx.canvas(30, 16);
      S.ball(c, 15, 10, 14.5, 6.5, [S.toneHex(leaf[0], -0.4), leaf[0]]);
      S.ball(c, 9, 10, 7.5, 5.5, leaf, { noise: 0.5, grain: 1.5, seed: 1 }); S.ball(c, 21, 10, 7.5, 5.5, leaf, { noise: 0.5, grain: 1.5, seed: 2 });
      S.ball(c, 15, 7, 7, 5.5, leaf, { noise: 0.5, grain: 1.5, seed: 3 });
      r = { img: c, ox: -15, oy: -15 };
    } else if (kind === 'rock') {
      const c = G.gfx.canvas(26, 16);
      const st = dark ? ['#2a2a38', '#3a3a4a', '#4a4a5a', '#5a5a6a'] : ['#4a4a5a', '#6a6a7a', '#8a8a98', '#a8a8b8', '#c8c8d4'];
      S.ball(c, 13, 10, 12.5, 7, [S.toneHex(st[0], -0.4), st[0]]); S.ball(c, 13, 10, 12, 6.5, st, { noise: 0.25, grain: 2, seed: 4 });
      S.ball(c, 9, 7, 6, 4.5, st.slice(1), { noise: 0.2, seed: 6 });
      r = { img: c, ox: -13, oy: -15 };
    } else if (kind === 'logs') {
      const c = G.gfx.canvas(28, 18), g = c.getContext('2d');
      for (let i = 0; i < 3; i++) {
        const x = 2 + i * 3, y = 12 - i * 5, w = 24 - i * 6;
        g.fillStyle = '#4a2a16'; g.fillRect(x, y, w, 5); g.fillStyle = '#a8683a'; g.fillRect(x, y + 1, w - 1, 3); g.fillStyle = '#c88a52'; g.fillRect(x, y + 1, w - 1, 1);
        S.ball(c, x + w - 1, y + 2.5, 2.5, 2.5, ['#7a4a26', '#c89a62', '#e8c08a']);
      }
      r = { img: c, ox: -13, oy: -17 };
    } else if (kind === 'water') {
      const c = G.gfx.canvas(40, 10);
      S.grad(c, 1, 1, 38, 8, ['#7ac0f0', '#3a8ad0', '#2a62a0'], { dir: 'v', steps: 2 });
      r = { img: c, ox: -20, oy: -4 };
    }
    return (objCache[key] = r);
  }

  return { get, clouds, obj, noise1, cols, haze, glow, treeline, cloudImg };
})();
