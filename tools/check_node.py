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
SUITES = ["regressions.js", "village.js", "adventures.js", "daily.js", "motion.js", "entries.js", "cartography.js", "release2.js", "street.js"]


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
    # Отдельные Node-наборы: запускаются все подряд, даже если какой-то упал; порядок вывода — как в списке
    failed = False
    for name in SUITES:
        sub = subprocess.run([node, os.path.join(ROOT, "tools", "node", name)], cwd=ROOT, env=env, capture_output=True, text=True, timeout=120)
        print((sub.stdout or "") + (sub.stderr or ""))
        failed = failed or sub.returncode != 0
    return 1 if (bad or r.returncode or failed) else 0


if __name__ == "__main__":
    sys.exit(main())
