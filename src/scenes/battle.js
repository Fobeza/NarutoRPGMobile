// Бой «Дуэль шиноби» (план §4). opts: { enemy, mode: ko|spar|bells|scroll|survive|ringout, terrain, turns, ambush, story, allies }
// onEnd(result) — result: { win, mode, enemy, ringout, surrender }
G.scenes.register('battle', (opts, onEnd) => {
  const W = G.screen.W, F = G.font, PAL = G.PAL, AU = G.audio;
  const A = G.ARENAS[opts.terrain || 'field'] || G.ARENAS.field;
  const mode = opts.mode || 'ko';
  let ed = G.ENEMIES[opts.enemy] || G.ENEMIES.dummy;
  const Hh = G.hero, st = (k) => Hh.stat(k), V = G.state.vars;
  const real = mode === 'ko' || mode === 'survive';
  const fac = (spd) => Math.max(0.6, 1.3 - spd * 0.05);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const has = (t) => (ed.traits || []).includes(t);
  const inv = (id) => G.game.count ? G.game.count(id) : (G.state.inv[id] || 0);
  const trainingFight = mode === 'spar' || mode === 'ringout';   // уроки, спарринги, турнир: запасы не тратятся
  const take = (id, n = 1) => { if (trainingFight) return; if (G.game.take) G.game.take(id, n); else G.state.inv[id] = Math.max(0, (G.state.inv[id] || 0) - n); };
  const sfx = {
    hit() { AU.noise(0.08, 0.25); AU.tone(140, 0.08, 'square', 0.12, 60); },
    big() { AU.noise(0.2, 0.3); AU.tone(110, 0.2, 'sawtooth', 0.15, 40); },
    whoosh() { AU.noise(0.12, 0.08); AU.tone(900, 0.1, 'triangle', 0.05, 300); },
    clang() { AU.tone(1400, 0.06, 'square', 0.1); AU.tone(1900, 0.1, 'triangle', 0.08, null, 0.04); },
    seal() { AU.tone(520 + Math.random() * 200, 0.04, 'square', 0.08); },
    win() { [523, 659, 784, 1046].forEach((f, i) => AU.tone(f, 0.15, 'square', 0.1, null, i * 0.12)); },
    lose() { [392, 330, 262].forEach((f, i) => AU.tone(f, 0.25, 'triangle', 0.12, null, i * 0.2)); },
    react() { AU.tone(1200, 0.05, 'square', 0.1); AU.tone(1600, 0.05, 'square', 0.1, null, 0.07); },
  };

  // ── бойцы ──
  const hpMax = Math.round((60 + st('end') * 4) * (Hh.has('tough') ? 1.1 : 1));
  const chMax = Math.round((20 + st('chakra') * 8) * (Hh.has('big_chakra') ? 1.25 : 1));
  const P = {
    side: 'p', name: G.state.hero.name, spr: 'hero', pos: opts.ppos != null ? opts.ppos : 1,
    tai: st('tai'), nin: st('nin'), gen: st('gen'), spd: st('spd'), end: st('end'), know: st('know'), ctrl: st('ctrl'), chakra: st('chakra'),
    hpMax, chMax, brMax: 2 + Math.floor(st('end') / 3), focusMax: 2 + (Hh.has('analyst') ? 1 : 0) + (G.state.flags.tactic ? 1 : 0),
    t: 0, s: {}, clones: 0, will: 0, ambush: 0,
  };
  P.hp = mode === 'ko' || mode === 'survive' ? Math.max(1, Math.round(hpMax * (V.hp == null ? 100 : V.hp) / 100)) : hpMax;
  P.ch = Math.round(chMax * clamp(V.chakra == null ? 100 : V.chakra, 10, 100) / 100);
  P.br = P.brMax; P.focus = P.focusMax;
  if (opts.will) P.will = opts.will;
  // уличные противники растут вместе с героем (баланс): HP +1,5%/день, Тай +1 за 2 недели, Скор +1 за 3
  if (ed.grow) { const d = V.day || 1; ed = Object.assign({}, ed, { hp: Math.round(ed.hp * (1 + 0.025 * d)), tai: ed.tai + Math.floor(d / 9), spd: ed.spd + Math.floor(d / 14), end: ed.end + Math.floor(d / 21) }); }
  const E = Object.assign({}, ed, { side: 'e', pos: opts.epos != null ? opts.epos : 3, hpMax: ed.hp, hp: ed.hp, chMax: ed.ch, ch: ed.ch,
    focusMax: ed.focus, t: 3, s: {}, clones: 0, realIdx: 1, an: 0, feinted: false, plan: 'stand', shown: 'stand', plan2: null, phase: 1 });
  if (opts.ambush) { P.ambush = 1.5; E.t = 12; }
  const traps = [];  // { pos, owner, kind, seen }
  const fx = { shake: 0, flash: 0, lines: 0, pops: [], puffs: [], bubble: null, logs: [], vfx: [], hitstop: 0, zoom: 1, zoomT: 1, slow: 0, bars: 0, barsT: 0, cut: null, rain: [], t: 0 };
  const msgs = [];
  let state = 'intro', stT = 2.3, animT = 0, after = null;
  let menu = 'main', page = 0, focus = 0, chain = [], comboId = null;
  let usedTough = false, lowSaid = false, eTurns = 0, pTurns = 0, result = null, lastPTai = false;
  let react = null, seals = null, rhythm = null, target = null, moment = null;
  let stats = { perfect: 0, reacts: 0, used: {} };
  const pName = G.state.hero.name;

  let simLog = null;
  const say = (t, col) => { if (simLog) simLog.push(G.util.fmt(t, { name: pName })); msgs.push({ t: G.util.fmt(t, { name: pName }), col: col || PAL.white }); while (msgs.length > 2) msgs.shift(); };
  const SP = Math.min(52, Math.floor((W - 48) / 4)), X = (pos) => Math.round(W / 2 + (pos - 2) * SP);
  const dist = () => Math.abs(P.pos - E.pos);
  const sgn = (a, b) => Math.sign(b.pos - a.pos) || 1;
  const objAt = (pos) => A.obj[pos];
  const other = (f) => (f === P ? E : P);

  const bubble = (key) => { const l = ed.lines && ed.lines[key]; if (l) fx.bubble = { text: G.util.fmt(l, { name: pName }), t: 2.2 }; };
  const xp = (stat, n) => { stats.used[stat] = (stats.used[stat] || 0) + n; };
  const gainWill = (n) => { P.will = clamp(P.will + n * (Hh.has('grit') ? 1.2 : 1), 0, 100); };
  const wait = (sec, then) => { state = 'anim'; animT = sec; after = then; };
  const TIPS = {
    dummy: 'Просто бей! Тайдзюцу — вплотную, метание — издалека.', dummy2: 'Манекен медленный. Попробуй цепочку из трёх ударов.',
    kiba: 'Силён вплотную и любит Гацугу. Держи дистанцию, кидай кунаи.', naruto: 'Создаёт клонов. Настоящий — тот, у кого пар изо рта.',
    sasuke: 'Уходит Каварими от сильных атак. Сначала Финт!', shikamaru: 'Ставит ловушки и ленится. Дави темпом, не ходи вслепую.',
    hinata: 'Мягкий кулак выжигает чакру. Держись дальше, бей метанием.', choji: 'Много HP, но медленный. Манёвр и метание.',
    ino: 'Иллюзии. Гендзюцу и Анализ помогают.', lee: 'Очень быстрый. Блок, Каварими и ловушки.', iruka: 'Колокольчик сорвёшь, если он оглушён, ослеплён или связан.',
    mizuki: 'Гигантский сюрикен издалека — подходи вплотную. Не верь его словам.', bully: 'Простой задира.', thief: 'Шустрый и прячется. Проволока!', dog: 'Быстро кусает. Блок!',
  };

  // ── раскладка экрана ──
  const layout = {};
  function relayout() {
    const H = G.screen.H;
    layout.tl = 0; layout.eb = 12; layout.ar = 33;
    const panelH = clamp(Math.round(H * 0.3), 74, 124);
    layout.pn = H - panelH; layout.ms = layout.pn - 22; layout.pb = layout.ms - 24;
    layout.arH = layout.pb - layout.ar; layout.groundY = layout.ar + layout.arH - 10;
    layout.panelH = panelH;
  }

  // ── шкала ходов ──
  function timeline() {
    const out = []; let tp = P.t, te = E.t, first = true;
    for (let i = 0; i < 6; i++) {
      if (tp <= te) { out.push('p'); tp += 10 * fac(P.spd); }
      else { out.push('e'); te += (first ? (G.EACTS[E.plan] || G.EACTS.stand).w : 10) * fac(E.spd); first = false; }
    }
    return out;
  }

  // эффекты боя — в scenes/battle_fx.js (имена те же, что были здесь: 40+ мест вызова не меняются)
  const FX = G.battleFx.make({
    fx, layout, X, rnd, PAL, P, E, sgn, other,
    get state() { return state; }, get seals() { return seals; },
  });
  const pop = FX.pop, puff = FX.puff, hurt = FX.hurt, impact = FX.impact, lunge = FX.lunge, proj = FX.proj;
  const cy = FX.cy, V1 = FX.V1;
  const burst = FX.burst, aura = FX.aura, leaves = FX.leaves, enemyFx = FX.enemyFx;
  const updateVfx = FX.updateVfx, drawVfx = FX.drawVfx, drawSealGlow = FX.drawSealGlow;
  // ── движение ──
  function canStand(f, pos) {
    if (pos < 0 || pos > 4) return false;
    if (pos === other(f).pos) return false;
    if (objAt(pos) === 'water' && !(f === P ? G.state.flags.tech_water : has('climb'))) return false;
    return true;
  }
  function step(f, toward, n = 1) {
    const dir = sgn(f, other(f)) * (toward ? 1 : -1);
    let moved = 0;
    for (let i = 0; i < n; i++) {
      const np = f.pos + dir;
      if (!canStand(f, np)) break;
      f.pos = np; moved++;
      if (f.s.high) f.s.high = 0;
      if (f.s.hidden && f.s.hidden !== 'henge') f.s.hidden = 0;
      if (trapCheck(f)) break;
    }
    return moved;
  }
  function trapCheck(f) {
    const i = traps.findIndex((t) => t.pos === f.pos && t.owner !== f.side);
    if (i < 0) return false;
    const t = traps[i];
    // умный враг может заметить ловушку
    if (f === E && Math.random() < E.know * 0.06) { say(`${E.name} замечает ловушку и обходит её!`, PAL.light); traps.splice(i, 1); return false; }
    if (f === P && P.know >= 6 && !t.seen && Math.random() < 0.5) { say('Ты замечаешь ловушку под ногами!', PAL.light); t.seen = true; return false; }
    traps.splice(i, 1);
    if (t.kind === 'tag') { const d = 22; f.hp -= d; pop(f, '-' + d, '#ff6a3a', true); say('БАБАХ! Взрывная печать!', PAL.orange); fx.shake = 0.4; fx.flash = 0.2; sfx.big(); puff(f.pos, 16); burst(f.pos, '#ff9030', 40); impact(f, 22, '#ffb040'); }
    else { f.s.bound = 2; say(`${f === P ? 'Ты попал' : f.name + ' попадает'} в проволочную ловушку!`, PAL.light); sfx.clang(); }
    return true;
  }
  function pushBack(f, n = 1) {
    const dir = sgn(other(f), f);
    for (let i = 0; i < n; i++) {
      const np = f.pos + dir;
      if ((mode === 'ringout' || A.ring) && (np < 0 || np > 4) && f === E) { result = { win: true, ringout: true }; say(`${E.name} вылетает за край арены!`, PAL.yellow); return; }
      if (!canStand(f, np)) return;
      f.pos = np;
      trapCheck(f);
    }
  }

  // ── ИИ противника — в scenes/battle_ai.js ──
  const AI = G.battleAi.make({ P, E, ed, traps, dist, has, canStand, sgn, rnd, Hh });
  const validAct = AI.validAct, decide = AI.decide, plan = AI.plan, actName = AI.actName, actOf = AI.actOf;

  // ── ходы ──
  function tick(f) {
    for (const k of ['blind', 'fear', 'bound', 'conf', 'shaken', 'prov']) if (f.s[k]) f.s[k]--;
    f.s.guard = 0; f.s.evade = 0; if (f.wet > 0) f.wet--;
    if (f === P && E.an > 0) E.an--;
  }
  function nextTurn() {
    if (checkEnd()) return;
    const m = Math.min(P.t, E.t); P.t -= m; E.t -= m;
    if (P.t <= E.t) playerTurn(); else enemyTurn();
  }
  function playerTurn() {
    tick(P); pTurns++;
    if (!lastPTai) P.br = Math.min(P.brMax, P.br + 1);
    lastPTai = false;
    if ((mode === 'bells' || mode === 'scroll') && opts.turns && pTurns > opts.turns) { result = { win: false, timeout: true }; say('Время вышло!', PAL.orange); wait(0.8, finish); return; }
    if (P.s.stun) { P.s.stun = 0; say('Ты оглушён и пропускаешь ход!', '#ff9a7a'); P.t += 8 * fac(P.spd); wait(0.9, nextTurn); return; }
    if (opts.allies && pTurns % 3 === 0) allyHelp();
    if (opts.story && !lowSaid && P.hp < P.hpMax * 0.3) {
      lowSaid = true; gainWill(35);
      fx.bubble = null; moment = { t: 0, line: opts.storyLine || 'Я не сдамся! Я стану генином!', pick: false }; state = 'moment';
      return;
    }
    state = 'menu'; menu = 'main'; page = 0; focus = Math.min(focus, 5); chain = []; comboId = null;
  }
  function allyHelp() {
    const who = opts.allies[Math.floor(pTurns / 3) % opts.allies.length];
    if (who === 'naruto') { const d = 8 + (E.phase === 2 ? 6 : 0); E.hp -= d; pop(E, '-' + d, PAL.yellow); say('Наруто: «Не трогай моего друга!» — сюрикены летят в Мизуки!', PAL.orangeLight); sfx.hit(); }
    if (who === 'iruka') { gainWill(15); P.focus = Math.min(P.focusMax, P.focus + 1); say('Ирука: «Держись, {name}! Я в тебя верю!» (+Фокус, +Воля)', '#9ad0ff'); }
  }
  function enemyTurn() {
    tick(E); eTurns++;
    if (mode === 'survive' && opts.turns && eTurns > opts.turns) { result = { win: true }; say('Ты продержался!', PAL.yellow); wait(0.8, finish); return; }
    if (E.s.stun) { E.s.stun = 0; say(`${E.name} оглушён!`, PAL.light); E.t += 8 * fac(E.spd); wait(0.8, () => { plan(); nextTurn(); }); return; }
    if (E.s.fear && Math.random() < 0.7) { say(`${E.name} в ужасе отшатывается от видения!`, '#d080e0'); E.t += 9 * fac(E.spd); wait(0.9, () => { plan(); nextTurn(); }); return; }
    if (P.s.hidden) {
      const find = clamp(0.3 + E.know * 0.06 + (dist() === 1 ? 0.25 : 0) - (P.s.hidden === 'henge' ? 0.25 : 0), 0.1, 0.9);
      if (Math.random() < find) { say(`${E.name}: «Вот ты где!»`, PAL.orangeLight); P.s.hidden = 0; }
      else { say(`${E.name} ищет тебя... и не находит.`, PAL.light); E.t += 8 * fac(E.spd); wait(0.9, () => { plan(); nextTurn(); }); return; }
    }
    state = 'enemy'; stT = 0.45;
  }

  function enemyAct() {
    if (!validAct(E.plan, dist()) && E.plan !== 'yawn') plan();
    const id = E.plan, a = actOf(id);
    let w = a.w;
    const done = (extra = 0.7) => { E.t += w * fac(E.spd); wait(extra, () => { plan(); nextTurn(); }); };
    if (a.jutsu) E.ch -= 10;
    switch (a.kind) {
      case 'idle': say(id === 'yawn' ? `${E.name} зевает. Хлопотно...` : `${E.name} стоит неподвижно.`, PAL.light); return done(0.6);
      case 'move': {
        const n = step(E, a.dir > 0, Math.abs(a.dir)); if (a.dir === 2) { fx.lines = 0.3; sfx.whoosh(); }
        say(n ? `${E.name}: ${a.name.toLowerCase()}.` : `${E.name} топчется на месте.`, PAL.light); return done(0.5);
      }
      case 'guard': E.s.guard = 1; say(`${E.name} в защите.`, PAL.light); return done(0.5);
      case 'focus': E.ch = Math.min(E.chMax, E.ch + 15); E.focus = Math.min(E.focusMax, E.focus + 1); say(`${E.name} копит чакру.`, PAL.light); return done(0.6);
      case 'clones': E.clones = 2; E.realIdx = Math.floor(Math.random() * 3); puff(E.pos, 18); AU.sfx.puff(); say(`${E.name}: «Теневое клонирование!» Их трое!`, PAL.yellow); bubble('start'); return done(0.9);
      case 'trap': {
        const tp = clamp(P.pos + sgn(P, E), 0, 4);
        if (tp !== E.pos && !traps.some((t) => t.pos === tp)) traps.push({ pos: tp, owner: 'e', kind: Math.random() < 0.5 ? 'wire' : 'tag', seen: P.know >= 7 || E.an > 0 });
        say(`${E.name} что-то прячет в траве...`, PAL.light); return done(0.6);
      }
      case 'taunt': P.s.shaken = 2; gainWill(8); say(`${E.name}: «Тебя никто не ждал в этой деревне! Ты здесь лишний!» (урон −20%)`, '#ff9a7a'); return done(0.9);
      case 'gen': {
        const resist = clamp(0.25 + P.gen * 0.07, 0.1, 0.85);
        if (Math.random() < resist) { say(`Иллюзия! Ты разрываешь её: «Кай!»`, '#9ad0ff'); gainWill(8); }
        else { P.s.conf = 2; say('Мир плывёт... ты в иллюзии! (действия могут сорваться)', '#d080e0'); fx.flash = 0.15; }
        return done(0.9);
      }
      default: break;
    }
    // атака по герою → окно реакции
    if (a.lunge && dist() > 1) { step(E, true, dist() - 1); fx.lines = 0.35; sfx.whoosh(); }
    let dmg = (a.dmg || 0) * (a.hits || 1) * (1 + (a.kind === 'tai' ? E.tai : E.nin) * 0.11);
    if (E.phase === 2) dmg *= 1.25;
    if (E.s.prov) dmg *= 1.25;
    react = { a, id, dmg: Math.round(dmg), t: 0, max: (a.kind === 'bind' ? 1.4 : 1.5) + (G.storage.settings.reactSlow ? 0.8 : 0), sub: null };
    // клоны героя
    if (P.clones > 0 && Math.random() < P.clones / (P.clones + 1)) {
      P.clones--; puff(P.pos, 8); AU.sfx.puff(); say(`${E.name} бьёт по клону! Пуф!`, PAL.yellow); react = null; return done(0.7);
    }
    state = 'react'; sfx.react(); fx.lines = 0.2;
    if (a.fx) enemyFx(a.fx); else if (a.kind === 'throw') proj(E, P, 'kunai'); else lunge(E, 1.2);
    say(`${E.name}: ${a.name}`, PAL.orangeLight);
    react.done = () => { E.t += w * fac(E.spd); wait(0.75, () => { plan(); nextTurn(); }); };
  }

  function resolveReact(choice) {
    const r = react; react = null; const a = r.a;
    let miss = false, mul = 1;
    if (E.s.blind && Math.random() < 0.5) { miss = true; say(`${E.name} ничего не видит и промахивается!`, PAL.light); }
    if (!miss && E.s.prov && Math.random() < 0.25) { miss = true; say(`${E.name} бьёт сгоряча — мимо!`, PAL.light); }
    if (!miss && a.kind === 'throw' && objAt(P.pos) === 'rock' && Math.random() < 0.5) { miss = true; say('Снаряд звякает о скалу. Укрытие!', PAL.light); sfx.clang(); }
    if (!miss && P.s.evade && Math.random() < 0.4) { miss = true; say('Отскок спас тебя!', '#9ad0ff'); }
    if (!miss) {
      if (choice === 'block') { mul = a.kind === 'bind' || a.kind === 'nin' ? 0.75 : 0.55; P.br = Math.max(0, P.br - 1); say('Блок!', '#9ad0ff'); sfx.clang(); if (a.kind === 'bind') miss = true; stats.reacts++; }
      else if (choice === 'dodge') {
        const ch = clamp(0.35 + (P.spd - E.spd) * 0.06 + (a.kind !== 'tai' ? 0.1 : 0), 0.1, 0.85);
        if (Math.random() < ch) { miss = true; say('Уклон! Мимо!', '#9ad0ff'); gainWill(6); stats.reacts++; sfx.whoosh(); } else say('Не успел увернуться!', '#ff9a7a');
      } else if (choice === 'kawa_ok') {
        miss = true; stats.reacts++;
        const cost = Math.round(G.TECHS.kawarimi.ch * (objAt(P.pos) === 'logs' ? 0.5 : 1));
        P.ch -= cost; P.focus--; gainWill(12); V.use_kawarimi = (V.use_kawarimi || 0) + 1;
        fx.logs.push({ x: X(P.pos), t: 0 }); puff(P.pos, 14); AU.sfx.puff();
        const behind = E.pos + sgn(P, E);
        if (canStand(P, behind)) P.pos = behind;
        P.ambush = Math.max(P.ambush, 1.5 + P.nin * 0.07); P.t = Math.min(P.t, E.t + a.w * fac(E.spd) - 0.1);
        say('Каварими! Полено вместо тебя — ты у врага за спиной!', PAL.yellow); xp('nin', 2);
      } else if (choice === 'kawa_fail') { say('Печать сорвалась! Каварими не вышло...', '#ff9a7a'); P.focus--; P.ch -= 4; }
      else if (choice === 'clash_ok') { miss = true; E.hp -= 4; pop(E, '-4'); say('Звон клинков! Ты отбил удар кунаем!', PAL.yellow); sfx.clang(); gainWill(10); stats.reacts++; }
      else if (choice === 'clash_fail') { mul = 0.7; say('Он пересилил!', '#ff9a7a'); sfx.clang(); }
    }
    if (!miss) {
      if (a.kind === 'bind') { P.s.bound = 2; say('Ты связан тенью! Не двинуться!', '#d080e0'); }
      else {
        let d = Math.round(r.dmg * mul * (P.s.vuln ? 1.25 : 1) * rnd(0.9, 1.1) / (1 + P.end * 0.03));
        P.s.vuln = 0;
        P.hp -= d; pop(P, '-' + d, '#ff6a3a', d >= 15); impact(P, d, '#ffb090', a.kind); gainWill(d * 0.8); fx.shake = d >= 15 ? 0.35 : 0.18; d >= 15 ? sfx.big() : sfx.hit();
        if (d >= 15) fx.flash = 0.12;
        if (a.drain) { P.ch = Math.max(0, P.ch - a.drain); say(`Мягкий кулак! Чакра −${a.drain}`, '#9ad0ff'); }
        if (a.push) pushBack(P, 1);
        if (P.hp <= 0 && Hh.has('tough') && !usedTough) { usedTough = true; P.hp = 1; say('Крепкий орешек! Ты устоял на ногах с 1 HP!', PAL.yellow); }
        if (P.s.hidden) P.s.hidden = 0;
      }
    }
    r.done();
  }

  // ── атаки героя ──
  // spec: { kind: tai|throw|nin, dmg, label, strong, onHit(f), noReact }
  function attack(spec, then) {
    if (spec.kind === 'throw') { if (!spec._pv) { spec._pv = 1; proj(P, E, spec.tag ? 'tag' : spec.fan ? 'shuriken' : spec.shu ? 'shuriken' : 'kunai', spec.fan ? 3 : 1); } } else if (spec.kind === 'tai') lunge(P);
    // клоны врага: выбрать цель
    if (E.clones > 0 && !spec.targetDone) {
      target = { spec, then }; state = 'target'; focus = 0; return;
    }
    // реакция врага (Каварими) на сильную атаку
    if (!spec.noReact && has('kawarimi') && E.focus > 0 && spec.strong && !E.feinted && !E.s.stun && !E.s.bound && Math.random() < (has('smart') ? 0.75 : 0.55)) {
      E.focus--; fx.logs.push({ x: X(E.pos), t: 0 }); puff(E.pos, 14); AU.sfx.puff();
      const behind = P.pos + sgn(E, P); if (canStand(E, behind)) E.pos = behind;
      say(`Каварими! ${E.name} подставил полено! Он за спиной!`, '#ff9a7a'); E.t = Math.min(E.t, P.t + 1); bubble('hurt');
      return then(false);
    }
    E.feinted = false;
    // уклон от метания
    if (spec.kind === 'throw' && !P.ambush) {
      const ev = clamp(0.1 + (E.spd - P.spd) * 0.05 - (Hh.has('eagle_eye') ? 0.15 : 0) - (E.s.bound ? 1 : 0), 0, 0.45);
      if (Math.random() < ev) { say(`${E.name} уклоняется!`, PAL.light); sfx.whoosh(); return then(false); }
    }
    let d = spec.dmg;
    const stat = spec.kind === 'tai' ? P.tai : spec.kind === 'throw' ? (P.tai + P.spd) / 2 : P.nin;
    d *= 1 + stat * (spec.kind === 'tai' ? 0.055 : spec.kind === 'nin' ? 0.08 : 0.065);
    if (spec.kind !== 'nin') d /= 1 + (E.end || 0) * 0.04;   // стойкость врага (баланс: tools/balance.py)
    if (spec.kind === 'throw' && Hh.has('eagle_eye')) d *= 1.2;
    if (spec.kind === 'throw' && P.s.high) d *= 1.3;
    if (P.ambush) { d *= P.ambush; say(P.ambush >= 2 ? 'ЗАСАДА! Урон ×2!' : 'Удар со спины!', PAL.yellow); P.ambush = 0; }
    if (P.clones > 0 && spec.kind === 'tai') d *= 1 + P.clones * (0.1 + P.nin * 0.02);   // клоны Буншина бьют вместе с героем (сила — от Ниндзюцу)
    if (Hh.has('grit') && P.hp < P.hpMax * 0.3) d *= 1.25;
    if (P.s.shaken) d *= 0.8;
    if (E.s.guard && spec.kind !== 'nin') d *= 0.5;
    if (V.injury) d *= 0.85;
    d = Math.max(1, Math.round(d * rnd(0.9, 1.1)));
    E.hp -= d; pop(E, '-' + d, spec.crit ? PAL.yellow : PAL.white, d >= 15); impact(E, d, spec.crit ? '#ffe070' : '#fff6c8', spec.kind); fx.shake = d >= 15 ? 0.3 : 0.12;
    d >= 15 ? sfx.big() : sfx.hit(); gainWill(2);
    if (P.s.hidden) P.s.hidden = 0;
    if (spec.onHit) spec.onHit(E);
    if (E.hp < E.hpMax * 0.35 && !E._low) { E._low = true; bubble('low'); }
    else if (Math.random() < 0.25) bubble('hurt');
    then(true, d);
  }
  const strongish = (d) => d >= 11;

  // ── действия героя ──
  const endTurn = (w, delay = 0.6) => { P.t += w * fac(P.spd); wait(delay, () => { if (!validAct(E.plan, dist())) plan(); nextTurn(); }); };
  function confused() { if (P.s.conf && Math.random() < 0.3) { say('Иллюзия сбивает тебя — действие сорвалось!', '#d080e0'); endTurn(6); return true; } return false; }

  function doMove(kind) {
    if (confused()) return;
    if (kind === 'fwd') { const n = step(P, true, 1); say(n ? 'Ты шагаешь вперёд.' : 'Дальше нельзя.'); return endTurn(6, 0.4); }
    if (kind === 'back') { const n = step(P, false, 1); say(n ? 'Ты отходишь назад.' : 'Дальше нельзя.'); return endTurn(6, 0.4); }
    if (kind === 'dash') { P.br--; const n = step(P, true, 2); fx.lines = 0.3; sfx.whoosh(); say(n ? 'Рывок!' : 'Некуда.'); xp('spd', 1); return endTurn(8, 0.4); }
    if (kind === 'hop') { P.br--; step(P, false, 1); P.s.evade = 1; sfx.whoosh(); say('Отскок! Следующий удар может пройти мимо.'); xp('spd', 1); return endTurn(7, 0.4); }
    if (kind === 'climb') { P.ch -= 5; P.s.high = 1; say('Ты взбегаешь по стволу! Наверху тайдзюцу не достанет, метание сильнее.', '#9ad0ff'); xp('ctrl', 2); return endTurn(7, 0.5); }
    if (kind === 'down') { P.s.high = 0; say('Ты спрыгиваешь вниз.'); return endTurn(4, 0.4); }
    if (kind === 'hide') { P.s.hidden = 1; say('Ты прячешься в кустах. Следующая атака — из засады.', '#9ad0ff'); P.ambush = Math.max(P.ambush, 1.5); return endTurn(7, 0.5); }
  }

  function doThrow(kind) {
    if (confused()) return;
    if (kind === 'kunai') { take('kunai'); sfx.whoosh(); say('Ты бросаешь кунай!'); xp('tai', 1); return attack({ kind: 'throw', dmg: 7, strong: false }, () => endTurn(7)); }
    if (kind === 'shuriken') { take('shuriken'); sfx.whoosh(); say('Сюрикен!'); xp('spd', 1); return attack({ kind: 'throw', shu: true, dmg: 5, strong: false }, () => endTurn(5)); }
    if (kind === 'fan') { take('shuriken', 3); sfx.whoosh(); say('Веер из трёх сюрикенов!'); xp('spd', 2); return attack({ kind: 'throw', fan: true, dmg: 12, strong: true }, () => endTurn(8)); }
    if (kind === 'wire') {
      take('kunai'); take('wire'); sfx.whoosh(); say('Кунай с проволокой!'); xp('know', 1);
      return attack({ kind: 'throw', dmg: 4, strong: false, onHit: (e) => { e.s.bound = 2; say(`${e.name} опутан проволокой!`, '#9ad0ff'); } }, () => endTurn(8));
    }
  }

  function doTool(kind) {
    if (kind === 'smoke') { take('smoke_bomb'); puff(E.pos, 20); puff(P.pos, 12); AU.sfx.puff(); E.s.blind = 2; P.s.hidden = 1; P.ambush = Math.max(P.ambush, 1.5); say('Дымовая бомба! Враг ослеплён, ты исчез в дыму.', '#9ad0ff'); return endTurn(6); }
    if (kind === 'flash') { take('flash_bomb'); fx.flash = 0.5; burst(E.pos, '#ffffff', 50); E.s.blind = 2; E.t += 4; say('Вспышка! Враг ослеплён.', PAL.yellow); return endTurn(6); }
    if (kind === 'tag') { take('tag_explosive'); say('Ты бросаешь кунай со взрывной печатью!'); return attack({ kind: 'throw', dmg: 18, strong: true, onHit: () => { fx.flash = 0.2; puff(E.pos, 18); burst(E.pos, '#ff9030', 42); }, tag: true }, () => endTurn(9)); }
    if (kind === 'trap_tag' || kind === 'trap_wire') {
      const tp = P.pos + sgn(P, E);
      take(kind === 'trap_tag' ? 'tag_explosive' : 'wire');
      if (tp !== E.pos) traps.push({ pos: tp, owner: 'p', kind: kind === 'trap_tag' ? 'tag' : 'wire', seen: true });
      say(tp !== E.pos ? 'Ловушка поставлена перед тобой.' : 'Враг слишком близко — ловушка бесполезна.'); xp('know', 2); return endTurn(7);
    }
    if (kind === 'bandage') { take('bandage'); const h = Math.round(P.hpMax * 0.25); P.hp = Math.min(P.hpMax, P.hp + h); pop(P, '+' + h, '#8ae070'); say('Перевязка. +' + h + ' HP'); return endTurn(7); }
    if (kind === 'pill') { take('chakra_pill'); const c = Math.round(P.chMax * 0.5); P.ch = Math.min(P.chMax, P.ch + c); pop(P, '+' + c, '#7ab0ff'); say('Пилюля чакры! +' + c); return endTurn(5); }
  }

  function doMisc(kind) {
    if (kind === 'guard') { P.s.guard = 1; P.br = Math.min(P.brMax, P.br + 2); say('Ты встаёшь в защиту и переводишь дыхание.'); return endTurn(5, 0.4); }
    if (kind === 'conc') { const c = 12 + P.chakra * 2; P.ch = Math.min(P.chMax, P.ch + c); P.focus = Math.min(P.focusMax, P.focus + 1); P.s.vuln = 1; say(`Концентрация: чакра +${c}, Фокус +1. Ты открыт для удара!`, '#7ab0ff'); xp('chakra', 1); return endTurn(8); }
    if (kind === 'analyze') {
      E.an = 3; P.focus = Math.min(P.focusMax, P.focus + 1); traps.forEach((t) => { t.seen = true; });
      E.shown = E.plan;
      say('Анализ: ' + (TIPS[opts.enemy] || 'Слабых мест не видно.'), '#9ad0ff'); xp('know', 2); return endTurn(6, 1.2);
    }
    if (kind === 'feint') {
      if (has('kawarimi') && E.focus > 0) { E.focus--; E.feinted = true; fx.logs.push({ x: X(E.pos), t: 0 }); puff(E.pos, 8); AU.sfx.puff(); say(`Финт! ${E.name} уходит Каварими... от пустоты!`, PAL.yellow); gainWill(8); }
      else { E.feinted = true; E.t += 2; say('Финт! Враг дёрнулся и потерял темп.'); }
      xp('gen', 1); return endTurn(4, 0.5);
    }
    if (kind === 'prov') {
      if (has('smart') && Math.random() < 0.6) say(`${E.name}: «Не сработает.»`, PAL.light);
      else { E.s.prov = 2; say(`Провокация! ${E.name} злится и бросается вперёд.`, PAL.orangeLight); gainWill(5); E.plan = decide(); E.shown = E.plan; }
      return endTurn(5, 0.5);
    }
    if (kind === 'grab') {
      let c = 0.2 + (E.s.stun ? 0.35 : 0) + (E.s.blind ? 0.35 : 0) + (E.s.bound ? 0.4 : 0) + (P.ambush ? 0.35 : 0) + (E.feinted ? 0.3 : 0) + (E.s.fear ? 0.3 : 0) - (has('smart') ? 0.1 : 0);
      c = clamp(c, 0.05, 0.95);
      if (Math.random() < c) { result = { win: true }; say(mode === 'bells' ? 'Дзинь! Колокольчик у тебя в руке!' : 'Свиток у тебя!', PAL.yellow); sfx.win(); return wait(0.9, finish); }
      say(`${E.name} ловко уворачивается!`, PAL.light); E.t = Math.max(0, E.t - 3); P.ambush = 0; E.feinted = false; return endTurn(6);
    }
    if (kind === 'give') { result = { win: false, surrender: true }; say('Ты сдаёшься.'); return wait(0.6, finish); }
    if (kind === 'will') { moment = { t: 0, line: 'Это моя Воля Огня!', pick: true }; state = 'moment'; AU.tone(220, 0.6, 'sawtooth', 0.12, 880); return; }
  }

  // тайдзюцу-цепочка с ритмом
  function runChain() {
    if (confused()) return;
    lastPTai = true;
    const seq = chain.slice(); const combo = comboId ? G.COMBOS[comboId] : null;
    P.br -= seq.length; xp('tai', seq.length); if (combo) xp('tai', 2);
    const strong = seq.length >= 2 || !!combo;
    // реакция врага проверяется в начале цепочки
    let k = 0; let afterSweep = false; let total = 0;
    // враг может встретить серию блоком (баланс): зависит от его Тай/Скор против твоих и от его Фокуса —
    // опытный противник читает комбинации (Фокус раньше давал «+8% если больше нуля», из-за чего
    // тайдзюцу-сборка почти не встречала сопротивления во второй половине игры)
    if (E.focusMax > 0 && !E.s.bound && !E.s.stun && !P.ambush && !E.s.fear) {
      const bc = clamp(0.12 + (E.tai - P.tai) * 0.03 + (E.spd - P.spd) * 0.03 + E.focus * 0.06, 0.06, 0.45);
      if (Math.random() < bc) { E.s.guard = 1; say(`${E.name} ставит блок!`, PAL.light); }
    }
    const next = () => {
      if (k >= seq.length || E.hp <= 0 || result) {
        if (combo && total > 0) { say(`${combo.name}!`, PAL.yellow); gainWill(6); if (combo.down) { E.t += 5; say(`${combo.name}! Враг сбит с ног!`, PAL.yellow); } if (combo.push) pushBack(E, combo.push); P.focus = Math.min(P.focusMax, P.focus + 1); }
        return endTurn(4 + seq.length * 3.2, 0.5);
      }
      const mv = G.MOVES[seq[k]];
      rhythm = { mv, id: seq[k], t: 0, dur: Math.max(0.55, 0.95 - P.tai * 0.03), zone: 0.72, zw: 0.12 + P.tai * 0.008, hit: null };
      state = 'rhythm';
      rhythm.resolve = (q) => {
        rhythm = null;
        let m = q === 'crit' ? 1.5 : q === 'ok' ? 1 : 0.6;
        if (seq[k] === 'upper' && afterSweep) m *= 1.3;
        if (combo) m *= combo.mul;
        const id = seq[k];
        attack({ kind: 'tai', dmg: mv.dmg * m, crit: q === 'crit', strong: strong && k === 0, noReact: k > 0, targetDone: k > 0,
          onHit: (e) => {
            if (id === 'sweep') { e.t += 4; afterSweep = true; say('Подсечка! Враг теряет равновесие.'); }
            if (id === 'kick' && q === 'crit') pushBack(e, 1);
            if (q === 'crit') { pop(e, 'КРИТ!', PAL.yellow); fx.lines = 0.2; }
          } }, (hit, d) => {
          if (!hit) { k = seq.length; total = 0; return endTurn(6, 0.6); }
          total += d || 0; k++;
          if (dist() > 1 && k < seq.length) { say('Враг отлетел — цепочка прервана.'); k = seq.length; }
          wait(0.3, next);
        });
      };
    };
    next();
  }

  // мини-игра печатей
  function startSeals(tid, free, then) {
    const t = G.TECHS[tid];
    const mast = G.combat.mastery(tid);
    const n = Math.max(1, t.seals.length - mast);
    const seq = t.seals.slice(0, n);
    let limit = 1.2 + n * (0.75 + P.ctrl * 0.08) + (Hh.has('fast_hands') ? 1.5 : 0) - (Hh.has('big_chakra') ? 0.3 : 0);
    if (G.storage.settings.reactSlow) limit *= 1.35;
    seals = { tid, seq, i: 0, t: 0, limit, hint: mast < 2, free, then };
    state = 'seals'; focus = 0;
    if (!free) P.ch -= Math.round(t.ch * (1 - P.ctrl * 0.03));
  }
  function sealDone(res) {
    const s = seals; seals = null; const t = G.TECHS[s.tid];
    V['use_' + s.tid] = (V['use_' + s.tid] || 0) + 1; xp('nin', 2); xp('ctrl', 1);
    if (res === 'fail') { puff(P.pos, 10); AU.sfx.puff(); say('Пшик! Печати сорвались, чакра потрачена впустую.', '#ff9a7a'); P.ch = Math.max(0, P.ch - 4); return endTurn(6); }
    if (res === 'perfect') { stats.perfect++; gainWill(15); say('Идеальные печати!', PAL.yellow); }
    const pf = res === 'perfect';
    s.then(pf);
  }
  function doTech(tid, free) {
    if (confused()) return;
    startSeals(tid, free, (pf) => {
      const t = G.TECHS[tid];
      aura(P, pf ? '#ffe070' : '#7ac0ff', 0.7); if (tid === 'henge') { P.s.hidden = 'henge'; P.ambush = 1.9 + P.nin * 0.08; puff(P.pos, 12); AU.sfx.puff(); say('Хенге! Ты превратился в камень. Враг тебя потерял.', '#9ad0ff'); xp('gen', 1); return endTurn(t.w); }
      if (tid === 'bunshin') { P.clones = pf ? 3 : 2; puff(P.pos, 14); AU.sfx.puff(); say(`Буншин! Рядом с тобой ${P.clones} клона.`, '#9ad0ff'); return endTurn(t.w); }
      if (tid === 'fear') {
        const resist = clamp(E.gen * 0.07 + (has('smart') ? 0.1 : 0) - (pf ? 0.15 : 0) - P.gen * 0.03, 0.05, 0.8);
        xp('gen', 3);
        if (Math.random() < resist) { say(`${E.name} видит иллюзию насквозь: «Кай!»`, PAL.light); return endTurn(t.w); }
        E.s.fear = pf ? 3 : 2; fx.flash = 0.2; burst(E.pos, '#b060e0', 34); say(`Ложный страх! ${E.name} видит кошмар!`, '#d080e0'); return endTurn(t.w);
      }
      if (tid === 'sexy') {
        puff(P.pos, 16); AU.sfx.puff();
        if (ed.male && opts.enemy !== 'dummy' && opts.enemy !== 'dummy2') { E.s.stun = 1; E.t += 10; E.hp -= 6; pop(E, 'ФОНТАН!', PAL.pink, true); say(`Секси-дзюцу! ${E.name} отлетает с кровью из носа!`, PAL.pink); }
        else say(`Секси-дзюцу... ${E.name} смотрит с холодным презрением.`, PAL.light);
        return endTurn(t.w);
      }
      if (G.TECHS[tid].el) {
        const el = G.TECHS[tid].el; xp('nin', 3); xp('chakra', 1);
        const wet = E.wet > 0;
        const dmg = { fire: 20, water: 13, bolt: 18, wind: 10 }[el] * (pf ? 1.25 : 1) * (el === 'bolt' && wet ? 1.6 : el === 'fire' && wet ? 0.7 : 1);
        proj(P, E, el === 'fire' ? 'fire' : el === 'bolt' ? 'bolt' : el === 'water' ? 'water' : 'wind', el === 'wind' ? 3 : 1);
        aura(P, { fire: '#ff7a20', water: '#4a9ae8', bolt: '#e8e060', wind: '#bfe8d0' }[el], 0.6);
        say({ fire: 'Катон! Огненный шар!', water: 'Суйтон! Водяная пуля!', bolt: 'Райтон! Разряд!', wind: 'Футон! Порыв ветра!' }[el], PAL.yellow);
        return attack({ kind: 'nin', dmg, strong: true, onHit: (e) => {
          if (el === 'water') e.wet = 3;
          if (el === 'fire') { e.wet = 0; burst(e.pos, '#ff9030', 34); }
          if (el === 'bolt') { burst(e.pos, '#f0f070', 34); if (Math.random() < 0.4 + (wet ? 0.3 : 0)) { e.s.stun = 1; pop(e, 'ОГЛУШЁН', PAL.yellow); } }
          if (el === 'wind') { pushBack(e, 2); e.t += 4; }
        } }, () => endTurn(G.TECHS[tid].w));
      }
      if (tid === 'shunshin') {
        const behind = E.pos + sgn(P, E); if (canStand(P, behind)) P.pos = behind;
        puff(P.pos, 8); leaves(P.pos, 16); P.ambush = 1.5; fx.lines = 0.4; say('Шуншин! Ты у врага за спиной — и ещё один ход!', PAL.yellow);
        P.t = Math.min(P.t, E.t - 0.1); return wait(0.6, nextTurn);
      }
    });
  }

  function doMoment(kind) {
    P.will = 0; moment = null;
    if (kind === 'final') {
      fx.cut = { t: 0, text: 'ФИНАЛЬНОЕ КОМБО', who: 'hero' }; fx.hitstop = 0.15; fx.flash = 0.4; fx.lines = 0.8; aura(P, '#ffb030', 1.2); burst(P.pos, '#ffb030', 36);
      say('ФИНАЛЬНОЕ КОМБО!', PAL.yellow);
      if (dist() > 1) step(P, true, dist() - 1);
      return attack({ kind: 'tai', dmg: 14 + P.tai * 1.3, crit: true, noReact: true, targetDone: true, onHit: (e) => { e.t += 6; } }, () => endTurn(8, 0.9));
    }
    if (kind === 'heal') { const h = Math.round(P.hpMax * 0.5); P.hp = Math.min(P.hpMax, P.hp + h); P.ch = Math.min(P.chMax, P.ch + Math.round(P.chMax * 0.5)); P.br = P.brMax; pop(P, '+' + h, '#8ae070', true); say('Второе дыхание! Силы возвращаются!', '#8ae070'); return endTurn(5, 0.8); }
  }

  // ── конец боя ──
  function checkEnd() {
    if (result) { finish(); return true; }
    if (E.hp <= 0 && ed.phase2 && E.phase === 1) {
      E.phase = 2; E.hp = Math.round(E.hpMax * 0.6); E.focus = E.focusMax; bubble('low'); fx.flash = 0.4; fx.shake = 0.5;
      say(`${E.name} в ярости! Вторая фаза!`, '#ff6a3a');
      if (opts.allies && opts.allies.includes('naruto')) { E.hp -= 20; say('Наруто: «Теневое клонирование!» Сотня клонов колотит Мизуки! (−20)', PAL.yellow); }
      return false;
    }
    const sp = mode === 'spar' || mode === 'ringout';
    if (E.hp <= 0 || (sp && E.hp <= E.hpMax * 0.3) || ((mode === 'bells' || mode === 'scroll') && E.hp <= E.hpMax * 0.25)) { result = { win: true }; finish(); return true; }
    if (P.hp <= 0 || (sp && P.hp <= P.hpMax * 0.3) || ((mode === 'bells' || mode === 'scroll') && P.hp <= P.hpMax * 0.3)) { P.hp = Math.max(P.hp, mode === 'ko' ? 0 : 1); result = { win: false }; finish(); return true; }
    return false;
  }
  function finish() {
    state = 'end'; stT = 0;
    fx.slow = 1.1; fx.zoomT = 1.28; fx.zoomX = X(result.win ? E.pos : P.pos); fx.flash = 0.35; fx.shake = 0.35; fx.ko = { t: 0, win: result.win };
    for (const f of [P, E]) if ((result.win ? f === E : f === P)) { hurt(f, 20); V1({ type: 'ring', x: X(f.pos), y: cy(), r: 46, dur: 0.6, col: '#ffffff' }); }
    result.mode = mode; result.enemy = opts.enemy; result.turns = pTurns; result.perfect = stats.perfect;
    if (result.win) { sfx.win(); bubble('lose'); } else { sfx.lose(); bubble('win'); }
    // обновить HP/чакру вне боя
    V.hp = real ? clamp(Math.round(P.hp / P.hpMax * 100), result.win ? 5 : 15, 100) : 100;
    V.chakra = clamp(Math.round(P.ch / P.chMax * 100), 0, 100);
    V.battles = (V.battles || 0) + 1; if (result.win) V.wins = (V.wins || 0) + 1;
    if (G.train && G.train.addXp) for (const [k, n] of Object.entries(stats.used)) G.train.addXp(k, n * (result.win ? 1.5 : 1), true);
  }

  // ── панель команд ──
  function mainButtons() {
    return [
      { label: 'Движение', act: () => open('move') },
      { label: 'Тайдзюцу', act: () => open('tai'), off: dist() > 1 ? 'Нужно вплотную' : P.s.high ? 'Ты на дереве' : P.br < 1 ? 'Нет дыхания' : null },
      { label: 'Метание', act: () => open('throw'), off: P.s.bound && false },
      { label: 'Ниндзюцу', act: () => open('tech') },
      { label: 'Инструм.', act: () => open('tool') },
      { label: P.will >= 100 ? 'Ещё ★' : 'Ещё', act: () => open('misc'), hot: P.will >= 100 },
    ];
  }
  function subButtons() {
    const b = [];
    const d = dist();
    if (menu === 'move') {
      const bound = P.s.bound ? 'Ты связан' : null;
      b.push({ label: 'Вперёд', sub: '', act: () => doMove('fwd'), off: bound || (d <= 1 ? 'Уже вплотную' : null), desc: 'Шаг к врагу.' });
      b.push({ label: 'Назад', act: () => doMove('back'), off: bound, desc: 'Шаг назад.' });
      b.push({ label: 'Рывок', sub: '1 дых.', act: () => doMove('dash'), off: bound || (P.br < 1 ? 'Нет дыхания' : d <= 1 ? 'Уже вплотную' : null), desc: 'Сразу на 2 клетки к врагу.' });
      b.push({ label: 'Отскок', sub: '1 дых.', act: () => doMove('hop'), off: bound || (P.br < 1 ? 'Нет дыхания' : null), desc: 'Назад, и следующий удар может промахнуться.' });
      if (objAt(P.pos) === 'tree') b.push(P.s.high ? { label: 'Спрыгнуть', act: () => doMove('down') } : { label: 'Залезть', sub: '5 чакры', act: () => doMove('climb'), off: (P.ctrl < 5 && !G.state.flags.tech_tree) ? 'Нужен Контроль 5' : P.ch < 5 ? 'Мало чакры' : null, desc: 'Наверх: тайдзюцу не достанет, метание ×1,3.' });
      else if (objAt(P.pos) === 'bush') b.push({ label: 'Спрятаться', act: () => doMove('hide'), off: P.s.hidden ? 'Уже спрятан' : null, desc: 'Засада: следующая атака ×1,5.' });
    } else if (menu === 'tai') {
      for (const id of ['punch', 'kick', 'sweep', 'upper']) b.push({ label: G.MOVES[id].name, sub: '1 дых.', desc: G.MOVES[id].desc, off: chain.length >= Math.min(3, P.br) ? 'Цепочка полна' : null, act: () => { chain.push(id); comboId = null; AU.sfx.select(); } });
      for (const cid of Object.keys(G.COMBOS)) if (G.combat.knowsCombo(cid)) { const c = G.COMBOS[cid]; b.push({ label: c.name, sub: '3 дых.', desc: c.desc + ' (' + c.seq.map((m) => G.MOVES[m].name).join(' > ') + ')', off: P.br < 3 ? 'Нужно 3 дыхания' : null, act: () => { chain = c.seq.slice(); comboId = cid; runChain(); } }); }
      b.unshift({ label: chain.length ? '▶ Атака!' : '▶ Атака', sub: chain.length + '/3', hot: chain.length > 0, act: () => runChain(), off: chain.length ? null : 'Выбери приёмы' });
    } else if (menu === 'throw') {
      b.push({ label: 'Кунай', sub: 'x' + inv('kunai'), act: () => doThrow('kunai'), off: inv('kunai') < 1 ? 'Нет кунаев' : null, desc: 'Урон 7. Средний вес.' });
      b.push({ label: 'Сюрикен', sub: 'x' + inv('shuriken'), act: () => doThrow('shuriken'), off: inv('shuriken') < 1 ? 'Нет сюрикенов' : null, desc: 'Урон 5. Самый быстрый.' });
      b.push({ label: 'Веер', sub: '3 сюр.', act: () => doThrow('fan'), off: P.spd < 5 ? 'Нужна Скорость 5' : inv('shuriken') < 3 ? 'Нужно 3 сюрикена' : null, desc: 'Три сюрикена разом. Урон 12.' });
      b.push({ label: 'Проволока', sub: 'кунай+пров.', act: () => doThrow('wire'), off: inv('wire') < 1 || inv('kunai') < 1 ? 'Нужны кунай и проволока' : null, desc: 'Опутать врага на 2 хода.' });
    } else if (menu === 'tech') {
      for (const tid of G.TECH_ORDER) if (G.combat.knows(tid)) {
        const t = G.TECHS[tid], cost = Math.round(t.ch * (1 - P.ctrl * 0.03));
        b.push({ label: t.name, sub: cost + ' чакры', desc: t.desc + ' Мастерство: ' + G.combat.mastery(tid) + '/3', off: P.ch < cost ? 'Мало чакры' : null, act: () => doTech(tid) });
      }
      if (!b.length) b.push({ label: 'Пока нет', off: 'Техники изучаются на уроках', act: () => {} });
    } else if (menu === 'tool') {
      const it = (id, label, kind, desc, cond) => { if (inv(id) > 0) b.push({ label, sub: 'x' + inv(id), act: () => doTool(kind), desc, off: cond || null }); };
      it('smoke_bomb', 'Дым. бомба', 'smoke', 'Ослепить врага и скрыться.');
      it('flash_bomb', 'Вспышка', 'flash', 'Ослепить врага.');
      it('tag_explosive', 'Взрыв. печать', 'tag', 'Бросок: урон 18.');
      if (inv('book_traps') > 0) {   // ловушки открывает учебник (награда полевого выхода или книжная лавка)
        it('tag_explosive', 'Ловушка-печать', 'trap_tag', 'Поставить перед собой: взрыв 22.');
        it('wire', 'Ловушка-пров.', 'trap_wire', 'Поставить перед собой: связывает.');
      }
      it('bandage', 'Бинт', 'bandage', '+25% HP.', P.hp >= P.hpMax ? 'Здоров' : null);
      it('chakra_pill', 'Пилюля', 'pill', '+50% чакры.');
      if (!b.length) b.push({ label: 'Пусто', off: 'Купи в оружейной и аптеке', act: () => {} });
    } else if (menu === 'misc') {
      if (P.will >= 100) b.push({ label: 'Воля Огня!', hot: true, act: () => doMisc('will'), desc: 'Кинематографичный момент!' });
      if (mode === 'bells' || mode === 'scroll') b.push({ label: mode === 'bells' ? 'Колокольчик' : 'Свиток', act: () => doMisc('grab'), off: d > 1 ? 'Нужно вплотную' : null, desc: 'Сорвать! Шанс выше, если враг оглушён, ослеплён, связан или после финта.' });
      b.push({ label: 'Защита', sub: '+2 дых.', act: () => doMisc('guard'), desc: 'Меньше урона, восстановить дыхание.' });
      b.push({ label: 'Концентр.', sub: '+чакра', act: () => doMisc('conc'), desc: '+чакра и Фокус, но ты уязвим.' });
      b.push({ label: 'Анализ', act: () => doMisc('analyze'), desc: 'Истинное намерение, слабость, ловушки, настоящий клон.' });
      b.push({ label: 'Финт', act: () => doMisc('feint'), desc: 'Выманить Каварими врага. Быстрое действие.' });
      b.push({ label: 'Провокация', act: () => doMisc('prov'), desc: 'Враг бьёт сильнее, но неточно и лезет вперёд.' });
      if (mode !== 'ko' && mode !== 'survive' && !opts.story) b.push({ label: 'Сдаться', act: () => doMisc('give') });
    } else if (menu === 'momentPick') {
      b.push({ label: 'Финал. комбо', hot: true, act: () => doMoment('final'), desc: 'Неотразимая серия. Огромный урон.' });
      for (const tid of G.TECH_ORDER) if (G.combat.knows(tid)) b.push({ label: G.TECHS[tid].name + '!', act: () => { P.will = 0; moment = null; doTech(tid, true); }, desc: 'Бесплатно и в полную силу.' });
      b.push({ label: 'Второе дыхание', act: () => doMoment('heal'), desc: '+50% HP и чакры.' });
    }
    return b;
  }
  function open(m) { menu = m; page = 0; focus = 0; AU.sfx.select(); if (m !== 'tai') chain = []; }
  function pageButtons() {
    if (menu === 'main') return mainButtons();
    const all = subButtons();
    const back = menu === 'momentPick' ? null : { label: '< Назад', act: () => { if (menu === 'tai' && chain.length) { chain.pop(); AU.sfx.cancel(); return; } menu = 'main'; focus = 0; AU.sfx.cancel(); } };
    const per = back ? 5 : 6;
    if (all.length <= per) return back ? all.concat([back]) : all;
    const pages = Math.ceil(all.length / (per - 1));
    page = page % pages;
    const slice = all.slice(page * (per - 1), page * (per - 1) + per - 1);
    slice.push({ label: 'Ещё ' + (page + 1) + '/' + pages, act: () => { page = (page + 1) % pages; focus = 0; AU.sfx.blip(); } });
    if (back) slice.push(back);
    return slice;
  }
  function gridRects(n, cols = 3) {
    const y0 = layout.pn + 3, h = layout.panelH - 6, rows = Math.ceil(n / cols) || 1;
    const bw = Math.floor((W - 8) / cols), bh = Math.floor(h / Math.max(2, rows));
    const out = [];
    for (let i = 0; i < n; i++) out.push({ x: 4 + (i % cols) * bw, y: y0 + Math.floor(i / cols) * bh, w: bw - 2, h: bh - 2 });
    return out;
  }
  function navGrid(n, cols = 3) {
    const I = G.input;
    if (focus >= n) focus = 0;
    if (I.pressed('left')) { focus = (focus + n - 1) % n; AU.sfx.blip(); }
    if (I.pressed('right')) { focus = (focus + 1) % n; AU.sfx.blip(); }
    if (I.pressed('up')) { focus = (focus - cols + n * 3) % n; AU.sfx.blip(); }
    if (I.pressed('down')) { focus = (focus + cols) % n; AU.sfx.blip(); }
    if (I.tapNow) { const rs = gridRects(n, cols); const i = rs.findIndex((r) => I.tapNow.x >= r.x && I.tapNow.x < r.x + r.w && I.tapNow.y >= r.y && I.tapNow.y < r.y + r.h); if (i >= 0) { focus = i; return 'a'; } }
    if (I.pressed('a')) return 'a';
    if (I.pressed('b')) return 'b';
    return null;
  }

  // ── сцена ──
  const S = {
    name: 'battle', P, E, opts, timeline: () => timeline(),
    get state() { return state; },
    // для автотеста
    debugWin() { result = { win: true }; finish(); },
    debugLose() { result = { win: false }; finish(); },
    // для симулятора баланса (systems/sim.js): прямой доступ к решениям без ввода
    sim: {
      startLog() { simLog = []; return simLog; },
      dist: () => dist(), obj: (pos) => objAt(pos), menu: () => menu, result: () => result,
      buttons(m) { const sv = menu; menu = m; const b = m === 'main' ? mainButtons() : subButtons(); menu = sv; return b.map((x) => ({ label: x.label, off: !!x.off })); },
      press(m, label) {
        if (state !== 'menu') return false;
        const sv = menu; menu = m;
        const b = (m === 'main' ? mainButtons() : subButtons()).find((x) => x.label === label);
        if (!b || b.off) { menu = sv; return false; }
        b.act();
        if (m === 'tai' && state === 'menu' && chain.length) runChain();   // комбо: сразу в атаку
        if (state === 'menu' && m !== 'momentPick') menu = 'main';
        return true;
      },
      rhythm(hit) { if (state === 'rhythm') { state = 'busy'; rhythm.resolve(hit); } },
      seals(res) { if (state === 'seals') { state = 'busy'; sealDone(res); } },
      react(choice) { if (state === 'react') { state = 'busy'; resolveReact(choice); } },
      reactInfo() { return react ? { kind: react.a.kind, dmg: react.dmg, kawa: G.combat.knows('kawarimi') && P.focus >= 1 && P.ch >= G.TECHS.kawarimi.ch } : null; },
      target(real) { if (state === 'target') { const n = E.clones + 1; chooseTarget(real || n < 2 ? E.realIdx : (E.realIdx + 1 + Math.floor(Math.random() * (n - 1))) % n); } },
      moment() { if (state === 'moment' && moment) moment.t = 9; },
    },
    act(kind, arg) {
      if (state !== 'menu') return false;
      const map = { move: doMove, throw: doThrow, tool: doTool, misc: doMisc };
      if (kind === 'tai') { chain = arg.slice(); comboId = null; runChain(); return true; }
      if (kind === 'tech') { doTech(arg); return true; }
      map[kind](arg); return true;
    },
    enter() { relayout(); plan(); say(`${ed.name}! Бой начинается!`, PAL.yellow); bubble('start'); if (opts.ambush) say('Засада! Ты атакуешь первым.', PAL.yellow); },
    update(dt) {
      fx.t += dt;
      if (fx.hitstop > 0) { fx.hitstop -= dt; return; }
      const vdt = fx.slow > 0 ? dt * 0.35 : dt; if (fx.slow > 0) fx.slow -= dt;
      if (state !== 'end') fx.zoomT = 1;
      fx.zoom += (fx.zoomT - fx.zoom) * Math.min(1, dt * 7);
      fx.bars += (fx.barsT - fx.bars) * Math.min(1, dt * 8);
      fx.barsT = (state === 'react' || state === 'intro' || state === 'seals' || state === 'moment' || fx.cut) ? 1 : 0;
      if (fx.cut) { fx.cut.t += dt; if (fx.cut.t > 1.0) fx.cut = null; }
      relayout();
      const I = G.input;
      updateVfx(vdt);
      fx.shake = Math.max(0, fx.shake - dt); fx.flash = Math.max(0, fx.flash - dt); fx.lines = Math.max(0, fx.lines - dt);
      fx.pops.forEach((p) => { p.t += dt; }); fx.pops = fx.pops.filter((p) => p.t < 1.1);
      fx.puffs.forEach((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; }); fx.puffs = fx.puffs.filter((p) => p.t < 0.7);
      fx.logs.forEach((l) => { l.t += dt; }); fx.logs = fx.logs.filter((l) => l.t < 1.2);
      if (fx.bubble) { fx.bubble.t -= dt; if (fx.bubble.t <= 0) fx.bubble = null; }
      S.time = (S.time || 0) + dt;

      switch (state) {
        case 'intro': stT -= dt; if (stT <= 0 || I.pressed('a') || I.tapNow) nextTurn(); return;
        case 'anim': animT -= dt; if (animT <= 0) { const f = after; after = null; state = 'busy'; f && f(); } return;
        case 'enemy': stT -= dt; if (stT <= 0) enemyAct(); return;
        case 'menu': {
          const bs = pageButtons(); if (focus >= bs.length) focus = 0;
          const k = navGrid(bs.length);
          if (k === 'a') { const b = bs[focus]; if (b.off) { AU.sfx.error(); say(b.off, '#ff9a7a'); } else { b.act(); } }
          else if (k === 'b' && menu !== 'main' && menu !== 'momentPick') { if (menu === 'tai' && chain.length) { chain.pop(); AU.sfx.cancel(); } else { menu = 'main'; focus = 0; AU.sfx.cancel(); } }
          return;
        }
        case 'target': {
          const k = navGrid(E.clones + 1);
          if (k === 'a') chooseTarget(focus);
          return;
        }
        case 'rhythm': {
          const r = rhythm; r.t += dt; const p = r.t / r.dur;
          if (I.pressed('a') || I.tapNow) { const dd = Math.abs(p - r.zone); r.hit = dd <= r.zw / 2 ? 'crit' : dd <= r.zw * 1.6 ? 'ok' : 'weak'; state = 'busy'; r.resolve(r.hit); return; }
          if (p >= 1) { state = 'busy'; r.resolve('weak'); }
          return;
        }
        case 'seals': {
          const s = seals; s.t += dt;
          if (s.t >= s.limit) { state = 'busy'; sealDone('fail'); return; }
          const k = navGrid(12, 4);
          if (k === 'a') {
            sfx.seal(); V1({ type: 'ring', x: X(P.pos), y: layout.groundY - 56, r: 14, dur: 0.25, col: '#9ad0ff' });
            if (focus === s.seq[s.i]) { s.i++; if (s.i >= s.seq.length) { state = 'busy'; sealDone(s.t <= s.limit * 0.55 ? 'perfect' : 'ok'); } }
            else { state = 'busy'; sealDone('fail'); }
          }
          return;
        }
        case 'react': {
          const r = react; r.t += dt;
          if (r.sub === 'kawa') {
            r.kt += dt;
            if (r.kt > 1.3 + (Hh.has('fast_hands') ? 0.5 : 0)) { state = 'busy'; resolveReact('kawa_fail'); return; }
            const k = navGrid(3);
            if (k === 'a') { state = 'busy'; resolveReact(r.opts[focus] === r.need ? 'kawa_ok' : 'kawa_fail'); }
            return;
          }
          if (r.sub === 'clash') {
            r.kt += dt; if (I.pressed('a') || I.tapNow) { r.taps++; sfx.clang(); fx.shake = 0.05; }
            if (r.kt >= 1.5) { state = 'busy'; resolveReact(r.taps >= Math.round(3 + E.spd * 0.35) ? 'clash_ok' : 'clash_fail'); }
            return;
          }
          if (r.t >= r.max) { state = 'busy'; resolveReact('none'); return; }
          const bs = reactButtons();
          const k = navGrid(bs.length, 2);
          if (k === 'a') { const b = bs[focus]; if (b.off) { AU.sfx.error(); return; } b.act(); }
          return;
        }
        case 'moment': {
          moment.t += dt;
          if (moment.t > 1.8 || (moment.t > 0.6 && (I.pressed('a') || I.tapNow))) {
            if (moment.pick) { state = 'menu'; menu = 'momentPick'; focus = 0; }
            else { moment = null; state = 'menu'; menu = 'main'; focus = 0; say('Воля Огня разгорается! (+35)', PAL.orangeLight); }
          }
          return;
        }
        case 'end': stT += dt; if (stT > 1.0 && (I.pressed('a') || I.pressed('b') || I.tapNow)) { G.audio.sfx.confirm(); G.scenes.pop(); onEnd && onEnd(result); } return;
        default: return;
      }
    },
    draw(ctx) { drawAll(ctx); },
  };

  function chooseTarget(i) {
    const tg = target; target = null;
    if (i === E.realIdx) { say('Это настоящий!', PAL.yellow); tg.spec.targetDone = true; state = 'busy'; attack(tg.spec, tg.then); }
    else { E.clones--; puff(E.pos, 10); AU.sfx.puff(); say('Пуф! Это был клон.', PAL.light); E.realIdx = Math.floor(Math.random() * (E.clones + 1)); endTurn(6); }
  }

  function reactButtons() {
    const r = react, d = dist(), cost = Math.round(G.TECHS.kawarimi.ch * (objAt(P.pos) === 'logs' ? 0.5 : 1));
    return [
      { label: 'Блок', sub: '1 дых.', off: P.br < 1 ? 1 : 0, act: () => { state = 'busy'; resolveReact('block'); } },
      { label: 'Уклон', sub: 'Скорость', act: () => { state = 'busy'; resolveReact('dodge'); } },
      { label: 'Каварими', sub: 'Фокус+' + cost + 'ч', off: !G.combat.knows('kawarimi') || P.focus < 1 || P.ch < cost ? 1 : 0,
        act: () => { const need = G.TECHS.kawarimi.seals[Math.floor(Math.random() * 5)]; const o = [need]; while (o.length < 3) { const x = Math.floor(Math.random() * 12); if (!o.includes(x)) o.push(x); } o.sort(() => Math.random() - 0.5); r.sub = 'kawa'; r.kt = 0; r.need = need; r.opts = o; focus = 0; } },
      { label: 'Кунай', sub: 'встречный', off: d > 1 || inv('kunai') < 1 || r.a.kind !== 'tai' ? 1 : 0, act: () => { r.sub = 'clash'; r.kt = 0; r.taps = 0; } },
    ];
  }

  // ── отрисовка ──
  function bar(ctx, x, y, w, h, v, max, col) {
    ctx.fillStyle = '#14121c'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * clamp(v / max, 0, 1)), h);
  }
  function drawFighter(ctx, f, x, y, face) {
    x += (f.kb || 0) + (f.lg || 0);
    if (f.hurt > 0) {
      const blink = Math.floor(f.hurt * 24) % 2 === 0;
      ctx.save(); ctx.globalAlpha *= blink ? 0.55 : 1; drawFighter0(ctx, f, x, y, face); ctx.restore();
      if (blink) { ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.ellipse(x, y - 16, 9, 18, 0, 0, 7); ctx.fill(); ctx.restore(); }
      return;
    }
    drawFighter0(ctx, f, x, y, face);
  }
  function drawFighter0(ctx, f, x, y, face) {
    const id = f.spr;
    if (id === 'dummy') {
      ctx.fillStyle = PAL.trunk; ctx.fillRect(x - 2, y - 34, 4, 34); ctx.fillRect(x - 12, y - 28, 24, 4);
      ctx.fillStyle = '#d8c070'; ctx.fillRect(x - 7, y - 44, 14, 12); ctx.fillStyle = PAL.ink; ctx.fillRect(x - 3, y - 40, 2, 2); ctx.fillRect(x + 2, y - 40, 2, 2);
      ctx.fillStyle = '#c8a050'; ctx.fillRect(x - 6, y - 26, 12, 14); return;
    }
    if (id === 'dog') {
      ctx.fillStyle = '#8a6a4a'; ctx.fillRect(x - 12, y - 14, 22, 10); ctx.fillRect(face < 0 ? x - 18 : x + 6, y - 20, 10, 9);
      ctx.fillRect(x - 10, y - 5, 3, 5); ctx.fillRect(x + 5, y - 5, 3, 5); ctx.fillStyle = PAL.ink; ctx.fillRect(face < 0 ? x - 16 : x + 12, y - 18, 2, 2); return;
    }
    const sheet = G.chars.sheet(id), FW = G.chars.FW, FH = G.chars.FH;
    const row = face < 0 ? 1 : 2;
    const fr = state === 'enemy' && f === E ? 1 : 0;
    ctx.drawImage(sheet, fr * FW, row * FH, FW, FH, Math.round(x - FW), Math.round(y - FH * 2 + 2), FW * 2, FH * 2);
  }
  function drawObj(ctx, kind, x, gy, t) {
    if (kind === 'tree') { ctx.fillStyle = PAL.trunkDark; ctx.fillRect(x - 4, gy - 46, 8, 46); ctx.fillStyle = A.dark ? '#1e3a26' : PAL.leaf; ctx.beginPath(); ctx.arc(x, gy - 50, 15, 0, 7); ctx.fill(); ctx.fillStyle = A.dark ? '#24462e' : PAL.grass; ctx.beginPath(); ctx.arc(x - 5, gy - 54, 8, 0, 7); ctx.fill(); }
    if (kind === 'bush') { ctx.fillStyle = A.dark ? '#1e3a26' : PAL.leaf; ctx.beginPath(); ctx.arc(x - 6, gy - 5, 7, 0, 7); ctx.arc(x + 5, gy - 6, 8, 0, 7); ctx.fill(); ctx.fillStyle = A.dark ? '#2a4a30' : PAL.grassLight; ctx.fillRect(x - 3, gy - 11, 3, 2); }
    if (kind === 'rock') { ctx.fillStyle = PAL.stoneDark; ctx.fillRect(x - 11, gy - 12, 22, 12); ctx.fillStyle = PAL.stone; ctx.fillRect(x - 9, gy - 14, 16, 8); }
    if (kind === 'logs') { ctx.fillStyle = PAL.wood; for (let i = 0; i < 3; i++) ctx.fillRect(x - 12 + i * 3, gy - 6 - i * 5, 22 - i * 6, 5); ctx.fillStyle = PAL.woodDark; ctx.fillRect(x - 12, gy - 2, 22, 2); }
    if (kind === 'water') { ctx.fillStyle = PAL.water; ctx.fillRect(x - 18, gy - 3, 36, 8); ctx.fillStyle = PAL.waterLight; ctx.fillRect(x - 14 + Math.round(Math.sin(t * 3) * 3), gy - 1, 8, 1); ctx.fillRect(x + 4, gy + 2, 6, 1); }
  }

  // ── погода и атмосфера арены ──
  const WEATHER = { field: 'leaves', yard: 'petals', forest: 'leaves', night: 'fireflies', river: 'mist', street: 'dust', ring: 'dust' };
  const wx = (G.life && G.life.raining && G.life.raining() && !A.dark) ? 'rain' : (A.weather || WEATHER[opts.terrain || 'field'] || 'leaves');
  const wparts = []; for (let i = 0; i < 26; i++) wparts.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random(), p: Math.random() * 6 });
  function drawWeather(ctx, t) {
    const L = layout; ctx.save(); ctx.beginPath(); ctx.rect(0, L.ar, W, L.arH); ctx.clip();
    for (const q of wparts) {
      const px = q.x * W, py = L.ar + q.y * L.arH;
      if (wx === 'rain') { const yy = L.ar + ((q.y + t * 1.6 * q.s) % 1) * L.arH, xx = (q.x * W - (t * 90 * q.s)) % W; ctx.fillStyle = 'rgba(170,200,240,0.55)'; ctx.fillRect(((xx % W) + W) % W, yy, 1, 7); }
      else if (wx === 'leaves') { const yy = L.ar + ((q.y + t * 0.12 * q.s) % 1) * L.arH, xx = (q.x * W + t * 20 * q.s + Math.sin(t * 2 + q.p) * 10) % W; ctx.fillStyle = q.p > 3 ? '#e8a030' : '#6aa040'; ctx.fillRect(xx, yy, 3, 2); }
      else if (wx === 'petals') { const yy = L.ar + ((q.y + t * 0.1 * q.s) % 1) * L.arH, xx = (q.x * W + t * 14 * q.s + Math.sin(t * 2 + q.p) * 8) % W; ctx.fillStyle = '#ffc0d4'; ctx.fillRect(xx, yy, 3, 2); ctx.fillRect(xx + 1, yy - 1, 2, 1); }
      else if (wx === 'fireflies') { const a = 0.5 + 0.5 * Math.sin(t * 3 + q.p * 3); ctx.globalAlpha = a; ctx.fillStyle = '#e8f080'; ctx.fillRect(px + Math.sin(t + q.p) * 8, L.groundY - 70 * q.y + Math.cos(t * 0.8 + q.p) * 6, 2, 2); ctx.globalAlpha = 1; }
      else if (wx === 'mist') { ctx.globalAlpha = 0.07; ctx.fillStyle = '#ffffff'; ctx.fillRect(((q.x * W + t * 6 * q.s) % (W + 80)) - 40, L.groundY - 8 - q.y * 22, 60, 5); ctx.globalAlpha = 1; }
      else if (wx === 'dust') { ctx.globalAlpha = 0.25; ctx.fillStyle = '#e8d8b0'; ctx.fillRect(((q.x * W + t * 24 * q.s) % W), L.groundY - 4 - q.y * 16, 2, 1); ctx.globalAlpha = 1; }
    }
    ctx.restore();
  }
  function drawCinema(ctx, t) {
    const L = layout, bh = Math.round(fx.bars * 14);
    if (bh > 0) { ctx.fillStyle = '#000'; ctx.fillRect(0, L.ar, W, bh); ctx.fillRect(0, L.ar + L.arH - bh, W, bh); }
    // VS-карточка
    if (state === 'intro') {
      const k = clamp((2.3 - stT) / 2.3, 0, 1), mid = L.ar + L.arH / 2;
      const a = clamp(k * 5, 0, 1) * clamp((1 - k) * 6, 0, 1);
      ctx.save(); ctx.globalAlpha = a * 0.85; ctx.fillStyle = '#10121e'; ctx.fillRect(0, mid - 38, W, 76);
      ctx.fillStyle = PAL.orange; ctx.fillRect(0, mid - 38, W, 2); ctx.fillRect(0, mid + 36, W, 2); ctx.globalAlpha = a;
      const slide = (1 - clamp(k * 4, 0, 1)) * 60;
      const por = (f, d) => G.chars.DEFS[f.spr] ? G.chars.portrait(f.spr) : G.chars.portrait(d);
      ctx.drawImage(por(P, 'hero'), W * 0.22 - 24 - slide, mid - 24, 48, 48);
      if (G.chars.DEFS[E.spr]) ctx.drawImage(G.chars.portrait(E.spr), W * 0.78 - 24 + slide, mid - 24, 48, 48);
      else { ctx.fillStyle = '#2a2a3a'; ctx.fillRect(W * 0.78 - 24 + slide, mid - 24, 48, 48); F.draw(ctx, '?', W * 0.78 + slide, mid - 4, { align: 'center', color: PAL.gray }); }
      F.draw(ctx, pName, W * 0.22, mid + 26, { align: 'center', color: PAL.white });
      F.draw(ctx, E.name, W * 0.78, mid + 26, { align: 'center', color: PAL.orangeLight });
      const sc = 1 + (1 - clamp(k * 6, 0, 1)) * 0.8;
      ctx.translate(W / 2, mid); ctx.scale(sc * 2, sc * 2); F.draw(ctx, 'VS', 0, -4, { align: 'center', color: PAL.yellow, outline: PAL.ink });
      ctx.restore();
    }
    // K.O.
    if (fx.ko && state === 'end') {
      fx.ko.t += 0.016; const k = clamp(fx.ko.t * 4, 0, 1), mid = L.ar + L.arH * 0.4;
      ctx.save(); ctx.globalAlpha = k; ctx.translate(W / 2, mid); ctx.scale(2 + (1 - k) * 2, 2 + (1 - k) * 2);
      F.draw(ctx, fx.ko.win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ', 0, -4, { align: 'center', color: fx.ko.win ? PAL.yellow : '#ff6a5a', outline: PAL.ink }); ctx.restore();
    }
    // вставка суперудара
    if (fx.cut) {
      const k = fx.cut.t, mid = L.ar + L.arH * 0.36, sl = clamp(k * 8, 0, 1);
      ctx.save(); ctx.globalAlpha = clamp((1 - k) * 4, 0, 1);
      ctx.fillStyle = '#e8621a'; ctx.beginPath(); ctx.moveTo(0, mid - 22); ctx.lineTo(W * sl, mid - 30); ctx.lineTo(W * sl, mid + 22); ctx.lineTo(0, mid + 30); ctx.fill();
      ctx.fillStyle = '#fff'; for (let i = 0; i < 8; i++) ctx.fillRect(((i * 61 + k * 500) % W), mid - 22 + (i * 11) % 44, 30, 1);
      ctx.drawImage(G.chars.portrait('hero'), W - 56 - (1 - sl) * 60, mid - 28, 56, 56);
      F.draw(ctx, fx.cut.text, 10, mid - 4, { color: PAL.white, outline: PAL.ink });
      ctx.restore();
    }
  }
  // дальний план: кроны деревьев (природа) или силуэты крыш (улица/арена), два слоя с дымкой
  function drawFar(ctx, L, W) {
    const nat = !(A.ring || A === G.ARENAS.street), base = L.groundY - 4;
    const haze = (c, k) => { const h = c.replace('#', ''); const n = [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)); const sk = A.sky[1].replace('#', ''); const m = [0, 2, 4].map((i) => parseInt(sk.substr(i, 2), 16)); return 'rgb(' + n.map((v, i) => Math.round(v + (m[i] - v) * k)).join(',') + ')'; };
    for (const [layer, k, step, hh] of [[0, 0.55, 30, 34], [1, 0, 22, 18]]) {
      ctx.fillStyle = haze(A.far, k);
      for (let i = -1; i * step < W + step; i++) {
        const x = i * step + (layer ? 0 : 11), h = hh + ((i * 7 + layer * 3) % 11) + Math.max(0, Math.round((L.arH - 120) * (layer ? 0.12 : 0.22) * (((i + layer) * 5) % 3) / 2));
        if (nat) {
          ctx.fillRect(x + step / 2 - 2, base - h * 0.5, 4, h * 0.5);
          ctx.beginPath(); ctx.ellipse(x + step / 2, base - h * 0.6, step * 0.62, h * 0.55, 0, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.ellipse(x + step / 2 + step * 0.3, base - h * 0.45, step * 0.45, h * 0.4, 0, 0, 7); ctx.fill();
        } else {
          ctx.fillRect(x, base - h, step - 2, h);
          ctx.beginPath(); ctx.moveTo(x - 3, base - h); ctx.lineTo(x + step / 2 - 1, base - h - 8); ctx.lineTo(x + step + 1, base - h); ctx.fill();
        }
      }
    }
  }
  function drawAll(ctx) {
    relayout();
    const L = layout, t = S.time || 0;
    ctx.fillStyle = '#14121c'; ctx.fillRect(0, 0, W, G.screen.H);
    const sx = fx.shake ? Math.round(rnd(-3, 3)) : 0, sy = fx.shake ? Math.round(rnd(-2, 2)) : 0;
    ctx.save(); ctx.translate(sx, sy);
    if (fx.zoom > 1.005) { const zx = fx.zoomX != null ? fx.zoomX : W / 2, zy = L.groundY - 20; ctx.translate(zx, zy); ctx.scale(fx.zoom, fx.zoom); ctx.translate(-zx, -zy); }
    // арена
    ctx.save(); ctx.beginPath(); ctx.rect(0, L.ar, W, L.arH); ctx.clip();
    // базовое приближение арены: на широких экранах бойцы крупнее (позиции 0–4 остаются в кадре)
    const bz = clamp((W - 16) / (4 * SP + 70), 1, 1.6), bzy = L.groundY + 6;
    ctx.save(); if (bz > 1.01) { ctx.translate(W / 2, bzy); ctx.scale(bz, bz); ctx.translate(-W / 2, -bzy); }
    // V8: фон арены — сгенерированный ассет (tools/assets/manifest.json). Нет картинки,
    // она не готова или ассеты выключены (?assets=0) — прежняя процедурная отрисовка.
    if (!G.assets.draw(ctx, 'arena_' + (opts.terrain || 'field'), 0, L.ar, W, L.arH)) {
      const bands = 6; for (let i = 0; i < bands; i++) { ctx.fillStyle = i < bands / 2 ? A.sky[0] : A.sky[1]; ctx.fillRect(0, L.ar + i * (L.arH / bands) * 0.7, W, L.arH); }
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 0; i < 4; i++) { const cx = ((i * 83 + t * (3 + i)) % (W + 60)) - 30, cy = L.ar + 10 + ((i * 29) % Math.max(20, L.arH - 90)); ctx.fillRect(cx, cy, 26, 5); ctx.fillRect(cx + 5, cy - 3, 14, 3); }
      drawFar(ctx, L, W);
      ctx.fillStyle = A.ground; ctx.fillRect(0, L.groundY - 4, W, L.arH);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 5; i++) ctx.fillRect(X(i) - 14, L.groundY + 2, 28, 3);
    if (A.ring) { const r0 = Math.max(4, X(0) - 20), r1 = Math.min(W - 4, X(4) + 20); ctx.fillStyle = '#a8683a'; ctx.fillRect(r0, L.groundY + 6, r1 - r0, 2); ctx.fillStyle = '#c8401c'; ctx.fillRect(r0, L.groundY - 4, 2, 12); ctx.fillRect(r1 - 2, L.groundY - 4, 2, 12); }
    for (const [pos, kind] of Object.entries(A.obj)) drawObj(ctx, kind, X(+pos), L.groundY, t);
    for (const tr of traps) if (tr.owner === 'p' || tr.seen) { ctx.fillStyle = tr.kind === 'tag' ? '#e8dcc0' : '#b8b0cc'; ctx.fillRect(X(tr.pos) - 4, L.groundY - 2, 8, 3); ctx.fillStyle = tr.owner === 'p' ? '#8ae070' : '#ff6a3a'; ctx.fillRect(X(tr.pos) - 1, L.groundY - 2, 2, 3); }
    // линии скорости
    if (fx.lines > 0) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 9; i++) { const y = L.ar + 6 + ((i * 37 + Math.floor(t * 60) * 13) % (L.arH - 12)); ctx.fillRect((i * 53 + Math.floor(t * 400)) % W, y, 26, 1); } }
    // бойцы
    const faceP = E.pos > P.pos ? 1 : -1;
    const lunge = (f) => (state === 'rhythm' && f === P ? faceP * 4 : 0);
    const yOf = (f) => L.groundY + (f.s.high ? -38 : 0);
    // враг + клоны
    const ex = X(E.pos);
    if (E.clones > 0) {
      const nC = E.clones + 1, offs = nC >= 3 ? [-11, 0, 11] : [-7, 7];
      for (let i = 0; i < nC; i++) {
        drawFighter(ctx, E, ex + offs[i], yOf(E) - (i === 1 ? 0 : 1), -faceP);
        if (i === E.realIdx && Math.sin(t * 4) > 0.6) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(ex + offs[i] + (-faceP) * 6, yOf(E) - 30, 2, 2); }
        if (state === 'target') F.draw(ctx, String(i + 1), ex + offs[i], yOf(E) - 50, { align: 'center', color: focus === i ? PAL.yellow : PAL.white });
        if (E.an > 0 && i === E.realIdx) F.draw(ctx, '▼', ex + offs[i], yOf(E) - 58, { align: 'center', color: PAL.yellow });
      }
    } else drawFighter(ctx, E, ex, yOf(E), -faceP);
    if (E.s.fear || E.s.stun) F.draw(ctx, E.s.fear ? '!!' : '*', ex, yOf(E) - 50, { align: 'center', color: '#d080e0' });
    if (E.s.bound) { ctx.fillStyle = '#b8b0cc'; ctx.fillRect(ex - 9, yOf(E) - 20, 18, 1); ctx.fillRect(ex - 9, yOf(E) - 14, 18, 1); }
    // герой
    const px = X(P.pos) + lunge(P);
    if (P.s.hidden === 'henge') { ctx.globalAlpha = 0.85; drawObj(ctx, 'rock', px, yOf(P), t); ctx.globalAlpha = 1; }
    else {
      if (P.s.hidden) ctx.globalAlpha = 0.45;
      for (let c = 0; c < P.clones; c++) { ctx.globalAlpha = 0.75; drawFighter(ctx, P, px - faceP * (10 + c * 9), yOf(P), faceP); }
      ctx.globalAlpha = P.s.hidden ? 0.45 : 1;
      drawFighter(ctx, P, px, yOf(P), faceP); ctx.globalAlpha = 1;
    }
    if (P.s.bound) { ctx.fillStyle = '#3a2a4a'; ctx.fillRect(px - 9, yOf(P) - 18, 18, 2); }
    drawVfx(ctx, t); drawSealGlow(ctx, t);
    drawWeather(ctx, t);
    // полено (Каварими)
    for (const lg of fx.logs) { ctx.globalAlpha = 1 - lg.t / 1.2; ctx.fillStyle = PAL.wood; ctx.fillRect(lg.x - 5, L.groundY - 26 + lg.t * 10, 10, 24); ctx.fillStyle = PAL.woodDark; ctx.fillRect(lg.x - 5, L.groundY - 26 + lg.t * 10, 10, 2); ctx.globalAlpha = 1; }
    for (const p of fx.puffs) { ctx.globalAlpha = 1 - p.t / 0.7; ctx.fillStyle = '#e8e4dc'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + p.t), 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    for (const p of fx.pops) F.draw(ctx, p.text, p.x, p.y - p.t * 18, { align: 'center', color: p.col });
    ctx.restore();
    if (fx.bubble) {
      const lines = F.wrap(fx.bubble.text, 120).slice(0, 3), bw = 128, bh = lines.length * 10 + 6;
      const bx = clamp(ex - bw / 2, 2, W - bw - 2), by = L.ar + 2;
      ctx.fillStyle = '#f8f4ec'; ctx.fillRect(bx, by, bw, bh); ctx.fillStyle = PAL.ink; ctx.fillRect(bx, by + bh, bw, 1);
      lines.forEach((l, i) => F.draw(ctx, l, bx + 4, by + 3 + i * 10, { color: PAL.ink }));
    }
    if (A.dark) { ctx.fillStyle = 'rgba(10,10,40,0.25)'; ctx.fillRect(0, L.ar, W, L.arH); }
    ctx.restore();

    drawCinema(ctx, t);
    // шкала ходов
    const tl = timeline();
    F.draw(ctx, 'Ходы', 3, 2, { color: PAL.gray });
    tl.forEach((s, i) => {
      const x = 30 + i * 18;
      ctx.fillStyle = s === 'p' ? '#2a4a7a' : '#7a2a2a'; ctx.fillRect(x, 1, 16, 10);
      F.draw(ctx, s === 'p' ? 'Я' : E.name[0], x + 8, 1, { align: 'center', color: i === 0 ? PAL.yellow : PAL.white });
    });
    const goal = { ko: 'нокаут', spar: 'спарринг', bells: 'колокольчик', scroll: 'свиток', survive: 'продержись', ringout: 'за край' }[mode];
    const goalExtra = (mode === 'bells' || mode === 'scroll') && opts.turns ? ` ${Math.max(0, opts.turns - pTurns + (state === 'menu' ? 1 : 0))}х` : mode === 'survive' && opts.turns ? ` ${Math.max(0, opts.turns - eTurns)}х` : '';
    F.draw(ctx, goal + goalExtra, W - 3, 2, { align: 'right', color: PAL.orangeLight });
    // враг
    ctx.fillStyle = '#24202f'; ctx.fillRect(0, L.eb, W, 21);
    F.draw(ctx, E.name + (E.phase === 2 ? ' (ярость)' : ''), 3, L.eb + 1, { color: PAL.white });
    bar(ctx, 3, L.eb + 12, 60, 3, E.hp, E.hpMax, '#d84a3a');
    if (E.chMax) bar(ctx, 3, L.eb + 16, 60, 2, E.ch, E.chMax, '#4a7ad8');
    if (mode === 'spar' || mode === 'ringout') { ctx.fillStyle = PAL.yellow; ctx.fillRect(3 + 18, L.eb + 11, 1, 5); }
    const intent = E.an > 0 ? E.plan : E.shown;
    F.draw(ctx, 'Намерение:', 68, L.eb + 1, { color: PAL.gray });
    F.draw(ctx, actName(intent) + (E.an > 0 ? ' ✔' : ''), 68, L.eb + 11, { color: (actOf(intent).kind === 'tai' || actOf(intent).kind === 'throw' || actOf(intent).kind === 'nin') ? '#ff9a7a' : PAL.light, maxW: W - 72 });
    if (E.plan2) F.draw(ctx, 'затем: ' + actName(E.plan2), W - 3, L.eb + 1, { align: 'right', color: PAL.gray, maxW: 64 });
    // герой
    ctx.fillStyle = '#24202f'; ctx.fillRect(0, L.pb, W, 24);
    F.draw(ctx, pName, 3, L.pb + 1, { color: PAL.white, maxW: 50 });
    F.draw(ctx, 'HP', 3, L.pb + 12, { color: PAL.gray });
    bar(ctx, 16, L.pb + 14, 46, 4, P.hp, P.hpMax, '#d84a3a'); F.draw(ctx, String(Math.max(0, P.hp)), 64, L.pb + 12, { color: PAL.white });
    F.draw(ctx, 'Ч', 84, L.pb + 12, { color: PAL.gray });
    bar(ctx, 92, L.pb + 14, 34, 4, P.ch, P.chMax, '#4a7ad8');
    F.draw(ctx, 'Дых', 56, L.pb + 1, { color: PAL.gray });
    for (let i = 0; i < P.brMax; i++) { ctx.fillStyle = i < P.br ? '#8ae0e0' : '#3a3548'; ctx.fillRect(76 + i * 6, L.pb + 4, 4, 4); }
    F.draw(ctx, 'Фокус', 130, L.pb + 1, { color: PAL.gray });
    for (let i = 0; i < P.focusMax; i++) { ctx.fillStyle = i < P.focus ? PAL.yellow : '#3a3548'; ctx.fillRect(162 + i * 8, L.pb + 3, 5, 5); }
    F.draw(ctx, 'Воля', 130, L.pb + 12, { color: P.will >= 100 && Math.sin(t * 8) > 0 ? PAL.yellow : PAL.orangeLight });
    bar(ctx, 156, L.pb + 14, 33, 4, P.will, 100, P.will >= 100 ? PAL.yellow : PAL.orange);
    // сообщения
    ctx.fillStyle = '#1a1724'; ctx.fillRect(0, L.ms, W, 22);
    if (state === 'menu' && menu === 'tai' && chain.length) F.draw(ctx, 'Цепочка: ' + chain.map((m) => G.MOVES[m].name).join(' > '), 3, L.ms + 1, { color: PAL.yellow, maxW: W - 6 });
    else if (state === 'menu') {
      const bs = pageButtons(), b = bs[focus];
      const desc = b && (b.off ? 'x ' + b.off : b.desc);
      if (desc) F.draw(ctx, desc, 3, L.ms + 1, { color: b.off ? '#ff9a7a' : PAL.light, maxW: W - 6 });
      else if (msgs.length) F.draw(ctx, msgs[msgs.length - 1].t, 3, L.ms + 1, { color: msgs[msgs.length - 1].col, maxW: W - 6 });
      if (msgs.length && desc) F.draw(ctx, msgs[msgs.length - 1].t, 3, L.ms + 11, { color: PAL.gray, maxW: W - 6 });
    } else msgs.forEach((m, i) => F.draw(ctx, m.t, 3, L.ms + 1 + i * 10, { color: m.col, maxW: W - 6 }));
    // панель
    ctx.fillStyle = '#100e18'; ctx.fillRect(0, L.pn, W, L.panelH + 40);
    const btn = (r, label, sub, on, off, hot) => {
      ctx.fillStyle = off ? '#1e1b28' : hot ? (Math.sin(t * 8) > 0 ? '#a8420c' : '#7a2a10') : '#2a2638'; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = on ? PAL.orange : '#3a3548'; ctx.fillRect(r.x, r.y, r.w, 1); ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1); ctx.fillRect(r.x, r.y, 1, r.h); ctx.fillRect(r.x + r.w - 1, r.y, 1, r.h);
      const ty = r.y + Math.max(1, Math.floor(r.h / 2) - (sub ? 9 : 5));
      F.draw(ctx, label, r.x + r.w / 2, ty, { align: 'center', color: off ? '#5a5670' : on ? PAL.yellow : PAL.white, maxW: r.w - 2 });
      if (sub) F.draw(ctx, sub, r.x + r.w / 2, ty + 10, { align: 'center', color: off ? '#4a4660' : PAL.gray, maxW: r.w - 2 });
    };
    if (state === 'menu') { const bs = pageButtons(); gridRects(bs.length).forEach((r, i) => btn(r, bs[i].label, bs[i].sub, i === focus, !!bs[i].off, bs[i].hot)); }
    else if (state === 'target') { const n = E.clones + 1, rs = gridRects(n), names = n >= 3 ? ['Левый', 'Средний', 'Правый'] : ['Левый', 'Правый']; names.forEach((l, i) => btn(rs[i], l, E.an > 0 && i === E.realIdx ? 'настоящий!' : 'кто из них?', i === focus)); }
    else if (state === 'react') {
      const r = react;
      F.draw(ctx, 'РЕАКЦИЯ!', W / 2, L.ar + 3, { align: 'center', color: Math.sin(t * 20) > 0 ? PAL.yellow : PAL.orange });
      if (r.sub === 'kawa') {
        F.draw(ctx, 'Печать: ' + G.SEALS[r.need] + '!', W / 2, L.ms + 1, { align: 'center', color: PAL.yellow });
        bar(ctx, 20, L.ms + 14, W - 40, 3, 1.3 - r.kt, 1.3, PAL.orange);
        gridRects(3).forEach((rc, i) => btn(rc, G.SEALS[r.opts[i]], '', i === focus));
      } else if (r.sub === 'clash') {
        F.draw(ctx, 'ЖМИ A БЫСТРО! ' + r.taps + '/' + Math.round(3 + E.spd * 0.35), W / 2, L.ms + 1, { align: 'center', color: PAL.yellow });
        bar(ctx, 20, L.ms + 14, W - 40, 3, 1.5 - r.kt, 1.5, PAL.orange);
        btn({ x: 20, y: L.pn + 8, w: W - 40, h: L.panelH - 16 }, 'ВСТРЕЧНЫЙ КУНАЙ!', 'дзинь-дзинь', true);
      } else {
        bar(ctx, 4, L.ms + 18, W - 8, 3, r.max - r.t, r.max, PAL.orange);
        const bs = reactButtons(); gridRects(4, 2).forEach((rc, i) => btn(rc, bs[i].label, bs[i].sub, i === focus, !!bs[i].off));
      }
    } else if (state === 'seals') {
      const s = seals;
      ctx.fillStyle = '#1a1724'; ctx.fillRect(0, L.ms, W, 22);
      bar(ctx, 4, L.ms + 18, W - 8, 3, s.limit - s.t, s.limit, s.t > s.limit * 0.55 ? PAL.orange : '#8ae070');
      s.seq.forEach((si, i) => { const x = W / 2 - s.seq.length * 19 + i * 38 + 19; F.draw(ctx, s.hint || i < s.i ? G.SEALS[si] : '???', x, L.ms + 4, { align: 'center', color: i < s.i ? '#8ae070' : i === s.i ? PAL.yellow : PAL.gray, maxW: 37 }); });
      F.draw(ctx, G.TECHS[s.tid].name, W / 2, L.ar + 3, { align: 'center', color: PAL.yellow });
      gridRects(12, 4).forEach((r, i) => { ctx.fillStyle = G.SEAL_COL[i]; ctx.fillRect(r.x + 2, r.y + 2, 3, r.h - 4); btn(Object.assign({}, r, { x: r.x + 5, w: r.w - 5 }), G.SEALS[i], '', i === focus); });
    } else if (state === 'rhythm') {
      const r = rhythm, p = clamp(r.t / r.dur, 0, 1), bx = 14, bw = W - 28, by = L.pn + L.panelH / 2 - 6;
      F.draw(ctx, r.mv.name + '! Жми A в жёлтой зоне', W / 2, L.pn + 6, { align: 'center', color: PAL.white });
      ctx.fillStyle = '#2a2638'; ctx.fillRect(bx, by, bw, 12);
      ctx.fillStyle = PAL.yellow; ctx.fillRect(bx + bw * (r.zone - r.zw / 2), by, bw * r.zw, 12);
      ctx.fillStyle = 'rgba(255,210,58,0.35)'; ctx.fillRect(bx + bw * (r.zone - r.zw * 1.6), by, bw * r.zw * 3.2, 12);
      ctx.fillStyle = PAL.white; ctx.fillRect(bx + bw * p - 1, by - 3, 3, 18);
    } else if (state === 'end') {
      const win = result.win;
      const title = win ? (result.ringout ? 'ПОБЕДА: ЗА КРАЕМ!' : 'ПОБЕДА!') : result.surrender ? 'ТЫ СДАЛСЯ' : result.timeout ? 'ВРЕМЯ ВЫШЛО' : 'ПОРАЖЕНИЕ';
      F.draw(ctx, title, W / 2, L.pn + 10, { align: 'center', color: win ? PAL.yellow : '#ff9a7a' });
      F.draw(ctx, `Ходов: ${pTurns} · реакций: ${stats.reacts}`, W / 2, L.pn + 24, { align: 'center', color: PAL.light, maxW: W - 8 });
      F.draw(ctx, `Идеальных печатей: ${stats.perfect}`, W / 2, L.pn + 35, { align: 'center', color: PAL.light, maxW: W - 8 });
      if (stT > 1.0) F.draw(ctx, 'Нажми A', W / 2, L.pn + 50, { align: 'center', color: PAL.gray });
    } else if (state === 'intro') {
      F.draw(ctx, A.name.toUpperCase(), W / 2, L.pn + 12, { align: 'center', color: PAL.gray });
      F.draw(ctx, `${pName}  VS  ${E.name}`, W / 2, L.pn + 28, { align: 'center', color: PAL.yellow });
    }
    ctx.restore();
    // момент (крупный план)
    if (state === 'moment' && moment) {
      const H = G.screen.H, k = Math.min(1, moment.t * 3);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f6c89a'; ctx.fillRect(0, H / 2 - 30 * k, W, 60 * k);
      ctx.fillStyle = '#3a2a2a'; ctx.fillRect(0, H / 2 - 30 * k, W, 10 * k);
      for (const ex2 of [W / 2 - 40, W / 2 + 40]) { ctx.fillStyle = '#fff'; ctx.fillRect(ex2 - 18, H / 2 - 6, 36, 14); ctx.fillStyle = '#3a5a8a'; ctx.fillRect(ex2 - 6, H / 2 - 6, 12, 14); ctx.fillStyle = '#14121c'; ctx.fillRect(ex2 - 3, H / 2 - 3, 6, 8); ctx.fillStyle = '#2a2030'; ctx.fillRect(ex2 - 20, H / 2 - 12, 40, 3); }
      ctx.fillStyle = 'rgba(232,98,26,' + (0.3 + 0.2 * Math.sin(moment.t * 10)) + ')'; ctx.fillRect(0, 0, W, H / 2 - 32); ctx.fillRect(0, H / 2 + 32, W, H / 2);
      F.draw(ctx, G.util.fmt(moment.line, { name: pName }), W / 2, H / 2 + 44, { align: 'center', color: PAL.white });
      F.draw(ctx, 'ВОЛЯ ОГНЯ', W / 2, H / 2 - 52, { align: 'center', color: PAL.yellow });
    }
    if (fx.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.8, fx.flash * 3) + ')'; ctx.fillRect(0, 0, W, G.screen.H); }
  }

  return S;
});

// Запуск боя из скрипта: call battle <enemy> <mode> <terrain> [после_победы] [после_поражения] [turns]
G.script.actions.battle = (a) => {
  G.game.pending = { type: 'battle', enemy: a[0], mode: a[1] || 'ko', terrain: a[2] || 'field', win: a[3] && a[3] !== '-' ? a[3] : null, lose: a[4] && a[4] !== '-' ? a[4] : null, turns: a[5] ? Number(a[5]) : 0 };
};
