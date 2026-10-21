#!/usr/bin/env python3
"""Планировщик Конохи: python3 tools/plan_konoha.py
Берёт размеры нарисованных зданий (tools/art_specs.json — их пишет tools/import_art.py) и шаблоны зданий (src/data/buildings.js),
раскладывает плотную деревню: скала Хокаге, река, озеро с островком, лес и пруд Нара, полигоны; центр с резиденцией и Академией,
торговые улицы, девять клановых кварталов (у каждого свои дома и характер), жилые ряды вплотную вдоль извилистых улиц.
Дома стоят фасадом (дверью) к улице; одна и та же картинка не повторяется рядом. К двери каждого дома проверяется проход
до дороги (те же правила, что у генератора карты в src/world/mapgen.js); дома без прохода выбрасываются.
Результат — src/data/konoha_layout.js (G.KONOHA_DRAFT, явный список зданий). Детерминирован (seed внутри)."""
import os, re, json, math, random, sys
from collections import deque
import heapq

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H, T = 160, 128, 16
SEED = 2027
rnd = random.Random(SEED)

# ───────────── размеры ─────────────
SPECS = {s['name']: s for s in json.load(open(os.path.join(ROOT, 'tools', 'art_specs.json'), encoding='utf-8'))}
BY_KIND = {}
for s in SPECS.values(): BY_KIND.setdefault(s['kind'], []).append(s['name'])
CLAN_ART = {}
for s in SPECS.values():
    if s['kind'] == 'clan': CLAN_ART.setdefault(s['clan'], []).append(s['name'])


def templates():
    src = open(os.path.join(ROOT, 'src', 'data', 'buildings.js'), encoding='utf-8').read()
    out = {}
    for m in re.finditer(r"^\s{2}(\w+):\s*\{([^\n]*)\}", src, re.M):
        b = m.group(2)
        w = re.search(r"\bw: (\d+)", b); h = re.search(r"\bh: (\d+)", b); d = re.search(r"door: \[(\d+), (\d+)\]", b)
        if w and h: out[m.group(1)] = dict(w=int(w.group(1)), h=int(h.group(1)), door=(int(d.group(1)), int(d.group(2))) if d else None)
    return out
TPL = templates()


def size_of(tpl, art=None):
    """(w, h, dx) пятна здания: у картинки свои размеры, у уникальных — тоже, остальное — из шаблона."""
    if art: s = SPECS[art]; return s['w'], s['h'], s['dx']
    if tpl in SPECS and SPECS[tpl]['kind'] == 'unique': s = SPECS[tpl]; return s['w'], s['h'], s['dx']
    t = TPL[tpl]; return t['w'], t['h'], (t['door'][0] if t['door'] else t['w'] // 2)


# ───────────── сетка ─────────────
cx, cy, ea, eb, ep = 80, 70, 79, 56, 3          # стена деревни — суперэллипс, как в генераторе
def inside(x, y, k=1.0): return (abs((x + 0.5 - cx) / (ea * k)) ** ep + abs((y + 0.5 - cy) / (eb * k)) ** ep) <= 1
GROUND, WATER, ROAD, BAD, KEEP = 0, 1, 2, 3, 4   # KEEP — земля без застройки: лес, парки, площади, полигоны
terr = [[GROUND if inside(x, y, 0.94) and y >= 17 else BAD for x in range(W)] for y in range(H)]
occ = [[0] * W for _ in range(H)]               # номер здания (>0) — клетка пятна
bld = []                                         # здания: dict(tpl, x, y, art?, name?)


def cr(a, b, c, d, t): return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)
def curve(pts, step=0.04):
    out = []
    for i in range(len(pts) - 1):
        a, b, c, d = pts[max(0, i - 1)], pts[i], pts[i + 1], pts[min(len(pts) - 1, i + 2)]
        t = 0.0
        while t < 1 - 1e-9:
            out.append((cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t))); t += step
    out.append(pts[-1]); return out


def in_rect(x, y, r): return r[0] <= x < r[0] + r[2] and r[1] <= y < r[1] + r[3]


# ───────────── районы (прямоугольники x, y, w, h) ─────────────
# Клановые кварталы: дома только из картинок клана; особняк — в «сердце» квартала.
CLANS = {   # id: (квартал, точка особняка, подпись)
    'sarutobi': ((40, 24, 22, 13), (46, 25), 'Сарутоби'),
    'senju':    ((96, 31, 30, 12), (104, 32), 'Сенджу'),
    'nara':     ((6, 36, 32, 22), (25, 37), 'Нара'),
    'hyuga':    ((5, 64, 30, 18), (12, 66), 'Хьюга'),
    'inuzuka':  ((22, 84, 26, 14), (30, 85), 'Инузука'),
    'aburame':  ((56, 100, 20, 14), (60, 102), 'Абураме'),
    'akimichi': ((98, 98, 24, 16), (104, 100), 'Акимичи'),
    'yamanaka': ((96, 44, 22, 13), (102, 45), 'Яманака'),
    'uchiha':   ((134, 26, 23, 70), (140, 50), 'Учиха'),
}
CLAN_RU = {k: v[2] for k, v in CLANS.items()}
MARKETS = [(54, 36, 40, 10), (58, 66, 18, 12), (118, 76, 15, 12)]        # торговая улица, рынок у перекрёстка, лавки у реки
OFFICIAL = (40, 15, 80, 20)                                                # центр: резиденция, Академия, библиотека, больница
PARKS = [(118, 58, 8, 7)]                                                  # сквер с сакурами у реки
FOREST = (4, 38, 15, 21)                                                   # лес Нара с оленями и прудом
TRAINING = [(19, 23, 10, 8), (39, 111, 8, 7), (50, 111, 8, 7)]           # полигон №3 и южные полигоны (ровно под пятно)
PLAZAS = [(60, 29, 16, 3), (76, 113, 8, 5)]              # площади перед резиденцией, Академией, воротами

