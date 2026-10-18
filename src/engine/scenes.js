// Менеджер сцен (стек). Сцена: { enter, exit, update(dt), draw(ctx), transparent, blocksUpdate }
// transparent  — рисовать сцену под ней (диалог поверх мира)
// Переходы: G.scenes.fadeTo(scene) — затемнение → смена → проявление
G.scenes = {
  stack: [],
  fade: { a: 0, dir: 0, speed: 3, then: null },
  registry: {},

  register(name, factory) { this.registry[name] = factory; },
  make(name, ...args) { return this.registry[name](...args); },

  top() { return this.stack[this.stack.length - 1]; },

  push(scene) {
    this.stack.push(scene);
    scene.enter && scene.enter();
    G.input.consume();
    return scene;
  },
  pop() {
    const s = this.stack.pop();
    s && s.exit && s.exit();
    const t = this.top();
    t && t.resume && t.resume();
    G.input.consume();
    return s;
  },
  replace(scene) {
    while (this.stack.length) { const s = this.stack.pop(); s.exit && s.exit(); }
    return this.push(scene);
  },

  // Затемнение экрана и выполнение действия в «тёмный» момент
  fadeOut(then, speed = 4) { this.fade = { a: this.fade.a, dir: 1, speed, then }; },
  fadeTo(scene, speed = 4) { this.fadeOut(() => this.replace(scene), speed); },
  get busy() { return this.fade.dir !== 0; },

  update(dt) {
    const f = this.fade;
    if (f.dir === 1) {
      f.a += dt * f.speed;
      if (f.a >= 1) {
        f.a = 1; f.dir = -1;
        const t = f.then; f.then = null;
        t && t();
      }
      return; // во время затемнения сцены не обновляются
    }
    if (f.dir === -1) {
      f.a -= dt * f.speed;
      if (f.a <= 0) { f.a = 0; f.dir = 0; }
    }
    const top = this.top();
    if (top) top.update(dt);
  },

  draw(ctx) {
    // найти самую нижнюю сцену, которую нужно рисовать
    let start = this.stack.length - 1;
    while (start > 0 && this.stack[start].transparent) start--;
    for (let i = Math.max(0, start); i < this.stack.length; i++) this.stack[i].draw(ctx);
    if (this.fade.a > 0) {
      ctx.globalAlpha = this.fade.a;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, G.screen.W, G.screen.H);
      ctx.globalAlpha = 1;
    }
  },
};
