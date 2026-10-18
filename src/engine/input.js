// Ввод: виртуальный геймпад (Pointer Events, мультитач) + клавиатура для ПК.
// Кнопки: up down left right a b menu map goal
G.input = {
  BTN: ['up', 'down', 'left', 'right', 'a', 'b', 'menu', 'map', 'goal'],
  _down: {},     // зажата сейчас (сырое состояние)
  _prev: {},     // состояние в прошлом кадре
  _cur: {},      // состояние в текущем кадре
  _queuedPress: {}, // нажатия, случившиеся между кадрами (быстрый тап)
  _keys: {},
  _dpadPointer: null,
  _dpadDirs: { up: false, down: false, left: false, right: false },
  _btnPointers: {},
  tap: null,     // последний тап по canvas {x,y} во внутренних координатах
  repeatTimer: 0,

  init() {
    this._bindDpad();
    this._bindButtons();
    this._bindKeyboard();
    this._bindCanvasTap();
    // блокируем жесты iOS
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => {
      if (!e.target.closest || !e.target.closest('#text-entry')) e.preventDefault();
    }, { passive: false });
  },

  // ----- D-pad: направление по углу касания, 8 направлений, можно вести пальцем -----
  _bindDpad() {
    const el = document.getElementById('dpad');
    const arms = {
      up: el.querySelector('.dp-up'), down: el.querySelector('.dp-down'),
      left: el.querySelector('.dp-left'), right: el.querySelector('.dp-right'),
    };
    const update = (e) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const d = { up: false, down: false, left: false, right: false };
      if (Math.hypot(dx, dy) > 12) {
        const a = Math.atan2(dy, dx); // -PI..PI, 0 = вправо
        const oct = Math.round(a / (Math.PI / 4)); // -4..4
        if (oct === 0) d.right = true;
        else if (oct === 1) { d.right = true; d.down = true; }
        else if (oct === 2) d.down = true;
        else if (oct === 3) { d.down = true; d.left = true; }
        else if (oct === 4 || oct === -4) d.left = true;
        else if (oct === -3) { d.left = true; d.up = true; }
        else if (oct === -2) d.up = true;
        else if (oct === -1) { d.up = true; d.right = true; }
      }
      for (const k in d) {
        if (d[k] && !this._dpadDirs[k]) this._queuedPress[k] = true;
        this._dpadDirs[k] = d[k];
        arms[k].classList.toggle('on', d[k]);
      }
    };
    const clear = () => {
      for (const k in this._dpadDirs) { this._dpadDirs[k] = false; arms[k].classList.remove('on'); }
      this._dpadPointer = null;
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._dpadPointer = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      G.audio.unlock();
      update(e);
    });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === this._dpadPointer) update(e); });
    const end = (e) => { if (e.pointerId === this._dpadPointer) clear(); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  },

  // ----- A, B, МЕНЮ, КАРТА -----
  _bindButtons() {
    document.querySelectorAll('[data-btn]').forEach((el) => {
      const b = el.dataset.btn;
      const set = (on) => {
        this._btnPointers[b] = on;
        el.classList.toggle('on', on);
      };
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
        G.audio.unlock();
        this._queuedPress[b] = true;
        set(true);
      });
      const end = () => set(false);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('lostpointercapture', end);
    });
  },

  _bindKeyboard() {
    const map = {
      ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      KeyZ: 'a', Enter: 'a', Space: 'a', KeyJ: 'a',
      KeyX: 'b', ShiftLeft: 'b', ShiftRight: 'b', KeyK: 'b', Backspace: 'b',
      Escape: 'menu', KeyQ: 'menu', Tab: 'map', KeyM: 'map', KeyG: 'goal', KeyC: 'goal',
    };
    window.addEventListener('keydown', (e) => {
      if (document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
      if (e.code === 'Backquote' || e.code === 'F2') { G.debug && G.debug.toggle(); e.preventDefault(); return; }
      const b = map[e.code];
      if (b) {
        e.preventDefault();
        G.audio.unlock();
        if (!this._keys[e.code]) this._queuedPress[b] = true;
        this._keys[e.code] = b;
      }
    });
    window.addEventListener('keyup', (e) => { delete this._keys[e.code]; });
    window.addEventListener('blur', () => { this._keys = {}; });
  },

  _bindCanvasTap() {
    const c = document.getElementById('screen');
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      G.audio.unlock();
      this.tap = G.screen.toLocal(e.clientX, e.clientY);
      this._tapFresh = true;
    });
  },

  // вызывается раз в кадр, до update сцен
  poll() {
    const raw = {};
    for (const b of this.BTN) raw[b] = false;
    for (const k in this._dpadDirs) if (this._dpadDirs[k]) raw[k] = true;
    for (const b in this._btnPointers) if (this._btnPointers[b]) raw[b] = true;
    for (const code in this._keys) raw[this._keys[code]] = true;
    this._prev = this._cur;
    this._cur = raw;
    this._pressedNow = {};
    for (const b of this.BTN) {
      this._pressedNow[b] = (raw[b] && !this._prev[b]) || !!this._queuedPress[b];
    }
    this._queuedPress = {};
    this.tapNow = this._tapFresh ? this.tap : null;
    this._tapFresh = false;
  },

  held(b) { return !!this._cur[b]; },
  pressed(b) { return !!(this._pressedNow && this._pressedNow[b]); },

  // Нажатие с автоповтором (для меню): сразу, потом через 0.35с каждые 0.09с
  _rep: {},
  repeat(b, dt) {
    if (this.pressed(b)) { this._rep[b] = 0.35; return true; }
    if (!this.held(b)) { this._rep[b] = 0; return false; }
    this._rep[b] -= dt;
    if (this._rep[b] <= 0) { this._rep[b] = 0.09; return true; }
    return false;
  },

  // Вектор движения (нормализованный для диагоналей)
  axis() {
    let x = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    let y = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  },

  // Сбросить всё (при смене сцены, чтобы нажатие не «протекало»)
  consume() {
    this._pressedNow = {};
    this.tapNow = null;
  },
};
