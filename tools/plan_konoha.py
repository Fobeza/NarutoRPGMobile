#!/usr/bin/env python3
"""Планировщик Конохи: python3 tools/plan_konoha.py
Берёт размеры нарисованных зданий (tools/art_specs.json — их пишет tools/import_art.py) и шаблоны зданий (src/data/buildings.js),
раскладывает деревню: река, озеро с островком, пруд, извилистые дороги, кварталы кланов, лавки по всем районам, дома вдоль улиц.
К двери каждого дома проверяется проход до дороги (те же правила, что у генератора карты в src/world/mapgen.js); дома без прохода
выбрасываются. Результат — src/data/konoha_layout.js (G.KONOHA_DRAFT, явный список зданий). Детерминирован (seed внутри)."""
import os, re, json, math, random, sys
from collections import deque

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H, T = 160, 128, 16
SEED = 2026
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
GROUND, WATER, ROAD, BAD = 0, 1, 2, 3
terr = [[GROUND if inside(x, y, 0.94) and y >= 17 else BAD for x in range(W)] for y in range(H)]
occ = [[0] * W for _ in range(H)]               # номер здания (>0) — клетка пятна
bld = []                                         # здания: dict(tpl, x, y, art?, name?)
BIG_W = ('hokage_rock',)


def cr(a, b, c, d, t): return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)
def curve(pts, step=0.04):
    out = []
    for i in range(len(pts) - 1):
        a, b, c, d = pts[max(0, i - 1)], pts[i], pts[i + 1], pts[min(len(pts) - 1, i + 2)]
        t = 0.0
        while t < 1 - 1e-9:
            out.append((cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t))); t += step
    out.append(pts[-1]); return out


# ───────────── вода ─────────────
RIVERS = [dict(w=4, pts=[(129, 25), (132, 32), (126, 42), (129, 54), (121, 66), (115, 78), (113, 90), (118, 100), (107, 108), (100, 117), (97, 127)])]
LAKES = [dict(cx=17, cy=107, rx=13, ry=9, isle=dict(cx=15, cy=106, rx=4, ry=3)), dict(cx=36, cy=34, rx=6, ry=4)]
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

# ───────────── дороги ─────────────
ROADS = [
    ('main', [(80, 126), (78, 110), (84, 94), (77, 78), (82, 62), (75, 48), (72, 38), (70, 29)]),          # ворота → Хокаге
    ('main', [(24, 62), (44, 66), (62, 60), (82, 64), (100, 58), (118, 62), (136, 54), (150, 60)]),         # запад — восток
    ('street', [(40, 26), (46, 36), (58, 52), (70, 54)]), ('street', [(22, 42), (36, 48), (50, 58)]),
    ('street', [(92, 24), (98, 36), (104, 48), (112, 60)]), ('street', [(132, 30), (140, 40), (146, 54)]),
    ('street', [(30, 94), (50, 98), (66, 92), (82, 98), (104, 92)]), ('street', [(36, 74), (48, 82), (60, 90)]),
    ('street', [(134, 62), (140, 74), (136, 90), (128, 100)]), ('street', [(100, 78), (112, 84), (122, 96)]),
    ('street', [(54, 70), (56, 82), (62, 96)]), ('street', [(60, 104), (70, 112), (80, 118)]),
    ('street', [(24, 82), (30, 92), (34, 104)]), ('street', [(44, 28), (52, 38), (62, 46)]),
]
road_tiles = set()
for kind, pts in ROADS:
    w = {'main': 3, 'street': 2, 'path': 1}[kind]
    for sx, sy in curve(pts):
        x0, y0 = math.floor(sx - w / 2 + 0.5), math.floor(sy - w / 2 + 0.5)
        for y in range(y0, y0 + w):
            for x in range(x0, x0 + w):
                if 0 <= x < W and 0 <= y < H and terr[y][x] in (GROUND, WATER): road_tiles.add((x, y))
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
import heapq
def carve_spur(sx, sy, width=2):
    """Извилистая улица от клетки (sx, sy) к ближайшей дороге: поиск Дейкстры со случайной ценой клеток обходит здания и воду."""
    if terr[sy][sx] == ROAD: return False
    cost = {}
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
                        if 0 <= tx < W and 0 <= ty < H and terr[ty][tx] == GROUND and not occ[ty][tx]: tiles.add((tx, ty))
            for tx, ty in tiles: terr[ty][tx] = ROAD; road_tiles.add((tx, ty))
            spurs.append(sorted(tiles)); return True
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if not (0 <= nx < W and 0 <= ny < H) or (nx, ny) in prev: continue
            if terr[ny][nx] not in (GROUND, ROAD) or occ[ny][nx]: continue
            if y + 1 < H and 0 <= ny + 1 < H and occ[ny + 1][nx] and terr[ny][nx] != ROAD: continue
            heapq.heappush(heap, (c + 1 + rnd.random() * 1.6, nx, ny, (x, y)))
    return False