def zone_of(x, y):
    for cid, (r, _, _) in CLANS.items():
        if in_rect(x, y, r): return 'clan:' + cid
    for r in MARKETS:
        if in_rect(x, y, r): return 'market'
    if in_rect(x, y, OFFICIAL): return 'official'
    return 'res'


# ───────────── вода ─────────────
RIVERS = [dict(w=4, pts=[(129, 25), (132, 32), (128, 42), (130, 54), (124, 66), (117, 78), (114, 90), (118, 100), (108, 108), (100, 117), (97, 127)])]
LAKES = [dict(cx=17, cy=107, rx=13, ry=9, isle=dict(cx=15, cy=106, rx=4, ry=3)), dict(cx=15, cy=50, rx=3, ry=2)]
for rv in RIVERS:
    r = rv['w'] / 2
    for sx, sy in curve(rv['pts']):
        for y in range(int(sy - r) - 1, int(sy + r) + 2):
            for x in range(int(sx - r) - 1, int(sx + r) + 2):
                if 0 <= x < W and 0 <= y < H and math.hypot(x + 0.5 - sx, y + 0.5 - sy) <= r and terr[y][x] != BAD: terr[y][x] = WATER
for lk in LAKES:
    for y in range(H):
        for x in range(W):
            if ((x + 0.5 - lk['cx']) / lk['rx']) ** 2 + ((y + 0.5 - lk['cy']) / lk['ry']) ** 2 <= 1 and terr[y][x] != BAD: terr[y][x] = WATER
    il = lk.get('isle')
    if il:
        for y in range(H):
            for x in range(W):
                if ((x + 0.5 - il['cx']) / il['rx']) ** 2 + ((y + 0.5 - il['cy']) / il['ry']) ** 2 <= 1 and terr[y][x] == WATER: terr[y][x] = BAD
# зелёные зоны без застройки
for r in PARKS + [FOREST] + TRAINING + PLAZAS:
    for y in range(r[1], r[1] + r[3]):
        for x in range(r[0], r[0] + r[2]):
            if 0 <= x < W and 0 <= y < H and terr[y][x] == GROUND: terr[y][x] = KEEP

# ───────────── дороги ─────────────
ROADS = [
    ('main', [(80, 126), (80, 116), (78, 104), (80, 90), (78, 76), (80, 62), (77, 48), (73, 38), (70, 31)]),           # ворота → резиденция
    ('main', [(6, 63), (24, 61), (44, 64), (62, 61), (80, 62), (100, 58), (117, 62), (136, 56), (155, 60)]),           # запад — восток
    # магистрали центра
    ('street', [(42, 34), (54, 35), (66, 34), (80, 35), (94, 34), (110, 31), (122, 28)]),
    ('street', [(30, 38), (40, 46), (52, 47), (66, 47), (80, 46), (94, 47), (106, 43), (118, 44), (126, 42)]),
    ('street', [(56, 22), (56, 30)]), ('street', [(92, 22), (94, 30)]),
    # восток за рекой: квартал Учиха
    ('street', [(136, 56), (140, 44), (144, 34), (148, 28)]), ('street', [(136, 56), (142, 68), (146, 80), (144, 92)]),
]
road_tiles = set()
for kind, pts in ROADS:
    w = {'main': 3, 'street': 2, 'path': 1}[kind]
    for sx, sy in curve(pts):
        x0, y0 = math.floor(sx - w / 2 + 0.5), math.floor(sy - w / 2 + 0.5)
        for y in range(y0, y0 + w):
            for x in range(x0, x0 + w):
                if 0 <= x < W and 0 <= y < H and terr[y][x] in (GROUND, WATER, KEEP): road_tiles.add((x, y))
MAJOR = set(road_tiles)                            # клетки проспектов и улиц (не переулков)
for x, y in road_tiles: terr[y][x] = ROAD          # на реке — мост (мост рисует генератор), для прохода это дорога


def road_dist():
    d = [[99] * W for _ in range(H)]; q = deque()
    for x, y in road_tiles: d[y][x] = 0; q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and d[ny][nx] > d[y][x] + 1: d[ny][nx] = d[y][x] + 1; q.append((nx, ny))
    return d
RD = road_dist()


