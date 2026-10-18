// Ввод: сенсорное управление без экранных кнопок (Pointer Events, мультитач) + клавиатура для ПК.
// Кнопки: up down left right a b menu map goal. Джойстик и кнопки рисует engine/touch.js.
G.input = {
  BTN: ['up', 'down', 'left', 'right', 'a', 'b', 'menu', 'map', 'goal'],
  _down: {},     // зажата сейчас (сырое состояние)
  _prev: {},     // состояние в прошлом кадре
  _cur: {},      // состояние в текущем кадре
  _queuedPress: {}, // нажатия, случившиеся между кадрами (быстрый тап)
  _keys: {},
  tap: null,     // последний тап по canvas {x,y} во внутренних координатах
  repeatTimer: 0,

  init() {
    this._bindTouch();
    this._bindKeyboard();
    // блокируем жесты iOS
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => {
      if (!e.target.closest || !e.target.closest('#text-entry')) e.preventDefault();
    }, { passive: false });
  },

  // ----- Сенсорное управление (без экранных кнопок) -----
  // Плавающий джойстик: палец зажал экран (≈0,14 с) или повёл — под пальцем появляется джойстик; 8 направлений,
  // «до упора» — бег. Быстрый тап — обычный тап (меню, диалоги). Кнопки (действие, «Назад», «Меню/Карта/Цель»)
  // рисует G.touch и регистрирует горячие зоны: касание зоны — нажатие кнопки, джойстик не включается.
  STICK_R: 46,        // радиус джойстика, CSS-пиксели
  STICK_DEAD: 9,      // мёртвая зона
  STICK_HOLD_MS: 140, // сколько держать палец, чтобы джойстик появился без движения
  stick: { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0, dirs: null, run: false },
  _ptrs: {},          // pointerId → { kind: 'btn'|'pending'|'stick'|'tap'|'dead', ... }
  _btnHeld: {},       // кнопка → сколько пальцев на ней
  tapHeld: 0,         // сколько пальцев сейчас лежит на экране (обычные касания) — для «зажать» в мини-играх

  _bindTouch() {
    const app = document.getElementById('app');
    const mv = 7;     // сдвиг пальца, после которого сразу включается джойстик
    app.addEventListener('pointerdown', (e) => {
      if (e.target.closest && e.target.closest('#text-entry, #code-box')) return;
      e.preventDefault();
      G.audio.unlock();
      const loc = G.screen.toLocal(e.clientX, e.clientY);
      const P = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), loc };
      const btn = G.touch.hit(loc);
      if (btn) { P.kind = 'btn'; P.btn = btn; this._queuedPress[btn] = true; this._btnHeld[btn] = (this._btnHeld[btn] || 0) + 1; }
      else if (G.touch.joyAllowed() && !this.stick.on) P.kind = 'pending';
      else { P.kind = 'tap'; this.tap = loc; this._tapFresh = true; this.tapHeld++; }
      this._ptrs[e.pointerId] = P;
      try { app.setPointerCapture(e.pointerId); } catch (_) {}
    });
    app.addEventListener('pointermove', (e) => {
      const P = this._ptrs[e.pointerId]; if (!P) return;
      P.x = e.clientX; P.y = e.clientY;
      if (P.kind === 'pending' && Math.hypot(P.x - P.x0, P.y - P.y0) > mv) this._startStick(P);
      if (P.kind === 'stick') { this.stick.x = P.x; this.stick.y = P.y; }
    });
    const end = (e) => {
      const P = this._ptrs[e.pointerId]; if (!P) return;
      delete this._ptrs[e.pointerId];
      if (P.kind === 'btn') this._btnHeld[P.btn] = Math.max(0, (this._btnHeld[P.btn] || 1) - 1);
      else if (P.kind === 'stick') this._stopStick();
      else if (P.kind === 'pending') { this.tap = P.loc; this._tapFresh = true; }   // короткое касание = тап
      else if (P.kind === 'tap') this.tapHeld = Math.max(0, this.tapHeld - 1);
    };
    app.addEventListener('pointerup', end);
    app.addEventListener('pointercancel', end);
    app.addEventListener('lostpointercapture', end);
  },
  _startStick(P) {
    P.kind = 'stick';
    this.stick = { on: true, id: P.id, ox: P.x0, oy: P.y0, x: P.x, y: P.y, dirs: null, run: false };
  },
  _stopStick() {
    this.stick = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0, dirs: null, run: false };
  },
  // направления и бег по смещению пальца от центра джойстика
  _stickState() {
    const st = this.stick, d = { up: false, down: false, left: false, right: false };
    if (!st.on) return { d, run: false };
    const dx = st.x - st.ox, dy = st.y - st.oy, dist = Math.hypot(dx, dy);
    if (dist <= this.STICK_DEAD) return { d, run: false };
    const oct = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));   // -4..4, 0 — вправо
    if (oct === 0) d.right = true;
    else if (oct === 1) { d.right = true; d.down = true; }
    else if (oct === 2) d.down = true;
    else if (oct === 3) { d.down = true; d.left = true; }
    else if (oct === 4 || oct === -4) d.left = true;
    else if (oct === -3) { d.left = true; d.up = true; }
    else if (oct === -2) d.up = true;
    else if (oct === -1) { d.up = true; d.right = true; }
    return { d, run: dist >= this.STICK_R * 0.95 };
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

  // вызывается раз в кадр, до update сцен
  poll() {
    const raw = {};
    for (const b of this.BTN) raw[b] = false;
    // сенсорный джойстик: ещё не появился, но палец держат дольше порога — включаем
    const now = performance.now();
    for (const id in this._ptrs) {
      const P = this._ptrs[id];
      if (P.kind === 'pending' && now - P.t0 >= this.STICK_HOLD_MS) { if (G.touch.joyAllowed() && !this.stick.on) this._startStick(P); else P.kind = 'dead'; }
    }
    // сцена сменилась (диалог, бой…) — джойстик отпускаем
    if (this.stick.on && !G.touch.joyAllowed()) { const P = this._ptrs[this.stick.id]; if (P) P.kind = 'dead'; this._stopStick(); }
    const sk = this._stickState();
    this.stick.dirs = sk.d; this.stick.run = sk.run;
    for (const k in sk.d) if (sk.d[k]) raw[k] = true;
    if (sk.run) raw.b = true;                 // «до упора» = удерживаемая B = бег
    for (const b in this._btnHeld) if (this._btnHeld[b] > 0) raw[b] = true;
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
