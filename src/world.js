import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AIRPORTS, HQ, WORLD_SIZE, WEATHER, planeById, facilityById, lotPosition, LOT_COLS, LOT_ROWS, LOT_SIZE, rng, clamp } from './data.js';
import { GRID, CELL, heights, heightAt, biomeAt, BIOME_COLORS, nearestAirport } from './terrain.js';
import { selectedPlane } from './state.js';
import { missionTarget } from './missions.js';
import { BRANCH_FACILITIES, branchPosition, townLevel } from './operations.js';
import { AirportLife } from './airport-life.js';

const UP=new THREE.Vector3(0,1,0);
const boxGeo=new THREE.BoxGeometry(1,1,1);
const materials=new Map();
function mat(color,options={}) {
  const key=color+JSON.stringify(options);
  if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.9,...options}));
  return materials.get(key);
}
function block(parent,x,y,z,w,h,d,color,rotation=0) {
  const m=new THREE.Mesh(boxGeo,mat(color));m.position.set(x,y,z);m.scale.set(w,h,d);m.rotation.y=rotation;m.receiveShadow=true;parent.add(m);return m;
}
function disposeGroup(group) {
  for(const child of [...group.children]){
    child.traverse(o=>{if(o.userData.disposable){o.geometry?.dispose();o.material?.dispose();}});
    group.remove(child);
  }
}

