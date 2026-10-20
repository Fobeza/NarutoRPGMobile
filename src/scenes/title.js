// Титульный экран: ночная Коноха, Скала Хокаге, «Воля Огня».
G.scenes.register('title', () => {
  let t = 0;
  let idx = 0;
  let items = [];   // кнопки главного меню: { label, act }
  let bg = null;

  // Фон — готовая картинка (gfx/title_art.js) без искажений: по ширине экрана, прижата к низу,
  // сверху — продолжение ночного неба; пока не загрузилась или её нет — рисуем кодом
  let art = null;
  function artReady() {
    if (!G.titleArt || typeof Image === 'undefined') return false;
    if (!art) { art = new Image(); art.onload = () => { bg = buildBg(); }; art.src = G.titleArt; }
    return art.complete && (art.naturalWidth || art.width) > 0;
  }
  function buildBg() {
    const W = G.screen.W, H = G.screen.H;
    if (artReady()) {
      const c = G.gfx.canvas(W, H), x = c.getContext('2d');
      const aw = art.naturalWidth || art.width, ah = art.naturalHeight || art.height;
      const s = W / aw, dh = Math.round(ah * s), top = H - dh;
      x.imageSmoothingEnabled = false;
      if (top > 0) skyAbove(c, W, top, s);
      x.drawImage(art, 0, top, W, dh);
      return c;
    }
    return drawBg(W, H);
  }
  // Небо над картинкой: цвет её верхнего ряда, звёзды и верх луны (в картинке луна срезана краем: центр 223,4, r 33)
  function skyAbove(c, W, top, s) {
    const x = c.getContext('2d'), Hh = G.util.hash2;
    G.shade.grad(c, 0, 0, W, top, ['#121830', '#1e2a4a'], { dir: 'v', steps: 3 });
    for (let i = 0; i < Math.round(W * top / 600); i++) {
      const sx = Math.floor(Hh(i, 3, 51) * W), sy = Math.floor(Hh(3, i, 52) * (top - 4)), b = Hh(i, i, 53);
      x.fillStyle = b > 0.8 ? '#ffffff' : b > 0.45 ? '#c8c0e8' : '#6a6498'; x.fillRect(sx, sy, 1, 1);
    }
    const mx = 223, my = 4, r = 33;
    for (let ay = Math.max(my - r, -Math.ceil(top / s)); ay < 0; ay++) {
      const half = Math.sqrt(r * r - (ay + 0.5 - my) ** 2), x0 = Math.round((mx - half) * s), x1 = Math.round((mx + half) * s);
      const y0 = top + Math.floor(ay * s), y1 = top + Math.floor((ay + 1) * s);
      x.fillStyle = '#f4ecd8'; x.fillRect(x0, y0, x1 - x0, y1 - y0);
      x.fillStyle = '#d8ccb0'; x.fillRect(x1 - Math.max(1, Math.round(s * 2)), y0, Math.max(1, Math.round(s * 2)), y1 - y0);
    }
  }
  // V9: ночная Коноха со светотенью — запасной фон кодом
  function drawBg(W, H) {
    const S = G.shade, BG = G.battleBg, Hh = G.util.hash2;
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

  // Главное меню: «Продолжить» (если есть сохранение), «Новая игра», «Загрузить игру» (по коду), «Настройки»
  function buildItems() {
    items = [];
    if (G.storage.hasSave()) items.push({ label: 'Продолжить', act: () => G.game.loadSaved() });
    items.push({ label: 'Новая игра', act: newGame });
    items.push({ label: 'Загрузить игру', act: loadByCode });
    items.push({ label: 'Настройки', act: () => G.scenes.push(G.scenes.make('settings')) });
  }
  const BTN_H = 22, BTN_GAP = 6, BTN_W = 168;
  const menuY = (i) => G.screen.H - 26 - items.length * (BTN_H + BTN_GAP) + BTN_GAP + i * (BTN_H + BTN_GAP);

  function newGame() {
    if (G.storage.hasSave()) {
      // перезапись сохранения — только после подтверждения
      G.dialog.start('confirm_new', { bottom: 30, onEnd: () => {
        if (G.state.flags._confirm) { G.game.newState(); G.scenes.fadeTo(G.scenes.make('prologue')); }
        delete G.state.flags._confirm;
      } });
    } else {
      G.game.newState();
      G.scenes.fadeTo(G.scenes.make('prologue'));
    }
  }

  // «Загрузить игру»: вставить код, полученный в «Сохранение… → Экспорт кода»
  function loadByCode() {
    G.codeBox.open({
      title: 'Загрузить игру', text: '', readonly: false, okLabel: 'ЗАГРУЗИТЬ',
      hint: G.storage.hasSave() ? 'Вставь код сохранения. Текущая игра уйдёт в резервную копию' : 'Вставь код сохранения (его даёт «Сохранение… → Экспорт кода»)',
      onOk: (ta, close) => {
        if (!G.storage.importCode(ta.value)) { G.codeBox.hintErr('Код не подходит. Проверь, что он скопирован целиком'); G.audio.sfx.error(); return; }
        close(); G.audio.sfx.confirm(); G.game.loadSaved();
      },
    });
  }

  return {
    name: 'title',
    enter() {
      bg = buildBg();
      buildItems();
      idx = 0;
      this._resize = G.events.on('resize', () => { bg = buildBg(); });
    },
    exit() { G.events.off('resize', this._resize); },

    update(dt) {
      t += dt;
      if (G.codeBox.isOpen) return;   // окно «Загрузить игру» открыто — меню ждёт
      const I = G.input;
      if (I.repeat('up', dt)) { idx = (idx + items.length - 1) % items.length; G.audio.sfx.select(); }
      if (I.repeat('down', dt)) { idx = (idx + 1) % items.length; G.audio.sfx.select(); }
      if (I.tapNow) {
        items.forEach((it, i) => { if (Math.abs(I.tapNow.y - (menuY(i) + BTN_H / 2)) <= (BTN_H + BTN_GAP) / 2 && Math.abs(I.tapNow.x - G.screen.W / 2) < BTN_W / 2 + 10) { idx = i; this.choose(); } });
        return;
      }
      if (I.pressed('a')) this.choose();
    },

    choose() {
      G.audio.sfx.confirm();
      items[idx].act();
    },

    draw(ctx) {
      const W = G.screen.W, H = G.screen.H, U = G.ui, C = U.C, F = G.font;
      ctx.drawImage(bg, 0, 0);
      // название на свитке: знак Листа сверху, «NARUTO RPG» и крупное «ВОЛЯ ОГНЯ»
      const sy = 10 + Math.round(Math.sin(t * 1.5) * 1.5), sw = Math.min(W - 24, 250), sx = Math.round((W - sw) / 2);
      U.panel(ctx, sx, sy + 12, sw, 64, 'scroll');
      G.icons.draw(ctx, 'emblem', Math.round(W / 2 - 16), sy - 10, 32, 32);
      F.draw(ctx, 'NARUTO RPG', W / 2, sy + 30, { align: 'center', color: C.inkDim });
      const title = 'ВОЛЯ ОГНЯ';
      const tw = F.measure(title);
      const tmp = G.gfx.canvas(tw + 4, 18);
      F.draw(tmp.getContext('2d'), title, 2, 5, { color: C.red, outline: C.ink });
      ctx.drawImage(tmp, Math.round(W / 2 - tmp.lw), sy + 44, tmp.lw * 2, tmp.lh * 2);
      // кнопки главного меню: деревянные дощечки, выбранная — красный лак
      items.forEach((it, i) => {
        const y = menuY(i), sel = i === idx;
        U.button(ctx, Math.round((W - BTN_W) / 2), y, BTN_W, BTN_H, it.label, sel ? 'sel' : 'normal');
      });
      F.small.draw(ctx, 'v' + BUILD.release, W - 5, H - 14, { align: 'right', color: '#c8b48a', shadow: '#160c06' });
    },
  };
});
