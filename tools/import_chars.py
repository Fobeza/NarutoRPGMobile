#!/usr/bin/env python3
"""Импорт нарисованных персонажей: python3 tools/import_chars.py
art/chars/<id>.webp — лист 571×2000: 14 рядов × 4 столбца (ряд = 143 px). Ряды: 1–4 стойка (вниз, влево, вправо, вверх), 5–8 ходьба (те же направления, 4 кадра),
9–14 — бег, действия, падение (пока не используются). Из каждой клетки вырезается окно вокруг фиксированной «земли», масштабируется в кадр 16×20
(×2 = 32×40 px, как у персонажей, нарисованных кодом) и кладётся в лист 3 кадра × 4 направления:
кадр 0 — стойка, 1 и 2 — шаги (кадры ходьбы 0 и 2 — «ноги врозь»). Ещё для каждого — портрет 64×64 (голова и плечи).
Результат: src/gfx/char_art_data.js (палитра + строки повторов, как у зданий). Нужны Pillow и numpy."""
import os, json, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import import_art as ia

ROOT = ia.ROOT
CHARS = ['asuma', 'ayame', 'kiba', 'akamaru', 'anko', 'izumo', 'teuchi', 'cart', 'choji', 'choza', 'danzo', 'ebisu', 'fisher', 'sasuke', 'courier']
ROWH, COLW = 2000 / 14, 571 / 4
SC = 0.4                      # масштаб исходник → px кадра (ширина кадра 32, высота 40)
BASE = 132                    # «земля» внутри клетки (исходные px)
FW, FH = 32, 40
WIN_W, WIN_H, WIN_TOP = int(FW / SC), int(FH / SC), 95   # окно: 80 × 100, над землёй — 95


def cell(a, row, col):
    cx = int(COLW * col + COLW / 2)
    y_base = int(ROWH * row + BASE)
    x0, y0 = cx - WIN_W // 2, y_base - WIN_TOP
    pad = np.zeros((WIN_H, WIN_W, 4), np.uint8)
    h, w = a.shape[:2]
    sx0, sy0, sx1, sy1 = max(0, x0), max(0, y0), min(w, x0 + WIN_W), min(h, y0 + WIN_H)
    pad[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = a[sy0:sy1, sx0:sx1]
    return pad


def shrink(win):
    return ia.scale(win.astype(np.float32), FW, FH)


def build(id):
    a = np.array(Image.open(os.path.join(ROOT, 'art', 'chars', id + '.webp')).convert('RGBA'))
    a[a[:, :, 3] < 40] = 0                  # прозрачность без полупрозрачной каймы
    sheet = np.zeros((FH * 4, FW * 3, 4), np.uint8)
    for di in range(4):                      # 0 вниз, 1 влево, 2 вправо, 3 вверх
        frames = [cell(a, di, 0), cell(a, 4 + di, 0), cell(a, 4 + di, 2)]
        for f, win in enumerate(frames):
            sheet[di * FH:(di + 1) * FH, f * FW:(f + 1) * FW] = shrink(win)
    # портрет: верх фигуры «вниз» в исходном размере
    idle = cell(a, 0, 0)
    ys = np.where(idle[:, :, 3] > 0)[0]
    top = max(0, ys.min() - 2)
    n = 32 if id == 'akamaru' else 64          # щенок мелкий: окно вдвое меньше, потом увеличиваем
    if n == 32: top = max(0, ys.max() - 34)
    crop = np.zeros((n, n, 4), np.uint8)
    part = idle[top:top + n, WIN_W // 2 - n // 2:WIN_W // 2 + n // 2]
    crop[:part.shape[0]] = part
    por = crop if n == 64 else np.array(Image.fromarray(crop).resize((64, 64), Image.NEAREST))
    return sheet, por


def main():
    out = {}
    for id in CHARS:
        sheet, por = build(id)
        pal, rle = ia.encode(sheet)
        ppal, prle = ia.encode(por)
        out[id] = {'w': FW * 3, 'h': FH * 4, 'pal': pal, 'rle': rle, 'por': {'w': 64, 'h': 64, 'pal': ppal, 'rle': prle}}
    js = ['// Нарисованные персонажи — СГЕНЕРИРОВАНО tools/import_chars.py из art/chars/, руками не править.',
          '// Лист 3 кадра × 4 направления (кадр 32×40 px, как у персонажей кодом) и портрет 64×64: палитра + строки повторов.',
          'G.CHAR_ART = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';', '']
    p = os.path.join(ROOT, 'src', 'gfx', 'char_art_data.js')
    open(p, 'w', encoding='utf-8').write('\n'.join(js))
    print('персонажей: %d, файл %d КБ' % (len(out), os.path.getsize(p) // 1024))


if __name__ == '__main__':
    main()
