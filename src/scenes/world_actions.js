// Сцена мира, часть «Действия»: что случится по кнопке A (двери, разговоры, предметы, рыбалка), окно реплик, лавки.
// Методы подмешиваются в объект сцены (scenes/world.js: G.worldParts); this — сама сцена.
// K — общие константы сцены: тайл, высота шапки и нижней полосы, объекты, за которыми герой просвечивает.
G.worldParts = G.worldParts || [];
G.worldParts.push(({ T, HUD_H, STRIP_H, FADE_BEHIND }) => ({
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

    // talk(lines | scriptId, [после]) — «после» вызывается, когда окно реплик закрыто (награда, переход, экран)
    talk(t, after) {
      if (!t) { after && after(); return; }
      const onEnd = () => { this.refreshNpcs(); after && after(); };
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
}));
