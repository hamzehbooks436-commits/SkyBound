import { SAVE_KEY, AIRCRAFT, CATEGORIES, AIRPORTS, planeById, facilityById, LOT_COLS, LOT_ROWS, RUNWAYS, clamp, applyMissionPay } from './data.js';
import { BRANCH_FACILITIES, UPGRADES, baseOwned, baseHas, baseCapacity, branchPrice, branchRep, branchLotPrice, effectiveSpec, upgradeCost, newSettlements, normalizeOperations, advanceSettlements, serviceQuote } from './operations.js';

export function newCompany(name = 'Skybound Airworks') {
  return {
    version:1, company:name.slice(0,36), started:false, money:14000, reputation:0, day:1, clock:8,
    fleet:[{ uid:'starter',type:'courier',fuel:90,condition:100,hours:0,upgrades:[],home:'hq',location:'hq' }], selected:'starter',
    lots:[0,1,6,7], buildings:[{ id:'dispatch',lot:0 },{ id:'hangar',lot:1 }], runway:1,
    mission:null, contracts:[], contractSerial:0, completed:0, totalRevenue:0, totalDistance:0,
    discovered:['hq'], ledger:[{ day:1,label:'Founding capital',amount:14000 }],
    settings:{ sound:.28,quality:'balanced',assist:true,units:'metric' }, history:[],
    branches:{},settlements:newSettlements(),dispatchBase:'hq',
  };
}
export function loadCompany() {
  try {
    const raw=JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!raw || raw.version!==1 || !Array.isArray(raw.fleet) || !raw.fleet.length) return newCompany();
    const defaults=newCompany();
    const s={...defaults,...raw,settings:{...defaults.settings,...raw.settings}};
    normalizeOperations(s);
    s.fleet=s.fleet.filter(p=>p&&AIRCRAFT.some(a=>a.id===p.type)).map((p,i)=>({
      uid:typeof p.uid==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(p.uid)?p.uid:`aircraft-${i}`,type:p.type,
      upgrades:[...new Set((Array.isArray(p.upgrades)?p.upgrades:[]).filter(id=>UPGRADES.some(u=>u.id===id)&&(id!=='cargo'||planeById(p.type).category==='cargo')))],
      home:baseOwned(s,p.home)?p.home:'hq',location:p.location===null?null:AIRPORTS.some(a=>a.id===p.location)?p.location:'hq',
      fuel:clamp(Number.isFinite(p.fuel)?p.fuel:planeById(p.type).fuel,0,effectiveSpec({...p,upgrades:Array.isArray(p.upgrades)?p.upgrades:[]}).fuel),
      condition:clamp(Number.isFinite(p.condition)?p.condition:100,0,100),hours:Math.max(0,Number(p.hours)||0),
    }));
    if(!s.fleet.length) s.fleet=defaults.fleet;
    if(!s.fleet.some(p=>p.uid===s.selected)) s.selected=s.fleet[0].uid;
    s.company=String(s.company||defaults.company).slice(0,36);
    s.money=Number.isFinite(s.money)?Math.max(0,s.money):14000;
    s.reputation=clamp(Number(s.reputation)||0,0,100);
    s.runway=clamp(Math.floor(Number(s.runway)||1),1,3);
    s.day=Math.max(1,Math.floor(Number(s.day)||1));
    s.clock=Number.isFinite(s.clock)?clamp(s.clock,0,23.999):8;
    for(const key of ['completed','totalRevenue','totalDistance','contractSerial'])s[key]=Math.max(0,Number(s[key])||0);
    s.lots=Array.isArray(s.lots)?[...new Set(s.lots.filter(n=>Number.isInteger(n)&&n>=0&&n<24))]:defaults.lots;
    if(!s.lots.length)s.lots=defaults.lots;
    const occupied=new Set();
    s.buildings=Array.isArray(s.buildings)?s.buildings.filter(b=>{
      if(!b||(!facilityById(b.id)&&b.id!=='dispatch')||!s.lots.includes(b.lot)||occupied.has(b.lot))return false;
      occupied.add(b.lot);return true;
    }):defaults.buildings;
    if(!s.buildings.length){s.lots=defaults.lots;s.buildings=defaults.buildings;}
    s.ledger=Array.isArray(s.ledger)?s.ledger.filter(l=>l&&Number.isFinite(l.amount)).slice(0,80).map(l=>({day:Math.max(1,Number(l.day)||1),label:String(l.label).slice(0,160),amount:l.amount})):defaults.ledger;
    s.history=Array.isArray(s.history)?s.history.slice(-40):[];
    s.discovered=Array.isArray(s.discovered)?[...new Set(s.discovered.filter(id=>AIRPORTS.some(a=>a.id===id)))]:['hq'];
    if(!s.discovered.includes('hq'))s.discovered.unshift('hq');
    s.settings.sound=clamp(Number(s.settings.sound)||0,0,1);
    s.settings.quality=['low','balanced','high'].includes(s.settings.quality)?s.settings.quality:'balanced';
    s.settings.assist=s.settings.assist!==false;
    s.dispatchBase=baseOwned(s,s.dispatchBase)?s.dispatchBase:'hq';
    const validContract=c=>c&&typeof c.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(c.id)&&CATEGORIES[c.category]&&AIRPORTS.some(a=>a.id===c.destination)&&(!c.origin||AIRPORTS.some(a=>a.id===c.origin))&&Number.isFinite(c.reward)&&c.reward>0&&Number.isFinite(c.payload)&&c.payload>=0&&Number.isFinite(c.distance);
    s.contracts=Array.isArray(s.contracts)?s.contracts.filter(validContract).map(c=>applyMissionPay({...c,origin:c.origin||'hq',supply:['food','medicine','materials'].includes(c.supply)?c.supply:undefined})):[];
    if(!validContract(s.mission)||!Array.isArray(s.mission.targets)||s.mission.targets.some(t=>![t.x,t.y,t.z,t.progress,t.radius].every(Number.isFinite)))s.mission=null;
    if(s.mission){
      applyMissionPay(s.mission);
      s.mission.stage=clamp(Math.floor(Number(s.mission.stage)||0),0,Math.max(1,s.mission.targets.length));
      s.mission.quality=clamp(Number(s.mission.quality)||100,35,100);
      s.mission.elapsed=Math.max(0,Number(s.mission.elapsed)||0);
      s.mission.progress=clamp(Number(s.mission.progress)||0,0,1);
      s.mission.winch=clamp(Number(s.mission.winch)||0,0,1);
      s.mission.deadline=Math.max(0,Number(s.mission.deadline)||0);
      s.mission.reports=Array.isArray(s.mission.reports)?s.mission.reports.filter(v=>typeof v==='string').map(v=>v.slice(0,250)).slice(-6):[];
      for(const target of s.mission.targets)target.progress=clamp(target.progress,0,1);
      s.mission.origin=s.mission.origin||'hq';
      if(s.mission.orders){
        if(s.mission.category!=='cargo'||!Array.isArray(s.mission.orders)||!s.mission.orders.length||s.mission.orders.length>6||s.mission.orders.some(o=>!validContract(o)||o.category!=='cargo'||!['onboard','delivered'].includes(o.status))){s.mission=null;}
        else {
          s.mission.orders=s.mission.orders.map(o=>applyMissionPay({...o,origin:o.origin||s.mission.origin,supply:['food','medicine','materials'].includes(o.supply)?o.supply:'food'}));
          const remaining=s.mission.orders.filter(o=>o.status==='onboard').map(o=>o.destination);
          s.mission.stopOrder=[...new Set([...(Array.isArray(s.mission.stopOrder)?s.mission.stopOrder:[]).filter(id=>remaining.includes(id)),...remaining])];
          s.mission.destination=s.mission.stopOrder[0]||s.mission.destination;
          s.mission.paid=s.mission.orders.filter(o=>o.status==='delivered').reduce((n,o)=>n+(Number(o.payment)||0),0);
        }
      }
      if(s.mission?.handling){
        const h=s.mission.handling;
        if(!AIRPORTS.some(a=>a.id===h.airport)||!['load','unload','patient'].includes(h.kind)||!Number.isFinite(h.remaining)||!Number.isFinite(h.duration))delete s.mission.handling;
        else {h.duration=clamp(h.duration,1,20);h.remaining=clamp(h.remaining,0,h.duration);}
      }
    }
    return s;
  } catch { return newCompany(); }
}
export function saveCompany(s) {
  try { localStorage.setItem(SAVE_KEY,JSON.stringify(s)); return true; } catch { return false; }
}
export function transact(s,amount,label) {
  if(amount<0 && s.money+amount<0) return false;
  s.money=Math.round((s.money+amount)*100)/100;
  s.ledger.unshift({ day:s.day,label,amount:Math.round(amount) });
  s.ledger=s.ledger.slice(0,80);
  if(amount>0 && !label.startsWith('Aircraft sale') && label!=='Founding capital') s.totalRevenue+=amount;
  return true;
}
export const selectedPlane = s => s.fleet.find(p=>p.uid===s.selected) || s.fleet[0];
export const hasFacility = (s,id,base='hq') => !id || baseHas(s,base,id);
export const facilityCount = (s,id) => s.buildings.filter(b=>b.id===id).length;
export const fleetCapacity = (s,base=null) => base?baseCapacity(s,base):['hq',...Object.keys(s.branches)].reduce((n,id)=>n+baseCapacity(s,id),0);
export function aircraftLock(s,a,base='hq') {
  if(s.reputation<a.rep) return `Requires ${a.rep} reputation`;
  if(!baseOwned(s,base))return 'Purchase a branch at this airport first';
  if(!hasFacility(s,a.facility,base)) return `Build ${facilityById(a.facility)?.name || a.facility} at this base`;
  const required=[0,600,1250,1850][a.runway],length=base==='hq'?RUNWAYS[s.runway-1].length:AIRPORTS.find(v=>v.id===base)?.length;
  if(length<required) return `Requires a ${required} m runway`;
  if(s.fleet.filter(p=>(p.home||'hq')===base).length>=fleetCapacity(s,base)) return 'Build another aircraft parking space at this base';
  if(s.money<a.price) return 'Insufficient company funds';
  return null;
}
export function buyAircraft(s,id,base='hq') {
  const a=planeById(id); const lock=aircraftLock(s,a,base);
  if(lock) return lock;
  if(!transact(s,-a.price,`Purchase · ${a.name}`)) return 'Insufficient funds';
  s.fleet.push({ uid:`${id}-${Date.now()}`,type:id,fuel:a.fuel,condition:100,hours:0,upgrades:[],home:base,location:base });
  return null;
}
export function buildFacility(s,id,lot) {
  const f=facilityById(id);
  if(!f || !s.lots.includes(lot) || s.buildings.some(b=>b.lot===lot)) return 'Choose an empty owned lot';
  if(s.reputation<f.rep) return `Requires ${f.rep} reputation`;
  if(facilityCount(s,id)>=f.max) return 'Maximum number already built';
  if(!transact(s,-f.cost,`Construction · ${f.name}`)) return 'Insufficient company funds';
  s.buildings.push({ id,lot });
  return null;
}
export function lotPrice(s) { return 2800+s.lots.length*450; }
export function lotAdjacent(s,lot) {
  const x=lot%LOT_COLS,y=Math.floor(lot/LOT_COLS);
  return s.lots.some(n=>Math.abs(n%LOT_COLS-x)+Math.abs(Math.floor(n/LOT_COLS)-y)===1);
}
export function buyLot(s,lot) {
  if(lot<0 || lot>=LOT_COLS*LOT_ROWS || s.lots.includes(lot)) return 'Choose unowned land';
  if(!lotAdjacent(s,lot)) return 'Expand into an adjoining lot';
  if(!transact(s,-lotPrice(s),'Headquarters land expansion')) return 'Insufficient company funds';
  s.lots.push(lot); return null;
}
export function upgradeRunway(s) {
  const next=RUNWAYS[s.runway];
  if(!next) return 'Your runway is fully upgraded';
  if(s.reputation<next.rep) return `Requires ${next.rep} reputation`;
  if(!transact(s,-next.cost,`Runway · ${next.name}`)) return 'Insufficient company funds';
  s.runway=next.level; return null;
}
export function serviceAircraft(s,uid,what,base='hq') {
  const p=s.fleet.find(p=>p.uid===uid); if(!p) return 'Aircraft unavailable';
  const a=effectiveSpec(p);
  const cost=serviceQuote(s,p,what,base);
  if(cost===0) return 'Already fully serviced';
  if(!transact(s,-cost,`${what==='fuel'?'Fuel':'Repair'} · ${a.name}`)) return 'Insufficient company funds';
  if(what==='fuel') p.fuel=a.fuel; else p.condition=100;
  return null;
}
export function buyBranch(s,id) {
  const a=AIRPORTS.find(a=>a.id===id);
  if(!a||id==='hq'||baseOwned(s,id))return 'Choose an unowned regional airport';
  if(!s.discovered.includes(id))return 'Fly to discover this airport before opening a branch';
  if(s.reputation<branchRep(a))return `Requires ${branchRep(a)} reputation`;
  if(!transact(s,-branchPrice(a),`Branch purchase · ${a.name}`))return 'Insufficient company funds';
  s.branches[id]={lots:[0,1],buildings:[{id:'dispatch',lot:0},{id:'apron',lot:1}],founded:s.day};
  return null;
}
export function buyBranchLot(s,id,lot) {
  const b=s.branches[id];if(!b||!Number.isInteger(lot)||lot<0||lot>=6||b.lots.includes(lot))return 'Choose unowned branch land';
  if(!b.lots.some(n=>Math.abs(n%3-lot%3)+Math.abs(Math.floor(n/3)-Math.floor(lot/3))===1))return 'Buy land adjoining your branch';
  if(!transact(s,-branchLotPrice(b),`Branch land · ${airportByName(id)}`))return 'Insufficient company funds';
  b.lots.push(lot);return null;
}
const airportByName = id => AIRPORTS.find(a=>a.id===id)?.name||id;
export function buildBranchFacility(s,id,facility,lot) {
  const b=s.branches[id],f=BRANCH_FACILITIES.find(f=>f.id===facility);
  if(!b||!f||!b.lots.includes(lot)||b.buildings.some(v=>v.lot===lot))return 'Choose an empty owned branch parcel';
  if(!['apron','hangar'].includes(f.id)&&b.buildings.some(v=>v.id===f.id))return 'This branch already has that facility';
  if(!transact(s,-f.cost,`${f.name} · ${airportByName(id)}`))return 'Insufficient company funds';
  b.buildings.push({id:facility,lot});return null;
}
export function installUpgrade(s,uid,id) {
  const p=s.fleet.find(p=>p.uid===uid),u=UPGRADES.find(u=>u.id===id);
  if(!p||!u)return 'Choose an aircraft and upgrade';
  if((p.upgrades||[]).includes(id))return 'This upgrade is already installed';
  if(id==='cargo'&&planeById(p.type).category!=='cargo')return 'Freight conversions require a cargo aircraft';
  if(s.mission&&uid===s.selected)return 'Finish your current mission before modifying the aircraft';
  if(!transact(s,-upgradeCost(p,u),`Upgrade · ${planeById(p.type).name} · ${u.name}`))return 'Insufficient company funds';
  p.upgrades=[...(p.upgrades||[]),id];return null;
}
export function rebaseAircraft(s,uid,base) {
  const p=s.fleet.find(p=>p.uid===uid);
  if(!p||!baseOwned(s,base)||p.location!==base)return 'Fly this aircraft to the new company base and park first';
  if(p.home===base)return 'This aircraft is already based here';
  if(s.mission&&s.selected===uid)return 'Finish the current mission before changing bases';
  const required=[0,600,1250,1850][planeById(p.type).runway],length=base==='hq'?RUNWAYS[s.runway-1].length:AIRPORTS.find(a=>a.id===base)?.length;
  if(!planeById(p.type).helicopter&&length<required)return `This aircraft needs a ${required} m runway at its home base`;
  if(s.fleet.filter(v=>v.home===base).length>=baseCapacity(s,base))return 'Build more aircraft parking at the destination base';
  if(!transact(s,-750,`Aircraft relocation · ${airportByName(base)}`))return 'Insufficient company funds';
  p.home=base;return null;
}
export const dailyOverhead = s => Math.round((120+s.fleet.length*65+s.buildings.length*18)*(hasFacility(s,'solar')?.65:1)+Object.values(s.branches).reduce((n,b)=>n+160+b.buildings.length*25,0));
export function advanceTime(s,seconds) {
  s.clock+=seconds/180;
  while(s.clock>=24) {
    s.clock-=24; s.day++;
    const overhead=dailyOverhead(s);
    const paid=Math.min(s.money,overhead);
    transact(s,-paid,'Daily company overhead');
    advanceSettlements(s);
    s.history.push({ day:s.day,money:s.money,reputation:s.reputation });
    s.history=s.history.slice(-40);
  }
}
