"""Тест боя «Дуэль»: меню действий, кольцо тайминга, печати, предметы, выброс, победа и поражение. python3 tools/test_battle.py"""
import sys, time
from playwright.sync_api import sync_playwright
from tlib import *
URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/index.html"

def start(page, enemy, mode="spar", terrain="field", extra=""):
    page.evaluate("G.game.pending = { type: 'battle', enemy: '%s', mode: '%s', terrain: '%s' %s }" % (enemy, mode, terrain, extra))
    wait_top(page, "battle", 3)
    for _ in range(40):
        if B(page, "return s.state") == "menu": break
        key(page, 'KeyZ', wait=0.2)

def settle(page, n=60):
    for _ in range(n):
        st = B(page, "return s && s.state")
        if st in ("menu", "end") or top(page) != "battle": return st
        key(page, 'KeyZ', wait=0.15)
    return B(page, "return s.state")

with sync_playwright() as p:
    b, page = open_page(p, URL)
    seed(page, "Object.assign(st.flags, { tech_chakra_shot: 1, tech_kawarimi: 1, tech_henge: 1, tech_bunshin: 1, tech_fear: 1 });")
    check(top(page) == "world", "мир загружен")
    start(page, "kiba", "spar", "field")
    check(top(page) == "battle" and B(page, "return s.state") == "menu", "бой с Кибой начался, открыто меню действий")
    shot(page, "b01_menu")
    check(B(page, "return s.buttons().length") >= 7, "в меню 4 действия и 3 малые кнопки")
    # — удар: кольцо тайминга, нажатие в нужный момент
    key(page, 'KeyZ'); time.sleep(0.1)
    check(B(page, "return s.phase") == "mini", "удар открыл кольцо тайминга")
    shot(page, "b02_ring")
    hp0 = B(page, "return s.D.E.hp"); php0 = B(page, "return s.D.P.hp")
    time.sleep(0.78); key(page, 'KeyZ'); time.sleep(0.3)
    shot(page, "b03_result")
    check(B(page, "return s.phase") in ("play", "choose", "end"), "раунд разыгран")
    settle(page)
    check(B(page, "return s.D.round") >= 1, "раунд засчитан (раундов: %s)" % B(page, "return s.D.round"))
    # — Блок и Уклон тоже идут через тайминг
    key(page, 'ArrowRight'); key(page, 'KeyZ'); time.sleep(0.1)
    check(B(page, "return s.phase") == "mini", "блок открыл кольцо")
    time.sleep(0.5); key(page, 'KeyZ'); settle(page)
    # — Приём: печати вводятся с клавиатуры (стрелки двигают выбор, A подтверждает)
    B(page, "s.D.P.ch = s.D.P.chMax; return 1")
    check(B(page, "return s.state") == "menu", "снова меню действий")
    check(B(page, "return s.choose('tech:bunshin')"), "выбран приём Буншин")
    check(B(page, "return s.phase") == "mini" and B(page, "return s.mini.kind") == "seals", "приём открыл мини-игру печатей")
    shot(page, "b05_seals")
    seq = B(page, "return s.mini.seq"); pal = B(page, "return s.mini.pal"); cur = 0
    for seal in seq:
        i = pal.index(seal)
        key(page, 'ArrowRight', (i - cur) % len(pal), 0.08); key(page, 'KeyZ', 1, 0.1); cur = i
    time.sleep(0.4)
    check(B(page, "return s.phase") in ("play", "choose"), "печати введены, раунд идёт")
    settle(page, 80)
    # — предметы: бинт лечит и считается в бою
    page.evaluate("G.state.inv.bandage = 2")
    if B(page, "return s.state") == "menu":
        B(page, "s.D.P.hp = 20; s.D.inv.bandage = 2; return 1")
        check(B(page, "return s.choose('item:bandage')"), "выбран бинт")
        time.sleep(0.4); settle(page, 80)
        check(B(page, "return s.D.P.hp") > 20 and B(page, "return s.D.inv.bandage") == 1, "бинт вылечил и израсходован (%s)" % B(page, "return s.D.P.hp"))
    # — победа: добиваем противника
    B(page, "s.debugWin(); return 1"); time.sleep(1.5)
    shot(page, "b06_win")
    check(B(page, "return s.state") == "end", "победа: экран итога")
    key(page, 'KeyZ'); time.sleep(0.8)
    check(top(page) == "world", "после боя — снова мир")
    # — настоящий бой и поражение: здоровье и обморок
    start(page, "bully", "ko", "street")
    B(page, "s.debugLose(); return 1"); time.sleep(1.5)
    check(B(page, "return s.state") == "end", "поражение: экран итога")
    key(page, 'KeyZ'); time.sleep(2.5)
    check(page.evaluate("G.state.vars.hp") <= 10 or top(page) != "battle", "после поражения здоровье мало или герой в больнице")
    close_dialogs(page)
    # — выброс фиолетовой чакры
    start(page, "dummy", "spar", "field")
    B(page, "s.D.P.heat = 90; s.D.P.ch = 99; return 1")
    shot(page, "b07_heat")
    check(B(page, "return s.buttons().find(b => b.id === 'release').off") is None or B(page, "return s.buttons().find(b => b.id === 'release').off") == "", "при накале 90 кнопка «Выброс» доступна")
    B(page, "return s.choose('release')"); time.sleep(0.2)
    check(B(page, "return s.phase") == "mini", "выброс открывает кольцо тайминга")
    time.sleep(0.8); key(page, 'KeyZ'); time.sleep(0.5); shot(page, "b08_release")
    check(B(page, "return s.D.P.heat") < 90, "накал потрачен на выброс (%s)" % B(page, "return Math.round(s.D.P.heat)"))
    b.close()

report()
sys.exit(1 if fails or errors else 0)
