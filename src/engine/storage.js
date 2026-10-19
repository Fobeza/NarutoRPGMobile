// Хранилище: один слот сохранения + резервная копия + настройки + экспорт/импорт кодом.
// Этап 4: резервная копия «утро дня N» (пишется при сне), экспорт/импорт кодом, версия формата и миграции.
G.storage = {
  KEY_SAVE: 'wof_save_v1',
  KEY_BACKUP: 'wof_save_v1_bak',
  KEY_SETTINGS: 'wof_settings',
  SAVE_VERSION: 2,

  // Если браузер не даёт localStorage (файл в Safari, приватный режим, запрет cookies), держим копию в памяти
  // и в window.name — так игра переживёт перезагрузку страницы в этой вкладке; для надёжности есть «Код сохранения».
  // В памяти лежат СТРОКИ (независимые снимки), а не ссылки на живой state.
  // _fresh[key] — запись в localStorage не удалась: актуальная копия только в памяти и она важнее старой из localStorage.
  _mem: {},
  _fresh: {},
  persistent: true,
  _wn() { try { return JSON.parse(window.name || '{}') || {}; } catch (_) { return {}; } },
  _text(key) {
    if (this._fresh[key] && this._mem[key]) return this._mem[key];
    try { const s = localStorage.getItem(key); if (s) return s; } catch (_) {}
    if (this._mem[key]) return this._mem[key];
    const w = this._wn(); return w[key] ? JSON.stringify(w[key]) : null;
  },
  _get(key) {
    const s = this._text(key);
    if (!s) return null;
    try { return JSON.parse(s); } catch (_) { return null; }
  },
  _set(key, obj) {
    const s = JSON.stringify(obj);
    this._mem[key] = s;
    try { localStorage.setItem(key, s); delete this._fresh[key]; this.persistent = true; return true; } catch (_) {}
    this._fresh[key] = true; this.persistent = false;
    try { const w = this._wn(); w[key] = obj; window.name = JSON.stringify(w); } catch (_) {}
    return false;
  },
  // текст сохранения для экспорта
  _raw(key) { return this._text(key); },

  // Проверка структуры: числа там, где числа, объекты там, где объекты; версия не новее нашей
  valid(d) {
    const obj = (o) => o && typeof o === 'object' && !Array.isArray(o);
    if (!obj(d) || !obj(d.state)) return false;
    if (d.v != null && (typeof d.v !== 'number' || d.v > this.SAVE_VERSION)) return false;
    const st = d.state;
    if (!obj(st.vars) || !obj(st.hero)) return false;
    for (const k of ['day', 'min', 'money']) if (st.vars[k] != null && !Number.isFinite(st.vars[k])) return false;
    if (st.vars.day != null && (st.vars.day < 1 || st.vars.day > 9999)) return false;
    for (const k of ['flags', 'inv', 'quests', 'daily']) if (st[k] != null && !obj(st[k])) return false;
    if (st.hero.name != null && typeof st.hero.name !== 'string') return false;
    if (st.hero.skills != null && !Array.isArray(st.hero.skills)) return false;
    if (st.hero.stats != null && !obj(st.hero.stats)) return false;
    // пробная починка на копии: если fix() падает — сохранение непригодно
    try { if (G.game && G.game.fix) G.game.fix(JSON.parse(JSON.stringify(st))); } catch (_) { return false; }
    return true;
  },
  _good(key) { const d = this._get(key); return d && this.valid(d) ? d : null; },

  hasSave() { return !!(this._good(this.KEY_SAVE) || this._good(this.KEY_BACKUP)); },

  // opts.backup — ещё и резервная копия (утро нового дня)
  save(state, opts = {}) {
    const data = { v: this.SAVE_VERSION, t: Date.now(), build: BUILD.version, state };
    const ok = this._set(this.KEY_SAVE, data);
    if (opts.backup || !this._good(this.KEY_BACKUP)) this._set(this.KEY_BACKUP, data);
    if (!ok && !this._warned) {
      this._warned = true;
      const w = G.scenes && G.scenes.stack && G.scenes.stack.find((q) => q.name === 'world');
      if (w && w.showToast) w.showToast('Браузер не даёт сохраняться! Меню → Сохранение → Код сохранения');
    }
    return ok;
  },
  backupInfo() {
    const d = this._good(this.KEY_BACKUP);
    return d ? { day: d.state.vars.day, min: d.state.vars.min, t: d.t } : null;
  },
  restoreBackup() {
    const d = this._good(this.KEY_BACKUP);
    if (!d) return false;
    this._set(this.KEY_SAVE, d);   // не удалась постоянная запись — копия всё равно в памяти и загрузится
    return true;
  },

  load() {
    let d = this._good(this.KEY_SAVE);
    if (!d) d = this._good(this.KEY_BACKUP); // основная копия повреждена → резервная
    if (!d) return null;
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
    delete this._mem[this.KEY_SAVE]; delete this._mem[this.KEY_BACKUP]; this._fresh = {};
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
      if (!this.valid(d)) return false;
      // текущую игру — в резервную копию, чтобы импорт можно было откатить
      const cur = this._good(this.KEY_SAVE); if (cur) this._set(this.KEY_BACKUP, cur);
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
