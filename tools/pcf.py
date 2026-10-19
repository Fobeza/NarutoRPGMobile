"""Минимальный читатель PCF-шрифтов (X11 bitmap): pcf.load('файл.pcf.gz') → (глифы {символ: (ширина, ascent, descent, left, [строки из 0/1])}, ascent, descent)."""
import gzip, struct


def load(path):
    raw = gzip.open(path, 'rb').read() if path.endswith('.gz') else open(path, 'rb').read()
    assert raw[:4] == b'\x01fcp', 'не PCF'
    n = struct.unpack_from('<I', raw, 4)[0]
    tabs = {}
    for i in range(n):
        t, fmt, size, off = struct.unpack_from('<IIII', raw, 8 + i * 16)
        tabs[t] = (fmt, off)

    def endian(fmt): return '>' if fmt & 4 else '<'

    # метрики
    fmt, off = tabs[0x4]; e = endian(fmt)
    if fmt & 0x100:                                  # сжатые (по байту)
        cnt = struct.unpack_from(e + 'H', raw, off + 4)[0]; p = off + 6
        mets = [tuple(b - 0x80 for b in raw[p + i * 5:p + i * 5 + 5]) for i in range(cnt)]
    else:
        cnt = struct.unpack_from(e + 'I', raw, off + 4)[0]; p = off + 8
        mets = [struct.unpack_from(e + 'hhhhh', raw, p + i * 12) for i in range(cnt)]   # left, right, width, ascent, descent
    # растры
    fmt, off = tabs[0x8]; e = endian(fmt)
    cnt = struct.unpack_from(e + 'I', raw, off + 4)[0]
    offs = struct.unpack_from(e + 'I' * cnt, raw, off + 8)
    data = off + 8 + 4 * cnt + 16
    pad = 1 << (fmt & 3); msb = bool(fmt & 8)
    # кодировка
    fmt2, off2 = tabs[0x20]; e2 = endian(fmt2)
    mincol, maxcol, minrow, maxrow, defch = struct.unpack_from(e2 + 'hhhhh', raw, off2 + 4)
    ncols, nrows = maxcol - mincol + 1, maxrow - minrow + 1
    idx = struct.unpack_from(e2 + 'H' * (ncols * nrows), raw, off2 + 14)
    glyphs = {}
    for k, gi in enumerate(idx):
        if gi == 0xFFFF: continue
        code = (minrow + k // ncols) * 256 + mincol + k % ncols
        l, r, w, asc, desc = mets[gi]
        wpx, hpx = r - l, asc + desc
        rowb = ((wpx + 8 * pad - 1) // (8 * pad)) * pad
        rows = []
        for j in range(hpx):
            b = raw[data + offs[gi] + j * rowb: data + offs[gi] + (j + 1) * rowb]
            bits = ''.join(format(x if msb else int(format(x, '08b')[::-1], 2), '08b') for x in b)
            rows.append([int(c) for c in bits[:wpx]])
        glyphs[chr(code)] = (w, asc, desc, l, rows)
    return glyphs
