// Модульные укрепления: камера сверху под углом, привязка к клеткам 16 px.
// Только палитра редактора; не меняет коллизии и объекты игровой деревни.
G.villageArt=(()=>{
 const specs={vwall_h:[32,40],vwall_v:[16,56],vwall_corner:[32,56],vwall_end:[16,40],vgate:[128,72]};
 const cache={};
 function sprite(id){if(!specs[id])return null;if(cache[id])return cache[id];
 const [w,h]=specs[id],img=G.gfx.canvas(w,h),c=img.getContext('2d');
 const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
 function wall(x,y,width){
 rect(x,y,width,32,'#665b49');rect(x,y+2,width,27,'#c2b88a');
 rect(x,y+4,width,2,'#d9cca0');rect(x,y+22,width,7,'#aaa078');
 for(let yy=9;yy<28;yy+=7)for(let xx=0;xx<width;xx+=8){const k=G.util.hash2(xx+x,yy+y,73);if(k>.45)rect(x+xx,y+yy,3,1,'#b1a77d');}
 rect(x,y+29,width,3,'#777568');rect(x,y+29,width,1,'#929481');
 for(let xx=0;xx<width;xx+=16){rect(x+xx,y+29,1,3,'#595e53');}
 rect(x,y,width,3,'#384b43');rect(x,y-5,width,5,'#65765b');rect(x,y-5,width,1,'#899571');
 for(let xx=0;xx<width;xx+=8)rect(x+xx,y-4,1,4,'#4c6250');
 }
 if(id==='vgate'){
 // Два пилона, открытый проезд и высокие красно-коричневые створки.
 wall(0,40,24);wall(104,40,24);
 rect(24,25,80,47,'#392e27');rect(33,30,62,42,'#152b24');c.clearRect(39,35,50,37);
 for(const x of [27,96]){rect(x,29,5,43,'#934b36');rect(x,30,1,40,'#c0784b');for(let y=35;y<70;y+=11)rect(x,y,5,2,'#4a3b2c');}
 rect(18,24,92,7,'#854535');rect(20,25,88,2,'#bd7650');
 rect(14,15,100,9,'#354c42');rect(18,10,92,5,'#506b52');rect(22,5,84,5,'#6b8061');
 rect(12,23,104,3,'#263c35');for(let x=20;x<110;x+=6)rect(x,12,1,11,'#81916b');
 rect(51,18,26,13,'#493b2c');rect(53,19,22,10,'#d2bb79');
 // Знак листа на вывеске, без текстурного шва в стенах.
 c.strokeStyle='#465741';c.lineWidth=1.5;c.beginPath();c.arc(64,24,3,0,Math.PI*1.7);c.lineTo(70,20);c.lineTo(69,27);c.stroke();
 }else if(id==='vwall_v'){
 rect(0,0,16,56,'#50604b');rect(2,0,12,56,'#7a8968');rect(2,0,1,56,'#a2aa7d');for(let y=0;y<56;y+=8)rect(3,y,11,1,'#5c7255');
 }else if(id==='vwall_corner'){
 wall(0,24,32);rect(0,0,16,24,'#50604b');rect(2,0,12,24,'#7a8968');rect(2,0,1,24,'#a2aa7d');for(let y=0;y<24;y+=8)rect(3,y,11,1,'#5c7255');
 }else{wall(0,8,w);if(id==='vwall_end'){rect(2,6,12,31,'#b8b184');rect(2,6,2,31,'#d9cc99');rect(0,2,16,5,'#607657');rect(0,2,16,1,'#94a275');}}
 return cache[id]={img,w,h,ox:-8,oy:-h};
 }
 return{sprite,ids:Object.keys(specs)};
})();
