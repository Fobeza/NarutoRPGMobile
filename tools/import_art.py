#!/usr/bin/env python3
"""Импорт нарисованных зданий: python3 tools/import_art.py
art/**.webp|png (прозрачный фон) + tools/art_catalog.json → src/gfx/house_art_data.js и tools/art_specs.json.
Для каждой картинки: чистим белую кайму, обрезаем по контуру, масштабируем под ширину пятна в тайлах (×2 — «подробный» холст),
сводим к 63 цветам и кодируем строками повторов. Игра раскодирует их сразу при загрузке (gfx/house_art.js).
Пятно (клетки, где нельзя ходить) считается по высоте картинки: всё, кроме верхних ~20 px карниза; дверь — по доле ширины.
tools/art_specs.json — те же размеры без пикселей: по ним планировщик (tools/plan_konoha.py) расставляет здания.
Нужны Pillow и numpy. Запускать при добавлении или замене картинок; результат коммитится."""
import os, json, sys, re
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


def components(m):
    """Связные области маски (4-связность): списки точек (y, x)."""
    h, w = m.shape; seen = np.zeros_like(m); res = []
    for y0, x0 in zip(*np.nonzero(m)):
        if seen[y0, x0]: continue
        q, pts = [(y0, x0)], []; seen[y0, x0] = True
        while q:
            y, x = q.pop(); pts.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not seen[ny, nx]: seen[ny, nx] = True; q.append((ny, nx))
        res.append(pts)
    return res


def windows(img, roof, reference=None):
    """Окна для ночного свечения: синеватое «стекло» ниже крыши, небольшие компактные пятна → прямоугольники [x, y, w, h] в px ×2.
    Для сложных фасадов используются проверенные области из tools/art_windows.json.
    Если стекло не найдено, свечение не выдумывается у двери или на крыше."""
    h, w = img.shape[:2]
    if reference is not None:
        rw, rh = reference['size']
        return [[round(x * w / rw), round(y * h / rh), max(1, round(ww * w / rw)), max(1, round(hh * h / rh)), *shape]
                for x, y, ww, hh, *shape in reference['rects']]
    r, g, b, a = [img[:, :, i].astype(np.float32) for i in range(4)]
    glass = (b > r + 22) & (b >= g - 8) & (b > 55) & (a > 0)
    glass[:int(max(0, roof * h)), :] = False
    # Синие концы карнизов не должны приниматься за стекло.
    margin = max(2, round(w * .09))
    glass[:, :margin] = False; glass[:, w - margin:] = False
    out = []
    for pts in components(glass):
        ys = [p[0] for p in pts]; xs = [p[1] for p in pts]
        hh, ww = max(ys) - min(ys) + 1, max(xs) - min(xs) + 1
        opaque = (a[min(ys):max(ys)+1, min(xs):max(xs)+1] > 0).mean()
        if 14 <= len(pts) <= h * w * 0.02 and len(pts) / (hh * ww) > 0.5 and 0.55 < ww / hh < 1.9 and hh <= w * 0.2 and ww <= w * 0.2 and min(hh, ww) >= 4 and opaque >= .98:
            sh = 0 if len(pts) / (hh * ww) > 0.85 else max(1, round(min(hh, ww) * 0.12))
            out.append([int(min(xs)) + sh, int(min(ys)) + sh, int(ww - 2 * sh), int(hh - 2 * sh)])
    return out[:40]


def window_references():
    with open(os.path.join(ROOT, 'tools', 'art_windows.json'), encoding='utf-8') as f:
        return json.load(f)


def js_string(data):
    """Данные графики лежат в сборке СТРОКОЙ и разбираются при первом обращении (gfx/art.js)."""
    return json.dumps(json.dumps(data, ensure_ascii=False, separators=(',', ':')), ensure_ascii=False)


def update_windows():
    """Обновить только маски в уже импортированных данных, сохранив пиксели, геометрию и коллизии."""
    path = os.path.join(ROOT, 'src', 'gfx', 'house_art_data.js')
    with open(path, encoding='utf-8') as f:
        source = f.read()
    prefix, encoded = source.split("house: ", 1)
    data = json.loads(json.JSONDecoder().raw_decode(encoded.lstrip())[0])
    with open(os.path.join(ROOT, 'tools', 'art_catalog.json'), encoding='utf-8') as f:
        catalog = {e['name']: e for e in json.load(f)['art']}
    refs = window_references()
    for name, a in data['art'].items():
        bm = data['bitmaps'][a['b']]
        pal = [tuple(bytes.fromhex(c[1:])) + (255,) for c in bm['pal']]
        pixels = []
        for ch, count in re.findall(r'([^0-9])([0-9]*)', bm['rle']):
            pixels.extend([(0, 0, 0, 0) if ch == '.' else pal[SYM.index(ch)]] * int(count or 1))
        img = np.array(pixels, dtype=np.uint8).reshape(bm['lh'] * HI, bm['lw'] * HI, 4)
        a['g'] = windows(img, catalog[name].get('roof', .5), refs.get(name.removesuffix('_big')))
    with open(path, 'w', encoding='utf-8') as f:
        f.write(prefix + 'house: ' + js_string(data) + ',\n});\n')
    print('масок окон обновлено:', len(data['art']))


