window.PF = window.PF || {};
PF.Zip = (() => {
  const encoder=new TextEncoder();
  const table=Uint32Array.from({length:256},(_,value)=>{
    let checksum=value;
    for(let bit=0;bit<8;bit++)checksum=checksum&1?0xedb88320^(checksum>>>1):checksum>>>1;
    return checksum>>>0;
  });
  function crc32(bytes){let checksum=0xffffffff;for(const value of bytes)checksum=table[(checksum^value)&255]^(checksum>>>8);return(checksum^0xffffffff)>>>0;}
  async function create(files){
    if(files.length>1024)throw new Error('Too many files for this export.');
    const local=[],central=[],names=new Set();let offset=0,centralSize=0;
    for(const file of files){
      if(typeof file.name!=='string'||file.name.startsWith('/')||file.name.includes('..')||file.name.includes('\\')||names.has(file.name))throw new Error('Unsafe or duplicate ZIP path.');
      names.add(file.name);
      const name=encoder.encode(file.name),data=typeof file.data==='string'?encoder.encode(file.data):file.data instanceof Blob?new Uint8Array(await file.data.arrayBuffer()):file.data;
      if(!(data instanceof Uint8Array)||name.length>65535||offset+data.length>512*1024*1024)throw new Error('ZIP exceeds the 512 MB export budget.');
      const checksum=crc32(data),header=new Uint8Array(30+name.length),view=new DataView(header.buffer);
      view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x0800,true);view.setUint16(12,33,true);view.setUint32(14,checksum,true);view.setUint32(18,data.length,true);view.setUint32(22,data.length,true);view.setUint16(26,name.length,true);header.set(name,30);
      local.push(header,data);
      const directory=new Uint8Array(46+name.length),record=new DataView(directory.buffer);
      record.setUint32(0,0x02014b50,true);record.setUint16(4,20,true);record.setUint16(6,20,true);record.setUint16(8,0x0800,true);record.setUint16(14,33,true);record.setUint32(16,checksum,true);record.setUint32(20,data.length,true);record.setUint32(24,data.length,true);record.setUint16(28,name.length,true);record.setUint32(42,offset,true);directory.set(name,46);
      central.push(directory);offset+=header.length+data.length;centralSize+=directory.length;
    }
    const end=new Uint8Array(22),view=new DataView(end.buffer);
    view.setUint32(0,0x06054b50,true);view.setUint16(8,files.length,true);view.setUint16(10,files.length,true);view.setUint32(12,centralSize,true);view.setUint32(16,offset,true);
    return new Blob([...local,...central,end],{type:'application/zip'});
  }
  async function gamePack(bundle,onProgress=()=>{}){
    const files=[],manifest={format:'pixelforge-game-pack',version:1,project:bundle.project.name,pixelsPerUnit:32,assets:[]};
    for(const id of bundle.project.assetIds){
      const asset=bundle.assets.find(value=>value.id===id);if(!asset)throw new Error('Project references a missing asset.');
      onProgress(`Preparing ${asset.name} (${manifest.assets.length+1}/${bundle.assets.length})…`);
      await new Promise(resolve=>setTimeout(resolve,0));
      const doc=asset.data?PF.Store.validate(asset.data):PF.Library.build(asset.templateId);
      const {canvas,atlas}=PF.IO.buildSheet({scale:1,layout:'rows'},doc);
      const filename=`${PF.UI.filename(asset.name)}-${asset.id.slice(0,8)}`;
      atlas.meta.image=`${filename}.png`;
      const png=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG encoding failed.')),'image/png'));
      files.push({name:`sprites/${filename}.png`,data:png},{name:`sprites/${filename}.json`,data:JSON.stringify(atlas,null,2)});
      manifest.assets.push({id:asset.id,name:asset.name,image:`sprites/${filename}.png`,atlas:`sprites/${filename}.json`,width:doc.width,height:doc.height,pivot:atlas.meta.pixelForge.pivot,states:atlas.meta.frameTags});
    }
    files.push({name:'manifest.json',data:JSON.stringify(manifest,null,2)},{name:'README.txt',data:'PixelForge game-ready sprite export\n\nImages are transparent, native-resolution PNG sprite sheets. Set nearest-neighbor filtering and disable texture smoothing in your engine. Read the paired JSON frames for pixel rectangles and frame durations in milliseconds. meta.frameTags defines named state ranges; directional names end in _south, _east, _north, or _west. The PixelForge extension records pivot and semantic state data. A pivot of (0.5, 0.875) aligns the feet of a 32px character at y=28.\n\nThese are procedural starter assets, not a finished game. Review collisions, timing, proportions, and tile joins in your own engine. Use the separate workspace backup command to preserve layered source files.\n'});
    onProgress('Packaging download…');return create(files);
  }
  return {create,crc32,gamePack};
})();
