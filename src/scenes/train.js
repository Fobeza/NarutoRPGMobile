// Мини-игры тренировок и подработок. kind: throw | log | meditate | tree | seals | run | quiz | cat | sort
// onDone(score 0..1). opts: { title, quiz: [...] (свои вопросы), sortCats, partner }
G.QUIZ = [
  ['Кто основал Коноху?', ['Хаширама и Мадара', 'Третий Хокаге', 'Клан Хьюга'], 0],
  ['Какой зверь напал на деревню 12 лет назад?', ['Девятихвостый лис', 'Восьмихвостый бык', 'Гигантская змея'], 0],
  ['Кто сейчас Хокаге?', ['Хирузен Сарутоби', 'Минато Намиказе', 'Данзо'], 0],
  ['Сколько основных печатей рук?', ['12', '10', '8'], 0],
  ['Что такое Каварими?', ['Техника замены', 'Техника превращения', 'Иллюзия'], 0],
  ['Из чего складывается чакра?', ['Физическая и духовная энергия', 'Кровь и воздух', 'Только сила воли'], 0],
  ['Кто был Четвёртым Хокаге?', ['Минато Намиказе', 'Тобирама Сенджу', 'Джирайя'], 0],
  ['Гендзюцу действует на...', ['Разум и чувства врага', 'Землю под ногами', 'Оружие врага'], 0],
  ['Ранг ниндзя после генина?', ['Чунин', 'Джонин', 'АНБУ'], 0],
  ['Что означает «Воля Огня»?', ['Любовь к деревне и вера в товарищей', 'Огненная техника Учиха', 'Клятва АНБУ'], 0],
  ['Какой клан владеет Бьякуганом?', ['Хьюга', 'Учиха', 'Нара'], 0],
  ['Чем знаменит клан Нара?', ['Техниками теней', 'Насекомыми', 'Собаками'], 0],
  ['Чем знаменит клан Акимичи?', ['Техникой увеличения', 'Огнём', 'Ядами'], 0],
  ['С кем всегда сражаются Инузука?', ['Вместе с нинкенами', 'В одиночку', 'С жуками'], 0],
  ['Сколько человек в обычной команде генинов?', ['Трое и сенсей', 'Двое', 'Пятеро'], 0],
  ['Что приносит контроль чакры?', ['Меньше затрат на техники', 'Больше HP', 'Быстрее бег'], 0],
  ['Какое оружие ниндзя самое универсальное?', ['Кунай', 'Катана', 'Лук'], 0],
  ['Для чего нужна взрывная печать?', ['Ловушки и подрыв', 'Лечение', 'Связь'], 0],
  ['Хождение по дереву тренирует...', ['Контроль чакры', 'Силу ног', 'Гендзюцу'], 0],
  ['Что делает Хенге?', ['Меняет облик', 'Создаёт клонов', 'Лечит'], 0],
  ['Буншин — это...', ['Иллюзорные клоны', 'Теневые клоны', 'Деревянные клоны'], 0],
  ['Как называется деревня Песка?', ['Сунагакуре', 'Киригакуре', 'Ивагакуре'], 0],
  ['Чьё лицо высечено на Скале последним?', ['Четвёртого Хокаге', 'Первого', 'Третьего'], 0],
  ['Чего нельзя делать в комендантский час?', ['Гулять после 23:00', 'Есть рамен', 'Тренироваться днём'], 0],
  ['Главное правило шиноби?', ['Выполнить миссию и защитить товарищей', 'Никогда не отступать', 'Слушаться только себя'], 0],
];

