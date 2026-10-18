#!/usr/bin/env python3
"""
Сборка игры «Воля Огня» в один HTML-файл.

    python3 build.py           → index.html + sw.js (в корне, это и есть сайт) + build/map_editor.html
    python3 build.py --debug   → то же, но с включённым debug-режимом по умолчанию

Исходники лежат в src/. Порядок подключения JS задаётся списком JS_FILES.
"""
import base64, hashlib, os, re, struct, sys, time, zlib

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
OUT = ROOT                                   # index.html и sw.js — в корне (GitHub Pages)
DEV = os.path.join(ROOT, "build")           # служебное (редактор карты), не коммитится

# Порядок подключения модулей. ВАЖЕН: модуль может пользоваться только тем, что подключено выше.
# Новый файл → добавь его сюда в подходящую группу (см. docs/ARCHITECTURE.md).
JS_FILES = [
    # ── движок: экран, ввод, звук, сцены, сохранения ──
    "engine/core.js", "engine/screen.js", "engine/input.js", "engine/audio.js", "engine/scenes.js", "engine/storage.js",
    # ── графика: палитра, шрифт, спрайты, персонажи, тайлы ──
    "gfx/palette.js", "gfx/font.js", "gfx/sprites.js", "gfx/shade.js",
    "gfx/chars.js", "data/characters.js", "gfx/chars_render.js",
    "gfx/tiles.js", "gfx/icons.js",
    # ── язык сценариев, окно диалога, время/деньги/сумка ──
    "systems/script.js", "systems/dialog.js", "systems/game.js",
    # ── данные: здания, предметы, задания, герой, бой ──
    "data/buildings.js", "data/items.js", "data/quests.js", "data/hero.js", "data/combat.js",
    # ── игровые системы ──
    "systems/quests.js", "systems/nav.js", "systems/life.js", "systems/flow.js", "systems/train.js",
    "systems/friends.js", "systems/story.js", "systems/lessons.js", "systems/cine.js", "systems/outdoor.js",
    "systems/sim.js",
    # ── сюжет и диалоги ──
    "data/konoha_layout.js", "data/dialogs.js", "data/story_dialogs.js", "data/story_scenes.js",
    # ── мир: карты, интерьеры, жители, расписания ──
    "world/buildgfx.js", "world/map.js", "world/mapgen.js", "world/interiors.js", "world/world.js",
    "world/village_extra.js", "world/village_life.js", "world/cast.js",
    "data/schedule.js", "systems/schedule.js",     # расписание — последним из «мира»: переставляет всех жителей
    "world/roofs.js", "world/fx.js",
    "engine/debug.js",
    # ── экраны (сцены) ──
    "scenes/title.js", "scenes/nameinput.js", "scenes/world.js", "scenes/mapview.js", "scenes/shop.js",
    "scenes/bag.js", "scenes/daysum.js", "scenes/cheats.js", "scenes/journal.js", "scenes/calendar.js",
    "scenes/charcreate.js", "scenes/status.js", "scenes/savemenu.js",
    "scenes/battle_fx.js", "scenes/battle_ai.js", "scenes/battle_bg.js", "scenes/battle.js", "scenes/train.js",
    "scenes/pick.js", "scenes/fishing.js", "scenes/storage.js", "scenes/ending.js", "scenes/menu.js",
    "scenes/gallery.js",
    # ── точка входа ──
    "main.js",
]

# Файлы, общие с редактором карты
EDITOR_SHARED = ["engine/core.js", "data/buildings.js", "data/konoha_layout.js"]


def read(rel):
    with open(os.path.join(SRC, rel), encoding="utf-8") as f:
        return f.read()


# ---------- PNG без сторонних библиотек (иконка «На экран Домой») ----------
def png_bytes(w, h, pixels):
    """pixels: список строк по h, каждая — список (r,g,b) длиной w"""
    raw = b"".join(b"\x00" + b"".join(struct.pack("BBB", *p) for p in row) for row in pixels)

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


ICON_ART = [  # 18×18, масштаб ×10 → 180×180. Символ Листа на протекторе.
    "..................",
    "..................",
    "..................",
    "..................",
    "..mmmmmmmmmmmmmm..",
    ".mllllllllllllllm.",
    ".mllllkkkkklllllm.",
    ".mlllkllllllklllm.",
    ".mlllklkkkllklllm.",
    ".mlllklkllklklllm.",
    ".mlllkllkkllklllm.",
    ".mllllkllllkkkklm.",
    ".mlllllkkkklllklm.",
    ".mllllllllllllllm.",
    "..mmmmmmmmmmmmmm..",
    "..................",
    "..................",
    "..................",
]
ICON_COLORS = {".": (232, 98, 26), "m": (60, 60, 72), "l": (176, 184, 196), "k": (40, 40, 52)}


def make_icon_datauri():
    scale = 10
    art = [row.ljust(18, ".")[:18] for row in ICON_ART]
    pixels = []
    for row in art:
        line = []
        for ch in row:
            line += [ICON_COLORS.get(ch, ICON_COLORS["."])] * scale
        for _ in range(scale):
            pixels.append(line)
    return "data:image/png;base64," + base64.b64encode(png_bytes(18 * scale, 18 * scale, pixels)).decode()


def build(debug=False):
    os.makedirs(DEV, exist_ok=True)

    js_parts = []
    for rel in JS_FILES:
        code = read(rel)
        js_parts.append(f"\n// ===== {rel} =====\n{code}")
    js = "\n".join(js_parts)

    version = hashlib.sha1((js + read("shell.html") + read("style.css")).encode("utf-8")).hexdigest()[:8]   # меняется при любой правке → телефоны подхватят обновление
    stamp = time.strftime("%Y-%m-%d %H:%M")
    header = (f"'use strict';\nconst BUILD = {{ version: '{version}', date: '{stamp}', "
              f"debug: {'true' if debug else 'false'} }};\n")

    shell = read("shell.html")
    css = read("style.css")
    html = (shell.replace("/*__CSS__*/", css)
                 .replace("/*__JS__*/", header + js)
                 .replace("__ICON__", make_icon_datauri())
                 .replace("__VERSION__", version))

    with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)

    sw = read("sw.js").replace("__VERSION__", version)
    with open(os.path.join(OUT, "sw.js"), "w", encoding="utf-8") as f:
        f.write(sw)

    # редактор карты (служебный, в игру не входит)
    ed = read("../tools/map_editor.html")
    shared = "\n".join(f"// ===== {r} =====\n" + read(r) for r in EDITOR_SHARED)
    ed = ed.replace("/*__SHARED__*/", "'use strict';\n" + shared)
    with open(os.path.join(DEV, "map_editor.html"), "w", encoding="utf-8") as f:
        f.write(ed)

    size = os.path.getsize(os.path.join(OUT, "index.html"))
    print(f"OK  версия {version}  index.html = {size/1024:.1f} КБ  ({len(JS_FILES)} модулей)")


if __name__ == "__main__":
    build(debug="--debug" in sys.argv)
