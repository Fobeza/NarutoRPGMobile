# Журнал уборки — 2026-10-21

Доказательство неиспользуемости для каждого идентификатора: поиск по словам во всём `src/` (кроме
`*_data.js`), `tools/` (`.js/.py/.html`), `src/shell.html` и `src/editor/phone.html` — имя встречается
ровно один раз, в собственном объявлении. Все удалённые выражения чистые (без побочных эффектов).
Отпечатки `node tools/node/golden.js` до и после совпали.

| Объект | Причина | Коммит |
|---|---|---|
| `src/gfx/chars_render.js` — `MIR` | хелпер зеркала формы, не вызывается | волна 4 |
| `src/gfx/chars_render.js` — `vc` (ветка `vest`) | значение вычисляется и не читается; `mix`/`rgb` чистые | волна 4 |
| `src/gfx/ui.js` — `mixHex` | не вызывается | волна 4 |
| `src/scenes/battle.js` — `strongish` | не вызывается | волна 4 |
| `src/scenes/world.js` — `CANON` | не читается | волна 4 |
| `src/world/mapgen.js` — `walkwayDown()` | функция не вызывается | волна 4 |
| `src/world/mapgen.js` — `fillO` | не вызывается | волна 4 |
| `src/world/mapgen.js` — `inRect`, `isRoad` | использовались только `fillO` и `walkwayDown` | волна 4 |
| `tools/check_node.py` — 9 копий блока запуска | заменены циклом по `SUITES`, вывод тот же | волна 2 |

Не удалено (публичное через `G`): `G.sprites.fromStrings` (`src/gfx/sprites.js`),
`G.debug.cheats.teleport` (`src/engine/debug.js`, консоль в `?debug=1`).
