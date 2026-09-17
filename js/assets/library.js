window.PF = window.PF || {};
PF.Library = (() => {
  const VERSION = 1;
  const SIZE = 32;
  const DIRECTIONS = ['south', 'east', 'north', 'west'];
  const ACTIONS = [
    ['idle', 4, 6, true], ['walk', 8, 10, true], ['run', 8, 14, true],
    ['jump', 6, 10, false], ['fall', 4, 8, true], ['land', 4, 12, false],
    ['sword', 8, 12, false], ['pickaxe', 8, 10, true], ['axe', 8, 10, true],
    ['shoot', 8, 12, false], ['cast', 8, 10, false], ['block', 4, 8, true],
    ['hurt', 4, 12, false], ['death', 8, 8, false], ['roll', 8, 14, false],
    ['eat', 6, 6, true], ['drink', 6, 6, true], ['sleep', 4, 3, true],
    ['carry', 8, 8, true], ['use', 8, 8, true], ['pickup', 6, 8, false],
    ['swim', 8, 8, true], ['fish', 6, 6, true]
  ];
  const CHARACTERS = [
    ['ranger-male', 'Rowan · Ranger', 'male', '#609760', '#a4ca78', '#694d3a', '#d9a374', 'ranger'],
    ['ranger-female', 'Fern · Ranger', 'female', '#609760', '#a4ca78', '#8b4d3d', '#edbb91', 'ranger'],
    ['knight-male', 'Alden · Knight', 'male', '#728fa5', '#b0cbd0', '#493a42', '#d9a374', 'knight'],
    ['knight-female', 'Briar · Knight', 'female', '#728fa5', '#b0cbd0', '#503a2e', '#b77c59', 'knight'],
    ['mage-male', 'Orin · Mage', 'male', '#7867ac', '#b4a0d8', '#d2c3ad', '#b77c59', 'mage'],
    ['mage-female', 'Lyra · Mage', 'female', '#7867ac', '#b4a0d8', '#433747', '#edbb91', 'mage'],
    ['miner-male', 'Flint · Miner', 'male', '#b4874e', '#dfb46b', '#663e31', '#d9a374', 'miner'],
    ['miner-female', 'Ember · Miner', 'female', '#b4874e', '#dfb46b', '#ab663c', '#b77c59', 'miner']
  ].map(([id, name, gender, coat, light, hair, skin, role]) => ({ id, name, category: 'Characters', kind: 'human', gender, coat, light, hair, skin, role, tags: [role, gender, 'survival', 'roguelike', '4 directions'] }));
  const entries = [...CHARACTERS];
  const add = (id, name, category, kind = id, tags = []) => entries.push({ id, name, category, kind, tags });
  [['slime','Moss slime'],['ember-slime','Ember slime'],['bat','Cave bat'],['skeleton','Crypt skeleton'],['goblin','Forest goblin'],['wolf','Grey wolf']].forEach(([id,name]) => add(id,name,'Enemies',id,['combat','4 directions']));
  [['chest','Oak chest'],['door','Dungeon door'],['campfire','Campfire'],['forge','Blacksmith forge'],['workbench','Workbench'],['bed','Bedroll'],['barrel','Barrel'],['crate','Supply crate']].forEach(([id,name]) => add(id,name,'Props',id,['survival','interactive']));
  [['oak','Oak tree'],['pine','Pine tree'],['rock','Boulder'],['copper','Copper ore'],['gold','Gold ore'],['bush','Berry bush'],['crop','Wheat'],['mushroom','Redcap mushroom']].forEach(([id,name]) => add(id,name,'Nature',id,['harvest','survival']));
  [['grass','Grass'],['dirt','Earth'],['stone','Stone floor'],['wall','Dungeon wall'],['water','Water'],['sand','Sand']].forEach(([id,name]) => add(id,name,'Tiles',id,['tile','terrain']));
  [['coin','Gold coin'],['potion','Health potion'],['heart','Heart'],['key','Dungeon key'],['torch','Torch'],['sword','Iron sword'],['pickaxe','Iron pickaxe'],['axe','Woodcutter axe'],['bow','Longbow'],['staff','Arcane staff'],['food','Bread']].forEach(([id,name]) => add(id,name,'Items',id,['inventory','pickup']));
  const find = id => {
    const entry = entries.find(item => item.id === id);
    if (!entry) throw new Error(`Unknown asset template: ${id}`);
    return entry;
  };
  const templates = [
    { id: 'blank', name: 'A fresh canvas', subtitle: 'Your next idea starts here.', description: 'One empty, editable sprite. Choose your own canvas size.', assets: [], color: '#b3ed9c', genre: 'Custom' },
    { id: 'woodland', name: 'The wildwood', subtitle: 'A small world, ready to grow.', description: 'Two rangers, gathering tools, harvestable nature, crafting props, and terrain.', assets: ['ranger-male','ranger-female','slime','wolf','oak','pine','rock','copper','gold','bush','crop','mushroom','campfire','workbench','bed','chest','crate','grass','dirt','water','sand','pickaxe','axe','bow','food','potion'], color: '#b3ed9c', genre: 'Survival' },
    { id: 'dungeon', name: 'Below the keep', subtitle: 'Every room tells a story.', description: 'Two knights, dungeon enemies, combat equipment, treasure, and dungeon tiles.', assets: ['knight-male','knight-female','skeleton','goblin','bat','ember-slime','door','chest','barrel','forge','stone','wall','sword','key','coin','potion','heart','torch'], color: '#b5a6f3', genre: 'Roguelike' },
    { id: 'arcane', name: 'A little magic', subtitle: 'For worlds beyond the ordinary.', description: 'Two mages, spell-ready animation suites, creatures, mushrooms, and collectibles.', assets: ['mage-male','mage-female','slime','ember-slime','bat','staff','potion','heart','mushroom','oak','grass','water','chest','coin'], color: '#a3d5f0', genre: 'Adventure' },
    { id: 'homestead', name: 'Slow mornings', subtitle: 'Build something worth coming home to.', description: 'Two workers, mining, farming, cooking, and building materials.', assets: ['miner-male','miner-female','crop','bush','oak','rock','copper','gold','campfire','forge','workbench','bed','barrel','crate','pickaxe','axe','food','grass','dirt'], color: '#efc78e', genre: 'Cozy survival' }
  ];
  function specs(entry) {
    if (entry.kind === 'human') return ACTIONS.flatMap(([action,count,fps,loop]) => DIRECTIONS.map(direction => ({ name: `${action}_${direction}`, action, direction, count, fps, loop })));
    if (entry.category === 'Enemies') return [['idle',4,6,true],['walk',6,8,true],['run',6,12,true],['attack',6,10,false],['hurt',4,10,false],['death',6,8,false],['spawn',6,8,false]].flatMap(([action,count,fps,loop]) => DIRECTIONS.map(direction => ({ name: `${action}_${direction}`, action, direction, count, fps, loop })));
    let actions = [['idle',1,6,true]];
    if (entry.category === 'Nature') actions = [['idle',4,5,true],['harvest',6,8,false],['depleted',1,6,false],['grow',6,5,false]];
    if (entry.category === 'Items') actions = [['idle',6,6,true],['pickup',6,10,false]];
    if (entry.category === 'Props') actions = ['chest','door'].includes(entry.id) ? [['closed',1,6,false],['open',6,8,false],['opened',1,6,false],['close',6,8,false]] : ['campfire','forge','workbench'].includes(entry.id) ? [['idle',6,8,true],['use',6,10,true],['off',1,6,false]] : [['idle',4,5,true],['use',6,8,false],['break',6,10,false]];
    if (entry.id === 'water') actions = [['flow',6,6,true]];
    return actions.map(([action,count,fps,loop]) => ({ name: action, action, count, fps, loop }));
  }
  function painter(pixels) {
    const color = value => PF.Color.hexToU32(value);
    return {
      dot: (left,top,ink) => PF.Raster.set(pixels,SIZE,SIZE,Math.round(left),Math.round(top),color(ink)),
      rect: (left,top,width,height,ink) => {
        if (width <= 0 || height <= 0) return;
        PF.Raster.rect(pixels,SIZE,SIZE,Math.round(left),Math.round(top),Math.round(left+width-1),Math.round(top+height-1),color(ink),{fill:true});
      },
      line: (left,top,right,bottom,ink,size=1) => PF.Raster.line(pixels,SIZE,SIZE,Math.round(left),Math.round(top),Math.round(right),Math.round(bottom),color(ink),size),
      oval: (left,top,width,height,ink) => PF.Raster.ellipse(pixels,SIZE,SIZE,Math.round(left),Math.round(top),Math.round(left+width-1),Math.round(top+height-1),color(ink),{fill:true})
    };
  }
  function transform(pixels, angle, shiftX=0, shiftY=0, mirror=false) {
    const source = pixels.slice();
    pixels.fill(0);
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    for (let row=0; row<SIZE; row++) for (let column=0; column<SIZE; column++) {
      const horizontal = column-16-shiftX, vertical = row-18-shiftY;
      let sourceX = Math.round(horizontal*cosine+vertical*sine+16);
      const sourceY = Math.round(-horizontal*sine+vertical*cosine+18);
      if (mirror) sourceX = 31-sourceX;
      if (sourceX>=0 && sourceX<SIZE && sourceY>=0 && sourceY<SIZE) pixels[row*SIZE+column]=source[sourceY*SIZE+sourceX];
    }
  }
  const ink = '#232738', steel = '#adc4c9', shine = '#e2ead3', wood = '#8a5a3d', gold = '#e9b85b';
  function human(entry, spec, index, layers) {
    const body = painter(layers.Body), equipment = painter(layers.Equipment), shadow = painter(layers.Shadow);
    const action=spec.action, phase=index/spec.count*Math.PI*2, progress=index/Math.max(1,spec.count-1);
    const side = spec.direction==='east' || spec.direction==='west', back=spec.direction==='north';
    const moving=['walk','run','carry','swim'].includes(action);
    const stride=moving?Math.round(Math.sin(phase)*(action==='run'?3:2)):0;
    let bob=moving?Math.round(Math.abs(Math.sin(phase))*(action==='run'?2:1)):Math.round(Math.sin(phase)*.55);
    if(action==='jump') bob+=Math.round(Math.sin(progress*Math.PI)*5);
    if(action==='fall') bob+=3;
    if(action==='land') bob-=Math.round(Math.sin(progress*Math.PI)*2);
    if(action==='pickup') bob-=Math.round(Math.sin(progress*Math.PI)*3);
    const top=6-bob, torso=15-bob, legs=22-bob;
    shadow.oval(9,26,15,4,'#18232b50');
    body.rect(side?13:11,legs,side?4:4,4+stride,ink);
    body.rect(side?16:18,legs,4,4-stride,ink);
    body.rect(side?13:11,legs,3,2+stride,'#525464');
    body.rect(side?16:18,legs,3,2-stride,'#525464');
    body.rect(side?13:10,legs+3+stride,5,2,'#4b3634');
    body.rect(side?16:18,legs+3-stride,5,2,'#4b3634');
    body.rect(side?13:10,torso,side?8:13,9,ink);
    body.rect(side?14:11,torso,side?6:11,7,entry.coat);
    body.rect(side?14:11,torso,3,6,entry.light);
    body.rect(side?14:11,torso+6,side?6:11,2,'#664535');
    body.rect(side?17:16,torso+6,2,2,gold);
    if(entry.role==='mage') { body.rect(10,torso+5,13,4,entry.coat); body.line(11,torso+8,21,torso+8,entry.light); }
    const faceX=side?13:11;
    body.rect(faceX,top+1,side?9:11,9,ink);
    body.rect(faceX+1,top+2,side?7:9,7,entry.skin);
    body.rect(faceX+1,top+6,2,3,PF.Color.u32ToHex(PF.Color.shade(PF.Color.hexToU32(entry.skin),-22)));
    body.rect(faceX,top,side?8:11,4,entry.hair);
    body.rect(faceX+1,top,side?5:7,1,PF.Color.u32ToHex(PF.Color.shade(PF.Color.hexToU32(entry.hair),22)));
    if(back) { body.rect(faceX,top+2,11,6,entry.hair); body.rect(12,top+7,8,2,entry.hair); }
    else if(side) { body.dot(19,top+5,ink); body.rect(21,top+6,2,2,entry.skin); }
    else { body.dot(14,top+5,ink); body.dot(19,top+5,ink); body.rect(16,top+8,2,1,'#a86c57'); }
    if(entry.gender==='female') { body.rect(side?11:10,top+3,2,7,entry.hair); if(back||side) body.rect(side?10:15,top+7,3,7,entry.hair); }
    if(entry.role==='ranger') { body.line(faceX,top+2,faceX+9,top+2,entry.coat); body.rect(faceX+1,top-1,7,3,entry.coat); body.line(faceX+1,top,faceX-1,top-3,gold); }
    if(entry.role==='knight') { body.rect(faceX-1,top,side?10:13,3,steel); body.rect(faceX-1,top+2,2,5,'#728fa5'); if(back) body.rect(faceX,top+2,11,5,steel); body.rect(faceX+4,top-2,3,2,'#a34a54'); }
    if(entry.role==='mage') { body.line(9,top+2,24,top+2,ink,2); body.rect(11,top,11,2,entry.coat); body.rect(13,top-3,7,4,entry.coat); body.rect(15,top-5,3,3,entry.light); }
    if(entry.role==='miner') { body.rect(faceX-1,top,12,3,entry.coat); body.rect(faceX+5,top,3,2,shine); }
    let handX=side?19:23, handY=torso+5-stride;
    if(['sword','pickaxe','axe','use'].includes(action)) { const angle=-2.7+progress*3.8; handX=20+Math.cos(angle)*4; handY=torso+2+Math.sin(angle)*4; }
    if(['eat','drink'].includes(action)) { handX=side?22:18; handY=top+9-Math.round((Math.sin(phase)+1)*1.5); }
    if(['cast','shoot','block','fish'].includes(action)) { handX=24; handY=torso+1+Math.round(Math.sin(phase)); }
    if(action==='carry') { handX=23; handY=torso+3; }
    body.line(side?15:11,torso+1,side?13:9,torso+6+stride,entry.coat,3);
    body.rect(side?12:8,torso+5+stride,3,3,entry.skin);
    body.line(side?18:21,torso+1,handX,handY,ink,3);
    body.line(side?18:21,torso+1,handX,handY,entry.coat,2);
    body.rect(handX-1,handY,3,3,entry.skin);
    if(['sword','pickaxe','axe','use'].includes(action)) {
      const angle=-2.2+progress*3.5, tipX=handX+Math.cos(angle)*8, tipY=handY+Math.sin(angle)*8;
      equipment.line(handX,handY,tipX,tipY,ink,3);
      equipment.line(handX,handY,tipX,tipY,action==='sword'?steel:wood,1);
      if(action==='sword') { equipment.line(tipX,tipY,tipX-1,tipY-1,shine); equipment.line(handX-2,handY,handX+2,handY,gold); }
      if(action==='pickaxe') equipment.line(tipX-3,tipY-2,tipX+3,tipY+1,steel,2);
      if(action==='axe') { equipment.rect(tipX-3,tipY-2,5,4,steel); equipment.rect(tipX-3,tipY-2,1,4,shine); }
      if(action==='use') equipment.rect(tipX-3,tipY-1,6,3,steel);
      if(index>3&&index<6) { equipment.dot(26,23,gold); equipment.dot(28,20,shine); equipment.dot(24,25,gold); }
    }
    if(action==='block') { equipment.oval(20,torso,8,10,ink); equipment.oval(21,torso+1,6,8,steel); equipment.line(24,torso+2,24,torso+7,gold); }
    if(action==='shoot') { equipment.line(24,torso-4,27,torso+1,wood,2); equipment.line(27,torso+1,24,torso+6,wood,2); equipment.line(24,torso-4,22+progress*2,torso+1,shine); equipment.line(22+progress*2,torso+1,24,torso+6,shine); if(index<5) equipment.line(20,torso+1,30,torso+1,steel); else equipment.line(27,torso+1,31,torso+1,gold); }
    if(action==='cast') { equipment.line(9,torso-5,9,torso+10,wood,2); equipment.oval(7,torso-8,5,5,'#a5dcf0'); const radius=2+Math.sin(progress*Math.PI)*3; equipment.oval(27-radius,torso-radius,radius*2,radius*2,'#8ab8e880'); equipment.dot(27,torso,shine); equipment.dot(24+Math.cos(phase)*4,torso+Math.sin(phase)*5,'#b5a6f3'); }
    if(action==='eat') { equipment.oval(handX,handY-2,4-(index%3),3,'#dcac69'); equipment.dot(handX+1,handY-2,shine); }
    if(action==='drink') { equipment.rect(handX,handY-4,3,5,'#9cc6ce'); equipment.rect(handX,handY-1,3,2,'#7293cf'); equipment.rect(handX+1,handY-5,1,2,wood); }
    if(action==='carry') { equipment.rect(11,torso+3,12,9,ink); equipment.rect(12,torso+4,10,7,wood); equipment.line(13,torso+4,21,torso+10,'#c69658'); }
    if(action==='fish') { equipment.line(handX,handY,27,6,wood); equipment.line(27,6,29,23+Math.sin(phase)*2,shine); equipment.rect(28,24+Math.sin(phase)*2,3,2,'#c76458'); }
    if(action==='pickup') equipment.rect(22,25-Math.sin(progress*Math.PI)*5,3,3,gold);
    if(action==='swim') { for(let row=24;row<32;row++) for(let column=0;column<32;column++) layers.Body[row*32+column]=0; equipment.line(8,25,23,25,'#80c2cf'); equipment.line(11+Math.sin(phase)*2,27,25,27,'#4e8da6'); }
    if(action==='hurt') { transform(layers.Body,0,-Math.sin(progress*Math.PI)*2,0); if(index%2===0) for(let pixel=0;pixel<1024;pixel++) if(layers.Body[pixel]) layers.Body[pixel]=PF.Color.blend(layers.Body[pixel],PF.Color.hexToU32('#ef828b70')); }
    if(action==='death'||action==='sleep'||action==='roll') {
      const angle=action==='sleep'?Math.PI/2:action==='death'?progress*Math.PI/2:progress*Math.PI*2;
      transform(layers.Body,angle,0,action==='roll'?0:5*(action==='sleep'?1:progress));
      layers.Equipment.fill(0);
      if(action==='sleep') { equipment.line(23,9-index,27,9-index,'#9fc8c5'); equipment.line(27,9-index,23,12-index,'#9fc8c5'); equipment.line(23,12-index,27,12-index,'#9fc8c5'); }
    }
    if(spec.direction==='west') { transform(layers.Body,0,0,0,true); transform(layers.Equipment,0,0,0,true); }
  }
  function enemy(entry,spec,index,layers) {
    const body=painter(layers.Body), equipment=painter(layers.Equipment), shadow=painter(layers.Shadow);
    const phase=index/spec.count*Math.PI*2, progress=index/Math.max(1,spec.count-1), back=spec.direction==='north', side=spec.direction==='east'||spec.direction==='west';
    const moving=['walk','run'].includes(spec.action), bob=Math.round(Math.sin(phase)*(moving?2:1));
    shadow.oval(7,26,19,4,'#18232b50');
    if(entry.kind.includes('slime')) {
      const flame=entry.kind==='ember-slime', base=flame?'#c9684e':'#5b9b69', light=flame?'#efba69':'#a2d77a';
      body.oval(6-bob,13+bob,21+bob*2,15-bob,ink); body.oval(7-bob,14+bob,19+bob*2,12-bob,base); body.oval(9,15+bob,7,4,light); body.rect(9,26,15,1,flame?'#954545':'#356252');
      if(!back) { body.rect(side?20:12,20+bob,2,3,ink); if(!side) body.rect(20,20+bob,2,3,ink); body.rect(16,24+bob,2,1,ink); }
    } else if(entry.kind==='bat') {
      const lift=Math.round(Math.sin(phase)*5);
      for(let step=0;step<9;step++) { body.line(14-step,18,14-step,12+lift+step/2,'#655982'); body.line(18+step,18,18+step,12+lift+step/2,'#655982'); }
      body.oval(12,13,9,12,ink); body.oval(13,14,7,8,'#8f79a5'); body.line(13,14,12,10,ink,2); body.line(19,14,20,10,ink,2);
      if(!back) { body.dot(14,17,gold); body.dot(18,17,gold); body.dot(15,21,shine); body.dot(17,21,shine); }
    } else if(entry.kind==='wolf') {
      const stride=moving?Math.round(Math.sin(phase)*3):0;
      body.line(9,19,5,14+bob,'#687580',3); body.oval(8,17+bob,16,8,'#687580'); body.oval(20,11+bob,8,11,'#9aa5a8'); body.rect(21,9+bob,2,5,ink); body.rect(26,10+bob,2,4,ink); body.rect(24,18+bob,6,4,'#b9c2bc'); body.rect(29,18+bob,2,2,ink); body.line(11,22,10+stride,27,ink,3); body.line(21,22,22-stride,27,ink,3); if(!back) body.dot(25,16+bob,gold);
    } else {
      const skin=entry.kind==='skeleton'?'#d5d3b3':'#7fa66a';
      body.line(12,20,11+Math.round(Math.sin(phase)*2),27,ink,3); body.line(20,20,21-Math.round(Math.sin(phase)*2),27,ink,3);
      body.rect(11,15+bob,11,9,entry.kind==='skeleton'?ink:'#755647');
      if(entry.kind==='skeleton') for(let rib=0;rib<3;rib++) body.rect(12,16+bob+rib*2,9,1,skin);
      body.oval(10,6+bob,13,11,ink); body.oval(11,7+bob,11,9,skin);
      if(entry.kind==='goblin') { body.line(11,11+bob,6,9+bob,skin,3); body.line(22,11+bob,27,9+bob,skin,3); }
      if(!back) { body.rect(side?19:13,10+bob,2,3,ink); if(!side) body.rect(19,10+bob,2,3,ink); body.line(14,14+bob,19,14+bob,ink); }
      body.line(11,17+bob,8,22,skin,2); body.line(22,17+bob,25,21,skin,2); equipment.line(25,22,27,12,steel,2);
    }
    if(spec.action==='attack') { transform(layers.Body,0,Math.round(Math.sin(progress*Math.PI)*3),0); equipment.line(22,13+index,29,19+index,'#efc78e',2); }
    if(spec.action==='hurt'&&index%2===0) for(let pixel=0;pixel<1024;pixel++) if(layers.Body[pixel]) layers.Body[pixel]=PF.Color.shade(layers.Body[pixel],55);
    if(spec.action==='death') { transform(layers.Body,progress*Math.PI/2,0,progress*5); layers.Equipment.fill(0); }
    if(spec.action==='spawn') { for(let row=0;row<32*(1-progress);row++) layers.Body.fill(0,row*32,(row+1)*32); }
    if(spec.direction==='west') { transform(layers.Body,0,0,0,true); transform(layers.Equipment,0,0,0,true); }
  }
  function object(entry,spec,index,layers) {
    const body=painter(layers.Body), equipment=painter(layers.Equipment), shadow=painter(layers.Shadow);
    const phase=index/spec.count*Math.PI*2, progress=index/Math.max(1,spec.count-1), kind=entry.kind;
    const sway=Math.round(Math.sin(phase)), inactive=['off','depleted'].includes(spec.action);
    shadow.oval(7,26,19,4,'#18232b50');
    if(entry.category==='Tiles') {
      layers.Shadow.fill(0);
      const base={grass:'#526f45',dirt:'#866443',stone:'#666b70',wall:'#4b515c',water:'#3e748d',sand:'#c6a470'}[kind];
      body.rect(0,0,32,32,base);
      for(let row=0;row<32;row++) for(let column=0;column<32;column++) {
        const noise=(column*17+row*31+column*row*7)%67;
        if(kind==='water') { if((column+row*3+index*2)%19<4&&row%6===0) body.dot(column,row,'#81b9bc'); }
        else if(noise<5) body.dot(column,row,PF.Color.u32ToHex(PF.Color.shade(PF.Color.hexToU32(base),noise%2?12:-10)));
      }
      if(kind==='stone'||kind==='wall') { for(let row=0;row<32;row+=8) { body.line(0,row,31,row,ink); for(let column=(row%16?0:8);column<32;column+=16) body.line(column,row,column,row+7,ink); body.line(0,row+1,31,row+1,'#777e85'); } }
      return;
    }
    if(['oak','pine'].includes(kind)) {
      body.rect(14,15,5,13,ink); body.rect(15,16,3,11,wood); body.rect(16,16,1,11,'#b5824c');
      if(!inactive) { if(kind==='oak') { body.oval(5+sway,4,23,17,ink); body.oval(6+sway,4,21,15,'#426d4b'); body.oval(8+sway,3,15,11,'#689659'); body.oval(10+sway,4,9,4,'#91b767'); }
        else for(let tier=0;tier<3;tier++) { const width=10+tier*6; for(let row=0;row<9;row++) body.rect(16-width/2+sway+row*.5,4+tier*5+8-row,width-row,1,tier%2?'#467b59':'#5b9267'); } }
    } else if(['rock','copper','gold'].includes(kind)) {
      body.oval(5,13,23,15,ink); body.oval(6,13,21,13,'#727c85'); body.oval(8,13,14,7,'#9ca9ad'); body.line(11,17,13,23,'#535967'); body.line(13,23,20,25,'#535967');
      if(kind!=='rock'&&!inactive) for(const [left,top] of [[10,17],[19,16],[18,23]]) { body.rect(left,top,4,3,kind==='gold'?gold:'#c48659'); body.dot(left,top,shine); }
    } else if(['bush','crop','mushroom'].includes(kind)) {
      if(kind==='bush') { body.oval(6,16,22,11,'#355446'); body.oval(8+sway,14,17,11,'#648c4c'); if(!inactive) for(const [left,top] of [[12,17],[19,19],[16,23]]) body.rect(left,top,3,2,'#bd6970'); }
      if(kind==='crop') for(let stalk=0;stalk<5;stalk++) { const left=8+stalk*4; body.line(left,27,left+sway,14-stalk%2*3,'#6b9659'); if(!inactive) { body.line(left+sway,13,left+sway,21,gold,2); body.dot(left+sway-1,14,shine); } }
      if(kind==='mushroom') { body.rect(14,19,5,8,'#e0c99b'); if(!inactive) { body.oval(7+sway,12,20,11,ink); body.oval(8+sway,12,18,9,'#b75560'); body.rect(12+sway,15,3,2,shine); body.rect(20+sway,17,3,2,shine); } }
    } else if(['chest','crate','barrel','workbench','bed','door'].includes(kind)) {
      if(kind==='door') { body.rect(7,3,18,26,ink); body.rect(9,5,14,22,wood); const opened=spec.action==='opened'?1:spec.action==='open'?progress:spec.action==='close'?1-progress:0; body.rect(9,5,Math.max(2,14*(1-opened)),22,'#b58551'); for(let seam=0;seam<3;seam++) body.line(11+seam*4*(1-opened),6,11+seam*4*(1-opened),25,wood); body.rect(18-opened*8,17,2,2,gold); }
      else if(kind==='bed') { body.rect(5,13,23,14,ink); body.rect(6,14,21,12,'#6a7c99'); body.rect(7,15,5,10,'#d9d2b8'); body.line(14,15,14,24,'#9eaabc'); }
      else if(kind==='workbench') { body.rect(5,15,23,5,ink); body.rect(6,15,21,3,'#bf935e'); body.rect(7,20,3,8,wood); body.rect(23,20,3,8,wood); equipment.line(13,14,21,12,steel,2); if(spec.action==='use') equipment.line(18,12,22,5+index%3*2,wood,2); }
      else { body.rect(6,14,21,14,ink); body.rect(7,15,19,12,wood); for(let seam=0;seam<4;seam++) body.line(8+seam*5,16,8+seam*5,26,'#b78450');
        if(kind==='chest') { const opening=spec.action==='opened'?1:spec.action==='open'?progress:spec.action==='close'?1-progress:0; body.rect(7,13-opening*5,19,6,ink); body.rect(8,14-opening*5,17,3,'#c99859'); body.line(8,20,25,20,'#d9ab60'); body.rect(15,19,4,4,gold); if(opening>.5) equipment.oval(11,14,12,5,'#f2d679'); }
        else if(kind==='crate') { body.line(8,16,24,26,'#d0a16b',2); body.line(8,26,24,16,'#d0a16b',2); }
        else { body.rect(6,16,21,2,'#86969e'); body.rect(6,24,21,2,'#86969e'); } }
    } else if(['campfire','forge','torch'].includes(kind)) {
      if(kind==='forge') { body.rect(5,13,23,15,ink); body.rect(6,14,21,13,'#606a73'); body.rect(9,18,15,8,'#2e303b'); body.rect(20,3,7,13,'#78828a'); }
      if(kind==='campfire') { body.line(9,26,23,22,wood,3); body.line(9,22,23,26,'#b6834b',3); for(let stone=0;stone<5;stone++) body.oval(5+stone*5,27,5,3,'#747e88'); }
      if(kind==='torch') body.line(15,26,17,13,wood,3);
      if(!inactive) { const left=kind==='forge'?11:12, top=kind==='forge'?19:12; equipment.oval(left,top-sway,10,12,'#c66042'); equipment.oval(left+2,top-2+index%3,6,12,'#e9a34e'); equipment.oval(left+3,top+3,4,6,'#f4d886'); equipment.dot(left+2+index%4,top-3-index%3,gold); }
    } else {
      const bob=Math.round(Math.sin(phase));
      if(kind==='coin') { const width=3+Math.round(Math.abs(Math.cos(phase))*10); body.oval(16-width/2,11+bob,width,15,ink); body.oval(17-width/2,12+bob,width-2,13,gold); body.line(16-width/2+2,15+bob,16-width/2+2,21+bob,shine); }
      if(kind==='potion') { body.rect(13,8+bob,6,5,steel); body.rect(13,8+bob,6,2,wood); body.oval(9,12+bob,14,15,ink); body.oval(10,13+bob,12,13,'#bacbd0'); body.oval(11,18+bob,10,7,'#b45569'); body.line(12,15+bob,12,19+bob,shine); }
      if(kind==='heart') { body.oval(7,12+bob,10,10,'#ba5968'); body.oval(16,12+bob,10,10,'#ba5968'); for(let row=0;row<8;row++) body.rect(9+row,19+row+bob,15-row*2,1,'#ba5968'); body.rect(10,14+bob,3,2,'#edac9c'); }
      if(kind==='key') { body.oval(8,10+bob,9,9,gold); body.oval(10,12+bob,5,5,ink); body.line(15,17+bob,24,26+bob,gold,2); body.line(21,24+bob,24,21+bob,gold,2); }
      if(kind==='food') { body.oval(7,16+bob,20,10,ink); body.oval(8,15+bob,18,9,'#cea163'); body.line(13,17+bob,11,20+bob,shine); body.line(19,17+bob,17,20+bob,shine); }
      if(['sword','pickaxe','axe','staff'].includes(kind)) { body.line(9,26+bob,22,10+bob,ink,3); body.line(9,26+bob,22,10+bob,kind==='sword'?steel:wood,2); if(kind==='sword') body.line(9,20+bob,16,26+bob,gold,2); if(kind==='pickaxe') body.line(15,8+bob,27,16+bob,steel,3); if(kind==='axe') body.rect(18,7+bob,9,8,steel); if(kind==='staff') { body.oval(18,6+bob,9,9,'#8e86bd'); body.oval(20,7+bob,5,5,'#c1e4df'); } }
      if(kind==='bow') { body.line(10,8+bob,23,17+bob,wood,2); body.line(23,17+bob,10,27+bob,wood,2); body.line(10,8+bob,10,27+bob,shine); body.line(7,17+bob,26,17+bob,steel); }
    }
    if(spec.action==='harvest'||spec.action==='break') { transform(layers.Body,Math.sin(index*3)*.06*(1-progress),0,0); if(progress>.6) { const source=layers.Body.slice(); layers.Body.fill(0); for(let row=0;row<32;row++) for(let column=0;column<32;column++) if((column+row)%3===0&&source[row*32+column]) equipment.rect(column+(column-16)*progress*.2,Math.min(28,row+progress*6),2,2,PF.Color.u32ToHex(source[row*32+column])); } }
    if(spec.action==='grow') for(let row=0;row<26*(1-progress);row++) layers.Body.fill(0,row*32,(row+1)*32);
    if(spec.action==='pickup'&&progress>0) { transform(layers.Body,0,0,-progress*8); for(let pixel=0;pixel<1024;pixel++) { const value=layers.Body[pixel]; if(value) layers.Body[pixel]=((Math.round((value>>>24)*(1-progress))<<24)|(value&0xffffff))>>>0; } }
    if(spec.action==='use'&&!['campfire','forge','workbench'].includes(kind)) transform(layers.Body,Math.sin(phase)*.04,0,-Math.abs(Math.sin(phase)));
  }
  function render(id,stateName,index=0) {
    const entry=find(id), available=specs(entry), spec=available.find(state=>state.name===stateName)||available[0];
    const frameIndex=((Math.floor(index)%spec.count)+spec.count)%spec.count;
    const layers={Shadow:new Uint32Array(1024),Body:new Uint32Array(1024),Equipment:new Uint32Array(1024)};
    if(entry.kind==='human') human(entry,spec,frameIndex,layers);
    else if(entry.category==='Enemies') enemy(entry,spec,frameIndex,layers);
    else object(entry,spec,frameIndex,layers);
    return layers;
  }
  function build(id) {
    const entry=find(id), palette=new Set(), layers=['Shadow','Body','Equipment'].map(name=>({id:name,name,visible:true,opacity:1,locked:name==='Shadow'}));
    const states=specs(entry).map(spec=>({id:`${id}-${spec.name}`,name:spec.name,action:spec.action,direction:spec.direction||null,fps:spec.fps,loop:spec.loop,frames:Array.from({length:spec.count},(_,index)=>{
      const pixels=render(id,spec.name,index);
      for(const buffer of Object.values(pixels)) for(const value of buffer) if(value>>>24) palette.add(PF.Color.u32ToHex(value));
      return {id:`${id}-${spec.name}-${index}`,duration:Math.round(1000/spec.fps),pixels};
    })}));
    return {id:`asset-${id}`,name:entry.name,width:SIZE,height:SIZE,layers,states,palette:[...palette].filter(value=>value.length===7).slice(0,64),activeState:0,activeFrame:0,activeLayer:1,color:entry.coat||'#b3ed9c',metadata:{generator:'PixelForge original procedural library',generatorVersion:VERSION,templateId:id,pivot:{x:.5,y:.875},directions:entry.kind==='human'||entry.category==='Enemies'?DIRECTIONS:[],tileable:entry.category==='Tiles'}};
  }
  function drawPreview(canvas,id,stateName,index=0) {
    const layers=render(id,stateName,index), context=canvas.getContext('2d');
    canvas.width=canvas.height=32;
    const image=context.createImageData(32,32), buffer=new Uint32Array(image.data.buffer);
    PF.Raster.composite(buffer,Object.values(layers).map(pixels=>({pixels,visible:true,opacity:1})));
    context.putImageData(image,0,0);
  }
  const list = () => entries.map(entry=>{const states=specs(entry);return {...entry,states:states.length,frames:states.reduce((sum,state)=>sum+state.count,0)};});
  return { VERSION, SIZE, DIRECTIONS, ACTIONS, entries, templates, list, find, specs, build, render, drawPreview };
})();
