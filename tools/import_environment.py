#!/usr/bin/env python3
"""Встроить согласованные мастеры как небольшие палитровые спрайты (без сетевой загрузки)."""
from pathlib import Path
import json,base64,math
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
BINDINGS={
 'tree':['tree-oak','tree-birch','tree','tree-low'], 'pine':['tree-pine','tree-spruce'],
 'sakura':['tree-sakura'],'maple':['tree-maple'],'bush':['bush'],
 'rock':['rock'],'rock2':['rock-moss'],'rock3':['rock-flat'],'pebbles':['rock-cluster'],
 'barrel':['barrel'],'crate':['crate'],'bench':['bench'],'fence':['fence'],
 'lamp':['lamp'],'stonelamp':['stonelamp'],'well':['well'],'planter':['planter'],
 'sign':['signpost'],'village_board':['noticeboard'],'mailbox':['mailbox'],'fern':['fern'],
 **{'fl_'+c:['flowers-'+c] for c in ['white','yellow','red','blue','pink']}}

def encode(im):
    im=im.convert('RGBA')
    if im.getchannel('A').getextrema()==(255,255):
        im=im.convert('RGB').quantize(colors=64,method=Image.Quantize.MEDIANCUT).convert('RGBA')
    else:
        im=im.quantize(colors=64,method=Image.Quantize.FASTOCTREE).convert('RGBA')
    palette=[];lookup={};pixels=[]
    for color in list(im.get_flattened_data()):
        if color[3]==0:color=(0,0,0,0)
        if color not in lookup:lookup[color]=len(palette);palette.append(list(color))
        pixels.append(lookup[color])
    return dict(w=im.width,h=im.height,pal=palette,pixels=base64.b64encode(bytes(pixels)).decode())

def main():
    sprites={}
    for name in sorted({n for names in BINDINGS.values() for n in names}):
        im=Image.open(ROOT/f'art/environment/konoha-{name}.webp').convert('RGBA')
        im.thumbnail((96,96),Image.Resampling.NEAREST);sprites[name]=encode(im)
    # Земля: используем пять утверждённых генераций. Подгоняем только края
    # игровых 32px тайлов, а не подменяем оригиналы в art/.
    terrain=ROOT/'art/terrain/path'
    grass=Image.open(terrain/'05-grass.png').convert('RGB').crop((192,192,320,320)).resize((32,32),Image.Resampling.BOX)
    straight=Image.open(terrain/'01-straight.png').convert('RGB')
    earth=straight.crop((220,160,290,230)).resize((32,32),Image.Resampling.BOX)
    # Один симметричный краевой профиль для повторов и поворотов.
    for im in (grass,earth):
        old=im.copy()
        for y in range(32):
            for x in range(32):
                depth=min(x,y,31-x,31-y)
                if depth>=3:continue
                pts=[(x,y),(31-y,x),(31-x,31-y),(y,31-x),(31-x,y),(x,31-y),(y,x),(31-y,31-x)]
                avg=[sum(old.getpixel(p)[k] for p in pts)//8 for k in range(3)]
                t=(3-depth)/3
                im.putpixel((x,y),tuple(round(c*(1-t)+a*t) for c,a in zip(old.getpixel((x,y)),avg)))
    sprites['ground-grass']=encode(grass)
    sprites['ground-earth']=encode(earth)
    for name,edges in [('01-straight','NS'),('02-corner-left-up','NW'),('03-down','S'),('04-up','N')]:
        src=Image.open(terrain/(name+'.png')).convert('RGB').resize((32,32),Image.Resampling.BOX)
        out=grass.copy()
        for y in range(32):
            for x in range(32):
                r,g,b=src.getpixel((x,y))
                a=max(0,min(1,(r-g-3)/17))
                # Одинаковая ширина на границах и чистая трава на закрытых сторонах.
                for side,d,pos in [('N',y,x),('S',31-y,x),('W',x,y),('E',31-x,y)]:
                    if d<4:
                        target=max(0,min(1,(6-abs(pos-15.5))/2)) if side in edges else 0
                        t=(4-d)/4;a=a*(1-t)+target*t
                out.putpixel((x,y),tuple(round(c*(1-a)+v*a) for c,v in zip(grass.getpixel((x,y)),earth.getpixel((x,y)))))
        sprites['ground-'+name]=encode(out)
    data={'bindings':BINDINGS,'sprites':sprites}
    out=ROOT/'src/gfx/environment_art_data.js'
    out.write_text('// СГЕНЕРИРОВАНО tools/import_environment.py. Не редактировать вручную.\nG.ENVIRONMENT_ART='+json.dumps(data,separators=(',',':'))+';\n')
    print(f'Окружение: {len(sprites)} спрайтов, {out.stat().st_size:,} байт')
if __name__=='__main__':main()
