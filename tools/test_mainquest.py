"""Главная ветка «Фиолетовая чакра»: вступительные сцены и сцены после шагов идут в игре сами, шаги закрываются действиями."""
import time, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from tlib import *

URL = "http://localhost:8765/index.html?debug=1"

def play_scenes(page, limit=40):
    """проигрывает очередь сцен: A, пока открыты диалоги"""
    for _ in range(limit):
        busy = page.evaluate("G.scenes.busy || G.scenes.top().name !== 'world'")
        q = page.evaluate("G.state.frQueue.length")
        if not busy and not q: return True
        key(page, 'KeyZ', wait=0.25)
    return False

with sync_playwright() as p:
    b, page = open_page(p, URL)
    seed(page)
    wait_top(page, 'world')
    close_dialogs(page)
    page.evaluate("G.state.daily = {}; G.state.vars.day = 2; G.state.vars.min = 14*60; G.state.quests = {}; G.state.frQueue = []; G.quests.start('main')")
    time.sleep(0.8)
    check(page.evaluate("G.state.frQueue.includes('mq_dummy_intro') || G.state.flags.qi_main_dummy === 1"), 'в день 2 открылось вступление шага «манекен»')
    check(play_scenes(page), 'вступительная сцена проиграна')
    shot(page, 'mq_intro')
    check(page.evaluate("G.quests.curStep('main').id") == 'dummy', 'шаг «манекен» ждёт действия')
    page.evaluate("G.events.emit('training', 'dummy', 0.8)")
    check(page.evaluate("G.quests.curStep('main').id") == 'library', 'тренировка у манекена закрыла шаг')
    time.sleep(0.8)
    check(play_scenes(page), 'сцена после шага проиграна (Ирука)')
    shot(page, 'mq_after')
    page.evaluate("G.scenes.push(G.scenes.make('journal'))"); time.sleep(0.5); shot(page, 'mq_journal')
    b.close()

    # ── экзамен на генина: день 21, все три части, итог и шаг «ворота» ──
    b, page = open_page(p, URL)
    seed(page); wait_top(page, 'world'); close_dialogs(page)
    page.evaluate("""(() => {
      G.state.quests = {}; G.state.frQueue = []; G.quests.start('main');
      const f = G.state.flags; Object.assign(f, { roofs: 1, tech_tree: 1, tech_water: 1, tech_bunshin: 1, tech_kawarimi: 1 });
      G.state.vars.day = 21; G.state.vars.min = 9 * 60; G.state.daily = {}; G.state.vars.fatigue = 5;
      for (const id of ['dummy','library','rod','fish','falls','shop','job','roof','tree','checkup1','spar','taunt','water','dream','brief','bunshin','study','help','lee','checkup2','hokage']) G.quests.step('main', id);
      G.state.frQueue = [];
    })()""")
    check(page.evaluate("G.quests.curStep('main').id") == 'exam', 'в день 21 текущий шаг — экзамен')
    ac = page.evaluate("G.world.konoha().landmarks.academy.interior.id")
    W(page, "s.setMap({ map: '%s', entry: true }); return 1" % ac); time.sleep(1.0)
    for _ in range(25):
        if top(page) in ('train',): break
        key(page, 'KeyZ', wait=0.25)
    check(top(page) == 'train', 'экзамен начался: письменный тест (%s)' % top(page))
    shot(page, 'mq_exam_1')
    for _ in range(160):
        done = page.evaluate("G.state.vars.exam != null && !G.scenes.busy && G.scenes.top().name === 'world' && G.state.frQueue.length === 0")
        if done: break
        if top(page) == 'train':
            page.evaluate("G.scenes.top().finishNow && G.scenes.top().finishNow(0.9)")
            time.sleep(0.8)
        key(page, 'KeyZ', wait=0.3)
    ex = page.evaluate("[G.state.vars.exam, G.state.vars.exam_pass, G.state.flags.genin, G.quests.curStep('main') && G.quests.curStep('main').id]")
    check(ex[0] is not None and ex[1] == 1 and ex[2] == 1, 'экзамен оценён и сдан: %s' % ex)
    check(ex[3] == 'gate', 'после экзамена шаг «ворота»: %s' % ex[3])
    shot(page, 'mq_exam_done')

    # ── финал первой главы: вечер у ворот → доклад → бой с Незнакомцем → развязка ──
    page.evaluate("G.state.vars.min = 19 * 60; G.quests.step('main', 'stranger'); G.quests.step('main', 'report'); 1")
    check(page.evaluate("G.quests.curStep('main').id") == 'duel', 'после доклада текущий шаг — бой у ворот')
    page.evaluate("G.events.emit('battle', { enemy: 'stranger', mode: 'ko' }, { win: true }); 1")
    check(page.evaluate("G.quests.curStep('main').id") == 'ending', 'победа над Незнакомцем открывает развязку')
    page.evaluate("G.quests.step('main', 'ending'); 1")
    fin = page.evaluate("[G.quests.done('main'), G.state.frQueue.includes('mq_epilogue'), G.state.flags.mq_won]")
    check(fin[0], 'главная ветка завершена, а не висит активной')
    check(fin[1], 'после развязки в очереди эпилог')
    check(fin[2] == 1, 'победа отмечена флагом mq_won')
    shot(page, 'mq_final')
    b.close()

    # ── побочная ветка: просьба Наруто принимается в диалоге, ветка и малое задание видны в журнале ──
    b, page = open_page(p, URL)
    seed(page); wait_top(page, 'world'); close_dialogs(page)
    page.evaluate("G.state.quests = {}; G.state.vars.day = 6; G.state.vars.friend_naruto = 6; G.state.vars.friend_choji = 0")
    check(page.evaluate("G.quests.scriptFor('naruto')") == 'arc_naruto_offer', 'Наруто предлагает ветку «Первый друг»')
    W(page, "s.talk('arc_naruto_offer'); return 1"); time.sleep(0.6)
    for _ in range(14):
        if page.evaluate("G.quests.active('arc_naruto')"): break
        key(page, 'KeyZ', wait=0.3)
    check(page.evaluate("G.quests.active('arc_naruto')"), 'ветка «Первый друг» принята')
    close_dialogs(page)
    page.evaluate("G.quests.start('sm_choji_milk')")
    page.evaluate("G.scenes.push(G.scenes.make('journal'))"); time.sleep(0.5); shot(page, 'side_journal')
    b.close()

report()
sys.exit(1 if fails or errors else 0)
