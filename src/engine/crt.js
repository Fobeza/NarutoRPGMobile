// CRT-фильтр: вид экрана старого кинескопа поверх игры. Настройка «CRT-экран»: ВЫКЛ / МЯГКО / СИЛЬНО.
//
// Игровой холст не трогаем вовсе: поверх него лежит второй холст (#crt) в ФИЗИЧЕСКИХ пикселях, на
// котором один раз (при смене размера или настройки) нарисованы строки развёртки, теневая маска,
// виньетка и блик стекла. Кадр игры от этого не дорожает — слой статичен, его склеивает видеокарта.
// Строки привязаны к сетке игры: одна тёмная кромка на каждый игровой пиксель (devScale физических),
// поэтому муара нет ни при какой «плотности пикселей». Касания слой не перехватывает (pointer-events: none).
// Яркость, съеденную строками, возвращает CSS-фильтр на самом холсте (см. style.css, body.crt-*).
G.crt = (() => {
  const MODES = [
    { id: 'off', name: 'ВЫКЛ' },
    // line — затемнение нижней кромки каждой строки; mask — сила RGB-маски; vig — виньетка по краям; glare — блик стекла
    { id: 'soft', name: 'МЯГКО', line: 0.26, mask: 0.05, vig: 0.30, glare: 0.035 },
    { id: 'full', name: 'СИЛЬНО', line: 0.46, mask: 0.11, vig: 0.50, glare: 0.06 },
  ];
  const find = (id) => MODES.find((m) => m.id === id) || MODES[0];
  const mode = () => find(G.storage && G.storage.settings.crt);

  // Плитка «одна игровая строка»: высота — s физических пикселей, ширина — 3 (красный, зелёный, синий столбцы маски).
  // Затемнение растёт к нижней кромке строки по кубу: при s = 2 это «светлая/тёмная», при s = 6 — мягкий спад.
  function tile(s, m) {
    const c = document.createElement('canvas'); c.width = 3; c.height = s;
    const x = c.getContext('2d');
    if (m.mask > 0) {
      ['255,40,40', '40,255,40', '60,60,255'].forEach((rgb, i) => { x.fillStyle = `rgba(${rgb},${m.mask})`; x.fillRect(i, 0, 1, s); });
    }
    for (let i = 0; i < s; i++) {
      const a = m.line * Math.pow((i + 1) / s, 3);
      x.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`; x.fillRect(0, i, 3, 1);
    }
    return c;
  }

  function render() {
    if (typeof document === 'undefined') return;
    const cv = document.getElementById('crt'), m = mode();
    const cl = document.body && document.body.classList;
    if (cl) for (const k of MODES) cl.toggle('crt-' + k.id, k.id === m.id && m.id !== 'off');
    if (!cv || !cv.getContext) return;
    if (m.id === 'off') { cv.width = cv.height = 1; cv.style.display = 'none'; return; }   // холст 1×1 — память не держим
    const s = Math.max(1, Math.round(G.screen.devScale || 2)), W = G.screen.W * s, H = G.screen.H * s;
    cv.width = W; cv.height = H; cv.style.display = 'block';
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    // 1) строки развёртки и маска
    const pat = ctx.createPattern(tile(s, m), 'repeat');
    if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H); }
    // 2) виньетка: эллипс на весь экран (круговой градиент, растянутый по высоте) — имитация выпуклого стекла
    const R = W * 0.78;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(1, H / W);
    const g = ctx.createRadialGradient(0, 0, R * 0.52, 0, 0, R);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.7, `rgba(0,0,0,${(m.vig * 0.45).toFixed(3)})`); g.addColorStop(1, `rgba(0,0,0,${m.vig})`);
    ctx.fillStyle = g; ctx.fillRect(-W / 2, -W / 2, W, W); ctx.restore();
    // 3) блик стекла: светлая полоса сверху, уходящая в ноль к трети экрана
    const gl = ctx.createLinearGradient(0, 0, W * 0.35, H * 0.34);
    gl.addColorStop(0, `rgba(255,255,255,${m.glare})`); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H * 0.34);
  }

  return {
    MODES, mode, render,
    name() { return mode().name; },
    set(id) { G.storage.settings.crt = find(id).id; G.storage.saveSettings(); render(); },
    cycle() { const i = MODES.indexOf(mode()); this.set(MODES[(i + 1) % MODES.length].id); },
  };
})();
// Размер экрана сменился (поворот, плотность пикселей) — слой перерисовывается под новую сетку.
G.events.on('resize', () => G.crt.render());
