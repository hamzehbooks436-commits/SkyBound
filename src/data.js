export const WORLD_SIZE = 44000;
export const SEA_LEVEL = 0;
export const SAVE_KEY = 'skybound.airworks.v1';
export const MISSION_PAY_FACTOR = 0.6;
export function applyMissionPay(contract) {
  const previousFactor=Number.isFinite(contract.rewardScale)&&contract.rewardScale>0?contract.rewardScale:1;
  contract.reward=Math.round(contract.reward*MISSION_PAY_FACTOR/previousFactor);
  contract.rewardScale=MISSION_PAY_FACTOR;
  return contract;
}
export const MONEY = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const cash = value => MONEY.format(value);
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const lerp = (a, b, t) => a + (b - a) * t;
export function rng(seed) {
  let n = seed >>> 0;
  return () => { n = Math.imul(n ^ n >>> 15, 1 | n); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}

export const AIRCRAFT = [
  { id: 'courier', model: 'courier_starter', name: 'Kestrel C1', role: 'Bush courier', category: 'cargo', price: 18500, rep: 0, facility: null, runway: 1, capacity: 280, cruise: 75, stall: 23, acceleration: 8.5, turn: .82, climb: 15, fuel: 90, burn: .043, span: 10.5, description: 'Your first aircraft. Forgiving handling, rugged wheels, and enough room for a small but important delivery.', colors: ['#256e74','#f3ecd9'], seats: 2 },
  { id: 'twin', model: 'courier_twin', name: 'Heron C12', role: 'Regional freight', category: 'cargo', price: 32000, rep: 8, facility: 'warehouse', runway: 1, capacity: 1400, cruise: 115, stall: 31, acceleration: 9, turn: .57, climb: 18, fuel: 230, burn: .09, span: 16, description: 'Twin engines, five times the payload, and the range to connect the whole region.', colors: ['#558fb5','#f3ecd9'], seats: 6 },
  { id: 'medical', model: 'medical_turboprop', name: 'Lifeline M7', role: 'Air ambulance', category: 'medical', price: 46000, rep: 15, facility: 'medical', runway: 1, capacity: 500, cruise: 125, stall: 28, acceleration: 10, turn: .65, climb: 24, fuel: 220, burn: .085, span: 14, description: 'A dedicated medical cabin for urgent patient transfers between remote airfields and city hospitals.', colors: ['#ca5346','#f3ecd9'], seats: 4 },
  { id: 'duster', model: 'agricultural_duster', name: 'Fieldfinch A4', role: 'Agricultural aviation', category: 'agriculture', price: 28000, rep: 10, facility: 'agriculture', runway: 1, capacity: 650, cruise: 78, stall: 20, acceleration: 9, turn: .92, climb: 15, fuel: 125, burn: .053, span: 12.5, description: 'A nimble low-flying specialist with a chemical hopper and a full-width spray boom.', colors: ['#efc456','#183c41'], seats: 1 },
  { id: 'float', model: 'tour_floatplane', name: 'Sandpiper T3', role: 'Island sightseeing', category: 'tour', price: 39000, rep: 12, facility: 'terminal', runway: 1, capacity: 360, cruise: 85, stall: 24, acceleration: 8, turn: .76, climb: 15, fuel: 150, burn: .06, span: 13.5, amphibious: true, description: 'Panoramic windows, twin floats, and unforgettable journeys above coral lagoons and mountain valleys.', colors: ['#ec8851','#f3ecd9'], seats: 5 },
  { id: 'survey', model: 'survey_scout', name: 'Merlin S2', role: 'Aerial surveying', category: 'survey', price: 35000, rep: 12, facility: 'radar', runway: 1, capacity: 300, cruise: 105, stall: 23, acceleration: 9, turn: .8, climb: 27, fuel: 175, burn: .062, span: 11.8, description: 'A belly-mounted mapping camera and a strong climb rate for surveys above the wilderness.', colors: ['#8c7ca5','#f3ecd9'], seats: 2 },
  { id: 'fire', model: 'fire_waterbomber', name: 'Pelican F9', role: 'Wildfire response', category: 'fire', price: 74000, rep: 22, facility: 'fire', runway: 2, capacity: 3600, cruise: 105, stall: 33, acceleration: 7, turn: .47, climb: 17, fuel: 340, burn: .125, span: 22, amphibious: true, description: 'A purpose-built amphibious water bomber. Drop water over wildfires and refill by skimming the sea.', colors: ['#efc456','#ca5346'], seats: 3 },
  { id: 'helicopter', model: 'rescue_helicopter', name: 'Osprey R6', role: 'Wilderness rescue', category: 'rescue', price: 68000, rep: 20, facility: 'helipad', runway: 1, capacity: 400, cruise: 72, stall: 0, acceleration: 11, turn: 1.25, climb: 22, fuel: 190, burn: .094, span: 9.5, helicopter: true, description: 'Hover over a stranded group, lower the rescue winch, and carry them to the hospital.', colors: ['#ec8851','#f3ecd9'], seats: 6 },
  { id: 'freighter', model: 'heavy_freighter', name: 'Albatross C40', role: 'Heavy logistics', category: 'cargo', price: 155000, rep: 42, facility: 'warehouse', runway: 3, capacity: 6500, cruise: 160, stall: 43, acceleration: 6.5, turn: .35, climb: 20, fuel: 680, burn: .24, span: 29, description: 'Four engines and a cavernous hold for the region’s largest industrial supply contracts.', colors: ['#256e74','#f3ecd9'], seats: 8 },
  { id: 'airliner', model: 'tour_airliner', name: 'Cloudswift T20', role: 'Charter & grand tours', category: 'tour', price: 130000, rep: 36, facility: 'terminal', runway: 3, capacity: 2200, cruise: 150, stall: 39, acceleration: 7, turn: .4, climb: 23, fuel: 510, burn: .18, span: 25, description: 'Bring twenty passengers on long scenic charters. Larger groups mean larger contracts.', colors: ['#558fb5','#f3ecd9'], seats: 20 },
];
export const planeById = id => AIRCRAFT.find(a => a.id === id) || AIRCRAFT[0];
export const CATEGORIES = {
  cargo: { name: 'Cargo delivery', icon: 'package', color: '#dd985b', action: 'Land at the destination. Park and press E to unload.' },
  medical: { name: 'Medical transfer', icon: 'medical', color: '#e08b82', action: 'Pick up the patient, then fly them to the hospital.' },
  fire: { name: 'Wildfire response', icon: 'fire', color: '#e9a867', action: 'Fly 20–180 m above the fires and hold Space to drop water.' },
  agriculture: { name: 'Crop treatment', icon: 'leaf', color: '#9dab67', action: 'Fly 8–70 m above the marked field and hold Space to spray.' },
  tour: { name: 'Scenic tour', icon: 'sun', color: '#e4bd63', action: 'Fly through the scenic gates, then return and unload your passengers.' },
  survey: { name: 'Aerial survey', icon: 'scan', color: '#b19bc9', action: 'Fly through each mapping gate at the displayed altitude, then return.' },
  rescue: { name: 'Search & rescue', icon: 'rescue', color: '#87b9c5', action: 'Hover 5–50 m over the beacon. Hold E to winch, then land at the hospital.' },
};

export const AIRPORTS = [
  { id: 'hq', name: 'Airworks Headquarters', region: 'Greenheart Valley', biome: 'grass', x: -2400, z: 3200, elevation: 65, length: 800, heading: 0, type: 'headquarters', color: '#8da874', population: 0 },
  { id: 'willow', name: 'Willow Creek', region: 'Greenheart Valley', biome: 'grass', x: -3200, z: 0, elevation: 70, length: 650, heading: .15, type: 'town', color: '#8da874', population: 2300 },
  { id: 'meadow', name: 'Meadowfield', region: 'Harvest Plains', biome: 'farm', x: -7300, z: 4700, elevation: 100, length: 700, heading: -.3, type: 'farm', color: '#b6bf7a', population: 850 },
  { id: 'port', name: 'Port Azure', region: 'Azure Coast', biome: 'coast', x: 1300, z: 5400, elevation: 30, length: 1000, heading: .4, type: 'port', color: '#83b2a0', population: 14800 },
  { id: 'city', name: 'Meridian City', region: 'Meridian District', biome: 'grass', x: -1300, z: -4400, elevation: 65, length: 1600, heading: 0, type: 'city', color: '#85a092', population: 245000 },
  { id: 'ridge', name: 'Pinecrest Ridge', region: 'Highland Range', biome: 'mountain', x: -4900, z: -8200, elevation: 720, length: 850, heading: -.3, type: 'mountain', color: '#7a998c', population: 1800 },
  { id: 'alpine', name: 'Alpine Reach', region: 'Highland Range', biome: 'snow', x: -8700, z: -13200, elevation: 1100, length: 950, heading: .5, type: 'mountain', color: '#c2d7d1', population: 1200 },
  { id: 'aurora', name: 'Aurora Station', region: 'Northern Wilderness', biome: 'snow', x: -14400, z: -16400, elevation: 850, length: 1000, heading: .2, type: 'research', color: '#d5e2de', population: 140 },
  { id: 'mesa', name: 'Red Mesa', region: 'Copper Desert', biome: 'desert', x: -11700, z: -1900, elevation: 230, length: 800, heading: .4, type: 'desert', color: '#d6ac76', population: 3100 },
  { id: 'canyon', name: 'Canyon Crossing', region: 'Copper Desert', biome: 'desert', x: -17600, z: 2100, elevation: 300, length: 850, heading: -.2, type: 'desert', color: '#d6ac76', population: 1700 },
  { id: 'copper', name: 'Copper Basin', region: 'Copper Desert', biome: 'desert', x: -13000, z: -7900, elevation: 470, length: 1250, heading: .5, type: 'industry', color: '#c3956e', population: 5200 },
  { id: 'westvale', name: 'Westvale', region: 'Harvest Plains', biome: 'farm', x: -13000, z: 9000, elevation: 125, length: 900, heading: 0, type: 'farm', color: '#b4ba72', population: 6700 },
  { id: 'frontier', name: 'Frontier Post', region: 'Western Wilderness', biome: 'grass', x: -17900, z: 14900, elevation: 200, length: 650, heading: .1, type: 'town', color: '#a3ad79', population: 780 },
  { id: 'delta', name: 'Mosswater Delta', region: 'Southern Wetlands', biome: 'swamp', x: 2200, z: 13800, elevation: 22, length: 700, heading: .3, type: 'town', color: '#809d83', population: 2100 },
  { id: 'southport', name: 'Southhaven', region: 'Southern Coast', biome: 'coast', x: -2600, z: 15700, elevation: 45, length: 1300, heading: -.15, type: 'port', color: '#8fb49b', population: 23400 },
  { id: 'northcoast', name: 'Northwatch', region: 'Northern Coast', biome: 'coast', x: 2300, z: -11800, elevation: 75, length: 950, heading: -.4, type: 'town', color: '#a3bdae', population: 4200 },
  { id: 'sunreef', name: 'Sunreef Island', region: 'Sundrift Archipelago', biome: 'tropical', x: 8500, z: 7400, elevation: 16, length: 900, heading: .15, type: 'island', color: '#b5c588', population: 1400 },
  { id: 'coral', name: 'Coral Bay', region: 'Sundrift Archipelago', biome: 'tropical', x: 14500, z: 1900, elevation: 18, length: 1300, heading: -.1, type: 'resort', color: '#b5c588', population: 3900 },
  { id: 'palm', name: 'Palm Key', region: 'Sundrift Archipelago', biome: 'tropical', x: 10500, z: -5700, elevation: 25, length: 700, heading: .4, type: 'island', color: '#b5c588', population: 780 },
  { id: 'volcano', name: 'Ember Island', region: 'Ember Sea', biome: 'volcanic', x: 15600, z: -13100, elevation: 180, length: 950, heading: .15, type: 'research', color: '#8b9b7a', population: 250 },
];
export const airportById = id => AIRPORTS.find(a => a.id === id) || AIRPORTS[0];
export const HQ = AIRPORTS[0];
export const ISLANDS = [
  { x:8500,z:7400,rx:3400,rz:2600,height:180 }, { x:14500,z:1900,rx:3600,rz:2800,height:140 },
  { x:10500,z:-5700,rx:3000,rz:2400,height:260 }, { x:15600,z:-13100,rx:3200,rz:3300,height:850 },
  { x:17500,z:9000,rx:1200,rz:1400,height:90 }, { x:6300,z:-1300,rx:900,rz:1400,height:110 },
  { x:6600,z:16000,rx:1700,rz:1300,height:140 }, { x:17400,z:-4800,rx:1400,rz:1800,height:180 },
];

export const FACILITIES = [
  { id: 'apron', name: 'Aircraft stand', model: 'apron_stand', cost: 6500, rep: 0, description: 'One additional aircraft parking space.', icon: 'plane', max: 8, capacity: 1 },
  { id: 'hangar', name: 'Small hangar', model: 'hangar_small', cost: 12500, rep: 0, description: 'Two protected spaces; lowers aircraft wear.', icon: 'hangar', max: 5, capacity: 2 },
  { id: 'largehangar', name: 'Large hangar', model: 'hangar_large', cost: 29000, rep: 20, description: 'Four spaces, including heavy aircraft.', icon: 'hangar', max: 3, capacity: 4 },
  { id: 'fuel', name: 'Fuel depot', model: 'fuel_depot', cost: 8500, rep: 0, description: 'Reduces your refuelling bill by 25%.', icon: 'fuel', max: 1 },
  { id: 'maintenance', name: 'Maintenance shop', model: 'maintenance_shop', cost: 14000, rep: 5, description: 'Repair for 40% less and reduce wear.', icon: 'tool', max: 1 },
  { id: 'warehouse', name: 'Cargo warehouse', model: 'cargo_warehouse', cost: 11000, rep: 8, description: 'Unlock twin-engine freight and bulk contracts.', icon: 'package', max: 1 },
  { id: 'medical', name: 'Medical station', model: 'medical_station', cost: 16000, rep: 15, description: 'Unlock dedicated patient transfers.', icon: 'medical', max: 1 },
  { id: 'agriculture', name: 'Agricultural store', model: 'agricultural_store', cost: 10500, rep: 10, description: 'Unlock crop dusting and chemical reloads.', icon: 'leaf', max: 1 },
  { id: 'terminal', name: 'Passenger terminal', model: 'tour_terminal', cost: 15500, rep: 12, description: 'Unlock sightseeing and charter aircraft.', icon: 'sun', max: 1 },
  { id: 'radar', name: 'Survey & radar station', model: 'radar_station', cost: 14000, rep: 12, description: 'Unlock aerial mapping aircraft.', icon: 'scan', max: 1 },
  { id: 'fire', name: 'Fire response station', model: 'fire_response_station', cost: 22000, rep: 22, description: 'Unlock water bombers and wildfire contracts.', icon: 'fire', max: 1 },
  { id: 'helipad', name: 'Rescue helipad', model: 'helipad', cost: 17000, rep: 20, description: 'Unlock rescue helicopters; adds one aircraft space.', icon: 'rescue', max: 1, capacity: 1 },
  { id: 'tower', name: 'Control tower', model: 'control_tower', cost: 12000, rep: 8, description: 'Increases all contract rewards by 10%.', icon: 'tower', max: 1 },
  { id: 'solar', name: 'Solar canopy', model: 'solar_canopy', cost: 9000, rep: 5, description: 'Reduces company overhead by 35%.', icon: 'sun', max: 1 },
];
export const facilityById = id => FACILITIES.find(f => f.id === id);
export const RUNWAYS = [
  { level:1,name:'Valley airstrip',length:800,cost:0,rep:0 },
  { level:2,name:'Regional runway',length:1250,cost:19500,rep:18 },
  { level:3,name:'International runway',length:1850,cost:42000,rep:32 },
];
export const LOT_COLS = 6;
export const LOT_ROWS = 4;
export const LOT_SIZE = 48;
export function lotPosition(index) {
  return { x: HQ.x - 90 - (index % LOT_COLS) * LOT_SIZE, z: HQ.z - 30 + Math.floor(index / LOT_COLS) * LOT_SIZE };
}
export const WEATHER = [
  { name:'Clear skies',wind:4,angle:.45,visibility:14000,clouds:.22,color:'#bdddd9' },
  { name:'Coastal breeze',wind:9,angle:1.2,visibility:12500,clouds:.36,color:'#bfd7d7' },
  { name:'Highland haze',wind:6,angle:-.6,visibility:10000,clouds:.5,color:'#c5d8d4' },
  { name:'Broken cloud',wind:12,angle:2.1,visibility:11000,clouds:.62,color:'#bacdd0' },
];
