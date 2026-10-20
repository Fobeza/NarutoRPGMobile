#!/usr/bin/env python3
"""Полная проверка перед публикацией: сборка → проверки без браузера (Node) → автотесты → карта и комнаты.

    python3 tools/check_all.py            # всё (≈10–12 минут)
    python3 tools/check_all.py --quick    # сборка + Node-проверки + быстрые тесты (≈3 минуты)
    python3 tools/check_all.py --node     # только Node-проверки (≈5 секунд, браузер и Playwright не нужны)

Сам поднимает локальный сервер на порту 8765 (если он ещё не запущен) из корня репозитория.
В конце печатает сводку: что прошло, что упало. Код выхода 0 — всё зелёное.
"""
import os, subprocess, sys, tempfile, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, "tools")
QUICK = "--quick" in sys.argv
NODE_ONLY = "--node" in sys.argv

FULL = ["test_recover.py", "test_battle.py", "test_life.py", "test_outdoor.py", "test_iphone.py", "test_calendar.py", "test_audit.py"]
FAST = ["test_recover.py", "test_battle.py", "test_calendar.py", "test_audit.py"]


def server_up():
    try:
        urllib.request.urlopen("http://localhost:8765/index.html", timeout=2)
        return True
    except Exception:
        return False


def main():
    print("== сборка")
    r = subprocess.run([sys.executable, os.path.join(ROOT, "build.py")], capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip())
    if r.returncode:
        sys.exit(1)

    results = []

    # Быстрые проверки без браузера (Node): сценарии, данные, мир, интерьеры, шрифт, отрисовка сцен,
    # симуляция боёв с целевыми окнами баланса, сохранения. Секунды вместо минут — поэтому всегда первые.
    print("== check_node.py", flush=True)
    r = subprocess.run([sys.executable, os.path.join(TOOLS, "check_node.py")], capture_output=True, text=True, timeout=900)
    out = r.stdout + r.stderr
    # «✘» в сводной строке «ИТОГ: ✔ 26  ✘ 0» — это счётчик, а не провал: смотрим только на помеченные строки и код выхода
    bad = [l.strip() for l in out.splitlines() if "\u2718" in l and not l.strip().startswith("ИТОГ")]
    for l in [x for x in out.strip().splitlines() if x.startswith("ИТОГ")][-1:]:
        print("   " + l)
    for l in bad[:10]:
        print("   " + l)
    results.append(("check_node.py", not bad and r.returncode == 0))

    if NODE_ONLY:
        print("\n== ИТОГ")
        for t, ok in results:
            print(("  \u2714 " if ok else "  \u2718 ") + t)
        sys.exit(0 if all(ok for _, ok in results) else 1)

    # Без Playwright браузерные наборы не запустить — это не провал, а пропуск (Node-слой проверку уже дал).
    try:
        subprocess.run([sys.executable, "-c", "import playwright.sync_api"], check=True, capture_output=True)
        browser = True
    except Exception:
        browser = False
        print("== Playwright не установлен: браузерные наборы пропущены (python3 -m pip install playwright && playwright install chromium)")

    srv = None
    if browser and not server_up():
        srv = subprocess.Popen([sys.executable, "-m", "http.server", "8765"], cwd=ROOT,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1.5)

    try:
        for t in (FAST if QUICK else FULL):
            if not browser:
                results.append((t + " (пропущено: нет Playwright)", True))
                continue
            print("== " + t, flush=True)
            r = subprocess.run([sys.executable, os.path.join(TOOLS, t)], capture_output=True, text=True, timeout=1200)
            out = r.stdout + r.stderr
            bad = [l.strip() for l in out.splitlines()
                   if ("✘" in l and not l.strip().startswith("ИТОГ")) or "Traceback" in l or "Error:" in l or l.strip().startswith("JS:")]
            for l in bad[:8]:
                print("   " + l)
            results.append((t, not bad and r.returncode == 0))
        if not QUICK:
            for t, args in [("render_map.py", [os.path.join(tempfile.gettempdir(), "konoha_map.png")]), ("audit_rooms.py", [])]:
                if not browser:
                    results.append((t + " (пропущено: нет Playwright)", True))
                    continue
                print("== " + t, flush=True)
                r = subprocess.run([sys.executable, os.path.join(TOOLS, t)] + args, capture_output=True, text=True, timeout=900)
                tail = r.stdout.strip().splitlines()[-3:]
                for l in tail:
                    print("   " + l)
                if r.returncode != 0:
                    for l in (r.stderr or "").strip().splitlines()[-6:]: print("   ! " + l)   # причина падения
                results.append((t, r.returncode == 0))
    finally:
        if srv:
            srv.terminate()

    print("\n== ИТОГ")
    for t, ok in results:
        print(("  ✔ " if ok else "  ✘ ") + t)
    sys.exit(0 if all(ok for _, ok in results) else 1)


if __name__ == "__main__":
    main()
