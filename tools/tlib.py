"""Общие помощники автотестов (Playwright, эмуляция iPhone 15 Pro)."""
import os, time
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")
os.makedirs(OUT, exist_ok=True)
errors, fails, oks = [], [], []

def shot(page, name):
    page.screenshot(path=os.path.join(OUT, name + ".png"))

def check(cond, msg):
    print(("  ✔ " if cond else "  ✘ ") + msg, flush=True)
    (oks if cond else fails).append(msg)

def key(page, k, n=1, wait=0.12):
    for _ in range(n):
        page.keyboard.press(k); time.sleep(wait)

def top(page):
    return page.evaluate("G.scenes.top() && G.scenes.top().name")

def W(page, js):
    return page.evaluate("(() => { const s = G.scenes.stack.find(x => x.name === 'world'); " + js + " })()")

def B(page, js):
    return page.evaluate("(() => { const s = G.scenes.stack.find(x => x.name === 'battle'); " + js + " })()")

def close_dialogs(page, limit=60):
    for _ in range(limit):
        if top(page) == "world" and not page.evaluate("G.scenes.busy"): return True
        if top(page) in ("battle", "train", "lesson", "exam", "ending", "board", "friend"): return False
        page.keyboard.press("KeyZ"); time.sleep(0.2)
    return False

def wait_top(page, name, t=6.0):
    t0 = time.time()
    while time.time() - t0 < t:
        if top(page) == name and not page.evaluate("G.scenes.busy"): return True
        time.sleep(0.1)
    return False

def open_page(p, url):
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 393, "height": 759}, device_scale_factor=2, is_mobile=True, has_touch=True,
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.goto(url + ("&" if "?" in url else "?") + "t=%d" % time.time())
    page.evaluate("localStorage.clear()"); page.reload(); time.sleep(0.8)
    return b, page

def seed(page, extra_js=""):
    """Новая игра: герой готов, день 1 пройден, утро дня 2 дома."""
    page.evaluate("""(() => {
      const st = G.game.newState(); st.started = true; st.hero.name = 'Кайто';
      st.hero.stats = { tai: 6, nin: 5, gen: 4, chakra: 5, ctrl: 5, spd: 6, end: 5, know: 4 }; st.hero.skills = ['eagle_eye', 'diligent'];
      Object.assign(st.flags, { enrolled: 1, naruto_invited: 1, ramen_done: 1, treated_naruto: 1, day2_intro: 1, met_naruto: 1, met_iruka: 1, met_sakura: 1, met_sasuke: 1, met_hinata: 1, tip_clock: 1, st_roofs: 1, tip_rain: 1, tip_evening: 1, tip_food: 1, tip_night: 1 });
      st.quests.day1 = { st: 'done', step: 99, day: 1 };
      st.vars.day = 2; st.vars.min = 7 * 60;
      st.inv = { kunai: 6, shuriken: 8, bandage: 2, smoke_bomb: 1, wire: 1 };
      st.pos = { map: G.world.heroHome().interior.id, x: 5 * 16 + 8, y: 5 * 16 + 4, dir: 'down' };
      """ + extra_js + """
      G.storage.save(st);
    })()""")
    page.evaluate("G.game.loadSaved()"); time.sleep(1.2)

def report():
    print("Проверок: %d, провалено: %d, ошибок JS: %d" % (len(oks) + len(fails), len(fails), len(errors)))
    for e in errors[:10]: print("  JS:", e)
    for f in fails: print("  FAIL:", f)
    if fails or errors:
        import sys
        sys.exit(1)   # ошибки JS тоже валят набор (раньше они только печатались)
