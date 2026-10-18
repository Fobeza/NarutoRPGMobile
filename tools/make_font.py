#!/usr/bin/env python3
"""Генератор пиксельного шрифта интерфейса: python3 tools/make_font.py
Растеризует глифы системным шрифтом DejaVu (Serif Bold 12 px — основной, Sans Bold 11 px — мелкий) через Chromium,
порогом превращает в чёткие пиксели и пишет src/gfx/font_data.js. Значки вместо эмодзи нарисованы здесь вручную.
Шрифт DejaVu — свободная лицензия (Bitstream Vera + общественное достояние), разрешает встраивание производных.
Запускать нужно только при смене шрифта или набора символов; результат коммитится."""
import os, re, glob, json, base64
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# что рисуем: имя → (css-шрифт, порог яркости)
FACES = {
    'body': ('bold 12px "DejaVu Serif"', 150),
    'small': ('bold 11px "DejaVu Sans"', 150),
}

# символы из DejaVu (всё, что встречается в тексте игры, кроме эмодзи)
def used_chars():
    cnt = set()
    for f in glob.glob(os.path.join(ROOT, 'src', '**', '*.js'), recursive=True):
        if f.endswith(('font_data.js', 'title_art.js', 'font.js')): continue
        s = open(f, encoding='utf-8').read()
        s = re.sub(r'//[^\n]*', '', s); s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
        cnt.update(s)
    out = [c for c in sorted(cnt) if 32 < ord(c) < 127 or 0x400 <= ord(c) <= 0x4ff]
    out += list('—«»·×▶♥★→✔–…▼−№◀▲●☂≈☀←▸○■□☁')
    return sorted(set(out), key=ord)

# значки, нарисованные вручную (эмодзи DejaVu не знает); 9 строк по 10 столбцов
ICONS = {
    '📍': ['...####...', '..######..', '.###..###.', '.###..###.', '.########.', '..######..', '...####...', '....##....', '....#.....'],
    '🌙': ['...####...', '..###.....', '.###......', '.###......', '.###......', '.####.....', '..#######.', '...#####..', '..........'],
    '⏰': ['.##....##.', '#.######.#', '..#.##.#..', '.#..##..#.', '.#..###.#.', '.#......#.', '..#....#..', '..######..', '.##....##.'],
    '❓': ['..######..', '.##....##.', '......##..', '.....##...', '....##....', '....##....', '..........', '....##....', '....##....'],
    '🍜': ['.#.#.#....', '..#.#.#...', '..........', '##########', '#.#.#.#.##', '.########.', '..######..', '...####...', '..........'],
    '🍃': ['......###.', '....#####.', '..#######.', '.########.', '.#######..', '#.#####...', '..###.....', '.#........', '#.........'],
    '💬': ['.########.', '##########', '##########', '##########', '##########', '.########.', '..###.....', '..##......', '..#.......'],
    '👤': ['...####...', '..######..', '..######..', '..######..', '...####...', '.########.', '##########', '##########', '##########'],
    '🔥': ['....#.....', '...##.....', '..###..#..', '..###.###.', '.#########', '.#########', '.#########', '..#######.', '...#####..'],
    '📘': ['.########.', '##.......#', '#.######.#', '#........#', '#.######.#', '#........#', '#.####...#', '##.......#', '.########.'],
    '📜': ['.########.', '#........#', '.#.####.#.', '...#......', '..####....', '...#......', '.#.####.#.', '#........#', '.########.'],
}


def main():
    chars = used_chars()
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); pg.set_content('<canvas id=c width=64 height=40></canvas>')
        out = {}
        for name, (font, thr) in FACES.items():
            data = pg.evaluate("""([chars, font, thr]) => {
              const c = document.getElementById('c'), x = c.getContext('2d', { willReadFrequently: true });
              const res = {};
              for (const ch of chars) {
                x.clearRect(0, 0, 64, 40); x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 40);
                x.font = font; x.fillStyle = '#000'; x.textBaseline = 'alphabetic';
                x.fillText(ch, 8, 24);
                const im = x.getImageData(0, 0, 64, 40).data, rows = [];
                for (let j = 0; j < 40; j++) { let r = ''; for (let i = 0; i < 64; i++) r += im[(j * 64 + i) * 4] < thr ? '#' : '.'; rows.push(r); }
                res[ch] = { rows, adv: x.measureText(ch).width };
              }
              return res;
            }""", [chars, font, thr])
            out[name] = data
        b.close()

    faces = {}
    for name, data in out.items():
        # общие границы по строкам (чтобы все глифы лежали в одной сетке) и колонки каждого глифа по отдельности
        top, bot = 99, -1
        for ch, g in data.items():
            for j, r in enumerate(g['rows']):
                if '#' in r:
                    top = min(top, j); bot = max(bot, j)
        base = 24 - top                               # строка базовой линии внутри глифа (0 — верх)
        glyphs = {}
        for ch, g in data.items():
            cols = [i for i in range(64) if any(g['rows'][j][i] == '#' for j in range(top, bot + 1))]
            if not cols: continue
            lo, hi = min(cols), max(cols)
            rows = [g['rows'][j][lo:hi + 1] for j in range(top, bot + 1)]
            glyphs[ch] = '|'.join(rows)
        h = bot - top + 1
        # символ-пробел и «?» на случай неизвестного
        faces[name] = {'h': h, 'base': base, 'glyphs': glyphs}
        # значки вручную — только в основной шрифт (в мелком масштабируются обрезкой)
    body = faces['body']
    for ch, rows in ICONS.items():
        pad_top = max(0, body['base'] - 9 - 0)       # значок стоит на базовой линии
        full = ['.' * 10] * pad_top + rows
        full += ['.' * 10] * (body['h'] - len(full))
        body['glyphs'][ch] = '|'.join(full[:body['h']])
    small = faces['small']
    for ch, rows in ICONS.items():
        r7 = rows[0:8]                               # 8 строк из 9 и сужаем до 9 столбцов
        r7 = [r[0:9] for r in r7]
        pad_top = max(0, small['base'] - 8)
        full = ['.' * 9] * pad_top + r7
        full += ['.' * 9] * (small['h'] - len(full))
        small['glyphs'][ch] = '|'.join(full[:small['h']])

    js = ['// Данные пиксельного шрифта — СГЕНЕРИРОВАНО tools/make_font.py, руками не править.',
          '// Шрифт DejaVu (свободная лицензия) растеризован в пиксели; значки вместо эмодзи нарисованы вручную.',
          'G.FONT_DATA = ' + json.dumps(faces, ensure_ascii=False, indent=1) + ';', '']
    path = os.path.join(ROOT, 'src', 'gfx', 'font_data.js')
    open(path, 'w', encoding='utf-8').write('\n'.join(js))
    print('глифов: body', len(faces['body']['glyphs']), 'small', len(faces['small']['glyphs']),
          '| высота', faces['body']['h'], 'база', faces['body']['base'], '|', os.path.getsize(path) // 1024, 'КБ')


if __name__ == '__main__':
    main()
