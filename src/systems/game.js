// Игровое состояние: время, деньги, нужды, цель, инвентарь.
// Всё хранится в G.state (и попадает в сохранение). Числа — в G.state.vars,
// чтобы сценарии могли их проверять: `if var.money >= 40 -> treat`, `if var.min >= 1080 -> sleep`.
G.game = (() => {
  const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const DAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  const START_MONEY = 300;
  const POUCH = 10;           // слотов подсумка на старте (§5.4)

  // Цели (строка цели внизу экрана). Полноценные задания — Этап 3.5.
  const GOALS = {
    academy: 'Зайди в Академию к Ируке-сенсею',
    naruto: 'Найди Наруто у качелей',
    ramen: 'Сходи с Наруто в Ичираку рамен',
    home: 'Вернись домой и ложись спать',
    free: 'Свободный день: гуляй по Конохе',
  };

  function defaults() {
    return {
      started: false,
      layoutVersion: 2,
      hero: { name: '', stats: null, skills: [] },
      flags: {},
      vars: { day: 1, min: 8 * 60, money: START_MONEY, hp: 100, chakra: 100, energy: 90, food: 60, mood: 60, spent: 0, injury: 0, poison: 0 },
      daily: {},           // разовые за день отметки (предупреждения о голоде и т.п.), сбрасываются во сне
      inv: {},
      chest: {},
      frQueue: [],
      makeupQ: [],
      battleCheckpoint: null, // независимый снимок до боя; незавершённый бой откатывается целиком
      streetLife: { events: {}, apples: 0, helped: {} }, // необязательные истории и память соседей
      learning: {},        // выполненные упражнения и памятка наставников
      goal: null,
      pos: null,
      log: [],             // события дня для экрана «Итоги дня»
      quests: {},          // id → { st, step, day, due }
      tracked: null,       // отслеживаемое задание
      marker: null,        // своя метка на карте { x, y, label } (в тайлах Конохи)
      fog: '',             // исследованные участки карты (строка 0/1 по блокам 8×8 тайлов)
    };
  }

  const api = {
    DAYS, DAYS_FULL, GOALS, POUCH,

    newState() { G.state = defaults(); return G.state; },

    // Дополнить старое сохранение недостающими полями
    fix(st) {
      if (st.battleCheckpoint) {
        const before = JSON.parse(st.battleCheckpoint);
        for (const k of Object.keys(st)) delete st[k];
        Object.assign(st, before, { battleCheckpoint: null });
      }
      const oldLayout = !st.layoutVersion;
      const d = defaults();
      for (const k of Object.keys(d)) if (st[k] == null) st[k] = d[k];
      for (const k of Object.keys(d.vars)) if (st.vars[k] == null) st.vars[k] = d.vars[k];
      for (const k of Object.keys(d.hero)) if (st.hero[k] === undefined) st.hero[k] = d.hero[k];
      if (oldLayout && st.pos && G.LEGACY_BUILDINGS) {
        const k = G.world.konoha(), p = st.pos;
        if (p.map !== 'konoha') {
          const old = G.LEGACY_BUILDINGS[Number(p.map.split(':')[1])];
          const home = (old && k.landmarks[old.tpl] && k.landmarks[old.tpl].interior ? k.landmarks[old.tpl] : null) || G.world.heroHome();
          const room = G.world.get(home.interior.id);
          st.pos = { map: room.id, dir: 'down', ...room.spawn };
        } else if (k.blockedRect(G.actors.feet({}, p.x, p.y))) {
          const free = G.world.freeTile(k, Math.floor(p.x / 16), Math.floor(p.y / 16));
          if (free) { p.x = free[0] * 16 + 8; p.y = free[1] * 16 + 12; }
          else st.pos = { map: G.world.heroHome().interior.id, dir: 'down', ...G.world.get(G.world.heroHome().interior.id).spawn };
        }
        st.marker = null;
      }
      // сохранение до этапа 3.5 (цели без заданий) → задание «Первый день»
      if (st.started && !Object.keys(st.quests).length) {
        const f = st.flags;
        const step = f.ramen_done ? 4 : f.naruto_invited ? 3 : f.enrolled ? 2 : 0;
        st.quests.day1 = { st: f.day2_intro ? 'done' : 'active', step, day: 1 };
        if (!f.day2_intro) st.tracked = 'day1';
      }
      // старые сохранения: награды дружбы за уже достигнутые уровни считаем выданными (иначе выдадутся повторно)
      if (st.started && !st.flags.frd_init && G.FRIENDS) {
        st.flags.frd_init = 1;
        for (const id of Object.keys(G.FRIENDS)) for (let l = 1; l <= Math.min(5, Math.floor((st.vars['friend_' + id] || 0) / 5)); l++) st.flags['frd_' + id + '_' + l] = 1;
      }
      // Старый переполненный подсумок: предметы сохраняются в домашнем сундуке.
      if (G.ITEMS) {
        let free = POUCH + (st.vars.pouch_plus || 0);
        for (const [id, n] of Object.entries(st.inv)) if (G.ITEMS[id] && G.ITEMS[id].pouch) {
          const keep = Math.max(0, Math.min(n, free)), extra = n - keep;
          free -= keep;
          if (extra) { st.chest[id] = (st.chest[id] || 0) + extra; if (keep) st.inv[id] = keep; else delete st.inv[id]; }
        }
      }
      if (st.started && G.story && G.story.recover) G.story.recover(st);
      return st;
    },

    get v() { return G.state.vars; },

    // Загрузить сохранение из слота и войти в мир («Продолжить», импорт, резервная копия)
    loadSaved() {
      const st = G.storage.load();
      G.game.newState();
      if (st) Object.assign(G.state, st);
      this.fix(G.state);
      G.scenes.fadeTo(G.scenes.make('world', G.state.pos || null));
      return !!st;
    },

    // ---------- Время ----------
    clock(min = this.v.min) {
      const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    },
    dayName(day = this.v.day) { return DAYS[(day - 1) % 7]; },
    dayNameFull(day = this.v.day) { return DAYS_FULL[(day - 1) % 7]; },
    week(day = this.v.day) { return Math.floor((day - 1) / 7) + 1; },

    // Сдвинуть время вперёд на n минут. Нужды (этап 4):
    //   сытость −6/ч; энергия −3,6/ч (×Выносливость), бег ещё −7/ч, на пустой желудок расход ×2;
    //   настроение медленно возвращается к 50, в дождь чуть падает.
    advance(n, opts = {}) {
      if (n <= 0) return;
      const v = this.v, H = G.hero;
      const prev = v.min;
      v.min += n;
      v.food = G.util.clamp(v.food - n * 0.1, 0, 100);
      let drain = (0.06 + (opts.running ? 0.12 : 0)) * (H ? H.drainMul() : 1);
      if (v.food <= 0) drain *= 2;
      v.energy = G.util.clamp(v.energy - n * drain, 0, 100);
      v.mood += G.util.clamp(50 - v.mood, -n * 0.01, n * 0.01);
      if (G.life && G.life.raining()) v.mood -= n * 0.004;
      v.mood = G.util.clamp(v.mood, 0, 100);
      G.events.emit('time', v.min, prev);
    },
    // Перевести часы на «HH:MM», только вперёд
    advanceTo(hhmm) {
      const [h, m] = String(hhmm).split(':').map(Number);
      const target = h * 60 + (m || 0);
      if (target > this.v.min) this.advance(target - this.v.min);
    },
    isNight(min = this.v.min) { return min >= 20 * 60 || min < 5 * 60; },

    // Цвет «освещения» по времени суток: [r,g,b,a] или null
    light(min = this.v.min) {
      const h = min / 60;
      if (h >= 6.5 && h < 16.5) return null;
      const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
      const EVE = [255, 140, 60, 0.18], DUSK = [120, 60, 140, 0.32], NIGHT = [20, 30, 90, 0.5], DAWN = [255, 190, 150, 0.15];
      if (h >= 16.5 && h < 18.5) return lerp([255, 160, 80, 0], EVE, (h - 16.5) / 2);
      if (h >= 18.5 && h < 19.5) return lerp(EVE, DUSK, h - 18.5);
      if (h >= 19.5 && h < 21) return lerp(DUSK, NIGHT, (h - 19.5) / 1.5);
      if (h >= 21 || h < 5) return NIGHT;
      if (h < 6.5) return lerp(NIGHT, DAWN, (h - 5) / 1.5);
      return null;
    },

    // ---------- Деньги ----------
    canPay(n) { return this.v.money >= n; },
    pay(n) {
      if (!this.canPay(n)) return false;
      this.v.money -= n; this.v.spent += n;
      G.events.emit('money', this.v.money);
      return true;
    },
    earn(n) { this.v.money += n; G.events.emit('money', this.v.money); },

    // ---------- Нужды ----------
    eat(n) { this.v.food = G.util.clamp(this.v.food + n, 0, 100); },
    rest(n) { this.v.energy = G.util.clamp(this.v.energy + n, 0, 100); },
    mood(n) { this.v.mood = G.util.clamp((this.v.mood ?? 60) + n, 0, 100); },
    moodName(m = this.v.mood) { return m >= 80 ? 'Отличное' : m >= 60 ? 'Хорошее' : m >= 40 ? 'Обычное' : m >= 20 ? 'Хмурое' : 'Ужасное'; },

    // ---------- Цель ----------
    setGoal(id) {
      if (G.state.goal === id) return;
      G.state.goal = id;
      G.events.emit('goal', id);
    },
    // Текст цели: шаг отслеживаемого задания (этап 3.5), иначе — старая цель (запасной вариант)
    goalText() {
      const q = G.quests && G.quests.tracked(), st = q && G.quests.curStep(q);
      if (st) return st.text;
      const g = G.state.goal; return g ? GOALS[g] || g : null;
    },

    // ---------- Инвентарь ----------
    count(id) { return G.state.inv[id] || 0; },
    give(id, n = 1) {
      if (!G.ITEMS[id] || !Number.isSafeInteger(n)) return 0;
      const st = G.state;
      let add = n < 0 ? -Math.min(this.count(id), -n) : n;
      if (n > 0 && G.ITEMS[id].pouch) {
        add = Math.min(n, Math.max(0, this.pouchMax() - this.pouchUsed()));
        const extra = n - add;
        if (extra) {
          st.chest[id] = (st.chest[id] || 0) + extra;
          const text = `${G.ITEMS[id].name} ×${extra}: отправлено в домашний сундук`;
          this.note(text);
          const w = G.scenes.stack.find((s) => s.name === 'world'); if (w && w.showToast) w.showToast(text);
        }
      }
      st.inv[id] = this.count(id) + add;
      if (st.inv[id] <= 0) delete st.inv[id];
      G.events.emit('inv', id);
      return add;
    },
    usable(id) {
      const it = G.ITEMS[id]; return !!(it && it.effect && (it.cat === 'food' || it.cat === 'med' || id === 'herb_tea'));
    },
    useItem(id) {
      const it = G.ITEMS[id], v = this.v, e = it && it.effect;
      if (!this.usable(id) || this.count(id) < 1) return { ok: false, text: 'Этот предмет нельзя применить.' };
      const useful = (e.food && v.food < 100) || (e.energy && v.energy < 100) || (e.mood && v.mood < 100) || (e.hp && v.hp < 100) || (e.chakra && v.chakra < 100) || (e.injury && v.injury > 0) || (e.poison && v.poison > 0) || (e.sleep && !G.state.daily.herbTea);
      if (!useful) return { ok: false, text: 'Сейчас не нужно. Предмет сохранён.' };
      this.take(id);
      if (e.food) this.eat(e.food); if (e.energy) this.rest(e.energy); if (e.mood) this.mood(e.mood);
      if (e.hp) v.hp = Math.min(100, v.hp + e.hp);
      if (e.chakra) v.chakra = Math.min(100, v.chakra + e.chakra);
      if (e.injury) v.injury = Math.max(0, v.injury - e.injury);
      if (e.poison) v.poison = 0;
      if (e.sleep) G.state.daily.herbTea = 1;
      if (e.minutes) this.advance(e.minutes);
      G.events.emit('item-used', id);
      return { ok: true, text: `${it.name}: применено.` };
    },
    // занято слотов подсумка (боевые предметы и медицина)
    take(id, n = 1) { this.give(id, -n); },
    pouchUsed() {
      let n = 0;
      for (const [id, c] of Object.entries(G.state.inv)) { const it = G.ITEMS[id]; if (it && it.pouch) n += c; }
      return n;
    },
    pouchMax() { return POUCH + (G.state.vars.pouch_plus || 0); },

    // ---------- Журнал дня ----------
    note(text) { G.state.log.push(text); },

    // ---------- Сон: следующий день ----------
    // opts.faint — уснул где попало (обморок): энергия утром 50.
    // Отбой до 23:00 — энергия 100; каждый час позже −10 (Ранняя пташка: −5), но не меньше 50.
    sleep(opts = {}) {
      const v = this.v, H = G.hero;
      if (G.academy && G.state.started) G.academy.checkSkip(true);   // сон не отменяет прогул
      const bed = v.min;
      const lateH = Math.max(0, bed - 23 * 60) / 60;
      const wakeEnergy = opts.faint ? 50 : Math.round(G.util.clamp(100 - lateH * (H.has('early_bird') ? 5 : 10), 50, 100));
      const summary = { day: v.day, dayName: this.dayNameFull(), spent: v.spent, log: G.state.log.slice(), money: v.money,
        bed, wakeEnergy, faint: !!opts.faint, mood: v.mood };
      v.day += 1;
      v.min = H.wakeMin();
      v.energy = G.state.daily.herbTea ? 100 : wakeEnergy;
      summary.wakeEnergy = v.energy;
      v.hp = Math.min(100, v.hp + (G.state.daily.herbTea ? 50 : opts.faint ? 10 : 25));
      v.chakra = Math.min(100, v.chakra + (G.state.daily.herbTea ? 100 : 40));
      v.injury = Math.max(0, (v.injury || 0) - 1);
      v.food = G.util.clamp(v.food - 15, 0, 100);
      v.spent = 0;
      if (opts.faint) this.mood(-8);
      summary.wake = v.min;
      summary.weather = G.life.weather(v.day);
      G.state.log = [];
      G.state.daily = {};
      G.events.emit('day', v.day);
      return summary;
    },
  };
  return api;
})();

// ---------- Действия для сценариев ----------
// call time 12:30   — перевести часы вперёд
// call wait 30      — подождать n минут
// call goal ramen   — новая цель (call goal none — убрать)
// call note Текст   — запись в журнал дня
// call give kunai 3 — дать предмет
// call sleep        — лечь спать (после диалога — экран «Итоги дня»)
G.script.actions.time = (a) => G.game.advanceTo(a[0]);
G.script.actions.wait = (a) => G.game.advance(Number(a[0]) || 0);
G.script.actions.goal = (a) => G.game.setGoal(a[0] === 'none' ? null : a[0]);
G.script.actions.note = (a) => G.game.note(a.join(' '));
G.script.actions.give = (a) => G.game.give(a[0], Number(a[1]) || 1);
G.script.actions.sleep = () => { G.game.pending = 'sleep'; };
G.script.actions.met = (a) => { G.state.flags['met_' + a[0]] = 1; };

// Состояние по умолчанию (до «Новой игры» / «Продолжить»)
G.game.newState();
