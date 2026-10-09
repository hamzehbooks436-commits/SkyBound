import { AIRPORTS, planeById, airportById, clamp, distance } from './data.js';

export const SUPPLIES = {
  food: { name:'Food & essentials', unit:'provisions', color:'#9dab67' },
  medicine: { name:'Clinic supplies', unit:'medical supplies', color:'#ca5346' },
  materials: { name:'Building materials', unit:'construction supplies', color:'#c3956e' },
};
export const BRANCH_FACILITIES = [
  { id:'apron',name:'Aircraft stand',model:'apron_stand',cost:4800,capacity:1,description:'One space for a locally based aircraft.',icon:'plane' },
  { id:'hangar',name:'Outpost hangar',model:'branch_hangar',cost:13500,capacity:2,description:'Two aircraft spaces and 20% less airframe wear from this base.',icon:'hangar' },
  { id:'fuel',name:'Fuel storage',model:'branch_depot',cost:9200,capacity:0,description:'Local fuel at 25% less than HQ prices, with no remote surcharge.',icon:'fuel' },
  { id:'maintenance',name:'Service workshop',model:'maintenance_shop',cost:14500,capacity:0,description:'Local repairs at 40% less than HQ prices.',icon:'tool' },
  { id:'warehouse',name:'Freight store',model:'branch_warehouse',cost:11500,capacity:0,description:'Unlock larger locally generated cargo orders.',icon:'package' },
  { id:'terminal',name:'Island & mountain terminal',model:'branch_terminal',cost:16500,capacity:0,description:'Unlock sightseeing departures and visible passenger boarding here.',icon:'sun' },
];
export const UPGRADES = [
  { id:'tanks',name:'Long-range tanks',cost:.24,description:'+35% fuel capacity; −8% cargo capacity and −3% cruise speed.',icon:'fuel' },
  { id:'engine',name:'Performance engine',cost:.32,description:'+14% cruise, +18% climb, +16% acceleration; +18% fuel burn and +12% wear.',icon:'plane' },
  { id:'cargo',name:'Freight conversion',cost:.22,description:'+25% cargo capacity; −8% cruise, −6% climb and +8% fuel burn. Cargo aircraft only.',icon:'package' },
  { id:'gear',name:'Rugged landing gear',cost:.16,description:'60% less rough-ground damage, gentler hard-landing limits; −4% cruise and −3% payload.',icon:'tool' },
];
export const baseOwned = (s,id) => id==='hq'||!!s.branches?.[id];
export const baseFacilities = (s,id='hq') => id==='hq'?s.buildings:(s.branches?.[id]?.buildings||[]);
export const baseHas = (s,id,facility) => baseFacilities(s,id).some(b=>b.id===facility);
export const baseName = id => airportById(id).name;
export const baseCapacity = (s,id) => baseFacilities(s,id).reduce((n,b)=>n+(id==='hq'?({apron:1,hangar:2,largehangar:4,helipad:1}[b.id]||0):(BRANCH_FACILITIES.find(f=>f.id===b.id)?.capacity||0)),0);
export const branchPrice = a => Math.round((a.type==='city'?74000:a.type==='port'||a.type==='resort'?48000:24000)+(a.biome==='tropical'?6000:a.elevation>500?4000:0));
export const branchRep = a => a.type==='city'?30:a.type==='port'||a.type==='resort'?20:8;
export const branchLotPrice = b => 3600+b.lots.length*850;
export function branchPosition(a,lot) {
  const x=115+(lot%3)*44,z=-50+Math.floor(lot/3)*48,c=Math.cos(a.heading),sn=Math.sin(a.heading);
  return { x:a.x+x*c+z*sn,z:a.z-x*sn+z*c };
}
export function effectiveSpec(p) {
  const original=planeById(p.type),a={...original},u=p.upgrades||[];
  if(u.includes('tanks')){a.fuel*=1.35;a.capacity*=.92;a.cruise*=.97;}
  if(u.includes('engine')){a.cruise*=1.14;a.climb*=1.18;a.acceleration*=1.16;a.burn*=1.18;}
  if(u.includes('cargo')&&a.category==='cargo'){a.capacity*=1.25;a.cruise*=.92;a.climb*=.94;a.burn*=1.08;}
  if(u.includes('gear')){a.cruise*=.96;a.capacity*=.97;}
  a.fuel=Math.round(a.fuel);a.capacity=Math.round(a.capacity);
  a.wear=u.includes('engine')?1.12:1;a.roughDamage=u.includes('gear')?.4:1;a.landingLimit=u.includes('gear')?9:7;
  return a;
}
export const upgradeCost = (p,u) => Math.round(planeById(p.type).price*u.cost/100)*100;
export function newSettlements() {
  return Object.fromEntries(AIRPORTS.filter(a=>a.id!=='hq').map((a,i)=>[a.id,{
    population:a.population,food:46+(i*7)%24,medicine:40+(i*11)%26,materials:28+(i*13)%35,
    development:0,delivered:0,lastDelivery:0,growth:0,
  }]));
}
export function normalizeOperations(s) {
  const initial=newSettlements(),raw=s.settlements||{};
  s.settlements=Object.fromEntries(Object.entries(initial).map(([id,defaults])=>{
    const v=raw[id]||{},a=airportById(id),out={...defaults};
    for(const key of ['food','medicine','materials'])out[key]=clamp(Number.isFinite(v[key])?v[key]:defaults[key],0,100);
    out.population=clamp(Math.floor(Number(v.population)||a.population),Math.floor(a.population*.8),Math.floor(a.population*2));
    out.development=clamp(Number(v.development)||0,0,300);out.delivered=clamp(Number(v.delivered)||0,0,1e9);
    out.lastDelivery=Math.max(0,Number(v.lastDelivery)||0);out.growth=Number(v.growth)||0;
    return [id,out];
  }));
  const branches={};
  for(const a of AIRPORTS.filter(a=>a.id!=='hq')){
    const b=s.branches?.[a.id];if(!b||!Array.isArray(b.lots))continue;
    const lots=[...new Set([0,1,...b.lots.filter(n=>Number.isInteger(n)&&n>=0&&n<6)])],occupied=new Set([0]);
    const buildings=[{id:'dispatch',lot:0}];
    for(const item of Array.isArray(b.buildings)?b.buildings:[]){
      if(!BRANCH_FACILITIES.some(f=>f.id===item?.id)||!lots.includes(item.lot)||occupied.has(item.lot))continue;
      if(!['hangar','apron'].includes(item.id)&&buildings.some(v=>v.id===item.id))continue;
      buildings.push({id:item.id,lot:item.lot});occupied.add(item.lot);
    }
    if(buildings.length===1)buildings.push({id:'apron',lot:1});
    branches[a.id]={lots,buildings,founded:Math.max(1,Number(b.founded)||s.day)};
  }
  s.branches=branches;
}
export const townLevel = t => Math.min(3,Math.floor((t?.development||0)/100));
export const townStatus = t => !t?'Headquarters':t.food<25?'Food shortage':t.medicine<25?'Clinic shortage':t.food>=45&&t.medicine>=40&&t.materials>=30?'Ready to grow':'Stable · needs supplies';
export function supplySettlement(s,id,supply,weight) {
  const t=s.settlements[id];if(!t||!SUPPLIES[supply])return '';
  const before=townLevel(t),gain=clamp(weight/(supply==='medicine'?10:18),4,40);
  t[supply]=clamp(t[supply]+gain,0,100);t.delivered+=weight;t.lastDelivery=s.day;
  t.development=clamp(t.development+Math.min(20,weight/35)*(supply==='materials'?1.6:1),0,300);
  return townLevel(t)>before?`${baseName(id)} reached development level ${townLevel(t)}. Larger orders are now available.`:`${baseName(id)} received ${weight} kg of ${SUPPLIES[supply].unit}.`;
}
export function advanceSettlements(s) {
  for(const [id,t] of Object.entries(s.settlements)){
    const a=airportById(id),remote=a.biome==='tropical'||a.elevation>500||a.type==='research';
    const need=remote?1.2:1;
    t.food=Math.max(0,t.food-5*need);t.medicine=Math.max(0,t.medicine-3*need);t.materials=Math.max(0,t.materials-2);
    const growing=t.food>=45&&t.medicine>=40&&t.materials>=30,shortage=t.food<15||t.medicine<15;
    t.growth=growing?Math.max(1,Math.round(t.population*.002*(1+townLevel(t)*.2))):shortage?-Math.max(1,Math.round(t.population*.0008)):0;
    const prior=t.population;t.population=clamp(t.population+t.growth,Math.floor(a.population*.8),Math.floor(a.population*2));t.growth=t.population-prior;
    if(growing)t.materials=Math.max(0,t.materials-3);
  }
}
export function missionCargoWeight(m) {
  return m?.category==='cargo'?(m.orders?m.orders.filter(o=>o.status==='onboard').reduce((n,o)=>n+o.payload,0):m.payload):0;
}
export const availablePayload = (a,fuel) => Math.max(0,Math.floor(a.capacity-Math.max(0,fuel-a.fuel*.5)*.4));
export function routePlan(s,orders,origin,p,startPosition=null,stopOrder=null) {
  const a=effectiveSpec(p),destinations=[...new Set(orders.map(o=>o.destination))],stops=stopOrder?stopOrder.filter(id=>destinations.includes(id)):destinations;
  let here=startPosition||airportById(origin),km=0;
  for(const id of stops){const next=airportById(id);km+=distance(here,next)/1000;here=next;}
  const returnBase=baseOwned(s,origin)?origin:(p.home||'hq');
  const returnKm=distance(here,airportById(returnBase))/1000,payload=orders.reduce((n,o)=>n+o.payload,0);
  // Includes climb/taxi time and a 20% reserve; a planning estimate, not an autopilot guarantee.
  const fuel=Math.ceil(((km+returnKm)*1000/a.cruise+stops.length*55)*a.burn*1.12*1.2);
  return {stops,km,returnKm,returnBase,payload,fuel,reward:orders.reduce((n,o)=>n+o.reward,0),capacity:availablePayload(a,p.fuel)};
}
export function serviceRate(s,base,what) {
  const discount=baseHas(s,base,what==='fuel'?'fuel':'maintenance');
  const multiplier=base==='hq'||baseOwned(s,base)&&discount?1:1.3;
  return (what==='fuel'?7.5*(discount ? .75 : 1):27*(discount ? .6 : 1))*multiplier;
}
export function serviceQuote(s,p,what,base='hq') {
  const a=effectiveSpec(p);
  return Math.ceil((what==='fuel'?a.fuel-p.fuel:100-p.condition)*serviceRate(s,base,what));
}
