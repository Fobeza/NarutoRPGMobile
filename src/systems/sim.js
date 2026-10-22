// Симулятор баланса: бои «Дуэли» без отрисовки (ядро G.duel), бот с «мастерством» 0..1, модель роста характеристик, экономика.
// Запуск: tools/balance.py → docs/BALANCE.md. В игре не используется.
G.sim = {
  // ── стартовые сборки (12 очков поверх базовых 3, максимум 7) ──
  BUILDS: {
    tai: { name: 'Тайдзюцу', add: { tai: 4, spd: 2, end: 3, chakra: 1, ctrl: 1, nin: 1 }, skills: ['tough', 'grit'], focus: ['dummy', 'throw', 'log', 'run'] },
    nin: { name: 'Ниндзюцу', add: { nin: 4, chakra: 2, ctrl: 3, gen: 1, spd: 1, end: 1 }, skills: ['fast_hands', 'big_chakra'], focus: ['seals', 'falls', 'meditate', 'tree'] },
    gen: { name: 'Гендзюцу', add: { gen: 4, know: 3, ctrl: 1, chakra: 1, spd: 2, end: 1 }, skills: ['analyst', 'eagle_eye'], focus: ['stealth', 'library', 'meditate', 'seals'] },
    bal: { name: 'Универсал', add: { tai: 2, nin: 1, gen: 1, chakra: 2, ctrl: 2, spd: 2, end: 1, know: 1 }, skills: ['diligent', 'analyst'], focus: ['dummy', 'seals', 'run', 'meditate', 'library'] },
  },
  LESSON_XP: [{ know: 6 }, { tai: 4, spd: 3 }, { nin: 5, ctrl: 2 }, { tai: 6, end: 2 }, { chakra: 4, ctrl: 3 }],
  DAYS: [1, 3, 8, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21],
  startStats(b) { const s = {}; for (const st of G.STATS) s[st.id] = G.STAT_BASE + (this.BUILDS[b].add[st.id] || 0); return s; },

  // ── модель роста: средний игрок (оценки ~75%, 3 тренировки в будни, 5 в выходные, раз в день — с другом) ──
  growth(b, upto = 21, o = {}) {
    const B = this.BUILDS[b], s = this.startStats(b), xp = {}, cap = G.STAT_CAP, perDay = o.perDay || [2, 4], score = o.score ?? 0.75;
    const need = (st) => G.train.needAt(s[st]);
    const add = (st, n) => { xp[st] = (xp[st] || 0) + n; while (s[st] < cap && xp[st] >= need(st)) { xp[st] -= need(st); s[st]++; } };
    const dil = B.skills.includes('diligent') ? 1.25 : 1;
    const snaps = {};
    for (let d = 1; d <= upto; d++) {
      const wd = (d - 1) % 7, school = G.academy.isSchoolDay(d);
      if (school) for (const [k, n] of Object.entries(this.LESSON_XP[wd])) add(k, n * (0.5 + score));
      const n = d === 1 ? 0 : perDay[school ? 0 : 1];
      const pool = B.focus.filter((t) => t !== 'tree' || d >= 9);
      const count = {};
      for (let i = 0; i < n; i++) {
        const id = pool[i % pool.length]; const rep = count[id] = (count[id] || 0) + 1;
        let m = [1, 0.7, 0.45, 0.3][Math.min(3, rep - 1)] * dil * (i === 0 ? 1.5 : 1) * (0.35 + 0.65 * score);
        for (const [k, base] of Object.entries(G.TRAININGS[id].stats)) add(k, base * m);
      }
      if (this.DAYS.includes(d)) snaps[d] = Object.assign({}, s);
    }
    return snaps;
  },
  techsAt(d) { const t = []; if (d >= 2) t.push('chakra_shot'); if (d >= 17) t.push('fear'); if (d >= 8) t.push('kawarimi'); if (d >= 12) t.push('henge'); if (d >= 16) t.push('bunshin'); return t; },
  invAt(d) { return d < 8 ? { bandage: 2, smoke_bomb: 1 } : { bandage: 3, smoke_bomb: 1, flash_bomb: 1, chakra_pill: 1 }; },
  // практика контроля чакры к дню d (тренировки на контроль и осмотры)
  purpleCtl(d) { return Math.min(30, Math.round(d * 1.2)); },

  // ── сценарии боёв нового сюжета ──
  SCEN: [
    { id: 'dummy2_d8', day: 8, enemy: 'dummy2', mode: 'spar', terrain: 'yard', label: 'Манекен Ируки (д.8)' },
    { id: 'kiba_d11', day: 11, enemy: 'kiba', mode: 'spar', terrain: 'yard', label: 'Киба, спарринг (д.11)' },
    { id: 'bully_d12', day: 12, enemy: 'bully', mode: 'ko', terrain: 'street', label: 'Хулиган, событие (д.12)' },
    { id: 'dog_d12', day: 12, enemy: 'dog', mode: 'ko', terrain: 'street', label: 'Бродячий пёс (д.12)' },
    { id: 'naruto_d14', day: 14, enemy: 'naruto', mode: 'spar', terrain: 'yard', label: 'Наруто (д.14)' },
    { id: 'hinata_d15', day: 15, enemy: 'hinata', mode: 'spar', terrain: 'yard', label: 'Хината (д.15)' },
    { id: 'shikamaru_d16', day: 16, enemy: 'shikamaru', mode: 'spar', terrain: 'field', label: 'Шикамару (д.16)' },
    { id: 'thief_d16', day: 16, enemy: 'thief', mode: 'ko', terrain: 'night', label: 'Ночной вор (д.16)' },
    { id: 'ino_d17', day: 17, enemy: 'ino', mode: 'spar', terrain: 'yard', label: 'Ино (д.17)' },
    { id: 'lee_d18', day: 18, enemy: 'lee', mode: 'spar', terrain: 'field', label: 'Рок Ли (д.18)' },
    { id: 'choji_d19', day: 19, enemy: 'choji', mode: 'spar', terrain: 'field', label: 'Чоджи (д.19)' },
    { id: 'sasuke_d19', day: 19, enemy: 'sasuke', mode: 'spar', terrain: 'yard', label: 'Саске (д.19)' },
    { id: 'iruka_d20', day: 20, enemy: 'iruka', mode: 'spar', terrain: 'yard', label: 'Ирука (д.20)' },
  ],
  // один бой ботом; cfg — сценарий + { stats, skills, build, skill }
  battle(cfg) {
    const R = Math.random;
    const r = G.duel.simulate({ enemy: cfg.enemy, mode: cfg.mode || 'ko', rounds: cfg.turns, stats: cfg.stats, skills: cfg.skills || [], techs: cfg.techs || [], day: cfg.day,
      stability: cfg.stability, fatigue: 15, hp: 100, chakra: 100, inv: cfg.inv || {}, rng: R }, cfg.skill ?? 0.65);
    return { win: r.win, turns: r.rounds, hp: r.hp, timeout: r.rounds >= 40 };
  },
  run(scId, build, skill, n = 20, statsDay = null) {
    const sc = this.SCEN.find((x) => x.id === scId), B = this.BUILDS[build];
    const g = this.growth(build, 21);
    const dd = statsDay || sc.day, key = Object.keys(g).map(Number).filter((k) => k <= dd).pop();
    const stats = g[key];
    const stability = Math.round(Math.max(5, Math.min(100, 10 + (stats.ctrl - 1) * 7 + this.purpleCtl(sc.day) - 15 * 0.3)));
    const cfg = Object.assign({}, sc, { stats, skills: B.skills, build, skill, techs: this.techsAt(sc.day), inv: this.invAt(sc.day), stability });
    let w = 0, turns = 0, hp = 0, to = 0;
    for (let i = 0; i < n; i++) { const r = this.battle(cfg); if (r.win) { w++; hp += r.hp; } turns += r.turns; if (r.timeout) to++; }
    return { sc: scId, label: sc.label, build, skill, n, win: w / n, turns: turns / n, hpLeft: w ? hp / w : 0, timeout: to, stats, stability };
  },

  // ── экономика: оценка средней недели ──
  economy() {
    const jobs = Object.values(G.JOBS), avgJob = jobs.reduce((a, j) => a + j.pay, 0) / jobs.length;
    const I = G.ITEMS;
    return {
      avgJob: Math.round(avgJob), jobScore: 0.8, jobPay: Math.round(avgJob * (0.4 + 0.6 * 0.8)),
      ramen: I.ramen_miso.price, fatiguePerDay: Math.round(0.07 * 60 * 16), riceRest: 15,
      fishSell: G.outdoor.sellPrice('fish'), carpSell: G.outdoor.sellPrice('carp'), herbSell: G.outdoor.sellPrice('herb'),
      kunai: I.kunai.price, bandage: I.bandage.price, pill: I.chakra_pill.price, rod: I.fishing_rod.price,
    };
  },
};
