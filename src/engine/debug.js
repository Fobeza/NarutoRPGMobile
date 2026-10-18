// Режим отладки: FPS, стек сцен, координаты, читы.
// Включение: клавиша ` (или F2) на ПК, пункт «Отладка» в меню на телефоне, или ?debug в адресе.
G.debug = {
  on: false,
  fps: 60,
  _acc: 0, _frames: 0,
  lines: [],      // доп. строки от сцен

  init() {
    this.on = BUILD.debug || /[?&]debug/.test(location.search);
  },
  toggle() { this.on = !this.on; G.audio.sfx.select(); },

  tick(dt) {
    this._acc += dt; this._frames++;
    if (this._acc >= 0.5) { this.fps = Math.round(this._frames / this._acc); this._acc = 0; this._frames = 0; }
  },

  draw(ctx) {
    if (!this.on) return;
    const top = G.scenes.top();
    const rows = [
      `FPS ${this.fps}  ${G.screen.W}x${G.screen.H} x${G.screen.scale}`,
      'Сцены: ' + G.scenes.stack.map((s) => s.name || '?').join(' > '),
      ...((top && top.debugInfo && top.debugInfo()) || []),
      `v${BUILD.release} (${BUILD.version})`,
    ];
    const w = Math.max(...rows.map((r) => G.font.measure(r))) + 6;
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 20, w, rows.length * 10 + 4);
    ctx.globalAlpha = 1;
    rows.forEach((r, i) => G.font.draw(ctx, r, 3, 22 + i * 10, { color: '#7cff7c' }));
  },

  // Читы (будут расширяться: время, деньги, статы, неделя)
  cheats: {
    teleport(scene, x, y) { if (scene.player) { scene.player.x = x; scene.player.y = y; } },
  },
};
