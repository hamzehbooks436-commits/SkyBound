import './styles.css';
import './touch-controls.css';
import { AIRCRAFT, SAVE_KEY, planeById, facilityById, cash, airportById, clamp } from './data.js';
import { loadCompany, newCompany, saveCompany, buyAircraft, buildFacility, buyLot, upgradeRunway, serviceAircraft, transact, advanceTime, buyBranch, buyBranchLot, buildBranchFacility, installUpgrade, rebaseAircraft, selectedPlane } from './state.js';
import { refreshContracts, acceptContract, acceptManifest, reorderStops, cancelContract, updateMission } from './missions.js';
import { baseOwned, baseHas, effectiveSpec, serviceRate } from './operations.js';
import { Flight, Controls } from './flight.js';
import { World } from './world.js';
import { UI } from './ui.js';
import { EngineAudio } from './audio.js';
import { bindTouchControls } from './touch-controls.js';

const state=loadCompany();
if(!state.mission&&(!state.contracts.length||!state.contracts.some(c=>c.category==='cargo'&&c.supply)))refreshContracts(state);
const flight=new Flight(state),controls=new Controls(),audio=new EngineAudio();
let world,ready=false,lastFrame=performance.now(),hudTime=0,saveTime=0,time=0;
const ui=new UI(document.querySelector('#app'),state,flight,action);
audio.volume=state.settings.sound;

function persist(notify=false){
  state.flight=flight.snapshot();
  const saved=saveCompany(state);
  if(notify)ui.toast(saved?'Company and flight position saved.':'This browser could not save. Export a save file to keep your progress.',saved?'success':'error');
  return saved;
}
function done(error,message,updateWorld=false){
  if(error){ui.toast(error,'error');return false;}
  if(updateWorld){world.rebuildHQ();world.rebuildBranches();}
  persist();ui.renderPanel();ui.updateHUD();
  if(message)ui.toast(message,'success');
  return true;
}
function requireHQ(){if(!flight.atHQ()){ui.toast('Return to headquarters and park before changing your company.','error');return false;}return true;}
function requireBase(){const a=flight.atAirport();if(!a||!baseOwned(state,a.id)){ui.toast('Park at headquarters or an owned branch first.','error');return null;}return a;}
function clearGround(){if(flight.groundJob||state.mission?.handling){ui.toast('Wait for ground crew to finish first.','error');return false;}return true;}
function dispatchLoaded(message){
  state.navigationBase=baseOwned(state,state.mission.origin)?state.mission.origin:(selectedPlane(state).home||'hq');
  flight.resetPayload();world.rebuildMission();ui.manifestIds=[];ui.close();controls.clear();persist();ui.updateHUD();
  ui.toast(message,'success');
}

