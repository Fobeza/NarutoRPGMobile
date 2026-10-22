// Дружба, подарки, совместные тренировки и спарринги (план §5.7). Очки дружбы: friend_<id>, уровень = очки / 5 (0..5).
G.FRIENDS = {
  naruto:    { team: 7,  love: ['charm', 'milk', 'chips'], like: ['carp'],   hate: ['flowers_s', 'flowers_m', 'flowers_l'], spar: 'naruto', train: 'run' },
  sasuke:    { team: 7,  love: ['tomato'], like: ['kunai', 'notebook'], hate: ['flowers_s', 'flowers_m', 'flowers_l', 'hairpin', 'candy'], spar: 'sasuke', train: 'throw' },
  sakura:    { team: 7,  love: ['hairpin', 'flowers_l'], like: ['flowers_m', 'flowers_s', 'notebook'], hate: ['chips', 'dog_food'], train: 'library' },
  hinata:    { team: 8,  love: ['flowers_s', 'charm', 'herb_blue'], like: ['hairpin', 'ointment', 'flowers_m'], hate: [], spar: 'hinata', train: 'meditate' },
  kiba:      { team: 8,  love: ['dog_treat'], like: ['dog_food', 'chips'], hate: ['flowers_s', 'flowers_m', 'flowers_l'], spar: 'kiba', train: 'run' },
  shino:     { team: 8,  love: ['bug_jar'], like: ['notebook', 'charm'], hate: ['chips'], spar: 'shino', train: 'stealth' },
  shikamaru: { team: 10, love: ['shogi'], like: ['notebook', 'green_tea'], hate: ['flowers_l'], spar: 'shikamaru', train: 'library' },
  choji:     { team: 10, love: ['chips', 'carp'], like: ['fish', 'eggs', 'milk', 'eel', 'berries'], hate: [], spar: 'choji', train: 'dummy' },
  ino:       { team: 10, love: ['hairpin', 'flowers_l', 'herb_blue'], like: ['flowers_m', 'charm'], hate: ['dog_food', 'chips'], spar: 'ino', train: 'meditate' },
  iruka:     { love: ['notebook'], like: ['charm', 'towel'], hate: [], train: 'seals' },
  lee:       { love: ['towel'], like: ['milk', 'weights'], hate: [], spar: 'lee', train: 'dummy' },
};
// Реплики по уровню: [0–1], [2–3], [4–5]
G.FRIEND_LINES = {
  naruto: [['Эй! Хочешь, расскажу, как я стану Хокаге?', 'Ирука-сенсей опять задал кучу всего... скукота!'], ['С тобой весело, даттебайо!', 'Пошли потом в Ичираку? Ты угощаешь! Шучу... наверное.'], ['Ты мой настоящий друг. Я это запомню навсегда!', 'Когда я стану Хокаге, ты будешь моей правой рукой!']],
  sasuke: [['...Чего тебе?', 'Не мешай. Я тренируюсь.'], ['Хм. Ты стал сильнее.', 'Если хочешь — потренируемся. Только не отставай.'], ['...Ты единственный, кто не смотрит на меня с жалостью.', 'Спасибо. Только никому не говори.']],
  sakura: [['Привет! Ты не видел Саске-куна?', 'Учиться надо, а не бегать по крышам!'], ['Ты, кстати, неплохо отвечаешь на уроках!', 'Давай вместе подготовимся к тесту?'], ['С тобой я чувствую себя смелее.', 'Ты хороший друг. Правда-правда!']],
  hinata: [['П-привет... — Хината краснеет и смотрит в сторону.', 'Я... я тренирую Мягкий кулак...'], ['Ты всегда такой добрый со мной...', 'Хочешь, потренируемся вместе? Если тебе не трудно...'], ['Рядом с тобой и с Наруто-куном я не боюсь.', 'Спасибо, что веришь в меня.']],
  kiba: [['Акамару говорит, от тебя пахнет раменом. Ха!', 'Я тут главный пёс, понял?'], ['А ты не трус! Акамару тебя уважает.', 'Погоняем по крышам? Кто последний — тот слабак!'], ['Ты в нашей стае, слышишь? Это навсегда.', 'Акамару, скажи «привет» лучшему другу! — Гав!']],
  shino: [['...', 'Ты наступил на муравья. Он запомнит.'], ['Ты не кричишь, как остальные. Это хорошо.', 'Жуки говорят, тебе можно доверять.'], ['Ты не забыл меня позвать. Я это ценю. Очень.', 'Ты — друг. Это логично.']],
  shikamaru: [['Хлопотно...', 'Облака не спешат. Вот бы и мне так.'], ['Сыграем в шоги? Ты хоть не сдаёшься сразу.', 'Знаешь, ты думаешь на пару ходов вперёд. Неплохо.'], ['С тобой даже хлопоты не такие хлопотные.', 'Если будет миссия — я хочу тебя в команду.']],
  choji: [['Хрум-хрум... Чипсы будешь? Последний не дам!', 'Мы с Шикамару лучшие друзья с детства.'], ['Ты не дразнишь меня толстым. Ты хороший.', 'Пойдём в Якинику! Там такое мясо!'], ['Последний чипс — тебе. Это значит — навсегда друг!', 'Ты как Шикамару — свой.']],
  ino: [['Ты кто? А, новенький. Цветы покупать будешь?', 'Саске-кун сегодня такой красивый...'], ['А ты ничего! Для новенького.', 'Знаешь язык цветов? Я научу!'], ['Ладно, признаю: ты классный.', 'Если кто обидит — скажи мне. Я ему устрою!']],
  iruka: [['Ну что, {name}, домашнее задание сделал?', 'Не опаздывай на уроки!'], ['Ты делаешь успехи. Я горжусь тобой.', 'Если что-то непонятно — спрашивай после уроков.'], ['Кем бы ты ни был раньше, {name}, — сейчас я тобой горжусь.', 'Ты и Наруто... вы оба мне как младшие братья.']],
  lee: [['Сила юности! Ты тоже тренируешься?!', '500 отжиманий — это только разминка!'], ['Ты не сдаёшься! Это достойно уважения!', 'Гай-сенсей говорит: упорный труд побеждает гения!'], ['Ты — мой вечный соперник! Как Гай-сенсей и Какаши-сенсей!', 'Давай вместе станем великими шиноби!']],
};

