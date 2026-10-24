// Карточный бой «Дуэль». Правила — systems/duel.js, описание — docs/COMBAT.md.
// Игрок разыгрывает до трёх карт, видит намерение врага и сам решает, когда закончить ход.
G.scenes.register('battle', (opts, onEnd) => {
  const F = G.font, AU = G.audio, U = G.ui, C = U.C, FS = F.small, PAL = G.PAL, I = G.input;
  const V = G.state.vars, mode = opts.mode || 'ko';
  const ed = G.ENEMIES[opts.enemy] || G.ENEMIES.dummy;
  const techs = Object.keys(G.TECHS).filter((id) => G.combat.knows(id));
  const stock = () => ({ bandage: G.game.count('bandage'), chakra_pill: G.game.count('chakra_pill'), smoke_bomb: G.game.count('smoke_bomb'), flash_bomb: G.game.count('flash_bomb') });
  const D = G.duel.create({ enemy: opts.enemy, mode, rounds: opts.turns, techs, hp: V.hp, chakra: V.chakra, fatigue: V.fatigue, inv: stock(), day: V.day });
  const TERRAIN = opts.terrain || 'field';
  let phase = 'intro', t = 0, focus = 0, handPage = 0, selected = D.hand[0] ? D.hand[0].uid : 0;
  let ev = [], evI = 0, evT = 0, afterEvents = 'card', lastIntent = D.intent, result = null, endT = 0, said = null;
  const fx = { shake: 0, flash: 0, flashCol: '#fff', pops: [], fxs: [], hurtP: 0, hurtE: 0, lungeP: 0, lungeE: 0, aura: 0 };
  let tip = !G.state.flags.card_duel_tip;
  const stats = { hits: 0, evades: 0, techs: 0 };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hit = (b, p) => p && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  const sfx = {
    hit() { AU.noise(0.08, 0.25); AU.tone(140, 0.08, 'square', 0.12, 60); },
    big() { AU.noise(0.2, 0.3); AU.tone(110, 0.2, 'sawtooth', 0.15, 40); },
    block() { AU.tone(1400, 0.06, 'square', 0.1); AU.tone(1900, 0.1, 'triangle', 0.08, null, 0.04); },
    whoosh() { AU.noise(0.12, 0.08); AU.tone(900, 0.1, 'triangle', 0.05, 300); },
    purple() { AU.tone(300, 0.3, 'sawtooth', 0.12, 900); AU.noise(0.2, 0.15); },
    win() { [523, 659, 784, 1046].forEach((f, i) => AU.tone(f, 0.15, 'square', 0.1, null, i * 0.12)); },
    lose() { [392, 330, 262].forEach((f, i) => AU.tone(f, 0.25, 'triangle', 0.12, null, i * 0.2)); },
  };

  // Геометрия рассчитана на внутренний экран от 192×256: карты и кнопки остаются крупными при CSS-масштабе телефона.
  const uiScale = () => { try { const r = G.screen.canvas.getBoundingClientRect(); return r.width > 0 ? r.width / G.screen.W : 1.34; } catch (_) { return 1.34; } };
  const dims = () => ({ bh: Math.max(28, Math.ceil(44 / uiScale())) });
  const geo = () => {
    const W = G.screen.W, H = G.screen.H, d = dims(), handH = Math.max(44, d.bh);
    const PH = Math.min(H - 82, 90 + handH + d.bh), AH = H - PH;
    return { W, H, AH, PH, d, yb: AH - 8, hx: Math.round(W * 0.27), ex: Math.round(W * 0.73), py: AH, handY: AH + 82, handH };
  };
  const cardColor = (kind) => ({ tai: '#d87838', def: '#4a90b8', skill: '#c09840', nin: '#8068c8', gen: '#b068b0', item: '#5a9a58' }[kind] || '#888');
  const selectedCard = () => D.hand.find((c) => c.uid === selected) || null;
  const pageCount = () => Math.max(1, Math.ceil(D.hand.length / 5));
  const selectCard = (c) => { if (!c) return; selected = c.uid; const i = D.hand.indexOf(c); if (i >= 0) handPage = Math.floor(i / 5); };

  // Кнопки руки и нижней панели. Карта доступна для выбора даже без чакры — так видно причину блокировки.
  function buttons() {
    const g = geo(), out = [], pad = 4, gap = 2;
    handPage = clamp(handPage, 0, pageCount() - 1);
    const visible = D.hand.slice(handPage * 5, handPage * 5 + 5);
    const cw = Math.floor((g.W - pad * 2 - gap * 4) / 5);
    visible.forEach((c, i) => out.push({ id: 'card:' + c.uid, ref: 'uid:' + c.uid, card: c.id, zone: 'hand', uid: c.uid,
      x: pad + i * (cw + gap), y: g.handY, w: cw, h: g.handH }));
    const actions = [];
    if (pageCount() > 1) actions.push({ id: 'prev', label: '‹', zone: 'action' });
    const check = selectedCard() ? G.duel.canPlay(D, selectedCard()) : { ok: false, why: 'Нет карты' };
    actions.push({ id: 'play', label: 'Играть', zone: 'action', off: check.ok ? null : check.why });
    if (pageCount() > 1) actions.push({ id: 'next', label: '›', zone: 'action' });
    actions.push({ id: 'end', label: 'Конец', zone: 'action' }, { id: 'quit', label: 'Сдаться', zone: 'action' });
    const aw = Math.floor((g.W - pad * 2 - gap * (actions.length - 1)) / actions.length);
    actions.forEach((b, i) => { b.x = pad + i * (aw + gap); b.y = g.py + g.PH - g.d.bh - 3; b.w = aw; b.h = g.d.bh; out.push(b); });
    return out;
  }

  function say(text) { said = { text, t: 2.4 }; }
  function playCard(ref) {
    if (phase !== 'choose') return false;
    const check = G.duel.canPlay(D, ref);
    if (!check.ok) { AU.sfx.error(); say(check.why); return false; }
    const c = check.card, def = check.def;
    AU.sfx.select();
    if (tip) { tip = false; G.state.flags.card_duel_tip = 1; }
    if (def.tech) stats.techs++;
    if (c.id === 'evade' || c.id === 'shunshin' || c.id === 'kawarimi') stats.evades++;
    if (def.release) { fx.aura = 1.2; sfx.purple(); }
    runEvents(G.duel.play(D, c), 'card');
    return true;
  }
  function endPlayerTurn() {
    if (phase !== 'choose') return false;
    lastIntent = D.intent;
    AU.sfx.confirm();
    runEvents(G.duel.endTurn(D), 'enemy');
    return true;
  }
  function pick(b) {
    if (phase !== 'choose' || !b) return;
    if (b.zone === 'hand') {
      const c = D.hand.find((x) => x.uid === b.uid);
      if (selected === b.uid) playCard(b.ref);
      else { selectCard(c); AU.sfx.blip(); }
      return;
    }
    if (b.id === 'play') { const c = selectedCard(); if (c) playCard(c); else say('Выбери карту'); return; }
    if (b.id === 'end') { endPlayerTurn(); return; }
    if (b.id === 'quit') { finish(false, true); return; }
    if (b.id === 'prev' || b.id === 'next') {
      handPage = (handPage + (b.id === 'next' ? 1 : -1) + pageCount()) % pageCount();
      const c = D.hand[handPage * 5]; if (c) selected = c.uid;
      focus = 0; AU.sfx.blip();
    }
  }

  function runEvents(events, after) {
    ev = events || []; evI = 0; evT = 0; afterEvents = after; phase = 'play';
    nextEvent();
  }
  function nextEvent() {
    if (evI >= ev.length) { completeEvents(); return; }
    const e = ev[evI++]; evT = 0.62;
    const g = geo(), tx = e.to === 'p' ? g.hx : g.ex, ty = g.yb - 24;
    if (e.who === 'p') fx.lungeP = 1; else fx.lungeE = 1;
    if (e.dmg > 0) {
      fx.pops.push({ x: tx, y: ty, t: 1.1, txt: '-' + Math.round(e.dmg), col: e.to === 'p' ? '#ff6a4a' : '#ffe28a' });
      if (e.to === 'p') { fx.hurtP = 0.4; fx.shake = 5; } else { fx.hurtE = 0.4; fx.shake = 3; stats.hits++; }
      (e.dmg > 10 ? sfx.big : sfx.hit)();
    } else if (e.type === 'block' || e.type === 'parry' || e.type === 'blocked') sfx.block();
    else if (e.type === 'miss') sfx.whoosh();
    if (e.type === 'boost' || e.type === 'backfire') { fx.flash = 0.4; fx.flashCol = '#c080ff'; sfx.purple(); }
    if (e.type === 'tech' && e.who === 'p') { fx.flash = 0.18; fx.flashCol = '#a8d8ff'; }
    if (e.type === 'counter') { fx.flash = 0.2; fx.flashCol = '#ffffff'; }
    if (e.type === 'heal') fx.pops.push({ x: g.hx, y: g.yb - 32, t: 1.1, txt: '+' + Math.round(e.heal || 0), col: '#8aff9a' });
    if (e.fx) spawnFx(e.fx, e.who, g);
    else if (e.dmg > 0) fx.fxs.push({ kind: 'slash', x0: tx, y0: ty, x1: tx, y1: ty, t: 0.35, T: 0.35, who: e.who });
    said = { text: e.text, t: 2 };
  }
  function completeEvents() {
    if (D.over) { finish(D.over.win, false); return; }
    phase = 'choose'; focus = 0; handPage = 0;
    if (!selectedCard()) selected = D.hand[0] ? D.hand[0].uid : 0;
  }

  function finish(win, surrender) {
    if (phase === 'end') return;
    const real = mode === 'ko' || mode === 'survive';
    if (surrender) D.over = { win: false };
    result = { win, mode, enemy: opts.enemy, turns: D.round, surrender: !!surrender, hp: D.P.hp / D.P.hpMax };
    if (real) V.hp = clamp(Math.round(D.P.hp / D.P.hpMax * 100), win ? 1 : 5, 100);
    V.chakra = clamp(Math.round(D.P.ch / D.P.chMax * 100), 0, 100);
    V.fatigue = clamp(Math.round(D.P.fat), 0, 100);
    if (!D.trainingFight) for (const id of D.usedItems || []) G.game.take(id);
    V.battles = (V.battles || 0) + 1; if (win) V.wins = (V.wins || 0) + 1;
    G.train.addXp('tai', 0.6 * stats.hits + 1); G.train.addXp('spd', 0.7 * stats.evades);
    if (stats.techs) { G.train.addXp('nin', 1.2 * stats.techs); V.purple_ctl = Math.min(40, (V.purple_ctl || 0) + 0.4 * stats.techs); }
    for (const [id, n] of Object.entries(D.stats.used)) if (G.TECHS[id]) V['use_' + id] = (V['use_' + id] || 0) + n;
    G.game.advance(5 + 3 * D.round);
    const line = ed.lines && (win ? ed.lines.lose : ed.lines.win);
    say(line ? G.util.fmt(line, { name: G.state.hero.name }) : win ? 'Победа!' : 'Поражение...');
    (win ? sfx.win : sfx.lose)();
    phase = 'end'; endT = 0;
  }

  function spawnFx(id, who, g) {
    const hx = g.hx, ex = g.ex, y = g.yb - 24, from = who === 'p' ? hx : ex, to = who === 'p' ? ex : hx;
    const T = { katon: 0.7, suiton: 0.6, raiton: 0.5, fuuton: 0.6, chakra_shot: 0.5, release: 0.9, kawarimi: 0.6, henge: 0.7, bunshin: 0.7, shunshin: 0.45, fear: 0.7, sexy: 0.8, 'e:dmg': 0.5, 'e:drain': 0.7, 'e:bind': 0.7, 'e:fear': 0.7 }[id] || 0.5;
    fx.fxs.push({ kind: id, x0: from, y0: y, x1: to, y1: y, t: T, T, who });
    if (id === 'release') { fx.flash = 0.3; fx.flashCol = '#c080ff'; }
  }

  function intentLines(intent) {
    if (!intent) return ['Бой завершён', ''];
    if (afterEvents === 'enemy' && phase === 'play') return ['Ответ противника', intent.name];
    const attack = ['strike', 'multi', 'tech', 'drain', 'bind'].includes(intent.kind);
    if (D.E.status.stun > 0) return [intent.name, 'Оглушён: действие будет пропущено'];
    if (attack) {
      let extra = intent.kind === 'drain' ? ' · кража чакры' : intent.kind === 'bind' ? ' · теневая связка' : '';
      return [intent.name + (intent.hits > 1 ? ` · ${intent.hits} удара` : ''), `Ожидаемый урон ${G.duel.expectedIncoming(D)}${extra}`];
    }
    if (intent.kind === 'charge') return ['Замах: готовит тяжёлый приём', 'Сорвать серией тайдзюцу (3 звена)'];
    if (intent.kind === 'block') return [intent.name, `Блок ${Math.round(D.E.block)} · помогут Финт и Футон`];
    if (intent.kind === 'evade') return [intent.name, `Уклон ${Math.round(D.E.dodge * 100)}% · помогут Финт и Чакра`];
    if (intent.kind === 'fear') return [intent.name, 'Иллюзия: −1 карта и −1 действие на следующий ход'];
    return [intent.name, intent.kind === 'idle' ? 'Можно спокойно развить атаку' : 'Враг не атакует в этом ходу'];
  }

  const S = {
    name: 'battle', D,
    touch() { return {}; },
    enter() {
      if (G.state.started && !G.state.battleCheckpoint) G.state.battleCheckpoint = JSON.stringify(Object.assign({}, G.state, { battleCheckpoint: null }));
      say(ed.lines && ed.lines.start ? G.util.fmt(ed.lines.start, { name: G.state.hero.name }) : `${ed.name}! Бой начинается!`);
    },
    // Программный API используется проверками: карта по id/uid или команда end.
    play(ref) { return ref === 'end' ? endPlayerTurn() : playCard(ref); },
    endTurn: endPlayerTurn,
    choose(id) {
      if (phase !== 'choose') return false;
      if (id === 'end' || id === 'quit') { const b = buttons().find((x) => x.id === id); pick(b); return true; }
      const c = D.hand.find((x) => x.id === id || x.id === String(id).replace(/^(tech|item):/, '') || 'uid:' + x.uid === id);
      return c ? playCard(c) : false;
    },
    openMenu() { return phase === 'choose' ? buttons() : null; },
    debugWin() { D.E.hp = 0; D.over = { win: true }; finish(true, false); },
    debugLose() { D.P.hp = 0; D.over = { win: false }; finish(false, false); },
    get phase() { return phase; },
    get state() { return phase === 'choose' ? 'menu' : phase === 'end' ? 'end' : phase; },
    get mini() { return null; },
    buttons,
    update(dt) {
      t += dt; if (phase === 'end') endT += dt;
      fx.shake = Math.max(0, fx.shake - dt * 14); fx.flash = Math.max(0, fx.flash - dt); fx.hurtP = Math.max(0, fx.hurtP - dt); fx.hurtE = Math.max(0, fx.hurtE - dt);
      fx.lungeP = Math.max(0, fx.lungeP - dt * 3); fx.lungeE = Math.max(0, fx.lungeE - dt * 3); fx.aura = Math.max(0, fx.aura - dt);
      for (const f of fx.fxs) f.t -= dt; fx.fxs = fx.fxs.filter((f) => f.t > 0);
      for (const p of fx.pops) { p.t -= dt; p.y -= dt * 14; } fx.pops = fx.pops.filter((p) => p.t > 0);
      if (said) { said.t -= dt; if (said.t <= 0 && phase !== 'end') said = null; }
      if (phase === 'intro') { if (t > 1.1 || I.tapNow || I.pressed('a')) phase = 'choose'; return; }
      if (phase === 'play') { evT -= dt; if (evT <= 0 || ((I.tapNow || I.pressed('a')) && evT < 0.42)) nextEvent(); return; }
      if (phase === 'end') {
        if (endT > 0.8 && (I.pressed('a') || I.pressed('b') || I.tapNow)) {
          AU.sfx.confirm(); G.scenes.pop(); G.state.battleCheckpoint = null;
          onEnd && onEnd(result);
          if (G.state.started) G.storage.save(G.state);
        }
        return;
      }
      const bs = buttons(); if (!bs.length) return;
      focus = clamp(focus, 0, bs.length - 1);
      if (I.tapNow) { const b = bs.find((x) => hit(x, I.tapNow)); if (b) { focus = bs.indexOf(b); pick(b); } return; }
      const move = (d) => { focus = (focus + d + bs.length) % bs.length; if (bs[focus].zone === 'hand') selectCard(D.hand.find((c) => c.uid === bs[focus].uid)); AU.sfx.blip(); };
      if (I.repeat('left', dt)) move(-1); if (I.repeat('right', dt)) move(1);
      if (I.repeat('up', dt) || I.repeat('down', dt)) {
        const hand = bs.map((b, i) => ({ b, i })).filter((x) => x.b.zone === 'hand');
        const actions = bs.map((b, i) => ({ b, i })).filter((x) => x.b.zone === 'action');
        if (bs[focus].zone === 'hand' && actions.length) focus = actions[0].i;
        else if (hand.length) { const i = hand.findIndex((x) => x.b.uid === selected); focus = hand[Math.max(0, i)].i; }
        AU.sfx.blip();
      }
      if (I.pressed('a') && bs[focus]) pick(bs[focus]);
    },

    draw(ctx) {
      const g = geo(), W = g.W, AH = g.AH;
      const sx = fx.shake > 0 ? Math.round(rnd(-fx.shake, fx.shake) * 0.5) : 0;
      ctx.save(); ctx.translate(sx, 0);
      const bg = G.battleBg.get(TERRAIN, W, AH, 30); ctx.drawImage(bg, 0, 0);
      G.battleBg.clouds && G.battleBg.clouds(ctx, TERRAIN, 0, 0, W, AH, t);
      this.drawFighter(ctx, 'p', g); this.drawFighter(ctx, 'e', g); this.drawFx(ctx);
      for (const p of fx.pops) F.draw(ctx, p.txt, Math.round(p.x), Math.round(p.y), { align: 'center', color: p.col, outline: PAL.ink });
      ctx.restore();
      if (fx.flash > 0) { ctx.save(); ctx.globalAlpha = Math.min(0.5, fx.flash * 1.4); ctx.fillStyle = fx.flashCol; ctx.fillRect(0, 0, W, AH); ctx.restore(); }
      this.drawHud(ctx, g); this.drawPanel(ctx, g);
      if (phase === 'intro') {
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, AH / 2 - 24, W, 48);
        F.draw(ctx, ed.name, W / 2, AH / 2 - 15, { align: 'center', color: PAL.yellow || '#ffd23a', outline: PAL.ink });
        FS.draw(ctx, G.ARENAS[TERRAIN] ? G.ARENAS[TERRAIN].name : '', W / 2, AH / 2 + 6, { align: 'center', color: '#f8eed0' });
      }
    },
    drawFx(ctx) {
      for (const f of fx.fxs) {
        const k = 1 - f.t / f.T, dx = f.x1 - f.x0, x = f.x0 + dx * Math.min(1, k * 1.5), y = f.y0, fl = Math.sin(t * 40);
        ctx.save();
        const dot = (px, py, w, col, a) => { w = Math.round(w * 1.7); ctx.globalAlpha = a == null ? 1 : a; ctx.fillStyle = col; ctx.fillRect(Math.round(px - w / 2), Math.round(py - w / 2), w, w); };
        if (f.kind === 'katon') { const r = 4 + k * 10; for (let i = 0; i < 14; i++) dot(x + rnd(-r, r) * 0.6, y + rnd(-r, r) * 0.6, 3 + (i % 3), i % 2 ? '#ff7a2a' : '#ffd23a', 1 - k * 0.4); dot(x, y, r, '#ffe8a0', 0.8); }
        else if (f.kind === 'suiton') { for (let i = 0; i < 8; i++) dot(x - i * 4 * Math.sign(dx), y + Math.sin(k * 12 + i) * 5, 4 - (i > 5 ? 2 : 0), i % 2 ? '#6ab8ff' : '#c8e8ff', 1 - i * 0.08); }
        else if (f.kind === 'raiton') { ctx.strokeStyle = fl > 0 ? '#fff6a0' : '#ffd23a'; ctx.lineWidth = 3; ctx.globalAlpha = 1 - k * 0.5; ctx.beginPath(); ctx.moveTo(f.x1, y - 40); for (let i = 1; i <= 6; i++) ctx.lineTo(f.x1 + rnd(-8, 8), y - 40 + i * 9); ctx.stroke(); }
        else if (f.kind === 'fuuton') { ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.9 - k * 0.5; ctx.beginPath(); ctx.arc(x, y - 10 + i * 10, 12 + i * 3, -1.1, 1.1); ctx.stroke(); } }
        else if (f.kind === 'chakra_shot') { dot(x, y, 8, '#4a9aff'); dot(x, y, 4, '#d8f0ff'); }
        else if (f.kind === 'release') { const w = Math.min(1, k * 2) * Math.abs(dx), lx = Math.min(f.x0, f.x0 + Math.sign(dx) * w); ctx.globalAlpha = 0.85 - k * 0.5; ctx.fillStyle = G.purple.COLOR; ctx.fillRect(lx, y - 6 - fl * 2, w, 12 + fl * 3); ctx.fillStyle = '#f0d8ff'; ctx.fillRect(lx, y - 2, w, 4); }
        else if (f.kind === 'kawarimi') { ctx.globalAlpha = 1 - k * 0.6; ctx.fillStyle = '#7a5230'; ctx.fillRect(f.x0 - 8, y - 20, 16, 44); ctx.fillStyle = '#a07040'; ctx.fillRect(f.x0 - 8, y - 20, 16, 5); for (let i = 0; i < 6; i++) dot(f.x0 + rnd(-14, 14), y + rnd(-10, 14), 4, '#e8e8e8', 0.6 - k * 0.4); }
        else if (f.kind === 'henge') { for (let i = 0; i < 9; i++) dot(f.x0 + rnd(-14, 14), y + rnd(-20, 14), 5, '#e8e8e8', 0.7 - k * 0.5); if (k > 0.4) { ctx.globalAlpha = 0.9; ctx.fillStyle = '#8a8478'; ctx.fillRect(f.x0 - 8, y + 8, 16, 14); ctx.fillStyle = '#a8a298'; ctx.fillRect(f.x0 - 8, y + 8, 16, 4); } }
        else if (f.kind === 'bunshin') { for (let i = 0; i < 8; i++) dot(f.x0 + rnd(-24, 24), y + rnd(-22, 14), 5, '#e8e8e8', 0.6 - k * 0.4); }
        else if (f.kind === 'shunshin') { ctx.globalAlpha = 0.5 * (1 - k); ctx.fillStyle = '#f8f8f8'; ctx.fillRect(Math.min(f.x0, f.x1), y - 18, Math.abs(dx), 4); ctx.fillRect(Math.min(f.x0, f.x1), y, Math.abs(dx), 3); for (let i = 0; i < 6; i++) dot(f.x1 + rnd(-10, 10), y + rnd(-18, 12), 3, '#e8e8e8', 0.8 - k * 0.6); }
        else if (f.kind === 'fear' || f.kind === 'e:fear') { for (let i = 0; i < 10; i++) { const a = t * 6 + i * 0.63; dot(f.x1 + Math.cos(a) * (6 + i * 1.5), y - 20 + Math.sin(a) * (6 + i * 1.5), 3, i % 2 ? '#b080e0' : '#5a3a8a', 0.9 - k * 0.5); } }
        else if (f.kind === 'sexy') { for (let i = 0; i < 12; i++) dot(f.x0 + rnd(-16, 16), y - 6 + rnd(-24, 10), 4, i % 2 ? '#ffb0d0' : '#fff', 0.8 - k * 0.5); for (let i = 0; i < 5; i++) dot(f.x1 + rnd(-10, 10), y - 36 - k * 14, 4, '#ff6a9a', 1 - k); }
        else if (f.kind === 'e:dmg') { ctx.strokeStyle = '#ffe8c8'; ctx.lineWidth = 3; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.moveTo(f.x1 - 14, y - 16); ctx.lineTo(f.x1 + 14, y + 12); ctx.stroke(); }
        else if (f.kind === 'e:drain') { for (let i = 0; i < 8; i++) { const kk = (k * 1.4 + i * 0.12) % 1; dot(f.x1 + (f.x0 - f.x1) * kk, y - 10 + Math.sin(kk * 9 + i) * 6, 4, '#6aa8ff', 0.9); } }
        else if (f.kind === 'e:bind') { ctx.strokeStyle = '#3a2a5a'; ctx.lineWidth = 2; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.moveTo(f.x0, y + 20); ctx.lineTo(f.x0 + dx * Math.min(1, k * 1.6), y + 20); ctx.stroke(); }
        else if (f.kind === 'slash') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.moveTo(f.x1 - 10, y - 12); ctx.lineTo(f.x1 + 10, y + 12); ctx.moveTo(f.x1 - 6, y - 14); ctx.lineTo(f.x1 + 14, y + 6); ctx.stroke(); }
        ctx.restore();
      }
    },
    drawFighter(ctx, side, g) {
      const isP = side === 'p', x0 = isP ? g.hx : g.ex, y = g.yb;
      const lunge = (isP ? fx.lungeP : fx.lungeE) * (isP ? 12 : -12), hurt = isP ? fx.hurtP : fx.hurtE;
      const x = x0 + Math.round(lunge);
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 20, 5, 0, 0, 7); ctx.fill();
      if (hurt > 0 && Math.floor(hurt * 24) % 2 === 0) ctx.globalAlpha = 0.55;
      const id = isP ? 'hero' : ed.spr;
      if (id === 'dummy') {
        ctx.fillStyle = PAL.trunk || '#6a4a30'; ctx.fillRect(x - 2, y - 34, 4, 34); ctx.fillRect(x - 12, y - 28, 24, 4);
        ctx.fillStyle = '#d8c070'; ctx.fillRect(x - 7, y - 44, 14, 12); ctx.fillStyle = PAL.ink; ctx.fillRect(x - 3, y - 40, 2, 2); ctx.fillRect(x + 2, y - 40, 2, 2);
        ctx.fillStyle = '#c8a050'; ctx.fillRect(x - 6, y - 26, 12, 14);
      } else if (id === 'dog') {
        ctx.fillStyle = '#8a6a4a'; ctx.fillRect(x - 10, y - 14, 22, 10); ctx.fillRect(x - 16, y - 20, 10, 9); ctx.fillRect(x - 8, y - 5, 3, 5); ctx.fillRect(x + 7, y - 5, 3, 5);
        ctx.fillStyle = PAL.ink; ctx.fillRect(x - 14, y - 18, 2, 2);
      } else {
        const sheet = G.chars.sheet(id), FW = G.chars.FW, FH = G.chars.FH, row = isP ? 2 : 1, fr = (isP ? fx.lungeP : fx.lungeE) > 0.3 ? 1 : 0;
        ctx.drawImage(sheet, fr * FW, row * FH, FW, FH, Math.round(x - FW * 1.5), Math.round(y - FH * 3 + 3), FW * 3, FH * 3);
      }
      ctx.restore();
      if (isP) {
        const k = Math.max(D.P.heat / 100, fx.aura);
        if (k > 0.05) {
          ctx.save();
          for (let i = 0; i < 5 + Math.round(k * 10); i++) {
            const a = t * 2 + i * 1.9, r = 12 + (i % 3) * 3 + Math.sin(t * 3 + i) * 2, up = (t * 14 + i * 7) % 28;
            ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(t * 4 + i)) * Math.min(1, k + 0.3); ctx.fillStyle = i % 3 === 0 ? '#e0b8ff' : G.purple.COLOR;
            ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y - 4 - up + Math.sin(a) * 4), 2, 2);
          }
          ctx.restore();
        }
      }
      const tags = [];
      if (isP) { if (D.P.clones) tags.push('клоны ' + D.P.clones); if (D.P.status.bind) tags.push('тень'); if (D.P.status.fear) tags.push('страх'); if (D.P.block) tags.push('блок ' + Math.round(D.P.block)); }
      else { if (D.E.status.stun > 0) tags.push('оглушён'); if (D.E.status.fear > 0) tags.push('страх'); if (D.E.status.wet > 0) tags.push('мокрый'); if (D.E.status.burn > 0) tags.push('горит'); if (D.E.status.mark > 0) tags.push('метка'); }
      tags.slice(0, 2).forEach((s, i) => FS.draw(ctx, s, x, Math.max(53, y - 62 + i * 9), { align: 'center', color: '#fff2cf', outline: PAL.ink }));
    },
    drawHud(ctx, g) {
      const W = g.W, bw = Math.floor(W / 2) - 12;
      const bar = (x, y, w, v, max, col) => U.gauge(ctx, x, y, w, 5, clamp(v / Math.max(1, max), 0, 1), col);
      FS.draw(ctx, G.state.hero.name || 'Герой', 6, 5, { color: '#f8eed0', outline: PAL.ink, maxW: bw });
      bar(6, 16, bw, D.P.hp, D.P.hpMax, C.hp); bar(6, 24, bw, D.P.ch, D.P.chMax, C.chakra); bar(6, 32, bw, D.P.fat, 100, C.fatigue); bar(6, 40, bw, D.P.heat, 100, '#e0a8ff');
      FS.draw(ctx, `${Math.round(D.P.hp)}/${D.P.hpMax}`, 8 + bw, 14, { align: 'right', color: '#f8eed0', outline: PAL.ink });
      FS.draw(ctx, 'уст. · накал', 6, 47, { color: '#d8c8a0', outline: PAL.ink });
      FS.draw(ctx, ed.name, W - 6, 5, { align: 'right', color: '#f8eed0', outline: PAL.ink, maxW: bw });
      bar(W - 6 - bw, 16, bw, D.E.hp, D.E.hpMax, C.hp); if (D.E.chMax) bar(W - 6 - bw, 24, bw, D.E.ch, D.E.chMax, C.chakra);
      if (mode === 'survive') FS.draw(ctx, `Ход ${D.round}/${D.rounds}`, W - 6, 34, { align: 'right', color: '#ffe28a', outline: PAL.ink });
      else if (mode === 'spar') FS.draw(ctx, 'до 30% здоровья', W - 6, 34, { align: 'right', color: '#d8c8a0', outline: PAL.ink });
    },
    drawPanel(ctx, g) {
      const W = g.W, py = g.py;
      U.panel(ctx, 0, py, W, g.PH, 'plank');
      const lines = intentLines(phase === 'play' && afterEvents === 'enemy' ? lastIntent : D.intent);
      FS.draw(ctx, lines[0], 7, py + 5, { color: '#ffe28a', shadow: PAL.ink, maxW: W - 14 });
      FS.draw(ctx, lines[1], 7, py + 16, { color: '#f8eed0', shadow: PAL.ink, maxW: W - 14 });
      FS.draw(ctx, `Ход ${D.round} · действия ${D.P.ap}/3`, 7, py + 29, { color: '#d8c8a0', maxW: Math.floor(W * 0.55) });
      FS.draw(ctx, `Колода ${D.deck.length} · сброс ${D.discard.length}`, W - 7, py + 29, { align: 'right', color: '#d8c8a0', maxW: Math.floor(W * 0.45) });
      if (phase === 'end') {
        F.draw(ctx, result.win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ', W / 2, py + 58, { align: 'center', color: result.win ? '#8ae070' : '#ff6a4a', shadow: PAL.ink });
        FS.draw(ctx, `Ходов ${result.turns} · карт ${D.stats.cards} · урона ${Math.round(D.stats.damage)}`, W / 2, py + 79, { align: 'center', color: '#e8c890', maxW: W - 16 });
        if (endT > 0.8) FS.draw(ctx, 'Коснись, чтобы продолжить', W / 2, py + 99, { align: 'center', color: Math.sin(endT * 6) > 0 ? '#ffe28a' : '#d8c8a0' });
        return;
      }
      if (phase === 'play' && said) {
        FS.wrap(said.text, W - 18).slice(0, 3).forEach((ln, i) => FS.draw(ctx, ln, 9, py + 45 + i * 11, { color: '#f8eed0', shadow: PAL.ink }));
        return;
      }
      if (tip) {
        ['Три действия — до трёх карт за ход.', 'Намерение врага видно заранее.', 'Коснись карты, затем «Играть».', 'Порядок карт создаёт связки.'].forEach((ln, i) => FS.draw(ctx, ln, 9, py + 43 + i * 10, { color: i === 3 ? '#ffe28a' : '#f8eed0' }));
      } else {
        const c = selectedCard();
        if (c) {
          const def = G.CARDS[c.id], check = G.duel.canPlay(D, c);
          FS.draw(ctx, `${def.name} · ${def.cost} чакры`, 8, py + 42, { color: check.ok ? '#ffe28a' : '#ff9a80', maxW: W - 16 });
          const preview = G.duel.preview(D, c.id).join(' · ');
          const description = preview + '. ' + def.text;
          FS.wrap(description, W - 18).slice(0, 3).forEach((ln, i) => FS.draw(ctx, ln, 9, py + 53 + i * 9, { color: '#f8eed0' }));
          if (!check.ok) FS.draw(ctx, check.why, W - 8, py + 42, { align: 'right', color: '#ff9a80', maxW: Math.floor(W * 0.48) });
        }
      }
      const bs = buttons();
      for (const b of bs) {
        if (b.zone === 'hand') {
          const c = D.hand.find((x) => x.uid === b.uid), def = G.CARDS[c.id], check = G.duel.canPlay(D, c), sel = c.uid === selected;
          U.button(ctx, b.x, b.y, b.w, b.h, '', sel ? 'sel' : check.ok ? 'normal' : 'dis');
          ctx.fillStyle = cardColor(def.kind); ctx.fillRect(b.x + 2, b.y + 2, 3, b.h - 4);
          FS.draw(ctx, def.cost ? String(def.cost) : '0', b.x + b.w - 3, b.y + 3, { align: 'right', color: check.ok ? '#ffe28a' : '#8a7a66' });
          const nameLines = FS.wrap(def.name, b.w - 8).slice(0, 2);
          nameLines.forEach((ln, i) => FS.draw(ctx, ln, b.x + b.w / 2 + 1, b.y + 13 + i * 9, { align: 'center', color: check.ok ? '#f8eed0' : '#8a7a66', maxW: b.w - 7 }));
          if (def.exhaust) FS.draw(ctx, '×', b.x + 5, b.y + b.h - 9, { color: '#d8c8a0' });
        } else {
          const i = bs.indexOf(b);
          U.button(ctx, b.x, b.y, b.w, b.h, '', b.off ? 'dis' : i === focus ? 'sel' : 'normal');
          FS.draw(ctx, b.label, b.x + b.w / 2, b.y + Math.round(b.h / 2) - 4, { align: 'center', color: b.off ? '#8a7a66' : '#f8eed0', shadow: PAL.ink, maxW: b.w - 4 });
        }
      }
      if (pageCount() > 1) FS.draw(ctx, `${handPage + 1}/${pageCount()}`, W / 2, g.handY - 9, { align: 'center', color: '#ffe28a', shadow: PAL.ink });
    },
  };
  return S;
});

// Мастерство техники в меню и тренировках использует G.combat (data/duel_data.js).
// Запуск боя из скрипта: call battle <enemy> <mode> <terrain> [после_победы] [после_поражения] [turns]
G.script.actions.battle = (a) => {
  G.game.pending = { type: 'battle', enemy: a[0], mode: a[1] || 'ko', terrain: a[2] || 'field', win: a[3] && a[3] !== '-' ? a[3] : null, lose: a[4] && a[4] !== '-' ? a[4] : null, turns: a[5] ? Number(a[5]) : 0 };
};
