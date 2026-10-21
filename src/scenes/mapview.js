// Большая карта Конохи (кнопка КАРТА), план §2.6.
// Масштаб ×1…×8, перетаскивание, фильтры, выбираемые группы знаков и карточки мест,
// «Проложить путь» и «Метка», туман неисследованных участков, задания и друзья.
G.scenes.register('mapview', (world) => {
  const T = G.CONFIG.TILE;
  const K = G.world.konoha();
  const FILTERS = ['Все', 'Задания', 'Лавки', 'Тренировки', 'Друзья'];
  const TOP = 72, BOT = 46, ZOOMS=[1,2,4,8];

  // ---------- места ----------
  const placeOf = (b) => {
    const p = G.nav.buildingPoint(b);
    return { x: p.x / T, y: p.y / T - 0.5 };
  };
  const places = [];
  for (const b of K.buildings) {
    const d = b.tplDef;
    if (!d) continue;
    const shop = G.SHOPS[b.tplId];
    let kind = null;
    if (shop) kind = d.cat === 'food' ? 'food' : 'shop';
    else if (d.cat === 'training') kind = 'training';
    else if (d.unique || d.cat === 'official' || d.cat === 'clan' || d.cat === 'landmark') kind = 'place';
    if (!kind) continue;
    places.push(Object.assign(placeOf(b), { b, kind, name: b.name, shop, known: !!d.unique }));
  }
  for (const sp of Object.values(K.spots)) {
    places.push(Object.assign(placeOf(sp), { b: sp, kind: sp.tplDef.cat === 'training' ? 'training' : 'place', name: sp.name, known: !!sp.tplDef.unique }));
  }
  const isOpen = (shop) => { const m = G.state.vars.min % 1440; return m >= shop.hours[0] && m < shop.hours[1]; };

  // ---------- позиции заданий / друзей ----------
  function questMarks() {
    const out = [];
    const tracked = G.quests.tracked();
    for (const id of G.quests.activeList()) {
      const st = G.quests.curStep(id);
      if (!st) continue;
      const r = G.nav.resolve(st.target, st);
      if (!r) continue;
      let x = r.x / T, y = r.y / T;
      if (r.map !== 'konoha') {
        const b = K.buildings[Number(String(r.map).split(':')[1])];
        if (!b) continue;
        ({ x, y } = placeOf(b));
      }
      out.push({ x, y, id, tracked: id === tracked, icon: G.QUEST_CATS[G.QUESTS[id].cat].icon, col: G.QUEST_CATS[G.QUESTS[id].cat].color, label: st.text });
    }
    for (const [id, d] of Object.entries(G.QUESTS)) {
      if (!d.offer || G.quests.state(id) || !d.offer.when()) continue;
      let pos = null;
      if (d.offer.in) { const b = K.buildings.find((b) => b.tplId === d.offer.in); if (b) pos = placeOf(b); }
      else { const f = G.nav.findNpc(d.offer.npc); if (f) pos = f.b ? placeOf(f.b) : { x: f.n.x / T, y: f.n.y / T }; }
      if (pos) out.push({ x: pos.x, y: pos.y, id, offer: true, icon: '!', col: G.PAL.yellow, label: d.title });
    }
    return out;
  }
  function friendMarks() {
    const out = [];
    for (const id of Object.keys(G.chars.DEFS)) {
      if ((G.state.vars['friend_' + id] || 0) < 2) continue;
      const f = G.nav.findNpc(id);
      if (!f || (f.map.id!=='konoha'&&!f.b)) continue;
      const pos = f.b ? placeOf(f.b) : { x: f.n.x / T, y: f.n.y / T };
      out.push({ x: pos.x, y: pos.y, icon: '🍃', col: '#6ab04a', label: G.chars.nameOf(id), npc: id });
    }
    return out;
  }

  // ---------- где герой ----------
  function heroPos() {
    const m = world.map, p = world.player;
    if (m.id==='konoha') return { x: p.x / T, y: p.y / T, inside: null };
    const pp = placeOf(m.building||G.world.heroHome());
    return { x: pp.x, y: pp.y, inside: m.name };
  }

  const S = {
    name: 'mapview',
    t: 0,
    zoom: 1,
    filter: 0,
    card: null,       // { place, opts, sel }
    toast: null, toastT: 0,
    qm: questMarks(),
    fm: friendMarks(),

    enter() {
      const h = heroPos();
      this.cx = h.x; this.cy = h.y;
      this.vx = 0; this.vy = 0;
      if (K.w * 2 <= G.screen.W && K.h * 2 <= this.vh()) this.zoom = 2;   // на широком экране вся карта влезает вдвое крупнее
      this.fitView(true);
    },
    vh() { return G.screen.H - TOP - BOT; },
    fitView(center) {
      const z = this.zoom, VW = G.screen.W / z, VH = this.vh() / z;
      if (K.w <= VW) this.vx = -(VW - K.w) / 2;
      else if (center) this.vx = G.util.clamp(this.cx - VW / 2, 0, K.w - VW);
      else {
        const mx = 16 / z;
        if (this.cx < this.vx + mx) this.vx = this.cx - mx;
        if (this.cx > this.vx + VW - mx) this.vx = this.cx - VW + mx;
        this.vx = G.util.clamp(this.vx, 0, K.w - VW);
      }
      if (K.h <= VH) this.vy = -(VH - K.h) / 2;
      else if (center) this.vy = G.util.clamp(this.cy - VH / 2, 0, K.h - VH);
      else {
        const my = 16 / z;
        if (this.cy < this.vy + my) this.vy = this.cy - my;
        if (this.cy > this.vy + VH - my) this.vy = this.cy - VH + my;
        this.vy = G.util.clamp(this.vy, 0, K.h - VH);
      }
    },
    toScreen(x, y) { return [Math.round((x - this.vx) * this.zoom), Math.round(TOP + (y - this.vy) * this.zoom)]; },
    fogged(x, y) {
      const B = G.nav.FOG_B;
      return !G.nav.explored(Math.floor(x / B), Math.floor(y / B));
    },
    visiblePlaces() {
      const f = FILTERS[this.filter];
      return places.filter((p) => {
        if (!p.known && this.fogged(p.x, p.y)) return false;
        if (f === 'Все') return true;
        if (f === 'Лавки') return p.kind === 'shop' || p.kind === 'food';
        if (f === 'Тренировки') return p.kind === 'training';
        return false;
      });
    },
    hover() {
      const r = 3.2 / this.zoom + 0.8;
      let best = null, bd = r;
      for (const p of this.visiblePlaces()) {
        if (!p.known && this.fogged(p.x, p.y)) continue;
        const d = Math.hypot(p.x - this.cx, p.y - this.cy);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    },
    say(t) { this.toast = t; this.toastT = 1.6; },

    changeZoom(delta) {this.zoom=ZOOMS[G.util.clamp(ZOOMS.indexOf(this.zoom)+delta,0,ZOOMS.length-1)];this.fitView(true);G.audio.sfx.select();},
    centerHero() {const h=heroPos();this.cx=h.x;this.cy=h.y;this.fitView(true);},
    marks() {
      const f=FILTERS[this.filter],out=this.visiblePlaces().map(p=>({x:p.x,y:p.y,kind:p.b.tplId==='hero_home'?'home':p.kind,label:p.name,place:p,priority:p.b.tplId==='hero_home'?80:20,closed:p.shop&&!isOpen(p.shop)}));
      if(f==='Все'||f==='Друзья')for(const m of this.fm)out.push({...m,kind:'friend',priority:60});
      if(f==='Все'||f==='Задания')for(const m of this.qm)out.push({...m,label:m.offer?m.label:G.QUESTS[m.id].title,kind:m.offer?'offer':'quest',priority:m.tracked?100:70,quest:m.id});
      return out;
    },
    clusters() {
      const points=this.marks().map(m=>{const [x,y]=this.toScreen(m.x,m.y);return {...m,x,y,tx:m.x,ty:m.y};}).filter(m=>m.x>=-12&&m.x<=G.screen.W+12&&m.y>=TOP-12&&m.y<=G.screen.H-BOT+12);
      return G.cartography.cluster(points,14*(G.storage.settings.mapMarkerSize||1));
    },
    clusterAt(x,y) {return this.clusters().filter(q=>Math.hypot(q.x-x,q.y-y)<13*(G.storage.settings.mapMarkerSize||1)).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];},
    openMark(mark) {
      if(mark.place){this.openCard(mark.place);return;}
      const found=mark.npc?G.nav.findNpc(mark.npc):null;
      this.openCard({x:mark.tx??mark.x,y:mark.ty??mark.y,name:mark.label,kind:'place',b:found?.b||{tplDef:{cat:'place'}}});
      if(mark.quest&&G.quests.active(mark.quest))this.card.opts[0]={label:'Следить и идти',act:()=>{G.state.marker=null;G.quests.track(mark.quest);world.savePos();G.storage.save(G.state);G.scenes.pop();world.showTrail();}};
    },
    openCluster(group) {
      if(group.items.length===1){this.openMark(group.items[0]);return;}
      G.scenes.push(G.scenes.make('pick',{title:'МЕСТА РЯДОМ',text:'Выбери нужный значок',options:group.items.map(m=>({label:m.label,desc:({quest:'Текущее задание',offer:'Новое поручение',friend:'Друг',home:'Твой дом',shop:'Лавка',food:'Еда',training:'Тренировка',place:'Место'})[m.kind]}))},i=>{if(i>=0)this.openMark(group.items[i]);}));
    },
    handleTap(t) {
      const W=G.screen.W,H=G.screen.H;
      if(t.y>=H-BOT&&t.y<H-BOT+30){const i=Math.floor(t.x/(W/FILTERS.length));if(i>=0&&i<FILTERS.length)this.filter=i;return;}
      if(t.y>=28&&t.y<TOP){const i=Math.min(3,Math.floor(t.x/(W/4)));if(i===0)this.changeZoom(-1);if(i===1)this.changeZoom(1);if(i===2)this.centerHero();if(i===3)this.legend=true;return;}
      if(t.y<TOP){this.changeZoom(1);return;}
      if(t.y>=H-BOT)return;
      const hit=this.clusterAt(t.x,t.y);
      this.cx=G.util.clamp(t.x/this.zoom+this.vx,0,K.w-1);this.cy=G.util.clamp((t.y-TOP)/this.zoom+this.vy,0,K.h-1);
      if(hit)this.openCluster(hit);else G.audio.sfx.blip();
    },
    pointerPan() {
      const ptrs=Object.values(G.input._ptrs||{}),p=ptrs.find(p=>p.kind==='tap'&&p.loc.y>=TOP&&p.loc.y<G.screen.H-BOT);
      if(p){
        if(!this.drag)this.drag={id:p.id,x:p.x,y:p.y,vx:this.vx,vy:this.vy,tap:p.loc,moved:false};
        const d=this.drag,dx=(p.x-d.x)/G.screen.scale,dy=(p.y-d.y)/G.screen.scale;
        if(Math.hypot(dx,dy)>5)d.moved=true;
        if(d.moved){const VW=G.screen.W/this.zoom,VH=this.vh()/this.zoom;this.vx=K.w<=VW?-(VW-K.w)/2:G.util.clamp(d.vx-dx/this.zoom,0,K.w-VW);this.vy=K.h<=VH?-(VH-K.h)/2:G.util.clamp(d.vy-dy/this.zoom,0,K.h-VH);this.cx=G.util.clamp(this.vx+VW/2,0,K.w-1);this.cy=G.util.clamp(this.vy+VH/2,0,K.h-1);}
        return true;
      }
      if(this.drag){const d=this.drag;this.drag=null;if(!d.moved)this.handleTap(d.tap);return true;}
      return false;
    },
    routePreview() {
      const target=G.nav.current(),hop=target&&G.nav.hop(K,target);if(!hop)return null;
      const h=heroPos(),key=[h.x,h.y,hop.x,hop.y].join(':');
      if(this._routeKey!==key){this._routeKey=key;this._route=G.nav.path(K,h.x*T,h.y*T,hop.x,hop.y);}
      return {pts:this._route||[],x:hop.x/T,y:hop.y/T,label:target.label};
    },

    setMarker(x, y, label) {
      const g = G.nav.walkGrid(K);
      const w = G.nav.nearestWalkable(K, g, Math.floor(x), Math.floor(y));
      if (!w) { G.audio.sfx.error(); this.say('Туда не пройти'); return false; }
      G.state.marker = { x: w[0], y: w[1], label };
      world.savePos();G.storage.save(G.state);
      G.audio.sfx.confirm();
      return true;
    },

    openCard(p) {
      const opts = [];
      opts.push({ label: 'Проложить путь', act: () => { if (this.setMarker(p.x, p.y + 0.5, p.name)) { G.scenes.pop(); world.showTrail(); } } });
      const mk = G.state.marker;
      const here = mk && mk.label === p.name;
      opts.push(here ? { label: 'Снять метку', act: () => { G.state.marker = null;world.savePos();G.storage.save(G.state); this.card = null; this.say('Метка снята'); G.audio.sfx.cancel(); } }
        : { label: 'Метка', act: () => { if (this.setMarker(p.x, p.y + 0.5, p.name)) { this.card = null; this.say('📍 Метка: ' + p.name); } } });
      // кто сейчас там
      let who = [];
      if (p.b.interior) {
        const m = G.world.get(p.b.interior.id);
        who = m.npcs.filter((n) => G.life.visible(n)).map((n) => n.name || G.chars.nameOf(n.id));
      } else {
        who = K.npcs.filter((n) => G.life.visible(n) && Math.hypot(n.x / T - p.x, n.y / T - p.y) < 6).map((n) => n.name || G.chars.nameOf(n.id));
      }
      this.card = { p, opts, sel: 0, who: [...new Set(who)] };
      G.audio.sfx.select();
    },

    update(dt) {
      this.t += dt;
      const I = G.input;
      if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toast = null; }
      const W = G.screen.W, H = G.screen.H;

      if(this.legend){if(I.tapNow||I.pressed('a')||I.pressed('b')||I.pressed('menu')||I.pressed('map'))this.legend=false;return;}

      if (this.card) {
        const c = this.card;
        if (I.pressed('b') || I.pressed('map')) { this.card = null; G.audio.sfx.cancel(); return; }
        if (I.pressed('up') || I.pressed('down')) { c.sel = 1 - c.sel; G.audio.sfx.select(); }
        if (I.pressed('a')) { c.opts[c.sel].act(); return; }
        if (I.tapNow) {
          const r = this.cardRect();
          const t = I.tapNow;
          if (t.y >= r.y && t.y < r.y + r.h && t.x >= r.x && t.x < r.x + r.w) {
            const i = Math.floor((t.y - r.btnY) / 22);
            if (i >= 0 && i < c.opts.length) { c.sel = i; c.opts[i].act(); }
          } else { this.card = null; G.audio.sfx.cancel(); }
        }
        return;
      }

      if (I.pressed('map') || I.pressed('b')) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
      if (I.pressed('menu')) { this.filter = (this.filter + 1) % FILTERS.length; G.audio.sfx.select(); return; }
      if (I.pressed('goal')) { this.zoom=ZOOMS[(ZOOMS.indexOf(this.zoom)+1)%ZOOMS.length];this.fitView(true);G.audio.sfx.select();return; }
      if(this.pointerPan())return;

      // курсор
      const ax = (I.held('right') ? 1 : 0) - (I.held('left') ? 1 : 0);
      const ay = (I.held('down') ? 1 : 0) - (I.held('up') ? 1 : 0);
      if (ax || ay) {
        this.hold = (this.hold || 0) + dt;
        const sp = (this.hold > 0.6 ? 60 : 24) / this.zoom;
        this.cx = G.util.clamp(this.cx + ax * sp * dt, 0, K.w - 1);
        this.cy = G.util.clamp(this.cy + ay * sp * dt, 0, K.h - 1);
        this.fitView(false);
      } else this.hold = 0;

      if (I.tapNow) {
        this.handleTap(I.tapNow);
        return;
      }

      if (I.pressed('a')) {
        const [sx,sy]=this.toScreen(this.cx,this.cy),mark=this.clusterAt(sx,sy);if(mark){this.openCluster(mark);return;}
        const h = this.hover();
        if (h) { this.openCard(h); return; }
        const mk = G.state.marker;
        if (mk && Math.hypot(mk.x + 0.5 - this.cx, mk.y + 0.5 - this.cy) < 3) { G.state.marker = null;world.savePos();G.storage.save(G.state); this.say('Метка снята'); G.audio.sfx.cancel(); return; }
        if (this.fogged(this.cx, this.cy)) { G.audio.sfx.error(); this.say('Ты там ещё не был'); return; }
        if (this.setMarker(this.cx, this.cy, 'Метка')) this.say('📍 Метка поставлена');
      }
    },

    cardRect() {
      const W = G.screen.W, H = G.screen.H;
      const c = this.card, lines = 3 + (c.who.length ? 1 : 0);
      const h = 22 + lines * 13 + c.opts.length * 22 + 6;
      const y = H - BOT - h - 4;
      return { x: 6, y, w: W - 12, h, btnY: y + 14 + lines * 13 + 4 };
    },

    draw(ctx) {
      const W = G.screen.W, H = G.screen.H, P = G.PAL, F = G.font, z = this.zoom;
      const size=W+':'+H;if(this._size!==size){this._size=size;this.fitView(true);}
      G.ui.backdrop(ctx);
      const VH = this.vh();
      ctx.save(); ctx.beginPath(); ctx.rect(0, TOP, W, VH); ctx.clip();
      // подложка
      const img = G.cartography.atlas(K);
      ctx.imageSmoothingEnabled = false;
      const [ox, oy] = this.toScreen(0, 0);
      ctx.fillStyle = P.ink; ctx.fillRect(ox - 1, oy - 1, K.w * z + 2, K.h * z + 2);
      ctx.drawImage(img, ox, oy, K.w * z, K.h * z);
      const route=this.routePreview();
      if(route&&route.pts.length>1){ctx.save();ctx.strokeStyle='#173e42';ctx.lineWidth=3;ctx.beginPath();route.pts.forEach(([x,y],i)=>{const [sx,sy]=this.toScreen(x+.5,y+.5);if(i)ctx.lineTo(sx,sy);else ctx.moveTo(sx,sy);});ctx.stroke();ctx.strokeStyle='#b0ece6';ctx.lineWidth=1;ctx.setLineDash([3,2]);ctx.stroke();ctx.restore();}
      // туман
      const B = G.nav.FOG_B, fs = G.nav.fogSize();
      ctx.fillStyle = 'rgba(20,18,28,0.82)';
      for (let by = 0; by < fs.bh; by++) for (let bx = 0; bx < fs.bw; bx++) {
        if (G.nav.explored(bx, by)) continue;
        const [sx, sy] = this.toScreen(bx * B, by * B);
        ctx.fillRect(sx, sy, B * z, B * z);
      }
      // Знаки не зависят от эмодзи шрифта; близкие точки собираются в один выбираемый значок.
      const groups=this.clusters(),labels=[];
      for(const q of groups){
        G.cartography.pin(ctx,q.x,q.y,q.kind,{count:q.items.length,closed:q.closed});
        if(G.storage.settings.mapLabels!==false&&z>=4&&labels.length<6){
          let text=q.label;while(F.small.measure(text)>96)text=text.slice(0,-2)+'…';
          const width=F.small.measure(text)+8,rx=G.util.clamp(q.x-width/2,3,W-width-3),ry=q.y-23,rect={x:rx,y:ry,w:width,h:13};
          if(ry>TOP+2&&!labels.some(r=>G.util.rectsOverlap(r,rect))){labels.push(rect);G.ui.panel(ctx,rx,ry,width,13,'tag');F.small.draw(ctx,text,rx+4,ry+2,{color:'#f2e7cc'});}
        }
      }
      const f=FILTERS[this.filter];
      if(G.game.count('map_secrets')&&!G.quests.done('waterfall_scroll')&&(f==='Все'||f==='Задания')){const wf=K.spots.waterfall;if(wf){const [sx,sy]=this.toScreen(wf.tx-1,wf.ty+wf.th);G.cartography.pin(ctx,sx,sy,'offer');}}
      if(route){const [sx,sy]=this.toScreen(route.x,route.y);G.cartography.pin(ctx,sx,sy,'target');}
      // Герой всегда виден: светлая стрелка показывает направление взгляда.
      const h = heroPos();
      {
        const [sx, sy] = this.toScreen(h.x, h.y);
        G.cartography.pin(ctx,sx,sy,'hero',{dir:world.player.dir});
      }
      // курсор
      {
        const [sx, sy] = this.toScreen(this.cx, this.cy);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 6, sy, 4, 1); ctx.fillRect(sx + 3, sy, 4, 1); ctx.fillRect(sx, sy - 6, 1, 4); ctx.fillRect(sx, sy + 3, 1, 4);
      }
      ctx.restore();

      // заголовок: деревянная планка с красной лентой
      const U = G.ui, C = U.C;
      U.panel(ctx, 0, 0, W, TOP, 'plank');
      F.draw(ctx,'КАРТА',W/2,9,{align:'center',color:'#f2e4c5'});
      F.small.draw(ctx,'×'+z,W-8,9,{align:'right',color:'#f4e4bc'});
      // узкий экран («крупно», ~196 точек): подпись, которая не влезает крупным шрифтом, — мелким, как у фильтров
      ['-','+','К себе','Знаки'].forEach((label,i)=>{const bw=(W-8)/4,x=4+i*bw,big=F.measure(label)<=bw-9;
        U.button(ctx,x,34,bw-3,26,big?label:'','normal');
        if(!big)F.small.draw(ctx,label,x+(bw-3)/2,34+Math.round((26-F.small.CAP)/2),{align:'center',color:'#f8eed0',shadow:'#160c06',maxW:bw-7});});

      // строка-подсказка о месте под курсором
      const hv = this.hover();
      let info;
      if (hv) {
        info = hv.name;
        if (hv.shop) info += isOpen(hv.shop) ? ` · до ${G.game.clock(hv.shop.hours[1])}` : ` · закрыто (с ${G.game.clock(hv.shop.hours[0])})`;
      } else if (h.inside) info = 'Ты внутри: ' + h.inside;
      else {const [sx,sy]=this.toScreen(this.cx,this.cy),mark=this.clusterAt(sx,sy);info=mark?mark.label:this.fogged(this.cx,this.cy)?'Неизведанные места':'Коснись значка — карточка';}
      U.panel(ctx, 0, TOP + VH - 17, W, 17, 'night');
      F.small.draw(ctx, info, W / 2, TOP + VH - 14, { align: 'center', color: hv ? '#f4d46a' : '#c8b48a', maxW: W - 8 });

      // фильтры: вкладки на деревянной планке
      const fy = H - BOT;
      U.panel(ctx, 0, fy, W, BOT, 'plank');
      const fw = (W - 8) / FILTERS.length;
      FILTERS.forEach((name, i) => {
        const sel = i === this.filter, x = Math.round(4 + i * fw);
        U.button(ctx, x, fy + 6, Math.round(fw) - 3, 22, '', sel ? 'sel' : 'normal');
        let n = name; while (F.small.measure(n) > fw - 8) n = n.slice(0, -2) + '.';
        F.small.draw(ctx, n, x + (Math.round(fw) - 3) / 2, fy + 12, { align: 'center', color: sel ? '#f8eed0' : '#e4d4a8', shadow: C.woodEdge });
      });
      const tip = ['Двигай карту пальцем · + приближает', 'Двигай пальцем · + ближе'].find((t) => F.small.measure(t) <= W - 8) || 'Двигай пальцем';
      F.small.draw(ctx, tip, W / 2, fy + 32, { align: 'center', color: '#c8b48a', maxW: W - 8, shadow: C.woodEdge });

      // карточка места
      if (this.card) this.drawCard(ctx);
      if (this.toast) {
        const w = Math.min(W-8,F.measure(this.toast) + 22);
        U.panel(ctx, Math.round((W - w) / 2), TOP + 6, w, 20, 'night');
        F.draw(ctx, this.toast, W / 2, TOP + 11, { align: 'center', color: '#f4d46a',maxW:w-12 });
      }
      if(this.legend)this.drawLegend(ctx);
    },

    drawLegend(ctx) {
      const W=G.screen.W,H=G.screen.H,w=Math.min(246,W-12),height=Math.min(180,H-34),x=(W-w)/2,y=(H-height)/2;
      G.ui.panel(ctx,x,y,w,height,'frame');G.font.small.draw(ctx,'УСЛОВНЫЕ ЗНАКИ',W/2,y+8,{align:'center',color:G.ui.C.redDark});
      const rows=[['hero','Ты и направление взгляда'],['home','Твой дом'],['quest','Задание / новое поручение'],['shop','Лавка / еда'],['friend','Друг'],['training','Тренировка'],['target','Твоя цель и маршрут'],['place','Цифра — несколько мест']];
      rows.forEach(([kind,label],i)=>{const yy=y+29+i*16;G.cartography.pin(ctx,x+16,yy,kind,{count:i===7?3:1});if(i===3)G.cartography.pin(ctx,x+31,yy,'food');G.font.small.draw(ctx,label,x+(i===3?44:29),yy-4,{color:G.ui.C.ink,maxW:w-(i===3?51:36)});});
      G.font.small.draw(ctx,'Коснись, чтобы закрыть',W/2,y+height-13,{align:'center',color:G.ui.C.inkDim});
    },

    drawCard(ctx) {
      const c = this.card, p = c.p, r = this.cardRect(), F = G.font, U = G.ui, C = U.C;
      U.panel(ctx, r.x, r.y, r.w, r.h, 'frame');
      let y = r.y + 12;
      F.draw(ctx, p.name, r.x + 12, y, { color: C.redDark, maxW: r.w - 80 }); y += 15;
      const cat = { food: 'Еда', shop: 'Лавка', training: 'Тренировки', place: p.b.tplDef.cat === 'clan' ? 'Клан' : 'Место' }[p.kind];
      F.small.draw(ctx, cat, r.x + r.w - 12, r.y + 14, { align: 'right', color: C.inkDim });
      if (p.shop) {
        const o = isOpen(p.shop);
        F.small.draw(ctx, `${G.game.clock(p.shop.hours[0])}–${G.game.clock(p.shop.hours[1])} · ${o ? 'открыто' : 'закрыто'}`, r.x + 12, y, { color: o ? C.ok : C.err });
      } else F.small.draw(ctx, p.b.interior ? 'Можно зайти' : 'Под открытым небом', r.x + 12, y, { color: C.inkDim });
      y += 13;
      const dist = Math.round(Math.hypot(p.x - heroPos().x, p.y - heroPos().y) * 2);
      F.small.draw(ctx, `≈${dist} м от тебя`, r.x + 12, y, { color: C.inkDim }); y += 13;
      if (c.who.length) F.small.draw(ctx, 'Сейчас там: ' + c.who.join(', '), r.x + 12, y, { color: '#3a62a0', maxW: r.w - 24 });
      c.opts.forEach((o, i) => {
        const by = r.btnY + i * 22, sel = i === c.sel;
        U.button(ctx, r.x + 10, by, r.w - 20, 20, o.label, sel ? 'sel' : 'normal');
      });
    },
  };
  return S;
});