spurs = []       # дороги-тропы, проложенные автоматически: список клеток (для data/konoha_layout.js)
def carve_spur(sx, sy, width=2):
    """Извилистая улица от клетки (sx, sy) к ближайшей дороге: поиск Дейкстры со случайной ценой клеток обходит здания и воду."""
    if terr[sy][sx] == ROAD: return False
    heap = [(0.0, sx, sy, None)]; prev = {}
    while heap:
        c, x, y, pr = heapq.heappop(heap)
        if (x, y) in prev: continue
        prev[(x, y)] = pr
        if terr[y][x] == ROAD and (x, y) != (sx, sy):
            path = []; k = (x, y)
            while k is not None: path.append(k); k = prev[k]
            tiles = set()
            for px, py in path:
                if terr[py][px] == ROAD: continue
                for ox in range(width):
                    for oy in range(width if width > 1 and ox == 0 else 1):
                        tx, ty = px + (ox if (px + py) % 2 == 0 else -ox), py + oy
                        if 0 <= tx < W and 0 <= ty < H and terr[ty][tx] in (GROUND, KEEP) and not occ[ty][tx]: tiles.add((tx, ty))
            for tx, ty in tiles: terr[ty][tx] = ROAD; road_tiles.add((tx, ty))
            spurs.append(sorted(tiles)); return True
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if not (0 <= nx < W and 0 <= ny < H) or (nx, ny) in prev: continue
            if terr[ny][nx] not in (GROUND, ROAD, KEEP) or occ[ny][nx]: continue
            if y + 1 < H and 0 <= ny + 1 < H and occ[ny + 1][nx] and terr[ny][nx] != ROAD: continue
            heapq.heappush(heap, (c + 1 + rnd.random() * 1.6 + (2 if terr[ny][nx] == KEEP else 0), nx, ny, (x, y)))
    return False


def refresh_rd():
    global RD
    RD = road_dist()


# ───────────── размещение ─────────────
def foot_free(x, y, w, h, keep_ok=False):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if not (0 <= xx < W and 0 <= yy < H) or occ[yy][xx]: return False
            t = terr[yy][xx]
            if t != GROUND and not (keep_ok and t == KEEP): return False
    return True


def air_ok(x, y, w, h, gap=2):
    """Над и под зданием на `gap` рядов нет других зданий: карнизы нижнего не закроют фасад верхнего."""
    for yy in list(range(y - gap, y)) + list(range(y + h, y + h + gap)):
        for xx in range(x, x + w):
            if 0 <= xx < W and 0 <= yy < H and occ[yy][xx]: return False
    return True


def front_ok(x, y, w, h, dx):
    fx, fy = x + dx, y + h
    return 0 <= fx < W and 0 <= fy < H and terr[fy][fx] in (GROUND, ROAD, KEEP) and not occ[fy][fx]


def fits(x, y, w, h, dx, maxrd=99, gap=2, keep_ok=False):
    if not (inside(x, y, 0.955) and inside(x + w - 1, y, 0.955) and inside(x, y + h, 0.955) and inside(x + w - 1, y + h, 0.955)): return False
    if not foot_free(x, y, w, h, keep_ok) or not air_ok(x, y, w, h, gap) or not front_ok(x, y, w, h, dx): return False
    return RD[min(H - 1, y + h)][x + dx] <= maxrd


def put(tpl, x, y, art=None, name=None):
    w, h, dx = size_of(tpl, art)
    b = dict(tpl=tpl, x=x, y=y)
    if art: b['art'] = art
    if name: b['name'] = name
    bld.append(b); n = len(bld)
    for yy in range(y, y + h):
        for xx in range(x, x + w): occ[yy][xx] = n
    return b


def near(tpl, ax, ay, art=None, maxr=20, maxrd=3, gap=2, keep_ok=False):
    """Ближайшее к (ax, ay) допустимое место для здания; None, если нет."""
    w, h, dx = size_of(tpl, art)
    for r in range(maxr):
        cand = []
        for y in range(ay - r, ay + r + 1):
            for x in range(ax - r, ax + r + 1):
                if max(abs(x - ax), abs(y - ay)) != r: continue
                if fits(x, y, w, h, dx, maxrd, gap, keep_ok): cand.append((x, y))
        if cand: return rnd.choice(cand)
    return None


def place_near(tpl, ax, ay, art=None, **kw):
    required = kw.pop('required', False)
    name = kw.pop('name', None)
    p = near(tpl, ax, ay, art, **kw)
    if not p and required:
        p = near(tpl, ax, ay, art, maxr=160, maxrd=99)
        if not p: raise RuntimeError('Не удалось разместить обязательное здание: ' + tpl)
        print('  далеко от места:', tpl, (ax, ay), '→', p)
    if not p: print('  нет места:', tpl, art or '', (ax, ay)); return None
    return put(tpl, p[0], p[1], art, name)


def spur_from_door(b):
    w, h, dx = size_of(b['tpl'], b.get('art'))
    if front_ok(b['x'], b['y'], w, h, dx): carve_spur(b['x'] + dx, b['y'] + h)


# --- ориентиры и ключевые здания (порядок = приоритет места) ---
KEY = [
    ('hokage_tower', 64, 17), ('academy', 42, 21), ('library', 82, 19), ('hospital', 100, 18), ('onsen', 112, 22),
    ('ichiraku', 66, 39), ('dango', 86, 39), ('books', 58, 38), ('weapons', 74, 39), ('souvenir', 92, 39),
    ('naruto_flat', 94, 61), ('market', 60, 68), ('teahouse', 120, 78), ('pharmacy', 96, 26), ('flowers', 104, 50), ('yakiniku', 112, 104),
    ('inuzuka_shop', 40, 86), ('hero_home', 86, 66),
]
for tpl, ax, ay in KEY:
    b = place_near(tpl, ax, ay, maxr=18, maxrd=8, required=True)
    spur_from_door(b)
refresh_rd()
# тренировки и ориентиры без дверей — на своих зелёных площадках
for tpl, ax, ay in (('training_3', 19, 23), ('training_ground', 39, 111), ('training_ground', 50, 111)):
    place_near(tpl, ax, ay, maxr=6, maxrd=99, gap=1, keep_ok=True)
