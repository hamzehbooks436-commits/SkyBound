import { AIRPORTS, ISLANDS, WORLD_SIZE, clamp, lerp } from './data.js';

export const GRID = 256;
export const CELL = WORLD_SIZE / GRID;
const HALF = WORLD_SIZE / 2;
export function coastline(z) { return 3800 + Math.sin(z / 3200) * 550 + Math.sin(z / 1200) * 180; }
function gaussian(x,z,cx,cz,r,h) { return h*Math.exp(-((x-cx)**2+(z-cz)**2)/(r*r)); }
function rawHeight(x,z) {
  const coast=coastline(z);
  let h=-45;
  if(x<coast) {
    const shore=clamp((coast-x)/1300,0,1);
    let base=68+Math.sin(x/1600)*32+Math.sin(z/1300)*28+Math.sin((x+z)/700)*18;
    base+=gaussian(x,z,-7200,-12500,4300,1250)+gaussian(x,z,-4300,-10700,1400,900)+gaussian(x,z,-10000,-15600,1800,1400);
    base+=gaussian(x,z,-13200,-4800,4900,260)+gaussian(x,z,-17500,1500,2700,280);
    base+=gaussian(x,z,-16500,14000,3800,180);
    if(x<-9500 && z<4500 && z>-10500) base+=Math.max(0,Math.sin(x/670)*Math.cos(z/830))*120;
    h=lerp(-15,base,shore);
  }
  for(const island of ISLANDS) {
    const d=((x-island.x)/island.rx)**2+((z-island.z)/island.rz)**2;
    if(d<1.35) {
      let ih=(1-d)*island.height;
      if(island.x===15600) ih+=gaussian(x,z,island.x-500,island.z-1000,1000,800);
      h=Math.max(h,ih);
    }
  }
  for(const a of AIRPORTS) {
    const d=Math.hypot(x-a.x,z-a.z);
    const flat=a.length*.56+240;
    if(d<flat+360) h=lerp(a.elevation,h,clamp((d-flat)/360,0,1));
  }
  return h;
}
export const heights=new Float32Array((GRID+1)*(GRID+1));
for(let j=0;j<=GRID;j++) for(let i=0;i<=GRID;i++) heights[j*(GRID+1)+i]=rawHeight(-HALF+i*CELL,-HALF+j*CELL);

export function heightAt(x,z) {
  const fx=clamp((x+HALF)/CELL,0,GRID-.00001),fz=clamp((z+HALF)/CELL,0,GRID-.00001);
  const i=Math.floor(fx),j=Math.floor(fz),tx=fx-i,tz=fz-j,k=j*(GRID+1)+i;
  // Same diagonal as the terrain mesh, so ground contact agrees with the visible surface.
  if(tx+tz<=1) return heights[k]+tx*(heights[k+1]-heights[k])+tz*(heights[k+GRID+1]-heights[k]);
  return heights[k+GRID+2]+(1-tx)*(heights[k+GRID+1]-heights[k+GRID+2])+(1-tz)*(heights[k+1]-heights[k+GRID+2]);
}
export function biomeAt(x,z,h=heightAt(x,z)) {
  if(h<0) return 'ocean';
  if(x>5000) return z<-10000?'volcanic':'tropical';
  if(h>1500 || z<-15000) return 'snow';
  if(z<-7200 && x<-2500) return 'mountain';
  if(x<-9700 && z<5100) return 'desert';
  if(z>11000 && x>0) return 'swamp';
  if(z>500 && x<-6000) return 'farm';
  if(x>coastline(z)-2000) return 'coast';
  return 'grass';
}
export const BIOME_COLORS={ ocean:'#61a9b2',grass:'#93ad7d',farm:'#b6ba7a',desert:'#d7b180',mountain:'#809689',snow:'#dce7df',tropical:'#a7bf88',coast:'#b9c590',swamp:'#789b83',volcanic:'#8b9382' };

export function runwayLocal(a,x,z) {
  const dx=x-a.x,dz=z-a.z,c=Math.cos(a.heading),s=Math.sin(a.heading);
  return { x:dx*c-dz*s,z:dx*s+dz*c };
}
export function nearestAirport(x,z) {
  let best=null,dist=Infinity;
  for(const a of AIRPORTS) { const d=Math.hypot(x-a.x,z-a.z); if(d<dist){best=a;dist=d;} }
  return { airport:best,distance:dist };
}
export function onRunway(x,z,state) {
  for(const a of AIRPORTS) {
    const p=runwayLocal(a,x,z);
    const length=a.id==='hq'?([800,1250,1850][state.runway-1]):a.length;
    if(Math.abs(p.x)<(a.type==='city'?32:23) && Math.abs(p.z)<length/2+35) return a;
  }
  return null;
}
