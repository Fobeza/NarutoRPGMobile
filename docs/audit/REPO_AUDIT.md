# Аудит репозитория — 2026-10-21

Точка отсчёта: `f23ee20` (main). Снимок состояния, а не постоянная инструкция:
текущая структура — [ARCHITECTURE](../ARCHITECTURE.md), проверки — [TESTING](../TESTING.md).

## Стек

- Игра: ванильный JavaScript без зависимостей, всё в глобальном `G`; `build.py` (Python 3, только стандартная
  библиотека) склеивает 113 модулей `src/` по списку `JS_FILES` в один `index.html` (~5,3 МБ) + `sw.js`.
- Редактор: `tools/build_phone_editor.py` → автономный `map-editor.html` (~3,8 МБ); служебный dev-редактор →
  `build/map_editor.html` (не коммитится).
- Публикация: GitHub Pages из корня репозитория (`index.html`, `sw.js`, `map-editor.html`, `.nojekyll`).
- Проверки: Node.js (`tools/node/`), Playwright для Python (`tools/test_*.py`) и Node (`tools/test_*.js`).
  Линтера, форматтера, typecheck и CI нет; манифестов пакетов (`package.json`, `requirements.txt`) нет.

## Карта

```
/                 13 записей; index.html, sw.js, map-editor.html — результат сборки, нужны Pages в корне
├── src/          126 файлов, 5,7 МБ — слои engine / gfx / systems / data / world / scenes / editor
├── art/          212 мастеров (webp/png, 40 МБ) + manifest — исходники для tools/import_*.py
├── tools/        58 файлов: сборка редактора, check_*, test_*.py (7), test_*.js (18), node/ (15),
│                 импорт/упаковка арта, съёмка кадров, json-спецификации, шрифты Terminus
├── docs/         документация; BALANCE.md и balance.csv генерируются tools/balance.py
└── .claude/      памятка polish
```

Сгенерированные файлы в `src/`: `gfx/*_art_data.js`, `gfx/font_data.js`, `editor/generated_art_data.js`,
`data/konoha_layout.js`. Источники правды: `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `build.py:JS_FILES`.

## Проблемные места (по объективным метрикам)

| Файл | Метрика |
|---|---|
| `src/scenes/battle.js` | 1130 строк, 87 КБ |
| `src/scenes/world.js` | 954 строки, 52 КБ, 8 коммитов из 65 |
| `src/gfx/tiles.js` | 783 строки, 51 КБ |
| `src/world/buildgfx.js` | 778 строк, 47 КБ |
| `src/world/mapgen.js` | 776 строк, 49 КБ |
| `src/gfx/chars_render.js` | 691 строка, 48 КБ |
| `src/systems/adventures.js` | 347 строк, 49 КБ, строки до 840 символов |
| `tools/test_iphone.py` | 510 строк |
| `tools/node/checks.js` | 500 строк |
| `tools/` | 58 файлов шести ролей на одном уровне |

TODO/FIXME/HACK в коде — 0. История — 65 коммитов с 2026-10-19. Дублирование (окна по 6 значимых строк) —
только служебный код: `check_node.py` (устранено), стартовый код пяти скриптов съёмки кадров.

## Достижимость

- Все 113 JS из `JS_FILES` и 5 файлов `src/editor/` (через `MODULES` в `build_phone_editor.py`) подключаются.
- Все 212 изображений `art/` упомянуты в `tools/art_catalog.json`, `art/manifest.json`,
  `art/editor-world/manifest.json`, `tools/char_sheets.json` или списке `CHARS` в `tools/import_chars.py`.
- У каждого файла `tools/` есть ссылка; `prepare_environment_art.py` подключается импортом из `package_art.py:9`.
- Секретов в рабочем дереве и истории не найдено; мусор (`.DS_Store`, логи, `build/`, бэкапы) не закоммичен.

## Базовая линия (до правок)

| Проверка | Результат |
|---|---|
| `python3 build.py` | OK, 113 модулей; изменилась только строка `BUILD.date` |
| `tools/check_node.py` | 10 наборов, 0 провалов |
| `tools/check_all.py` | 10/10 |
| `tools/test_*.js` | 18/18 |
| `check_docs.py`, `check_art_assets.py` | ✔ |
