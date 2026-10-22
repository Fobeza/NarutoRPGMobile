// Регрессии спрайтов: настоящие пиксели Canvas, а не только успешный вызов рисования.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const shots=process.env.SPRITE_SHOTS||path.join(__dirname,'shots','sprites');fs.mkdirSync(shots,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:393,height:759},deviceScaleFactor:2,isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:8765/index.html');await page.waitForFunction(()=>window.G?.chars?.sheet&&G.houseArt);
  const result=await page.evaluate(()=>{
   const failures=[],frames=[];let portraits=0;
   function components(d,w,h){
    const seen=new Uint8Array(w*h),out=[];
    for(let p=0;p<w*h;p++)if(d[p*4+3]&&!seen[p]){
     const todo=[p];seen[p]=1;let count=0,x0=w,y0=h,x1=-1,y1=-1;
     while(todo.length){const q=todo.pop(),x=q%w,y=Math.floor(q/w);count++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy,np=ny*w+nx;if(nx>=0&&ny>=0&&nx<w&&ny<h&&!seen[np]&&d[np*4+3]){seen[np]=1;todo.push(np);}}
     }out.push({count,x0,y0,x1,y1});
    }return out.sort((a,b)=>b.count-a.count);
   }
   for(const id of Object.keys(G.chars.DEFS)){
    const s=G.chars.sheet(id),ctx=s.getContext('2d');
    for(let di=0;di<4;di++)for(let f=0;f<3;f++){
     const cc=components(ctx.getImageData(f*32,di*40,32,40).data,32,40),body=cc[0];
     if(!body)failures.push(`${id}: пустой кадр ${di}/${f}`);
     if(['hero','fugaku'].includes(id)&&body){
      if(body.y1-body.y0+1<28||body.y1-body.y0+1>34||body.y1>37)failures.push(`${id}: неверный масштаб или земля ${di}/${f}`);
      if(cc.slice(1).some(c=>c.count>=10&&(c.y1<body.y0-1||c.y0>body.y1+1)))failures.push(`${id}: фрагмент соседней позы ${di}/${f}`);
     }
     frames.push({id,dir:G.chars.DIRS[di],frame:f,body});
    }
    const p=G.chars.portrait(id);if(!components(p.getContext('2d').getImageData(0,0,p.width,p.height).data,p.width,p.height).length)failures.push(id+': пустой портрет');else portraits++;
   }
   if(!G.CHAR_ART.fugaku)failures.push('Фугаку остался на процедурном спрайте');
   let lights=0;
   for(const id of Object.keys(G.HOUSE_ART.art)){
    const s=G.houseArt.sprite(id);if(!s.glow)continue;lights++;
    const a=s.img.getContext('2d').getImageData(0,0,s.img.width,s.img.height).data,b=s.glow.getContext('2d').getImageData(0,0,s.glow.width,s.glow.height).data;
    for(let i=3;i<b.length;i+=4)if(b[i]>a[i]){failures.push(id+': свет на прозрачном фоне');break;}
   }
   for(const [id,areas] of Object.entries({clan_hyuga:[[9,165,14,27],[410,176,30,15]],sasuke_home:[[5,110,17,32],[246,110,17,32]],flowers:[[3,75,9,14],[160,75,9,13]],weapons:[[3,84,18,14]]})){
    const s=G.houseArt.sprite(id);if(!s.glow){failures.push(id+': пропали все окна');continue;}
    const ctx=s.glow.getContext('2d'),all=ctx.getImageData(0,0,s.glow.width,s.glow.height).data;
    if(!all.some((v,i)=>i%4===3&&v))failures.push(id+': пустая маска окон');
    for(const [x,y,w,h]of areas){const d=ctx.getImageData(x,y,w,h).data;if(d.some((v,i)=>i%4===3&&v))failures.push(id+': светится карниз');}
   }
   for(const id of ['gate','hokage_rock'])if(G.houseArt.sprite(id).glow)failures.push(id+': свет у объекта без окон');
   return {failures,frames,portraits,lights,characters:Object.keys(G.chars.DEFS).length};
  });
  fs.writeFileSync(path.join(shots,'metrics.json'),JSON.stringify(result,null,2));
  assert.deepEqual(result.failures,[]);assert.equal(result.frames.length,result.characters*12);assert.equal(result.portraits,result.characters);
  for(const id of ['hero','fugaku'])assert.ok(result.frames.some(f=>f.id===id),id+' отсутствует в проверке');
  console.log('✔ Все '+result.frames.length+' кадров и '+result.portraits+' портретов непустые; герой и Фугаку без чужих фрагментов, масштаб и земля верны');
  console.log('✔ Окна не выходят за непрозрачный контур; карнизы и объекты без окон не светятся');
  const atlas=await page.evaluate(()=>{
   const ids=['hero','fugaku','iruka','itachi'],c=document.createElement('canvas');c.width=1400;c.height=500;const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.fillStyle='#17252c';x.fillRect(0,0,c.width,c.height);
   ids.forEach((id,i)=>{const ox=i*350;x.fillStyle='#e4e8dc';x.fillRect(ox+8,45,330,440);x.fillStyle='#fff0cc';x.font='bold 19px monospace';x.fillText(id,ox+12,28);const s=G.chars.sheet(id),p=G.chars.portrait(id);x.drawImage(s,ox+12,52,240,400);x.drawImage(p,ox+254,52,80,80);});return c.toDataURL();
  });
  fs.writeFileSync(path.join(shots,'characters.png'),Buffer.from(atlas.split(',')[1],'base64'));
  await page.evaluate(()=>{
   const st=G.game.newState();st.started=true;st.hero.name='Кайто';st.hero.stats={tai:6,nin:5,gen:4,chakra:5,ctrl:5,spd:6,end:5,know:4};st.hero.skills=[];
   Object.assign(st.flags,{hosp_done:1,enrolled:1,day2_intro:1,roofs:1,home_seen:1,naruto_invited:1,ramen_done:1,frd_init:1,tip_clock:1});st.vars.day=6;st.vars.min=22*60;st.daily.lesson=1;st.quests.day1={st:'done',step:5,day:1};
   G.life.RATE=0;G.story.poll=()=>false;G.debug.on=false;G.audio.enabled=false;G.storage.settings.fx=true;G.scenes.replace(G.scenes.make('world',G.world.outsideOf(G.world.heroHome())));
  });
  for(const tpl of ['clan_hyuga','sasuke_home','flowers','weapons']){
   await page.evaluate(tpl=>{const w=G.scenes.top(),b=w.map.buildings.find(b=>b.tplId===tpl);w.setMap(G.world.outsideOf(b));w.player.dir='up';w.notes=[];w.banner=null;w.toast=null;w.updateCamera();},tpl);
   await page.screenshot({path:path.join(shots,'night-'+tpl+'.png')});
  }
  assert.deepEqual(errors,[]);console.log('✔ Фактические ночные сцены записаны; ошибок JavaScript нет');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