for tpl, ax, ay in (('swing_tree', 52, 30), ('memorial', 40, 102), ('night_alley', 104, 75)):
    place_near(tpl, ax, ay, maxr=20, maxrd=99, gap=1, keep_ok=True)
# пристань — на берегу большого озера, водопад — у истока реки
pier = None
for x in range(24, 40):
    for y in range(100, 112):
        if terr[y][x] == GROUND and terr[y][x - 1] == WATER and all(terr[y + k][x] not in (BAD, WATER) for k in range(0, 3)):
            pier = (x - 1, y - 1); break
    if pier: break
if pier: bld.append(dict(tpl='pier', x=pier[0], y=pier[1]))
bld.append(dict(tpl='waterfall', x=127, y=22))
for yy in range(22, 25):
    for xx in range(127, 131): terr[yy][xx] = BAD
carve_spur(126, 25, 1)             # к камню у водопада должна вести тропа
bld.append(dict(tpl='hokage_rock', x=65, y=2))   # скала Хокаге — у верхнего края (генератор прижмёт к подножию утёса)
# ворота и посты стражи у южного въезда
gw, gh, gdx = size_of('gate'); gx, gy = 80 - gdx, 121
put('gate', gx, gy)
for tpl, art, ax in (('guard_post', 'guard_post01', 70), ('guard_post', 'guard_post02', 86)):
    put(tpl, ax, 118, art)
place_near('dojo', 64, 112, art='house13', maxr=16, maxrd=6)
# особняки кланов, потом сюжетные дома Учиха
manors = {}
for cid, (r, (ax, ay), ru) in CLANS.items():
    b = place_near('clan_' + cid, ax, ay, maxr=24, maxrd=10, required=True)
    manors[cid] = b; spur_from_door(b)
for tpl, ax, ay in (('sasuke_home', 146, 30), ('uchiha_police', 138, 60)):
    b = place_near(tpl, ax, ay, maxr=30, maxrd=10, required=True); spur_from_door(b)
refresh_rd()

# ───────────── застройка: дома фасадом к улице, вплотную, без повторов рядом ─────────────
GEN = BY_KIND['house']
POOLS = {
    'res': GEN + ['house02'],
    'market': BY_KIND['shop'] + ['house02', 'house05', 'house06', 'house09', 'house11', 'house17'],
    'official': ['house02', 'house08', 'house08_big', 'house10_big', 'house12'],
}
for cid in CLANS: POOLS['clan:' + cid] = CLAN_ART[cid] + (['house14'] if cid == 'uchiha' else [])
used = {}                          # картинка → сколько раз уже поставлена
placed_art = []                    # (центр x, центр y, картинка)
def family(a): return a.replace('_big', '')
def too_close(art, x, y, w, h, zone):
    """Та же картинка (или её большой/малый вариант) рядом — нельзя: улица не должна выглядеть копией."""
    R, RY = (5, 6) if zone.startswith('clan') else (9, 6)   # по горизонтали — через 2 дома, по вертикали — соседний ряд
    if SPECS[art]['h'] >= 6: R, RY = 40, 30                 # крупный дом — примета места, второй такой не рядом
    mx, my = x + w / 2, y + h / 2
    for px, py, pa in placed_art:
        if family(pa) == family(art) and abs(px - mx) < R and abs(py - my) < RY: return True
    return False

def kind_of(zone, art):
    if zone.startswith('clan:'):
        cid = zone[5:]
        return ('uchiha_small' if cid == 'uchiha' else 'house_s'), 'Дом клана ' + CLAN_RU[cid]
    k = SPECS[art]['kind']
    if k == 'shop': return 'shop_generic', None
    if k == 'office': return 'office', None
    return 'house_s', 'Жилой дом'

def try_build(x, y, zone, maxrd, gap=2, big_first=False):
    """Пробует поставить у (x, y) дом из набора района: сначала редкие картинки, потом частые."""
    arts = [a for a in POOLS[zone] if a in SPECS]
    rnd.shuffle(arts)
    arts.sort(key=lambda a: (used.get(a, 0) + rnd.random() * 1.5 - (2 if big_first and a.endswith('_big') else 0)))
    for art in arts:
        tpl, name = kind_of(zone, art)
        w, h, dx = size_of(tpl, art)
        if zone_of(x + dx, y + h - 1) != zone: continue
        if not fits(x, y, w, h, dx, maxrd, gap) or not roof_clear(x, y, w): continue
        if too_close(art, x, y, w, h, zone): continue
        put(tpl, x, y, art, name); used[art] = used.get(art, 0) + 1; placed_art.append((x + w / 2, y + h / 2, art))
        return w
    return 0

def roof_clear(x, y, w):
    """Крыша выступает над пятном до 27 px (меньше 2 клеток): над улицами и проспектами её быть не должно —
    там ходят люди и стоят фонари; над узким переулком — можно (так задворки и выглядят)."""
    for xx in range(x, x + w):
        for yy in (y - 1, y - 2):
            if 0 <= xx < W and 0 <= yy < H and (xx, yy) in MAJOR: return False
    return True


