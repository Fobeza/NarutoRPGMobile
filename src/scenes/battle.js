// Экран боя «Дуэль» (правила — systems/duel.js, docs/COMBAT.md).
// opts: { enemy, mode: ko|spar|survive, terrain, turns, ... }. onEnd(result) — result: { win, mode, enemy, turns, surrender }.
// Фазы: intro → choose (меню) → mini (кольцо тайминга или печати) → play (анимация исходов) → choose … → end.
G.scenes.register('battle', (opts, onEnd) => {
  const F = G.font, AU = G.audio, U = G.ui, C = U.C, FS = F.small, PAL = G.PAL, I = G.input;
  const V = G.state.vars, mode = opts.mode || 'ko';
  const ed = G.ENEMIES[opts.enemy] || G.ENEMIES.dummy;
  const techs = Object.keys(G.TECHS).filter((t) => G.combat.knows(t));
  const stock = () => ({ bandage: G.game.count('bandage'), chakra_pill: G.game.count('chakra_pill'), smoke_bomb: G.game.count('smoke_bomb'), flash_bomb: G.game.count('flash_bomb') });
  const D = G.duel.create({ enemy: opts.enemy, mode, rounds: opts.turns, techs, hp: V.hp, chakra: V.chakra, fatigue: V.fatigue, inv: stock(), day: V.day });
  const ITEMS = [['bandage', 'Бинт', '+25% здоровья'], ['chakra_pill', 'Пилюля чакры', '+50% чакры'], ['smoke_bomb', 'Дымовая бомба', 'враг промахнётся'], ['flash_bomb', 'Вспышка', 'враг ослеплён']];
  const ACT_NAME = { strike: 'Удар', block: 'Блок', evade: 'Уклон', tech: 'Приём', idle: 'Ждёт' };
  const TERRAIN = opts.terrain || (mode === 'spar' ? 'field' : 'field');
  let phase = 'intro', t = 0, menu = 'main', focus = 0, mini = null, ev = [], evI = 0, evT = 0, result = null, endT = 0, said = null;
  const fx = { shake: 0, flash: 0, flashCol: '#fff', pops: [], fxs: [], hurtP: 0, hurtE: 0, lungeP: 0, lungeE: 0, aura: 0 };
  let stats = { hits: 0, evades: 0, techs: 0 };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const slow = () => (G.storage.settings.reactSlow ? 1.45 : 1);
  const hit = (b, p) => p && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  const sfx = {
    hit() { AU.noise(0.08, 0.25); AU.tone(140, 0.08, 'square', 0.12, 60); },
    big() { AU.noise(0.2, 0.3); AU.tone(110, 0.2, 'sawtooth', 0.15, 40); },
    block() { AU.tone(1400, 0.06, 'square', 0.1); AU.tone(1900, 0.1, 'triangle', 0.08, null, 0.04); },
    whoosh() { AU.noise(0.12, 0.08); AU.tone(900, 0.1, 'triangle', 0.05, 300); },
    seal() { AU.tone(520 + Math.random() * 200, 0.04, 'square', 0.08); },
    purple() { AU.tone(300, 0.3, 'sawtooth', 0.12, 900); AU.noise(0.2, 0.15); },
    win() { [523, 659, 784, 1046].forEach((f, i) => AU.tone(f, 0.15, 'square', 0.1, null, i * 0.12)); },
    lose() { [392, 330, 262].forEach((f, i) => AU.tone(f, 0.25, 'triangle', 0.12, null, i * 0.2)); },
  };

  // ── геометрия ──
  // Кнопки не меньше 44 CSS px: минимальная высота в логических px зависит от масштаба экрана
  const uiScale = () => { try { const r = G.screen.canvas.getBoundingClientRect(); return r.width > 0 ? r.width / G.screen.W : 1.34; } catch (_) { return 1.34; } };
  const dims = () => { const mh = Math.ceil(44 / uiScale()); return { mh, bh: Math.max(34, mh), sh: Math.max(26, mh), th: Math.max(30, mh) }; };
  const geo = () => {
    const W = G.screen.W, H = G.screen.H, d = dims();
    const main = 46 + 2 * (d.bh + 4) + d.sh + 10, list = 40 + 4 * (d.th + 4) + 6, PH = Math.min(Math.round(H * 0.5), Math.max(main, list));
    const AH = H - PH;
    return { W, H, AH, PH, d, yb: AH - 38, hx: Math.round(W * 0.27), ex: Math.round(W * 0.73), py: H - PH };
  };

  // ── кнопки текущего меню ──
  function buttons() {
    const g = geo(), W = g.W, out = [], pad = 8, bw = Math.floor((W - pad * 3) / 2), y0 = g.py + 46, d = g.d;
    if (menu === 'main') {
      const opt = G.duel.options(D), tech = opt.find((o) => o.id === 'tech'), rel = opt.find((o) => o.id === 'release');
      const mk = (i, id, label, sub, off) => ({ id, label, sub, off, x: pad + (i % 2) * (bw + pad), y: y0 + Math.floor(i / 2) * (d.bh + 4), w: bw, h: d.bh });
      out.push(mk(0, 'strike', 'Удар', 'тайминг', null), mk(1, 'block', 'Блок', 'тайминг', null), mk(2, 'evade', 'Уклон', 'тайминг', null),
        mk(3, 'tech', 'Приём', techs.length ? 'печати' : 'нет техник', techs.length ? null : 'Пока нет изученных техник'));
      const sw = Math.floor((W - pad * 4) / 3), sy = y0 + 2 * (d.bh + 4);
      out.push({ id: 'release', label: 'Выброс', sub: rel.off ? '' : 'накал!', off: rel.off, x: pad, y: sy, w: sw, h: d.sh },
        { id: 'item', label: 'Предмет', off: null, x: pad * 2 + sw, y: sy, w: sw, h: d.sh },
        { id: 'quit', label: 'Сдаться', off: null, x: pad * 3 + sw * 2, y: sy, w: sw, h: d.sh });
    } else if (menu === 'tech') {
      techs.slice(0, 6).forEach((id, i) => {
        const T = G.TECHS[id], off = D.P.ch < T.ch ? 'Мало чакры' : null;
        out.push({ id: 'tech:' + id, label: T.name, sub: T.ch + ' ч', off, x: pad + (i % 2) * (bw + pad), y: g.py + 40 + Math.floor(i / 2) * (d.th + 4), w: bw, h: d.th, tech: id });
      });
      out.push({ id: 'back', label: 'Назад', x: pad, y: g.py + 40 + Math.ceil(Math.min(6, techs.length) / 2) * (d.th + 4), w: W - pad * 2, h: d.th });
    } else if (menu === 'item') {
      const st = D.inv;
      ITEMS.forEach(([id, name, sub], i) => out.push({ id: 'item:' + id, label: name, sub: 'x' + (st[id] || 0), off: (st[id] || 0) < 1 ? 'Нет в сумке' : null, x: pad + (i % 2) * (bw + pad), y: g.py + 40 + Math.floor(i / 2) * (d.th + 4), w: bw, h: d.th, desc: sub }));
      out.push({ id: 'back', label: 'Назад', x: pad, y: g.py + 40 + Math.ceil(ITEMS.length / 2) * (d.th + 4), w: W - pad * 2, h: d.th });
    }
    return out;
  }

  // ── выбор действия ──
  function pick(b) {
    if (b.off) { AU.sfx.error(); say(b.off); return; }
    AU.sfx.select();
    if (b.id === 'tech') { menu = 'tech'; focus = 0; return; }
    if (b.id === 'item') { menu = 'item'; focus = 0; return; }
    if (b.id === 'back') { menu = 'main'; focus = 0; return; }
    if (b.id === 'quit') { finish(false, true); return; }
    if (b.id.startsWith('item:')) { begin(b.id, null); return; }
    begin(b.id, null);
  }
  // запускает мини-игру для действия или сразу раунд (предмет)
  function begin(act, q) {
    menu = 'main';
    if (act.startsWith('item:') || q != null) { runRound(act, q != null ? q : 0.5); return; }
    if (act.startsWith('tech:')) {
      const T = G.TECHS[act.slice(5)], seq = T.seals.slice(), pal = seq.slice();
      while (pal.length < Math.min(6, seq.length + 3)) { const s = Math.floor(Math.random() * 12); if (!pal.includes(s)) pal.push(s); }
      pal.sort(() => Math.random() - 0.5);
      const limit = (1.6 + 0.9 * seq.length + (D.has('fast_hands') ? 1.5 : 0) + D.P.st('ctrl') * 0.1) * slow();
      mini = { kind: 'seals', act, seq, pal, i: 0, errs: 0, t: 0, limit, shake: 0 };
    } else {
      const w = G.duel.window(D) * (act === 'release' ? 0.7 : 1), T = 1.0 * slow();
      mini = { kind: 'ring', act, t: 0, T, tp: 0.8 * T, half: (0.1 + 0.5 * w) * T };
    }
    phase = 'mini';
  }
  function say(text) { said = { text, t: 2.2 }; }

  function runRound(act, q) {
    mini = null;
    ev = G.duel.play(D, act, q); evI = 0; evT = 0; phase = 'play';
    if (act.startsWith('item:')) G.audio.sfx.confirm();
    if (act.startsWith('tech:')) stats.techs++;
    if (act === 'release') { stats.techs++; fx.aura = 1.2; sfx.purple(); }
    if (act === 'evade') stats.evades++;
    nextEvent();
  }
  function nextEvent() {
    if (evI >= ev.length) { endRound(); return; }
    const e = ev[evI++]; evT = 0.75;
    const g = geo(), tx = e.to === 'p' ? g.hx : g.ex, ty = g.yb - 28;
    if (e.who === 'p') fx.lungeP = 1; else fx.lungeE = 1;
    if (e.dmg > 0) {
      fx.pops.push({ x: tx, y: ty, t: 1.1, txt: '-' + Math.round(e.dmg), col: e.to === 'p' ? '#ff6a4a' : '#ffe28a' });
      if (e.to === 'p') { fx.hurtP = 0.4; fx.shake = 5; } else { fx.hurtE = 0.4; fx.shake = 3; stats.hits++; }
      (e.dmg > 10 ? sfx.big : sfx.hit)();
    } else if (e.type === 'block' || e.type === 'parry') sfx.block();
    else if (e.type === 'miss') sfx.whoosh();
    if (e.type === 'boost' || e.type === 'backfire') { fx.flash = 0.4; fx.flashCol = '#c080ff'; sfx.purple(); }
    if (e.type === 'tech' && e.who === 'p') { fx.flash = 0.18; fx.flashCol = '#a8d8ff'; }
    if (e.type === 'parry') { fx.flash = 0.2; fx.flashCol = '#ffffff'; }
    if (e.type === 'heal') fx.pops.push({ x: g.hx, y: g.yb - 36, t: 1.1, txt: '+', col: '#8aff9a' });
    if (e.fx) spawnFx(e.fx, e.who, g);
    else if (e.dmg > 0) fx.fxs.push({ kind: 'slash', x0: tx, y0: ty, x1: tx, y1: ty, t: 0.35, T: 0.35, who: e.who });
    said = { text: e.text, t: 2 };
  }
  // визуальные эффекты техник: снаряды, вспышки, дым (рисует drawFx)
  function spawnFx(id, who, g) {
    const hx = g.hx, ex = g.ex, y = g.yb - 28, from = who === 'p' ? hx : ex, to = who === 'p' ? ex : hx;
    const T = { katon: 0.7, suiton: 0.6, raiton: 0.5, fuuton: 0.6, chakra_shot: 0.5, release: 0.9, kawarimi: 0.6, henge: 0.7, bunshin: 0.7, shunshin: 0.45, fear: 0.7, sexy: 0.8, 'e:dmg': 0.5, 'e:drain': 0.7, 'e:bind': 0.7, 'e:fear': 0.7 }[id] || 0.5;
    fx.fxs.push({ kind: id, x0: from, y0: y, x1: to, y1: y, t: T, T, who });
    if (id === 'release') { fx.flash = 0.3; fx.flashCol = '#c080ff'; }
  }
  function endRound() {
    if (D.over) { finish(D.over.win, false); return; }
    phase = 'choose'; menu = 'main'; focus = 0;
  }

  // ── конец боя ──
  function finish(win, surrender) {
    if (phase === 'end') return;
    const real = mode === 'ko' || mode === 'survive';
    if (surrender) { D.over = { win: false }; D.P.hp = real ? D.P.hp : D.P.hp; }
    result = { win, mode, enemy: opts.enemy, turns: D.round, surrender: !!surrender, hp: D.P.hp / D.P.hpMax };
    // итоги в состоянии игры
    if (real) V.hp = clamp(Math.round(D.P.hp / D.P.hpMax * 100), win ? 1 : 5, 100);
    V.chakra = clamp(Math.round(D.P.ch / D.P.chMax * 100), 0, 100);
    V.fatigue = clamp(Math.round(D.P.fat), 0, 100);
    if (!D.trainingFight) for (const id of D.usedItems || []) G.game.take(id);
    V.battles = (V.battles || 0) + 1; if (win) V.wins = (V.wins || 0) + 1;
    G.train.addXp('tai', 0.6 * stats.hits + 1); G.train.addXp('spd', 0.7 * stats.evades);
    if (stats.techs) { G.train.addXp('nin', 1.2 * stats.techs); G.state.vars.purple_ctl = Math.min(40, (V.purple_ctl || 0) + 0.4 * stats.techs); }
    for (const [act, n] of Object.entries(D.stats.used)) if (act.startsWith('tech:')) V['use_' + act.slice(5)] = (V['use_' + act.slice(5)] || 0) + n;
    G.game.advance(5 + 3 * D.round);
    const line = ed.lines && (win ? ed.lines.lose : ed.lines.win);
    say(line ? G.util.fmt(line, { name: G.state.hero.name }) : win ? 'Победа!' : 'Поражение...');
    (win ? sfx.win : sfx.lose)();
    phase = 'end'; endT = 0;
  }

  // ── сцена ──
  const S = {
    name: 'battle',
    D,   // для тестов и отладки
    touch() { return {}; },
    enter() {
      if (G.state.started && !G.state.battleCheckpoint) G.state.battleCheckpoint = JSON.stringify(Object.assign({}, G.state, { battleCheckpoint: null }));
      say(`${ed.name}! Бой начинается!`);
      if (ed.lines && ed.lines.start) say(G.util.fmt(ed.lines.start, { name: G.state.hero.name }));
    },
    // для автотестов: сыграть раунд сразу с качеством q
    play(act, q = 0.5) { if (phase !== 'choose') return false; runRound(act, q); return true; },
    // для автотестов: выбрать пункт меню по id (как нажатием), с открытием нужного подменю
    choose(id) { if (phase !== 'choose') return false; menu = id.startsWith('tech:') ? 'tech' : id.startsWith('item:') ? 'item' : 'main'; const b = buttons().find((x) => x.id === id); if (!b) return false; pick(b); return true; },
    // для автотестов: показать меню (main|tech|item) и вернуть его кнопки
    openMenu(m) { if (phase !== 'choose') return null; menu = m; focus = 0; return buttons(); },
    get mini() { return mini; },
    sealPalette() { return mini && mini.kind === 'seals' ? mini.pal.slice() : null; },
    debugWin() { D.E.hp = 0; D.over = { win: true }; finish(true, false); },
    debugLose() { D.P.hp = 0; D.over = { win: false }; finish(false, false); },
    get phase() { return phase; },
    get state() { return phase === 'choose' ? 'menu' : phase === 'end' ? 'end' : phase; },
    buttons,
    update(dt) {
      t += dt; endT += dt;
      fx.shake = Math.max(0, fx.shake - dt * 14); fx.flash = Math.max(0, fx.flash - dt); fx.hurtP = Math.max(0, fx.hurtP - dt); fx.hurtE = Math.max(0, fx.hurtE - dt);
      fx.lungeP = Math.max(0, fx.lungeP - dt * 3); fx.lungeE = Math.max(0, fx.lungeE - dt * 3); fx.aura = Math.max(0, fx.aura - dt);
      for (const f of fx.fxs) f.t -= dt; fx.fxs = fx.fxs.filter((f) => f.t > 0);
      for (const p of fx.pops) { p.t -= dt; p.y -= dt * 14; } fx.pops = fx.pops.filter((p) => p.t > 0);
      if (said) { said.t -= dt; if (said.t <= 0 && phase !== 'end') said = null; }
      if (phase === 'intro') { if (t > 1.4 || I.tapNow || I.pressed('a')) { phase = 'choose'; } return; }
      if (phase === 'play') { evT -= dt; if (evT <= 0 || ((I.tapNow || I.pressed('a')) && evT < 0.45)) nextEvent(); return; }
      if (phase === 'end') {
        if (endT > 1.0 && (I.pressed('a') || I.pressed('b') || I.tapNow)) {
          AU.sfx.confirm(); G.scenes.pop(); G.state.battleCheckpoint = null;
          onEnd && onEnd(result);
          if (G.state.started) G.storage.save(G.state);
        }
        return;
      }
      if (phase === 'mini') return this.updateMini(dt);
      // choose: клавиши и касания
      const bs = buttons();
      if (I.tapNow) { const b = bs.find((x) => hit(x, I.tapNow)); if (b) { focus = bs.indexOf(b); pick(b); } return; }
      if (I.pressed('b') && menu !== 'main') { menu = 'main'; focus = 0; AU.sfx.cancel(); return; }
      const move = (d) => { focus = (focus + d + bs.length) % bs.length; AU.sfx.blip(); };
      if (I.repeat('left', dt)) move(-1); if (I.repeat('right', dt)) move(1);
      if (I.repeat('up', dt)) { menu === 'main' ? (focus = focus >= 2 ? focus - 2 : focus) : move(-1); } if (I.repeat('down', dt)) { menu === 'main' ? (focus = focus < 4 ? Math.min(bs.length - 1, focus + 2) : focus) : move(1); }
      if (I.pressed('a') && bs[focus]) pick(bs[focus]);
    },
    updateMini(dt) {
      const m = mini, tap = I.tapNow, a = I.pressed('a');
      m.t += dt; m.shake = Math.max(0, (m.shake || 0) - dt * 10);
      if (m.kind === 'ring') {
        if (a || tap) { const q = clamp(1 - Math.abs(m.t - m.tp) / m.half, 0, 1); if (q > 0.8) { sfx.seal(); } runRound(m.act, m.t < m.T * 0.1 ? 0.3 : q); return; }
        if (m.t > m.T * 1.3) runRound(m.act, 0.15);
        return;
      }
      // печати
      const g = geo(), btns = sealButtons(g);
      let choice = -1;
      if (tap) { const b = btns.find((x) => hit(x, tap)); if (b) choice = b.seal; }
      else { const n = btns.length; if (I.repeat('left', dt)) m.f = ((m.f || 0) + n - 1) % n; if (I.repeat('right', dt)) m.f = ((m.f || 0) + 1) % n; if (a) choice = btns[m.f || 0].seal; }
      if (choice >= 0) {
        if (choice === m.seq[m.i]) { m.i++; sfx.seal(); } else { m.errs++; m.shake = 1; AU.sfx.error(); }
        if (m.i >= m.seq.length) { const q = clamp(0.55 + 0.45 * (1 - m.t / m.limit) - 0.12 * m.errs, 0.2, 1); runRound(m.act, q); return; }
      }
      if (m.t > m.limit) runRound(m.act, 0.1);
    },

    // ── отрисовка ──
    draw(ctx) {
      const g = geo(), W = g.W, H = g.H, AH = g.AH;
      const sx = fx.shake > 0 ? Math.round(rnd(-fx.shake, fx.shake) * 0.5) : 0;
      ctx.save(); ctx.translate(sx, 0);
      // арена
      const bg = G.battleBg.get(TERRAIN, W, AH, 30); ctx.drawImage(bg, 0, 0);
      G.battleBg.clouds && G.battleBg.clouds(ctx, TERRAIN, 0, 0, W, AH, t);
      this.drawFighter(ctx, 'p', g); this.drawFighter(ctx, 'e', g);
      this.drawFx(ctx);
      if (phase === 'choose' && D.hint) this.drawHint(ctx, g);
      // всплывающие числа
      for (const p of fx.pops) F.draw(ctx, p.txt, Math.round(p.x), Math.round(p.y), { align: 'center', color: p.col, outline: PAL.ink });
      ctx.restore();
      if (fx.flash > 0) { ctx.save(); ctx.globalAlpha = Math.min(0.5, fx.flash * 1.4); ctx.fillStyle = fx.flashCol; ctx.fillRect(0, 0, W, AH); ctx.restore(); }
      this.drawHud(ctx, g);
      this.drawPanel(ctx, g);
      if (phase === 'mini') this.drawMini(ctx, g);
      if (phase === 'intro') {
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, AH / 2 - 26, W, 52);
        F.draw(ctx, ed.name, W / 2, AH / 2 - 16, { align: 'center', color: PAL.yellow || '#ffd23a', outline: PAL.ink });
        FS.draw(ctx, G.ARENAS[TERRAIN] ? G.ARENAS[TERRAIN].name : '', W / 2, AH / 2 + 6, { align: 'center', color: '#f8eed0' });
      }
    },
    // пузырь над врагом: что он, похоже, сделает (точность — в строке панели)
    drawHint(ctx, g) {
      const x = g.ex, y = g.yb - 84, col = { strike: '#ff8a6a', block: '#8ab8ff', evade: '#8aff9a', tech: '#d8a0ff', idle: '#d8c8a0' }[D.hint] || '#fff';
      const bob = Math.round(Math.sin(t * 4) * 1.5);
      ctx.fillStyle = PAL.ink; ctx.fillRect(x - 21, y - 8 + bob, 42, 15); ctx.fillRect(x - 3, y + 7 + bob, 6, 4);
      ctx.fillStyle = '#fff6dc'; ctx.fillRect(x - 20, y - 7 + bob, 40, 13); ctx.fillRect(x - 2, y + 6 + bob, 4, 3);
      FS.draw(ctx, '? ' + (ACT_NAME[D.hint] || '?'), x, y - 4 + bob, { align: 'center', color: '#2e1e14' });
      ctx.fillStyle = col; ctx.fillRect(x - 20, y + 5 + bob, 40, 1);
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
      const lunge = (isP ? fx.lungeP : fx.lungeE) * (isP ? 16 : -16), hurt = isP ? fx.hurtP : fx.hurtE;
      const x = x0 + Math.round(lunge);
      ctx.save();
      // тень
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 20, 5, 0, 0, 7); ctx.fill();
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
        ctx.drawImage(sheet, fr * FW, row * FH, FW, FH, Math.round(x - FW * 1.5), Math.round(y - FH * 3 + 3), FW * 3, FH * 3);   // персонаж ×3
      }
      ctx.restore();
      // фиолетовая аура героя: накал и выбросы
      if (isP) {
        const k = Math.max(D.P.heat / 100, fx.aura);
        if (k > 0.05) {
          ctx.save();
          for (let i = 0; i < 5 + Math.round(k * 10); i++) {
            const a = t * 2 + i * 1.9, r = 12 + (i % 3) * 3 + Math.sin(t * 3 + i) * 2, up = (t * 14 + i * 7) % 28;
            ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(t * 4 + i)) * Math.min(1, k + 0.3);
            ctx.fillStyle = i % 3 === 0 ? '#e0b8ff' : G.purple.COLOR;
            ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y - 4 - up + Math.sin(a) * 4), 2, 2);
          }
          ctx.restore();
        }
      }
      // ярлык статусов
      const f = isP ? D.P : D.E, tags = [];
      if (isP) { if (D.P.clones) tags.push('клоны ' + D.P.clones); if (D.P.status.bind) tags.push('тень'); if (D.P.status.fear) tags.push('страх'); if (D.P.status.smoke) tags.push('дым'); }
      else { if (D.E.status.stun > 0) tags.push('оглушён'); if (D.E.status.fear > 0) tags.push('страх'); if (D.E.status.wet > 0) tags.push('мокрый'); }
      tags.forEach((s, i) => FS.draw(ctx, s, x, y - 78 - i * 9, { align: 'center', color: '#fff2cf', outline: PAL.ink }));
    },
    drawHud(ctx, g) {
      const W = g.W, bw = Math.floor(W / 2) - 14;
      const bar = (x, y, w, v, max, col) => U.gauge(ctx, x, y, w, 5, clamp(v / Math.max(1, max), 0, 1), col);
      // герой слева
      FS.draw(ctx, G.state.hero.name || 'Герой', 8, 6, { color: '#f8eed0', outline: PAL.ink, maxW: bw });
      bar(8, 18, bw, D.P.hp, D.P.hpMax, C.hp); bar(8, 26, bw, D.P.ch, D.P.chMax, C.chakra); bar(8, 34, bw, D.P.fat, 100, C.fatigue); bar(8, 42, bw, D.P.heat, 100, '#e0a8ff');
      FS.draw(ctx, `${Math.round(D.P.hp)}/${D.P.hpMax}`, 10 + bw, 15, { align: 'right', color: '#f8eed0', outline: PAL.ink });
      FS.draw(ctx, 'усталость · накал', 8, 49, { color: '#d8c8a0', outline: PAL.ink });
      // противник справа
      FS.draw(ctx, ed.name, W - 8, 6, { align: 'right', color: '#f8eed0', outline: PAL.ink, maxW: bw });
      bar(W - 8 - bw, 18, bw, D.E.hp, D.E.hpMax, C.hp); if (D.E.chMax) bar(W - 8 - bw, 26, bw, D.E.ch, D.E.chMax, C.chakra);
      if (mode === 'survive') FS.draw(ctx, `Раунд ${D.round}/${D.rounds}`, W - 8, 34, { align: 'right', color: '#ffe28a', outline: PAL.ink });
      else if (mode === 'spar') FS.draw(ctx, 'до 30% здоровья', W - 8, 34, { align: 'right', color: '#d8c8a0', outline: PAL.ink });
    },
    drawPanel(ctx, g) {
      const W = g.W, py = g.py;
      U.panel(ctx, 0, py, W, g.PH, 'plank');
      // строка подсказки: намёк противника или реплика
      let line = '', col = '#f8eed0';
      if (phase === 'choose' && D.hint) {
        const acc = Math.round(G.duel.hintAccuracy(D) * 100);
        line = `Намёк: ${ACT_NAME[D.hint] || '?'}  (верен ≈${acc}%)`; col = '#ffe28a';
      } else if (said) line = said.text;
      for (const [i, ln] of FS.wrap(line, W - 20).slice(0, 2).entries()) FS.draw(ctx, ln, 10, py + 8 + i * 11, { color: col, shadow: PAL.ink });
      if (phase === 'choose') {
        const bs = buttons();
        bs.forEach((b, i) => {
          U.button(ctx, b.x, b.y, b.w, b.h, '', b.off ? 'dis' : i === focus ? 'sel' : 'normal');
          F.small.draw(ctx, b.label, b.x + (menu !== 'main' && b.sub ? b.w * 0.36 : b.w / 2), b.y + (b.sub && menu === 'main' && b.h > 30 ? 8 : Math.round(b.h / 2) - 4), { align: 'center', color: b.off ? '#8a7a66' : '#f8eed0', shadow: PAL.ink });
          if (b.sub && b.h > 26) FS.draw(ctx, b.sub, b.x + b.w / 2, b.y + 21, { align: 'center', color: b.off ? '#6a5a4a' : '#e8c890' });
          else if (b.sub && menu !== 'main') FS.draw(ctx, b.sub, b.x + b.w - 6, b.y + Math.round(b.h / 2) - 4, { align: 'right', color: b.off ? '#6a5a4a' : '#e8c890' });
        });
      } else if (phase === 'end') {
        F.draw(ctx, result.win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ', W / 2, py + 62, { align: 'center', color: result.win ? '#8ae070' : '#ff6a4a', shadow: PAL.ink });
        FS.draw(ctx, `Раундов ${result.turns} · ударов ${stats.hits} · уклонов ${stats.evades} · приёмов ${stats.techs}`, W / 2, py + 80, { align: 'center', color: '#e8c890' });
        if (endT > 1) FS.draw(ctx, 'Коснись, чтобы продолжить', W / 2, py + 98, { align: 'center', color: Math.sin(endT * 6) > 0 ? '#ffe28a' : '#d8c8a0' });
      }
    },
    drawMini(ctx, g) {
      const m = mini, W = g.W, cx = Math.round(W / 2), cy = g.AH - 76;
      if (m.kind === 'ring') {
        const T = m.T, k = clamp(m.t / T, 0, 1.3), r0 = 16, r = 16 + (1 - Math.min(1, m.t / m.tp)) * 38;
        const q = clamp(1 - Math.abs(m.t - m.tp) / m.half, 0, 1);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r0, 0, 7); ctx.stroke();
        ctx.strokeStyle = q > 0.8 ? '#8aff9a' : q > 0.35 ? '#ffe28a' : '#ff8a6a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, Math.max(r0 - 4, r), 0, 7); ctx.stroke();
        ctx.restore();
        FS.draw(ctx, m.act === 'release' ? 'Фиолетовый выброс: коснись!' : { strike: 'Бей, когда кольцо сойдётся', block: 'Блокируй в момент удара', evade: 'Уклонись в нужный миг' }[m.act] || 'Коснись!', cx, cy - 62, { align: 'center', color: '#fff2cf', outline: PAL.ink });
      } else {
        const btns = sealButtons(g), left = Math.max(0, 1 - m.t / m.limit);
        U.panel(ctx, 6, cy - 64, W - 12, 72, 'inner');
        FS.draw(ctx, G.TECHS[m.act.slice(5)].name, cx, cy - 58, { align: 'center', color: '#2e1e14' });
        m.seq.forEach((s, i) => { const bx = Math.round(cx - m.seq.length * 12 + i * 24 + 3); ctx.fillStyle = G.SEAL_COL[s]; ctx.globalAlpha = i < m.i ? 0.35 : 1; ctx.fillRect(bx, cy - 44, 18, 14); ctx.globalAlpha = 1; FS.draw(ctx, G.SEALS[s].slice(0, 3), bx + 9, cy - 42, { align: 'center', color: '#2e1e14' }); if (i === m.i) { ctx.fillStyle = '#b8321c'; ctx.fillRect(bx, cy - 29, 18, 2); } });
        U.gauge(ctx, 14, cy - 22, W - 28, 5, left, left > 0.3 ? '#4a8a3a' : '#c8281c');
        btns.forEach((b, i) => {
          const sh = m.shake ? Math.round(rnd(-1, 1) * m.shake * 2) : 0;
          U.button(ctx, b.x + sh, b.y, b.w, b.h, '', i === (m.f || 0) ? 'sel' : 'normal');
          ctx.fillStyle = G.SEAL_COL[b.seal]; ctx.fillRect(b.x + 3 + sh, b.y + 3, 6, b.h - 6);
          FS.draw(ctx, G.SEALS[b.seal], b.x + b.w / 2 + 3 + sh, b.y + b.h / 2 - 4, { align: 'center', color: '#f8eed0', shadow: PAL.ink });
        });
      }
    },
  };
  // кнопки печатей в панели управления
  function sealButtons(g) {
    const m = mini, W = g.W, n = m.pal.length, cols = 3, bw = Math.floor((W - 16 - (cols - 1) * 6) / cols), out = [];
    m.pal.forEach((s, i) => out.push({ seal: s, x: 8 + (i % cols) * (bw + 6), y: g.py + 50 + Math.floor(i / cols) * (g.d.th + 4), w: bw, h: g.d.th }));
    return out;
  }
  return S;
});

// Мастерство техники в меню и тренировках использует G.combat (data/duel_data.js)

// Запуск боя из скрипта: call battle <enemy> <mode> <terrain> [после_победы] [после_поражения] [turns]
G.script.actions.battle = (a) => {
  G.game.pending = { type: 'battle', enemy: a[0], mode: a[1] || 'ko', terrain: a[2] || 'field', win: a[3] && a[3] !== '-' ? a[3] : null, lose: a[4] && a[4] !== '-' ? a[4] : null, turns: a[5] ? Number(a[5]) : 0 };
};
