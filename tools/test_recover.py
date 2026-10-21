"""Регрессия: события, прерванные выгрузкой вкладки; очередь отработок; сон до ночи Мизуки; команда при ничьей;
клоны в бою; запасы в тренировочных боях; состояние после титров; предупреждение об уроке."""
import time, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from tlib import *

URL = "http://localhost:8765/index.html?debug=1"
EARLY = "Object.assign(G.state.flags, {st_tourney:1,st_kiba:1,st_prank:1,st_lee:1,st_festival:1,st_mizuki1:1,st_mizuki2:1,st_field:1,st_bells:1,field_done:1,bells_done:1}); G.state.vars.tourney = 4"

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
    # ── 1. финал прерван → после «Продолжить» ночь выпуска начинается заново ──
    # 2.0 (data/first_promise.js): ночь наступает после расследования promise_case, первый бой — у склада
    b, page = fresh(p)
    page.evaluate("Object.assign(G.state.vars, { day: 54, min: 19*60+58, exam: 85, exam_pass: 1 }); Object.assign(G.state.flags, { st_exam: 1, graduated: 1, best: 1, tech_bunshin: 1 }); G.state.daily = { ev: 9 }; G.state.quests.promise_case = { st: 'done', step: 99, day: 40 }")
    page.evaluate("G.state.vars.min = 20*60+5"); time.sleep(0.8)
    check(press_until(page, 'battle'), 'финал: первый бой ночи выпуска начался')
    page.evaluate("G.storage.save(G.state)")
    r = saved_after_recover(page)
    check(not r['flags'].get('st_night') and 'ночь Мизуки' in r['fixes'], 'recover снимает st_night: %s' % r['fixes'])
    suspend_and_continue(page)
    page.evaluate("G.state.vars.min = 20*60+10"); time.sleep(0.8)
    check(press_until(page, 'battle'), 'ночь выпуска начинается заново (игру можно пройти)')
    b.close()

    # ── 2. экзамен прерван → начинается заново ──
    b, page = fresh(p)
    page.evaluate("Object.assign(G.state.vars, { day: 54, min: 6*60 }); G.state.daily = { ev: 9 }; G.state.flags.tech_bunshin = 1")
    close_dialogs(page)
    page.evaluate("G.state.vars.min = 7*60+5"); time.sleep(0.8)
    check(press_until(page, 'train'), 'экзамен начался (письменный тест)')
    page.evaluate("G.storage.save(G.state)")
    r = saved_after_recover(page)
    check(not r['flags'].get('st_exam') and 'экзамен' in r['fixes'], 'recover снимает st_exam: %s' % r['fixes'])
    suspend_and_continue(page)
    page.evaluate("G.state.vars.min = 7*60+10"); time.sleep(0.8)
    check(press_until(page, 'train'), 'экзамен начинается заново')
    b.close()

    # ── 3. урок Буншина прерван → урок начнётся снова, а не «прогул без отработки» ──
    b, page = fresh(p)
    page.evaluate("Object.assign(G.state.vars, { day: 43, min: 7*60 }); G.state.daily = { ev: 9 }")
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

    # ── 4. очередь отработок: два прогула подряд не затирают друг друга ──
    b, page = fresh(p)
    page.evaluate("G.state.daily = {}; G.state.vars.day = 8; G.state.vars.min = 10*60; G.academy.checkSkip()")
    page.evaluate("G.state.daily = {}; G.state.vars.day = 15; G.state.vars.min = 10*60; G.academy.checkSkip()")
    page.evaluate("G.state.daily = {}; G.state.vars.day = 29; G.state.vars.min = 10*60; G.academy.checkSkip()")
    q = page.evaluate("G.state.makeupQ")
    check(q == [8, 15, 29], 'отработки хранятся списком: %s' % q)
    b.close()

    # ── 5. сон до ночи Мизуки запрещён ──
    b, page = fresh(p)
    r = page.evaluate("""(() => { G.state.vars.min = 19*60; G.state.flags.st_exam = 1; delete G.state.flags.mizuki_beaten;
      const a = G.script.runner('home_bed').next(); G.state.flags.mizuki_beaten = 1;
      const c = G.script.runner('home_bed').next(); return [a.text, c.op === 'choice' ? 'choice' : c.text]; })()""")
    check('садишься' in r[0], 'в день экзамена кровать не даёт лечь: «%s»' % r[0][:40])
    check(r[1] == 'choice', 'после победы над Мизуки кровать работает как обычно')
    b.close()

    # ── 6. команда при ничьей по сумме ──
    b, page = fresh(p)
    t = page.evaluate("(() => { const v = G.state.vars; v.friend_naruto = 3; v.friend_sasuke = 3; v.friend_hinata = 6; return G.friends.team(); })()")
    check(t == 8, 'ничья 6:6 → команда с самым близким другом (8): %s' % t)
    t = page.evaluate("(() => { const v = G.state.vars; v.friend_naruto = 5; v.friend_sasuke = 0; v.friend_hinata = 5; return G.friends.team(); })()")
    check(t == 7, 'полная ничья → 7: %s' % t)
    check(page.evaluate("G.friends.KEY_ITEMS.includes('fishing_rod') && G.friends.KEY_ITEMS.includes('book_traps')"), 'удочку и книги нельзя подарить')
    b.close()

    # ── 7. бой: клоны и запасы в спарринге ──
    b, page = fresh(p)
    k0 = page.evaluate("G.state.inv.kunai")
    W(page, "G.flow.battle({ enemy: 'naruto', mode: 'spar', terrain: 'field' }, s); return 1"); time.sleep(0.5)
    ok = False
    for _ in range(40):
        if B(page, "return s.state") == 'menu': ok = True; break
        key(page, 'KeyZ', wait=0.25)
    check(ok, 'бой с Наруто: дошли до меню действий')
    B(page, "s.E.clones = 2; s.E.realIdx = 1; return 1")
    B(page, "return s.act('throw', 'kunai')"); time.sleep(0.3)
    check(B(page, "return s.state") == 'target', 'с клонами — выбор цели')
    B(page, "s.sim.target(false); return 1"); time.sleep(0.4)
    c = B(page, "return [s.E.clones, s.E.realIdx]")
    check(c[0] == 1 and c[1] in (0, 1), 'после неверной цели клонов 1, настоящий в диапазоне 0..1: %s' % c)
    check(page.evaluate("G.state.inv.kunai") == k0, 'кунай в спарринге не тратится (%s → %s)' % (k0, page.evaluate("G.state.inv.kunai")))
    b.close()

    # ── 8. ловушки только с учебником ──
    b, page = fresh(p)
    page.evaluate("G.state.inv.wire = 2; G.state.inv.tag_explosive = 1; delete G.state.inv.book_traps")
    W(page, "G.flow.battle({ enemy: 'dummy', mode: 'ko', terrain: 'field' }, s); return 1"); time.sleep(0.5)
    for _ in range(30):
        if B(page, "return s.state") == 'menu': break
        key(page, 'KeyZ', wait=0.25)
    no_book = B(page, "return s.sim.buttons('tool').map(b => b.label)")
    page.evaluate("G.state.inv.book_traps = 1")
    with_book = B(page, "return s.sim.buttons('tool').map(b => b.label)")
    check(not any('Ловушка' in x for x in no_book) and any('Ловушка' in x for x in with_book), 'ловушки открываются учебником: %s → %s' % (no_book, with_book))
    b.close()

    # ── 9. после титров «Продолжить» ведёт в свободное утро дома ──
    b, page = fresh(p)
    page.evaluate("Object.assign(G.state.vars, { day: 54, min: 23*60, exam: 85, exam_pass: 1 }); Object.assign(G.state.flags, { st_exam: 1, st_night: 1, graduated: 1, best: 1, mizuki_beaten: 1 })")
    page.evaluate("G.scenes.fadeTo(G.scenes.make('ending'))"); time.sleep(1.5)
    check(top(page) == 'ending', 'титры открылись')
    for _ in range(8): time.sleep(0.9); key(page, 'KeyZ')
    time.sleep(1.0)
    page.evaluate("G.game.loadSaved()"); time.sleep(1.5)
    v = page.evaluate("[G.state.vars.day, G.state.vars.min, G.state.pos.map, G.state.flags.game_clear]")
    home = page.evaluate("G.world.heroHome().interior.id")
    check(v[0] == 55 and 7 * 60 <= v[1] <= 7 * 60 + 5 and v[2] == home and v[3] == 1, 'после титров: день 55, 07:00, дома: %s' % v)
    b.close()

    # ── 10. предупреждение об уроке перед тренировкой ──
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