def frontage(skip=0.06):
    """Ряды вдоль улиц и переулков: курсор идёт по отрезку дороги слева направо, каждый дом встаёт вплотную
    к предыдущему, дверью на дорогу под ним. Картинку выбираем по разнообразию (реже встречавшиеся — первыми),
    через раз пробуем дом повыше; изредка оставляем просвет на клетку-две — дворик, колодец, проход."""
    n = 0
    rows = {}
    for x, y in road_tiles:
        if 0 < y < H and terr[y - 1][x] == GROUND and not occ[y - 1][x]: rows.setdefault(y, []).append(x)
    for ry in sorted(rows):
        xs = sorted(rows[ry]); runs, run = [], [xs[0]]
        for x in xs[1:]:
            if x == run[-1] + 1: run.append(x)
            else: runs.append(run); run = [x]
        runs.append(run)
        for run in runs:
            a, b = run[0], run[-1]
            cur = a - 3
            while cur <= b:
                placed = 0
                zone = zone_of(min(max(cur + 2, a), b), ry - 1)
                arts = [q for q in POOLS[zone] if q in SPECS]; rnd.shuffle(arts)
                tall = rnd.random() < 0.45
                arts.sort(key=lambda q: used.get(q, 0) + rnd.random() * 2 - (SPECS[q]['h'] * 1.5 if tall else 0))
                for art in arts:
                    tpl, name = kind_of(zone, art)
                    w, h, dx = size_of(tpl, art)
                    x, y = cur, ry - h
                    if not (a <= x + dx <= b) or (x + dx, ry) not in road_tiles: continue
                    if not fits(x, y, w, h, dx, 0, 2) or not roof_clear(x, y, w) or too_close(art, x, y, w, h, zone): continue
                    put(tpl, x, y, art, name); used[art] = used.get(art, 0) + 1; placed_art.append((x + w / 2, y + h / 2, art)); n += 1
                    placed = w
                    break
                cur += placed + (rnd.choice((1, 2)) if placed and rnd.random() < skip else 0) if placed else 1
    return n


grid = []        # клетки сетки: (тип, [клетки]) — улицы-лучи и переулки, для data/konoha_layout.js
def paintable(x, y, keep=True):
    return 0 <= x < W and 0 <= y < H and not occ[y][x] and (terr[y][x] == GROUND or (keep and terr[y][x] == KEEP)) and inside(x, y, 0.93)

VERT = set()     # клетки вертикальных улиц сетки (переулкам они не мешают, а служат выходом)
def make_grid():
    """Кварталы режутся сеткой: почти прямые вертикальные проулки (1 клетка, одна — улица в 2 клетки) через 26–34 клетки
    и горизонтальные переулки (1 клетка). Переулки идут в каждом отрезке между проулками снизу вверх: новый — там, где
    до дороги ниже набралось 4–7 рядов (ряд домов, ряд под крыши, переулок); изредка 9–11 — под большие дома.
    Так переулок повторяет изгиб улицы под ним. Сетка обходит здания, воду, парки, лес и площади."""
    xs, x = [], 8
    while x < W - 8:
        if abs(x - 79) > 7: xs.append(x)
        x += rnd.randint(26, 34)
    wide_x = xs[len(xs) // 2 - 1] if xs else None      # одна из вертикалей у центра — настоящая улица
    for bx in xs:
        tiles, vx = [], bx
        wide = bx == wide_x and abs(bx - 79) < 40
        for y in range(17, H - 3):
            if y % 13 == 0: vx = bx + rnd.choice((-1, 0, 0, 1))
            for xx in ((vx, vx + 1) if wide else (vx,)):
                if paintable(xx, y, keep=False): tiles.append((xx, y))
        for t in tiles: terr[t[1]][t[0]] = ROAD; road_tiles.add(t); VERT.add(t)
        grid.append(('path', tiles))
    bounds = [0] + [bx for bx in xs] + [W]
    free = lambda x, y: 0 <= x < W and 0 <= y < H and paintable(x, y, keep=False)
    def below(x, y):
        """Сколько рядов от (x, y) вниз до ближайшей дороги (кроме вертикальных улиц сетки) или препятствия."""
        for k in range(1, 14):
            yy = y + k
            if yy >= H: return k
            if terr[yy][x] == ROAD and (x, yy) not in VERT: return k
            if terr[yy][x] in (WATER, BAD, KEEP) or occ[yy][x]: return k + 3   # у воды и зданий ряд домов не нужен
        return 99
    for i in range(len(bounds) - 1):
        xa, xb = bounds[i] + 2, bounds[i + 1]
        p = rnd.choice((4, 5, 6, 6, 7))
        for y in range(H - 5, 19, -1):
            cells = [x for x in range(xa, xb) if free(x, y) and p <= below(x, y) <= p + 2 and all(free(x, y - k) for k in range(1, 5))]
            runs, run = [], []
            for x in range(xa - 2, xb + 2):
                if x in cells: run.append(x); continue
                if len(run) >= 4: runs.append(run)
                run = []
            if len(run) >= 4: runs.append(run)
            tiles = []
            for run in runs:          # концы тянем до ближайшей дороги (до 5 клеток), чтобы переулок не был тупиком
                r = [(x, y) for x in run]
                for step in (-1, 1):
                    xx, ext = (run[0] if step < 0 else run[-1]) + step, []
                    while len(ext) < 5 and free(xx, y): ext.append((xx, y)); xx += step
                    if (xx, y) in road_tiles: r = r + ext
                tiles += r
            if tiles:
                for t in tiles: terr[t[1]][t[0]] = ROAD; road_tiles.add(t)
                grid.append(('path', tiles)); p = rnd.choice((4, 5, 5, 6, 6, 6, 7, 9, 11))


def prune_roads():
    """Куски дорог, не связанные с главной улицей, — либо соединяем тропой, либо убираем."""
    def comp_of(seed):
        seen = {seed}; q = deque([seed])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + dx, y + dy)
                if n in road_tiles and n not in seen: seen.add(n); q.append(n)
        return seen
    main = comp_of(min(road_tiles, key=lambda t: abs(t[0] - 79) + abs(t[1] - 62)))
    dropped = 0
    for kind, tiles in grid:
        for t in list(tiles):
            if t in main or t not in road_tiles: continue
            c = comp_of(t)
            joined = False
            if len(c) >= 4:
                for q in c: terr[q[1]][q[0]] = BAD           # пока ищем выход, сам кусок — не дорога
                starts = sorted({(x + a, y + b) for x, y in c for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))
                                 if 0 <= x + a < W and 0 <= y + b < H and terr[y + b][x + a] in (GROUND, KEEP) and not occ[y + b][x + a]},
                                key=lambda p: RD[p[1]][p[0]])
                for sx, sy in starts[:3]:
                    if carve_spur(sx, sy, 1):
                        terr[sy][sx] = ROAD; road_tiles.add((sx, sy)); spurs[-1].append((sx, sy)); joined = True; break
                for q in c: terr[q[1]][q[0]] = ROAD
            if joined: main |= comp_of(t); continue
            for q in c:
                road_tiles.discard(q); terr[q[1]][q[0]] = GROUND; dropped += 1
    for i, (kind, tiles) in enumerate(grid): grid[i] = (kind, [t for t in tiles if t in road_tiles])
    return dropped

