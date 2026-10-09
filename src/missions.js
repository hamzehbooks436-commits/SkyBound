import { HQ, CATEGORIES, airportById, rng, distance, clamp, applyMissionPay, cash } from './data.js';
import { selectedPlane, hasFacility, transact } from './state.js';
import { SUPPLIES, baseOwned, baseHas, effectiveSpec, townLevel, supplySettlement, missionCargoWeight, routePlan, availablePayload } from './operations.js';
import { heightAt } from './terrain.js';

const clients=['Valley Co-operative','Azure Supply Co.','Regional Postal Service','Greenheart Schools','Northern Research Council','Harvest Market','Meridian Construction','Sundrift Community'];
export function refreshContracts(s) {
  const r=rng(7049+s.day*83+s.contractSerial++*611);
  const list=[];
  const bases=['hq',...Object.keys(s.branches)];
  const origins=[...new Set([...bases,...s.discovered])];
  let cargoSerial=0;
  for(const origin of origins){
    const start=airportById(origin),owned=baseOwned(s,origin);
    const destinations=owned?['hq',...Object.keys(s.settlements)].filter(id=>id!==origin):bases.filter(id=>id!==origin);
    destinations.sort((a,b)=>distance(start,airportById(a))-distance(start,airportById(b)));
    for(const [i,id] of destinations.entries()){
      const a=airportById(id),t=s.settlements[id],km=distance(start,a)/1000;
      const level=townLevel(t),supplies=owned?Object.keys(SUPPLIES):[['food','medicine','materials'][i%3]];
      for(const supply of supplies){
        const urgent=t&&t[supply]<25,baseWeight=supply==='medicine'?55:supply==='materials'?90:75;
        const weight=Math.round((baseWeight+r()*40)*(1+level*.22)*(t?clamp(t.population/a.population,.9,1.35):1));
        list.push({id:`c${s.contractSerial}-${cargoSerial++}`,category:'cargo',origin,destination:id,supply,urgent,
          title:urgent?`Urgent ${SUPPLIES[supply].unit}`:owned?SUPPLIES[supply].name:'Return freight',client:owned?clients[i%clients.length]:`${start.name} freight counter`,
          payload:weight,reward:Math.round((1000+km*200+weight*3)*(urgent?1.25:1)/50)*50,rep:urgent?3:1,distance:km,
          description:`Load ${weight} kg at ${start.name} and deliver to ${a.name}.${urgent?' Supplies are critically low.':''} Can share a manifest with other orders from this airport.`});
      }
      if(owned&&baseHas(s,origin,'warehouse')&&i%3===0){
        const heavy=s.reputation>=30&&level>=1,bulkWeight=Math.round((heavy?2500:650)+r()*(heavy?2300:650)+level*150);
        const supply=t?Object.keys(SUPPLIES).sort((x,y)=>t[x]-t[y])[0]:'materials',urgent=t&&t[supply]<25;
        list.push({id:`b${s.contractSerial}-${cargoSerial++}`,category:'cargo',origin,destination:id,supply,urgent,title:heavy?'Development project freight':'Regional bulk delivery',client:`${a.name} development council`,payload:bulkWeight,reward:Math.round((1900+km*300+bulkWeight*(heavy?5.5:4.4))*(urgent?1.25:1)/50)*50,rep:heavy?5:3,distance:km,description:`Transport ${bulkWeight} kg of ${SUPPLIES[supply].unit}. Settlement development expands demand for larger shipments.`});
      }
    }
  }
  const categories=['medical','agriculture','tour','survey','fire','rescue'];
  const settings={
    medical:{destinations:['ridge','frontier','palm','aurora'],titles:['A lifeline from the mountains','Remote clinic transfer','Island patient transfer'],client:'Regional Health Service',base:8200},
    agriculture:{destinations:['meadow','westvale'],titles:['Protect the spring harvest','Westvale crop treatment'],client:'Harvest Growers Union',base:6500},
    tour:{destinations:['sunreef','ridge','coral','port'],titles:['The island panorama','Above the highlands','Coral coast charter'],client:'Sundrift Travel',base:7300},
    survey:{destinations:['mesa','alpine','volcano','delta'],titles:['Map the uncharted valley','Highland aerial survey','Ember geological survey'],client:'Regional Survey Bureau',base:7400},
    fire:{destinations:['ridge','frontier','mesa'],titles:['Pinecrest wildfire','Frontier fire response'],client:'Wilderness Fire Service',base:12500},
    rescue:{destinations:['alpine','canyon','volcano','delta'],titles:['Stranded in the wilderness','Mountain rescue beacon'],client:'Search & Rescue Council',base:10800},
  };
  for(const [i,cat] of categories.entries()) {
    const opt=settings[cat],dest=opt.destinations[Math.floor(r()*opt.destinations.length)],a=airportById(dest),km=distance(HQ,a)/1000;
    list.push({ id:`s${s.contractSerial}-${i}`,category:cat,origin:'hq',title:opt.titles[Math.floor(r()*opt.titles.length)],client:opt.client,destination:dest,payload:cat==='tour'?4:cat==='medical'?240:0,reward:Math.round((opt.base+km*190)/100)*100,rep:cat==='fire'||cat==='rescue'?5:4,distance:km,description:CATEGORIES[cat].action });
  }
  for(const origin of Object.keys(s.branches).filter(id=>baseHas(s,id,'terminal'))){
    const a=airportById(origin);
    list.push({id:`tour${s.contractSerial}-${origin}`,category:'tour',origin,title:`${a.name} scenic departure`,client:'Regional visitor bureau',destination:origin,payload:4,reward:7400,rep:4,distance:12,description:'Board four passengers at your branch terminal, fly the scenic gates, and return to this base.'});
  }
  if(s.reputation>=30){
    const km=distance(HQ,airportById('coral'))/1000;
    list.push({id:`charter${s.contractSerial}`,category:'tour',title:'Grand archipelago charter',client:'Meridian World Travel',destination:'coral',payload:16,reward:Math.round((19500+km*250)/100)*100,rep:6,distance:km,description:'Carry sixteen passengers through five panoramic island gates, then bring them safely home. Requires a Cloudswift charter aircraft.'});
  }
  s.contracts=list.map(applyMissionPay);
}
export function contractLock(s,c) {
  const p=selectedPlane(s),a=effectiveSpec(p);
  if(a.category!==c.category) return `Requires ${CATEGORIES[c.category].name.toLowerCase()} aircraft`;
  if(c.category==='cargo'&&c.payload>availablePayload(a,p.fuel)) return `Payload exceeds ${availablePayload(a,p.fuel)} kg with current fuel`;
  if(c.category!=='cargo'&&c.category!=='tour'&&c.payload>a.capacity) return `Payload exceeds ${a.capacity} kg capacity`;
  if(c.category==='tour' && c.payload>a.seats) return `Requires ${c.payload} passenger seats`;
  if(selectedPlane(s).condition<25) return 'Repair your aircraft first';
  if(p.fuel+1e-6<a.fuel*.1) return 'Refuel your aircraft first';
  if(s.mission) return 'Finish or cancel your current contract';
  return null;
}

