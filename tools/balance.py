#!/usr/bin/env python3
"""Симулятор баланса: прогоняет сюжетные бои ботом (G.sim) для 4 сборок × 3 уровней мастерства игрока,
считает кривые роста характеристик и экономику, пишет docs/BALANCE.md и docs/balance.csv.
Запуск:  python3 -m http.server 8765 (в корне репозитория)  →  python3 tools/balance.py [N боёв на ячейку, по умолч. 40]
"""
import sys, os, json, time, csv
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tlib import open_page, seed, errors
from playwright.sync_api import sync_playwright

N = int(sys.argv[1]) if len(sys.argv) > 1 else 40
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILLS = [(0.4, 'новичок'), (0.65, 'средний'), (0.85, 'опытный')]
BUILDS = ['tai', 'nin', 'gen', 'bal']
STAT_IDS = ['tai', 'nin', 'gen', 'chakra', 'ctrl', 'spd', 'end', 'know']

def pct(x): return '%d%%' % round(x * 100)

def main():
    with sync_playwright() as p:
        b, page = open_page(p, "http://localhost:8765/index.html?debug=1")
        seed(page)
        t0 = time.time()
        meta = page.evaluate("""(() => ({
          builds: Object.fromEntries(Object.entries(G.sim.BUILDS).map(([k, v]) => [k, { name: v.name, skills: v.skills.map((s) => G.SKILLS.find((x) => x.id === s).name), focus: v.focus.map((t) => G.TRAININGS[t].name) }])),
          scen: G.sim.SCEN.map((s) => ({ id: s.id, label: s.label, enemy: s.enemy, mode: s.mode })),
          growth: Object.fromEntries(Object.keys(G.sim.BUILDS).map((k) => [k, G.sim.growth(k)])),
          enemies: Object.fromEntries(Object.entries(G.ENEMIES).map(([k, e]) => [k, { name: e.name, hp: e.hp, ch: e.ch, tai: e.tai, nin: e.nin, gen: e.gen, spd: e.spd, end: e.end, know: e.know, focus: e.focus, pref: e.pref, acts: e.acts.map((a) => G.EACTS[a] ? G.EACTS[a].name + ' ' + (G.EACTS[a].dmg || 0) : a), traits: e.traits || [], phase2: !!e.phase2 }])),
          moves: G.MOVES, combos: G.COMBOS,
          techs: Object.fromEntries(Object.entries(G.TECHS).map(([k, t]) => [k, { name: t.name, ch: t.ch, seals: t.seals.length, w: t.w }])),
          trainings: G.TRAININGS, need: [3,4,5,6,7,8,9,10,11].map((s) => G.train.needAt(s)),
          econ: G.sim.economy(),
          jobs: Object.values(G.JOBS).map((j) => ({ name: j.name, pay: j.pay, min: j.min || j.minutes || 0, energy: j.energy || 0 })),
          items: Object.entries(G.ITEMS).map(([k, i]) => ({ id: k, name: i.name, price: i.price, kind: i.kind || '' })),
        }))()""")
        rows = []
        for sc in meta['scen']:
            for bd in BUILDS:
                for sk, _ in SKILLS:
                    r = page.evaluate(f"G.sim.run('{sc['id']}', '{bd}', {sk}, {N})")
                    rows.append(r)
            print('  ', sc['label'], ' '.join(pct(r['win']) for r in rows[-12:]), flush=True)
        print('боёв: %d, %.1f c, ошибок JS: %d' % (len(rows) * N, time.time() - t0, len(errors)))
        b.close()
    with open(os.path.join(ROOT, 'docs', 'balance.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f); w.writerow(['scenario', 'build', 'skill', 'n', 'win', 'turns', 'hp_left_on_win', 'enemy_hp_left', 'ringouts', 'timeouts'])
        for r in rows: w.writerow([r['sc'], r['build'], r['skill'], r['n'], round(r['win'], 3), round(r['turns'], 1), round(r['hpLeft'], 2), round(r['enemyLeft'], 2), r['ringout'], r['timeout']])
    write_md(meta, rows)
    json.dump({'rows': rows}, open('/tmp/balance_rows.json', 'w'))
    if errors: print('JS errors:', errors[:5])

def target(sc):
    """Целевое окно побед для «среднего» игрока."""
    return {'kiba_d3': (0.45, 0.8), 'dummy2_d8': (0.9, 1), 'bully_d12': (0.85, 1), 'dog_d12': (0.85, 1), 'naruto_d14': (0.5, 0.85),
            'lee_d18': (0.1, 0.45), 'choji_d26': (0.55, 0.9), 'kiba_d26': (0.55, 0.9), 'sasuke_d26': (0.25, 0.6), 'thief_d30': (0.7, 1),
            'senior_d38': (0.6, 0.9), 'bully_d33': (0.8, 1), 'iruka_d47': (0.4, 0.8), 'mizuki_d54': (0.55, 0.9)}.get(sc, (0.4, 0.9))

def write_md(meta, rows):
    L = []
    A = L.append
    A('# BALANCE — таблица баланса «Naruto RPG»')
    A('')
    A('Сгенерировано `tools/balance.py` (симулятор `src/systems/sim.js`): %d боёв на ячейку, бот-игрок с мастерством 0,4 / 0,65 / 0,85 '
      '(точность ритма, печатей и реакций). Характеристики героя берутся из модели роста «средний игрок» на день боя.' % N)
    A('')
    A('## 1. Формулы боя')
    A('')
    A('| Что | Формула |')
    A('|---|---|')
    for k, v in [
        ('HP героя', '(60 + 4·Вын) × 1,1 с «Крепким орешком»'),
        ('Чакра героя', '20 + 8·Чак (× 1,25 «Большой запас»)'),
        ('Шкала ходов', 'вес действия × fac(Скор), fac = max(0,6; 1,3 − 0,05·Скор)'),
        ('Засада', 'Каварими: ×(1,4 + 0,04·Нин), Хенге: ×(1,8 + 0,04·Нин), куст ×1,5'),
        ('Блок врага против серии', '12% + 3%·(Тай врага − Тай) + 3%·(Скор врага − Скор) + 8% при Фокусе; 6–45%; урон ×0,5'),
        ('Финальное комбо (Воля)', '16 + 1,5·Тай, всегда крит'),
        ('Уличные враги (хулиган, пёс, вор)', 'растут с днём: HP × (1 + 0,015·день), Тай +⌊день/14⌋, Скор и Вын +⌊день/21⌋'),
        ('Урон героя', 'база × (1 + 0,065·стат) / (1 + 0,04·Вын врага) × крит 1,5 / норма 1 / слабо 0,6 × комбо'),
        ('Урон врага', 'база × (1 + 0,11·стат врага) / (1 + 0,03·Вын героя); блок ×0,55 (1 дыхание), уклон: 35% + 6%·(Скор − Скор врага)'),
        ('Дыхание (тайдзюцу)', '2 + ⌊Вын / 3⌋ ячеек, +1 за ход без тайдзюцу, «Защита» +2'),
        ('Фокус (реакции)', '2 + «Аналитик» + флаг «Тактик» (из Академии)'),
        ('Воля Огня', '+урон получен ×0,8, +крит/уклон; 100 → «Воля Огня!»'),
        ('Спарринг / свиток / колокольчик', 'победа при HP врага ≤30% (≤25% для колокольчика); поражение при своём ≤30%'),
    ]: A('| %s | %s |' % (k, v))
    A('')
    A('Приёмы тайдзюцу: ' + ', '.join('%s %s' % (m['name'], m['dmg']) for m in meta['moves'].values()) + '.  ')
    A('Комбо: ' + ', '.join('%s ×%s' % (c['name'], c['mul']) for c in meta['combos'].values()) + '.  ')
    A('Техники (цена чакры / печатей): ' + ', '.join('%s %s/%s' % (t['name'], t['ch'], t['seals']) for t in meta['techs'].values()) + '.')
    A('')
    A('## 2. Враги')
    A('')
    A('| Враг | HP | Чак | Тай | Нин | Ген | Скор | Вын | Зн | Фокус | Дист. | Особое |')
    A('|---|---|---|---|---|---|---|---|---|---|---|---|')
    for e in meta['enemies'].values():
        A('| %s | %d | %d | %d | %d | %d | %d | %d | %d | %d | %d | %s |' % (e['name'], e['hp'], e['ch'], e['tai'], e['nin'], e['gen'], e['spd'], e['end'], e['know'], e['focus'], e['pref'], ', '.join(e['traits'] + (['2 фаза'] if e['phase2'] else [])) or '—'))
    A('')
    A('## 3. Рост характеристик (модель «средний игрок»)')
    A('')
    A('Будни: урок (оценка ~75%) + 2 тренировки (+ работа), выходные: 4 тренировки; первая тренировка дня — с другом (×1,5); повтор той же тренировки в день: ×1 / 0,7 / 0,45 / 0,3. '
      'Опыт до следующего уровня: 30 + 10·(стат − 3) → ' + ', '.join(str(x) for x in meta['need']) + ' (3→4 … 11→12). Потолок 12.')
    A('')
    for bd in BUILDS:
        B = meta['builds'][bd]
        A('**%s** — навыки: %s; тренирует: %s.' % (B['name'], ', '.join(B['skills']), ', '.join(B['focus'])))
        A('')
        A('| День | ' + ' | '.join(STAT_IDS) + ' |')
        A('|---|' + '---|' * len(STAT_IDS))
        for d, s in sorted(meta['growth'][bd].items(), key=lambda x: int(x[0])):
            A('| %s | ' % d + ' | '.join(str(s[k]) for k in STAT_IDS) + ' |')
        A('')
    A('## 4. Матрица побед (симуляция)')
    A('')
    A('Ячейка: доля побед новичок / средний / опытный. ✔ — «средний» в целевом окне, ▲ — слишком легко, ▼ — слишком трудно.')
    A('')
    A('| Бой | Цель (средний) | ' + ' | '.join(meta['builds'][b]['name'] for b in BUILDS) + ' |')
    A('|---|---|' + '---|' * len(BUILDS))
    for sc in meta['scen']:
        lo, hi = target(sc['id'])
        cells = []
        for bd in BUILDS:
            rs = [r for r in rows if r['sc'] == sc['id'] and r['build'] == bd]
            mid = [r for r in rs if r['skill'] == 0.65][0]['win']
            mark = '✔' if lo <= mid <= hi else ('▲' if mid > hi else '▼')
            cells.append('%s %s' % (' / '.join(pct(r['win']) for r in rs), mark))
        A('| %s | %s–%s | %s |' % (sc['label'], pct(lo), pct(hi), ' | '.join(cells)))
    A('')
    A('Средняя длина боя (ходов героя, «средний»): ' + '; '.join('%s — %.1f' % (sc['label'].split(' (')[0], sum(r['turns'] for r in rows if r['sc'] == sc['id'] and r['skill'] == 0.65) / len(BUILDS)) for sc in meta['scen']) + '.')
    A('')
    A('## 5. Экономика')
    A('')
    e = meta['econ']
    A('| Статья | Значение |')
    A('|---|---|')
    for k, v in [
        ('Старт', '300 рё'),
        ('Работа с доски (средняя ставка / выплата при 80%)', '%d / %d рё' % (e['avgJob'], e['jobPay'])),
        ('Турнир (1/2/3/4 место)', '300 / 150 / 80 / 30 рё'),
        ('Еда: расход сытости', '~%d в сутки бодрствования; рис дома бесплатно: %d' % (e['foodPerDay'], e['riceFree'])),
        ('Рамен (мисо)', '%d рё' % e['ramen']),
        ('Продажа: рыба / карп / трава', '%d / %d / %d рё' % (e['fishSell'], e['carpSell'], e['herbSell'])),
        ('Кунай / бинт / пилюля / удочка', '%d / %d / %d / %d рё' % (e['kunai'], e['bandage'], e['pill'], e['rod'])),
        ('Типичная неделя', '+5 работ ≈ %d рё, рыбалка/травы ≈ 60–120 рё; расходы: обеды ≈ 250, расходники ≈ 80, подарки ≈ 60 → +%d рё' % (5 * e['jobPay'], 5 * e['jobPay'] + 90 - 390)),
    ]: A('| %s | %s |' % (k, v))
    A('')
    A('Работы: ' + ', '.join('%s %d' % (j['name'], j['pay']) for j in meta['jobs']) + ' рё.')
    A('')
    A('## 6. Выводы и что изменено по итогам симуляции')
    A('')
    for s in [
        '**Было (первый прогон):** 95–100% побед во всех боях у всех сборок, даже у «новичка». Причины: урон героя не учитывал Выносливость врага; '
        'комбо перемножались (подсечка→апперкот ×1,5 × комбо ×1,6 × стат ×1,9 — «Воздушное комбо» снимало Ли 60% HP); 6 дыханий на старте = два комбо подряд; '
        'блок срезал 60% урона; финальное комбо Воли 28 + 2·Тай; модель роста (3+5 тренировок в день) выводила почти все статы на 12 к д.47.',
        '**Изменено:** урон героя ×(1 + 0,065·стат) / (1 + 0,04·Вын врага); комбо ×1,2 / 1,35 / 1,45; апперкот после подсечки ×1,3; приёмы 5/7/3/6; '
        'дыхание 2 + ⌊Вын/3⌋; блок ×0,55; враг может блокировать серию; урон врагов ×(1 + 0,11·стат); HP героя 60 + 4·Вын, «Крепкий орешек» ×1,1; '
        'финальное комбо 16 + 1,5·Тай; Воля с «Упорством» ×1,2; засады Каварими/Хенге растут с Нин; опыт до уровня 30 + 10·(стат − 3); '
        'HP сюжетных врагов +10–25%; уличные враги растут с днём; на полевом выходе — новый «Старшеклассник» вместо хулигана.',
        '**Ревизия после аудита:** в тренировочных боях (уроки, спарринги, турнир) расходники не тратятся; ловушки в бою требуют учебник «Теория ловушек»; встречный кунай — 3 + 0,35·Скор врага нажатий за 1,5 с (было 5 + 0,5·Скор за 1,3 с); оценка за урок-бой не ниже 50% при победе.',
        '**Сейчас:** «средний» игрок выигрывает обязательные бои примерно в 55–95%, новичок — заметно реже, опытный — почти всегда. '
        'Проигрыш в спаррингах и на турнире сюжет не ломает (есть ветки поражения).',
        '**Особенность сборок:** Тайдзюцу — самая «боевая»: её тренировки (манекен, бревно, крыши) качают ещё Скорость и Выносливость, а эксперимент показал, '
        'что именно они дают основной выигрыш (без +Вын: 88% → 61%, без +Скор: → 59%). Это осознанно: такой герой слабее в учёбе, на экзамене и в техниках. '
        'Ниндзюцу — самая трудная до Буншина (д.43): её урон идёт через засады Хенге/Каварими. Колокольчики Ируки почти не зависят от сборки (удача рывка).',
        '**Как перепроверить после правок:** `python3 tools/balance.py 40` — ячейки с ▲/▼ показывают выход «среднего» игрока из целевого окна.',
    ]: A('- ' + s)
    A('')
    open(os.path.join(ROOT, 'docs', 'BALANCE.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    print('BALANCE.md записан')

if __name__ == '__main__':
    main()
