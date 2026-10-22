// Этапы 7–9: дополнительные жители, места тренировок, доска поручений, ночной торговец, секретные свитки.
(() => {
  const H = 60;
  const basePopulate = G.world.populateKonoha.bind(G.world);
  G.world.populateKonoha = function (m) {
    basePopulate(m);
    const T = G.CONFIG.TILE;
    const at = (p) => ({ x: p[0] * T + 8, y: p[1] * T + 12 });
    const add = (tx, ty, def) => { const p = this.freeTile(m, tx, ty); if (p) m.npcs.push(this.makeNpc(Object.assign({}, def, at(p)))); };
    const day = () => G.state.vars.day;
    const AN = G.KONOHA_DRAFT.anchors || {}, an = (k, d) => AN[k] || d;   // опорные точки из раскладки (tools/plan_konoha.py)
    // одноклассники и знакомые
    add(...an('choji', [46, 55]), { id: 'choji', dir: 'down', talk: 'choji_talk', sched: [[14 * H, 20 * H, 'wd'], [11 * H, 20 * H, 'we']] });
    add(...an('kiba', [14, 104]), { id: 'kiba', dir: 'right', talk: 'kiba_talk', ai: 'wander', wanderR: 24, sched: [[14 * H, 19 * H, 'wd'], [8 * H, 18 * H, 'we']] });
    add(...an('shino', [100, 118]), { id: 'shino', dir: 'down', talk: 'shino_talk', sched: [[14 * H, 18 * H, 'wd'], [10 * H, 17 * H, 'we']], dryOnly: true });
    add(...an('lee', [38, 115]), { id: 'lee', dir: 'left', talk: 'lee_talk', sched: [[15 * H, 21 * H, 'wd'], [6 * H, 21 * H, 'we']], cond: () => day() >= 18 || G.state.flags.met_lee });
    add(...an('guy', [40, 115]), { id: 'guy', dir: 'left', talk: 'guy_talk', sched: [[16 * H, 20 * H]], cond: () => day() >= 18 || G.state.flags.met_lee });
    // ночной торговец в переулке (каждую третью ночь)
    add(...an('thief', [104, 68]), { id: 'thief', name: 'Ночной торговец', dir: 'down', shop: 'night', reach: 20, sched: [[21 * H, 26 * H]], cond: () => day() % 3 === 0 });
    // объекты тренировок на полигонах
    for (const o of m.objects) {
      if (o.kind === 'target') o.talk = 'train_throw';
      else if (o.kind === 'dummy') o.talk = 'train_dummy';
      else if (o.kind === 'post') o.talk = 'train_tree';
      else if (o.kind === 'log' || o.kind === 'stump') o.talk = 'train_log';
    }
    const obj = (kind, tx, ty, talk) => { const p = this.freeTile(m, tx, ty, true); if (p) return m.addObject(kind, p[0] * T + 8, p[1] * T + 15, { talk }); };
    obj('sign', ...an('board', [44, 28]), 'board');
    obj('sign', ...an('run', [81, 46]), 'train_run');
    obj('stump', ...an('falls', [123, 112]), 'train_falls');
    obj('stump', ...an('water', [138, 104]), 'train_water');
    obj('stump', ...an('stealth', [16, 30]), 'train_stealth');
    // 20 секретных свитков (план §5.9): спрятаны по всей деревне
    // свиток не кладём туда, где уже стоит житель: бочка или камень на его клетке запирают его в стене
    const rnd = G.util.rng(2024), pts = m.spawnPoints.filter((p) => !m.npcs.some((n) => Math.hypot(n.x - p.x, n.y - p.y) < 24));
    const kinds = ['barrel', 'crate', 'stump', 'rock'];
    const used = [];
    for (let i = 0; i < 20 && pts.length; i++) {
      let p = null;
      for (let k = 0; k < 40; k++) { const c = pts[Math.floor(rnd() * pts.length)]; if (used.every((u) => Math.hypot(u.x - c.x, u.y - c.y) > 200)) { p = c; break; } }
      if (!p) p = pts[Math.floor(rnd() * pts.length)];
      used.push(p);
      const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
      const o = obj(kinds[i % 4], tx, ty, 'scroll_' + i);
      if (o) o.secret = i;
    }
    G.outdoor.addHerbs(m);
    m.finalize();
  };

  // интерьеры: учёба, додзё, дом героя
  const K = G.interiors.KINDS;
  const wrap = (kind, fn) => { const base = K[kind]; K[kind] = (info) => { const m = base(info); fn(m, info); return m; }; };
  wrap('library', (m) => { for (const n of m.npcs) n.talk = 'library_talk'; });
  wrap('dojo', (m) => { for (const n of m.npcs) n.talk = 'dojo_talk'; for (const o of m.objects) if (o.kind === 'dummy') o.talk = 'train_dummy'; });
  wrap('hero_home', (m) => {
    for (const o of m.objects) {
      if (o.kind === 'desk') o.talk = 'home_desk';
      if (o.kind === 'flowerpot') o.talk = 'home_flower';
      if (o.kind === 'chest') o.talk = 'home_chest';
    }
  });
  for (const k of ['nara_hall', 'akimichi_hall', 'hyuga_hall', 'inuzuka_hall', 'aburame_hall', 'senju_hall', 'sarutobi_hall', 'yamanaka_hall', 'uchiha_hall']) {
    const base = K[k];
    K[k] = (info) => { const m = base(info); return m; };
  }
})();

// Скрипты простых точек тренировки (генерируются)
(() => {
  const spots = {
    train_throw: ['Мишени для метания.', 'throw'], train_dummy: ['Тренировочный манекен.', 'dummy'], train_log: ['Бревно для ритм-ударов.', 'log'],
    train_tree: ['Высокий столб и деревья вокруг полигона.', 'tree'], train_falls: ['Шум водопада. Здесь хорошо медитировать.', 'falls'],
    train_water: ['Гладь озера. Говорят, шиноби умеют ходить по воде.', 'water'], train_run: ['Табличка: «Бег по крышам запрещён!» Но кто её читает...', 'run'],
    train_stealth: ['Лес Нара. Олени чутко слушают каждый шорох.', 'stealth'],
  };
  let src = '';
  for (const [id, [text, tr]] of Object.entries(spots)) {
    const t = G.TRAININGS[tr];
    src += `=== ${id}\n: ${text}\n? ${t.name} (${t.minutes} мин, энергия −${t.energy})\n* Тренироваться -> go\n* Не сейчас -> no\n# go\ncall train ${tr}\nend\n# no\nend\n`;
  }
  for (let i = 0; i < 20; i++) src += `=== scroll_${i}\ncall scroll ${i}\nend\n`;
  G.script.parse(src);
})();
