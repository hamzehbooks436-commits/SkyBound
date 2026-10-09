import * as THREE from 'three';
import { HQ, WORLD_SIZE, WEATHER, clamp, distance, airportById } from './data.js';
import { heightAt, onRunway, nearestAirport } from './terrain.js';
import { selectedPlane, transact } from './state.js';
import { effectiveSpec, baseHas, missionCargoWeight } from './operations.js';

const smooth=(value,target,rate,dt)=>THREE.MathUtils.damp(value,target,rate,dt);
export class Flight {
  constructor(state) {
    this.state=state;
    this.position=new THREE.Vector3();
    this.cameraMode=0; this.timeScale=1; this.flaps=true; this.cruiseHold=false;
    this.pitch=0; this.roll=0; this.yaw=0; this.speed=0; this.verticalSpeed=0; this.throttle=0;
    this.grounded=true; this.agl=0; this.stalling=false; this.payload=0; this.flightSeconds=0;
    this.spawn(airportById(this.aircraft.location||this.aircraft.home||'hq'));
    const saved=state.flight;
    if(saved && [saved.x,saved.y,saved.z,saved.yaw].every(Number.isFinite)) {
      this.position.set(saved.x,saved.y,saved.z); this.yaw=saved.yaw;
      this.speed=clamp(saved.speed||0,0,this.spec.cruise*1.4); this.throttle=clamp(saved.throttle||0,0,1);
      this.pitch=clamp(saved.pitch||0,-.5,.5); this.roll=clamp(saved.roll||0,-1,1);
      this.verticalSpeed=saved.verticalSpeed||0; this.grounded=!!saved.grounded;
      this.payload=Number.isFinite(saved.payload)?saved.payload:this.payload;
      this.flaps=saved.flaps!==false;
      this.agl=this.position.y-Math.max(0,heightAt(this.position.x,this.position.z));
      this.aircraft.location=this.atAirport()?.id||null;
      const job=saved.groundJob;
      if(job&&['fuel','repair'].includes(job.kind)&&job.airport===this.atAirport()?.id&&Number.isFinite(job.duration)&&Number.isFinite(job.remaining)){
        const duration=clamp(job.duration,1,30);
        this.groundJob={kind:job.kind,airport:job.airport,duration,remaining:clamp(job.remaining,0,duration)};
      }
    }
  }
  get aircraft(){ return selectedPlane(this.state); }
  get spec(){ return effectiveSpec(this.aircraft); }
  spawn(a=HQ) {
    const heading=a.heading;
    const offset=a.id==='hq'?([800,1250,1850][this.state.runway-1])*.32:a.length*.3;
    this.position.set(a.x+Math.sin(heading)*offset,Math.max(0,heightAt(a.x,a.z))+.26,a.z+Math.cos(heading)*offset);
    this.yaw=heading; this.pitch=0; this.roll=0; this.speed=0; this.verticalSpeed=0; this.throttle=0;
    this.grounded=true; this.agl=0; this.stalling=false; this.timeScale=1; this.cruiseHold=false;
    this.flaps=true;
    this.aircraft.location=a.id;
    this.resetPayload();
  }
  resetPayload(){ this.payload=(this.spec.category==='fire'||this.spec.category==='agriculture')?this.spec.capacity:0; }
  atAirport() {
    const n=nearestAirport(this.position.x,this.position.z);
    return this.grounded && this.speed<3 && n.distance<n.airport.length*.65+150?n.airport:null;
  }
  atHQ(){ return this.atAirport()?.id==='hq'; }
  snapshot() {
    return {x:this.position.x,y:this.position.y,z:this.position.z,yaw:this.yaw,pitch:this.pitch,roll:this.roll,speed:this.speed,verticalSpeed:this.verticalSpeed,throttle:this.throttle,grounded:this.grounded,payload:this.payload,flaps:this.flaps,groundJob:this.groundJob?{...this.groundJob}:null};
  }
  update(input,dt,world) {
    const a=this.spec,p=this.aircraft;
    const m=this.state.mission;
    if(this.grounded&&(m?.handling||this.groundJob)){
      this.throttle=0;this.speed=smooth(this.speed,0,6,dt);
      if(this.groundJob){
        this.groundJob.remaining-=dt;
        if(this.groundJob.remaining<=0){this.groundJob=null;return {type:'stage',text:'Ground service complete. Ready to depart.'};}
      }
      return null;
    }
    const missionLoad=m?.category==='cargo'?missionCargoWeight(m)/a.capacity:m?.category==='tour'?m.payload/a.seats:(m?.category==='medical'&&m.stage===1 ? .5 : 0);
    const load=clamp(missionLoad+(p.fuel/a.fuel)*.1,0,1);
    this.flightSeconds+=dt;
    const manual=input.pitch!==0 || input.bank!==0 || input.rudder!==0;
    if(manual) this.cruiseHold=false;
    if(input.throttleDelta) this.throttle=clamp(this.throttle+input.throttleDelta*dt*.4,0,1);
    if(p.fuel<=0 || p.condition<=0) this.throttle=0;
    const pitchInput=clamp(input.pitch,-1,1),bankInput=clamp(input.bank,-1,1);
    const assisted=this.state.settings.assist;
    if(a.helicopter) {
      this.yaw+=input.rudder*a.turn*dt-bankInput*a.turn*.7*dt;
      this.roll=smooth(this.roll,-bankInput*.28,3,dt);
      this.pitch=smooth(this.pitch,-pitchInput*.25,3,dt);
      const targetSpeed=clamp(pitchInput*48+(this.throttle-.5)*a.cruise*.65,0,a.cruise);
      this.speed=smooth(this.speed,input.brake?0:targetSpeed,1.5,dt);
      const climb=(this.throttle-.52)*a.climb*2;
      this.verticalSpeed=smooth(this.verticalSpeed,p.fuel>0?climb:-15,1.8,dt);
      if(this.grounded && this.throttle>.57 && p.fuel>0){this.grounded=false;this.position.y+=.15;}
    } else {
      const authority=clamp(this.speed/(a.stall*.9),.22,1);
      const desiredRoll=bankInput?-bankInput*.95:(assisted||this.cruiseHold?0:this.roll);
      this.roll=smooth(this.roll,this.grounded?0:desiredRoll,assisted?3:1.7,dt);
      if(pitchInput) this.pitch=clamp(this.pitch+pitchInput*.43*authority*dt,-.48,.48);
      else if(assisted || this.cruiseHold) this.pitch=smooth(this.pitch,0,.75,dt);
      this.yaw+=(Math.sin(this.roll)*a.turn*authority+input.rudder*a.turn*(this.grounded ? .7 : .3)+(this.grounded?-bankInput*.45:0))*dt;
      const flapDrag=this.flaps&&!this.grounded?1.16:1;
      const drag=a.acceleration/(a.cruise*a.cruise)*this.speed*this.speed*flapDrag;
      const power=this.throttle*a.acceleration*(.55+p.condition*.0045)*(1-load*.13);
      this.speed=Math.max(0,this.speed+(power-drag-Math.sin(this.pitch)*9.81-(this.grounded?1.35:0)-(input.brake&&this.grounded?11:0))*dt);
      const stall=a.stall*(this.flaps ? .86 : 1)*(1+load*.08);
      this.stalling=!this.grounded && this.speed<stall;
      let vTarget=Math.sin(this.pitch)*this.speed*.82;
      if(this.stalling) vTarget-=(1-this.speed/stall)*28;
      this.verticalSpeed=smooth(this.verticalSpeed,clamp(vTarget,-45,a.climb),2.2,dt);
      if(this.grounded) {
        this.verticalSpeed=0;
        if(this.pitch>.055 && this.speed>stall*1.18) {this.grounded=false;this.position.y+=.15;this.verticalSpeed=2;}
      }
    }
    const weather=WEATHER[(this.state.day-1)%WEATHER.length];
    const windScale=this.grounded?0:.45;
    const dx=-Math.sin(this.yaw)*this.speed+Math.sin(weather.angle)*weather.wind*windScale;
    const dz=-Math.cos(this.yaw)*this.speed+Math.cos(weather.angle)*weather.wind*windScale;
    const previous=this.position.clone();
    this.position.x+=dx*dt; this.position.z+=dz*dt;
    this.position.y+=this.verticalSpeed*dt;
    const runway=onRunway(this.position.x,this.position.z,this.state);
    const ground=heightAt(this.position.x,this.position.z),floor=Math.max(0,ground)+(runway ? .26 : .04);
    this.agl=Math.max(0,this.position.y-Math.max(0,ground));
    if(this.grounded) {
      this.position.y=floor;
      this.pitch=smooth(this.pitch,clamp(this.pitch,-.02,.18),4,dt);
      if(!runway && this.speed>18 && !a.helicopter) p.condition=Math.max(0,p.condition-dt*(this.speed/20)*a.roughDamage);
      if(ground<-.5 && !a.amphibious && !a.helicopter) return this.crash('Your aircraft reached the water.');
    } else if(this.position.y<=floor) {
      const hard=this.verticalSpeed<-a.landingLimit || Math.abs(this.roll)>.52 || this.pitch<-.26 || this.speed>a.cruise*.88;
      if(hard || (ground<-.5&&!a.amphibious) || (!runway&&this.speed>48&&!a.amphibious)) return this.crash('A hard landing damaged the aircraft.');
      this.grounded=true;this.position.y=floor;this.agl=0;
      const damage=(Math.max(0,(-this.verticalSpeed-2)*2.5)+(runway?0:4))*a.roughDamage;
      p.condition=Math.max(0,p.condition-damage);
      this.verticalSpeed=0; this.pitch=0; this.roll=0; this.cruiseHold=false; this.timeScale=1;
      return {type:'landing',text:runway?`Touchdown at ${runway.name}. Brake and press E when parked.`:'Touchdown. Taxi carefully on the rough ground.'};
    }
    if(world?.hitsObstacle(this.position,a.span*.12)) return this.crash('Your aircraft hit a building or tree.');
    const bound=WORLD_SIZE/2-150;
    if(Math.abs(this.position.x)>bound||Math.abs(this.position.z)>bound) {
      this.position.x=clamp(this.position.x,-bound,bound);this.position.z=clamp(this.position.z,-bound,bound);
      this.yaw+=Math.PI; this.speed*=.8; this.timeScale=1;
      return {type:'boundary',text:'You reached the edge of the operating region. Turn back toward the airfields.'};
    }
    p.fuel=Math.max(0,p.fuel-a.burn*(.2+this.throttle*.8)*dt);
    if(!this.grounded) {
      p.hours+=dt/3600;
      p.location=null;
      p.condition=Math.max(0,p.condition-dt*.002*a.wear*(baseHas(this.state,p.home||'hq','maintenance') ? .6 : 1)*(baseHas(this.state,p.home||'hq','hangar') ? .8 : 1));
      this.state.totalDistance+=distance(previous,this.position)/1000;
    }
    const n=nearestAirport(this.position.x,this.position.z);
    const parked=this.atAirport();if(parked)p.location=parked.id;
    if(n.distance<1400&&!this.state.discovered.includes(n.airport.id)) {
      this.state.discovered.push(n.airport.id);
      return {type:'discovery',text:`Discovered ${n.airport.name} · ${n.airport.region}`};
    }
    return null;
  }
  crash(reason) {
    const s=this.state,p=this.aircraft;
    const bill=Math.min(s.money,1800+Math.round((100-p.condition)*12));
    transact(s,-bill,'Aircraft recovery & emergency repair');
    s.reputation=Math.max(0,s.reputation-3); s.mission=null;
    p.condition=75; p.fuel=Math.max(p.fuel,this.spec.fuel*.5);
    this.groundJob=null;this.spawn();
    return {type:'crash',text:reason,bill};
  }
}

