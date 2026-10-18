"""Тест боя: экраны и механики. python3 tools/test_battle.py"""
import sys, time
from playwright.sync_api import sync_playwright
from tlib import *
URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/index.html"

def start(page, enemy, mode="spar", terrain="field", extra=""):
    page.evaluate("G.game.pending = { type: 'battle', enemy: '%s', mode: '%s', terrain: '%s' %s }" % (enemy, mode, terrain, extra))
    wait_top(page, "battle", 3)
    for _ in range(30):
        if B(page, "return s.state") == "menu": break
        time.sleep(0.15)

with sync_playwright() as p:
    b, page = open_page(p, URL)
    seed(page, "Object.assign(st.flags, { tech_kawarimi: 1, tech_henge: 1, tech_bunshin: 1, tech_fear: 1 });")
    check(top(page) == "world", "мир загружен")
    start(page, "kiba", "spar", "field")
    check(top(page) == "battle", "бой с Кибой начался")
    shot(page, "b01_menu")
    # движение вперёд → вплотную
    key(page, "KeyZ"); time.sleep(0.2); shot(page, "b02_move")
    key(page, "KeyZ"); time.sleep(1.0)
    for _ in range(40):
        st = B(page, "return s.state")
        if st == "react": shot(page, "b03_react"); key(page, "ArrowRight"); key(page, "KeyZ"); time.sleep(0.9)
        elif st == "menu": break
        else: time.sleep(0.2)
    d = B(page, "return Math.abs(s.P.pos - s.E.pos)")
    print("  дистанция", d)
    # тайдзюцу цепочка
    page.evaluate("(() => { const s = G.scenes.top(); s.P.pos = 2; s.E.pos = 3; })()")
    key(page, "ArrowRight"); key(page, "KeyZ"); time.sleep(0.2)
    key(page, "ArrowRight"); key(page, "KeyZ"); key(page, "KeyZ"); key(page, "ArrowRight"); key(page, "KeyZ"); time.sleep(0.1)
    shot(page, "b04_tai_chain")
    hp0 = B(page, "return s.E.hp")
    key(page, "ArrowLeft", 3); key(page, "ArrowRight", 0)
    page.evaluate("(() => { const s = G.scenes.top(); })()")
    B(page, "s.act('tai', ['punch','kick','punch']); return 1")
    time.sleep(0.4); shot(page, "b05_rhythm")
    for _ in range(60):
        st = B(page, "return s.state")
        if st == "rhythm": key(page, "KeyZ", 1, 0.05)
        elif st == "react": key(page, "KeyZ"); time.sleep(0.3)
        elif st in ("menu", "end"): break
        time.sleep(0.12)
    hp1 = B(page, "return s.E.hp")
    check(hp1 < hp0, "цепочка нанесла урон (%s → %s)" % (hp0, hp1))
    # печати
    for _ in range(40):
        if B(page, "return s.state") == "menu": break
        if B(page, "return s.state") == "react": key(page, "KeyZ")
        time.sleep(0.2)
    B(page, "s.P.ch = 99; s.act('tech', 'bunshin'); return 1"); time.sleep(0.3)
    shot(page, "b06_seals")
    seq = page.evaluate("G.TECHS.bunshin.seals")
    cur = 0
    for sidx in seq:
        # перейти фокусом на нужную печать
        page.evaluate("(() => {})()")
        tgt = sidx
        dx = tgt - cur
        k = "ArrowRight" if dx > 0 else "ArrowLeft"
        key(page, k, abs(dx), 0.05); key(page, "KeyZ", 1, 0.05); cur = tgt
    time.sleep(0.5)
    check(B(page, "return s.P.clones") >= 2, "Буншин: клоны появились (%s)" % B(page, "return s.P.clones"))
    shot(page, "b07_clones")
    # Воля Огня
    for _ in range(40):
        if B(page, "return s.state") == "menu": break
        if B(page, "return s.state") == "react": key(page, "KeyZ")
        time.sleep(0.2)
    B(page, "s.P.will = 100; s.E.hp = Math.min(s.E.hp, 30); return 1")
    key(page, "Escape")
    page.evaluate("(() => {})()")
    B(page, "s.act('misc', 'will'); return 1"); time.sleep(0.5); shot(page, "b08_moment")
    time.sleep(1.6); shot(page, "b09_moment_pick")
    key(page, "KeyZ"); time.sleep(1.5)
    for _ in range(50):
        st = B(page, "return s && s.state")
        if st == "end" or st is None: break
        if st == "react": key(page, "KeyZ")
        if st == "menu": B(page, "s.act('misc', 'guard'); return 1")
        time.sleep(0.25)
    shot(page, "b10_end")
    check(B(page, "return s && s.state") == "end", "бой закончился")
    time.sleep(1.2); key(page, "KeyZ"); time.sleep(0.6)
    check(top(page) == "world", "вернулись в мир")
    # Наруто: клоны и выбор цели
    start(page, "naruto", "spar", "forest")
    B(page, "s.E.plan = 'clones'; s.E.t = 0; s.P.t = 5; return 1")
    B(page, "s.act('misc', 'guard'); return 1"); time.sleep(2.5)
    for _ in range(30):
        st = B(page, "return s.state")
        if st == "react": key(page, "KeyZ")
        if st == "menu": break
        time.sleep(0.2)
    B(page, "s.E.clones = 2; s.P.pos = 2; s.E.pos = 3; return 1")
    B(page, "s.act('throw', 'kunai'); return 1"); time.sleep(0.3)
    check(B(page, "return s.state") == "target", "клоны Наруто: выбор цели")
    shot(page, "b11_target")
    key(page, "KeyZ"); time.sleep(1.0)
    B(page, "s.debugWin(); return 1"); time.sleep(1.2); key(page, "KeyZ"); time.sleep(0.5)
    # Мизуки ночью с союзниками
    start(page, "mizuki", "ko", "night", ", story: true, allies: ['iruka','naruto']")
    shot(page, "b12_mizuki")
    B(page, "s.debugWin(); return 1"); time.sleep(1.2); key(page, "KeyZ"); time.sleep(0.5)
    check(top(page) == "world", "после боя с Мизуки — снова мир")
    report()
    b.close()
