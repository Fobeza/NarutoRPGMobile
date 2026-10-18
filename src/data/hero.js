// Характеристики и стартовые навыки героя (план §3). Распределяются на вступительном тесте у Ируки.
G.STATS = [
  { id: 'tai',    name: 'Тайдзюцу',       short: 'Тай',  desc: 'Рукопашный бой и метание: урон, длина комбо.' },
  { id: 'nin',    name: 'Ниндзюцу',       short: 'Нин',  desc: 'Сила техник.' },
  { id: 'gen',    name: 'Гендзюцу',       short: 'Ген',  desc: 'Иллюзии, обман и защита от иллюзий.' },
  { id: 'chakra', name: 'Чакра',          short: 'Чак',  desc: 'Запас чакры.' },
  { id: 'ctrl',   name: 'Контроль чакры', short: 'Конт', desc: 'Время на печати, цена техник, хождение по деревьям и воде.' },
  { id: 'spd',    name: 'Скорость',       short: 'Скор', desc: 'Место на шкале ходов, уклонение. Уже сейчас: быстрее бег.' },
  { id: 'end',    name: 'Выносливость',   short: 'Вын',  desc: 'HP и стойкость. Уже сейчас: энергия тратится медленнее.' },
  { id: 'know',   name: 'Знания',         short: 'Зн',   desc: 'Анализ врага, ловушки, письменные тесты, учёба.' },
];
G.STAT_BASE = 3;
G.STAT_POINTS = 12;
G.STAT_MAX_START = 7;

// now: что навык делает уже сейчас (до появления боя и тренировок)
G.SKILLS = [
  { id: 'eagle_eye',  name: 'Меткий глаз',      desc: '+20% к точности и урону метания.' },
  { id: 'fast_hands', name: 'Быстрые руки',     desc: '+1,5 сек на печати рук.' },
  { id: 'big_chakra', name: 'Большой запас',    desc: '+25% чакры, но печати немного сложнее.' },
  { id: 'tough',      name: 'Крепкий орешек',   desc: '+10% HP. Раз за бой выживаешь с 1 HP.' },
  { id: 'analyst',    name: 'Аналитик',         desc: 'Видишь намерения врага на 2 хода вперёд.' },
  { id: 'grit',       name: 'Упорство',         desc: 'При HP < 30% урон +25%, Воля Огня растёт быстрее.' },
  { id: 'diligent',   name: 'Трудолюбие',       desc: 'Тренировки дают +25% прогресса.' },
  { id: 'charm',      name: 'Обаяние',          desc: 'Дружба растёт быстрее. Уже сейчас: скидка 10% в лавках.', now: true },
  { id: 'early_bird', name: 'Ранняя пташка',    desc: 'Нужно меньше сна. Уже сейчас: подъём в 5:00, поздний отбой бьёт слабее.', now: true },
];

G.hero = {
  stat(id) { const s = G.state.hero.stats; return s ? s[id] : G.STAT_BASE; },
  has(skill) { return (G.state.hero.skills || []).includes(skill); },
  ready() { return !!G.state.hero.stats; },
  // Множители, которые действуют уже сейчас
  runMul() { return 1 + 0.04 * (this.stat('spd') - G.STAT_BASE); },
  walkMul() { return 1 + 0.02 * (this.stat('spd') - G.STAT_BASE); },
  drainMul() { return Math.max(0.6, 1 - 0.05 * (this.stat('end') - G.STAT_BASE)); },
  priceMul() { const r = G.state.vars.rep || 0; return (this.has('charm') ? 0.9 : 1) * (r >= 20 ? 0.9 : r >= 10 ? 0.95 : 1); },
  wakeMin() { return this.has('early_bird') ? 5 * 60 : 7 * 60; },
};
