// Титульный экран: ночная Коноха, Скала Хокаге, «Воля Огня».
G.scenes.register('title', () => {
  let t = 0;
  let idx = 0;
  let items = [];
  let bg = null;

  // V9: ночная Коноха со светотенью — небо с дизерным градиентом, луна, Скала Хокаге с объёмом, огни деревни
  function buildBg() {
    const W = G.screen.W, H = G.screen.H, S = G.shade, BG = G.battleBg, Hh = G.util.hash2;
    const c = G.gfx.canvas(W, H), x = c.getContext('2d');
    x.fillStyle = '#100c1a'; x.fillRect(0, 0, W, H);
    const rockY = Math.floor(H * 0.42), roofY = Math.floor(H * 0.6);
    S.grad(c, 0, 0, W, roofY + 20, ['#07061a', '#120e30', '#241a48', '#3e2656', '#7a3450', '#c05a3e'], { dir: 'v', steps: 3 });
    for (let i = 0; i < 90; i++) {
      const sx = Math.floor(Hh(i, 1, 21) * W), sy = Math.floor(Hh(1, i, 22) * H * 0.38), b = Hh(i, i, 23);
      x.fillStyle = b > 0.85 ? '#ffffff' : b > 0.5 ? '#c8c0e8' : '#6a6498'; x.fillRect(sx, sy, 1, 1);
      if (b > 0.95) { x.globalAlpha = 0.45; x.fillRect(sx - 1, sy, 3, 1); x.fillRect(sx, sy - 1, 1, 3); x.globalAlpha = 1; }
    }
    // луна слева сверху — источник света сцены
    const mx = Math.round(W * 0.24), my = Math.round(H * 0.15);
    BG.glow(c, mx, my, 80, '#9a98d8', 0.3); BG.glow(c, mx, my, 34, '#e8e0ff', 0.25);
    S.ball(c, mx, my, 15, 15, ['#c8bea0', '#e0d8b8', '#f4ecd0', '#fffaf0']);
    x.fillStyle = '#c8bc9c'; x.fillRect(mx - 5, my - 3, 4, 3); x.fillRect(mx + 4, my + 4, 3, 3); x.fillRect(mx - 1, my + 7, 2, 2);
    for (let i = 0; i < 3; i++) { const cl = BG.cloudImg(i, false, true); x.globalAlpha = 0.85; x.drawImage(cl, Math.round(W * (0.45 + i * 0.22) - 20), Math.round(H * (0.08 + i * 0.06))); x.globalAlpha = 1; }
    // Скала Хокаге: каменная гряда, склоны к луне светлее
    const rockTop = Math.floor(H * 0.21);
    BG.cols(c, (px) => rockTop + 10 - BG.noise1(px / 40, 7) * 22, roofY + 10, ['#7a6058', '#66504a', '#523e3e', '#3e2e34'], { lit: 0.6, litCol: '#c8c0e8' });
    // слои породы: пологие полосы светлее/темнее
    S.tint(c, 0, rockTop, W, roofY - rockTop, (u, v) => (BG.noise1(u * 3 + v * 9, 41) - 0.5) * 0.35 - u * 0.12);
    // трещины и уступы скалы
    for (let i = 0; i < 26; i++) {
      const cx0 = Hh(i, 2, 31) * W, cy0 = rockTop + 20 + Hh(2, i, 32) * (roofY - rockTop - 20);
      x.fillStyle = '#2e2228'; x.fillRect(Math.round(cx0), Math.round(cy0), 1 + Math.floor(Hh(i, 5, 33) * 8), 1);
      x.fillStyle = '#8a7268'; x.fillRect(Math.round(cx0), Math.round(cy0) - 1, 1 + Math.floor(Hh(i, 5, 33) * 6), 1);
    }
    // четыре высеченных лица: формы с объёмом, свет луны слева сверху
    const { E, R, RR, PO, LN, OR, AND, SUB } = G.icons.shapes, I = G.icons;
    const FW = Math.min(96, Math.floor(W * 0.3)), FH = Math.round(FW * 100 / 72);
    const st = '#86685c', hairC = '#6e564e';
    const HAIR = [
      // Первый: длинные прямые волосы на пробор
      () => OR(E(36, 30, 27, 24), RR(7, 26, 19, 92, 5), RR(53, 26, 65, 92, 5)),
      // Второй: короткие торчащие пряди
      () => OR(E(36, 30, 26, 22), ...[0, 1, 2, 3, 4, 5].map((k) => PO([[12 + k * 9, 24], [16 + k * 9 + (k - 2.5) * 2, 2 + Math.abs(k - 2.5) * 3], [22 + k * 9, 24]]))),
      // Третий: зачёсанные назад волосы и бородка
      () => OR(E(36, 28, 26, 21), RR(8, 24, 16, 52, 4), RR(56, 24, 64, 52, 4), PO([[28, 86], [44, 86], [36, 97]])),
      // Четвёртый: длинная растрёпанная чёлка
      () => OR(E(36, 30, 27, 23), ...[0, 1, 2, 3, 4, 5, 6].map((k) => PO([[8 + k * 9, 26], [10 + k * 9, 4 + (k % 2) * 6], [17 + k * 9, 24]])), PO([[9, 30], [4, 62], [16, 44]]), PO([[63, 30], [68, 62], [56, 44]])),
    ];
    for (let k = 0; k < 4; k++) {
      const face = I.raster(72, 100, (B) => {
        I.fill(B, PO([[14, 66], [58, 66], [70, 100], [2, 100]]), '#5e4844', { lit: 0.3, dark: 0.5 });   // шея-уступ: лицо вырастает из скалы
        I.fill(B, HAIR[k](), hairC, { seam: true, lit: 0.42 });
        const head = OR(E(36, 46, 22, 27), PO([[15, 52], [57, 52], [50, 80], [36, 90], [22, 80]]));
        I.fill(B, head, st, { lit: 0.42, dark: 0.5, vx: 1.1 });
        if (k === 0 || k === 3) I.fill(B, AND(head, R(0, 0, 72, 34)), hairC, { seam: true });     // чёлка
        I.flat(B, OR(RR(19, 40, 32, 44, 2), RR(40, 40, 53, 44, 2)), '#4e3c3a');                  // надбровные дуги
        I.flat(B, OR(E(26, 49, 5.5, 3), E(46, 49, 5.5, 3)), '#2a1e24');                        // глазницы
        I.flat(B, OR(R(21, 51, 31, 52), R(41, 51, 51, 52)), '#b09a8e');                         // освещённое веко
        I.fill(B, PO([[36, 48], [40, 66], [33, 66]]), '#9a8074', { lit: 0.5 });                 // нос
        I.flat(B, PO([[38, 55], [42, 67], [36, 67]]), '#4e3c3a');                              // тень носа
        I.flat(B, OR(R(28, 74, 44, 76), R(30, 76, 42, 77)), '#3a2c30');                          // рот
        I.flat(B, AND(head, PO([[50, 40], [60, 40], [56, 84], [44, 88]])), '#5e4a46');          // тень щеки
        I.outline(B, 0.6);
      });
      const fx = Math.round(W * (0.13 + k * 0.248) - FW / 2), fy = rockTop + 6 + (k % 2) * 8;
      x.drawImage(face, fx, fy, FW, FH);
    }
    S.tint(c, 0, rockTop - 14, W, roofY - rockTop + 24, (u, v) => 0.14 - 0.42 * u - 0.12 * v, { keepInk: false });   // лунный свет слева, правый край в тени
    BG.haze(c, rockY, roofY + 10, '#3a2a50', 0.0, 0.45);
    // лес под скалой и крыши деревни с тёплыми окнами
    x.fillStyle = '#1a1422'; x.fillRect(0, roofY + 4, W, H);
    BG.treeline(c, roofY + 2, W, 71, ['#0a0a14', '#12121e', '#1a1a2a', '#26263a', '#4a4a6a'], { step: 13, size: 8 });
    for (let row = 0; row < 5; row++) {
      for (let i = -1; i < 18; i++) {
        const rx = i * 20 - 6 + Math.floor(Hh(i, 7 + row, 3) * 10) + row * 9, rw = 18 + Math.floor(Hh(7 + row, i, 4) * 12);
        const ry = roofY + 8 + row * 22 + Math.floor(Hh(i, 9 + row, 5) * 8), dk = row * 0.12;
        x.fillStyle = S.toneHex('#2e2232', -dk); x.fillRect(rx, ry, rw, H);
        S.tint(c, rx, ry, rw, 24, (u, v) => 0.12 - u * 0.25 - v * 0.2);
        x.fillStyle = S.toneHex('#3e2a3a', -dk); x.beginPath(); x.moveTo(rx - 5, ry + 2); x.lineTo(rx + rw / 2, ry - 7); x.lineTo(rx + rw + 5, ry + 2); x.fill();
        x.fillStyle = '#7a6a9a'; x.fillRect(rx - 4, ry + 1, Math.round(rw / 2) + 2, 1);           // лунный блик на скате
        for (let w = 0; w < 2; w++) if (Hh(i, w + row * 3, 11) > 0.4) {
          const wx = rx + 4 + w * Math.max(6, rw - 12), wy = ry + 6 + Math.floor(Hh(w, i, 12) * 6);
          BG.glow(c, wx + 1.5, wy + 1.5, 7, '#ffb050', 0.3);
          x.fillStyle = '#ffc870'; x.fillRect(wx, wy, 3, 3); x.fillStyle = '#fff0b8'; x.fillRect(wx, wy, 1, 1);
        }
      }
    }
    BG.haze(c, roofY + 40, H, '#100c1a', 0.2, 0.85);
    return c;
  }

  return {
    name: 'title',
    enter() {
      bg = buildBg();
      items = G.storage.hasSave() ? ['Продолжить', 'Новая игра'] : ['Новая игра'];
      idx = 0;
      this._resize = G.events.on('resize', () => { bg = buildBg(); });
    },
    exit() { G.events.off('resize', this._resize); },

    update(dt) {
      t += dt;
      const I = G.input;
      if (I.repeat('up', dt) || I.repeat('down', dt)) { idx = (idx + 1) % items.length; G.audio.sfx.select(); }
      if (I.tapNow) {
        const H = G.screen.H;
        items.forEach((it, i) => { if (Math.abs(I.tapNow.y - (H - 62 + i * 14 + 4)) < 7) { idx = i; this.choose(); } });
        return;
      }
      if (I.pressed('a')) this.choose();
    },

    choose() {
      G.audio.sfx.confirm();
      const it = items[idx];
      if (it === 'Продолжить') {
        G.game.loadSaved();
      } else if (G.storage.hasSave()) {
        // перезапись сохранения — только после подтверждения
        G.dialog.start('confirm_new', { bottom: 30, onEnd: () => {
          if (G.state.flags._confirm) { G.game.newState(); G.scenes.fadeTo(G.scenes.make('nameinput')); }
          delete G.state.flags._confirm;
        } });
      } else {
        G.game.newState();
        G.scenes.fadeTo(G.scenes.make('nameinput'));
      }
    },

    draw(ctx) {
      const W = G.screen.W, H = G.screen.H;
      ctx.drawImage(bg, 0, 0);
      // логотип
      G.icons.draw(ctx, 'emblem', Math.round(W / 2 - 16), 0, 32, 32);   // V9: знак Листа над плашкой
      const ly = 26 + Math.round(Math.sin(t * 1.5) * 2);
      ctx.fillStyle = 'rgba(20,10,20,.55)';
      ctx.fillRect(16, ly - 6, W - 32, 44);
      G.font.draw(ctx, 'NARUTO RPG', W / 2, ly, { align: 'center', color: G.PAL.yellow, outline: G.PAL.ink });
      // крупный заголовок ×2
      const title = 'ВОЛЯ ОГНЯ';
      const tw = G.font.measure(title);
      const tmp = G.gfx.canvas(tw + 4, 12);
      G.font.draw(tmp.getContext('2d'), title, 1, 1, { color: G.PAL.orange, outline: G.PAL.ink });
      ctx.drawImage(tmp, Math.round(W / 2 - tmp.lw), ly + 12, tmp.lw * 2, tmp.lh * 2);
      // меню
      items.forEach((it, i) => {
        const y = H - 62 + i * 14;
        const sel = i === idx;
        if (sel && Math.floor(t * 3) % 2 === 0) G.font.draw(ctx, '▶', W / 2 - G.font.measure(it) / 2 - 10, y, { color: G.PAL.orange });
        G.font.draw(ctx, it, W / 2, y, { align: 'center', color: sel ? G.PAL.white : G.PAL.light, shadow: G.PAL.black });
      });
      G.font.draw(ctx, 'Нажми A', W / 2, H - 22, { align: 'center', color: Math.floor(t * 2) % 2 ? G.PAL.gray : G.PAL.light });
      G.font.draw(ctx, 'v' + BUILD.version, W - 3, H - 11, { align: 'right', color: G.PAL.gray });
    },
  };
});