def refresh_rd():
    global RD
    RD = road_dist()


# ───────────── размещение ─────────────
def foot_free(x, y, w, h):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if not (0 <= xx < W and 0 <= yy < H) or terr[yy][xx] != GROUND or occ[yy][xx]: return False
    return True


def air_ok(x, y, w, h, gap=2):
    """Над и под зданием на `gap` рядов нет других зданий: карнизы нижнего не закроют фасад верхнего."""
    for yy in list(range(y - gap, y)) + list(range(y + h, y + h + gap)):
        for xx in range(x, x + w):
            if 0 <= xx < W and 0 <= yy < H and occ[yy][xx]: return False
    return True


def front_ok(x, y, w, h, dx):
    fx, fy = x + dx, y + h
    return 0 <= fx < W and 0 <= fy < H and terr[fy][fx] in (GROUND, ROAD) and not occ[fy][fx]


def fits(x, y, w, h, dx, maxrd=99, gap=2):
    if not (inside(x, y, 0.955) and inside(x + w - 1, y, 0.955) and inside(x, y + h, 0.955) and inside(x + w - 1, y + h, 0.955)): return False
    if not foot_free(x, y, w, h) or not air_ok(x, y, w, h, gap) or not front_ok(x, y, w, h, dx): return False
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


def near(tpl, ax, ay, art=None, maxr=20, maxrd=3, gap=2, rows=None):
    """Ближайшее к (ax, ay) допустимое место для здания; None, если нет."""
    w, h, dx = size_of(tpl, art)
    for r in range(maxr):
        cand = []
        for y in range(ay - r, ay + r + 1):
            for x in range(ax - r, ax + r + 1):
                if max(abs(x - ax), abs(y - ay)) != r: continue
                if fits(x, y, w, h, dx, maxrd, gap): cand.append((x, y))
        if cand: return rnd.choice(cand)
    return None


def place_near(tpl, ax, ay, art=None, **kw):
    p = near(tpl, ax, ay, art, **kw)
    if not p: print('  нет места:', tpl, art or '', (ax, ay)); return None
    return put(tpl, p[0], p[1], art, kw.get('name'))


