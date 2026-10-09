import { AIRCRAFT, AIRPORTS, HQ, CATEGORIES, FACILITIES, RUNWAYS, LOT_COLS, LOT_ROWS, WEATHER, WORLD_SIZE, cash, clamp, distance, planeById, airportById, facilityById } from './data.js';
import { fleetCapacity, aircraftLock, selectedPlane, facilityCount, lotPrice, lotAdjacent, hasFacility } from './state.js';
import { contractLock, missionTarget, missionInstruction } from './missions.js';
import { heightAt, biomeAt, BIOME_COLORS, nearestAirport } from './terrain.js';
import { dispatch, fleet as fleetPanel, network } from './company-ui.js';
import { effectiveSpec, serviceQuote, baseOwned, townLevel, missionCargoWeight } from './operations.js';
import { dailyOverhead } from './state.js';

const paths={
  plane:'M12 2l2 7 8 4v3l-8-2-1 5 3 2v1l-4-1-4 1v-1l3-2-1-5-8 2v-3l8-4z',
  package:'M3 7l9-5 9 5v10l-9 5-9-5zM3 7l9 5 9-5M12 12v10M8 4l9 5',
  hangar:'M2 10l10-7 10 7v11H2zM6 21V11h12v10M6 15h12M6 18h12',
  map:'M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16',
  chart:'M4 3v18h17M8 16v-4M13 16V8M18 16V5',
  medical:'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  fire:'M13 2c1 5-3 5-2 9 2 0 3-2 3-3 5 5 7 8 4 12-3 4-10 3-12 0-4-6 2-10 3-14 0 4 2 4 4 6',
  leaf:'M21 3C8 2 2 7 4 15c5 7 15 1 17-12zM3 21L16 8',
  sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2M12 20v2M2 12h2M20 12h2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
  scan:'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M4 12h16M12 8v8',
  rescue:'M4 7h16M12 3v4M8 10h8l3 6H5zM12 16v5M9 21h6M2 7h2M20 7h2',
  fuel:'M4 21V4h9v17M4 9h9M2 21h13M13 7h3l3 4v7a2 2 0 0 0 4 0V9l-4-4',
  tool:'M14 3a6 6 0 0 0-7 8l-5 6 5 5 6-7a6 6 0 0 0 8-7l-4 4-5-5z',
  tower:'M8 21V10h8v11M5 10V4h14v6zM3 4h18M12 4V1',
  arrow:'M4 12h15M13 6l6 6-6 6',
  close:'M5 5l14 14M19 5L5 19',
  check:'M4 12l5 5 11-11',
  lock:'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4',
  clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l4 2',
  settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  wind:'M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7',
  pin:'M12 22s8-8 8-13A8 8 0 0 0 4 9c0 5 8 13 8 13M12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  info:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 10v7M12 7v1',
};
export const icon=(id,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[id]||paths.plane}" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const km=n=>`${n.toFixed(1)} km`;
const pct=(n,color='')=>`<span class="meter ${color}"><i style="width:${clamp(n,0,100)}%"></i></span>`;
const thumb=id=>`${import.meta.env.BASE_URL}thumbnails/${id}.png`;

