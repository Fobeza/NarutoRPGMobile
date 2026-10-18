#!/usr/bin/env python3
"""V8: импорт ассетов в игру.

Цепочка: декод PNG → кроп до пропорций цели → усреднение блоками до логического
размера → квантование цветов в G.PAL → (chroma-key для иконок) → PNG → base64
внутри src/gfx/assets.js. Всё на чистом Python 3 (zlib, struct): сторонних
библиотек в проекте нет и не будет.

Запуск:  python3 tools/assets/import.py [id ...]     без аргументов — весь манифест
Отчёт:   по каждому ассету — исходник, цель, цветов, макс. увод в палитру,
         прозрачность, вес PNG и base64. Манифест дополняется статусом и весом.
Выход:   0 — всё импортировано; 1 — жёсткое нарушение (нет файла, не та
         прозрачность, цветов больше палитры).

Правила приёмки (V8.md, раздел 8): фон без альфы, иконка с альфой; размер после
масштабирования равен целевому; палитра не шире G.PAL.
"""
import base64
import hashlib
import json
import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.join(ROOT, "tools", "assets")
MAN = os.path.join(HERE, "manifest.json")
PALF = os.path.join(HERE, "palette.json")
OUTJS = os.path.join(ROOT, "src", "gfx", "assets.js")

# ---------- декод PNG (8 бит, без чересстрочности) ----------


def decode_png(path):
    data = open(path, "rb").read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"{path}: не PNG")
    pos, idat, plte, trns = 8, b"", None, None
    w = h = ct = inter = 0
    while pos < len(data):
        (ln,) = struct.unpack(">I", data[pos:pos + 4])
        tag = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + ln]
        pos += 12 + ln
        if tag == b"IHDR":
            w, h, bd, ct, _, _, inter = struct.unpack(">IIBBBBB", chunk)
        elif tag == b"PLTE":
            plte = chunk
        elif tag == b"tRNS":
            trns = chunk
        elif tag == b"IDAT":
            idat += chunk
        elif tag == b"IEND":
            break
    if bd != 8 or inter:
        raise SystemExit(f"{path}: поддерживаю только 8 бит без чересстрочности")
    ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ct]
    stride = w * ch
    raw = zlib.decompress(idat)
    out = bytearray(h * stride)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]
        p += 1
        line = bytearray(raw[p:p + stride])
        p += stride
        if f == 1:
            for i in range(ch, stride):
                line[i] = (line[i] + line[i - ch]) & 255
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                b = prev[i]
                c = prev[i - ch] if i >= ch else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        out[y * stride:(y + 1) * stride] = line
        prev = line
    px = bytearray(w * h * 4)
    for y in range(h):
        row = out[y * stride:(y + 1) * stride]
        o = y * w * 4
        if ct == 6:
            px[o:o + w * 4] = row
        elif ct == 2:
            for x in range(w):
                px[o + x * 4:o + x * 4 + 3] = row[x * 3:x * 3 + 3]
                px[o + x * 4 + 3] = 255
        elif ct == 0:
            for x in range(w):
                v = row[x]
                px[o + x * 4:o + x * 4 + 3] = bytes((v, v, v))
                px[o + x * 4 + 3] = 255
        elif ct == 4:
            for x in range(w):
                v = row[x * 2]
                px[o + x * 4:o + x * 4 + 3] = bytes((v, v, v))
                px[o + x * 4 + 3] = row[x * 2 + 1]
        else:  # палитровый
            for x in range(w):
                i = row[x]
                px[o + x * 4:o + x * 4 + 3] = plte[i * 3:i * 3 + 3]
                px[o + x * 4 + 3] = trns[i] if trns and i < len(trns) else 255
    return w, h, px


# ---------- геометрия и цвет ----------


def crop_box(w, h, tw, th, cx, cy):
    """Центральный (или со смещением cx/cy) кроп до пропорций цели."""
    ta, sa = tw / th, w / h
    if sa > ta + 1e-9:                      # источник шире — режем по ширине
        nw = max(tw, int(round(h * ta)))
        return int((w - nw) * cx), 0, nw, h
    if sa < ta - 1e-9:                      # источник уже — режем по высоте
        nh = max(th, int(round(w / ta)))
        return 0, int((h - nh) * cy), w, nh
    return 0, 0, w, h


