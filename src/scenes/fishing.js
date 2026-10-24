// Мини-игра «Рыбалка»: заброс → ожидание поклёвки → подсечка (A вовремя) → вываживание (держи A, следи за натяжением).
// make('fishing', { spot, left() }, onCatch(id|null), onClose())
G.scenes.register('fishing', (opts, onCatch, onClose) => {
  const W = G.screen.W, F = G.font, P = G.PAL, AU = G.audio, In = G.input;
  const NAMES = { fish: 'Рыба', eel: 'Угорь', carp: 'Золотой карп', boot: 'Старый сапог', herb_blue: 'Голубой лотос' };
  let phase = 'ready', t = 0, wait = 0, fishId = null, str = 1;
  let tension = 0.3, prog = 0, slack = 0, pull = 0, pullT = 0, msg = '', result = null;
  const hookWin = () => 0.75 + (G.hero.has('eagle_eye') ? 0.25 : 0) + G.hero.stat('spd') * 0.02;
  const S = {
    name: 'fishing',
    get phase() { return phase; },
    touch: () => ({ back: phase === 'ready' || phase === 'result' }),
    finishNow(id) { fishId = id || 'fish'; end(true); },   // для автотеста
    update(dt) {
      t += dt;
      const A = In.pressed('a') || !!In.tapNow, hold = In.held('a') || !!In.tapNow || In.tapHeld > 0;
      if (In.pressed('b') && (phase === 'ready' || phase === 'result')) { AU.sfx.cancel(); G.scenes.pop(); onClose && onClose(); return; }
      if (phase === 'ready') { if (A && t > 0.2) { if (opts.left() <= 0) { msg = 'Рыба больше не клюёт сегодня.'; return; } phase = 'wait'; t = 0; wait = 1.5 + Math.random() * 4; AU.sfx.blip(); msg = ''; } return; }
      if (phase === 'wait') {
        if (A) { msg = 'Рано! Рыба испугалась.'; AU.sfx.error(); fishId = null; return end(false); }
        if (t >= wait) { phase = 'bite'; t = 0; fishId = G.outdoor.rollCatch(opts.spot); str = G.outdoor.STRENGTH[fishId] || 1; AU.sfx.react ? AU.sfx.react() : AU.sfx.select(); }
        return;
      }
      if (phase === 'bite') {
        if (A) { phase = 'reel'; t = 0; tension = 0.35; prog = 0.1; slack = 0; AU.sfx.confirm(); return; }
        if (t > hookWin()) { msg = 'Сорвалась... Не успел подсечь.'; return end(false); }
        return;
      }
      if (phase === 'reel') {
        pullT -= dt;
        if (pullT <= 0) { pull = Math.random() < 0.45 ? (0.35 + Math.random() * 0.5) * str : 0; pullT = 0.4 + Math.random() * 0.9; }
        const ctrl = G.hero.stat('ctrl');
        tension += (hold ? 0.55 : -0.7) * dt + pull * 0.5 * dt;
        tension = Math.max(0, tension);
        if (hold && tension < 0.85) prog += dt * (0.32 - pull * 0.12) / Math.max(0.6, str * 0.8) * (1 + ctrl * 0.03);
        else if (!hold) prog -= dt * 0.05 * str;
        if (tension < 0.12) slack += dt; else slack = 0;
        if (tension >= 1) { msg = 'Леска лопнула!'; AU.sfx.error(); return end(false); }
        if (slack > 1.6 || prog < 0) { msg = 'Рыба ушла с крючка.'; return end(false); }
        if (prog >= 1) return end(true);
        return;
      }
      if (phase === 'result') { if (A && t > 0.5) { phase = 'ready'; t = 0; result = null; msg = ''; } }
    },
    draw(ctx) {
      const H = G.screen.H;
      // небо и вода
      const hour = (G.state.vars.min % 1440) / 60, night = hour < 5 || hour >= 20;
      ctx.fillStyle = night ? '#1a1e3a' : hour < 7 || hour >= 18 ? '#e8906a' : '#8ac8f0'; ctx.fillRect(0, 0, W, H * 0.35);
      ctx.fillStyle = night ? '#16305a' : '#3a8ad0'; ctx.fillRect(0, H * 0.35, W, H * 0.65);
      for (let i = 0; i < 14; i++) { ctx.fillStyle = night ? '#25457a' : '#7ac0f0'; ctx.fillRect((i * 37 + t * 8) % (W + 20) - 10, H * 0.38 + (i * 23) % (H * 0.5), 8, 1); }
      ctx.fillStyle = '#5a8a3a'; ctx.fillRect(0, H * 0.33, W, 4);
      // пристань и герой
      ctx.fillStyle = '#a8683a'; ctx.fillRect(0, H - 60, 70, 12); ctx.fillStyle = '#7a4626'; ctx.fillRect(8, H - 48, 4, 30); ctx.fillRect(56, H - 48, 4, 30);
      G.chars.draw(ctx, 'hero', 'up', 0, 40, H - 58);
      // удочка и леска
      const fx = W * 0.62, fy = H * 0.55 + (phase === 'bite' ? Math.sin(t * 40) * 3 : phase === 'reel' ? Math.sin(t * 20) * 2 : Math.sin(t * 2) * 1);
      ctx.strokeStyle = '#5a321a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(44, H - 70); ctx.lineTo(80, H - 120); ctx.stroke();
      ctx.lineWidth = 1;
      if (phase !== 'ready' && phase !== 'result') {
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.moveTo(80, H - 120); ctx.quadraticCurveTo(fx - 20, H * 0.4, fx, fy); ctx.stroke();
        ctx.fillStyle = '#e84a3a'; ctx.fillRect(fx - 2, fy - 3, 4, 3); ctx.fillStyle = '#f8f4ec'; ctx.fillRect(fx - 2, fy, 4, 2);
      }
      if (phase === 'bite') F.draw(ctx, '!', fx, fy - 18, { align: 'center', color: P.yellow, outline: P.ink });
      // панель: дерево с подсказкой; на сенсорном экране — «коснись»
      const U = G.ui, C = U.C, SF = F.small;
      U.panel(ctx, 6, 22, W - 12, 46, 'night');
      F.draw(ctx, 'Рыбалка · ' + (opts.spot === 'lake' ? 'озеро' : 'река'), 14, 28, { color: '#f4d46a' });
      SF.draw(ctx, `Забросов: ${Math.max(0, opts.left())}`, W - 14, 30, { align: 'right', color: '#c8b48a' });
      const hint = { ready: 'Коснись — забросить', wait: 'Жди поклёвки... не дёргай!', bite: 'КЛЮЁТ! Коснись!', reel: 'Держи палец — тяни. Отпусти, если леска звенит!', result: 'Коснись — ещё раз' }[phase];
      SF.draw(ctx, msg || hint, 14, 49, { color: phase === 'bite' ? '#ffd23a' : msg ? '#ff9a7a' : '#e8d8b0', maxW: W - 28 });
      if (phase === 'reel') {
        const bx = 14, by = 82, bw = W - 28, lx = bx + 64;
        U.panel(ctx, 6, 74, W - 12, 44, 'night');
        SF.draw(ctx, 'Натяжение', bx, by, { color: '#e8d8b0' });
        ctx.fillStyle = '#120a05'; ctx.fillRect(lx, by + 1, bw - 64, 8);
        ctx.fillStyle = '#3a6a3a'; ctx.fillRect(lx + (bw - 64) * 0.12, by + 1, (bw - 64) * 0.73, 8);
        ctx.fillStyle = '#8a2a1a'; ctx.fillRect(lx + (bw - 64) * 0.85, by + 1, (bw - 64) * 0.15, 8);
        ctx.fillStyle = tension > 0.85 ? '#ff6a4a' : '#f4d46a'; ctx.fillRect(lx + (bw - 64) * Math.min(1, tension) - 1, by - 1, 3, 12);
        SF.draw(ctx, 'Улов', bx, by + 18, { color: '#e8d8b0' });
        U.gauge(ctx, lx, by + 19, bw - 64, 8, Math.max(0, Math.min(1, prog)), '#7ac0f0');
      }
      if (phase === 'result' && result) {
        U.panel(ctx, 24, H * 0.4, W - 48, 36, 'frame');
        F.draw(ctx, result, W / 2, H * 0.4 + 12, { align: 'center', color: C.redDark, maxW: W - 70 });
      }
    },
  };
  function end(ok) {
    phase = 'result'; t = 0;
    if (ok) { result = 'Поймал: ' + NAMES[fishId] + '!'; msg = ''; AU.sfx.confirm(); onCatch(fishId); }
    else { result = null; onCatch(null); }
  }
  return S;
});