export class Controls {
  constructor() {
    this.keys=new Set();this.pressed=new Set();this.onClear=new Set();this.touch={pitch:0,bank:0,rudder:0,throttleDelta:0,brake:false,action:false,interact:false};
    window.addEventListener('keydown',e=>{
      if(e.target.matches('textarea,select,input:not([type="range"]):not([type="checkbox"]):not([type="file"])')) return;
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
      if(!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>this.clear());
  }
  consume(key){const yes=this.pressed.has(key);this.pressed.delete(key);return yes;}
  clear(){this.keys.clear();this.pressed.clear();for(const k of Object.keys(this.touch))this.touch[k]=typeof this.touch[k]==='boolean'?false:0;for(const reset of this.onClear)reset();}
  read() {
    const k=this.keys,gamepad=navigator.getGamepads?.()[0];
    const padInteract=!!gamepad?.buttons[2]?.pressed;
    const padInteractPressed=padInteract&&!this.padInteractHeld;
    this.padInteractHeld=padInteract;
    const dead=n=>Math.abs(n||0)>.12?n:0;
    return {
      pitch:(k.has('KeyS')||k.has('ArrowDown')?1:0)-(k.has('KeyW')||k.has('ArrowUp')?1:0)+this.touch.pitch-(gamepad?dead(gamepad.axes[1]):0),
      bank:(k.has('KeyD')||k.has('ArrowRight')?1:0)-(k.has('KeyA')||k.has('ArrowLeft')?1:0)+this.touch.bank+(gamepad?dead(gamepad.axes[0]):0),
      rudder:(k.has('KeyZ')?1:0)-(k.has('KeyX')?1:0)+this.touch.rudder,
      throttleDelta:(k.has('ShiftLeft')||k.has('ShiftRight')||k.has('KeyR')?1:0)-(k.has('ControlLeft')||k.has('ControlRight')||k.has('KeyF')?1:0)+this.touch.throttleDelta+(gamepad?((gamepad.buttons[7]?.value||0)-(gamepad.buttons[6]?.value||0)):0),
      brake:k.has('KeyB')||this.touch.brake||!!gamepad?.buttons[1]?.pressed,
      action:k.has('Space')||this.touch.action||!!gamepad?.buttons[0]?.pressed,
      interact:k.has('KeyE')||this.touch.interact||!!gamepad?.buttons[2]?.pressed,
      interactPressed:this.consume('KeyE')||this.consume('TouchInteract')||padInteractPressed,
    };
  }
}
