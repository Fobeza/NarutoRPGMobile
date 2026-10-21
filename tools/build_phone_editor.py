#!/usr/bin/env python3
"""Автономный мобильный редактор. Не включает движок игры и систему сохранений."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
MODULES=['engine/core.js','gfx/palette.js','gfx/font_data.js','gfx/font.js','gfx/sprites.js','gfx/shade.js','gfx/ui.js','gfx/environment.js','gfx/environment_art_data.js','gfx/environment_art.js','gfx/terrain_art.js','gfx/street_art.js','gfx/water_art.js','gfx/tiles.js','data/buildings.js','gfx/house_art_data.js','gfx/house_art.js','editor/generated_art_data.js','editor/generated_art.js','editor/village_art.js']
def build():
    shared='\n'.join((ROOT/'src'/p).read_text() for p in MODULES)
    html=(ROOT/'src/editor/phone.html').read_text().replace('/*__GRAPHICS__*/',shared).replace('/*__EDITOR__*/',(ROOT/'src/editor/phone.js').read_text())
    (ROOT/'map-editor.html').write_text(html)
    print(f'Мобильный редактор: {len(html.encode()):,} байт, автономный HTML')
if __name__=='__main__':build()
