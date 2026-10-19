// Звук: синтез через Web Audio. Музыка — на этапе 10, сейчас только короткие эффекты.
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

  // Готовые эффекты
  sfx: {
    blip()    { G.audio.tone(880, 0.025, 'square', 0.05); },
    select()  { G.audio.tone(660, 0.05, 'square', 0.1); },
    confirm() { G.audio.tone(660, 0.06, 'square', 0.12); G.audio.tone(990, 0.08, 'square', 0.12, null, 0.06); },
    cancel()  { G.audio.tone(440, 0.08, 'square', 0.1, 220); },
    step()    { G.audio.noise(0.03, 0.03); },
    puff()    { G.audio.noise(0.25, 0.2); G.audio.tone(300, 0.2, 'triangle', 0.1, 80); },
    error()   { G.audio.tone(160, 0.15, 'sawtooth', 0.1); },
  },
};
