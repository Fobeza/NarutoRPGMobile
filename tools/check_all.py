#!/usr/bin/env python3
"""Полная проверка перед публикацией: сборка → все автотесты → проверка карты и комнат.

    python3 tools/check_all.py            # всё (≈10–12 минут)
    python3 tools/check_all.py --quick    # сборка + быстрые тесты (≈3 минуты)

Сам поднимает локальный сервер на порту 8765 (если он ещё не запущен) из корня репозитория.
В конце печатает сводку: что прошло, что упало. Код выхода 0 — всё зелёное.
"""
import os, subprocess, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, "tools")
QUICK = "--quick" in sys.argv

FULL = ["test_recover.py", "test_battle.py", "test_life.py", "test_outdoor.py", "test_iphone.py", "test_calendar.py"]
FAST = ["test_recover.py", "test_battle.py", "test_calendar.py"]


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

    srv = None
    if not server_up():
        srv = subprocess.Popen([sys.executable, "-m", "http.server", "8765"], cwd=ROOT,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1.5)

    results = []
    try:
        for t in (FAST if QUICK else FULL):
            print("== " + t, flush=True)
            r = subprocess.run([sys.executable, os.path.join(TOOLS, t)], capture_output=True, text=True, timeout=1200)
            out = r.stdout + r.stderr
            bad = [l.strip() for l in out.splitlines() if "✘" in l or "Traceback" in l or "Error:" in l]
            for l in bad[:8]:
                print("   " + l)
            results.append((t, not bad and r.returncode == 0))
        if not QUICK:
            for t, args in [("render_map.py", ["/tmp/konoha_map.png"]), ("audit_rooms.py", [])]:
                print("== " + t, flush=True)
                r = subprocess.run([sys.executable, os.path.join(TOOLS, t)] + args, capture_output=True, text=True, timeout=900)
                tail = r.stdout.strip().splitlines()[-3:]
                for l in tail:
                    print("   " + l)
                ok = r.returncode == 0 and "unreachableDoors': [" + "]" in r.stdout if t == "render_map.py" else r.returncode == 0
                results.append((t, ok))
    finally:
        if srv:
            srv.terminate()

    print("\n== ИТОГ")
    for t, ok in results:
        print(("  ✔ " if ok else "  ✘ ") + t)
    sys.exit(0 if all(ok for _, ok in results) else 1)


if __name__ == "__main__":
    main()
