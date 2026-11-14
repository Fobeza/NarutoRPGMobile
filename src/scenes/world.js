// Сцена мира: ходьба по Конохе и интерьерам, смена карт, камера и главный цикл обновления.
// Части сцены — world_npc.js, world_actions.js, world_time.js, world_draw.js (подмешиваются через G.worldParts).
// pos: { map, x, y, dir }
G.scenes.register('world', (pos) => {
  const T = G.CONFIG.TILE;
  const HUD_H = 28, STRIP_H = 22;
  const FADE_BEHIND = { tree: 1, pine: 1, planter: 1, lamp: 1 };

  const S = {
    name: 'world',
    map: null,
    player: null,
    cam: { x: 0, y: 0 },
    time: 0,
    toast: null,
    banner: null,
    place: '',
    others: [],
    visCount: 0,

    enter() {
      this.player = G.actors.make('hero', 0, 0);
      this.setMap(pos || G.world.startPos());
      this.pendingTalk = pos && pos.intro;
      // старое сохранение: зачислен, но вступительный тест не пройден
      if (!this.pendingTalk && G.state.started && G.state.flags.enrolled && !G.hero.ready()) this.pendingTalk = 'iruka_retest';
      this.notes = [];
      this._onQuest = G.events.on('quest', (type, id, extra) => this.questNote(type, id, extra));
    },
    exit() { G.events.off('quest', this._onQuest); },

    // Уведомления о заданиях: «📜 Новое задание», «✔ Шаг выполнен», «★ Задание выполнено»
    questNote(type, id, extra) {
      const d = G.QUESTS[id], cat = G.QUEST_CATS[d.cat];
      const n = {
        new: { title: (d.cat === 'secret' ? '❓ Секрет найден' : cat.icon + ' Новое задание'), text: d.title, col: cat.color },
        step: { title: '✔ Шаг выполнен', text: extra, col: '#6ab04a' },
        done: { title: '★ Задание выполнено', text: d.title + (d.reward && d.reward.text ? ' · ' + d.reward.text : ''), col: G.PAL.yellow },
        fail: { title: 'x Задание провалено', text: d.title, col: '#c04a3a' },
      }[type];
      if (!n) return;
      n.t = 2.6;
      this.notes.push(n);
      while (this.notes.length > 2) this.notes.shift();
      this.goalFlash = 2.5;
      if (type === 'fail') G.audio.sfx.error(); else G.audio.sfx.confirm();
    },
    // Подсказка (онбординг): показывается один раз за игру
    tip(id, title, text) {
      if (G.state.flags['tip_' + id]) return;
      G.state.flags['tip_' + id] = 1;
      this.notes.push({ title, text, col: '#7ad0ff', t: 4.5, tip: true });
      while (this.notes.length > 2) this.notes.shift();
    },
    resume() { this.refreshNpcs(); },

    // NPC появляются по условиям и расписанию (G.life.visible)
    refreshNpcs() {
      const m = this.map;
      if (G.schedule) G.schedule.sync(this);
      this.npcs = m.npcs.filter((n) => G.life.visible(n));
      this.others = [this.player, ...this.npcs];
    },
    // Мягкое обновление по часам: те, кто сейчас на экране, не исчезают и не возникают из воздуха
    softRefresh() {
      if (G.schedule) G.schedule.sync(this);
      const m = this.map, cx = this.cam.x, cy = this.cam.y, W = G.screen.W / (this.z || 1), VH = this.viewH() / (this.z || 1);
      const onScreen = (n) => n.x > cx - 16 && n.x < cx + W + 16 && n.y > cy - 8 && n.y < cy + VH + 40;
      const cur = new Set(this.npcs);
      this.npcs = m.npcs.filter((n) => {
        const vis = G.life.visible(n);
        if (vis === cur.has(n)) return vis;
        return onScreen(n) ? cur.has(n) : vis;
      });
      this.others = [this.player, ...this.npcs];
    },

    // ---------- Смена карты ----------
    setMap(p) {
      let m = G.world.get(p.map);
      const pl = this.player;
      if (m.id !== p.map) { p = G.world.startPos(); m = G.world.get(p.map); }
      if (p.entry) { pl.x = m.spawn.x; pl.y = m.spawn.y; pl.dir = m.spawn.dir; }
      else { pl.x = p.x; pl.y = p.y; pl.dir = p.dir || 'down'; }
      pl.vx = pl.vy = 0; pl.moving = false;
      pl.jump = null; pl.roof = !!(p.roof && m.outdoor && G.roofs && G.roofs.at(m, pl.x, pl.y));
      this.map = m;
      if (G.villageStories) G.villageStories.sync(m);
      // Сохранение могло остаться на месте передвинутой мебели.
      if (!pl.roof && m.blockedRect(G.actors.feet(pl))) {
        const free=G.nav.nearestWalkable(m,G.nav.walkGrid(m),Math.floor(pl.x/T),Math.floor(pl.y/T));
        if(free){pl.x=free[0]*T+8;pl.y=free[1]*T+12;}
      }
      this._actionKey=null; this._streetScene=null;
      if(G.villageDaily)G.villageDaily.clear(this);
      this.refreshNpcs();
      this.lastDistrict = null;
      this.updatePlace(true);
      this.updateCamera();
      this.savePos();
      this.trail = null;
      G.quests.onEnterMap(m);
      if (m.id==='konoha') G.nav.reveal(pl.x, pl.y);
      if (G.state.started) G.storage.save(G.state); // автосейв при входе/выходе из зданий
    },

    goTo(p) {
      G.audio.sfx.confirm();
      G.scenes.fadeOut(() => this.setMap(p), 5);
    },

    enterBuilding(b) {
      if (!b.interior) { this.showToast('Заперто.'); G.audio.sfx.error(); return; }
      if (b.tplId === 'hero_home' && !G.state.flags.home_seen) { G.state.flags.home_seen = 1; this.pendingTalk = 'home_first'; }   // первый раз в новом доме
      G.audio.sfx.door();
      this.goTo({ map: b.interior.id, entry: true });
      if (b.occupantNames) this.showToast('Здесь живут: ' + b.occupantNames.join(', '));
    },

    exitBuilding() {
      const b = this.map.building;
      if (!b) return;
      G.audio.sfx.door();
      this.goTo(G.world.outsideOf(b));
    },

    savePos() {
      const p = this.player;
      G.state.pos = { map: this.map.id, x: Math.round(p.jump ? p.jump.x1 : p.x), y: Math.round(p.jump ? p.jump.y1 : p.y), dir: p.dir };
      if (p.roof || (p.jump && p.jump.toRoof)) G.state.pos.roof = 1;
    },

    updatePlace(force) {
      const m = this.map, p = this.player;
      let place = m.name;
      if (m.outdoor) {
        const d = m.districtAt(Math.floor(p.x / T), Math.floor(p.y / T));
        const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
        const r = m.roads && m.roads.find((r) => tx >= r.rect.x && ty >= r.rect.y && tx < r.rect.x + r.rect.w && ty < r.rect.y + r.rect.h);
        place = d ? d.label : r ? G.ROADS[r.type].name : 'Коноха';
      }
      if (place !== this.place || force) {
        this.place = place;
        this.banner = { text: place, t: 2.4 };
      }
    },

    // ---------- Обновление ----------
    update(dt) {
      this.time += dt;
      const I = G.input, p = this.player, m = this.map;
      if (this.pendingTalk && !G.scenes.busy) { const t = this.pendingTalk; this.pendingTalk = null; this.talk(t); return; }
      if (this.cine) { G.cine.update(this, dt); for (const n of this.npcs) if (!n._cine && n.moving) { n.moving = false; n.anim = 0; } this.updateCamera(); return; }
      if (G.game.pending && !G.scenes.busy) {
        const a = G.game.pending; G.game.pending = null;
        if (a === 'sleep') this.doSleep();
        else if (a === 'home') this.goHome();
        else if (typeof a === 'object' && G.flow[a.type]) G.flow[a.type](a, this);
        else if (a === 'charcreate') G.scenes.push(G.scenes.make('charcreate', () => this.talk('iruka_after_test')));
        else if (a === 'askname') G.scenes.push(G.scenes.make('nameinput', () => this.talk('hosp_after_name')));
        return;
      }
      if (G.story && G.story.poll(this)) return;
      if (this.goalFlash) this.goalFlash = Math.max(0, this.goalFlash - dt);

      if (I.pressed('menu')) { G.audio.sfx.select(); G.scenes.push(G.scenes.make('menu')); return; }
      if (I.pressed('map')) { G.audio.sfx.select(); G.scenes.push(G.scenes.make('mapview', this)); return; }
      if (I.pressed('goal')) this.showTrail();
      if (this.trail) { this.trail.t += dt; if (this.trail.t > this.trail.dur) this.trail = null; }

      if (G.debug.on && I.tapNow && I.tapNow.y > HUD_H && I.tapNow.y < G.screen.H - STRIP_H) {
        const z = this.z || 1, tx = I.tapNow.x / z + this.cam.x, ty = (I.tapNow.y - HUD_H) / z + this.cam.y;
        if (!m.blockedRect(G.actors.feet(p, tx, ty))) { p.x = tx; p.y = ty; }
      }

      // движение игрока (во время прыжка по крышам — без управления)
      if (p.jump) G.roofs.updateJump(this, dt);
      const ax = p.jump ? { x: 0, y: 0 } : I.axis();
      const v = G.state.vars;
      const tired = v.fatigue > 90;
      if (I.held('b') && tired && (ax.x || ax.y) && !G.state.daily.noRun) { G.state.daily.noRun = 1; this.showToast('Нет сил бежать'); }
      const run = I.held('b') && !tired;
      const speed = (run ? G.CONFIG.RUN_SPEED * G.hero.runMul() : G.CONFIG.WALK_SPEED * G.hero.walkMul()) * dt;
      G.actors.playerContact(m, p, ax.x, ax.y, this.others, dt);
      p.moving = !!(ax.x || ax.y);
      if (p.moving) {
        if (ax.x && ax.y) {
          const h = ax.x > 0 ? 'right' : 'left', v = ax.y > 0 ? 'down' : 'up';
          if (p.dir !== h && p.dir !== v) p.dir = Math.abs(ax.x) >= Math.abs(ax.y) ? h : v;
        } else p.dir = ax.x > 0 ? 'right' : ax.x < 0 ? 'left' : ax.y > 0 ? 'down' : 'up';
        const px = p.x, py = p.y;
        if (!(G.roofs && G.roofs.move(this, p, ax, speed))) G.actors.move(m, p, ax.x * speed, ax.y * speed, this.others);
        // упёрся в стену или в человека — стоим на месте: без шагов и без анимации ходьбы
        const shifted = Math.abs(p.x - px) + Math.abs(p.y - py) > speed * 0.25;
        p.moving = shifted;
        if (shifted) {
          p.anim += dt * (run ? 12 : 8);
          p.stepT -= dt;
          if (p.stepT <= 0) { G.audio.sfx.step(G.ambience.ground(this.map, p.x, p.y)); p.stepT = run ? 0.18 : 0.28; }
        } else { p.anim = 0; p.stepT = 0.06; }
      } else { p.anim = 0; p.vx = p.vy = 0; p.stepT = 0.06; }
      // Бег — «джойстик до упора», и на маленьком экране палец упирается в край раньше. Десять секунд шагом
      // на джойстике без единого рывка — подсказываем один раз, где это лечится.
      if (I.stick.on && p.moving && !run && !tired && !G.state.flags.tip_run) {
        this._walkT = (this._walkT || 0) + dt;
        if (this._walkT > 10) this.tip('run', '▸ Бег', 'Отведи джойстик до упора. Не хватает экрана? Настройки → Джойстик: ЧУТКО');
      } else if (run) G.state.flags.tip_run = 1;

      // NPC: обновляем только тех, кто рядом
      for (const n of this.npcs) {
        if (!m.outdoor || (Math.abs(n.x - p.x) < 260 && Math.abs(n.y - p.y) < 260)) this.updateNpc(n, dt);
      }

      if (I.pressed('a')) {this.interact();if(G.scenes.busy||G.scenes.top()!==this)return;}

      // Скорость часов задаётся G.life.RATE.
      if (G.state.started && !G.scenes.busy && G.scenes.top() === this) {
        const before = v.min;
        if (G.life.tick(dt, run && p.moving, p.moving)) { this.onTime(before, v.min); if (G.scenes.top() !== this || G.scenes.busy) return; }
      }

      if (G.life2) G.life2.poll(this, dt);
      if (G.villageStories) G.villageStories.update(this,dt);
      if (G.villageDaily) G.villageDaily.update(this,dt);
      if (G.roofPatrol) G.roofPatrol.update(this,dt);
      if (G.guards) G.guards.update(this, dt);
      this.updateCamera();
      this.updatePlace(false);
      this.savePos();
      if (m.id==='konoha') G.nav.reveal(p.x, p.y);
      // своя метка достигнута
      const mk = G.state.marker;
      if (mk && m.outdoor && Math.hypot(mk.x * T + 8 - p.x, mk.y * T + 8 - p.y) < 24) {
        G.state.marker = null; this.showToast('Метка достигнута: ' + (mk.label || 'место')); G.audio.sfx.confirm();
      }
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
      if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    },

    // Остальные методы сцены живут в частях: world_npc.js (жители), world_actions.js (кнопка A, лавки),
    // world_time.js (часы, сон, обмороки) и world_draw.js (отрисовка) — их подмешивает цикл в конце фабрики.

    showToast(text) { this.toast = { text, t: 2.2 }; },
    viewH() { return G.screen.H - HUD_H - STRIP_H; },
    // Масштаб: в помещениях комната крупнее (вписывается в экран), на улице — 1
    zoom() {
      const m = this.map;
      if (!m || m.outdoor !== false) return 1;
      const W = G.screen.W, VH = this.viewH();
      const z = Math.min(W / (m.w * T + 8), VH / (m.h * T + 40));
      return Math.max(1, Math.min(3, Math.floor(z * 4) / 4));
    },

    updateCamera() {
      const z = this.z = this.zoom();
      const W = G.screen.W / z, VH = this.viewH() / z, m = this.map, p = this.player;
      const mw = m.w * T, mh = m.h * T;
      let fx = p.x, fy = p.y;
      const ct = G.cine && G.cine.camTarget();
      if (ct) {
        const k = this.camPos ? 0.12 : 1; this.camPos = this.camPos || { x: p.x, y: p.y };
        this.camPos.x += (ct.x - this.camPos.x) * k; this.camPos.y += (ct.y - this.camPos.y) * k; fx = this.camPos.x; fy = this.camPos.y;
      } else if (this.camPos && G.cine && G.cine.active) {
        this.camPos.x += (p.x - this.camPos.x) * 0.12; this.camPos.y += (p.y - this.camPos.y) * 0.12; fx = this.camPos.x; fy = this.camPos.y;
      } else this.camPos = null;
      this.cam.x = mw <= W ? Math.round((mw - W) / 2) : G.util.clamp(Math.round(fx - W / 2), 0, mw - W);
      this.cam.y = mh <= VH ? Math.round((mh - VH) / 2) : G.util.clamp(Math.round(fy - 10 - VH / 2), 0, mh - VH);
    },

    debugInfo() {
      const p = this.player, m = this.map;
      return [
        `${m.id}  ${Math.round(p.x)},${Math.round(p.y)}  тайл ${Math.floor(p.x / T)},${Math.floor(p.y / T)}`,
        `объектов ${m.objects.length}  видно ${this.visCount}  NPC ${m.npcs.length}`,
        `чанков ${m.chunks.size}  генерация ${G.world.genMs || 0} мс`,
        `след A*: ${this.trailMs || 0} мс  цель: ${(G.nav.current() || {}).label || '—'}`,
        'Тап по карте — телепорт',
      ];
    },
  };
  for (const part of G.worldParts || []) Object.assign(S, part({ T, HUD_H, STRIP_H, FADE_BEHIND }));
  return S;
});
