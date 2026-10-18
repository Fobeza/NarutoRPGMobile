// Скриптовый формат диалогов и событий.
//
//   === id_скрипта
//   naruto: Эй, {name}! Ты новенький?        ← реплика (id говорящего из G.chars.DEFS)
//   naruto(happy): Ха-ха!                     ← реплика с эмоцией
//   villager_m[Повар]: Садись!                ← своё имя на табличке
//   : Ветер шевелит листья.                   ← повествование (без говорящего)
//   ? Что ответить?                           ← вопрос перед выбором (необязательно)
//   * Хочу стать сильным! -> strong           ← вариант ответа → метка
//   * [flag.met_sasuke] Про Саске -> sasuke   ← вариант с условием
//   # strong                                  ← метка
//   -> end_part                               ← переход
//   set flag.met_naruto = 1                   ← флаги/переменные: = += -=
//   set var.friend_naruto += 1
//   if flag.met_naruto -> again               ← условный переход (== != >= <= > <, ! — отрицание)
//   if quest.day1.ramen -> x / qdone.id / has.kunai.3  ← задания и предметы (systems/quests.js)
//   call sfx puff                             ← вызов действия (G.script.actions)
//   end                                       ← конец
//   // комментарий
//
G.script = (() => {
  const library = {};   // id → { ops, labels }
  const actions = {};   // имя → fn(args[], runner)
  const problems = [];  // ошибки сценариев, найденные при разборе и выполнении (их ловит tools/check_node.py)

  // Сообщение об ошибке сценария: пишем в список и в консоль. Игру не роняем —
  // потерянная метка обрывается как «end», чтобы игрок не зависал в пустом диалоге.
  function report(msg) {
    if (!problems.includes(msg)) problems.push(msg);
    console.warn('Сценарий: ' + msg);
  }

  // Проверить блоки: все ли метки переходов определены внутри своего сценария
  function validateBlocks(list) {
    for (const s of list) {
      for (const op of s.ops) {
        if (op.op === 'goto' || op.op === 'if') { if (!(op.label in s.labels)) report(`${s.id}: нет метки «${op.label}»`); }
        else if (op.op === 'choice') for (const o of op.options) if (!(o.label in s.labels)) report(`${s.id}: нет метки «${o.label}»`);
      }
    }
  }

  function parse(src) {
    let cur = null;
    const touched = [];   // блоки этого вызова — проверить в конце (метка может быть объявлена позже перехода)
    const lines = src.split('\n');
    for (let n = 0; n < lines.length; n++) {
      const raw = lines[n];
      const line = raw.replace(/\s+\/\/.*$/, '').trim();
      if (!line || line.startsWith('//')) continue;

      let m;
      if ((m = line.match(/^===\s*(\S+)/))) {
        cur = { id: m[1], ops: [], labels: {} };
        library[cur.id] = cur;
        touched.push(cur);
        continue;
      }
      if (!cur) throw new Error('Скрипт: строка вне блока === : ' + line);
      const ops = cur.ops;

      if ((m = line.match(/^#\s*(\w+)/))) { cur.labels[m[1]] = ops.length; continue; }
      if ((m = line.match(/^->\s*(\w+)/))) { ops.push({ op: 'goto', label: m[1] }); continue; }
      if (line === 'end') { ops.push({ op: 'end' }); continue; }
      if ((m = line.match(/^set\s+(flag|var)\.(\w+)\s*(=|\+=|-=)\s*(-?\d+)/))) {
        ops.push({ op: 'set', kind: m[1], key: m[2], mode: m[3], val: Number(m[4]) }); continue;
      }
      if ((m = line.match(/^if\s+(.+?)\s*->\s*(\w+)$/))) {
        ops.push({ op: 'if', cond: m[1], label: m[2] }); continue;
      }
      if ((m = line.match(/^call\s+(\w+)\s*(.*)$/))) {
        ops.push({ op: 'call', name: m[1], args: m[2] ? m[2].split(/\s+/) : [] }); continue;
      }
      if ((m = line.match(/^\?\s*(.*)$/))) {
        ops.push({ op: 'choice', prompt: m[1], options: [] }); continue;
      }
      if ((m = line.match(/^\*\s*(?:\[([^\]]+)\]\s*)?(.+?)\s*->\s*(\w+)$/))) {
        let last = ops[ops.length - 1];
        if (!last || last.op !== 'choice') { last = { op: 'choice', prompt: '', options: [] }; ops.push(last); }
        last.options.push({ cond: m[1] || null, text: m[2], label: m[3] });
        continue;
      }
      if ((m = line.match(/^(\w*)(?:\[([^\]]+)\])?(?:\((\w+)\))?\s*:\s*(.*)$/))) {
        ops.push({ op: 'say', who: m[1] || null, name: m[2] || null, emo: m[3] || null, text: m[4] }); continue;
      }
      report(`${cur.id}: не понимаю строку «${line}»`);   // строку пропускаем: игра работает, ошибку ловят проверки
    }
    validateBlocks(touched);
  }

  // Проверка условия: flag.x | !flag.x | var.n >= 3
  function test(cond) {
    const neg = cond.trim().startsWith('!');
    if (G.script.extraTest) {
      const r = G.script.extraTest(cond.trim().replace(/^!/, ''));
      if (r !== undefined) return neg ? !r : r;
    }
    const m = cond.trim().match(/^(!?)(flag|var)\.(\w+)\s*(==|!=|>=|<=|>|<)?\s*(-?\d+)?$/);
    if (!m) { report(`непонятное условие «${cond.trim()}»`); return false; }
    const store = m[2] === 'flag' ? G.state.flags : G.state.vars;
    const v = Number(store[m[3]] || 0);
    let r;
    if (!m[4]) r = !!v;
    else {
      const b = Number(m[5]);
      r = { '==': v === b, '!=': v !== b, '>=': v >= b, '<=': v <= b, '>': v > b, '<': v < b }[m[4]];
    }
    return m[1] ? !r : r;
  }

  // Исполнитель: шагает по операциям до реплики/выбора/конца
  function runner(id) {
    const s = library[id];
    if (!s) throw new Error('Нет скрипта ' + id);
    let pc = 0;
    const r = {
      id,
      // вернуть следующую «видимую» операцию: say | choice | end
      next() {
        for (let guard = 0; guard < 1000; guard++) {
          const op = s.ops[pc++];
          if (!op) return { op: 'end' };
          switch (op.op) {
            case 'say': return op;
            case 'choice': {
              const options = op.options.filter((o) => !o.cond || test(o.cond));
              return { op: 'choice', prompt: op.prompt, options };
            }
            case 'end': return op;
            case 'goto': r.jump(op.label); break;
            case 'if': if (test(op.cond)) r.jump(op.label); break;
            case 'set': {
              const store = op.kind === 'flag' ? G.state.flags : G.state.vars;
              const old = Number(store[op.key] || 0);
              store[op.key] = op.mode === '=' ? op.val : op.mode === '+=' ? old + op.val : old - op.val;
              G.events.emit('state-changed', op.kind, op.key, store[op.key]);
              break;
            }
            case 'call': {
              const fn = actions[op.name];
              if (fn) fn(op.args, r); else report(`${id}: нет действия «${op.name}»`);
              break;
            }
          }
        }
        return { op: 'end' };
      },
      jump(label) {
        if (!(label in s.labels)) {
          // Метка потерялась (ошибка сценария). Раньше здесь летело исключение и игра зависала:
          // сцена диалога оставалась в стеке без текущей операции. Теперь — сообщаем и завершаем диалог.
          report(`${id}: нет метки ${label}`);
          pc = s.ops.length;
          return;
        }
        pc = s.labels[label];
      },
    };
    return r;
  }

  // Перепроверить всю библиотеку (используют проверки и режим отладки)
  function validate() { for (const id of Object.keys(library)) validateBlocks([library[id]]); return problems.slice(); }

  return { parse, runner, test, library, actions, problems, report, validate };
})();

// Базовые действия
G.script.actions.sfx = (a) => { const f = G.audio.sfx[a[0]]; f && f(); };
