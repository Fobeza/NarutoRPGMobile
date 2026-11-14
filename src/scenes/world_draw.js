// Сцена мира, часть «Отрисовка»: кадр мира, стрелка и след к цели, мини-карта, уведомления, дождь, свет, HUD и нижняя полоса.
// Методы подмешиваются в объект сцены (scenes/world.js: G.worldParts); this — сама сцена.
// K — общие константы сцены: тайл, высота шапки и нижней полосы, объекты, за которыми герой просвечивает.
G.worldParts = G.worldParts || [];
G.worldParts.push(({ T, HUD_H, STRIP_H, FADE_BEHIND }) => ({
    // ---------- Отрисовка ----------
    draw(ctx) {
      const z = this.z || 1, SW = G.screen.W, SVH = this.viewH();
      const W = SW / z, VH = SVH / z, m = this.map, p = this.player;
      const cx = this.cam.x, cy = this.cam.y;

      ctx.fillStyle = m.bg; ctx.fillRect(0, HUD_H, SW, SVH);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, HUD_H, SW, SVH); ctx.clip();
      if (z !== 1) { ctx.translate(0, HUD_H); ctx.scale(z, z); ctx.translate(-cx, -cy); }
      else ctx.translate(-cx, HUD_H - cy);

      m.drawGround(ctx, cx, cy, W, VH, this.time);
      if(G.villageDaily)G.villageDaily.drawUnder(ctx,this);
      G.fx.roomSunlight(ctx, m, G.state.vars.min);

      const vis = m.query({ x: cx, y: cy, w: W, h: VH });
      this.visCount = vis.length;
      G.fx.shadows(ctx, vis, m, G.state.vars.min);
      const list = [];
      for (const o of vis) {
        if (o.layer === 'floor') { ctx.drawImage(o.img, o.x + o.ox, o.y + o.oy); continue; }
        list.push(o);
      }
      if(G.streetLife)list.push(...G.streetLife.actors(this));
      if(G.villageStories)list.push(...G.villageStories.actors(this));
      if(G.villageDaily)list.push(...G.villageDaily.actors(this));
      if(G.guards)list.push(...G.guards.actors(this));
      for (const a of this.others) {
        if (a.x < cx - 16 || a.x > cx + W + 16 || a.y < cy - 4 || a.y > cy + VH + 24) continue;
        list.push(a);
      }
      list.sort((a, b) => (a.sortY != null ? a.sortY : a.y) - (b.sortY != null ? b.sortY : b.y));

      const pr = { x: p.x - 7, y: p.y - 19, w: 14, h: 19 };
      for (const it of list) {
        if (it === p && (p.roof || p.jump)) continue;   // на крыше героя рисуем поверх всего
        if(it._dailyAnimal){G.villageDaily.drawAnimal(ctx,this,it);continue;}
        if (it.id && it.dir) {
          if(it._street){ctx.save();ctx.globalAlpha*=this._streetScene.alpha;this.drawActor(ctx,it);ctx.restore();}
          else this.drawActor(ctx, it);
          continue;
        }
        if (it.anim) { G.world.drawAnim(ctx, it, this.time); continue; }
        let alpha = 1;
        if ((it.isBuilding || FADE_BEHIND[it.kind]) && it.sortY > p.y && it.sortY >= 0 && !p.roof && !p.jump) {
          const pad = it.isBuilding ? 10 : 2; // у зданий сверху прозрачный запас под трубы/эмблемы
          if (G.util.rectsOverlap(pr, { x: it.x + it.ox + 2, y: it.y + it.oy + pad, w: it.w - 4, h: it.h - pad })) alpha = 0.45;
        }
        if (alpha < 1) ctx.globalAlpha = alpha;
        const img=it.img;
        if(!G.villageDaily||!G.villageDaily.drawObject(ctx,this,it,img))ctx.drawImage(img, it.x + it.ox, it.y + it.oy);
        if (alpha < 1) ctx.globalAlpha = 1;
      }

      if(G.worldMotion)G.worldMotion.atmosphere(ctx,this,vis);
      if(G.roofPatrol)G.roofPatrol.draw(ctx,this,cx,cy,W,VH);
      if (p.roof || p.jump) G.roofs.drawPlayer(ctx, this);
      if(G.villageStories)G.villageStories.draw(ctx,this);
      if(G.villageDaily)G.villageDaily.draw(ctx,this,vis);
      if(G.streetLife)G.streetLife.draw(ctx,this);
      this.drawActionHint(ctx);

      // значки над NPC: ! — новое задание, ? — можно сдать, 💬 — новое знакомство
      const bob = Math.round(Math.sin(this.time * 5) * 1.5);
      for (const n of this.npcs) {
        if (n.x < cx - 8 || n.x > cx + W + 8 || n.y < cy || n.y > cy + VH + 30) continue;
        let ic = G.quests.iconFor(n.id);
        if (!ic && n.mark && !G.state.flags['met_' + n.mark]) ic = '💬';
        if (!ic) continue;
        const col = ic === '!' ? G.PAL.yellow : ic === '?' ? '#7ad0ff' : '#ffffff';
        G.font.draw(ctx, ic, n.x, n.y - 30 + bob, { color: col, outline: G.PAL.ink, align: 'center' });
      }
      if (G.life2) G.life2.drawEmotes(ctx, this, cx, cy, W, VH);
      this.drawTargetMark(ctx, cx, cy, W, VH, bob);
      this.drawTrail(ctx);

      this.drawLight(ctx, vis, cx, cy, W, VH);
      if (G.guards) G.guards.glow(ctx, this);
      G.fx.particles(ctx, cx, cy, W, VH, m, G.state.vars.min, this.time);
      if (this.map.outdoor && G.life.raining()) {
        G.fx.puddles(ctx, cx, cy, W, VH, this.map, this.time);
        this.drawRain(ctx, cx, cy, W, VH);
      }

      if (G.debug.on) {
        ctx.strokeStyle = 'rgba(255,0,0,.7)'; ctx.lineWidth = 1;
        for (const o of vis) if (o.box) ctx.strokeRect(o.box.x + 0.5, o.box.y + 0.5, o.box.w - 1, o.box.h - 1);
        ctx.strokeStyle = 'rgba(0,255,255,.8)';
        for (const w of m.warps) ctx.strokeRect(w.rect.x + 0.5, w.rect.y + 0.5, w.rect.w - 1, w.rect.h - 1);
        for (const a of this.others) { const b = G.actors.feet(a); ctx.strokeStyle = 'rgba(255,255,0,.8)'; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1); }
      }
      ctx.restore();
      {
      const W = SW, VH = SVH;
      G.fx.vignette(ctx, W, VH, HUD_H);

      this.drawMinimap(ctx, W);
      this.drawHud(ctx);
      this.drawStrip(ctx);
      this.drawNotes(ctx, W);

      if (this.banner) {
        const a = Math.min(1, this.banner.t * 2, (2.4 - this.banner.t) * 4);
        ctx.globalAlpha = Math.max(0, a);
        G.ui.title(ctx, this.banner.text, W / 2, HUD_H + 6, 0);   // красная лента с названием места
        ctx.globalAlpha = 1;
      }
      if (this.toast) {
        const w = Math.min(W - 8, G.font.measure(this.toast.text) + 18), h = 19;
        const x = Math.round((W - w) / 2), y = G.screen.H - STRIP_H - h - 6;
        G.ui.panel(ctx, x, y, w, h, 'night');
        G.font.draw(ctx, this.toast.text, W / 2, y + 5, { align: 'center', color: '#f4d46a', maxW: w - 12 });
      }
      if (G.cine) G.cine.drawBars(ctx, HUD_H, VH, W);
      this.drawArrow(ctx, W, VH);   // стрелка цели — поверх табличек и уведомлений
      }
    },

    hintsOn() { return G.storage.settings.hints !== false; },

    // ---------- Направление к цели ----------
    navHop() {
      const tgt = G.nav.current();
      if (!tgt) return null;
      const h = G.nav.hop(this.map, tgt);
      return h ? { tgt, h } : null;
    },

    // ▼ над целью (или над дверью/выходом), если она на экране
    // Рамка показывает ровно ту цель, которую использует кнопка A.
    drawActionHint(ctx) {
      if(G.scenes.top()!==this||G.scenes.busy||this.cine)return;
      const action=this.currentAction();if(!action||!action.show||!action.targetRect)return;
      const r=action.targetRect,x=Math.round(r.x-2),y=Math.round(r.y-2),w=Math.round(r.w+4),h=Math.round(r.h+4);
      const col=this.player.roof?'#b6e2d0':'#f0cc79';
      ctx.save();ctx.fillStyle=col;ctx.globalAlpha=0.8+Math.sin(this.time*5)*0.15;
      for(const [a,b,sx,sy] of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]]){
        ctx.fillRect(a+(sx<0?-4:0),b,5,1);ctx.fillRect(a,b+(sy<0?-4:0),1,5);
      }
      ctx.restore();
    },
    drawTargetMark(ctx, cx, cy, W, VH, bob) {
      if (!this.hintsOn()) return;
      const r = this.navHop();
      if (!r) return;
      const { tgt, h } = r;
      let x = h.x, y = h.y;
      if (h.final && tgt.npc) y = tgt.npc.y - 38;
      else if (h.exit) y -= 14;
      else y -= 26;
      if (x < cx || x > cx + W || y < cy - 6 || y > cy + VH) return;
      G.font.draw(ctx, '▼', x, y + bob * 2, { color: tgt.ok ? '#ff5a3a' : '#9a9aa8', outline: G.PAL.ink, align: 'center' });
    },

    // Стрелка у края экрана с расстоянием
    drawArrow(ctx, W, VH) {
      if (!this.hintsOn()) return;
      const r = this.navHop();
      if (!r) return;
      const { tgt, h } = r;
      const z = this.z || 1, sx = (h.x - this.cam.x) * z, sy = (h.y - this.cam.y) * z + HUD_H - 10;
      if (sx > 6 && sx < W - 6 && sy > HUD_H + 6 && sy < HUD_H + VH - 6) return;
      const ccx = W / 2, ccy = HUD_H + VH / 2;
      const dx = sx - ccx, dy = sy - ccy;
      const k = Math.min((W / 2 - 12) / Math.abs(dx || 1e-6), (VH / 2 - 12) / Math.abs(dy || 1e-6));
      const ax = ccx + dx * k, ang = Math.atan2(dy, dx);let ay = ccy + dy * k;
      if(G.storage.settings.minimap!==false&&ax>W-70&&ay<HUD_H+70)ay=HUD_H+76;
      const pulse = 1 + Math.sin(this.time * 6) * 0.12;
      ctx.save();
      ctx.translate(Math.round(ax), Math.round(ay)); ctx.rotate(ang); ctx.scale(pulse, pulse);
      ctx.fillStyle = G.PAL.ink;
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -7); ctx.lineTo(-3, 0); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = tgt.ok ? '#ff6a3a' : '#9a9aa8';
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, -5); ctx.lineTo(-2, 0); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
      // значок и расстояние — ближе к центру
      const m = G.nav.meters(this.map, this.player.x, this.player.y, tgt);
      const label = (h.exit ? 'выход' : h.door ? '' : '') + '≈' + m + ' м';
      const lx = ax - Math.cos(ang) * 22, ly = ay - Math.sin(ang) * 16;
      const icon = h.exit ? '' : tgt.icon + ' ';
      const txt = icon + label, tw = G.font.small.measure(txt) + 10;
      const bx = G.util.clamp(Math.round(lx - tw / 2), 2, W - tw - 2);let by = G.util.clamp(Math.round(ly - 5), HUD_H + 2, HUD_H + VH - 17);
      if(G.storage.settings.minimap!==false&&bx+tw>W-63&&by<HUD_H+64)by=HUD_H+68;
      G.ui.panel(ctx, bx, by, tw, 15, 'night');
      G.font.small.draw(ctx, txt, bx + 5, by + 4, { color: '#f4d46a' });
    },

    // Кнопка ЦЕЛЬ: светящийся след (A*) до цели на этой карте
    showTrail() {
      const r = this.navHop();
      if (!r) { this.showToast('Нет цели: выбери задание или метку'); G.audio.sfx.error(); return; }
      const p = this.player;
      const t0 = performance.now();
      const path = G.nav.path(this.map, p.x, p.y, r.h.x, r.h.y);
      this.trailMs = Math.round(performance.now() - t0);
      if (!path || path.length < 2) { this.showToast(path ? 'Цель рядом!' : 'Чутьё молчит: пути не видно'); G.audio.sfx.blip(); return; }
      this.trail = { pts: path, t: 0, dur: 4 + path.length * 0.03 };
      G.audio.sfx.puff();
      if (!G.state.flags.trail_hint) { G.state.flags.trail_hint = 1; this.showToast('Чутьё ниндзя: след ведёт к цели'); }
    },
    drawTrail(ctx) {
      const tr = this.trail;
      if (!tr) return;
      const fade = Math.min(1, (tr.dur - tr.t) / 0.8);
      const head = tr.t * 22;
      ctx.globalCompositeOperation = 'lighter';
      tr.pts.forEach(([tx, ty], i) => {
        if (i === 0) return;
        const ph = head - i;
        if (ph < 0) return;
        const glow = ph < 6 ? 1 - ph / 6 : 0;
        const a = (0.35 + glow * 0.65) * fade;
        const x = tx * T + 8, y = ty * T + 10;
        ctx.fillStyle = `rgba(120,220,255,${(a * 0.35).toFixed(3)})`; ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.fillStyle = `rgba(200,250,255,${a.toFixed(3)})`; ctx.fillRect(x - 1, y - 1, 2, 2);
      });
      ctx.globalCompositeOperation = 'source-over';
    },

    // ---------- Мини-карта ----------
    drawMinimap(ctx, W) {
      if(G.cartography){G.cartography.minimap(ctx,this,W);return;}
      if (G.storage.settings.minimap === false) return;
      const S = 48, x0 = W - S - 3, y0 = HUD_H + 3;
      const m = this.map, p = this.player;
      G.ui.panel(ctx, x0 - 3, y0 - 3, S + 6, S + 6, 'plank');
      ctx.fillStyle = '#14121c'; ctx.fillRect(x0, y0, S, S);
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, S, S); ctx.clip();
      let sc, ox, oy;
      if (m.outdoor) {
        sc = 1;
        const ptx = p.x / T, pty = p.y / T;
        ox = x0 + S / 2 - ptx; oy = y0 + S / 2 - pty;
        ctx.drawImage(m.overview(), Math.round(ox), Math.round(oy));
        // двери лавок
        ctx.fillStyle = '#ffd84a';
        for (const b of m.buildings) if (b.door && G.SHOPS[b.tplId]) ctx.fillRect(Math.round(ox + b.door.tx), Math.round(oy + b.door.ty), 1, 1);
      } else {
        sc = Math.max(2, Math.floor(Math.min((S - 4) / m.w, (S - 4) / m.h)));
        ox = x0 + Math.floor((S - m.w * sc) / 2); oy = y0 + Math.floor((S - m.h * sc) / 2);
        const ID = G.tiles.ID;
        for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
          const t = m.get(tx, ty);
          ctx.fillStyle = t === ID.VOID ? '#14121c' : t === ID.IWALL ? '#5a4a3a' : t === ID.MAT ? '#6ab04a' : '#c8a878';
          ctx.fillRect(ox + tx * sc, oy + ty * sc, sc, sc);
        }
        ctx.fillStyle = '#7a5a3a';
        for (const o of m.objects) if (o.box) ctx.fillRect(Math.round(ox + o.box.x / T * sc), Math.round(oy + o.box.y / T * sc), Math.max(1, Math.round(o.box.w / T * sc)), Math.max(1, Math.round(o.box.h / T * sc)));
      }
      const P2 = (wx, wy) => [Math.round(ox + wx / T * sc), Math.round(oy + wy / T * sc)];
      // NPC со значками
      for (const n of this.npcs) {
        const ic = G.quests.iconFor(n.id);
        if (!ic) continue;
        const [nx, ny] = P2(n.x, n.y);
        ctx.fillStyle = ic === '!' ? '#ffd84a' : '#7ad0ff'; ctx.fillRect(nx - 1, ny - 1, 3, 3);
      }
      // цель
      const r = this.navHop();
      if (r && Math.floor(this.time * 3) % 2 === 0) {
        const [hx, hy] = P2(r.h.x, r.h.y);
        const cxp = G.util.clamp(hx, x0 + 1, x0 + S - 2), cyp = G.util.clamp(hy, y0 + 1, y0 + S - 2);
        ctx.fillStyle = '#ff3a2a'; ctx.fillRect(cxp - 1, cyp - 1, 3, 3);
      }
      // игрок — стрелка по направлению взгляда
      const [px, py] = P2(p.x, p.y);
      const v = G.actors.DIRV[p.dir];
      ctx.fillStyle = '#ffffff'; ctx.fillRect(px - 1, py - 1, 3, 3);
      ctx.fillStyle = '#e8621a'; ctx.fillRect(px + v[0] * 2, py + v[1] * 2, 1, 1); ctx.fillRect(px, py, 1, 1);
      ctx.restore();
    },

    // Уведомления о заданиях
    drawNotes(ctx, W) {
      // таймер идёт по реальному времени, даже когда сверху диалог или лавка
      const now = performance.now(), dt = Math.min(0.1, (now - (this._noteT || now)) / 1000);
      this._noteT = now;
      if (this.notes.length) { this.notes[0].t -= dt; if (this.notes[0].t <= 0) this.notes.shift(); }
      const n = this.notes[0];
      if (!n) return;
      const a = Math.min(1, n.t * 3, (2.6 - n.t) * 5);
      ctx.globalAlpha = Math.max(0, a);
      const F = G.font.small, tw = Math.min(W - 8, Math.max(G.font.measure(n.title), F.measure(n.text)) + 26);
      const x = Math.round((W - tw) / 2), y = HUD_H + 28;
      G.ui.panel(ctx, x, y, tw, 36, 'frame');
      G.font.draw(ctx, n.title, W / 2, y + 8, { align: 'center', color: G.ui.C.redDark });
      let txt = n.text;
      while (F.measure(txt) > tw - 20 && txt.length > 4) txt = txt.slice(0, -2) + '…';
      F.draw(ctx, txt, W / 2, y + 22, { align: 'center', color: G.ui.C.ink });
      ctx.globalAlpha = 1;
    },

    // Освещение по времени суток + свет фонарей ночью
    // Дождь: серый тон и косые струи (в координатах экрана)
    drawRain(ctx, cx, cy, W, VH) {
      G.fx.rain(ctx,cx,cy,W,VH,this.map,this.time);
    },

    drawLight(ctx, vis, cx, cy, W, VH) {
      if (G.lighting) return G.lighting.draw(ctx, this, vis, cx, cy, W, VH);
      const L = G.game.light();
      if (!L) return;
      const m = this.map;
      const a = m.outdoor ? L[3] : L[3] * 0.35;
      ctx.fillStyle = `rgba(${L[0] | 0},${L[1] | 0},${L[2] | 0},${a.toFixed(3)})`;
      ctx.fillRect(cx, cy, W, VH);
      G.fx.windows(ctx, vis, m, (a - 0.12) / 0.3, this.time);
      if (!m.outdoor || a < 0.2) return;
      ctx.globalCompositeOperation = 'lighter';
      const k = Math.min(1, (a - 0.2) / 0.25);
      for (const o of vis) {
        const ly = o.kind === 'lamp' ? o.y - 24 : o.kind === 'stonelamp' ? o.y - 13 : null;
        if (ly == null) continue;
        const gr = ctx.createRadialGradient(o.x, ly, 1, o.x, ly, 26);
        gr.addColorStop(0, `rgba(255,190,90,${0.5 * k})`);
        gr.addColorStop(1, 'rgba(255,150,60,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(o.x - 26, ly - 26, 52, 52);
      }
      ctx.globalCompositeOperation = 'source-over';
    },

    drawActor(ctx, a) {
      if (G.lighting) G.lighting.actor(ctx, a, this.map, G.state.vars.min);
      const bounce = a.moving ? Math.abs(Math.sin(a.anim * Math.PI)) : 0;
      G.shade.shadow(ctx, a.x + 1, a.y - 1, 6 - bounce * .5, 2, 0.28);
      G.shade.shadow(ctx, a.x, a.y - 1, 3, 1, 0.23);   // V9: мягкая тень под ногами
      const frame = a.moving ? G.chars.WALK[Math.floor(a.anim) % 4] : 0;
      // жители: у каждого своя расцветка одежды (по номеру в списке жителей карты — одинаково между кадрами и загрузками)
      if (a._look === undefined) a._look = (a.id === 'villager_m' || a.id === 'villager_f') ? Math.floor(G.util.hash2(this.map.npcs.indexOf(a), 7, 91) * G.chars.LOOKS) : 0;
      const lift=G.villageDaily?G.villageDaily.lift(a,this.time):0;
      ctx.save();
      if (a._npcPass?.size) ctx.globalAlpha *= .65;
      if(G.villageDaily)G.villageDaily.drawCargo(ctx,this,a,true);
      if(!G.worldMotion||!G.worldMotion.actor(ctx,this,a,frame,lift))G.chars.draw(ctx, a.id, a.dir, frame, a.x, a.y-lift, a._look);
      ctx.restore();
      if (a === this.player && G.purple) G.purple.drawAura(ctx, this, a);
      if(G.villageDaily){G.villageDaily.drawCargo(ctx,this,a);G.villageDaily.drawActorExtras(ctx,this,a);}
      if(a._guard)G.guards.lantern(ctx,a);
    },

    drawHud(ctx) {
      const W = G.screen.W, U = G.ui, F = G.font.small, C = U.C;
      U.panel(ctx, 0, 0, W, HUD_H, 'night');
      const g = G.game, v = g.v;
      F.draw(ctx, `${g.dayName()}, ${g.date()}`, 6, 5, { color: '#d8c8a0' });
      // часы: мигающее двоеточие, пока время идёт; значок погоды (ночью — луна)
      const wt = G.life.WEATHER[G.life.weather()];
      const night = g.isNight();
      const running = G.scenes.top() === this && !G.scenes.busy;
      let clk = g.clock();
      if (running && this.player.moving && Math.floor(G.life.acc * 2) % 2 === 1) clk = clk.replace(':', ' ');   // двоеточие мигает, только пока часы идут
      const cw = G.font.measure('00:00'), cx = Math.round(W / 2 - cw / 2);
      if (night && wt.icon === '☀') U.icon(ctx, 'moon', cx - 14, 4, '#c8d0ff');
      else F.draw(ctx, wt.icon, cx - 12, 5, { color: wt.col });
      // Цифры часов и денег — основным шрифтом: они решают (сколько времени до урока, хватает ли
      // на рамен), а мелкий на телефоне приходится разбирать. Подписи остаются мелкими.
      G.font.draw(ctx, clk, cx, 2, { color: v.min >= 23 * 60 ? '#ff8a6a' : night ? '#9ab0ff' : '#f8eed0' });
      const mw = G.font.small.measure(' рё');
      G.font.draw(ctx, String(v.money), W - 4 - mw, 2, { align: 'right', color: '#f4d46a' });
      G.font.small.draw(ctx, ' рё', W - 4 - mw, 6, { color: '#c8a860' });
      // здоровье, чакра, усталость: значок + бамбуковая шкала (у усталости полная шкала — плохо)
      const bars = [['heart', C.hp, v.hp / 100], ['drop', C.chakra, v.chakra / 100], ['bolt', C.fatigue, v.fatigue / 100]];
      const cell = (W - 8) / 3;
      bars.forEach(([ic, col, val], i) => {
        const x = Math.round(4 + i * cell), low = i === 2 && val > 0.8 && Math.floor(this.time * 3) % 2 === 0;
        U.icon(ctx, ic, x, 15, low ? '#ff6a4a' : col);
        U.gauge(ctx, x + 13, 18, Math.round(cell) - 17, 6, val, low ? '#e04a4a' : col);
      });
    },

    drawStrip(ctx) {
      const W = G.screen.W, U = G.ui, F = G.font.small;
      const y = G.screen.H - STRIP_H;
      U.panel(ctx, 0, y, W, STRIP_H, 'plank');
      const mk = G.state.marker;
      const qid = !mk && G.quests.tracked(), st = qid && G.quests.curStep(qid);
      const maxW = W - G.touch.sysWidth() - 6;
      if (st || mk) {
        const flash = this.goalFlash && Math.floor(this.goalFlash * 6) % 2 === 0;
        const ok = !st || G.quests.timeOk(st);
        const icon = st ? G.QUEST_CATS[G.QUESTS[qid].cat].icon : '📍';
        F.draw(ctx, icon, 6, y + 7, { color: st ? G.QUEST_CATS[G.QUESTS[qid].cat].color : '#ff9a4a' });
        let txt = st ? st.text : 'Метка: ' + (mk.label || 'место');
        const suffix = ok ? '' : st.day && G.state.vars.day < st.day ? ' · с ' + G.game.date(st.day) : st.time && G.quests.dayOk(st) ? ' ⏰ с ' + G.game.clock(st.time[0]) : '';
        while (F.measure(txt + suffix) > maxW - 14 && txt.length > 4) txt = txt.slice(0, -2) + '…';
        F.draw(ctx, txt + suffix, 18, y + 7, { color: !ok ? '#9a8a76' : flash ? '#ffd23a' : '#f8eed0', shadow: '#160c06' });
      } else {
        U.icon(ctx, 'leaf', 5, y + 6, '#ff9a4a');
        F.draw(ctx, this.place, 18, y + 7, { color: '#f8eed0', shadow: '#160c06', maxW });
      }
    },
}));