G.scenes.register('train', (kind, opts, onDone) => {
  const W = G.screen.W, F = G.font, U = G.ui, C = U.C, AU = G.audio;
  const I = () => G.input;
  const pressA = () => I().pressed('a') || !!I().tapNow;
  let t = 0, phase = 'intro', score = 0, total = 1, msg = '', msgT = 0;
  const say = (m) => { msg = m; msgT = 0.7; };
  const R = Math.random;
  const st = {};   // состояние игры
  const INTRO = {
    throw: 'Мишень движется. Коснись экрана, когда она в прицеле.',
    log: 'Удары по ритму: коснись экрана, когда метка на линии.',
    meditate: 'Дыши: держи кнопку на вдохе (круг растёт), отпускай на выдохе.',
    tree: 'Держи кнопку — чакра в ноги. Удерживай метку в зелёной зоне.',
    seals: 'Складывай печати как можно быстрее!',
    run: 'Бег по крышам: коснись экрана, чтобы перепрыгнуть препятствие.',
    quiz: 'Вопросы по книге. Выбери верный ответ.',
    cook: 'Готовь рамен: лапша и бульон — касайся в зелёной зоне; потом повтори рецепт.',
    shogi: 'Сыграй с Шикамару: собери три в ряд. Ходишь первым.',
    cat: 'Лови кошку Тору! Касайся клетки, где она выглянет.',
    sort: 'Сортируй: коснись левой или правой половины экрана.',
  };
  const DUR = { meditate: 16, tree: 14, seals: 16, cat: 18 };

  function init() {
    if (kind === 'throw') { st.n = 0; st.max = 8; st.x = 0; st.sp = 1.6; st.zone = 9 + (G.hero.has('eagle_eye') ? 4 : 0); total = 8; }
    if (kind === 'log') { st.notes = []; let tt = 1.2; for (let i = 0; i < 12; i++) { st.notes.push({ t: tt, done: null }); tt += [0.6, 0.45, 0.9, 0.6][i % 4]; } total = 12; }
    if (kind === 'meditate') { st.sync = 0; total = 1; }
    if (kind === 'tree') { st.v = 0.3; st.z = 0.5; st.zt = 0.5; st.in = 0; st.h = 0; total = 1; }
    if (kind === 'seals') { st.seq = newSeq(); st.i = 0; st.done = 0; st.focus = 0; total = 4; }
    if (kind === 'run') { st.obs = []; let tt = 1.5; for (let i = 0; i < 12; i++) { st.obs.push({ t: tt, hit: null }); tt += 0.9 + R() * 0.7; } st.jump = 0; total = 12; }
    if (kind === 'quiz') {
      const pool = (opts.quiz || G.QUIZ).slice(); st.qs = [];
      for (let i = 0; i < (opts.n || 3) && pool.length; i++) { const q = pool.splice(Math.floor(R() * pool.length), 1)[0]; const ord = [0, 1, 2].sort(() => R() - 0.5); st.qs.push({ q: q[0], a: ord.map((k) => q[1][k]), ok: ord.indexOf(q[2]) }); }
      st.i = 0; st.focus = 0; st.res = null; total = st.qs.length;
    }
    if (kind === 'cook') { st.ph = 0; st.m = 0; st.dir = 1; st.zone = [0.52, 0.7]; st.sp = 0.9; st.res = null; total = 5; st.top = ['Нарутомаки', 'Яйцо', 'Свинина', 'Нори', 'Зелёный лук', 'Кукуруза']; st.rec = []; const pool = [0, 1, 2, 3, 4, 5].sort(() => R() - 0.5); st.rec = pool.slice(0, 3); st.show = 0; st.pi = 0; st.focus = 0; }
    if (kind === 'shogi') { st.b = Array(9).fill(0); st.turn = 0; st.t2 = 0; st.focus = 4; st.over = null; total = 1; }
    if (kind === 'cat') { st.cell = -1; st.ct = 0; st.focus = 4; st.caught = 0; total = 5; }
    if (kind === 'sort') { const cats = opts.sortCats || ['Травы', 'Бинты']; st.cats = cats; st.items = []; for (let i = 0; i < 14; i++) st.items.push(R() < 0.5 ? 0 : 1); st.i = 0; st.it = 0; total = 14; }
  }
  const WL = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const winner = (b) => { for (const l of WL) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) return b[l[0]]; return b.every((x) => x) ? 3 : 0; };
  function mm(b, me, turn) { const w = winner(b); if (w) return w === 3 ? 0 : (w === me ? 1 : -1); let best = turn === me ? -2 : 2; for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = turn; const v = mm(b, me, 3 - turn); b[i] = 0; best = turn === me ? Math.max(best, v) : Math.min(best, v); } return best; }
  function aiMove(b) { const free = []; for (let i = 0; i < 9; i++) if (!b[i]) free.push(i); if (Math.random() < 0.28) return free[Math.floor(Math.random() * free.length)]; let bs = -9, bi = free[0]; for (const i of free) { b[i] = 2; const v = mm(b, 2, 1); b[i] = 0; if (v > bs) { bs = v; bi = i; } } return bi; }
  function shogiEnd(w) { st.over = { w, t: 0 }; score = w === 1 ? 1 : w === 3 ? 0.7 : 0.25; w === 1 ? AU.sfx.confirm() : AU.sfx.select(); }
  function newSeq() { const s = []; for (let i = 0; i < 3; i++) s.push(Math.floor(R() * 12)); return s; }
  function finish() { phase = 'result'; t = 0; const s = Math.max(0, Math.min(1, score / total)); st.final = s; s >= 0.7 ? AU.sfx.confirm() : AU.sfx.select(); }
  const grid = (n, cols, y0, h) => { const bw = Math.floor((W - 8) / cols), rows = Math.ceil(n / cols), bh = Math.floor(h / rows), o = []; for (let i = 0; i < n; i++) o.push({ x: 4 + (i % cols) * bw, y: y0 + Math.floor(i / cols) * bh, w: bw - 2, h: bh - 2 }); return o; };
  function gridNav(n, cols, rects) {
    const In = I();
    if (In.pressed('left')) st.focus = (st.focus + n - 1) % n;
    if (In.pressed('right')) st.focus = (st.focus + 1) % n;
    if (In.pressed('up')) st.focus = (st.focus - cols + n * 3) % n;
    if (In.pressed('down')) st.focus = (st.focus + cols) % n;
    if (In.tapNow) { const i = rects.findIndex((r) => In.tapNow.x >= r.x && In.tapNow.x < r.x + r.w && In.tapNow.y >= r.y && In.tapNow.y < r.y + r.h); if (i >= 0) { st.focus = i; return true; } }
    return In.pressed('a');
  }
  const H = () => G.screen.H;
  const area = () => ({ y: 40, h: H() - 70 });

  const S = {
    name: 'train', kind,
    finishNow(s) { score = s * total; finish(); },   // для автотеста
    enter() { init(); },
    // кнопка удержания нужна только в играх, где значение берётся из held('a')
    touch() { return { action: phase === 'play' && (kind === 'meditate' || kind === 'tree') ? { label: 'Держи' } : null }; },
    update(dt) {
      t += dt; if (msgT > 0) msgT -= dt;
      const In = I();
      if (phase === 'intro') { if (t > 0.4 && pressA()) { phase = 'play'; t = 0; } return; }
      if (phase === 'result') { if (t > 0.6 && (pressA() || In.pressed('b'))) { G.scenes.pop(); onDone && onDone(st.final); } return; }
      const a = area();
      switch (kind) {
        case 'throw': {
          st.x = Math.sin(t * st.sp) * 70;
          if (pressA()) {
            const hit = Math.abs(st.x) <= st.zone; st.n++; if (hit) { score++; say('Попал!'); AU.sfx.confirm(); } else { say('Мимо!'); AU.sfx.cancel(); }
            st.sp += 0.25; st.last = st.x;
            if (st.n >= st.max) finish();
          }
          break;
        }
        case 'log': {
          if (pressA()) {
            const n = st.notes.find((q) => q.done == null && Math.abs(q.t - t) < 0.25);
            if (n) { const d = Math.abs(n.t - t); n.done = d < 0.07 ? 2 : d < 0.15 ? 1 : 0; score += n.done === 2 ? 1 : n.done === 1 ? 0.6 : 0; say(['Мимо', 'Хорошо', 'Отлично!'][n.done]); n.done ? AU.sfx.blip() : AU.sfx.cancel(); }
          }
          for (const n of st.notes) if (n.done == null && t - n.t > 0.25) { n.done = 0; say('Мимо'); }
          if (t > st.notes[st.notes.length - 1].t + 0.6) finish();
          break;
        }
        case 'meditate': {
          st.inhale = (t % 4) < 2;   // 2 с вдох (круг растёт), 2 с выдох (круг сжимается)
          const ok = In.held('a') === st.inhale; if (ok) score += dt / DUR.meditate; st.ok = ok;
          if (t >= DUR.meditate) { score = Math.min(1, score * 1.15); finish(); }
          break;
        }
        case 'tree': {
          st.v += (In.held('a') ? 0.9 : -0.7) * dt; st.v = Math.max(0, Math.min(1, st.v));
          st.zt -= dt; if (st.zt <= 0) { st.zt = 0.8 + R(); st.zTarget = 0.2 + R() * 0.6; }
          st.z += ((st.zTarget || 0.5) - st.z) * dt * 1.5;
          const zw = 0.13 + G.hero.stat('ctrl') * 0.008;
          st.ok = Math.abs(st.v - st.z) < zw; st.zw = zw;
          if (st.ok) { score += dt / DUR.tree; st.h = Math.min(1, st.h + dt / DUR.tree * 1.3); }
          if (t >= DUR.tree) { score = Math.min(1, score * 1.2); finish(); }
          break;
        }
        case 'seals': {
          const rs = grid(12, 4, a.y + 44, Math.min(a.h - 48, 150));
          if (gridNav(12, 4, rs)) {
            if (st.focus === st.seq[st.i]) { st.i++; AU.sfx.blip(); if (st.i >= 3) { st.done++; score = st.done; st.seq = newSeq(); st.i = 0; say('Готово!'); AU.sfx.confirm(); } }
            else { st.i = 0; say('Сбился!'); AU.sfx.error(); }
          }
          if (t >= DUR.seals) finish();
          break;
        }
        case 'run': {
          if (pressA() && st.jump <= 0) { st.jump = 0.55; AU.sfx.blip(); }
          st.jump -= dt;
          for (const o of st.obs) if (o.hit == null && t >= o.t) { o.hit = st.jump > 0.05; if (o.hit) score++; else { say('Споткнулся!'); AU.sfx.cancel(); } }
          if (t > st.obs[st.obs.length - 1].t + 0.8) finish();
          break;
        }
        case 'quiz': {
          if (st.res) { st.res.t -= dt; if (st.res.t <= 0) { st.res = null; st.i++; st.focus = 0; if (st.i >= st.qs.length) finish(); } break; }
          const q = st.qs[st.i], qh = 34 + F.wrap(q.q, W - 40).length * 14; const rs = grid(3, 1, a.y + qh + 2, Math.min(96, a.h - qh - 2));
          if (gridNav(3, 1, rs)) { const ok = st.focus === q.ok; if (ok) { score++; AU.sfx.confirm(); } else AU.sfx.error(); st.res = { ok, t: 0.9 }; }
          break;
        }
        case 'cook': {
          if (st.res) { st.res.t -= dt; if (st.res.t <= 0) { st.res = null; if (st.ph === 2 && st.pi >= 3) finish(); } break; }
          if (st.ph < 2) {
            st.m += st.dir * dt * st.sp * (st.ph ? 1.35 : 1); if (st.m > 1) { st.m = 1; st.dir = -1; } if (st.m < 0) { st.m = 0; st.dir = 1; }
            if (pressA()) { const z = st.zone, d = st.m < z[0] ? z[0] - st.m : st.m > z[1] ? st.m - z[1] : 0; const g = d === 0 ? 1 : d < 0.1 ? 0.5 : 0; score += g; AU.sfx[g ? 'confirm' : 'cancel'](); st.res = { t: 0.7, g }; st.ph++; st.m = 0; st.dir = 1; st.zone = [0.6, 0.72]; if (st.ph === 2) { st.show = 2.4; } }
          } else if (st.show > 0) { st.show -= dt; }
          else if (st.pi < 3) {
            const rs = grid(6, 3, a.y + 60, Math.min(110, a.h - 70));
            if (gridNav(6, 3, rs)) { const ok = st.focus === st.rec[st.pi]; if (ok) { score++; AU.sfx.confirm(); } else AU.sfx.error(); st.pi++; st.res = { t: 0.45, g: ok ? 1 : 0 }; }
          }
          break;
        }
        case 'shogi': {
          if (st.over) { st.over.t += dt; if (st.over.t > 1.1) finish(); break; }
          const rs = grid(9, 3, a.y + 24, Math.min(240, a.h - 34));
          if (st.turn === 0) {
            if (gridNav(9, 3, rs) && !st.b[st.focus]) { st.b[st.focus] = 1; AU.sfx.select(); const w = winner(st.b); if (w) shogiEnd(w); else { st.turn = 1; st.t2 = 0.7; } }
          } else { st.t2 -= dt; if (st.t2 <= 0) { st.b[aiMove(st.b)] = 2; AU.sfx.blip && AU.sfx.blip(); const w = winner(st.b); if (w) shogiEnd(w); else st.turn = 0; } }
          break;
        }
        case 'cat': {
          st.ct -= dt;
          if (st.ct <= 0) { st.cell = st.cell < 0 ? Math.floor(R() * 12) : -1; st.ct = st.cell < 0 ? 0.35 + R() * 0.5 : Math.max(0.55, 1.1 - st.caught * 0.1); }
          const rs = grid(12, 4, a.y + 10, Math.min(a.h - 14, 180));
          if (gridNav(12, 4, rs)) { if (st.focus === st.cell) { st.caught++; score = st.caught; st.cell = -1; st.ct = 0.4; say('Поймал... и она вырвалась!'); AU.sfx.confirm(); if (st.caught >= 5) { say('Попалась!'); finish(); } } else { AU.sfx.cancel(); } }
          if (t >= DUR.cat) finish();
          break;
        }
        case 'sort': {
          st.it += dt; const lim = Math.max(0.8, 1.6 - st.i * 0.05);
          let ch = null; if (In.pressed('left') || (In.tapNow && In.tapNow.x < W / 2)) ch = 0; else if (In.pressed('right') || In.tapNow) ch = 1;
          if (ch != null || st.it > lim) { if (ch === st.items[st.i]) { score++; AU.sfx.blip(); } else { say(ch == null ? 'Не успел!' : 'Не туда!'); AU.sfx.cancel(); } st.i++; st.it = 0; if (st.i >= st.items.length) finish(); }
          break;
        }
      }
    },
    draw(ctx) {
      const h = H(), a = area(), cx = W / 2, S = F.small;
      U.backdrop(ctx);
      U.title(ctx, opts.title || 'Тренировка', cx, 4, 90);
      if (opts.partner) S.draw(ctx, 'с партнёром: ' + G.chars.nameOf(opts.partner) + ' (+50%)', cx, 23, { align: 'center', color: C.goldHi, outline: C.woodEdge });
      if (phase === 'intro') {
        const lines = F.wrap(INTRO[kind], W - 48), ph = 40 + lines.length * 14, py = Math.round(h / 2 - ph / 2) - 8;
        U.panel(ctx, 10, py, W - 20, ph, 'scroll');
        lines.forEach((l, i) => F.draw(ctx, l, cx, py + 14 + i * 14, { align: 'center', color: C.ink }));
        if (t > 0.4) S.draw(ctx, 'Коснись, чтобы начать', cx, py + ph - 17, { align: 'center', color: Math.sin(t * 6) > 0 ? C.red : C.inkDim });
        return;
      }
      if (phase === 'result') {
        const s = Math.round(st.final * 100), py = Math.round(h / 2) - 50;
        U.panel(ctx, 14, py, W - 28, 96, 'scroll');
        F.draw(ctx, 'Результат', cx, py + 14, { align: 'center', color: C.inkDim });
        F.draw(ctx, s + '%', cx, py + 28, { align: 'center', color: s >= 70 ? C.red : C.ink, shadow: s >= 70 ? '#f4d46a' : null });
        U.gauge(ctx, 34, py + 44, W - 68, 7, st.final, s >= 70 ? C.gold : C.energy);
        S.draw(ctx, s >= 90 ? 'Превосходно!' : s >= 70 ? 'Отлично!' : s >= 40 ? 'Неплохо.' : 'Надо больше стараться...', cx, py + 57, { align: 'center', color: C.redDark });
        if (t > 0.6) S.draw(ctx, 'Коснись, чтобы продолжить', cx, py + 76, { align: 'center', color: C.inkFaint });
        return;
      }
      const tm = DUR[kind]; if (tm) U.gauge(ctx, 10, 31, W - 20, 5, Math.max(0, 1 - t / tm), C.seal);
      // нижняя подпись счёта — на деревянной дощечке
      const foot = (text, col) => { U.panel(ctx, 10, a.y + a.h + 3, W - 20, 17, 'plank'); S.draw(ctx, text, cx, a.y + a.h + 8, { align: 'center', color: col || '#f8eed0', maxW: W - 30 }); };
      // игровое поле — рамка-колодец
      const field = (fy, fh, base) => { U.panel(ctx, 4, fy - 2, W - 8, fh + 4, 'well'); if (base) { ctx.fillStyle = base; ctx.fillRect(7, fy + 1, W - 14, fh - 2); } };
      // клетка сетки: плитка-карточка с подписью
      const cell = (r, label, sel, mode, lcol) => {
        U.card(ctx, r.x, r.y, r.w, r.h, sel);
        if (mode === 'ok') { ctx.globalAlpha = 0.55; ctx.fillStyle = C.ok; ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4); ctx.globalAlpha = 1; }
        else if (mode === 'bad') { ctx.globalAlpha = 0.5; ctx.fillStyle = C.err; ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4); ctx.globalAlpha = 1; }
        if (label) (r.w < 60 ? S : F).draw(ctx, label, r.x + r.w / 2 + 1, r.y + Math.round(r.h / 2) - 4, { align: 'center', color: lcol || (sel ? C.redDark : C.ink), maxW: r.w - 6 });
      };
      switch (kind) {
        case 'throw': {
          const y = a.y + a.h / 2;
          field(a.y + 4, a.h - 8, '#4a7a3a');
          // трава внизу поля — полосы для глубины
          ctx.fillStyle = '#3a6a2e'; ctx.fillRect(7, y + 18, W - 14, a.h / 2 - 25);
          const tx = cx + st.x;
          ctx.fillStyle = '#5a3a20'; ctx.fillRect(Math.round(tx) - 1, y + 14, 3, 12);               // стойка
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(tx, y + 25, 12, 3, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#f4ecd8'; ctx.beginPath(); ctx.arc(tx, y, 14, 0, 7); ctx.fill();
          ctx.fillStyle = '#c8401c'; ctx.beginPath(); ctx.arc(tx, y, 9, 0, 7); ctx.fill();
          ctx.fillStyle = '#f4ecd8'; ctx.beginPath(); ctx.arc(tx, y, 4, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(244,212,106,0.9)'; ctx.fillRect(cx - st.zone, y - 22, 1, 44); ctx.fillRect(cx + st.zone, y - 22, 1, 44); ctx.fillRect(cx - 4, y, 9, 1);
          foot(`Бросок ${st.n}/${st.max} · попаданий ${score}`);
          break;
        }
        case 'log': {
          const y = a.y + a.h / 2, lx = 40;
          field(a.y + 4, a.h - 8, '#2e1c10');
          ctx.fillStyle = '#6a4228'; ctx.fillRect(7, y - 14, W - 14, 28); ctx.fillStyle = '#8a5a36'; ctx.fillRect(7, y - 14, W - 14, 2); ctx.fillStyle = '#3e2616'; ctx.fillRect(7, y + 12, W - 14, 2);
          ctx.fillStyle = C.goldHi; ctx.fillRect(lx - 1, y - 18, 3, 36);
          for (const n of st.notes) {
            const x = lx + (n.t - t) * 120; if (x < -10 || x > W + 10) continue;
            ctx.fillStyle = n.done == null ? '#f8eed0' : n.done === 2 ? C.goldHi : n.done ? '#8ae070' : '#5a4a3e';
            ctx.fillRect(x - 4, y - 8, 8, 16);
            ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 4, y + 5, 8, 3);
          }
          G.chars.draw(ctx, 'hero', 'right', Math.floor(t * 4) % 2, 20, y + 34);
          foot('Очки: ' + score.toFixed(1));
          break;
        }
        case 'meditate': {
          const cyc = t % 4, r = 18 + 22 * (cyc < 2 ? cyc / 2 : 1 - (cyc - 2) / 2), y = a.y + a.h / 2 + 6;
          field(a.y + 4, a.h - 8, '#1c1a2c');
          ctx.fillStyle = st.ok ? 'rgba(122,176,255,0.35)' : 'rgba(255,106,58,0.28)'; ctx.beginPath(); ctx.arc(cx, y, r, 0, 7); ctx.fill();
          ctx.strokeStyle = st.ok ? '#8ac8ff' : '#ff9a6a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, y, r, 0, 7); ctx.stroke();
          G.chars.draw(ctx, 'hero', 'down', 0, cx, y + 10);
          F.draw(ctx, st.inhale ? 'ВДОХ — держи кнопку' : 'ВЫДОХ — отпусти', cx, a.y + 10, { align: 'center', color: st.ok ? '#8ae0ff' : '#ffb08a', outline: '#0a0604' });
          foot('Синхронность: ' + Math.round(score * 100) + '%');
          break;
        }
        case 'tree': {
          field(a.y + 4, a.h - 8, '#2c4a26');
          const bx = W - 30, by = a.y + 10, bh = a.h - 20;
          ctx.fillStyle = '#120a05'; ctx.fillRect(bx - 1, by - 1, 14, bh + 2);
          ctx.fillStyle = 'rgba(138,224,112,0.75)'; ctx.fillRect(bx, by + bh * (1 - st.z - st.zw), 12, bh * st.zw * 2);
          ctx.fillStyle = st.ok ? '#ffffff' : C.seal; ctx.fillRect(bx - 3, by + bh * (1 - st.v) - 1, 18, 3);
          ctx.fillStyle = '#5a3a20'; ctx.fillRect(50, a.y + 4, 20, a.h - 8); ctx.fillStyle = '#7a5230'; ctx.fillRect(50, a.y + 4, 3, a.h - 8); ctx.fillStyle = '#3a2412'; ctx.fillRect(67, a.y + 4, 3, a.h - 8);
          G.chars.draw(ctx, 'hero', 'up', Math.floor(t * 5) % 3, 60, a.y + a.h - 8 - st.h * (a.h - 34));
          foot(st.ok ? 'Держишься!' : st.v > st.z ? 'Слишком много чакры — отскакиваешь!' : 'Мало чакры — соскальзываешь!', st.ok ? '#a8f090' : '#ffb08a');
          break;
        }
        case 'seals': {
          U.panel(ctx, 20, a.y - 2, W - 40, 28, 'plank');
          st.seq.forEach((si, i) => F.draw(ctx, G.SEALS[si], cx - 84 + i * 84, a.y + 6, { align: 'center', color: i < st.i ? '#a8f090' : i === st.i ? C.goldHi : '#f8eed0', shadow: '#160c06' }));
          S.draw(ctx, 'Серий: ' + st.done, cx, a.y + 31, { align: 'center', color: C.goldHi, outline: C.woodEdge });
          grid(12, 4, a.y + 44, Math.min(a.h - 48, 150)).forEach((r, i) => {
            cell(r, null, i === st.focus);
            ctx.fillStyle = G.SEAL_COL[i]; ctx.fillRect(r.x + 3, r.y + 3, 3, r.h - 6);
            S.draw(ctx, G.SEALS[i], r.x + r.w / 2 + 2, r.y + Math.round(r.h / 2) - 4, { align: 'center', color: i === st.focus ? C.redDark : C.ink, maxW: r.w - 10 });
          });
          break;
        }
        case 'run': {
          field(a.y + 4, a.h - 8, '#3a2a48');
          const gy = a.y + a.h * 0.65;
          ctx.fillStyle = '#b84a3a'; ctx.fillRect(7, gy, W - 14, a.h * 0.35 - 8);
          ctx.fillStyle = '#8a3226'; for (let x = 7 - ((t * 120) % 24); x < W - 7; x += 24) { const x0 = Math.max(7, x), x1 = Math.min(W - 7, x + 12); if (x1 > x0) ctx.fillRect(x0, gy, x1 - x0, 3); }
          for (const o of st.obs) { const x = 40 + (o.t - t) * 120; if (x < 12 || x > W - 12) continue; ctx.fillStyle = o.hit === false ? '#5a4a3e' : '#7a4a2a'; ctx.fillRect(x - 5, gy - 12, 10, 12); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 5, gy - 3, 10, 3); }
          const jy = st.jump > 0 ? Math.sin((0.55 - st.jump) / 0.55 * Math.PI) * 26 : 0;
          G.chars.draw(ctx, 'hero', 'right', Math.floor(t * 8) % 3, 40, gy - jy);
          foot(`Препятствий: ${score}/${total}`);
          break;
        }
        case 'quiz': {
          if (st.i >= st.qs.length) break;
          const q = st.qs[st.i], lines = F.wrap(q.q, W - 40), qh = 34 + lines.length * 14, qy = a.y - 6;
          U.panel(ctx, 6, qy, W - 12, qh, 'scroll');
          S.draw(ctx, `Вопрос ${st.i + 1}/${st.qs.length}`, cx, qy + 10, { align: 'center', color: C.inkFaint });
          lines.forEach((l, i) => F.draw(ctx, l, cx, qy + 22 + i * 14, { align: 'center', color: C.ink }));
          grid(3, 1, a.y + qh + 2, Math.min(96, a.h - qh - 2)).forEach((r, i) => {
            const res = st.res; let mode = null;
            if (res && i === q.ok) mode = 'ok'; else if (res && i === st.focus && !res.ok) mode = 'bad';
            cell(r, q.a[i], i === st.focus, mode);
          });
          break;
        }
        case 'cook': {
          const names = ['Лапша', 'Бульон', 'Топпинги'];
          F.draw(ctx, st.ph < 2 ? names[st.ph] + ': касайся в зелёной зоне' : st.show > 0 ? 'Запомни рецепт!' : 'Добавь по рецепту: ' + Math.min(3, st.pi + 1) + '/3', cx, a.y, { align: 'center', color: C.goldHi, outline: C.woodEdge });
          if (st.ph < 2) {
            const bx = 16, bw = W - 32, by = a.y + 40;
            ctx.fillStyle = '#0a0604'; ctx.fillRect(bx - 2, by - 2, bw + 4, 22);
            ctx.fillStyle = '#2a2018'; ctx.fillRect(bx, by, bw, 18);
            ctx.fillStyle = '#4a9a3a'; ctx.fillRect(bx + bw * st.zone[0], by, bw * (st.zone[1] - st.zone[0]), 18);
            ctx.fillStyle = '#f8eed0'; ctx.fillRect(bx + bw * st.m - 1, by - 4, 3, 26);
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx, by + 96, 46, 14, 0, 0, 7); ctx.fill();
            ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.ellipse(cx, by + 90, 44, 14, 0, 0, 7); ctx.fill(); ctx.fillStyle = st.ph ? '#c88a3a' : '#e8d8a0'; ctx.beginPath(); ctx.ellipse(cx, by + 86, 36, 9, 0, 0, 7); ctx.fill();
          } else if (st.show > 0) {
            U.panel(ctx, 30, a.y + 16, W - 60, 76, 'scroll');
            st.rec.forEach((r, i) => F.draw(ctx, (i + 1) + '. ' + st.top[r], cx, a.y + 32 + i * 18, { align: 'center', color: C.ink }));
          } else {
            grid(6, 3, a.y + 60, Math.min(110, a.h - 70)).forEach((r, i) => cell(r, st.top[i], i === st.focus));
          }
          break;
        }
        case 'shogi': {
          F.draw(ctx, st.over ? (st.over.w === 1 ? 'Ты выиграл!' : st.over.w === 3 ? 'Ничья...' : 'Шикамару выиграл. Хлопотно.') : st.turn === 0 ? 'Твой ход' : 'Шикамару думает...', cx, a.y, { align: 'center', color: C.goldHi, outline: C.woodEdge });
          grid(9, 3, a.y + 24, Math.min(240, a.h - 34)).forEach((r, i) => {
            cell(r, null, i === st.focus && st.turn === 0 && !st.over);
            const v = st.b[i]; if (v) F.draw(ctx, v === 1 ? 'Х' : 'О', r.x + r.w / 2 + 1, r.y + Math.round(r.h / 2) - 4, { align: 'center', color: v === 1 ? '#1e5aa8' : C.red });
          });
          break;
        }
        case 'cat': {
          grid(12, 4, a.y + 10, Math.min(a.h - 14, 180)).forEach((r, i) => {
            U.card(ctx, r.x, r.y, r.w, r.h, i === st.focus);
            ctx.fillStyle = '#3a6a32'; ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + r.h - 6, 12, Math.PI, 0); ctx.fill();
            if (i === st.cell) { const x = r.x + r.w / 2, y = r.y + r.h / 2; ctx.fillStyle = '#8a6a4a'; ctx.fillRect(x - 7, y - 4, 14, 10); ctx.fillRect(x - 7, y - 8, 3, 4); ctx.fillRect(x + 4, y - 8, 3, 4); ctx.fillStyle = '#c8401c'; ctx.fillRect(x - 3, y - 6, 2, 2); ctx.fillRect(x + 1, y - 6, 2, 2); ctx.fillStyle = '#f0a0c0'; ctx.fillRect(x - 6, y - 1, 12, 2); }
          });
          foot(`Поймано: ${st.caught}/5`);
          break;
        }
        case 'sort': {
          field(a.y + 4, a.h - 8, '#2e1c10');
          if (st.i < st.items.length) {
            const it = st.items[st.i];
            S.draw(ctx, '◀ ' + st.cats[0], 12, a.y + 10, { color: C.goldHi, outline: C.woodEdge }); S.draw(ctx, st.cats[1] + ' ▶', W - 12, a.y + 10, { align: 'right', color: C.goldHi, outline: C.woodEdge });
            ctx.fillStyle = it ? '#e8e4dc' : '#6ab04a'; ctx.fillRect(cx - 14, a.y + a.h / 2 - 14, 28, 28);
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(cx - 14, a.y + a.h / 2 + 10, 28, 4);
            F.draw(ctx, st.cats[it], cx, a.y + a.h / 2 + 20, { align: 'center', color: '#f8eed0', outline: '#0a0604' });
            U.gauge(ctx, cx - 30, a.y + a.h / 2 + 38, 60, 5, 1 - st.it / Math.max(0.8, 1.6 - st.i * 0.05), C.seal);
          }
          foot(`Верно: ${score}/${total}`);
          break;
        }
      }
      if (msgT > 0) F.draw(ctx, msg, cx, a.y + a.h - 24, { align: 'center', color: C.goldHi, outline: C.woodEdge });
    },
  };
  return S;
});
