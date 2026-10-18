// Окно лавки (план §5.4): портрет и приветствие, список товаров, описание, количество, деньги.
// G.scenes.make('shop', shopId, { title, onClose(bought) })
G.scenes.register('shop', (shopId, opts = {}) => {
  const shop = G.SHOPS[shopId];
  // навык «Обаяние» — скидка 10%
  const items = shop.stock.map((id) => Object.assign({ id }, G.ITEMS[id], { price: Math.max(1, Math.round(G.ITEMS[id].price * G.hero.priceMul())) }));
  const keeperName = shop.keeper.name || G.chars.nameOf(shop.keeper.who);
  const title = opts.title || keeperName;
  const bought = [];
  let idx = 0, top = 0, qty = 1, msg = null, msgT = 0, msgErr = false;
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
      const hdr = { x: 2, y: 24, w: W - 4, h: 46 };
      const foot = { x: 2, y: H - 20, w: W - 4, h: 18 };
      const info = { x: 2, y: foot.y - 50, w: W - 4, h: 48 };
      const listY = hdr.y + hdr.h + 3;
      const rows = Math.max(3, Math.min(items.length, Math.floor((info.y - 3 - listY - 8) / 13)));
      const list = { x: 2, y: listY, w: W - 4, h: rows * 13 + 8, rows };
      return { hdr, list, info, foot };
    },

    update(dt) {
      const I = G.input;
      if (msgT > 0) { msgT -= dt; if (msgT <= 0) msg = null; }
      const L = this.layout();
      const n = items.length;
      if (I.repeat('up', dt)) { idx = (idx + n - 1) % n; qty = 1; G.audio.sfx.select(); }
      if (I.repeat('down', dt)) { idx = (idx + 1) % n; qty = 1; G.audio.sfx.select(); }
      const mq = maxQty(items[idx]);
      if (I.repeat('left', dt) && qty > 1) { qty--; G.audio.sfx.blip(); }
      if (I.repeat('right', dt) && qty < mq) { qty++; G.audio.sfx.blip(); }
      if (idx < top) top = idx;
      if (idx >= top + L.list.rows) top = idx - L.list.rows + 1;

      if (I.tapNow) {
        const t = I.tapNow;
        // строка списка
        if (t.y > L.list.y + 4 && t.y < L.list.y + L.list.h - 4) {
          const i = top + Math.floor((t.y - L.list.y - 4) / 13);
          if (i >= 0 && i < n) { if (i === idx) buy(); else { idx = i; qty = 1; G.audio.sfx.select(); } }
          return;
        }
        // стрелки количества
        const qy = L.info.y + 33;
        if (Math.abs(t.y - qy - 4) < 8) {
          if (t.x > 54 && t.x < 70 && qty > 1) { qty--; G.audio.sfx.blip(); return; }
          if (t.x > 84 && t.x < 100 && qty < mq) { qty++; G.audio.sfx.blip(); return; }
        }
        // кнопки внизу
        if (t.y > L.foot.y) { if (t.x < G.screen.W / 2) buy(); else close(); return; }
        return;
      }
      if (I.pressed('a')) buy();
      else if (I.pressed('b') || I.pressed('menu')) close();
    },

    draw(ctx) {
      const W = G.screen.W, F = G.font, pal = P();
      const L = this.layout();
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(0, 20, W, G.screen.H - 20); ctx.globalAlpha = 1;

      // шапка: портрет, имя, приветствие
      const h = L.hdr;
      G.gfx.window(ctx, h.x, h.y, h.w, h.h, 'paper');
      const who = shop.keeper.who;
      let tx = h.x + 7;
      if (G.chars.DEFS[who]) {
        ctx.fillStyle = G.UI.edge; ctx.fillRect(h.x + 5, h.y + 6, 34, 34);
        ctx.drawImage(G.chars.portrait(who), h.x + 6, h.y + 7);
        tx = h.x + 44;
      }
      F.draw(ctx, title, tx, h.y + 4, { color: pal.orange });
      const greet = F.wrap('«' + shop.greet + '»', h.w - (tx - h.x) - 6).slice(0, 3);
      greet.forEach((ln, i) => F.draw(ctx, ln, tx, h.y + 15 + i * 10, { color: G.UI.text }));

      // список
      const l = L.list;
      G.gfx.window(ctx, l.x, l.y, l.w, l.h, 'paper');
      for (let r = 0; r < l.rows; r++) {
        const i = top + r;
        if (i >= items.length) break;
        const it = items[i], y = l.y + 5 + r * 13, sel = i === idx, lk = locked(it);
        if (sel) { ctx.fillStyle = G.UI.sel; ctx.fillRect(l.x + 4, y - 2, l.w - 8, 12); F.draw(ctx, '▶', l.x + 6, y, { color: pal.orange }); }
        const col = lk ? G.UI.faint : sel ? G.UI.selText : G.UI.dim;
        F.draw(ctx, it.name, l.x + 15, y, { color: col });
        const price = lk ? '—' : it.price + ' рё';
        F.draw(ctx, price, l.x + l.w - 7, y, { align: 'right', color: lk ? '#b0a690' : !G.game.canPay(it.price) ? G.UI.err : col });
      }
      if (top > 0) F.draw(ctx, '▲', l.x + l.w / 2, l.y - 1, { align: 'center', color: pal.orange });
      if (top + l.rows < items.length) F.draw(ctx, '▼', l.x + l.w / 2, l.y + l.h - 9, { align: 'center', color: pal.orange });

      // описание и количество
      const inf = L.info, it = items[idx];
      G.gfx.window(ctx, inf.x, inf.y, inf.w, inf.h, 'paper');
      if (msg) {
        F.wrap(msg, inf.w - 12).slice(0, 2).forEach((ln, i) => F.draw(ctx, ln, inf.x + 6, inf.y + 5 + i * 11, { color: msgErr ? G.UI.err : G.UI.ok }));
      } else {
        F.wrap(it.desc || '', inf.w - 12).slice(0, 2).forEach((ln, i) => F.draw(ctx, ln, inf.x + 6, inf.y + 5 + i * 11, { color: G.UI.text }));
      }
      const qy = inf.y + 33;
      if (it.cat === 'food' || it.cat === 'service') {
        const v = G.state.vars;
        F.draw(ctx, it.cat === 'food' ? `Сытость: ${Math.round(v.food)}/100` : `Энергия: ${Math.round(v.energy)}/100`, inf.x + 6, qy, { color: pal.gray });
      } else {
        F.draw(ctx, 'Кол-во:', inf.x + 6, qy, { color: pal.gray });
        F.draw(ctx, '<', 60, qy, { color: qty > 1 ? pal.orange : '#c8bca0' });
        F.draw(ctx, String(qty), 77, qy, { align: 'center', color: pal.ink });
        F.draw(ctx, '>', 90, qy, { color: qty < maxQty(it) ? pal.orange : '#c8bca0' });
        F.draw(ctx, '= ' + it.price * qty + ' рё', 102, qy, { color: pal.ink });
        const side = it.pouch ? `${G.game.pouchUsed()}/${G.game.pouchMax()}` : `есть ${G.game.count(it.id)}`;
        F.draw(ctx, side, inf.x + inf.w - 6, qy, { align: 'right', color: pal.gray });
      }

      // подвал
      const f = L.foot;
      G.gfx.window(ctx, f.x, f.y, f.w, f.h, 'dark');
      F.draw(ctx, '(A) Купить', f.x + 6, f.y + 5, { color: pal.white });
      F.draw(ctx, '(B) Выйти', f.x + 70, f.y + 5, { color: pal.light });
      F.draw(ctx, G.state.vars.money + ' рё', f.x + f.w - 6, f.y + 5, { align: 'right', color: pal.yellow });
    },
  };
  return S;
});
