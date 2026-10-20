"""Браузерные регрессии аудита: настоящий Canvas, перекраска и мобильный интерфейс."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tlib import *
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b, page = open_page(p, 'http://localhost:8765/index.html')
    seed(page)
    result = page.evaluate('''() => {
      const bad=[];
      for(const id of ['villager_m','villager_f']) {
        const base=G.chars.sheet(id), data=base.getContext('2d').getImageData(0,0,base.width,base.height).data;
        for(let look=1;look<G.chars.LOOKS;look++) {
          const cv=G.chars.sheet(id,look), other=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
          for(let i=3;i<data.length;i+=4) if(data[i]!==other[i]) {bad.push(id+':'+look);break;}
        }
      }
      return bad;
    }''')
    check(not result, 'перекраска сохраняет размер и силуэт всех кадров: %s' % result)
    page.evaluate("G.debug.on=false; G.storage.settings.density='big'; G.screen.resize(); G.scenes.replace(G.scenes.make('status'))")
    key(page, 'ArrowDown', 6, wait=.03)
    shot(page, 'audit_status_all_friends')
    page.evaluate("G.scenes.replace(G.scenes.make('settings'))")
    shot(page, 'audit_settings_narrow')
    page.evaluate("G.scenes.replace(G.scenes.make('shop','pharmacy'))")
    shot(page, 'audit_shop_narrow')
    page.evaluate("G.scenes.replace(G.scenes.make('battle',{enemy:'naruto',mode:'spar'},()=>{}))")
    page.evaluate("G.storage.settings.density='fine'; G.screen.resize()")
    time.sleep(.2)
    shot(page, 'audit_battle_resized')
    check(not errors, 'настоящий Canvas и смена масштаба без ошибок: %s' % errors[:2])
    b.close()
report()
sys.exit(1 if fails or errors else 0)
