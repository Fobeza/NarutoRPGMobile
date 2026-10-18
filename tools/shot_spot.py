#!/usr/bin/env python3
"""Скриншот игрового вида: python3 tools/shot_spot.py out.png tileX tileY [minutes]"""
import sys, time, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tlib import *
from playwright.sync_api import sync_playwright
out, tx, ty = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); mn = int(sys.argv[4]) if len(sys.argv) > 4 else 12 * 60
with sync_playwright() as p:
    b, page = open_page(p, "http://localhost:8765/index.html"); seed(page); wait_top(page, 'world')
    page.evaluate("G.state.vars.min=%d" % mn)
    W(page, "s.setMap({ map: 'konoha', x: %d*16+8, y: %d*16+8 }); return 1" % (tx, ty)); time.sleep(1.2)
    page.screenshot(path=out); b.close()
