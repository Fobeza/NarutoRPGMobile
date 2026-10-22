// Экзамен на генина (день 21, воскресенье): письменный тест, метание, Буншин. Фиолетовая чакра может усилить клонов или сорваться.
// Запускается из G.story.poll, когда текущий шаг главной ветки — «exam» и герой в Академии. Провал — пересдача через неделю.
G.exam = (() => {
  const DAY = 21, RETAKE = 7, PASS = 55;
  const v = () => G.state.vars;
  const world = () => G.scenes.stack.find((s) => s.name === 'world');
  const dlg = (id, then) => { const w = world(); G.dialog.start(id, { bottom: 22, onEnd: () => { w && w.refreshNpcs && w.refreshNpcs(); then && then(); } }); };
  const say = (lines, then) => { const w = world(); G.dialog.say(lines.map((l) => (typeof l === 'string' ? { text: l } : l)), { bottom: 22, onEnd: () => { w && w.softRefresh && w.softRefresh(); then && then(); } }); };

  // можно ли сдавать сейчас (для шага и для запуска)
  function open() {
    const d = v().day, fail = v().exam_fail_day;
    return d >= DAY && (!fail || d >= fail + RETAKE);
  }
  function due(w) {
    const st = G.quests.curStep('main');
    if (!st || st.id !== 'exam' || !open() || G.state.daily.exam_done) return false;
    const m = v().min, b = w.map && w.map.building;
    return m >= 8 * 60 && m < 20 * 60 && !!b && b.tplId === 'academy';
  }
  function start(w) {
    G.state.daily.exam_done = 1;   // одна попытка в день, даже если вкладку выгрузят посреди экзамена
    const res = {};
    const finish = () => {
      const grade = G.academy.avg() / 100, att = G.academy.attendance() / 100, iruka = G.friends.level('iruka') / 5, stab = G.purple.stability() / 100;
      const total = Math.round(res.wr * 25 + res.thr * 20 + res.bun * 30 + grade * 10 + att * 5 + iruka * 5 + stab * 5);
      const pass = total >= PASS && res.bun > 0.3;
      v().exam = total; v().exam_pass = pass ? 1 : 0;
      if (!pass) v().exam_fail_day = v().day;
      G.game.advanceTo('15:00');
      G.game.note(`Экзамен на генина: ${total} баллов — ${pass ? 'сдан' : 'не сдан'}`);
      say([
        { text: `Письменный тест: ${Math.round(res.wr * 100)}%. Метание: ${Math.round(res.thr * 100)}%. Буншин: ${Math.round(res.bun * 100)}%.` },
        { text: `Оценки: ${G.academy.avg() || '—'}. Посещаемость: ${G.academy.attendance()}%. Итог: ${total} из 100.` },
      ], () => dlg(pass ? (total >= 80 ? 'mq_exam_best' : 'mq_exam_pass') : 'mq_exam_fail', () => {
        if (pass) { G.state.flags.genin = 1; G.game.earn(200); }
        G.events.emit('exam', pass, total);
        G.storage.save(G.state);
      }));
    };
    const bunshin = () => {
      if (!G.combat.knows('bunshin')) { res.bun = 0; return finish(); }
      G.scenes.push(G.scenes.make('train', 'seals', { title: 'Экзамен: Буншин' }, (s) => {
        let bun = s * 0.7 + G.combat.mastery('bunshin') * 0.12 + G.hero.stat('nin') * 0.02;
        // выброс фиолетовой чакры: честный показ силы рискованнее, но выигрыш больше; осторожность — безопаснее
        const honest = G.choices.is('exam', 'honest');
        const surge = G.purple.roll(honest ? 45 : 18);
        if (surge) bun += surge.kind === 'boost' ? (honest ? 0.25 : 0.1) : -(honest ? 0.2 : 0.1);
        G.purple.apply(surge, w);
        res.bun = Math.max(0, Math.min(1, bun));
        say([{ text: surge ? (surge.kind === 'boost' ? 'Клоны вспыхивают фиолетовым светом: их больше, чем нужно!' : 'Клоны выходят кривыми: чакра дрогнула в самый неподходящий момент.') : 'Клоны вышли ровными.' }], finish);
      }));
    };
    const throwing = () => say([{ who: 'iruka', text: 'Вторая часть: метание. Восемь бросков!' }], () => G.scenes.push(G.scenes.make('train', 'throw', { title: 'Экзамен: метание' }, (s) => {
      res.thr = Math.min(1, s * 0.85 + G.hero.stat('tai') * 0.015);
      dlg('mq_exam_choice', () => say([{ who: 'iruka', text: 'И последнее: создай клонов. Техника Буншин!' }], bunshin));
    })));
    dlg('mq_exam_start', () => G.scenes.push(G.scenes.make('train', 'quiz', { title: 'Экзамен: письменный тест', n: 5 }, (s) => {
      res.wr = Math.min(1, s * 0.8 + G.hero.stat('know') * 0.02);
      throwing();
    })));
  }
  return { DAY, RETAKE, PASS, open, due, start };
})();
