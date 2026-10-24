"""Карточный бой: касания, три действия, намерения, добор, техники, предметы и исход. python3 tools/test_battle.py"""
import sys, time
from playwright.sync_api import sync_playwright
from tlib import *
URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/index.html"


def start(page, enemy, mode="spar", terrain="field", extra=""):
    page.evaluate("G.game.pending = { type: 'battle', enemy: '%s', mode: '%s', terrain: '%s' %s }" % (enemy, mode, terrain, extra))
    wait_top(page, "battle", 3)
    for _ in range(40):
        if B(page, "return s.state") == "menu": break
        key(page, 'KeyZ', wait=0.15)


def settle(page, n=80):
    for _ in range(n):
        st = B(page, "return s && s.state")
        if st in ("menu", "end") or top(page) != "battle": return st
        key(page, 'KeyZ', wait=0.12)
    return B(page, "return s.state")


def force(page, card):
    return B(page, """return (() => { const D=s.D; let c=D.hand.find(c=>c.id==='%s');
      if(!c) for(const z of [D.deck,D.discard]) { const i=z.findIndex(c=>c.id==='%s'); if(i>=0){c=z.splice(i,1)[0];D.hand.push(c);break;} }
      return !!c; })()""" % (card, card))


def tap_rect(page, rect):
    p = page.evaluate("""r => { const c=G.screen.canvas.getBoundingClientRect(); return {
      x:c.x+(r.x+r.w/2)*c.width/G.screen.W, y:c.y+(r.y+r.h/2)*c.height/G.screen.H }; }""", rect)
    page.touchscreen.tap(p['x'], p['y']); time.sleep(0.18)


def playable_basic():
    return "c=>G.duel.canPlay(s.D,c).ok&&!['analyze','bunshin','fuuton','bandage'].includes(c.id)"


def play_first(page):
    return B(page, "const c=s.D.hand.find(%s); return c ? s.play(c) : false" % playable_basic())


with sync_playwright() as p:
    b, page = open_page(p, URL)
    seed(page, "Object.assign(st.flags, { tech_chakra_shot: 1, tech_kawarimi: 1, tech_henge: 1, tech_bunshin: 1, tech_fear: 1 });")
    check(top(page) == "world", "мир загружен")
    page.evaluate("G.state.inv.bandage=2")
    start(page, "kiba", "spar", "field")
    B(page, "s.D.E.hp=s.D.E.hpMax=300; return 1")
    check(top(page) == "battle" and B(page, "return s.state") == "menu", "бой с Кибой начался, открыта рука")
    check(B(page, "return s.D.hand.length") == 5 and B(page, "return s.D.P.ap") == 3, "пять карт и три действия")
    check(B(page, "return s.D.intent && typeof s.D.intent.name === 'string' && typeof s.D.intent.kind === 'string'"), "намерение врага показано точно")
    check(B(page, "return s.buttons().length") >= 8, "пять карт и команды панели доступны")
    shot(page, "b01_cards")

    # Реальные касания: выбрать доступную карту, затем нажать «Играть».
    rect = B(page, "const c=s.D.hand.find(%s); return s.buttons().find(b=>b.uid===c.uid)" % playable_basic())
    tap_rect(page, rect)
    tap_rect(page, B(page, "return s.buttons().find(b=>b.id==='play')"))
    settle(page)
    check(B(page, "return s.D.stats.cards") == 1 and B(page, "return s.D.P.ap") == 2, "касание разыгрывает карту и тратит действие")
    check(B(page, "return s.mini") is None, "в карточном бою нет кольца или печатей")
    for _ in range(2):
        check(play_first(page), "есть доступная карта для действия")
        settle(page)
    check(B(page, "return s.D.stats.cards") == 3 and B(page, "return s.D.round") == 1, "три карты сыграны, а враг ещё не ответил")
    shot(page, "b02_three_cards")
    B(page, "return s.endTurn()"); settle(page)
    check(B(page, "return s.D.round") == 2 and B(page, "return s.D.turns") == 1, "кнопка конца хода передаёт ответ врагу")

    # Добор может дать шесть карт: появляются кнопки страниц.
    force(page, 'analyze'); B(page, "s.D.P.ap=3; return s.play('analyze')"); settle(page)
    check(B(page, "return s.D.hand.length") >= 6, "Анализ увеличил руку")
    check(B(page, "return !!s.buttons().find(b=>b.id==='next') && !!s.buttons().find(b=>b.id==='prev')"), "длинная рука листается страницами")

    # Буншин: два клона принимают серию из двух ударов.
    force(page, 'bunshin')
    B(page, "s.D.P.ap=3; s.D.intent={kind:'multi',name:'Серия',dmg:20,hits:2}; s.D.P.hp=s.D.P.hpMax; return 1")
    check(B(page, "return s.choose('tech:bunshin')"), "выбрана карта Буншин")
    settle(page)
    check(B(page, "return s.D.P.clones") == 2 and B(page, "return s.mini") is None, "Буншин создаёт двух клонов сразу, без мини-игры")
    B(page, "return s.endTurn()"); settle(page)
    check(B(page, "return s.D.P.clones") == 0 and B(page, "return s.D.P.hp") == B(page, "return s.D.P.hpMax"), "клоны приняли оба удара")

    # Бинт расходуется внутри спарринга, но не из общей сумки.
    force(page, 'bandage')
    B(page, "s.D.P.hp=20; s.D.P.ap=3; return 1")
    before = B(page, "return s.D.inv.bandage")
    check(B(page, "return s.choose('item:bandage')"), "выбран бинт")
    settle(page)
    check(B(page, "return s.D.P.hp") > 20 and B(page, "return s.D.inv.bandage") == before - 1, "бинт лечит и расходуется")
    check(page.evaluate("G.game.count('bandage')") == 2, "спарринг не списывает общую сумку")

    B(page, "s.debugWin(); return 1"); time.sleep(1.1)
    shot(page, "b06_win")
    check(B(page, "return s.state") == "end", "победа: экран итога")
    key(page, 'KeyZ'); time.sleep(0.7)
    check(top(page) == "world", "после боя — снова мир")

    start(page, "bully", "ko", "street")
    B(page, "s.debugLose(); return 1"); time.sleep(1.1)
    check(B(page, "return s.state") == "end", "поражение: экран итога")
    key(page, 'KeyZ'); time.sleep(2.0)
    check(page.evaluate("G.state.vars.hp") <= 10 or top(page) != "battle", "после поражения здоровье мало или герой в больнице")
    close_dialogs(page)

    start(page, "dummy", "spar", "field")
    force(page, 'release')
    B(page, "s.D.P.heat=90; s.D.P.ch=s.D.P.chMax; s.D.P.ap=3; return 1")
    check(B(page, "return G.duel.canPlay(s.D,'release').ok"), "при накале 90 Выброс доступен")
    check(B(page, "return s.choose('release')"), "Выброс разыгран как карта")
    settle(page); shot(page, "b08_release")
    check(B(page, "return s.D.P.heat") == 0 and B(page, "return s.mini") is None, "Выброс тратит накал без кольца тайминга")
    b.close()

report()
sys.exit(1 if fails or errors else 0)
