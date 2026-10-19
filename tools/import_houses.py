#!/usr/bin/env python3
"""Импорт нарисованных домов: python3 tools/import_houses.py
art/houses/*.webp|png (картинка на прозрачном фоне) + tools/houses.json → src/gfx/house_art_data.js.
Для каждого дома: чистим края от белой каймы, обрезаем по контуру, масштабируем под ширину шаблона здания
(в «подробных» пикселях ×2), сводим к палитре из ≤63 цветов и кодируем строками-повторами; игра раскодирует их сразу при загрузке
(gfx/house_art.js), без ожидания картинок. Шаблоны подбираются по пропорциям или задаются в houses.json («tpls»).
Нужен Pillow и numpy. Запускать при добавлении/замене картинок; результат коммитится."""
import os, re, json, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = 16                       # тайл
HI = 2                       # подробность холста
EX = 3                       # на сколько карниз выступает за стену с каждой стороны, px
SYM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&*+-/:;<=>?@^_'   # 64 знака без цифр и точки
# шаблоны, для которых годятся нарисованные дома (не «уникальные» и не квартал Учиха — у него свой облик)
ALLOWED = ['house_xs', 'house_n', 'house_s', 'house_m', 'house_t', 'house_w', 'apartment_s', 'tower_r',
           'shop_s', 'shop_generic', 'office', 'dojo']
MAX_RATIO = 1.25             # насколько пропорции картинки могут отличаться от пропорций шаблона


def templates():
    src = open(os.path.join(ROOT, 'src', 'data', 'buildings.js'), encoding='utf-8').read()
    out = {}
    for m in re.finditer(r"^\s{2}(\w+):\s*\{([^\n]*)\}", src, re.M):
        body = m.group(2)
        w = re.search(r"\bw: (\d+)", body); h = re.search(r"\bh: (\d+)", body)
        d = re.search(r"door: \[(\d+), (\d+)\]", body); ov = re.search(r"\bov: (\d+)", body)
        if w and h and d:
            out[m.group(1)] = dict(w=int(w.group(1)), h=int(h.group(1)), door=int(d.group(1)), ov=int(ov.group(1)) if ov else 16,
                                   unique='unique: true' in body)
    return out


def clean(path):
    """RGBA → резкий контур без белой каймы, обрезка по границе."""
    a = np.array(Image.open(path).convert('RGBA')).astype(np.float32)
    al = a[:, :, 3]
    op = al >= 128
    # каёмка: почти белые пиксели рядом с пустотой — остаток фона
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
    """RGBA → (палитра, строка повторов). Индекс 0 палитры не нужен: прозрачность — точка."""
    h, w = img.shape[:2]
    rgb = Image.fromarray(img[:, :, :3]).quantize(colors=len(SYM) - 1, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = rgb.getpalette()[:3 * (len(SYM) - 1)]
    idx = np.array(rgb)
    used = sorted(set(idx[img[:, :, 3] > 0].tolist()))
    remap = {old: new for new, old in enumerate(used)}
    flat = []
    for p, (i, al) in enumerate(zip(idx.ravel().tolist(), img[:, :, 3].ravel().tolist())):
        flat.append('.' if al == 0 else SYM[remap[i]])
    out, i = [], 0
    while i < len(flat):
        j = i
        while j < len(flat) and flat[j] == flat[i]: j += 1
        out.append(flat[i] + (str(j - i) if j - i > 1 else ''))
        i = j
    colors = ['#%02x%02x%02x' % tuple(pal[3 * u:3 * u + 3]) for u in used]
    return colors, ''.join(out)


def main():
    cfg = json.load(open(os.path.join(ROOT, 'tools', 'houses.json'), encoding='utf-8'))
    tpls = templates()
    bitmaps, bkey, variants = [], {}, {}
    for item in cfg['houses']:
        path = os.path.join(ROOT, 'art', 'houses', item['file'])
        if not os.path.exists(path): print('нет файла', path); continue
        a = clean(path)
        ch, cw = a.shape[:2]
        aspect = cw / ch
        names = item.get('tpls')
        if not names:
            names = []
            for tid in ALLOWED:
                t = tpls[tid]
                asp = t['w'] * T / (t['h'] * T + t['ov'])
                if max(aspect / asp, asp / aspect) <= MAX_RATIO: names.append(tid)
        print('%s: пропорции %.2f → %s' % (item['file'], aspect, ', '.join(names) or '— (не подошло ни одному шаблону)'))
        for tid in names:
            t = tpls[tid]
            lw = t['w'] * T + 2 * EX                       # ширина в логических px (с карнизами)
            lh = max(8, round(lw * ch / cw))
            # одинаковые по ширине шаблоны делят одну картинку: хранится один раз
            if (item['file'], lw) not in bkey:
                colors, rle = encode(scale(a, lw * HI, lh * HI))
                bkey[(item['file'], lw)] = len(bitmaps)
                bitmaps.append(dict(src=os.path.splitext(item['file'])[0], lw=lw, lh=lh, pal=colors, rle=rle))
            # дверь картинки ставим над дверной клеткой шаблона (сдвиг не больше 10 px от центра)
            target = t['door'] * T + T / 2
            best = min(item.get('door', [0.5]), key=lambda f: abs(target - (-EX + f * lw)))
            ox = round(target - best * lw)
            ox = max(-EX - 10, min(-EX + 10, ox))
            wall = max(14, round((1 - item.get('roof', 0.5)) * lh))
            variants.setdefault(tid, []).append(dict(b=bkey[(item['file'], lw)], ox=ox, wall=wall))
    js = ['// Нарисованные дома — СГЕНЕРИРОВАНО tools/import_houses.py из art/houses/, руками не править.',
          '// Раскодирует gfx/house_art.js. Для каждого шаблона здания — свой набор картинок (по seed здания).',
          'G.HOUSE_ART = ' + json.dumps({'bitmaps': bitmaps, 'tpl': variants}, ensure_ascii=False, separators=(',', ':')) + ';', '']
    path = os.path.join(ROOT, 'src', 'gfx', 'house_art_data.js')
    open(path, 'w', encoding='utf-8').write('\n'.join(js))
    print('картинок: %d, привязок к шаблонам: %d (шаблонов %d), файл %d КБ' % (len(bitmaps), sum(len(v) for v in variants.values()), len(variants), os.path.getsize(path) // 1024))


if __name__ == '__main__':
    main()
