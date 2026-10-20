// Экран «Настройки»: открывается из главного меню (титульный экран) и из меню паузы. Окно — свиток (G.ui.menu).
G.scenes.register('settings', () => {
  let idx = 0;
  const S = G.storage.settings;
  const SPEED_NAMES = ['мгновенно', 'медленно', 'обычно', 'быстро'];
  const W = 214;
  const onoff = (v) => (v ? 'ВКЛ' : 'ВЫКЛ');
  const items = () => [
    { label: 'Звук', value: onoff(S.sound), act: () => { S.sound = !S.sound; G.audio.setEnabled(S.sound); G.storage.saveSettings(); } },
    { label: 'Текст', value: SPEED_NAMES[S.textSpeed], act: () => { S.textSpeed = (S.textSpeed + 1) % 4; G.storage.saveSettings(); } },
    { label: 'Карта и метки', act: () => G.scenes.push(G.scenes.make('mapsettings')) },
    { label: 'Эффекты', value: onoff(S.fx !== false), act: () => { S.fx = S.fx === false; G.storage.saveSettings(); } },
    { label: 'Подсказки', value: onoff(S.hints !== false), act: () => { S.hints = S.hints === false; G.storage.saveSettings(); } },
    { label: 'Реакция', value: S.reactSlow ? 'МЕДЛЕННО' : 'ОБЫЧНО', act: () => { S.reactSlow = !S.reactSlow; G.storage.saveSettings(); } },
    { label: 'Размер кнопки A', value: Math.round((S.buttonSize||1)*100)+'%', act: () => { const a=[1,1.2,1.4];S.buttonSize=a[(a.indexOf(S.buttonSize||1)+1)%3];G.storage.saveSettings(); } },
    { label: 'Джойстик', value: ({0.75:'ПЛАВНО',1:'ОБЫЧНО',1.3:'ЧУТКО'})[S.stickSensitivity||1], act: () => { const a=[0.75,1,1.3];S.stickSensitivity=a[(a.indexOf(S.stickSensitivity||1)+1)%3];G.storage.saveSettings(); } },
    { label: 'Вибрация', value: onoff(S.vibration), act: () => { S.vibration=!S.vibration;G.storage.saveSettings(); } },
    { label: 'Пиксели', value: G.screen.densityOptions().length > 1 ? G.screen.density().name : 'АВТО', dis: G.screen.densityOptions().length < 2, act: () => G.screen.cycleDensity() },
    { label: 'Отладка', value: onoff(G.debug.on), act: () => G.debug.toggle() },
    ...(G.debug.on ? [{ label: 'Читы', act: () => G.scenes.push(G.scenes.make('cheats')) }, { label: 'Шрифт', act: () => G.scenes.push(G.scenes.make('fonttest')) }] : []),
    { label: 'Назад', act: () => G.scenes.pop() },
  ];
  return {
    name: 'settings',
    transparent: true,
    update(dt) {
      const I = G.input, list = items();
      if (I.repeat('up', dt)) { idx = (idx + list.length - 1) % list.length; G.audio.sfx.select(); }
      if (I.repeat('down', dt)) { idx = (idx + 1) % list.length; G.audio.sfx.select(); }
      if (I.pressed('b') || I.pressed('menu')) { G.audio.sfx.cancel(); G.scenes.pop(); return; }
      if (I.tapNow) {
        const i = G.ui.menu.hit(I.tapNow, list.length, W);
        if (i >= 0) { idx = i; G.audio.sfx.confirm(); list[i].act(); }
        return;
      }
      if (I.pressed('a')) { G.audio.sfx.confirm(); list[idx].act(); }
    },
    draw(ctx) { G.ui.menu.draw(ctx, 'НАСТРОЙКИ', items(), idx, W); },
  };
});

G.scenes.register('mapsettings',()=>{
  const S=G.storage.settings,W=220;let idx=0;
  const items=()=>[
    {label:'Мини-карта',value:S.minimap===false?'ВЫКЛ':'ВКЛ',act:()=>S.minimap=S.minimap===false},
    {label:'Детализация',value:S.mapDetail==='simple'?'СХЕМА':'ПОДРОБНО',act:()=>S.mapDetail=S.mapDetail==='simple'?'detailed':'simple'},
    {label:'Маркеры',value:S.mapMarkerSize===1.3?'КРУПНЫЕ':'ОБЫЧНЫЕ',act:()=>S.mapMarkerSize=S.mapMarkerSize===1.3?1:1.3},
    {label:'Подписи мест',value:S.mapLabels===false?'ВЫКЛ':'ВКЛ',act:()=>S.mapLabels=S.mapLabels===false},
    {label:'Назад',act:()=>G.scenes.pop()}
  ];
  return{name:'mapsettings',transparent:true,touch:()=>({back:true}),update(dt){
    const I=G.input,a=items();if(I.pressed('b')||I.pressed('menu')){G.scenes.pop();return;}
    if(I.repeat('up',dt))idx=(idx+a.length-1)%a.length;if(I.repeat('down',dt))idx=(idx+1)%a.length;
    if(I.tapNow){const n=G.ui.menu.hit(I.tapNow,a.length,W);if(n>=0){idx=n;a[n].act();G.storage.saveSettings();G.audio.sfx.confirm();}return;}
    if(I.pressed('a')){a[idx].act();G.storage.saveSettings();G.audio.sfx.confirm();}
  },draw(ctx){G.ui.menu.draw(ctx,'КАРТА И МЕТКИ',items(),idx,W);}};
});
