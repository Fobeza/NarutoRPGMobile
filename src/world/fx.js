// Визуальные эффекты мира: тени от зданий и деревьев по положению солнца, светящиеся ночью окна,
// падающие лепестки, светлячки и мягкая виньетка. Всё включается настройкой «Эффекты» (S.fx !== false).
G.fx = (() => {
  const T = G.CONFIG.TILE;
  const H = G.util.hash2;
  const enabled = () => G.storage.settings.fx !== false;

  // Положение солнца: -1 утро (тень на запад) … 0 полдень … +1 вечер; sun — сила дневного света 0..1
  function sun(min) {
    const h = min / 60;
    const a = Math.max(-1, Math.min(1, (h - 12) / 6));
    const sun = Math.max(0, Math.min(1, Math.min((h - 5.5) / 1.5, (19.5 - h) / 1.5)));
    return { a, sun };
  }

  function ellipse(ctx, cx, cy, rx, ry) {
    for (let y = -ry; y <= ry; y++) {
      const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.01))));
      ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
    }
  }
  const TREES = { tree: [8, 3], pine: [7, 3], sakura: [9, 3], maple: [8, 3], ginkgo: [8, 3], bamboo: [5, 2], watertower: [7, 3] };

  // V9: статичные мягкие тени. Свет всегда сверху-слева, поэтому тени ложатся вправо-вниз.
  // Днём тень плотнее, ночью остаётся только контактная (мягче). Форма тени здания запекается один раз.
  const SH_L = 0.62;   // длина тени здания относительно высоты стены
  function buildingShadow(o) {
    if (o._shadow) return o._shadow;
    const W = o.tw * T, FH = o.th * T, wh = G.buildgfx.wallH(o.tplDef, o.tplId, o.spr);
    const L = Math.max(6, Math.min(18, Math.round(wh * SH_L))), D = 7, pad = 3;
    const side = Math.round(FH * 0.55);
    const B = G.shade.box;
    const img = G.shade.soft(W + L + pad * 2, side + D + pad * 2, (x, y) => {
      x -= pad; y -= pad;
      // контактная полоса у фасада + косая тень справа; к дальнему краю — светлее
      const front = B(x, y, 1, side - 2, W + L * 0.6, side + D, 4) * (1 - 0.35 * Math.max(0, (y - side) / D));
      const sk = (side + D - y) * 0.45;   // скос: верх тени справа короче
      const right = B(x, y, W - 3, 2, W + L - sk * 0.4, side + D, 4) * (1 - 0.6 * Math.max(0, (x - W) / L));
      return Math.max(front, right);
    }, 0.4);
    return (o._shadow = { img, dx: -pad, dy: FH - side - pad });
  }

  // Тени на земле: рисуем до объектов, чтобы здания и деревья ложились поверх
  function shadows(ctx, vis, map, min) {
    if (!enabled()) return;
    const { sun: s } = sun(min);
    const k = map.outdoor ? 0.55 + 0.45 * s : 0.8;
    ctx.globalAlpha = k;
    for (const o of vis) {
      if (o.isBuilding) {
        if (!map.outdoor || o.sortY < 0 || o.tplId === 'gate' || !o.tw) continue;
        const sh = buildingShadow(o);
        ctx.drawImage(sh.img, o.x + sh.dx, o.y + sh.dy);
      } else if (TREES[o.kind]) {
        const [rx, ry] = TREES[o.kind];
        G.shade.shadow(ctx, o.x + 3, o.y, rx + 2, ry + 1, 0.32);
      } else if (o.kind === 'lamp' || o.kind === 'stonelamp') {
        G.shade.shadow(ctx, o.x + 3, o.y, 4, 2, 0.3);
      } else if (o.img && o.layer !== 'floor' && o.box && o.w <= 48) {
        G.shade.shadow(ctx, o.x + o.ox + o.w / 2 + 2, o.y - 1, o.w * 0.46, Math.max(2, Math.min(4, o.w * 0.15)), 0.3);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Солнечные пятна от настоящих окон комнаты. Маска запекается один раз,
  // яркость зависит от времени и дождя; мебель и персонажи рисуются поверх.
  function roomSunlight(ctx, map, min) {
    if (!enabled() || map.outdoor) return;
    const daylight = sun(min).sun * (G.life.raining() ? 0.28 : 1);
    if (daylight <= 0) return;
    if (!map._sunlight) {
      const c = G.gfx.canvas(map.w * T, map.h * T), cc = c.getContext('2d'), ID = G.tiles.ID;
      cc.save(); cc.beginPath();
      for (let y = 2; y < map.h - 1; y++) for (let x = 1; x < map.w - 1; x++) {
        const id = map.get(x, y);
        if (!G.tiles.SOLID[id]) cc.rect(x * T, y * T, T, T);
      }
      cc.clip();
      for (const o of map.objects) {
        if (o.kind !== 'window' || o.y > 2 * T) continue;
        const left = o.x - 7, top = 2 * T;
        // Четыре стекла, между ними остаётся тень оконной решётки.
        for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
          const near = row * 21 + 2, far = near + 18, u = left + col * 8;
          cc.fillStyle = row ? 'rgba(255,231,162,0.13)' : 'rgba(255,237,180,0.22)';
          cc.beginPath();cc.moveTo(u + near * 0.48, top + near);
          cc.lineTo(u + 6 + near * 0.48, top + near);
          cc.lineTo(u + 6 + far * 0.48, top + far);
          cc.lineTo(u + far * 0.48, top + far);cc.closePath();cc.fill();
        }
      }
      cc.restore(); map._sunlight = c;
    }
    ctx.save(); ctx.globalAlpha *= daylight; ctx.drawImage(map._sunlight, 0, 0); ctx.restore();
  }

  // Окна светятся тёплым светом ночью (карта окон хранится в спрайте здания: spr.glow)
  function windows(ctx, vis, map, k, time) {
    if (!enabled() || !map.outdoor || k <= 0.02) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const o of vis) {
      if (!o.isBuilding || !o.spr || !o.spr.glow) continue;
      const lit = H(o.tx, o.ty, 77);
      if (lit < 0.28) continue;
      const flick = lit > 0.9 ? 0.85 + 0.15 * Math.sin(time * 7 + o.tx) : 1;
      ctx.globalAlpha = Math.min(1, k) * 0.62 * flick;
      ctx.drawImage(o.spr.glow, o.x + o.spr.ox, o.y + o.spr.oy);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  // Лепестки днём, светлячки ночью (в мировых координатах вокруг камеры)
  function particles(ctx, cx, cy, W, VH, map, min, time) {
    if (!enabled() || !map.outdoor || G.life.raining()) return;
    const { sun: s } = sun(min);
    if (s > 0.3) {
      for (let i = 0; i < 16; i++) {
        const sp = 9 + (i % 5) * 4;
        const x = cx + ((i * 47 + time * sp) % (W + 24)) - 12 + Math.sin(time * 1.6 + i) * 4;
        const y = cy + ((i * 83 + time * (14 + (i % 4) * 4)) % (VH + 24)) - 12;
        ctx.fillStyle = i % 3 ? '#f8c0d4' : '#fff0f6';
        ctx.globalAlpha = 0.85;
        ctx.fillRect(Math.round(x), Math.round(y), 2, 1); ctx.fillRect(Math.round(x) + 1, Math.round(y) + 1, 1, 1);
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const bl = 0.5 + 0.5 * Math.sin(time * (1.2 + (i % 4) * 0.3) + i * 2.1);
        if (bl < 0.25) continue;
        const x = cx + ((i * 61 + Math.sin(time * 0.5 + i) * 18 + 400) % W);
        const y = cy + VH * 0.35 + ((i * 37) % (VH * 0.6)) + Math.sin(time * 0.8 + i * 1.7) * 6;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, 6);
        gr.addColorStop(0, `rgba(210,255,120,${(0.8 * bl).toFixed(2)})`); gr.addColorStop(1, 'rgba(160,255,80,0)');
        ctx.fillStyle = gr; ctx.fillRect(x - 6, y - 6, 12, 12);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // Мягкое затемнение по краям (в экранных координатах)
  let vig = null, vigKey = '';
  function vignette(ctx, W, VH, y0) {
    if (!enabled()) return;
    const key = W + 'x' + VH;
    if (key !== vigKey) {
      vigKey = key; vig = G.gfx.canvas(W, VH); const c = vig.getContext('2d');
      const gr = c.createRadialGradient(W / 2, VH / 2, Math.min(W, VH) * 0.45, W / 2, VH / 2, Math.hypot(W, VH) * 0.56);
      gr.addColorStop(0, 'rgba(8,10,30,0)'); gr.addColorStop(1, 'rgba(8,10,30,0.34)');
      c.fillStyle = gr; c.fillRect(0, 0, W, VH);
    }
    ctx.drawImage(vig, 0, y0);
  }

  return { sun, shadows, roomSunlight, windows, particles, vignette, enabled };
})();
