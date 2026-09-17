window.PF = window.PF || {};
PF.Anim = (() => {
  const PRESETS = [['idle',4,6],['walk',8,10],['run',8,14],['jump',6,10],['fall',4,8],['land',4,12],['sword',8,12],['pickaxe',8,10],['axe',8,10],['shoot',8,12],['cast',8,10],['block',4,8],['hurt',4,12],['death',8,8],['roll',8,14],['eat',6,6],['drink',6,6],['sleep',4,3],['carry',8,8],['use',8,8],['pickup',6,8],['swim',8,8],['fish',6,6]];
  let playing=false, elapsed=0, last=0, handle=0;
  function play() {if(playing)return;PF.Input?.cancel();playing=true;elapsed=0;last=performance.now();handle=requestAnimationFrame(tick);PF.Store.emit('play',true);}
  function pause() {if(!playing)return;playing=false;cancelAnimationFrame(handle);PF.Store.emit('play',false);}
  function tick(time) {
    if(!playing)return;
    const state=PF.Store.state();elapsed+=Math.min(250,time-last);last=time;
    let frame=PF.Store.get().activeFrame, steps=0;
    while(elapsed>=state.frames[frame].duration&&steps++<32) {
      elapsed-=state.frames[frame].duration;
      if(frame+1>=state.frames.length&&!state.loop) {PF.Store.setActive({frame:state.frames.length-1});pause();return;}
      frame=(frame+1)%state.frames.length;
    }
    if(frame!==PF.Store.get().activeFrame) PF.Store.setActive({frame});
    handle=requestAnimationFrame(tick);
  }
  function uniqueName(base) {const names=new Set(PF.Store.get().states.map(state=>state.name));let name=base,suffix=2;while(names.has(name))name=`${base}-${suffix++}`;return name;}
  function createFromPreset(name,{copyCurrent=true}={}) {
    const preset=PRESETS.find(value=>value[0]===name)||[name,4,8], source=PF.Store.frame();
    const index=PF.Store.addState({name:uniqueName(preset[0]),fps:preset[2],frames:preset[1]});
    if(copyCurrent) PF.Store.transact(doc=>{for(const frame of doc.states[index].frames) for(const id of Object.keys(source.pixels)) frame.pixels[id].set(source.pixels[id]);});
    return index;
  }
  const preview=(()=>{
    let canvas,index=0,elapsed=0,last=0,stateId=null,dirty=true,enabled=false;
    function init(element) {
      canvas=element;
      PF.Store.on('change',()=>{dirty=true;});PF.Store.on('doc',()=>{stateId=null;index=0;elapsed=0;dirty=true;});
      requestAnimationFrame(loop);
    }
    function loop(time) {
      const state=PF.Store.state();
      if(state.id!==stateId) {stateId=state.id;index=0;elapsed=0;dirty=true;}
      if(index>=state.frames.length) index=0;
      if(enabled&&!document.hidden) {
        elapsed+=Math.min(250,last?time-last:0);
        while(elapsed>=state.frames[index].duration) {
          elapsed-=state.frames[index].duration;
          if(index===state.frames.length-1&&!state.loop) {elapsed=0;break;}
          index=(index+1)%state.frames.length;dirty=true;
        }
      }
      last=time;
      if(dirty&&!document.hidden) {PF.Renderer.frameToCanvas(state.frames[index],4,canvas);dirty=false;}
      requestAnimationFrame(loop);
    }
    return {init,setState:()=>{stateId=null;},setPlaying:value=>{enabled=value;index=0;elapsed=0;dirty=true;},isPlaying:()=>enabled};
  })();
  PF.Store.on('doc',pause);
  document.addEventListener('visibilitychange',()=>{last=performance.now();});
  return {PRESETS,play,pause,toggle:()=>playing?pause():play(),isPlaying:()=>playing,createFromPreset,uniqueName,preview};
})();
