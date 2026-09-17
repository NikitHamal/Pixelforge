window.PF = window.PF || {};
PF.Workspace = (() => {
  const {query,all,node,button,safe,toast,ask,dialog,confirmAction,download,filename}=PF.UI;
  const store=PF.Store;
  let project=null,assets=[],activeId=null,ready=false,busy=false,dirty=false,editRevision=0,saveTimer=null,saveJob=null,saveBlocked=false,paintScheduled=false;
  const current=()=>assets.find(asset=>asset.id===activeId);
  function setStatus(text,failed=false){query('#save-status').textContent=text;query('#save-status').classList.toggle('failed',failed);}
  function persistentError(error){const element=query('#studio-error');element.hidden=false;element.textContent=error.message;setStatus('Not saved — export a backup',true);}
  function markDirty(){
    if(!ready)return;
    dirty=true;editRevision++;setStatus('Unsaved changes');clearTimeout(saveTimer);
    if(!saveBlocked)saveTimer=setTimeout(()=>flush().catch(persistentError),850);
  }
  async function flush(force=false){
    if(!ready)return;
    if(force){dirty=true;editRevision++;}
    if(saveJob)return saveJob;
    if(!dirty)return project;
    if(saveBlocked)throw new Error('Saving is paused after a storage conflict. Export the active sprite, then reload to reconcile your project.');
    saveJob=(async()=>{
      while(dirty){
        const revision=editRevision,asset=current(),data=store.serialize(),thumbnail=PF.Renderer.frameToCanvas(store.frame(),1).toDataURL('image/png');
        setStatus('Saving locally…');
        try{
          project=await PF.Projects.saveAsset({projectId:project.id,assetId:asset.id,data,thumbnail,revision:project.revision});
          asset.data=data;asset.thumbnail=thumbnail;asset.name=store.get().name;asset.updatedAt=Date.now();
          if(revision===editRevision)dirty=false;
          setStatus(dirty?'Saving latest changes…':'All changes saved locally');
        }catch(error){saveBlocked=true;persistentError(error);throw error;}
      }
      renderAssets();return project;
    })();
    try{return await saveJob;}finally{saveJob=null;}
  }
  const yieldPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
  async function exclusive(operation){
    if(busy)throw new Error('Please wait for the current project operation to finish.');
    busy=true;
    const studio=query('#studio');studio.inert=true;
    try{PF.Input.cancel();PF.Anim.pause();await flush();return await operation();}
    finally{studio.inert=false;busy=false;}
  }
  async function loadAsset(asset){
    setStatus(asset.data?'Opening sprite…':'Building animation suite…');await yieldPaint();
    const data=asset.data||store.serialize(PF.Library.build(asset.templateId));
    ready=false;
    try{store.load(data);activeId=asset.id;dirty=false;editRevision++;}
    finally{ready=true;}
    renderAll();renderAssets();PF.Renderer.fit();setStatus('All changes saved locally');
  }
  async function openAsset(assetId){
    if(assetId===activeId)return;
    return exclusive(async()=>{
      const asset=assets.find(value=>value.id===assetId);if(!asset)throw new Error('Asset not found in this project.');
      const previous=current();
      try{
        project=await PF.Projects.activate(project.id,project.revision,assetId);
        await loadAsset(asset);
      }catch(error){
        setStatus('Could not open asset',true);
        if(previous){activeId=previous.id;if(project.activeAssetId===assetId){try{project=await PF.Projects.activate(project.id,project.revision,previous.id);}catch{}}}
        throw error;
      }
    });
  }
  async function addAsset(options){
    return exclusive(async()=>{
      const result=await PF.Projects.addAsset(project.id,project.revision,options);
      project=result.project;assets.push(result.asset);await loadAsset(result.asset);return {id:result.asset.id,name:result.asset.name};
    });
  }
  async function duplicateAsset(){const data=JSON.parse(store.serialize());data.name+=' · copy';return addAsset({name:data.name,data:JSON.stringify(data)});}
  function renderAssets(){
    const list=query('#asset-list'),needle=query('#asset-search').value.toLowerCase();list.replaceChildren();query('#asset-count').textContent=assets.length;
    const ordered=project.assetIds.map(id=>assets.find(asset=>asset.id===id)).filter(Boolean);
    for(const asset of ordered.filter(item=>item.name.toLowerCase().includes(needle))){
      const selected=asset.id===activeId,entry=asset.templateId?PF.Library.find(asset.templateId):null;
      const image=asset.thumbnail?node('img',{src:asset.thumbnail,alt:''}):node('canvas',{'aria-hidden':'true'});
      const row=button('',()=>openAsset(asset.id),'asset-row',`Open ${asset.name}`);row.setAttribute('aria-pressed',String(selected));row.dataset.agentId=`asset-${asset.id}`;
      row.append(image,node('span',{class:'grow'},[node('strong',{text:asset.name}),node('small',{text:entry?.category||'Custom sprite'})]));list.append(row);
      if(!asset.thumbnail&&entry)PF.Library.drawPreview(image,entry.id);
      else if(!asset.thumbnail){image.width=image.height=32;}
    }
    if(!list.children.length)list.append(node('p',{class:'muted',text:'No matching assets.'}));
  }
  function stateParts(state){
    const match=state.name.match(/^(.*)_(south|east|north|west)$/);
    return match?{action:match[1],direction:match[2]}:{action:state.name,direction:''};
  }
  function renderStates(){
    const states=store.get().states,active=store.state(),parts=stateParts(active),actions=[...new Set(states.map(state=>stateParts(state).action))];
    const select=query('#action-select');select.replaceChildren(...actions.map(action=>node('option',{value:action,text:action.replaceAll('-',' ')})));select.value=parts.action;
    const directions=states.filter(state=>stateParts(state).action===parts.action).map(state=>stateParts(state).direction);
    const direction=query('#direction-select');direction.replaceChildren(...directions.map(value=>node('option',{value,text:value||'All'})));direction.value=parts.direction;direction.disabled=directions.length===1;
    query('#fps').value=active.fps;query('#duration').value=store.frame().duration;query('#loop').checked=active.loop;
    query('#state-name').textContent=`${active.name.replaceAll('_',' / ')} · ${active.frames.length} frames`;
  }
  function renderFrames(){
    const element=query('#frames'),active=store.get().activeFrame,state=store.state();element.replaceChildren();
    state.frames.forEach((frame,index)=>{
      const canvas=PF.Renderer.frameToCanvas(frame,1),control=button('',()=>{PF.Input.cancel();PF.Anim.pause();store.setActive({frame:index});},'frame',`Frame ${index+1}, ${frame.duration} milliseconds`);
      control.setAttribute('aria-pressed',String(index===active));control.dataset.agentId=`frame-${index}`;control.append(canvas,node('small',{text:`${index+1} · ${frame.duration}ms`}));element.append(control);
    });
  }
  function renderLayers(){
    const document=store.get(),element=query('#layers');element.replaceChildren();
    document.layers.map((layer,index)=>({layer,index})).reverse().forEach(({layer,index})=>{
      const visible=button(layer.visible?'◉':'○',()=>store.updateLayer(index,{visible:!layer.visible}),'',`${layer.visible?'Hide':'Show'} ${layer.name}`);visible.dataset.agentId=`layer-${index}-visible`;
      const select=button(layer.name,()=>{PF.Input.cancel();store.setActive({layer:index});},'layer-name',`Select ${layer.name}`);select.dataset.agentId=`layer-${index}`;
      const lock=button(layer.locked?'▣':'□',()=>store.updateLayer(index,{locked:!layer.locked}),'',`${layer.locked?'Unlock':'Lock'} ${layer.name}`);lock.dataset.agentId=`layer-${index}-lock`;
      element.append(node('div',{class:`layer-row${index===document.activeLayer?' selected':''}`},[visible,select,lock]));
    });
    query('#layer-opacity').value=Math.round(store.layer().opacity*100);
  }
  function renderPalette(){
    const palette=query('#palette');palette.replaceChildren();
    store.get().palette.forEach((color,index)=>{
      const control=button('',()=>store.setColor(color),'swatch',`Use ${color}`);control.style.background=color;control.setAttribute('aria-label',`Color ${color}`);control.setAttribute('aria-pressed',String(color===store.get().color));control.dataset.agentId=`palette-${index}`;palette.append(control);
    });syncColor();
  }
  function syncColor(){const color=store.get().color;query('#color-picker').value=color.slice(0,7);query('#color-hex').value=color;all('#palette button').forEach(control=>control.setAttribute('aria-pressed',String(control.title===`Use ${color}`)));}
  function renderAll(){
    if(!store.get())return;
    query('#doc-name').value=store.get().name;query('#doc-dimensions').textContent=`${store.get().width} × ${store.get().height} px`;
    query('#project-name').value=project?.name||'';document.title=`${store.get().name} · PixelForge`;
    renderStates();renderFrames();renderLayers();renderPalette();syncHistory();
  }
  function scheduleRender(){if(paintScheduled)return;paintScheduled=true;requestAnimationFrame(()=>{paintScheduled=false;renderAll();});}
  function syncHistory(){query('#undo').disabled=!store.canUndo();query('#redo').disabled=!store.canRedo();}
  const bind=(id,handler,event='click')=>query(`#${id}`).addEventListener(event,safe(async value=>{if(!ready||busy)throw new Error('The workspace is still opening. Please wait.');return handler(value);}));
  function selectAnimation(){
    const action=query('#action-select').value,direction=query('#direction-select').value;
    const states=store.get().states,index=states.findIndex(state=>stateParts(state).action===action&&stateParts(state).direction===direction);
    const fallback=states.findIndex(state=>stateParts(state).action===action);
    PF.Input.cancel();PF.Anim.pause();store.setActive({state:index>=0?index:fallback});renderStates();
  }
  function bindEditor(){
    const icons={pencil:['✎','B'],eraser:['▱','E'],fill:['◩','G'],line:['╱','L'],rect:['□','R'],ellipse:['○','O'],picker:['⌖','I'],select:['▧','V'],move:['✥','M'],pan:['✋','H'],shade:['◐','U']};
    for(const [tool,[symbol,key]] of Object.entries(icons)){
      const control=button(symbol,()=>PF.Input.setTool(tool),'tool',`${tool[0].toUpperCase()+tool.slice(1)} (${key})`);control.dataset.tool=tool;control.dataset.agentId=`tool-${tool}`;control.setAttribute('aria-label',control.title);query('#tool-strip').append(control);
    }
    store.on('tool',options=>{all('[data-tool]').forEach(control=>control.setAttribute('aria-pressed',String(control.dataset.tool===options.tool)));query('#mirror-x').setAttribute('aria-pressed',String(options.mirrorX));query('#mirror-y').setAttribute('aria-pressed',String(options.mirrorY));query('#brush-size').value=options.size;query('#shape-fill').checked=options.shapeFill;query('#status-left').textContent=`${options.tool} · ${options.size}px`;});
    store.on('view',view=>{query('#zoom-value').textContent=`${view.zoom}×`;query('#grid').setAttribute('aria-pressed',String(view.grid));query('#onion').setAttribute('aria-pressed',String(view.onion));});
    store.on('hover',point=>{if(point)query('#status-left').textContent=`${PF.Input.get().tool} · ${point.x}, ${point.y} px`;});
    store.on('selection',region=>{if(region)query('#status-left').textContent=`Selection ${region.width} × ${region.height} · arrows to move`;});
    store.on('color',()=>{if(ready)editRevision++;syncColor();});store.on('history',syncHistory);store.on('doc',scheduleRender);store.on('change',()=>{markDirty();scheduleRender();});
    store.on('active',()=>{if(ready)editRevision++;all('#frames button').forEach((control,index)=>control.setAttribute('aria-pressed',String(index===store.get().activeFrame)));query('#duration').value=store.frame().duration;if(!PF.Anim.isPlaying()){renderStates();renderFrames();renderLayers();}});
    store.on('play',playing=>{query('#play').textContent=playing?'Ⅱ':'▶';query('#play').setAttribute('aria-label',playing?'Pause animation':'Play animation');});
    bind('undo',()=>{PF.Input.cancel();PF.Anim.pause();store.undo();});bind('redo',()=>{PF.Input.cancel();PF.Anim.pause();store.redo();});
    bind('brush-size',event=>PF.Input.setSize(Number(event.target.value)||1),'change');bind('shape-fill',event=>PF.Input.setOption('shapeFill',event.target.checked),'change');
    bind('mirror-x',()=>PF.Input.setOption('mirrorX',!PF.Input.get().mirrorX));bind('mirror-y',()=>PF.Input.setOption('mirrorY',!PF.Input.get().mirrorY));
    bind('zoom-in',()=>PF.Renderer.zoomBy(1));bind('zoom-out',()=>PF.Renderer.zoomBy(-1));bind('fit',()=>{PF.Renderer.fit();store.emit('view',PF.Renderer.getView());});
    bind('grid',()=>PF.Renderer.setOption('grid',!PF.Renderer.getView().grid));bind('onion',()=>PF.Renderer.setOption('onion',!PF.Renderer.getView().onion));
    bind('play',()=>PF.Anim.toggle());bind('preview-play',()=>{const value=!PF.Anim.preview.isPlaying();PF.Anim.preview.setPlaying(value);query('#preview-play').textContent=value?'Pause Ⅱ':'Preview ▶';query('#preview-play').setAttribute('aria-pressed',String(value));});
    bind('frame-add',()=>store.addFrame({duplicate:false}));bind('frame-duplicate',()=>store.addFrame({duplicate:true}));bind('frame-delete',()=>{if(!store.removeFrame(store.get().activeFrame))toast('Keep at least one frame.');});
    bind('frame-left',()=>store.moveFrame(store.get().activeFrame,-1));bind('frame-right',()=>store.moveFrame(store.get().activeFrame,1));
    bind('fps',event=>store.updateState(store.get().activeState,{fps:Number(event.target.value)}),'change');bind('duration',event=>store.setFrameDuration(store.get().activeFrame,Number(event.target.value)),'change');bind('loop',event=>store.updateState(store.get().activeState,{loop:event.target.checked}),'change');
    bind('action-select',selectAnimation,'change');bind('direction-select',selectAnimation,'change');
    bind('state-add',()=>ask('Add an animation state',[{name:'name',label:'State name (for example: dodge_south)',value:PF.Anim.uniqueName('new-state')},{name:'frames',label:'Blank frames',type:'number',min:1,max:256,value:4},{name:'fps',label:'Frames per second',type:'number',min:1,max:60,value:8}],values=>store.addState({name:values.name,frames:Number(values.frames),fps:Number(values.fps)}),'Add state'));
    bind('state-rename',()=>ask('Rename animation',[{name:'name',label:'State name',value:store.state().name}],values=>store.updateState(store.get().activeState,{name:values.name})));
    bind('state-delete',()=>confirmAction('Delete animation?',`Remove ${store.state().name} and all its frames? You can undo this.`,()=>{if(!store.removeState(store.get().activeState))throw new Error('Keep at least one state.');}));
    bind('layer-add',()=>ask('Add a layer',[{name:'name',label:'Layer name',value:'Details'}],values=>store.addLayer(values.name)));
    bind('layer-rename',()=>ask('Rename layer',[{name:'name',label:'Layer name',value:store.layer().name}],values=>store.updateLayer(store.get().activeLayer,{name:values.name})));
    bind('layer-opacity',event=>store.updateLayer(store.get().activeLayer,{opacity:Number(event.target.value)/100}),'change');
    bind('layer-up',()=>store.moveLayer(store.get().activeLayer,1));bind('layer-down',()=>store.moveLayer(store.get().activeLayer,-1));bind('layer-merge',()=>store.mergeDown(store.get().activeLayer));
    bind('layer-delete',()=>confirmAction('Delete layer?',`Remove ${store.layer().name} from every frame? You can undo this.`,()=>{if(!store.removeLayer(store.get().activeLayer))throw new Error('Keep at least one layer.');}));
    bind('color-picker',event=>store.setColor(event.target.value),'input');bind('color-hex',event=>{if(!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(event.target.value))throw new Error('Use #RRGGBB or #RRGGBBAA.');store.setColor(event.target.value);},'change');bind('color-add',()=>store.addPaletteColor(store.get().color));
    bind('selection-copy',()=>{PF.Selection.copy();toast('Pixels copied to the in-app clipboard.');});bind('selection-cut',()=>PF.Selection.copy(true));bind('selection-paste',()=>PF.Selection.paste());bind('selection-clear',()=>PF.Selection.clear());bind('flip-x',()=>PF.Selection.flip('x'));bind('flip-y',()=>PF.Selection.flip('y'));
    bind('doc-name',event=>{store.rename(event.target.value);current().name=store.get().name;renderAssets();},'change');
    bind('resize-open',()=>ask('Resize all sprite frames',[{name:'width',label:'Width (pixels)',type:'number',min:1,max:256,value:store.get().width},{name:'height',label:'Height (pixels)',type:'number',min:1,max:256,value:store.get().height}],values=>{store.resize(Number(values.width),Number(values.height),'center');PF.Renderer.fit();},'Resize centered'));
    bind('save-project',()=>flush(true));
    bind('project-name',event=>exclusive(async()=>{project=await PF.Projects.rename(project.id,project.revision,event.target.value);query('#project-name').value=project.name;}),'change');
    bind('asset-search',renderAssets,'input');bind('asset-add',()=>PF.UI.assetPicker(templateId=>addAsset({templateId})));
    bind('asset-blank',()=>ask('New blank sprite',[{name:'name',label:'Sprite name',value:'Untitled sprite'},{name:'width',label:'Width',type:'number',min:1,max:256,value:32},{name:'height',label:'Height',type:'number',min:1,max:256,value:32}],values=>addAsset({name:values.name,width:Number(values.width),height:Number(values.height)}),'Create sprite'));
    bind('asset-duplicate',duplicateAsset);
    bind('asset-delete',()=>confirmAction('Delete this asset?',`“${current().name}” will be permanently removed from the project. This cannot be undone. Export a backup first.`,()=>exclusive(async()=>{
      const removeId=activeId;project=await PF.Projects.removeAsset(project.id,project.revision,removeId);assets=assets.filter(asset=>asset.id!==removeId);await loadAsset(assets.find(asset=>asset.id===project.activeAssetId));
    })));
    bind('asset-import',()=>query('#import-file').click());bind('import-file',event=>{const file=event.target.files[0];event.target.value='';if(file)return importFile(file);},'change');
    all('.mobile-tabs [data-panel]').forEach(control=>control.addEventListener('click',()=>PF.UI.setView(control.dataset.panel)));
    all('[data-close]').forEach(control=>control.addEventListener('click',()=>control.closest('dialog').close()));
    all('[data-leave]').forEach(anchor=>anchor.addEventListener('click',safe(async event=>{event.preventDefault();if(busy)throw new Error('Please wait for the project operation to finish.');await flush();location.href=anchor.href;})));
    bind('help-open',showHelp);
    bindExports();bindAgent();bindKeyboard();
    query('#studio').addEventListener('dragover',event=>event.preventDefault());
    query('#studio').addEventListener('drop',safe(async event=>{event.preventDefault();const file=event.dataTransfer.files[0];if(file)await importFile(file);}));
    PF.Input.setTool('pencil');store.emit('view',PF.Renderer.getView());
  }
  async function importFile(file){
    if(busy)throw new Error('Wait for the current operation to finish.');
    if(/\.json$/i.test(file.name)){
      if(file.size>96*1024*1024)throw new Error('Sprite import is limited to 96 MB. Import workspace backups from the Projects page.');
      const data=await file.text(),raw=JSON.parse(data);
      if(raw.format==='pixelforge-workspace')throw new Error('This is a full project backup. Import it from the Projects page to keep assets separate.');
      const document=store.validate(raw);await addAsset({name:document.name,data:store.serialize(document)});return;
    }
    ask('Import image as a new sprite',[{name:'width',label:'Frame width (leave 0 for entire image)',type:'number',min:0,max:256,value:0},{name:'height',label:'Frame height (leave 0 for entire image)',type:'number',min:0,max:256,value:0}],async values=>{
      const document=await PF.IO.readPNG(file,{frameWidth:Number(values.width)||undefined,frameHeight:Number(values.height)||undefined});
      await addAsset({name:document.name,data:store.serialize(document)});
    },'Import sprite');
  }
  function bindExports(){
    bind('export-open',()=>{query('#export-error').textContent='';query('#export-dialog').showModal();});
    const descriptions={png:['PNG frame','Transparent image of this frame'],spritesheet:['Sprite sheet + JSON','All selected animation states'],gif:['Animated GIF','Preview the selected animation'],json:['Atlas JSON','Coordinates, timing, and state tags'],svg:['Pixel SVG','Editable vector pixel rectangles'],project:['Sprite source JSON','All layers, frames, and palette']};
    for(const [id,[title,description]] of Object.entries(descriptions)){
      const control=button('',async()=>{
        control.disabled=true;query('#export-error').textContent='';
        try{
          PF.Input.cancel();
          const state=query('#export-scope').value==='current'?store.get().activeState:undefined;
          await PF.IO.run(id,{scale:Number(query('#export-scale').value),layout:query('#export-layout').value,padding:Number(query('#export-padding').value),...(state===undefined?{}:{state})});
          toast('Download prepared. Check your browser downloads.');
        }catch(error){query('#export-error').textContent=error.message;}finally{control.disabled=false;}
      });control.append(node('strong',{text:title}),node('small',{text:description}));control.dataset.agentId=`export-${id}`;query('#export-formats').append(control);
    }
    bind('workspace-backup',async()=>{await flush();download(await PF.Projects.backup(project.id),`${filename(project.name)}.workspace.json`);toast('Project backup downloaded. Keep it somewhere safe.');});
    const pack=button('Download game asset pack (.zip)',()=>exclusive(async()=>{
      pack.disabled=true;
      try{const bundle=await PF.Projects.read(project.id),archive=await PF.Zip.gamePack(bundle,text=>{pack.textContent=text;});download(archive,`${filename(project.name)}-game-assets.zip`);toast('All project assets exported as PNG sheets + JSON atlases.');}
      finally{pack.disabled=false;pack.textContent='Download game asset pack (.zip)';}
    }), '');
    pack.dataset.agentId='export-game-pack';query('#workspace-backup').parentElement.prepend(pack);
  }
  function bindAgent(){
    bind('agent-open',()=>query('#agent-dialog').showModal());
    PF.Agent.init({log:query('#agent-log'),input:query('#agent-input'),send:query('#agent-send'),chips:query('#agent-chips')});
    bind('agent-schema',()=>download(JSON.stringify(PixelForge.manifest(),null,2),'pixelforge-tools.json'));
    bind('agent-example',()=>{query('#agent-input').value=JSON.stringify([{tool:'get_document',args:{}},{tool:'list_project_assets',args:{}},{tool:'select_animation',args:{action:'walk',direction:'south'}}],null,2);query('#agent-input').focus();});
    bind('agent-enable',()=>{const connection=PixelForge.enableBridge(query('#agent-origin').value);query('#agent-connection').textContent=JSON.stringify(connection,null,2);});
    bind('agent-disable',()=>{PixelForge.disableBridge();query('#agent-connection').textContent='Bridge disabled.';});
  }
  function showHelp(){
    const text='B Pencil · E Eraser · G Fill · L Line · R Rectangle · O Ellipse\nI Eyedropper · V Rectangle selection · M Move layer · H Pan · U Shade\nSpace + drag: pan · Wheel: zoom · 0: fit · [ / ]: brush size\nCtrl/Cmd+Z: undo · Ctrl/Cmd+Shift+Z: redo · Ctrl/Cmd+S: save locally\nCtrl/Cmd+C / X / V: copy / cut / paste pixels inside this tab\nArrow keys: nudge selection or layer (Shift = 8 pixels)\nEscape: deselect · Delete: clear selection / active layer\nP: playback · , / .: previous / next frame\nCtrl/Cmd+E: export · Shift+N: duplicate frame\n\nEach asset owns its own layers and states. Switching assets clears undo history. Undo targets 64 MB, retaining the newest edit even if it is larger. Selection does not clip brush strokes; it controls copy, cut, flip, and nudge.';
    dialog('A few useful shortcuts',node('pre',{text}));
  }
  function bindKeyboard(){
    window.addEventListener('keydown',safe(event=>{
      if(!ready||busy||document.querySelector('dialog[open]')||/INPUT|TEXTAREA|SELECT|BUTTON/.test(event.target.tagName)||event.target.isContentEditable)return;
      const key=event.key.toLowerCase(),modifier=event.ctrlKey||event.metaKey;
      const actions={b:'pencil',e:'eraser',g:'fill',l:'line',r:'rect',o:'ellipse',i:'picker',v:'select',m:'move',h:'pan',u:'shade'};
      let operation;
      if(modifier&&key==='s')operation=()=>flush(true);
      else if(modifier&&key==='z')operation=()=>event.shiftKey?store.redo():store.undo();
      else if(modifier&&key==='y')operation=()=>store.redo();
      else if(modifier&&key==='e')operation=()=>query('#export-dialog').showModal();
      else if(modifier&&key==='c')operation=()=>PF.Selection.copy();
      else if(modifier&&key==='x')operation=()=>PF.Selection.copy(true);
      else if(modifier&&key==='v')operation=()=>PF.Selection.paste();
      else if(modifier)return;
      else if(actions[key])operation=()=>PF.Input.setTool(actions[key]);
      else if(key==='p')operation=()=>PF.Anim.toggle();
      else if(key==='0')operation=()=>PF.Renderer.fit();
      else if(key==='['||key===']')operation=()=>PF.Input.setSize(PF.Input.get().size+(key===']'?1:-1));
      else if(key==='escape')operation=()=>PF.Selection.clear();
      else if(key==='delete'||key==='backspace')operation=()=>PF.Selection.erase();
      else if(key==='n'&&event.shiftKey)operation=()=>store.addFrame({duplicate:true});
      else if(key===','||key==='.')operation=()=>{PF.Anim.pause();const count=store.state().frames.length;store.setActive({frame:(store.get().activeFrame+(key==='.'?1:count-1))%count});};
      else if(key.startsWith('arrow'))operation=()=>{const step=event.shiftKey?8:1;PF.Selection.move(key==='arrowright'?step:key==='arrowleft'?-step:0,key==='arrowdown'?step:key==='arrowup'?-step:0);};
      if(operation){event.preventDefault();return operation();}
    }));
    window.addEventListener('beforeunload',event=>{if(dirty||saveJob||busy){event.preventDefault();event.returnValue='';}});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirty&&!saveBlocked)flush().catch(persistentError);});
  }
  async function boot(){
    try{
      let id=new URLSearchParams(location.search).get('project');
      if(!id){project=await PF.Projects.create({name:'Untitled project'});id=project.id;history.replaceState(null,'',`studio.html?project=${encodeURIComponent(id)}`);}
      const bundle=await PF.Projects.read(id);project=bundle.project;assets=bundle.assets;
      const asset=assets.find(value=>value.id===project.activeAssetId)||assets[0];if(!asset)throw new Error('This project contains no assets. Import a backup from Projects.');
      const data=asset.data||store.serialize(PF.Library.build(asset.templateId));store.load(data);activeId=asset.id;
      query('#studio').hidden=false;
      PF.Renderer.init(query('#pixel-canvas'));PF.Input.init(query('#pixel-canvas'));PF.Selection.init(query('#pixel-canvas'));PF.Anim.preview.init(query('#preview-canvas'));
      bindEditor();ready=true;renderAll();renderAssets();query('#workspace-loading').hidden=true;
      requestAnimationFrame(()=>{PF.Renderer.fit();store.emit('view',PF.Renderer.getView());});setStatus('All changes saved locally');
    }catch(error){persistentError(error);query('#workspace-loading').textContent='The editor could not open this project. Return to Projects to create a new project or import a backup.';}
  }
  boot();
  return {flush,openAsset,addAsset,duplicateAsset,isReady:()=>ready&&!busy,revision:()=>editRevision,summary:()=>({id:project?.id,name:project?.name,revision:project?.revision,editRevision,dirty,saving:!!saveJob,saveBlocked,activeAssetId:activeId,assets:assets.map(({id,name,templateId})=>({id,name,templateId}))})};
})();