# --- ориентиры и ключевые здания (порядок = приоритет места) ---
KEY = [
    ('hokage_tower', 63, 17), ('academy', 34, 17), ('library', 86, 16), ('hospital', 98, 16), ('onsen', 108, 30),
    ('ichiraku', 66, 44), ('dango', 88, 44), ('teahouse', 106, 64), ('yakiniku', 124, 80), ('market', 44, 55),
    ('books', 48, 33), ('flowers', 98, 54), ('souvenir', 84, 106), ('weapons', 128, 66), ('pharmacy', 112, 26),
    ('inuzuka_shop', 30, 98), ('hero_home', 86, 70), ('naruto_flat', 96, 70),
]
for tpl, ax, ay in KEY: place_near(tpl, ax, ay, maxr=26, maxrd=14)
# тренировки, ориентиры без дверей
for tpl, ax, ay in (('training_3', 19, 32), ('training_ground', 34, 114), ('training_ground', 46, 114)): place_near(tpl, ax, ay, maxr=30, maxrd=99, gap=1)
place_near('dojo', 62, 112, art='house13', maxr=34, maxrd=30)
for tpl, ax, ay in (('swing_tree', 50, 28), ('memorial', 28, 112), ('night_alley', 100, 74)): place_near(tpl, ax, ay, maxr=26, maxrd=99, gap=1)
# пристань — на берегу большого озера, водопад — у истока реки
pier = None
for x in range(24, 40):
    for y in range(100, 112):
        if terr[y][x] == GROUND and terr[y][x - 1] == WATER and all(terr[y + k][x] != BAD for k in range(0, 3)):
            pier = (x - 1, y - 1); break
    if pier: break
if pier: bld.append(dict(tpl='pier', x=pier[0], y=pier[1]))
bld.append(dict(tpl='waterfall', x=127, y=22))
for yy in range(22, 25):
    for xx in range(127, 131): terr[yy][xx] = BAD
carve_spur(126, 25, 1)             # к камню у водопада должна вести тропа             # к камню у водопада должна вести тропа
# скала Хокаге — у верхнего края (генератор сам прижмёт к подножию утёса)
rs = SPECS['hokage_rock']; bld.append(dict(tpl='hokage_rock', x=65, y=2))
for b in list(bld):                      # улица от двери каждого ключевого здания к ближайшей дороге
    w, h, dx = size_of(b['tpl']);
    if front_ok(b['x'], b['y'], w, h, dx): carve_spur(b['x'] + dx, b['y'] + h)
refresh_rd()
# ворота и посты стражи у южного въезда (дорога идёт к воротам)
gw, gh, gdx = size_of('gate'); gx, gy = 80 - gdx, 121
put('gate', gx, gy)
for tpl, art, ax in (('guard_post', 'guard_post01', 64), ('guard_post', 'guard_post02', 92)):
    w, h, dx = size_of(tpl, art); put(tpl, ax, 118, art)
# кланы: особняк и свои дома вокруг
CL = [('nara', 22, 30, 12), ('hyuga', 20, 64, 12), ('inuzuka', 30, 98, 11), ('aburame', 58, 106, 11), ('akimichi', 112, 100, 12),
      ('uchiha', 142, 60, 22), ('senju', 114, 16, 11), ('sarutobi', 52, 26, 11), ('yamanaka', 100, 48, 11)]
CLAN_RU = dict(nara='Нара', hyuga='Хьюга', inuzuka='Инузука', aburame='Абураме', akimichi='Акимичи', uchiha='Учиха', senju='Сенджу', sarutobi='Сарутоби', yamanaka='Яманака')
clan_pos = {}
for cid, ax, ay, k in CL:
    b = place_near('clan_' + cid, ax, ay, maxr=26, maxrd=4)
    if not b: continue
    clan_pos[cid] = (b['x'] + 4, b['y'] + 3)
    got, tries = 0, 0
    while got < k and tries < 900:
        tries += 1
        art = rnd.choice(CLAN_ART[cid] + (['house14'] if cid == 'uchiha' else []))
        art = art if art in SPECS else rnd.choice(CLAN_ART[cid])
        tpl = 'uchiha_small' if cid == 'uchiha' else 'house_s'
        w, h, dx = size_of(tpl, art)
        x, y = b['x'] - 12 + rnd.randint(0, 33), b['y'] - 8 + rnd.randint(0, 22)
        if fits(x, y, w, h, dx, 7, 2):
            put(tpl, x, y, art, 'Дом клана ' + CLAN_RU[cid]); got += 1
    print('  клан', cid, 'домов', got)
