# Skybound Airworks

A low-poly aviation business game. You are the owner and the pilot: start with one Kestrel courier aircraft, fly real delivery routes, and use the earnings to grow your headquarters and fleet.

## Play online

Open **https://hamzehbooks436-commits.github.io/SkyBound/**. Your company saves in your browser, so use Settings to export a save before changing browser or device.

Every push to `main` builds and publishes the game through `.github/workflows/pages.yml`. In the repository's Pages settings, the source is **GitHub Actions**. Vite uses relative asset URLs so models, thumbnails, and scripts load under `/SkyBound/`.

## Start the game

Double-click **Start Skybound.bat** in this folder. It starts the local server and opens **http://127.0.0.1:5273** in your browser.

Alternatively, open a terminal in this folder and run:

```powershell
npm.cmd install
npm.cmd run dev
```

Use Node.js 20.19 or later in the 20 series, or Node.js 22.12 or later. Open the local URL in a browser with WebGL enabled. The game uses local assets and local browser saves; it needs no account or API key. Opening `index.html` directly from the filesystem does not start the module server.

## Your first delivery

1. Name your company and open the dispatch board.
2. Accept a small delivery to **Willow Creek**. You begin with one aircraft, a dispatch office, a hangar, four land parcels, and **$14,000**.
3. Wait for the ground crew to finish loading, then increase throttle to 100% with **Shift**, **R**, or the throttle slider. Keep the aircraft straight, and gently hold **S / ↓** at about 105 km/h to take off.
4. Steer towards the destination marker. **A / D** bank, **W / S** change pitch, and **Z / X** steer the rudder. **G** retracts the flaps for cruise.
5. Line up with the destination runway. Extend the flaps, reduce throttle, and descend gently with level wings.
6. After landing, set throttle to zero and hold **B** to brake. Press **E** when parked, then wait for unloading to finish and receive payment.
7. Continue to your next manifest stop, collect return freight at the local counter, or fly back to headquarters. Refuel and repair when necessary.

The **Flight guide** inside the game explains all controls. The management panels pause flight, and primary controls stay within the window. Touch controls and basic gamepad controls are included.

## Grow the company

- **Fleet:** ten flyable aircraft, each with its own model, performance, capacity, equipment, price, and unlock requirements. Buy, select, service, and sell aircraft. The starter is included with your company; additional couriers must be purchased.
- **Headquarters:** a physical 6 × 4 site plan. Buy adjoining parcels, build aircraft stands and hangars, add specialist facilities, and expand the runway through three levels. Aircraft parking capacity constrains fleet purchases.
- **Business:** fuel costs, repairs, daily overhead, reputation, contract quality, larger payloads, and a transaction ledger. Cargo warehouses unlock bulk logistics; specialist facilities unlock their aircraft. Fuel, maintenance, solar, and control-tower investments provide economic benefits.
- **Persistence:** automatic saves every twenty seconds, including your flight position and active mission. Export and import a company save through Settings. Crash recovery returns your aircraft to headquarters with a repair bill and reputation loss.

## Seven kinds of work

Cargo contracts can now share one flight. The specialist operations below remain individual missions.

| Operation | Aircraft | What you fly |
| --- | --- | --- |
| Cargo | Kestrel C1, Heron C12, Albatross C40 | Load at HQ, manually fly to the destination, land, and unload. Larger aircraft handle larger contracts. |
| Medical | Lifeline M7 | Land to collect a remote patient, then transport them to Meridian City hospital. |
| Agriculture | Fieldfinch A4 | Fly 8–70 m above marked field sections and hold Space to spray. Return to HQ to reload the hopper if needed. |
| Tours & charters | Sandpiper T3, Cloudswift T20 | Fly five scenic gates and return your passengers to HQ. Smooth flying preserves quality; the airliner carries larger charter groups. |
| Surveying | Merlin S2 | Fly five mapping gates at their displayed altitudes and return to HQ. |
| Firefighting | Pelican F9 | Drop water over four wildfire zones from 20–180 m AGL. Refill at HQ or skim open water between 2 and 14 m AGL, below 342 km/h, without dropping. |
| Rescue | Osprey R6 helicopter | Hover 5–50 m above the rescue beacon below 43 km/h, hold E to winch for eight seconds, and deliver the group to the hospital. |

ASL means altitude above sea level. AGL means height above the ground beneath you. The helicopter hovers near 52% throttle; higher throttle climbs and lower throttle descends. Hold S / ↓ to move forwards.

## The region

A **44 × 44 km** operating region with twenty airfields, mountain ridges, snowy research outposts, tropical islands, farms and orchards, desert settlements and canyons, towns, cities, coastal ports, volcanic terrain, and wetlands. The atlas, minimap, compass, terrain, airport positions, and mission targets share the same coordinates.

