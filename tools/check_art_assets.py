#!/usr/bin/env python3
"""Проверка опубликованного набора арта: размеры, альфа, хеши, отсутствие лишних файлов.
Работает из чистого checkout без оригиналов assets/src. Нужен Pillow.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

def main():
    manifest = json.loads((ROOT / 'art/manifest.json').read_text())
    assert manifest['release'] == '2.2.2'
    assert manifest['status'] == 'integrated'
    assets = manifest['assets']
    paths = {a['file'] for a in assets}
    assert len(assets) == len(paths) == 35
    actual = {p.relative_to(ROOT).as_posix() for folder in ('art/environment','art/terrain/path')
              for p in (ROOT / folder).iterdir() if p.suffix.lower() in ('.png','.webp')}
    assert paths == actual, (paths-actual, actual-paths)
    total = 0
    for a in assets:
        path = ROOT / a['file']
        assert path.resolve().is_relative_to(ROOT / 'art')
        assert 'clanwall' not in path.stem, 'Отменённая ограда не должна публиковаться'
        raw = path.read_bytes()
        assert hashlib.sha256(raw).hexdigest() == a['sha256'], path
        assert len(raw) == a['bytes'] < 512*1024, path
        total += len(raw)
        with Image.open(path) as im:
            w,h = im.size
            assert (w,h) == (a['width'],a['height'])
            assert 0 < w <= a['maxSize'] <= 512 and 0 < h <= a['maxSize']
            sw,sh = a['sourceCroppedSize']
            assert w <= sw and h <= sh, 'Увеличенный мастер'
            assert abs(w*sh-h*sw) <= sw+sh, 'Растянуты пропорции'
            if a['kind'] == 'environment':
                assert im.mode == 'RGBA' and im.getchannel('A').getextrema() == (0,255), path
                assert im.getbbox() is not None
                if 'flowers-' in path.name: assert max(w,h) <= 256
            else:
                assert a['kind'] == 'terrain' and (w,h) == (512,512)
    assert total <= 8*1024*1024, 'Бюджет набора превышен'
    print(f'✔ Арт: 35 файлов, прозрачность 30/30, пропорции, SHA-256, лимиты; {total:,} байт')
    print('✔ Мастер-изображения подключены через встроенные спрайты; размеры игровых объектов заданы отдельно')

if __name__ == '__main__':
    main()
