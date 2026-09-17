(() => {
  const object=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
  const string=description=>({type:'string',description,maxLength:120});
  const integer=(description,minimum=0,maximum=255)=>({type:'integer',description,minimum,maximum});
  const register=(name,description,schema,handler)=>PF.Tools.register(name,description,schema,handler,['workspace']);
  const workspace=()=>{if(!PF.Workspace?.isReady())throw new Error('Open a project in the studio first.');return PF.Workspace;};
  register('new_document','Create a NEW blank project asset and open it. Saves and preserves the previous asset.',object({width:integer('Canvas width',1,256),height:integer('Canvas height',1,256),name:string('Sprite name')},['width','height']),args=>workspace().addAsset(args));
  register('load_project','Import a version 1 sprite JSON string as a NEW project asset; preserves existing assets.',object({project:{type:'string',description:'Lossless PixelForge sprite JSON',maxLength:96*1024*1024}},['project']),args=>{const doc=PF.Store.validate(args.project);return workspace().addAsset({name:doc.name,data:PF.Store.serialize(doc)});});
  register('get_workspace','Inspect the active project, asset IDs, local edit revision, save status, and disk revision.',object({}),()=>workspace().summary());
  register('list_projects','List projects saved in this browser. Does not change the open project.',object({}),()=>PF.Projects.list());
  register('list_project_assets','List editable asset IDs in the open project.',object({}),()=>workspace().summary().assets);
  register('list_asset_templates','List original sprite templates, frame counts, and categories.',object({category:string('Optional category filter')}),args=>PF.Library.list().filter(entry=>!args.category||entry.category.toLowerCase()===args.category.toLowerCase()));
  register('get_asset_template','Inspect animation states and directions available for a template.',object({id:string('Template ID')},['id']),args=>({asset:PF.Library.find(args.id),states:PF.Library.specs(PF.Library.find(args.id))}));
  register('add_library_asset','Add a new editable asset with its full suite; preserves other project assets.',object({template_id:string('Template ID from list_asset_templates')},['template_id']),args=>workspace().addAsset({templateId:args.template_id}));
  register('open_asset','Save pending edits and open an existing project asset by ID.',object({id:string('Project asset ID')},['id']),async args=>{await workspace().openAsset(args.id);return PF.Store.summary();});
  register('save_workspace','Persist the active asset to local browser storage. Throws on multi-tab conflict.',object({}),()=>workspace().flush(true));
  register('select_animation','Select an action and direction by name, not by fragile numeric index.',object({action:string('Action, e.g. walk, sword, eat'),direction:{type:'string',enum:['south','east','north','west']}},['action']),args=>{
    const name=args.direction?`${args.action}_${args.direction}`:args.action,index=PF.Store.get().states.findIndex(state=>state.name===name);
    if(index<0)throw new Error(`Animation ${name} is unavailable. Call list_states first.`);
    PF.Input.cancel();PF.Anim.pause();PF.Store.setActive({state:index});return PF.Store.summary().states[index];
  });
  register('select_region','Select a rectangular pixel region for copying, flipping, or nudging.',object({x:integer('Left pixel'),y:integer('Top pixel'),width:integer('Width',1,256),height:integer('Height',1,256)},['x','y','width','height']),args=>PF.Selection.set(args));
  register('copy_selection','Copy the selected region or whole layer to the in-app clipboard.',object({cut:{type:'boolean'} }),args=>PF.Selection.copy(args.cut||false));
  register('paste_selection','Paste the in-app clipboard at a pixel position.',object({x:integer('Left pixel'),y:integer('Top pixel')}),args=>{PF.Selection.paste(args.x,args.y);return {pasted:true};});
  register('recolor_asset','Replace one exact color across every state and layer, in one undoable edit.',object({from:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},to:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'}},['from','to']),args=>{
    const source=PF.Color.hexToU32(args.from),target=PF.Color.hexToU32(args.to);let changed=0;
    PF.Store.transact(doc=>{for(const state of doc.states)for(const frame of state.frames)for(const pixels of Object.values(frame.pixels))for(let index=0;index<pixels.length;index++)if(pixels[index]===source){pixels[index]=target;changed++;}doc.palette=doc.palette.map(color=>color.toLowerCase()===args.from.toLowerCase()?args.to:color);});
    return {pixelsChanged:changed};
  });
  const batchTools=new Set(['set_active','paint_rows','set_pixels','draw_line','draw_rect','draw_ellipse','fill','clear','outline','flip','shift','set_palette','add_palette_color','set_color','add_layer','remove_layer','set_layer','merge_layer_down','add_state','remove_state','set_state','add_frame','remove_frame','move_frame','set_frame_duration','rename_document','resize_document','recolor_asset']);
  register('run_edit_plan','Validate and execute up to 64 editing commands atomically, with one undo entry. dry_run validates without editing. Export, navigation, and nested plans are excluded.',object({steps:{type:'array',maxItems:64,items:object({tool:string('Editing tool name'),args:{type:'object'}},['tool','args'])},dry_run:{type:'boolean'},expected_revision:integer('Optional local edit revision from get_workspace',0,Number.MAX_SAFE_INTEGER)},['steps']),args=>{
    if(args.expected_revision!==undefined&&args.expected_revision!==workspace().revision())throw new Error('Edit revision changed. Inspect the document again before applying this plan.');
    for(const step of args.steps){if(!batchTools.has(step.tool))throw new Error(`${step.tool} is not allowed inside an atomic edit plan.`);PF.Tools.validate(step.tool,step.args);}
    if(args.dry_run)return {valid:true,commands:args.steps.length,note:'Schemas validated; state-dependent checks occur during execution.'};
    PF.Input.cancel();PF.Anim.pause();
    return PF.Store.batch(()=>args.steps.map(step=>({tool:step.tool,result:PF.Tools.get(step.tool).handler(step.args)})));
  });
  let bridge=null,queue=Promise.resolve();
  const allowedOrigins=new Set();
  PixelForge.enableBridge=origin=>{
    const parsed=new URL(origin);
    if(!['http:','https:'].includes(parsed.protocol)||parsed.origin!==origin||parsed.username||parsed.password)throw new Error('Enter an exact http(s) origin, without a path or trailing slash.');
    const bytes=crypto.getRandomValues(new Uint8Array(24)),token=[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
    allowedOrigins.clear();allowedOrigins.add(origin);bridge={origin,token};return {...bridge,type:'pf:call',example:{type:'pf:call',id:'inspect-1',token,tool:'get_document',args:{}}};
  };
  PixelForge.disableBridge=()=>{bridge=null;allowedOrigins.clear();};
  window.addEventListener('message',event=>{
    const message=event.data;
    if(!bridge||!allowedOrigins.has(event.origin)||!event.source||!message||message.type!=='pf:call'||message.token!==bridge.token||typeof message.id!=='string'||message.id.length>120)return;
    const session=bridge;
    queue=queue.then(async()=>{
      if(bridge!==session)return;
      const result=await PF.Tools.call(message.tool,message.args||{});
      event.source.postMessage({type:'pf:result',id:message.id,...result},event.origin);
    }).catch(error=>console.error('Agent bridge error',error));
  });
  PixelForge.workspace=()=>workspace().summary();
  PixelForge.library=()=>PF.Library.list();
  PixelForge.plan=(steps,options={})=>PF.Tools.call('run_edit_plan',{steps,...options});
})();