make_grid()
refresh_rd()
pruned = prune_roads()
refresh_rd()
nl = sum(1 for k, t in grid if k == 'path' and t)
nf = frontage()
nf += frontage(0.0)
nb = 0
for _ in range(60000):                         # добор: случайные места по всем остаткам земли (проход проверяется ниже)
    x, y = rnd.randint(6, W - 10), rnd.randint(17, H - 7)
    if terr[y][x] == GROUND and not occ[y][x] and try_build(x, y, zone_of(x, y), 12, 2): nb += 1
for y in range(17, H - 6):                     # доводка: оставшиеся просветы — дома с короткой дорожкой до улицы
    xs = list(range(6, W - 10)); rnd.shuffle(xs)
    for x in xs:
        z = zone_of(x, y)
        if try_build(x, y, z, 7, 2, big_first=True): nb += 1
# мелкие объекты дворов: колодцы в жилых кварталах, лотки на торговых улицах
wells = stalls = 0
for _ in range(4000):
    x, y = rnd.randint(8, W - 8), rnd.randint(20, H - 8)
    z = zone_of(x, y)
    if z == 'market' and stalls < 26 and terr[y][x] == GROUND and terr[y][x + 1] == GROUND and not occ[y][x] and not occ[y][x + 1] \
            and RD[y][x] == 1 and not occ[y + 1][x] and not occ[y - 1][x] and not occ[y - 1][x + 1]:
        put('stall', x, y); stalls += 1
    elif z == 'res' and wells < 16 and terr[y][x] == GROUND and not occ[y][x] and RD[y][x] <= 2 \
            and all(not occ[y + b][x + a] for a in (-1, 0, 1) for b in (-1, 0, 1)) and all(abs(b['x'] - x) + abs(b['y'] - y) > 14 for b in bld if b['tpl'] == 'well'):
        put('well', x, y); wells += 1


# ───────────── проход от двери до дороги (правила генератора) ─────────────
def walk(x, y):
    if not (0 <= x < W and 0 <= y < H): return False
    if terr[y][x] == ROAD: return True
    return terr[y][x] in (GROUND, KEEP) and not occ[y][x] and not (y + 1 < H and occ[y + 1][x])
def reach(b, maxlen=30):
    w, h, dx = size_of(b['tpl'], b.get('art'))
    sx, sy = b['x'] + dx, b['y'] + h
    if not walk(sx, sy): return False
    if terr[sy][sx] == ROAD: return True
    seen = {(sx, sy)}; front = [(sx, sy)]
    for _ in range(maxlen):
        nxt = []
        for x, y in front:
            for ax, ay in ((0, 1), (-1, 0), (1, 0), (0, -1)):
                n = (x + ax, y + ay)
                if n in seen or not walk(*n): continue
                if terr[n[1]][n[0]] == ROAD: return True
                seen.add(n); nxt.append(n)
        front = nxt
    return False
NO_DOOR = ('training_3', 'training_ground', 'memorial', 'swing_tree', 'night_alley', 'pier', 'waterfall', 'hokage_rock', 'gate', 'well', 'stall')
NEEDS_DOOR = lambda b: b['tpl'] not in NO_DOOR
SOFT = ('house_s', 'uchiha_small', 'shop_generic', 'office', 'well', 'stall')
removed = 0
def renumber():
    global bld, occ
    bld = [b for b in bld if b]; occ = [[0] * W for _ in range(H)]
    for n, b in enumerate(bld, 1):
        if b['tpl'] in ('pier', 'waterfall', 'hokage_rock'): continue
        w, h, dx = size_of(b['tpl'], b.get('art'))
        for yy in range(b['y'], b['y'] + h):
            for xx in range(b['x'], b['x'] + w): occ[yy][xx] = n