def resample(px, w, x0, y0, sw, sh, tw, th):
    """Усреднение блоками: из «крупного пикселя» генератора — в логическую сетку."""
    out = bytearray(tw * th * 4)
    for ty in range(th):
        sy0 = y0 + (sh * ty) // th
        sy1 = max(sy0 + 1, y0 + (sh * (ty + 1)) // th)
        for tx in range(tw):
            sx0 = x0 + (sw * tx) // tw
            sx1 = max(sx0 + 1, x0 + (sw * (tx + 1)) // tw)
            n = 0
            r = g = b = a = 0
            for sy in range(sy0, sy1):
                seg = px[(sy * w + sx0) * 4:(sy * w + sx1) * 4]
                r += sum(seg[0::4])
                g += sum(seg[1::4])
                b += sum(seg[2::4])
                a += sum(seg[3::4])
                n += sx1 - sx0
            o = (ty * tw + tx) * 4
            out[o], out[o + 1], out[o + 2], out[o + 3] = r // n, g // n, b // n, a // n
    return out


def quantize(px, pal_rgb, want_alpha, chroma, snap=None):
    """Chroma-key → альфа; snap — довести близкие к фону цвета до точного фона;
    затем каждый цвет к ближайшему из палитры импорта (вес 3/4/2)."""
    cache = {}
    colors, maxdist, transp = set(), 0, 0
    cr = cg = cb = 0
    if chroma:
        cr = int(chroma[1:3], 16)
        cg = int(chroma[3:5], 16)
        cb = int(chroma[5:7], 16)
    sr = sg = sb = 0
    if snap:
        sr = int(snap[1:3], 16)
        sg = int(snap[3:5], 16)
        sb = int(snap[5:7], 16)
    for i in range(0, len(px), 4):
        if snap and abs(px[i] - sr) + abs(px[i + 1] - sg) + abs(px[i + 2] - sb) < 96:
            px[i], px[i + 1], px[i + 2] = sr, sg, sb
        if chroma and abs(px[i] - cr) + abs(px[i + 1] - cg) + abs(px[i + 2] - cb) < 300:
            px[i + 3] = 0
        if px[i + 3] < 128:
            px[i + 3] = 0
            transp += 1
            if not want_alpha:
                continue                      # у фонов альфы быть не должно — посчитаем в отчёте
            continue
        px[i + 3] = 255
        key = (px[i], px[i + 1], px[i + 2])
        q = cache.get(key)
        if q is None:
            best, bd = None, 1 << 30
            for (pr, pg, pb) in pal_rgb:
                dr, dg, db = px[i] - pr, px[i + 1] - pg, px[i + 2] - pb
                d = 3 * dr * dr + 4 * dg * dg + 2 * db * db
                if d < bd:
                    best, bd = (pr, pg, pb), d
            q = best
            cache[key] = q
            d8 = bd // 6
            if d8 > maxdist:
                maxdist = d8
        px[i], px[i + 1], px[i + 2] = q
        colors.add(q)
    return colors, maxdist, transp


# ---------- код PNG ----------


def chunk(tag, payload):
    return (struct.pack(">I", len(payload)) + tag + payload
            + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF))


def encode_png(w, h, px, colors):
    if colors and len(colors) <= 256:
        order = sorted(colors)
        idx = {c: i for i, c in enumerate(order)}
        plte = b"".join(bytes(c) for c in order)
        rows = bytearray()
        for y in range(h):
            rows.append(0)
            rows += bytes(idx[(px[i], px[i + 1], px[i + 2])]
                          for i in range(y * w * 4, (y + 1) * w * 4, 4))
        ihdr = struct.pack(">IIBBBBB", w, h, 8, 3, 0, 0, 0)
        return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"PLTE", plte)
                + chunk(b"IDAT", zlib.compress(bytes(rows), 9)) + chunk(b"IEND", b""))
    rows = bytearray()
    for y in range(h):
        rows.append(0)
        rows += px[y * w * 4:(y + 1) * w * 4]
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(bytes(rows), 9)) + chunk(b"IEND", b""))


# ---------- главный проход ----------


def parse_data_js(text):
    """Данные из собранного assets.js или index.html: ключ → data URI (для накопления и восстановления)."""
    import re as _re
    return dict(_re.findall(r"^    '([^']+)': '(data:image/png;base64,[A-Za-z0-9+/=]+)',$", text, _re.M))


