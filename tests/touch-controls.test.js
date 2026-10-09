import test from 'node:test';
import assert from 'node:assert/strict';
import { bindTouchControls } from '../src/touch-controls.js';
import { Controls } from '../src/flight.js';

class Element extends EventTarget {
  constructor(touch){super();this.dataset=touch?{touch}:{};this.classes=new Set();this.captures=new Set();this.props={};this.classList={toggle:(k,on)=>on?this.classes.add(k):this.classes.delete(k),add:k=>this.classes.add(k),remove:k=>this.classes.delete(k)};this.style={setProperty:(k,v)=>this.props[k]=v};}
  setPointerCapture(id){this.captures.add(id);}
  hasPointerCapture(id){return this.captures.has(id);}
  releasePointerCapture(id){this.captures.delete(id);this.emit('lostpointercapture',id);}
  getBoundingClientRect(){return {left:0,top:0,width:150,height:150};}
  emit(type,id=1,x=75,y=75){const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:id,pointerType:'touch',button:0,clientX:x,clientY:y});this.dispatchEvent(e);return e;}
}
function setup(){
  globalThis.window=new EventTarget();globalThis.document=new EventTarget();globalThis.matchMedia=()=>({matches:true,addEventListener(){}});
  const buttons=['rudder:1','rudder:-1','brake:true','action:true','interact:true'].map(v=>new Element(v));
  const stick=new Element(),range=new Element(),root=new Element();range.min='0';range.max='100';
  root.querySelector=()=>stick;root.querySelectorAll=s=>s==='[data-touch]'?buttons:[range];
  const controls=new Controls();let active=true;
  bindTouchControls(root,controls,()=>{},()=>active);
  return {controls,stick,range,buttons,pause:()=>{active=false;controls.clear();}};
}
test('opposite rudders cancel and releasing one restores the other',()=>{
  const {controls,buttons:[left,right]}=setup();left.emit('pointerdown',1);right.emit('pointerdown',2);
  assert.equal(controls.touch.rudder,0);right.emit('pointerup',2);assert.equal(controls.touch.rudder,1);
  right.emit('lostpointercapture',2);assert.equal(controls.touch.rudder,1);left.emit('pointercancel',1);assert.equal(controls.touch.rudder,0);
});
test('two fingers on one button keep it held until the last release',()=>{
  const {controls,buttons}=setup(),brake=buttons[2];brake.emit('pointerdown',1);brake.emit('pointerdown',2);brake.emit('pointerup',1);
  assert.equal(controls.touch.brake,true);assert.equal(brake.classes.has('pressed'),true);
  brake.emit('lostpointercapture',1);assert.equal(controls.touch.brake,true);brake.emit('pointerup',2);assert.equal(controls.touch.brake,false);
});
test('stick is proportional, bounded, ignores a second finger, and centers on cancel',()=>{
  const {controls,stick}=setup();stick.emit('pointerdown',1,75,75);assert.equal(controls.touch.bank,0);
  stick.emit('pointermove',1,99,51);assert.ok(controls.touch.bank>0&&controls.touch.bank<1);assert.ok(controls.touch.pitch>0&&controls.touch.pitch<1);
  stick.emit('pointerdown',2,0,0);stick.emit('pointerup',2);assert.ok(controls.touch.bank>0);
  stick.emit('pointermove',1,1000,-1000);assert.ok(controls.touch.bank<=1&&controls.touch.pitch<=1);
  stick.emit('pointercancel',1);assert.equal(controls.touch.bank,0);assert.equal(controls.touch.pitch,0);assert.equal(stick.props['--stick-x'],'0px');
});
test('interaction press fires once while held and another press after release',()=>{
  const {controls,buttons}=setup(),interact=buttons[4];interact.emit('pointerdown',1);assert.equal(controls.consume('TouchInteract'),true);
  interact.emit('pointerdown',2);assert.equal(controls.consume('TouchInteract'),false);interact.emit('pointerup',1);assert.equal(controls.touch.interact,true);
  interact.emit('pointerup',2);interact.emit('pointerdown',3);assert.equal(controls.consume('TouchInteract'),true);
});
test('pause clears every input, capture, pressed appearance, and slider drag',()=>{
  const {controls,stick,range,buttons,pause}=setup();stick.emit('pointerdown',1,120,20);buttons[2].emit('pointerdown',2);range.emit('pointerdown',3);
  pause();assert.ok(Object.values(controls.touch).every(v=>!v));assert.equal(stick.captures.size,0);assert.equal(buttons[2].captures.size,0);assert.equal(buttons[2].classes.has('pressed'),false);assert.equal(range.dataset.adjusting,undefined);
  buttons[2].emit('pointerdown',4);assert.equal(controls.touch.brake,false);stick.emit('pointerdown',5,120,20);assert.equal(controls.touch.bank,0);
});
test('resize and lost slider capture clean up inputs',()=>{
  const {controls,range,buttons}=setup();range.emit('pointerdown',3);range.emit('lostpointercapture',3);assert.equal(range.dataset.adjusting,undefined);
  buttons[2].emit('pointerdown',2);window.dispatchEvent(new Event('resize'));assert.equal(controls.touch.brake,false);
});
test('throttle updates directly while another finger flies, ignores unrelated movement',()=>{
  const {controls,range,stick}=setup();stick.emit('pointerdown',1,100,50);range.emit('pointerdown',2,8,75);assert.equal(range.value,'0');
  range.emit('pointermove',2,75,75);assert.equal(range.value,'50');range.emit('pointermove',3,142,75);assert.equal(range.value,'50');
  range.emit('pointermove',2,142,75);assert.equal(range.value,'100');assert.ok(controls.touch.bank>0);controls.clear();assert.equal(range.captures.size,0);
});
