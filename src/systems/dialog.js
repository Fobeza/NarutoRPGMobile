// Сцена диалога: окно внизу экрана, портрет, печать по буквам, выбор ответа.
// Использование: G.dialog.start('script_id', { onEnd })
G.dialog = (() => {
  const BOX_H = 50;
  const LINES = 3;
  const SPEEDS = [0, 30, 55, 120]; // символов/сек по настройке textSpeed (0 — мгновенно)

  function start(scriptId, opts = {}) {
    const run = G.script.runner(scriptId);
    const scene = makeScene(run, opts);
    G.scenes.push(scene);
    return scene;
  }

  // Короткие реплики без отдельного сценария:
  //   G.dialog.say(['Текст', { who: 'villager_m', name: 'Теучи', text: '...' }])
  let tmpN = 0;
  function say(lines, opts = {}) {
    const id = '_say' + (++tmpN % 8);
    const ops = lines.map((l) => (typeof l === 'string' ? { op: 'say', who: null, text: l } : { op: 'say', who: l.who || null, name: l.name || null, text: l.text }));
    ops.push({ op: 'end' });
    G.script.library[id] = { id, ops, labels: {} };
    return start(id, opts);
  }

  function makeScene(run, opts) {
    const S = {
      name: 'dialog:' + run.id,
      transparent: true,
      cur: null,         // текущая операция
      pages: [],         // страницы текста (массивы строк)
      page: 0,
      shown: 0,          // показано символов на странице
      tAcc: 0,
      blink: 0,
      choiceIdx: 0,
      bottom: opts.bottom != null ? opts.bottom : 22, // отступ снизу (над строкой цели)

      enter() { this.advance(); },

      advance() {
        const op = run.next();
        this.cur = op;
        if (op.op === 'end') { G.scenes.pop(); opts.onEnd && opts.onEnd(); return; }
        if (op.op === 'say') { this.setText(op.text, op.who); this.lastWho = op.who; this.whoName = op.name || null; this.lastName = this.whoName; }
        if (op.op === 'choice') {
          this.choiceIdx = 0;
          // вопрос показывается с портретом последнего говорящего
          this.setText(op.prompt || this.lastText || '', this.lastWho || null, true); this.whoName = this.lastName || null;
          if (!op.prompt) this.shown = Infinity;
        }
      },

      setText(text, who, keepPortrait) {
        if (!keepPortrait) this.lastText = text;
        const vars = { name: G.state.hero.name };
        text = G.util.fmt(text, vars);
        const hasPortrait = who && G.chars.DEFS[who];
        const textW = G.screen.W - 16 - (hasPortrait ? 36 : 0);
        const lines = G.font.wrap(text, textW);
        this.pages = [];
        for (let i = 0; i < lines.length; i += LINES) this.pages.push(lines.slice(i, i + LINES));
        if (!this.pages.length) this.pages = [['']];
        this.page = 0;
        this.shown = SPEEDS[G.storage.settings.textSpeed] === 0 ? Infinity : 0;
        this.tAcc = 0;
        this.who = who;
      },

      pageLen() { return this.pages[this.page].reduce((s, l) => s + [...l].length, 0); },

      update(dt) {
        this.blink += dt;
        const total = this.pageLen();
        if (this.shown < total) {
          const sp = SPEEDS[G.storage.settings.textSpeed] || 55;
          const before = Math.floor(this.shown);
          this.shown += dt * sp;
          if (Math.floor(this.shown) !== before && Math.floor(this.shown) % 2 === 0) G.audio.sfx.blip();
        }
        const done = this.shown >= total;
        const I = G.input;

        if (this.cur.op === 'choice' && done && this.page === this.pages.length - 1) {
          const n = this.cur.options.length;
          if (I.repeat('up', dt)) { this.choiceIdx = (this.choiceIdx + n - 1) % n; G.audio.sfx.select(); }
          if (I.repeat('down', dt)) { this.choiceIdx = (this.choiceIdx + 1) % n; G.audio.sfx.select(); }
          // тап по варианту
          if (I.tapNow) {
            const hit = this.choiceHit(I.tapNow);
            if (hit >= 0) { this.choiceIdx = hit; this.pick(); return; }
          }
          if (I.pressed('a')) this.pick();
          return;
        }

        if (I.pressed('a') || I.pressed('b') || I.tapNow) {
          if (!done) { this.shown = total; return; }
          if (this.page < this.pages.length - 1) { this.page++; this.shown = SPEEDS[G.storage.settings.textSpeed] === 0 ? Infinity : 0; return; }
          G.audio.sfx.select();
          this.advance();
        }
      },

      pick() {
        const opt = this.cur.options[this.choiceIdx];
        G.audio.sfx.confirm();
        run.jump(opt.label);
        this.advance();
      },

      // геометрия окна выбора
      choiceRect() {
        const opts = this.cur.options;
        const w = Math.min(G.screen.W - 8, Math.max(...opts.map((o) => G.font.measure(o.text))) + 22);
        const h = opts.length * 12 + 8;
        const x = G.screen.W - w - 4;
        const y = G.screen.H - this.bottom - BOX_H - h - 12; // выше таблички с именем
        return { x, y, w, h };
      },
      choiceHit(p) {
        const r = this.choiceRect();
        if (p.x < r.x || p.x > r.x + r.w || p.y < r.y || p.y > r.y + r.h) return -1;
        const i = Math.floor((p.y - r.y - 4) / 12);
        return i >= 0 && i < this.cur.options.length ? i : -1;
      },

      draw(ctx) {
        const W = G.screen.W, Hs = G.screen.H;
        const x = 2, y = Hs - this.bottom - BOX_H, w = W - 4, h = BOX_H;
        G.gfx.window(ctx, x, y, w, h, 'paper');

        let tx = x + 7;
        const who = this.who;
        if (who && G.chars.DEFS[who]) {
          const p = G.chars.portrait(who);
          ctx.fillStyle = G.PAL.ink;
          ctx.fillRect(x + 4, y + 6, 34, 34);
          ctx.drawImage(p, x + 5, y + 7);
          tx = x + 43;
        }
        // табличка с именем
        if (who) {
          const nm = this.whoName || G.chars.nameOf(who);
          const nw = G.font.measure(nm) + 10;
          ctx.fillStyle = G.PAL.ink; ctx.fillRect(x + 4, y - 9, nw + 2, 11);
          ctx.fillStyle = G.PAL.orange; ctx.fillRect(x + 5, y - 8, nw, 9);
          G.font.draw(ctx, nm, x + 10, y - 8, { color: G.PAL.white });
        }
        // текст
        const lines = this.pages[this.page];
        let left = Math.floor(this.shown);
        lines.forEach((ln, i) => {
          const n = [...ln].length;
          G.font.draw(ctx, ln, tx, y + 7 + i * 12, { color: G.PAL.ink, max: Math.max(0, left) });
          left -= n;
        });
        // индикатор «дальше»
        const done = this.shown >= this.pageLen();
        if (done && this.cur.op === 'say' && Math.floor(this.blink * 3) % 2 === 0) {
          G.font.draw(ctx, '▼', x + w - 12, y + h - 13, { color: G.PAL.orange });
        }
        // выбор
        if (this.cur.op === 'choice' && done && this.page === this.pages.length - 1) {
          const r = this.choiceRect();
          G.gfx.window(ctx, r.x, r.y, r.w, r.h, 'paper');
          this.cur.options.forEach((o, i) => {
            const sel = i === this.choiceIdx;
            if (sel) G.font.draw(ctx, '▶', r.x + 6, r.y + 5 + i * 12, { color: G.PAL.orange });
            G.font.draw(ctx, o.text, r.x + 14, r.y + 5 + i * 12, { color: sel ? G.PAL.ink : G.PAL.gray });
          });
        }
      },
    };
    return S;
  }

  return { start, say };
})();
