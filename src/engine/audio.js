// Звук: синтез через Web Audio. Музыка — на этапе 10, сейчас только короткие эффекты.
G.audio = {
  ctx: null,
  master: null,
  enabled: true,
  volume: 0.5,

  // iOS: запускать только по жесту пользователя
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
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

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? this.volume : 0;
  },

  // Базовый тон: частота, длительность, форма волны, громкость, сдвиг частоты
  tone(freq, dur = 0.08, type = 'square', vol = 0.15, slideTo = null, delay = 0) {
    if (!this.ctx || !this.enabled) return;
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
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
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
