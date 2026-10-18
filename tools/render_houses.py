#!/usr/bin/env python3
"""Галерея вариантов домов: python3 tools/render_houses.py out.png"""
import sys, os, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tlib import open_page, seed
from playwright.sync_api import sync_playwright
out = sys.argv[1] if len(sys.argv) > 1 else 'houses.png'
with sync_playwright() as p:
    b, page = open_page(p, "http://localhost:8765/index.html?debug=1"); seed(page)
    data = page.evaluate("""() => {
      const ids = ['house_xs','house_n','house_s','house_m','house_w','house_t','apartment_s','tower_r','shop_s'];
      const N = 8, pad = 8, cw = 112, ch = 130;
      const c = document.createElement('canvas'); c.width = N * cw + pad; c.height = ids.length * ch + pad;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#6aa05a'; x.fillRect(0, 0, c.width, c.height);
      ids.forEach((id, r) => { for (let i = 0; i < N; i++) { const s = G.buildgfx.make(id, G.BUILDINGS[id], 101 + i * 7 + r);
        x.drawImage(s.img, pad + i * cw, pad + r * ch + (ch - 8 - s.h)); } });
      return c.toDataURL('image/png'); }""")
    open(out, 'wb').write(base64.b64decode(data.split(',')[1]))
    b.close()
