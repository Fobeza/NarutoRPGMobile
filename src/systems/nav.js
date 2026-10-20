// Навигация (план §2.6): где цель, как до неё дойти через двери, путь A*, туман на карте.
G.nav = (() => {
  const T = 16;
  const FOG_B = 8;                 // блок тумана — 8×8 тайлов
  const K = () => G.world.konoha();
  const bld = (tpl) => K().buildings.find((b) => b.tplId === tpl) || K().spots[tpl];

  // Точка перед дверью здания (снаружи) или у основания ориентира
  function buildingPoint(b) {
    if (b.door) return { map: 'konoha', x: b.door.tx * T + 8, y: (b.door.ty + 1) * T + 6 };
    return { map: 'konoha', x: (b.tx + b.tw / 2) * T, y: (b.ty + b.th) * T + 8 };
  }

  const api = {
    // Текущая цель: своя метка (поставлена с карты) важнее задания; дошёл — метка снимается.
    current() {
      const mk = G.state.marker;
      if (mk) return { map: 'konoha', x: mk.x * T + 8, y: mk.y * T + 8, label: mk.label || 'Метка', icon: '📍', marker: true, ok: true };
      const qid = G.quests.tracked();
      if (qid) {
        const st = G.quests.curStep(qid);
        if (st) {
          const r = this.resolve(st.target, st);
          if (r) return Object.assign(r, { quest: qid, step: st, ok: G.quests.timeOk(st) });
        }
      }
      return null;
    },

    // Где сейчас NPC: { map, b (здание или null), n }
    findNpc(id) {
      const k = K();
      if (G.residents) G.residents.ensureCurrent();
      const resident = G.residents && G.residents.people.get(id);
      if (resident && resident.active && G.life.visible(resident.active.actor)) return { map: resident.active.map, b: resident.active.map.building || null, n: resident.active.actor };
      const n = k.npcs.find((n) => n.id === id && G.life.visible(n));
      if (n) return { map: k, b: null, n };
      for (const b of k.buildings) {
        if (!b.interior || !(b.tplDef && (b.tplDef.unique || G.SHOPS[b.tplId]))) continue;
        const m = G.world.get(b.interior.id);
        const n2 = m.npcs.find((n) => n.id === id && G.life.visible(n));
        if (n2) return { map: m, b, n: n2 };
      }
      return null;
    },

    // target из задания → { map, x, y, label, icon, npc? }
    resolve(t, step) {
      if (!t) return null;
      const icon = (step && step.icon) || (t.npc ? '👤' : '📍');
      if (t.building) {
        const b = bld(t.building);
        if (!b) return null;
        return Object.assign(buildingPoint(b), { label: b.name, icon, building: b });
      }
      if (t.npc) {
        let maps = [K()];
        if (t.in) { const b = bld(t.in); if (!b || !b.interior) return null; maps = [G.world.get(b.interior.id)]; }
        for (const m of maps) {
          const n = m.npcs.find((n) => n.id === t.npc && G.life.visible(n));
          if (n) return { map: m.id, x: n.x, y: n.y, label: G.chars.nameOf(t.npc), icon, npc: n };
        }
        // персонажи живут по расписанию: если в «своём» месте нет — ищем, где он сейчас
        const f = this.findNpc(t.npc);
        if (f) return { map: f.map.id, x: f.n.x, y: f.n.y, label: G.chars.nameOf(t.npc), icon, npc: f.n };
        return null;
      }
      if (t.obj) {
        if (t.map === 'konoha') {
          const o=K().objects.find(o=>o.kind===t.obj);
          return o?{map:'konoha',x:o.x,y:o.y,label:t.label||'Фонарь у чайной',icon}:null;
        }
        const b = bld(t.in); if (!b || !b.interior) return null;
        const m = G.world.get(b.interior.id);
        const o = m.objects.find((o) => o.kind === t.obj);
        return o ? { map: m.id, x: o.x, y: o.y, label: m.name, icon } : null;
      }
      if (t.tile) return { map: 'konoha', x: t.tile[0] * T + 8, y: t.tile[1] * T + 8, label: t.label || 'Место', icon };
      return null;
    },

    // Следующая точка на текущей карте по пути к цели (граф переходов: улица ↔ интерьеры)
    hop(curMap, tgt) {
      if (!tgt) return null;
      if (tgt.map === curMap.id) return { x: tgt.x, y: tgt.y, final: true };
      if (!curMap.outdoor) {
        const w = curMap.warps.find((w) => w.to && w.to.back);
        if (w) return { x: w.rect.x + w.rect.w / 2, y: w.rect.y + w.rect.h / 2, exit: true };
        return null;
      }
      // на улице, цель внутри здания → к его двери
      const n = Number(String(tgt.map).split(':')[1]);
      const b = K().buildings[n];
      if (b && b.door) return Object.assign(buildingPoint(b), { door: b });
      return null;
    },

    // Приблизительное расстояние до цели в метрах (1 тайл ≈ 2 м)
    meters(curMap, px, py, tgt) {
      const h = this.hop(curMap, tgt);
      if (!h) return 0;
      let d = Math.hypot(h.x - px, h.y - py);
      if (!h.final) {
        if (h.exit && curMap.building) {
          const o = buildingPoint(curMap.building);
          if (tgt.map === 'konoha') d += Math.hypot(tgt.x - o.x, tgt.y - o.y);
          else d += 120;
        } else d += 80; // путь внутри здания
      }
      return Math.round(d / T * 2);
    },

    // ---------- Сетка проходимости и A* ----------
    walkGrid(m) {
      if (m._walk) return m._walk;
      const g = new Uint8Array(m.w * m.h);
      for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
        g[ty * m.w + tx] = m.blockedRect({ x: tx * T + 3, y: ty * T + 7, w: 10, h: 5 }) ? 0 : 1;
      }
      m._walk = g;
      return g;
    },

    nearestWalkable(m, g, tx, ty) {
      if (tx >= 0 && ty >= 0 && tx < m.w && ty < m.h && g[ty * m.w + tx]) return [tx, ty];
      for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = tx + dx, y = ty + dy;
        if (x >= 0 && y >= 0 && x < m.w && y < m.h && g[y * m.w + x]) return [x, y];
      }
      return null;
    },

    // Путь по тайлам от (x0,y0) до (x1,y1) в пикселях → массив [tx,ty] или null
    path(m, x0, y0, x1, y1, maxNodes = 30000, avoid = []) {
      const g = avoid.length ? this.walkGrid(m).slice() : this.walkGrid(m), W = m.w;
      for (const box of avoid) {
        const tx = Math.floor((box.x + box.w / 2) / T), ty = Math.floor((box.y + box.h) / T);
        if (tx >= 0 && ty >= 0 && tx < m.w && ty < m.h) g[ty * W + tx] = 0;
      }
      const s = this.nearestWalkable(m, g, Math.floor(x0 / T), Math.floor((y0 - 2) / T));
      const e = this.nearestWalkable(m, g, Math.floor(x1 / T), Math.floor((y1 - 2) / T));
      if (!s || !e) return null;
      const si = s[1] * W + s[0], ei = e[1] * W + e[0];
      const gs = new Float32Array(m.w * m.h).fill(Infinity);
      const from = new Int32Array(m.w * m.h).fill(-1);
      const closed = new Uint8Array(m.w * m.h);
      const heap = [];   // [f, idx]
      const push = (f, i) => {
        heap.push([f, i]); let k = heap.length - 1;
        while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
      };
      const pop = () => {
        const top = heap[0], last = heap.pop();
        if (heap.length) {
          heap[0] = last; let k = 0;
          for (;;) {
            const l = 2 * k + 1, r = l + 1; let m2 = k;
            if (l < heap.length && heap[l][0] < heap[m2][0]) m2 = l;
            if (r < heap.length && heap[r][0] < heap[m2][0]) m2 = r;
            if (m2 === k) break; [heap[m2], heap[k]] = [heap[k], heap[m2]]; k = m2;
          }
        }
        return top;
      };
      const ex = e[0], ey = e[1];
      const hfn = (x, y) => { const dx = Math.abs(x - ex), dy = Math.abs(y - ey); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
      gs[si] = 0; push(hfn(s[0], s[1]), si);
      let n = 0;
      const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
      while (heap.length && n++ < maxNodes) {
        const [, i] = pop();
        if (closed[i]) continue;
        if (i === ei) break;
        closed[i] = 1;
        const x = i % W, y = (i / W) | 0;
        for (const [dx, dy, c] of DIRS) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= m.h) continue;
          const ni = ny * W + nx;
          if (!g[ni] || closed[ni]) continue;
          if (dx && dy && (!g[y * W + nx] || !g[ny * W + x])) continue; // не срезать углы
          const ng = gs[i] + c;
          if (ng < gs[ni]) { gs[ni] = ng; from[ni] = i; push(ng + hfn(nx, ny), ni); }
        }
      }
      if (from[ei] === -1 && si !== ei) return null;
      const out = [];
      for (let i = ei; i !== -1; i = from[i]) { out.push([i % W, (i / W) | 0]); if (i === si) break; }
      return out.reverse();
    },

    // ---------- Туман (исследованные блоки Конохи) ----------
    fogSize() { const k = K(); return { bw: Math.ceil(k.w / FOG_B), bh: Math.ceil(k.h / FOG_B) }; },
    explored(bx, by) {
      const { bw } = this.fogSize();
      return G.state.fog[by * bw + bx] === '1';
    },
    reveal(px, py) {
      const { bw, bh } = this.fogSize();
      let f = G.state.fog;
      if (f.length !== bw * bh) f = '0'.repeat(bw * bh);
      const cx = Math.floor(px / T / FOG_B), cy = Math.floor(py / T / FOG_B);
      if (cx === this._lastBx && cy === this._lastBy && f === G.state.fog) return;
      this._lastBx = cx; this._lastBy = cy;
      const arr = f.split('');
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && y >= 0 && x < bw && y < bh) arr[y * bw + x] = '1';
      }
      G.state.fog = arr.join('');
    },
    FOG_B,
    buildingPoint,
  };
  return api;
})();
