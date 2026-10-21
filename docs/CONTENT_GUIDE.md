# Как добавлять и менять контент — рецепты

После любой правки: `python3 build.py` → открыть игру (`python3 -m http.server 8765`, http://localhost:8765/?debug=1)
→ `python3 tools/check_all.py --quick`. В режиме отладки тап по карте телепортирует героя, в МЕНЮ появляются «Читы».

Оглавление: [Персонаж](#1-новый-персонаж-внешность) · [Житель на улице](#2-житель-на-улице-с-расписанием) ·
[Реплики и диалог](#3-реплики-и-диалог) · [Задание](#4-задание) · [Предмет и магазин](#5-предмет-и-магазин) ·
[Враг и бой](#6-враг-и-бой) · [Техника](#7-техника-ниндзюцу) · [Тренировка / подработка](#8-тренировка-и-подработка) ·
[Сюжетное событие](#9-сюжетное-событие-по-дню) · [Катсцена](#10-катсцена) · [Комната](#11-комната-интерьер) ·
[Здание на карте](#12-здание-на-карте) · [Календарь](#13-календарь-праздники-дни-рождения) · [Друг](#14-друг-дружба-подарки) ·
[Урок Академии](#15-урок-академии) · [Мелочи](#16-частые-мелкие-правки)

---

## 1. Новый персонаж (внешность)

Файл **`src/data/characters.js`**.

```js
def('tenten', 'Тентен', 'buns', { h: '#6a3a1e', H: '#8a5a36', t: '#e87a9a', T: '#b85674',
  a: '#f0e8d0', p: '#4a6a4a', P: '#34503a', f: '#3a2a1a', e: '#6a3a1e' });
```

- `def(id, имя, причёска, цвета, доп)` — `id` латиницей, им персонаж будет называться везде (диалоги, задания, бой).
- Цвета: `h/H` волосы и блик, `t/T` верх и тень, `a` акцент (пояс, отделка), `p/P` низ, `f` обувь, `e` глаза,
  `b/B` металл/ткань протектора. В `доп` — `{ band: true }` (протектор на лбу), `{ skin: ['#кожа', '#тень'] }`.
- Причёски: `short spiky duck long pony bob bowl ino bun buns lowpony sage bald`.

Одежда и детали — в том же файле, в `G.chars.STY`:

```js
tenten: { top: 'plain', sleeve: 'short', ex: ['blush'], hair: 'buns' },
```

- `top`: `plain | jacket | vest | dress | robe | apron`; `sleeve`: `long | short | mesh`.
- `ex` — детали (полный список в шапке файла): `goggles`, `shades`, `mask`, `band`, `scar`, `whiskers`, `brows`, `beard`,
  `stache`, `glasses`, `hood`, `fang`, `skirt`, `cap`, `scarf`, `satchel`, `lines`, `senbon`, …
- Особые: `body: 'fat'`, `kid: 1`, `eye: 'pale'` (глаза Хьюга), `cat: 1` / `dog: 1` (животное).

Посмотреть результат: `python3 tools/render_chars.py /tmp/x.png tenten,neji` — лист спрайтов и портрет.
Новая деталь одежды: добавь `if (ex.has('моя_деталь'))` в нужную функцию `gfx/chars_render.js` (`drawTop`, `drawFaceFront`,
`drawFaceSide`, `drawHeadwear`) — формы задаются `E` (эллипс), `R`/`RR` (прямоугольник/скруглённый), `PO` (многоугольник).

## 2. Житель на улице с расписанием

1. Внешность — п.1.
2. **Расписание** — `src/data/schedule.js`:

```js
tenten: { since: 1, rows: [
  ['wd', 14, 17, 'Выбирает оружие в лавке', 'weapons', 2, 5],          // будни 14–17 у оружейной
  ['we',  9, 12, 'Тренирует метание на полигоне', 'training_ground', 4, 8],
] },
```

Строка: `[дни, с_часа, до_часа, текст для календаря, шаблон_здания, dx, dy]`; дни — `wd` будни, `we` выходные, `all`.
Шаблон — ключ из `data/buildings.js`; `dx, dy` — клетка относительно левого-верхнего угла здания (ближайшая свободная
найдётся сама). Строка без шаблона — персонаж «внутри» (только текст в календаре). `'@'` вместо шаблона — исходное место.
`since` — с какого дня персонаж существует в мире.

3. **Чтобы появился на улице** — добавь его реплики в `LINES` в `src/world/cast.js` (первая реплика — знакомство).
   Расстановка и переходы между местами сделаются сами.

## 3. Реплики и диалог

- Короткие случайные реплики нового жителя — `LINES` в `world/cast.js`; массовка — `world/village_life.js`.
- Полноценный диалог — сценарий на языке из **[SCRIPTS.md](SCRIPTS.md)**. Где писать: `data/dialogs.js` (персонажи),
  `data/story_dialogs.js` и `data/story_scenes.js` (сюжет). Внутри файла — строка-шаблон, которая уходит в `G.script.parse`.
- Привязать диалог к NPC: поле `talk: 'id_сценария'` при создании (`world/world.js`, `village_extra.js`, интерьеры).
- Друзьям (Наруто, Саске и др.) реплики по уровню дружбы — `G.FRIEND_LINES` в `systems/friends.js`.

## 4. Задание

`src/data/quests.js`, формат описан в шапке файла:

```js
my_quest: {
  cat: 'errand', title: 'Потерянный кунай', desc: 'Тентен потеряла любимый кунай у пристани.',
  offer: { npc: 'tenten', script: 'tenten_offer', when: () => G.state.vars.day >= 5 },   // над NPC появится «!»
  steps: [
    { id: 'find', text: 'Найти кунай у пристани', target: { tile: [24, 110], label: 'Пристань' } },
    { id: 'back', text: 'Вернуть Тентен', target: { npc: 'tenten' }, script: 'tenten_done' },
  ],
  deadline: 3,
  reward: { money: 60, vars: { friend_tenten: 1 }, text: 'Тентен довольна' },
},
```

Категории: `story` 🔥, `academy` 📘, `errand` 📜, `friend` 🍃, `secret` ❓. В сценариях: `call quest start my_quest`,
`call step my_quest find` (завершить шаг), `if quest.my_quest.back -> …`, `if qdone.my_quest -> …`.
Шаг `visit: 'шаблон'` + `target: { building: 'шаблон' }` засчитывается, когда герой подходит к зданию.

## 5. Предмет и магазин

`src/data/items.js`: `G.ITEMS.id = { name, price, cat, effect?, desc }`.
`cat`: `food` (съедается при покупке, `effect: { food, energy, mood, hp, minutes }`), `tool`/`med` (подсумок, `pouch: true`),
`gift`, `book`, `misc`. Продаётся — добавь `id` в `stock` нужной лавки в `G.SHOPS`. Выдать из сценария: `call give id 2`,
забрать: `call take id 1`, проверить: `if has.id.2 -> …`.

## 6. Враг и бой

`src/data/combat.js` → `G.ENEMIES`:

```js
tenten: { name: 'Тентен', spr: 'tenten', hp: 110, ch: 50, tai: 6, nin: 4, gen: 2, spd: 8, end: 5, know: 5,
          focus: 2, pref: 3, acts: ['kunai', 'shuriken', 'blades', 'strike'], traits: ['smart'] },
```

- `spr` — id персонажа для спрайта и портрета. `pref` — любимая дистанция (1 — вплотную, 3 — издалека).
- `acts` — приёмы из `G.EACTS` (там же можно добавить свой: `range`, `w` вес, `kind`, `dmg`, `hits`).
- `traits`: `smart` (читает героя), `impulsive`, `defensive`, `kawarimi`, `deceive`, `climb`, `clones`, `lazy`.
- Начать бой из сценария: `call battle tenten spar field win_script lose_script`. Режимы: `ko spar bells scroll survive ringout`.
  Арены — `G.ARENAS`: `yard field forest night river street ring`.
- После правок проверь баланс: `python3 tools/balance.py 20` → `docs/BALANCE.md`. Чтобы бой попал в симулятор,
  добавь сценарий в `SCEN` в `systems/sim.js`.

## 7. Техника (ниндзюцу)

`G.TECHS` в `data/combat.js`: `{ name, seals: _S([...печати]), ch: цена_чакры, w: вес_хода, el?: 'fire'|'water'|'bolt'|'wind', desc }`
и id в `G.TECH_ORDER` (порядок в меню). Логика эффекта — в `doTech` в `scenes/battle.js` (стихийные работают сами по `el`).
Научить: `set flag.tech_<id> = 1` в сценарии (так учат Асума и Какаши в `data/story_scenes.js`).

## 8. Тренировка и подработка

- Тренировка — `G.TRAININGS` (`systems/train.js`): `{ name, mg, stats: {стат: опыт}, energy, minutes, place, pay? }`.
  `mg` — вид мини-игры из `scenes/train.js` (`throw log meditate tree seals run quiz cook shogi cat sort`).
  Запуск из сценария: `call train <id> [друг]`. Новая мини-игра — новая ветка `kind === '...'` в `init/update/draw` `scenes/train.js`
  и подсказка в `INTRO`.
- Подработка с доски — `G.JOBS` (`systems/story.js`): `{ name, pay, mg, min, energy, xp, text }`.
- Курьерские поручения — задания `courier_*` в `world/village_life.js`.

## 9. Сюжетное событие по дню

`G.STORY` (`systems/story.js`, а новые — `G.STORY.push(...)` в `data/story_scenes.js`):

```js
{ id: 'tenten_meet', day: 11, from: 14 * 60, to: 19 * 60, where: 'out', script: 'st_tenten_meet' },
```

`where`: `out` (на улице), `any`, `class`; `must: true` — нельзя пропустить; `place` — где (для подсказки);
`after: 'id'` — только после другого события. Сыгранное событие ставит флаг `st_<id>`.
Чтобы событие было в календаре — допиши название в `STORY_NAMES` в `scenes/calendar.js`.

## 10. Катсцена

`data/story_scenes.js`: `G.cine.defs.cine_tenten = (world) => [ шаги ]`, и в `G.STORY` укажи `script: 'cine_tenten'`.
Шаги: `{ spawn: 'k', id: 'tenten', at: [dx, dy], dir }`, `{ walk: 'k', to: [dx, dy], speed, par: true }`,
`{ say: 'script_id' }`, `{ wait: 1 }`, `{ emote: 'k', ch: '!' }`, `{ face: 'k', dir }`, `{ cam: 'k' | 'player' }`,
`{ hero: 'left' }`, `{ flag: 'name' }`. Позиции — в клетках относительно героя.

## 11. Комната (интерьер)

`world/interiors.js`, словарь `KINDS`. Вид комнаты — функция:

```js
my_room(info) {
  const m = room(info.id, info.name, 10, 8, G.tiles.ID.TATAMI, { exitX: 5 });  // ширина, высота, пол, где выход
  put(m, 'table', 4, 5, null, 16);           // предмет в клетку (4,5); последний аргумент — сдвиг по x в пикселях
  onWall(m, 'scroll', 3, { talk: ['Свиток с гербом.'] });   // на стену над колонкой 3
  npc(m, 'villager_f', 6, 4, 'down', ['Привет!']);
  return m;
},
```

Предметы — `gfx/tiles.js` (`obj('имя', ...)`). После функции `decorate()` сама добавит уюта, не налезая на мебель.
Привязка вида к зданию — `interiorKind()` в `world/mapgen.js`. **Проверка**: `python3 tools/audit_rooms.py --shots`
(скриншоты — в `tools/shots/rooms/`): нет ли наложений, недоступных NPC и предметов.

## 12. Здание на карте

Шаблон — `data/buildings.js` (`name, w, h, cat, door: [dx, dy], ...`), рисунок — `world/buildgfx.js`.
Где стоит — `data/konoha_layout.js` (генерируется): правь `tools/plan_konoha.py` (список `KEY` — ключевые здания и их
примерные места, `CLANS` — кварталы кланов и места особняков, `MARKETS`/`OFFICIAL`/`PARKS`/`FOREST`/`TRAINING`/`PLAZAS` —
районы, `POOLS` — какие картинки домов где ставить, `ROADS` — проспекты, `RIVERS`/`LAKES` — вода) и запусти его.
Рядовые дома ставятся сами: сетка улиц и переулков (`make_grid`), ряды домов дверью к дороге (`frontage`), добор во дворах.
`PLAN_LOOSE=1` — дорисовать схему `tools/shots/konoha_plan.png`, даже если ключевому зданию не хватило прохода.
Новая картинка здания — в `art/` + строка в `tools/art_catalog.json`, затем `python3 tools/import_art.py`.
Проверка: `python3 tools/render_map.py /tmp/map.png` — `unreachableDoors` и `unreachableTalk` должны быть пустыми.

## 13. Календарь, праздники, дни рождения

`G.calendar` в `systems/story.js`: `EVENTS: { день: 'название' }`, `BDAY: { день: 'id' }` (в день рождения подарки ×2).
Экран календаря — `scenes/calendar.js` (вкладки «Дни» и «Расписание»).

## 14. Друг (дружба, подарки)

`G.FRIENDS` (`systems/friends.js`): `{ team, love: [...], like: [...], hate: [...], spar: 'враг', train: 'тренировка' }` +
реплики по уровням в `G.FRIEND_LINES`. Персонаж из `G.FRIENDS` получает меню друга (поговорить, подарить, тренироваться, спарринг).

## 15. Урок Академии

Расписание предметов по дням недели и особые уроки — `G.academy.plan(day)` в `systems/story.js` (словарь `special` — особые уроки по дням).
Содержание (лекции, вопросы классу, тесты) — `systems/lessons.js`: `TOPICS[предмет]` и `TEST`.

## 16. Частые мелкие правки

| Хочу… | Где |
|---|---|
| поменять цену / эффект еды | `data/items.js` |
| сделать врага слабее/сильнее | `G.ENEMIES` в `data/combat.js`, потом `tools/balance.py` |
| поменять скорость времени | `RATE` в `systems/life.js` |
| стартовые деньги, вместимость подсумка | `START_MONEY`, `POUCH` в `systems/game.js` |
| текст в меню | `scenes/menu.js` |
| подсказку в мини-игре | `INTRO` в `scenes/train.js` |
| погоду | `G.life.weather()` в `systems/life.js` |
| новый символ в шрифте | `tools/make_font.py` (`used_chars()` или `ICONS`), затем `python3 tools/make_font.py` |