function action(name,id,data={}){
  if(!ready)return;
  audio.start();
  if(name==='panel'){
    controls.clear();
    if(!state.started){ui.open('welcome');return;}
    if(id==='contracts'&&!state.mission){
      const origin=flight.atAirport()?.id||state.dispatchBase||'hq';
      if(origin!==ui.dispatchOrigin){ui.manifestIds=[];ui.contractId=null;}
      ui.dispatchOrigin=origin;
      if(!state.contracts.some(c=>(c.origin||'hq')===origin))refreshContracts(state);
    }
    ui.open(id);return;
  }
  if(name==='close'){ui.close();controls.clear();return;}
  if(name==='start'){
    state.company=document.querySelector('#company-name')?.value.trim().slice(0,36)||'Skybound Airworks';
    state.started=true;persist();ui.close();ui.open('contracts');
    ui.toast('Welcome to your airworks. Willow Creek is a good first delivery.');return;
  }
  if(name==='filter'){ui.filter=id;ui.contractId=null;ui.renderPanel();return;}
  if(name==='contract'){ui.contractId=id;ui.renderPanel();return;}
  if(name==='refresh'){if(state.mission)return;refreshContracts(state);persist();ui.renderPanel();return;}
  if(name==='accept'){
    const c=state.contracts.find(c=>c.id===id);if(!c)return;
    if(flight.atAirport()?.id!==(c.origin||'hq')){ui.toast(`Park at ${airportById(c.origin||'hq').name} to collect this contract.`,'error');return;}
    if(!clearGround())return;
    const error=acceptContract(state,c);
    if(error){ui.toast(error,'error');return;}
    dispatchLoaded(`${c.title} accepted. Ground crew are preparing your aircraft.`);return;
  }
  if(name==='dispatch-base'){ui.dispatchOrigin=id;state.dispatchBase=id;ui.manifestIds=[];ui.contractId=null;ui.renderPanel();return;}
  if(name==='manifest-toggle'){
    const ids=ui.manifestIds,index=ids.indexOf(id);
    if(index>=0)ids.splice(index,1);
    else {if(ids.length>=6){ui.toast('A manifest holds up to six orders.');return;}const c=state.contracts.find(c=>c.id===id&&c.category==='cargo'&&(c.origin||'hq')===ui.dispatchOrigin);if(!c)return;ids.push(id);}
    ui.renderPanel();return;
  }
  if(name==='manifest-move'){
    const ids=ui.manifestIds,i=ids.indexOf(id),next=i+Number(data.dir);if(i<0||next<0||next>=ids.length)return;
    [ids[i],ids[next]]=[ids[next],ids[i]];ui.renderPanel();return;
  }
  if(name==='stop-move'){reorderStops(state,id,Number(data.dir));done(null);return;}
  if(name==='accept-manifest'){
    if(flight.atAirport()?.id!==ui.dispatchOrigin||!clearGround())return;
    const error=acceptManifest(state,ui.manifestIds);if(error){ui.toast(error,'error');return;}
    dispatchLoaded('Manifest accepted. Ground crew are loading the aircraft; keep parked until they finish.');return;
  }
  if(name==='set-fuel'){
    const here=flight.atAirport();if(!here||state.mission||!clearGround())return;
    const p=selectedPlane(state),a=effectiveSpec(p),target=clamp(Number(document.querySelector('#dispatch-fuel-target')?.value)||0,Math.ceil(a.fuel*.1),a.fuel),difference=target-p.fuel;
    if(Math.abs(difference)<.5){ui.toast('Fuel is already at this target.');return;}
    const cost=Math.ceil(Math.max(0,difference)*serviceRate(state,here.id,'fuel'));
    if(cost&&!transact(state,-cost,`Fuel load · ${a.name}`)){ui.toast('Insufficient company funds.','error');return;}
    p.fuel=target;flight.groundJob={kind:'fuel',airport:here.id,remaining:8,duration:8};done(null,`Fuel load set to ${target} L${difference<0?' · offloaded fuel earns no refund':''}. Ground crew are servicing the aircraft.`);return;
  }
  if(name==='cancel'){cancelContract(state);world.rebuildMission();done(null,'Contract cancelled. Reputation reduced by one.');return;}
  if(name==='fleet-tab'){ui.fleetTab=id;ui.renderPanel();return;}
  if(name==='buy-plane'){
    const here=requireBase();if(!here||state.mission||!clearGround())return;
    done(buyAircraft(state,id,here.id),`${planeById(id).name} has joined your fleet at ${here.name}.`,true);return;
  }
  if(name==='select-plane'){
    const here=requireBase();if(!here||state.mission||!clearGround())return;
    if(!state.fleet.some(p=>p.uid===id&&p.location===here.id))return;
    state.selected=id;flight.spawn(here);world.changeAircraft();done(null,`${flight.spec.name} is now your dispatch aircraft.`,true);return;
  }
  if(name==='sell-plane'){
    const here=requireBase();if(!here||state.mission||!clearGround()||state.fleet.length<=1||id===state.selected)return;
    const p=state.fleet.find(p=>p.uid===id&&p.location===here.id);if(!p)return;
    const a=planeById(p.type),price=Math.round(a.price*.55*p.condition/100);
    transact(state,price,`Aircraft sale · ${a.name}`);state.fleet=state.fleet.filter(p=>p.uid!==id);done(null,`${a.name} sold for ${cash(price)}.`,true);return;
  }
  if(name==='service-fleet'){
    const here=requireBase();if(!here||!clearGround()||!state.fleet.some(p=>p.uid===id&&p.location===here.id))return;
    const error=serviceAircraft(state,id,data.service,here.id);
    if(!error&&id===state.selected)flight.groundJob={kind:data.service,airport:here.id,remaining:8,duration:8};
    done(error,'Ground service purchased.');return;
  }
  if(name==='service-active'){
    const airport=flight.atAirport();if(!airport||!clearGround())return;
    const error=serviceAircraft(state,state.selected,id,airport.id);
    if(!error)flight.groundJob={kind:id,airport:airport.id,remaining:8,duration:8};
    done(error,'Ground crew are servicing your aircraft.');return;
  }
  if(name==='workshop'){ui.upgradeAircraft=id;ui.fleetTab='upgrades';ui.renderPanel();return;}
  if(name==='rebase-aircraft'){
    const here=requireBase();if(!here||!clearGround())return;
    const error=rebaseAircraft(state,id,here.id);
    if(!error&&id===state.selected)state.navigationBase=here.id;
    done(error,`Aircraft now based at ${here.name}.`,true);return;
  }
  if(name==='upgrade-selection'){ui.upgradeAircraft=id;ui.renderPanel();return;}
  if(name==='upgrade-aircraft'){
    const here=requireBase(),p=state.fleet.find(p=>p.uid===id);if(!here||!p||p.location!==here.id||!clearGround())return;
    if(!baseHas(state,here.id,'hangar')&&!baseHas(state,here.id,'largehangar')&&!baseHas(state,here.id,'maintenance')){ui.toast('Build a hangar or maintenance workshop here first.','error');return;}
    done(installUpgrade(state,id,data.upgrade),'Aircraft upgrade installed. Performance and operating costs updated.');return;
  }
  if(name==='network-tab'){ui.networkTab=id;ui.renderPanel();return;}
  if(name==='network-airport'){ui.networkAirport=id;ui.networkTab='bases';ui.renderPanel();return;}
  if(name==='view-airport'){ui.selectedAirport=id;ui.open('atlas');return;}
  if(name==='manage-branch'){ui.networkAirport=id;ui.networkTab='bases';ui.open('network');return;}
  if(name==='branch-facility'){ui.branchFacility=id;ui.renderPanel();return;}
  if(name==='buy-branch'||name==='branch-lot'){
    const airportId=name==='buy-branch'?id:ui.networkAirport,here=flight.atAirport();
    if(!here||(here.id!=='hq'&&here.id!==airportId)){ui.toast('Park at headquarters or the chosen branch to manage construction.','error');return;}
    if(name==='buy-branch'){
      const error=buyBranch(state,airportId);if(!error)refreshContracts(state);
      done(error,`Branch established at ${airportById(airportId).name}.`,true);return;
    }
    const b=state.branches[airportId],lot=Number(id);if(!b)return;
    const error=b.lots.includes(lot)?buildBranchFacility(state,airportId,ui.branchFacility,lot):buyBranchLot(state,airportId,lot);
    if(!error)refreshContracts(state);done(error,'Branch site updated.',true);return;
  }
  if(name==='facility'){ui.selectedFacility=id;ui.buildMode='build';ui.renderPanel();return;}
  if(name==='build-mode'){ui.buildMode=id;ui.renderPanel();return;}
  if(name==='lot'){
    if(!requireHQ())return;
    const index=Number(id),building=state.buildings.find(b=>b.lot===index);
    if(building){ui.toast(`${building.id==='dispatch'?'Dispatch office':facilityById(building.id)?.name} occupies this parcel.`);return;}
    if(!state.lots.includes(index)){
      if(ui.buildMode!=='land'){ui.buildMode='land';ui.renderPanel();ui.toast('Land expansion selected. Click the parcel again to purchase it.');return;}
      done(buyLot(state,index),'New land acquired. Choose a facility to build on it.',true);return;
    }
    if(ui.buildMode==='land'){ui.toast('You already own this parcel. Choose Facilities to build here.');return;}
    done(buildFacility(state,ui.selectedFacility,index),`${facilityById(ui.selectedFacility).name} constructed.`,true);return;
  }
  if(name==='runway'){
    if(!requireHQ())return;
    done(upgradeRunway(state),'Runway expanded. Your airworks can welcome larger aircraft.',true);return;
  }
  if(name==='airport'){ui.selectedAirport=id;ui.renderPanel();return;}
  if(name==='camera'){flight.cameraMode=(flight.cameraMode+1)%3;ui.updateHUD();return;}
  if(name==='throttle-preset'){if(!ui.panel){flight.throttle=clamp(Number(id)/100,0,1);ui.updateHUD();}return;}
  if(name==='flaps'){if(flight.spec.helicopter)return;flight.flaps=!flight.flaps;ui.toast(`Flaps ${flight.flaps?'extended for takeoff & landing':'retracted for cruise'}.`);return;}
  if(name==='hold'){
    if(flight.grounded||flight.spec.helicopter)return;
    flight.cruiseHold=!flight.cruiseHold;ui.toast(`Level cruise hold ${flight.cruiseHold?'engaged. Manual input releases it.':'released.'}`);return;
  }
  if(name==='speed'){
    if(flight.agl<250){ui.toast('Climb above 250 m AGL to accelerate cruise.');return;}
    flight.timeScale=flight.timeScale===1?2:flight.timeScale===2?4:1;ui.updateHUD();return;
  }
  if(name==='quality'){world.setQuality(id);persist();return;}
  if(name==='settingschange'){audio.volume=state.settings.sound;persist();return;}
  if(name==='save'){persist(true);return;}
  if(name==='export-save'){
    state.flight=flight.snapshot();
    const blob=new Blob([JSON.stringify({game:'skybound-airworks',save:state},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='skybound-company.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);ui.toast('Save file exported.','success');return;
  }
  if(name==='reset-request'){
    document.querySelector('#reset-confirm').innerHTML='<button class="primary-button" data-action="reset">Confirm: replace this company with a new one</button>';return;
  }
  if(name==='reset'){
    const fresh=newCompany();localStorage.setItem(SAVE_KEY,JSON.stringify(fresh));window.location.reload();return;
  }
}

document.querySelector('#app').addEventListener('change',async e=>{
  if(e.target.id!=='import-save'||!e.target.files?.[0])return;
  try{
    const file=e.target.files[0];
    if(file.size>2_000_000)throw new Error('This save file is too large.');
    const raw=JSON.parse(await file.text()),s=raw.save;
    if(raw.game!=='skybound-airworks'||s?.version!==1||!Array.isArray(s.fleet)||!s.fleet.length||!Array.isArray(s.buildings)||!Array.isArray(s.lots)||!Number.isFinite(s.money)||s.money<0)throw new Error('Choose a valid Skybound company save.');
    if(s.fleet.some(p=>!AIRCRAFT.some(a=>a.id===p.type)))throw new Error('This save contains an unknown aircraft.');
    localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.location.reload();
  }catch(error){ui.toast(error.message||'The save file could not be imported.','error');}
});

bindTouchControls(document.querySelector('#app'),controls,()=>audio.start(),()=>ready&&!ui.panel);
window.addEventListener('beforeunload',()=>{if(ready)persist();});
window.addEventListener('skybound-pause',()=>{
  controls.clear();if(ready&&state.started&&!ui.panel)ui.open('settings');
  if(ready)persist();
});
document.addEventListener('visibilitychange',()=>{
  controls.clear();if(document.hidden&&ready&&state.started&&!ui.panel)ui.open('settings');
  if(ready)persist();
});

function shortcuts(){
  if(controls.consume('Escape')){if(ui.panel&&ui.panel!=='welcome')ui.close();else if(state.started)ui.open('settings');controls.clear();}
  if(!state.started)return;
  for(const [key,panel] of [['Digit1','contracts'],['Digit2','fleet'],['Digit3','headquarters'],['Digit4','ledger'],['Digit5','network'],['KeyM','atlas']])if(controls.consume(key)){action('panel',panel);controls.clear();}
  if(!ui.panel){
    for(const [key,name] of [['KeyC','camera'],['KeyG','flaps'],['KeyH','hold']])if(controls.consume(key))action(name);
  }
}
function handleEvent(event){
  if(!event)return;
  if(event.type==='crash'){
    world.rebuildMission();persist();ui.showResult(event);controls.clear();return;
  }
  if(event.type==='complete'){
    refreshContracts(state);world.rebuildCommunities();world.rebuildMission();persist();audio.chime();ui.showResult(event);controls.clear();return;
  }
  if(event.type==='stage'){world.rebuildCommunities();persist();ui.toast(event.text,'success');return;}
  if(event.type==='discovery'){if(!state.mission)refreshContracts(state);persist();ui.toast(event.text,'success');return;}
  if(event.type==='landing'){persist();ui.toast(event.text);return;}
  if(event.type==='boundary')ui.toast(event.text,'error');
}
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;time+=dt;
  if(!ready)return;
  shortcuts();
  const paused=!!ui.panel||document.hidden;
  const input=controls.read();
  if(!paused){
    if(flight.agl<250||flight.grounded)flight.timeScale=1;
    const simulationDelta=dt*flight.timeScale,steps=Math.max(1,Math.ceil(simulationDelta/.025));
    for(let i=0;i<steps;i++){
      const step=simulationDelta/steps;
      handleEvent(flight.update(input,step,world));
      if(ui.panel)break;
      handleEvent(updateMission(state,flight,input,step));
      input.interactPressed=false;
      const priorDay=state.day;advanceTime(state,step);
      if(state.day!==priorDay){world.rebuildCommunities();if(!state.mission)refreshContracts(state);}
      if(ui.panel)break;
    }
  }
  audio.update(flight,paused);
  world.update(flight,dt,time,paused?null:input,ui.panel==='headquarters'?'headquarters':ui.panel==='welcome'?'welcome':'flight',paused);
  hudTime+=dt;saveTime+=dt;
  if(hudTime>.1){hudTime=0;ui.updateHUD();}
  if(saveTime>20){saveTime=0;persist();}
}
async function initialize(){
  try{
    world=new World(document.querySelector('#game'),state);
    world.setQuality(state.settings.quality);
    await world.load((progress,label)=>ui.loading(progress,label));
    ready=true;ui.ready();ui.updateHUD();
  }catch(error){console.error(error);ui.failed(error.message||'This browser could not open the 3D world. Try a current browser with WebGL enabled.');}
}
requestAnimationFrame(frame);
initialize();
