#!/usr/bin/env python3
"""Упаковать согласованные мастеры 2.2.2. Оригиналы нужны только для пересборки арта.
python3 tools/package_art.py; обычный build.py их не требует.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image
from prepare_environment_art import prepare

ROOT = Path(__file__).resolve().parents[1]

def main():
    sources = ROOT / 'assets/src'
    entries = []
    for src in sorted((sources / 'environment').glob('konoha-*.png')):
        # Отменённая ограда не должна возвращаться из старого архива.
        if src.stem.startswith('konoha-clanwall'):
            raise ValueError('Удалите отменённый исходник: ' + str(src))
        dest = ROOT / 'art/environment' / (src.stem + '.webp')
        limit = 256 if 'flowers-' in src.stem else 512
        original = prepare(src, dest, limit)
        entries.append(entry(dest, original, limit, 'environment'))
    for src in sorted((sources / 'terrain').glob('*.png')):
        im = Image.open(src).convert('RGB')
        original = im.size
        im.thumbnail((512, 512), Image.Resampling.NEAREST)
        dest = ROOT / 'art/terrain/path' / src.name
        im.save(dest, optimize=True)
        entries.append(entry(dest, original, 512, 'terrain'))
    if len(entries) != 35:
        raise ValueError(f'Ожидалось 35 согласованных изображений, найдено {len(entries)}')
    data = {'release': '2.2.2', 'status': 'not_integrated',
            'note': 'Размеры мастеров не задают игровые размеры. Тайл игры 16 точек, HI=2. Границы земли ещё не согласованы.',
            'assets': entries}
    (ROOT / 'art/manifest.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
    print(f'{len(entries)} изображений, {sum(e["bytes"] for e in entries):,} байт')

def entry(dest, original, limit, kind):
    with Image.open(dest) as im:
        width, height = im.size
    raw = dest.read_bytes()
    return {'file': dest.relative_to(ROOT).as_posix(), 'kind': kind,
            'sourceCroppedSize': list(original), 'width': width, 'height': height,
            'maxSize': limit, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}

if __name__ == '__main__':
    main()