while True:
    bad = [b for b in bld if NEEDS_DOOR(b) and not reach(b)]
    soft = [b for b in bad if b['tpl'] in SOFT]
    if not soft: break
    saved = []
    for b in soft:                 # сначала пробуем провести к двери тропу — дом в кармане лучше, чем пустырь
        if b['tpl'] in ('well', 'stall'): continue
        w, h, dx = size_of(b['tpl'], b.get('art'))
        if front_ok(b['x'], b['y'], w, h, dx) and carve_spur(b['x'] + dx, b['y'] + h, 1) and reach(b): saved.append(b)
    soft = [b for b in soft if b not in saved]
    if not soft: continue
    for b in soft: bld[bld.index(b)] = None; removed += 1
    renumber()
hard = [b for b in bld if NEEDS_DOOR(b) and not reach(b)]
if hard: print('  без прохода (ключевые):', [(b['tpl'], b['x'], b['y']) for b in hard])
if hard and not os.environ.get('PLAN_LOOSE'): raise RuntimeError('Обязательные здания должны иметь проход к дороге')
homes = sum(1 for b in bld if b['tpl'] in ('house_s', 'uchiha_small', 'shop_generic', 'office'))
print('переулков %d, рядовых домов %d (вдоль улиц %d, во дворах %d), колодцев %d, лотков %d, выброшено без прохода %d, всего зданий %d'
      % (nl, homes, nf, nb, wells, stalls, removed, len(bld)))

# ───────────── районы ─────────────
# порядок важен: следующий район перекрывает предыдущие (жилая Коноха → кварталы кланов → центр и рынки → зелень)
def bbox(pred, pad=2):
    xs, ys, xe, ye = [], [], [], []
    for b in bld:
        if pred(b):
            w, h, _ = size_of(b['tpl'], b.get('art')); xs.append(b['x']); ys.append(b['y']); xe.append(b['x'] + w); ye.append(b['y'] + h)
    return (max(2, min(xs) - pad), max(15, min(ys) - pad), min(W - 2, max(xe) + pad) - max(2, min(xs) - pad), min(H - 1, max(ye) + pad) - max(15, min(ys) - pad))
def rect(r): return dict(x=r[0], y=r[1], w=r[2], h=r[3])
districts = [dict(type='cliff', x=0, y=0, w=160, h=14, label='Скала Хокаге'),
             dict(type='residential', x=3, y=15, w=154, h=110, label='Коноха')]
for cid, (r, _, ru) in CLANS.items():
    own = lambda b, cid=cid: b['tpl'] == 'clan_' + cid or b.get('name') == 'Дом клана ' + CLAN_RU[cid] or (cid == 'uchiha' and b['tpl'] in ('sasuke_home', 'uchiha_police'))
    bx = bbox(own, 1)
    if cid == 'uchiha': districts.append(dict(type='uchiha', label='Квартал Учиха', **rect(bx)))
    else: districts.append(dict(type='clan', label='Квартал ' + ru, fence=cid in ('hyuga', 'senju', 'aburame'), **rect(bx)))
districts.append(dict(type='official', label='Центр', **rect(OFFICIAL)))
for i, r in enumerate(MARKETS): districts.append(dict(type='market', label=['Торговая улица', 'Рынок', 'Лавки у реки'][i], **rect(r)))
districts.append(dict(type='forest', label='Лес Нара', **rect(FOREST)))
for r in PARKS: districts.append(dict(type='park', label='Сквер', **rect(r)))
for b in bld:
    if b['tpl'] in ('training_3', 'training_ground'):
        w, h, _ = size_of(b['tpl']); districts.append(dict(type='training', x=b['x'], y=b['y'], w=w, h=h, label='Полигон'))

# ───────────── опорные точки для жителей и объектов ─────────────
def road_pt(ax, ay):
    best = None
    for x, y in road_tiles:
        if terr[y][x] == ROAD and not occ[y][x]:
            d = abs(x - ax) + abs(y - ay)
            if best is None or d < best[0]: best = (d, x, y)
    return [best[1], best[2]]
start = road_pt(78, 50); cross = road_pt(79, 62)
refresh_rd()
free_pts = [(x, y) for y in range(17, H - 4) for x in range(4, W - 4) if terr[y][x] in (GROUND, KEEP) and not occ[y][x]
            and not occ[y + 1][x] and inside(x, y, 0.9) and RD[y][x] <= 9]
def pick(ax, ay, rmin=0, avoid=None, ar=0):
    c = [p for p in free_pts if abs(p[0] - ax) + abs(p[1] - ay) <= 14 and math.hypot(p[0] - ax, p[1] - ay) >= rmin and not (avoid and math.hypot(p[0] - avoid[0], p[1] - avoid[1]) < ar)]
    c.sort(key=lambda p: abs(p[0] - ax) + abs(p[1] - ay))
    return list(rnd.choice(c[:6])) if c else [ax, ay]
herbs = []
for _ in range(16):
    for t in range(800):
        p = rnd.choice(free_pts)
        edge = min(abs(p[0] - cx) / ea, 1) ** 3 + min(abs(p[1] - cy) / eb, 1) ** 3
        if edge > 0.5 and all(math.hypot(p[0] - q[0], p[1] - q[1]) > 14 for q in herbs): herbs.append(list(p)); break
lotus = []
for lk in LAKES[:1]:
    for _ in range(300):
        a = rnd.random() * 6.28; p = [int(lk['cx'] + math.cos(a) * (lk['rx'] + 2)), int(lk['cy'] + math.sin(a) * (lk['ry'] + 2))]
        if 0 <= p[0] < W and 0 <= p[1] < H and terr[p[1]][p[0]] in (GROUND, KEEP) and not occ[p[1]][p[0]]: lotus.append(p)
        if len(lotus) >= 3: break
