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
      const c = G.gfx.canvas(map.w * T, map.h * T), cc = c.getContext('2d');
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
  // Ритм вечера: окна зажигаются по очереди с 17:30 до 19:30, гаснут с 21:30 до половины первого;
  // у ранних пташек свет горит и с 5:30 до рассвета. У каждого дома своё время.
  function lightsOn(o) {
    if (!G.state || !o.tplDef || o.tplDef.unique) return true;   // большие здания светятся всю ночь
    const m = G.state.vars.min % 1440, on = 1050 + H(o.tx, o.ty, 81) * 120, off = 1290 + H(o.tx, o.ty, 82) * 180;
    if (m >= on && m < Math.min(off, 1440)) return true;
    if (off > 1440 && m < off - 1440) return true;
    const early = H(o.tx, o.ty, 83);
    return early > 0.55 && m >= 330 + early * 40 && m < 420;
  }
  function windows(ctx, vis, map, k, time) {
    if (!enabled() || !map.outdoor || k <= 0.02) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const o of vis) {
      if (!o.isBuilding || !o.spr || !o.spr.glow) continue;
      const lit = H(o.tx, o.ty, 77);
      if (lit < 0.28 || !lightsOn(o)) continue;
      const flick = lit > 0.9 ? 0.85 + 0.15 * Math.sin(time * 7 + o.tx) : 1;
      ctx.globalAlpha = Math.min(1, k) * 0.62 * flick;
      ctx.drawImage(o.spr.glow, o.x + o.spr.ox, o.y + o.spr.oy);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  // Камера выбирает ячейки мира, но не участвует в координатах частиц.
  // Одинаковая ячейка в двух перекрывающихся кадрах рисуется одинаково.
  function cells(cx,cy,W,VH,map,draw){
    const size=64;
    for(let y=Math.max(0,Math.floor((cy-24)/size));y<=Math.min(Math.ceil(map.h*16/size)-1,Math.floor((cy+VH+24)/size));y++)
      for(let x=Math.max(0,Math.floor((cx-24)/size));x<=Math.min(Math.ceil(map.w*16/size)-1,Math.floor((cx+W+24)/size));x++)draw(x*size,y*size,G.util.hash2(x,y,917));
  }
  function particles(ctx,cx,cy,W,VH,map,min,time){
    if(!enabled()||!map.outdoor||G.life.raining())return;
    const day=sun(min).sun>.3;
    ctx.save();
    cells(cx,cy,W,VH,map,(x,y,seed)=>{
      if(seed<.65)return;
      if(day){
        const p=(time*(.12+seed*.08)+seed)%1;
        const px=x+seed*40+p*18+Math.sin(time*1.6+seed*20)*4,py=y+p*64;
        ctx.globalAlpha=Math.sin(p*Math.PI)*.85;ctx.fillStyle=seed>.85?'#fff0f6':'#f8c0d4';
        ctx.fillRect(Math.round(px),Math.round(py),2,1);ctx.fillRect(Math.round(px)+1,Math.round(py)+1,1,1);
      }else{
        const px=x+32+Math.sin(time*.5+seed*20)*18,py=y+32+Math.sin(time*.8+seed*31)*6;
        const tx=Math.floor(px/16),ty=Math.floor(py/16);
        if(map.solidTile(tx,ty)&&map.get(tx,ty)!==G.tiles.ID.WATER)return;
        const glow=.5+.5*Math.sin(time*(1.2+seed)+seed*21);
        if(glow<.25)return;
        ctx.globalCompositeOperation='lighter';
        const gr=ctx.createRadialGradient(px,py,0,px,py,6);
        gr.addColorStop(0,`rgba(210,255,120,${(.8*glow).toFixed(2)})`);gr.addColorStop(1,'rgba(160,255,80,0)');
        ctx.fillStyle=gr;ctx.fillRect(px-6,py-6,12,12);
      }
    });ctx.restore();
  }
  function rain(ctx,cx,cy,W,VH,map,time){
    if(!enabled()||!map.outdoor)return;
    ctx.save();ctx.fillStyle='rgba(40,50,80,.16)';ctx.fillRect(cx,cy,W,VH);
    cells(cx,cy,W,VH,map,(x,y,seed)=>{
      ctx.fillStyle='rgba(190,210,255,.55)';
      for(let i=0;i<5;i++){
        const p=(time*(2.5+seed)+seed+i*.2)%1;
        const px=Math.round(x+(seed*47+i*13)%48+p*16),py=Math.round(y+p*64);
        ctx.fillRect(px,py,1,4);ctx.fillRect(px-1,py+4,1,2);
      }
      const p=(time*3+seed*7)%1,px=x+seed*48+8,py=y+seed*37+12;
      if(p<.3&&!map.solidTile(Math.floor(px/16),Math.floor(py/16))){ctx.fillStyle='rgba(200,220,255,.35)';ctx.fillRect(Math.round(px)-1,Math.round(py),3,1);}
    });ctx.restore();
  }

  // Лужи после дождя: на мостовой и утоптанных тропах остаются тёмные пятна с отражением неба
  // и расходящимися кругами от капель. Пятна держатся за мировую сетку 32 px, поэтому не мигают.
  function puddles(ctx, cx, cy, W, VH, map, time) {
    if (!enabled() || !map.outdoor) return;
    const ID = G.tiles.ID;
    const wet = [ID.MAINROAD, ID.STONE, ID.PLAZA, ID.COBBLE, ID.BRICK, ID.DARKSTONE, ID.PATH, ID.DIRT, ID.GRAVEL];
    const tx0 = Math.max(0, Math.floor(cx / T) - 1), ty0 = Math.max(0, Math.floor(cy / T) - 1);
    const tx1 = Math.min(map.w - 1, Math.ceil((cx + W) / T)), ty1 = Math.min(map.h - 1, Math.ceil((cy + VH) / T));
    ctx.save();
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!wet.includes(map.get(tx, ty))) continue;
      // Пятно живёт в узле сетки 32 px: соседние клетки делят одно поле, поэтому лужа цельная.
      const gx = Math.floor(tx / 2), gy = Math.floor(ty / 2);
      const n = H(gx, gy, 961);
      if (n < 0.61) continue;
      const ox = tx * T + Math.floor(H(gx, gy, 962) * 8), oy = ty * T + Math.floor(H(gy, gx, 963) * 8);
      const rx = 3 + Math.floor(n * 5), ry = Math.max(2, Math.round(rx * 0.55));
      // влажная кайма и тёмная вода
      ctx.globalAlpha = 0.22; ctx.fillStyle = '#2a3a48';
      ellipse(ctx, ox, oy, rx + 1, ry + 1);
      ctx.globalAlpha = 0.42; ctx.fillStyle = '#20323e';
      ellipse(ctx, ox, oy, rx, ry);
      // отражение неба — узкой полосой у дальнего края
      ctx.globalAlpha = 0.20; ctx.fillStyle = '#9fb6c8';
      ellipse(ctx, ox, oy - 1, Math.max(2, rx - 2), Math.max(1, ry - 2));
      // круги от капель: две волны с разной фазой
      for (let k = 0; k < 2; k++) {
        const ph = (time * (0.55 + k * 0.2) + H(gx, gy, 964 + k)) % 1;
        const rr = 1 + ph * rx * 0.9;
        ctx.globalAlpha = (1 - ph) * 0.34;
        ctx.fillStyle = '#cfe0ea';
        const ryy = Math.max(1, Math.round(rr * 0.55));
        ctx.fillRect(ox - Math.round(rr), oy - ryy, Math.round(rr * 2), 1);
        ctx.fillRect(ox - Math.round(rr), oy + ryy, Math.round(rr * 2), 1);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
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

  return { sun, shadows, roomSunlight, windows, particles, rain, puddles, vignette, enabled };
})();
