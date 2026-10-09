import * as THREE from 'three';
import { lotPosition } from './data.js';
import { heightAt, nearestAirport, runwayLocal } from './terrain.js';
import { baseFacilities, branchPosition } from './operations.js';

// Airport activity is local to the nearest airfield: a bounded number of animated models.
export class AirportLife {
  constructor(world) {
    this.world=world;this.group=new THREE.Group();world.scene.add(this.group);this.airport=null;this.elapsed=0;this.trafficClock=0;
  }
  point(a,x,z){const c=Math.cos(a.heading),s=Math.sin(a.heading);return {x:a.x+x*c+z*s,z:a.z-x*s+z*c};}
  build(a) {
    this.group.clear();this.airport=a;this.trafficClock=0;this.walkers=[];
    const w=this.world;
    this.truck=w.model('fuel_truck',this.group,0,0,0);
    this.cart=w.model('baggage_cart',this.group,0,0,0,1.35,0,true);
    this.crates=[];this.cart?.traverse(o=>{if(o.name.includes('__supply_box'))this.crates.push(o);});
    this.cartMarkings=[];this.cart?.traverse(o=>{if(o.name.includes('__medical_cross'))this.cartMarkings.push(o);});
    for(let i=0;i<5;i++){
      const model=w.model(i<2?'ground_crew':'airport_passenger',this.group,0,0,0,1.3,0,true),limbs=[];
      model?.traverse(o=>{if(/__(Leg|Arm)_[LR](?:\.\d+)?$/.test(o.name))limbs.push(o);});
      this.walkers.push({model,limbs,index:i});
    }
    this.traffic=w.model(a.type==='city'?'courier_twin':'courier_starter',this.group,0,0,0,1,0,true);
    this.props=[];this.traffic?.traverse(o=>{if(o.name.includes('Propeller_hub'))this.props.push(o);});
  }
  place(model,p,heading=0,y=null) {
    if(!model)return;model.position.set(p.x,y??Math.max(0,heightAt(p.x,p.z))+.4,p.z);model.rotation.y=heading;
  }
  update(f,dt,paused) {
    if(!paused)this.elapsed+=dt;
    const nearest=nearestAirport(f.position.x,f.position.z),a=nearest.airport;
    this.group.visible=nearest.distance<3000;if(!this.group.visible)return;
    if(this.airport?.id!==a.id)this.build(a);
    const s=this.world.state,h=s.mission?.handling||f.groundJob,working=!!h&&h.airport===a.id;
    const fraction=working?1-h.remaining/h.duration:0,approach=Math.min(1,fraction/.38),returning=fraction>.82?(fraction-.82)/.18:0;
    const progress=returning?1-returning:approach;
    const depot=baseFacilities(s,a.id).find(b=>b.id==='fuel'),terminal=baseFacilities(s,a.id).find(b=>b.id==='terminal');
    const apron=this.point(a,-80,70),fuelOrigin=depot?(a.id==='hq'?lotPosition(depot.lot):branchPosition(a,depot.lot)):this.point(a,-65,95);
    const terminalOrigin=terminal?(a.id==='hq'?lotPosition(terminal.lot):branchPosition(a,terminal.lot)):this.point(a,-125,115);
    const target={x:f.position.x+Math.cos(f.yaw)*(f.spec.span*.55+4),z:f.position.z-Math.sin(f.yaw)*(f.spec.span*.55+4)};
    const fuelJob=working&&(h.kind==='fuel'||h.kind==='repair'),loadJob=working&&!fuelJob;
    const mix=(from,to,t)=>({x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t});
    const truckPos=fuelJob?mix(fuelOrigin,target,progress):fuelOrigin;
    this.place(this.truck,truckPos,fuelJob?Math.atan2(fuelOrigin.x-target.x,fuelOrigin.z-target.z):a.heading);
    this.place(this.cart,loadJob?mix(apron,{x:target.x+3,z:target.z+3},progress):{x:apron.x+10,z:apron.z+5},a.heading);
    for(const [i,crate] of this.crates.entries())crate.visible=!loadJob||(h.kind==='unload'?fraction>.4+i*.08:fraction<.45+i*.08);
    for(const [i,mark] of this.cartMarkings.entries())mark.visible=this.crates[2+Math.floor(i/2)]?.visible!==false;
    const passengerJob=loadJob&&(s.mission?.category==='tour'||h.kind==='patient');
    for(const actor of this.walkers){
      const {index,model,limbs}=actor;if(!model)continue;
      const crew=index<2,origin=crew?{x:apron.x+index*3,z:apron.z+index*2}:{x:terminalOrigin.x+(index-2)*2,z:terminalOrigin.z+12};
      const moving=crew?working:passengerJob;
      model.visible=crew||passengerJob||!!terminal||['city','port','resort'].includes(a.type);
      if(!crew&&passengerJob&&h.kind!=='unload'&&fraction>.65){model.visible=false;continue;}
      const t=moving?Math.min(1,Math.max(0,progress-(crew?0:(index-2)*.06))):0;
      const journey=!crew&&passengerJob&&h.kind==='unload'?1-Math.min(1,fraction/.8):t;
      const walk=moving?mix(origin,{x:target.x+index*.7,z:target.z-index},journey):{x:origin.x+Math.sin(this.elapsed*.32+index)*2,z:origin.z+Math.cos(this.elapsed*.32+index)*2};
      this.place(model,walk,moving?Math.atan2(origin.x-target.x,origin.z-target.z):this.elapsed*.32+index);
      const stepping=!paused&&(!moving||t>0&&t<1);
      for(const limb of limbs)limb.rotation.x=stepping?Math.sin(this.elapsed*6+index+(/_R(?:\.\d+)?$/.test(limb.name)?Math.PI:0))*.4:crew&&working&&t>.98&&limb.name.includes('__Arm_')?-.8+Math.sin(this.elapsed*3)*.16:0;
    }
    this.updateTraffic(a,f,dt,paused);
  }
  updateTraffic(a,f,dt,paused) {
    if(!this.traffic)return;
    const local=runwayLocal(a,f.position.x,f.position.z),length=a.id==='hq'?[800,1250,1850][this.world.state.runway-1]:a.length;
    const blocked=Math.abs(local.x)<100&&Math.abs(local.z)<length*.8+600&&f.agl<250;
    let phase=this.trafficClock%180;
    if(!paused){
      if(blocked&&phase>=28&&phase<80)this.trafficClock=28;
      else if(blocked&&phase>=110&&phase<160)this.trafficClock=110;
      else this.trafficClock+=dt;
    }
    phase=this.trafficClock%180;
    let x=0,z=0,y=.5,yaw=a.heading;
    const lerp=(from,to,t)=>from+(to-from)*t;
    if(blocked&&phase>=28&&phase<80){
      const angle=this.elapsed*.13;x=Math.sin(angle)*350;z=length/2+1400+Math.cos(angle)*350;y=250;
      yaw=a.heading+Math.atan2(-Math.cos(angle),Math.sin(angle));
    }else if(phase<40){z=lerp(length/2+1000,length/2,phase/40);y=lerp(120,.5,phase/40);}
    else if(phase<60){z=lerp(length/2,-length*.3,(phase-40)/20);}
    else if(phase<80){const t=(phase-60)/20;x=lerp(0,-90,t);z=lerp(-length*.3,60,t);yaw=a.heading+Math.atan2(90,-(60+length*.3));}
    else if(phase<110){x=-90;z=60;yaw=a.heading+Math.PI/2;}
    else if(phase<145){const t=(phase-110)/35;x=lerp(-90,0,t);z=lerp(60,length*.4,t);yaw=a.heading+Math.atan2(-90,-(length*.4-60));}
    else if(phase<160){const t=(phase-145)/15;z=lerp(length*.4,-length*.5,t);y=lerp(.5,80,Math.max(0,(t-.3)/.7));}
    else {const t=(phase-160)/20;z=-length*.5-t*1600;y=80+t*190;}
    const position=this.point(a,x,z);this.place(this.traffic,position,yaw,Math.max(0,heightAt(a.x,a.z))+y);
    this.traffic.rotation.x=phase>=145&&phase<180?.08:phase<40?-.04:0;
    if(!paused)for(const prop of this.props)prop.rotateY(dt*(phase>=80&&phase<=110?4:48));
    // Traffic is decorative and yields to the player's runway; it never obstructs flight.
  }
}