# автоматические улицы: пока есть застраиваемые клетки дальше 6 шагов от дороги — прокладываем улицу
for _ in range(60):
    far = [(RD[y][x], x, y) for y in range(18, H - 6) for x in range(6, W - 6) if terr[y][x] == GROUND and not occ[y][x] and inside(x, y, 0.92) and RD[y][x] > 13]
    if not far: break
    far.sort(reverse=True); _, fx, fy = far[0]
    if not carve_spur(fx, fy, 2 if rnd.random() < 0.3 else 1): RD[fy][fx] = 0
    refresh_rd()
# квартал Учиха: дом Саске, участок полиции
for tpl, ax, ay in (('sasuke_home', 140, 30), ('uchiha_police', 134, 44)): place_near(tpl, ax, ay, maxr=30, maxrd=4)
# конторы и рядовые лавки по всем районам, потом жилые дома вдоль улиц
for ax, ay in ((72, 30), (60, 36), (92, 34)):
    place_near('office', ax, ay, art=rnd.choice(['house02', 'house08']), maxr=14, maxrd=4)
SHOP_SPOTS = [(30, 40), (22, 56), (40, 82), (36, 108), (58, 72), (66, 90), (88, 78), (70, 24), (110, 44), (120, 72), (140, 40), (146, 70), (140, 104),
              (104, 100), (90, 118), (60, 120), (24, 78), (52, 36), (126, 28), (78, 54), (44, 90), (96, 90), (132, 90), (16, 50), (150, 50)]
for ax, ay in SHOP_SPOTS: place_near('shop_generic', ax, ay, art=rnd.choice(BY_KIND['shop']), maxr=22, maxrd=5)
houses = 0
GEN = BY_KIND['house']
def try_house(x, y):
    global houses
    arts = GEN[:]; rnd.shuffle(arts)
    if rnd.random() < 0.3: arts.sort(key=lambda a: not a.endswith('_big'))   # большие дома пробуем первыми в каждом третьем месте
    for art in arts:
        w, h, dx = size_of('house_s', art)
        if y + h < H and RD[y + h][x + dx] <= 13 and fits(x, y, w, h, dx, 13, 2):
            put('house_s', x, y, art, 'Жилой дом'); houses += 1; return True
    return False
for _ in range(80000):
    x, y = rnd.randint(8, W - 12), rnd.randint(17, H - 8)
    try_house(x, y)
for y in range(17, H - 6):                     # доводка: заполняем оставшиеся просветы рядами
    xs = list(range(6, W - 10)); rnd.shuffle(xs)
    for x in xs: try_house(x, y)

# ───────────── проход от двери до дороги (правила генератора) ─────────────
def walk(x, y):
    if not (0 <= x < W and 0 <= y < H): return False
    if terr[y][x] == ROAD: return True
    return terr[y][x] == GROUND and not occ[y][x] and not (y + 1 < H and occ[y + 1][x])
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
NEEDS_DOOR = lambda b: b['tpl'] not in ('training_3', 'training_ground', 'memorial', 'swing_tree', 'night_alley', 'pier', 'waterfall', 'hokage_rock', 'gate')
removed = 0
while True:
    bad = [b for b in bld if NEEDS_DOOR(b) and not reach(b)]
    soft = [b for b in bad if b['tpl'] in ('house_s', 'uchiha_small', 'shop_generic', 'office')]
    if not soft: break
    for b in soft:
        i = bld.index(b); n = i + 1
        w, h, dx = size_of(b['tpl'], b.get('art'))
        for yy in range(b['y'], b['y'] + h):
            for xx in range(b['x'], b['x'] + w): occ[yy][xx] = 0
        bld[i] = None; removed += 1
    # индексы occ сбиваются — перенумеруем
    bld = [b for b in bld if b]; occ = [[0] * W for _ in range(H)]
    for n, b in enumerate(bld, 1):
        w, h, dx = size_of(b['tpl'], b.get('art'))
        for yy in range(b['y'], b['y'] + h):
            for xx in range(b['x'], b['x'] + w): occ[yy][xx] = n