export function acceptContract(s,c) {
  if(c.category==='cargo')return acceptManifest(s,[c.id]);
  const lock=contractLock(s,c); if(lock) return lock;
  const a=airportById(c.destination);
  const m={...c,origin:c.origin||'hq',stage:0,elapsed:0,progress:0,quality:100,targets:[],winch:0,deadline:c.category==='medical'?900:c.category==='fire'?1100:0};
  if(c.category==='tour')m.handling={kind:'load',airport:m.origin,remaining:8,duration:8};
  if(c.category==='fire') {
    for(let i=0;i<4;i++) {
      const x=a.x+1150+(i%2)*270,z=a.z-1100+Math.floor(i/2)*280;
      m.targets.push({x,z,y:Math.max(0,heightAt(x,z)),progress:0,radius:185});
    }
  }
  if(c.category==='agriculture') {
    for(let i=0;i<10;i++) {
      const x=a.x+1050+(i%2)*170,z=a.z-900+Math.floor(i/2)*170;
      m.targets.push({x,z,y:Math.max(0,heightAt(x,z)),progress:0,radius:135});
    }
  }
  if(c.category==='tour'||c.category==='survey') {
    for(let i=0;i<5;i++) {
      const angle=i*.9-.8,radius=1600+(i%2)*800;
      const x=a.x+Math.sin(angle)*radius,z=a.z+Math.cos(angle)*radius;
      m.targets.push({x,z,y:Math.max(0,heightAt(x,z))+(c.category==='tour'?280:650),progress:0,radius:c.category==='tour'?230:190});
    }
  }
  if(c.category==='rescue') {
    const x=a.x+1250,z=a.z-1250;
    m.targets.push({x,z,y:Math.max(0,heightAt(x,z)),progress:0,radius:95});
  }
  s.mission=m;
  s.contracts=s.contracts.filter(t=>t.id!==c.id);
  return null;
}
export function manifestLock(s,orders) {
  if(!orders.length)return 'Choose cargo orders to add to your manifest';
  if(orders.length>6)return 'Carry up to six orders on one flight';
  if(orders.some(o=>o.category!=='cargo'||(o.origin||'hq')!==(orders[0].origin||'hq')))return 'All cargo must be collected at the same airport';
  for(const c of orders){const lock=contractLock(s,c);if(lock)return lock;}
  const plan=routePlan(s,orders,orders[0].origin||'hq',selectedPlane(s));
  if(plan.payload>plan.capacity)return `Combined cargo is ${plan.payload} kg; current fuel leaves ${plan.capacity} kg capacity`;
  if(plan.fuel>selectedPlane(s).fuel)return `Route estimate including return and reserve needs ${plan.fuel} L. Refuel or shorten the route`;
  return null;
}
export function acceptManifest(s,ids) {
  const unique=[...new Set(ids)],orders=unique.map(id=>s.contracts.find(c=>c.id===id));
  if(orders.some(o=>!o))return 'One of these orders is no longer on the board';
  const lock=manifestLock(s,orders);if(lock)return lock;
  const origin=orders[0].origin||'hq',plan=routePlan(s,orders,origin,selectedPlane(s));
  const duration=Math.min(14,5+plan.payload/80);
  s.mission={id:`manifest-${s.contractSerial}`,category:'cargo',origin,destination:plan.stops[0],title:orders.length===1?orders[0].title:`${orders.length}-order cargo manifest`,client:'Regional freight network',
    orders:orders.map(o=>({...o,origin,supply:o.supply||'food',status:'onboard',payment:0})),stopOrder:plan.stops,reward:plan.reward,rewardScale:orders[0].rewardScale,payload:plan.payload,rep:orders.reduce((n,o)=>n+o.rep,0),distance:plan.km,
    stage:0,elapsed:0,progress:0,quality:100,targets:[],winch:0,deadline:0,paid:0,handling:{kind:'load',airport:origin,remaining:duration,duration}};
  s.contracts=s.contracts.filter(c=>!unique.includes(c.id));return null;
}
export function reorderStops(s,id,delta) {
  const m=s.mission;if(!m?.orders||m.handling)return;
  const i=m.stopOrder.indexOf(id),next=i+delta;if(i<0||next<0||next>=m.stopOrder.length)return;
  [m.stopOrder[i],m.stopOrder[next]]=[m.stopOrder[next],m.stopOrder[i]];m.destination=m.stopOrder[0];
}
export function missionTarget(s) {
  const m=s.mission;
  if(!m){const home=airportById(s.navigationBase||selectedPlane(s).home||'hq');return {...home,y:home.elevation,label:home.id==='hq'?'Headquarters':home.name,kind:'home'};}
  if(m.handling){const a=airportById(m.handling.airport);return {...a,y:a.elevation,label:`${m.handling.kind==='unload'?'Unloading':'Boarding / loading'} · ${a.name}`,kind:'handling'};}
  if(m.category==='cargo') { const a=airportById(m.orders?m.stopOrder[0]:m.destination); return {...a,y:a.elevation,label:a.name,kind:'landing'}; }
  if(m.category==='medical') { const a=airportById(m.stage===0?m.destination:'city'); return {...a,y:a.elevation,label:m.stage===0?'Patient pickup':'Hospital delivery',kind:'landing'}; }
  if(m.category==='rescue') {
    if(m.stage===0) return {...m.targets[0],label:'Rescue beacon',kind:'rescue'};
    const a=airportById('city'); return {...a,y:a.elevation,label:'Hospital delivery',kind:'landing'};
  }
  if((m.category==='tour'||m.category==='survey') && m.stage<m.targets.length) return {...m.targets[m.stage],label:`${m.category==='tour'?'Scenic':'Mapping'} gate ${m.stage+1}/${m.targets.length}`,kind:'gate'};
  if((m.category==='fire'||m.category==='agriculture') && m.stage===0) {
    const t=m.targets.find(t=>t.progress<1);
    if(t) return {...t,label:m.category==='fire'?'Wildfire zone':'Treatment field',kind:m.category};
  }
  const home=airportById(m.origin||'hq');
  return {...home,y:home.elevation,label:`Return to ${home.id==='hq'?'headquarters':home.name}`,kind:'landing'};
}
function finishMission(s,m) {
  const quality=clamp(m.quality,35,100);
  const bonus=hasFacility(s,'tower')?1.1:1;
  const reward=Math.round(m.reward*(.65+.35*quality/100)*bonus);
  transact(s,reward,`${CATEGORIES[m.category].name} · ${m.title}`);
  s.reputation=clamp(s.reputation+m.rep*(quality<55 ? .5 : 1),0,100);
  s.completed++;
  const reports=[];
  if(m.category==='cargo')reports.push(supplySettlement(s,m.destination,m.supply||'food',m.payload));
  if(m.category==='medical'||m.category==='rescue')reports.push(supplySettlement(s,m.origin==='hq'?m.destination:m.origin,'medicine',120));
  if(m.category==='agriculture')reports.push(supplySettlement(s,m.destination,'food',200));
  s.mission=null;
  return {type:'complete',reward,quality,title:m.title,reports};
}
export function cancelContract(s) {
  if(!s.mission) return;
  s.reputation=Math.max(0,s.reputation-1);
  s.mission=null;
}

