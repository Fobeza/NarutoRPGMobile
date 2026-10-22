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

report()
sys.exit(1 if fails or errors else 0)