print('домов %d, выброшено без прохода %d, всего зданий %d' % (houses, removed, len(bld)))
hard = [b for b in bld if NEEDS_DOOR(b) and not reach(b)]
if hard: print('  без прохода (ключевые):', [(b['tpl'], b['x'], b['y']) for b in hard])

# ───────────── районы ─────────────
# порядок важен: следующий район перекрывает предыдущие (кварталы кланов → центр и торговая улица → полигоны)
def bbox(pred, pad=2):
    xs, ys, xe, ye = [], [], [], []
    for b in bld:
        if pred(b):
            w, h, _ = size_of(b['tpl'], b.get('art')); xs.append(b['x']); ys.append(b['y']); xe.append(b['x'] + w); ye.append(b['y'] + h)
    return (max(2, min(xs) - pad), max(15, min(ys) - pad), min(W - 2, max(xe) + pad) - max(2, min(xs) - pad), min(H - 1, max(ye) + pad) - max(15, min(ys) - pad))
districts = [dict(type='cliff', x=0, y=0, w=160, h=14, label='Скала Хокаге'),
             dict(type='residential', x=3, y=15, w=154, h=110, label='Коноха')]
for cid, ax, ay, k in CL:
    if cid not in clan_pos: continue
    own = lambda b, cid=cid: b['tpl'] == 'clan_' + cid or b.get('name') == 'Дом клана ' + CLAN_RU[cid]
    r = bbox(own, 2)
    districts.append(dict(type='uchiha' if cid == 'uchiha' else 'clan', x=r[0], y=r[1], w=r[2], h=r[3], label='Квартал ' + CLAN_RU[cid], **({} if cid == 'uchiha' else dict(fence=False))))
hx = bbox(lambda b: b['tpl'] in ('hokage_tower', 'academy', 'library'), 3)
districts.append(dict(type='official', x=hx[0], y=hx[1], w=hx[2], h=hx[3], label='Центр'))
mx = bbox(lambda b: b['tpl'] in ('market', 'ichiraku', 'dango'), 2)
districts.append(dict(type='market', x=mx[0], y=mx[1], w=mx[2], h=mx[3], label='Торговая улица'))
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
start = road_pt(78, 50); cross = road_pt(78, 62)
free_pts = [(x, y) for y in range(17, H - 4) for x in range(4, W - 4) if terr[y][x] == GROUND and not occ[y][x] and inside(x, y, 0.9) and RD[y][x] <= 9]
def pick(ax, ay, rmin=0, avoid=None, ar=0):
    c = [p for p in free_pts if abs(p[0] - ax) + abs(p[1] - ay) <= 14 and math.hypot(p[0] - ax, p[1] - ay) >= rmin and not (avoid and math.hypot(p[0] - avoid[0], p[1] - avoid[1]) < ar)]
    return list(rnd.choice(c)) if c else [ax, ay]
herbs = []
for _ in range(16):
    for t in range(600):
        p = rnd.choice(free_pts)
        edge = min(abs(p[0] - cx) / ea, 1) ** 3 + min(abs(p[1] - cy) / eb, 1) ** 3
        if edge > 0.55 and all(math.hypot(p[0] - q[0], p[1] - q[1]) > 14 for q in herbs): herbs.append(list(p)); break
lotus = []
for lk in LAKES[:1]:
    for _ in range(300):
        a = rnd.random() * 6.28; p = [int(lk['cx'] + math.cos(a) * (lk['rx'] + 2)), int(lk['cy'] + math.sin(a) * (lk['ry'] + 2))]
        if 0 <= p[0] < W and 0 <= p[1] < H and terr[p[1]][p[0]] == GROUND: lotus.append(p)
        if len(lotus) >= 3: break
