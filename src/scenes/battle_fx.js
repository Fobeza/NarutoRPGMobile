// Визуальные эффекты боя «Дуэль шиноби»: всплывающий урон, дым, искры, снаряды, ауры, печати.
// Вынесено из scenes/battle.js (пункт «разбить монолит боя»): ядро боя отвечает за состояния и ходы,
// этот модуль — только за картинку эффектов. Поведение не изменилось (проверяется tools/node/golden.js).
//
// C — контекст боя, собирается один раз в scenes/battle.js:
//   { fx, layout, X, rnd, PAL, P, E, sgn, other, state, seals }
// fx и layout — объекты, которые меняются на месте (ссылка стабильна); state и seals — изменяемые
// переменные ядра, поэтому приходят геттерами и читаются как C.state / C.seals.
G.battleFx = {
  make(C) {
    const fx = C.fx, layout = C.layout, X = C.X, rnd = C.rnd, PAL = C.PAL;
    const P = C.P, E = C.E, sgn = C.sgn, other = C.other;

    const pop = (f, text, col, big) => fx.pops.push({ x: X(f.pos) + rnd(-6, 6), y: layout.groundY - 46, text, col: col || PAL.white, t: 0, big });
    const puff = (pos, n = 10) => { for (let i = 0; i < n; i++) fx.puffs.push({ x: X(pos) + rnd(-8, 8), y: layout.groundY - rnd(4, 30), r: rnd(3, 7), vx: rnd(-20, 20), vy: rnd(-20, 4), t: 0 }); };

    // ── визуальные эффекты боя: удары, урон, метание, печати, техники ──
    const cy = () => layout.groundY - 22;
    const V1 = (o) => { o.t = 0; o.delay = o.delay || 0; fx.vfx.push(o); return o; };
    const hurt = (f, d, dirx) => { f.hurt = 0.42; f.kb = (dirx || (f === P ? -1 : 1)) * Math.min(12, 4 + d * 0.5); f.hs = d >= 15 ? 0.12 : 0.06; };
    const impact = (f, d, col, kind) => {
      const x = X(f.pos), big = d >= 15, dirx = f === P ? -1 : 1;
      hurt(f, d, sgn(other(f), f));
      V1({ type: 'star', x, y: cy(), r: big ? 20 : 13, dur: 0.28, col: col || '#fff6c8' });
      V1({ type: 'slash', x, y: cy(), dir: dirx, dur: 0.26, big, col: kind === 'nin' ? '#9ad0ff' : '#ffffff' });
      for (let i = 0; i < (big ? 12 : 6); i++) V1({ type: 'bit', x, y: cy(), vx: rnd(-70, 70) + dirx * 30, vy: rnd(-90, -10), dur: 0.5, col: i % 2 ? '#ffd84a' : '#ffffff' });
      if (big) { fx.hitstop = 0.09; fx.zoom = 1.14; fx.zoomX = x; }
    };
    const lunge = (f, mul = 1) => { f.lg = sgn(f, other(f)) * 10 * mul; };
    const proj = (from, to, kind, n = 1) => {
      for (let i = 0; i < n; i++) V1({ type: 'proj', kind, x: X(from.pos), y: cy() - 4 + (i - (n - 1) / 2) * 7, x2: X(to.pos), y2: cy() - 2 + (i - (n - 1) / 2) * 5, dur: 0.22, delay: i * 0.05 });
    };
    const burst = (pos, col, r = 30) => { V1({ type: 'ring', x: X(pos), y: cy(), r, dur: 0.45, col }); V1({ type: 'ring', x: X(pos), y: cy(), r: r * 0.6, dur: 0.35, col: '#ffffff' }); };
    const aura = (f, col, dur = 0.9) => V1({ type: 'aura', f, dur, col });
    const leaves = (pos, n = 14) => { for (let i = 0; i < n; i++) V1({ type: 'leaf', x: X(pos), y: cy(), a: rnd(0, 6.28), sp: rnd(30, 80), dur: rnd(0.6, 1) }); };

    function enemyFx(k) {
      if (k === 'bug') { proj(E, P, 'bug', 4); aura(E, '#4a4a2a', 0.6); }
      else if (k === 'duo') { lunge(E, 1.5); V1({ type: 'ring', x: X(E.pos), y: cy(), r: 24, dur: 0.35, col: '#c8a070' }); proj(E, P, 'fang', 2); }
      else if (k === 'snake') { proj(E, P, 'snake', 3); aura(E, '#6a3a8a', 0.6); }
      else if (k === 'blades') { lunge(E, 1.4); V1({ type: 'slash', x: X(P.pos), y: cy(), dir: -sgn(E, P), dur: 0.4, big: true, col: '#8ad0ff' }); }
      else if (k === 'smoke') { puff(E.pos, 16); puff(P.pos, 10); }
      else if (k === 'fire') { proj(E, P, 'fire', 1); aura(E, '#ff7a20', 0.5); }
    }
    function updateVfx(dt) {
      for (const v of fx.vfx) {
        if (v.delay > 0) { v.delay -= dt; continue; }
        v.t += dt;
        if (v.type === 'bit') { v.x += v.vx * dt; v.y += v.vy * dt; v.vy += 260 * dt; }
      }
      fx.vfx = fx.vfx.filter((v) => v.delay > 0 || v.t < v.dur);
      for (const f of [P, E]) {
        if (f.hurt > 0) f.hurt = Math.max(0, f.hurt - dt);
        if (f.hs > 0) f.hs = Math.max(0, f.hs - dt);
        if (f.kb) { f.kb *= Math.pow(0.002, dt); if (Math.abs(f.kb) < 0.3) f.kb = 0; }
        if (f.lg) { f.lg *= Math.pow(0.0005, dt); Math.abs(f.lg) < 0.3 && (f.lg = 0); }
      }
    }
    function drawVfx(ctx, t) {
      for (const v of fx.vfx) {
        if (v.delay > 0) continue;
        const k = v.t / v.dur, a = 1 - k;
        ctx.save();
        if (v.type === 'star') {
          ctx.globalAlpha = a; ctx.strokeStyle = v.col; ctx.lineWidth = 2; ctx.beginPath();
          for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4 + 0.4, r0 = v.r * 0.25 * (1 + k), r1 = v.r * (0.5 + k); ctx.moveTo(v.x + Math.cos(an) * r0, v.y + Math.sin(an) * r0); ctx.lineTo(v.x + Math.cos(an) * r1, v.y + Math.sin(an) * r1); }
          ctx.stroke(); ctx.fillStyle = '#fff'; ctx.globalAlpha = a * 0.9; ctx.beginPath(); ctx.arc(v.x, v.y, v.r * 0.28 * a + 1, 0, 7); ctx.fill();
        } else if (v.type === 'slash') {
          ctx.globalAlpha = a; ctx.strokeStyle = v.col; ctx.lineCap = 'round';
          const L = v.big ? 26 : 18, sw = k * 0.9;
          for (let i = 0; i < (v.big ? 3 : 2); i++) { ctx.lineWidth = 3 - i; ctx.beginPath(); ctx.arc(v.x - v.dir * 4, v.y, L - i * 4, -1.2 * v.dir - 0.5 + sw * v.dir, 1.0 * v.dir + sw * v.dir * 0.4, v.dir < 0); ctx.stroke(); }
        } else if (v.type === 'bit') {
          ctx.globalAlpha = a; ctx.fillStyle = v.col; ctx.fillRect(Math.round(v.x), Math.round(v.y), 2, 2);
        } else if (v.type === 'proj') {
          const px = v.x + (v.x2 - v.x) * k, py = v.y + (v.y2 - v.y) * k - Math.sin(k * Math.PI) * 4, dirx = Math.sign(v.x2 - v.x) || 1;
          if (v.kind === 'fire') { ctx.globalAlpha = 0.9; ctx.fillStyle = '#ff9a30'; ctx.beginPath(); ctx.arc(px, py, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#ffe070'; ctx.beginPath(); ctx.arc(px + dirx * 2, py, 3, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,120,30,0.5)'; ctx.fillRect(px - dirx * 14, py - 2, 14, 4); ctx.restore(); continue; }
          if (v.kind === 'water') { ctx.globalAlpha = 0.9; ctx.fillStyle = '#4a9ae8'; ctx.beginPath(); ctx.arc(px, py, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#cfe8ff'; ctx.fillRect(px - 2, py - 3, 2, 2); ctx.fillStyle = 'rgba(74,154,232,0.5)'; ctx.fillRect(px - dirx * 16, py - 2, 16, 4); ctx.restore(); continue; }
          if (v.kind === 'bolt') { ctx.strokeStyle = '#f0f070'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(v.x, v.y); for (let i = 1; i <= 7; i++) { const q = i / 7; ctx.lineTo(v.x + (px - v.x) * q, v.y + (py - v.y) * q + (i % 2 ? -6 : 6) * (1 - q) + Math.sin(t * 90 + i) * 2); } ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); continue; }
          if (v.kind === 'wind') { ctx.strokeStyle = 'rgba(200,240,220,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 7, t * 20, t * 20 + 4); ctx.stroke(); ctx.beginPath(); ctx.arc(px - dirx * 10, py, 5, -t * 20, -t * 20 + 3.5); ctx.stroke(); ctx.restore(); continue; }
          if (v.kind === 'bug') { ctx.fillStyle = '#2a2a1a'; for (let i = 0; i < 5; i++) ctx.fillRect(px - dirx * i * 3 + Math.sin(t * 40 + i * 2) * 3, py + Math.cos(t * 30 + i) * 4, 2, 2); ctx.restore(); continue; }
          if (v.kind === 'snake') { ctx.strokeStyle = '#4a9a3a'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i <= 8; i++) { const q = i / 8, xx = v.x + (px - v.x) * q, yy = py + Math.sin(q * 9 + t * 20) * 4; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); ctx.restore(); continue; }
          if (v.kind === 'fang') { ctx.globalAlpha = 0.7; ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.moveTo(px - dirx * 12, py - 4); ctx.lineTo(px + dirx * 6, py); ctx.lineTo(px - dirx * 12, py + 4); ctx.fill(); ctx.restore(); continue; }
          ctx.translate(px, py);
          ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff'; ctx.fillRect(-dirx * 14, -1, 14 * dirx > 0 ? 14 : -14, 1);
          ctx.globalAlpha = 1;
          if (v.kind === 'shuriken') { ctx.rotate(t * 30); ctx.fillStyle = '#c8ccd8'; ctx.fillRect(-5, -1, 10, 2); ctx.fillRect(-1, -5, 2, 10); ctx.fillStyle = '#555a6a'; ctx.fillRect(-1, -1, 2, 2); }
          else { ctx.rotate(dirx > 0 ? 0 : Math.PI); ctx.rotate(k * 2); ctx.fillStyle = '#c8ccd8'; ctx.fillRect(-1, -6, 3, 8); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-1, 2, 3, 4); if (v.kind === 'tag') { ctx.fillStyle = '#e8dcc0'; ctx.fillRect(2, 0, 3, 5); ctx.fillStyle = '#d03020'; ctx.fillRect(3, 1, 1, 3); } }
        } else if (v.type === 'ring') {
          ctx.globalAlpha = a * 0.8; ctx.strokeStyle = v.col; ctx.lineWidth = 3 * a + 1; ctx.beginPath(); ctx.arc(v.x, v.y, v.r * (0.2 + k * 0.8), 0, 7); ctx.stroke();
          if (k < 0.5) { ctx.globalAlpha = (0.5 - k); ctx.fillStyle = v.col; ctx.fill(); }
        } else if (v.type === 'leaf') {
          const an = v.a + k * 7, r = 4 + k * v.sp * 0.5;
          ctx.globalAlpha = a; ctx.fillStyle = '#5a9a3a'; ctx.fillRect(Math.round(v.x + Math.cos(an) * r), Math.round(v.y - k * 18 + Math.sin(an) * r * 0.6), 3, 2);
        } else if (v.type === 'aura') {
          const x = X(v.f.pos) + (v.f.kb || 0), pulse = 0.6 + 0.4 * Math.sin(t * 18);
          ctx.globalAlpha = Math.min(1, a * 1.4) * 0.5 * pulse; ctx.fillStyle = v.col; ctx.beginPath(); ctx.ellipse(x, layout.groundY - 14, 14, 24, 0, 0, 7); ctx.fill();
        }
        ctx.restore();
      }
    }
    // аура и печати над героем, пока идёт ввод печатей
    function drawSealGlow(ctx, t) {
      if (C.state !== 'seals' || !C.seals) return;
      const x = X(P.pos), n = C.seals.seq.length, prog = C.seals.i / n, gy = layout.groundY;
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.35 * prog; ctx.fillStyle = '#5ab0ff';
      ctx.beginPath(); ctx.ellipse(x, gy - 16, 12 + prog * 6, 22 + prog * 6, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      for (let i = 0; i < 8; i++) { const ph = (t * 1.3 + i / 8) % 1; ctx.fillStyle = i % 2 ? '#bfe4ff' : '#5ab0ff'; ctx.fillRect(Math.round(x + Math.sin(i * 2.4 + t * 3) * (10 + prog * 6)), Math.round(gy - 6 - ph * 40), 2, 2); }
      // кружок печати над головой: сегменты по числу печатей
      const cy0 = gy - 56, R = 9;
      ctx.translate(x, cy0); ctx.rotate(t * (1 + prog * 3));
      ctx.strokeStyle = '#9ad0ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke();
      for (let i = 0; i < n; i++) { const an = i / n * 6.283; ctx.fillStyle = i < C.seals.i ? '#ffe070' : '#33507a'; ctx.fillRect(Math.round(Math.cos(an) * R) - 1, Math.round(Math.sin(an) * R) - 1, 3, 3); }
      ctx.restore();
    }

    return { pop, puff, cy, V1, hurt, impact, lunge, proj, burst, aura, leaves, enemyFx, updateVfx, drawVfx, drawSealGlow };
  },
};
