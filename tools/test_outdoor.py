#!/usr/bin/env python3
"""Автотест «Доделай»: травы, рыбалка, сундук-хранилище, продажа, травничество, унаги-дон, слой крыш, симулятор баланса.
Запуск: python3 -m http.server 8765 (в корне репозитория)  →  python3 tools/test_outdoor.py"""
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tlib import *
from playwright.sync_api import sync_playwright

URL = "http://localhost:8765/index.html?debug=1"

def inv(page, id): return page.evaluate("G.game.count('%s')" % id)
def P(page, js): return W(page, "const p = s.player, m = s.map; " + js)

with sync_playwright() as p:
    b, page = open_page(p, URL)
    seed(page, "delete st.flags.st_roofs;")
    close_dialogs(page)
    print("— травы")
    n = page.evaluate("G.world.get('konoha').objects.filter((o) => o.herb != null).length")
    check(n >= 17, "кусты трав и лотосы расставлены на карте (%d)" % n)
    W(page, "G.flow.herb({ i: 0 }, s); return 1"); time.sleep(0.3); close_dialogs(page)
    h = inv(page, 'herb')
    check(h >= 1, "сорвал лечебную траву (x%d)" % h)
    check(page.evaluate("(() => { const o = G.world.get('konoha').objects.find((o) => o.herb === 0); return o.img === G.tiles.object('herb_cut').img; })()"), "куст стал «срезанным»")
    W(page, "G.flow.herb({ i: 0 }, s); return 1"); time.sleep(0.3); close_dialogs(page)
    check(inv(page, 'herb') == h, "повторно с того же куста не собрать")
    page.evaluate("G.state.vars.day += 3")
    check(page.evaluate("G.outdoor.ready(0)"), "через 3 дня трава отросла")
    page.evaluate("G.state.vars.day -= 3")
    W(page, "G.flow.herb({ i: 100 }, s); return 1"); time.sleep(0.3); close_dialogs(page)
    check(inv(page, 'herb_blue') == 1, "голубой лотос у озера")

    print("— рыбалка")
    page.evaluate("G.state.vars.min = 10 * 60")
    spot = page.evaluate("""(() => { const m = G.world.get('konoha'), T = 16;
      for (let r = 0; r < 30; r++) for (let dx = -r; dx <= r; dx++) { const x = 142 + dx, y = 100 - r;
        if (m.get(x, y) === G.tiles.ID.WATER && m.get(x, y + 1) !== G.tiles.ID.WATER && !m.blockedRect({ x: x * T + 3, y: (y + 1) * T + 6, w: 10, h: 5 })) return [x, y]; }
      for (let y = 20; y < 128; y++) for (let x = 0; x < 160; x++) if (m.get(x, y) === G.tiles.ID.WATER && m.get(x, y + 1) !== G.tiles.ID.WATER && !m.blockedRect({ x: x * T + 3, y: (y + 1) * T + 6, w: 10, h: 5 })) return [x, y];
      return null; })()""")
    check(spot is not None, "найден берег у воды %s" % spot)
    W(page, "s.setMap({ map: 'konoha', x: %d * 16 + 8, y: %d * 16 + 12, dir: 'up' }); return 1" % (spot[0], spot[1] + 1)); time.sleep(0.6)
    key(page, "KeyZ"); time.sleep(0.4)
    check((top(page) or '').startswith('dialog'), "без удочки — подсказка про сувенирную лавку")
    close_dialogs(page)
    page.evaluate("G.state.inv.fishing_rod = 1")
    key(page, "KeyZ"); time.sleep(0.5)
    check(top(page) == 'fishing', "A у воды с удочкой — мини-игра рыбалки")
    shot(page, "out_fishing")
    page.evaluate("G.scenes.top().finishNow('carp')"); time.sleep(0.4)
    shot(page, "out_fishing_carp")
    check(inv(page, 'carp') == 1 and page.evaluate("G.state.daily.fish") == 1, "поймал карпа, заброс засчитан")
    key(page, "KeyX"); time.sleep(0.3)
    check(top(page) == 'world', "рыбалка закрыта")

    print("— продажа на рынке")
    page.evaluate("G.state.inv.fish = 2")
    m0 = page.evaluate("G.state.vars.money")
    W(page, "s.openShop({ shop: 'market', id: 'villager_m' }); return 1"); time.sleep(0.4)
    check(top(page) == 'pick', "у торговца: Купить / Продать / Уйти")
    key(page, "ArrowDown"); key(page, "KeyZ"); time.sleep(0.3)
    shot(page, "out_sell")
    key(page, "KeyZ"); time.sleep(0.3)
    m1 = page.evaluate("G.state.vars.money")
    check(m1 > m0, "продал улов: %d → %d рё" % (m0, m1))
    for _ in range(4):
        if top(page) == 'world': break
        key(page, "KeyX"); time.sleep(0.25)
    close_dialogs(page)

    print("— сундук-хранилище")
    W(page, "G.flow.chest({}, s); return 1"); time.sleep(0.3)
    key(page, "KeyZ"); time.sleep(0.3)
    check(top(page) == 'storage', "сундук → хранилище")
    k0 = inv(page, 'kunai')
    page.evaluate("G.scenes.top().move(0, 'kunai')"); time.sleep(0.1)
    check(inv(page, 'kunai') == k0 - 1 and page.evaluate("G.state.chest.kunai") == 1, "кунай убран в сундук")
    shot(page, "out_storage")
    page.evaluate("G.scenes.top().move(1, 'kunai')")
    check(inv(page, 'kunai') == k0 and not page.evaluate("G.state.chest.kunai"), "кунай вернулся в освободившееся место подсумка")
    page.evaluate("G.state.chest.bandage = 1")
    page.evaluate("G.scenes.top().move(1, 'bandage')")
    check(page.evaluate("G.game.pouchUsed() === G.game.pouchMax() && G.state.chest.bandage === 1"), "из полного сундука нельзя переполнить подсумок")
    page.evaluate("G.scenes.top().move(0, 'herb_blue')"); page.evaluate("G.scenes.top().move(1, 'herb_blue')")
    check(inv(page, 'herb_blue') == 1 and not page.evaluate("G.state.chest.herb_blue"), "лотос туда и обратно")
    key(page, "KeyX"); time.sleep(0.2); key(page, "KeyX"); time.sleep(0.3)
    page.evaluate("G.state.chest.carp = 1; G.storage.save(G.state)")
    check(page.evaluate("G.storage.load().chest.carp") == 1, "содержимое сундука сохраняется")

    print("— травничество и готовка")
    page.evaluate("G.state.inv.herb = 3")
    W(page, "G.outdoor.craftMenu(s); return 1"); time.sleep(0.3); key(page, "KeyZ"); time.sleep(0.3); close_dialogs(page)
    check(page.evaluate("G.game.count('ointment') + (G.state.chest.ointment || 0)") == 1 and inv(page, 'herb') == 0, "мазь из 3 трав сохранена в сумке или сундуке")
    page.evaluate("Object.assign(G.state.inv, { eel: 1, rice: 1 }); G.state.vars.fatigue = 80")
    W(page, "G.flow.cook({}, s); return 1"); time.sleep(0.3)
    pick(page, "Обычная готовка"); pick(page, "Унаги-дон"); close_dialogs(page)   # с 1.6 кухня сначала спрашивает: обычная или семейная
    check(inv(page, 'eel') == 0 and page.evaluate("G.state.vars.fatigue") <= 36, "унаги-дон: усталость %d" % page.evaluate("Math.round(G.state.vars.fatigue)"))

    print("— крыши")
    page.evaluate("Object.assign(G.state.vars, { day: 4, min: 14 * 60 + 5, fatigue: 10 }); G.state.daily = { lesson: 1 }")
    W(page, "s.setMap({ map: 'konoha', x: 62 * 16 + 8, y: 46 * 16 + 8, dir: 'down' }); return 1"); time.sleep(1.0)
    for _ in range(30):
        if page.evaluate("G.state.flags.roofs"): break
        key(page, "KeyZ", wait=0.25)
    close_dialogs(page)
    check(page.evaluate("G.state.flags.roofs") == 1, "Наруто научил бегать по крышам (день 4)")
    # жилой дом, у которого справа в пределах прыжка есть другая крыша; встать к его южной стене (не у двери)
    st = W(page, """const m = s.map, T = 16, R = G.roofs.rects(m);
      const ok = (a) => a.b.tplId === 'house_s' && a.b.door && R.some((b) => b !== a && b.x >= a.x + a.w - 4 && b.x - (a.x + a.w) <= 40 && Math.abs((b.y + b.h / 2) - (a.y + a.h / 2)) < 14);
      const spotOf = (b) => ({ x: (b.tx + (b.door.tx - b.tx === 0 ? b.tw - 1 : 0)) * T + 10, y: (b.ty + b.th) * T + 6 });
      const a = R.find((a) => ok(a) && !m.blockedRect(G.actors.feet(spotOf(a.b))) && Math.abs(a.b.door.tx - (a.b.tx + (a.b.door.tx - a.b.tx === 0 ? a.b.tw - 1 : 0))) > 1);
      const b = a.b, p = spotOf(b);
      s.setMap({ map: 'konoha', x: p.x, y: p.y, dir: 'up' }); return [b.tx, b.ty, b.tw, b.th];""")
    time.sleep(0.5)
    key(page, "KeyZ"); time.sleep(1.0)
    check(P(page, "return !!p.roof"), "A у стены — герой на крыше (%s)" % st)
    shot(page, "out_roof")
    r0 = P(page, "const b = G.roofs.at(m, p.x, p.y).b; return b.tplId + ':' + b.tx + ',' + b.ty")
    # На увеличенной крыше стартуем у правого края, в створе соседней крыши.
    P(page, "const r = G.roofs.at(m, p.x, p.y); const next = G.roofs.rects(m).find(b => b !== r && b.x >= r.x+r.w-4 && b.x-(r.x+r.w)<=40 && Math.abs((b.y+b.h/2)-(r.y+r.h/2))<14); const pos = G.roofs.clampIn(r, r.x+r.w-6, next.y+next.h/2); p.x=pos[0];p.y=pos[1];return 1")
    x0 = P(page, "return p.x")
    page.keyboard.down("ArrowRight"); time.sleep(2.2); page.keyboard.up("ArrowRight"); time.sleep(0.8)
    r1 = P(page, "const r = G.roofs.at(m, p.x, p.y); return r ? r.b.tplId + ':' + r.b.tx + ',' + r.b.ty : null")
    check(P(page, "return !!p.roof") and P(page, "return p.x") > x0 + 30, "бег по крышам вправо (%s → %s)" % (r0, r1))
    check(r1 is not None and r1 != r0, "перепрыгнул на соседнюю крышу")
    shot(page, "out_roof_jump")
    W(page, "s.savePos(); return 1")
    check(page.evaluate("G.state.pos.roof") == 1, "позиция на крыше сохраняется")
    P(page, "p.dir = 'down'; return 1"); key(page, "KeyZ"); time.sleep(1.0)
    ok = P(page, "return !p.roof && !p.jump && !m.blockedRect(G.actors.feet(p)) && !G.roofs.inFootprint(m, p.x, p.y)")
    check(ok, "A на краю — спрыгнул на улицу")

    print("— симулятор баланса")
    before = page.evaluate("JSON.stringify([G.state.vars.money, G.state.hero.stats, G.state.inv])")
    r = page.evaluate("G.sim.run('kiba_d3', 'bal', 0.65, 6)")
    check(r['n'] == 6 and 0 <= r['win'] <= 1, "G.sim.run: 6 боёв, побед %d%%" % round(r['win'] * 100))
    check(page.evaluate("JSON.stringify([G.state.vars.money, G.state.hero.stats, G.state.inv])") == before, "симуляция не трогает сохранение")
    check(top(page) == 'world', "после симуляции игра на месте")
    b.close()
report()
