#!/usr/bin/env python3
"""
Автотест в эмуляции iPhone 15 Pro (Playwright + Chromium).
Сценарий: титул → пролог → больница, имя, решение Хокаге (задание, стрелка) → вступительный тест → улица (след A*) → Квартира Наруто → карта →
Наруто у качелей → Академия (Ирука) → Наруто зовёт в Ичираку → лавка Теучи, рамен,
угостить Наруто → оружейная → поручение Ино → секрет водопада → журнал → большая карта/метка → сумка → сон → «Итоги дня» → утро дня 2 → часы, расписание, голод, обморок, рис, патруль, дождь, статус, 2:00 ночи, код сохранения, пауза → меню →
«Продолжить» после перезагрузки.
Скриншоты кладёт в tools/shots/. Ошибки JS выводит в консоль.

    python3 tools/test_iphone.py [http://localhost:8765/index.html]
"""
import os, sys, time
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/index.html"
URL += ("&" if "?" in URL else "?") + "t=%d" % time.time()   # без кеша
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")
os.makedirs(OUT, exist_ok=True)

errors, fails = [], []

def shot(page, name):
    page.screenshot(path=os.path.join(OUT, name + ".png"))
    print("  📸", name)

def check(cond, msg):
    print(("  ✔ " if cond else "  ✘ ") + msg)
    if not cond: fails.append(msg)

def key(page, k, n=1, wait=0.12):
    for _ in range(n):
        page.keyboard.press(k); time.sleep(wait)

def top(page):
    return page.evaluate("G.scenes.top().name")

def W(page, js):
    return page.evaluate("(() => { const s = G.scenes.stack.find(x => x.name === 'world'); " + js + " })()")

def pos(page):
    return W(page, "return { m: s.map.id, x: s.player.x, y: s.player.y, name: s.map.name };")

def close_dialogs(page, limit=40):
    for _ in range(limit):
        if top(page) == "world" and not page.evaluate("G.scenes.busy"): return
        page.keyboard.press("KeyZ"); time.sleep(0.22)

def walk_axis(page, axis, target, tol=3, timeout=6.0):
    """Идём вдоль оси до координаты target (в пикселях). False — если упёрлись."""
    t0, last, still = time.time(), None, 0
    while time.time() - t0 < timeout:
        p = pos(page); v = p[axis]
        if abs(v - target) <= tol: return True
        k = ("ArrowRight" if v < target else "ArrowLeft") if axis == "x" else ("ArrowDown" if v < target else "ArrowUp")
        page.keyboard.down(k); time.sleep(0.06 if abs(v - target) < 10 else 0.15); page.keyboard.up(k)
        if p.get("m") != pos(page).get("m"): return True     # сменилась карта (дверь)
        still = still + 1 if last is not None and abs(last - v) < 0.5 else 0
        if still > 6: return False
        last = v
    return False

def walk_path(page, pts):
    for axis, target in pts:
        if not walk_axis(page, axis, target): return False
    return True

def menu_pick(page, label):
    """Открыть меню (Escape) и выбрать пункт по подписи — новые пункты меню не сбивают счёт."""
    key(page, "Escape"); time.sleep(0.3)
    i = page.evaluate("G.scenes.top().name === 'menu' ? G.scenes.top().labels().indexOf(%r) : -1" % label)
    if i > 0: key(page, "ArrowDown", i)
    key(page, "KeyZ"); time.sleep(0.4)

