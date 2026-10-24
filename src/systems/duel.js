// Карточная дуэль: чистая логика без экрана и без записи в сохранение.
// Игрок тратит до трёх действий на карты, затем враг выполняет видимое заранее намерение.
G.duel = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const SPAR_END = 0.3, RELEASE_HEAT = 60, RELEASE_COST = 25, BOOST = 1.5;
  const FAT_CARD = 0.45, FAT_ROUND = 1.1, HEAT_CARD = 3, HEAT_HIT = 5;
  const TUNE = { hp: 1.35, enemyDmg: 2.8, hand: 5, ap: 3 };

  function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const fatMul = (D) => D.P.fat > 90 ? 0.7 : D.P.fat > 70 ? 0.85 : 1;
  const isAttack = (D) => D.intent && ['strike', 'multi', 'tech', 'drain', 'bind'].includes(D.intent.kind);
  const cardDef = (id) => G.CARDS[id];

  // ── создание колоды и состояния ──
  function create(opts) {
    const rng = opts.rng || Math.random;
    const stats = opts.stats || G.state.hero.stats || {}, st = (k) => stats[k] || G.STAT_BASE;
    const skills = opts.skills || G.state.hero.skills || [], has = (s) => skills.includes(s);
    let ed = G.ENEMIES[opts.enemy] || G.ENEMIES.dummy;
    const day = opts.day != null ? opts.day : G.state.vars.day;
    if (ed.grow) ed = Object.assign({}, ed, { hp: Math.round(ed.hp * (1 + 0.025 * day)), tai: ed.tai + Math.floor(day / 9), spd: ed.spd + Math.floor(day / 14), end: ed.end + Math.floor(day / 21) });
    const hpMax = Math.round((60 + st('end') * 5) * (has('tough') ? 1.1 : 1));
    const chMax = Math.round((30 + st('chakra') * 10) * (has('big_chakra') ? 1.25 : 1));
    const mode = opts.mode || 'ko', real = mode === 'ko' || mode === 'survive';
    const P = {
      st, name: opts.name || (G.state && G.state.hero && G.state.hero.name) || 'Герой',
      hpMax, hp: real ? Math.max(1, Math.round(hpMax * (opts.hp == null ? 100 : opts.hp) / 100)) : hpMax,
      chMax, ch: Math.round(chMax * clamp(opts.chakra == null ? 100 : opts.chakra, 10, 100) / 100),
      fat: opts.fatigue == null ? 10 : opts.fatigue, fat0: opts.fatigue == null ? 10 : opts.fatigue,
      heat: 0, ap: TUNE.ap, block: 0, dodge: 0, riposte: 0, chain: 0, focus: 0, clones: 0,
      status: {}, hist: [], turnCards: [], techs: (opts.techs || []).filter((t) => G.TECHS[t]),
      knows: (t) => (opts.techs || []).includes(t),
    };
    P.stab0 = opts.stability != null ? opts.stability : (G.purple && G.state.started ? G.purple.stability() : 40);
    const ehp = Math.round(ed.hp * TUNE.hp);
    const E = Object.assign({}, ed, { id: opts.enemy, dmg: (ed.dmg != null ? ed.dmg : 4 + ed.tai * 1.2) * TUNE.enemyDmg, hpMax: ehp, hp: ehp, chMax: ed.ch, ch: ed.ch, status: {}, hist: [], cd: 0, block: 0, dodge: 0, charged: 0 });
    const D = {
      opts, rng, mode, rounds: opts.rounds || 6, P, E, round: 0, over: null, phase: 'player', intent: null,
      log: [], inv: Object.assign({}, opts.inv || {}), trainingFight: mode === 'spar',
      stats: { used: {}, sequence: [], cards: 0, damage: 0, taken: 0 }, turns: 0, deck: [], hand: [], discard: [], exhaust: [], usedItems: [],
      prevCards: [], notice: '', last: null, _uid: 0,
    };
    D.has = has;
    const ids = G.CARD_BASE_DECK.slice();
    for (const t of P.techs) for (let i = 0; i < G.CARD_TECH_LIMIT; i++) ids.push(t);
    if (opts.surge !== false) ids.push('release');
    for (const id of G.CARD_ITEM_ORDER) {
      const copies = Math.min(D.inv[id] || 0, id === 'bandage' ? 2 : 1);
      for (let i = 0; i < copies; i++) ids.push(id);
    }
    D.deck = ids.filter((id) => G.CARDS[id]).map((id) => ({ id, uid: ++D._uid }));
    shuffle(D, D.deck);
    startTurn(D, true);
    return D;
  }

  function shuffle(D, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(D.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function draw(D, n) {
    const out = [];
    while (n-- > 0) {
      if (!D.deck.length) {
        if (!D.discard.length) break;
        D.deck = D.discard.splice(0); shuffle(D, D.deck);
      }
      const c = D.deck.pop(); D.hand.push(c); out.push(c);
    }
    return out;
  }
  function startTurn(D, first = false) {
    if (D.over) return;
    D.round++;
    const P = D.P;
    P.ap = TUNE.ap; P.block = 0; P.dodge = 0; P.riposte = 0; P.chain = 0; P.turnCards = [];
    if (!first) P.ch = Math.min(P.chMax, P.ch + Math.round(6 + P.st('ctrl') * 0.5));
    D.phase = 'player';
    if (P.status.fear > 0) P.ap = Math.max(1, P.ap - 1);
    nextIntent(D);
    const size = Math.max(3, TUNE.hand - (P.status.fear > 0 ? 1 : 0));
    draw(D, Math.max(0, size - D.hand.length));
  }

  // ── намерения противника ──
  function strikeIntent(D) { return { kind: 'strike', name: 'Удар', dmg: D.E.dmg != null ? D.E.dmg : 4 + D.E.tai * 1.2, hits: 1 }; }
  function techIntent(D, charged = false) {
    const E = D.E, t = E.tech;
    if (!t) return strikeIntent(D);
    const power = (t.power || 1) * (charged ? 1.25 : 1);
    return { kind: t.kind === 'dmg' ? 'tech' : t.kind, name: t.name + (charged ? ' +' : ''), dmg: (E.dmg || 8) * power, hits: 1, cost: t.cost || 0, charged };
  }
  function weighted(D, entries) {
    let r = D.rng() * entries.reduce((s, x) => s + x[1], 0);
    for (const [value, weight] of entries) { r -= weight; if (r <= 0) return value; }
    return entries[entries.length - 1][0];
  }
  function decide(D) {
    const E = D.E;
    if (E.style === 'dummy') return { kind: 'idle', name: 'Ждёт' };
    if (E.charged) return techIntent(D, true);
    const techOk = E.tech && E.ch >= (E.tech.cost || 0) && E.cd <= 0;
    if (E.style === 'brute' && D.round % 3 === 1) return { kind: 'charge', name: 'Замах', interrupt: 3 };
    const prev = D.prevCards, tai = prev.filter((id) => G.CARDS[id] && G.CARDS[id].kind === 'tai').length;
    const tech = prev.filter((id) => G.CARDS[id] && G.CARDS[id].tech).length;
    const adapt = clamp(0.25 + E.know * 0.04, 0.2, 0.7);
    if ((E.style === 'reader' || E.style === 'counter') && tai >= 2 && D.rng() < adapt) return { kind: 'block', name: 'Читает удары', block: 10 + E.end * 1.3 };
    if (E.style === 'reader' && tech >= 2 && D.rng() < adapt) return { kind: 'evade', name: 'Читает печати', dodge: 0.55 };
    const choice = weighted(D, E.style === 'turtle' ? [['block', 38], ['strike', 22], ['tech', 24], ['evade', 16]]
      : E.style === 'trickster' ? [['evade', 28], ['strike', 27], ['tech', 25], ['multi', 12], ['block', 8]]
      : E.style === 'brute' ? [['strike', 60], ['tech', 20], ['block', 15], ['multi', 5]]
      : E.style === 'counter' ? [['strike', 32], ['block', 28], ['evade', 20], ['tech', 20]]
      : E.style === 'reader' ? [['strike', 28], ['block', 28], ['evade', 25], ['tech', 19]]
      : [['strike', 43], ['multi', 22], ['tech', 17], ['evade', 10], ['block', 8]]);
    if (choice === 'tech') return techOk ? techIntent(D) : strikeIntent(D);
    if (choice === 'multi') return { kind: 'multi', name: 'Серия атак', dmg: (E.dmg || 8) * 0.58, hits: 2 };
    if (choice === 'block') return { kind: 'block', name: 'Защита', block: 9 + E.end * 1.2 };
    if (choice === 'evade') return { kind: 'evade', name: 'Манёвр', dodge: 0.55 };
    return strikeIntent(D);
  }
  function nextIntent(D) {
    const E = D.E;
    E.block = 0; E.dodge = 0;
    D.intent = decide(D);
    if (D.intent.charged) E.charged = 0;
    if (D.intent.kind === 'charge') E.chargeBroken = 0;
    if (D.intent.block) E.block = D.intent.block;
    if (D.intent.dodge) E.dodge = D.intent.dodge;
  }
  function intentDamage(D) {
    const i = D.intent;
    if (!i || !isAttack(D) || D.E.status.stun > 0) return 0;
    const mul = (D.E.status.fear > 0 ? 0.65 : 1) * (D.E.status.slow > 0 ? 0.75 : 1) * (D.E.status.weak > 0 ? 0.75 : 1);
    return Math.round((i.dmg || 0) * (i.hits || 1) * mul);
  }
  function expectedIncoming(D) {
    let total = 0;
    if (!isAttack(D) || D.E.status.stun > 0) return 0;
    const i = D.intent, mul = (D.E.status.fear > 0 ? 0.65 : 1) * (D.E.status.slow > 0 ? 0.75 : 1) * (D.E.status.weak > 0 ? 0.75 : 1);
    let block = D.P.block, clones = D.P.clones;
    for (let n = 0; n < (i.hits || 1); n++) {
      const dodge = D.P.dodge >= 1 ? 1 : D.P.status.bind > 0 ? 0 : D.P.dodge;
      let d = (i.dmg || 0) * mul * (1 - dodge);
      if (clones > 0 && d > 0) { clones--; d = 0; }
      const absorbed = Math.min(block, d); block -= absorbed; d -= absorbed;
      total += Math.max(0, d);
    }
    return Math.round(total);
  }

  // ── формулы карт ──
  function comboBonus() {
    if (!G.combat || !G.state || !G.state.flags) return 0;
    let b = 0; for (const [id, c] of Object.entries(G.COMBOS || {})) if (G.combat.knowsCombo(id) && id !== 'academy') b += c.bonus || 0; return b;
  }
  function mastery(id) { return G.combat && G.state ? G.combat.mastery(id) : 0; }
  function damageFormula(D, id) {
    const P = D.P, tai = P.st('tai'), nin = P.st('nin'), spd = P.st('spd'), mul = fatMul(D);
    const taiMul = (1 + Math.min(P.chain, 4) * (0.08 + comboBonus())) * mul;
    const techMul = (1 + mastery(id) * 0.06) * (P.focus ? 1.25 : 1) * (D.E.status.mark ? 1.5 : 1) * mul;
    const f = (amount, hits = 1, extra = {}) => Object.assign({ amount, hits, tech: false }, extra);
    const t = (amount, extra = {}) => Object.assign({ amount: amount * techMul, hits: 1, tech: true }, extra);
    if (id === 'strike') return f((5 + tai) * taiMul);
    if (id === 'kunai') return f((4 + spd * 0.6) * mul);
    if (id === 'combo') return f((2 + tai * 0.45) * taiMul, 3);
    if (id === 'feint') return f((4 + tai * 0.5) * mul);
    if (id === 'chakra_shot') return t(7 + nin * 1.3, { ignoreDodge: true });
    if (id === 'shunshin') return t(10 + spd * 1.4);
    if (id === 'katon') return t((14 + nin * 1.8) * (D.E.status.wet > 0 ? 0.6 : 1), { el: 'fire' });
    if (id === 'suiton') return t(8 + nin * 1.25, { el: 'water' });
    if (id === 'raiton') return t((10 + nin * 1.5) * (D.E.status.wet > 0 ? 1.6 : 1), { el: 'bolt' });
    if (id === 'fuuton') return t(7 + nin * 1.1, { el: 'wind' });
    if (id === 'release') return t(18 + (nin + P.st('chakra')) * 1.5, { ignoreDodge: true, pierce: true, release: true });
    return null;
  }
  function preview(D, id) {
    const P = D.P, f = damageFormula(D, id);
    if (f) {
      const lines = [f.hits > 1 ? `${f.hits} × ${Math.round(f.amount)}` : `${Math.round(f.amount)} урон`];
      if (id === 'kunai') lines.push('Метка +50%');
      else if (id === 'combo') lines.push('Тай-серия');
      else if (id === 'feint') lines.push('Снять защиту');
      else if (id === 'katon') lines.push('Горение ×2');
      else if (id === 'suiton') lines.push('Мокрый ×2');
      else if (id === 'raiton') lines.push(D.E.status.wet > 0 ? 'Оглушение!' : 'Нужен Суйтон');
      else if (id === 'fuuton') lines.push('+1 карта');
      else if (id === 'shunshin') lines.push('Уклон 100%');
      else if (id === 'release') lines.push('Сквозь защиту');
      else if (f.tech && (P.focus || D.E.status.mark)) lines.push('Усилено');
      return lines;
    }
    const block = Math.round(8 + P.st('end') * 1.1), stance = Math.round(5 + P.st('end') * 0.7);
    const table = {
      guard: [`${block} блок`], evade: ['65% уклон'], focus: [`+${Math.round(8 + P.st('ctrl'))} чакры`, 'Техника +25%'],
      analyze: ['+2 карты', 'Техника +25%'], stance: [`${stance} блок`, `${Math.round(5 + P.st('tai') * 0.6)} ответ`],
      breath: [`+${Math.round(3 + P.st('end') * 0.3)} зд.`, '−4 усталости'], kawarimi: ['Уклон 100%', `${Math.round(8 + P.st('tai') * 0.8)} ответ`],
      henge: ['Отмена хода'], fear: ['Страх ×2', '−35% урона'], bunshin: ['2 клона', '+1 карта'], sexy: [D.E.male ? 'Оглушение' : 'Слабость'],
      bandage: [`+${Math.round(P.hpMax * 0.25)} зд.`], chakra_pill: [`+${Math.round(P.chMax * 0.5)} чакры`], smoke_bomb: ['Уклон 100%'], flash_bomb: ['Отмена хода'],
    };
    return table[id] || [G.CARDS[id] ? G.CARDS[id].kind : ''];
  }

  // ── розыгрыш карты ──
  function findCard(D, ref) {
    if (typeof ref === 'number') return D.hand[ref] || null;
    if (ref && typeof ref === 'object' && ref.uid) return D.hand.find((c) => c.uid === ref.uid) || null;
    let id = String(ref == null ? '' : ref);
    if (id.startsWith('uid:')) return D.hand.find((c) => c.uid === Number(id.slice(4))) || null;
    if (id.startsWith('tech:') || id.startsWith('item:')) id = id.slice(5);
    return D.hand.find((c) => c.id === id) || null;
  }
  function canPlay(D, ref) {
    if (D.over || D.phase !== 'player') return { ok: false, why: 'Сейчас ход врага' };
    const c = findCard(D, ref);
    if (!c) return { ok: false, why: 'Карты нет в руке' };
    const d = cardDef(c.id), P = D.P;
    if (P.ap < (d.ap || 1)) return { ok: false, why: 'Не хватает действий' };
    if (P.ch < d.cost) return { ok: false, why: `Нужно ${d.cost} чакры` };
    if (d.release && P.heat < RELEASE_HEAT) return { ok: false, why: `Накал ${Math.floor(P.heat)}/${RELEASE_HEAT}` };
    if (c.id === 'bandage' && P.hp >= P.hpMax) return { ok: false, why: 'Здоровье уже полное' };
    if (c.id === 'chakra_pill' && P.ch >= P.chMax) return { ok: false, why: 'Чакра уже полная' };
    if (d.item && (D.inv[c.id] || 0) <= 0) return { ok: false, why: 'Предмет закончился' };
    if (c.id === 'kawarimi' && !isAttack(D)) return { ok: false, why: 'Враг не атакует' };
    if (c.id === 'evade' && P.status.bind > 0) return { ok: false, why: 'Теневая связка мешает уклону' };
    if (c.id === 'smoke_bomb' && !isAttack(D)) return { ok: false, why: 'Враг не атакует' };
    return { ok: true, card: c, def: d };
  }
  function note(ev, who, type, text, extra) { ev.push(Object.assign({ who, type, text, to: who === 'p' ? 'e' : 'p' }, extra || {})); }
  function playerDamage(D, c, formula, ev) {
    const E = D.E;
    let total = 0;
    for (let n = 0; n < formula.hits; n++) {
      let d = formula.amount * (E.status.vuln > 0 ? 1.25 : 1);
      if (!formula.ignoreDodge) d *= 1 - E.dodge;
      const blocked = formula.pierce ? 0 : Math.min(E.block, d);
      E.block -= blocked; d = Math.max(0, d - blocked); d = Math.round(d);
      E.hp = clamp(E.hp - d, 0, E.hpMax); total += d;
      note(ev, 'p', d > 0 ? (formula.tech ? 'tech' : 'hit') : 'blocked', d > 0 ? cardDef(c.id).name : `${cardDef(c.id).name}: блок`, { dmg: d, to: 'e', fx: c.id });
    }
    D.stats.damage += total;
    return total;
  }
  function heal(D, amount, ev, text) { const n = Math.max(0, Math.min(Math.round(amount), D.P.hpMax - D.P.hp)); D.P.hp += n; note(ev, 'p', 'heal', text || `Лечение +${n}`, { heal: n, to: 'p' }); }
  function gainBlock(D, amount, ev) { const n = Math.round(amount); D.P.block += n; note(ev, 'p', 'block', `Блок +${n}`, { block: n, to: 'p' }); }
  function surgeRoll(D, c) {
    if (D.opts.surge === false) return null;
    const stab = stability(D), chance = clamp((1 - stab / 100) * cardDef(c.id).cost / 40, 0, 0.4);
    return D.rng() < chance ? { kind: D.rng() < 0.35 + stab * 0.004 ? 'boost' : 'backfire' } : null;
  }
  function play(D, ref) {
    const check = canPlay(D, ref);
    D.notice = check.ok ? '' : check.why;
    if (!check.ok) return [];
    const c = check.card, def = check.def, P = D.P, E = D.E, ev = [];
    D.hand.splice(D.hand.indexOf(c), 1);
    P.ap -= def.ap || 1; P.ch -= def.cost;
    P.fat = clamp(P.fat + FAT_CARD + (def.tech ? 0.5 : 0), 0, 100);
    if (!def.release) P.heat = clamp(P.heat + HEAT_CARD, 0, 100);
    D.stats.used[c.id] = (D.stats.used[c.id] || 0) + 1; D.stats.cards++; D.stats.sequence.push(c.id);
    P.hist.push(c.id); P.turnCards.push(c.id); if (P.hist.length > 18) P.hist.shift();
    if (def.item) { D.inv[c.id]--; D.usedItems.push(c.id); }
    const formula = damageFormula(D, c.id);
    let surge = null;
    if (formula && formula.tech) {
      surge = surgeRoll(D, c);
      if (surge && surge.kind === 'boost') { formula.amount *= BOOST; note(ev, 'p', 'boost', 'Фиолетовая вспышка: карта усилена', { fx: 'release' }); }
      P.focus = 0; E.status.mark = 0;
    }

    if (c.id === 'guard') gainBlock(D, 8 + P.st('end') * 1.1, ev);
    else if (c.id === 'evade') { P.dodge = Math.max(P.dodge, 0.65); note(ev, 'p', 'status', 'Уклон 65% до конца хода', { to: 'p' }); }
    else if (c.id === 'focus') { const n = Math.round(8 + P.st('ctrl')); P.ch = Math.min(P.chMax, P.ch + n); P.focus = 1; note(ev, 'p', 'chakra', `Фокус: +${n} чакры, техника усилена`, { to: 'p' }); }
    else if (c.id === 'analyze') { P.focus = 1; draw(D, 2); note(ev, 'p', 'status', 'Анализ: +2 карты, техника усилена', { to: 'p' }); }
    else if (c.id === 'stance') { gainBlock(D, 5 + P.st('end') * 0.7, ev); P.riposte += 5 + P.st('tai') * 0.6; }
    else if (c.id === 'breath') { heal(D, 3 + P.st('end') * 0.3, ev, 'Дыхание восстанавливает силы'); P.fat = Math.max(0, P.fat - 4); }
    else if (c.id === 'kawarimi') { P.dodge = 1; P.riposte += 8 + P.st('tai') * 0.8; note(ev, 'p', 'status', 'Каварими: замена и контрудар', { fx: c.id, to: 'p' }); }
    else if (c.id === 'henge' || c.id === 'flash_bomb') { E.status.stun = 1; note(ev, 'p', 'status', `${def.name}: действие врага отменено`, { fx: c.id }); }
    else if (c.id === 'fear') { E.block = 0; E.status.fear = 2; note(ev, 'p', 'status', 'Ложный страх: урон врага −35% на два действия', { fx: c.id }); }
    else if (c.id === 'bunshin') { P.clones = Math.max(P.clones, 2); draw(D, 1); note(ev, 'p', 'status', 'Буншин: два клона и дополнительная карта', { fx: c.id, to: 'p' }); }
    else if (c.id === 'sexy') { if (E.male) E.status.stun = 1; else E.status.weak = 1; note(ev, 'p', 'status', E.male ? 'Секси-дзюцу: враг оглушён' : 'Не сработало: враг ослаблен', { fx: c.id }); }
    else if (c.id === 'shunshin') P.dodge = 1;
    else if (c.id === 'smoke_bomb') { P.dodge = 1; note(ev, 'p', 'status', 'Дымовая завеса', { fx: c.id, to: 'p' }); }
    else if (c.id === 'bandage') heal(D, P.hpMax * 0.25, ev, 'Бинт восстанавливает здоровье');
    else if (c.id === 'chakra_pill') { const n = Math.round(P.chMax * 0.5); P.ch = Math.min(P.chMax, P.ch + n); note(ev, 'p', 'chakra', `Пилюля: +${n} чакры`, { to: 'p' }); }

    if (c.id === 'feint' || c.id === 'fuuton') { E.block = 0; E.dodge = 0; }
    let dealt = 0;
    if (formula) dealt = playerDamage(D, c, formula, ev);
    if (c.id === 'kunai') { E.status.mark = 1; note(ev, 'p', 'status', 'Метка: следующая атакующая техника ×1,5', { to: 'e' }); }
    if (c.id === 'feint') E.status.vuln = 1;
    if (c.id === 'fuuton') { E.status.weak = 1; draw(D, 1); }
    if (c.id === 'katon' && dealt > 0) E.status.burn = 2;
    if (c.id === 'suiton' && dealt > 0) E.status.wet = 2;
    if (c.id === 'raiton' && dealt > 0 && E.status.wet > 0) { E.status.stun = 1; note(ev, 'p', 'status', 'Райтон по мокрой цели: оглушение', { fx: c.id }); }
    if (def.kind === 'tai') P.chain += formula ? formula.hits : 1;
    if (def.kind === 'tai' && D.intent.kind === 'charge' && P.chain >= 3 && !E.chargeBroken) { E.chargeBroken = 1; E.status.stun = 1; note(ev, 'p', 'counter', 'Серия тайдзюцу срывает замах!', { fx: c.id }); }
    if (surge && surge.kind === 'backfire') { const rec = Math.max(3, Math.round(dealt * 0.25)); P.hp = clamp(P.hp - rec, 0, P.hpMax); D.stats.taken += rec; note(ev, 'p', 'backfire', `Срыв чакры: отдача ${rec}`, { dmg: rec, to: 'p', fx: 'release' }); }
    if (def.release) P.heat = 0;
    (def.exhaust || def.item ? D.exhaust : D.discard).push(c);
    D.last = { pAct: c.id, q: 1, surge, damage: dealt };
    checkEnd(D);
    D.events = ev;
    return ev;
  }

  // ── ход противника ──
  function enemyHit(D, raw, ev, name) {
    const P = D.P, E = D.E;
    let total = 0;
    const mul = (E.status.fear > 0 ? 0.65 : 1) * (E.status.slow > 0 ? 0.75 : 1) * (E.status.weak > 0 ? 0.75 : 1);
    for (let n = 0; n < (D.intent.hits || 1); n++) {
      const dodge = P.dodge >= 1 ? 1 : P.status.bind > 0 ? 0 : P.dodge;
      let d = raw * mul * (1 - dodge);
      if (P.clones > 0 && d > 0) { P.clones--; d = 0; note(ev, 'p', 'info', 'Клон принял удар', { to: 'p', fx: 'bunshin' }); }
      const blocked = Math.min(P.block, d); P.block -= blocked; d = Math.max(0, Math.round(d - blocked));
      P.hp = clamp(P.hp - d, 0, P.hpMax); total += d; D.stats.taken += d;
      note(ev, 'e', d > 0 ? 'hit' : 'block', d > 0 ? name : `${name}: задержано`, { dmg: d, to: 'p', fx: D.intent.kind === 'tech' ? 'e:dmg' : null });
      if (d > 0) P.heat = clamp(P.heat + HEAT_HIT, 0, 100);
    }
    return total;
  }
  function endTurn(D) {
    if (D.over || D.phase !== 'player') return [];
    const P = D.P, E = D.E, ev = [], intent = D.intent;
    D.phase = 'enemy';
    D.discard.push(...D.hand.splice(0));
    D.prevCards = P.turnCards.slice();
    E.block = 0; E.dodge = 0;
    if (E.status.stun > 0) note(ev, 'e', 'info', `${E.name}: действие пропущено`, { to: 'p' });
    else if (intent.kind === 'charge') { E.charged = 1; E.chargeBroken = 0; note(ev, 'e', 'status', `${E.name} готовит тяжёлый приём`, { to: 'p' }); }
    else if (intent.kind === 'block' || intent.kind === 'evade') { E.ch = Math.min(E.chMax, E.ch + 4); note(ev, 'e', 'info', intent.kind === 'block' ? 'Враг удерживает защиту' : 'Враг меняет позицию', { to: 'p' }); }
    else if (intent.kind === 'idle') note(ev, 'e', 'info', 'Враг ждёт', { to: 'p' });
    else if (isAttack(D)) {
      if (intent.cost) { E.ch = Math.max(0, E.ch - intent.cost); E.cd = 2; }
      const dealt = enemyHit(D, intent.dmg || 0, ev, intent.name);
      if (intent.kind === 'drain' && dealt > 0) { const n = Math.min(P.ch, Math.round(8 + E.nin)); P.ch -= n; E.ch = Math.min(E.chMax, E.ch + n); note(ev, 'e', 'drain', `Чакра украдена: ${n}`, { to: 'p', fx: 'e:drain' }); }
      if (intent.kind === 'bind' && dealt > 0) { P.status.bind = 2; note(ev, 'e', 'status', 'Теневая связка: уклон недоступен на ход', { to: 'p', fx: 'e:bind' }); }
      if (P.riposte > 0 && P.hp > 0) {
        const n = Math.round(P.riposte); E.hp = clamp(E.hp - n, 0, E.hpMax); D.stats.damage += n;
        note(ev, 'p', 'counter', `Контрудар: ${n}`, { dmg: n, to: 'e', fx: 'kawarimi' });
      }
    } else if (intent.kind === 'fear') {
      P.status.fear = 2; if (intent.cost) { E.ch = Math.max(0, E.ch - intent.cost); E.cd = 2; }
      note(ev, 'e', 'status', 'Иллюзия: на следующий ход меньше рука и действия', { to: 'p', fx: 'e:fear' });
    }
    if (E.status.burn > 0 && E.hp > 0) { const n = 4; E.hp = clamp(E.hp - n, 0, E.hpMax); D.stats.damage += n; note(ev, 'p', 'tech', `Горение: ${n}`, { dmg: n, to: 'e', fx: 'katon' }); }
    P.fat = clamp(P.fat + FAT_ROUND * (1 - P.st('end') * 0.025), 0, 100);
    P.heat = clamp(P.heat + 2, 0, 100); E.ch = Math.min(E.chMax, E.ch + 2);
    for (const s of ['stun', 'fear', 'weak', 'wet', 'vuln', 'burn', 'slow']) if (E.status[s] > 0) E.status[s]--;
    for (const s of ['bind', 'fear']) if (P.status[s] > 0) P.status[s]--;
    if (E.cd > 0) E.cd--;
    D.turns++;
    checkEnd(D);
    if (!D.over && D.mode === 'survive' && D.round >= D.rounds) { D.over = { win: true }; D.phase = 'over'; }
    if (!D.over && D.round >= 40) { D.over = { win: E.hp / E.hpMax < P.hp / P.hpMax }; D.phase = 'over'; }
    D.events = ev;
    if (!D.over) startTurn(D);
    return ev;
  }
  function checkEnd(D) {
    if (D.E.hp <= 0 || (D.mode === 'spar' && D.E.hp <= D.E.hpMax * SPAR_END)) { D.over = { win: true }; D.phase = 'over'; }
    else if (D.P.hp <= 0 || (D.mode === 'spar' && D.P.hp <= D.P.hpMax * SPAR_END)) { D.over = { win: false }; D.phase = 'over'; }
  }

  // ── бот: оценивает карты заново после каждого розыгрыша ──
  function score(D, id, plan) {
    const f = damageFormula(D, id), incoming = expectedIncoming(D), P = D.P, E = D.E, intent = D.intent;
    const hand = D.hand.map((c) => c.id), has = (x) => hand.includes(x);
    let s = f ? f.amount * f.hits : 0;
    if (f) {
      let block = E.block, total = 0;
      for (let n = 0; n < f.hits; n++) {
        let d = f.amount * (E.status.vuln > 0 ? 1.25 : 1) * (f.ignoreDodge ? 1 : 1 - E.dodge);
        const absorbed = f.pierce ? 0 : Math.min(block, d); block -= absorbed; total += Math.max(0, d - absorbed);
      }
      const threshold = D.mode === 'spar' ? E.hpMax * SPAR_END : 0;
      if (E.hp - total <= threshold + 0.5) s += 1000; // опытный бот не упускает добивание
    }
    if (id === 'guard') s = Math.min(incoming, 8 + P.st('end') * 1.1) * 1.1 - (incoming ? 0 : 24);
    else if (id === 'evade') s = incoming * 0.6 - (incoming ? 0 : 24);
    else if (id === 'stance') s = Math.min(incoming, 5 + P.st('end') * 0.7) + (isAttack(D) ? 5 + P.st('tai') * 0.6 : -20);
    else if (id === 'focus') s = (P.ch < P.chMax * 0.55 ? 15 : 2) + (hand.some((x) => damageFormula(D, x) && damageFormula(D, x).tech) ? 8 : 0);
    else if (id === 'analyze') s = 10 + (P.ap > 1 ? 4 : 0);
    else if (id === 'breath') s = (P.hpMax - P.hp) * 0.7 + (P.fat > 65 ? 8 : 0) - (P.hp >= P.hpMax ? 25 : 0);
    else if (id === 'kunai') s += hand.some((x) => damageFormula(D, x) && damageFormula(D, x).tech) && !E.status.mark ? 13 : 0;
    else if (id === 'feint') s += E.block + E.dodge * 20 + 4;
    else if (id === 'kawarimi') s = incoming + 10 + P.st('tai') * 0.8;
    else if (id === 'henge' || id === 'flash_bomb') s = incoming + (intent.kind === 'charge' ? 24 : 10);
    else if (id === 'fear') s = incoming * 0.7 + E.block;
    else if (id === 'bunshin') s = incoming * 0.85 + (intent.hits || 1) * 5;
    else if (id === 'sexy') s = E.male ? incoming + 14 : incoming * 0.25;
    else if (id === 'shunshin') s += incoming;
    else if (id === 'katon') s += 8;
    else if (id === 'suiton') s += has('raiton') ? 18 : 3;
    else if (id === 'raiton') s += E.status.wet > 0 ? incoming + 16 : 0;
    else if (id === 'fuuton') s += incoming * 0.25 + 6;
    else if (id === 'release') s += 12;
    else if (id === 'smoke_bomb') s = incoming + 5;
    else if (id === 'bandage') s = (P.hpMax - P.hp) * 0.8 - (P.hp / P.hpMax > 0.65 ? 30 : 0);
    else if (id === 'chakra_pill') s = P.ch < P.chMax * 0.4 ? 24 : -20;
    const pref = plan && (plan.prefer || plan);
    if (Array.isArray(pref)) { const i = pref.indexOf(id); if (i >= 0) s += 50 - Math.min(i, 8) * 2; }
    return s;
  }
  function bot(D, skill = 0.65, rng = D.rng, plan = null) {
    const playable = D.hand.filter((c) => canPlay(D, c).ok);
    if (!playable.length || D.P.ap <= 0) return { act: 'end', q: 1 };
    if (rng() > skill) return { act: 'uid:' + playable[Math.floor(rng() * playable.length)].uid, q: 1 };
    let best = playable[0], bestScore = -Infinity;
    for (const c of playable) {
      const s = score(D, c.id, plan) * (0.92 + rng() * 0.16 * (1 - skill));
      if (s > bestScore) { bestScore = s; best = c; }
    }
    return { act: 'uid:' + best.uid, q: 1 };
  }
  function simulate(opts, skill = 0.65, plan = null) {
    const D = create(opts); let guard = 0;
    while (!D.over && guard++ < 1000) {
      let plays = 0;
      while (!D.over && D.P.ap > 0 && plays++ < 12) {
        const b = bot(D, skill, D.rng, plan);
        if (b.act === 'end') break;
        if (!play(D, b.act).length) break;
      }
      if (!D.over) endTurn(D);
    }
    return { win: !!(D.over && D.over.win), rounds: D.round, hp: D.P.hp / D.P.hpMax, fat: D.P.fat, used: D.stats.used, sequence: D.stats.sequence.slice(), cards: D.stats.cards, damage: D.stats.damage };
  }

  function options(D) { return D.hand.map((c) => ({ id: c.id, uid: c.uid, label: cardDef(c.id).name, cost: cardDef(c.id).cost, off: canPlay(D, c).ok ? null : canPlay(D, c).why })); }
  function stability(D) { return clamp(D.P.stab0 - (D.P.fat - D.P.fat0) * 0.3, 5, 100); }
  return { TUNE, create, play, endTurn, canPlay, options, bot, simulate, draw, preview, intentDamage, expectedIncoming,
    stability, mulberry, SPAR_END, RELEASE_HEAT, RELEASE_COST, BOOST, FAT_ROUND };
})();