G.friends = {
  // нужные для игры предметы нельзя подарить по ошибке
  KEY_ITEMS: ['parcel', 'fishing_rod', 'book_history', 'book_traps', 'map_secrets'],
  pts(id) { return G.state.vars['friend_' + id] || 0; },
  level(id) { return Math.min(5, Math.floor(this.pts(id) / 5)); },
  // Возвращает фактическую прибавку (с учётом «Обаяния» и нижней границы 0)
  add(id, n, why) {
    if (!G.FRIENDS[id] || !n) return 0;
    if (n > 0 && G.hero.has('charm')) n = Math.round(n * 1.25 * 10) / 10;
    const before = this.level(id), p0 = this.pts(id);
    G.state.vars['friend_' + id] = Math.max(0, Math.round((p0 + n) * 10) / 10);
    const after = this.level(id);
    if (after > before) {
      G.game.note(`Дружба с ${G.chars.nameOf(id)}: уровень ${after}`);
      const w = G.scenes.stack.find((s) => s.name === 'world'); w && w.showToast && w.showToast(`♥ ${G.chars.nameOf(id)}: дружба ${after}`);
    }
    // награды за ВСЕ достигнутые уровни, каждая — один раз (флаг frd_), даже если дружба потом падала и росла снова
    for (let l = 1; l <= after; l++) {
      const sc = 'fr_' + id + '_' + l, fl = 'frd_' + id + '_' + l;
      const queue = G.state.frQueue || (G.state.frQueue = []);
      if (G.script.library[sc] && !G.state.flags[fl] && !queue.includes(sc)) queue.push(sc);
    }
    return Math.round((this.pts(id) - p0) * 10) / 10;
  },
  gift(id, item) {
    const f = G.FRIENDS[id], bday = G.calendar && G.calendar.birthday() === id;
    let n = 1, react = 'Спасибо.';
    if (f.love.includes(item)) { n = 4; react = 'love'; } else if ((f.like || []).includes(item)) { n = 2; react = 'like'; } else if ((f.hate || []).includes(item)) { n = -1; react = 'hate'; } else react = 'ok';
    if (bday && n > 0) n *= 2;
    G.game.give(item, -1); n = this.add(id, n, 'gift'); G.state.daily['gift_' + id] = 1; G.events.emit('gift', id, item);
    return { react, n, bday };
  },
  // командный путь для эпилога
  team() {
    const sum = (ids) => ids.reduce((a, i) => a + this.pts(i), 0);
    const grp = { 7: ['naruto', 'sasuke', 'sakura'], 8: ['hinata', 'kiba', 'shino'], 10: ['shikamaru', 'choji', 'ino'] };
    // при равной сумме побеждает команда, где есть самый близкий друг; потом — порядок 7, 8, 10
    const best = (ids) => Math.max(...ids.map((i) => this.pts(i)));
    return Object.keys(grp).map(Number).sort((a, b) => (sum(grp[b]) - sum(grp[a])) || (best(grp[b]) - best(grp[a])))[0];
  },
  // меню общения: «Поговорить», «Подарить», «Тренироваться вместе», «Спарринг»
  menu(npc, world) {
    const id = npc.id, f = G.FRIENDS[id], d = G.state.daily || (G.state.daily = {}), name = G.chars.nameOf(id);
    const lvl = this.level(id);
    const gifts = Object.keys(G.state.inv).filter((k) => G.ITEMS[k] && !G.ITEMS[k].quest && !G.friends.KEY_ITEMS.includes(k) && G.state.inv[k] > 0 && ['gift', 'misc', 'tool', 'med', 'book', 'food'].includes(G.ITEMS[k].cat));
    const t = G.TRAININGS[f.train];
    const opts = [
      { label: 'Поговорить', act: 'talk' },
      { label: 'Подарить', sub: gifts.length ? '' : 'нечего', off: d['gift_' + id] ? 'Сегодня уже дарил' : !gifts.length ? 'Нечего дарить — загляни в лавки' : null, act: 'gift' },
      { label: 'Тренировка вместе', sub: '', off: !t ? 'Не тренируется' : d['trw_' + id] ? 'Сегодня уже тренировались' : G.game.vigor() < 15 ? 'Ты устал' : lvl < 1 && id !== 'iruka' ? 'Пока не доверяет (дружба 1)' : null, act: 'train', desc: 'Прогресс +50% и дружба.' },
    ];
    if (f.spar) opts.push({ label: 'Спарринг', off: d['spar_' + id] ? 'Сегодня уже был' : G.game.vigor() < 15 ? 'Ты устал' : null, act: 'spar', desc: 'Бой до 30% HP. Победа — уважение и опыт.' });
    opts.push({ label: 'Пока', act: 'bye' });
    G.scenes.push(G.scenes.make('pick', { title: name + '  ' + '♥'.repeat(lvl) + '·'.repeat(5 - lvl), options: opts }, (i) => {
      const a = i >= 0 ? opts[i].act : 'bye';
      if (a === 'talk') {
        const pool = G.FRIEND_LINES[id] ? G.FRIEND_LINES[id][lvl >= 4 ? 2 : lvl >= 2 ? 1 : 0] : ['...'];
        const line = pool[Math.floor(Math.random() * pool.length)];
        if (!d['talk_' + id]) { d['talk_' + id] = 1; this.add(id, 1, 'talk'); }
        if (npc.talk && typeof npc.talk === 'string' && !d['story_' + id] && G.script.library[npc.talk]) { d['story_' + id] = 1; world.talk(npc.talk); return; }
        const conversation=G.FRIEND_DIALOGUES?.[id]?.[lvl>=4?2:lvl>=2?1:0];
        if(conversation)world.talk(conversation.map((text,i)=>({who:i===1?'hero':id,text})));
        else world.talk([{ who: id, text: G.util.fmt(line, { name: G.state.hero.name }) }]);
      } else if (a === 'gift') {
        const gopts = gifts.map((k) => ({ label: G.ITEMS[k].name, sub: 'x' + G.state.inv[k], k }));
        G.scenes.push(G.scenes.make('pick', { title: 'Подарок для: ' + name, options: gopts }, (j) => {
          if (j < 0) return;
          const r = this.gift(id, gopts[j].k);
          const txt = { love: 'Это же... именно то, что я хотел(а)! Спасибо огромное!', like: 'О, здорово! Спасибо!', ok: 'Спасибо, приятно.', hate: 'Э-э... ну... спасибо, наверное.' }[r.react];
          world.talk([{ who: id, text: txt }, { text: `${r.bday ? 'День рождения — подарок ценится вдвойне! ' : ''}Дружба ${r.n > 0 ? '+' + r.n : r.n}.` }]);
        }));
      } else if (a === 'train') { G.train.start(f.train, world, { partner: id }); }
      else if (a === 'spar') {
        d['spar_' + id] = 1;
        G.flow.battle({ enemy: f.spar, mode: 'spar', terrain: 'field', onEnd: (res) => {
          this.add(id, 2, 'spar'); G.game.advance(40); G.game.tire(12);
          if (res.win) { G.state.vars['spwin_' + id] = (G.state.vars['spwin_' + id] || 0) + 1; G.state.vars.rep = (G.state.vars.rep || 0) + 1; }
          if (id === 'sasuke' && res.win) G.state.vars.rival = (G.state.vars.rival || 0) + 1;
          const l = G.ENEMIES[f.spar].lines; world.talk([{ who: id, text: G.util.fmt(res.win ? l.lose : l.win, { name: G.state.hero.name }) }]);
        } }, world);
      }
    }));
  },
};