def main():
    argv = [a for a in sys.argv[1:] if not a.startswith("--")]
    merge_from = None
    if "--merge-from" in sys.argv:
        merge_from = sys.argv[sys.argv.index("--merge-from") + 1]
        argv = [a for a in argv if a != merge_from]
    man = json.load(open(MAN, encoding="utf-8"))
    pal = json.load(open(PALF, encoding="utf-8"))
    pal_rgb = [tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for v in pal.values()]
    only = set(argv)
    entries = [a for a in man["assets"] if not only or a["id"] in only]
    # накопление: то, что не перегенерируется сейчас, берём из прошлой сборки
    prev = {}
    if os.path.exists(OUTJS):
        prev.update(parse_data_js(open(OUTJS, encoding="utf-8").read()))
    if merge_from:
        prev.update(parse_data_js(open(merge_from, encoding="utf-8").read()))
    data, errs, total = {}, [], 0

    for a in entries:
        if a.get("status") == "отклонён":
            continue
        key = a.get("use_as", a["id"])
        src = os.path.join(ROOT, a["file"])
        if not os.path.exists(src):
            if key in prev:
                data[key] = prev[key]
                a["status"] = "импортирован"
                a["source"] = "прежняя сборка (негатив утерян, взят из бандла)"
                print(f"  {a['id']:14s} негатива нет — оставлен из прежней сборки ({len(prev[key]) // 1024} КБ b64)")
                continue
            errs.append(f"{a['id']}: нет файла {a['file']} и нет в прежней сборке")
            continue
        tw, th = a["target"]
        w, h, px = decode_png(src)
        x0, y0, sw, sh = crop_box(w, h, tw, th, a.get("crop_x", 0.5), a.get("crop_y", 0.5))
        small = resample(px, w, x0, y0, sw, sh, tw, th)
        want_alpha = a["kind"] == "icon"
        colors, maxdist, transp = quantize(small, pal_rgb, want_alpha, a.get("chroma"), a.get("bg_snap"))
        npix = tw * th
        if want_alpha and transp == 0:
            errs.append(f"{a['id']}: ждал прозрачность, получил непрозрачную картинку")
            continue
        if not want_alpha and transp > npix // 100:
            errs.append(f"{a['id']}: у фона {100 * transp // npix}% прозрачных пикселей")
            continue
        if len(colors) > len(pal_rgb):
            errs.append(f"{a['id']}: цветов больше палитры")
            continue
        png = encode_png(tw, th, small, colors if not want_alpha else None)
        b64 = base64.b64encode(png).decode()
        key = a.get("use_as", a["id"])
        data[key] = "data:image/png;base64," + b64
        total += len(png)
        a["status"] = "импортирован"
        a["png_bytes"] = len(png)
        a["b64_bytes"] = len(b64)
        a["colors"] = len(colors)
        a["maxdist"] = maxdist
        a["alpha_pct"] = 100 * transp // npix
        a["sha1"] = hashlib.sha1(png).hexdigest()[:10]
        print(f"  {a['id']:12s} {w}×{h} → {tw}×{th}  цветов {len(colors):3d}  "
              f"увод {maxdist:3d}  альфа {a['alpha_pct']:3d}%  "
              f"png {len(png)/1024:6.1f} КБ  b64 {len(b64)/1024:6.1f} КБ")

    if errs:
        print("ОШИБКИ:")
        for e in errs:
            print("  ✘", e)
    for k in prev:                      # ключи, не обработанные в этом прогоне, не теряем
        if k not in data:
            data[k] = prev[k]
            print(f"  {k}: не перегенерирован в этом прогоне — оставлен из прежней сборки")
    json.dump(man, open(MAN, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    lines = ["// Ассеты V8: сгенерировано tools/assets/import.py — НЕ ПРАВИТЬ РУКАМИ.",
             "// Источники, промпты и статусы: tools/assets/manifest.json; план и правила: V8.md.",
             "// Фолбэк: нет картинки или ассеты выключены (?assets=0) — игра рисует всё кодом, как раньше.",
             "G.assets = (function () {",
             "  const data = {"]
    for k, v in data.items():
        lines.append(f"    '{k}': '{v}',")
    lines += [
        "  };",
        "  const cache = {};",
        "  const cbs = [];",
        "  let loaded = 0, fired = false;",
        "  const total = Object.keys(data).length;",
        "  const api = {",
        "    enabled: true,",
        "    data,",
        "    has(id) { return !!data[id]; },",
        "    img(id) {",
        "      if (!data[id]) return null;",
        "      if (!cache[id]) {",
        "        const i = new Image();",
        "        i.onload = () => { loaded++; if (loaded >= total && !fired) { fired = true; cbs.splice(0).forEach((f) => f()); } };",
        "        i.src = data[id];",
        "        cache[id] = i;",
        "      }",
        "      return cache[id];",
        "    },",
        "    ready(id) { const i = cache[id]; return !!(i && i.complete && (i.naturalWidth || i.width) > 0); },",
        "    onReady(fn) { if (fired) fn(); else cbs.push(fn); },",
        "    preload() { for (const id in data) this.img(id); },",
        "    canvas(id, w, h) {",
        "      if (!this.enabled || !this.ready(id)) return null;",
        "      const c = G.gfx.canvas(w, h), x = c.getContext('2d');",
        "      x.imageSmoothingEnabled = false;",
        "      x.drawImage(cache[id], 0, 0, w, h);",
        "      c._asset = id;",
        "      return c;",
        "    },",
        "    draw(ctx, id, x, y, w, h) {",
        "      if (!this.enabled || !this.ready(id)) return false;",
        "      ctx.drawImage(cache[id] || this.img(id), x, y, w, h);",
        "      return true;",
        "    },",
        "  };",
        "  try {",
        "    if (typeof location !== 'undefined' && /[?&]assets=0/.test(location.search)) api.enabled = false;",
        "  } catch (_) {}",
        "  api.preload();",
        "  return api;",
        "})();",
        "",
    ]
    open(OUTJS, "w", encoding="utf-8").write("\n".join(lines))
    print(f"ИТОГО: ассетов {len(data)}, PNG {total/1024:.1f} КБ, base64 в assets.js "
          f"{sum(len(v) for v in data.values())/1024:.1f} КБ")
    if errs:
        sys.exit(1)


if __name__ == "__main__":
    main()
