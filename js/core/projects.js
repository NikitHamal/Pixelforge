window.PF = window.PF || {};
PF.Projects = (() => {
  let connection;
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const cleanName = value => String(value || 'Untitled project').trim().slice(0,120) || 'Untitled project';
  function open() {
    if (connection) return connection;
    connection = new Promise((resolve,reject) => {
      if (!globalThis.indexedDB) { reject(new Error('Browser storage is unavailable. Use a normal browser window on localhost.')); return; }
      const request = indexedDB.open('pixelforge-workspace',1);
      request.onupgradeneeded = () => {
        const database=request.result;
        database.createObjectStore('projects',{keyPath:'id'});
        const assets=database.createObjectStore('assets',{keyPath:'id'});
        assets.createIndex('projectId','projectId',{unique:false});
      };
      request.onsuccess = () => { request.result.onversionchange=()=>{request.result.close();connection=null;}; resolve(request.result); };
      request.onerror = () => { connection=null; reject(new Error(`Cannot open browser storage: ${request.error?.message || 'permission denied'}`)); };
      request.onblocked = () => { connection=null; reject(new Error('Close other PixelForge tabs, then reload to finish opening storage.')); };
    });
    return connection;
  }
  async function transaction(mode,operation) {
    const database=await open();
    return new Promise((resolve,reject) => {
      const tx=database.transaction(['projects','assets'],mode);
      let result, failure;
      const done=value=>{result=value;};
      const fail=error=>{failure=error;tx.abort();};
      tx.oncomplete=()=>resolve(result);
      tx.onabort=()=>reject(failure || new Error(`Storage transaction failed: ${tx.error?.message || 'aborted'}. Export a backup before closing.`));
      tx.onerror=()=>{};
      try { operation(tx,done,fail); } catch(error) { fail(error); }
    });
  }
  const list = () => transaction('readonly',(tx,done)=>{
    const request=tx.objectStore('projects').getAll();
    request.onsuccess=()=>done(request.result.sort((left,right)=>right.updatedAt-left.updatedAt));
  });
  const read = id => transaction('readonly',(tx,done,fail)=>{
    const result={project:null,assets:[]}; done(result);
    const project=tx.objectStore('projects').get(id), assets=tx.objectStore('assets').index('projectId').getAll(id);
    project.onsuccess=()=>{if(!project.result) fail(new Error('Project not found. Return to Projects or import a backup.')); else result.project=project.result;};
    assets.onsuccess=()=>{result.assets=assets.result;};
  });
  function blank(name='Untitled sprite',width=32,height=32) {
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>256||height>256) throw new Error('Canvas dimensions must be integers from 1 to 256.');
    return {id:uid(),name:cleanName(name),width,height,layers:[{id:'Body',name:'Body',visible:true,locked:false,opacity:1}],states:[{id:'idle',name:'idle',fps:8,loop:true,frames:[{id:uid(),duration:125,pixels:{Body:new Uint32Array(width*height)}}]}],palette:[...PF.Store.DEFAULT_PALETTE],activeState:0,activeFrame:0,activeLayer:0,color:'#b3ed9c'};
  }
  function assetRecord(projectId,templateId,name,document=null) {
    const entry=templateId ? PF.Library.find(templateId) : null;
    return {id:uid(),projectId,templateId:templateId||null,name:cleanName(name||entry?.name||'Untitled sprite'),data:document,thumbnail:null,updatedAt:Date.now()};
  }
  async function create({name='Untitled project',templateId='blank',width=32,height=32}={}) {
    const template=PF.Library.templates.find(item=>item.id===templateId);
    if(!template) throw new Error('Unknown project template.');
    const id=uid(), time=Date.now();
    const assets=template.assets.map(asset=>assetRecord(id,asset));
    if(!assets.length) assets.push(assetRecord(id,null,'Untitled sprite',PF.Store.serialize(blank('Untitled sprite',width,height))));
    const project={id,name:cleanName(name),templateId,createdAt:time,updatedAt:time,revision:1,assetIds:assets.map(asset=>asset.id),activeAssetId:assets[0].id,cover:assets[0].templateId};
    await transaction('readwrite',(tx,done)=>{tx.objectStore('projects').add(project);for(const asset of assets) tx.objectStore('assets').add(asset);done(project);});
    return project;
  }
  const mutate = (id,revision,apply) => transaction('readwrite',(tx,done,fail)=>{
    const request=tx.objectStore('projects').get(id);
    request.onsuccess=()=>{
      try {
        const project=request.result;
        if(!project) throw new Error('This project was deleted in another tab. Export your current sprite before leaving.');
        if(project.revision!==revision) { const error=new Error('This project changed in another tab. Export your current sprite, then reload. Your local edits have not been overwritten.'); error.name='ConflictError'; throw error; }
        apply(project,tx);
        project.revision++; project.updatedAt=Date.now();
        tx.objectStore('projects').put(project);done(project);
      } catch(error) { fail(error); }
    };
  });
  const saveAsset = ({projectId,assetId,data,thumbnail,revision}) => {
    const document=PF.Store.validate(data);
    return mutate(projectId,revision,(project,tx)=>{
      if(!project.assetIds.includes(assetId)) throw new Error('Asset no longer exists.');
      const request=tx.objectStore('assets').get(assetId);
      request.onsuccess=()=>{const asset=request.result; tx.objectStore('assets').put({...asset,name:document.name,data,thumbnail:thumbnail||asset.thumbnail,updatedAt:Date.now()});};
      project.activeAssetId=assetId;
    });
  };
  async function addAsset(projectId,revision,{templateId,name,data,width=32,height=32}={}) {
    if(data) PF.Store.validate(data);
    const asset=assetRecord(projectId,templateId,name,data||(!templateId?PF.Store.serialize(blank(name,width,height)):null));
    const project=await mutate(projectId,revision,(project,tx)=>{
      if(project.assetIds.length>=128) throw new Error('A project can contain at most 128 assets.');
      project.assetIds.push(asset.id);project.activeAssetId=asset.id;tx.objectStore('assets').add(asset);
    });
    return {project,asset};
  }
  const rename = (id,revision,name) => mutate(id,revision,project=>{project.name=cleanName(name);});
  const activate = (id,revision,assetId) => mutate(id,revision,project=>{if(!project.assetIds.includes(assetId))throw new Error('Asset not found.');project.activeAssetId=assetId;});
  const removeAsset = (projectId,revision,assetId) => mutate(projectId,revision,(project,tx)=>{
    if(project.assetIds.length<=1) throw new Error('Keep at least one asset in a project.');
    if(!project.assetIds.includes(assetId)) throw new Error('Asset not found.');
    project.assetIds=project.assetIds.filter(id=>id!==assetId);
    if(project.activeAssetId===assetId) project.activeAssetId=project.assetIds[0];
    tx.objectStore('assets').delete(assetId);
  });
  const remove = (id,revision) => transaction('readwrite',(tx,done,fail)=>{
    const request=tx.objectStore('projects').get(id);
    request.onsuccess=()=>{
      if(!request.result || request.result.revision!==revision) {fail(new Error('Project changed in another tab. Refresh before deleting.'));return;}
      for(const assetId of request.result.assetIds) tx.objectStore('assets').delete(assetId);
      tx.objectStore('projects').delete(id);done(true);
    };
  });
  async function backup(id) {
    const bundle=await read(id);
    return JSON.stringify({format:'pixelforge-workspace',version:2,generatorVersion:PF.Library.VERSION,exportedAt:new Date().toISOString(),...bundle});
  }
  async function restore(input) {
    if(typeof input==='string'&&input.length>256*1024*1024) throw new Error('Backup exceeds the 256 MB import limit.');
    const raw=typeof input==='string'?JSON.parse(input):input;
    if(raw?.format==='pixelforge') {
      const document=PF.Store.validate(raw), id=uid(), asset=assetRecord(id,null,document.name,PF.Store.serialize(document));
      return insert({id,name:document.name,templateId:'blank',createdAt:Date.now(),updatedAt:Date.now(),revision:1,assetIds:[asset.id],activeAssetId:asset.id,cover:null},[asset]);
    }
    if(raw?.format!=='pixelforge-workspace'||raw.version!==2||raw.generatorVersion!==PF.Library.VERSION||!raw.project||!Array.isArray(raw.assets)||!raw.assets.length||raw.assets.length>128) throw new Error('Unsupported or invalid workspace backup.');
    const id=uid(), assetIds=new Set();
    if (!Array.isArray(raw.project.assetIds) || raw.project.assetIds.length !== raw.assets.length || new Set(raw.project.assetIds).size !== raw.assets.length) throw new Error('Backup asset order is invalid.');
    const ordered=raw.project.assetIds.map(assetId=>raw.assets.find(value=>value?.id===assetId));
    const assets=ordered.map(value=>{
      if(!value||typeof value.id!=='string'||assetIds.has(value.id)) throw new Error('Invalid or duplicate asset IDs.');
      assetIds.add(value.id);
      if(value.templateId) PF.Library.find(value.templateId);
      if(value.data) PF.Store.validate(value.data);
      else if(!value.templateId) throw new Error('Asset has no template or pixel data.');
      return assetRecord(id,value.templateId,value.name,value.data||null);
    });
    const activeIndex=Math.max(0,raw.project.assetIds.indexOf(raw.project.activeAssetId));
    const project={id,name:cleanName(raw.project.name),templateId:PF.Library.templates.some(item=>item.id===raw.project.templateId)?raw.project.templateId:'blank',createdAt:Date.now(),updatedAt:Date.now(),revision:1,assetIds:assets.map(asset=>asset.id),activeAssetId:assets[activeIndex].id,cover:assets[0].templateId};
    return insert(project,assets);
  }
  const insert = (project,assets) => transaction('readwrite',(tx,done)=>{tx.objectStore('projects').add(project);for(const asset of assets) tx.objectStore('assets').add(asset);done(project);});
  async function duplicate(id) {
    const raw=JSON.parse(await backup(id));raw.project.name+=' · copy';return restore(raw);
  }
  return {open,list,read,create,blank,saveAsset,addAsset,removeAsset,rename,activate,remove,backup,restore,duplicate};
})();