def free_cells(img, w, h, lw, lh, ox, dx):
    """Клетки пятна, где на картинке пусто (скруглённые углы круглых домов): ходить можно, невидимых стен нет.
    Клетка свободна, если закрашено меньше 45 % клетки и меньше 60 % там, где стоят ноги героя (x 3–13, y 7–12): картинка сдвинута от пятна до 11 px — остаются невидимые полосы. Дверь — не трогаем."""
    a = img[:, :, 3] > 0
    oy = h * T - lh
    out = []
    for cy in range(h):
        for cx in range(w):
            if cy == h - 1 and cx == dx: continue
            x0, y0 = (cx * T - ox) * HI, (cy * T - oy) * HI
            def cut(xa, ya, xb, yb):
                xa, xb = max(0, xa), min(a.shape[1], xb); ya, yb = max(0, ya), min(a.shape[0], yb)
                return a[ya:yb, xa:xb] if xb > xa and yb > ya else np.zeros((0, 0), bool)
            cell = cut(x0, y0, x0 + T * HI, y0 + T * HI)
            feet = cut(x0 + 3 * HI, y0 + 7 * HI, x0 + 13 * HI, y0 + 12 * HI)
            if (cell.mean() if cell.size else 0) < 0.45 and (feet.mean() if feet.size else 0) < 0.6: out.append([cx, cy])
    return out


def width_tiles(e, aspect):
    """Ширина пятна в тайлах: задана в каталоге или по пропорциям (плоские и длинные — шире)."""
    if e.get('w'): return int(e['w'])
    return max(3, min(9, round(4.0 * aspect ** 0.5 + 0.4)))


def specs(with_pixels=False):
    cat = json.load(open(os.path.join(ROOT, 'tools', 'art_catalog.json'), encoding='utf-8'))['art']
    refs = window_references()
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
            s['fr'] = free_cells(scale(a, lw * HI, lh * HI), w, th, lw, lh, ox, dx)
            s['g'] = windows(scale(a, lw * HI, lh * HI), e.get('roof', 0.5), refs.get(e['name'].removesuffix('_big')))
        out.append(s)
    return out


def main():
    ss = specs(True)
    bitmaps, art = [], {}
    for s in ss:
        art[s['name']] = {k: s[k] for k in ('kind', 'tpl', 'clan', 'w', 'h', 'dx', 'ox', 'wall', 'lw', 'lh') if k in s}
        art[s['name']]['b'] = len(bitmaps); art[s['name']]['g'] = s['g']
        if s['fr']: art[s['name']]['fr'] = s['fr']
        bitmaps.append(dict(src=s['name'], lw=s['lw'], lh=s['lh'], pal=s['pal'], rle=s['rle']))
    js = ['// Нарисованные здания — СГЕНЕРИРОВАНО tools/import_art.py из art/ и tools/art_catalog.json, руками не править.',
          '// Раскодирует gfx/house_art.js: bitmaps — картинки палитрой и строками повторов, art — размеры пятна, дверь, стена.',
          'G.ART_STR = Object.assign(G.ART_STR || {}, {',
          'house: ' + js_string({'bitmaps': bitmaps, 'art': art}) + ',',
          '});', '']
    path = os.path.join(ROOT, 'src', 'gfx', 'house_art_data.js')
    open(path, 'w', encoding='utf-8').write('\n'.join(js))
    meta = [{k: v for k, v in s.items() if k not in ('pal', 'rle', 'g', 'fr')} for s in ss]
    json.dump(meta, open(os.path.join(ROOT, 'tools', 'art_specs.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    kinds = {}
    for s in ss: kinds[s['kind']] = kinds.get(s['kind'], 0) + 1
    print('картинок: %d %s, файл %d КБ' % (len(bitmaps), kinds, os.path.getsize(path) // 1024))


if __name__ == '__main__':
    if '--windows-only' in sys.argv: update_windows()
    else: main()
