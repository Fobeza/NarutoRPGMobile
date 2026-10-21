// Звук: синтез через Web Audio — короткие эффекты (G.audio.sfx), фон деревни и тихая музыка (engine/ambience.js).
// Шины: master → эффекты напрямую, amb — фон деревни, mus — музыка; громкость шин меняет G.ambience.
G.audio = {
  ctx: null,
  master: null,
  enabled: true,
  volume: 0.5,

  // iOS: запускать только по жесту пользователя
  unlock() {
    if (this.ctx) {
      this.wake();
      return;
    }
    try {
      // играть даже при переключателе «Бесшумно» (Safari 17+)
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch (_) {}
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.amb = this.ctx.createGain(); this.amb.gain.value = 1; this.amb.connect(this.master);
    this.mus = this.ctx.createGain(); this.mus.gain.value = 0; this.mus.connect(this.master);
    // «пустой» звук для разблокировки
    const b = this.ctx.createBuffer(1, 1, 22050);
    const s = this.ctx.createBufferSource();
    s.buffer = b; s.connect(this.master); s.start(0);
  },

  // iOS переводит контекст в suspended/interrupted (звонок, сворачивание) — без resume звуки копятся и выходят пачкой или молчат
  wake() {
    const c = this.ctx;
    if (c && c.state !== 'running' && c.state !== 'closed') { try { const r = c.resume(); if (r && r.catch) r.catch(() => {}); } catch (_) {} }
  },

  // звуки играем только в рабочем контексте: в остановленном они бы накопились и «зависли»
  ready() { return !!this.ctx && this.enabled && this.ctx.state === 'running'; },

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? this.volume : 0;
  },

  // Базовый тон: частота, длительность, форма волны, громкость, сдвиг частоты
  tone(freq, dur = 0.08, type = 'square', vol = 0.15, slideTo = null, delay = 0) {
    if (!this.ready()) { this.wake(); return; }
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },

  noise(dur = 0.1, vol = 0.15, delay = 0) {
    if (!this.ready()) { this.wake(); return; }
    const t = this.ctx.currentTime + delay;
    // буфер шума кэшируется по длительности: шаги идут по 4–6 раз в секунду
    const cache = this._noise || (this._noise = {});
    let buf = cache[dur];
    if (!buf) {
      const len = Math.floor(this.ctx.sampleRate * dur);
      buf = cache[dur] = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const s = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = vol;
    s.buffer = buf; s.connect(g); g.connect(this.master);
    s.start(t);
  },

  // Белый шум (2 с) — общий источник для фильтрованных шумов и фоновых петель
  whiteBuffer() {
    if (this._white) return this._white;
    const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return (this._white = buf);
  },
  // в стерео, если браузер умеет: звуки деревни слева и справа от героя
  panner(pan, dest) {
    if (!pan || !this.ctx.createStereoPanner) return dest;
    const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(dest); return p;
  },
  // Шум через фильтр с огибающей: шаги, ветер, всплеск. type — lowpass/highpass/bandpass
  noiseF(dur, vol, freq, type = 'lowpass', { delay = 0, q = 1, attack = 0.004, slideTo = null, bus = null, pan = 0 } = {}) {
    if (!this.ready()) { this.wake(); return; }
    const t = this.ctx.currentTime + delay, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.whiteBuffer(); s.loop = true;
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.panner(pan, bus || this.master));
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  },
  // «Щипок» струны (кото, сямисэн): основной тон + тихая октава, быстрая атака и долгий спад
  pluck(freq, dur = 1.2, vol = 0.06, { delay = 0, bus = null, pan = 0, type = 'triangle' } = {}) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + delay, out = this.panner(pan, bus || this.master);
    for (const [k, v, w] of [[1, 1, type], [2, 0.25, 'sine'], [3.01, 0.08, 'sine']]) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = w; o.frequency.setValueAtTime(freq * k, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur / k);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    }
  },
  // Колокол: неровные обертоны и долгий хвост
  bellTone(freq, dur = 3, vol = 0.05, { delay = 0, bus = null, pan = 0 } = {}) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + delay, out = this.panner(pan, bus || this.master);
    for (const [k, v] of [[1, 1], [2.02, 0.45], [2.76, 0.3], [5.4, 0.12]]) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(freq * k, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur / Math.sqrt(k));
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    }
  },

  // Готовые эффекты
  sfx: {
    blip()    { G.audio.tone(880, 0.025, 'square', 0.05); },
    select()  { G.audio.tone(660, 0.05, 'square', 0.1); },
    confirm() { G.audio.tone(660, 0.06, 'square', 0.12); G.audio.tone(990, 0.08, 'square', 0.12, null, 0.06); },
    cancel()  { G.audio.tone(440, 0.08, 'square', 0.1, 220); },
    // шаг по разной земле: трава шуршит, камень щёлкает, доски глухо стучат, по воде — плеск
    step(ground) {
      const A = G.audio;
      if (ground === 'stone') { A.noiseF(0.035, 0.05, 2600, 'bandpass', { q: 1.4 }); A.tone(900 + Math.random() * 200, 0.012, 'square', 0.012); }
      else if (ground === 'wood') { A.tone(150 + Math.random() * 30, 0.05, 'triangle', 0.07, 110); A.noiseF(0.03, 0.02, 900, 'lowpass'); }
      else if (ground === 'water') A.noiseF(0.12, 0.045, 1800, 'bandpass', { q: 0.7, slideTo: 700 });
      else if (ground === 'grass') A.noiseF(0.06, 0.035, 3800 + Math.random() * 900, 'highpass', { attack: 0.012 });
      else A.noise(0.03, 0.03);
    },
    door()    { G.audio.noiseF(0.25, 0.04, 500, 'lowpass', { slideTo: 220, attack: 0.03 }); G.audio.tone(160, 0.07, 'triangle', 0.09, 120, 0.2); },
    coin()    { G.audio.tone(1320, 0.06, 'square', 0.05); G.audio.tone(1980, 0.12, 'square', 0.05, null, 0.06); },
    questDone() { [587, 659, 784, 880, 1175].forEach((f, i) => G.audio.pluck(f, 0.9, 0.07, { delay: i * 0.09 })); },
    meow()    { G.audio.tone(620, 0.32, 'sawtooth', 0.025, 940); G.audio.tone(900, 0.2, 'sine', 0.03, 560, 0.18); },
    bark()    { for (const d of [0, 0.22]) { G.audio.noiseF(0.09, 0.06, 700, 'bandpass', { delay: d, q: 2 }); G.audio.tone(330, 0.09, 'sawtooth', 0.035, 190, d); } },
    jump()    { G.audio.tone(260, 0.16, 'sine', 0.06, 620); G.audio.noiseF(0.12, 0.02, 1800, 'highpass'); },
    land()    { G.audio.noiseF(0.08, 0.06, 500, 'lowpass'); G.audio.tone(110, 0.06, 'sine', 0.06, 70); },
    splash()  { G.audio.noiseF(0.45, 0.07, 2600, 'bandpass', { q: 0.6, slideTo: 600, attack: 0.01 }); },
    bell()    { G.audio.bellTone(196, 4.5, 0.06); },
    puff()    { G.audio.noise(0.25, 0.2); G.audio.tone(300, 0.2, 'triangle', 0.1, 80); },
    error()   { G.audio.tone(160, 0.15, 'sawtooth', 0.1); },
  },
};
