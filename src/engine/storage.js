// Хранилище: один слот сохранения + резервная копия + настройки + экспорт/импорт кодом.
// Этап 4: резервная копия «утро дня N» (пишется при сне), экспорт/импорт кодом, версия формата и миграции.
G.storage = {
  KEY_SAVE: 'wof_save_v1',
  KEY_BACKUP: 'wof_save_v1_bak',
  KEY_SETTINGS: 'wof_settings',
  SAVE_VERSION: 2,

  // Если браузер не даёт localStorage (файл в Safari, приватный режим, запрет cookies), держим копию в памяти
  // и в window.name — так игра переживёт перезагрузку страницы в этой вкладке; для надёжности есть «Код сохранения».
  _mem: {},
  persistent: true,
  _wn() { try { return JSON.parse(window.name || '{}') || {}; } catch (_) { return {}; } },
  _get(key) {
    try { const s = localStorage.getItem(key); if (s) return JSON.parse(s); } catch (_) {}
    if (this._mem[key]) return this._mem[key];
    const w = this._wn(); return w[key] || null;
  },
  _set(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); this._mem[key] = obj; this.persistent = true; return true; } catch (_) {}
    this._mem[key] = obj; this.persistent = false;
    try { const w = this._wn(); w[key] = obj; window.name = JSON.stringify(w); } catch (_) {}
    return false;
  },
  // текст сохранения для экспорта: из localStorage или из памяти
  _raw(key) {
    try { const s = localStorage.getItem(key); if (s) return s; } catch (_) {}
    const o = this._get(key); return o ? JSON.stringify(o) : null;
  },

  hasSave() { return !!(this._get(this.KEY_SAVE) || this._get(this.KEY_BACKUP)); },

  // opts.backup — ещё и резервная копия (утро нового дня)
  save(state, opts = {}) {
    const data = { v: this.SAVE_VERSION, t: Date.now(), build: BUILD.version, state };
    const ok = this._set(this.KEY_SAVE, data);
    if (opts.backup || !this._get(this.KEY_BACKUP)) this._set(this.KEY_BACKUP, data);
    if (!ok && !this._warned) {
      this._warned = true;
      const w = G.scenes && G.scenes.stack && G.scenes.stack.find((q) => q.name === 'world');
      if (w && w.showToast) w.showToast('Браузер не даёт сохраняться! Меню → Сохранение → Код сохранения');
    }
    return ok;
  },
  backupInfo() {
    const d = this._get(this.KEY_BACKUP);
    return d && d.state ? { day: d.state.vars.day, min: d.state.vars.min, t: d.t } : null;
  },
  restoreBackup() {
    const d = this._get(this.KEY_BACKUP);
    if (!d || !d.state) return false;
    return this._set(this.KEY_SAVE, d);
  },

  load() {
    let d = this._get(this.KEY_SAVE);
    if (!d || !d.state) d = this._get(this.KEY_BACKUP); // основная копия повреждена → резервная
    if (!d || !d.state) return null;
    return this.migrate(d).state;
  },

  // Миграции между версиями формата сохранения
  migrate(d) {
    // v1 → v2: задания, туман, нужды, характеристики — недостающие поля заполняет G.game.fix()
    if (!d.v || d.v < 2) d.v = 2;
    return d;
  },

  wipe() {
    try { localStorage.removeItem(this.KEY_SAVE); localStorage.removeItem(this.KEY_BACKUP); } catch (_) {}
    delete this._mem[this.KEY_SAVE]; delete this._mem[this.KEY_BACKUP];
    try { const w = this._wn(); delete w[this.KEY_SAVE]; delete w[this.KEY_BACKUP]; window.name = JSON.stringify(w); } catch (_) {}
  },

  // Экспорт: строка, которую можно скопировать и вставить в другом месте
  exportCode() {
    const s = this._raw(this.KEY_SAVE);
    if (!s) return '';
    return 'WOF1:' + btoa(unescape(encodeURIComponent(s)));
  },
  importCode(code) {
    try {
      code = String(code).replace(/\s+/g, '');
      if (!code.startsWith('WOF1:')) return false;
      const s = decodeURIComponent(escape(atob(code.slice(5))));
      const d = JSON.parse(s);
      if (!d.state || !d.state.vars || !d.state.hero) return false;
      // текущую игру — в резервную копию, чтобы импорт можно было откатить
      const cur = this._raw(this.KEY_SAVE); if (cur) this._set(this.KEY_BACKUP, JSON.parse(cur));
      this._set(this.KEY_SAVE, d);
      return true;
    } catch (_) { return false; }
  },

  settings: { sound: true, textSpeed: 2, hints: true, minimap: true, lefty: false },
  loadSettings() {
    const s = this._get(this.KEY_SETTINGS);
    if (s) Object.assign(this.settings, s);
    return this.settings;
  },
  saveSettings() { this._set(this.KEY_SETTINGS, this.settings); },
};
