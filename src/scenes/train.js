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
  const W = G.screen.W, F = G.font, P = G.PAL, AU = G.audio;
  const I = () => G.input;
  const pressA = () => I().pressed('a') || !!I().tapNow;
  let t = 0, phase = 'intro', score = 0, total = 1, msg = '', msgT = 0;
  const say = (m) => { msg = m; msgT = 0.7; };
  const R = Math.random;
  const st = {};   // состояние игры
  const INTRO = {
    throw: 'Мишень движется. Жми A, когда она в прицеле.',
    log: 'Удары по ритму: жми A, когда метка на линии.',
    meditate: 'Дыши: держи A на вдохе (круг растёт), отпускай на выдохе.',
    tree: 'Держи A — чакра в ноги. Удерживай метку в зелёной зоне.',
    seals: 'Складывай печати как можно быстрее!',
    run: 'Бег по крышам: жми A, чтобы перепрыгнуть препятствие.',
    quiz: 'Вопросы по книге. Выбери верный ответ.',
    cook: 'Готовь рамен: лапша и бульон — жми A в зелёной зоне; потом повтори рецепт.',
    shogi: 'Сыграй с Шикамару: собери три в ряд. Ходишь первым.',
    cat: 'Лови кошку Тору! Жми туда, где она выглянет.',
    sort: 'Сортируй: влево или вправо, как подсказано.',
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
          const rs = grid(12, 4, a.y + 34, a.h - 40);
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
          const q = st.qs[st.i]; const rs = grid(3, 1, a.y + 52, Math.min(90, a.h - 56));
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
          const rs = grid(12, 4, a.y + 10, a.h - 14);
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
      const h = H(), a = area();
      ctx.fillStyle = '#1a1724'; ctx.fillRect(0, 0, W, h);
      F.draw(ctx, opts.title || 'Тренировка', W / 2, 6, { align: 'center', color: P.orange });
      if (opts.partner) F.draw(ctx, 'с партнёром: ' + G.chars.nameOf(opts.partner) + ' (+50%)', W / 2, 18, { align: 'center', color: '#8ae070' });
      if (phase === 'intro') {
        F.wrap(INTRO[kind], W - 24).forEach((l, i) => F.draw(ctx, l, W / 2, h / 2 - 20 + i * 12, { align: 'center', color: P.white }));
        if (t > 0.4) F.draw(ctx, 'Нажми A, чтобы начать', W / 2, h / 2 + 30, { align: 'center', color: Math.sin(t * 6) > 0 ? P.yellow : P.gray });
        return;
      }
      if (phase === 'result') {
        const s = Math.round(st.final * 100);
        F.draw(ctx, 'Результат: ' + s + '%', W / 2, h / 2 - 16, { align: 'center', color: s >= 70 ? P.yellow : P.white });
        F.draw(ctx, s >= 90 ? 'Превосходно!' : s >= 70 ? 'Отлично!' : s >= 40 ? 'Неплохо.' : 'Надо больше стараться...', W / 2, h / 2, { align: 'center', color: P.light });
        if (t > 0.6) F.draw(ctx, 'Нажми A', W / 2, h / 2 + 24, { align: 'center', color: P.gray });
        return;
      }
      const tm = DUR[kind]; if (tm) { ctx.fillStyle = '#3a3548'; ctx.fillRect(10, 30, W - 20, 3); ctx.fillStyle = P.orange; ctx.fillRect(10, 30, (W - 20) * Math.max(0, 1 - t / tm), 3); }
      const cx = W / 2;
      switch (kind) {
        case 'throw': {
          const y = a.y + a.h / 2;
          ctx.fillStyle = '#4a7a3a'; ctx.fillRect(0, a.y, W, a.h);
          const tx = cx + st.x;
          ctx.fillStyle = '#f4ecd8'; ctx.beginPath(); ctx.arc(tx, y, 14, 0, 7); ctx.fill(); ctx.fillStyle = '#c8401c'; ctx.beginPath(); ctx.arc(tx, y, 9, 0, 7); ctx.fill(); ctx.fillStyle = '#f4ecd8'; ctx.beginPath(); ctx.arc(tx, y, 4, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(255,210,58,0.8)'; ctx.fillRect(cx - st.zone, y - 22, 1, 44); ctx.fillRect(cx + st.zone, y - 22, 1, 44); ctx.fillRect(cx - 4, y, 9, 1);
          F.draw(ctx, `Бросок ${st.n}/${st.max} · попаданий ${score}`, cx, a.y + a.h + 6, { align: 'center', color: P.white });
          break;
        }
        case 'log': {
          const y = a.y + a.h / 2, lx = 40;
          ctx.fillStyle = '#6a4226'; ctx.fillRect(0, y - 14, W, 28);
          ctx.fillStyle = P.yellow; ctx.fillRect(lx - 1, y - 18, 3, 36);
          for (const n of st.notes) { const x = lx + (n.t - t) * 120; if (x < -10 || x > W + 10) continue; ctx.fillStyle = n.done == null ? P.white : n.done === 2 ? P.yellow : n.done ? '#8ae070' : '#5a5670'; ctx.fillRect(x - 4, y - 8, 8, 16); }
          G.chars.draw(ctx, 'hero', 'right', Math.floor(t * 4) % 2, 20, y + 30);
          F.draw(ctx, 'Очки: ' + score.toFixed(1), cx, a.y + a.h + 6, { align: 'center', color: P.white });
          break;
        }
        case 'meditate': {
          const cyc = t % 4, r = 18 + 22 * (cyc < 2 ? cyc / 2 : 1 - (cyc - 2) / 2);
          const y = a.y + a.h / 2;
          ctx.fillStyle = st.ok ? 'rgba(122,176,255,0.35)' : 'rgba(255,106,58,0.25)'; ctx.beginPath(); ctx.arc(cx, y, r, 0, 7); ctx.fill();
          G.chars.draw(ctx, 'hero', 'down', 0, cx, y + 10);
          F.draw(ctx, st.inhale ? 'ВДОХ — держи A' : 'ВЫДОХ — отпусти', cx, a.y + 4, { align: 'center', color: st.ok ? '#8ae0ff' : '#ff9a7a' });
          F.draw(ctx, 'Синхронность: ' + Math.round(score * 100) + '%', cx, a.y + a.h + 6, { align: 'center', color: P.white });
          break;
        }
        case 'tree': {
          const bx = W - 30, by = a.y + 6, bh = a.h - 12;
          ctx.fillStyle = '#2a2638'; ctx.fillRect(bx, by, 12, bh);
          ctx.fillStyle = 'rgba(138,224,112,0.6)'; ctx.fillRect(bx, by + bh * (1 - st.z - st.zw), 12, bh * st.zw * 2);
          ctx.fillStyle = st.ok ? P.white : '#ff6a3a'; ctx.fillRect(bx - 3, by + bh * (1 - st.v) - 1, 18, 3);
          ctx.fillStyle = P.trunk; ctx.fillRect(50, a.y, 20, a.h);
          G.chars.draw(ctx, 'hero', 'up', Math.floor(t * 5) % 3, 60, a.y + a.h - 4 - st.h * (a.h - 30));
          F.draw(ctx, st.ok ? 'Держишься!' : st.v > st.z ? 'Слишком много чакры — отскакиваешь!' : 'Мало чакры — соскальзываешь!', cx - 10, a.y + a.h + 6, { align: 'center', color: st.ok ? '#8ae070' : '#ff9a7a', maxW: W - 10 });
          break;
        }
        case 'seals': {
          st.seq.forEach((si, i) => F.draw(ctx, G.SEALS[si], cx - 60 + i * 60, a.y + 4, { align: 'center', color: i < st.i ? '#8ae070' : i === st.i ? P.yellow : P.white }));
          F.draw(ctx, 'Серий: ' + st.done, cx, a.y + 18, { align: 'center', color: P.light });
          grid(12, 4, a.y + 34, a.h - 40).forEach((r, i) => { ctx.fillStyle = i === st.focus ? '#4a3a2a' : '#2a2638'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = G.SEAL_COL[i]; ctx.fillRect(r.x, r.y, 3, r.h); F.draw(ctx, G.SEALS[i], r.x + r.w / 2 + 1, r.y + r.h / 2 - 5, { align: 'center', color: i === st.focus ? P.yellow : P.white, maxW: r.w - 4 }); });
          break;
        }
        case 'run': {
          const gy = a.y + a.h * 0.65;
          ctx.fillStyle = '#b84a3a'; ctx.fillRect(0, gy, W, a.h * 0.35);
          ctx.fillStyle = '#8a3226'; for (let x = -((t * 120) % 24); x < W; x += 24) ctx.fillRect(x, gy, 12, 3);
          for (const o of st.obs) { const x = 40 + (o.t - t) * 120; if (x < -10 || x > W + 10) continue; ctx.fillStyle = o.hit === false ? '#5a5670' : '#7a4a2a'; ctx.fillRect(x - 5, gy - 12, 10, 12); }
          const jy = st.jump > 0 ? Math.sin((0.55 - st.jump) / 0.55 * Math.PI) * 26 : 0;
          G.chars.draw(ctx, 'hero', 'right', Math.floor(t * 8) % 3, 40, gy - jy);
          F.draw(ctx, `Препятствий: ${score}/${total}`, cx, a.y + a.h + 6, { align: 'center', color: P.white });
          break;
        }
        case 'quiz': {
          if (st.i >= st.qs.length) break;
          const q = st.qs[st.i];
          F.draw(ctx, `Вопрос ${st.i + 1}/${st.qs.length}`, cx, a.y, { align: 'center', color: P.gray });
          F.wrap(q.q, W - 16).forEach((l, i) => F.draw(ctx, l, cx, a.y + 14 + i * 11, { align: 'center', color: P.white }));
          grid(3, 1, a.y + 52, Math.min(90, a.h - 56)).forEach((r, i) => {
            const res = st.res; let col = '#2a2638'; if (res && i === q.ok) col = '#2a5a2a'; else if (res && i === st.focus && !res.ok) col = '#6a2a2a'; else if (i === st.focus) col = '#4a3a2a';
            ctx.fillStyle = col; ctx.fillRect(r.x, r.y, r.w, r.h); F.draw(ctx, q.a[i], r.x + r.w / 2, r.y + r.h / 2 - 5, { align: 'center', color: i === st.focus ? P.yellow : P.white, maxW: r.w - 6 });
          });
          break;
        }
        case 'cook': {
          const names = ['Лапша', 'Бульон', 'Топпинги'];
          F.draw(ctx, st.ph < 2 ? names[st.ph] + ': жми A в зелёной зоне' : st.show > 0 ? 'Запомни рецепт!' : 'Добавь по рецепту: ' + Math.min(3, st.pi + 1) + '/3', cx, a.y, { align: 'center', color: P.yellow });
          if (st.ph < 2) {
            const bx = 16, bw = W - 32, by = a.y + 40;
            ctx.fillStyle = '#2a2638'; ctx.fillRect(bx, by, bw, 18); ctx.fillStyle = '#2a7a3a'; ctx.fillRect(bx + bw * st.zone[0], by, bw * (st.zone[1] - st.zone[0]), 18);
            ctx.fillStyle = P.white; ctx.fillRect(bx + bw * st.m - 1, by - 4, 3, 26);
            ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.ellipse(cx, by + 90, 44, 14, 0, 0, 7); ctx.fill(); ctx.fillStyle = st.ph ? '#c88a3a' : '#e8d8a0'; ctx.beginPath(); ctx.ellipse(cx, by + 86, 36, 9, 0, 0, 7); ctx.fill();
          } else if (st.show > 0) {
            st.rec.forEach((r, i) => F.draw(ctx, (i + 1) + '. ' + st.top[r], cx, a.y + 50 + i * 16, { align: 'center', color: P.white }));
          } else {
            grid(6, 3, a.y + 60, Math.min(110, a.h - 70)).forEach((r, i) => { ctx.fillStyle = i === st.focus ? '#4a3a2a' : '#2a2638'; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); F.draw(ctx, st.top[i], r.x + r.w / 2, r.y + r.h / 2 - 5, { align: 'center', color: i === st.focus ? P.yellow : P.white, maxW: r.w - 4 }); });
          }
          break;
        }
        case 'shogi': {
          F.draw(ctx, st.over ? (st.over.w === 1 ? 'Ты выиграл!' : st.over.w === 3 ? 'Ничья...' : 'Шикамару выиграл. Хлопотно.') : st.turn === 0 ? 'Твой ход' : 'Шикамару думает...', cx, a.y, { align: 'center', color: P.yellow });
          grid(9, 3, a.y + 24, Math.min(240, a.h - 34)).forEach((r, i) => {
            ctx.fillStyle = i === st.focus && st.turn === 0 && !st.over ? '#4a3a2a' : '#2a2638'; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
            const v = st.b[i]; if (v) F.draw(ctx, v === 1 ? 'Х' : 'О', r.x + r.w / 2, r.y + r.h / 2 - 5, { align: 'center', color: v === 1 ? '#7ad0ff' : '#ff9a7a' });
          });
          break;
        }
        case 'cat': {
          grid(12, 4, a.y + 10, a.h - 14).forEach((r, i) => {
            ctx.fillStyle = i === st.focus ? '#5a4a3a' : '#3a5a3a'; ctx.fillRect(r.x, r.y, r.w, r.h);
            ctx.fillStyle = '#2e6a32'; ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + r.h - 6, 12, Math.PI, 0); ctx.fill();
            if (i === st.cell) { const x = r.x + r.w / 2, y = r.y + r.h / 2; ctx.fillStyle = '#8a6a4a'; ctx.fillRect(x - 7, y - 4, 14, 10); ctx.fillRect(x - 7, y - 8, 3, 4); ctx.fillRect(x + 4, y - 8, 3, 4); ctx.fillStyle = '#c8401c'; ctx.fillRect(x - 3, y - 6, 2, 2); ctx.fillRect(x + 1, y - 6, 2, 2); ctx.fillStyle = '#f0a0c0'; ctx.fillRect(x - 6, y - 1, 12, 2); }
          });
          F.draw(ctx, `Поймано: ${st.caught}/5`, cx, a.y + a.h + 6, { align: 'center', color: P.white });
          break;
        }
        case 'sort': {
          if (st.i < st.items.length) {
            const it = st.items[st.i];
            F.draw(ctx, '< ' + st.cats[0], 10, a.y + 6, { color: P.light }); F.draw(ctx, st.cats[1] + ' >', W - 10, a.y + 6, { align: 'right', color: P.light });
            ctx.fillStyle = it ? '#e8e4dc' : '#6ab04a'; ctx.fillRect(cx - 14, a.y + a.h / 2 - 14, 28, 28);
            F.draw(ctx, st.cats[it], cx, a.y + a.h / 2 + 20, { align: 'center', color: P.white });
            ctx.fillStyle = P.orange; ctx.fillRect(cx - 30, a.y + a.h / 2 + 36, 60 * (1 - st.it / Math.max(0.8, 1.6 - st.i * 0.05)), 3);
          }
          F.draw(ctx, `Верно: ${score}/${total}`, cx, a.y + a.h + 6, { align: 'center', color: P.white });
          break;
        }
      }
      if (msgT > 0) F.draw(ctx, msg, cx, a.y + a.h - 14, { align: 'center', color: P.yellow });
    },
  };
  return S;
});
