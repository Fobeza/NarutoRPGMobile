#!/usr/bin/env python3
"""Убрать фон и подготовить компактные мастеры окружения, не меняя игровой рендер.
Оригиналы в assets/src/environment (не публикуются). Нужен Pillow.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

def prepare(source, destination, max_size=512):
    image = Image.open(source).convert('RGBA')
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if r > 100 and b > 100 and r > g * 1.5 and b > g * 1.5:
                pixels[x, y] = (0, 0, 0, 0)
    bounds = image.getbbox()
    if bounds is None:
        raise ValueError(f'Пустой спрайт: {source}')
    image = image.crop(bounds)
    original = image.size
    image.thumbnail((max_size, max_size), Image.Resampling.NEAREST)
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, lossless=True, method=6)
    return original

if __name__ == '__main__':
    for source in sorted((ROOT / 'assets/src/environment').glob('konoha-*.png')):
        limit = 256 if 'flowers-' in source.stem else 512
        destination = ROOT / 'art/environment' / (source.stem + '.webp')
        prepare(source, destination, limit)
        print(destination.relative_to(ROOT))
