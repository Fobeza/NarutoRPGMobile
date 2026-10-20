// Рыбалка, сбор трав, сундук-хранилище дома, продажа улова и трав, травничество.
G.outdoor = {
  // кусты трав (клетки карты; freeTile найдёт ближайшее свободное место)
  HERBS: [[28, 27], [46, 40], [19, 47], [9, 66], [8, 90], [22, 104], [30, 118], [118, 116], [131, 114], [60, 121], [92, 119], [96, 24], [88, 28], [150, 64], [140, 90], [56, 30]],
  LOTUS: [[145, 97], [136, 101], [154, 101]],
  REGROW: 3,      // дней до нового урожая
  FISH_DAY: 6,    // забросов в день
  SELL: 0.5,      // доля цены при продаже

  addHerbs(m) {
    const T = G.CONFIG.TILE;
    const put = (list, rare, base) => list.forEach(([tx, ty], k) => {
      const p = G.world.freeTile(m, tx, ty, true); if (!p) return;
      const i = base + k;
      const o = m.addObject(rare ? 'herb_blue' : 'herb', p[0] * T + 8, p[1] * T + 13, { talk: 'herb_' + i });
      o.herb = i; o.rare = rare;
    });
    const AN = G.KONOHA_DRAFT.anchors || {};
    put(AN.herbs || this.HERBS, false, 0); put(AN.lotus || this.LOTUS, true, 100);
    this.refresh(m);
  },
  ready(i) { const d = G.state.vars['herb_' + i]; return !d || G.state.vars.day - d >= this.REGROW; },
  refresh(m) {
    if (!m) return;
    for (const o of m.objects) if (o.herb != null) o.img = G.tiles.object(this.ready(o.herb) ? (o.rare ? 'herb_blue' : 'herb') : 'herb_cut').img;
  },
  pick(i, world) {
    const v = G.state.vars, rare = i >= 100;
    if (!this.ready(i)) return world.talk([{ text: `Здесь всё уже собрано. Трава отрастёт через ${this.REGROW - (v.day - v['herb_' + i])} дн.` }]);
    v['herb_' + i] = v.day; v.herbs = (v.herbs || 0) + 1;
    const got = [];
    if (rare) { G.game.give('herb_blue', 1); got.push('Голубой лотос'); }
    else {
      const n = 1 + (Math.random() < 0.45 ? 1 : 0) + (G.hero.has('eagle_eye') && Math.random() < 0.35 ? 1 : 0);
      G.game.give('herb', n); got.push('Лечебная трава ×' + n);
      if (Math.random() < 0.3) { G.game.give('berries', 2); got.push('ягоды ×2'); }
    }
    G.game.advance(5); G.train.addXp('know', 0.6);
    G.audio.sfx.confirm();
    this.refresh(G.world.get('konoha'));
    world.talk([{ text: (rare ? 'Ты осторожно срываешь цветок у самой воды. ' : 'Ты собираешь травы. ') + 'Получено: ' + got.join(', ') + '.' }]);
  },

  // ── рыбалка ──
  isWater(m, x, y) { const T = G.CONFIG.TILE; return m.outdoor && m.get(Math.floor(x / T), Math.floor(y / T)) === G.tiles.ID.WATER; },
  spotKind(m, x, y) {
    const T = G.CONFIG.TILE, d = m.districtAt(Math.floor(x / T), Math.floor(y / T));
    if (d && /lake|озер/i.test((d.type || '') + (d.name || ''))) return 'lake';
    const lakes = (G.KONOHA_DRAFT.shape && G.KONOHA_DRAFT.shape.lakes) || [{ cx: 142, cy: 100, rx: 14, ry: 14 }];
    return lakes.some((l) => Math.hypot((x / T - l.cx) / (l.rx + 3), (y / T - l.cy) / (l.ry + 3)) < 1) ? 'lake' : 'river';
  },
  TABLE: {
    lake:  [['fish', 58], ['eel', 12], ['carp', 7], ['boot', 18], ['herb_blue', 5]],
    river: [['fish', 55], ['eel', 18], ['carp', 4], ['boot', 23]],
  },
  STRENGTH: { fish: 1, eel: 1.35, carp: 1.8, boot: 0.5, herb_blue: 0.6 },
  rollCatch(spot) {
    const t = G.state.vars.min % 1440, dusk = (t >= 5 * 60 && t < 8 * 60) || (t >= 17 * 60 && t < 20 * 60);
    const tab = this.TABLE[spot].map(([id, w]) => [id, (id === 'carp' || id === 'eel') && dusk ? w * 2 : id === 'fish' && G.life.raining() ? w * 1.3 : w]);
    let r = Math.random() * tab.reduce((a, x) => a + x[1], 0);
    for (const [id, w] of tab) { r -= w; if (r <= 0) return id; }
    return 'fish';
  },
  fish(world, spot) {
    const v = G.state.vars, d = G.state.daily;
    if (!G.game.count('fishing_rod')) return world.talk([{ text: 'Вода прозрачная, видно рыбу. Была бы удочка... (сувенирная лавка, 80 рё)' }]);
    if ((d.fish || 0) >= this.FISH_DAY) return world.talk([{ text: 'Рыба больше не клюёт. Приходи завтра.' }]);
    if (v.energy < 5) return world.talk([{ text: 'Ты слишком устал даже для рыбалки.' }]);
    G.scenes.push(G.scenes.make('fishing', { spot, left: () => this.FISH_DAY - (G.state.daily.fish || 0) }, (id) => {
      d.fish = (d.fish || 0) + 1; G.game.advance(20); v.energy = Math.max(0, v.energy - 3);
      if (id) { G.game.give(id, 1); v.fished = (v.fished || 0) + 1; if (id === 'carp') G.game.note('Поймал золотого карпа!'); G.train.addXp('ctrl', 0.5); }
    }, () => { world.softRefresh && world.softRefresh(); }));
  },

  // ── продажа ──
  sellPrice(id) { return Math.max(1, Math.round(G.ITEMS[id].price * this.SELL)); },
  sellMenu(n, world, done) {
    const shop = G.SHOPS[n.shop];
    const ids = shop.buys.filter((id) => G.game.count(id) > 0);
    if (!ids.length) { world.talk([{ who: shop.keeper.who, name: shop.keeper.name, text: 'Мне нечего у тебя купить.' }]); return; }
    const opts = ids.map((id) => ({ label: G.ITEMS[id].name, sub: `x${G.game.count(id)} · ${this.sellPrice(id)} рё`, desc: 'A — продать одну штуку.', id }));
    G.scenes.push(G.scenes.make('pick', { title: 'Продать: ' + (n.name || G.chars.nameOf(n.id)), text: `У тебя ${G.state.vars.money} рё`, options: opts }, (i) => {
      if (i < 0) return done && done();
      const id = opts[i].id, pr = this.sellPrice(id);
      G.game.give(id, -1); G.game.earn(pr); G.audio.sfx.confirm();
      G.events.emit('sold', id);
      this.sellMenu(n, world, done);
    }));
  },

  // ── сундук ──
  chest() { return G.state.chest || (G.state.chest = {}); },
  chestMenu(world) {
    const opts = [{ label: 'Хранилище', desc: 'Сложить вещи из сумки или забрать.' }, { label: 'Мамины письма', desc: 'Самое дорогое, что осталось.' }, { label: 'Закрыть' }];
    G.scenes.push(G.scenes.make('pick', { title: 'Сундук', options: opts }, (i) => {
      if (i === 0) G.scenes.push(G.scenes.make('storage'));
      else if (i === 1) world.talk([{ text: '«Мой маленький шиноби. Когда ты прочтёшь это, ты уже будешь в Академии...»' }, { text: 'Ты аккуратно складываешь письмо обратно, рядом с папиным протектором.' }]);
    }));
  },

  // ── травничество (стол дома) ──
  RECIPES: [
    { id: 'ointment', label: 'Мазь', need: { herb: 3 }, min: 30 },
    { id: 'herb_tea', label: 'Травяной чай', need: { herb: 2 }, min: 20 },
    { id: 'chakra_pill', label: 'Пилюля чакры', need: { herb: 2, herb_blue: 1 }, min: 45 },
    { id: 'bandage', label: 'Бинты с травой ×2', n: 2, need: { herb: 1 }, min: 15 },
  ],
  craftMenu(world) {
    const opts = this.RECIPES.map((r) => {
      const miss = Object.entries(r.need).filter(([k, n]) => G.game.count(k) < n);
      return { label: r.label, sub: r.min + ' мин', desc: 'Нужно: ' + Object.entries(r.need).map(([k, n]) => `${G.ITEMS[k].name} ×${n}`).join(', '), off: miss.length ? 'Не хватает: ' + miss.map(([k, n]) => `${G.ITEMS[k].name} (${G.game.count(k)}/${n})`).join(', ') : null };
    });
    G.scenes.push(G.scenes.make('pick', { title: 'Травничество', text: 'Травы растут в лесу Нара, у водопада, озера и на окраинах.', options: opts }, (i) => {
      if (i < 0) return;
      const r = this.RECIPES[i];
      for (const [k, n] of Object.entries(r.need)) G.game.give(k, -n);
      G.game.give(r.id, r.n || 1); G.game.advance(r.min); G.train.addXp('know', 1.5);
      G.events.emit('crafted', r.id);
      G.audio.sfx.confirm();
      world.talk([{ text: `Готово: ${G.ITEMS[r.id].name}${r.n ? ' ×' + r.n : ''}.` }]);
    }));
  },
};

// Скрипты для трав
(() => {
  let src = '';
  for (let i = 0; i < 16; i++) src += `=== herb_${i}\ncall herb ${i}\nend\n`;
  for (let i = 100; i < 103; i++) src += `=== herb_${i}\ncall herb ${i}\nend\n`;
  src += `=== home_chest\ncall chest\nend\n`;
  G.script.parse(src);
})();
Object.assign(G.script.actions, {
  herb: (a) => { G.game.pending = { type: 'herb', i: Number(a[0]) }; },
  chest: () => { G.game.pending = { type: 'chest' }; },
});
Object.assign(G.flow, {
  herb: (a, w) => G.outdoor.pick(a.i, w),
  chest: (a, w) => G.outdoor.chestMenu(w),
});
G.events.on('day', () => { const w = G.scenes.stack.find((s) => s.name === 'world'); if (w) G.outdoor.refresh(G.world.get('konoha')); });
