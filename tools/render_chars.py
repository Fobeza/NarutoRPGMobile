"""Рендер всех персонажей: лист (4 направления × 3 кадра) и портрет — в PNG для осмотра."""
import sys, base64, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from tlib import *
URL = "http://localhost:8765/index.html?debug=1"
ids = sys.argv[2].split(',') if len(sys.argv) > 2 else None
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/chars.png'
with sync_playwright() as p:
    b, page = open_page(p, URL)
    seed(page); wait_top(page, 'world')
    js = """(ids) => {
      ids = ids || Object.keys(G.chars.DEFS);
      const S = 3, cols = 4, cw = 96 * S + 64 * S + 20, ch = 160 * S + 20;
      const c = document.createElement('canvas'); c.width = cw * cols; c.height = Math.ceil(ids.length / cols) * ch;
      const x = c.getContext('2d'); x.fillStyle = '#7ab04a'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = false;
      ids.forEach((id, n) => {
        const ox = (n % cols) * cw, oy = Math.floor(n / cols) * ch;
        try {
          const sh = G.chars.sheet(id);
          const tmp = document.createElement('canvas'); tmp.width = sh.width; tmp.height = sh.height; tmp.getContext('2d').putImageData(sh.getContext('2d').getImageData(0, 0, sh.width, sh.height), 0, 0);
          x.drawImage(tmp, 0, 0, sh.width, sh.height, ox, oy + 14, sh.width * S, sh.height * S);
          const pt = G.chars.portrait(id); const t2 = document.createElement('canvas'); t2.width = pt.width; t2.height = pt.height; t2.getContext('2d').putImageData(pt.getContext('2d').getImageData(0, 0, pt.width, pt.height), 0, 0);
          x.drawImage(t2, 0, 0, pt.width, pt.height, ox + 96 * S + 10, oy + 14, pt.width * S, pt.height * S);
          x.fillStyle = '#fff'; x.font = '14px monospace'; x.fillText(id, ox + 4, oy + 11);
        } catch (e) { x.fillStyle = '#f00'; x.fillText(id + ' ERR ' + e.message, ox + 4, oy + 24); }
      });
      return c.toDataURL('image/png');
    }"""
    d = page.evaluate(js, ids)
    open(out, 'wb').write(base64.b64decode(d.split(',')[1]))
    print('errors', errors[:3])
    b.close()
