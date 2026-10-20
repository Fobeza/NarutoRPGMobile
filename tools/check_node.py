#!/usr/bin/env python3
"""Быстрые проверки игры без браузера: python3 tools/check_node.py

Запускает tools/node/checks.js — он исполняет собранный index.html в Node (заглушки DOM/Canvas/localStorage)
и проверяет сценарии, данные, генерацию деревни, интерьеры, шрифт, отрисовку сцен, симуляцию боёв и сохранения.
Занимает секунды вместо ~12 минут полного прогона Playwright, поэтому годится и для --quick, и для CI.

Нужен Node.js 18+ (только для этой проверки; сама игра по-прежнему без зависимостей).
Если Node не установлен — проверка пропускается (код возврата 0) с предупреждением.

Переменные окружения:
    N=200       боёв на ячейку баланса (по умолчанию 120; меньше не бывает — иначе окна «мигают»)
    SEEDS=7,13  сиды генерации деревни (по умолчанию 7,13,42)
"""
import os, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHECKS = os.path.join(ROOT, "tools", "node", "checks.js")


def main():
    node = shutil.which("node") or shutil.which("nodejs")
    if not node:
        print("  · Node.js не найден — проверки без браузера пропущены (нужны только для tools/check_node.py)")
        return 0
    index = os.path.join(ROOT, "index.html")
    if not os.path.exists(index):
        print("  ✘ нет index.html — сначала python3 build.py")
        return 1
    env = dict(os.environ)
    r = subprocess.run([node, CHECKS], cwd=ROOT, env=env, capture_output=True, text=True, timeout=900)
    out = (r.stdout or "") + (r.stderr or "")
    print(out.rstrip())
    # строка «ИТОГ: ✔ 26  ✘ 0» содержит «✘» как счётчик — в список провалов её брать нельзя
    bad = [l.strip() for l in out.splitlines() if "✘" in l and not l.strip().startswith("ИТОГ")]
    if r.returncode and not bad:
        print("  ✘ проверки завершились с кодом %d" % r.returncode)
        return 1
    regressions = subprocess.run([node, os.path.join(ROOT, "tools", "node", "regressions.js")], cwd=ROOT, env=env, capture_output=True, text=True, timeout=120)
    print((regressions.stdout or "") + (regressions.stderr or ""))
    village = subprocess.run([node, os.path.join(ROOT, "tools", "node", "village.js")], cwd=ROOT, env=env, capture_output=True, text=True, timeout=120)
    print((village.stdout or "") + (village.stderr or ""))
    adventures = subprocess.run([node, os.path.join(ROOT, "tools", "node", "adventures.js")], cwd=ROOT, env=env, capture_output=True, text=True, timeout=120)
    print((adventures.stdout or "") + (adventures.stderr or ""))
    daily = subprocess.run([node, os.path.join(ROOT, "tools", "node", "daily.js")], cwd=ROOT, env=env, capture_output=True, text=True, timeout=120)
    print((daily.stdout or "") + (daily.stderr or ""))
    motion = subprocess.run([node, os.path.join(ROOT, "tools", "node", "motion.js")], cwd=ROOT, env=env, capture_output=True, text=True, timeout=120)
    print((motion.stdout or "") + (motion.stderr or ""))
    entries = subprocess.run([node, os.path.join(ROOT, "tools", "node", "entries.js")], cwd=ROOT, env=env, capture_output=True, text=True, timeout=120)
    print((entries.stdout or "") + (entries.stderr or ""))
    cartography = subprocess.run([node, os.path.join(ROOT, "tools", "node", "cartography.js")], cwd=ROOT, env=env, capture_output=True, text=True, timeout=120)
    print((cartography.stdout or "") + (cartography.stderr or ""))
    return 1 if (bad or r.returncode or regressions.returncode or village.returncode or adventures.returncode or daily.returncode or motion.returncode or entries.returncode or cartography.returncode) else 0


if __name__ == "__main__":
    sys.exit(main())
