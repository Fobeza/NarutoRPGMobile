#!/usr/bin/env python3
"""Импорт нарисованных зданий: python3 tools/import_art.py
art/**.webp|png (прозрачный фон) + tools/art_catalog.json → src/gfx/house_art_data.js и tools/art_specs.json.
Для каждой картинки: чистим белую кайму, обрезаем по контуру, масштабируем под ширину пятна в тайлах (×2 — «подробный» холст),
сводим к 63 цветам и кодируем строками повторов. Игра раскодирует их сразу при загрузке (gfx/house_art.js).
Пятно (клетки, где нельзя ходить) считается по высоте картинки: всё, кроме верхних ~20 px карниза; дверь — по доле ширины.
tools/art_specs.json — те же размеры без пикселей: по ним планировщик (tools/plan_konoha.py) расставляет здания.
Нужны Pillow и numpy. Запускать при добавлении или замене картинок; результат коммитится."""
import os, json, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = 16                       # тайл
HI = 2                       # подробность холста
EX = 3                       # на сколько карниз выступает за стену с каждой стороны, px
OVERHANG = 20                # сколько верхних пикселей картинки не входит в пятно
COLORS = 32                 # цветов в палитре одной картинки (меньше — легче файл, больше — плавнее переходы)
SYM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&*+-/:;<=>?@^_'   # 64 знака без цифр и точки


def clean(path):
    """RGBA → резкий контур без белой каймы, обрезка по границе."""
    a = np.array(Image.open(path).convert('RGBA')).astype(np.float32)
    al = a[:, :, 3]
    op = al >= 128
    for _ in range(2):
        empty = ~op
        near = np.zeros_like(op)
        near[1:] |= empty[:-1]; near[:-1] |= empty[1:]; near[:, 1:] |= empty[:, :-1]; near[:, :-1] |= empty[:, 1:]
        lum = a[:, :, :3].mean(axis=2); sat = a[:, :, :3].max(axis=2) - a[:, :, :3].min(axis=2)
        op &= ~(near & (lum > 225) & (sat < 28))
    ys, xs = np.where(op)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    a[:, :, 3] = np.where(op, 255, 0)
    return a[y0:y1, x0:x1]


def scale(a, w, h):
    """Уменьшение с учётом прозрачности (премультиплицированный альфа-канал), потом резкий контур."""
    pm = a.copy(); pm[:, :, :3] *= pm[:, :, 3:4] / 255.0
    chans = [Image.fromarray(pm[:, :, i]).resize((w, h), Image.LANCZOS) for i in range(4)]
    r = np.stack([np.array(c) for c in chans], axis=2).astype(np.float32)
    al = r[:, :, 3]
    rgb = np.where(al[:, :, None] > 1, r[:, :, :3] / np.maximum(al[:, :, None], 1) * 255.0, 0)
    out = np.concatenate([np.clip(rgb, 0, 255), np.where(al >= 128, 255, 0)[:, :, None]], axis=2)
    return out.astype(np.uint8)


def encode(img):
    """RGBA → (палитра, строка повторов): знак — цвет, число — сколько подряд, точка — прозрачность."""
    rgb = Image.fromarray(img[:, :, :3]).quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = rgb.getpalette()[:3 * COLORS]
    idx = np.array(rgb)
    used = sorted(set(idx[img[:, :, 3] > 0].tolist()))
    remap = {old: new for new, old in enumerate(used)}
    flat = ['.' if al == 0 else SYM[remap[i]] for i, al in zip(idx.ravel().tolist(), img[:, :, 3].ravel().tolist())]
    out, i = [], 0
    while i < len(flat):
        j = i
        while j < len(flat) and flat[j] == flat[i]: j += 1
        out.append(flat[i] + (str(j - i) if j - i > 1 else ''))
        i = j
    return ['#%02x%02x%02x' % tuple(pal[3 * u:3 * u + 3]) for u in used], ''.join(out)


def width_tiles(e, aspect):
    """Ширина пятна в тайлах: задана в каталоге или по пропорциям (плоские и длинные — шире)."""
    if e.get('w'): return int(e['w'])
    return max(3, min(9, round(4.0 * aspect ** 0.5 + 0.4)))


def specs(with_pixels=False):
    cat = json.load(open(os.path.join(ROOT, 'tools', 'art_catalog.json'), encoding='utf-8'))['art']
    out = []
    for e in cat:
        path = os.path.join(ROOT, 'art', e['file'])
        if not os.path.exists(path): print('нет файла', path); continue
        a = clean(path)
        ch, cw = a.shape[:2]
        w = width_tiles(e, cw / ch)
        lw = w * T + 2 * EX
        lh = max(8, round(lw * ch / cw))
        th = max(2, round((lh - OVERHANG) / T))
        door = e.get('door', 0.5)
        dx = max(0, min(w - 1, round((door * lw - EX - T / 2) / T)))
        ox = dx * T + T // 2 - round(door * lw)
        ox = max(-EX - 8, min(-EX + 8, ox))
        s = dict(e, w=w, h=th, lw=lw, lh=lh, dx=dx, ox=ox, wall=max(14, round((1 - e.get('roof', 0.5)) * lh)))
        if with_pixels:
            colors, rle = encode(scale(a, lw * HI, lh * HI))
            s['pal'], s['rle'] = colors, rle
        out.append(s)
    return out


def main():
    ss = specs(True)
    bitmaps, art = [], {}
    for s in ss:
        art[s['name']] = {k: s[k] for k in ('kind', 'tpl', 'clan', 'w', 'h', 'dx', 'ox', 'wall', 'lw', 'lh') if k in s}
        art[s['name']]['b'] = len(bitmaps)
        bitmaps.append(dict(src=s['name'], lw=s['lw'], lh=s['lh'], pal=s['pal'], rle=s['rle']))
    js = ['// Нарисованные здания — СГЕНЕРИРОВАНО tools/import_art.py из art/ и tools/art_catalog.json, руками не править.',
          '// Раскодирует gfx/house_art.js: bitmaps — картинки палитрой и строками повторов, art — размеры пятна, дверь, стена.',
          'G.HOUSE_ART = ' + json.dumps({'bitmaps': bitmaps, 'art': art}, ensure_ascii=False, separators=(',', ':')) + ';', '']
    path = os.path.join(ROOT, 'src', 'gfx', 'house_art_data.js')
    open(path, 'w', encoding='utf-8').write('\n'.join(js))
    meta = [{k: v for k, v in s.items() if k not in ('pal', 'rle')} for s in ss]
    json.dump(meta, open(os.path.join(ROOT, 'tools', 'art_specs.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    kinds = {}
    for s in ss: kinds[s['kind']] = kinds.get(s['kind'], 0) + 1
    print('картинок: %d %s, файл %d КБ' % (len(bitmaps), kinds, os.path.getsize(path) // 1024))


if __name__ == '__main__':
    main()