anch = dict(
    choji=pick(106, 96), kiba=pick(34, 98), shino=pick(64, 98), lee=pick(42, 108), guy=pick(46, 108), mizuki=pick(50, 32), thief=pick(104, 79),
    board=pick(64, 31), run=pick(78, 52), falls=pick(122, 26, 0, (126, 25), 8), water=pick(32, 104), stealth=pick(14, 44), herbs=herbs, lotus=lotus,
)
signs = [
    pick(80, 58) + [['▲ Академия, резиденция Хокаге, Скала Хокаге', '< Кварталы Нара, Хьюга, Инузука   За рекой — квартал Учиха >', '▼ Жилые кварталы, полигоны, главные ворота']],
    pick(90, 72) + [['Жилой квартал. Дом героя — рядом, у реки.', 'Мимо квартиры Наруто ночью лучше не шуметь.']],
    pick(78, 110) + [['Главные ворота Конохи. Посты стражи: Изумо и Котецу.']],
    pick(22, 44) + [['Лес и пруд клана Нара. Без разрешения не входить. Не кормить оленей!']],
    pick(134, 56) + [['Квартал Учиха. После трагедии здесь живёт только Саске.']],
    pick(68, 44) + [['Торговая улица: рамен, данго, книги, оружие и сувениры.']],
    pick(118, 88) + [['Лавки у реки. Чайная открыта до поздней ночи.']],
]

# ───────────── запись ─────────────
def js(o):
    return json.dumps(o, ensure_ascii=False, separators=(',', ': '))
out = ['// Раскладка Конохи — СГЕНЕРИРОВАНО tools/plan_konoha.py (seed %d) из размеров картинок и шаблонов; руками не править.' % SEED,
       '// Чтобы поменять деревню, правь tools/plan_konoha.py (районы, дороги, реки, ключевые здания) и запусти его заново.',
       '// explicit: true — здания заданы списком (генератор не застраивает кварталы сам); art — имя нарисованной картинки (gfx/house_art.js).',
       'G.KONOHA_DRAFT = {', '  version: 3, explicit: true,', '  size: { w: %d, h: %d },' % (W, H),
       '  shape: { cx: %d, cy: %d, a: %d, b: %d, p: %d, wall: 2.4, rings: [], lakes: %s },' % (cx, cy, ea, eb, ep, js([{k: v for k, v in lk.items()} for lk in LAKES])),
       '  rivers: %s,' % js(RIVERS), '  roads: [']
for kind, pts in ROADS: out.append('    { type: %s, pts: %s },' % (js(kind), js([list(p) for p in pts])))
for kind, tl in grid:
    if tl: out.append('    { type: %s, tiles: %s },' % (js(kind), js([list(t) for t in tl])))
for tl in spurs: out.append('    { type: "path", tiles: %s },' % js([list(t) for t in tl]))
out += ['  ],', '  districts: [']
for d in districts: out.append('    ' + js(d) + ',')
out += ['  ],', '  start: %s, cross: %s,' % (js(start), js(cross)), '  anchors: %s,' % js(anch), '  signs: %s,' % js(signs), '  buildings: [']
for b in bld: out.append('    ' + js(b) + ',')
out += ['  ],', '};', '']
open(os.path.join(ROOT, 'src', 'data', 'konoha_layout.js'), 'w', encoding='utf-8').write('\n'.join(out))
kinds = {}
for b in bld: kinds[b['tpl']] = kinds.get(b['tpl'], 0) + 1
print({k: v for k, v in sorted(kinds.items(), key=lambda kv: -kv[1])[:12]})
print('картинок использовано:', len(used), ' чаще всего:', sorted(used.items(), key=lambda kv: -kv[1])[:6])

# картинка схемы для просмотра
try:
    from PIL import Image, ImageDraw
    S = 7; im = Image.new('RGB', (W * S, H * S), '#4f7f3f'); d = ImageDraw.Draw(im)
    col = {GROUND: '#9bbf72', WATER: '#6aaae0', ROAD: '#e8d6a4', BAD: '#3d6a34', KEEP: '#7fae5a'}
    for y in range(H):
        for x in range(W): d.rectangle([x * S, y * S, x * S + S - 1, y * S + S - 1], fill=col[terr[y][x]])
    for g in range(0, max(W, H), 10):
        d.line([(g * S, 0), (g * S, H * S)], fill='#5a8a4a'); d.line([(0, g * S), (W * S, g * S)], fill='#5a8a4a')
    for b in bld:
        if b['tpl'] in ('pier', 'waterfall', 'hokage_rock'): continue
        w, h, dx = size_of(b['tpl'], b.get('art')); k = SPECS.get(b.get('art') or b['tpl'], {}).get('kind', '')
        c = {'unique': '#d8803a', 'clan': '#b070c0', 'shop': '#d84a3a', 'guard': '#808080'}.get(k, '#b87a4a')
        d.rectangle([b['x'] * S, b['y'] * S, (b['x'] + w) * S - 1, (b['y'] + h) * S - 1], fill=c, outline='#2a1a0a')
        d.rectangle([(b['x'] + dx) * S + 1, (b['y'] + h) * S - 3, (b['x'] + dx + 1) * S - 2, (b['y'] + h) * S - 1], fill='#fff')
    os.makedirs(os.path.join(ROOT, 'tools', 'shots'), exist_ok=True)
    im.save(os.path.join(ROOT, 'tools', 'shots', 'konoha_plan.png'))
except Exception as e: print('схема не нарисована:', e)
