// Фон деревни и тихая музыка — всё синтезом Web Audio, без файлов (игра работает офлайн).
//   G.ambience.update(world, dt) — каждый кадр из главного цикла: слои (ветер, дождь, вода, гомон) плавно
//   подстраиваются под место и время, редкие события (птицы, сверчки, лягушки, собака, колокол Академии) — по расписанию.
//   G.ambience.ground(map, x, y) — какая земля под ногами: для звука шагов.
//   Настройки: settings.ambience (звуки деревни), settings.music (музыка); общий выключатель — settings.sound.
G.ambience = (() => {
  const A = G.audio, layers = {};
  let clock = 0, slow = 0, lastMin = null, nextEvent = {}, musicT = 0, phrase = null;
  const R = (a, b) => a + Math.random() * (b - a);
  const on = (k) => G.storage.settings[k] !== false;

  // Петля шума через фильтр; громкость меняется плавно (setTargetAtTime), источник не пересоздаётся
  function layer(name, type, freq, q) {
    if (layers[name]) return layers[name];
    const c = A.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = A.whiteBuffer(); s.loop = true;
    f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
    g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(A.amb); s.start(0, Math.random() * 1.5);
    return (layers[name] = { g, f, level: 0 });
  }
  function setLayer(name, type, freq, q, level, tau = 1.2) {
    const L = layer(name, type, freq, q);
    if (Math.abs(L.level - level) < 0.0005) return L;
    L.level = level; L.g.gain.setTargetAtTime(level, A.ctx.currentTime, tau);
    return L;
  }

  // Что вокруг героя: вода, деревья, люди — по клеткам и объектам рядом
  function surroundings(w) {
    const m = w.map, p = w.player, T = G.CONFIG.TILE, tx = p.x / T | 0, ty = p.y / T | 0, ID = G.tiles.ID;
    let water = 0;
    for (let y = ty - 6; y <= ty + 6; y += 2) for (let x = tx - 6; x <= tx + 6; x += 2) if (m.get(x, y) === ID.WATER) water++;
    const objs = m.query({ x: p.x - 110, y: p.y - 90, w: 220, h: 180 });
    const trees = objs.filter((o) => ['tree', 'pine', 'sakura', 'maple', 'ginkgo', 'bamboo', 'oak', 'birch'].some((k) => String(o.kind).includes(k))).length;
    const people = w.npcs.filter((n) => Math.abs(n.x - p.x) < 130 && Math.abs(n.y - p.y) < 110).length;
    const d = m.districtAt ? m.districtAt(tx, ty) : null;
    return { water: Math.min(1, water / 12), trees, people, market: d && d.type === 'market' };
  }

  // Редкие звуки: каждое событие со своим таймером
  function due(k, a, b) {
    if (nextEvent[k] == null) nextEvent[k] = clock + R(a * 0.3, b);
    if (clock < nextEvent[k]) return false;
    nextEvent[k] = clock + R(a, b); return true;
  }
  const bus = () => A.amb;
  function bird() {
    const base = R(2200, 3600), n = 2 + (Math.random() * 3 | 0);
    for (let i = 0; i < n; i++) A.tone(base * R(0.9, 1.15), 0.05, 'sine', 0.012, base * R(1.2, 1.5), i * R(0.08, 0.13));
  }
  function cricket(pan) {
    const f = R(4200, 4900);
    for (let k = 0; k < 3; k++) for (let i = 0; i < 6; i++) A.noiseF(0.018, 0.006, f, 'bandpass', { delay: k * 0.32 + i * 0.035, q: 12, bus: bus(), pan });
  }
  function frog(pan) { for (const d of [0, 0.18]) A.noiseF(0.12, 0.03, 260, 'bandpass', { delay: d, q: 3, slideTo: 170, bus: bus(), pan }); }
  function crow(pan) { for (const d of [0, 0.45]) { A.noiseF(0.22, 0.02, 900, 'bandpass', { delay: d, q: 4, slideTo: 600, bus: bus(), pan }); } }
  function chime(pan) { const f = R(1900, 2600); [1, 1.25, 1.5].forEach((k, i) => A.bellTone(f * k / 2, 1.6, 0.008, { delay: i * R(0.15, 0.35), bus: bus(), pan })); }

  function events(w, s, hour, outdoor, rain) {
    const pan = () => R(-0.8, 0.8);
    if (!outdoor) return;
    if (!rain && hour >= 5 && hour < 19 && s.trees > 1 && due('bird', 3, Math.max(4, 14 - s.trees))) bird();
    if (!rain && (hour >= 20 || hour < 5) && due('cricket', 2, 6)) cricket(pan());
    if (!rain && (hour >= 19 || hour < 4) && s.water > 0.15 && due('frog', 4, 11)) frog(pan());
    if (!rain && hour >= 17 && hour < 19.5 && due('crow', 20, 45)) crow(pan());
    if (hour >= 8 && hour < 20 && !rain && due('dog', 45, 110)) G.audio.sfx.bark();
    if (!rain && hour >= 9 && hour < 18 && due('chime', 25, 60)) chime(pan());
  }
  // Колокол Академии: в 8:00 — к урокам, в 13:00 — перемена, в 18:00 — вечер
  function bells(min) {
    if (lastMin != null && min > lastMin) for (const h of [8, 13, 18]) if (lastMin < h * 60 && min >= h * 60) A.bellTone(147, 5, 0.05, { bus: A.amb });
    lastMin = min;
  }

  // ── музыка: пентатоника, днём лад «ё», ночью «ин»; ноты с паузами, под ними тихий бурдон ──
  const ROOT = 293.66, YO = [0, 2, 5, 7, 9], IN = [0, 1, 5, 7, 8];
  const freqOf = (scale, deg) => ROOT * Math.pow(2, (scale[((deg % 5) + 5) % 5] + 12 * Math.floor(deg / 5)) / 12);
  function music(dt, night, quiet) {
    const want = on('music') && on('sound') ? (quiet ? 0.35 : 1) : 0;
    A.mus.gain.setTargetAtTime(want, A.ctx.currentTime, 1.5);
    if (!want) { phrase = null; return; }
    musicT -= dt;
    if (musicT > 0) return;
    const scale = night ? IN : YO;
    if (!phrase || !phrase.left) phrase = { deg: (Math.random() * 5 | 0) + 2, left: 6 + (Math.random() * 6 | 0), drone: true };
    if (phrase.drone) { A.pluck(ROOT / (night ? 4 : 2), 5, 0.035, { bus: A.mus, type: 'sine' }); phrase.drone = false; }
    phrase.deg = Math.max(0, Math.min(10, phrase.deg + [-2, -1, -1, 0, 1, 1, 2][Math.random() * 7 | 0]));
    A.pluck(freqOf(scale, phrase.deg), night ? 1.8 : 1.3, night ? 0.035 : 0.045, { bus: A.mus, pan: R(-0.3, 0.3) });
    if (Math.random() < 0.25) A.pluck(freqOf(scale, phrase.deg + 2), 1, 0.02, { bus: A.mus, delay: 0.12 });
    phrase.left--;
    musicT = (night ? 0.75 : 0.5) * [1, 1, 2, 2, 3][Math.random() * 5 | 0] + (phrase.left ? 0 : R(3, 7));   // после фразы — пауза
  }

  function update(world, dt) {
    if (!A.ready()) return;
    clock += dt; slow -= dt;
    const top = G.scenes.top(), w = world || G.scenes.stack.find((x) => x.name === 'world');
    const min = G.state ? G.state.vars.min : 12 * 60, hour = (min / 60) % 24, night = hour >= 19 || hour < 6;
    const battle = top && top.name === 'battle';
    music(dt, night, battle);
    if (!w || !w.map || !on('ambience') || battle) {
      for (const k of Object.keys(layers)) setLayer(k, 'lowpass', 1, 1, 0, 0.6);
      return;
    }
    const outdoor = !!w.map.outdoor, rain = G.life.raining();
    if (slow <= 0) {   // слои пересчитываем 4 раза в секунду: этого хватает для плавной смены
      slow = 0.25;
      const s = outdoor ? surroundings(w) : { water: 0, trees: 0, people: 0, market: false };
      setLayer('wind', 'lowpass', 420, 0.6, outdoor ? 0.035 + (night ? 0.012 : 0) + (rain ? 0.03 : 0) : 0.006, 2);
      setLayer('rain', 'highpass', 1100, 0.5, rain ? (outdoor ? 0.11 : 0.035) : 0, 1.5);
      setLayer('water', 'bandpass', 780, 0.9, outdoor ? s.water * 0.07 : 0, 1);
      // гомон: тише ночью, громче на рынке и в толпе; мерцает — люди говорят не хором
      const crowd = outdoor && !night ? Math.min(0.06, s.people * 0.0035 + (s.market ? 0.02 : 0)) : 0;
      setLayer('crowd', 'bandpass', 620, 1.3, crowd * R(0.6, 1.2) * (rain ? 0.3 : 1), 0.3);   // в дождь люди по домам
      w._amb = s;
      events(w, s, hour, outdoor, rain);
    }
    bells(min);
  }

  // Земля под ногами для шагов
  function ground(m, x, y) {
    const ID = G.tiles.ID, t = m.get(x / G.CONFIG.TILE | 0, y / G.CONFIG.TILE | 0);
    if (t === ID.WATER) return 'water';
    if ([ID.PLANKS, ID.FLOOR, ID.TATAMI, ID.MAT, ID.RUG, ID.STEPS].includes(t)) return 'wood';   // мосты — тоже доски
    if ([ID.STONE, ID.MAINROAD, ID.BRICK, ID.COBBLE, ID.DARKSTONE, ID.PLAZA, ID.TILEFLOOR].includes(t)) return 'stone';
    if ([ID.PATH, ID.DIRT, ID.GRAVEL, ID.SAND, ID.DUSTFLOOR].includes(t)) return 'dirt';
    return m.outdoor ? 'grass' : 'wood';
  }
  return { update, ground, get layers() { return layers; } };
})();
