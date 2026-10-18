#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Таблица баланса: доля побед по сборкам и дням → docs/BALANCE.md и docs/balance.csv.

Раньше скрипт гонял симулятор в headless Chromium (Playwright, ~2 минуты). Симулятор src/systems/sim.js
не трогает DOM, поэтому теперь он исполняется прямо в Node через tools/node/harness.js — те же данные,
~9 секунд и без браузера. Вся генерация живёт в tools/node/balance.js.

    python3 tools/balance.py            # 40 боёв на ячейку
    python3 tools/balance.py 120        # 120 боёв на ячейку (столько же берёт tools/node/checks.js)
    SEED=7 python3 tools/balance.py 120 # другое зерно генератора случайных чисел

Целевые окна побед — tools/targets.json (общие с проверкой tools/node/checks.js).
"""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = os.path.join(ROOT, 'tools', 'node', 'balance.js')


def main():
    node = shutil.which('node') or shutil.which('nodejs')
    if not node:
        print('Нужен Node.js 18+ (или python3 tools/check_all.py — он пропустит этот шаг).')
        return 2
    n = sys.argv[1] if len(sys.argv) > 1 else '40'
    r = subprocess.run([node, JS, str(n)], cwd=ROOT)
    return r.returncode


if __name__ == '__main__':
    sys.exit(main())
