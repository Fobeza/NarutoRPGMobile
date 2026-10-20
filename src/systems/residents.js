// Постоянные жители, жильё и ежедневные перемещения. Спрайт id и личность uid разделены:
// два жителя с одинаковой картинкой остаются разными людьми со своими домами.
G.residents = (() => {
  const T = 16, people = new Map();
  let village = null, building = false, syncedAt = '';
  const families = {
    naruto: 'naruto_flat', sasuke: 'sasuke_home', fugaku: 'sasuke_home', mikoto: 'sasuke_home', itachi: 'sasuke_home',
    hinata: 'clan_hyuga', hanabi: 'clan_hyuga', neji: 'clan_hyuga', shikamaru: 'clan_nara', shikaku: 'clan_nara',
    ino: 'clan_yamanaka', inoichi: 'clan_yamanaka', choji: 'clan_akimichi', choza: 'clan_akimichi',
    kiba: 'clan_inuzuka', akamaru: 'clan_inuzuka', shino: 'clan_aburame', hokage: 'clan_sarutobi', konohamaru: 'clan_sarutobi',
  };
  const names = ['Хару', 'Рэн', 'Аки', 'Юки', 'Нао', 'Сора', 'Мэй', 'Кэн', 'Рика', 'Тацу', 'Суми', 'Юна', 'Рё', 'Кай', 'Мина', 'Томо'];
  const surnames = ['Аоки', 'Мори', 'Като', 'Оно', 'Сато', 'Хаяси', 'Танака', 'Симада', 'Исида', 'Фудзи', 'Мацуда', 'Сава', 'Такада', 'Уэда', 'Кондо', 'Хосино', 'Накамура', 'Судзуки', 'Ямада', 'Сайто', 'Ито', 'Сугияма', 'Окада', 'Фукуда', 'Миура', 'Кимура', 'Хасимото', 'Кобаяси', 'Эндо', 'Мураками', 'Огава', 'Икэда'];
  const canonical = (n) => !!(G.SCHED[n.id] || G.FRIENDS[n.id] || ['teuchi', 'ayame', 'hokage', 'konohamaru', 'tora'].includes(n.id));
  const homeBuilding = (b) => b.interior && (b.tplDef.cat === 'house' || /^(clan_|sasuke_home|uchiha_house|uchiha_small)/.test(b.tplId));
  const keyFor = (map, n, i) => canonical(n) ? n.id : map.id + ':' + i;
  const title = (r) => r.name || G.chars.nameOf(r.id);

  function roomPoint(m, reserved = []) {
    const grid = G.nav.walkGrid(m), start = Math.floor(m.spawn.y / T) * m.w + Math.floor(m.spawn.x / T);
    const seen = new Set([start]), queue = [start], candidates = [];
    for (let i = 0; i < queue.length; i++) {
      const cell = queue[i], x = cell % m.w, y = Math.floor(cell / m.w);
      if (y >= 3 && y < m.h - 2 && x > 1 && x < m.w - 2 && !reserved.some((n) => Math.hypot(n.x - (x * T + 8), n.y - (y * T + 12)) < 18)) candidates.push({ x: x * T + 8, y: y * T + 12 });
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = ny * m.w + nx;
        if (nx >= 0 && ny >= 0 && nx < m.w && ny < m.h && grid[k] && !seen.has(k)) { seen.add(k); queue.push(k); }
      }
    }
    return candidates[Math.floor(candidates.length / 2)] || { x: m.spawn.x, y: m.spawn.y - 16 };
  }

  function attach(r, m, n, point) {
    n.uid = r.uid; n.homeId = r.home.interior.id; n.residentMap = m.id;
    n._look = (r.id === 'villager_m' || r.id === 'villager_f') ? r.serial % G.chars.LOOKS : 0;
    const rep = { map: m, actor: n, x: point ? point.x : n.x, y: point ? point.y : n.y };
    r.reps.push(rep);
    return rep;
  }

  function init(k) {
    if (village === k || building) return;
    village = k; building = true; people.clear();
    syncedAt = '';
    try {
      const houses = k.buildings.filter(homeBuilding);
      for (const b of k.buildings) b.residents = [];
      // Интерьеры небольшие; заранее строим население, но чанки пола запекаются лишь при посещении.
      const maps = [k, ...k.buildings.filter((b) => b.interior).map((b) => G.world.get(b.interior.id))];
      let serial = 0;
      for (const m of maps) m.npcs.forEach((n, i) => {
        const uid = keyFor(m, n, i);
        let r = people.get(uid);
        if (!r) {
          r = { uid, id: n.id, name: canonical(n) ? G.chars.nameOf(n.id) : `${names[serial % names.length]} ${surnames[Math.floor(serial / names.length) % surnames.length]}`, reps: [], origin: n, serial: serial++, home: null, active: null };
          people.set(uid, r);
        }
        r.reps.push({ map: m, actor: n, x: n.x, y: n.y });
      });
      for (const r of people.values()) {
        let home = families[r.id] && k.landmarks[families[r.id]];
        if (!home) home = r.reps.map((p) => p.map.building).find((b) => b && homeBuilding(b) && b.tplId !== 'hero_home');
        if (!home) home = houses.filter((b) => b.tplId !== 'hero_home').sort((a, b) => a.residents.length - b.residents.length || a.ty - b.ty || a.tx - b.tx)[0];
        if (!home) throw new Error('Нет жилого дома для ' + r.uid);
        r.home = home; home.residents.push(r.uid);
      }
      // Даже ранее пустые дома Учиха получают постоянного хозяина.
      for (const home of houses) {
        if (home.tplId === 'hero_home') { home.residents.push('hero'); continue; }
        if (home.residents.length) continue;
        const m = G.world.get(home.interior.id), p = roomPoint(m, m.npcs);
        const id = serial % 2 ? 'villager_m' : 'villager_f', uid = 'resident:' + home.interior.id;
        const n = G.world.makeNpc({ id, ...p, ai: 'idle', talk: [{ text: 'Заходи в гости. Днём я гуляю по деревне, а вечером возвращаюсь домой.' }] });
        const r = { uid, id, name: `${names[serial % names.length]} ${surnames[Math.floor(serial / names.length) % surnames.length]}`, reps: [], origin: n, serial: serial++, home, active: null };
        m.npcs.push(n); people.set(uid, r); home.residents.push(uid); attach(r, m, n);
      }
      for (const r of people.values()) {
        for (const rep of r.reps) {
          rep.actor.uid = r.uid; rep.actor.homeId = r.home.interior.id; rep.actor.residentMap = rep.map.id;
          rep.actor._look = (r.id === 'villager_m' || r.id === 'villager_f') ? r.serial % G.chars.LOOKS : 0;
          if (!canonical(r.origin)) { rep.actor.role = rep.actor.name; rep.actor.name = r.name; }
        }
        const hm = G.world.get(r.home.interior.id);
        let hr = r.reps.find((p) => p.map === hm);
        if (!hr) {
          const p = roomPoint(hm, hm.npcs);
          const n = G.world.makeNpc({ id: r.id, ...p, ai: 'idle', name: canonical(r.origin) && !r.origin.name ? undefined : title(r), talk: canonical(r.origin) && !r.origin.shop ? r.origin.talk : [{ text: `Меня зовут ${title(r)}. Это мой дом. Днём у меня дела в деревне.` }] });
          n.residentHome = true;
          hm.npcs.push(n); hr = attach(r, hm, n);
        }
        r.homeRep = hr;
        const work = (r.id === 'hokage' && r.reps.find((p) => p.map.building && p.map.building.tplId === 'hokage_tower')) || r.reps.find((p) => p !== hr && p.actor.shop) || r.reps.find((p) => p !== hr && !p.actor.cond) || r.reps.find((p) => p !== hr) || null;
        r.work = work;
        const door = G.world.outsideOf(r.home);
        const market = k.landmarks.market || r.home;
        const dest = G.world.freeTile(k, market.tx + 2 + r.serial % 7, market.ty + market.th + 2 + Math.floor(r.serial / 7) % 4, true) || [door.x / T | 0, door.y / T | 0];
        r.dailyRoute = [
          { from: 0, to: 7 * 60, label: 'Дома', map: hm.id, x: hr.x, y: hr.y },
          { from: 7 * 60, to: 12 * 60, label: work ? 'На работе или учёбе' : 'Прогулка у дома', map: work ? work.map.id : 'konoha', x: work ? work.x : door.x, y: work ? work.y : door.y },
          { from: 12 * 60, to: 14 * 60, label: 'За покупками на рынке', map: 'konoha', x: dest[0] * T + 8, y: dest[1] * T + 12 },
          { from: 14 * 60, to: 20 * 60, label: work ? 'Дневные дела' : 'Прогулка по деревне', map: work ? work.map.id : 'konoha', x: work ? work.x : dest[0] * T + 8, y: work ? work.y : dest[1] * T + 12 },
          { from: 20 * 60, to: 30 * 60, label: 'Возвращается домой', map: hm.id, x: hr.x, y: hr.y },
        ];
        const shop = work && G.SHOPS[work.actor.shop || (work.map.building && work.map.building.tplId)];
        if (shop || r.id === 'hokage') {
          const hours = shop ? shop.hours : [8 * 60, 18 * 60];
          r.dailyRoute = [
            { from: 0, to: hours[0], label: 'Дома', map: hm.id, x: hr.x, y: hr.y },
            { from: hours[0], to: hours[1], label: 'На работе', map: work.map.id, x: work.x, y: work.y },
            { from: hours[1], to: 30 * 60, label: 'Дома', map: hm.id, x: hr.x, y: hr.y },
          ];
        }
        r.active = r.homeRep;
      }
      // Табличка дома сообщает о настоящих жильцах, даже когда они ушли по делам.
      for (const home of houses) {
        if (!home.tplDef.unique) home.name = `${home.name}, №${houses.indexOf(home) + 1}`;
        G.world.get(home.interior.id).name = home.name;
        if (home.tplId === 'hero_home') continue;
        const m = G.world.get(home.interior.id), labels = home.residents.map((id) => title(people.get(id)));
        m.residentNames = labels;
        home.occupantNames = labels;
      }
    } finally { building = false; }
  }

  function eligible(r) {
    if (G.SCHED[r.id] && G.state.vars.day < G.SCHED[r.id].since) return false;
    // Мизуки и некоторые гости могут покинуть деревню по сюжету.
    return r.reps.some((p) => !p.travel && !p.actor.residentHome && (!p.actor.cond || p.actor.cond()));
  }

  function target(r) {
    const min = G.state.vars.min;
    if (canonical(r.origin) && G.SCHED[r.id]) {
      const pinned = r.reps.find((p) => !p.travel && p.actor.keep && p.actor.keep());
      if (pinned) return pinned;
      if (G.SCHED[r.id] && !G.schedule.at(r.id)) return r.homeRep;
      const inClass = min >= 8 * 60 && min < 13 * 60 && G.life.weekday() && r.reps.find((p) => !p.travel && p.map.name === 'Академия: класс' && baseVisible(p.actor));
      if (inClass) return inClass;
      const indoor = r.reps.find((p) => {
        const shop = G.SHOPS[p.actor.shop || (p.map.building && p.map.building.tplId)];
        return !p.travel && p.map !== village && p !== r.homeRep && baseVisible(p.actor) && (!shop || min >= shop.hours[0] && min < shop.hours[1]);
      });
      if (indoor) return indoor;
      for (const p of r.reps) if (!p.travel && p.map === village && baseVisible(p.actor)) {
        const stop = p.actor.route && p.actor.route.find((s) => G.life.inWindow(s.w));
        if (stop) return { ...p, x: stop.spot.x, y: stop.spot.y };
        if (!p.actor.route && (!p.actor.shop || min >= G.SHOPS[p.actor.shop].hours[0] && min < G.SHOPS[p.actor.shop].hours[1])) return p;
      }
      return r.homeRep;
    }
    const workShop = r.work && G.SHOPS[r.work.actor.shop || (r.work.map.building && r.work.map.building.tplId)];
    if (workShop) {
      const hours = workShop.hours;
      return min >= hours[0] && min < hours[1] ? r.work : r.homeRep;
    }
    const stop = r.dailyRoute.find((s) => min >= s.from && min < s.to) || r.dailyRoute[0];
    if (stop.map === r.homeRep.map.id) return r.homeRep;
    if (r.work && stop.map === r.work.map.id) return r.work;
    return { map: village, actor: travelRep(r, village).actor, x: stop.x, y: stop.y };
  }

  function travelRep(r, map) {
    let rep = r.reps.find((p) => p.travel && p.map === map);
    if (!rep) {
      const n = G.world.makeNpc({ id: r.id, x: map.spawn ? map.spawn.x : r.homeRep.x, y: map.spawn ? map.spawn.y : r.homeRep.y, ai: 'idle', name: r.origin.name || (canonical(r.origin) ? undefined : title(r)), talk: r.origin.shop ? [{ text: `Сейчас я иду по делам. Мой дом: ${r.home.name}.` }] : r.origin.talk });
      n._residentTravel = true;
      map.npcs.push(n); rep = attach(r, map, n); rep.travel = true;
    }
    return rep;
  }

  function onScreen(rep, world) {
    if (!rep || rep.map !== world.map) return false;
    const n = rep.actor, c = world.cam, z = world.z || 1;
    return n.x > c.x - 32 && n.x < c.x + G.screen.W / z + 32 && n.y > c.y - 32 && n.y < c.y + world.viewH() / z + 32;
  }
  function arrive(r, dst) { r.active = dst; dst.actor.x = dst.x; dst.actor.y = dst.y; dst.actor.home = { x: dst.x, y: dst.y }; dst.actor.path = null; dst.actor.moving = false; r.trip = null; }
  function trip(r, dst) {
    const from = r.active, legs = [];
    let start = { x: from.actor.x, y: from.actor.y };
    if (from.map !== dst.map && !from.map.outdoor) {
      legs.push({ map: from.map, start, end: from.map.spawn });
      start = G.world.outsideOf(from.map.building);
    }
    if (from.map.outdoor || from.map !== dst.map) {
      const end = dst.map.outdoor ? dst : G.world.outsideOf(dst.map.building);
      legs.push({ map: village, start, end });
      if (!dst.map.outdoor) start = dst.map.spawn;
    }
    if (!dst.map.outdoor) legs.push({ map: dst.map, start, end: dst });
    r.trip = { dst, legs, index: 0 };
    return nextLeg(r);
  }
  function nextLeg(r) {
    const t = r.trip;
    if (t.index >= t.legs.length) { arrive(r, t.dst); return true; }
    const leg = t.legs[t.index++], rep = travelRep(r, leg.map);
    const path = G.nav.path(leg.map, leg.start.x, leg.start.y, leg.end.x, leg.end.y);
    if (!path) { r.trip = null; return false; }
    r.active = rep; rep.actor.x = leg.start.x; rep.actor.y = leg.start.y;
    rep.actor._routePath = path; rep.actor._routeWait = 0;
    return true;
  }

  const baseVisible = G.life.visible.bind(G.life);
  function sync(world) {
    init(G.world.konoha());
    syncedAt = G.state.vars.day + ':' + G.state.vars.min;
    for (const r of people.values()) {
      // Сюжет первого дня использует специально расставленных актёров и спутников.
      if (canonical(r.origin) && !G.state.flags.day2_intro) continue;
      const dst = target(r), stamp = dst.map.id + ':' + dst.x + ':' + dst.y;
      if (r.trip && !onScreen(r.active, world)) arrive(r, dst);
      if (r.stamp === stamp && r.day === G.state.vars.day) continue;
      if (r.trip && onScreen(r.active, world)) continue;
      const visible = onScreen(r.active, world);
      if (!r.stamp || r.day !== G.state.vars.day || !visible) arrive(r, dst);
      else if (!trip(r, dst)) continue;
      r.stamp = stamp; r.day = G.state.vars.day;
    }
  }

  function tick(world, n, dt) {
    const r = people.get(n.uid);
    if (!r || !r.trip || r.active.actor !== n) return false;
    const path = n._routePath;
    if (!path || !path.length) { nextLeg(r); world.refreshNpcs(); return true; }
    const [tx, ty] = path[0], x = tx * T + 8, y = ty * T + 12, dx = x - n.x, dy = y - n.y;
    if (Math.hypot(dx, dy) < 1.5) { path.shift(); return true; }
    const len = Math.hypot(dx, dy), speed = Math.min(len, 30 * dt);
    n.dir = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up';
    const oldX = n.x, oldY = n.y;
    G.actors.move(world.map, n, dx / len * speed, dy / len * speed, world.others);
    n.moving = Math.abs(n.x - oldX) + Math.abs(n.y - oldY) > .01;
    if (n.moving) { n.anim += dt * 7; n._routeWait = 0; } else n._routeWait += dt;
    if (n._routeWait > 2) {
      const leg = r.trip.legs[r.trip.index - 1];
      const blockers = world.others.filter((o) => o !== n).map((o) => G.actors.feet(o));
      const detour = G.nav.path(world.map, n.x, n.y, leg.end.x, leg.end.y, 30000, blockers);
      if (detour) n._routePath = detour;
      n._routeWait = 0;
    }
    return true;
  }

  const baseKonoha = G.world.konoha.bind(G.world);
  G.world.konoha = function () { const k = baseKonoha(); init(k); return k; };
  G.life.visible = function (n) {
    const r = people.get(n.uid);
    if (!r) return baseVisible(n);
    if (canonical(r.origin) && !G.state.flags.day2_intro) return !n.residentHome && !n._residentTravel && baseVisible(n);
    return eligible(r) && r.active && r.active.actor === n;
  };
  const oldSync = G.schedule.sync;
  G.schedule.sync = (world) => { if (!G.state.flags.day2_intro) oldSync(world); sync(world); };

  function list() { init(G.world.konoha()); return [...people.values()]; }
  function ensureCurrent() {
    if (syncedAt === G.state.vars.day + ':' + G.state.vars.min) return;
    const world = G.scenes.stack.find((s) => s.name === 'world');
    sync(world || { map: null, cam: { x: 0, y: 0 } });
  }
  function menu(world) {
    const all = list().sort((a, b) => title(a).localeCompare(title(b)));
    G.scenes.push(G.scenes.make('pick', { title: 'Жители Конохи', options: all.map((r) => ({ label: title(r), desc: 'Дом: ' + r.home.name })) }, (i) => {
      if (i < 0) return;
      const r = all[i], point = G.world.outsideOf(r.home);
      const stops = G.SCHED[r.id] ? [...G.schedule.rowsFor(r.id).map((s) => `${G.game.clock(s[1] * 60)}–${G.game.clock(s[2] * 60)}: ${s[3]}`), 'В остальное время — дома.'] : r.dailyRoute.map((s) => `${G.game.clock(s.from)}–${G.game.clock(s.to)}: ${s.label}`);
      world.talk([{ who: r.id, text: `${title(r)}. Дом: ${r.home.name}. Вместе живут: ${(r.home.occupantNames || [title(r)]).join(', ')}.` }, ...stops.map((text) => ({ text })), { text: 'Дом отмечен на карте.' }]);
      G.state.marker = { x: Math.floor(point.x / T), y: Math.floor(point.y / T), label: 'Дом: ' + title(r) };
    }));
  }
  return { init, list, tick, sync, ensureCurrent, menu, get people() { return people; } };
})();
