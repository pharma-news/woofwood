'use strict';
/* ===== сенсорное управление: джойстик, кнопки, тап-прицел ===== */
var TOUCH={on:false,touch:false,vx:0,vy:0,run:false,aim:null,aimT:0};
var _joyId=null,_joyCx=0,_joyCy=0,_aimId=null;

function touchSupported(){
  if('ontouchstart' in window)return true;
  if(navigator.maxTouchPoints>0)return true;
  try{return matchMedia('(pointer: coarse)').matches;}catch(e){return false;}
}

function touchInit(){
  const ui=$('touchUI');
  if(!ui)return;
  const joy=$('joy'),knob=$('joyKnob'),fire=$('tbFire'),mark=$('aimMark');
  TOUCH.touch=touchSupported();
  TOUCH.on=TOUCH.touch;

  const cm=$('ctrlMob');
  if(cm&&TOUCH.on)cm.hidden=false;

  const tb=$('touchBtn');
  if(tb){
    tb.textContent='СЕНСОР: '+(TOUCH.on?'ВКЛ':'ВЫКЛ');
    tb.onclick=e=>{
      e.currentTarget.blur();
      TOUCH.on=!TOUCH.on;
      tb.textContent='СЕНСОР: '+(TOUCH.on?'ВКЛ':'ВЫКЛ');
      cm&&!TOUCH.touch&&(cm.hidden=!TOUCH.on);
      if(!TOUCH.on){TOUCH.vx=TOUCH.vy=0;TOUCH.run=false;TOUCH.aim=null;
        if(G)G.mouse.down=false;joy.classList.remove('run');knob.style.transform='';}
      syncTouchUI();
      log(TOUCH.on?'Сенсорное управление включено.':'Сенсорное управление выключено.','8f8d7e');
    };
  }

  /* ---------- джойстик движения ---------- */
  function joyMove(x,y){
    const r=joy.getBoundingClientRect(),rad=Math.max(20,r.width/2-6);
    let dx=x-_joyCx,dy=y-_joyCy,d=Math.hypot(dx,dy);
    if(d>rad){dx=dx/d*rad;dy=dy/d*rad;d=rad;}
    knob.style.transform='translate('+dx.toFixed(1)+'px,'+dy.toFixed(1)+'px)';
    TOUCH.vx=dx/rad;TOUCH.vy=dy/rad;
    TOUCH.run=d>rad*.82;
    joy.classList.toggle('run',TOUCH.run);
  }
  function joyStop(){
    _joyId=null;TOUCH.vx=TOUCH.vy=0;TOUCH.run=false;
    knob.style.transform='';joy.classList.remove('run');
  }
  joy.addEventListener('pointerdown',e=>{
    e.preventDefault();
    const r=joy.getBoundingClientRect();
    _joyCx=r.left+r.width/2;_joyCy=r.top+r.height/2;_joyId=e.pointerId;
    joyMove(e.clientX,e.clientY);
  });
  joy.addEventListener('pointermove',e=>{
    if(_joyId===e.pointerId)joyMove(e.clientX,e.clientY);
  });
  const joyUp=e=>{if(_joyId===e.pointerId)joyStop();};
  joy.addEventListener('pointerup',joyUp);
  joy.addEventListener('pointercancel',joyUp);
  joy.addEventListener('mouseleave',joyUp);

  /* ---------- кнопка атаки (держать) ---------- */
  const setFire=on=>{
    fire.classList.toggle('down',on);
    if(G&&G.state==='play'&&!G.paused)G.mouse.down=on;
  };
  fire.addEventListener('pointerdown',e=>{e.preventDefault();setFire(true);});
  fire.addEventListener('pointerup',()=>setFire(false));
  fire.addEventListener('pointercancel',()=>setFire(false));
  fire.addEventListener('mouseleave',()=>setFire(false));

  /* ---------- тап по экрану: прицел + атака ---------- */
  function aimTo(x,y){
    if(!G)return;
    G.mouse.x=x;G.mouse.y=y;
    TOUCH.aim={x:x,y:y};TOUCH.aimT=Date.now();
    if(mark){mark.style.left=x+'px';mark.style.top=y+'px';mark.classList.remove('hidden');}
  }
  cv.addEventListener('pointerdown',e=>{
    if(!TOUCH.on||!G||G.state!=='play'||G.paused)return;
    e.preventDefault();
    _aimId=e.pointerId;aimTo(e.clientX,e.clientY);G.mouse.down=true;
  });
  cv.addEventListener('pointermove',e=>{
    if(_aimId===e.pointerId)aimTo(e.clientX,e.clientY);
  });
  const aimUp=e=>{
    if(_aimId===e.pointerId){_aimId=null;if(G)G.mouse.down=false;if(mark)mark.classList.add('hidden');}
  };
  cv.addEventListener('pointerup',aimUp);
  cv.addEventListener('pointercancel',aimUp);
  cv.addEventListener('touchcancel',aimUp);

  /* ---------- кнопки действий ---------- */
  const tap=(id,fn)=>{
    const b=$(id);if(!b)return;
    b.addEventListener('pointerdown',e=>{e.preventDefault();b.classList.add('down');fn();});
    b.addEventListener('pointerup',()=>b.classList.remove('down'));
    b.addEventListener('pointercancel',()=>b.classList.remove('down'));
  };
  const hold=(id,on,off)=>{
    const b=$(id);if(!b)return;
    b.addEventListener('pointerdown',e=>{e.preventDefault();b.classList.add('down');on();});
    b.addEventListener('pointerup',()=>{b.classList.remove('down');off();});
    b.addEventListener('pointercancel',()=>{b.classList.remove('down');off();});
  };
  hold('tbE',()=>{
    if(!G||G.ui.menu)return;
    if(G.ui.panel)closePanel();else G.eHeld=true;
  },()=>{
    if(!G)return;
    G.eHeld=false;G.prog=0;G.progKey=null;
    if(UI.el.prog)UI.el.prog.classList.add('hidden');
  });
  tap('tbH',()=>{if(G&&!G.paused)quickHeal();});
  tap('tbF',()=>{if(G&&!G.paused)toggleFlash();});
  tap('tbC',()=>{if(G&&!G.paused){G.p.crouch=!G.p.crouch;
    log(G.p.crouch?'Крадёмся: тихо, но медленно.':'Идём обычным шагом.','8f8d7e');}});
  tap('tbR',()=>{if(G&&!G.paused)startReload();});
  tap('tbBag',()=>{if(!G)return;
    if(G.ui.menu)closeMenu();else if(G.ui.panel)closePanel();else openInv();});
  tap('tbMenu',()=>{if(!G)return;
    if(G.ui.panel)closePanel();else if(G.ui.menu)closeMenu();else openMenu();});

  syncTouchUI();
  if(TOUCH.on)log('Сенсорное управление: слева — джойстик (до упора — бег), справа — кнопки. Тап по экрану — прицел и атака.','8aa06b');
}

function syncTouchUI(){
  const ui=$('touchUI');if(!ui)return;
  const vis=TOUCH.on&&G&&G.state==='play'&&!(G.ui&&(G.ui.panel||G.ui.menu));
  ui.classList.toggle('hidden',!vis);
}

/* вектор движения с джойстика: {x,y} или null */
function touchVec(){
  if(!TOUCH.on)return null;
  if(!TOUCH.vx&&!TOUCH.vy)return null;
  return {x:TOUCH.vx,y:TOUCH.vy};
}
