"""Регрессия: урок, прерванный выгрузкой вкладки; очередь отработок; команда при ничьей;
запасы в тренировочных боях; предупреждение об уроке."""
import time, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from tlib import *

URL = "http://localhost:8765/index.html?debug=1"
EARLY = "0"

def fresh(p):
    b, page = open_page(p, URL)
    seed(page)
    wait_top(page, 'world')
    page.evaluate(EARLY)
    return b, page

def suspend_and_continue(page):
    """как при сворачивании Safari и выгрузке вкладки: сохранение → перезагрузка → «Продолжить»"""
    page.evaluate("G.storage.save(G.state)")
    page.reload(); time.sleep(1.0)
    page.evaluate("G.game.loadSaved()"); time.sleep(1.5)
    for _ in range(5):
        if top(page) == 'pause': key(page, 'KeyZ'); time.sleep(0.3)

def saved_after_recover(page):
    """сохранение из localStorage, пропущенное через G.story.recover (то, что делает «Продолжить»)"""
    return page.evaluate("""(() => { const st = JSON.parse(localStorage.getItem('wof_save_v1')).state; const fixes = G.story.recover(st); return { fixes, flags: st.flags, daily: st.daily, vars: st.vars }; })()""")

def press_until(page, name, n=50):
    for _ in range(n):
        if top(page) == name: return True
        key(page, 'KeyZ', wait=0.25)
    return top(page) == name

with sync_playwright() as p:
    # ── 1. урок Буншина прерван → урок начнётся снова, а не «прогул без отработки» ──
    b, page = fresh(p)
    page.evaluate("Object.assign(G.state.vars, { day: 16, min: 7*60 }); G.state.daily = { ev: 9 }")
    W(page, "const ac = G.world.konoha().buildings.find(b => b.tplId === 'academy'); s.setMap({ map: ac.interior.id, entry: true }); return 1"); time.sleep(0.6)
    page.evaluate("G.state.vars.min = 7*60+45"); time.sleep(0.8)
    check(page.evaluate("G.state.daily.lessonRun") == 1, 'урок идёт (lessonRun)')
    page.evaluate("G.storage.save(G.state)")
    r = saved_after_recover(page)
    check(not r['daily'].get('lesson') and not r['daily'].get('lessonRun') and 'урок' in r['fixes'], 'recover снимает отметку урока: %s' % r['fixes'])
    suspend_and_continue(page)
    page.evaluate("G.state.vars.min = 8*60+20"); time.sleep(1.0)
    check(page.evaluate("G.state.daily.lesson") == 1, 'урок Буншина начинается снова')
    b.close()

    # ── 2. очередь отработок: два прогула подряд не затирают друг друга ──
    b, page = fresh(p)
    page.evaluate("G.state.daily = {}; G.state.vars.day = 8; G.state.vars.min = 10*60; G.academy.checkSkip()")
    page.evaluate("G.state.daily = {}; G.state.vars.day = 9; G.state.vars.min = 10*60; G.academy.checkSkip()")
    page.evaluate("G.state.daily = {}; G.state.vars.day = 12; G.state.vars.min = 10*60; G.academy.checkSkip()")
    q = page.evaluate("G.state.makeupQ")
    check(q == [8, 9, 12], 'отработки хранятся списком: %s' % q)
    b.close()

    # ── 3. команда при ничьей по сумме ──
    b, page = fresh(p)
    t = page.evaluate("(() => { const v = G.state.vars; v.friend_naruto = 3; v.friend_sasuke = 3; v.friend_hinata = 6; return G.friends.team(); })()")
    check(t == 8, 'ничья 6:6 → команда с самым близким другом (8): %s' % t)
    t = page.evaluate("(() => { const v = G.state.vars; v.friend_naruto = 5; v.friend_sasuke = 0; v.friend_hinata = 5; return G.friends.team(); })()")
    check(t == 7, 'полная ничья → 7: %s' % t)
    check(page.evaluate("G.friends.KEY_ITEMS.includes('fishing_rod') && G.friends.KEY_ITEMS.includes('book_traps')"), 'удочку и книги нельзя подарить')
    b.close()

    # ── 4. бой: запасы в спарринге не тратятся, в настоящем бою тратятся после боя ──
    b, page = fresh(p)
    page.evaluate("G.state.inv.bandage = 2")
    W(page, "G.flow.battle({ enemy: 'naruto', mode: 'spar', terrain: 'field' }, s); return 1"); time.sleep(0.5)
    ok = False
    for _ in range(40):
        if B(page, "return s.state") == 'menu': ok = True; break
        key(page, 'KeyZ', wait=0.25)
    check(ok, 'бой с Наруто: дошли до меню действий')
    B(page, "s.D.P.hp = 10; const D=s.D; if(!D.hand.some(c=>c.id==='bandage')){for(const z of [D.deck,D.discard]){const i=z.findIndex(c=>c.id==='bandage');if(i>=0){D.hand.push(z.splice(i,1)[0]);break;}}} s.play('item:bandage'); return 1"); time.sleep(2.5)
    check(B(page, "return s.D.inv.bandage") == 1 and page.evaluate("G.state.inv.bandage") == 2, 'в спарринге бинт тратится в бою, но не из сумки')
    B(page, "s.debugWin(); return 1"); time.sleep(1.8); key(page, 'KeyZ'); time.sleep(0.5)
    check(page.evaluate("G.state.inv.bandage") == 2 and top(page) == 'world', 'после спарринга сумка цела')
    b.close()

    # ── 5. предупреждение об уроке перед тренировкой ──
    b, page = fresh(p)
    page.evaluate("G.state.daily = { ev: 9 }; G.state.vars.day = 2; G.state.vars.min = 8*60+30")
    W(page, "s.setMap({ map: 'konoha', x: 38 * 16 + 8, y: 119 * 16 + 8 }); return 1"); time.sleep(0.6)
    W(page, "G.train.start('throw', s); return 1"); time.sleep(0.5)
    check(top(page) == 'pick', 'перед тренировкой в часы урока — предупреждение')
    key(page, 'KeyX'); time.sleep(0.4)
    check(top(page) == 'world', 'отмена возвращает в мир без тренировки')
    W(page, "G.train.start('throw', s); return 1"); time.sleep(0.5)
    key(page, 'KeyZ'); time.sleep(0.6)
    check(top(page) == 'train', '«Всё равно» запускает тренировку')
    b.close()

report()
sys.exit(1 if fails or errors else 0)
