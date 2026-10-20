// Сенсорный интерфейс поверх игры (рисуется в canvas, DOM-кнопок нет — весь экран отдан под игру):
//   • плавающий джойстик под пальцем (логика — engine/input.js);
//   • кнопка действия — всплывает, когда есть с чем взаимодействовать;
//   • «Назад» — в меню и окнах; «Меню», «Карта», «Цель» — значки в нижней полосе мира.
// Сцена сама говорит, что показывать: необязательный метод scene.touch() → { joy, action: {label}, sys, back }.
// Нет метода — «Назад» показываем только в известных меню-сценах (BACK).
G.touch = (() => {
  const BACK = new Set(['bag', 'status', 'journal', 'calendar', 'gallery', 'mapview', 'storage', 'charcreate', 'cheats']);
  const STRIP_H = 22;          // высота нижней полосы мира (scenes/world.js)
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

  // ---------- рисование (стиль «Свитки и дерево», gfx/ui.js) ----------
  function sysIcons(ctx, W, H) {
    const U = G.ui, y = H - STRIP_H + 3, items = ['menu', 'map', 'goal'], bw = 20, bh = 16;
    items.forEach((b, i) => {
      const x = W - 4 - (items.length - i) * (bw + 2) + 2, on = G.input.held(b);
      U.button(ctx, x, y + (on ? 1 : 0), bw, bh, '', on ? 'sel' : 'normal');
      U.icon(ctx, b, x + 5, y + 3 + (on ? 1 : 0), on ? '#ffffff' : '#f4e4bc');
      hits.push({ x, y: H - STRIP_H, w: bw + 2, h: STRIP_H, btn: b });
    });
  }
  function actionButton(ctx, W, H, c, now) {
    const k = anim.action; if (k <= 0.01) return;
    const r = Math.round(17 * (0.6 + 0.4 * k)), cx = W - 26, cy = H - STRIP_H - 30, on = G.input.held('a');
    ctx.globalAlpha = Math.min(1, k * 1.4);
    // красная печать на деревянном основании
    ctx.fillStyle = '#0a0604'; ctx.beginPath(); ctx.arc(cx, cy + 1.5, r + 2, 0, 7); ctx.fill();
    ctx.fillStyle = '#3e2616'; ctx.beginPath(); ctx.arc(cx, cy, r + 1.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#6a4228'; ctx.beginPath(); ctx.arc(cx, cy - 0.5, r, 0, 7); ctx.fill();
    ctx.fillStyle = on ? '#e0562e' : '#b8321c'; ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, 7); ctx.fill();
    ctx.fillStyle = on ? '#b8321c' : '#e0562e'; ctx.beginPath(); ctx.arc(cx - 1.5, cy - 2, r - 8, 0, 7); ctx.fill();
    ctx.fillStyle = on ? '#e0562e' : '#b8321c'; ctx.beginPath(); ctx.arc(cx, cy, r - 7, 0, 7); ctx.fill();
    G.font.draw(ctx, 'A', cx, cy - 4, { align: 'center', color: '#f8eed0', shadow: '#5a1408' });
    if (anim.label) {
      const lw = G.font.small.measure(anim.label) + 12;
      G.ui.panel(ctx, Math.round(cx - lw / 2), cy - r - 18, lw, 15, 'tag');
      G.font.small.draw(ctx, anim.label, cx, cy - r - 15, { align: 'center', color: '#f4d46a', shadow: '#5a1408' });
    }
    ctx.globalAlpha = 1;
    if (c.action) hits.push({ x: cx - 20, y: cy - 20, w: 40, h: 40, btn: 'a' });
  }
  function backPill(ctx) {
    const on = G.input.held('b'), w = 52, h = 16, x = 3, y = 3;
    G.ui.button(ctx, x, y + (on ? 1 : 0), w, h, '', on ? 'sel' : 'normal');
    G.ui.icon(ctx, 'back', x + 4, y + 3 + (on ? 1 : 0), '#f4e4bc');
    G.font.small.draw(ctx, 'Назад', x + 17, y + 4 + (on ? 1 : 0), { color: '#f8eed0', shadow: '#160c06' });
    hits.push({ x, y, w, h, btn: 'b' });
  }
  function stick(ctx) {
    const st = G.input.stick; if (!st.on) return;
    const sc = G.screen.scale, R = G.input.STICK_R / sc;
    const o = G.screen.toLocal(st.ox, st.oy), p = G.screen.toLocal(st.x, st.y);
    let dx = p.x - o.x, dy = p.y - o.y; const d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    const run = st.run;
    // кольцо — свиток с красным ободом, рукоять — печать
    ctx.globalAlpha = 0.34; ctx.fillStyle = '#ecdcb0'; ctx.beginPath(); ctx.arc(o.x, o.y, R, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.85; ctx.strokeStyle = run ? '#e0562e' : '#3e2616'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(o.x, o.y, R - 0.75, 0, 7); ctx.stroke();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = '#f4d46a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(o.x, o.y, R - 3, 0, 7); ctx.stroke();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#3e2616'; ctx.beginPath(); ctx.arc(o.x + dx, o.y + dy + 0.5, R * 0.38, 0, 7); ctx.fill();
    ctx.fillStyle = run ? '#e0562e' : '#b8321c'; ctx.beginPath(); ctx.arc(o.x + dx, o.y + dy, R * 0.34, 0, 7); ctx.fill();
    ctx.fillStyle = run ? '#ff9a4a' : '#e0562e'; ctx.beginPath(); ctx.arc(o.x + dx - 1.5, o.y + dy - 1.5, R * 0.16, 0, 7); ctx.fill();
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
