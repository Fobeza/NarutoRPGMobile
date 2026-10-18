// Сенсорный интерфейс поверх игры (рисуется в canvas, DOM-кнопок нет — весь экран отдан под игру):
//   • плавающий джойстик под пальцем (логика — engine/input.js);
//   • кнопка действия — всплывает, когда есть с чем взаимодействовать;
//   • «Назад» — в меню и окнах; «Меню», «Карта», «Цель» — значки в нижней полосе мира.
// Сцена сама говорит, что показывать: необязательный метод scene.touch() → { joy, action: {label}, sys, back }.
// Нет метода — «Назад» показываем только в известных меню-сценах (BACK).
G.touch = (() => {
  const BACK = new Set(['menu', 'settings', 'savemenu', 'bag', 'shop', 'journal', 'calendar', 'status', 'gallery', 'mapview', 'storage', 'charcreate', 'cheats', 'fonttest']);
  const STRIP_H = 20;          // высота нижней полосы мира (scenes/world.js)
  let hits = [];               // горячие зоны прошлого кадра: { x, y, w, h, btn }
  const anim = { action: 0, label: '' };
  let lastT = 0;

  // конфиг запрашивают несколько раз за кадр, а сцена (мир) ищет действие по всем NPC — кэшируем на 50 мс
  const cache = { s: null, t: 0, v: {} };
  function cfg() {
    const s = G.scenes.top();
    if (!s || G.scenes.busy) return {};
    const now = performance.now();
    if (cache.s === s && now - cache.t < 50) return cache.v;
    cache.s = s; cache.t = now;
    cache.v = typeof s.touch === 'function' ? (s.touch() || {}) : { back: BACK.has(s.name) };
    return cache.v;
  }
  const joyAllowed = () => !!cfg().joy;
  function hit(p) {
    for (const h of hits) if (p.x >= h.x - 2 && p.x < h.x + h.w + 2 && p.y >= h.y - 2 && p.y < h.y + h.h + 2) return h.btn;
    return null;
  }

  // ---------- рисование ----------
  function plate(ctx, x, y, w, h, on) {
    ctx.fillStyle = '#000'; ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2);
    ctx.fillStyle = on ? '#6a6a7a' : '#46444f'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = on ? '#4a4858' : '#26242e'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  }
  const ICONS = {
    menu(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(x + 3, y + 4, 7, 1); ctx.fillRect(x + 3, y + 6, 7, 1); ctx.fillRect(x + 3, y + 8, 7, 1); },
    map(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(x + 3, y + 3, 7, 7); ctx.fillStyle = '#26242e'; ctx.fillRect(x + 5, y + 3, 1, 7); ctx.fillRect(x + 8, y + 3, 1, 7); },
    goal(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(x + 4, y + 3, 1, 8); ctx.fillRect(x + 5, y + 3, 5, 1); ctx.fillRect(x + 5, y + 4, 4, 1); ctx.fillRect(x + 5, y + 5, 3, 1); },
  };
  function sysIcons(ctx, W, H) {
    const y = H - STRIP_H + 3, items = ['menu', 'map', 'goal'];
    items.forEach((b, i) => {
      const x = W - 3 - (items.length - i) * 15, on = G.input.held(b);
      plate(ctx, x, y, 14, 14, on);
      ICONS[b](ctx, x, y + 0, on ? '#ffffff' : '#b8b0cc');
      hits.push({ x, y: H - STRIP_H, w: 15, h: STRIP_H, btn: b });
    });
  }
  function actionButton(ctx, W, H, c, now) {
    const k = anim.action; if (k <= 0.01) return;
    const r = Math.round(15 * (0.6 + 0.4 * k)), cx = W - 24, cy = H - STRIP_H - 28, on = G.input.held('a');
    ctx.globalAlpha = Math.min(1, k * 1.4);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy + 1, r + 1.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#46341a'; ctx.beginPath(); ctx.arc(cx, cy, r + 1, 0, 7); ctx.fill();
    ctx.fillStyle = on ? '#ff9a4a' : '#e8621a'; ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, 7); ctx.fill();
    ctx.fillStyle = on ? '#e8621a' : '#ff9a4a'; ctx.beginPath(); ctx.arc(cx - 2, cy - 2, r - 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8621a'; ctx.beginPath(); ctx.arc(cx, cy, r - 5, 0, 7); ctx.fill();
    G.font.draw(ctx, 'A', cx, cy - 4, { align: 'center', color: '#ffffff', outline: '#8a2a10' });
    if (anim.label) G.font.draw(ctx, anim.label, cx, cy - r - 11, { align: 'center', color: '#f8f4ec', outline: '#14121c' });
    ctx.globalAlpha = 1;
    if (c.action) hits.push({ x: cx - 18, y: cy - 18, w: 36, h: 36, btn: 'a' });
  }
  function backPill(ctx) {
    const on = G.input.held('b'), w = 41, h = 14, x = 2, y = 2;
    plate(ctx, x, y, w, h, on);
    G.font.draw(ctx, '< Назад', x + w / 2, y + 3, { align: 'center', color: on ? '#ffffff' : '#dcd8e8' });
    hits.push({ x, y, w, h, btn: 'b' });
  }
  function stick(ctx) {
    const st = G.input.stick; if (!st.on) return;
    const sc = G.screen.scale, R = G.input.STICK_R / sc;
    const o = G.screen.toLocal(st.ox, st.oy), p = G.screen.toLocal(st.x, st.y);
    let dx = p.x - o.x, dy = p.y - o.y; const d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    const run = st.run;
    ctx.globalAlpha = 0.28; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(o.x, o.y, R, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = run ? '#ff9a4a' : '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(o.x, o.y, R - 0.5, 0, 7); ctx.stroke();
    ctx.globalAlpha = 0.85; ctx.fillStyle = run ? '#e8621a' : '#f8f4ec'; ctx.beginPath(); ctx.arc(o.x + dx, o.y + dy, R * 0.36, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function draw(ctx) {
    const W = G.screen.W, H = G.screen.H, now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000 || 0); lastT = now;
    const c = cfg();
    hits = [];
    // кнопка действия появляется/гаснет плавно; подпись запоминаем, пока гаснет
    const want = c.action ? 1 : 0;
    anim.action += (want - anim.action) * Math.min(1, dt * 14);
    if (c.action && c.action.label) anim.label = c.action.label;
    if (c.sys) sysIcons(ctx, W, H);
    if (c.back) backPill(ctx);
    actionButton(ctx, W, H, c, now);
    stick(ctx);
  }

  return { draw, hit, joyAllowed, cfg, BACK };
})();
