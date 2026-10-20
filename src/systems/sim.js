// Симулятор баланса (этап 10): бои без отрисовки, бот с «мастерством» 0..1, модель роста характеристик,
// экономика недели. Запуск: tools/balance.py (Playwright) → BALANCE.md. В игре не используется.
G.sim = {
  // ── стартовые сборки (12 очков поверх базовых 3, максимум 7) ──
  BUILDS: {
    tai: { name: 'Тайдзюцу', add: { tai: 4, spd: 2, end: 3, chakra: 1, ctrl: 1, nin: 1 }, skills: ['tough', 'grit'], focus: ['dummy', 'throw', 'log', 'run'] },
    nin: { name: 'Ниндзюцу', add: { nin: 4, chakra: 2, ctrl: 3, gen: 1, spd: 1, end: 1 }, skills: ['fast_hands', 'big_chakra'], focus: ['seals', 'falls', 'meditate', 'tree'] },
    gen: { name: 'Гендзюцу', add: { gen: 4, know: 3, ctrl: 1, chakra: 1, spd: 2, end: 1 }, skills: ['analyst', 'eagle_eye'], focus: ['stealth', 'library', 'meditate', 'seals'] },
    bal: { name: 'Универсал', add: { tai: 2, nin: 1, gen: 1, chakra: 2, ctrl: 2, spd: 2, end: 1, know: 1 }, skills: ['diligent', 'analyst'], focus: ['dummy', 'seals', 'run', 'meditate', 'library', 'throw'] },
  },
  LESSON_XP: [{ know: 6 }, { tai: 4, spd: 3 }, { nin: 5, ctrl: 2 }, { tai: 6, end: 2 }, { chakra: 4, ctrl: 3 }],
  startStats(b) { const s = {}; for (const st of G.STATS) s[st.id] = G.STAT_BASE + (this.BUILDS[b].add[st.id] || 0); return s; },

  // ── модель роста: средний игрок (оценки ~75%, 3 тренировки в будни, 5 в выходные, раз в день — с другом) ──
  growth(b, upto = 54, o = {}) {
    const B = this.BUILDS[b], s = this.startStats(b), xp = {}, cap = G.STAT_CAP, perDay = o.perDay || [2, 4], score = o.score ?? 0.75;
    const need = (st) => G.train.needAt(s[st]);
    const add = (st, n) => { xp[st] = (xp[st] || 0) + n; while (s[st] < cap && xp[st] >= need(st)) { xp[st] -= need(st); s[st]++; } };
    const dil = B.skills.includes('diligent') ? 1.25 : 1;
    const snaps = {};
    for (let d = 1; d <= upto; d++) {
      const wd = (d - 1) % 7, school = d >= 2 && d < 54 && wd < 5 && d !== 26 && d !== 38;
      if (school) for (const [k, n] of Object.entries(this.LESSON_XP[wd])) add(k, n * (0.5 + score));
      const n = d === 1 ? 0 : perDay[school ? 0 : 1];
      const pool = B.focus.filter((t) => t !== 'tree' || d >= 29);
      const count = {};
      for (let i = 0; i < n; i++) {
        const id = pool[i % pool.length]; const rep = count[id] = (count[id] || 0) + 1;
        let m = [1, 0.7, 0.45, 0.3][Math.min(3, rep - 1)] * dil * (i === 0 ? 1.5 : 1) * (0.35 + 0.65 * score);
        for (const [k, base] of Object.entries(G.TRAININGS[id].stats)) add(k, base * m);
      }
      if ([1, 3, 14, 18, 26, 38, 47, 54].includes(d)) snaps[d] = Object.assign({}, s);
    }
    return snaps;
  },
  techsAt(d) { const t = []; if (d >= 8) t.push('kawarimi'); if (d >= 15) t.push('henge'); if (d >= 17) t.push('fear'); if (d >= 43) t.push('bunshin'); if (d >= 20) t.push('fuuton'); if (d >= 24) t.push('katon'); return t; },
  combosAt(d) { const c = []; if (d >= 18) c.push('air'); if (d >= 40) c.push('whirl'); return c; },
  invAt(d) { return d < 14 ? { kunai: 6, shuriken: 8, bandage: 2, smoke_bomb: 1, wire: 1 } : d < 38 ? { kunai: 8, shuriken: 10, bandage: 3, smoke_bomb: 1, flash_bomb: 1, wire: 2, chakra_pill: 1 } : { kunai: 10, shuriken: 12, bandage: 3, smoke_bomb: 2, flash_bomb: 1, wire: 2, chakra_pill: 2, tag_explosive: 2 }; },

  // ── один бой ──
  battle(cfg) {
    const snap = JSON.stringify(G.state), st = G.state;
    const sndOld = G.audio.enabled; G.audio.enabled = false;
    const slowOld = G.storage.settings.reactSlow; G.storage.settings.reactSlow = !!cfg.slow;
    let out;
    try {
      st.hero.stats = Object.assign({}, cfg.stats); st.hero.skills = (cfg.skills || []).slice();
      for (const k of Object.keys(st.flags)) if (/^(tech_|combo_)/.test(k)) delete st.flags[k];
      for (const t of cfg.techs || []) { st.flags['tech_' + t] = 1; st.vars['use_' + t] = cfg.uses || 0; }
      for (const c of cfg.combos || []) st.flags['combo_' + c] = 1;
      st.flags.tactic = cfg.tactic ? 1 : 0;
      st.inv = Object.assign({}, cfg.inv || {}); st.vars.day = cfg.day || 1; st.vars.hp = 100; st.vars.chakra = 100;
      let res = null;
      const S = G.scenes.make('battle', { enemy: cfg.enemy, mode: cfg.mode || 'ko', terrain: cfg.terrain || 'field', turns: cfg.turns, story: cfg.story, allies: cfg.allies, will: cfg.will }, (r) => { res = r; });
      const log = cfg.log ? S.sim.startLog() : null;
      S.enter();
      let it = 0, turns = 0;
      const sk = cfg.skill ?? 0.65, R = Math.random;
      while (it++ < 40000) {
        const s = S.state;
        if (s === 'end') { res = S.sim.result(); break; }
        if (s === 'menu') { turns++; if (!this.decide(S, cfg)) S.sim.press('misc', 'Защита'); }
        else if (s === 'rhythm') { const x = R(); S.sim.rhythm(x < 0.05 + 0.5 * sk ? 'crit' : x < 0.45 + 0.45 * sk ? 'ok' : 'weak'); }
        else if (s === 'seals') { const x = R(), c = S.P.ctrl * 0.02; S.sim.seals(x < 0.08 + 0.55 * sk + c ? 'perfect' : x < 0.7 + 0.28 * sk + c ? 'ok' : 'fail'); }
        else if (s === 'react') this.react(S, sk);
        else if (s === 'target') S.sim.target(R() < ((cfg.skills || []).includes('analyst') ? 0.6 : 0.34));
        else if (s === 'moment') S.sim.moment();
        S.update(0.1);
      }
      const P = S.P, E = S.E;
      out = { win: !!(res && res.win), ringout: !!(res && res.ringout), timeout: !res, turns, hp: Math.max(0, P.hp) / P.hpMax, log, ehp: Math.max(0, E.hp) / E.hpMax };
    } finally {
      const back = JSON.parse(snap);
      for (const k of Object.keys(G.state)) delete G.state[k];
      Object.assign(G.state, back);
      G.audio.enabled = sndOld; G.storage.settings.reactSlow = slowOld;
    }
    return out;
  },
  react(S, sk) {
    const R = Math.random, info = S.sim.reactInfo() || { dmg: 5 };
    if (R() < (1 - sk) * 0.35) return S.sim.react('none');                       // не успел
    if (info.kawa && info.dmg >= 8 && R() < 0.6) return S.sim.react(R() < 0.4 + 0.5 * sk ? 'kawa_ok' : 'kawa_fail');
    if (S.P.br >= 1 && info.dmg >= 6 && R() < 0.55) return S.sim.react('block');
    return S.sim.react('dodge');
  },
  // политика бота: true — действие выбрано
  decide(S, cfg) {
    const P = S.P, E = S.E, sim = S.sim, d = sim.dist(), b = cfg.build || 'bal', R = Math.random, mode = S.opts.mode;
    const can = (m, l) => { const x = sim.buttons(m).find((y) => y.label === l); return x && !x.off; };
    const tryP = (m, l) => can(m, l) && sim.press(m, l);
    const tech = (id) => G.combat.knows(id) && tryP('tech', G.TECHS[id].name);
    if (sim.menu() === 'momentPick') return sim.press('momentPick', 'Финал. комбо');
    if (P.will >= 100 && tryP('misc', 'Воля Огня!')) return true;
    if ((mode === 'bells' || mode === 'scroll') && d <= 1 && (E.s.stun || E.s.blind || E.s.bound || E.s.fear || R() < 0.3) && tryP('misc', mode === 'bells' ? 'Колокольчик' : 'Свиток')) return true;
    if (P.hp < P.hpMax * 0.35 && R() < 0.8 && tryP('tool', 'Бинт')) return true;
    if (P.ch < P.chMax * 0.2 && tryP('tool', 'Пилюля')) return true;
    if (!P.clones && R() < (b === 'nin' ? 0.45 : 0.2) && tech('bunshin')) return true;
    if (d <= 3 && R() < (b === 'nin' ? 0.55 : b === 'bal' ? 0.25 : 0.08) && (tech('katon') || tech('fuuton') || tech('suiton') || tech('raiton'))) return true;
    if (!E.s.fear && R() < (b === 'gen' ? 0.4 : 0.12) && tech('fear')) return true;
    if (!P.s.hidden && d >= 2 && R() < (b === 'nin' ? 0.4 : b === 'gen' ? 0.25 : 0.06) && tech('henge')) return true;
    if ((mode === 'bells' || mode === 'scroll') && d <= 2 && !E.s.blind && R() < 0.45 && (tryP('tool', 'Вспышка') || tryP('tool', 'Дым. бомба'))) return true;
    if (d <= 2 && R() < 0.08 && tryP('tool', 'Взрыв. печать')) return true;
    // ниндзюцу-игрок разрывает дистанцию, чтобы спрятаться в Хенге и ударить из засады
    if (b === 'nin' && d <= 1 && !P.s.hidden && P.ch >= 8 && G.combat.knows('henge') && R() < 0.4 && (tryP('move', 'Отскок') || tryP('move', 'Назад'))) return true;
    if (d <= 1) {
      if (P.br >= 3) for (const c of ['Вихрь Листа', 'Воздушное комбо', 'Связка Академии']) if (R() < 0.7 && tryP('tai', c)) return true;
      if (P.br >= 1) { const seqs = [['punch', 'kick', 'sweep'], ['sweep', 'upper', 'punch'], ['punch', 'punch', 'kick'], ['kick', 'punch', 'upper']]; S.act('tai', seqs[Math.floor(R() * seqs.length)].slice(0, Math.min(3, P.br))); return true; }
      return tryP('misc', 'Защита');
    }
    if (R() < (b === 'tai' ? 0.22 : 0.4) && tryP('throw', R() < 0.5 ? 'Кунай' : 'Сюрикен')) return true;
    if (d >= 3 && P.br >= 1 && R() < 0.5 && tryP('move', 'Рывок')) return true;
    if (P.ch < P.chMax * 0.4 && R() < 0.3 && tryP('misc', 'Концентр.')) return true;
    return tryP('move', 'Вперёд') || tryP('misc', 'Защита');
  },

  // ── сценарии сюжета: кто, когда, на каких условиях ──
  SCEN: [
    { id: 'kiba_d3', day: 3, enemy: 'kiba', mode: 'spar', terrain: 'yard', label: 'Киба, спарринг (д.3)' },
    { id: 'dummy2_d8', day: 8, enemy: 'dummy2', mode: 'spar', terrain: 'yard', label: 'Кусачий манекен (д.8)' },
    { id: 'bully_d12', day: 12, enemy: 'bully', mode: 'ko', terrain: 'street', label: 'Хулиган, событие (д.12)' },
    { id: 'dog_d12', day: 12, enemy: 'dog', mode: 'ko', terrain: 'street', label: 'Бродячий пёс (д.12)' },
    { id: 'naruto_d14', day: 14, enemy: 'naruto', mode: 'spar', terrain: 'yard', label: 'Наруто, урок (д.14)' },
    { id: 'lee_d18', day: 18, enemy: 'lee', mode: 'spar', terrain: 'field', label: 'Рок Ли (д.18)' },
    { id: 'choji_d26', day: 26, enemy: 'choji', mode: 'ringout', terrain: 'ring', label: 'Турнир: Чоджи (д.26)' },
    { id: 'kiba_d26', day: 26, enemy: 'kiba_t', mode: 'ringout', terrain: 'ring', label: 'Турнир: Киба (д.26)' },
    { id: 'sasuke_d26', day: 26, enemy: 'sasuke', mode: 'ringout', terrain: 'ring', story: true, label: 'Турнир: Саске (д.26)' },
    { id: 'bully_d33', day: 33, enemy: 'bully', mode: 'ko', terrain: 'street', label: 'Хулиган, событие (д.33)' },
    { id: 'thief_d30', day: 30, enemy: 'thief', mode: 'ko', terrain: 'night', label: 'Ночной вор (д.30)' },
    { id: 'senior_d38', day: 38, enemy: 'senior', mode: 'scroll', terrain: 'forest', turns: 12, label: 'Полевой выход: свиток (д.38)' },
    { id: 'iruka_d47', day: 47, enemy: 'iruka', mode: 'bells', terrain: 'yard', turns: 10, label: 'Колокольчики Ируки (д.47)' },
    { id: 'mizuki_d54', day: 54, enemy: 'gendo', mode: 'ko', terrain: 'night', story: true, allies: ['iruka', 'naruto'], will: 30, label: 'ФИНАЛ: Гэндо (д.54)' },
  ],
  run(scId, build, skill, n = 20, statsDay = null) {
    const sc = this.SCEN.find((x) => x.id === scId), B = this.BUILDS[build];
    const g = this.growth(build, 54);
    const dd = statsDay || sc.day, key = Object.keys(g).map(Number).filter((k) => k <= dd).pop();
    const stats = g[key];
    const cfg = Object.assign({}, sc, { stats, skills: B.skills, build, skill, techs: this.techsAt(sc.day), combos: this.combosAt(sc.day), inv: this.invAt(sc.day), uses: Math.max(0, Math.round((sc.day - 8) * 0.5)) });
    let w = 0, turns = 0, hp = 0, ehp = 0, ro = 0, to = 0;
    for (let i = 0; i < n; i++) { const r = this.battle(cfg); if (r.win) { w++; hp += r.hp; } turns += r.turns; ehp += r.ehp; if (r.ringout) ro++; if (r.timeout) to++; }
    return { sc: scId, label: sc.label, build, skill, n, win: w / n, turns: turns / n, hpLeft: w ? hp / w : 0, enemyLeft: ehp / n, ringout: ro, timeout: to, stats };
  },

  // ── экономика: оценка средней недели ──
  economy() {
    const jobs = Object.values(G.JOBS), avgJob = jobs.reduce((a, j) => a + j.pay, 0) / jobs.length;
    const I = G.ITEMS;
    return {
      avgJob: Math.round(avgJob), jobScore: 0.8, jobPay: Math.round(avgJob * (0.4 + 0.6 * 0.8)),
      ramen: I.ramen_miso.price, foodPerDay: 6 * 16, riceFree: 2 * 25,
      fishSell: G.outdoor.sellPrice('fish'), carpSell: G.outdoor.sellPrice('carp'), herbSell: G.outdoor.sellPrice('herb'),
      kunai: I.kunai.price, bandage: I.bandage.price, pill: I.chakra_pill.price, rod: I.fishing_rod.price,
    };
  },
};
