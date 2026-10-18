"""Аудит интерьеров: проходимость, NPC в мебели, недоступные NPC/объекты, наложения мебели, выход; скриншот каждого типа комнаты."""
import sys, json, time, os
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tlib import *
URL = "http://localhost:8765/index.html?debug=1"
JS = r"""() => {
  const K = G.world.konoha(), T = 16, seen = new Set(), out = [];
  for (const b of K.buildings) {
    if (!b.interior) continue;
    const key = b.interior.kind + '/' + b.tplId;
    if (seen.has(key)) continue; seen.add(key);
    const m = G.world.get(b.interior.id); if (!m) { out.push({ key, err: 'нет карты' }); continue; }
    const walk = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && !m.blockedRect({ x: x * T + 3, y: y * T + 7, w: 10, h: 5 });
    const sx = Math.floor(m.spawn.x / T), sy = Math.floor(m.spawn.y / T);
    const R = new Set(); const q = [[sx, sy]]; if (walk(sx, sy)) R.add(sx * 999 + sy);
    while (q.length) { const [x, y] = q.pop(); for (const [a, c] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + a, ny = y + c, k = nx * 999 + ny; if (!R.has(k) && walk(nx, ny)) { R.add(k); q.push([nx, ny]); } } }
    const iss = [];
    if (!walk(sx, sy)) iss.push('точка входа заблокирована');
    let floor = 0, dead = 0;
    for (let y = 2; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) if (walk(x, y)) { floor++; if (!R.has(x * 999 + y)) dead++; }
    if (dead) iss.push('недоступных клеток пола: ' + dead);
    // как в world.interact(): игрок на достижимой клетке, смотрит в одну из 4 сторон, точка перед ним — fx,fy
    const fronts = []; for (const k of R) { const x = Math.floor(k / 999), y = k % 999, px = x * T + 8, py = y * T + 12; for (const [a, c] of [[1,0],[-1,0],[0,1],[0,-1]]) fronts.push([px + a * 12, py - 3 + c * 12]); }
    const npcOk = (n) => fronts.some(([fx, fy]) => Math.hypot(n.x - fx, n.y - 3 - fy) < (n.reach || 15));
    const objOk = (o) => { const r = o.box || { x: o.x - 8, y: o.y - 14, w: 16, h: 14 }; const ex = { x: r.x - 6, y: r.y - 10, w: r.w + 12, h: r.h + 16 }; return fronts.some(([fx, fy]) => fx >= ex.x && fx <= ex.x + ex.w && fy >= ex.y && fy <= ex.y + ex.h); };
    for (const n of m.npcs) {
      const f = { x: n.x - 5, y: n.y - 5, w: 10, h: 5 };
      const inside = m.objects.find((o) => o.box && G.util.rectsOverlap(f, o.box));
      if (inside) iss.push(`NPC ${n.id} стоит в объекте ${inside.kind}`);
      if (!npcOk(n)) iss.push(`NPC ${n.id} недоступен для разговора`);
    }
    for (const o of m.objects) if (o.talk && !objOk(o)) iss.push(`объект ${o.kind} (talk) недоступен`);
    const sol = m.objects.filter((o) => o.box);
    for (let i = 0; i < sol.length; i++) for (let j = i + 1; j < sol.length; j++) {
      const a = sol[i].box, c = sol[j].box;
      const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
      if (ox > 2 && oy > 2) iss.push(`наложение: ${sol[i].kind} × ${sol[j].kind}`);
    }
    const vis = m.objects.filter((o) => o.y !== T + 13 && o.layer !== 'floor' && o.box);
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
      const a = m.drawRect(vis[i]), c = m.drawRect(vis[j]);
      const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
      if (ox > 4 && oy > 6 && !(vis[i].kind === vis[j].kind && ['counter','desk','stool'].includes(vis[i].kind))) iss.push(`рисунки налезают: ${vis[i].kind}@${Math.floor(vis[i].x/T)},${Math.floor(vis[i].y/T)} × ${vis[j].kind}@${Math.floor(vis[j].x/T)},${Math.floor(vis[j].y/T)}`);
    }
    for (const o of m.objects) { const r = m.drawRect(o); if (r.x < T - 2 || r.x + r.w > (m.w - 1) * T + 2 || r.y + r.h > (m.h - 1) * T + 4) iss.push(`объект ${o.kind}@${Math.floor(o.x/T)},${Math.floor(o.y/T)} вылезает за стены`); }
    // спрайты, перекрывающие друг друга визуально (оба на полу, рисунок пересекается сильно)
    const ex = m.exit; if (ex && !R.has(ex.tx * 999 + (ex.ty - 1))) iss.push('выход недоступен');
    out.push({ key, id: b.interior.id, name: b.name, w: m.w, h: m.h, floor, objs: m.objects.length, npcs: m.npcs.length, iss });
  }
  return out;
}"""
with sync_playwright() as p:
    b, page = open_page(p, URL)
    seed(page); wait_top(page, 'world')
    page.evaluate("G.state.vars.day = 3; G.state.vars.min = 11*60; G.state.daily.lesson = 1; G.debug.on = false")
    res = page.evaluate(JS)
    bad = 0
    for r in res:
        if r.get('iss'): bad += 1
        print(r['key'], '|', r.get('name'), f"{r.get('w')}x{r.get('h')} пол={r.get('floor')} объектов={r.get('objs')} npc={r.get('npcs')}")
        for i in r.get('iss', []): print('   -', i)
    print('комнат:', len(res), 'с проблемами:', bad)
    if '--shots' in sys.argv:
        os.makedirs(OUT + '/rooms', exist_ok=True)
        for r in res:
            if 'id' not in r: continue
            W(page, "s.setMap({ map: '%s', entry: true }); return 1" % r['id']); time.sleep(0.9)
            close_dialogs(page, 10); time.sleep(0.2)
            page.screenshot(path=OUT + '/rooms/' + r['key'].replace('/', '_') + '.png', clip={'x': 0, 'y': 0, 'width': 393, 'height': 560})
    print('errors', errors[:3])
    b.close()
