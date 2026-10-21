#!/usr/bin/env python3
"""Проверка локальных Markdown-ссылок и согласованности 36 мастеров редактора.
Только стандартная библиотека. Не заменяет браузерные проверки рендера.
"""
from pathlib import Path
import base64
import hashlib
import json
import re
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


def check():
    errors = []
    documents = sorted(set([ROOT / 'README.md', ROOT / 'CLAUDE.md'] +
                          list((ROOT / 'docs').rglob('*.md')) +
                          list((ROOT / '.claude').rglob('*.md')) +
                          list((ROOT / 'art').rglob('*.md'))))
    links = 0
    for document in documents:
        text = re.sub(r'```.*?```', '', document.read_text(), flags=re.S)
        for match in re.finditer(r'!?\[[^\]\n]*\]\(<?([^\s)>]+)>?(?:\s+"[^"]*")?\)', text):
            url = urlsplit(match[1])
            if url.scheme or url.netloc or not url.path:
                continue
            target = (document.parent / unquote(url.path)).resolve()
            links += 1
            if not target.exists():
                errors.append(f'{document.relative_to(ROOT)}: нет {match[1]}')

    directory = ROOT / 'art/editor-world'
    manifest = json.loads((directory / 'manifest.json').read_text())
    specs = json.loads((ROOT / 'tools/editor_art_specs.json').read_text())
    source = (ROOT / 'src/editor/generated_art_data.js').read_text()
    compiled = json.loads(source.split('G.EDITOR_ART=', 1)[1].strip().removesuffix(';'))
    if len(manifest) != 36 or set(manifest) != set(specs) or set(manifest) != set(compiled):
        errors.append('Набор 36 ID расходится между manifest/specs/compiled')
    files = set()
    for key, entry in manifest.items():
        path = directory / entry['file']
        files.add(path.name)
        if path.parent != directory or not path.is_file():
            errors.append(f'{key}: мастер отсутствует или неверный путь')
            continue
        if hashlib.sha256(path.read_bytes()).hexdigest() != entry.get('master_sha256'):
            errors.append(f'{key}: master_sha256 не совпадает')
        if entry.get('status') != 'integrated-editor':
            errors.append(f'{key}: устаревший статус подключения')
        if key not in specs or key not in compiled:
            continue
        data, spec = compiled[key], specs[key]
        if any(data.get(field) != value for field, value in spec.items()):
            errors.append(f'{key}: рамка/точка опоры расходятся')
        pixels = base64.b64decode(data['pixels'], validate=True)
        if len(pixels) != spec['w'] * spec['h'] * 4 or not any(pixels):
            errors.append(f'{key}: неверный размер/пустые пиксели')
        if max(pixels, default=0) >= len(data['pal']):
            errors.append(f'{key}: индекс вне палитры')
    if len(files) != len(manifest):
        errors.append('Несколько ID ссылаются на один мастер')
    extra = {p.name for p in directory.glob('*.webp')} - files
    if extra:
        errors.append(f'Мастера вне manifest: {sorted(extra)}')
    if errors:
        raise ValueError('\n'.join(errors))
    print(f'✔ {len(documents)} MD-файлов, {links} локальных ссылок: цели существуют')
    print('✔ 36 мастеров: SHA256, статусы, ID, рамки и встроенные палитры согласованы')


if __name__ == '__main__':
    check()
