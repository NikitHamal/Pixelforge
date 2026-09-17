(() => {
  const {query,node,button,preview,ask,dialog,confirmAction,safe,download,filename}=PF.UI;
  const page=document.body.dataset.page;
  const studio=id=>`studio.html?project=${encodeURIComponent(id)}`;
  let projects=[],category='All';
  const notice=message=>{const element=query('#storage-notice');element.hidden=false;element.textContent=message;};
  if(location.protocol==='file:') notice('For reliable project storage, serve this folder locally: python -m http.server 8000 --bind 127.0.0.1, then open localhost:8000. Keep using the same address for your saved projects.');
  query('#library-count').textContent=`${PF.Library.entries.length} original assets`;
  PF.UI.all('[data-preview]').forEach(canvas=>preview(canvas,canvas.dataset.preview));
  function createProject(templateId='blank') {
    const template=PF.Library.templates.find(item=>item.id===templateId);
    const fields=[{name:'name',label:'Project name',value:templateId==='blank'?'My first world':template.name}];
    if(templateId==='blank')fields.push({name:'width',label:'Canvas width (pixels)',type:'number',min:1,max:256,value:32},{name:'height',label:'Canvas height (pixels)',type:'number',min:1,max:256,value:32});
    ask('Create a new project',fields,async values=>{
      const project=await PF.Projects.create({name:values.name,templateId,width:Number(values.width||32),height:Number(values.height||32)});
      location.href=studio(project.id);
    },'Create & open studio');
  }
  function projectCard(project) {
    const open=node('a',{class:'card-art',href:studio(project.id),'aria-label':`Open ${project.name}`}),canvas=node('canvas',{'aria-hidden':'true'});
    const template=PF.Library.templates.find(item=>item.id===project.templateId);
    if(project.cover) {open.append(canvas);preview(canvas,project.cover);} else open.append(node('span',{class:'eyebrow',text:'YOUR NEXT GREAT IDEA'}));
    open.append(node('span',{class:'badge',text:template?.genre||'Custom'}));
    const updated=new Date(project.updatedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'});
    const content=node('div',{class:'card-content'},[node('a',{href:studio(project.id)},[node('h3',{text:project.name})]),node('p',{class:'card-meta',text:`${project.assetIds.length} assets · Updated ${updated}`})]);
    const menu=node('select',{'aria-label':`Actions for ${project.name}`,class:'compact'},['Actions…','Rename','Duplicate','Download backup','Delete'].map((label,index)=>node('option',{value:index,text:label})));
    menu.addEventListener('change',safe(async()=>{
      const action=menu.value;menu.value='0';
      if(action==='1')ask('Rename project',[{name:'name',label:'Project name',value:project.name}],async values=>{await PF.Projects.rename(project.id,project.revision,values.name);await loadProjects();});
      if(action==='2'){menu.disabled=true;try{await PF.Projects.duplicate(project.id);await loadProjects();}finally{menu.disabled=false;}}
      if(action==='3')download(await PF.Projects.backup(project.id),`${filename(project.name)}.workspace.json`);
      if(action==='4')confirmAction('Delete this project?',`“${project.name}” and its ${project.assetIds.length} assets will be permanently removed from this browser. Download a backup first.`,async()=>{await PF.Projects.remove(project.id,project.revision);await loadProjects();});
    }));
    content.append(node('div',{class:'card-actions'},[node('a',{href:studio(project.id),class:'button',text:'Open studio ↗'}),menu]));
    return node('article',{class:'project-card'},[open,content]);
  }
  function renderProjects() {
    const grid=query('#project-grid'),needle=query('#project-search').value.toLowerCase();grid.replaceChildren();query('#project-count').textContent=projects.length;
    const visible=projects.filter(project=>project.name.toLowerCase().includes(needle));
    for(const project of visible)grid.append(projectCard(project));
    if(!visible.length)grid.append(node('div',{class:'empty'},[node('h2',{text:projects.length?'No matching projects':'Let’s make your first world.'}),node('p',{text:projects.length?'Try a different name.':'Start from a curated kit or create a blank canvas.'}),button('Create a project',()=>createProject(),'primary')]));
  }
  async function loadProjects(){projects=await PF.Projects.list();renderProjects();}
  function renderTemplates(){
    const grid=query('#template-grid');
    for(const template of PF.Library.templates){
      const art=node('div',{class:'card-art'});art.style.backgroundColor=`${template.color}12`;
      art.append(node('span',{class:'badge',text:template.genre}));
      const chosen=template.assets.filter((id,index)=>index===0||index===2||index===4).slice(0,3);
      for(const id of chosen){const canvas=node('canvas',{'aria-hidden':'true'});art.append(canvas);preview(canvas,id);}
      if(!chosen.length)art.append(node('span',{text:'＋',style:'font-size:54px;color:#839080;font-weight:200'}));
      grid.append(node('article',{class:'template-card'},[art,node('div',{class:'card-content'},[node('h3',{text:template.name}),node('p',{text:template.description}),node('div',{class:'row spread'},[node('small',{text:template.assets.length?`${template.assets.length} editable assets`:'Choose your canvas size'}),button('Use template ↗',()=>createProject(template.id),'compact')])])]));
    }
  }
  async function addFromLibrary(id){
    const current=await PF.Projects.list();
    ask('Choose a home for this asset',[{name:'project',label:'Project',value:'new',options:[{value:'new',label:'Create a new project'},...current.map(item=>({value:item.id,label:item.name}))]}],async values=>{
      let project;
      if(values.project==='new'){
        project=await PF.Projects.create({name:PF.Library.find(id).name});
        const initial=project.activeAssetId;
        project=(await PF.Projects.addAsset(project.id,project.revision,{templateId:id})).project;
        project=await PF.Projects.removeAsset(project.id,project.revision,initial);
      }else{
        project=(await PF.Projects.read(values.project)).project;
        project=(await PF.Projects.addAsset(project.id,project.revision,{templateId:id})).project;
      }
      location.href=studio(project.id);
    },'Add & open studio');
  }
  function assetDetail(entry){
    const specs=PF.Library.specs(entry),canvas=node('canvas',{'aria-label':`Animation preview of ${entry.name}`}),state=node('select',{'aria-label':'Preview animation'},specs.map(spec=>node('option',{value:spec.name,text:spec.name.replaceAll('_',' · ')})));
    let index=0,last=0,handle=0,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
    const play=button(playing?'Pause preview':'Play preview',()=>{playing=!playing;index=0;last=0;play.textContent=playing?'Pause preview':'Play preview';},'compact');
    const copy=node('div',{class:'stack'},[node('span',{class:'badge',text:`${entry.category} · 32 × 32`}),node('p',{text:`${entry.states} states · ${entry.frames} frames. Layered pixel data with shadow, body, and equipment. Export PNG sheets and atlas metadata from the studio.`}),state,play,button('Add to a project',()=>addFromLibrary(entry.id),'primary')]);
    if(entry.kind==='human')copy.append(node('small',{text:'23 actions × south, east, north, west. These are procedural starter sprites: review timing and silhouettes in your game before shipping.'}));
    const modal=dialog(entry.name,node('div',{class:'preview-detail'},[canvas,copy]));
    state.addEventListener('change',()=>{index=0;last=0;PF.Library.drawPreview(canvas,entry.id,state.value,index);});
    function tick(time){
      const spec=specs.find(item=>item.name===state.value);
      if(playing&&!document.hidden&&time-last>1000/spec.fps){last=time;PF.Library.drawPreview(canvas,entry.id,state.value,index);if(index+1<spec.count)index++;else if(spec.loop)index=0;}
      handle=requestAnimationFrame(tick);
    }
    modal.addEventListener('close',()=>cancelAnimationFrame(handle));PF.Library.drawPreview(canvas,entry.id,state.value,0);handle=requestAnimationFrame(tick);
  }
  function renderAssets(){
    const needle=query('#asset-search').value.toLowerCase(),grid=query('#asset-grid');grid.replaceChildren();
    const entries=PF.Library.list().filter(entry=>(category==='All'||category===entry.category)&&`${entry.name} ${entry.tags.join(' ')} ${entry.category}`.toLowerCase().includes(needle));
    for(const entry of entries){
      const canvas=node('canvas',{'aria-hidden':'true'}),card=button('',()=>assetDetail(entry),'asset-card',`Preview ${entry.name}`);
      card.append(node('div',{class:'asset-art'},[canvas]),node('div',{class:'asset-info'},[node('strong',{text:entry.name}),node('small',{text:`${entry.category} · ${entry.frames} frames`})]));
      grid.append(card);preview(canvas,entry.id);
    }
    if(!entries.length)grid.append(node('div',{class:'empty',text:'No assets match that search.'}));
  }
  if(page==='projects'){
    query('#new-project').addEventListener('click',()=>createProject());query('#project-search').addEventListener('input',renderProjects);
    query('#import-backup').addEventListener('click',()=>query('#backup-file').click());
    query('#backup-file').addEventListener('change',safe(async event=>{
      const file=event.target.files[0];event.target.value='';if(!file)return;
      if(file.size>256*1024*1024)throw new Error('Backup is larger than the 256 MB import limit.');
      await PF.Projects.restore(await file.text());await loadProjects();PF.UI.toast('Backup imported as a new project.');
    }));
    let legacy;try{legacy=localStorage.getItem('pf-autosave');}catch{}
    if(legacy){query('#recover-legacy').hidden=false;query('#recover-legacy').addEventListener('click',safe(async()=>{await PF.Projects.restore(legacy);query('#recover-legacy').hidden=true;await loadProjects();PF.UI.toast('Old autosave recovered. The original browser copy is unchanged.');}));}
    loadProjects().catch(error=>{notice(error.message);query('#project-grid').replaceChildren(node('div',{class:'empty',text:'Storage could not be opened. Your existing browser data has not been removed.'}));});
  }else{
    renderTemplates();
    for(const name of ['All','Characters','Enemies','Props','Nature','Tiles','Items']){
      const filter=button(name,()=>{category=name;PF.UI.all('#asset-filters button').forEach(item=>item.setAttribute('aria-pressed',String(item===filter)));renderAssets();},'filter');filter.setAttribute('aria-pressed',String(name==='All'));query('#asset-filters').append(filter);
    }
    query('#asset-search').addEventListener('input',renderAssets);renderAssets();
  }
})();
