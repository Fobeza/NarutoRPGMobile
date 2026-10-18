"""Календарь и расписания."""
import time, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from tlib import *
URL = "http://localhost:8765/index.html?debug=1"
with sync_playwright() as p:
    b, page = open_page(p, URL)
    seed(page)
    check(wait_top(page, 'world'), 'мир')
    page.evaluate("G.state.vars.day = 26; G.state.vars.min = 15*60")
    page.evaluate("G.scenes.push(G.scenes.make('calendar'))"); time.sleep(0.4)
    shot(page, 'cal_days')
    check(top(page) == 'calendar', 'календарь открыт')
    key(page, 'KeyZ'); time.sleep(0.3); shot(page, 'cal_sched')
    key(page, 'ArrowRight', 3); key(page, 'ArrowDown'); time.sleep(0.3); shot(page, 'cal_sched2')
    key(page, 'Escape'); time.sleep(0.3)
    # расписание: где Наруто в разное время
    for day, h in [(15, 9), (15, 12.5), (15, 15), (20, 10), (20, 13)]:
        print(day, h, page.evaluate("G.schedule.label('naruto', %d, %d)" % (day, h * 60)))
    # уличные перемещения
    res = []
    for day, h in [(15, 13), (15, 16), (20, 10), (20, 15)]:
        page.evaluate("G.state.vars.day=%d; G.state.vars.min=%d" % (day, h * 60))
        W(page, "s.setMap({ map: 'konoha', x: 20*16, y: 20*16 }); return 1"); time.sleep(0.4)
        r = W(page, "const n = s.map.npcs.find(n => n.id === 'naruto'); s.refreshNpcs(); return {vis: s.npcs.includes(n), tx: Math.round(n.x/16), ty: Math.round(n.y/16)}")
        res.append(r); print(day, h, r)
    check(res[0]['vis'] and res[1]['vis'] and (res[0]['tx'], res[0]['ty']) != (res[1]['tx'], res[1]['ty']), 'Наруто в разных местах в разное время')
    check(not errors, 'нет JS-ошибок %s' % errors[:2])
    b.close()
print('FAILS', fails)
