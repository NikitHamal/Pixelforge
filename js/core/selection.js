window.PF = window.PF || {};
PF.Selection = (() => {
  let selection=null, start=null, clipboard=null;
  const get=()=>selection;
  const clear=()=>{selection=null;start=null;PF.Renderer.invalidate();PF.Store.emit('selection',null);};
  function set(rect) {
    const doc=PF.Store.get();
    for(const key of ['x','y','width','height']) if(!Number.isInteger(rect[key])) throw new Error('Selection coordinates must be integers.');
    if(rect.x<0||rect.y<0||rect.width<1||rect.height<1||rect.x+rect.width>doc.width||rect.y+rect.height>doc.height) throw new Error('Selection is outside the canvas.');
    selection={...rect};PF.Renderer.invalidate();PF.Store.emit('selection',selection);return selection;
  }
  function copy(cut=false) {
    const doc=PF.Store.get(), region=selection||{x:0,y:0,width:doc.width,height:doc.height}, source=PF.Store.pixels();
    if(cut&&PF.Store.layer().locked) throw new Error('Unlock the layer before cutting.');
    clipboard={...region,pixels:new Uint32Array(region.width*region.height)};
    for(let row=0;row<region.height;row++) for(let column=0;column<region.width;column++) clipboard.pixels[row*region.width+column]=source[(row+region.y)*doc.width+column+region.x];
    if(cut) erase();
    return {width:region.width,height:region.height};
  }
  function edit(operation) {
    if(PF.Store.layer().locked) throw new Error('Unlock the layer first.');
    PF.Input.cancel();PF.Anim.pause();
    const pixels=PF.Store.beginStroke();
    try { operation(pixels,PF.Store.get());PF.Store.endStroke(); }
    catch(error) {PF.Store.cancelStroke();throw error;}
  }
  function paste(left=selection?.x ?? clipboard?.x ?? 0,top=selection?.y ?? clipboard?.y ?? 0) {
    if(!clipboard) throw new Error('Copy a selection first. The pixel clipboard is local to this tab.');
    edit((pixels,doc)=>{
      for(let row=0;row<clipboard.height;row++) for(let column=0;column<clipboard.width;column++) {
        const targetX=left+column,targetY=top+row,value=clipboard.pixels[row*clipboard.width+column];
        if(targetX>=0&&targetX<doc.width&&targetY>=0&&targetY<doc.height&&value>>>24) pixels[targetY*doc.width+targetX]=value;
      }
    });
  }
  function erase() {
    edit((pixels,doc)=>{const region=selection||{x:0,y:0,width:doc.width,height:doc.height};for(let row=0;row<region.height;row++) pixels.fill(0,(row+region.y)*doc.width+region.x,(row+region.y)*doc.width+region.x+region.width);});
  }
  function move(horizontal,vertical) {
    if(!Number.isInteger(horizontal)||!Number.isInteger(vertical)) throw new Error('Movement must use whole pixels.');
    const region=selection;
    if(!region) { edit((pixels,doc)=>pixels.set(PF.Raster.shift(pixels,doc.width,doc.height,horizontal,vertical,false)));return; }
    const doc=PF.Store.get(),left=Math.max(0,Math.min(doc.width-region.width,region.x+horizontal)),top=Math.max(0,Math.min(doc.height-region.height,region.y+vertical));
    edit((pixels,document)=>{
      const saved=[];
      for(let row=0;row<region.height;row++) for(let column=0;column<region.width;column++) {saved.push(pixels[(region.y+row)*document.width+region.x+column]);pixels[(region.y+row)*document.width+region.x+column]=0;}
      for(let row=0;row<region.height;row++) for(let column=0;column<region.width;column++) {const value=saved[row*region.width+column];if(value>>>24) pixels[(top+row)*document.width+left+column]=value;}
    });
    set({...region,x:left,y:top});
  }
  function flip(axis='x') {
    edit((pixels,doc)=>{
      const region=selection||{x:0,y:0,width:doc.width,height:doc.height}, source=pixels.slice();
      for(let row=0;row<region.height;row++) for(let column=0;column<region.width;column++) {
        const sourceX=axis==='x'?region.width-1-column:column,sourceY=axis==='y'?region.height-1-row:row;
        pixels[(row+region.y)*doc.width+column+region.x]=source[(sourceY+region.y)*doc.width+sourceX+region.x];
      }
    });
  }
  function init(canvas) {
    const point=event=>{const value=PF.Renderer.toPixel(event.clientX,event.clientY),doc=PF.Store.get();return {x:Math.max(0,Math.min(doc.width-1,value.x)),y:Math.max(0,Math.min(doc.height-1,value.y))};};
    canvas.addEventListener('pointerdown',event=>{
      if(PF.Input.get().tool!=='select'||PF.Input.get().spaceHeld||event.button!==0) return;
      event.stopImmediatePropagation();event.preventDefault();PF.Anim.pause();canvas.setPointerCapture(event.pointerId);start={...point(event),pointerId:event.pointerId};set({x:start.x,y:start.y,width:1,height:1});
    },true);
    canvas.addEventListener('pointermove',event=>{
      if(!start||event.pointerId!==start.pointerId) return;
      event.stopImmediatePropagation();const current=point(event);set({x:Math.min(current.x,start.x),y:Math.min(current.y,start.y),width:Math.abs(current.x-start.x)+1,height:Math.abs(current.y-start.y)+1});
    },true);
    canvas.addEventListener('pointerup',()=>{start=null;},true);
    canvas.addEventListener('pointercancel',clear,true);
    PF.Store.on('doc',clear);PF.Store.on('active',clear);
  }
  return {init,get,set,clear,copy,paste,erase,move,flip};
})();
