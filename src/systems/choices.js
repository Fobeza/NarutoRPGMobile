// Выборы сюжета, которые меняют мир. Значение хранится числом во флаге ch_<id> (1 — первый вариант).
// Последствия — таблица EFFECTS: репутация (цены в лавках и отношение жителей), дружба, флаги мира (стража, реплики жителей).
G.CHOICES = {
  taunt:  ['fight', 'leave', 'talk'],   // день 13: героя дразнят из-за чакры
  hokage: ['told', 'silent'],           // день 20: рассказать Хокаге о незнакомце в плаще
  exam:   ['honest', 'cautious'],       // день 21: показать на экзамене всю силу или сдерживаться
  naruto: ['listen', 'joke'],
  sasuke: ['trust', 'distance'],        // ветка Саске: поддержать или держать дистанцию
  kiba:   ['tell', 'keep'],             // ветка Кибы: рассказать про незнакомый запах или умолчать           // ветка Наруто: ответить серьёзно или шуткой
};
G.choices = (() => {
  const EFFECTS = {
    taunt:  { fight: { rep: -3, friend: { naruto: 2 } }, leave: { friend: { iruka: 1 } }, talk: { rep: 2, friend: { hinata: 1 } } },
    hokage: { told: { rep: 1, flag: 'guards_up', friend: { iruka: 1 } }, silent: { friend: { naruto: 1 } } },
    exam:   { honest: { rep: 1 }, cautious: { friend: { shikamaru: 1 } } },
    sasuke: { trust: { friend: { sasuke: 1 } }, distance: { rep: 1 } },
    kiba:   { tell: { friend: { kiba: 1 }, flag: 'kiba_knows' }, keep: {} },
    naruto: { listen: { friend: { naruto: 1 }, flag: 'naruto_trust' }, joke: {} },
  };
  function get(id) { const v = G.state.flags['ch_' + id]; return v ? (G.CHOICES[id] || [])[v - 1] || null : null; }
  function set(id, name) {
    const i = (G.CHOICES[id] || []).indexOf(name);
    if (i < 0 || G.state.flags['ch_' + id]) return false;   // выбор делается один раз
    G.state.flags['ch_' + id] = i + 1;
    const e = (EFFECTS[id] || {})[name] || {};
    if (e.rep) G.state.vars.rep = (G.state.vars.rep || 0) + e.rep;
    for (const [who, n] of Object.entries(e.friend || {})) G.friends.add(who, n, 'quest');
    if (e.flag) G.state.flags[e.flag] = 1;
    G.events.emit('choice', id, name);
    return true;
  }
  const is = (id, name) => get(id) === name;
  // как деревня относится к герою: afraid / neutral / kind
  function attitude() {
    const f = G.state.flags;
    let s = (G.state.vars.rep || 0) * 0.5;
    if (is('taunt', 'fight')) s -= 2; if (is('taunt', 'talk')) s += 2;
    if (G.purple && G.state.started) s += (G.purple.stability() - 40) / 30;
    return s < -1 ? 'afraid' : s > 1 ? 'kind' : 'neutral';
  }
  // реплика случайного жителя о герое (одна и та же для одного жителя), null — обычный разговор
  function villagerLine(n) {
    if (!G.state.started || G.state.vars.day < 4 || !(n.id === 'villager_m' || n.id === 'villager_f')) return null;
    const h = G.util.hash2(n.uid ? n.uid.length : 0, (n.uid || '').charCodeAt(n.uid ? n.uid.length - 1 : 0) || 0, 61);
    if (h > 0.55) return null;   // часть жителей молчит
    const name = G.state.hero.name || 'новичок', a = attitude();
    const pool = {
      afraid: ['Говорят, у новичка фиолетовая чакра. Держись от него подальше, лучше не рисковать.', name + '? Это ты вспыхиваешь искрами? Не подходи близко, ладно?', 'Из-за таких, как ты, нам тревожно. Уходи, пожалуйста.'],
      neutral: ['Так это ты новенький с необычной чакрой? Любопытно. Главное, не разнеси мне лавку.', 'Слышала, у тебя чакра фиолетовая. Редкость.', 'Ты учишься в Академии, верно? Удачи на экзамене.'],
      kind: ['Это ты новенький с фиолетовой чакрой? Ничего не бойся, в Конохе тебя не обидят.', 'Мы за тебя держим кулаки, ' + name + '! Сдай экзамен!', 'Хорошие ребята учатся в Академии. Ты нам нравишься.'],
    }[a];
    return pool[Math.floor(h / 0.55 * pool.length) % pool.length];
  }
  return { get, set, is, attitude, villagerLine, EFFECTS };
})();
G.script.actions.choice = (a) => G.choices.set(a[0], a[1]);
// Условия сценариев: choice.taunt.fight; stab.45 — стабильность чакры не ниже 45
(() => {
  const prev = G.script.extraTest;
  G.script.extraTest = (cond) => {
    let m;
    if ((m = cond.match(/^choice\.(\w+)\.(\w+)$/))) return G.choices.is(m[1], m[2]);
    if ((m = cond.match(/^stab\.(\d+)$/))) return G.purple.stability() >= Number(m[1]);
    return prev ? prev(cond) : undefined;
  };
})();
// call emit имя аргумент — сообщить миру о событии (закрывает шаги заданий с on)
G.script.actions.emit = (a) => G.events.emit(a[0], ...a.slice(1));
// call purplectl 8 — практика контроля чакры (например, урок наставника)
G.script.actions.purplectl = (a) => { G.state.vars.purple_ctl = Math.min(40, (G.state.vars.purple_ctl || 0) + (Number(a[0]) || 0)); };
