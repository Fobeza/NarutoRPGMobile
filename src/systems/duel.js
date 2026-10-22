// Ядро боя «Дуэль»: чистая логика без экрана и без записи в сохранение (экран — scenes/duel.js, симулятор — tools/node/balance.js).
// Правила — docs/COMBAT.md. Раунд: герой и противник одновременно выбирают действие; исход решает пара.
//   Блок бьёт Удар, Удар бьёт Уклон, Уклон бьёт Блок. Приём (техника) пробивает Блок, но промахивается по Уклону.
// Качество q (0..1) приходит от мини-игры (тайминг для удара и блока, печати для приёма); у ботов и тестов — задаётся числом.
G.duel = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ACTS = ['strike', 'block', 'evade'];
  const BEATS = { block: 'strike', strike: 'evade', evade: 'block' };   // ключ побеждает значение
  const KIND_ICON = { strike: 'strike', block: 'block', evade: 'evade', tech: 'tech', idle: 'idle' };
  const SPAR_END = 0.3;          // спарринг идёт до 30% здоровья
  const FAT_ROUND = 2.5;         // усталость за раунд
  const HEAT_ROUND = 7, HEAT_HIT = 5, HEAT_MAX = 100, RELEASE_HEAT = 60, RELEASE_COST = 25;
  const BOOST = 1.5;
  // Настройки баланса (меняются симулятором и подгоняются под окна tools/targets.json)
  const TUNE = { hp: 1, dmgBase: 4, dmgPer: 1.2 };

  // Простая детерминируемая случайность (для тестов и симулятора): rng = () => [0,1)
  function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ── создание боя ──
  // opts: { enemy, mode: ko|spar|survive, rounds, stats, skills, techs: [id], hp (0..100 %), chakra (0..100 %), fatigue,
  //         stability, rng, inv, day, trainingFight }
  function create(opts) {
    const rng = opts.rng || Math.random;
    const stats = opts.stats || G.state.hero.stats || {}, st = (k) => stats[k] || G.STAT_BASE;
    const skills = opts.skills || G.state.hero.skills || [];
    const has = (s) => skills.includes(s);
    let ed = G.ENEMIES[opts.enemy] || G.ENEMIES.dummy;
    const day = opts.day != null ? opts.day : G.state.vars.day;
    if (ed.grow) ed = Object.assign({}, ed, { hp: Math.round(ed.hp * (1 + 0.025 * day)), tai: ed.tai + Math.floor(day / 9), spd: ed.spd + Math.floor(day / 14), end: ed.end + Math.floor(day / 21) });
    const hpMax = Math.round((60 + st('end') * 5) * (has('tough') ? 1.1 : 1));
    const chMax = Math.round((30 + st('chakra') * 10) * (has('big_chakra') ? 1.25 : 1));
    const mode = opts.mode || 'ko';
    const real = mode === 'ko' || mode === 'survive';
    const P = {
      st, name: opts.name || (G.state && G.state.hero && G.state.hero.name) || 'Герой',
      hpMax, hp: real ? Math.max(1, Math.round(hpMax * (opts.hp == null ? 100 : opts.hp) / 100)) : hpMax,
      chMax, ch: Math.round(chMax * clamp(opts.chakra == null ? 100 : opts.chakra, 10, 100) / 100),
      fat: opts.fatigue == null ? 10 : opts.fatigue, fat0: opts.fatigue == null ? 10 : opts.fatigue, heat: 0,
      clones: 0, shield: 0, status: {}, hist: [], chain: 0, techs: (opts.techs || []).filter((t) => G.TECHS[t]),
      knows: (t) => (opts.techs || []).includes(t),
    };
    P.stab0 = opts.stability != null ? opts.stability : (G.purple && G.state.started ? G.purple.stability() : 40);
    const ehp = Math.round(ed.hp * TUNE.hp);
    const E = Object.assign({}, ed, { id: opts.enemy, hpMax: ehp, hp: ehp, chMax: ed.ch, ch: ed.ch, status: {}, hist: [], cd: 0, charge: 0 });
    const D = { opts, rng, mode, rounds: opts.rounds || 6, P, E, round: 0, over: null, intent: null, hint: null, log: [], inv: Object.assign({}, opts.inv || {}), trainingFight: mode === 'spar', stats: { perfect: 0, used: {} }, turns: 0 };
    D.has = has;
    nextIntent(D);
    return D;
  }

  // Стабильность чакры героя прямо сейчас: усталость в бою снижает её
  function stability(D) { return clamp(D.P.stab0 - (D.P.fat - D.P.fat0) * 0.3, 5, 100); }
  function fatMul(D) { return D.P.fat > 70 ? 0.85 : D.P.fat > 90 ? 0.7 : 1; }
  // Ширина окна тайминга 0..1 для экрана и ботов: шире при высокой стабильности и малой усталости
  function window(D) { return clamp(0.3 + stability(D) / 250 - D.P.fat / 400 - (D.P.status.fear ? 0.12 : 0), 0.12, 0.7); }

  // ── намёк о ходе противника ──
  function hintAccuracy(D) { return clamp(0.2 + 0.04 * D.P.st('know') + 0.015 * D.P.st('spd') + (D.has('analyst') ? 0.1 : 0) - (D.E.style === 'trickster' ? 0.2 : 0), 0.15, 0.9); }

  // ── решение противника ──
  const WEIGHTS = {
    rush: [50, 12, 18], counter: [30, 25, 25], turtle: [18, 45, 22], reader: [30, 25, 25], trickster: [35, 15, 35], brute: [55, 15, 5], dummy: [0, 0, 0],
  };
  function best(vs) { return Object.keys(BEATS).find((k) => BEATS[k] === vs); }   // чем побеждается действие vs
  function mostCommon(hist) { const c = {}; for (const a of hist.slice(-6)) c[a] = (c[a] || 0) + 1; let m = null; for (const [a, n] of Object.entries(c)) if (!m || n > c[m]) m = a; return m; }
  function decide(D) {
    const E = D.E, rng = D.rng;
    if (E.style === 'dummy') return 'idle';
    if (E.status.stun > 0) return 'idle';
    if (E.status.fear > 0 && rng() < 0.35) return 'idle';   // страх: враг теряется
    const techOk = E.tech && E.ch >= E.tech.cost && E.cd <= 0;
    if (E.style === 'brute') { E.charge++; if (E.charge >= 3 && techOk) { E.charge = 0; return 'tech'; } }
    else if (techOk && rng() < (E.style === 'rush' ? 0.22 : 0.16)) return 'tech';
    const hist = D.P.hist, last = hist[hist.length - 1];
    const adapt = clamp(0.25 + 0.04 * E.know, 0.2, 0.7);
    if (E.style === 'counter' && last && rng() < adapt) return last === 'tech' ? 'evade' : best(last);
    if (E.style === 'reader' && hist.length >= 2 && rng() < adapt) { const m = mostCommon(hist); return m && m !== 'tech' ? best(m) : 'block'; }
    const w = WEIGHTS[E.style] || WEIGHTS.rush; let r = rng() * (w[0] + w[1] + w[2]);
    for (let i = 0; i < 3; i++) { r -= w[i]; if (r <= 0) return ACTS[i]; }
    return 'strike';
  }
  function nextIntent(D) {
    D.intent = decide(D);
    const truthful = D.rng() < hintAccuracy(D);
    const pool = ['strike', 'block', 'evade', 'tech'].filter((a) => a !== D.intent);
    D.hint = truthful ? D.intent : pool[Math.floor(D.rng() * pool.length)];
    D.hintTrue = truthful;
  }

  // ── урон ──
  const heroStrike = (D) => (6 + D.P.st('tai') * 1.5) * fatMul(D);
  const enemyStrike = (D) => (D.E.dmg != null ? D.E.dmg : TUNE.dmgBase + D.E.tai * TUNE.dmgPer);   // dmg — урон обычного удара противника из данных
  const Q = (q) => 0.75 + 0.5 * clamp(q, 0, 1);
  function techPower(D, id) {
    const t = G.TECHS[id], nin = D.P.st('nin') + (t.gen ? D.P.st('gen') - D.P.st('nin') : 0);
    const mast = G.combat && G.state ? G.combat.mastery(id) : 0;
    const base = { chakra_shot: 1.25, katon: 2.2, suiton: 1.5, raiton: 1.8, fuuton: 1.3 }[id] || 0;
    return base * (6 + nin * 1.8) * (1 + mast * 0.06) * fatMul(D);
  }
  const SPECIAL = ['kawarimi', 'henge', 'fear', 'bunshin', 'sexy', 'shunshin'];

  // доступные игроку действия сейчас: [{id, label, cost?, off?}]
  function options(D) {
    const P = D.P, out = [{ id: 'strike' }, { id: 'block' }, { id: 'evade' }];
    out.push({ id: 'tech', techs: P.techs.map((t) => ({ id: t, name: G.TECHS[t].name, cost: G.TECHS[t].ch, off: P.ch < G.TECHS[t].ch ? 'мало чакры' : null })) });
    out.push({ id: 'release', cost: RELEASE_COST, off: P.heat < RELEASE_HEAT ? 'накал ' + Math.round(P.heat) + '/' + RELEASE_HEAT : P.ch < RELEASE_COST ? 'мало чакры' : null });
    return out;
  }

  // ── раунд ──
  // pAct: 'strike'|'block'|'evade'|'tech:<id>'|'release'|'item:<id>'; q — качество мини-игры 0..1
  function play(D, pAct, q = 0.5) {
    if (D.over) return [];
    const P = D.P, E = D.E, rng = D.rng, ev = [];
    D.round++; D.turns++;
    const eAct = D.intent;
    const kind = pAct.startsWith('tech:') ? 'tech' : pAct.startsWith('item:') ? 'item' : pAct;
    const techId = kind === 'tech' ? pAct.slice(5) : null;
    P.hist.push(kind === 'release' ? 'tech' : kind === 'item' ? 'block' : kind); if (P.hist.length > 12) P.hist.shift();
    E.hist.push(eAct); if (E.hist.length > 12) E.hist.shift();
    D.stats.used[pAct] = (D.stats.used[pAct] || 0) + 1;
    let pDmgToE = 0, eDmgToP = 0;
    // who — кто действует (p/e); to — кто получает урон (по умолчанию противоположная сторона)
    let fxId = null;   // какая техника сработала: экран боя рисует по ней эффект
    const note = (who, type, text, extra) => ev.push(Object.assign({ who, type, text, to: who === 'p' ? 'e' : 'p', fx: fxId }, extra || {}));

    // — статусы врага
    const eStun = E.status.stun > 0, eFear = E.status.fear > 0, bound = P.status.bind > 0;
    const eAttacking = !eStun && (eAct === 'strike' || eAct === 'tech');
    // — затраты чакры
    let surge = null, pTechMul = 1;
    const eEvading = eAct === 'evade' && !eStun, eBlocking = eAct === 'block' && !eStun;

    // Предмет: занимает раунд, враг действует как обычно
    if (kind === 'item') {
      const id = pAct.slice(5), need = (id === 'bandage' && P.hp < P.hpMax) || (id === 'chakra_pill' && P.ch < P.chMax) || id === 'smoke_bomb' || id === 'flash_bomb';
      const ok = (D.inv[id] || 0) > 0 && need;
      if (!ok) note('p', 'info', (D.inv[id] || 0) > 0 ? 'Сейчас не нужно' : 'Нет в сумке');
      if (ok) {
        D.inv[id]--; D.usedItems = (D.usedItems || []).concat(id);
        if (id === 'bandage') { const h = Math.round(P.hpMax * 0.25); P.hp = Math.min(P.hpMax, P.hp + h); note('p', 'heal', `Бинт: +${h} здоровья`); }
        if (id === 'chakra_pill') { const c = Math.round(P.chMax * 0.5); P.ch = Math.min(P.chMax, P.ch + c); note('p', 'chakra', `Пилюля: +${c} чакры`); }
        if (id === 'smoke_bomb') { P.status.smoke = 1; note('p', 'status', 'Дымовая завеса: следующая атака врага промахнётся'); }
        if (id === 'flash_bomb') { E.status.stun = 3; note('p', 'status', 'Вспышка: враг ослеплён на раунд'); }
      }
    }

    // Приём героя
    let techMiss = false, techUtility = null;
    if (kind === 'tech' || kind === 'release') {
      const cost = kind === 'release' ? RELEASE_COST : G.TECHS[techId].ch;
      if (kind === 'release' && P.heat < RELEASE_HEAT) { note('p', 'info', 'Накал мал: выброс не получился'); }
      else if (P.ch < cost) { note('p', 'info', 'Не хватило чакры'); }
      else {
        P.ch -= cost; P.heat = Math.max(0, P.heat - (kind === 'release' ? RELEASE_HEAT : 0));
        const stab = stability(D), chance = clamp((1 - stab / 100) * cost / 40, 0, 0.4);   // та же формула, что у G.purple.chance, но с усталостью боя
        surge = D.opts.surge === false ? null : rng() < chance ? { kind: rng() < 0.35 + stab * 0.004 ? 'boost' : 'backfire' } : null;
        pTechMul = surge ? (surge.kind === 'boost' ? BOOST : 1) : 1;
        if (kind === 'release') {
          const dmg = (14 + (P.st('nin') + P.st('chakra')) * 1.5) * Q(q) * pTechMul * fatMul(D);
          techUtility = { dmg, through: 0.8, label: 'Фиолетовый выброс' };
        } else if (SPECIAL.includes(techId)) techUtility = { special: techId, label: G.TECHS[techId].name };
        else techUtility = { dmg: techPower(D, techId) * Q(q) * pTechMul, through: 0.7, el: G.TECHS[techId].el, label: G.TECHS[techId].name, id: techId };
      }
    }
    P.fat = clamp(P.fat + FAT_ROUND * (1 - P.st('end') * 0.03) + (techUtility ? 2 : 0), 0, 100);

    // — разбор пар
    const heroKind = kind === 'item' ? 'item' : (kind === 'release' || kind === 'tech') && techUtility ? 'tech' : kind === 'tech' || kind === 'release' ? 'fail' : kind;
    const dmgStrikeP = heroStrike(D) * Q(q) * (1 + Math.min(P.chain, 4) * (0.08 + comboBonus()));
    const dmgStrikeE = enemyStrike(D) * (eFear ? 0.6 : 1) * (E.status.slow > 0 ? 0.75 : 1);
    const eTechDmg = E.tech && E.tech.kind === 'dmg' ? enemyStrike(D) * E.tech.power : 0;   // приём бьёт сильнее обычного удара

    // Итоги героя
    // 1) удары по врагу
    if (heroKind === 'strike') {
      if (eStun || eAct === 'idle') { pDmgToE += dmgStrikeP; note('p', 'hit', 'Удар достигает цели', { dmg: dmgStrikeP }); P.chain++; }
      else if (eAct === 'block') { const d = dmgStrikeP * (q > 0.8 ? 0.35 : 0.2); pDmgToE += d; note('p', 'blocked', 'Враг блокирует удар', { dmg: d }); P.chain = 0; P.fat = clamp(P.fat + 3, 0, 100); }
      else if (eAct === 'evade') { const d = dmgStrikeP * 1.0; pDmgToE += d; note('p', 'hit', 'Удар догоняет уклон', { dmg: d }); P.chain++; }
      else if (eAct === 'strike') { const d = dmgStrikeP * 0.7; pDmgToE += d; note('p', 'trade', 'Удары сталкиваются', { dmg: d }); P.chain++; }
      else if (eAct === 'tech') { const d = dmgStrikeP * 0.6; pDmgToE += d; note('p', 'trade', 'Удар сбивает приём врага', { dmg: d }); P.chain = Math.max(0, P.chain); }
    } else if (heroKind !== 'block' && heroKind !== 'evade') P.chain = heroKind === 'tech' ? P.chain : 0;

    // 2) удары по герою
    const pBlocking = kind === 'block', pEvading = kind === 'evade' && !bound;
    const smoke = P.status.smoke > 0 || (P.status.henge > 0 && eAttacking && rng() < 0.5 && (note('p', 'info', 'Хенге: враг потерял тебя из виду'), true));
    if (eStun) { note('e', 'info', 'Враг не может действовать'); }
    else if (eAct === 'strike') {
      if (smoke) { note('p', 'info', 'Враг промахнулся'); }
      else if (heroKind === 'strike') { const d = dmgStrikeE * 0.7; eDmgToP += d; note('e', 'trade', 'Враг бьёт в ответ', { dmg: d, to: 'p' }); }
      else if (pBlocking) { const perfect = q > 0.8; const d = dmgStrikeE * (perfect ? 0 : 0.2); eDmgToP += d; note('e', perfect ? 'parry' : 'block', perfect ? 'Идеальный блок! Контрудар' : 'Блок смягчает удар', { dmg: d, to: 'p' }); if (perfect) { pDmgToE += heroStrike(D) * 0.5; P.chain++; } else P.chain = 0; P.ch = Math.min(P.chMax, P.ch + 2); }
      else if (pEvading) { const slip = q > 0.8; const d = dmgStrikeE * (slip ? 0.5 : 1); eDmgToP += d; note('e', slip ? 'graze' : 'hit', slip ? 'Уклон почти удался' : 'Уклон не спас', { dmg: d, to: 'p' }); }
      else if (heroKind === 'tech') { const d = dmgStrikeE * 0.6; eDmgToP += d; note('e', 'hit', 'Враг бьёт сквозь приём', { dmg: d, to: 'p' }); }
      else { eDmgToP += dmgStrikeE; note('e', 'hit', heroKind === 'item' ? 'Враг бьёт, пока ты занят' : 'Удар врага достигает цели', { dmg: dmgStrikeE, to: 'p' }); }
    } else if (eAct === 'block' && pEvading) {
      const d = heroStrike(D) * 0.6 * Q(q); pDmgToE += d; note('p', 'counter', 'Ты обошёл блок и ударил сзади', { dmg: d }); P.chain++;
    } else if (eAct === 'evade' && pBlocking) {
      const d = enemyStrike(D) * 0.6; eDmgToP += d; note('e', 'counter', 'Враг обошёл твой блок', { dmg: d, to: 'p' }); P.chain = 0;
    } else if (eAct === 'block' && pBlocking) { P.ch = Math.min(P.chMax, P.ch + 4); E.ch = Math.min(E.chMax, E.ch + 4); note('p', 'info', 'Оба в защите: чакра восстанавливается'); }
    else if (eAct === 'evade' && pEvading) { P.fat = clamp(P.fat + 2, 0, 100); note('p', 'info', 'Оба кружат на месте'); }

    // 3) приём героя
    if (techUtility) {
      fxId = techUtility.special || techUtility.id || 'release';
      if (techUtility.special) {
        const s = techUtility.special;
        if (s === 'kawarimi') { if (eAttacking && !smoke) { const d = 0; eDmgToP = 0; const c = heroStrike(D) * 0.5 * Q(q); pDmgToE += c; note('p', 'counter', 'Каварими: вместо тебя полено!', { dmg: c }); } else note('p', 'info', 'Каварими впустую'); }
        else if (s === 'henge') { P.status.henge = 2; D.hintTrue = true; D.hint = D.intent; note('p', 'status', 'Хенге: враг теряет тебя, намёк теперь точный'); }
        else if (s === 'fear') { const resist = clamp(E.gen * 0.04, 0, 0.5), land = clamp(0.5 + D.P.st('gen') * 0.05 - resist, 0.15, 0.95) * Q(q); if (rng() < land) { E.status.fear = 3; note('p', 'status', 'Ложный страх: враг дрожит'); } else note('p', 'info', 'Враг стряхнул иллюзию'); }
        else if (s === 'bunshin') { P.clones = 2; note('p', 'status', 'Буншин: два клона принимают удары'); }
        else if (s === 'sexy') { if (E.male) { E.status.stun = 3; note('p', 'status', 'Секси-дзюцу: враг в нокдауне'); } else note('p', 'info', 'Не подействовало'); }
        else if (s === 'shunshin') { if (eAttacking) { eDmgToP = 0; const c = heroStrike(D) * 1.0; pDmgToE += c; note('p', 'counter', 'Шуншин: ты уже за спиной врага', { dmg: c }); } else { pDmgToE += heroStrike(D) * 0.6; note('p', 'hit', 'Шуншин: быстрый удар', { dmg: heroStrike(D) * 0.6 }); } }
      } else {
        let d = techUtility.dmg;
        if (eEvading) { d = 0; note('p', 'miss', `${techUtility.label}: враг уклонился`); }
        else if (eBlocking) { d *= techUtility.through; note('p', 'tech', `${techUtility.label} пробивает блок`, { dmg: d }); }
        else note('p', 'tech', techUtility.label, { dmg: d });
        if (techUtility.el === 'water' && d > 0) E.status.wet = 3;
        if (techUtility.el === 'bolt' && d > 0 && E.status.wet > 0) d *= 1.6;
        if (techUtility.el === 'bolt' && d > 0 && rng() < 0.3) E.status.stun = 2;
        if (techUtility.el === 'fire' && E.status.wet > 0) d *= 0.6;
        if (techUtility.el === 'wind' && d > 0) { E.status.slow = 2; E.ch = Math.max(0, E.ch - 6); }
        pDmgToE += d;
        if (surge && surge.kind === 'backfire') { const rec = Math.round(Math.max(3, d * 0.25)); eDmgToP += rec; note('p', 'backfire', `Срыв чакры: отдача ${rec}`, { dmg: rec, to: 'p' }); }
        if (surge && surge.kind === 'boost') note('p', 'boost', 'Фиолетовая вспышка: приём усилен');
      }
      P.chain = 0;
    } else if (surge === null && (kind === 'tech' || kind === 'release')) { /* не хватило чакры */ }
    // враг, ответивший приёмом
    fxId = null;
    if (!eStun && eAct === 'tech' && E.tech) {
      fxId = 'e:' + E.tech.kind;
      E.ch = Math.max(0, E.ch - E.tech.cost); E.cd = 2;
      const k = E.tech.kind, name = E.tech.name;
      if (smoke) note('e', 'info', `${name}: дым сбил прицел`);
      else if (k === 'dmg') {
        let d = eTechDmg * (eFear ? 0.6 : 1) * (E.status.slow > 0 ? 0.75 : 1);
        if (pEvading) { const slip = q > 0.7; d = slip ? 0 : d * 0.5; note('e', slip ? 'miss' : 'graze', slip ? `${name}: ты уклонился` : `${name} задевает`, { dmg: d }); }
        else if (pBlocking) { d *= 0.5; note('e', 'tech', `${name} пробивает блок`, { dmg: d }); }
        else note('e', 'tech', name, { dmg: d });
        if (techUtility && techUtility.special === 'kawarimi') { d = 0; }
        eDmgToP += d;
      } else if (k === 'drain') { const dr = Math.round(8 + E.nin); const lost = Math.min(P.ch, dr); P.ch -= lost; E.ch = Math.min(E.chMax, E.ch + lost); const d = enemyStrike(D) * 0.4; eDmgToP += pBlocking ? d * 0.3 : d; note('e', 'drain', `${name}: ты теряешь ${lost} чакры`, { dmg: d }); }
      else if (k === 'bind') { P.status.bind = 1; const d = enemyStrike(D) * 0.3; eDmgToP += d; note('e', 'status', `${name}: уклон невозможен в следующем раунде`, { dmg: d }); }
      else if (k === 'fear') { P.status.fear = 2; note('e', 'status', `${name}: мысли путаются, тайминг шире не будет`); }
    }
    // отражение клонов
    if (eDmgToP > 0 && P.clones > 0) { P.clones--; eDmgToP = 0; note('p', 'info', 'Клон принял удар'); }
    // статусы
    P.shield = 0;
    for (const s of ['stun', 'fear', 'slow', 'wet']) if (E.status[s] > 0) E.status[s]--;
    if (E.cd > 0) E.cd--;
    if (P.status.smoke > 0) P.status.smoke--;
    for (const s of ['bind', 'fear', 'henge']) if (P.status[s] > 0) P.status[s]--;

    // — применить урон
    pDmgToE = Math.round(pDmgToE); eDmgToP = Math.round(eDmgToP);
    E.hp = clamp(E.hp - pDmgToE, 0, E.hpMax); P.hp = clamp(P.hp - eDmgToP, 0, P.hpMax);
    P.heat = clamp(P.heat + HEAT_ROUND + (eDmgToP > 0 ? HEAT_HIT : 0), 0, HEAT_MAX);
    E.ch = Math.min(E.chMax, E.ch + 1);
    D.last = { pAct, eAct, q, pDmgToE, eDmgToP, surge, hintTrue: D.hintTrue };
    // — конец боя
    if (E.hp <= 0 || (D.mode === 'spar' && E.hp <= E.hpMax * SPAR_END)) D.over = { win: true };
    else if (P.hp <= 0 || (D.mode === 'spar' && P.hp <= P.hpMax * SPAR_END)) D.over = { win: false };
    else if (D.mode === 'survive' && D.round >= D.rounds) D.over = { win: true };
    else if (D.round >= 40) D.over = { win: E.hp / E.hpMax < P.hp / P.hpMax };   // страховка от затяжки
    D.events = ev;
    if (!D.over) nextIntent(D); else D.hint = null;
    return ev;
  }
  function comboBonus() { if (!G.combat || !G.state || !G.state.flags) return 0; let b = 0; for (const [id, c] of Object.entries(G.COMBOS || {})) if (G.combat.knowsCombo(id) && id !== 'academy') b += c.bonus || 0; return b; }

  // ── бот для симулятора: skill 0..1 — как часто бот пользуется намёком и умными выборами ──
  function bot(D, skill, rng = D.rng) {
    const P = D.P, E = D.E;
    let want;
    const useHint = rng() < skill * (D.hintTrue ? 1 : 0.55 + (1 - skill) * 0.2);   // верит намёку чаще, чем он прав — и ошибается
    const hint = D.hint;
    if (useHint && hint && hint !== 'idle') want = hint === 'tech' ? 'block' : best(hint);   // ответ на намёк
    else want = ACTS[Math.floor(rng() * 3)];
    const eStunned = E.status.stun > 0 || D.intent === 'idle';
    const techs = P.techs.filter((t) => P.ch >= G.TECHS[t].ch && ['chakra_shot', 'katon', 'suiton', 'raiton', 'fuuton'].includes(t));
    if (P.knows('fear') && !E.status.fear && P.ch >= G.TECHS.fear.ch && rng() < 0.1 + 0.05 * P.st('gen') * skill) return { act: 'tech:fear', q: clamp(0.4 + skill * 0.4 + (rng() - 0.5) * 0.3, 0, 1) };
    if (eStunned || E.style === 'dummy') return { act: 'strike', q: clamp(0.5 + skill * 0.3 + (rng() - 0.5) * 0.3, 0, 1) };
    if (P.heat >= RELEASE_HEAT && P.ch >= RELEASE_COST && rng() < 0.3 + skill * 0.4) return { act: 'release', q: clamp(0.4 + skill * 0.4 + (rng() - 0.5) * 0.3, 0, 1) };
    if (techs.length && want !== 'evade' && rng() < 0.25 + skill * 0.3) return { act: 'tech:' + techs[Math.floor(rng() * techs.length)], q: clamp(0.4 + skill * 0.4 + (rng() - 0.5) * 0.3, 0, 1) };
    if (P.knows('bunshin') && !P.clones && P.ch >= G.TECHS.bunshin.ch && rng() < 0.12 * skill) return { act: 'tech:bunshin', q: 0.6 };
    if (P.hp < P.hpMax * 0.35 && (D.inv.bandage || 0) > 0 && rng() < 0.5) return { act: 'item:bandage', q: 0.5 };
    const q = clamp(0.35 + skill * 0.45 + (rng() - 0.5) * 0.4 + (window(D) - 0.4) * 0.3, 0, 1);
    return { act: want, q };
  }
  // полный бой ботом; возвращает итог
  function simulate(opts, skill = 0.65) {
    const D = create(opts); let guard = 0;
    while (!D.over && guard++ < 80) { const b = bot(D, skill); play(D, b.act, b.q); }
    return { win: !!(D.over && D.over.win), rounds: D.round, hp: D.P.hp / D.P.hpMax, fat: D.P.fat };
  }

  return { TUNE, create, play, options, bot, simulate, stability, window, hintAccuracy, mulberry, ACTS, BEATS, KIND_ICON, SPAR_END, RELEASE_HEAT, RELEASE_COST, BOOST, FAT_ROUND };
})();
