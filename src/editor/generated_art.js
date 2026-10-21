// Только редактор: новые мастеры не подменяют игровые G.tiles / сохранения.
G.editorArt=(()=>{
 const cache=new Map();
 function sprite(id){
  const a=G.EDITOR_ART[id];if(!a)return null;
  if(cache.has(id))return cache.get(id);
  const img=G.gfx.canvas(a.w,a.h),c=img.getContext('2d'),im=c.createImageData(img.width,img.height),raw=atob(a.pixels);
  for(let i=0;i<raw.length;i++)im.data.set(a.pal[raw.charCodeAt(i)],i*4);
  c.putImageData(im,0,0);
  const s={img,w:a.w,h:a.h,ox:a.ox,oy:a.oy};cache.set(id,s);return s;
 }
 return{sprite,ids:Object.keys(G.EDITOR_ART)};
})();
