// Each finger owns its input until release, cancellation, or a pause.
export function bindTouchControls(root, controls, startAudio, enabled) {
  const coarse=matchMedia('(any-pointer: coarse)');
  const show=()=>root.classList.toggle('touch-device',coarse.matches||navigator.maxTouchPoints>0);
  show();coarse.addEventListener('change',show);
  const held=new Map(),stick=root.querySelector('#flight-stick');
  let stickPointer=null,geometry=null;
  const sync=()=>{
    for(const key of ['rudder','brake','action','interact']){
      const values=[...held.values()].filter(v=>v.key===key).map(v=>v.value);
      controls.touch[key]=key==='rudder'?Math.max(-1,Math.min(1,values.reduce((a,b)=>a+b,0))):values.some(Boolean);
    }
    for(const button of root.querySelectorAll('[data-touch]'))button.classList.toggle('pressed',[...held.values()].some(v=>v.button===button));
  };
  for(const button of root.querySelectorAll('[data-touch]')){
    const [key,raw]=button.dataset.touch.split(':'),value=raw==='true'?true:Number(raw);
    button.addEventListener('pointerdown',e=>{
      if(!enabled()||(e.pointerType==='mouse'&&e.button!==0))return;
      e.preventDefault();startAudio();button.setPointerCapture(e.pointerId);
      const wasInteracting=controls.touch.interact;
      held.set(e.pointerId,{key,value,button});sync();
      if(key==='interact'&&!wasInteracting)controls.pressed.add('TouchInteract');
    });
    const release=e=>{if(held.get(e.pointerId)?.button!==button)return;held.delete(e.pointerId);sync();};
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);
  }
  const center=()=>{
    stickPointer=null;geometry=null;controls.touch.pitch=0;controls.touch.bank=0;
    stick.classList.remove('pressed');stick.style.setProperty('--stick-x','0px');stick.style.setProperty('--stick-y','0px');
  };
  const move=e=>{
    if(e.pointerId!==stickPointer)return;
    e.preventDefault();
    let x=(e.clientX-geometry.x)/geometry.radius,y=(e.clientY-geometry.y)/geometry.radius;
    const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}
    const axis=v=>Math.abs(v)<.1?0:Math.sign(v)*(Math.abs(v)-.1)/.9;
    controls.touch.bank=axis(x);controls.touch.pitch=-axis(y);
    stick.style.setProperty('--stick-x',`${x*geometry.radius}px`);stick.style.setProperty('--stick-y',`${y*geometry.radius}px`);
  };
  stick.addEventListener('pointerdown',e=>{
    if(!enabled()||stickPointer!==null||(e.pointerType==='mouse'&&e.button!==0))return;
    e.preventDefault();startAudio();
    const rect=stick.getBoundingClientRect();geometry={x:rect.left+rect.width/2,y:rect.top+rect.height/2,radius:rect.width*.32};
    stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);stick.classList.add('pressed');move(e);
  });
  stick.addEventListener('pointermove',move);
  for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,e=>{if(e.pointerId===stickPointer)center();});
  const ranges=[...root.querySelectorAll('#throttle, #touch-throttle')];
  for(const range of ranges){
    const adjust=e=>{
      if(range.dataset.adjusting!==String(e.pointerId))return;
      e.preventDefault();
      const rect=range.getBoundingClientRect(),min=Number(range.min),max=Number(range.max);
      const fraction=Math.max(0,Math.min(1,(e.clientX-rect.left-8)/Math.max(1,rect.width-16)));
      range.value=String(Math.round(min+fraction*(max-min)));
      range.dispatchEvent(new Event('input',{bubbles:true}));
    };
    range.addEventListener('pointerdown',e=>{
      if(!enabled()||range.dataset.adjusting!==undefined||(e.pointerType==='mouse'&&e.button!==0))return;
      e.preventDefault();startAudio();range.dataset.adjusting=String(e.pointerId);range.setPointerCapture(e.pointerId);adjust(e);
    });
    range.addEventListener('pointermove',adjust);
    const release=e=>{if(range.dataset.adjusting===String(e.pointerId))delete range.dataset.adjusting;};
    for(const event of ['pointerup','pointercancel','lostpointercapture'])range.addEventListener(event,release);
    range.addEventListener('blur',()=>delete range.dataset.adjusting);
  }
  // Range inputs do not consistently capture their pointer on older Safari.
  for(const event of ['pointerup','pointercancel'])window.addEventListener(event,e=>{
    for(const range of ranges)if(range.dataset.adjusting===String(e.pointerId))delete range.dataset.adjusting;
  });
  controls.onClear.add(()=>{
    const pointers=[...held.entries()].map(([id,v])=>[v.button,id]);
    if(stickPointer!==null)pointers.push([stick,stickPointer]);
    for(const range of ranges)if(range.dataset.adjusting!==undefined)pointers.push([range,Number(range.dataset.adjusting)]);
    held.clear();center();sync();
    for(const range of ranges)delete range.dataset.adjusting;
    for(const [element,id] of pointers)if(element.hasPointerCapture(id))element.releasePointerCapture(id);
  });
  window.addEventListener('resize',()=>controls.clear());
  window.addEventListener('pagehide',()=>controls.clear());
  // Safari gesture events cover pinch zoom; CSS covers double-tap and selection.
  for(const event of ['gesturestart','gesturechange','gestureend'])document.addEventListener(event,e=>e.preventDefault(),{passive:false});
  for(const event of ['touchstart','touchmove'])document.addEventListener(event,e=>{if(e.touches.length>1)e.preventDefault();},{passive:false});
  root.addEventListener('contextmenu',e=>{if(!e.target.closest('input,textarea,[contenteditable="true"]'))e.preventDefault();});
}
