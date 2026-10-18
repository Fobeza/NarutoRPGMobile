# Правила для ИИ-помощника

Проект: фанатская пиксельная RPG «Naruto RPG — Воля Огня», браузер, ориентирована на iPhone (портрет).
Владелец общается по-русски; отвечай по-русски, кратко, с результатом. Код и комментарии в коде — тоже по-русски.

## Команды

```bash
python3 build.py                     # src/ → index.html + sw.js (корень репозитория = сайт GitHub Pages)
python3 -m http.server 8765          # локальный сервер из корня → http://localhost:8765/?debug=1
python3 tools/check_all.py --quick   # сборка + быстрые тесты
python3 tools/check_all.py           # все тесты + аудит карты и комнат (перед публикацией)
python3 tools/balance.py 20          # баланс боёв → docs/BALANCE.md (после правок боя/врагов)
python3 tools/render_chars.py /tmp/c.png naruto,sasuke   # посмотреть персонажей
python3 tools/audit_rooms.py --shots # посмотреть и проверить все комнаты
```

Если тесты пишут `ERR_CONNECTION_REFUSED` — сервер упал, перезапусти:
`setsid nohup python3 -m http.server 8765 >/dev/null 2>&1 < /dev/null &` (из корня).

## Правила

1. **Никогда не правь `index.html` и корневой `sw.js` руками** — это результат сборки. Правь `src/`, потом `python3 build.py`.
2. Всё в глобальном `G`. Новый файл → добавь в `JS_FILES` в `build.py` (порядок важен: при загрузке модуль видит только то, что выше).
3. Контент — это данные: персонажи `src/data/characters.js`, расписания `src/data/schedule.js`, задания `data/quests.js`,
   предметы `data/items.js`, бой `data/combat.js`, диалоги — язык из `docs/SCRIPTS.md`. Рецепты — `docs/CONTENT_GUIDE.md`.
4. Координаты — логические пиксели, тайл 16. Холсты «подробные» (×2), рисовать в логических координатах.
5. Шрифт пиксельный: символ, которого нет в `gfx/font.js` (`RAW`), выводится как «?». Добавляй глифы, если нужен новый значок.
6. Новые поля сохранения — в `defaults()` в `systems/game.js` (старые сохранения дополнит `G.game.fix()`).
7. Проверяй себя глазами: скриншоты через Playwright (`tools/tlib.py`), а не только тесты.
   Комнаты — `audit_rooms.py`, карта — `render_map.py` (`unreachableDoors`/`unreachableTalk` пустые).
8. После правок боя — `tools/balance.py`; целевые окна побед указаны в `docs/BALANCE.md`.
9. Перед коммитом: `python3 tools/check_all.py` зелёный, запись в `docs/CHANGELOG.md`.
10. Публикация: `git push` в `main` — GitHub Pages обновится сам за 1–2 минуты.

## Карта кода (кратко)

- `src/engine/` — экран, ввод, звук, сцены, сохранения, отладка
- `src/gfx/` — палитра, шрифт, спрайты, тайлы, отрисовка персонажей (`chars_render.js`)
- `src/systems/` — время, задания, навигация, жизнь (часы/погода), Академия и сюжет (`story.js`), уроки, дружба,
  тренировки, катсцены, расписания (`schedule.js`), симулятор баланса (`sim.js`)
- `src/world/` — генератор Конохи, интерьеры (`interiors.js`), жители (`village_*.js`, `cast.js`), крыши, эффекты
- `src/scenes/` — экраны: `world.js` (карта, NPC, камера), `battle.js`, `train.js` (мини-игры), меню, календарь и др.
- Подробно — `docs/ARCHITECTURE.md`.
