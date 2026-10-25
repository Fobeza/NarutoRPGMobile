// Игровое состояние: время, деньги, нужды, цель, инвентарь.
// Всё хранится в G.state (и попадает в сохранение). Числа — в G.state.vars,
// чтобы сценарии могли их проверять: `if var.money >= 40 -> treat`, `if var.min >= 1080 -> sleep`.
G.game = (() => {
  const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  // Календарь как в Stardew Valley: месяц — 4 недели по 7 дней, всегда лето (июнь → июль → август → снова июнь)
  const MONTHS = [['Июнь', 'июня'], ['Июль', 'июля'], ['Август', 'августа']], MONTH_DAYS = 28;
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
      layoutVersion: 3,
      hero: { name: '', stats: null, skills: [] },
      flags: {},
      vars: { day: 1, min: 8 * 60, money: START_MONEY, hp: 100, chakra: 100, fatigue: 10, purple_ctl: 0, spent: 0, injury: 0, poison: 0 },
      daily: {},           // разовые за день отметки (предупреждения об усталости и т.п.), сбрасываются во сне
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
      dlgLog: [],          // история реплик (последние 60 строк), экран «История»
      quests: {},          // id → { st, step, day, due }
      tracked: null,       // отслеживаемое задание
      cardOwned: null,     // свои карты боя: id → копий (G.deck.ensure заполнит по умолчанию)
      deck: null,          // колода героя: список id карт (10–20), см. systems/deck.js
      cardOwned: null,     // свои карты боя: id → копий (G.deck.ensure заполнит по умолчанию)
      deck: null,          // колода героя: список id (10–20 карт)
      marker: null,        // своя метка на карте { x, y, label } (в тайлах Конохи)
      fog: '',             // исследованные участки карты (строка 0/1 по блокам 8×8 тайлов)
    };
  }

  const api = {
    DAYS, DAYS_FULL, MONTHS, MONTH_DAYS, GOALS, POUCH,

    newState() {
      G.state = defaults();
      // новая игра всегда пишется в основной слот: иначе автосейв затрёт ручной
      if (G.storage && G.storage.KEY_SLOTS) G.storage.active = 0;
      return G.state;
    },

    // Дополнить старое сохранение недостающими полями
    fix(st) {
      if (G.deck) G.deck.ensure(st);   // колода: у старых сохранений её нет — собираем базовую
      if (st.battleCheckpoint) {
        const before = JSON.parse(st.battleCheckpoint);
        for (const k of Object.keys(st)) delete st[k];
        Object.assign(st, before, { battleCheckpoint: null });
      }
      const layout = st.layoutVersion || 1;   // 1 — до увеличения зданий, 2 — до плотной Конохи (2026-10-21), 3 — текущая
      const d = defaults();
      for (const k of Object.keys(d)) if (st[k] == null) st[k] = d[k];
      // 2.3: вместо энергии и сытости — одна шкала усталости (0 — свеж, 100 — без сил)
      if (st.vars.fatigue == null && st.vars.energy != null) st.vars.fatigue = Math.round(100 - st.vars.energy);
      delete st.vars.energy; delete st.vars.food; delete st.vars.mood;   // 2.3: настроения нет
      for (const k of Object.keys(d.vars)) if (st.vars[k] == null) st.vars[k] = d.vars[k];
      for (const k of Object.keys(d.hero)) if (st.hero[k] === undefined) st.hero[k] = d.hero[k];
      if (layout < 3 && st.pos && G.LEGACY_BUILDINGS) {
        // раскладка сменилась: комната «in:N» — по старому номеру здания, на улице — ближайшая свободная клетка
        const k = G.world.konoha(), p = st.pos;
        if (String(p.map).startsWith('in:')) {
          const n = Number(String(p.map).split(':')[1]);
          const tpl = layout === 1 ? (G.LEGACY_BUILDINGS[n] || {}).tpl : (G.LEGACY_ROOMS_V2 || {})[n];
          const home = (tpl && k.landmarks[tpl] && k.landmarks[tpl].interior ? k.landmarks[tpl] : null) || G.world.heroHome();
          const room = G.world.get(home.interior.id);
          st.pos = { map: room.id, dir: 'down', ...room.spawn };
        } else if (p.map === 'konoha' && k.blockedRect(G.actors.feet({}, p.x, p.y))) {
          const free = G.world.freeTile(k, Math.floor(p.x / 16), Math.floor(p.y / 16));
          if (free) { p.x = free[0] * 16 + 8; p.y = free[1] * 16 + 12; }
          else st.pos = { map: G.world.heroHome().interior.id, dir: 'down', ...G.world.get(G.world.heroHome().interior.id).spawn };
        }
        st.marker = null;
      }
      st.layoutVersion = 3;
      // «Дороги Листа» убраны (2.3): герой с карты экспедиции возвращается к Академии, служебные поля чистятся
      if (st.pos && String(st.pos.map).startsWith('adv:') && G.world) {
        const k = G.world.konoha();
        st.pos = G.world.outsideOf(k.landmarks.academy || G.world.heroHome());
        st.marker = null;
      }
      for (const bag of [st.flags, st.vars, st.daily]) if (bag) for (const key of Object.keys(bag)) if (key.startsWith('adv_')) delete bag[key];
      for (const id of Object.keys(st.quests || {})) if (id.startsWith('adv_')) delete st.quests[id];
      if (st.tracked && String(st.tracked).startsWith('adv_')) st.tracked = null;
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
      if (G.deck) G.deck.ensure(st);
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
    monthIndex(day = this.v.day) { return Math.floor((day - 1) / MONTH_DAYS); },
    dayOfMonth(day = this.v.day) { return (day - 1) % MONTH_DAYS + 1; },
    monthName(day = this.v.day) { return MONTHS[this.monthIndex(day) % MONTHS.length][0]; },
    // «5 июня»
    date(day = this.v.day) { return this.dayOfMonth(day) + ' ' + MONTHS[this.monthIndex(day) % MONTHS.length][1]; },
    year(day = this.v.day) { return Math.floor(this.monthIndex(day) / MONTHS.length) + 1; },

    // Сдвинуть время вперёд на n минут. Нужды (этап 4):
    //   усталость +4,2/ч (×Выносливость), бег ещё +7/ч; еда, чай и отдых её снимают;
    advance(n, opts = {}) {
      if (n <= 0) return;
      const v = this.v, H = G.hero;
      const prev = v.min;
      v.min += n;
      const drain = (0.07 + (opts.running ? 0.12 : 0)) * (H ? H.drainMul() : 1);
      v.fatigue = G.util.clamp(v.fatigue + n * drain, 0, 100);
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
    // еда питательностью n снимает усталость (сытость в игре не считается)
    eat(n) { this.rest(Math.round(n * 0.6)); },
    // отдых: усталость −n; tire — усталость +n (занятия, бой, работа)
    rest(n) { this.v.fatigue = G.util.clamp(this.v.fatigue - n, 0, 100); },
    tire(n) { this.v.fatigue = G.util.clamp(this.v.fatigue + n, 0, 100); },
    // запас сил: 100 — свеж, 0 — без сил
    vigor() { return 100 - this.v.fatigue; },

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
      // после финала первой главы задания кончились — но строка цели не должна пустовать
      if (G.state.flags.postgame) return 'Свободная жизнь: тренируйся, дружи и бери поручения';
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
      const useful = (e.rest && v.fatigue > 0) || (e.hp && v.hp < 100) || (e.chakra && v.chakra < 100) || (e.injury && v.injury > 0) || (e.poison && v.poison > 0) || (e.sleep && !G.state.daily.herbTea);
      if (!useful) return { ok: false, text: 'Сейчас не нужно. Предмет сохранён.' };
      this.take(id);
      if (e.rest) this.rest(e.rest);
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
    // opts.faint — уснул где попало (обморок): утром усталость 50.
    // Отбой до 23:00 — усталость 0; каждый час позже +10 (Ранняя пташка: +5), но не больше 50.
    sleep(opts = {}) {
      const v = this.v, H = G.hero;
      if (G.academy && G.state.started) G.academy.checkSkip(true);   // сон не отменяет прогул
      const bed = v.min;
      const lateH = Math.max(0, bed - 23 * 60) / 60;
      const wakeFatigue = opts.faint ? 50 : Math.round(G.util.clamp(lateH * (H.has('early_bird') ? 5 : 10), 0, 50));
      const summary = { day: v.day, date: this.date(), dayName: this.dayNameFull(), spent: v.spent, log: G.state.log.slice(), money: v.money,
        bed, wakeFatigue, faint: !!opts.faint };
      v.day += 1;
      v.min = H.wakeMin();
      v.fatigue = G.state.daily.herbTea ? 0 : wakeFatigue;
      summary.wakeFatigue = v.fatigue;
      v.hp = Math.min(100, v.hp + (G.state.daily.herbTea ? 50 : opts.faint ? 10 : 25));
      v.chakra = Math.min(100, v.chakra + (G.state.daily.herbTea ? 100 : 40));
      v.injury = Math.max(0, (v.injury || 0) - 1);
      v.spent = 0;
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