export class UI {
  constructor(root,state,flight,onAction){
    this.root=root;this.state=state;this.flight=flight;this.onAction=onAction;
    this.panel=null;this.filter='all';this.contractId=null;this.selectedFacility='apron';this.selectedAirport='hq';this.fleetTab='owned';this.buildMode='build';this.toasts=[];
    this.dispatchOrigin=flight.atAirport()?.id||'hq';this.manifestIds=[];this.networkTab='bases';this.networkAirport='willow';this.branchFacility='hangar';
    root.innerHTML=`
      <header class="topbar">
        <button class="brand" data-action="panel" data-id="company" aria-label="Company menu"><span class="brand-mark">${icon('plane')}</span><span><b>SKYBOUND</b><small>A I R W O R K S</small></span></button>
        <div class="location-pill">${icon('pin')}<span id="location-label">Greenheart Valley</span><span class="status-dot"></span></div>
        <div class="company-stats"><div><small>COMPANY FUNDS</small><strong id="funds">${cash(state.money)}</strong></div><div><small>REPUTATION</small><strong><span id="reputation">0</span><span class="stat-unit"> / 100</span></strong></div><div class="time-stat"><small id="day-label">DAY 01</small><strong id="clock-label">08:00</strong></div></div>
        <button class="icon-button" data-action="panel" data-id="settings" aria-label="Settings and pause">${icon('settings')}</button>
      </header>
      <aside class="mission-card" id="mission-card"></aside>
      <div class="navigation-tag" id="navigation-tag"><span class="nav-diamond"></span><span id="target-label">HEADQUARTERS</span><b id="target-distance"></b></div>
      <div class="flight-warning" id="flight-warning" role="status"></div>
      <div class="world-caption"><span>YOUR COMPANY. YOUR SKIES.</span><b id="weather-label">Clear skies</b><small id="wind-label">Wind 4 m/s</small></div>
      <canvas class="minimap" id="minimap" width="240" height="180" aria-label="Local navigation map"></canvas>
      <button class="minimap-open" data-action="panel" data-id="atlas">REGIONAL ATLAS ${icon('arrow')}</button>
      <div class="cockpit" id="cockpit">
        <div class="instrument instrument-speed"><small>AIRSPEED</small><strong id="airspeed">0</strong><span>km/h</span><div class="speed-ticks"></div></div>
        <div class="horizon-instrument"><div class="horizon-disc" id="horizon-disc"><div class="horizon-sky"></div><div class="horizon-ground"></div><i></i></div><div class="horizon-cross">— • —</div><small id="heading">N · 000°</small></div>
        <div class="instrument"><small>ALTITUDE</small><strong id="altitude">65</strong><span>m ASL <em id="agl">0 m AGL</em></span></div>
        <div class="small-instruments"><div><span>${icon('fuel')} FUEL <b id="fuel-label">100%</b></span><div id="fuel-meter">${pct(100)}</div></div><div><span>${icon('tool')} AIRFRAME <b id="condition-label">100%</b></span><div id="condition-meter">${pct(100)}</div></div></div>
        <div class="throttle-control"><label for="throttle">THROTTLE <b id="throttle-value">0%</b></label><input id="throttle" type="range" min="0" max="100" value="0" aria-label="Throttle percentage"/><span><kbd>SHIFT</kbd> up <kbd>CTRL</kbd> down</span></div>
      </div>
      <nav class="toolbar" aria-label="Company management">
        <button data-action="panel" data-id="contracts">${icon('package')}<span>Contracts</span><kbd>1</kbd></button>
        <button data-action="panel" data-id="fleet">${icon('plane')}<span>Fleet</span><kbd>2</kbd></button>
        <button data-action="panel" data-id="headquarters">${icon('hangar')}<span>Headquarters</span><kbd>3</kbd></button>
        <button data-action="panel" data-id="network">${icon('pin')}<span>Network</span><kbd>5</kbd></button>
        <button data-action="panel" data-id="atlas">${icon('map')}<span>Atlas</span><kbd>M</kbd></button>
        <button data-action="panel" data-id="ledger">${icon('chart')}<span>Ledger</span><kbd>4</kbd></button>
        <div class="toolbar-divider"></div>
        <button class="help-button" data-action="panel" data-id="guide">${icon('info')}<span>Flight guide</span></button>
      </nav>
      <div class="flight-actions"><button data-action="camera" id="camera-button">${icon('plane')}<span>Chase view</span><kbd>C</kbd></button><button data-action="hold" id="hold-button">LEVEL HOLD <kbd>H</kbd></button><button data-action="speed" id="speed-button">1× CRUISE</button><button data-action="flaps" id="flaps-button">FLAPS ON <kbd>G</kbd></button></div>
      <div class="touch-controls" id="touch-controls">
        <div class="touch-flight"><span class="touch-label">NOSE UP</span><div id="flight-stick" class="flight-stick" role="group" aria-label="Flight stick: drag up to raise the nose, left or right to bank"><i class="stick-cross"></i><span class="stick-knob"></span><span class="stick-center">FLY</span></div><span class="touch-label">NOSE DOWN</span><div class="touch-rudder"><button data-touch="rudder:1" aria-label="Steer left">◀ STEER</button><button data-touch="rudder:-1" aria-label="Steer right">STEER ▶</button></div></div>
        <div class="touch-engine"><label for="touch-throttle">THROTTLE <b id="touch-throttle-value">0%</b></label><input id="touch-throttle" type="range" min="0" max="100" value="0" aria-label="Touch throttle percentage"/><div class="touch-power"><button data-action="throttle-preset" data-id="0">IDLE</button><button data-action="throttle-preset" data-id="100">FULL</button></div><div class="touch-buttons"><button data-touch="brake:true">HOLD BRAKE</button><button data-touch="action:true">DROP / SPRAY</button><button data-touch="interact:true">INTERACT / WINCH</button></div></div>
      </div>
      <div class="toast-stack" id="toasts" aria-live="polite"></div>
      <div class="panel-host" id="panel-host"></div>
      <div class="loading-screen" id="loading-screen"><div class="loading-logo">${icon('plane')}<span>SKYBOUND<small>AIRWORKS</small></span></div><p>Preparing a world of possibilities.</p><div class="loading-bar"><i id="loading-progress"></i></div><small id="loading-detail">Opening the hangar doors…</small><span class="loading-foot">AN ORIGINAL LOW-POLY AVIATION BUSINESS GAME</span></div>`;
    root.addEventListener('click',e=>{
      const el=e.target.closest('[data-action]');if(!el)return;
      this.onAction(el.dataset.action,el.dataset.id,el.dataset);
    });
    root.addEventListener('input',e=>{
      if(e.target.id==='throttle'||e.target.id==='touch-throttle'){flight.throttle=Number(e.target.value)/100;}
      if(e.target.id==='sound-volume'){state.settings.sound=Number(e.target.value)/100;this.onAction('settingschange');}
      if(e.target.id==='dispatch-fuel-target'){root.querySelector('#fuel-target-label').textContent=`${e.target.value} L`;}
    });
    root.addEventListener('change',e=>{
      if(e.target.id==='quality-select'){state.settings.quality=e.target.value;this.onAction('quality',e.target.value);}
      if(e.target.id==='assist-toggle'){state.settings.assist=e.target.checked;this.onAction('settingschange');}
      if(e.target.id==='dispatch-base'){this.onAction('dispatch-base',e.target.value);}
      if(e.target.id==='upgrade-aircraft'){this.onAction('upgrade-selection',e.target.value);}
    });
    this.elements=Object.fromEntries([...root.querySelectorAll('[id]')].map(e=>[e.id,e]));
    this.makeMapBackground();
  }
  loading(progress,label){this.elements['loading-progress'].style.width=`${progress*100}%`;this.elements['loading-detail'].textContent=label;}
  ready(){this.elements['loading-screen'].remove();if(!this.state.started)this.open('welcome');else this.open('contracts');}
  failed(message){this.elements['loading-detail'].textContent=message;this.elements['loading-detail'].classList.add('loading-error');}
  open(panel){
    if(this.panel===panel&&panel!=='welcome'){this.close();return;}
    if(panel==='contracts'&&!this.state.mission){const origin=this.flight.atAirport()?.id||this.dispatchOrigin;if(origin!==this.dispatchOrigin)this.manifestIds=[];this.dispatchOrigin=origin;}
    this.panel=panel;this.renderPanel();this.root.classList.add('panel-open');
    this.root.classList.toggle('welcome-open',panel==='welcome');
    for(const el of this.root.querySelectorAll('.toolbar [data-id]'))el.classList.toggle('active',el.dataset.id===panel);
  }
  close(){this.panel=null;this.elements['panel-host'].innerHTML='';this.root.classList.remove('panel-open','welcome-open');for(const el of this.root.querySelectorAll('.toolbar .active'))el.classList.remove('active');}
  renderPanel(){
    const p=this.panel;if(!p)return;
    const titles={contracts:['The dispatch board','Every flight moves your company forward.'],fleet:['Your wings, your possibilities','Build a fleet for every kind of work.'],headquarters:['Room to grow','Expand your footprint. Give your ambitions a home.'],atlas:['A whole world to connect','44 × 44 km · 20 airfields · 10 landscapes'],ledger:['The company ledger','Make every flight count.'],settings:['A moment on the ground','Flight is paused while this panel is open.'],guide:['Learn to fly','A few good habits will take you a long way.'],company:['Your aviation company','From one small aeroplane to a regional airworks.']};
    if(p==='welcome'){this.renderWelcome();return;}
    if(p==='result'||p==='crash'){this.renderResult();return;}
    const title=titles[p]||titles.company;
    if(p==='network'){title[0]='Your regional network';title[1]='Build branches. Keep communities connected.';}
    let content=p==='contracts'?this.contracts():p==='fleet'?this.fleet():p==='network'?network(this,icon,escapeHtml):p==='headquarters'?this.headquarters():p==='atlas'?this.atlas():p==='ledger'?this.ledger():p==='settings'?this.settings():p==='guide'?this.guide():this.company();
    this.elements['panel-host'].innerHTML=`<section class="management-panel ${p}-panel" aria-label="${title[0]}"><header class="panel-header"><div><span class="eyebrow">SKYBOUND / ${p.toUpperCase()}</span><h1>${title[0]}</h1><p>${title[1]}</p></div><div class="panel-header-right"><span class="paused-label">${icon('clock')} FLIGHT PAUSED</span><button class="icon-button" data-action="close" aria-label="Close panel">${icon('close')}</button></div></header>${content}</section>`;
    if(p==='atlas')this.drawAtlas();
  }
  renderWelcome(){
    this.elements['panel-host'].innerHTML=`<section class="welcome-card"><span class="eyebrow">A SMALL PLANE. A BIG BEGINNING.</span><h1>Your company.<br/>Your skies.</h1><p>Start with a trusty Kestrel, a little airstrip, and a world waiting on your next delivery.</p><div class="welcome-line"><span>${icon('plane')} Fly the missions</span><span>${icon('hangar')} Grow your airworks</span><span>${icon('map')} Explore everywhere</span></div><label class="company-name-label" for="company-name">NAME YOUR COMPANY</label><input id="company-name" maxlength="36" value="${escapeHtml(this.state.company)}"/><button class="primary-button welcome-start" data-action="start">Open the hangar doors ${icon('arrow')}</button><small class="welcome-sub">One aircraft · ${cash(this.state.money)} starting capital · Your first contract awaits</small></section><div class="welcome-world-label"><span>01 / GREENHEART VALLEY</span><b>It all starts here.</b><small>Original aircraft & scenery, crafted in Blender.</small></div>`;
  }
  contracts(){ return dispatch(this,icon,escapeHtml); }
  fleet(){ return fleetPanel(this,icon,escapeHtml); }
  headquarters(){
    const s=this.state,f=facilityById(this.selectedFacility),parked=this.flight.atHQ(),next=RUNWAYS[s.runway];
    return `<div class="hq-layout"><aside class="build-catalog scroll-panel"><div class="segmented"><button class="${this.buildMode==='build'?'selected':''}" data-action="build-mode" data-id="build">Facilities</button><button class="${this.buildMode==='land'?'selected':''}" data-action="build-mode" data-id="land">Buy land</button></div>${this.buildMode==='land'?`<div class="land-brief"><span class="eyebrow">SPACE FOR YOUR AMBITIONS</span><h2>Expand your footprint.</h2><p>Buy an adjoining parcel, then choose what to build on it.</p><div class="big-reward">${cash(lotPrice(s))}<small>NEXT PARCEL</small></div><p>${s.lots.length} / ${LOT_COLS*LOT_ROWS} parcels owned</p></div>`:FACILITIES.map(a=>`<button class="facility-option ${this.selectedFacility===a.id?'selected':''}" data-action="facility" data-id="${a.id}"><span class="facility-icon">${icon(a.icon)}</span><span><b>${a.name}</b><small>${cash(a.cost)} ${a.rep?`· ${a.rep} rep`:''}</small></span>${facilityCount(s,a.id)?`<em>${facilityCount(s,a.id)} built</em>`:icon('arrow')}</button>`).join('')}</aside><div class="hq-plan"><div class="hq-metrics"><div><small>HQ FLEET SPACES</small><b>${s.fleet.filter(p=>p.home==='hq').length}<span> / ${fleetCapacity(s,'hq')}</span></b></div><div><small>FACILITIES</small><b>${s.buildings.length}</b></div><div><small>LAND OWNED</small><b>${s.lots.length}<span> / 24 lots</span></b></div><div><small>RUNWAY</small><b>LV ${s.runway}</b></div></div><div class="blueprint"><div class="blueprint-title"><span>${icon('hangar')} AIRWORKS / SITE PLAN</span><small>N ↑</small></div><div class="lot-grid">${Array.from({length:24},(_,i)=>{
      const owned=s.lots.includes(i),b=s.buildings.find(b=>b.lot===i),a=b?.id==='dispatch'?{name:'Dispatch office',icon:'tower'}:facilityById(b?.id),adjacent=lotAdjacent(s,i);
      return `<button class="lot ${owned?'owned':''} ${b?'occupied':''} ${!owned&&adjacent?'expandable':''} ${!owned&&!adjacent?'remote-lot':''}" style="grid-column:${LOT_COLS-i%LOT_COLS};grid-row:${Math.floor(i/LOT_COLS)+1}" data-action="lot" data-id="${i}" ${!parked||(!owned&&!adjacent)?'disabled':''}><small>LOT ${String(i+1).padStart(2,'0')}</small>${b?`${icon(a?.icon)}<b>${a?.name||'Facility'}</b>`:owned?`<span class="lot-plus">＋</span><b>${this.buildMode==='build'?'Build here':'Owned land'}</b>`:adjacent?`<span class="lot-plus">＋</span><b>${this.buildMode==='land'?cash(lotPrice(s)):'Available land'}</b>`:`${icon('lock')}<b>Expand towards me</b>`}</button>`;
    }).join('')}</div><div class="runway-plan"><span></span><b>RUNWAY ${String(s.runway).padStart(2,'0')} / ${RUNWAYS[s.runway-1].length} m</b><span></span></div></div><div class="build-detail">${this.buildMode==='build'?`<div><span class="eyebrow">SELECTED FACILITY</span><h3>${f.name}</h3><p>${f.description}</p><span class="build-requirements">${cash(f.cost)} ${f.rep?`· Requires ${f.rep} reputation`:''} · Click an empty owned lot to build</span></div>${icon(f.icon)}`:`<div><h3>Click an outlined parcel to buy land</h3><p>Your new parcel must share an edge with land you already own.</p></div>${icon('map')}`}</div><div class="runway-upgrade"><div><b>${next?'Ready for a longer runway?':'International runway complete'}</b><small>${next?`${next.length} m · ${next.rep} reputation · Opens larger aircraft`:'Your airworks can handle the region’s largest aircraft.'}</small></div>${next?`<button class="secondary-button" data-action="runway" ${!parked||s.reputation<next.rep||s.money<next.cost?'disabled':''}>Upgrade · ${cash(next.cost)}</button>`:icon('check')}</div>${!parked?'<div class="panel-note">Return to headquarters and park to build or expand.</div>':''}</div></div>`;
  }
  atlas(){
    const s=this.state,a=airportById(this.selectedAirport),n=nearestAirport(this.flight.position.x,this.flight.position.z),visited=s.discovered.includes(a.id);
    return `<div class="atlas-layout"><div class="atlas-map-wrap"><canvas id="atlas-map" width="1100" height="1100" aria-label="Map of the entire Skybound region"></canvas><div class="map-scale"><span></span><b>5 km</b></div><div class="map-coordinates">44° REGION / NORTH ↑</div><div class="map-legend"><span><i style="background:#cde3ad"></i>Your aircraft</span><span><i style="background:#f7e7b4"></i>Airfield</span><span><i style="background:#e69761"></i>Branch base</span><span><i style="background:#c09979"></i>Mission route</span></div></div><aside class="atlas-sidebar scroll-panel"><span class="eyebrow">EXPLORE THE REGION</span><h2>${a.name}</h2><p>${a.region}</p><div class="region-badge" style="background:${a.color}">${a.biome.toUpperCase()} / ${visited?'DISCOVERED':'UNDISCOVERED'}</div><div class="detail-row"><span>Distance from you</span><b>${km(distance(a,this.flight.position)/1000)}</b></div><div class="detail-row"><span>Runway length</span><b>${a.id==='hq'?RUNWAYS[s.runway-1].length:a.length} m</b></div><div class="detail-row"><span>Elevation</span><b>${Math.round(heightAt(a.x,a.z))} m</b></div><div class="detail-row"><span>Population</span><b>${s.settlements[a.id]?s.settlements[a.id].population.toLocaleString():'Your company'}</b></div><p class="atlas-tip">${a.biome==='mountain'||a.biome==='snow'?'Climb early and keep a generous clearance above the ridgelines.':a.biome==='tropical'?'Plan your fuel carefully over the sea. Floatplanes can also land on water.':a.biome==='desert'?'Dry plateaus and rocky canyons reward careful route planning.':'Airfields offer refuelling and repair when you are safely parked.'}</p>${a.id!=='hq'?`<button class="secondary-button" data-action="manage-branch" data-id="${a.id}">${s.branches[a.id]?'Manage branch':'Establish a branch'} ${icon('hangar')}</button><p class="atlas-tip">Development level ${townLevel(s.settlements[a.id])} · ${Math.round(s.settlements[a.id].delivered)} kg supplied</p>`:''}<h3 class="airfield-list-title">${s.discovered.length} / 20 airfields discovered</h3><div class="airfield-list">${AIRPORTS.map(a=>`<button class="${a.id===this.selectedAirport?'selected':''}" data-action="airport" data-id="${a.id}"><span class="airfield-dot ${s.discovered.includes(a.id)?'visited':''}"></span><span><b>${a.name}</b><small>${a.region}</small></span>${icon('arrow')}</button>`).join('')}</div></aside></div>`;
  }
  ledger(){
    const s=this.state,revenue=s.ledger.filter(l=>l.amount>0).reduce((n,l)=>n+l.amount,0),expenses=-s.ledger.filter(l=>l.amount<0).reduce((n,l)=>n+l.amount,0);
    return `<div class="ledger-layout scroll-panel"><div class="ledger-stats"><div><small>COMPANY BALANCE</small><b>${cash(s.money)}</b><span>A runway for your next idea.</span></div><div><small>CONTRACTS COMPLETED</small><b>${s.completed}</b><span>Trusted by ${Math.floor(s.reputation)} reputation points.</span></div><div><small>LIFETIME REVENUE</small><b>${cash(s.totalRevenue)}</b><span>Earned by the work you fly.</span></div><div><small>DISTANCE FLOWN</small><b>${s.totalDistance.toFixed(1)} <em>km</em></b><span>${s.discovered.length} places discovered.</span></div></div><div class="ledger-columns"><div><div class="section-title"><h2>Recent transactions</h2><small>Latest 80 entries</small></div><table class="transaction-table"><thead><tr><th>DAY</th><th>DESCRIPTION</th><th>AMOUNT</th></tr></thead><tbody>${s.ledger.map(l=>`<tr><td>${String(l.day).padStart(2,'0')}</td><td>${escapeHtml(l.label)}</td><td class="${l.amount>=0?'positive':'negative'}">${l.amount>=0?'+':'−'}${cash(Math.abs(l.amount))}</td></tr>`).join('')}</tbody></table></div><aside class="company-summary"><span class="eyebrow">KEEP THE AIRWORKS HEALTHY</span><h2>Good flying.<br/>Good business.</h2><p>Fuel, repairs, and daily overhead are real costs. Longer routes and specialist work pay more, but need the right equipment.</p><div class="detail-row"><span>Recent income</span><b>${cash(revenue)}</b></div><div class="detail-row"><span>Recent spending</span><b>${cash(expenses)}</b></div><div class="detail-row"><span>Daily overhead</span><b>${cash(dailyOverhead(s))}</b></div><div class="brief-tip">${icon('info')} Fuel depots, maintenance shops, and solar canopies lower running costs. A control tower adds 10% to contract rewards.</div></aside></div></div>`;
  }
  settings(){
    const s=this.state;
    return `<div class="settings-layout scroll-panel"><div><h2>Make yourself comfortable.</h2><label class="setting-row"><span><b>Engine & wind volume</b><small>Procedural engine sound and airflow.</small></span><input id="sound-volume" type="range" min="0" max="100" value="${Math.round(s.settings.sound*100)}"/></label><label class="setting-row"><span><b>Graphics quality</b><small>Resolution, cloud visibility, and shadows.</small></span><select id="quality-select">${['low','balanced','high'].map(q=>`<option value="${q}" ${s.settings.quality===q?'selected':''}>${q[0].toUpperCase()+q.slice(1)}</option>`).join('')}</select></label><label class="setting-row"><span><b>Flight assistance</b><small>Returns pitch and bank towards level when you release the controls.</small></span><input id="assist-toggle" type="checkbox" ${s.settings.assist?'checked':''}/></label><div class="save-actions"><button class="primary-button" data-action="save">Save company ${icon('check')}</button><button class="secondary-button" data-action="export-save">Export save file</button><label class="secondary-button import-button">Import save<input type="file" id="import-save" accept="application/json,.json" hidden/></label></div><p class="save-note">Your company and flight position also save automatically in this browser every 20 seconds.</p><div class="reset-area"><h3>A fresh beginning</h3><p>Start a new company in this browser. Export your current save if you want to keep it.</p><button class="text-button danger" data-action="reset-request">Start a new company</button><div id="reset-confirm"></div></div></div><aside class="settings-aside"><span class="eyebrow">SKYBOUND AIRWORKS</span><h2>Built to go<br/>a little further.</h2><p>73 original low-poly Blender models, ten aircraft, twenty airfields, and seven kinds of work.</p><button class="secondary-button" data-action="panel" data-id="guide">Open the flight guide ${icon('arrow')}</button><button class="primary-button" data-action="close">Continue flying ${icon('arrow')}</button></aside></div>`;
  }
  guide(){
    return `<div class="guide-layout scroll-panel"><div class="guide-first"><span class="eyebrow">YOUR FIRST FLIGHT</span><h2>From runway to reward.</h2><ol class="flight-steps"><li><span>01</span><div><b>Collect a small delivery</b><p>Open Contracts at headquarters. Willow Creek is a short first route; your Kestrel carries up to 280 kg, with less space when the tanks are full. Use + to combine orders.</p></div></li><li><span>02</span><div><b>Take off</b><p>Hold Shift or move the throttle slider to 100%. At 105 km/h, hold S / ↓ gently to lift the nose. Retract flaps with G once airborne.</p></div></li><li><span>03</span><div><b>Fly your route</b><p>A / D bank the aircraft. Watch your heading and atlas; steer towards the destination marker. Climb above hills before crossing them.</p></div></li><li><span>04</span><div><b>Land gently</b><p>Line up with the runway from about 2 km out. Reduce throttle to 25–40%, extend flaps, and descend gently at 100–130 km/h. Keep your wings level.</p></div></li><li><span>05</span><div><b>Finish the job</b><p>After touchdown, reduce throttle to zero and hold B to stop. Press E to unload and wait for the ground crew. Continue to the next stop, or collect return freight at this airport.</p></div></li></ol></div><div class="guide-controls"><h2>At your fingertips.</h2><div class="control-table">${[['Shift / R','Increase throttle'],['Ctrl / F','Decrease throttle'],['S / ↓','Pitch up · nose rises'],['W / ↑','Pitch down · nose lowers'],['A / D or ← / →','Bank left / right'],['Z / X','Rudder · ground steering'],['B','Wheel brakes'],['G','Extend / retract flaps'],['Space','Drop water / spray crops'],['E','Unload / pick up / hold to winch'],['C','Chase / cockpit / orbit camera'],['H','Level cruise hold'],['M','Regional atlas'],['1 · 2 · 3 · 4 · 5','Contracts · Fleet · HQ · Ledger · Network'],['Esc','Pause / close panel']].map(([key,label])=>`<div><kbd>${key}</kbd><span>${label}</span></div>`).join('')}</div><div class="brief-tip">${icon('info')} Helicopter: throttle around 52% to hover, higher to climb, lower to descend. Hold S / ↓ to move forward. Use A / D to turn.</div><div class="brief-tip">${icon('info')} Gamepad: left stick flies, triggers change throttle; A drops/sprays, B brakes, and X interacts. iPad / touch: drag the left flight stick up to raise the nose and sideways to bank. Use STEER on the runway. Set power with the right throttle slider or IDLE / FULL; hold BRAKE, DROP / SPRAY, or INTERACT / WINCH as needed. Releasing the stick centers it. Touch controls appear at every screen size on touch devices.</div><p class="guide-cruise">2× and 4× cruise are available above 250 m AGL. They return to 1× near the ground.</p></div></div>`;
  }
  company(){
    return `<div class="company-page scroll-panel"><span class="eyebrow">EST. DAY 01</span><h2>${escapeHtml(this.state.company)}</h2><p>Your headquarters connects places that roads cannot. Keep your aircraft healthy, build a useful fleet, and let each new contract fund your next possibility.</p><div class="company-milestones">${[['First flight',this.state.completed>=1,'Complete your first delivery.'],['A growing airworks',this.state.buildings.length>=5,'Build five headquarters facilities.'],['Specialist wings',this.state.fleet.some(p=>planeById(p.type).category!=='cargo'),'Own an aircraft for specialist work.'],['Across the region',this.state.discovered.length>=10,'Discover ten different airfields.'],['A name people trust',this.state.reputation>=50,'Reach 50 reputation.'],['The whole horizon',this.state.discovered.length===20,'Discover all twenty airfields.']].map(([name,done,text])=>`<div class="milestone ${done?'complete':''}">${icon(done?'check':'plane')}<span><b>${name}</b><small>${text}</small></span></div>`).join('')}</div><button class="primary-button" data-action="close">Back to your skies ${icon('arrow')}</button></div>`;
  }
  showResult(result){this.result=result;this.panel=result.type==='crash'?'crash':'result';this.renderPanel();this.root.classList.add('panel-open');}
  renderResult(){
    const r=this.result,crash=r.type==='crash';
    this.elements['panel-host'].innerHTML=`<section class="result-card"><span class="result-icon ${crash?'crash-icon':''}">${icon(crash?'tool':'check')}</span><span class="eyebrow">${crash?'BACK ON SOLID GROUND':'ANOTHER PROMISE DELIVERED'}</span><h1>${crash?'Recovered & ready.':'A job well flown.'}</h1><p>${escapeHtml(crash?r.text:r.title)}</p><div class="result-stats">${crash?`<div><b>${cash(r.bill)}</b><small>RECOVERY & REPAIR</small></div><div><b>75%</b><small>AIRFRAME RESTORED</small></div>`:`<div><b>+${cash(r.reward)}</b><small>${r.manifest?'TOTAL MANIFEST PAYMENTS':'PAYMENT RECEIVED'}</small></div><div><b>${Math.round(r.quality)}%</b><small>CONTRACT QUALITY</small></div>`}</div>${!crash&&r.reports?.filter(Boolean).length?`<div class="result-community">${r.reports.filter(Boolean).map(report=>`<p>${escapeHtml(report)}</p>`).join('')}</div>`:''}<p class="result-note">${crash?'Your aircraft is back at headquarters. Check your fuel, collect a new contract, and try again.':'Open Contracts for local departures or return freight. Your next base is marked on the map.'}</p><button class="primary-button" data-action="close">${crash?'Return to the airfield':'Back to the cockpit'} ${icon('arrow')}</button></section>`;
  }
  toast(message,type='info'){
    const el=document.createElement('div');el.className=`toast toast-${type}`;el.innerHTML=`${icon(type==='success'?'check':type==='error'?'info':'plane')}<span>${escapeHtml(message)}</span>`;this.elements.toasts.append(el);
    setTimeout(()=>{el.classList.add('toast-out');setTimeout(()=>el.remove(),350);},5500);
  }
  updateHUD(){
    const s=this.state,f=this.flight,p=selectedPlane(s),a=effectiveSpec(p),e=this.elements;
    e.funds.textContent=cash(s.money);e.reputation.textContent=Math.floor(s.reputation);
    e['day-label'].textContent=`DAY ${String(s.day).padStart(2,'0')}`;
    e['clock-label'].textContent=`${String(Math.floor(s.clock)).padStart(2,'0')}:${String(Math.floor((s.clock%1)*60)).padStart(2,'0')}`;
    e.airspeed.textContent=Math.round(f.speed*3.6);e.altitude.textContent=Math.round(f.position.y);e.agl.textContent=`${Math.round(f.agl)} m AGL`;
    const heading=((f.yaw*180/Math.PI)%360+360)%360,dirs=['N','NW','W','SW','S','SE','E','NE'];
    const compass=(360-heading)%360;e.heading.textContent=`${dirs[Math.round(heading/45)%8]} · ${String(Math.round(compass)%360).padStart(3,'0')}°`;
    e['horizon-disc'].style.transform=`rotate(${-f.roll*180/Math.PI}deg) translateY(${f.pitch*45}px)`;
    e['fuel-label'].textContent=`${Math.round(p.fuel/a.fuel*100)}%`;e['condition-label'].textContent=`${Math.round(p.condition)}%`;
    e['fuel-meter'].innerHTML=pct(p.fuel/a.fuel*100,p.fuel<a.fuel*.2?'low':'');e['condition-meter'].innerHTML=pct(p.condition,p.condition<30?'low':'');
    if(!e.throttle.hasAttribute('data-adjusting'))e.throttle.value=Math.round(f.throttle*100);
    if(!e['touch-throttle'].hasAttribute('data-adjusting'))e['touch-throttle'].value=Math.round(f.throttle*100);
    e['touch-throttle-value'].textContent=`${Math.round(f.throttle*100)}%`;
    e['throttle-value'].textContent=`${Math.round(f.throttle*100)}%`;
    const n=nearestAirport(f.position.x,f.position.z),biome=biomeAt(f.position.x,f.position.z);
    e['location-label'].textContent=n.distance<2200?n.airport.region:biome==='ocean'?'The Open Sea':`${biome[0].toUpperCase()+biome.slice(1)} Wilderness`;
    const weather=WEATHER[(s.day-1)%WEATHER.length];e['weather-label'].textContent=weather.name;e['wind-label'].textContent=`Wind ${weather.wind} m/s`;
    const t=missionTarget(s),d=distance(f.position,t);e['target-label'].textContent=t.label.toUpperCase();e['target-distance'].textContent=km(d/1000);
    e['hold-button'].classList.toggle('enabled',f.cruiseHold);e['hold-button'].disabled=f.grounded||a.helicopter;e['speed-button'].textContent=`${f.timeScale}× CRUISE`;e['speed-button'].disabled=f.agl<250;
    e['flaps-button'].innerHTML=`FLAPS ${f.flaps?'ON':'OFF'} <kbd>G</kbd>`;e['flaps-button'].classList.toggle('enabled',f.flaps);e['flaps-button'].disabled=!!a.helicopter;
    e['camera-button'].querySelector('span').textContent=['Chase view','Cockpit view','Orbit view'][f.cameraMode];
    const warning=f.stalling?'STALL · LOWER YOUR NOSE AND ADD POWER':p.fuel<a.fuel*.12?'LOW FUEL · PLAN A LANDING':p.condition<25?'AIRFRAME DAMAGE · LAND FOR REPAIR':f.agl<80&&!f.grounded&&f.speed>a.stall*1.9?'LOW ALTITUDE · WATCH YOUR CLEARANCE':'';
    e['flight-warning'].textContent=warning;e['flight-warning'].classList.toggle('visible',!!warning);
    this.updateMissionCard();this.drawMinimap();
  }
  updateMissionCard(){
    const s=this.state,m=s.mission,airport=this.flight.atAirport();
    const content=m?`<div class="mission-card-top"><span>${icon(CATEGORIES[m.category].icon)} ${CATEGORIES[m.category].name.toUpperCase()}</span><b>${cash(m.reward)}</b></div><h3>${escapeHtml(m.title)}</h3><p>${escapeHtml(missionInstruction(s))}</p>${m.category==='fire'||m.category==='agriculture'?`<div class="mission-progress">${pct(m.progress*100)}<span>${Math.round(m.progress*100)}%</span></div>`:m.category==='rescue'&&m.stage===0?`<div class="mission-progress">${pct(m.winch*100)}<span>${Math.round(m.winch*100)}%</span></div>`:''}<div class="mission-card-footer"><span>${icon('pin')} ${escapeHtml(missionTarget(s).label)}</span><button data-action="panel" data-id="contracts">Briefing ${icon('arrow')}</button></div>`:`<div class="mission-card-top"><span>${icon('plane')} ${planeById(selectedPlane(s).type).name.toUpperCase()}</span><span class="freeflight-dot">FREE FLIGHT</span></div><h3>${s.completed?'The next possibility awaits.':'Your first chapter starts here.'}</h3><p>${airport?'Collect local work or return freight at this airport. Combine cargo orders to make the most of your flight.':'Explore the skies, or follow your base marker to collect another contract.'}</p><button class="mission-cta" data-action="panel" data-id="contracts">Open dispatch board ${icon('arrow')}</button>`;
    const p=selectedPlane(s),a=effectiveSpec(p),remote=airport?.id!=='hq'&&!baseOwned(s,airport?.id);
    const fuelCost=serviceQuote(s,p,'fuel',airport?.id||'hq');
    const repairCost=serviceQuote(s,p,'repair',airport?.id||'hq');
    const busy=!!s.mission?.handling||!!this.flight.groundJob;
    const services=airport?`<div class="remote-services"><span>${icon('pin')} PARKED · ${airport.name}${remote?' · REMOTE SERVICE +30%':airport.id!=='hq'?' · LOCAL FACILITY RATES':''}</span><button data-action="service-active" data-id="fuel" ${busy||fuelCost===0||s.money<fuelCost?'disabled':''}>${icon('fuel')} Refuel ${cash(fuelCost)}</button><button data-action="service-active" data-id="repair" ${busy||repairCost===0||s.money<repairCost?'disabled':''}>${icon('tool')} Repair ${cash(repairCost)}</button></div>`:'';
    const payload=(s.mission?.category==='fire'||s.mission?.category==='agriculture')?`<div class="payload-status">${icon(s.mission.category==='fire'?'fire':'leaf')} ${Math.round(this.flight.payload)} / ${this.flight.spec.capacity} ${s.mission.category==='fire'?'L WATER':'KG SPRAY'}</div>`:'';
    const cargo=m?.orders?`<div class="payload-status">${icon('package')} ${missionCargoWeight(m)} kg aboard · ${m.stopOrder.length} stops left</div>`:'';
    const job=this.flight.groundJob;
    const ground=job?`<div class="payload-status">${icon('clock')} ${job.kind==='fuel'?'Fuel truck':'Ground crew'} · ${Math.ceil(job.remaining)} seconds</div>`:'';
    const html=content+services+payload+cargo+ground;
    if(this.elements['mission-card'].innerHTML!==html)this.elements['mission-card'].innerHTML=html;
  }
  makeMapBackground(){
    this.mapBackground=document.createElement('canvas');this.mapBackground.width=440;this.mapBackground.height=440;
    const ctx=this.mapBackground.getContext('2d'),image=ctx.createImageData(440,440);
    for(let y=0;y<440;y++)for(let x=0;x<440;x++){
      const wx=(x/440-.5)*WORLD_SIZE,wz=(y/440-.5)*WORLD_SIZE,h=heightAt(wx,wz),biome=biomeAt(wx,wz,h);
      const hex=h>0&&h<18?'#d8c8a1':BIOME_COLORS[biome],index=(y*440+x)*4;
      const shade=biome==='ocean'?1:clamp(.9+h/8500,.86,1.08);
      image.data[index]=parseInt(hex.slice(1,3),16)*shade;image.data[index+1]=parseInt(hex.slice(3,5),16)*shade;image.data[index+2]=parseInt(hex.slice(5,7),16)*shade;image.data[index+3]=255;
    }
    ctx.putImageData(image,0,0);
  }
  drawAtlas(){
    const canvas=this.elements['panel-host'].querySelector('#atlas-map');if(!canvas)return;
    const ctx=canvas.getContext('2d'),size=canvas.width;ctx.drawImage(this.mapBackground,0,0,size,size);
    const xy=p=>({x:(p.x/WORLD_SIZE+.5)*size,y:(p.z/WORLD_SIZE+.5)*size});
    ctx.strokeStyle='rgba(240,247,224,.15)';ctx.lineWidth=1;
    for(let i=0;i<=10;i++){ctx.beginPath();ctx.moveTo(i*size/10,0);ctx.lineTo(i*size/10,size);ctx.moveTo(0,i*size/10);ctx.lineTo(size,i*size/10);ctx.stroke();}
    const target=missionTarget(this.state),p=xy(this.flight.position),t=xy(target);
    ctx.setLineDash([8,7]);ctx.strokeStyle='#655d4b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(t.x,t.y);ctx.stroke();ctx.setLineDash([]);
    if(this.state.mission?.orders){
      ctx.setLineDash([8,7]);ctx.strokeStyle='#b9774e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x,p.y);
      let last=p;for(const id of this.state.mission.stopOrder){last=xy(airportById(id));ctx.lineTo(last.x,last.y);}ctx.stroke();
      const home=xy(airportById(this.state.navigationBase||this.state.mission.origin));ctx.setLineDash([3,9]);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(home.x,home.y);ctx.stroke();ctx.setLineDash([]);
    }
    for(const a of AIRPORTS){
      const q=xy(a),selected=a.id===this.selectedAirport;
      if(selected){ctx.beginPath();ctx.arc(q.x,q.y,17,0,Math.PI*2);ctx.strokeStyle='#183c41';ctx.lineWidth=2;ctx.stroke();}
      ctx.beginPath();ctx.arc(q.x,q.y,a.id==='hq'?8:this.state.branches[a.id]?7:5,0,Math.PI*2);ctx.fillStyle=a.id==='hq'?'#e9f0b8':this.state.branches[a.id]?'#e69761':'#fff1cf';ctx.fill();ctx.strokeStyle='#51685d';ctx.lineWidth=2;ctx.stroke();
      ctx.font=selected?'bold 15px sans-serif':'13px sans-serif';ctx.fillStyle='#213f3c';ctx.fillText(a.name,q.x+12,q.y+4);
    }
    this.drawPlane(ctx,p.x,p.y,18);
    canvas.addEventListener('click',e=>{
      const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*size,y=(e.clientY-rect.top)/rect.height*size;
      let best=null,dist=40;
      for(const a of AIRPORTS){const q=xy(a),d=Math.hypot(x-q.x,y-q.y);if(d<dist){dist=d;best=a;}}
      if(best){this.selectedAirport=best.id;this.renderPanel();}
    });
  }
  drawPlane(ctx,x,y,size){
    ctx.save();ctx.translate(x,y);ctx.rotate(-this.flight.yaw);ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(size*.25,-size*.15);ctx.lineTo(size,size*.2);ctx.lineTo(size,size*.45);ctx.lineTo(size*.18,size*.25);ctx.lineTo(size*.12,size*.8);ctx.lineTo(size*.4,size);ctx.lineTo(0,size*.8);ctx.lineTo(-size*.4,size);ctx.lineTo(-size*.12,size*.8);ctx.lineTo(-size*.18,size*.25);ctx.lineTo(-size,size*.45);ctx.lineTo(-size,size*.2);ctx.lineTo(-size*.25,-size*.15);ctx.closePath();ctx.fillStyle='#e4edb0';ctx.strokeStyle='#183c41';ctx.lineWidth=1.4;ctx.fill();ctx.stroke();ctx.restore();
  }
  drawMinimap(){
    const c=this.elements.minimap,ctx=c.getContext('2d'),w=c.width,h=c.height,f=this.flight,range=6200,rangeZ=range*h/w;
    ctx.fillStyle='#6ea7a6';ctx.fillRect(0,0,w,h);
    const sourceX=(f.position.x/WORLD_SIZE+.5)*440-range/WORLD_SIZE*220,sourceY=(f.position.z/WORLD_SIZE+.5)*440-rangeZ/WORLD_SIZE*220;
    ctx.drawImage(this.mapBackground,sourceX,sourceY,range/WORLD_SIZE*440,rangeZ/WORLD_SIZE*440,0,0,w,h);
    const xy=p=>({x:w/2+(p.x-f.position.x)/range*w,y:h/2+(p.z-f.position.z)/rangeZ*h});
    ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=1;
    for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(i*w/4,0);ctx.lineTo(i*w/4,h);ctx.stroke();}
    for(const a of AIRPORTS){
      const p=xy(a);if(p.x<-20||p.x>w+20||p.y<-20||p.y>h+20)continue;
      ctx.fillStyle=this.state.branches[a.id]?'#e69761':'#fff1cf';ctx.beginPath();ctx.arc(p.x,p.y,this.state.branches[a.id]?4:3,0,Math.PI*2);ctx.fill();ctx.font='9px sans-serif';ctx.fillStyle='#254641';ctx.fillText(a.id==='hq'?'HQ':a.name,p.x+6,p.y+3);
    }
    const t=xy(missionTarget(this.state));ctx.setLineDash([4,3]);ctx.strokeStyle='#e9dbac';ctx.beginPath();ctx.moveTo(w/2,h/2);ctx.lineTo(t.x,t.y);ctx.stroke();ctx.setLineDash([]);
    if(this.state.mission?.orders){
      ctx.setLineDash([4,3]);ctx.strokeStyle='#edcb96';ctx.beginPath();ctx.moveTo(w/2,h/2);
      for(const id of this.state.mission.stopOrder){const q=xy(airportById(id));ctx.lineTo(q.x,q.y);}ctx.stroke();ctx.setLineDash([]);
    }
    this.drawPlane(ctx,w/2,h/2,9);ctx.font='bold 10px sans-serif';ctx.fillStyle='#eef2d3';ctx.fillText('N ↑',10,15);
  }
}
