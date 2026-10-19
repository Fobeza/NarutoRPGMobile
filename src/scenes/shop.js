// Окно лавки (план §5.4): портрет и приветствие, список товаров, описание, количество, деньги.
// G.scenes.make('shop', shopId, { title, onClose(bought) })
G.scenes.register('shop', (shopId, opts = {}) => {
  const shop = G.SHOPS[shopId];
  // навык «Обаяние» — скидка 10%
  const items = shop.stock.map((id) => Object.assign({ id }, G.ITEMS[id], { price: Math.max(1, Math.round(G.ITEMS[id].price * G.hero.priceMul())) }));
  const keeperName = shop.keeper.name || G.chars.nameOf(shop.keeper.who);
  const title = opts.title || keeperName;
  const bought = [];
  let idx = 0, qty = 1, msg = null, msgT = 0, msgErr = false, qmode = false;
  const P = () => G.PAL;

  const locked = (it) => it.week && G.game.week() < it.week;
  const maxQty = (it) => {
    if (it.cat === 'food' || it.cat === 'service') return 1;
    let n = Math.floor(G.state.vars.money / it.price);
    if (it.pouch) n = Math.min(n, G.game.pouchMax() - G.game.pouchUsed());
    return G.util.clamp(n, 1, 20);
  };

  function say(text, err) { msg = text; msgT = 1.8; msgErr = !!err; }

  function buy() {
    const it = items[idx];
    const g = G.game;
    if (locked(it)) { G.audio.sfx.error(); say(`Продаётся с ${it.week}-й недели.`, true); return; }
    const total = it.price * qty;
    if (!g.canPay(total)) { G.audio.sfx.error(); say('Не хватает рё!', true); return; }
    if (it.pouch && g.pouchUsed() + qty > g.pouchMax()) { G.audio.sfx.error(); say('Подсумок полон!', true); return; }
    if (it.cat === 'food' && it.effect.food && G.state.vars.food >= 95) { G.audio.sfx.error(); say('Ты уже сыт. Больше не влезет.', true); return; }
    g.pay(total);
    if (it.cat === 'food' || it.cat === 'service') {
      const e = it.effect || {};
      if (e.food) g.eat(e.food);
      if (e.energy) g.rest(e.energy);
      if (e.mood) g.mood(e.mood);
      if (e.minutes) g.advance(e.minutes);
      G.audio.sfx.confirm();
      say(it.cat === 'food' ? `Ты съел: ${it.name}. Вкуснотища!` : `${it.name} — готово. Силы вернулись!`);
    } else {
      g.give(it.id, qty);
      G.audio.sfx.confirm();
      say(`Куплено: ${it.name}${qty > 1 ? ' ×' + qty : ''}`);
    }
    bought.push({ id: it.id, qty });
    qty = 1;
  }

  function close() {
    G.audio.sfx.cancel();
    G.scenes.pop();
    opts.onClose && opts.onClose(bought);
  }

  const S = {
    name: 'shop',
    transparent: true,

    layout() {
      const W = G.screen.W, H = G.screen.H;
      const hdr = { x: 4, y: 4, w: W - 8, h: 58 };
      const foot = { x: 4, y: H - 30, w: W - 8, h: 26 };
      const info = { x: 4, y: foot.y - 74, w: W - 8, h: 70 };
      const cols = Math.max(2, Math.floor((W - 22) / 62)), cardW = Math.floor((W - 8 - 12) / cols), cardH = 56;
      const listY = hdr.y + hdr.h + 4;
      const rows = Math.max(1, Math.floor((info.y - 4 - listY - 12) / cardH));
      const list = { x: 4, y: listY, w: W - 8, h: rows * cardH + 12, rows, cols, cardW, cardH, per: rows * cols };
      const bw = Math.round((foot.w - 6) / 2);
      const buyB = { x: foot.x, y: foot.y, w: bw, h: foot.h }, exitB = { x: foot.x + bw + 6, y: foot.y, w: bw, h: foot.h };
      const minus = { x: info.x + 12, y: info.y + info.h - 28, w: 22, h: 20 }, plus = { x: info.x + 72, y: info.y + info.h - 28, w: 22, h: 20 };
      return { hdr, list, info, foot, buyB, exitB, minus, plus };
    },

    update(dt) {
      const I = G.input;
      if (msgT > 0) { msgT -= dt; if (msgT <= 0) msg = null; }
      const L = this.layout();
      const n = items.length, g = L.list;
      const mq = maxQty(items[idx]);
      if (qmode) {
        if (I.repeat('left', dt) && qty > 1) { qty--; G.audio.sfx.blip(); }
        if (I.repeat('right', dt) && qty < mq) { qty++; G.audio.sfx.blip(); }
      } else {
        if (I.repeat('up', dt)) { idx = (idx - g.cols + n) % n; qty = 1; G.audio.sfx.select(); }
        if (I.repeat('down', dt)) { idx = (idx + g.cols) % n; qty = 1; G.audio.sfx.select(); }
        if (I.repeat('left', dt)) { idx = (idx + n - 1) % n; qty = 1; G.audio.sfx.select(); }
        if (I.repeat('right', dt)) { idx = (idx + 1) % n; qty = 1; G.audio.sfx.select(); }
      }
      const inR = (t, r) => t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.h;
      const pageBtn = (d) => ({ x: g.x + g.w - (d > 0 ? 24 : 62), y: g.y + g.h - 13, w: 22, h: 12 });
      const pages = Math.ceil(n / g.per), pg = Math.floor(idx / g.per);

      if (I.tapNow) {
        const t = I.tapNow;
        // кнопки страниц ◀ ▶ под сеткой (без них товары на дальних страницах недоступны пальцем)
        if (pages > 1) for (const d of [-1, 1]) if (inR(t, pageBtn(d))) { const np = (pg + d + pages) % pages; idx = Math.min(n - 1, np * g.per); qty = 1; qmode = false; G.audio.sfx.select(); return; }
        // карточка в сетке
        if (t.y > g.y + 6 && t.y < g.y + g.h - 6 && t.x > g.x && t.x < g.x + g.w) {
          const page = Math.floor(idx / g.per) * g.per;
          const k = Math.floor((t.y - g.y - 6) / g.cardH) * g.cols + Math.floor((t.x - g.x - 6) / g.cardW);
          const i = page + k;
          if (i >= 0 && i < n && (i !== idx || qmode)) { idx = i; qty = 1; qmode = false; G.audio.sfx.select(); }
          return;
        }
        if (items[idx].cat !== 'food' && items[idx].cat !== 'service') {
          if (inR(t, L.minus) && qty > 1) { qty--; G.audio.sfx.blip(); return; }
          if (inR(t, L.plus) && qty < mq) { qty++; G.audio.sfx.blip(); return; }
        }
        if (inR(t, L.buyB)) { buy(); return; }
        if (inR(t, L.exitB)) { close(); return; }
        return;
      }
      if (I.pressed('a')) { if (qmode) { buy(); qmode = false; } else { qmode = true; G.audio.sfx.select(); } }
      else if (I.pressed('b') || I.pressed('menu')) { if (qmode) qmode = false; else close(); }
    },

    draw(ctx) {
      const W = G.screen.W, H = G.screen.H, F = G.font, U = G.ui, C = U.C;
      const L = this.layout();
      U.backdrop(ctx);

      // шапка: портрет в деревянной рамке, имя и приветствие
      const h = L.hdr;
      U.panel(ctx, h.x, h.y, h.w, h.h, 'frame');
      const who = shop.keeper.who;
      let tx = h.x + 12;
      if (G.chars.DEFS[who]) {
        U.panel(ctx, h.x + 8, h.y + 8, 42, 42, 'plank');
        ctx.fillStyle = '#120a05'; ctx.fillRect(h.x + 10, h.y + 10, 38, 38);
        ctx.drawImage(G.chars.portrait(who), h.x + 13, h.y + 13);
        tx = h.x + 58;
      }
      F.draw(ctx, title, tx, h.y + 10, { color: C.redDark, maxW: h.w - (tx - h.x) - 8 });
      F.small.wrap('«' + shop.greet + '»', h.w - (tx - h.x) - 10).slice(0, 3).forEach((ln, i) => F.small.draw(ctx, ln, tx, h.y + 25 + i * 11, { color: C.ink }));

      // список — сетка карточек с иконками
      const l = L.list;
      U.panel(ctx, l.x, l.y, l.w, l.h, 'well');
      const page = Math.floor(idx / l.per) * l.per;
      for (let k = 0; k < l.per; k++) {
        const i = page + k;
        if (i >= items.length) break;
        const it = items[i], lk = locked(it);
        const cx = l.x + 6 + (k % l.cols) * l.cardW, cy = l.y + 6 + Math.floor(k / l.cols) * l.cardH;
        U.card(ctx, cx, cy, l.cardW - 3, l.cardH - 3, i === idx);
        G.icons.draw(ctx, it.id, cx + Math.floor((l.cardW - 3 - 48) / 2), cy + 1, 48, 48);
        if (lk) { ctx.globalAlpha = .5; ctx.fillStyle = '#2a1e14'; ctx.fillRect(cx + 2, cy + 2, l.cardW - 7, l.cardH - 7); ctx.globalAlpha = 1; }
        F.small.draw(ctx, lk ? '—' : it.price + 'р', cx + l.cardW - 7, cy + l.cardH - 17,
          { align: 'right', color: lk ? '#9c8662' : !G.game.canPay(it.price) ? '#ff9a7a' : '#f4d46a', outline: C.woodEdge });
      }
      const pages = Math.ceil(items.length / l.per);
      if (pages > 1) {
        const pb = (d) => ({ x: l.x + l.w - (d > 0 ? 24 : 62), y: l.y + l.h - 13, w: 22, h: 12 });
        U.button(ctx, pb(-1).x, pb(-1).y, 22, 12, '<', 'normal'); U.button(ctx, pb(1).x, pb(1).y, 22, 12, '>', 'normal');
        F.small.draw(ctx, `${Math.floor(idx / l.per) + 1}/${pages}`, l.x + l.w - 66, l.y + l.h - 11, { align: 'right', color: C.red });
      }

      // описание, количество, деньги
      const inf = L.info, it = items[idx];
      U.panel(ctx, inf.x, inf.y, inf.w, inf.h, 'frame');
      // название выбранного товара — до покупки (B24)
      F.small.draw(ctx, it.name, inf.x + 12, inf.y + 8, { color: C.redDark, maxW: inf.w - 110 });
      const textLines = F.small.wrap(msg || it.desc || '', inf.w - 24).slice(0, 2);
      textLines.forEach((ln, i) => F.small.draw(ctx, ln, inf.x + 12, inf.y + 20 + i * 11, { color: msg ? (msgErr ? C.err : C.ok) : C.ink }));
      const qy = inf.y + inf.h - 24;
      if (it.cat === 'food' || it.cat === 'service') {
        const v = G.state.vars;
        F.small.draw(ctx, it.cat === 'food' ? `Сытость: ${Math.round(v.food)}/100` : `Энергия: ${Math.round(v.energy)}/100`, inf.x + 12, qy + 4, { color: C.inkDim });
        F.draw(ctx, it.price + ' рё', inf.x + inf.w - 12, qy + 3, { align: 'right', color: '#8a5a10' });
      } else {
        U.button(ctx, L.minus.x, L.minus.y, L.minus.w, L.minus.h, '−', qty > 1 ? (qmode ? 'sel' : 'normal') : 'dis');
        F.draw(ctx, String(qty), (L.minus.x + L.plus.x + L.plus.w) / 2 + 0.5, L.minus.y + 6, { align: 'center', color: C.ink });
        U.button(ctx, L.plus.x, L.plus.y, L.plus.w, L.plus.h, '+', qty < maxQty(it) ? (qmode ? 'sel' : 'normal') : 'dis');
        F.draw(ctx, '= ' + it.price * qty + ' рё', L.plus.x + L.plus.w + 12, L.minus.y + 6, { color: '#8a5a10' });
        const side = it.pouch ? `подсумок ${G.game.pouchUsed()}/${G.game.pouchMax()}` : `есть ${G.game.count(it.id)}`;
        F.small.draw(ctx, side, inf.x + inf.w - 12, inf.y + 8, { align: 'right', color: C.inkDim });
      }

      // кнопки внизу + деньги
      U.button(ctx, L.buyB.x, L.buyB.y, L.buyB.w, L.buyB.h, it.cat === 'food' || it.cat === 'service' ? 'Взять' : 'Купить', qmode ? 'on' : 'sel');
      U.button(ctx, L.exitB.x, L.exitB.y, L.exitB.w, L.exitB.h, 'Выйти', 'normal');
      F.draw(ctx, G.state.vars.money + ' рё', h.x + h.w - 12, h.y + 10, { align: 'right', color: '#8a5a10' });
    },
  };
  return S;
});
