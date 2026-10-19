// «Жизнь» (этап 4): непрерывные часы, погода, расписание персонажей, предупреждения о нуждах.
// Часы идут только в сцене мира, когда сверху нет диалога, меню, лавки или карты (§14.3 п.5).
G.life = (() => {
  const RATE = 0.6;             // игровых минут за реальную секунду: сутки (1440 мин) = 40 реальных минут
  const WEATHER = {
    sun:   { icon: '☀', name: 'Ясно',    col: '#ffd84a' },
    cloud: { icon: '☁', name: 'Облачно', col: '#c8c8d8' },
    rain:  { icon: '☂', name: 'Дождь',   col: '#7ab0ff' },
  };
  const PERIODS = [[6, 'Утро'], [12, 'День'], [18, 'Вечер'], [22, 'Ночь']];

  const api = {
    RATE, WEATHER,
    acc: 0,

    // Погода на день (детерминированно от номера дня; день 1 всегда ясный)
    weather(day = G.state.vars.day) {
      if (day === 1) return 'sun';
      const r = G.util.rng(day * 7919 + 13)();
      return r < 0.58 ? 'sun' : r < 0.82 ? 'cloud' : 'rain';
    },
    raining() { return this.weather() === 'rain'; },

    weekday(day = G.state.vars.day) { return (day - 1) % 7 < 5; },   // Пн–Пт
    period(min = G.state.vars.min) {
      const h = (min / 60) % 24;
      let name = 'Ночь';
      for (const [from, n] of PERIODS) if (h >= from) name = n;
      return name;
    },
    absMin() { return G.state.vars.day * 1440 + G.state.vars.min; },

    // Окно расписания: [от, до, дни?]  дни: 'wd' — будни, 'we' — выходные, число — с какого дня
    inWindow(w, min = G.state.vars.min, day = G.state.vars.day) {
      const [a, b, days] = w;
      if (days === 'wd' && !this.weekday(day)) return false;
      if (days === 'we' && this.weekday(day)) return false;
      if (typeof days === 'number' && day < days) return false;
      return min >= a && min < b;
    },
    // Виден ли NPC сейчас: keep() — сюжетное «держать на месте», sched — окна, cond — прочие условия
    visible(n) {
      if (n.keep && n.keep()) return true;
      if (n.cond && !n.cond()) return false;
      if (n.sched && !n.sched.some((w) => this.inWindow(w))) return false;
      if (n.dryOnly && this.raining()) return false;
      return true;
    },

    // Шаг часов. Возвращает, сколько целых минут прошло (0, если ни одной)
    tick(dt, running) {
      this.acc += dt * RATE;
      if (this.acc < 1) return 0;
      const n = Math.floor(this.acc);
      this.acc -= n;
      G.game.advance(n, { running });
      return n;
    },
  };
  return api;
})();

// ---------- Действия и условия для сценариев ----------
// call eat 25 | call rest 20 | call mood 5 | call cooldown rice 240 | call home | call charcreate | call askname | call begin
G.script.actions.eat = (a) => G.game.eat(Number(a[0]) || 0);
G.script.actions.rest = (a) => G.game.rest(Number(a[0]) || 0);
G.script.actions.mood = (a) => G.game.mood(Number(a[0]) || 0);
G.script.actions.cooldown = (a) => { G.state.vars['cd_' + a[0]] = G.life.absMin() + (Number(a[1]) || 60); };
G.script.actions.home = () => { G.game.pending = 'home'; };
G.script.actions.charcreate = () => { G.game.pending = 'charcreate'; };
// пролог: ввод имени героя (сцена nameinput) и начало игры (с этого момента работают автосохранения)
G.script.actions.askname = () => { G.game.pending = 'askname'; };
G.script.actions.begin = () => { G.state.started = true; G.state.flags.frd_init = 1; G.storage.save(G.state); };
(() => {
  const prev = G.script.extraTest;
  G.script.extraTest = (cond) => {
    let m;
    if ((m = cond.match(/^cooldown\.(\w+)$/))) return (G.state.vars['cd_' + m[1]] || 0) > G.life.absMin();
    if (cond === 'weekday') return G.life.weekday();
    if (cond === 'rain') return G.life.raining();
    if ((m = cond.match(/^skill\.(\w+)$/))) return G.hero.has(m[1]);
    return prev ? prev(cond) : undefined;
  };
})();