export function updateMission(s,f,input,dt) {
  const m=s.mission; if(!m) return null;
  m.elapsed+=dt;
  if(m.handling){
    const h=m.handling;
    if(f.atAirport()?.id!==h.airport)return null;
    h.remaining=Math.max(0,h.remaining-dt);
    if(h.remaining>0)return null;
    delete m.handling;
    if(h.kind==='patient'){m.stage=1;return {type:'stage',text:'Patient aboard. Fly to Meridian City hospital.'};}
    if(h.kind==='load')return {type:'stage',text:'Ground crew finished loading. Your aircraft is ready to depart.'};
    if(m.orders){
      const here=h.airport,drop=m.orders.filter(o=>o.status==='onboard'&&o.destination===here);let payment=0;const reports=[];
      for(const o of drop){
        const reward=Math.round(o.reward*(.65+.35*clamp(m.quality,35,100)/100)*(baseHas(s,m.origin,'tower')?1.1:1));
        transact(s,reward,`Delivery · ${airportById(here).name} · ${o.title}`);payment+=reward;o.status='delivered';o.payment=reward;
        s.reputation=clamp(s.reputation+o.rep,0,100);s.completed++;
        reports.push(supplySettlement(s,here,o.supply,o.payload));
      }
      m.reports=[...(m.reports||[]),...reports.filter(Boolean)].slice(-6);
      m.paid+=payment;m.payload=missionCargoWeight(m);m.stopOrder=m.stopOrder.filter(id=>m.orders.some(o=>o.status==='onboard'&&o.destination===id));
      m.progress=m.orders.filter(o=>o.status==='delivered').length/m.orders.length;
      if(!m.stopOrder.length){s.mission=null;return {type:'complete',reward:m.paid,quality:m.quality,title:m.title,reports:m.reports,manifest:true};}
      m.destination=m.stopOrder[0];return {type:'stage',text:`${airportById(here).name}: unloaded for ${cash(payment)}. ${reports.filter(Boolean).join(' ')} Next: ${airportById(m.destination).name}.`};
    }
    return finishMission(s,m);
  }
  if(m.deadline && m.elapsed>m.deadline) m.quality=Math.max(35,m.quality-dt*.025);
  if(m.category==='tour' && (Math.abs(f.roll)>.6 || f.stalling)) m.quality=Math.max(35,m.quality-dt*1.3);
  const target=missionTarget(s),d=Math.hypot(f.position.x-target.x,f.position.z-target.z);
  const parked=f.grounded && f.speed<3;
  if(target.kind==='landing' && parked && d<airportById(target.id).length*.65+150 && input.interactPressed) {
    const kind=m.category==='medical'&&m.stage===0?'patient':'unload';
    const duration=m.orders?Math.min(14,4+m.orders.filter(o=>o.status==='onboard'&&o.destination===target.id).reduce((n,o)=>n+o.payload,0)/70):6;
    m.handling={kind,airport:target.id,remaining:duration,duration};
    return {type:'stage',text:kind==='patient'?'Medical crew are boarding the patient.':'Ground crew are unloading. Keep the aircraft parked.'};
  }
  if(target.kind==='rescue' && d<target.radius && f.agl>5 && f.agl<50 && f.speed<12 && input.interact) {
    m.winch=Math.min(1,m.winch+dt/8);
    if(m.winch>=1) {m.stage=1;return {type:'stage',text:'Rescue complete. Carry the group to Meridian City hospital.'};}
  }
  if(target.kind==='gate' && d<target.radius && Math.abs(f.position.y-target.y)<target.radius*.75) {
    m.targets[m.stage].progress=1; m.stage++;
    return {type:'stage',text:m.stage===m.targets.length?`All gates complete. Return to ${airportById(m.origin||'hq').name}.`:`Gate ${m.stage}/${m.targets.length} complete.`};
  }
  if((m.category==='fire'||m.category==='agriculture') && m.stage===0) {
    const fire=m.category==='fire',limit=fire?180:70,min=fire?20:8;
    if(input.action && !f.grounded && f.agl>min && f.agl<limit && f.payload>0) {
      const used=Math.min(f.payload,dt*(fire?220:20));
      f.payload-=used;
      for(const t of m.targets) {
        const td=Math.hypot(f.position.x-t.x,f.position.z-t.z);
        if(td<t.radius && t.progress<1) t.progress=Math.min(1,t.progress+used/(fire?700:48));
      }
    }
    m.progress=m.targets.reduce((n,t)=>n+t.progress,0)/m.targets.length;
    if(m.progress>=.999) {m.stage=1;return {type:'stage',text:fire?'All fires extinguished. Return to headquarters.':'Field fully treated. Return to headquarters.'};}
    if(fire && heightAt(f.position.x,f.position.z)<-2 && f.agl<14 && f.agl>2 && f.speed<95 && !input.action) f.payload=Math.min(effectiveSpec(selectedPlane(s)).capacity,f.payload+dt*500);
    if(parked && f.atAirport()?.id===(m.origin||'hq') && input.interactPressed) {
      f.payload=effectiveSpec(selectedPlane(s)).capacity;
      return {type:'stage',text:fire?'Water tank refilled. Continue the fire response.':'Chemical hopper refilled. Continue the treatment.'};
    }
  }
  return null;
}

export function missionInstruction(s) {
  const m=s.mission; if(!m) return 'Choose a contract at headquarters, or explore the region freely.';
  const t=missionTarget(s);
  if(m.handling)return `${m.handling.kind==='unload'?'Unloading':m.handling.kind==='patient'?'Boarding patient':'Loading aircraft'} · ${Math.ceil(m.handling.remaining)} seconds. Keep parked.`;
  if(m.orders)return `Land at ${t.label}, brake below 11 km/h, and press E to unload. ${missionCargoWeight(m)} kg aboard; ${m.stopOrder.length} stops left.`;
  if(t.kind==='landing') return m.category==='medical'&&m.stage===0?'Park at the pickup airfield and press E to board the patient.':'Land, reduce your speed below 11 km/h, and press E.';
  if(t.kind==='gate') return `Fly through the gate at ${Math.round(t.y)} m above sea level.`;
  if(t.kind==='rescue') return `Hover 5–50 m above the beacon; hold E for 8 seconds. ${Math.round(m.winch*100)}% winched.`;
  return CATEGORIES[m.category].action;
}
