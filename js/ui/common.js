window.PF = window.PF || {};
PF.UI = (() => {
  const query=(selector,root=document)=>root.querySelector(selector);
  const all=(selector,root=document)=>[...root.querySelectorAll(selector)];
  let toastTimer;
  function node(tag,attributes={},children=[]) {
    const element=document.createElement(tag);
    for(const [name,value] of Object.entries(attributes)) {
      if(name==='text')element.textContent=value;
      else if(name==='class')element.className=value;
      else if(name.startsWith('on')&&typeof value==='function') element.addEventListener(name.slice(2),value);
      else if(value!==null&&value!==undefined) element.setAttribute(name,String(value));
    }
    for(const child of children) if(child!==null&&child!==undefined)element.append(typeof child==='string'?document.createTextNode(child):child);
    return element;
  }
  function toast(message,error=false) {
    let element=query('#toast');
    if(!element) {element=node('div',{id:'toast',role:'status','aria-live':'polite'});document.body.append(element);}
    clearTimeout(toastTimer);element.className=`toast${error?' error':''}`;element.hidden=false;element.textContent=message;
    toastTimer=setTimeout(()=>{element.hidden=true;},error?12000:4200);
  }
  const safe=callback=>async event=>{try{return await callback(event);}catch(error){console.error(error);toast(error.message||String(error),true);}};
  const button=(label,callback,className='',title=label)=>node('button',{type:'button',text:label,class:className,title,onclick:safe(callback)});
  function download(data,name,type='application/json') {
    const blob=data instanceof Blob?data:new Blob([data],{type}),url=URL.createObjectURL(blob),anchor=node('a',{href:url,download:name});
    document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  const filename=value=>String(value||'pixelforge').replace(/[^a-z0-9_-]+/gi,'-').slice(0,100).toLowerCase();
  function preview(canvas,id,stateName) {
    if(!id)return;
    PF.Library.drawPreview(canvas,id,stateName,0);
    const parent=canvas.closest('button,a,article')||canvas.parentElement;
    let handle=0,last=0,index=0;
    const stop=()=>{cancelAnimationFrame(handle);handle=0;index=0;PF.Library.drawPreview(canvas,id,stateName,0);};
    const tick=time=>{if(!canvas.isConnected||document.hidden){handle=0;return;}if(time-last>125){PF.Library.drawPreview(canvas,id,stateName,index++);last=time;}handle=requestAnimationFrame(tick);};
    const start=()=>{if(!handle&&!matchMedia('(prefers-reduced-motion: reduce)').matches)handle=requestAnimationFrame(tick);};
    parent.addEventListener('pointerenter',start);parent.addEventListener('pointerleave',stop);parent.addEventListener('focus',start);parent.addEventListener('blur',stop);
  }
  function dialog(title,body,wide=false) {
    const element=node('dialog',{class:wide?'library-dialog':''});
    const close=button('×',()=>element.close(),'text-button','Close dialog');
    element.append(node('div',{class:'dialog-head'},[node('h2',{text:title}),close]),body);
    document.body.append(element);element.addEventListener('close',()=>element.remove(),{once:true});element.showModal();return element;
  }
  function ask(title,fields,onSubmit,submitLabel='Save') {
    const form=node('form'),error=node('p',{class:'dialog-error',role:'alert'});
    for(const field of fields) {
      const input=field.options?node('select',{name:field.name},field.options.map(option=>node('option',{value:option.value,text:option.label}))):node('input',{name:field.name,type:field.type||'text',value:field.value??'',required:field.required===false?null:'',min:field.min,max:field.max,maxlength:field.type==='number'?null:120});
      if(field.value!==undefined)input.value=String(field.value);
      form.append(node('label',{class:'field'},[node('span',{text:field.label}),input]));
    }
    const submit=node('button',{type:'submit',class:'primary',text:submitLabel});
    form.append(error,node('div',{class:'dialog-actions'},[submit]));
    const modal=dialog(title,form);
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(!form.reportValidity())return;submit.disabled=true;error.textContent='';
      try {await onSubmit(Object.fromEntries(new FormData(form)));modal.close();}
      catch(failure){error.textContent=failure.message;submit.disabled=false;}
    });
    return modal;
  }
  function confirmAction(title,message,callback) {
    const body=node('div',{class:'stack'},[node('p',{text:message,class:'muted'})]);
    const error=node('p',{class:'dialog-error',role:'alert'}),cancel=button('Cancel',()=>modal.close()),confirm=button('Confirm',async()=>{
      confirm.disabled=true;try{await callback();modal.close();}catch(failure){error.textContent=failure.message;confirm.disabled=false;}
    },'danger');
    body.append(error,node('div',{class:'dialog-actions'},[cancel,confirm]));const modal=dialog(title,body);cancel.focus();return modal;
  }
  function assetPicker(onSelect) {
    const search=node('input',{type:'search',class:'search',placeholder:'Search assets, actions, categories…','aria-label':'Search asset library'}),categories=node('div',{class:'filters'}),grid=node('div',{class:'asset-grid'}),note=node('p',{class:'muted',text:'Original, editable 32 × 32 assets. Characters include 23 actions in four directions.'});
    let category='All';
    const body=node('div',{},[note,search,categories,grid]),modal=dialog('Add an asset',body,true);
    function render(){
      grid.replaceChildren();
      const needle=search.value.toLowerCase();
      const choices=PF.Library.list().filter(entry=>(category==='All'||entry.category===category)&&`${entry.name} ${entry.tags.join(' ')} ${entry.category} ${PF.Library.specs(entry).map(state=>state.action).join(' ')}`.toLowerCase().includes(needle));
      for(const entry of choices){
        const canvas=node('canvas',{'aria-hidden':'true'}),card=button('',async()=>{card.disabled=true;try{await onSelect(entry.id);modal.close();}finally{card.disabled=false;}},'asset-card',`Add ${entry.name}`);
        card.append(node('div',{class:'asset-art'},[canvas]),node('div',{class:'asset-info'},[node('strong',{text:entry.name}),node('small',{text:`${entry.states} states · ${entry.frames} frames`})]));
        grid.append(card);preview(canvas,entry.id);
      }
      if(!choices.length)grid.append(node('div',{class:'empty',text:'No matching assets. Try a different search.'}));
    }
    for(const name of ['All','Characters','Enemies','Props','Nature','Tiles','Items']) {
      const filter=button(name,()=>{category=name;all('button',categories).forEach(item=>item.setAttribute('aria-pressed',String(item===filter)));render();},'filter');filter.setAttribute('aria-pressed',String(name==='All'));categories.append(filter);
    }
    search.addEventListener('input',render);render();return modal;
  }
  function setView(view){const layout=query('.studio-layout');if(view==='agent')query('#agent-dialog')?.showModal();else if(layout){layout.dataset.panel=view;PF.Renderer?.fit();}}
  const setTheme=theme=>{if(theme!=='dark')toast('This workspace currently uses its dark editing theme.');document.documentElement.dataset.theme='dark';};
  const describe=filter=>all('[data-agent-id]').map(element=>{const bounds=element.getBoundingClientRect();return {id:element.dataset.agentId,label:element.getAttribute('aria-label')||element.title||element.textContent.trim().slice(0,60),role:element.tagName.toLowerCase(),visible:bounds.width>0&&bounds.height>0,disabled:!!element.disabled,value:'value'in element?element.value:undefined,rect:{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height}};}).filter(value=>!filter||`${value.id} ${value.label}`.toLowerCase().includes(filter.toLowerCase()));
  function click(id,value){const element=all('[data-agent-id]').find(item=>item.dataset.agentId===id);if(!element||element.disabled)throw new Error('UI control is unavailable.');if(value!==undefined&&'value'in element&&element.tagName!=='BUTTON'){element.value=value;element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));}else element.click();return {id,ok:true};}
  return {query,all,node,button,toast,safe,download,filename,preview,dialog,ask,confirmAction,assetPicker,setView,setTheme,describe,click};
})();
