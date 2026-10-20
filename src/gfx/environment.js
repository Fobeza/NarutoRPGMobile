// Материалы окружения. Рисуем в логических пикселях; полупиксельные детали используют холст ×2.
// Все узоры детерминированы: перерисовка чанка и загрузка сохранения не меняют фактуру.
G.environment = (() => {
  const H = G.util.hash2;
  const ink = '#493b35', wood = '#a5754d', edge = '#d4aa73', dark = '#674a39';
  const p = (c, x, y, col, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const rect = (c, x, y, w, h, fill, line = ink) => {
    p(c, x, y, line, w, h); p(c, x + 1, y + 1, fill, w - 2, h - 2);
  };
  const poly = (c, col, points) => {
    c.fillStyle = col; c.beginPath(); c.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) c.lineTo(...points[i]);
    c.closePath(); c.fill();
  };
  const grain = (c, x, y, w, h, seed, vertical = false) => {
    for (let i = 0; i < Math.ceil(w * h / 18); i++) {
      const u = Math.floor(H(i, seed, 61) * Math.max(1, w - 3));
      const v = Math.floor(H(seed, i, 62) * Math.max(1, h - 2));
      p(c, x + u, y + v, i % 3 ? '#966b49' : '#c69b68', vertical ? 0.5 : 2.5, vertical ? 2 : 0.5);
    }
  };
  const cup = (c, x, y, col = '#d6e4d9') => {
    p(c, x, y, '#5c655e', 4, 3); p(c, x + 0.5, y + 1, col, 3, 2);
    p(c, x + 0.5, y, '#f6efda', 3, 1); p(c, x + 1, y, '#718365', 2, 0.5);
  };
  const leaf = (c, x, y, flip = false) => {
    poly(c, '#3c6650', [[x,y+3],[x+(flip?-4:4),y],[x+(flip?-6:6),y+1],[x+(flip?-2:2),y+4]]);
    p(c, x + (flip ? -3 : 2), y + 1, '#81a66c', 2, 1);
  };

  function floor(c, x, y, tx = 0, ty = 0, dusty = false) {
    const base = dusty ? ['#82715d','#8a7861','#7d6d5a'] : ['#b98e60','#c29a6b','#b58b5e','#c09a70'];
    for (let row = 0; row < 2; row++) {
      const gy = ty * 2 + row, k = H(Math.floor(tx / 3), gy, 24);
      p(c, x, y + row * 8, base[Math.floor(k * base.length)], 16, 8);
      p(c, x, y + row * 8, dusty ? '#9a8972' : '#ddba86', 16, 0.5);
      p(c, x, y + row * 8 + 7.5, dusty ? '#655748' : '#94704f', 16, 0.5);
      // Стык доски через три тайла, в соседних рядах со смещением.
      const joint = ((tx + gy) % 3 + 3) % 3;
      if (!joint) {
        p(c, x, y + row * 8, dusty ? '#63594d' : '#8a684d', 0.5, 8);
        p(c, x + 1, y + row * 8 + 1, '#736047', 0.5, 0.5);
        p(c, x + 1, y + row * 8 + 6, '#736047', 0.5, 0.5);
      }
      for (let i = 0; i < 3; i++) {
        const u = H(tx * 3 + i, gy, 25) * 11, v = 1.5 + H(i, gy + tx, 26) * 4;
        p(c, x + u, y + row * 8 + v, dusty ? '#7a6a57' : '#ac8158', 3 + i, 0.5);
      }
      if (k > 0.83) { p(c, x + 8, y + row * 8 + 3, '#9c7854', 3, 1); p(c, x + 9, y + row * 8 + 3, '#c49a6b', 1, 0.5); }
    }
  }

  function tatami(c, x, y, tx = 1, ty = 2) {
    const u = ((tx - 1) % 2 + 2) % 2 * 16, v = ((ty - 2) % 2 + 2) % 2 * 16;
    const vertical = ((Math.floor((tx - 1) / 2) + Math.floor((ty - 2) / 2)) & 1) !== 0;
    p(c, x, y, vertical ? '#bdba8c' : '#c9c497', 16, 16);
    for (let i = 0; i < 16; i++) {
      if (vertical) p(c, x + i, y, i % 2 ? '#c5c297' : '#b5b386', 0.5, 16);
      else p(c, x, y + i, i % 2 ? '#d2cda2' : '#bdb88b', 16, 0.5);
    }
    // Узкая тканевая окантовка обрамляет целый мат 32×16, а не каждую клетку.
    const seam = (pos, verticalLine) => {
      p(c, x + (verticalLine ? pos : 0), y + (verticalLine ? 0 : pos), '#657566', verticalLine ? 1 : 16, verticalLine ? 16 : 1);
      for (let i = 1; i < 16; i += 3) p(c, x + (verticalLine ? pos + 0.5 : i), y + (verticalLine ? i : pos + 0.5), '#a2ad86', 0.5, 0.5);
    };
    if (vertical) { seam(0, true); if (!v) seam(0, false); if (v === 16) seam(15, false); }
    else { seam(0, false); if (!u) seam(0, true); if (u === 16) seam(15, true); }
  }

  function stone(c, x, y, seed = 0, road = false) {
    p(c, x, y, road ? '#8b8d83' : '#a3a292', 16, 16);
    const colors = road ? ['#b7b8a7','#c2c2af','#b0b3a4','#c8c7b5'] : ['#d0cbb7','#d8d1bb','#c8c4b1'];
    const rh = road ? 8 : 8;
    for (let r = 0; r < 2; r++) for (let k = -1; k < 3; k++) {
      const a = k * 12 + (r ? 6 : 0), l = Math.max(0, a), rr = Math.min(16, a + 11);
      if (rr <= l) continue;
      const col = colors[Math.floor(H(k + seed, r, 97) * colors.length)];
      p(c, x + l, y + r * rh, col, rr - l, 7.5);
      p(c, x + l, y + r * rh, '#e0ddc9', rr - l, 0.5);
      if (a >= 0) p(c, x + l, y + r * rh + 0.5, '#d3d2bc', 0.5, 6);
      p(c, x + l, y + r * rh + 7, '#a6a998', rr - l, 0.5);
      if (rr - l > 5) p(c, x + l + 2, y + r * rh + 3, '#bbbdab', 2, 0.5);
    }
  }

  function wall(c, map, tx, ty, x, y) {
    const ID = G.tiles.ID, kind = map.info && map.info.kind || '';
    const cool = ['hospital','onsen','pharmacy'].includes(kind);
    const uchiha = kind === 'sasuke_home' || kind === 'uchiha_hall' || kind === 'abandoned';
    const timber = cool ? '#69847b' : uchiha ? '#575263' : '#785540';
    p(c, x, y, cool ? '#e0e6d9' : uchiha ? '#d8d5ca' : '#e8dec4', 16, 16);
    // Мелкая фактура штукатурки без вертикальной сетки на каждом тайле.
    for (let i = 0; i < 5; i++) p(c, x + H(tx + i, ty, 32) * 15, y + H(i, tx + ty, 33) * 15, cool ? '#cfd9ce' : '#d9ccb1', 0.5, 0.5);
    if (map.get(tx, ty - 1) !== ID.IWALL) {
      p(c, x, y, '#473e37', 16, 3); p(c, x, y + 0.5, timber, 16, 1.5);
      p(c, x, y + 3, '#b89d73', 16, 0.5); p(c, x, y + 3.5, '#cec0a2', 16, 1);
    } else {
      p(c, x, y + 10, timber, 16, 6); p(c, x, y + 10, cool ? '#94a99a' : '#b48c61', 16, 1);
      p(c, x, y + 11.5, uchiha ? '#68606e' : cool ? '#7f998b' : '#906b4c', 16, 3);
      p(c, x, y + 15, '#493f38', 16, 1);
      if (tx % 3 === 0) p(c, x + 1, y + 12, '#665441', 0.5, 2);
    }
    if (tx === 0 || tx === map.w - 1 || (tx > 0 && tx % 4 === 0)) {
      p(c, x + (tx === map.w - 1 ? 13 : 0), y, timber, 3, 16);
      p(c, x + (tx === map.w - 1 ? 13.5 : 0.5), y, cool ? '#a5b5a0' : '#af8960', 0.5, 16);
    }
  }

  const props = {};
  props.barrel = (c) => {
    poly(c, ink, [[3,0],[9,0],[11,3],[12,12],[10,16],[2,16],[0,12],[1,3]]);
    p(c,2,3,'#a67d50',8,11); p(c,2,4,'#c29b62',2,9); p(c,8,3,'#795740',2,11);
    for(let x=4;x<10;x+=2)p(c,x,3,'#8c6747',0.5,11);
    for(const y of [4,11]){p(c,1,y,'#5c6662',10,2);p(c,2,y,'#a2aaa0',8,0.5);p(c,3,y+1,'#d2c6a0',0.5,0.5);}
    p(c,2,1,'#d1b17a',8,2);p(c,3,1,'#9c794f',6,0.5);p(c,6,1,'#775b42',0.5,2);
  };
  props.crate = (c) => {
    rect(c,0,0,14,14,'#a37e54');p(c,1,1,'#d6b77d',12,2);p(c,11,3,'#816344',2,10);
    for(const y of [5,9])p(c,1,y,'#7f6046',11,0.5);
    grain(c,2,3,9,9,15);
    poly(c,'#d0aa70',[[1,3],[3,3],[12,11],[12,13],[10,13],[1,5]]);
    p(c,1,12,'#d6b77d',12,1);for(const [x,y] of [[2,2],[11,2],[2,11],[11,11]])p(c,x,y,'#5b594b',0.5,0.5);
  };
  props.bench = (c) => {
    for(const x of [2,22]){p(c,x,5,'#4d554d',2,7);p(c,x-1,10,'#6a7062',4,1);}
    rect(c,1,0,24,4,'#aa7c50');p(c,2,0,edge,22,0.5);p(c,2,2,'#74533e',22,0.5);
    rect(c,0,4,26,4,'#b38958');p(c,1,4,'#dec18a',24,1);p(c,1,6,'#7c5c43',24,0.5);grain(c,2,5,21,2,4);
    for(const x of [3,22])p(c,x,1,'#d3bf8b',0.5,1);
  };
  props.fence = (c) => {
    for(const y of [4,9]){p(c,0,y,'#6f563e',16,3);p(c,0,y,'#b89a65',16,1);}
    for(const x of [2,11]){p(c,x,1,'#72583e',3,13);p(c,x,1,'#c7aa76',1,12);p(c,x+1,5,'#494c42',0.5,0.5);p(c,x+1,10,'#494c42',0.5,0.5);}
  };
  props.clanwall = (c) => {
    p(c,0,6,'#e4decb',16,14);p(c,0,8,'#f2e9d2',16,1);p(c,0,18,'#9ca28d',16,2);
    p(c,0,15,'#d2cfbc',16,0.5);p(c,0,6,'#b9baa6',16,1);
    p(c,0,2,'#434e53',16,4);p(c,0,2,'#8e9c94',16,0.5);p(c,0,5,'#333d43',16,1);
    for(let x=1;x<16;x+=4){p(c,x,2,'#617371',0.5,3);p(c,x+1,2,'#b2bca8',0.5,0.5);}
    p(c,1,19,'#718c65',3,0.5);p(c,12,18,'#849a70',2,1);
  };
  props.lamp = (c) => {
    p(c,5,10,'#4a5045',2,18);p(c,5,11,'#89917a',0.5,16);p(c,3,28,'#535749',6,2);p(c,4,27,'#78806a',4,1);
    rect(c,2,2,8,9,'#e4bd78');p(c,3,3,'#fff0bc',4,6);p(c,7,3,'#d9a65e',2,6);
    for(const y of [4,7])p(c,3,y,'#c2a470',6,0.5);
    p(c,5,2,'#b89560',0.5,8);poly(c,'#43534b',[[1,2],[4,0],[8,0],[11,2]]);p(c,3,1,'#93a08a',6,0.5);p(c,4,10,'#414a41',4,1);
  };
  props.stonelamp = (c) => {
    p(c,2,20,'#747e76',10,2);p(c,3,19,'#adb2a0',8,1);p(c,5,12,'#9ba38e',4,7);p(c,5,12,'#c7c9b1',1,7);
    rect(c,3,7,8,6,'#8b9987','#687669');p(c,5,8,'#fff0ae',4,3);p(c,8,8,'#c5a260',1,3);
    poly(c,'#718173',[[0,6],[3,4],[5,1],[9,1],[11,4],[14,6]]);p(c,3,4,'#c1c5a9',8,0.5);p(c,6,0,'#9ea98f',2,2);
    p(c,2,20,'#6d8859',3,1);p(c,8,18,'#7a9562',2,1);
  };
  props.well = (c) => {
    rect(c,1,12,16,10,'#909c94');p(c,2,12,'#d1cdb3',14,2);p(c,3,13,'#3e676b',12,3);p(c,4,13,'#88afa0',9,0.5);
    for(const y of [17,20]){p(c,2,y,'#647d77',14,0.5);p(c,y===17?6:10,y-2,'#647d77',0.5,2);}
    for(const x of [2,14]){p(c,x,3,dark,2,12);p(c,x,4,edge,0.5,8);}
    poly(c,'#743f34',[[0,3],[5,0],[13,0],[18,3],[18,4],[0,4]]);p(c,2,2,'#bb7050',14,0.5);
    p(c,8,3,'#dfc998',0.5,7);rect(c,6,9,5,4,'#aa885c');p(c,7,10,'#d1b485',3,0.5);
  };
  props.stall = (c) => {
    for(const x of [2,28]){p(c,x,6,dark,2,22);p(c,x,10,edge,0.5,15);}
    rect(c,1,17,30,10,'#92704e');p(c,2,17,'#dbbc83',28,2);p(c,2,25,dark,28,1);
    for(let x=4;x<30;x+=6){p(c,x,20,'#b58f5f',4,4);grain(c,x,20,4,4,x);}
    for(let i=0;i<6;i++){const x=4+i*4;rect(c,x,13,4,4,['#b76045','#d9b85f','#7d9d5b'][i%3],dark);p(c,x+1,13,'#e9cf83',1,1);p(c,x+1,12,'#517248',1,1);}
    for(let i=0;i<8;i++){
      const x=i*4, red=i%2===0;p(c,x,2,red?'#a95443':'#d8ceb1',4,7);p(c,x,2,red?'#d88a69':'#f4e8c7',4,1);
      p(c,x,8,red?'#813e36':'#aca58d',4,1);p(c,x+0.5,9,red?'#b96c53':'#e9dbbc',3,2);
    }
    p(c,0,1,dark,32,1);
  };
  props.flowerbox = (c) => {
    rect(c,0,5,16,5,'#a77b53');p(c,1,5,edge,14,1);p(c,2,7,dark,12,0.5);
    for(let i=0;i<5;i++){const x=2+i*3,y=2+i%2;p(c,x,y+1,'#537346',1,3);p(c,x-1,y+1,'#789451',3,1);p(c,x-1,y,['#c27883','#e2c477','#e7dfc7'][i%3],2,2);p(c,x,y,'#f8dfb2',0.5,0.5);}
  };

  props.futon = (c) => {
    rect(c,0,0,18,30,'#d3c7a8','#827561');p(c,1,1,'#eee4c9',16,27);
    rect(c,3,2,12,6,'#f7edda','#c4b9a1');p(c,4,3,'#fff8e4',9,2);p(c,4,6,'#d5c9ad',10,0.5);
    p(c,1,9,'#4f737d',16,19);p(c,2,10,'#7da2a2',3,16);p(c,14,11,'#3c5c68',3,17);
    p(c,1,9,'#c4d0ba',16,2);p(c,1,11,'#91b1a9',16,0.5);p(c,2,27,'#c4d0ba',14,1);
    for(let y=14;y<26;y+=5)for(let x=6;x<13;x+=4){p(c,x,y,'#a6bdb3',1,0.5);p(c,x+0.5,y-0.5,'#a6bdb3',0.5,1.5);}
    p(c,4,13,'#94afab',0.5,10);p(c,13,18,'#62868b',0.5,8);
  };
  const tabletop = (c,x,y,w,h) => {
    rect(c,x,y,w,h,'#98704d');p(c,x+1,y+1,'#c8a570',w-2,h-3);p(c,x+1,y+1,'#e2c28a',w-2,0.5);
    p(c,x+1,y+h-2,'#684c3b',w-2,1);grain(c,x+2,y+2,w-4,h-5,12);
  };
  props.table = (c) => {
    for(const x of [2,22]){rect(c,x,0,8,5,'#a65c4e','#704b43');p(c,x+1,1,'#cf9274',6,0.5);p(c,x+3,2,'#dfb282',2,0.5);}
    tabletop(c,2,5,28,12);for(const x of [4,26]){p(c,x,17,dark,2,3);p(c,x,17,'#af8659',0.5,2);}
    p(c,11,9,'#655f47',13,5);p(c,12,9,'#9f784f',11,3);
    cup(c,13,9);cup(c,19,9,'#adc5c0');p(c,15,7,'#c2d0bc',4,2);p(c,16,6,'#e1e2c7',2,1);
  };
  props.desk = (c) => {
    tabletop(c,0,2,26,10);for(const x of [2,22]){p(c,x,12,dark,2,6);p(c,x,12,'#b38c5d',0.5,5);}
    p(c,4,4,'#eae0c2',8,5);p(c,5,5,'#a3987b',5,0.5);p(c,5,6.5,'#b1a486',4,0.5);
    p(c,9,4,'#f7edcf',3,4);p(c,9,4,'#c9bb99',0.5,4);rect(c,16,4,4,5,'#647e74');p(c,17,4,'#b5bd97',1,1);
    p(c,21,3,'#655d48',1,4);p(c,21,3,'#e2d4b1',0.5,3);
  };
  props.shelf = (c) => {
    rect(c,0,0,16,28,'#6d5342');p(c,1,1,edge,14,1);p(c,1,2,'#c09561',1,24);p(c,14,2,'#4a4038',1,25);
    const cols=['#a55e4e','#668782','#d2b56e','#7c8b62','#897283','#d4ceb0'];
    for(let r=0;r<3;r++){
      p(c,2,3+r*8,'#4f4940',12,6);
      for(let i=0;i<5;i++){const x=2+i*2.5,y=3+r*8+(i%2);p(c,x,y,cols[(i+r)%6],2,6-i%2);p(c,x+0.5,y+1,'#e0cca0',1,0.5);p(c,x,y+4,'#c1b28d',1.5,0.5);}
      p(c,1,9+r*8,'#c4a06c',14,1);p(c,1,10+r*8,'#4a4036',14,0.5);
    }
    p(c,0,26,dark,16,2);
  };
  props.kitchen = (c) => {
    rect(c,0,8,32,20,'#b6b79c','#66685b');p(c,1,10,'#eee2c2',30,3);p(c,1,13,'#7d806d',30,1);
    for(const x of [2,17]){rect(c,x,16,13,10,'#c8c2a4','#979c84');p(c,x+1,17,'#e2d7b7',11,0.5);p(c,x+9,19,'#677e73',1,3);}
    p(c,1,27,'#647366',30,1);p(c,3,10,'#4d5b55',10,2);p(c,4,10,'#8b9383',8,0.5);
    poly(c,'#545f5c',[[5,5],[7,4],[11,4],[13,6],[12,9],[6,9]]);p(c,7,4,'#b0b8a2',4,1);p(c,8,3,'#5e635b',2,1);p(c,5,6,'#8e9d90',1,2);
    rect(c,19,9,10,4,'#7faaa5','#849685');p(c,20,10,'#b4ccc0',7,1);p(c,24,5,'#71867d',1,5);p(c,24,5,'#a4b3a0',3,1);p(c,27,6,'#85978c',0.5,2);
    p(c,16,6,'#a6684e',2,3);p(c,16,5,'#709467',1,2);
  };
  props.chest = (c) => {
    rect(c,0,2,16,12,'#99734e');p(c,1,3,'#bf9a61',14,3);p(c,1,3,'#dfc08a',14,0.5);grain(c,1,8,14,5,9);
    p(c,0,7,dark,16,1);for(const x of [2,12]){p(c,x,3,'#5c6b62',2,10);p(c,x,3,'#a7b098',0.5,10);p(c,x+0.5,11,'#d4c69a',0.5,0.5);}
    rect(c,6,6,4,4,'#c9b16e','#756b4a');p(c,7.5,7,'#454c43',0.5,1.5);
  };
  props.counter = (c) => {
    p(c,0,5,dark,16,15);p(c,0,5,'#c4a576',16,3);p(c,0,4,'#e0c28d',16,1);p(c,0,8,'#5e4c3c',16,1);
    p(c,0,10,'#a27d53',16,8);p(c,1,11,'#bf9761',14,0.5);p(c,1,12,'#8d6d4a',0.5,5);p(c,15,11,'#70563f',0.5,7);
    grain(c,2,12,12,5,4);p(c,0,18,'#6b5440',16,2);
  };
  props.window = (c) => {
    rect(c,0,0,16,12,'#b0c9bd',dark);p(c,1,1,'#d9e2ce',14,1);p(c,1,2,'#b5cdbf',14,6);
    poly(c,'#85a791',[[1,7],[4,5],[7,7],[10,4],[15,6],[15,10],[1,10]]);p(c,1,9,'#79967a',14,2);
    poly(c,'#dce6d2',[[2,2],[5,2],[2,5]]);p(c,7,1,'#a27b53',1,10);p(c,1,6,'#8a6b4a',14,1);
    p(c,0,11,'#c5a472',16,1);p(c,0,10.5,'#e7c996',16,0.5);p(c,7,1,'#d4b786',0.5,10);
  };
  props.plant = (c) => {
    p(c,3,14,'#765747',8,7);p(c,4,15,'#c29673',6,5);p(c,4,15,'#e0b48b',1,4);p(c,3,13,'#d0aa7d',8,2);p(c,4,13,'#655e45',6,1);
    p(c,7,5,'#466d46',0.5,9);leaf(c,7,3);leaf(c,7,6,true);leaf(c,7,8);leaf(c,7,10,true);
  };
  props.flowerpot = (c) => {
    rect(c,2,10,8,6,'#ad7e60','#795b48');p(c,3,11,'#d8ac80',1,3);p(c,2,9,'#d7b78c',8,2);p(c,3,9,'#676a4a',6,0.5);
    p(c,6,3,'#54774d',0.5,7);leaf(c,6,4,true);leaf(c,6,5);
    for(const [x,y] of [[4,1],[6,0],[7,2],[5,3]])p(c,x,y,'#e9c980',2,2);p(c,5.5,2,'#bb7851',1.5,1.5);
  };
  props.tansu = (c) => {
    rect(c,0,0,20,30,'#6d5543');p(c,1,1,'#d4b27c',18,1);p(c,1,2,'#b48a59',1,26);
    for(let r=0;r<4;r++){
      const y=3+r*6;rect(c,3,y,14,5,'#ad8657','#634f3e');p(c,4,y+1,'#d0ab75',12,0.5);grain(c,4,y+1,11,3,r+8);
      p(c,8,y+2,'#46594f',4,2);p(c,9,y+2.5,'#b3b38d',2,0.5);
    }
    for(const x of [1,17]){p(c,x,2,'#526155',2,2);p(c,x,25,'#526155',2,3);p(c,x+0.5,3,'#c2bb90',0.5,0.5);}
    p(c,0,28,dark,20,2);
  };
  props.wardrobe = (c) => {
    rect(c,0,0,20,32,'#715740');p(c,1,1,'#d3b27a',18,1);p(c,1,2,'#be9867',1,27);
    for(const x of [3,11]){
      rect(c,x,3,6,25,'#ac8659','#806344');p(c,x+1,4,'#c7a36f',4,0.5);
      p(c,x+1,6,'#9c794f',4,17);grain(c,x+1,7,3,15,x,true);
    }
    p(c,9,2,'#594c3d',1,27);p(c,7,15,'#4b5d51',1,3);p(c,12,15,'#4b5d51',1,3);
    p(c,7,15,'#bfb68b',0.5,2);p(c,12,15,'#bfb68b',0.5,2);p(c,0,29,dark,20,3);
  };
  props.andon = (c) => {
    p(c,5,16,dark,2,4);p(c,2,20,dark,8,2);p(c,3,20,'#bd9c6a',6,0.5);
    rect(c,1,2,10,14,'#e4d29e',dark);p(c,2,3,'#fff0bf',5,12);p(c,7,3,'#d3b982',3,12);
    p(c,6,3,'#a08b64',0.5,12);p(c,1,8,'#9e825b',10,0.5);p(c,1,14,'#c3a978',10,0.5);
  };
  props.screen = (c) => {
    for(let i=0;i<3;i++){
      const x=i*8;rect(c,x,0,8,26,i%2?'#e4d8b8':'#e9dfc1',dark);p(c,x+1,1,'#c1a477',6,0.5);
      for(const y of [7,15])p(c,x+1,y,'#d2c29e',6,0.5);p(c,x+6.5,2,'#c9b58e',0.5,22);
    }
    // Веточка бамбука на бумажных створках.
    for(let i=0;i<16;i++){const x=5+Math.floor(i*0.75);p(c,x,22-i,'#6d8267',0.5,1.5);}
    for(const [x,y] of [[8,17],[11,13],[14,9],[16,6]]){leaf(c,x,y);leaf(c,x,y-2,true);}
  };
  props.rack = (c) => {
    for(const x of [1,23]){p(c,x,2,dark,2,24);p(c,x,3,'#c2a273',0.5,21);}
    for(const y of [2,14]){p(c,1,y,'#74593f',24,2);p(c,2,y,'#c3a674',22,0.5);}
    for(let i=0;i<4;i++){
      const x=6+i*4;poly(c,'#94a9a2',[[x,4],[x+1,5],[x+1,12],[x-0.5,11]]);p(c,x,5,'#e3e5ca',0.5,5);
      p(c,x-1,12,'#4b5a52',3,1);p(c,x,13,'#b09868',0.5,2);
    }
    for(let i=0;i<3;i++){
      const x=7+i*5;poly(c,'#91a49b',[[x,17],[x+1,19],[x+3,20],[x+1,21],[x,23],[x-1,21],[x-3,20],[x-1,19]]);p(c,x,20,'#46534e',0.5,0.5);
    }
  };
  props.bed = (c) => {
    rect(c,0,0,18,30,'#aabeb3','#627e77');p(c,1,1,'#dae5d2',16,27);
    rect(c,3,2,12,6,'#f9f4dc','#bdcbbc');p(c,4,3,'#fffbe9',9,2);
    p(c,1,10,'#b9d0c5',16,18);p(c,2,11,'#e2e8d6',12,15);p(c,14,11,'#9fbcb3',3,17);
    p(c,1,10,'#f6f0d9',16,2);p(c,4,13,'#cbdcd0',0.5,11);p(c,0,28,'#79958b',18,2);p(c,1,28,'#c9dac9',16,0.5);
  };
  props.stool = (c) => {
    p(c,3,5,'#525c50',1,5);p(c,7,5,'#525c50',1,5);p(c,3,8,'#89927a',5,0.5);
    poly(c,'#674b40',[[2,0],[8,0],[10,2],[9,5],[1,5],[0,2]]);p(c,2,1,'#ba7960',6,3);p(c,3,1,'#e2ac80',4,0.5);p(c,4,4,'#874e44',4,0.5);
  };
  props.sign = (c) => {
    p(c,7,8,dark,2,10);p(c,7,10,'#b19465',0.5,7);rect(c,1,1,14,9,'#be9e6b',dark);p(c,2,2,'#e0c697',12,0.5);
    p(c,3,4,'#8e6b4c',7,0.5);p(c,3,6,'#8e6b4c',5,0.5);poly(c,'#667956',[[10,4],[12,5],[10,7]]);
    p(c,2,2,'#697360',0.5,0.5);p(c,13,8,'#697360',0.5,0.5);
  };
  props.planter = (c) => {
    rect(c,2,22,16,8,'#a6ac97','#6f8174');p(c,3,23,'#d7d6b8',14,1);p(c,4,23,'#5f674c',12,1);p(c,3,25,'#c6c8ac',2,3);
    p(c,9,12,'#705b3f',2,11);p(c,9,13,'#ba9a63',0.5,9);
    const clusters=[[9,8,6],[5,11,4],[14,11,4],[7,4,3],[13,5,4]];
    for(let i=0;i<clusters.length;i++){
      const [x,y,r]=clusters[i];G.shade.ball(c,x,y,r,r*0.8,['#365c46','#52794f','#7c9c60','#a7b77b'],{noise:0.35,seed:53+i});
    }
  };
  props.lowtable = (c) => {
    tabletop(c,0,3,28,9);for(const x of [2,24]){p(c,x,12,dark,2,4);p(c,x,12,'#c19c69',0.5,3);}
    cup(c,5,2);cup(c,12,3);cup(c,19,2,'#b5c5b8');p(c,7,0,'#bacbad',3,2);p(c,8,0,'#e3dec1',1,0.5);
  };
  props.cups = (c) => {
    for(const [x,y] of [[1,3],[6,1],[11,4]]){
      p(c,x,y,'#827660',4,4);p(c,x+0.5,y+1,'#eee0bb',3,3);p(c,x,y,'#f8ebc9',4,1);
      p(c,x+1,y,'#8d7354',2,0.5);p(c,x+0.5,y+2,'#b87558',3,0.5);
    }
  };
  props.vase = (c) => {
    poly(c,'#527a7b',[[3,9],[7,9],[8,13],[7,17],[3,17],[2,13]]);p(c,3,10,'#b7d0bc',1,5);p(c,4,16,'#405f64',3,1);
    p(c,5,3,'#7a694c',0.5,7);p(c,4,5,'#7a694c',1.5,0.5);
    for(const [x,y] of [[4,1],[1,4],[7,5]]){p(c,x,y,'#c9888d',2,2);p(c,x+0.5,y,'#f2c8ba',1,0.5);}
  };
  props.bonsai = (c) => {
    rect(c,3,13,8,5,'#8c9b86','#576b5c');p(c,4,13,'#d5d0aa',6,1);p(c,4,14,'#6b6c4e',6,0.5);
    poly(c,dark,[[6,14],[7,8],[4,6],[5,5],[9,8],[8,13]]);
    for(const [x,y,r] of [[7,3,3],[3,6,2],[10,7,2]])G.shade.ball(c,x,y,r,r*0.65,['#3f6347','#71915c','#a1b276'],{noise:0.25,seed:x});
  };
  const cushion = (c, blue) => {
    rect(c,1,1,12,6,blue?'#668780':'#a4675a',blue?'#475f5b':'#704d43');
    p(c,2,2,blue?'#a0b7a2':'#d6a37c',10,0.5);p(c,3,5,blue?'#567770':'#8f574b',8,0.5);
    p(c,6,3,'#d9c99c',2,1);p(c,6.5,2.5,'#d9c99c',1,2);
  };
  props.cushion = (c) => { cushion(c,false); };
  props.cushion_b = (c) => { cushion(c,true); };
  const smallRug = (c, blue) => {
    p(c,0,0,blue?'#455e58':'#684d40',32,20);p(c,1,1,blue?'#7a9888':'#ac7960',30,18);
    p(c,3,3,'#d0b986',26,14);p(c,4,4,blue?'#5f8074':'#925d4d',24,12);
    for(let x=6;x<27;x+=6){poly(c,'#c8b789',[[x,10],[x+2,7],[x+4,10],[x+2,13]]);p(c,x+1.5,9,'#eddbab',1,1);}
    for(let x=1;x<31;x+=2){p(c,x,0,'#cfc29a',0.5,1);p(c,x,19,'#cfc29a',0.5,1);}
  };
  props.rug_red = (c) => { smallRug(c,false); };
  props.rug_blue = (c) => { smallRug(c,true); };
  // Предметы, по которым узнаётся назначение комнаты.
  const details = {};
  const detail = (name, w, h, draw, box = null, layer = 'floor') => {
    details[name] = [w, h, draw, -w / 2, 1 - h, box, layer];
  };
  detail('ramen_stack', 14, 18, (c) => {
    for (let row=0;row<3;row++) for (let i=0;i<2;i++) {
      const x=1+i*6,y=12-row*5;rect(c,x,y,6,5,'#ece0bb','#8d7758');p(c,x+1,y+2,'#b96c4e',4,1);p(c,x+1,y,'#f8eac6',4,1);
    }
  }, {x:-6,y:-5,w:12,h:5}, null);
  detail('family_photo', 14, 14, (c) => {
    rect(c,0,0,14,14,'#cabd9c',dark);p(c,2,2,'#8c9d8c',10,10);
    for (const [x,y,col] of [[3,3,'#635866'],[7,3,'#765f52'],[5,7,'#536e6b']]) {p(c,x,y,'#d3b28a',2,2);p(c,x-1,y+2,col,4,3);}
    p(c,1,1,edge,12,0.5);
  });
  detail('herb_bundle', 12, 18, (c) => {
    p(c,1,1,dark,10,1);p(c,6,1,'#b8a36d',0.5,7);
    for(let i=0;i<4;i++){p(c,3+i*2,6,'#858c53',0.5,9);leaf(c,3+i*2,8,i%2===0);p(c,2+i*2,14,'#a1ad71',2,2);}
    p(c,3,7,'#c7b77c',7,1);
  });
  detail('medicine_case', 16, 28, (c) => {
    rect(c,0,0,16,28,'#6e897c',dark);p(c,1,1,'#c6d1b7',14,1);
    for(let row=0;row<3;row++) {
      p(c,2,3+row*8,'#425f58',12,6);
      for(let i=0;i<4;i++){const x=3+i*3,y=5+row*8;p(c,x,y,['#a6be9c','#d0b782','#a0b9b0'][row],2,4);p(c,x,y-1,'#d8d1ad',2,1);p(c,x,y+1,'#eee2bf',2,1);}
      p(c,1,10+row*8,'#a8b69c',14,1);
    }
  }, {x:-8,y:-6,w:16,h:6}, null);
  detail('insect_case', 24, 22, (c) => {
    rect(c,0,0,24,22,'#657b64',dark);p(c,2,2,'#a9bc96',20,15);p(c,3,3,'#c3cfaa',2,12);
    for(let i=0;i<4;i++){const x=5+i*4,y=6+i%2*4;p(c,x,y,'#52674d',2,3);p(c,x-1,y+1,'#6e7951',4,1);}
    p(c,1,18,'#a28a5e',22,3);p(c,11,2,'#658072',1,15);
  }, {x:-11,y:-6,w:22,h:6}, null);
  detail('shogi_table', 28, 16, (c) => {
    tabletop(c,0,3,28,9);p(c,6,4,'#dcc28c',16,6);
    for(let x=7;x<22;x+=2)p(c,x,4,'#b2915e',0.5,6);
    for(let y=5;y<10;y+=1.5)p(c,6,y,'#b2915e',16,0.5);
    for(const [x,y] of [[8,5],[12,8],[18,5],[16,7]]){p(c,x,y,'#685b42',1,1);p(c,x,y,'#e5cc91',0.5,0.5);}
    p(c,2,12,dark,2,4);p(c,24,12,dark,2,4);
  }, {x:-13,y:-7,w:26,h:7}, null);
  detail('bbq_table', 28, 16, (c) => {
    tabletop(c,0,3,28,9);rect(c,8,4,12,6,'#4c5850','#9caa96');
    for(let x=9;x<20;x+=2)p(c,x,5,'#9b9b80',0.5,4);p(c,11,6,'#bb7653',3,1);p(c,16,7,'#e0a16a',2,1);
    cup(c,2,4);cup(c,22,5);p(c,2,12,dark,2,4);p(c,24,12,dark,2,4);
  }, {x:-13,y:-7,w:26,h:7}, null);
  detail('produce_tray', 28, 10, (c) => {
    rect(c,0,2,28,8,'#a38857',dark);
    for(let i=0;i<8;i++){const x=2+i*3;const col=['#b9684c','#879e59','#d5b666'][i%3];p(c,x,3+i%2,col,3,4);p(c,x+1,3,'#e9cd87',1,1);p(c,x+1,2,'#54754a',1,1);}
    p(c,1,8,'#d3af70',26,1);
  });
  detail('dango_tray', 24, 10, (c) => {
    rect(c,0,3,24,7,'#7a6547',dark);p(c,1,4,'#bf9b67',22,4);
    for(let i=0;i<4;i++){const x=3+i*5;p(c,x,1,'#d9bf86',0.5,7);for(let j=0;j<3;j++)p(c,x-1,j*2,['#dfa9a1','#eee0bb','#9dad7c'][j],3,2);}
  });
  detail('dog_bed', 22, 12, (c) => {
    rect(c,0,2,22,10,'#a88b61','#6d6850');p(c,2,3,'#d1b080',18,7);p(c,4,4,'#7c9883',14,5);
    p(c,7,6,'#e6d5a9',7,1);p(c,7,5,'#e6d5a9',2,3);p(c,12,5,'#e6d5a9',2,3);
  });
  detail('laundry_bundle', 14, 10, (c) => {
    poly(c,'#556f7b',[[1,8],[2,3],[6,1],[11,3],[13,9]]);p(c,4,3,'#a8b9b3',4,3);p(c,8,6,'#7c959b',4,2);p(c,1,8,'#c6b995',5,1);
  });
  detail('parcel', 12, 12, (c) => {
    rect(c,0,1,12,11,'#c5ac7b',dark);p(c,1,2,'#e7c998',10,1);p(c,5,2,'#eee1b9',1,9);p(c,1,6,'#eee1b9',10,1);p(c,7,3,'#a05e4b',3,2);
  });
  detail('broken_lamp', 12, 30, (c) => {
    props.lamp(c);p(c,3,3,'#62716a',6,6);p(c,4,3,'#899380',1,5);poly(c,'#38473f',[[8,2],[5,5],[7,5],[4,9],[6,7],[5,6]]);
  }, {x:-3,y:-3,w:6,h:3}, null);
  detail('village_board', 24, 28, (c) => {
    p(c,3,18,dark,2,10);p(c,19,18,dark,2,10);rect(c,0,1,24,20,'#a3865d',dark);p(c,1,2,edge,22,1);
    for(const [x,y] of [[3,5],[13,6]]){p(c,x,y,'#eee1bc',8,11);p(c,x+1,y+2,'#b76c50',5,1);p(c,x+1,y+5,'#9e9677',5,0.5);p(c,x+1,y+7,'#9e9677',4,0.5);}
  }, null, null);
  const crests = {nara:'#697b50',akimichi:'#b47653',hyuga:'#bbb7a0',inuzuka:'#a66c55',aburame:'#627363',senju:'#7c9570',sarutobi:'#ba8d59',yamanaka:'#b98b9c',uchiha:'#a3584f'};
  for(const [clan,col] of Object.entries(crests))detail('crest_'+clan,16,16,(c)=>{
    rect(c,1,0,14,16,'#e4d8b8',dark);p(c,3,3,col,10,1);p(c,5,5,col,6,6);p(c,7,11,col,2,2);
    if(clan==='uchiha'){p(c,4,4,col,8,4);p(c,4,8,'#f2e6c9',8,3);}
    else if(clan==='hyuga')poly(c,col,[[8,4],[12,8],[8,12],[4,8]]);
    else if(clan==='yamanaka'){p(c,4,7,'#e9c3c0',8,2);p(c,7,4,'#e9c3c0',2,8);}
    else if(clan==='nara'){p(c,4,5,'#e2d4ac',2,4);p(c,10,5,'#e2d4ac',2,4);}
  });
  return { floor, tatami, stone, wall, props, details };
})();
