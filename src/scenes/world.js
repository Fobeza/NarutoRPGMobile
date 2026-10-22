// Сцена мира: ходьба по Конохе и интерьерам, двери, разговоры, слои, камера.
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
      const tired = v.energy < 10 || v.food <= 0;
      if (I.held('b') && tired && (ax.x || ax.y) && !G.state.daily.noRun) { G.state.daily.noRun = 1; this.showToast(v.food <= 0 ? 'Голодный — не до бега' : 'Нет сил бежать'); }
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

      // NPC: обновляем только тех, кто рядом
      for (const n of this.npcs) {
        if (!m.outdoor || (Math.abs(n.x - p.x) < 260 && Math.abs(n.y - p.y) < 260)) this.updateNpc(n, dt);
      }

      if (I.pressed('a')) {this.interact();if(G.scenes.busy||G.scenes.top()!==this)return;}

      // Скорость часов задаётся G.life.RATE.
      if (G.state.started && !G.scenes.busy && G.scenes.top() === this) {
        const before = v.min;
        if (G.life.tick(dt, run && p.moving)) { this.onTime(before, v.min); if (G.scenes.top() !== this || G.scenes.busy) return; }
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


    // --- навигация NPC по клеткам: никаких шагов в стены ---
    npcWalk(tx, ty) {
      const T = G.CONFIG.TILE, m = this.map;
      const c = m._wk || (m._wk = new Map()), k = tx * 4096 + ty;
      let v = c.get(k);
      if (v === undefined) {
        v = tx >= 1 && ty >= 1 && tx < m.w - 1 && ty < m.h - 1 && !m.blockedRect({ x: tx * T + 2, y: ty * T + 7, w: 12, h: 7 });
        if (v && m.outdoor) { const id = m.get(tx, ty); v = id !== G.tiles.ID.WATER && id !== G.tiles.ID.DEEP; }
        c.set(k, v);
      }
      return v;
    },
    snapNpc(n) {
      const T = G.CONFIG.TILE, x0 = Math.floor(n.x / T), y0 = Math.floor(n.y / T);
      if (this.npcWalk(x0, y0)) return;
      for (let r = 1; r <= 4; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
        if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue;
        if (this.npcWalk(x0 + a, y0 + b)) { n.x = (x0 + a) * T + 8; n.y = (y0 + b) * T + 12; n.home = { x: n.x, y: n.y }; return; }
      }
    },
    planPath(n) {
      const T = G.CONFIG.TILE, sx = Math.floor(n.x / T), sy = Math.floor(n.y / T);
      const R = Math.max(2, Math.min(12, Math.round(n.wanderR / T) + 1)), hx = n.home.x, hy = n.home.y;
      const prev = new Map([[sx * 4096 + sy, null]]), dist = new Map([[sx * 4096 + sy, 0]]), q = [[sx, sy]], cand = [];
      for (let i = 0; i < q.length; i++) {
        const [x, y] = q[i], d = dist.get(x * 4096 + y);
        if (d >= 2 && Math.hypot(x * T + 8 - hx, y * T + 12 - hy) <= n.wanderR + 4) cand.push([x, y]);
        if (d >= R) continue;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + a, ny = y + b, k = nx * 4096 + ny;
          if (dist.has(k) || !this.npcWalk(nx, ny)) continue;
          dist.set(k, d + 1); prev.set(k, [x, y]); q.push([nx, ny]);
        }
      }
      if (!cand.length) return null;
      let t = cand[Math.floor(Math.random() * cand.length)];
      const path = [];
      while (t && !(t[0] === sx && t[1] === sy)) { path.unshift(t); t = prev.get(t[0] * 4096 + t[1]); }
      return path;
    },

    updateNpc(n, dt) {
      if (G.residents && G.residents.tick(this, n, dt)) {if(G.villageDaily)G.villageDaily.travelling(n);return;}
      if (G.villageDaily && G.villageDaily.tickNpc(this,n,dt)) return;
      n.aiT -= dt;
      if (G.life2) G.life2.npcTick(this, n, dt);
      if (n.ai === 'wander') {
        if (!n._snap) { n._snap = 1; this.snapNpc(n); }
        if (!n.path || !n.path.length) {
          n.moving = false; n.anim = 0;
          if (n.aiT <= 0) {
            n.path = this.planPath(n);
            n.aiT = n.path && n.path.length ? 0 : 1 + Math.random() * 2.5;
            if (!n.path || !n.path.length) { n.path = null; if (Math.random() < 0.5) n.dir = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)]; }
            n.stuck = 0;
          }
        } else {
          const T = G.CONFIG.TILE, [tx, ty] = n.path[0];
          const px = tx * T + 8, py = ty * T + 12, dx = px - n.x, dy = py - n.y;
          if (Math.abs(dx) < 1.2 && Math.abs(dy) < 1.2) { n.path.shift(); if (!n.path.length) { n.aiT = 1 + Math.random() * 3; n.moving = false; } }
          else {
            const sp = (n.speed || 30) * dt, ax = Math.abs(dx) > 1.2;
            n.dir = ax ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
            const step = Math.min(sp, ax ? Math.abs(dx) : Math.abs(dy));
            const b = n.x + n.y * 10000;
            const v = G.actors.DIRV[n.dir];
            G.actors.move(this.map, n, v[0] * step, v[1] * step, this.others);
            n.moving = true; n.anim += dt * 6;
            if (n.x + n.y * 10000 === b) { n.stuck = (n.stuck || 0) + dt; if (n.stuck > 0.8) { n.path = null; n.moving = false; n.aiT = 0.5 + Math.random(); } } else n.stuck = 0;
          }
        }
      } else if (n.ai === 'idle' && n.aiT <= 0) {
        n.aiT = 2 + Math.random() * 4;
        if (Math.random() < 0.35) n.dir = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
      }
    },

    // ---------- Взаимодействие (A) ----------
    doorAction() {
      const p=this.player,m=this.map;if(p.roof||p.jump)return null;
      const v=G.actors.DIRV[p.dir],fx=p.x+v[0]*12,fy=p.y-3+v[1]*12,feet=G.actors.feet(p);
      for(const w of m.warps){
        if(w.dir!==p.dir||(!w.to.back&&!w.building))continue;
        const r=w.rect,near=fx>=r.x-3&&fx<=r.x+r.w+3&&fy>=r.y-8&&fy<=r.y+r.h+8;
        if(!near&&!G.util.rectsOverlap(feet,r))continue;
        const b=w.building;
        return {show:true,label:w.to.back?'Выйти':'Войти',title:w.to.back?'На улицу':b.name,
          targetRect:b?.door?{x:b.door.tx*T+1,y:b.door.ty*T,w:14,h:16}:r,
          run:()=>w.to.back?this.exitBuilding():this.enterBuilding(b)};
      }
      return null;
    },
    // probeAction() ничего не делает, а только ищет, что случится по A: { run, label, show } или null.
    // show — «заметное» действие (разговор, дверь, рыбалка…): для него на сенсорном экране всплывает кнопка.
    // Табличка с названием здания тоже действие, но кнопку ради неё не показываем.
    probeAction() {
      const p = this.player, m = this.map;
      if (p.jump) return null;
      const door=this.doorAction();if(door)return door;
      if (G.roofs && p.roof) {
        const a=G.roofs.action(this);
        return a?{show:true,label:a.label,title:a.kind==='jump'?'Следующая крыша':'Место приземления',targetRect:{x:a.point.x-6,y:a.point.y-5,w:12,h:8},run:()=>G.roofs.interact(this)}:null;
      }
      const v = G.actors.DIRV[p.dir];
      const fx = p.x + v[0] * 12, fy = p.y - 3 + v[1] * 12;

      // NPC
      let best = null, bd = 99;
      for (const n of [...this.npcs,...(G.villageStories?G.villageStories.actors(this):[])]) {
        const d = Math.hypot(n.x - fx, n.y - 3 - fy);
        const reach = n.reach || 15;
        if (d < reach && d < bd) { bd = d; best = n; }
      }
      if (best) {
        const shop = !G.quests.scriptFor(best.id) && best.shop;
        return { show: true, label: best._street?'Послушать':shop?'Торговать':G.villageDaily?.label(best)||'Говорить', title:best.name||G.chars.nameOf(best.id),
          targetRect:{x:best.x-8,y:best.y-23,w:16,h:24},run: () => {
          if (!best.reach) best.dir = G.actors.OPP[p.dir];
          best.moving = false; best.anim = 0;
          G.audio.sfx.select();
          if(best._street){this.talk(best.talk);return;}
          const qs = G.quests.scriptFor(best.id);
          if (qs) this.talk(qs);
          else if (G.villageStories && G.villageStories.greet(best,this)) return;
          else if (G.villageDaily && G.villageDaily.talk(best,this)) return;
          else if (best.shop) this.openShop(best);
          else if (G.FRIENDS[best.id] && G.state.flags.day2_intro && !best.name) G.friends.menu(best, this);
          else this.talk(best.talk);
        } };
      }
      if(G.streetLife){const action=G.streetLife.probe(this);if(action)return action;}
      // объекты с описанием
      const near = m.query({ x: fx - 10, y: fy - 10, w: 20, h: 20 });
      let bo = null, bdist = 99;
      for (const o of near) {
        if (!o.talk || o.isBuilding) continue;
        const r = o.box || { x: o.x - 8, y: o.y - 14, w: 16, h: 14 };
        const ex = { x: r.x - 6, y: r.y - 10, w: r.w + 12, h: r.h + 16 };
        if (fx >= ex.x && fx <= ex.x + ex.w && fy >= ex.y && fy <= ex.y + ex.h) {
          const d = Math.hypot(o.x - fx, o.y - 6 - fy);
          if (d < bdist) { bdist = d; bo = o; }
        }
      }
      if (bo) {
        const verbs={home_bed:'Отдохнуть',home_chest:'Сундук',home_desk:'Учиться',home_kitchen:'Готовить',board:'Поручения',train_throw:'Тренировка',train_dummy:'Тренировка'};
        const titles={futon:'Постель',chest:'Сундук',desk:'Письменный стол',shelf:'Книжная полка',window:'Окно',table:'Чайный столик',vase:'Цветы'};
        return {show:true,label:bo.actionLabel||verbs[bo.talk]||'Осмотреть',title:bo.title||titles[bo.kind]||'Предмет',targetRect:m.drawRect(bo),
          run:()=>{G.audio.sfx.select();this.talk(bo.talk);}};
      }
      // здания
      for (const o of near) {
        if (!o.isBuilding) continue;
        const r = { x: o.tx * T, y: o.ty * T, w: o.tw * T, h: o.th * T };
        if (fx < r.x || fx > r.x + r.w || fy < r.y || fy > r.y + r.h + 2) continue;
        if (o.talk) return { show: true, label: 'Осмотреть', title:o.name,targetRect:{x:o.x+o.ox,y:o.y+o.oy,w:o.w,h:o.h},run: () => this.talk(o.talk) };
        if (o.door && o.door.tx === Math.floor(fx / T) && p.dir === 'up') return { show: true, label: 'Войти', title:o.name,
          targetRect:{x:o.door.tx*T+1,y:o.door.ty*T,w:14,h:16},run: () => this.enterBuilding(o) };
        if (G.roofs && G.roofs.canClimb(this, o)) return { show: true, label: 'На крышу',title:o.name,
          targetRect:{x:p.x+v[0]*12-6,y:p.y+v[1]*12-10,w:12,h:10},run: () => G.roofs.climb(this, o) };
        return { show: false, run: () => { this.showToast(o.locked ? o.name + ' — заперто' : o.name); G.audio.sfx.blip(); } };
      }
      // Домашние животные уступают предметам, дверям и заданиям.
      if(G.villageDaily){const action=G.villageDaily.probe(this);if(action)return action;}
      // вода: рыбалка
      for (const k of [1, 1.8]) {
        const wx = p.x + v[0] * 12 * k, wy = p.y - 3 + v[1] * 12 * k;
        if (G.outdoor && G.outdoor.isWater(m, wx, wy)) return { show: true, label: 'Рыбалка', title:'Место для ловли',targetRect:{x:wx-6,y:wy-4,w:12,h:8},run: () => { G.audio.sfx.select(); G.outdoor.fish(this, G.outdoor.spotKind(m, wx, wy)); } };
      }
      return null;
    },
    currentAction() {
      const p=this.player,key=[this.time,this.map.id,p.x,p.y,p.dir,p.roof,!!p.jump].join(':');
      if(key!==this._actionKey){this._actionKey=key;this._action=this.probeAction();}
      return this._action;
    },
    interact() {
      const act = this.currentAction();
      this._actionKey=null;
      if (act) act.run();
    },

    // что показывать на сенсорном экране (engine/touch.js)
    touch() {
      if (this.cine || this.player.jump) return { sys: true };
      const act = this.currentAction();
      return { joy: true, sys: true, action: act && act.show ? { label: act.label } : null };
    },

    talk(t) {
      if (!t) return;
      const onEnd = () => this.refreshNpcs();
      if (typeof t === 'string') G.dialog.start(t, { bottom: STRIP_H + 2, onEnd });
      else G.dialog.say(t, { bottom: STRIP_H + 2, onEnd });
    },

    // ---------- Лавки ----------
    openShop(n) {
      const shop = G.SHOPS[n.shop];
      const g = G.game, min = g.v.min;
      const keeper = { who: n.id, name: n.name || G.chars.nameOf(n.id) };
      if (min < shop.hours[0] || min >= shop.hours[1]) {
        const txt = min >= shop.hours[1] ? `Закрыто! Приходи завтра к ${g.clock(shop.hours[0])}.` : `Ещё закрыто. Открываемся в ${g.clock(shop.hours[0])}.`;
        this.talk([Object.assign({ text: txt }, keeper)]);
        return;
      }
      const buy = () => G.scenes.push(G.scenes.make('shop', n.shop, {
        title: n.shopTitle || keeper.name,
        onClose: (bought) => this.afterShop(n.shop, bought),
      }));
      if (shop.buys && shop.buys.some((id) => G.game.count(id) > 0)) {
        G.scenes.push(G.scenes.make('pick', { title: keeper.name, text: shop.greet, options: [{ label: 'Купить' }, { label: 'Продать', desc: 'Улов и травы — за половину цены.' }, { label: 'Уйти' }] }, (i) => {
          if (i === 0) buy(); else if (i === 1) G.outdoor.sellMenu(n, this);
        }));
      } else buy();
    },
    afterShop(shopId, bought) {
      const f = G.state.flags;
      if (shopId === 'ichiraku' && G.quests.active('day1') && f.naruto_invited && !f.ramen_done) {
        const ate = bought.some((b) => G.ITEMS[b.id].ramen);
        this.talk(ate ? 'ramen_day1' : 'naruto_noramen');
      }
    },

    // ---------- Время: события по часам ----------
    onTime(prev, now) {
      const v = G.state.vars, m = this.map, d = G.state.daily;
      const crossed = (t) => prev < t && now >= t;
      const every = (k) => Math.floor(prev / k) !== Math.floor(now / k);
      if (every(10)) this.softRefresh();
      if (every(120) && G.state.started) G.storage.save(G.state);          // автосейв раз в 2 часа
      // подсказки онбординга
      if (m.outdoor) this.tip('clock', '⏰ Время идёт', `Игровая минута — ${(1 / G.life.RATE).toFixed(1)} сек. В меню и диалогах часы стоят`);
      if (m.outdoor && G.life.raining()) this.tip('rain', '☂ Дождь', 'Многие сидят по домам, настроение чуть падает');
      if (crossed(19 * 60)) this.tip('evening', '🌙 Вечер', 'Лавки закрываются в 19–23 часа. Смотри часы на карте');
      // лавка закрывается
      const shop = m.building && G.SHOPS[m.building.tplId];
      if (shop && crossed(shop.hours[1] - 15)) this.showToast('Лавка закроется через 15 минут');
      if (shop && crossed(shop.hours[1])) this.showToast('Лавка закрылась');
      // нужды
      if (v.food < 25 && !d.hungry) { d.hungry = 1; this.showToast('Живот урчит... Пора поесть'); this.tip('food', '🍜 Сытость', 'Еда — в Ичираку, данго-лавке или дома (рис бесплатно)'); }
      if (v.food <= 0 && !d.starving) { d.starving = 1; this.notes.push({ title: 'x Голод!', text: 'Энергия тает вдвое быстрее', col: '#c04a3a', t: 3 }); }
      if (v.energy < 20 && !d.tired) { d.tired = 1; this.showToast('Ты устал... Пора отдохнуть'); }
      if (v.energy <= 0) return this.faint('tired');
      // ночь
      if (crossed(22 * 60)) this.tip('night', '🌙 Поздно', 'С 23:00 ученикам нельзя на улицу — патруль отправит домой');
      if (crossed(23 * 60) && m.outdoor) { this.notes.push({ title: '🌙 Комендантский час', text: 'Ученикам пора по домам!', col: '#9ab0ff', t: 3 }); G.audio.sfx.error(); }
      if (now >= 26 * 60) return this.faint('late');
      if (m.outdoor && now >= 23 * 60 + 30 && every(10) && Math.random() < 0.3) this.talk('patrol_curfew');
    },

    // Обморок: от усталости днём — больница, поздно ночью — сон где стоишь
    faint(kind) {
      const v = G.state.vars;
      if ((kind === 'tired' || kind === 'beaten') && v.min < 21 * 60) {
        G.scenes.fadeOut(() => {
          const hb = G.world.konoha().buildings.find((b) => b.tplId === 'hospital');
          if (hb && hb.interior) this.setMap({ map: hb.interior.id, entry: true });
          G.game.advance(180);
          v.energy = 35; G.game.mood(-10);
          G.game.note('Обморок от усталости — очнулся в больнице');
          this.pendingTalk = 'faint_hospital';
        }, 1.2);
      } else {
        G.game.note(kind === 'late' ? 'Уснул, не дойдя до кровати' : 'Свалился без сил');
        this.doSleep({ faint: true });
      }
    },
    // Патруль/сценарий отправляет домой
    goHome() {
      G.scenes.fadeOut(() => {
        const hm = G.world.get(G.world.heroHome().interior.id);
        this.setMap({ map: hm.id, x: 3 * 16 + 8, y: 5 * 16 + 4, dir: 'up' });
        G.game.advance(20);
      }, 2);
    },

    // ---------- Сон и новый день ----------
    doSleep(opts = {}) {
      G.scenes.fadeOut(() => {
        G.quests.onSleep(G.state.vars.day + 1);
        const sum = G.game.sleep(opts);
        const home = G.world.heroHome();
        const hm = G.world.get(home.interior.id);
        this.setMap({ map: hm.id, x: 3 * 16 + 8, y: 4 * 16 + 4, dir: 'down' });
        G.storage.save(G.state, { backup: true });   // утренняя резервная копия
        G.scenes.push(G.scenes.make('daysum', sum, () => {
          G.scenes.fadeOut(() => {
            G.scenes.pop();
            if (G.quests.done('day1') && !G.state.flags.day2_intro) { G.state.flags.day2_intro = 1; this.pendingTalk = 'day2_morning'; }
          }, 3);
        }));
      }, 2);
    },

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

    // ---------- Отрисовка ----------
    draw(ctx) {
      const z = this.z || 1, SW = G.screen.W, SVH = this.viewH();
      const W = SW / z, VH = SVH / z, m = this.map, p = this.player;
      const cx = this.cam.x, cy = this.cam.y;

      ctx.fillStyle = m.bg; ctx.fillRect(0, HUD_H, SW, SVH);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, HUD_H, SW, SVH); ctx.clip();
      if (z !== 1) { ctx.translate(0, HUD_H); ctx.scale(z, z); ctx.translate(-cx, -cy); }
      else ctx.translate(-cx, HUD_H - cy);

      m.drawGround(ctx, cx, cy, W, VH, this.time);
      if(G.villageDaily)G.villageDaily.drawUnder(ctx,this);
      G.fx.roomSunlight(ctx, m, G.state.vars.min);

      const vis = m.query({ x: cx, y: cy, w: W, h: VH });
      this.visCount = vis.length;
      G.fx.shadows(ctx, vis, m, G.state.vars.min);
      const list = [];
      for (const o of vis) {
        if (o.layer === 'floor') { ctx.drawImage(o.img, o.x + o.ox, o.y + o.oy); continue; }
        list.push(o);
      }
      if(G.streetLife)list.push(...G.streetLife.actors(this));
      if(G.villageStories)list.push(...G.villageStories.actors(this));
      if(G.villageDaily)list.push(...G.villageDaily.actors(this));
      if(G.guards)list.push(...G.guards.actors(this));
      for (const a of this.others) {
        if (a.x < cx - 16 || a.x > cx + W + 16 || a.y < cy - 4 || a.y > cy + VH + 24) continue;
        list.push(a);
      }
      list.sort((a, b) => (a.sortY != null ? a.sortY : a.y) - (b.sortY != null ? b.sortY : b.y));

      const pr = { x: p.x - 7, y: p.y - 19, w: 14, h: 19 };
      for (const it of list) {
        if (it === p && (p.roof || p.jump)) continue;   // на крыше героя рисуем поверх всего
        if(it._dailyAnimal){G.villageDaily.drawAnimal(ctx,this,it);continue;}
        if (it.id && it.dir) {
          if(it._street){ctx.save();ctx.globalAlpha*=this._streetScene.alpha;this.drawActor(ctx,it);ctx.restore();}
          else this.drawActor(ctx, it);
          continue;
        }
        if (it.anim) { G.world.drawAnim(ctx, it, this.time); continue; }
        let alpha = 1;
        if ((it.isBuilding || FADE_BEHIND[it.kind]) && it.sortY > p.y && it.sortY >= 0 && !p.roof && !p.jump) {
          const pad = it.isBuilding ? 10 : 2; // у зданий сверху прозрачный запас под трубы/эмблемы
          if (G.util.rectsOverlap(pr, { x: it.x + it.ox + 2, y: it.y + it.oy + pad, w: it.w - 4, h: it.h - pad })) alpha = 0.45;
        }
        if (alpha < 1) ctx.globalAlpha = alpha;
        const img=it.img;
        if(!G.villageDaily||!G.villageDaily.drawObject(ctx,this,it,img))ctx.drawImage(img, it.x + it.ox, it.y + it.oy);
        if (alpha < 1) ctx.globalAlpha = 1;
      }

      if(G.worldMotion)G.worldMotion.atmosphere(ctx,this,vis);
      if(G.roofPatrol)G.roofPatrol.draw(ctx,this,cx,cy,W,VH);
      if (p.roof || p.jump) G.roofs.drawPlayer(ctx, this);
      if(G.villageStories)G.villageStories.draw(ctx,this);
      if(G.villageDaily)G.villageDaily.draw(ctx,this,vis);
      if(G.streetLife)G.streetLife.draw(ctx,this);
      this.drawActionHint(ctx);

      // значки над NPC: ! — новое задание, ? — можно сдать, 💬 — новое знакомство
      const bob = Math.round(Math.sin(this.time * 5) * 1.5);
      for (const n of this.npcs) {
        if (n.x < cx - 8 || n.x > cx + W + 8 || n.y < cy || n.y > cy + VH + 30) continue;
        let ic = G.quests.iconFor(n.id);
        if (!ic && n.mark && !G.state.flags['met_' + n.mark]) ic = '💬';
        if (!ic) continue;
        const col = ic === '!' ? G.PAL.yellow : ic === '?' ? '#7ad0ff' : '#ffffff';
        G.font.draw(ctx, ic, n.x, n.y - 30 + bob, { color: col, outline: G.PAL.ink, align: 'center' });
      }
      if (G.life2) G.life2.drawEmotes(ctx, this, cx, cy, W, VH);
      this.drawTargetMark(ctx, cx, cy, W, VH, bob);
      this.drawTrail(ctx);

      this.drawLight(ctx, vis, cx, cy, W, VH);
      if (G.guards) G.guards.glow(ctx, this);
      G.fx.particles(ctx, cx, cy, W, VH, m, G.state.vars.min, this.time);
      if (this.map.outdoor && G.life.raining()) this.drawRain(ctx, cx, cy, W, VH);

      if (G.debug.on) {
        ctx.strokeStyle = 'rgba(255,0,0,.7)'; ctx.lineWidth = 1;
        for (const o of vis) if (o.box) ctx.strokeRect(o.box.x + 0.5, o.box.y + 0.5, o.box.w - 1, o.box.h - 1);
        ctx.strokeStyle = 'rgba(0,255,255,.8)';
        for (const w of m.warps) ctx.strokeRect(w.rect.x + 0.5, w.rect.y + 0.5, w.rect.w - 1, w.rect.h - 1);
        for (const a of this.others) { const b = G.actors.feet(a); ctx.strokeStyle = 'rgba(255,255,0,.8)'; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1); }
      }
      ctx.restore();
      {
      const W = SW, VH = SVH;
      G.fx.vignette(ctx, W, VH, HUD_H);

      this.drawMinimap(ctx, W);
      this.drawHud(ctx);
      this.drawStrip(ctx);
      this.drawNotes(ctx, W);

      if (this.banner) {
        const a = Math.min(1, this.banner.t * 2, (2.4 - this.banner.t) * 4);
        ctx.globalAlpha = Math.max(0, a);
        G.ui.title(ctx, this.banner.text, W / 2, HUD_H + 6, 0);   // красная лента с названием места
        ctx.globalAlpha = 1;
      }
      if (this.toast) {
        const w = Math.min(W - 8, G.font.measure(this.toast.text) + 18), h = 19;
        const x = Math.round((W - w) / 2), y = G.screen.H - STRIP_H - h - 6;
        G.ui.panel(ctx, x, y, w, h, 'night');
        G.font.draw(ctx, this.toast.text, W / 2, y + 5, { align: 'center', color: '#f4d46a', maxW: w - 12 });
      }
      if (G.cine) G.cine.drawBars(ctx, HUD_H, VH, W);
      this.drawArrow(ctx, W, VH);   // стрелка цели — поверх табличек и уведомлений
      }
    },

    hintsOn() { return G.storage.settings.hints !== false; },

    // ---------- Направление к цели ----------
    navHop() {
      const tgt = G.nav.current();
      if (!tgt) return null;
      const h = G.nav.hop(this.map, tgt);
      return h ? { tgt, h } : null;
    },

    // ▼ над целью (или над дверью/выходом), если она на экране
    // Рамка показывает ровно ту цель, которую использует кнопка A.
    drawActionHint(ctx) {
      if(G.scenes.top()!==this||G.scenes.busy||this.cine)return;
      const action=this.currentAction();if(!action||!action.show||!action.targetRect)return;
      const r=action.targetRect,x=Math.round(r.x-2),y=Math.round(r.y-2),w=Math.round(r.w+4),h=Math.round(r.h+4);
      const col=this.player.roof?'#b6e2d0':'#f0cc79';
      ctx.save();ctx.fillStyle=col;ctx.globalAlpha=0.8+Math.sin(this.time*5)*0.15;
      for(const [a,b,sx,sy] of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]]){
        ctx.fillRect(a+(sx<0?-4:0),b,5,1);ctx.fillRect(a,b+(sy<0?-4:0),1,5);
      }
      ctx.restore();
    },
    drawTargetMark(ctx, cx, cy, W, VH, bob) {
      if (!this.hintsOn()) return;
      const r = this.navHop();
      if (!r) return;
      const { tgt, h } = r;
      let x = h.x, y = h.y;
      if (h.final && tgt.npc) y = tgt.npc.y - 38;
      else if (h.exit) y -= 14;
      else y -= 26;
      if (x < cx || x > cx + W || y < cy - 6 || y > cy + VH) return;
      G.font.draw(ctx, '▼', x, y + bob * 2, { color: tgt.ok ? '#ff5a3a' : '#9a9aa8', outline: G.PAL.ink, align: 'center' });
    },

    // Стрелка у края экрана с расстоянием
    drawArrow(ctx, W, VH) {
      if (!this.hintsOn()) return;
      const r = this.navHop();
      if (!r) return;
      const { tgt, h } = r;
      const z = this.z || 1, sx = (h.x - this.cam.x) * z, sy = (h.y - this.cam.y) * z + HUD_H - 10;
      if (sx > 6 && sx < W - 6 && sy > HUD_H + 6 && sy < HUD_H + VH - 6) return;
      const ccx = W / 2, ccy = HUD_H + VH / 2;
      const dx = sx - ccx, dy = sy - ccy;
      const k = Math.min((W / 2 - 12) / Math.abs(dx || 1e-6), (VH / 2 - 12) / Math.abs(dy || 1e-6));
      const ax = ccx + dx * k, ang = Math.atan2(dy, dx);let ay = ccy + dy * k;
      if(G.storage.settings.minimap!==false&&ax>W-70&&ay<HUD_H+70)ay=HUD_H+76;
      const pulse = 1 + Math.sin(this.time * 6) * 0.12;
      ctx.save();
      ctx.translate(Math.round(ax), Math.round(ay)); ctx.rotate(ang); ctx.scale(pulse, pulse);
      ctx.fillStyle = G.PAL.ink;
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -7); ctx.lineTo(-3, 0); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = tgt.ok ? '#ff6a3a' : '#9a9aa8';
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, -5); ctx.lineTo(-2, 0); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
      // значок и расстояние — ближе к центру
      const m = G.nav.meters(this.map, this.player.x, this.player.y, tgt);
      const label = (h.exit ? 'выход' : h.door ? '' : '') + '≈' + m + ' м';
      const lx = ax - Math.cos(ang) * 22, ly = ay - Math.sin(ang) * 16;
      const icon = h.exit ? '' : tgt.icon + ' ';
      const txt = icon + label, tw = G.font.small.measure(txt) + 10;
      const bx = G.util.clamp(Math.round(lx - tw / 2), 2, W - tw - 2);let by = G.util.clamp(Math.round(ly - 5), HUD_H + 2, HUD_H + VH - 17);
      if(G.storage.settings.minimap!==false&&bx+tw>W-63&&by<HUD_H+64)by=HUD_H+68;
      G.ui.panel(ctx, bx, by, tw, 15, 'night');
      G.font.small.draw(ctx, txt, bx + 5, by + 4, { color: '#f4d46a' });
    },

    // Кнопка ЦЕЛЬ: светящийся след (A*) до цели на этой карте
    showTrail() {
      const r = this.navHop();
      if (!r) { this.showToast('Нет цели: выбери задание или метку'); G.audio.sfx.error(); return; }
      const p = this.player;
      const t0 = performance.now();
      const path = G.nav.path(this.map, p.x, p.y, r.h.x, r.h.y);
      this.trailMs = Math.round(performance.now() - t0);
      if (!path || path.length < 2) { this.showToast(path ? 'Цель рядом!' : 'Чутьё молчит: пути не видно'); G.audio.sfx.blip(); return; }
      this.trail = { pts: path, t: 0, dur: 4 + path.length * 0.03 };
      G.audio.sfx.puff();
      if (!G.state.flags.trail_hint) { G.state.flags.trail_hint = 1; this.showToast('Чутьё ниндзя: след ведёт к цели'); }
    },
    drawTrail(ctx) {
      const tr = this.trail;
      if (!tr) return;
      const fade = Math.min(1, (tr.dur - tr.t) / 0.8);
      const head = tr.t * 22;
      ctx.globalCompositeOperation = 'lighter';
      tr.pts.forEach(([tx, ty], i) => {
        if (i === 0) return;
        const ph = head - i;
        if (ph < 0) return;
        const glow = ph < 6 ? 1 - ph / 6 : 0;
        const a = (0.35 + glow * 0.65) * fade;
        const x = tx * T + 8, y = ty * T + 10;
        ctx.fillStyle = `rgba(120,220,255,${(a * 0.35).toFixed(3)})`; ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.fillStyle = `rgba(200,250,255,${a.toFixed(3)})`; ctx.fillRect(x - 1, y - 1, 2, 2);
      });
      ctx.globalCompositeOperation = 'source-over';
    },

    // ---------- Мини-карта ----------
    drawMinimap(ctx, W) {
      if(G.cartography){G.cartography.minimap(ctx,this,W);return;}
      if (G.storage.settings.minimap === false) return;
      const S = 48, x0 = W - S - 3, y0 = HUD_H + 3;
      const m = this.map, p = this.player;
      G.ui.panel(ctx, x0 - 3, y0 - 3, S + 6, S + 6, 'plank');
      ctx.fillStyle = '#14121c'; ctx.fillRect(x0, y0, S, S);
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, S, S); ctx.clip();
      let sc, ox, oy;
      if (m.outdoor) {
        sc = 1;
        const ptx = p.x / T, pty = p.y / T;
        ox = x0 + S / 2 - ptx; oy = y0 + S / 2 - pty;
        ctx.drawImage(m.overview(), Math.round(ox), Math.round(oy));
        // двери лавок
        ctx.fillStyle = '#ffd84a';
        for (const b of m.buildings) if (b.door && G.SHOPS[b.tplId]) ctx.fillRect(Math.round(ox + b.door.tx), Math.round(oy + b.door.ty), 1, 1);
      } else {
        sc = Math.max(2, Math.floor(Math.min((S - 4) / m.w, (S - 4) / m.h)));
        ox = x0 + Math.floor((S - m.w * sc) / 2); oy = y0 + Math.floor((S - m.h * sc) / 2);
        const ID = G.tiles.ID;
        for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
          const t = m.get(tx, ty);
          ctx.fillStyle = t === ID.VOID ? '#14121c' : t === ID.IWALL ? '#5a4a3a' : t === ID.MAT ? '#6ab04a' : '#c8a878';
          ctx.fillRect(ox + tx * sc, oy + ty * sc, sc, sc);
        }
        ctx.fillStyle = '#7a5a3a';
        for (const o of m.objects) if (o.box) ctx.fillRect(Math.round(ox + o.box.x / T * sc), Math.round(oy + o.box.y / T * sc), Math.max(1, Math.round(o.box.w / T * sc)), Math.max(1, Math.round(o.box.h / T * sc)));
      }
      const P2 = (wx, wy) => [Math.round(ox + wx / T * sc), Math.round(oy + wy / T * sc)];
      // NPC со значками
      for (const n of this.npcs) {
        const ic = G.quests.iconFor(n.id);
        if (!ic) continue;
        const [nx, ny] = P2(n.x, n.y);
        ctx.fillStyle = ic === '!' ? '#ffd84a' : '#7ad0ff'; ctx.fillRect(nx - 1, ny - 1, 3, 3);
      }
      // цель
      const r = this.navHop();
      if (r && Math.floor(this.time * 3) % 2 === 0) {
        const [hx, hy] = P2(r.h.x, r.h.y);
        const cxp = G.util.clamp(hx, x0 + 1, x0 + S - 2), cyp = G.util.clamp(hy, y0 + 1, y0 + S - 2);
        ctx.fillStyle = '#ff3a2a'; ctx.fillRect(cxp - 1, cyp - 1, 3, 3);
      }
      // игрок — стрелка по направлению взгляда
      const [px, py] = P2(p.x, p.y);
      const v = G.actors.DIRV[p.dir];
      ctx.fillStyle = '#ffffff'; ctx.fillRect(px - 1, py - 1, 3, 3);
      ctx.fillStyle = '#e8621a'; ctx.fillRect(px + v[0] * 2, py + v[1] * 2, 1, 1); ctx.fillRect(px, py, 1, 1);
      ctx.restore();
    },

    // Уведомления о заданиях
    drawNotes(ctx, W) {
      // таймер идёт по реальному времени, даже когда сверху диалог или лавка
      const now = performance.now(), dt = Math.min(0.1, (now - (this._noteT || now)) / 1000);
      this._noteT = now;
      if (this.notes.length) { this.notes[0].t -= dt; if (this.notes[0].t <= 0) this.notes.shift(); }
      const n = this.notes[0];
      if (!n) return;
      const a = Math.min(1, n.t * 3, (2.6 - n.t) * 5);
      ctx.globalAlpha = Math.max(0, a);
      const F = G.font.small, tw = Math.min(W - 8, Math.max(G.font.measure(n.title), F.measure(n.text)) + 26);
      const x = Math.round((W - tw) / 2), y = HUD_H + 28;
      G.ui.panel(ctx, x, y, tw, 36, 'frame');
      G.font.draw(ctx, n.title, W / 2, y + 8, { align: 'center', color: G.ui.C.redDark });
      let txt = n.text;
      while (F.measure(txt) > tw - 20 && txt.length > 4) txt = txt.slice(0, -2) + '…';
      F.draw(ctx, txt, W / 2, y + 22, { align: 'center', color: G.ui.C.ink });
      ctx.globalAlpha = 1;
    },

    // Освещение по времени суток + свет фонарей ночью
    // Дождь: серый тон и косые струи (в координатах экрана)
    drawRain(ctx, cx, cy, W, VH) {
      G.fx.rain(ctx,cx,cy,W,VH,this.map,this.time);
    },

    drawLight(ctx, vis, cx, cy, W, VH) {
      if (G.lighting) return G.lighting.draw(ctx, this, vis, cx, cy, W, VH);
      const L = G.game.light();
      if (!L) return;
      const m = this.map;
      const a = m.outdoor ? L[3] : L[3] * 0.35;
      ctx.fillStyle = `rgba(${L[0] | 0},${L[1] | 0},${L[2] | 0},${a.toFixed(3)})`;
      ctx.fillRect(cx, cy, W, VH);
      G.fx.windows(ctx, vis, m, (a - 0.12) / 0.3, this.time);
      if (!m.outdoor || a < 0.2) return;
      ctx.globalCompositeOperation = 'lighter';
      const k = Math.min(1, (a - 0.2) / 0.25);
      for (const o of vis) {
        const ly = o.kind === 'lamp' ? o.y - 24 : o.kind === 'stonelamp' ? o.y - 13 : null;
        if (ly == null) continue;
        const gr = ctx.createRadialGradient(o.x, ly, 1, o.x, ly, 26);
        gr.addColorStop(0, `rgba(255,190,90,${0.5 * k})`);
        gr.addColorStop(1, 'rgba(255,150,60,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(o.x - 26, ly - 26, 52, 52);
      }
      ctx.globalCompositeOperation = 'source-over';
    },

    drawActor(ctx, a) {
      if (G.lighting) G.lighting.actor(ctx, a, this.map, G.state.vars.min);
      const bounce = a.moving ? Math.abs(Math.sin(a.anim * Math.PI)) : 0;
      G.shade.shadow(ctx, a.x + 1, a.y - 1, 6 - bounce * .5, 2, 0.28);
      G.shade.shadow(ctx, a.x, a.y - 1, 3, 1, 0.23);   // V9: мягкая тень под ногами
      const frame = a.moving ? G.chars.WALK[Math.floor(a.anim) % 4] : 0;
      // жители: у каждого своя расцветка одежды (по номеру в списке жителей карты — одинаково между кадрами и загрузками)
      if (a._look === undefined) a._look = (a.id === 'villager_m' || a.id === 'villager_f') ? Math.floor(G.util.hash2(this.map.npcs.indexOf(a), 7, 91) * G.chars.LOOKS) : 0;
      const lift=G.villageDaily?G.villageDaily.lift(a,this.time):0;
      ctx.save();
      if (a._npcPass?.size) ctx.globalAlpha *= .65;
      if(G.villageDaily)G.villageDaily.drawCargo(ctx,this,a,true);
      if(!G.worldMotion||!G.worldMotion.actor(ctx,this,a,frame,lift))G.chars.draw(ctx, a.id, a.dir, frame, a.x, a.y-lift, a._look);
      ctx.restore();
      if(G.villageDaily){G.villageDaily.drawCargo(ctx,this,a);G.villageDaily.drawActorExtras(ctx,this,a);}
      if(a._guard)G.guards.lantern(ctx,a);
    },

    drawHud(ctx) {
      const W = G.screen.W, U = G.ui, F = G.font.small, C = U.C;
      U.panel(ctx, 0, 0, W, HUD_H, 'night');
      const g = G.game, v = g.v;
      F.draw(ctx, `${g.dayName()}, день ${v.day}`, 6, 5, { color: '#d8c8a0' });
      // часы: мигающее двоеточие, пока время идёт; значок погоды (ночью — луна)
      const wt = G.life.WEATHER[G.life.weather()];
      const night = g.isNight();
      const running = G.scenes.top() === this && !G.scenes.busy;
      let clk = g.clock();
      if (running && Math.floor(G.life.acc * 2) % 2 === 1) clk = clk.replace(':', ' ');
      const cw = F.measure('00:00'), cx = Math.round(W / 2 - cw / 2) + 5;
      if (night && wt.icon === '☀') U.icon(ctx, 'moon', cx - 14, 4, '#c8d0ff');
      else F.draw(ctx, wt.icon, cx - 12, 5, { color: wt.col });
      F.draw(ctx, clk, cx, 5, { color: v.min >= 23 * 60 ? '#ff8a6a' : night ? '#9ab0ff' : '#f8eed0' });
      const mt = v.money + ' рё';
      F.draw(ctx, mt, W - 6, 5, { align: 'right', color: '#f4d46a' });
      // здоровье, чакра, сытость, энергия: значок + бамбуковая шкала
      const bars = [['heart', C.hp, v.hp / 100], ['drop', C.chakra, v.chakra / 100], ['bowl', C.food, v.food / 100], ['bolt', C.energy, v.energy / 100]];
      const cell = (W - 8) / 4;
      bars.forEach(([ic, col, val], i) => {
        const x = Math.round(4 + i * cell), low = i >= 2 && val < 0.2 && Math.floor(this.time * 3) % 2 === 0;
        U.icon(ctx, ic, x, 15, low ? '#ff6a4a' : col);
        U.gauge(ctx, x + 13, 18, Math.round(cell) - 17, 6, val, low ? '#e04a4a' : col);
      });
    },

    drawStrip(ctx) {
      const W = G.screen.W, U = G.ui, F = G.font.small, C = U.C;
      const y = G.screen.H - STRIP_H;
      U.panel(ctx, 0, y, W, STRIP_H, 'plank');
      const mk = G.state.marker;
      const qid = !mk && G.quests.tracked(), st = qid && G.quests.curStep(qid);
      const maxW = W - G.touch.sysWidth() - 6;
      if (st || mk) {
        const flash = this.goalFlash && Math.floor(this.goalFlash * 6) % 2 === 0;
        const ok = !st || G.quests.timeOk(st);
        const icon = st ? G.QUEST_CATS[G.QUESTS[qid].cat].icon : '📍';
        F.draw(ctx, icon, 6, y + 7, { color: st ? G.QUEST_CATS[G.QUESTS[qid].cat].color : '#ff9a4a' });
        let txt = st ? st.text : 'Метка: ' + (mk.label || 'место');
        const suffix = ok ? '' : ' ⏰ с ' + G.game.clock(st.time[0]);
        while (F.measure(txt + suffix) > maxW - 14 && txt.length > 4) txt = txt.slice(0, -2) + '…';
        F.draw(ctx, txt + suffix, 18, y + 7, { color: !ok ? '#9a8a76' : flash ? '#ffd23a' : '#f8eed0', shadow: '#160c06' });
      } else {
        U.icon(ctx, 'leaf', 5, y + 6, '#ff9a4a');
        F.draw(ctx, this.place, 18, y + 7, { color: '#f8eed0', shadow: '#160c06', maxW });
      }
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
  return S;
});