All routes are flown by the player. Optional 2× / 4× cruise becomes available above 250 m AGL and returns to normal speed near the ground. Three cameras provide chase, cockpit, and orbit views. Weather changes across company days, and the lighting follows the company clock.

## Regional expansion

- **Branch airports — Network / key 5:** discover an airfield, then purchase its branch while parked there or at HQ. Each branch starts with a dispatch office, one stand, two owned parcels, and a six-parcel site. Buy adjoining land and choose hangars, fuel storage, a freight store, a workshop, or a terminal. Branches have daily overhead; their existing runway lengths constrain aircraft purchases. They generate local cargo departures, and terminals add scenic tours.
- **Local fleets:** buy and select aircraft at owned bases. Aircraft remain at the airport where they are parked; selecting a different aircraft requires it to be at your current airport. After physically flying an aircraft to another owned base, use **Base this aircraft here** in Fleet to relocate it for $750, provided the destination has an available parking allocation.
- **Cargo manifests — Contracts / key 1:** press **+** beside up to six cargo orders from one collection airport. Move orders up or down to choose the route, review combined payload, delivery distance, return distance, and estimated fuel with a 20% reserve. Orders to the same airport unload together. Press E when parked at each stop; each completed delivery pays once, reduces onboard weight, and updates that settlement. Remaining stops can be reordered in the active briefing. Discovered airports offer return freight to company bases.
- **Fuel and payload:** extra fuel above half-tank uses cargo allowance. The dispatch planner includes a fuel-load slider; adding fuel is charged at the local rate, while offloaded fuel receives no refund. Cargo weight and fuel load affect flight performance. Route estimates are planning guidance and do not account for every wind condition or detour.
- **Community report — Network:** nineteen settlements track population, food, clinic supplies, construction materials, deliveries, and development. Stocks decline each company day, with higher consumption at island and remote bases. Food, medicine, and construction stocks support gradual population growth; critical shortages cause population decline. Deliveries advance three development levels, increase order sizes, and add buildings to the settlement. Low supplies generate urgent orders with higher rewards. Freight stores unlock larger shipments matching the community's needs.
- **Aircraft workshop — Fleet / key 2:** install long-range tanks, a performance engine, freight conversion on cargo aircraft, or rugged landing gear. Each upgrade belongs to one aircraft, costs company funds, and has explicit performance or operating-cost tradeoffs. Installing requires that airframe to be parked at your current company base with a hangar or maintenance shop.
- **Living airports:** animated ground crew and baggage carts load and unload cargo; passengers board and disembark on tour operations; fuel trucks approach during ground service. Loading, unloading, and active-aircraft service hold the aircraft parked until the operation ends. Nearby regional aircraft approach, taxi, park, and depart; decorative traffic yields while the player occupies the runway. Activity is limited to the nearby airport. Management panels pause these operations along with flight.
- **Existing saves:** branches, supplies, development, individual aircraft upgrades and locations, manifest payments, stop order, pending loading/unloading, and active ground service are included in version 1 company saves. Older saves receive defaults for the added systems, and existing missions keep their original mission structure.

## Original Blender asset library

**73 original models** were authored and exported through live Blender MCP. The original kit has ten aircraft, fifteen headquarters assets, and forty scenery, settlement, vehicle, and prop assets, with 1,061 mesh objects and 10,746 vertices. The regional expansion adds eight models with 140 meshes and 13,240 vertices: a terminal, outpost hangar, fuel depot, freight store, branch sign, ground crew, passenger, and baggage cart. Crew and passenger models include limb pivots for game animation. Aircraft market images were also rendered in Blender.

- `art/skybound-models.blend` — editable Blender asset studio.
- `art/skybound-expansion.blend` — editable regional expansion studio, saved through live Blender MCP.
- `art/model-library.png` — asset library illustration.
- `public/models/manifest.json` — inventory of every exported model.
- `public/models/*.glb` — individual models used by the game.
- `public/thumbnails/*.png` — ten aircraft thumbnails.
- `tools/create_models.py` — reproducible authoring functions, intended to run inside Blender via Blender MCP. Load the script, then call `build_aircraft()`, `build_facilities()`, `build_environment()`, and `finish()` in order.
- `tools/render_thumbnails.py` — Blender thumbnail authoring script.
- `tools/create_expansion_models.py` — regional asset authoring script, executed inside Blender through Blender MCP. It exports the eight models and appends their inventory to the existing manifest. Run this after recreating the original kit.

World scenery uses instancing, airport surfaces are merged, and nearby obstacle queries use a spatial grid. Graphics quality is adjustable in Settings.

## Verification status

The original Blender exports and renders were inspected. The eight new models were exported through live Blender MCP, and the facilities and ground crew were visually inspected in Blender. Source changes were reviewed by reading the files. **No game tests, syntax checks, production builds, browser previews, or gameplay checks were run**, following the existing requested no-testing constraint. The expanded game, save migration, flight balance, airport activity, and responsive panel layouts remain unverified at runtime.
