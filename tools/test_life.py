"""Тест этапов 7–9: уроки, тренировки, дружба, доска, события, экзамен, финал, концовка."""
import time, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from tlib import *

URL = "http://localhost:8765/index.html?debug=1"

def finish_train(page, s=1.0):
    if not wait_top(page, 'train', 5): return False
    page.evaluate("G.scenes.top().finishNow(%s)" % s); time.sleep(0.8)
    key(page, 'KeyZ'); time.sleep(0.3)
    return True

def to_konoha(page, tx, ty):
    W(page, "s.setMap({ map: 'konoha', x: %d * 16 + 8, y: %d * 16 + 8 }); return 1" % (tx, ty)); time.sleep(0.5)

with sync_playwright() as p:
    b, page = open_page(p, URL)
    seed(page)
    check(wait_top(page, 'world'), 'игра загрузилась в мир')
    # ── 1. урок в классе ──
    W(page, "const ac = G.world.konoha().buildings.find(b => b.tplId === 'academy'); s.setMap({ map: ac.interior.id, entry: true }); return 1"); time.sleep(0.6)
    page.evaluate("G.state.vars.min = 7 * 60 + 45"); time.sleep(0.5)
    check(page.evaluate("G.state.daily.lesson") == 1, 'урок начался сам при входе в класс')
    close_dialogs(page)
    check(wait_top(page, 'battle', 6), 'первый урок: бой с манекеном')
    B(page, "s.debugWin(); return 1"); time.sleep(2.2); key(page, 'KeyZ'); time.sleep(0.6)
    close_dialogs(page)
    v = page.evaluate("G.state.vars")
    check(v.get('att') == 1 and v.get('gn_prac') == 1, 'посещаемость и оценка записаны (%s, %s)' % (v.get('att'), v.get('gs_prac')))
    check(v['min'] >= 13 * 60, 'после урока 13:00+ (%d)' % v['min'])
    shot(page, 'life_after_lesson')
    # ── 2. тренировка ──
    to_konoha(page, 36, 110)
    xp0 = page.evaluate("G.state.vars.xp_tai || 0")
    W(page, "G.train.start('throw', s); return 1"); time.sleep(0.4)
    shot(page, 'life_train_intro')
    check(finish_train(page, 0.9), 'мини-игра метания открылась')
    close_dialogs(page)
    check(page.evaluate("G.state.vars.xp_tai || 0") > xp0, 'опыт тайдзюцу вырос')
    # ── 3. дружба: меню общения ──
    page.evaluate("G.state.vars.min = 15 * 60"); W(page, "s.refreshNpcs(); return 1"); time.sleep(0.3)
    n_before = page.evaluate("G.friends.pts('naruto')")
    W(page, "const n = s.map.npcs.find(n => n.id === 'naruto') || { id: 'naruto', talk: 'naruto_konoha' }; G.friends.menu(n, s); return 1"); time.sleep(0.4)
    check(top(page) == 'pick', 'меню дружбы открылось'); shot(page, 'life_friend_menu')
    key(page, 'KeyZ'); time.sleep(0.4); close_dialogs(page)
    check(page.evaluate("G.friends.pts('naruto')") > n_before, 'разговор добавил дружбу')
    inv0 = page.evaluate("JSON.stringify(G.state.inv)"); page.evaluate("G.state.inv = { chips: 2 }")
    W(page, "G.friends.menu({ id: 'choji' }, s); return 1"); time.sleep(0.3)
    key(page, 'ArrowDown'); key(page, 'KeyZ'); time.sleep(0.4)
    check(top(page) == 'pick', 'выбор подарка'); key(page, 'KeyZ'); time.sleep(0.4); close_dialogs(page)
    check(page.evaluate("G.friends.pts('choji')") >= 4, 'любимый подарок: +4 (Чоджи, %s)' % page.evaluate("G.friends.pts('choji')"))
    page.evaluate("G.state.inv = JSON.parse(%r)" % inv0)
    # ── 4. доска поручений ──
    page.evaluate("G.state.vars.min = 10 * 60; G.state.vars.energy = 90")
    m0 = page.evaluate("G.state.vars.money")
    W(page, "s.talk('board'); return 1"); time.sleep(0.6)
    check(top(page) == 'pick', 'доска поручений открылась'); shot(page, 'life_board')
    key(page, 'KeyZ'); time.sleep(0.4)
    check(finish_train(page, 1.0), 'мини-игра поручения')
    close_dialogs(page)
    check(page.evaluate("G.state.vars.money") > m0, 'деньги за поручение (%d→%d)' % (m0, page.evaluate("G.state.vars.money")))
    # ── 5. прогул ──
    page.evaluate("G.state.vars.day = 3; G.state.daily = {}; G.state.vars.min = 9 * 60 + 29; G.game.advance(2)"); time.sleep(0.3)
    check(page.evaluate("G.state.vars.miss") == 1, 'прогул засчитан')
    close_dialogs(page)
    # ── 6. сюжет: Киба (день 3) ──
    to_konoha(page, 80, 46)
    page.evaluate("G.state.vars.min = 14 * 60"); time.sleep(0.6)
    check(page.evaluate("G.state.flags.st_kiba") == 1 and page.evaluate("G.scenes.busy || G.scenes.top().name !== 'world'"), 'Киба сам находит героя')
    shot(page, 'life_kiba')
    for _ in range(4): key(page, 'KeyZ', wait=0.3)
    close_dialogs(page)
    if top(page) == 'battle':
        B(page, "s.debugWin(); return 1"); time.sleep(2.2); key(page, 'KeyZ'); time.sleep(0.5); close_dialogs(page)
    check(page.evaluate("G.state.flags.met_kiba") == 1, 'сцена Кибы завершена')
    # ── 7. свиток, готовка, календарь ──
    W(page, "G.flow.scroll({ i: 3 }, s); return 1"); time.sleep(0.3); close_dialogs(page)
    check(page.evaluate("G.state.vars.scrolls") == 1, 'секретный свиток найден')
    page.evaluate("Object.assign(G.state.inv, { rice: 1, fish: 1, vegetables: 1 })")
    W(page, "G.flow.cook({}, s); return 1"); time.sleep(0.3)
    pick(page, "Обычная готовка"); pick(page, "Бэнто: рис, рыба, овощи"); close_dialogs(page)   # с 1.6 — сначала выбор кухни
    check(page.evaluate("G.state.daily.bento") == 1, 'бэнто приготовлено')
    W(page, "G.flow.calendar({}, s); return 1"); time.sleep(0.4); shot(page, 'life_calendar'); key(page, 'KeyX'); time.sleep(0.3)
    page.evaluate("G.scenes.push(G.scenes.make('status'))"); time.sleep(0.4); shot(page, 'life_status'); key(page, 'KeyX'); time.sleep(0.3)
    # ── 7б. турнир (день 26) ──
    page.evaluate("Object.assign(G.state.vars, { day: 26, min: 6 * 60 }); G.state.daily = {}"); close_dialogs(page)
    page.evaluate("G.state.vars.min = 7 * 60 + 5"); time.sleep(0.6)
    check(page.evaluate("G.state.flags.st_tourney") == 1, 'турнир начался (перенос в Академию: %s)' % W(page, "return s.map.name"))
    for rnd in range(3):
        for _ in range(30):
            if top(page) == 'battle': break
            key(page, 'KeyZ', wait=0.25)
        if top(page) != 'battle': break
        if rnd == 0: shot(page, 'life_tourney')
        B(page, "s.debugWin(); return 1"); time.sleep(2.2); key(page, 'KeyZ'); time.sleep(0.6)
    close_dialogs(page)
    check(page.evaluate("G.state.vars.tourney") == 4, 'турнир: 3 победы → чемпион (%s), +300 рё' % page.evaluate("G.state.vars.tourney"))
    # ── 8. экзамен ──
    page.evaluate("Object.assign(G.state.vars, { day: 54, min: 6 * 60 }); G.state.daily = {}; G.state.flags.tech_bunshin = 1")
    close_dialogs(page)
    page.evaluate("G.state.vars.min = 7 * 60 + 5"); time.sleep(0.6)
    check(page.evaluate("G.state.flags.st_exam") == 1, 'экзамен начался')
    for i in range(3):
        close_dialogs(page)
        ok = finish_train(page, 1.0)
    close_dialogs(page)
    ex = page.evaluate("G.state.vars.exam")
    check(ex is not None and ex > 0, 'экзамен оценён: %s баллов, сдан=%s' % (ex, page.evaluate("G.state.vars.exam_pass")))
    # ── 9. ночь выпуска и концовка (2.0, data/first_promise.js) ──
    # ночь наступает после расследования «Пропавшие лекарства»; дальше два боя: удержать проход у склада и Гэндо
    page.evaluate("G.state.quests.promise_case = { st: 'done', step: 99, day: 40 }")
    page.evaluate("G.state.vars.min = 20 * 60 + 5")
    for _ in range(30):
        if page.evaluate("G.state.flags.st_night") == 1: break
        time.sleep(0.1)
    check(page.evaluate("G.state.flags.st_night") == 1, 'ночь выпуска началась')
    for stage, name in enumerate(['бой у склада: удержать проход', 'финальный бой с Гэндо']):
        for _ in range(50):
            if top(page) == 'battle': break
            key(page, 'KeyZ', wait=0.25)
        check(wait_top(page, 'battle', 5), name)
        shot(page, 'life_final_%d' % stage)
        B(page, "s.debugWin(); return 1"); time.sleep(2.2); key(page, 'KeyZ'); time.sleep(0.5)
    for _ in range(40):
        if top(page) == 'ending': break
        key(page, 'KeyZ', wait=0.25)
    time.sleep(1.0)
    check(top(page) == 'ending', 'концовка')
    for i in range(12):   # 2.0: 7 страниц титров («Первое обещание»), затем игра продолжается
        if top(page) != 'ending': break
        time.sleep(0.9); shot(page, 'life_end_%d' % i); key(page, 'KeyZ')
    time.sleep(1.2)
    check(top(page) == 'world', 'после титров — игра продолжается в мире (%s)' % top(page))
    check(page.evaluate("(G.storage.load() || {flags:{}}).flags.game_clear") == 1, 'сохранение с флагом прохождения')
    b.close()
report()