def where(tpl):
    for b in bld:
        if b['tpl'] == tpl: return b
anch = dict(
    choji=pick(46, 62), kiba=pick(28, 100), shino=pick(62, 112), lee=pick(40, 112), guy=pick(44, 112), mizuki=pick(58, 30), thief=pick(100, 72),
    board=pick(46, 26), run=pick(80, 52), falls=pick(122, 24, 0, (126, 25), 8), water=pick(34, 102), stealth=pick(20, 38), herbs=herbs, lotus=lotus,
)
signs = [
    pick(78, 56) + [['▲ Академия, резиденция Хокаге, Скала Хокаге', '< Квартал Нара, Хьюга, Инузука   Квартал Учиха >', '▼ Жилые кварталы, полигоны, главные ворота']],
    pick(86, 76) + [['Жилой квартал. Дом героя — рядом, у реки.', 'Мимо квартиры Наруто ночью лучше не шуметь.']],
    pick(76, 116) + [['Главные ворота Конохи. Посты стражи: Изумо и Котецу.']],
    pick(24, 34) + [['Пруд клана Нара. Без разрешения не входить. Не кормить оленей!']],
    pick(138, 56) + [['Квартал Учиха. После трагедии здесь живёт только Саске.']],
]

# ───────────── запись ─────────────
def js(o, ind=0):
    return json.dumps(o, ensure_ascii=False, separators=(',', ': '))
out = ['// Раскладка Конохи — СГЕНЕРИРОВАНО tools/plan_konoha.py (seed %d) из размеров картинок и шаблонов; руками не править.' % SEED,
       '// Чтобы поменять деревню, правь tools/plan_konoha.py (якоря, дороги, реки, число домов) и запусти его заново.',
       '// explicit: true — здания заданы списком (генератор не застраивает кварталы сам); art — имя нарисованной картинки (gfx/house_art.js).',
       'G.KONOHA_DRAFT = {', '  version: 2, explicit: true,', '  size: { w: %d, h: %d },' % (W, H),
       '  shape: { cx: %d, cy: %d, a: %d, b: %d, p: %d, wall: 2.4, rings: [], lakes: %s },' % (cx, cy, ea, eb, ep, js([{k: v for k, v in lk.items()} for lk in LAKES])),
       '  rivers: %s,' % js(RIVERS), '  roads: [']
for kind, pts in ROADS: out.append('    { type: %s, pts: %s },' % (js(kind), js([list(p) for p in pts])))
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

# картинка схемы для просмотра
try:
    from PIL import Image, ImageDraw
    S = 7; im = Image.new('RGB', (W * S, H * S), '#4f7f3f'); d = ImageDraw.Draw(im)
    col = {GROUND: '#9bbf72', WATER: '#6aaae0', ROAD: '#e8d6a4', BAD: '#3d6a34'}
    for y in range(H):
        for x in range(W): d.rectangle([x * S, y * S, x * S + S - 1, y * S + S - 1], fill=col[terr[y][x]])
    for b in bld:
        w, h, dx = size_of(b['tpl'], b.get('art')); k = SPECS.get(b.get('art') or b['tpl'], {}).get('kind', '')
        c = {'unique': '#d8803a', 'clan': '#b070c0', 'shop': '#d84a3a', 'guard': '#808080'}.get(k, '#b87a4a')
        d.rectangle([b['x'] * S, b['y'] * S, (b['x'] + w) * S - 1, (b['y'] + h) * S - 1], fill=c, outline='#2a1a0a')
        d.rectangle([(b['x'] + dx) * S + 1, (b['y'] + h) * S - 3, (b['x'] + dx + 1) * S - 2, (b['y'] + h) * S - 1], fill='#fff')
    im.save(os.path.join(ROOT, 'tools', 'shots', 'konoha_plan.png'))
except Exception as e: print('схема не нарисована:', e)
