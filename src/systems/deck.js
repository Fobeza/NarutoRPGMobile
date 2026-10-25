// Колода героя: какие карты он берёт в бой.
// Раньше колода собиралась сама (12 базовых карт + по копии каждой техники), и выбирать было нечего.
// Теперь у героя есть свои карты (G.state.cardOwned) и колода из них (G.state.deck): 10–20 карт, до трёх копий.
// Карты техник и предметы в колоду не входят — техники добавляются сами, когда герой их выучил.
// Правила боя — systems/duel.js, экран — scenes/deckview.js.
G.deck = (() => {
  const MIN = 10, MAX = 20, MAX_COPIES = 3;
  const st = () => G.state;
  const editable = (id) => { const d = G.CARDS[id]; return !!d && !d.tech && !d.item; };

  // Свои карты: базовая колода (12 карт, включая вторые копии) считается уже выданной.
  function defaultOwn() { const own = {}; for (const id of G.CARD_BASE_DECK) own[id] = (own[id] || 0) + 1; return own; }

  // Привести состояние колоды к допустимому: неизвестные карты убрать, размер — в 10–20, копии — не больше трёх.
  function ensure(state) {
    const s = state || st();
    if (!s) return null;
    if (!s.cardOwned || typeof s.cardOwned !== 'object') s.cardOwned = defaultOwn();
    const own = {};
    for (const [id, n] of Object.entries(s.cardOwned)) {
      if (!editable(id)) continue;
      const k = Math.max(0, Math.min(MAX_COPIES, Math.floor(Number(n) || 0)));
      if (k) own[id] = k;
    }
    s.cardOwned = own;
    if (!Array.isArray(s.deck)) s.deck = G.CARD_BASE_DECK.slice();
    s.deck = s.deck.filter((id) => own[id]);
    // добрать до минимума из своих карт
    for (const id of Object.keys(own)) {
      const have = s.deck.filter((x) => x === id).length;
      for (let k = have; k < own[id] && s.deck.length < MIN; k++) s.deck.push(id);
      if (s.deck.length >= MIN) break;
    }
    if (s.deck.length > MAX) s.deck.length = MAX;
    return s;
  }

  const own = (id) => { ensure(); return st().cardOwned[id] || 0; };
  const count = (id) => { ensure(); return st().deck.filter((x) => x === id).length; };
  const size = () => { ensure(); return st().deck.length; };
  const canAdd = (id) => editable(id) && count(id) < own(id) && count(id) < MAX_COPIES && size() < MAX;
  const canRemove = (id) => count(id) > 0 && size() > MIN;

  function add(id) { if (!canAdd(id)) return false; st().deck.push(id); G.events.emit('deck', id); return true; }
  function remove(id) { if (!canRemove(id)) return false; const d = st().deck, i = d.lastIndexOf(id); if (i < 0) return false; d.splice(i, 1); G.events.emit('deck', id); return true; }

  // Выдать карту навсегда: +1 копия, и сразу в колоду, если есть место.
  function give(id, n = 1) {
    ensure();
    const s = st();
    if (!editable(id)) return 0;
    const was = s.cardOwned[id] || 0;
    s.cardOwned[id] = Math.min(MAX_COPIES, was + n);
    const got = s.cardOwned[id] - was;
    for (let i = 0; i < got && s.deck.length < MAX; i++) s.deck.push(id);
    if (got) G.events.emit('deck', id);
    return got;
  }

  // Колода для боя: свои карты + по копии каждой выученной техники (техника появляется сама).
  function full(state) {
    const s = ensure(state);
    if (!s) return G.CARD_BASE_DECK.slice();
    const ids = s.deck.slice();
    for (const id of Object.keys(G.TECHS)) if (G.combat.knows(id)) for (let i = 0; i < G.CARD_TECH_LIMIT; i++) ids.push(id);
    return ids.filter((id) => G.CARDS[id]);
  }

  // Карты, которые можно получить за победу: те, которых у героя меньше трёх копий.
  function pool() {
    ensure();
    return Object.keys(G.CARDS).filter((id) => editable(id) && (st().cardOwned[id] || 0) < MAX_COPIES);
  }

  // Награда за выигранный спарринг: выбор одной карты из двух (награда не навязывается — можно отказаться).
  function reward(world, n = 2) {
    const ids = pool();
    if (!ids.length || !world || !G.scenes) return null;
    const options = [];
    while (options.length < n && ids.length) options.push(ids.splice(Math.floor(Math.random() * ids.length), 1)[0]);
    const opts = options.map((id) => ({ label: G.CARDS[id].name, sub: `${count(id)}/${own(id)}`, desc: G.CARDS[id].text, id }));
    opts.push({ label: 'Не нужно', desc: 'Оставить колоду как есть' });
    G.scenes.push(G.scenes.make('pick', { title: 'Карта в колоду', text: 'Победа в спарринге: возьми одну карту.', options: opts }, (i) => {
      if (i < 0 || i >= options.length) return;
      const id = options[i];
      if (!give(id, 1)) { G.audio.sfx.error(); return; }
      G.audio.sfx.confirm();
      G.game.note('Карта в колоду: ' + G.CARDS[id].name);
      world.talk([{ text: `В колоде новая карта: ${G.CARDS[id].name} (${count(id)}/${own(id)}).` }]);
    }));
    return options;
  }

  // Список для экрана «Колода»: в колоде / есть всего, по видам карт.
  function list() {
    ensure();
    const s = st();
    return Object.keys(s.cardOwned)
      .filter((id) => G.CARDS[id])
      .sort((a, b) => (G.CARDS[a].kind === G.CARDS[b].kind ? G.CARDS[a].name.localeCompare(G.CARDS[b].name) : G.CARDS[a].kind.localeCompare(G.CARDS[b].kind)))
      .map((id) => ({ id, name: G.CARDS[id].name, kind: G.CARDS[id].kind, inDeck: count(id), owned: own(id) }));
  }
  // Карты техник: они в колоде автоматически и не редактируются — показываем их отдельной строкой
  const techs = () => Object.keys(G.TECHS).filter((id) => G.combat.knows(id)).map((id) => G.CARDS[id].name);

  // Для старых сохранений и новых игр
  function reset() { const s = st(); s.cardOwned = defaultOwn(); s.deck = G.CARD_BASE_DECK.slice(); return s; }

  return { MIN, MAX, MAX_COPIES, ensure, reset, own, count, size, canAdd, canRemove, add, remove, give, full, pool, reward, list, techs };
})();
