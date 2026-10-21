#!/usr/bin/env python3
"""36 независимых мастеров → синхронная палитровая графика только редактора.
Pillow; размеры/опоры старых спрайтов сохраняются ради JSON v1/v2.
"""
from pathlib import Path
import base64, json
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def build():
    specs=json.loads((ROOT/'tools/editor_art_specs.json').read_text())
    manifest=json.loads((ROOT/'art/editor-world/manifest.json').read_text())
    if set(specs)!=set(manifest) or len(specs)!=36:
        raise ValueError('Нужны все 36 мастеров и их размеры')
    data={}
    for key,s in specs.items():
        im=Image.open(ROOT/'art/editor-world'/manifest[key]['file']).convert('RGBA')
        # Пропорции мастера неизменны; прозрачное поле сохраняет прежние bounds.
        W,H=s['w']*2,s['h']*2
        # Прямую стену берём как центральный участок длинного мастера,
        # а не сжимаем целую стену в тонкую полоску. Геометрия не растягивается.
        k=(32/im.height if key=='vwall_h' else min(W/im.width,H/im.height))
        im=im.resize((max(1,round(im.width*k)),max(1,round(im.height*k))),Image.Resampling.LANCZOS)
        if im.width>W:
            left=(im.width-W)//2;im=im.crop((left,0,left+W,im.height))
        canvas=Image.new('RGBA',(W,H));canvas.paste(im,((W-im.width)//2,H-im.height))
        rgb=canvas.convert('RGB').quantize(colors=95,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE)
        colors=rgb.getpalette();pal=[[0,0,0,0]]+[colors[i:i+3]+[255] for i in range(0,285,3)]
        raw=bytes(0 if a<128 else p+1 for a,p in zip(canvas.getchannel('A').getdata(),rgb.getdata()))
        if not any(raw):raise ValueError('Пустой спрайт '+key)
        data[key]={**s,'pal':pal,'pixels':base64.b64encode(raw).decode()}
    (ROOT/'src/editor/generated_art_data.js').write_text('// Генерируется tools/import_editor_art.py, только редактор.\nG.EDITOR_ART='+json.dumps(data,separators=(',',':'))+';\n')
    print(f'Графика редактора: {len(data)} мастеров')
if __name__=='__main__':build()
