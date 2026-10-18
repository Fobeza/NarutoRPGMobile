// Большая карта Конохи (кнопка КАРТА), план §2.6.
// Масштаб ×1 / ×2 (кнопка ЦЕЛЬ), курсор крестовиной, фильтры (МЕНЮ или тап), карточка места (A),
// «Проложить путь» и «Метка», туман неисследованных участков, задания и друзья.
G.scenes.register('mapview', (world) => {
  const T = G.CONFIG.TILE;
  const K = G.world.konoha();
  const FILTERS = ['Все', 'Задания', 'Лавки', 'Тренировки', 'Друзья'];
  const TOP = 13, BOT = 27;

  // ---------- места ----------
  const placeOf = (b) => {
    const p = G.nav.buildingPoint(b);
    return { x: p.x / T, y: p.y / T - 0.5 };
  };
  const places = [];
  for (const b of K.buildings) {
    const d = b.tplDef;
    if (!d) continue;
    const shop = G.SHOPS[b.tplId];
    let kind = null;
    if (shop) kind = d.cat === 'food' ? 'food' : 'shop';
    else if (d.cat === 'training') kind = 'training';
    else if (d.unique || d.cat === 'official' || d.cat === 'clan' || d.cat === 'landmark') kind = 'place';
    if (!kind) continue;
    places.push(Object.assign(placeOf(b), { b, kind, name: b.name, shop, known: !!d.unique }));
  }
  for (const sp of Object.values(K.spots)) {
    places.push(Object.assign(placeOf(sp), { b: sp, kind: sp.tplDef.cat === 'training' ? 'training' : 'place', name: sp.name, known: !!sp.tplDef.unique }));
  }
  const isOpen = (shop) => { const m = G.state.vars.min % 1440; return m >= shop.hours[0] && m < shop.hours[1]; };

  // ---------- позиции заданий / друзей ----------
  function questMarks() {
    const out = [];
    const tracked = G.quests.tracked();
    for (const id of G.quests.activeList()) {
      const st = G.quests.curStep(id);
      if (!st) continue;
      const r = G.nav.resolve(st.target, st);
      if (!r) continue;
      let x = r.x / T, y = r.y / T;
      if (r.map !== 'konoha') {
        const b = K.buildings[Number(String(r.map).split(':')[1])];
        if (!b) continue;
        ({ x, y } = placeOf(b));
      }
      out.push({ x, y, id, tracked: id === tracked, icon: G.QUEST_CATS[G.QUESTS[id].cat].icon, col: G.QUEST_CATS[G.QUESTS[id].cat].color, label: st.text });
    }
    for (const [id, d] of Object.entries(G.QUESTS)) {
      if (!d.offer || G.quests.state(id) || !d.offer.when()) continue;
      let pos = null;
      if (d.offer.in) { const b = K.buildings.find((b) => b.tplId === d.offer.in); if (b) pos = placeOf(b); }
      else { const f = G.nav.findNpc(d.offer.npc); if (f) pos = f.b ? placeOf(f.b) : { x: f.n.x / T, y: f.n.y / T }; }
      if (pos) out.push({ x: pos.x, y: pos.y, offer: true, icon: '!', col: G.PAL.yellow, label: d.title });
    }
    return out;
  }
  function friendMarks() {
    const out = [];
    for (const id of Object.keys(G.chars.DEFS)) {
      if ((G.state.vars['friend_' + id] || 0) < 2) continue;
      const f = G.nav.findNpc(id);
      if (!f) continue;
      const pos = f.b ? placeOf(f.b) : { x: f.n.x / T, y: f.n.y / T };
      out.push({ x: pos.x, y: pos.y, icon: '🍃', col: '#6ab04a', label: G.chars.nameOf(id), npc: id });
    }
    return out;
  }

  // ---------- где герой ----------
  function heroPos() {
    const m = world.map, p = world.player;
    if (m.outdoor) return { x: p.x / T, y: p.y / T, inside: null };
    const pp = placeOf(m.building);
    return { x: pp.x, y: pp.y, inside: m.name };
  }

  const S = {
    name: 'mapview',
    t: 0,
    zoom: 1,
    filter: 0,
    card: null,       // { place, opts, sel }
    toast: null, toastT: 0,
    qm: questMarks(),
    fm: friendMarks(),

    enter() {
      const h = heroPos();
      this.cx = h.x; this.cy = h.y;
      this.vx = 0; this.vy = 0;
      this.fitView(true);
    },
    vh() { return G.screen.H - TOP - BOT; },
    fitView(center) {
      const z = this.zoom, VW = G.screen.W / z, VH = this.vh() / z;
      if (K.w <= VW) this.vx = -(VW - K.w) / 2;
      else if (center) this.vx = G.util.clamp(this.cx - VW / 2, 0, K.w - VW);
      else {
        const mx = 16 / z;
        if (this.cx < this.vx + mx) this.vx = this.cx - mx;
        if (this.cx > this.vx + VW - mx) this.vx = this.cx - VW + mx;
        this.vx = G.util.clamp(this.vx, 0, K.w - VW);
      }
      if (K.h <= VH) this.vy = -(VH - K.h) / 2;
      else if (center) this.vy = G.util.clamp(this.cy - VH / 2, 0, K.h - VH);
      else {
        const my = 16 / z;
        if (this.cy < this.vy + my) this.vy = this.cy - my;
        if (this.cy > this.vy + VH - my) this.vy = this.cy - VH + my;
        this.vy = G.util.clamp(this.vy, 0, K.h - VH);
      }
    },
    toScreen(x, y) { return [Math.round((x - this.vx) * this.zoom), Math.round(TOP + (y - this.vy) * this.zoom)]; },
    fogged(x, y) {
      const B = G.nav.FOG_B;
      return !G.nav.explored(Math.floor(x / B), Math.floor(y / B));
    },
    visiblePlaces() {
      const f = FILTERS[this.filter];
      return places.filter((p) => {
        if (!p.known && this.fogged(p.x, p.y)) return false;
        if (f === 'Все') return true;
        if (f === 'Лавки') return p.kind === 'shop' || p.kind === 'food';
        if (f === 'Тренировки') return p.kind === 'training';
        return false;
      });
    },
    hover() {
      const r = 3.2 / this.zoom + 0.8;
      let best = null, bd = r;
      for (const p of places) {
        if (!p.known && this.fogged(p.x, p.y)) continue;
        const d = Math.hypot(p.x - this.cx, p.y - this.cy);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    },
    say(t) { this.toast = t; this.toastT = 1.6; },

    setMarker(x, y, label) {
      const g = G.nav.walkGrid(K);
      const w = G.nav.nearestWalkable(K, g, Math.floor(x), Math.floor(y));
      if (!w) { G.audio.sfx.error(); this.say('Туда не пройти'); return false; }
      G.state.marker = { x: w[0], y: w[1], label };
      G.audio.sfx.confirm();
      return true;
    },

    openCard(p) {
      const opts = [];
      opts.push({ label: 'Проложить путь', act: () => { if (this.setMarker(p.x, p.y + 0.5, p.name)) { G.scenes.pop(); world.showTrail(); } } });
      const mk = G.state.marker;
      const here = mk && mk.label === p.name;
      opts.push(here ? { label: 'Снять метку', act: () => { G.state.marker = null; this.card = null; this.say('Метка снята'); G.audio.sfx.cancel(); } }
        : { label: 'Метка', act: () => { if (this.setMarker(p.x, p.y + 0.5, p.name)) { this.card = null; this.say('📍 Метка: ' + p.name); } } });
      // кто сейчас там
      let who = [];
      if (p.b.interior) {
        const m = G.world.get(p.b.interior.id);
        who = m.npcs.filter((n) => G.life.visible(n)).map((n) => n.name || G.chars.nameOf(n.id));
      } else {
        who = K.npcs.filter((n) => G.life.visible(n) && Math.hypot(n.x / T - p.x, n.y / T - p.y) < 6).map((n) => n.name || G.chars.nameOf(n.id));
      }
      this.card = { p, opts, sel: 0, who: [...new Set(who)] };
      G.audio.sfx.select();
    },

    update(dt) {
      this.t += dt;
      const I = G.input;
      if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toast = null; }
      const W = G.screen.W, H = G.screen.H;

      if (this.card) {
        const c = this.card;
        if (I.pressed('b') || I.pressed('map')) { this.card = null; G.audio.sfx.cancel(); return; }
        if (I.pressed('up') || I.pressed('down')) { c.sel = 1 - c.sel; G.audio.sfx.select(); }
        if (I.pressed('a')) { c.opts[c.sel].act(); return; }
        if (I.tapNow) {
          const r = this.cardRect();
          const t = I.tapNow;
          if (t.y >= r.y && t.y < r.y + r.h && t.x >= r.x && t.x < r.x + r.w) {
            const i = Math.floor((t.y - r.btnY) / 12);
            if (i >= 0 && i < c.opts.length) { c.sel = i; c.opts[i].act(); }
          } else { this.card = null; G.audio.sfx.cancel(); }
        }
        return;
      }

      if (I.pressed('map') || I.pressed('b')) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
      if (I.pressed('menu')) { this.filter = (this.filter + 1) % FILTERS.length; G.audio.sfx.select(); return; }
      if (I.pressed('goal')) { this.zoom = this.zoom === 1 ? 2 : 1; this.fitView(true); G.audio.sfx.select(); return; }

      // курсор
      const ax = (I.held('right') ? 1 : 0) - (I.held('left') ? 1 : 0);
      const ay = (I.held('down') ? 1 : 0) - (I.held('up') ? 1 : 0);
      if (ax || ay) {
        this.hold = (this.hold || 0) + dt;
        const sp = (this.hold > 0.6 ? 60 : 24) / this.zoom;
        this.cx = G.util.clamp(this.cx + ax * sp * dt, 0, K.w - 1);
        this.cy = G.util.clamp(this.cy + ay * sp * dt, 0, K.h - 1);
        this.fitView(false);
      } else this.hold = 0;

      if (I.tapNow) {
        const t = I.tapNow;
        if (t.y >= H - BOT && t.y < H - BOT + 14) {         // фильтры
          const i = Math.floor(t.x / (W / FILTERS.length));
          if (i >= 0 && i < FILTERS.length) { this.filter = i; G.audio.sfx.select(); }
          return;
        }
        if (t.y < TOP) { this.zoom = this.zoom === 1 ? 2 : 1; this.fitView(true); return; }
        if (t.y >= H - BOT + 14) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
        const nx = t.x / this.zoom + this.vx, ny = (t.y - TOP) / this.zoom + this.vy;
        const before = this.hover();
        const same = Math.hypot(nx - this.cx, ny - this.cy) < 3 / this.zoom + 1;
        this.cx = G.util.clamp(nx, 0, K.w - 1); this.cy = G.util.clamp(ny, 0, K.h - 1);
        const h = this.hover();
        if (same && h && h === before) this.openCard(h);
        else G.audio.sfx.blip();
        return;
      }

      if (I.pressed('a')) {
        const h = this.hover();
        if (h) { this.openCard(h); return; }
        const mk = G.state.marker;
        if (mk && Math.hypot(mk.x + 0.5 - this.cx, mk.y + 0.5 - this.cy) < 3) { G.state.marker = null; this.say('Метка снята'); G.audio.sfx.cancel(); return; }
        if (this.fogged(this.cx, this.cy)) { G.audio.sfx.error(); this.say('Ты там ещё не был'); return; }
        if (this.setMarker(this.cx, this.cy, 'Метка')) this.say('📍 Метка поставлена');
      }
    },

    cardRect() {
      const W = G.screen.W, H = G.screen.H;
      const c = this.card, lines = 3 + (c.who.length ? 1 : 0);
      const h = 10 + lines * 10 + c.opts.length * 12 + 4;
      const y = H - BOT - h - 4;
      return { x: 6, y, w: W - 12, h, btnY: y + 8 + lines * 10 + 2 };
    },

    draw(ctx) {
      const W = G.screen.W, H = G.screen.H, P = G.PAL, F = G.font, z = this.zoom;
      ctx.fillStyle = '#14121c'; ctx.fillRect(0, 0, W, H);
      const VH = this.vh();
      ctx.save(); ctx.beginPath(); ctx.rect(0, TOP, W, VH); ctx.clip();
      // подложка
      const img = K.overview();
      ctx.imageSmoothingEnabled = false;
      const [ox, oy] = this.toScreen(0, 0);
      ctx.fillStyle = P.ink; ctx.fillRect(ox - 1, oy - 1, K.w * z + 2, K.h * z + 2);
      ctx.drawImage(img, ox, oy, K.w * z, K.h * z);
      // туман
      const B = G.nav.FOG_B, fs = G.nav.fogSize();
      ctx.fillStyle = 'rgba(20,18,28,0.82)';
      for (let by = 0; by < fs.bh; by++) for (let bx = 0; bx < fs.bw; bx++) {
        if (G.nav.explored(bx, by)) continue;
        const [sx, sy] = this.toScreen(bx * B, by * B);
        ctx.fillRect(sx, sy, B * z, B * z);
      }
      // места
      const bob = Math.round(Math.sin(this.t * 5) * 1.2);
      const icon = (txt, x, y, col) => { const [sx, sy] = this.toScreen(x, y); F.draw(ctx, txt, sx, sy - 4, { color: col, outline: P.ink, align: 'center' }); };
      for (const p of this.visiblePlaces()) {
        if (p.kind === 'food') icon('🍜', p.x, p.y, isOpen(p.shop) ? '#ffb070' : '#7a7a86');
        else if (p.kind === 'shop') icon('●', p.x, p.y, isOpen(p.shop) ? '#ffd84a' : '#7a7a86');
        else if (p.kind === 'training') icon('★', p.x, p.y, '#ff8a6a');
        else if (z === 2) { const [sx, sy] = this.toScreen(p.x, p.y); ctx.fillStyle = P.ink; ctx.fillRect(sx - 1, sy - 1, 3, 3); ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, sy, 1, 1); }
      }
      const f = FILTERS[this.filter];
      // друзья
      if (f === 'Все' || f === 'Друзья') for (const m of this.fm) icon(m.icon, m.x, m.y, m.col);
      // секрет с «Карты тайников»
      if (G.game.count('map_secrets') && !G.quests.done('waterfall_scroll') && (f === 'Все' || f === 'Задания')) {
        const wf = K.spots.waterfall;
        if (wf) icon('❓', wf.tx - 1, wf.ty + wf.th, '#c090ff');
      }
      // задания
      if (f === 'Все' || f === 'Задания') {
        for (const m of this.qm) if (!m.tracked) icon(m.offer ? '!' : m.icon, m.x, m.y, m.col);
        for (const m of this.qm) if (m.tracked && !G.state.marker) { const [sx, sy] = this.toScreen(m.x, m.y); F.draw(ctx, '▼', sx, sy - 11 + bob * 2, { color: '#ff4a3a', outline: P.ink, align: 'center' }); }
      }
      // метка
      const mk = G.state.marker;
      if (mk) { const [sx, sy] = this.toScreen(mk.x + 0.5, mk.y + 0.5); F.draw(ctx, '📍', sx, sy - 7 + bob, { color: '#ff4a3a', outline: P.ink, align: 'center' }); }
      // герой ◉
      const h = heroPos();
      {
        const [sx, sy] = this.toScreen(h.x, h.y);
        const on = Math.floor(this.t * 3) % 2 === 0;
        ctx.fillStyle = P.ink; ctx.fillRect(sx - 3, sy - 2, 7, 5); ctx.fillRect(sx - 2, sy - 3, 5, 7);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 2, sy - 1, 5, 3); ctx.fillRect(sx - 1, sy - 2, 3, 5);
        ctx.fillStyle = on ? '#e8621a' : '#ffffff'; ctx.fillRect(sx - 1, sy - 1, 3, 3);
      }
      // курсор
      {
        const [sx, sy] = this.toScreen(this.cx, this.cy);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 6, sy, 4, 1); ctx.fillRect(sx + 3, sy, 4, 1); ctx.fillRect(sx, sy - 6, 1, 4); ctx.fillRect(sx, sy + 3, 1, 4);
      }
      ctx.restore();

      // заголовок
      ctx.fillStyle = '#1e1a28'; ctx.fillRect(0, 0, W, TOP);
      F.draw(ctx, 'КАРТА КОНОХИ', 4, 3, { color: P.orange });
      F.draw(ctx, (z === 1 ? '×1' : '×2') + ' ' + G.game.clock(), W - 4, 3, { align: 'right', color: P.light });

      // строка-подсказка о месте под курсором
      const hv = this.hover();
      let info;
      if (hv) {
        info = hv.name;
        if (hv.shop) info += isOpen(hv.shop) ? ` · до ${G.game.clock(hv.shop.hours[1])}` : ` · закрыто (с ${G.game.clock(hv.shop.hours[0])})`;
      } else if (h.inside) info = 'Ты внутри: ' + h.inside;
      else info = this.fogged(this.cx, this.cy) ? 'Неизведанные места' : 'A — метка, ЦЕЛЬ — масштаб';
      ctx.globalAlpha = 0.85; ctx.fillStyle = '#14121c'; ctx.fillRect(0, TOP + VH - 11, W, 11); ctx.globalAlpha = 1;
      F.draw(ctx, info, W / 2, TOP + VH - 9, { align: 'center', color: hv ? P.white : P.gray, max: 99 });

      // фильтры
      const fy = H - BOT;
      ctx.fillStyle = '#1e1a28'; ctx.fillRect(0, fy, W, BOT);
      const fw = W / FILTERS.length;
      FILTERS.forEach((name, i) => {
        const sel = i === this.filter;
        ctx.fillStyle = sel ? '#3a3450' : '#24202e'; ctx.fillRect(Math.round(i * fw) + 1, fy + 1, Math.round(fw) - 2, 12);
        let n = name; while (F.measure(n) > fw - 4) n = n.slice(0, -2) + '.';
        F.draw(ctx, n, i * fw + fw / 2, fy + 3, { align: 'center', color: sel ? P.yellow : P.gray });
      });
      F.draw(ctx, 'МЕНЮ фильтр · ЦЕЛЬ ×2 · B закрыть', W / 2, fy + 16, { align: 'center', color: '#8a8498', max: 99 });

      // карточка места
      if (this.card) this.drawCard(ctx);
      if (this.toast) {
        const w = F.measure(this.toast) + 12;
        G.gfx.window(ctx, Math.round((W - w) / 2), TOP + 4, w, 16, 'dark');
        F.draw(ctx, this.toast, W / 2, TOP + 8, { align: 'center', color: P.yellow });
      }
    },

    drawCard(ctx) {
      const c = this.card, p = c.p, r = this.cardRect(), F = G.font, P = G.PAL;
      G.gfx.window(ctx, r.x, r.y, r.w, r.h, 'paper');
      let y = r.y + 6;
      F.draw(ctx, p.name, r.x + 6, y, { color: G.UI.text }); y += 10;
      const cat = { food: 'Еда', shop: 'Лавка', training: 'Тренировки', place: p.b.tplDef.cat === 'clan' ? 'Клан' : 'Место' }[p.kind];
      F.draw(ctx, cat, r.x + r.w - 6, r.y + 6, { align: 'right', color: P.gray });
      if (p.shop) {
        const o = isOpen(p.shop);
        F.draw(ctx, `${G.game.clock(p.shop.hours[0])}–${G.game.clock(p.shop.hours[1])} · ${o ? 'открыто' : 'закрыто'}`, r.x + 6, y, { color: o ? '#4a7a3a' : '#b04a3a' });
      } else F.draw(ctx, p.b.interior ? 'Можно зайти' : 'Под открытым небом', r.x + 6, y, { color: P.gray });
      y += 10;
      const dist = Math.round(Math.hypot(p.x - heroPos().x, p.y - heroPos().y) * 2);
      F.draw(ctx, `≈${dist} м от тебя`, r.x + 6, y, { color: P.gray }); y += 10;
      if (c.who.length) {
        let s = 'Сейчас там: ' + c.who.join(', ');
        while (F.measure(s) > r.w - 12 && s.length > 4) s = s.slice(0, -2) + '…';
        F.draw(ctx, s, r.x + 6, y, { color: '#5a6a8a' }); y += 10;
      }
      c.opts.forEach((o, i) => {
        const by = r.btnY + i * 12, sel = i === c.sel;
        if (sel) { ctx.fillStyle = G.UI.sel; ctx.fillRect(r.x + 4, by - 2, r.w - 8, 11); F.draw(ctx, '▶', r.x + 7, by, { color: P.orange }); }
        F.draw(ctx, o.label, r.x + 16, by, { color: sel ? G.UI.selText : G.UI.dim });
      });
    },
  };
  return S;
});