def wait_map(page, mid=None, prefix=None, t=3.0):
    # с 2.0 двери открываются только кнопкой A: у двери с подсказкой «Войти»/«Выйти» жмём её один раз
    t0, pressed = time.time(), False
    while time.time() - t0 < t:
        try:
            if top(page) == "world" and not page.evaluate("G.scenes.busy"):
                m = pos(page)["m"]
                if (mid and m == mid) or (prefix and m.startswith(prefix)): return True
                if not pressed and W(page, "const a = s.currentAction(); return a ? a.label : null;") in ("Войти", "Выйти"):
                    page.keyboard.press("KeyZ"); pressed = True
        except Exception: pass
        time.sleep(0.1)
    return False

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(
        viewport={"width": 393, "height": 852 - 59 - 34},   # без safe-area (как в режиме «На экран Домой»)
        device_scale_factor=3, is_mobile=True, has_touch=True,
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    )
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.goto(URL)
    page.evaluate("localStorage.clear()")
    page.reload()
    time.sleep(1.0)
    print("Экран:", page.evaluate("G.screen.W + 'x' + G.screen.H + ' x' + G.screen.scale"))
    shot(page, "01_title")

    # ── новая игра: пролог (голоса в темноте) → палата больницы → имя → решение Хокаге ──
    key(page, "Enter"); time.sleep(0.8)
    key(page, "Enter"); time.sleep(1.2)           # «Новая игра»
    check(top(page) == "dialog:prologue_voices", "пролог: голоса в темноте (%s)" % top(page))
    shot(page, "02_prologue")
    for _ in range(20):
        if top(page) == "world": break
        key(page, "KeyZ", 1, 0.5)
    time.sleep(2.2)
    check(top(page) == "dialog:hosp_wake" and pos(page)["name"] == "Больница", "очнулся в палате больницы (%s / %s)" % (top(page), pos(page)["name"]))
    shot(page, "04_wake_dialog")
    for _ in range(20):
        if top(page) == "nameinput": break
        key(page, "KeyZ", 1, 0.5)
    check(top(page) == "nameinput", "Хокаге спрашивает имя: открылся ввод")
    time.sleep(0.4)
    shot(page, "03_name_entry")
    page.fill("#te-input", "Кайто")
    page.dispatch_event("#te-ok", "pointerdown")
    time.sleep(1.0)
    for _ in range(60):
        if top(page) == "world" and not page.evaluate("G.scenes.busy"): break
        key(page, "KeyZ", 1, 0.5)                 # на вопросах — первый вариант
    time.sleep(0.5)
    p0 = pos(page)
    check(p0["name"] == "Больница" and page.evaluate("G.state.started && G.state.hero.name") == "Кайто", "имя сохранено, игра началась (%s)" % p0["name"])
    check(page.evaluate("!!G.state.flags.hosp_done"), "Хокаге, Ирука и Сидзуне вышли из палаты")
    time.sleep(2.8)   # дождаться, пока уйдёт уведомление «Новое задание»
    shot(page, "05_hospital")
    # ── Этап 3.5: задание «Первый день», стрелка ведёт к выходу ──
    q = page.evaluate("[G.quests.tracked(), (G.quests.curStep('day1')||{}).id]")
    check(q == ["day1", "academy"], "задание «Первый день» отслеживается, шаг «Дойти до Академии» (%s)" % q)
    h = W(page, "const t = G.nav.current(); const h = G.nav.hop(s.map, t); return { label: t && t.label, exit: !!(h && h.exit) };")
    check(h["exit"] and h["label"] == "Академия", "в больнице навигация ведёт к выходу, цель — Академия (%s)" % h)

    # ── выход на улицу: вниз вдоль левой стены, к коврику, вниз ─
    mat = W(page, "const w = s.map.warps[0].rect; return { x: w.x + w.w / 2, y: w.y + w.h / 2 };")
    walk_path(page, [("x", mat["x"]), ("y", mat["y"] + 8)])   # из палаты: вправо вдоль коек и вниз к коврику
    ok = wait_map(page, "konoha")
    check(ok, "вышел из больницы на улицу Конохи")
    if not ok:
        W(page, "s.goTo({ map: 'konoha', x: 87*16+8, y: 70*16+12, dir: 'down' });"); wait_map(page, "konoha")
    time.sleep(0.6)
    shot(page, "06_konoha_street")
    # на улице: следующий шаг — дверь Академии; след A*
    nav = W(page, """const t = G.nav.current(), h = G.nav.hop(s.map, t);
        const path = G.nav.path(s.map, s.player.x, s.player.y, h.x, h.y);
        const g = G.nav.walkGrid(s.map);
        const okAll = path && path.every(([x, y]) => g[y * s.map.w + x] === 1);
        return { final: h.final, len: path ? path.length : 0, okAll, m: G.nav.meters(s.map, s.player.x, s.player.y, t) };""")
    print("   ", nav)
    check(nav["final"] and nav["len"] > 20 and nav["okAll"], "на улице путь A* до двери Академии найден (%s тайлов, ≈%s м)" % (nav["len"], nav["m"]))
    key(page, "KeyG"); time.sleep(1.2)
    tr = W(page, "return { on: !!s.trail, ms: s.trailMs };")
    check(tr["on"], "кнопка ЦЕЛЬ показывает светящийся след (A* за %s мс)" % tr["ms"])
    shot(page, "31_trail")
    # идём по следу (телепорт по точкам пути — проверка, что путь проходим без застреваний)
    walked = W(page, """const t = G.nav.current(), h = G.nav.hop(s.map, t);
        const path = G.nav.path(s.map, s.player.x, s.player.y, h.x, h.y);
        for (const [x, y] of path) { const r = { x: x*16+3, y: y*16+7, w: 10, h: 5 }; if (s.map.blockedRect(r)) return false; }
        const last = path[path.length - 1]; s.player.x = last[0]*16+8; s.player.y = last[1]*16+12; s.player.dir = 'up'; s.updateCamera(); return true;""")
    check(walked, "весь путь до Академии свободен")
    time.sleep(0.4)
    shot(page, "32_academy_door")
    # вход в Академию закрывает шаг «Дойти»
    W(page, "s.setMap({ map: G.world.konoha().landmarks.academy.interior.id, entry: true });"); time.sleep(0.8)
    q = page.evaluate("(G.quests.curStep('day1')||{}).id")
    check(q == "iruka", "вход в Академию закрыл шаг, следующий — Ирука (%s)" % q)
    tg = W(page, "const t = G.nav.current(), h = G.nav.hop(s.map, t); return { final: !!h.final, npc: !!t.npc, icon: G.quests.iconFor('iruka') };")
    check(tg["final"] and tg["npc"] and tg["icon"] == "?", "в классе цель — Ирука, над ним «?» (%s)" % tg)
    time.sleep(2.0)
    shot(page, "33_academy_iruka_target")
    W(page, "s.setMap(G.world.outsideOf(G.world.konoha().landmarks.academy));"); time.sleep(0.4)
    W(page, "s.setMap(G.world.outsideOf(G.world.heroHome()));"); time.sleep(0.4)

    # ── прогулка к квартире Наруто и вход ──────────────────────
    door = page.evaluate("(() => { const b = G.world.konoha().buildings.find(b => b.tplId === 'naruto_flat'); return { x: b.door.tx*16+8, y: b.door.ty*16+8 }; })()")
    hold_start = pos(page)
    walk_path(page, [("y", hold_start["y"] + 20), ("x", door["x"]), ("y", door["y"] + 22), ("y", door["y"])])
    ok = wait_map(page, prefix="in:")
    if not ok:   # дорога могла быть перекрыта — подходим телепортом к двери и жмём вверх
        W(page, "s.player.x = %d; s.player.y = %d; s.player.dir = 'up';" % (door["x"], door["y"] + 20))
        walk_axis(page, "y", door["y"]); ok = wait_map(page, prefix="in:")
    check(ok and pos(page)["name"] == "Квартира Наруто", "вошёл в Квартиру Наруто")
    time.sleep(0.5)
    shot(page, "07_naruto_flat")
    hold = lambda k, s: (page.keyboard.down(k), time.sleep(s), page.keyboard.up(k))
    mat = W(page, "const w = s.map.warps[0].rect; return { x: w.x + w.w / 2, y: w.y + w.h / 2 };")
    walk_path(page, [("x", mat["x"]), ("y", mat["y"] + 8)])
    ok = wait_map(page, "konoha")
    pp = pos(page)
    check(ok and abs(pp["x"] - door["x"]) < 20 and pp["y"] > door["y"], "вышел обратно к двери снаружи")

    # ── карта ─────────────────────────────────────────────────
    key(page, "Tab"); time.sleep(0.6)
    check(top(page) == "mapview", "открылась карта")
    shot(page, "08_map")
    key(page, "KeyX"); time.sleep(0.4)

    # ── Наруто у качелей ──────────────────────────────────────
    nx = W(page, "const n = s.map.npcs.find(n => n.id === 'naruto'); return n ? { x: n.x, y: n.y } : null;")
    check(nx is not None, "Наруто стоит в деревне")
    if nx:
        W(page, "s.player.x = %f; s.player.y = %f; s.player.dir = 'up'; s.updatePlace(true);" % (nx["x"], nx["y"] + 16))
        time.sleep(0.5)
        shot(page, "09_naruto_mark")
        key(page, "KeyZ"); time.sleep(0.4)
        key(page, "KeyZ", 3, 0.45); time.sleep(0.5)
        shot(page, "10_naruto_choice")
        close_dialogs(page)
        check(page.evaluate("!!G.state.flags.met_naruto"), "флаг знакомства с Наруто")

    # ── Академия: класс, Ирука ─────────────────────────────────
    ac = page.evaluate("(() => { const b = G.world.konoha().buildings.find(b => b.tplId === 'academy'); return { x: b.door.tx*16+8, y: b.door.ty*16+8 }; })()")
    W(page, "s.player.x = %d; s.player.y = %d; s.player.dir = 'up';" % (ac["x"], ac["y"] + 18))
    time.sleep(0.2)
    walk_axis(page, "y", ac["y"]); ok = wait_map(page, prefix="in:")
    check(ok and "Академия" in pos(page)["name"], "вошёл в Академию")
    ir = W(page, "const n = s.map.npcs.find(n => n.id === 'iruka'); return { x: n.x, y: n.y };")
    W(page, "s.player.x = %f; s.player.y = %f; s.player.dir = 'up';" % (ir["x"], ir["y"] + 16))
    time.sleep(0.2); key(page, "KeyZ"); time.sleep(0.9)
    shot(page, "11_iruka_class")
    # ── Этап 4: вступительный тест (характеристики и навыки) ──
    for _ in range(40):
        if top(page) in ("charcreate", "world"): break
        page.keyboard.press("KeyZ"); time.sleep(0.25)
    check(top(page) == "charcreate", "Ирука устроил вступительный тест")
    key(page, "ArrowRight", 3, 0.15); key(page, "ArrowDown"); key(page, "ArrowRight", 2, 0.15)
    shot(page, "50_charcreate_stats")
    page.evaluate("(() => { const s = G.scenes.top(); s.randomize(); })()")
    key(page, "ArrowUp", 2); key(page, "KeyZ"); time.sleep(0.3)       # «Далее»
    key(page, "KeyZ"); key(page, "ArrowDown"); key(page, "ArrowDown"); key(page, "KeyZ"); time.sleep(0.2)
    shot(page, "51_charcreate_skills")
    page.evaluate("G.scenes.top().finish({ tai: 5, nin: 3, gen: 3, chakra: 4, ctrl: 4, spd: 6, end: 5, know: 6 }, ['eagle_eye', 'diligent'])")
    time.sleep(0.4)
    check(page.evaluate("G.hero.ready() && G.hero.stat('spd') === 6 && G.hero.has('diligent')"), "характеристики и навыки сохранены")
    close_dialogs(page)
    check(page.evaluate("!!G.state.flags.met_iruka"), "разговор с Ирукой в классе")
    check(page.evaluate("(G.quests.curStep('day1')||{}).id") == "naruto", "шаг задания: найти Наруто")
    check(page.evaluate("G.quests.active('homework')"), "Ирука дал задание «Снаряжение к уроку»")
    # 2.0 (first_promise.js): после теста Ирука зачисляет в класс, время больше не переводится на 12:30
    check(page.evaluate("!!G.state.flags.enrolled"), "зачислен в класс Ируки")

    # ── Этап 3: сюжет первого дня ─────────────────────────────
    W(page, "s.setMap(G.world.outsideOf(G.world.konoha().buildings.find(b => b.tplId === 'academy')));")
    time.sleep(0.4)
    nx = W(page, "const n = s.npcs.find(n => n.id === 'naruto'); return { x: n.x, y: n.y };")
    W(page, "s.player.x = %f; s.player.y = %f; s.player.dir = 'up';" % (nx["x"], nx["y"] + 16))
    time.sleep(0.2); key(page, "KeyZ"); time.sleep(0.5)
    key(page, "KeyZ", 3, 0.45); time.sleep(0.4)
    shot(page, "20_naruto_invite")
    close_dialogs(page)
    check(page.evaluate("(G.quests.curStep('day1')||{}).id") == "ramen" and page.evaluate("!!G.state.flags.naruto_invited"), "Наруто позвал в Ичираку")
    check(not W(page, "return s.npcs.some(n => n.id === 'naruto')"), "Наруто ушёл с качелей")
    shot(page, "21_goal_ramen")

    ich = page.evaluate("(() => { const b = G.world.konoha().buildings.find(b => b.tplId === 'ichiraku'); return { x: b.door.tx*16+8, y: b.door.ty*16+8 }; })()")
    W(page, "s.player.x = %d; s.player.y = %d; s.player.dir = 'up';" % (ich["x"], ich["y"] + 18))
    time.sleep(0.2); walk_axis(page, "y", ich["y"]); ok = wait_map(page, prefix="in:")
    check(ok and pos(page)["name"] == "Ичираку рамен", "вошёл в Ичираку")
    check(W(page, "return s.npcs.some(n => n.id === 'naruto')"), "Наруто ждёт в Ичираку")
    time.sleep(0.4)
    shot(page, "22_ichiraku")
    te = W(page, "const n = s.npcs.find(n => n.id === 'teuchi'); return { x: n.x, y: n.y };")
    W(page, "s.player.x = %f; s.player.y = %f; s.player.dir = 'up';" % (te["x"], te["y"] + 34))
    time.sleep(0.2); key(page, "KeyZ"); time.sleep(0.5)
    check(top(page) == "shop", "открылась лавка Теучи")
    shot(page, "23_shop")
    key(page, "KeyZ", 2, 0.4); time.sleep(0.5)      # первое A — режим количества, второе — покупка
    shot(page, "24_shop_bought")
    money1 = page.evaluate("G.state.vars.money")
    check(money1 == 260, "мисо-рамен куплен за 40 рё (осталось %s)" % money1)
    key(page, "KeyX"); time.sleep(0.6)
    key(page, "KeyZ", 2, 0.45); time.sleep(0.4)
    shot(page, "25_treat_choice")
    close_dialogs(page)
    f = page.evaluate("[G.state.flags.ramen_done, G.state.flags.treated_naruto, (G.quests.curStep('day1')||{}).id, G.state.vars.money, G.state.vars.friend_naruto, G.game.clock()]")
    print("   ", f)
    check(f[0] == 1 and f[1] == 1 and f[2] == "sleep" and f[3] == 220, "угостил Наруто, шаг — домой спать")

    # магазин снаряжения: кунаи ×3
    wp = page.evaluate("(() => { const b = G.world.konoha().buildings.find(b => b.tplId === 'weapons'); return b.interior.id; })()")
    page.evaluate("G.state.vars.min = 10*60")    # днём, чтобы лавка была открыта
    W(page, "s.setMap({ map: '%s', entry: true });" % wp); time.sleep(0.4)
    kp = W(page, "const n = s.npcs.find(n => n.shop); return { x: n.x, y: n.y };")
    W(page, "s.player.x = %f; s.player.y = %f; s.player.dir = 'up';" % (kp["x"], kp["y"] + 34))
    time.sleep(0.2); key(page, "KeyZ"); time.sleep(0.5)
    key(page, "KeyZ", 1, 0.3); key(page, "ArrowRight", 2, 0.15); key(page, "KeyZ"); time.sleep(0.4)   # количество 3 → купить
    shot(page, "26_weapons")
    key(page, "KeyX"); time.sleep(0.4)
    check(page.evaluate("G.game.count('kunai')") == 3, "куплено 3 куная")
    check(page.evaluate("(G.quests.curStep('homework')||{}).id") == "show", "покупка кунаев закрыла шаг «Купить»")

    # ── Этап 3.5: побочные задания ────────────────────────────
    fl = page.evaluate("G.world.konoha().buildings.find(b => b.tplId === 'flowers').interior.id")
    W(page, "s.setMap({ map: '%s', entry: true });" % fl); time.sleep(0.5)
    check(page.evaluate("G.quests.iconFor('ino')") == "!", "над Ино «!» — есть поручение")
    time.sleep(2.0)
    shot(page, "34_ino_offer_mark")
    ino = W(page, "const n = s.npcs.find(n => n.id === 'ino'); return { x: n.x, y: n.y };")
    W(page, "s.player.x = %f; s.player.y = %f; s.player.dir = 'up';" % (ino["x"], ino["y"] + 34))
    time.sleep(0.2); key(page, "KeyZ"); time.sleep(0.5); key(page, "KeyZ", 2, 0.45); time.sleep(0.4)
    shot(page, "35_ino_choice")
    key(page, "KeyZ"); time.sleep(0.4)
    close_dialogs(page)
    check(page.evaluate("G.quests.active('ino_flowers') && G.game.count('bouquet_ino') === 1"), "взял поручение Ино, букет в сумке")
    page.evaluate("G.state.vars.min = 15*60")    # после уроков Хината у дома Хьюга
    hi = W(page, "s.setMap({ map: 'konoha', x: 88*16+8, y: 72*16+8 }); const n = s.npcs.find(n => n.id === 'hinata'); return { x: n.x, y: n.y };")
    time.sleep(0.3)
    W(page, "s.player.x = %f; s.player.y = %f; s.player.dir = 'up'; s.updateCamera();" % (hi["x"], hi["y"] + 16))
    time.sleep(0.2); key(page, "KeyZ"); time.sleep(0.4); close_dialogs(page)
    check(page.evaluate("(G.quests.curStep('ino_flowers')||{}).id") == "return" and page.evaluate("G.game.count('bouquet_ino')") == 0, "букет вручён Хинате")
    m0 = page.evaluate("G.state.vars.money")
    W(page, "s.setMap({ map: '%s', entry: true });" % fl); time.sleep(0.4)
    W(page, "s.player.x = %f; s.player.y = %f; s.player.dir = 'up';" % (ino["x"], ino["y"] + 34))
    time.sleep(0.2); key(page, "KeyZ"); time.sleep(0.4); close_dialogs(page)
    check(page.evaluate("G.quests.done('ino_flowers')") and page.evaluate("G.state.vars.money") == m0 + 60, "поручение Ино выполнено: +60 рё")
    # секрет у водопада
    rk = page.evaluate("(() => { const r = G.world.konoha().secretRock; return { x: r.x, y: r.y }; })()")
    W(page, "s.setMap({ map: 'konoha', x: %d, y: %d, dir: 'up' });" % (rk["x"], rk["y"] + 16)); time.sleep(0.4)
    # прохожий, случайно оказавшийся у камня, перехватил бы нажатие — уводим всех жителей подальше
    W(page, "for (const n of s.npcs) { if (Math.abs(n.x - s.player.x) < 48 && Math.abs(n.y - s.player.y) < 48) { n.x += 200; n.y += 200; } }; return 1")
    shot(page, "36_waterfall_rock")
    key(page, "KeyZ"); time.sleep(0.4); close_dialogs(page)
    check(page.evaluate("G.quests.done('waterfall_scroll')") and page.evaluate("G.state.vars.money") == m0 + 160, "секрет водопада найден: +100 рё")

    # журнал заданий
    menu_pick(page, "Задания")
    check(top(page) == "journal", "открылся журнал заданий")
    shot(page, "37_journal")
    key(page, "KeyZ"); time.sleep(0.3)
    shot(page, "38_journal_detail")
    key(page, "KeyX"); key(page, "ArrowRight"); time.sleep(0.2)
    shot(page, "39_journal_done")
    key(page, "KeyX"); key(page, "KeyX"); time.sleep(0.3)

    # большая карта: фильтры, масштаб, карточка места, метка
    W(page, "s.setMap({ map: 'konoha', x: 66*16+8, y: 46*16+8, dir: 'down' });"); time.sleep(0.3)
    key(page, "Tab"); time.sleep(0.5)
    shot(page, "40_bigmap")
    key(page, "KeyG"); time.sleep(0.3)
    ac2 = page.evaluate("(() => { const b = G.world.konoha().landmarks.ichiraku; return { x: b.door.tx + 0.5, y: b.door.ty + 1 }; })()")
    page.evaluate("(() => { const s = G.scenes.top(); s.cx = %f; s.cy = %f; s.fitView(true); })()" % (ac2["x"], ac2["y"]))
    time.sleep(0.2)
    shot(page, "41_bigmap_x2")
    # 2.0: близкие значки собраны в группу — A открывает выбор «Места рядом», в нём берём Ичираку
    pick_i = page.evaluate("(() => { const s = G.scenes.top(), [sx, sy] = s.toScreen(s.cx, s.cy), m = s.clusterAt(sx, sy); return m && m.items && m.items.length > 1 ? m.items.findIndex(x => x.label === 'Ичираку рамен') : -1; })()")
    key(page, "KeyZ"); time.sleep(0.3)
    if top(page) == "pick" and pick_i >= 0:
        key(page, "ArrowDown", pick_i); key(page, "KeyZ"); time.sleep(0.3)
    check(page.evaluate("!!G.scenes.top().card"), "карточка места на карте")
    shot(page, "42_place_card")
    key(page, "ArrowDown"); key(page, "KeyZ"); time.sleep(0.3)
    check(page.evaluate("!!G.state.marker && G.state.marker.label") == "Ичираку рамен", "метка поставлена на Ичираку")
    key(page, "Escape"); time.sleep(0.2); key(page, "Escape"); time.sleep(0.2); key(page, "Escape"); time.sleep(0.2)
    shot(page, "43_bigmap_filter")
    key(page, "KeyX"); time.sleep(0.4)
    cur = page.evaluate("(G.nav.current()||{}).label")
    check(cur == "Ичираку рамен", "метка важнее задания: стрелка ведёт к Ичираку (%s)" % cur)
    W(page, "s.player.x = G.state.marker.x*16+8; s.player.y = G.state.marker.y*16+8;"); time.sleep(0.5)
    check(page.evaluate("G.state.marker") is None, "дошёл до метки — она снята")
    page.evaluate("G.state.vars.min = 19*60 + 45")

    # сумка
    menu_pick(page, "Сумка")
    check(top(page) == "bag", "открылась сумка")
    shot(page, "27_bag")
    key(page, "KeyX"); time.sleep(0.2); key(page, "KeyX"); time.sleep(0.3)

    # домой, спать
    home = page.evaluate("G.world.heroHome().interior.id")
    W(page, "s.setMap({ map: '%s', x: 42, y: 68, dir: 'left' });" % home); time.sleep(0.5)
    shot(page, "28_home_night")
    key(page, "KeyZ"); time.sleep(0.5); key(page, "KeyZ", 1, 0.5)
    time.sleep(0.3); key(page, "KeyZ"); time.sleep(2.2)
    check(top(page) == "daysum", "экран «Итоги дня»")
    shot(page, "29_daysum")
    key(page, "KeyZ"); time.sleep(1.6)
    shot(page, "30_day2_morning")
    close_dialogs(page)
    d = page.evaluate("[G.state.vars.day, G.game.clock(), G.quests.done('day1'), G.quests.tracked()]")
    check(d[0] == 2 and d[1].startswith("07:0") and d[2], "наступил день 2, 07:00, «Первый день» выполнен (%s)" % d)
    shot(page, "44_day2_hud")

    # ── Этап 4: время и жизнь ─────────────────────────────────
    W(page, "s.setMap({ map: 'konoha', x: 66*16+8, y: 46*16+8, dir: 'down' });"); time.sleep(0.5)
    m0 = page.evaluate("G.state.vars.min"); time.sleep(3.2); m1 = page.evaluate("G.state.vars.min")
    check(1 <= m1 - m0 <= 3, "часы идут сами: за 3 сек прошло %s игровых мин" % (m1 - m0))
    key(page, "Escape"); time.sleep(0.3); m2 = page.evaluate("G.state.vars.min"); time.sleep(2.0); m3 = page.evaluate("G.state.vars.min")
    check(m3 == m2, "в меню часы стоят")
    key(page, "Escape"); time.sleep(0.3)
    # расписание: вторник 9:00 — Наруто в классе, в 13:00 — на качелях
    page.evaluate("G.state.vars.min = 9*60")
    acid = page.evaluate("G.world.konoha().landmarks.academy.interior.id")
    page.evaluate("G.state.daily.lesson = 1")   # урок считаем пройденным (уроки тестирует test_life.py)
    W(page, "s.setMap({ map: '%s', entry: true });" % acid); time.sleep(0.6)
    cls = W(page, "return s.npcs.map(n => n.id);")
    check("naruto" in cls and "sakura" in cls and "iruka" in cls, "утром в будни класс полон (%s)" % cls)
    shot(page, "52_class_morning")
    page.evaluate("G.state.vars.min = 13*60+5")
    W(page, "s.setMap({ map: 'konoha', x: 66*16+8, y: 46*16+8, dir: 'down' });"); time.sleep(0.4)
    sw = W(page, "return s.npcs.some(n => n.id === 'naruto');")
    tg = page.evaluate("(() => { const f = G.nav.findNpc('iruka'); return f ? (f.b ? f.b.tplId : 'konoha') : null; })()")
    check(sw, "после уроков Наруто на качелях")
    page.evaluate("G.state.vars.min = 16*60")
    tg = page.evaluate("(() => { const f = G.nav.findNpc('iruka'); return f ? (f.b ? f.b.tplId : 'konoha') : null; })()")
    check(tg == "hokage_tower", "в 16:00 Ирука за столом миссий в Резиденции (%s)" % tg)
    page.evaluate("G.state.vars.min = 19*60")
    tg = page.evaluate("(() => { const f = G.nav.findNpc('iruka'); return f ? (f.b ? f.b.tplId : 'konoha') : null; })()")
    check(tg == "ichiraku", "вечером Ирука ужинает в Ичираку (%s)" % tg)
    # нужды: голод → предупреждение, усталость → обморок и больница
    page.evaluate("G.state.vars.min = 14*60; G.state.vars.food = 0.15; G.state.daily = {}")
    W(page, "s.softRefresh();"); time.sleep(1.6)
    check(W(page, "return !!(s.toast && /урчит/.test(s.toast.text)) || G.state.daily.hungry === 1;"), "голод: предупреждение «Живот урчит»")
    shot(page, "53_hungry")
    page.evaluate("G.state.vars.energy = 0.05")
    time.sleep(3.5)
    p_ = pos(page)
    check(p_["name"] == "Больница" or "Больниц" in p_["name"], "обморок от усталости — очнулся в больнице (%s)" % p_["name"])
    shot(page, "54_hospital")
    close_dialogs(page)
    check(page.evaluate("G.state.vars.energy") >= 30, "в больнице энергия восстановлена")
    # дома: бесплатный рис
    hm = page.evaluate("G.world.heroHome().interior.id")
    W(page, "s.setMap({ map: '%s', x: 7*16+8, y: 3*16+12, dir: 'up' });" % hm); time.sleep(0.4)
    f0 = page.evaluate("G.state.vars.food")
    key(page, "KeyZ"); time.sleep(0.5); key(page, "KeyZ"); time.sleep(0.4); key(page, "KeyZ"); time.sleep(0.4)
    close_dialogs(page)
    check(page.evaluate("G.state.vars.food") >= f0 + 20, "дома сварил рис: сытость +25 (%s → %s)" % (round(f0), round(page.evaluate("G.state.vars.food"))))
    # комендантский час: патруль отводит домой
    page.evaluate("G.state.vars.min = 23*60+40")
    W(page, "s.setMap({ map: 'konoha', x: 66*16+8, y: 46*16+8, dir: 'down' });"); time.sleep(0.4)
    shot(page, "55_night_curfew")
    W(page, "s.talk('patrol_curfew');"); time.sleep(0.5)
    shot(page, "56_patrol")
    close_dialogs(page); time.sleep(1.2)
    check(pos(page)["name"] == "Дом героя", "патруль отвёл домой после 23:00")
    # дождь
    rd = page.evaluate("(() => { for (let d = 2; d < 60; d++) if (G.life.weather(d) === 'rain') return d; })()")
    page.evaluate("G.state.flags.st_roofs = 1; G.STORY.forEach(e => { G.state.flags['st_' + e.id] = 1; }); G.state.vars.day = %d; G.state.vars.min = 15*60" % rd)
    W(page, "s.setMap({ map: 'konoha', x: 60*16+8, y: 40*16+8, dir: 'down' });"); time.sleep(1.0)
    shot(page, "57_rain")
    check(page.evaluate("G.life.raining()"), "дождливый день %d" % rd)
    # статус
    menu_pick(page, "Статус")
    check(top(page) == "status", "экран «Статус»")
    shot(page, "58_status")
    key(page, "KeyX"); time.sleep(0.2); key(page, "KeyX"); time.sleep(0.3)
    # 2 часа ночи — уснул где стоял
    page.evaluate("G.state.vars.min = 26*60 - 2; G.state.vars.energy = 60")
    time.sleep(4.0)
    check(top(page) == "daysum", "в 2:00 ночи уснул без сил → «Итоги дня»")
    shot(page, "59_daysum_faint")
    key(page, "KeyZ"); time.sleep(1.6); close_dialogs(page)
    e = page.evaluate("[G.state.vars.energy, G.game.clock()]")
    check(round(e[0]) == 50, "после ночи на ногах энергия утром 50 (%s)" % e)
    # экспорт / импорт кода
    code = page.evaluate("(() => { const s = G.scenes.stack.find(x => x.name === 'world'); s.savePos(); G.storage.save(G.state); return G.storage.exportCode(); })()")
    money = page.evaluate("G.state.vars.money")
    page.evaluate("G.state.vars.money = 1; G.storage.save(G.state)")
    ok = page.evaluate("(c) => G.storage.importCode(c)", code)
    page.evaluate("G.game.loadSaved()"); time.sleep(1.2)
    check(ok and page.evaluate("G.state.vars.money") == money and top(page) == "world", "импорт кода вернул сохранение (%s рё)" % money)
    check(not page.evaluate("G.storage.importCode('WOF1:мусор')"), "неверный код отклонён")
    key(page, "Escape"); time.sleep(0.3)
    key(page, "ArrowUp", 2)        # «Сохранение…» — предпоследний пункт
    key(page, "KeyZ"); time.sleep(0.4); key(page, "ArrowDown"); key(page, "KeyZ"); time.sleep(0.6)
    check(page.evaluate("G.scenes.top().name === 'savemenu' && G.scenes.top().boxOpen"), "окно экспорта кода открылось")
    shot(page, "60_export")
    page.dispatch_event("#cb-cancel", "pointerdown"); time.sleep(0.3)
    key(page, "KeyX"); time.sleep(0.2); key(page, "KeyX"); time.sleep(0.3)
    # пауза при возвращении в игру
    page.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); time.sleep(0.3)
    check(top(page) == "pause", "после сворачивания — пауза")
    shot(page, "61_pause")
    key(page, "KeyZ"); time.sleep(0.3)

    # ── меню ──────────────────────────────────────────────────
    key(page, "Escape"); time.sleep(0.4)
    shot(page, "12_menu")
    key(page, "KeyX"); time.sleep(0.3)

    # ── маленький экран (обычный Safari с панелями) ───────────
    page.set_viewport_size({"width": 393, "height": 660}); time.sleep(0.5)
    print("Экран (Safari с панелями):", page.evaluate("G.screen.W + 'x' + G.screen.H + ' x' + G.screen.scale"))
    shot(page, "13_safari_small")
    page.set_viewport_size({"width": 393, "height": 759}); time.sleep(0.3)

    # ── сохранение → перезагрузка → «Продолжить» ──────────────
    page.evaluate("G.scenes.stack.find(x => x.name === 'world').savePos(); G.storage.save(G.state)")
    saved = page.evaluate("G.state.pos")
    page.reload(); time.sleep(1.0)
    key(page, "Enter"); time.sleep(1.2)
    pp = pos(page) if top(page) == "world" else {}
    check(pp.get("m") == saved["map"], "«Продолжить» вернул на сохранённую карту (%s)" % pp.get("name"))
    shot(page, "14_continue")

    # производительность генерации
    print("Генерация Конохи:", page.evaluate("G.world.genMs"), "мс")
    b.close()

print("\nПроверок провалено:", len(fails))
for f in fails: print("  ✘", f)
print("Ошибок JS:", len(errors))
for e in errors: print("  ❌", e)
sys.exit(1 if errors or fails else 0)
