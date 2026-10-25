// Синхронные встроенные картинки: работают при первом кадре и офлайн.
G.environmentArt=(()=>{
  const data=()=>G.art.data('env')||{sprites:{},bindings:{}},cache=new Map();
  function image(name){
    if(cache.has(name))return cache.get(name);
    const a=data().sprites[name];if(!a)return null;
    const c=G.gfx.canvas(a.w,a.h,true),ctx=c.getContext('2d'),im=ctx.createImageData(a.w,a.h),raw=atob(a.pixels);
    for(let i=0;i<raw.length;i++)im.data.set(a.pal[raw.charCodeAt(i)],i*4);
    ctx.putImageData(im,0,0);cache.set(name,c);return c;
  }
  function draw(ctx,name,w,h,variant=0){
    const names=data().bindings[name];if(!names)return null;
    const asset=names[variant%names.length],img=image(asset);
    const scale=Math.min(w/img.width,h/img.height),dw=img.width*scale,dh=img.height*scale;
    // Сохраняем исходный холст/опору, вписываем пропорционально, привязываем к низу.
    ctx.drawImage(img,(w-dw)/2,h-dh,dw,dh);return asset;
  }
  return {image,draw,get bindings(){return data().bindings;}};
})();
