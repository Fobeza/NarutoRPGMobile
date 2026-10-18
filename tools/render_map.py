#!/usr/bin/env python3
"""Рендер всей Конохи (или фрагмента) в PNG: python3 tools/render_map.py out.png [x y w h] (в тайлах)."""
import sys, os, base64, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tlib import open_page, seed
from playwright.sync_api import sync_playwright
out = sys.argv[1] if len(sys.argv) > 1 else 'map.png'
rx, ry, rw, rh = (int(v) for v in sys.argv[2:6]) if len(sys.argv) >= 6 else (0, 0, 160, 128)
with sync_playwright() as p:
    b, page = open_page(p, "http://localhost:8765/index.html?debug=1"); seed(page)
    data = page.evaluate("""([rx, ry, rw, rh]) => {
      const m = G.world.get('konoha'), T = 16, c = document.createElement('canvas');
      c.width = rw * T; c.height = rh * T; const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
      ctx.translate(-rx * T, -ry * T);
      m.drawGround(ctx, rx * T, ry * T, rw * T, rh * T, 0);
      const objs = m.objects.filter((o) => o.img).slice().sort((a, b) => a.sortY - b.sortY);
      for (const o of objs) if (o.layer === 'floor') ctx.drawImage(o.img, o.x + o.ox, o.y + o.oy);
      for (const o of objs) if (o.layer !== 'floor') ctx.drawImage(o.img, o.x + o.ox, o.y + o.oy);
      return c.toDataURL('image/png');
    }""", [rx, ry, rw, rh])
    open(out, 'wb').write(base64.b64decode(data.split(',')[1]))
    print(page.evaluate("G.world.get('konoha').buildings.length"), 'buildings')
    print(page.evaluate("""(() => { const m = G.world.get('konoha'); const bad = m.buildings.filter((b) => b.door && b.interior && !m.reach[(b.door.ty + 1) * m.w + b.door.tx]).map((b) => b.tplId + '@' + b.door.tx + ',' + b.door.ty);
      const objs = m.objects.filter((o) => o.talk && !o.isBuilding).filter((o) => { const tx = Math.floor(o.x / 16), ty = Math.floor((o.y - 1) / 16); return ![[0,1],[1,0],[-1,0],[0,-1],[1,1],[-1,1]].some(([a, b]) => m.reach[(ty + b) * m.w + tx + a]); }).map((o) => o.kind + '@' + Math.floor(o.x / 16) + ',' + Math.floor(o.y / 16));
      return { genMs: G.world.genMs, pockets: m.pocketTiles, unreachableDoors: bad, unreachableTalk: objs, auto: m.buildings.filter((b) => b.auto).length }; })()"""))
    b.close()