export class World {
  constructor(container,state) {
    this.state=state;this.assets=new Map();this.obstacles=[];this.staticRecords=new Map();
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.13;
    container.appendChild(this.renderer.domElement);
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#bdddd9');this.scene.fog=new THREE.Fog('#bdddd9',5000,15500);
    this.camera=new THREE.PerspectiveCamera(58,1,.5,58000);
    this.camera.position.set(HQ.x+75,HQ.elevation+40,HQ.z+340);
    this.scene.add(new THREE.HemisphereLight('#f5f6de','#8d9f83',2.4));
    this.sun=new THREE.DirectionalLight('#fff1d5',3.2);this.sun.position.set(HQ.x-350,HQ.elevation+800,HQ.z+250);
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);
    Object.assign(this.sun.shadow.camera,{left:-220,right:220,top:220,bottom:-220,near:10,far:2000});
    this.sun.shadow.normalBias=1.2;this.sun.shadow.bias=-.00015;this.scene.add(this.sun,this.sun.target);
    this.hqGroup=new THREE.Group();this.scene.add(this.hqGroup);
    this.airportGroup=new THREE.Group();this.scene.add(this.airportGroup);
    this.missionGroup=new THREE.Group();this.scene.add(this.missionGroup);
    this.playerGroup=new THREE.Group();this.scene.add(this.playerGroup);
    this.parkedGroup=new THREE.Group();this.scene.add(this.parkedGroup);
    this.branchGroup=new THREE.Group();this.scene.add(this.branchGroup);
    this.communityGroup=new THREE.Group();this.scene.add(this.communityGroup);
    this.effects=new THREE.Group();this.scene.add(this.effects);
    this.makeTerrain();this.makeSky();this.makeParticles();
    window.addEventListener('resize',()=>this.resize());this.resize();
  }
  resize(){const w=window.innerWidth,h=window.innerHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  async load(onProgress) {
    const base=import.meta.env.BASE_URL;
    const response=await fetch(`${base}models/manifest.json`);
    if(!response.ok)throw new Error('The model library could not be loaded. Start the game with the included launcher.');
    const manifest=await response.json();this.modelCount=manifest.count;
    const loader=new GLTFLoader();let finished=0;
    const failures=[];
    const queue=[...manifest.assets];
    const worker=async()=>{
      while(queue.length){
        const asset=queue.shift();
        try{
          const gltf=await loader.loadAsync(`${base}models/${asset.file}`);
          gltf.scene.updateMatrixWorld(true);
          gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
          const groups=new Map();
          gltf.scene.traverse(o=>{
            if(!o.isMesh || Array.isArray(o.material))return;
            const g=o.geometry.clone().toNonIndexed();g.applyMatrix4(o.matrixWorld);
            for(const key of Object.keys(g.attributes))if(key!=='position'&&key!=='normal')g.deleteAttribute(key);
            if(!g.getAttribute('normal'))g.computeVertexNormals();
            if(!groups.has(o.material.uuid))groups.set(o.material.uuid,{material:o.material,geometries:[]});
            groups.get(o.material.uuid).geometries.push(g);
          });
          const baked=[];
          for(const group of groups.values()){
            const geometry=mergeGeometries(group.geometries,false);
            if(geometry)baked.push({geometry,material:group.material});
            for(const g of group.geometries)g.dispose();
          }
          this.assets.set(asset.id,{scene:gltf.scene,baked});
        }catch(e){failures.push(asset.id);console.error(`Model ${asset.id}:`,e);}
        finished++;onProgress(finished/manifest.count,asset.id.replaceAll('_',' '));
      }
    };
    await Promise.all(Array.from({length:6},worker));
    if(failures.length)throw new Error(`Missing aircraft or scenery models: ${failures.join(', ')}. Please keep the public/models folder with the game.`);
    this.makeAirports();this.mergeAirportSurfaces();this.makeScenery();this.flushInstances();this.rebuildHQ();this.rebuildBranches();this.rebuildCommunities();this.changeAircraft();this.rebuildMission();
    this.airportLife=new AirportLife(this);
    onProgress(1,'Your company is ready');
  }
  makeTerrain(){
    const positions=[],colors=[],indices=[],c=new THREE.Color();
    for(let z=0;z<=GRID;z++)for(let x=0;x<=GRID;x++){
      const wx=-WORLD_SIZE/2+x*CELL,wz=-WORLD_SIZE/2+z*CELL,h=heights[z*(GRID+1)+x];
      positions.push(wx,h,wz);
      const biome=biomeAt(wx,wz,h);c.set(BIOME_COLORS[biome]);
      if(h>0&&h<16)c.set('#dbca9f');
      c.multiplyScalar(.93+.07*Math.sin(x*17.13+z*8.71));colors.push(c.r,c.g,c.b);
    }
    for(let z=0;z<GRID;z++)for(let x=0;x<GRID;x++){
      const a=z*(GRID+1)+x,b=a+1,c1=a+GRID+1,d=c1+1;
      indices.push(a,c1,b,b,c1,d);
    }
    const indexed=new THREE.BufferGeometry();indexed.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));indexed.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));indexed.setIndex(indices);
    const geo=indexed.toNonIndexed();geo.computeVertexNormals();indexed.dispose();
    this.terrain=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true}));this.terrain.receiveShadow=true;this.scene.add(this.terrain);
    this.sea=new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE*2,WORLD_SIZE*2),new THREE.MeshStandardMaterial({color:'#67afb9',roughness:.5,metalness:.05}));
    this.sea.rotation.x=-Math.PI/2;this.sea.position.y=0;this.sea.receiveShadow=true;this.scene.add(this.sea);
    const r=rng(9177),dummy=new THREE.Object3D();
    const waves=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:'#a9d3cf',transparent:true,opacity:.22}),700);
    let count=0;
    for(let i=0;i<1600&&count<700;i++){
      const x=(r()-.5)*WORLD_SIZE,z=(r()-.5)*WORLD_SIZE;
      if(heightAt(x,z)>-4)continue;
      dummy.position.set(x,.16,z);dummy.rotation.y=.28;dummy.scale.set(35+r()*55,.03,2+r()*2);dummy.updateMatrix();waves.setMatrixAt(count++,dummy.matrix);
    }
    waves.count=count;this.scene.add(waves);this.waves=waves;
  }
  makeSky(){
    const r=rng(232),dummy=new THREE.Object3D();
    this.clouds=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:'#f1f3e9',transparent:true,opacity:.82}),260);
    this.cloudPositions=[];
    for(let i=0;i<260;i++){
      const p={x:(r()-.5)*WORLD_SIZE,z:(r()-.5)*WORLD_SIZE,y:1800+r()*1700,sx:150+r()*280,sy:40+r()*60,sz:80+r()*190};this.cloudPositions.push(p);
      dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.sx,p.sy,p.sz);dummy.updateMatrix();this.clouds.setMatrixAt(i,dummy.matrix);
    }
    this.scene.add(this.clouds);
  }
  makeParticles(){
    this.dropPositions=new Float32Array(180*3);this.dropAges=new Float32Array(180).fill(100);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(this.dropPositions,3));
    this.drops=new THREE.Points(geo,new THREE.PointsMaterial({color:'#d2eff2',size:2.8,transparent:true,opacity:.8,sizeAttenuation:true}));this.drops.frustumCulled=false;this.effects.add(this.drops);this.dropIndex=0;
  }
  model(id,parent,x,y,z,scale=1,rotation=0,animated=false){
    const asset=this.assets.get(id);if(!asset)return null;
    const m=animated?asset.scene.clone(true):new THREE.Group();
    if(!animated)for(const part of asset.baked){
      const mesh=new THREE.Mesh(part.geometry,part.material);mesh.castShadow=true;mesh.receiveShadow=true;m.add(mesh);
    }
    m.position.set(x,y,z);m.scale.setScalar(scale);m.rotation.y=rotation;parent.add(m);return m;
  }
  record(id,x,z,scale=1,rotation=0,y=null,collision=null){
    const yy=y??Math.max(0,heightAt(x,z));
    if(!this.staticRecords.has(id))this.staticRecords.set(id,[]);
    this.staticRecords.get(id).push({x,y:yy,z,scale,rotation});
    if(collision)this.obstacles.push({x,z,y:yy,r:collision.r*scale,height:collision.h*scale});
  }
  flushInstances(){
    const dummy=new THREE.Object3D();
    this.staticMeshes=[];
    for(const [id,records] of this.staticRecords){
      const asset=this.assets.get(id);if(!asset)continue;
      for(const part of asset.baked){
        const inst=new THREE.InstancedMesh(part.geometry,part.material,records.length);
        inst.receiveShadow=true;inst.castShadow=true;
        for(let i=0;i<records.length;i++){
          const p=records[i];dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.rotation,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);
        }
        inst.computeBoundingSphere();this.scene.add(inst);this.staticMeshes.push(inst);
      }
    }
  }
  runway(a,length,parent){
    const group=new THREE.Group();group.position.set(a.x,heightAt(a.x,a.z)+.14,a.z);group.rotation.y=a.heading;parent.add(group);
    const width=a.type==='city'?52:36;
    block(group,0,0,0,width,.2,length,'#657877');
    block(group,-width/2+.6,.12,0,.24,.025,length,'#ecebca');block(group,width/2-.6,.12,0,.24,.025,length,'#ecebca');
    for(let z=-length/2+45;z<length/2-30;z+=55)block(group,0,.13,z,.65,.03,23,'#f3ecd9');
    for(const side of [-1,1]){
      for(let x=-10;x<=10;x+=4)block(group,x,.13,side*(length/2-22),1.5,.03,20,'#f3ecd9');
      for(let z=-length/2+15;z<length/2;z+=90){
        const x=side*(width/2+2);
        if(a.id==='hq')this.model('runway_light',group,x,0,z,1);
        else this.record('runway_light',a.x+x*Math.cos(a.heading)+z*Math.sin(a.heading),a.z-x*Math.sin(a.heading)+z*Math.cos(a.heading),1,a.heading,a.elevation+.2);
      }
    }
    return group;
  }
  makeAirports(){
    const r=rng(6677);
    for(const a of AIRPORTS){
      if(a.id==='hq')continue;
      this.runway(a,a.length,this.airportGroup);
      const side=a.x-130,z=a.z+100;
      block(this.airportGroup,side,heightAt(side,z)+.05,z,160,.15,170,'#a7b4a0');
      this.record('windsock',a.x-30,a.z+a.length*.35,1,a.heading);
      this.record('hangar_small',side,z,1,a.heading,undefined,{r:12,h:10});
      this.record(a.type==='city'||a.type==='resort'||a.type==='port'?'airport_terminal':'dispatch_office',side-70,z+25,1,a.heading,undefined,{r:19,h:10});
      if(a.type==='city'||a.type==='port')this.record('control_tower',side-85,z-65,1,0,undefined,{r:5,h:15});
      this.record('cargo_pallet',side+25,z+20,1);
      const choices=a.type==='city'?['city_midrise','city_tower','city_office','town_house_teal']:a.biome==='desert'?['desert_adobe','desert_adobe','factory']:a.biome==='tropical'?['island_bungalow','island_bungalow','resort_hotel']:a.type==='farm'?['farm_barn','farm_house']:a.biome==='mountain'||a.biome==='snow'?['mountain_cabin','mountain_cabin','town_house']:['town_house','town_house_teal','city_midrise'];
      const count=a.type==='city'?135:a.type==='port'?70:a.type==='farm'?18:35;
      const center={x:a.x-1000,z:a.z+200};
      for(let i=0;i<count;i++){
        const col=i%11,row=Math.floor(i/11),x=center.x+col*65-350,z1=center.z+row*75-300;
        if(heightAt(x,z1)<4 || Math.hypot(x-a.x,z1-a.z)<a.length*.6+80)continue;
        const id=choices[Math.floor(r()*choices.length)],scale=.8+r()*.55;
        const h=id==='city_tower'?48:id==='city_office'?32:id==='city_midrise'?25:id==='factory'?28:10;
        this.record(id,x,z1,scale,0,undefined,{r:id.includes('city')?14:8,h});
        if(i%5===0){this.record(a.biome==='tropical'?'tree_palm':'tree_oak',x+28,z1,1.4,0,undefined,{r:2,h:9});}
      }
      for(let i=0;i<7;i++){
        const x=center.x+i*100-350,z1=center.z;
        block(this.airportGroup,x,heightAt(x,z1)+.2,z1,12,.3,700,'#7c8c82');
      }
      if(a.type==='farm'){
        for(let i=0;i<70;i++)this.record('crop_patch',a.x+1000+i%7*32,a.z-1000+Math.floor(i/7)*32,1.8,0);
        this.record('tractor',a.x+930,a.z-850,1.5);
        this.record('water_tower',a.x-640,a.z+100,1);
        for(let i=0;i<25;i++)this.record('orchard_tree',a.x+1300+i%5*10,a.z-500+Math.floor(i/5)*12,1.6);
      }
      if(a.type==='city'){
        this.record('hospital',a.x-1400,a.z-650,1.4,0,undefined,{r:24,h:16});this.record('ambulance',a.x-1410,a.z-610,1.2);
      }
      if(a.type==='port'||a.biome==='tropical'){
        this.record('lighthouse',a.x+750,a.z+700,1.4);
        for(let i=0;i<8;i++)this.record('shipping_container',side-100+i%4*8,z+90+Math.floor(i/4)*4,1);
      }
      if(a.type==='industry')for(let i=0;i<10;i++)this.record('factory',a.x-1100+i%5*75,a.z+800+Math.floor(i/5)*100,1,0,undefined,{r:20,h:28});
      if(a.type==='research')this.record('radar_station',side-70,z-75,1.7,0,undefined,{r:10,h:16});
    }
  }
  makeScenery(){
    const r=rng(24961);
    // A planted valley around the starter airworks gives the first flight a sense of place.
    for(let i=0;i<260;i++){
      const side=i%2?-1:1,x=HQ.x+side*(190+r()*1200),z=HQ.z+(r()-.5)*2700;
      if(x<HQ.x&&Math.abs(z-HQ.z)<250&&x>HQ.x-420)continue;
      const h=heightAt(x,z);if(h<4)continue;
      this.record(i%9===0?'tree_autumn':'tree_oak',x,z,1.4+r()*1.4,r()*Math.PI*2,h,{r:1.1,h:8});
    }
    for(let i=0;i<12;i++){
      const x=HQ.x+450+i%4*45,z=HQ.z+650+Math.floor(i/4)*55;
      this.record(i%3?'town_house':'town_house_teal',x,z,1,0,undefined,{r:7,h:8});
    }
    for(let i=0;i<7500;i++){
      const x=(r()-.5)*(WORLD_SIZE-1000),z=(r()-.5)*(WORLD_SIZE-1000),h=heightAt(x,z);
      if(h<8)continue;
      const n=nearestAirport(x,z);if(n.distance<n.airport.length*.63+160)continue;
      const biome=biomeAt(x,z,h),scale=1.3+r()*2.6;
      let id;
      if(biome==='desert')id=r()<.65?'cactus':'rock_desert';
      else if(biome==='snow')id=r()<.65?'tree_pine':'rock_snow';
      else if(biome==='tropical')id=r()<.8?'tree_palm':'rock_coastal';
      else if(biome==='mountain')id=r()<.83?'tree_pine':'rock_boulder';
      else if(biome==='volcanic')id=r()<.5?'rock_boulder':'tree_palm';
      else id=r()<.82?'tree_oak':r()<.5?'tree_autumn':'bush';
      this.record(id,x,z,scale,r()*Math.PI*2,h,{r:id.includes('tree')?1.1:2,h:id.includes('tree')?8:3});
    }
    for(let i=0;i<18;i++)this.record('wind_turbine',-9200+i%6*180,7000+Math.floor(i/6)*230,2.5);
    for(const a of AIRPORTS.filter(a=>a.biome==='mountain'||a.biome==='desert'))this.record('radio_mast',a.x+1400,a.z+1000,1.8);
    for(const p of [{x:7500,z:10600},{x:17500,z:3000},{x:4900,z:-1800}])if(heightAt(p.x,p.z)<0)this.record('fishing_boat',p.x,p.z,2,1,0);
  }
  mergeAirportSurfaces(){
    this.airportGroup.updateMatrixWorld(true);
    const groups=new Map();
    this.airportGroup.traverse(o=>{
      if(!o.isMesh)return;
      const g=o.geometry.clone().applyMatrix4(o.matrixWorld);
      if(!groups.has(o.material.uuid))groups.set(o.material.uuid,{material:o.material,geometries:[]});
      groups.get(o.material.uuid).geometries.push(g);
    });
    this.airportGroup.clear();
    for(const group of groups.values()){
      const geo=mergeGeometries(group.geometries,false);
      for(const geometry of group.geometries)geometry.dispose();
      if(!geo)continue;
      const mesh=new THREE.Mesh(geo,group.material);mesh.receiveShadow=true;this.airportGroup.add(mesh);
    }
  }
  rebuildHQ(){
    disposeGroup(this.hqGroup);disposeGroup(this.parkedGroup);
    this.obstacles=this.obstacles.filter(o=>!o.hq);
    this.runway(HQ,[800,1250,1850][this.state.runway-1],this.hqGroup);
    block(this.hqGroup,HQ.x-125,HQ.elevation+.13,HQ.z+65,280,.2,220,'#a6b19c');
    block(this.hqGroup,HQ.x-49,HQ.elevation+.2,HQ.z+135,92,.12,28,'#84948b');
    for(let i=0;i<LOT_COLS*LOT_ROWS;i++){
      const p=lotPosition(i),owned=this.state.lots.includes(i);
      if(owned)block(this.hqGroup,p.x,HQ.elevation+.27,p.z,LOT_SIZE-2,.17,LOT_SIZE-2,'#b6bea8');
      if(owned&&!this.state.buildings.some(b=>b.lot===i)){
        for(const dx of [-1,1])for(const dz of [-1,1])this.model('fence_section',this.hqGroup,p.x+dx*20,HQ.elevation+.4,p.z+dz*21,1);
      }
    }
    for(const b of this.state.buildings){
      const p=lotPosition(b.lot),id=b.id==='dispatch'?'dispatch_office':facilityById(b.id)?.model;
      if(!id)continue;
      this.model(id,this.hqGroup,p.x,HQ.elevation+.38,p.z,1,Math.PI/2);
      if(b.id!=='apron'&&b.id!=='helipad')this.obstacles.push({x:p.x,z:p.z,y:HQ.elevation+.3,r:b.id==='largehangar'?20:b.id==='hangar'?11:10,height:b.id==='tower'?16:10,hq:true});
    }
    this.model('windsock',this.hqGroup,HQ.x-30,HQ.elevation,HQ.z-160,1,0);
    for(let i=0;i<5;i++)this.model('cargo_pallet',this.hqGroup,HQ.x-76-i%3*3,HQ.elevation+.4,HQ.z+97+Math.floor(i/3)*2,1);
    const spaces=this.state.buildings.flatMap(b=>{
      const capacity=facilityById(b.id)?.capacity||0,p=lotPosition(b.lot);
      return Array.from({length:capacity},(_,i)=>({x:p.x-15-Math.floor(i/2)*12,z:p.z+(capacity>=2?(i%2-.5)*14:0)}));
    });
    let index=0;
    for(const p of this.state.fleet){
      if(p.uid===this.state.selected)continue;
      if(p.location&&p.location!=='hq')continue;
      const a=planeById(p.type),loc=spaces[index%Math.max(1,spaces.length)]||lotPosition(1);
      const m=this.model(a.model,this.parkedGroup,loc.x,HQ.elevation+.5,loc.z,1,Math.PI/2);
      if(m)m.userData.parked=true;index++;
    }
    this.indexObstacles();
  }
  rebuildBranches(){
    disposeGroup(this.branchGroup);this.obstacles=this.obstacles.filter(o=>!o.branch);
    for(const [id,b] of Object.entries(this.state.branches)){
      const a=AIRPORTS.find(a=>a.id===id);if(!a)continue;
      for(const lot of b.lots){
        const p=branchPosition(a,lot),y=heightAt(p.x,p.z);
        block(this.branchGroup,p.x,y+.25,p.z,42,.2,42,'#b6bea8',a.heading);
        const building=b.buildings.find(v=>v.lot===lot);
        if(building){
          const model=building.id==='dispatch'?'dispatch_office':BRANCH_FACILITIES.find(v=>v.id===building.id)?.model;
          this.model(model,this.branchGroup,p.x,y+.4,p.z,1,a.heading);
          if(building.id!=='apron')this.obstacles.push({x:p.x,z:p.z,y,r:building.id==='hangar'?16:12,height:10,branch:true});
        }else for(const side of [-1,1])this.model('fence_section',this.branchGroup,p.x+Math.cos(a.heading)*side*20,y+.4,p.z-Math.sin(a.heading)*side*20,1,a.heading);
      }
      const sign=branchPosition(a,0);this.model('branch_sign',this.branchGroup,sign.x-22,heightAt(sign.x,sign.z),sign.z+20,1,a.heading);
    }
    const locations=new Map();
    for(const p of this.state.fleet){
      if(p.uid===this.state.selected||!p.location||p.location==='hq')continue;
      const a=AIRPORTS.find(a=>a.id===p.location);if(!a)continue;
      const i=locations.get(a.id)||0;locations.set(a.id,i+1);
      const b=this.state.branches[a.id],parking=b?.buildings.filter(v=>['apron','hangar'].includes(v.id));
      const loc=parking?.length?branchPosition(a,parking[Math.min(i,parking.length-1)].lot):{x:a.x-65-i*25,z:a.z+70};
      this.model(planeById(p.type).model,this.branchGroup,loc.x-14,heightAt(loc.x,loc.z)+.5,loc.z+(i%2)*12,1,a.heading+Math.PI/2);
    }
    this.indexObstacles();
  }
  rebuildCommunities(){
    const stamp=Object.entries(this.state.settlements).map(([id,t])=>`${id}:${townLevel(t)}`).join('|');
    if(stamp===this.communityStamp)return;this.communityStamp=stamp;
    disposeGroup(this.communityGroup);this.obstacles=this.obstacles.filter(o=>!o.community);
    for(const a of AIRPORTS.filter(a=>a.id!=='hq')){
      const level=townLevel(this.state.settlements[a.id]);
      for(let i=0;i<level*5;i++){
        const x=a.x-1770+(i%5)*52,z=a.z+850+Math.floor(i/5)*65,y=heightAt(x,z);if(y<2)continue;
        const model=i===14?'hospital':i===9?'factory':a.biome==='tropical'?'island_bungalow':a.biome==='snow'||a.biome==='mountain'?'mountain_cabin':'town_house_teal';
        this.model(model,this.communityGroup,x,y,z,1);
        this.obstacles.push({x,z,y,r:model==='hospital'?24:10,height:model==='factory'?28:12,community:true});
      }
    }
    this.indexObstacles();
  }
  changeAircraft(){
    disposeGroup(this.playerGroup);
    this.player=this.model(planeById(selectedPlane(this.state).type).model,this.playerGroup,0,0,0,1,0,true);
    this.propellers=[];
    this.player?.traverse(o=>{if(o.name.includes('Propeller_hub')||o.name.includes('Rotor_main'))this.propellers.push(o);});
  }
  rebuildMission(){
    disposeGroup(this.missionGroup);
    this.markerData=[];const m=this.state.mission;
    if(m) {
      for(const [i,t] of m.targets.entries()){
        if(m.category==='tour'||m.category==='survey'){
          const ring=new THREE.Mesh(new THREE.TorusGeometry(t.radius*.64,5,6,36),new THREE.MeshBasicMaterial({color:m.category==='tour'?'#f0d480':'#bfa4e3',transparent:true,opacity:.85}));
          ring.position.set(t.x,t.y,t.z);ring.userData.disposable=true;this.missionGroup.add(ring);this.markerData.push({mesh:ring,target:t,index:i});
        } else if(m.category==='fire'){
          const fireGroup=new THREE.Group();fireGroup.position.set(t.x,t.y,t.z);this.missionGroup.add(fireGroup);
          for(let j=0;j<7;j++){
            const flame=new THREE.Mesh(new THREE.ConeGeometry(15+j%2*8,50+j%3*14,5),new THREE.MeshBasicMaterial({color:j%2?'#f0b055':'#dd7953'}));
            flame.position.set(Math.sin(j*2)*50,22,Math.cos(j*2)*50);flame.userData.disposable=true;fireGroup.add(flame);
            const smoke=new THREE.Mesh(new THREE.IcosahedronGeometry(30,1),new THREE.MeshBasicMaterial({color:'#657779',transparent:true,opacity:.45}));
            smoke.position.set(Math.sin(j*2)*45,100+j*35,Math.cos(j*2)*45);smoke.scale.set(1,1.7,1);smoke.userData.disposable=true;fireGroup.add(smoke);
          }
          this.markerData.push({mesh:fireGroup,target:t,index:i});
        } else if(m.category==='agriculture'){
          const field=new THREE.Mesh(new THREE.PlaneGeometry(155,155),new THREE.MeshBasicMaterial({color:'#e3dc83',transparent:true,opacity:.32,side:THREE.DoubleSide}));
          field.rotation.x=-Math.PI/2;field.position.set(t.x,t.y+1,t.z);field.userData.disposable=true;this.missionGroup.add(field);this.markerData.push({mesh:field,target:t,index:i});
        } else if(m.category==='rescue'){
          this.model('rescue_camp',this.missionGroup,t.x,t.y,t.z,4);
          const beacon=new THREE.Mesh(new THREE.CylinderGeometry(4,4,200,8),new THREE.MeshBasicMaterial({color:'#edcf7e',transparent:true,opacity:.35}));
          beacon.position.set(t.x,t.y+100,t.z);beacon.userData.disposable=true;this.missionGroup.add(beacon);this.markerData.push({mesh:beacon,target:t,index:i});
        }
      }
    }
    this.targetMarker=new THREE.Group();this.missionGroup.add(this.targetMarker);
    const hoop=new THREE.Mesh(new THREE.TorusGeometry(60,3,6,32),new THREE.MeshBasicMaterial({color:'#e3edb4',transparent:true,opacity:.85}));
    hoop.rotation.x=-Math.PI/2;hoop.userData.disposable=true;this.targetMarker.add(hoop);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,160,6),new THREE.MeshBasicMaterial({color:'#e3edb4',transparent:true,opacity:.35}));
    pole.position.y=80;pole.userData.disposable=true;this.targetMarker.add(pole);
  }
  indexObstacles(){
    this.obstacleCells=new Map();
    for(const o of this.obstacles){
      const key=`${Math.floor(o.x/200)},${Math.floor(o.z/200)}`;
      if(!this.obstacleCells.has(key))this.obstacleCells.set(key,[]);
      this.obstacleCells.get(key).push(o);
    }
  }
  hitsObstacle(pos,radius){
    const cx=Math.floor(pos.x/200),cz=Math.floor(pos.z/200);
    for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++)for(const o of this.obstacleCells?.get(`${x},${z}`)||[]){
      if(Math.abs(pos.x-o.x)>o.r+radius || Math.abs(pos.z-o.z)>o.r+radius)continue;
      if(pos.y>o.y-.2 && pos.y<o.y+o.height && Math.hypot(pos.x-o.x,pos.z-o.z)<o.r+radius)return true;
    }
    return false;
  }
  setQuality(quality){
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,quality==='high'?2:quality==='low'?1:1.6));
    this.renderer.shadowMap.enabled=quality!=='low';this.clouds.visible=quality!=='low';
    this.resize();
  }
  update(f,dt,time,input,view='flight',paused=false){
    if(!this.player)return;
    this.playerGroup.position.copy(f.position);this.playerGroup.rotation.set(f.pitch,f.yaw,f.roll,'YXZ');
    for(const p of this.propellers){
      p.rotateY((p.name.includes('Rotor')?4+f.throttle*32:5+f.throttle*65)*dt);
    }
    this.parkedGroup.visible=f.position.distanceTo(new THREE.Vector3(HQ.x,HQ.elevation,HQ.z))<2400;
    this.airportLife?.update(f,dt,paused);
    const target=missionTarget(this.state);
    this.targetMarker?.position.set(target.x,target.y+2,target.z);
    if(this.targetMarker)this.targetMarker.visible=target.kind!=='gate'&&target.kind!=='fire'&&target.kind!=='agriculture';
    for(const marker of this.markerData){
      const m=this.state.mission;if(!m)continue;
      if(m.category==='tour'||m.category==='survey'){
        marker.mesh.visible=marker.index>=m.stage;
        marker.mesh.material.opacity=marker.index===m.stage ? .85 : .2;
        const prev=marker.index>0?m.targets[marker.index-1]:HQ;
        marker.mesh.rotation.y=Math.atan2(marker.target.x-prev.x,marker.target.z-prev.z);
      }else if(m.category==='fire'){marker.mesh.visible=marker.target.progress<1;marker.mesh.scale.setScalar(Math.max(.12,1-marker.target.progress));}
      else if(m.category==='agriculture'){marker.mesh.material.color.set(marker.target.progress>=1?'#9bc583':'#e3dc83');marker.mesh.material.opacity=marker.target.progress>=1 ? .12 : .32;}
      else if(m.category==='rescue')marker.mesh.visible=m.stage===0;
    }
    this.updateParticles(f,input,dt);
    const hour=this.state.clock,daylight=clamp(Math.sin((hour-6)/12*Math.PI),.12,1);
    const weather=WEATHER[(this.state.day-1)%WEATHER.length];
    const sky=new THREE.Color(weather.color).lerp(new THREE.Color('#708e9b'),1-daylight);
    this.scene.background.copy(sky);this.scene.fog.color.copy(sky);this.scene.fog.far=weather.visibility+2000;
    this.sun.intensity=1.1+daylight*2.1;
    this.sun.position.set(f.position.x-350,f.position.y+800,f.position.z+250);this.sun.target.position.copy(f.position);
    const desired=new THREE.Vector3(),look=new THREE.Vector3();
    if(view==='headquarters'){
      desired.set(HQ.x-230,HQ.elevation+240,HQ.z+350);look.set(HQ.x-190,HQ.elevation+5,HQ.z+30);
    }else if(view==='welcome'){
      const angle=.5+Math.sin(time*.035)*.2;
      desired.set(f.position.x+Math.sin(angle)*38,f.position.y+14,f.position.z+Math.cos(angle)*42);look.copy(f.position).add(new THREE.Vector3(0,2,-20));
    }else if(f.cameraMode===1){
      const offset=new THREE.Vector3(0,2.25,-1.05).applyEuler(this.playerGroup.rotation);desired.copy(f.position).add(offset);
      look.copy(desired).add(new THREE.Vector3(0,0,-1000).applyEuler(this.playerGroup.rotation));
      this.player.visible=false;
    }else if(f.cameraMode===2){
      const s=Math.max(1,f.spec.span/10);desired.copy(f.position).add(new THREE.Vector3(45*s,22*s,25*s));look.copy(f.position).add(new THREE.Vector3(0,2,0));
    }else{
      const s=Math.max(1,f.spec.span/12),offset=new THREE.Vector3(0,10*s,31*s).applyAxisAngle(UP,f.yaw);
      desired.copy(f.position).add(offset);look.copy(f.position).add(new THREE.Vector3(-Math.sin(f.yaw)*35,4+f.pitch*12,-Math.cos(f.yaw)*35));
    }
    if(f.cameraMode!==1||view!=='flight')this.player.visible=true;
    const minimum=heightAt(desired.x,desired.z)+3;if(desired.y<minimum)desired.y=minimum;
    this.camera.position.lerp(desired,1-Math.exp(-dt*(f.cameraMode===1?15:3.5)));
    this.camera.lookAt(look);
    this.renderer.render(this.scene,this.camera);
  }
  updateParticles(f,input,dt){
    const spraying=input?.action&&f.payload>0&&!f.grounded&&(f.spec.category==='fire'||f.spec.category==='agriculture');
    if(spraying){
      this.drops.material.color.set(f.spec.category==='fire'?'#d2eff2':'#e0e8a5');
      for(let i=0;i<6;i++){
        const n=this.dropIndex++%180;this.dropPositions[n*3]=f.position.x+(Math.random()-.5)*f.spec.span;this.dropPositions[n*3+1]=f.position.y+1;this.dropPositions[n*3+2]=f.position.z;this.dropAges[n]=0;
      }
    }
    let any=false;
    for(let i=0;i<180;i++){
      this.dropAges[i]+=dt;
      if(this.dropAges[i]<2){this.dropPositions[i*3+1]-=dt*35;any=true;}
      else this.dropPositions[i*3+1]=-5000;
    }
    this.drops.visible=any;this.drops.geometry.attributes.position.needsUpdate=true;
  }
}
