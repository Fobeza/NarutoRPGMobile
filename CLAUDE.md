# Правила для ИИ-помощника

Проект: фанатская пиксельная RPG «Naruto RPG — Воля Огня», браузер, ориентирована на iPhone (портрет).
Владелец общается по-русски; отвечай по-русски, кратко, с результатом. Код и комментарии в коде — тоже по-русски.

## Команды

```bash
python3 build.py                     # src/ → index.html + sw.js + map-editor.html (корень репозитория = сайт GitHub Pages)
python3 -m http.server 8765          # локальный сервер из корня → http://localhost:8765/?debug=1
python3 tools/check_node.py          # быстрые проверки без браузера (~12 с, нужен Node.js) — после любой правки
python3 tools/check_all.py --quick   # сборка + Node-проверки + быстрые браузерные тесты
python3 tools/check_all.py           # всё: Node + браузерные тесты + аудит карты и комнат (перед публикацией)
python3 tools/balance.py 120         # баланс боёв → docs/BALANCE.md и docs/balance.csv (нужен Node, без браузера)
node tools/node/golden.js > /tmp/before.txt   # отпечатки отрисовки — снять ДО рефакторинга боя/сцен
python3 tools/render_chars.py /tmp/c.png naruto,sasuke   # посмотреть персонажей
python3 tools/audit_rooms.py --shots # посмотреть и проверить все комнаты
```

Если тесты пишут `ERR_CONNECTION_REFUSED` — сервер упал, перезапусти:
`setsid nohup python3 -m http.server 8765 >/dev/null 2>&1 < /dev/null &` (из корня).

## Правила

1. **Никогда не правь `index.html` и корневой `sw.js` руками** — это результат сборки. Правь `src/`, потом `python3 build.py`.
2. Всё в глобальном `G`. Новый файл → добавь в `JS_FILES` в `build.py` (порядок важен: при загрузке модуль видит только то, что выше).
3. Контент — это данные: персонажи `src/data/characters.js`, расписания `src/data/schedule.js`, задания `data/quests.js`,
   предметы `data/items.js`, бой `data/duel_data.js` (правила — `docs/COMBAT.md`, ядро `systems/duel.js`), диалоги — язык из `docs/SCRIPTS.md`. Рецепты — `docs/CONTENT_GUIDE.md`.
4. Координаты — логические пиксели, тайл 16. Холсты «подробные» (×2), рисовать в логических координатах.
5. Шрифт пиксельный (`gfx/font_data.js`, генерируется `tools/make_font.py`): символ, которого в нём нет, выводится как «?». Новый символ — в `make_font.py`, затем `python3 tools/make_font.py`.
   Интерфейс собирается из `G.ui` (`gfx/ui.js`): панели, кнопки, шкалы, заголовки — не рисуй рамки руками.
6. Новые поля сохранения — в `defaults()` в `systems/game.js` (старые сохранения дополнит `G.game.fix()`).
7. Проверяй себя глазами: скриншоты через Playwright (`tools/tlib.py`), а не только тесты.
   Комнаты — `audit_rooms.py`, карта — `render_map.py` (обе сообщают о проблемах кодом выхода).
   Если браузера нет — `python3 tools/check_node.py` покрывает сценарии, данные, мир, комнаты, шрифт, сцены, бой и сохранения.
8. После правок боя — `python3 tools/balance.py 120`; целевые окна побед — `tools/targets.json` (их же проверяет
   `tools/node/checks.js`), таблицы — в `docs/BALANCE.md` (файл генерируется, руками его не правь).
   Рефакторинг боя/сцен — только со снятыми отпечатками: `node tools/node/golden.js` до и после, `diff` пустой.
9. Перед коммитом: `python3 tools/check_all.py` зелёный (без Playwright — `--node`), запись в `docs/CHANGELOG.md`.
10. Полировка (вид, ощущение, мелочи) — по памятке `.claude/skills/polish/SKILL.md`: цикл «скриншот до → правка → проверки → скриншот после».
11. Публикация: работать в назначенной рабочей ветке, открыть PR в `main`; после merge дождаться успешного GitHub Pages. Не переключать/переименовывать ветку сессии.

## Карта кода (кратко)

- `src/engine/` — экран, ввод, звук, сцены, сохранения, отладка
- `src/gfx/` — палитра, шрифт (`font.js`+`font_data.js`), набор интерфейса (`ui.js`), спрайты, тайлы, отрисовка персонажей (`chars_render.js`)
- `src/systems/` — время, задания, навигация, жизнь (часы/погода), Академия и сюжет (`story.js`), уроки, дружба,
  тренировки, катсцены, расписания (`schedule.js`), симулятор баланса (`sim.js`)
- `src/world/` — генератор Конохи, интерьеры (`interiors.js`), жители (`village_*.js`, `cast.js`), крыши, эффекты
- `src/scenes/` — экраны: `world.js` (карта, NPC, камера), `battle.js` (экран боя «Дуэль»; фоны — `battle_bg.js`),
  `train.js` (мини-игры), меню, календарь и др.
- Подробно — `docs/ARCHITECTURE.md`.

## Документация редактора

Указатель: `docs/README.md`. Актуальные инструкции: `docs/MAP_EDITOR.md` и
`docs/EDITOR_ART_REGEN.md`; текущие задачи: `docs/TODO.md`. Генерация и подключение
всех 36 новых мастеров завершены. Полный прогон требует и `check_all.py`, и
отдельного последовательного запуска `tools/test_*.js` — см. `docs/TESTING.md`.
