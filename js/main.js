'use strict';
/* ============ главный цикл, ввод, пиксельный рендер ============ */
var G=null,cv,ctx,DPR=1,ZB=4,bcv=null,bctx=null,dark=null,dctx=null,vign=null,grainCv=null,grainPat=null,crtCv=null,crtPat=null,_last=0;

function boot(){
  cv=$('cv');ctx=cv.getContext('2d');
  resize();addEventListener('resize',resize);
  loadHero();
  initUI();initInput();
  if(typeof touchInit==='function')touchInit();
  addEventListener('pointerdown',()=>{if(typeof ensureAudio==='function')ensureAudio();},{once:true});
  $('startBtn').onclick=e=>{
    e.currentTarget.blur();
    if(typeof ensureAudio==='function')ensureAudio();
    if(hasSave()&&!confirm('Начать заново? Прежнее сохранение не пропадёт, пока вы не сохранитесь в новой игре.'))return;
    startGame();
  };
  $('wakeBtn').onclick=wakeUp;
  refreshTitle();
  requestAnimationFrame(frame);
}
function resize(){
  DPR=Math.min(2,window.devicePixelRatio||1);
  cv.width=innerWidth*DPR|0;cv.height=innerHeight*DPR|0;
  ZB=Math.max(3,Math.round(DPR*3));
  if(innerWidth<720)ZB=Math.max(2,Math.round(cv.width/220)); // на телефоне — широкий обзор
  bcv=document.createElement('canvas');
  bcv.width=Math.ceil(cv.width/ZB);bcv.height=Math.ceil(cv.height/ZB);
  bctx=bcv.getContext('2d');
  dark=document.createElement('canvas');
  dark.width=bcv.width;dark.height=bcv.height;dctx=dark.getContext('2d');
  vign=document.createElement('canvas');vign.width=cv.width;vign.height=cv.height;
  const vg=vign.getContext('2d'),r=Math.hypot(cv.width,cv.height)/2;
  const grd=vg.createRadialGradient(cv.width/2,cv.height/2,r*.28,cv.width/2,cv.height/2,r*.78);
  grd.addColorStop(0,'rgba(0,0,0,0)');grd.addColorStop(.58,'rgba(2,4,2,.28)');grd.addColorStop(1,'rgba(1,1,1,.82)');
  vg.fillStyle=grd;vg.fillRect(0,0,cv.width,cv.height);
  grainCv=document.createElement('canvas');grainCv.width=128;grainCv.height=128;
  const gg=grainCv.getContext('2d'),img=gg.createImageData(128,128),gd=img.data;
  for(let i=0;i<gd.length;i+=4){
    const v=(Math.random()*255)|0;
    gd[i]=v;gd[i+1]=v;gd[i+2]=v;gd[i+3]=11;
  }
  gg.putImageData(img,0,0);
  grainPat=ctx.createPattern(grainCv,'repeat');
  // маска кинескопа 90-х: сканлайны + RGB-маска люминофора
  crtCv=document.createElement('canvas');crtCv.width=6;crtCv.height=4;
  const cg=crtCv.getContext('2d');
  cg.fillStyle='rgba(0,0,0,0.30)';cg.fillRect(0,0,6,2);
  cg.fillStyle='rgba(255,40,40,0.035)';cg.fillRect(0,2,2,2);
  cg.fillStyle='rgba(40,255,60,0.035)';cg.fillRect(2,2,2,2);
  cg.fillStyle='rgba(40,80,255,0.035)';cg.fillRect(4,2,2,2);
  crtPat=ctx.createPattern(crtCv,'repeat');
}

function startGame(fromSave){
  sfxInit();
  const data=(fromSave&&fromSave.v===SAVE_V)?fromSave:null;
  buildWorld(data?data.seed:undefined);
  G={state:'play',paused:false,day:1,hours:DAY_START,cam:{x:0,y:0},
    p:null,inv:new Array(24).fill(null),eq:{blade:'knife',gunA:null,gunB:null},
    ws:{fists:{},blade:{},gunA:{mag:0},gunB:{mag:0}},
    enemies:[],bullets:[],parts:[],noises:[],rings:[],
    ui:{con:null,panel:null,cook:false,menu:false},
    stats:{kills:0,looted:0,value:0},upg:{bench:1,stash:1,tent:1,fire:1,doors:{N:1,S:1,E:1,W:1}},
    shake:0,redFlash:0,_exfilDay:0,_feralDay:0,_duskDay:0,_fireT:0,
    _evT:30,_fenceMsg:0,tradeC:0,stash:null,wx:null,
    _visX:-1,_visY:-1,_visL:-1,
    keys:{},mouse:{x:innerWidth/2,y:innerHeight/2,down:false},
    eHeld:false,prog:0,progKey:null};
  takeStash();
  G.p=newPlayer(0,0);
  if(data)applySave(data);
  else{
    addItem('water',2);addItem('beans',2);addItem('bandage',1);addItem('stew',1);
    const q=freeNear((CAMP.x+CAMP.w/2)*TS,(CAMP.y+CAMP.h/2)*TS,7);
    G.p.x=q.x;G.p.y=q.y;
  }
  G.p.r=7;
  initWeather();
  if(World&&G.upg){const fp=World.props.find(q=>q.type==='fire');if(fp)fp.light=BASE_UPG.fire[G.upg.fire].light;for(const s of World.segs){const dlv=(G.upg.doors&&G.upg.doors[s.side])||1;const m=BASE_UPG.door[dlv].maxHp;s.max=m;s.hp=m;}}
  spawnPatrols();
  updVis(true);
  $('title').classList.add('hidden');$('menuPanel').classList.add('hidden');
  $('deadPanel').classList.add('hidden');
  $('hud').classList.remove('hidden');$('topright').classList.remove('hidden');
  $('hotbar').classList.remove('hidden');$('mmWrap').classList.remove('hidden');
  if(data){
    log('День '+G.day+'. Вы вернулись к тому же очагу: лес тот же, что и до сохранения.','97a17f');
    log('Волк: помню каждую тропу. Идём дальше.','b0a888');
  } else {
    log('Утро. Опушка. Лагерь — палатка за забором, схрон в углу.','97a17f');
    log('Еда, вода, хлам. До темноты лучше быть дома: выстрелы слышно по всему урочищу.','8f8d7e');
    log('Волк: ночи голодны. Ищем еду и хлам до темноты.','b0a888');
  }
  renderHUD();
}

// ---------- сохранение и загрузка (localStorage) ----------
const SAVE_KEY='greywood_save_v1',SAVE_V=1;
function b64a(a){let s='';for(let i=0;i<a.length;i+=4096)s+=String.fromCharCode.apply(null,a.subarray(i,i+4096));return btoa(s);}
function unb64a(str){const bin=atob(str),a=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a;}
function hasSave(){
  try{const d=JSON.parse(localStorage.getItem(SAVE_KEY));return !!(d&&d.v===SAVE_V);}catch(e){return false;}
}
function saveInfo(){
  try{const d=JSON.parse(localStorage.getItem(SAVE_KEY));
    if(!d||d.v!==SAVE_V)return null;
    return {day:d.day,hours:d.hours,when:d.when,value:d.value,kills:d.kills,looted:d.looted};
  }catch(e){return null;}
}
function saveGame(quiet){
  if(!G||G.state!=='play')return false;
  const p=G.p;
  const data={v:SAVE_V,when:Date.now(),day:G.day,hours:+G.hours.toFixed(2),seed:World.seed,
    value:G.stats.value,kills:G.stats.kills,looted:G.stats.looted,
    stats:{kills:G.stats.kills,looted:G.stats.looted,value:G.stats.value},tradeC:G.tradeC,upg:G.upg,
    inv:G.inv,eq:G.eq,ws:{blade:G.ws.blade,gunA:G.ws.gunA,gunB:G.ws.gunB,fists:{}},
    p:{x:Math.round(p.x),y:Math.round(p.y),hp:p.hp,hunger:p.hunger,thirst:p.thirst,
      stam:p.stam,bleed:p.bleed,crouch:p.crouch,flashT:p.flashT,cur:p.cur,vigourT:p.vigourT||0},
    stash:G.stash,
    conts:World.conts.map(c=>({x:c.tx,y:c.ty,s:c.searched?1:0,a:+(c.sacc||0).toFixed(2),
      v:c.visited?1:0,
      it:(c.items||[]).map(it=>it?[it.id,it.n,it.known?1:0,(it.cost==null?null:+it.cost.toFixed(2))]:0)})),
    fence:World.segs.map(s=>s.hp),
    placed:World.placed.map(q=>({kind:q.kind,x:Math.round(q.x),y:Math.round(q.y)})),
    exp:b64a(World.explored)};
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(data));
    if(!quiet)log('Сохранено. День '+G.day+', '+fmtTime(G.hours)+'.','8aa06b');
    if(UI.el.saveNote)UI.el.saveNote.textContent='сохранено: день '+G.day+', '+fmtTime(G.hours);
    if(UI.el.loadBtn)UI.el.loadBtn.disabled=false;
    return true;
  }catch(e){if(!quiet)log('Не удалось сохранить: '+e.message,'a06a5a');return false;}
}
function applySave(d){
  G.day=d.day;G.hours=d.hours;
  G.stats=d.stats;G.tradeC=d.tradeC||0;
  G.upg=Object.assign({bench:1,stash:1,tent:1,fire:1,doors:{N:1,S:1,E:1,W:1}},d.upg||{});
  if(World){const fp=World.props.find(q=>q.type==='fire');if(fp)fp.light=BASE_UPG.fire[G.upg.fire].light;}
  G.inv=d.inv.slice();G.eq=d.eq;
  for(const k of['blade','gunA','gunB','fists'])G.ws[k]=(d.ws&&d.ws[k])||{mag:0};
  Object.assign(G.p,d.p);
  const q=freeNear(G.p.x,G.p.y,7);G.p.x=q.x;G.p.y=q.y;
  const st=World.conts.find(c=>c.type==='stash');
  if(st&&d.stash){st.fixed=d.stash.length;st.items=d.stash;st.searched=true;G.stash=st.items;}
  if(d.conts)World.conts.forEach((c,i)=>{
    const s=d.conts[i];
    if(!s||s.x!==c.tx||s.y!==c.ty)return;
    c.searched=!!s.s;c.sacc=s.a;c.visited=!!s.v;
    c.items=s.it.map(it=>it===0?null:{id:it[0],n:it[1],known:!!it[2],cost:it[3]});
    if(c.fixed)c.searched=unknownIdx(c)<0;
  });
  if(World&&G.upg.doors){
    for(const s of World.segs){const dlv=G.upg.doors[s.side]||1;s.max=BASE_UPG.door[dlv].maxHp;}
  }
  if(d.fence)World.segs.forEach((s,i)=>{
    if(d.fence[i]!==undefined)s.hp=clamp(d.fence[i],0,s.max);});
  World.anyBreach=World.segs.some(s=>s.hp<=0);
  World.placed=(d.placed||[]).map(q=>({kind:q.kind,x:q.x,y:q.y,cd:0}));
  if(d.exp)try{World.explored.set(unb64a(d.exp));}catch(e){}
  G._visX=-1;
}
function loadGame(){
  let d=null;
  try{d=JSON.parse(localStorage.getItem(SAVE_KEY));}catch(e){}
  if(!d||d.v!==SAVE_V)return false;
  closeMenu();startGame(d);
  return true;
}
function exitToTitle(){
  saveGame(true);
  closeMenu();
  if(G&&G.ui.panel)closePanel();
  G=null;World=null;
  $('hud').classList.add('hidden');$('topright').classList.add('hidden');
  $('hotbar').classList.add('hidden');$('mmWrap').classList.add('hidden');
  $('hint').classList.add('hidden');$('log').innerHTML='';
  $('title').classList.remove('hidden');
  if(SFX.musicUpdate)SFX.musicUpdate({mode:'title',threat:0,hp:100});
  refreshTitle();
}
function fmtTime(h){return ('0'+(h|0)).slice(-2)+':'+String(Math.floor((h%1)*60)).padStart(2,'0');}

function freeNear(x,y,r){
  if(!collides(x,y,r))return {x,y};
  for(let ring=1;ring<16;ring++)
    for(let a=0;a<24;a++){
      const ang=a/24*6.283;
      const nx=x+Math.cos(ang)*ring*7,ny=y+Math.sin(ang)*ring*7;
      if(nx<8||ny<8||nx>MAPW*TS-8||ny>MAPH*TS-8)continue;
      if(!collides(nx,ny,r))return {x:nx,y:ny};
    }
  return {x,y};
}
function takeStash(){
  const st=World.conts.find(c=>c.type==='stash');
  if(!st)return;
  if(G.stash){st.fixed=G.stash.length;st.items=G.stash;st.searched=true;}
  else G.stash=st.items;
}
function regenWorld(){
  const placedCopy=World.placed.slice();
  buildWorld();
  takeStash();
  let returned=0;
  for(const pl of placedCopy){
    const id=pl.kind==='trap'?'trap':'cans';
    if(addItem(id,1)===0||addItemToStash(id,1)===0)returned++;
  }
  G.enemies=[];G.bullets=[];G.parts=[];G.noises=[];G.rings=[];
  const c=World.camp;
  const q=freeNear((c.x+c.w/2)*TS,(c.y+c.h/2)*TS,7);
  G.p.x=q.x;G.p.y=q.y;G.p.flashOn=false;
  G._visX=-1;
  initWeather();
  spawnPatrols();
  updVis(true);
  return returned;
}

// ---------- ввод ----------
function initInput(){
  addEventListener('keydown',e=>{
    if(!G)return;
    if(e.repeat)return;
    G.keys[e.code]=1;
    if(['KeyE','KeyI','Space','Tab'].includes(e.code))e.preventDefault();
    if(G.state!=='play')return;
    if(e.code==='Tab'||e.code==='KeyI'){
      if(G.ui.menu)closeMenu();
      else if(G.ui.panel)closePanel();
      else openInv();
      return;}
    if(e.code==='Escape'){
      if(G.ui.panel)closePanel();
      else if(G.ui.menu)closeMenu();
      else openMenu();
      return;}
    if(G.ui.menu)return;
    if(e.code==='KeyE'){if(G.ui.panel)closePanel();else G.eHeld=true;}
    if(e.code==='KeyR'&&!G.paused)startReload();
    if(e.code==='KeyF')toggleFlash();
    if(e.code==='KeyM'&&SFX.toggleMute){const on=SFX.toggleMute();log(on?'Звук и музыка включены.':'Звук и музыка отключены.','8f8d7e');}
    if(e.code==='KeyC'&&!G.paused)G.p.crouch=!G.p.crouch;
    if((e.code==='KeyH'||e.code==='KeyQ')&&!G.paused)quickHeal();
    if(e.code==='Digit1')selectW('blade');
    if(e.code==='Digit2')selectW('gunA');
    if(e.code==='Digit3')selectW('gunB');
  });
  addEventListener('keyup',e=>{if(!G)return;G.keys[e.code]=0;
    if(e.code==='KeyE'){G.eHeld=false;G.prog=0;G.progKey=null;UI.el.prog.classList.add('hidden');}});
  addEventListener('mousemove',e=>{if(G){G.mouse.x=e.clientX;G.mouse.y=e.clientY;}});
  cv.addEventListener('mousedown',e=>{if(G&&e.button===0&&G.state==='play')G.mouse.down=true;});
  addEventListener('mouseup',e=>{if(G&&e.button===0)G.mouse.down=false;});
  addEventListener('wheel',e=>{if(G&&G.state==='play'&&!G.paused){
    const order=['blade','gunA','gunB'].filter(k=>G.eq[k]);
    if(!order.length)return;
    let i=order.indexOf(G.p.cur);if(i<0)i=-1;
    i=(i+(e.deltaY>0?1:order.length-1))%order.length;
    selectW(order[i]);}});
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  addEventListener('beforeunload',()=>{if(G&&G.state==='play')saveGame(true);});
  addEventListener('blur',()=>{if(G&&G.state==='play'&&!G.ui.panel&&!G.ui.menu)saveGame(true);});
}
function toggleFlash(){
  const p=G.p;
  if(p.flashOn){p.flashOn=false;SFX.click();return;}
  if(countItem('flashlight')<=0){log('Нет фонаря.','a06a5a');SFX.dry();return;}
  if(p.flashT<=0){log('Батарейка фонаря села. Зарядите в рюкзаке.','a06a5a');SFX.dry();return;}
  p.flashOn=true;SFX.click();log('Фонарь включён.','8aa06b');
}

// ---------- цикл ----------
function frame(ts){
  const dt=Math.min(.05,((ts-_last)/1000)||0);_last=ts;
  if(typeof syncTouchUI==='function')syncTouchUI();
  if(G){
    if(G.state==='play'&&!G.paused)update(dt);
    else if(G.state==='play'&&G.ui&&G.ui.panel===UI.el.lootP)tickSearch(dt);
    render();
  }
  requestAnimationFrame(frame);
}

function update(dt){
  const p=G.p,k=G.keys;
  G.hours+=dt*TIME_MIN_PER_SEC/60;
  if(G.hours>=24){G.hours-=24;G.day++;}
  if(G.hours>=19&&G._duskDay!==G.day){G._duskDay=G.day;
    log('Солнце садится. Вечером урочище становится чужим.','8f8d7e');
    log('Волк: солнце легло. Чужие запахи усиливаются.','b0a888');}
  if(G.hours>=21&&G._exfilDay!==G.day){G._exfilDay=G.day;
    UI.el.exfil.textContent='21:00 — НОЧНАЯ ОСАДА (до 05:00): держитесь за забором, ставьте ловушки и чините периметр!';UI.el.exfil.classList.remove('hidden');spawnScavs();SFX.saw();}
  if(G.hours>=20.6&&G._feralDay!==G.day){G._feralDay=G.day;spawnNights();}
  // статусы
  const dtH=dt*TIME_MIN_PER_SEC/60;
  p.hunger=Math.max(0,p.hunger-3.2*dtH);
  p.thirst=Math.max(0,p.thirst-5.4*dtH);
  if(p.bleed>0){p.hp-=.5*p.bleed*dt;p.cause='кровотечение';}
  if(p.hunger<=0){p.hp-=.5*dt;p.cause='голод';}
  if(p.thirst<=0){p.hp-=.9*dt;p.cause='жажда';}
  if(p.hunger>65&&p.thirst>45&&p.hp<100)p.hp=Math.min(100,p.hp+.4*dt);
  if(p.flashOn){p.flashT-=dt;if(p.flashT<=0){p.flashOn=false;SFX.click();log('Батарейка фонаря села.','a06a5a');}}
  // движение
  let dx=0,dy=0;
  if(k['KeyW']||k['ArrowUp'])dy--;
  if(k['KeyS']||k['ArrowDown'])dy++;
  if(k['KeyA']||k['ArrowLeft'])dx--;
  if(k['KeyD']||k['ArrowRight'])dx++;
  const tv=touchVec();
  if(tv){dx=tv.x;dy=tv.y;}
  if(TOUCH.on)p.crouch=(TOUCH.stance==='crouch');
  const moving=dx||dy;
  p.moving=!!moving;
  const wantRun=((k['ShiftLeft']||k['ShiftRight'])||(TOUCH.on&&TOUCH.stance==='run')||(tv&&TOUCH.run))&&p.stam>1&&moving&&!p.crouch;
  p.run=wantRun;
  if(p.vigourT>0)p.vigourT=Math.max(0,p.vigourT-dt);
  const vMul=(p.vigourT>0&&G.upg)?BASE_UPG.tent[G.upg.tent].spd:1;
  const spd=(p.crouch?28:(wantRun?70:46))*vMul;
  if(moving){
    const l=Math.hypot(dx,dy),vx=dx/l*spd,vy=dy/l*spd;
    if(!collides(p.x+vx*dt,p.y,p.r))p.x+=vx*dt;
    if(!collides(p.x,p.y+vy*dt,p.r))p.y+=vy*dt;
    p.anim=(p.anim||0)+dt*(wantRun?13:9);
    if(wantRun)p.stam=Math.max(0,p.stam-22*dt);
    else p.stam=Math.min(100,p.stam+(p.crouch?8:13)*dt);
    p.stepT-=dt;
    if(p.stepT<=0){p.stepT=p.crouch?.55:(wantRun?.33:.45);
      const mat=World.tileAt(p.x/TS|0,p.y/TS|0);
      SFX.step(mat,wantRun,p.crouch);
      if(mat===TILE.TALL||(mat<=TILE.GRASS_B&&Math.random()<.45))SFX.rustle();
      if(Math.random()<.3)G.parts.push({x:p.x,y:p.y+6,vx:0,vy:0,t:.25,tl:.25,type:'dust'});}
  } else p.stam=Math.min(100,p.stam+11*dt);
  if(wantRun){p._br=(p._br||0)-dt;if(p._br<=0){SFX.breath();p._br=1+Math.random()*.6;}}
  const nightNow=dayL(G.hours)<.25;
  if(nightNow!==G._nightSfx){G._nightSfx=nightNow;
    if(nightNow)SFX.nightAmbOn();else SFX.nightAmbOff();}
  let nearThreat=0;
  for(const e of G.enemies){
    if(e.dead)continue;
    const d=dst(e.x,e.y,p.x,p.y);
    if(e.state==='fight'&&d<13*TS)nearThreat=Math.max(nearThreat,1-d/(13*TS));
    else if(d<8*TS)nearThreat=Math.max(nearThreat,.35*(1-d/(8*TS)));
  }
  const threat=nearThreat>.25;
  if((threat&&dayL(G.hours)<.45)||p.hp<30)SFX.heartOn(p.hp<30);else SFX.heartOff();
  if(SFX.musicUpdate){
    const Lnow=dayL(G.hours);
    const mMode=nearThreat>.45?'combat':(Lnow<.22?'night':(Lnow<.65?'dusk':'day'));
    SFX.musicUpdate({mode:mMode,threat:nearThreat,hp:p.hp,inCamp:inCamp(p.x,p.y)});
  }
  if(TOUCH.touch){
    if(!TOUCH.aim||Date.now()-TOUCH.aimT>900){
      const ax=moving?dx:Math.cos(p.face),ay=moving?dy:Math.sin(p.face);
      const l=Math.hypot(ax,ay)||1;
      G.mouse.x=(p.x+ax/l*36-G.cam.x)*ZB/DPR;
      G.mouse.y=(p.y+ay/l*36-G.cam.y)*ZB/DPR;
    }
  }
  const mwx=G.mouse.x*DPR/ZB+G.cam.x,mwy=G.mouse.y*DPR/ZB+G.cam.y;
  p.face=Math.atan2(mwy-p.y,mwx-p.x);
  if(p.atkCd>0)p.atkCd-=dt;
  if(p.reload){p.reload.t+=dt;
    if(p.reload.t>=p.reload.max){
      const d=ITEMS[G.eq[p.reload.slot]].w,sl=p.reload.slot;
      const need=d.mag-G.ws[sl].mag,take=Math.min(need,countItem(d.ammo));
      if(take>0){removeItem(d.ammo,take);G.ws[sl].mag+=take;if(SFX.reloadDone)SFX.reloadDone(p.reload.id);else SFX.craft();}
      p.reload=null;}}
  if(G.mouse.down)fireWeapon();
  if(p.swing){p.swing.t-=dt;if(p.swing.t<=0)p.swing=null;}
  handleInteract(dt);
  // Неуязвимые ночные призраки вне лагеря (21:00 - 05:00)
  const isNightOut=(G.hours>=21||G.hours<5)&&!inCamp(p.x,p.y);
  if(isNightOut){
    if(!G.ghosts||!G.ghosts.length){
      G.ghosts=[];
      for(let i=0;i<3;i++){
        const a=i*2.094;
        G.ghosts.push({x:p.x+Math.cos(a)*85,y:p.y+Math.sin(a)*85,cd:1.0+i*.5});
      }
      log('Тьма за забором сгущается — неуязвимые призраки охотятся на вас! Бегите в лагерь!','d9422b');
      if(SFX.ghostScream)SFX.ghostScream();
    }
    for(const gh of G.ghosts){
      const a=Math.atan2(p.y-gh.y,p.x-gh.x);
      gh.x+=Math.cos(a)*68*dt; gh.y+=Math.sin(a)*68*dt;
      gh.cd-=dt;
      if(dst(gh.x,gh.y,p.x,p.y)<18&&gh.cd<=0){
        gh.cd=1.8;
        if(SFX.ghostScream)SFX.ghostScream();
        hurtPlayer(14,'призраки тьмы',1);
      }
    }
  } else if(G.ghosts&&G.ghosts.length){
    G.ghosts=[];
    log('Призраки отступили за границу забора.','8aa06b');
  }
  updEnemies(dt);updBullets(dt);updParts(dt);updPlaced(dt);updVis(false);updWeather(dt);
  if(SFX.rainUpdate)SFX.rainUpdate(G.wx?G.wx.rain:0);
  if(dayL(G.hours)<.2&&inCamp(p.x,p.y)){
    G._evT-=dt;
    if(G._evT<=0){nightEvent();G._evT=45+Math.random()*70;}
  } else if(G._evT<12)G._evT=12+Math.random()*8;
  G._fireT-=dt;
  if(G._fireT<=0){G._fireT=.055;
    for(const f of World.props){
      if(f.type!=='fire'&&f.type!=='traderfire')continue;
      const fx=f.x*TS+8, fy=f.y*TS+6;
      G.parts.push({x:fx+(Math.random()*7-3.5),y:fy,vx:(Math.random()*2-1)*8,vy:-26-Math.random()*12,t:.45,tl:.45,type:'flame'});
      if(Math.random()<.45)G.parts.push({x:fx+(Math.random()*6-3),y:fy-2,vx:(Math.random()*2-1)*12,vy:-18-Math.random()*16,t:.9+Math.random()*.7,tl:1.4,type:'ember'});
      if(Math.random()<.6)G.parts.push({x:fx+(Math.random()*4-2),y:fy-4,vx:(Math.random()*2-1)*6,vy:-14,t:2.6,tl:2.6,type:'smoke'});
    }}
  G.shake=Math.max(0,G.shake-12*dt);
  G.redFlash=Math.max(0,G.redFlash-1.1*dt);
  if(p.hp<=0)die();
  renderHUD();
}

function handleInteract(dt){
  const t=findInteract();
  if(!t){UI.el.hint.classList.add('hidden');
    if(!G.eHeld){UI.el.prog.classList.add('hidden');G.prog=0;G.progKey=null;}
    return;}
  if(!G.eHeld){
    UI.el.hint.textContent='[E] '+t.label;
    UI.el.hint.classList.remove('hidden');
    UI.el.prog.classList.add('hidden');G.prog=0;G.progKey=null;
    return;}
  const key=(t.kind==='con')?('c'+World.conts.indexOf(t.c)):('p'+World.props.indexOf(t.pr));
  if(G.progKey!==key){G.progKey=key;G.prog=0;}
  G.prog+=dt/t.open;
  UI.el.prog.classList.remove('hidden');
  UI.el.progF.style.width=Math.min(100,G.prog*100)+'%';
  if(G.prog>=1){
    G.eHeld=false;G.prog=0;G.progKey=null;
    UI.el.prog.classList.add('hidden');UI.el.hint.classList.add('hidden');
    if(t.kind==='con'){
      if(!t.c.visited){t.c.visited=true;G.stats.looted++;}
      openLoot(t.c);
    } else if(t.kind==='fence'){
      openFence(t.s);
    } else if(t.kind==='place'){
      removeItem(t.what,1);
      World.placed.push({kind:t.what==='trap'?'trap':'can',x:G.p.x,y:G.p.y+8,cd:0});
      SFX.craft();
      log(t.what==='trap'?'Ловушка натянута. Ждём гостей.':'Жестянка подвешена на леску.','8aa06b');
    } else {
      const pr=t.pr;
      if(pr.act==='sleep')openTent();
      else if(pr.act==='craft')openCraft(false);
      else if(pr.act==='cook')openCraft(true);
      else if(pr.act==='trade')openTrade();
      else if(pr.act==='drink'){G.p.thirst=Math.min(100,G.p.thirst+45);
        SFX.drink();log('Вы напились из колодца. Вода на вкус как железо.','8aa06b');}
    }
  }
}
function findInteract(){
  const p=G.p;let best=null,bd=30;
  for(const c of World.conts){
    const d=dst(p.x,p.y,c.x,c.y);
    if(d<bd){bd=d;best={kind:'con',c,
      label:c.fixed?('схрон: сложить или взять — '+knownCount(c)+'/'+c.fixed)
        :('обыскать: '+CTYPE[c.type].n.toLowerCase()),
      open:CTYPE[c.type].open,noise:CTYPE[c.type].noise};}
  }
  for(const pr of World.props){
    if(!pr.act)continue;
    const cx=(pr.x+pr.w/2)*TS,cy=(pr.y+pr.h/2)*TS;
    const d=dst(p.x,p.y,cx,cy)-Math.max(pr.w,pr.h)*7;
    if(d<bd&&d>-46){bd=d;
      best={kind:'prop',pr,label:pr.label,
        open:pr.act==='drink'?1.2:(pr.act==='sleep'?1.0:.3)};}
  }
  if(!best){
    let done=false;
    for(let yy=(p.y/TS|0)-2;yy<=(p.y/TS|0)+2&&!done;yy++)
      for(let xx=(p.x/TS|0)-2;xx<=(p.x/TS|0)+2;xx++){
        const ti=xx+yy*MAPW;
        if(xx<0||yy<0||xx>=MAPW||yy>=MAPH)continue;
        if(World.segMap[ti]<0)continue;
        const s=World.segs[World.segMap[ti]];
        if(s&&dst(p.x,p.y,xx*TS+8,yy*TS+8)<34){
          const dlv=(G.upg&&G.upg.doors&&G.upg.doors[s.side])||1;
          best={kind:'fence',s,label:'дверь ('+SIDE_N[s.side]+'): '+BASE_UPG.door[dlv].n+' '+s.hp+'/'+s.max,open:.4};
          done=true;break;
        }
      }
  }
  if(!best&&countItem('trap')>0&&placeSpotOK(p))
    best={kind:'place',what:'trap',label:'установить ловушку-растяжку',open:.5};
  if(!best&&countItem('cans')>0&&placeSpotOK(p))
    best={kind:'place',what:'cans',label:'подвесить сигнальную жестянку',open:.5};
  return best;
}
function placeSpotOK(p){
  if(pointSolid(p.x,p.y+8))return false;
  const tile=World.tileAt(p.x/TS|0,(p.y+8)/TS|0);
  if(tile===TILE.WATER)return false;
  for(const q of World.placed)if(dst(q.x,q.y,p.x,p.y+8)<24)return false;
  return true;
}
function nightEvent(){
  const r=Math.random();
  if(r<.2){SFX.knock();G.shake=1.5;log('Тук. Тук-тук. Кто-то щупает забор.','8f8d7e');}
  else if(r<.4){SFX.scratch();log('Царапанье по дереву. Мелкое, терпеливое.','8f8d7e');}
  else if(r<.55){SFX.whisper();log('Волк: шепчет кто-то. Или мерещится.','b0a888');}
  else if(r<.68){SFX.thud();G.shake=3;log('Глухой удар из темноты. Земля вздрогнула.','8f8d7e');}
  else if(r<.8&&World.placed.some(q=>q.kind==='can')){SFX.rattle();
    log('Жестянка звякнула. Сама... или не сама.','d8c07a');}
  else {
    const c=World.camp, side=['N','S','E','W'][Math.random()*4|0];
    const raw={N:[c.x+c.w/2,c.y-2],S:[c.x+c.w/2,c.y+c.h+2],E:[c.x+c.w+2,c.y+c.h/2],W:[c.x-2,c.y+c.h/2]}[side];
    const pt=freeNear(raw[0]*TS,raw[1]*TS,7);
    const e=makeEnemy(pt.x,pt.y,'hound','night');e.anchor={x:e.x,y:e.y};
    SFX.growl('hound');
    log('Волк: не мерещится. Береги дыры в заборе.','c9584a');
  }
}

// ---------- видимость / туман ----------
function updVis(force){
  const L=dayL(G.hours),R=L>.4?15:10;
  const pcx=G.p.x/TS,pcy=G.p.y/TS;
  const tx=pcx|0,ty=pcy|0;
  if(!force&&tx===G._visX&&ty===G._visY&&Math.abs(L-G._visL)<.04)return;
  G._visX=tx;G._visY=ty;G._visL=L;
  const d=World.fogImg.data,ex=World.explored;
  const x0=Math.max(0,Math.floor(pcx-R)),x1=Math.min(MAPW-1,Math.ceil(pcx+R));
  const y0=Math.max(0,Math.floor(pcy-R)),y1=Math.min(MAPH-1,Math.ceil(pcy+R));
  for(let i=0;i<MAPW*MAPH;i++){
    const q=i*4;d[q]=5;d[q+1]=7;d[q+2]=6;
    d[q+3]=ex[i]===0?255:(148+(1-L)*64);
  }
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const dx=x+.5-pcx,dy=y+.5-pcy,dd=Math.hypot(dx,dy);
    if(dd>R)continue;
    if(!losClear(pcx,pcy,x+.5,y+.5))continue;
    const i=y*MAPW+x,q=i*4;
    if(ex[i]!==2)ex[i]=2;
    d[q+3]=lerp(22,175,dd/R)*(.8+.2*(1-L));
  }
  World.fctx.putImageData(World.fogImg,0,0);
}

// ---------- погода и атмосфера Darkwood (туман, дождь, споры, молнии) ----------
function initWeather(){
  const mists=[], spores=[], drops=[];
  for(let i=0;i<18;i++)mists.push({
    x:Math.random()*MAPW*TS,y:Math.random()*MAPH*TS,
    rx:28+Math.random()*44,ry:12+Math.random()*20,
    vx:3+Math.random()*5,vy:(Math.random()-.5)*2,a:.07+Math.random()*.08
  });
  for(let i=0;i<36;i++)spores.push({
    x:Math.random()*400,y:Math.random()*300,
    vx:(Math.random()-.5)*7,vy:-3-Math.random()*6,ph:Math.random()*6.28
  });
  for(let i=0;i<90;i++)drops.push({
    x:Math.random()*420,y:Math.random()*300,
    l:4+Math.random()*5,spd:170+Math.random()*70
  });
  G.wx={mode:'fog',t:40+Math.random()*45,rain:0,targetRain:0,flash:0,mists,spores,drops};
}
function updWeather(dt){
  if(!G.wx)initWeather();
  const wx=G.wx;
  wx.t-=dt;
  if(wx.t<=0){
    const r=Math.random();
    if(r<.42){wx.mode='fog';wx.targetRain=0;}
    else if(r<.78){wx.mode='drizzle';wx.targetRain=.45;}
    else{wx.mode='storm';wx.targetRain=1;}
    wx.t=35+Math.random()*55;
  }
  wx.rain=lerp(wx.rain,wx.targetRain,dt*.35);
  wx.flash=Math.max(0,wx.flash-dt*2.8);
  if(wx.mode==='storm'&&dayL(G.hours)<.6&&Math.random()<dt*.06){
    wx.flash=.55+Math.random()*.35;
    if(SFX.thunder)SFX.thunder();
  }
  const W=bcv?bcv.width:320, H=bcv?bcv.height:240;
  for(const m of wx.mists){
    m.x+=m.vx*dt;m.y+=m.vy*dt;
    if(m.x>MAPW*TS+60)m.x=-60;
    if(m.y<0)m.y=MAPH*TS;if(m.y>MAPH*TS)m.y=0;
  }
  for(const s of wx.spores){
    s.x=(s.x+s.vx*dt+W)%W;s.y=(s.y+s.vy*dt+H)%H;s.ph+=dt*2;
  }
  if(wx.rain>.05){
    for(const d of wx.drops){
      d.x-=d.spd*.26*dt;d.y+=d.spd*dt;
      if(d.y>H){d.y=-6;d.x=Math.random()*(W+80);}
      if(d.x<-10)d.x+=W+40;
    }
  }
}
function drawWeather(camx,camy,W,H,L){
  if(!G.wx)return;
  const g=bctx, wx=G.wx;
  const fogMul=.75+(1-L)*.65+(wx.mode==='fog'?.35:0);
  for(const m of wx.mists){
    const sx=m.x-camx, sy=m.y-camy;
    if(sx<-m.rx||sx>W+m.rx||sy<-m.ry||sy>H+m.ry)continue;
    g.globalAlpha=m.a*fogMul;
    g.fillStyle='#4a5243';
    g.beginPath();g.ellipse(sx,sy,m.rx,m.ry,0,0,7);g.fill();
  }
  g.globalAlpha=1;
  for(const s of wx.spores){
    const a=.14+.12*Math.sin(s.ph);
    g.fillStyle='rgba(175,172,140,'+a+')';
    g.fillRect(Math.round(s.x),Math.round(s.y),1,1);
  }
  if(wx.rain>.06){
    const cnt=Math.floor(wx.drops.length*wx.rain);
    g.strokeStyle='rgba(148,162,152,'+(0.16+wx.rain*0.22)+')';
    g.lineWidth=1;
    g.beginPath();
    for(let i=0;i<cnt;i++){
      const d=wx.drops[i], dx=Math.round(d.x), dy=Math.round(d.y);
      g.moveTo(dx,dy);g.lineTo(dx-Math.round(d.l*.26),dy+Math.round(d.l));
    }
    g.stroke();
    if(Math.random()<wx.rain*.85){
      const rx=Math.random()*W|0, ry=Math.random()*H|0;
      g.fillStyle='rgba(160,175,165,.25)';
      g.fillRect(rx-1,ry,3,1);g.fillRect(rx,ry-1,1,3);
    }
  }
}

// ---------- рендер ----------
function drawBaseProps(){
  const g=bctx, upg=G.upg||{bench:1,stash:1,tent:1,fire:1};
  for(const p of World.props){
    const px=p.x*TS, py=p.y*TS, w=p.w*TS, h=p.h*TS;
    if(p.type==='tent'){
      const lv=upg.tent||1;
      pxEll(g,px+w/2,py+h-1,w/2+5,5.5,'rgba(3,5,2,.65)');
      if(lv===1){
        for(let yy=0;yy<h;yy++){
          const hw=Math.max(1,Math.round(((yy+1)/h)*(w/2)));
          g.fillStyle=yy<h/2?'#2c3625':'#232c1d';g.fillRect(px+w/2-hw,py+yy,hw*2,1);
          g.fillStyle='#141a10';g.fillRect(px+w/2-hw,py+yy,1,1);g.fillRect(px+w/2+hw-1,py+yy,1,1);
        }
        g.fillStyle='#38402d';g.fillRect(px+w/2-6,py+h/2,4,3);
        pxLine(g,px+w/2,py,px+w/2,py+h-1,'#3f4c36');
        g.fillStyle='#10140d';g.fillRect(px+w/2-4,py+h-7,8,7);
      } else if(lv===2){
        // Утеплённый шатёр с деревянным каркасом и трубой
        g.fillStyle='#242c1d';g.fillRect(px+2,py+4,w-4,h-4);
        g.fillStyle='#35402b';g.fillRect(px+3,py+2,w-6,h/2);
        pxRect(g,px+2,py+2,w-4,h-2,'#171b12');
        pxLine(g,px+w/2,py+1,px+w/2,py+h-1,'#4d3b27',2);
        g.fillStyle='#3c3d40';g.fillRect(px+w-9,py+1,3,5); // труба
        g.fillStyle='#11140d';g.fillRect(px+w/2-4,py+h-8,8,8);
      } else {
        // Укреплённый барак-убежище с железной крышей и тёплым окном
        g.fillStyle='#2a2117';g.fillRect(px,py+2,w,h-2);
        g.fillStyle='#2d3236';g.fillRect(px-1,py,w+2,h/2+2); // жестяная крыша
        pxLine(g,px-1,py+4,px+w,py+4,'#42474c');
        pxRect(g,px,py,w,h,'#0d0f0a');
        g.fillStyle='#140f0a';g.fillRect(px+w/2-4,py+h-9,8,9);
        g.fillStyle='#d99438';g.fillRect(px+5,py+h-11,4,3); // тёплое окно
      }
    } else if(p.type==='workbench'){
      const lv=upg.bench||1;
      pxEll(g,px+w/2,py+TS-2,w/2+2,3.5,'rgba(3,5,2,.58)');
      g.fillStyle='#16100a';g.fillRect(px+2,py+4,3,TS-4);g.fillRect(px+w-5,py+4,3,TS-4);
      g.fillStyle=lv===1?DW.wood2:(lv===2?'#3a3d40':'#2b2f33');g.fillRect(px,py,w-1,6);
      g.fillStyle=lv===1?DW.wood4:'#595e63';g.fillRect(px,py,w-1,1);
      g.fillStyle='#4f4c43';g.fillRect(px+w-8,py-2,5,3);
      if(lv>=2){g.fillStyle='#787d82';g.fillRect(px+3,py+1,7,2);pst(g,px+14,py+1,'#c9933a');}
      if(lv>=3){
        g.fillStyle='#232629';g.fillRect(px+10,py-3,6,3); // пресс/наковальня
        g.fillStyle='#f0b848';g.fillRect(px+2,py-2,2,2); // лампа
      }
    } else if(p.type==='fire'){
      const lv=upg.fire||1;
      pxEll(g,px+8,py+8,9.5,8,'rgba(6,4,2,.68)');
      if(lv===1){
        for(let i=0;i<8;i++){const a=i/8*6.283;pxEll(g,px+8+Math.cos(a)*7,py+8+Math.sin(a)*6,2.1,1.7,DW.stone2);}
        pxLine(g,px+4,py+9,px+12,py+7,'#1d150c',2);pxLine(g,px+5,py+6,px+11,py+10,'#241a10',2);
      } else if(lv===2){
        for(let i=0;i<9;i++){const a=i/9*6.283;pxEll(g,px+8+Math.cos(a)*7.5,py+8+Math.sin(a)*6.5,2.3,1.9,DW.stone3);}
        pxLine(g,px+3,py+11,px+8,py+1,'#2e3134',1);pxLine(g,px+13,py+11,px+8,py+1,'#2e3134',1); // тренога
        pxEll(g,px+8,py+6,2.4,2,'#1b1d1f'); // котелок
      } else {
        // Печь-буржуйка
        g.fillStyle='#25282b';g.fillRect(px+3,py+2,10,11);
        pxRect(g,px+3,py+2,10,11,'#111315');
        g.fillStyle='#3b3f44';g.fillRect(px+6,py-2,4,5); // труба
        g.fillStyle='#e06c20';g.fillRect(px+5,py+8,6,3); // топка
      }
    }
  }
  // Непробиваемый железный забор (горизонтальный на N/S и ребром вертикальный на W/E)
  const c=World.camp;
  for(let y=c.y;y<c.y+c.h;y++)for(let x=c.x;x<c.x+c.w;x++){
    if(x!==c.x&&x!==c.x+c.w-1&&y!==c.y&&y!==c.y+c.h-1)continue;
    const ti=x+y*MAPW;
    if(World.t[ti]!==TILE.FENCE)continue;
    const px=x*TS, py=y*TS;
    const horiz=(y===c.y||y===c.y+c.h-1);
    if(horiz){
      g.fillStyle='rgba(2,3,1,.6)';g.fillRect(px,py+12,TS,3);
      g.fillStyle='#24282c';g.fillRect(px,py+6,TS,4);
      g.fillStyle='#454c54';g.fillRect(px,py+6,TS,1);
      g.fillStyle='#131619';g.fillRect(px,py+9,TS,1);
      for(let i=2;i<16;i+=4){
        g.fillStyle='#343a40';g.fillRect(px+i,py+2,2,11);
        pst(g,px+i,py+1,'#7d858e');
      }
    } else {
      // вертикальный забор ребром (W/E)
      g.fillStyle='rgba(2,3,1,.6)';g.fillRect(px+10,py,3,TS);
      g.fillStyle='#24282c';g.fillRect(px+6,py,4,TS);
      g.fillStyle='#454c54';g.fillRect(px+6,py,1,TS);
      g.fillStyle='#131619';g.fillRect(px+9,py,1,TS);
      for(let i=2;i<16;i+=4){
        g.fillStyle='#343a40';g.fillRect(px+3,py+i,10,2);
        pst(g,px+3,py+i,'#7d858e');pst(g,px+12,py+i,'#7d858e');
      }
    }
  }
  // 4 двери лагеря (5 уровней: соломенная -> деревянная -> железная -> кирпичная -> бетонная)
  const DCOLS={
    1:['#8c7438','#6b5626','#a88c48'],
    2:['#4d3822','#302214','#664b2e'],
    3:['#383e44','#22262a','#6b737c'],
    4:['#6e3226','#4a2018','#8a8272'],
    5:['#585c5e','#383c3e','#84898c']
  };
  for(const s of World.segs){
    const dlv=(upg.doors&&upg.doors[s.side])||1;
    const cl=DCOLS[dlv];
    const horiz=(s.side==='N'||s.side==='S');
    for(const ti of s.tiles){
      const x=(ti%MAPW)*TS, y=(ti/MAPW|0)*TS;
      if(s.hp<=0){
        g.fillStyle=cl[1];g.fillRect(x+2,y+10,4,4);g.fillRect(x+10,y+3,4,5);
        continue;
      }
      if(horiz){
        g.fillStyle=cl[0];g.fillRect(x,y+5,TS,6);
        g.fillStyle=cl[1];g.fillRect(x,y+10,TS,2);
        g.fillStyle=cl[2];g.fillRect(x,y+5,TS,1);
        if(dlv===4){pst(g,x+4,y+7,cl[2]);pst(g,x+11,y+8,cl[2]);}
        if(dlv===5){g.fillStyle='#24282b';g.fillRect(x+2,y+6,2,4);g.fillRect(x+12,y+6,2,4);}
      } else {
        g.fillStyle=cl[0];g.fillRect(x+5,y,6,TS);
        g.fillStyle=cl[1];g.fillRect(x+10,y,2,TS);
        g.fillStyle=cl[2];g.fillRect(x+5,y,1,TS);
        if(dlv===4){pst(g,x+7,y+4,cl[2]);pst(g,x+8,y+11,cl[2]);}
        if(dlv===5){g.fillStyle='#24282b';g.fillRect(x+6,y+2,4,2);g.fillRect(x+6,y+12,4,2);}
      }
      if(s.hp<s.max*.65)pxLine(g,x+3,y+3,x+13,y+13,'#120a08');
    }
  }
  // Визуальный апгрейд схрона
  const sc=World.conts.find(c=>c.type==='stash');
  if(sc){
    const lv=upg.stash||1, sx=Math.round(sc.x), sy=Math.round(sc.y);
    pxEll(g,sx,sy+4,7,3,'rgba(3,5,2,.6)');
    if(lv===1){
      g.fillStyle='#3a2b1c';g.fillRect(sx-5,sy-4,10,8);pxRect(g,sx-5,sy-4,10,8,'#17110a');
    } else if(lv===2){
      g.fillStyle='#3d2e1e';g.fillRect(sx-6,sy-5,12,9);pxRect(g,sx-6,sy-5,12,9,'#141618');
      g.fillStyle='#5c6166';g.fillRect(sx-6,sy-2,12,2);g.fillRect(sx-1,sy-5,2,9);
      pst(g,sx,sy,'#c9a84a');
    } else {
      g.fillStyle='#23282b';g.fillRect(sx-6,sy-6,12,11);pxRect(g,sx-6,sy-6,12,11,'#0d0f10');
      g.fillStyle='#3c4247';g.fillRect(sx-5,sy-5,10,2);
      g.fillStyle='#d4b24c';g.fillRect(sx-1,sy-1,2,3);
    }
  }
}

function render(){
  const W=bcv.width,H=bcv.height;
  let camx=Math.round(G.p.x)-(W>>1),camy=Math.round(G.p.y)-(H>>1);
  camx=clamp(camx,0,Math.max(0,MAPW*TS-W));
  camy=clamp(camy,0,Math.max(0,MAPH*TS-H));
  if(G.shake>0){camx+=Math.round((Math.random()*2-1)*G.shake);camy+=Math.round((Math.random()*2-1)*G.shake);}
  G.cam={x:camx,y:camy};
  bctx.setTransform(1,0,0,1,0,0);
  bctx.imageSmoothingEnabled=false;
  bctx.fillStyle='#050705';bctx.fillRect(0,0,W,H);
  bctx.translate(-Math.round(camx),-Math.round(camy));
  bctx.drawImage(World.canvas,0,0);
  drawBaseProps();
  for(const c of World.conts)drawCon(c);
  drawBrokenFence();
  for(const pl of World.placed)drawPlaced(pl);
  drawTrader();
  for(const q of G.parts)drawPart(q);
  const ents=G.enemies.slice();ents.push(G.p);
  ents.sort((a,b)=>a.y-b.y);
  for(const e of ents){if(e===G.p)drawPlayer(e);else drawEnemy(e);}
  if(G.ghosts&&G.ghosts.length){
    const tn=performance.now();
    for(const gh of G.ghosts){
      const gx=Math.round(gh.x), gy=Math.round(gh.y+Math.sin(tn/160+gh.x)*3);
      bctx.globalAlpha=.68;
      pxEll(bctx,gx,gy,8,10,'#060305');
      pxEll(bctx,gx,gy-2,5.5,6.5,'#24060a');
      bctx.globalAlpha=.95;
      pst(bctx,gx-2,gy-3,'#ff2820');pst(bctx,gx+2,gy-3,'#ff2820');
      pxEll(bctx,gx,gy+1,2,2.5,'#020102');
      bctx.globalAlpha=1;
    }
  }
  for(const b of G.bullets){const l=Math.hypot(b.vx,b.vy);
    pxLine(bctx,b.x,b.y,b.x-b.vx/l*6,b.y-b.vy/l*6,'rgba(238,214,140,.85)');}
  for(const r of G.rings){const T=r.r/140,k=r.t/T;if(k>1)continue;
    pxCirc(bctx,r.x,r.y,r.r*k,'rgba(180,175,145,'+(.22*(1-k))+')');}
  if(World.canopy)bctx.drawImage(World.canopy,0,0);
  bctx.drawImage(World.roof,0,0);

  // погода
  bctx.setTransform(1,0,0,1,0,0);
  const L=dayL(G.hours),p=G.p;
  drawWeather(camx,camy,W,H,L);

  // туман войны
  bctx.translate(-Math.round(camx),-Math.round(camy));
  bctx.imageSmoothingEnabled=true;
  bctx.drawImage(World.fog,0,0,MAPW,MAPH,0,0,MAPW*TS,MAPH*TS);
  bctx.imageSmoothingEnabled=false;

  // живое танцующее пламя на кострах поверх земли
  bctx.setTransform(1,0,0,1,0,0);
  const tNow=performance.now();
  for(const q of World.props){
    if(q.type!=='fire'&&q.type!=='traderfire')continue;
    const fx=Math.round(q.x*TS+8-camx), fy=Math.round(q.y*TS+7-camy);
    const sw1=Math.sin(tNow/95+q.x)*1.6, sw2=Math.cos(tNow/70+q.y)*1.2;
    pxEll(bctx,fx,fy,4.2,2.6,'rgba(180,52,18,.55)');
    pxTri(bctx,fx-3,fy+1,fx+3,fy+1,fx+sw1,fy-7,'#d9581e');
    pxTri(bctx,fx-2,fy+1,fx+2,fy+1,fx+sw2,fy-5,'#f5a432');
    pxEll(bctx,fx+sw2*.4,fy-1,1.6,1.8,'#fff0a8');
  }

  // ещё более мрачная и безысходная цветокоррекция Darkwood
  bctx.fillStyle='rgba(5,9,6,'+(0.14+(1-L)*0.16)+')';
  bctx.fillRect(0,0,W,H);

  // нервное мерцание фонаря при низком заряде
  const flFlick=(p.flashOn&&p.flashT<55&&Math.sin(tNow/38)>0.55)?0.35:1;

  // широкий, тёплый, долго держащийся отблеск костров и фонаря
  bctx.globalCompositeOperation='lighter';
  for(const q of World.props){
    if(!q.light)continue;
    const fx=q.x*TS+8-camx,fy=q.y*TS+8-camy;
    const flk=Math.sin(tNow/115+q.x*3)*.09+Math.sin(tNow/43+q.y)*.04;
    const isFire=(q.type==='fire'||q.type==='traderfire');
    const R=q.light*(isFire?1.35:1)*(.94+flk);
    const wg=bctx.createRadialGradient(fx,fy,0,fx,fy,R);
    wg.addColorStop(0,'rgba(220,104,28,'+(0.34+(1-L)*0.32)+')');
    wg.addColorStop(.45,'rgba(155,54,16,'+(0.16+(1-L)*0.18)+')');
    wg.addColorStop(1,'rgba(0,0,0,0)');
    bctx.fillStyle=wg;bctx.beginPath();bctx.arc(fx,fy,R,0,7);bctx.fill();
  }
  if(p.flashOn&&flFlick>.4){
    const fx0=p.x+Math.cos(p.face)*7-camx, fy0=p.y+Math.sin(p.face)*7-camy;
    bctx.save();bctx.translate(fx0,fy0);bctx.rotate(p.face);
    // мягкий тёплый оттенок фонаря (не засвечивает картинку, сохраняет чёткость деталей)
    const fg=bctx.createRadialGradient(0,0,4,0,0,295*flFlick);
    fg.addColorStop(0,'rgba(245,222,165,'+(.16*flFlick)+')');
    fg.addColorStop(.55,'rgba(225,198,138,'+(.10*flFlick)+')');
    fg.addColorStop(1,'rgba(0,0,0,0)');
    bctx.fillStyle=fg;bctx.beginPath();bctx.moveTo(0,0);bctx.arc(0,0,295*flFlick,-.44,.44);bctx.closePath();bctx.fill();
    const fg2=bctx.createRadialGradient(0,0,4,0,0,220*flFlick);
    fg2.addColorStop(0,'rgba(255,244,205,'+(.18*flFlick)+')');
    fg2.addColorStop(.6,'rgba(245,224,170,'+(.09*flFlick)+')');
    fg2.addColorStop(1,'rgba(0,0,0,0)');
    bctx.fillStyle=fg2;bctx.beginPath();bctx.moveTo(0,0);bctx.arc(0,0,220*flFlick,-.20,.20);bctx.closePath();bctx.fill();
    bctx.restore();
  }
  bctx.globalCompositeOperation='source-over';

  // гнетущая темнота + чёткий и светлый конус взгляда героя
  {
    dctx.setTransform(1,0,0,1,0,0);
    dctx.globalCompositeOperation='source-over';
    dctx.clearRect(0,0,W,H);
    const darkA=Math.max(0.16,(1-L)*.90-(G.wx?G.wx.flash*.55:0));
    dctx.fillStyle='rgba(1,2,1,'+darkA+')';dctx.fillRect(0,0,W,H);
    dctx.globalCompositeOperation='destination-out';
    const px=p.x-camx,py=p.y-camy;
    const R0=42+(p.flashOn?24*flFlick:0)+L*210;
    let gr=dctx.createRadialGradient(px,py,0,px,py,R0);
    gr.addColorStop(0,'rgba(0,0,0,.98)');gr.addColorStop(.42,'rgba(0,0,0,.38)');gr.addColorStop(1,'rgba(0,0,0,0)');
    dctx.fillStyle=gr;dctx.beginPath();dctx.arc(px,py,R0,0,7);dctx.fill();
    // чёткий, светлый конус взгляда в направлении курсора (и без фонаря, и с фонарём от рук)
    const cx0=p.flashOn?(px+Math.cos(p.face)*7):px, cy0=p.flashOn?(py+Math.sin(p.face)*7):py;
    dctx.save();dctx.translate(cx0,cy0);dctx.rotate(p.face);
    const gazeR=p.flashOn?(315*flFlick):(190+L*155);
    const gazeAng=p.flashOn?.45:.44;
    const cg=dctx.createRadialGradient(0,0,6,0,0,gazeR);
    cg.addColorStop(0,p.flashOn?'rgba(0,0,0,1)':'rgba(0,0,0,.96)');
    cg.addColorStop(.72,p.flashOn?'rgba(0,0,0,.94)':'rgba(0,0,0,.76)');
    cg.addColorStop(.90,p.flashOn?'rgba(0,0,0,.55)':'rgba(0,0,0,.30)');
    cg.addColorStop(1,'rgba(0,0,0,0)');
    dctx.fillStyle=cg;dctx.beginPath();dctx.moveTo(0,0);dctx.arc(0,0,gazeR,-gazeAng,gazeAng);dctx.closePath();dctx.fill();
    dctx.restore();
    for(const q of World.props){
      if(!q.light)continue;
      const fx=q.x*TS+8-camx,fy=q.y*TS+8-camy;
      const FR=q.light*((q.type==='fire'||q.type==='traderfire')?1.45:1.05)+Math.sin(performance.now()/140+q.x)*5;
      const gr2=dctx.createRadialGradient(fx,fy,0,fx,fy,FR);
      gr2.addColorStop(0,'rgba(0,0,0,.95)');gr2.addColorStop(.55,'rgba(0,0,0,.45)');gr2.addColorStop(1,'rgba(0,0,0,0)');
      dctx.fillStyle=gr2;dctx.beginPath();dctx.arc(fx,fy,FR,0,7);dctx.fill();
    }
    bctx.drawImage(dark,0,0);
  }

  // светящиеся глаза тварей в темноте и волчье чутьё
  const senseOn=p.crouch||L<.42;
  const now=performance.now();
  for(const e of G.enemies){
    if(e.dead)continue;
    const dd=dst(e.x,e.y,p.x,p.y);
    if(L<.65&&dd<14*TS&&losClear(p.x/TS,p.y/TS,e.x/TS,e.y/TS)){
      const ex=Math.round(e.x-camx),ey=Math.round(e.y-camy);
      const fx=Math.cos(e.face),fy=Math.sin(e.face),px2=-fy,py2=fx;
      const col=e.type==='straf'?'#e8a838':'#ff3222';
      bctx.globalAlpha=.25;
      pxEll(bctx,ex+fx*3,ey+fy*3-(e.type==='scav'?7:0),3.5,2.5,col);
      bctx.globalAlpha=1;
      bctx.fillStyle=col;
      bctx.fillRect(Math.round(ex+fx*3+px2*1.5),Math.round(ey+fy*3+py2*1.5-(e.type==='scav'?7:0)),1,1);
      bctx.fillRect(Math.round(ex+fx*3-px2*1.5),Math.round(ey+fy*3-py2*1.5-(e.type==='scav'?7:0)),1,1);
      if(e.type==='straf')bctx.fillRect(Math.round(ex+fx*4),Math.round(ey+fy*4-2),1,1);
    }
    if(senseOn&&dd<12*TS&&(e.state==='fight'||dd<7*TS)){
      const pulse=((now/900+e.x*.05)%1);
      pxCirc(bctx,e.x-camx,e.y-camy,4+pulse*12,'rgba(175,55,42,'+(.28*(1-pulse)).toFixed(2)+')');
    }
  }

  if(G.wx&&G.wx.flash>.02){
    bctx.fillStyle='rgba(170,185,195,'+(G.wx.flash*.22)+')';
    bctx.fillRect(0,0,W,H);
  }

  // апскейл буфера на экран без сглаживания
  ctx.setTransform(1,0,0,1,0,0);
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#030403';ctx.fillRect(0,0,cv.width,cv.height);
  ctx.drawImage(bcv,0,0,W,H,0,0,W*ZB,H*ZB);
  if(grainPat){
    ctx.save();ctx.translate((Math.random()*64)|0,(Math.random()*64)|0);
    ctx.fillStyle=grainPat;ctx.fillRect(-64,-64,cv.width+128,cv.height+128);ctx.restore();
  }
  if(G.redFlash>.01){ctx.fillStyle='rgba(110,16,12,'+Math.min(.55,G.redFlash)+')';ctx.fillRect(0,0,cv.width,cv.height);}
  if(p.bleed>0||p.hp<35){
    const pulse=.10+.08*Math.sin(now/210);
    ctx.fillStyle='rgba(88,10,8,'+pulse.toFixed(3)+')';
    ctx.fillRect(0,0,cv.width,cv.height);
    // тёмные прожилки ужаса по краям экрана
    ctx.save();ctx.strokeStyle='rgba(45,4,4,'+(pulse*2.4).toFixed(2)+')';ctx.lineWidth=2;
    for(let i=0;i<8;i++){
      const a=i/8*6.283+Math.sin(now/1800+i)*.05;
      const r1=Math.min(cv.width,cv.height)*.38, r2=Math.hypot(cv.width,cv.height)*.55;
      ctx.beginPath();
      ctx.moveTo(cv.width/2+Math.cos(a)*r2,cv.height/2+Math.sin(a)*r2);
      ctx.lineTo(cv.width/2+Math.cos(a+.08)*r1,cv.height/2+Math.sin(a+.08)*r1);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.drawImage(vign,0,0);
  drawMinimap();
  if(G.state==='play'&&World.tent){
    const tent=World.tent;
    const tx=((tent.x+1.5)*TS-camx)*ZB,ty=((tent.y+1)*TS-camy)*ZB;
    const cx=cv.width/2,cy=cv.height/2,a=Math.atan2(ty-cy,tx-cx);
    const rr=Math.min(cv.width,cv.height)*.34;
    ctx.save();ctx.translate(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);ctx.rotate(a);
    ctx.globalAlpha=.42;ctx.fillStyle='#8c9472';
    ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-5,5);ctx.lineTo(-2,0);ctx.lineTo(-5,-5);ctx.closePath();ctx.fill();
    ctx.restore();
  }
}

// ---------- контейнеры ----------
function drawCon(c){
  const g=bctx,x=Math.round(c.x),y=Math.round(c.y);
  if(!c.searched&&!c.base&&c.items.length){
    let mr=0;for(const it of c.items)mr=Math.max(mr,ITEMS[it.id].r);
    g.globalAlpha=.09+.05*Math.sin(performance.now()/360);
    pxEll(g,x,y,8.5,7.2,RAR[mr]);g.globalAlpha=1;
  }
  switch(c.type){
    case 'stash':
      pxEll(g,x,y+2,10,8,'rgba(4,6,3,.58)');
      g.fillStyle='#3a2e1b';g.fillRect(x-9,y-8,18,16);
      pxRect(g,x-9,y-8,18,16,'#140f08');
      pxLine(g,x-9,y-2,x+8,y-2,'#211a0f');pxLine(g,x-9,y+4,x+8,y+4,'#211a0f');
      pxLine(g,x-6,y-6,x+5,y+5,'#6b6349');pxLine(g,x+5,y-6,x-6,y+5,'#6b6349');
      g.fillStyle='#7c7458';g.fillRect(x+7,y-3,2,4);pst(g,x+8,y-4,'#a8a088');
      break;
    case 'crate':
      pxEll(g,x,y+2,8,6,'rgba(4,6,3,.55)');
      g.fillStyle=c.searched?'#2a2215':'#3b2f1d';g.fillRect(x-7,y-6,14,12);
      pxRect(g,x-7,y-6,14,12,'#17120a');
      pxLine(g,x-7,y-1,x+6,y-1,'#211a0e');
      pxLine(g,x-6,y-5,x+5,y+4,'#2a2113');
      pst(g,x-5,y-4,'#4d3e27');pst(g,x+3,y+2,'#4d3e27');
      if(c.searched){g.fillStyle='#0d0a06';g.fillRect(x-5,y-5,10,4);}break;
    case 'bigcrate':
      pxEll(g,x,y+2,10,7.5,'rgba(4,6,3,.58)');
      g.fillStyle=c.searched?'#282014':'#372c1b';g.fillRect(x-9,y-7,18,14);
      pxRect(g,x-9,y-7,18,14,'#141009');
      pxLine(g,x-9,y-1,x+8,y-1,'#1e170d');pxLine(g,x,y-7,x,y+6,'#1e170d');
      g.fillStyle='#3d4044';g.fillRect(x-9,y-7,2,2);g.fillRect(x+7,y-7,2,2);
      g.fillRect(x-9,y+5,2,2);g.fillRect(x+7,y+5,2,2);
      if(c.searched){g.fillStyle='#0b0905';g.fillRect(x-7,y-6,14,4);}break;
    case 'cupboard':
      pxEll(g,x,y+2,6.5,9,'rgba(4,6,3,.55)');
      g.fillStyle='#363024';g.fillRect(x-5,y-9,10,17);
      pxRect(g,x-5,y-9,10,17,'#1a1610');
      pxLine(g,x,y-9,x,y+7,'#211d15');
      pst(g,x-2,y-1,'#6d6449');pst(g,x+1,y-1,'#6d6449');
      if(c.searched){g.fillStyle='#0d0b08';g.fillRect(x-4,y-8,3,9);}break;
    case 'safe':
      pxEll(g,x,y+2,7,6.5,'rgba(4,6,3,.6)');
      g.fillStyle='#35383c';g.fillRect(x-6,y-6,12,12);
      pxRect(g,x-6,y-6,12,12,'#16181c');
      pxCirc(g,x-1,y,2.5,'#1d2024');pst(g,x-1,y-2,'#4b4f55');
      g.fillStyle='#4f2e1b';g.fillRect(x+2,y+3,3,2);
      if(c.searched){g.fillStyle='#0e1012';g.fillRect(x-5,y-5,6,10);}break;
    case 'toolbox':
      pxEll(g,x,y+2,6,4.5,'rgba(4,6,3,.5)');
      g.fillStyle='#5c2820';g.fillRect(x-5,y-4,10,8);
      pxRect(g,x-5,y-4,10,8,'#2a120e');
      pxLine(g,x-5,y-1,x+4,y-1,'#3a1914');
      g.fillStyle='#8c887a';g.fillRect(x-1,y-5,3,1);break;
    case 'shelf':
      pxEll(g,x,y+2,9,7,'rgba(4,6,3,.55)');
      g.fillStyle='#2e2516';g.fillRect(x-8,y-6,16,13);
      for(let i=0;i<3;i++)pxLine(g,x-8,y-4+i*4.5,x+7,y-4+i*4.5,'#18120a');
      if(!c.searched){g.fillStyle='#484c50';g.fillRect(x-6,y-3,3,2);g.fillRect(x+2,y+1,4,2);}
      else{g.fillStyle='#0b0906';g.fillRect(x-8,y-6,16,4);}break;
    case 'barrel':
      pxEll(g,x,y+2,6,6.8,'rgba(4,6,3,.55)');
      pxEll(g,x,y,5,6.5,'#312b20');
      pxLine(g,x-4,y-2,x+3,y-2,'#1d1912');pxLine(g,x-4,y+3,x+3,y+3,'#1d1912');
      pst(g,x-2,y-5,'#4a4131');
      if(c.searched){pxEll(g,x,y-4,3,1.2,'#090806');}break;
    case 'corpse':
      pxEll(g,x-1,y+1,10,6.5,'rgba(52,12,10,.45)');
      pxEll(g,x,y,8.5,5,'rgba(8,10,6,.6)');
      pxEll(g,x-2,y,6,3.8,'#2d2720');
      pxEll(g,x+5,y-2,2.4,2.2,'#5d574a');
      pst(g,x+6,y-2,'#14120e');pst(g,x+4,y-1,'#4a453a');
      pxLine(g,x-4,y-2,x,y-1,'#6d6658');break;
    case 'ground':
      pxEll(g,x,y+1,6.5,4,'rgba(4,6,3,.45)');
      g.fillStyle='#373328';g.fillRect(x-5,y-2,5,3);g.fillRect(x+1,y-4,4,5);
      g.fillStyle='#242116';g.fillRect(x-2,y+1,6,2);
      pst(g,x+4,y-5,'#4c4738');break;
  }
}

// ---------- частицы ----------
function drawPart(q){
  const g=bctx,k=q.t/q.tl;
  switch(q.type){
    case 'blood':g.fillStyle='rgba(86,16,14,'+k+')';g.fillRect(Math.round(q.x)-1,Math.round(q.y)-1,2,2);break;
    case 'dust':g.fillStyle='rgba(64,58,45,'+(k*.38)+')';g.fillRect(Math.round(q.x),Math.round(q.y),1,1);break;
    case 'spark':g.fillStyle='rgba(230,205,155,'+k+')';g.fillRect(Math.round(q.x),Math.round(q.y),1,1);break;
    case 'muzzle':g.globalAlpha=k*.65;pxEll(g,q.x,q.y,3.8,3.2,'#ffcf70');g.globalAlpha=1;break;
    case 'flame':{const x=Math.round(q.x),y=Math.round(q.y);
      g.fillStyle=k>.65?'#fff0a8':(k>.35?'#f0942c':'#b83a1e');
      g.fillRect(x,y,2,2);g.fillRect(x,y-1,1,1);break;}
    case 'ember':{const x=Math.round(q.x+Math.sin(q.t*8)*2),y=Math.round(q.y);
      g.fillStyle='rgba(255,168,58,'+Math.min(1,k*1.3).toFixed(2)+')';
      g.fillRect(x,y,1,1);break;}
    case 'smoke':g.globalAlpha=k*.2;pxEll(g,q.x,q.y,2.2+(1-k)*3.4,2.2+(1-k)*3.4,'#42403a');g.globalAlpha=1;break;
    case 'bang':g.fillStyle='rgba(195,72,58,'+Math.min(1,k*2)+')';
      g.fillRect(Math.round(q.x),Math.round(q.y)-4,1,3);g.fillRect(Math.round(q.x),Math.round(q.y)-1,1,1);break;
  }
}

function furBall(g,cx,cy,rx,ry,c,seed){
  pxEll(g,cx,cy,rx,ry,c);
  const n=Math.max(8,Math.round((rx+ry)*1.5));
  for(let i=0;i<n;i++){
    const a=i/n*6.2832+Math.sin(seed+i*7.3)*.15;
    const jit=1+Math.sin(seed*1.7+i*13.7)*.25;
    pxEll(g,cx+Math.cos(a)*rx*jit,cy+Math.sin(a)*ry*jit,1.3,1.3,c);
  }
}
function claw3(g,x,y,fx,fy,px,py,c){
  for(let k=-1;k<=1;k++)
    pxLine(g,x,y,x+fx*2.4+px*k*1.3,y+fy*2.4+py*k*1.3,c);
}

// ---------- Волк: спрайт-лист + попосовая анимация ----------
const HM=(typeof HERO_META!=='undefined')?HERO_META:{cw:24,ch:38,gap:2,n:6,cols:6,rows:1,bx0:1,bx1:22,by0:0,by1:34,legsRow:26};
const HERO={ready:false,frames:null,grid:null,CW:HM.cw,CH:HM.ch,GAP:HM.gap,N:HM.n,
  COLS:HM.cols||HM.n,ROWS:HM.rows||1,anims:HM.anims||null,
  bx0:HM.bx0,bx1:HM.bx1,by0:HM.by0,by1:HM.by1,legsRow:HM.legsRow,
  SW:HM.cw+8,SH:HM.ch+8,can:null,cg:null,im:null,failed:false};
function loadHero(){
  const im=new Image();
  im.onload=()=>{
    if(im.width<HERO.CW*HERO.N||im.height<HERO.CH){HERO.failed=true;return;}
    const c=document.createElement('canvas');c.width=im.width;c.height=im.height;
    const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(im,0,0);
    const d=g.getImageData(0,0,im.width,im.height).data;
    HERO.grid=[];
    for(let r=0;r<HERO.ROWS;r++){
      const rowY=r*(HERO.CH+HERO.GAP);
      if(rowY+HERO.CH>im.height)break;
      const rowArr=[];
      for(let i=0;i<HERO.COLS;i++){
        const colX=i*(HERO.CW+HERO.GAP);
        if(colX+HERO.CW>im.width)break;
        const f=new Uint8Array(HERO.CW*HERO.CH*4);
        for(let y=0;y<HERO.CH;y++)for(let x=0;x<HERO.CW;x++){
          const a=((rowY+y)*im.width+(colX+x))*4,b=(y*HERO.CW+x)*4;
          f[b]=d[a];f[b+1]=d[a+1];f[b+2]=d[a+2];f[b+3]=d[a+3];
        }
        rowArr.push(f);
      }
      HERO.grid.push(rowArr);
    }
    HERO.frames=HERO.grid[0]||[];
    HERO.can=document.createElement('canvas');HERO.can.width=HERO.SW;HERO.can.height=HERO.SH;
    HERO.cg=HERO.can.getContext('2d');
    HERO.im=new ImageData(HERO.SW,HERO.SH);
    HERO.ready=true;
  };
  im.onerror=()=>{HERO.failed=true;};
  im.src=(typeof HERO_META!=='undefined'&&HERO_META.dataUri)?HERO_META.dataUri:'assets/hero.png';
}
function heroBlit(f,lx,dy,lxg,lyg,tint){
  const {CW,CH,SW,SH,im,cg,legsRow}=HERO,d=im.data;
  d.fill(0);
  const ox=(SW-CW)>>1,oy=(SH-CH)>>1;
  for(let y=0;y<CH;y++){
    const sx=(y>=legsRow)?lx:0;
    for(let x=0;x<CW;x++){
      const a=(y*CW+x)*4;
      if(f[a+3]<100)continue;
      const yy=y+oy+dy+lyg,xx=x+ox+sx+lxg;
      if(yy<0||yy>=SH||xx<0||xx>=SW)continue;
      let r=f[a],g=f[a+1],b=f[a+2];
      if(tint>0){r=r+(245-r)*tint;g=g*(1-tint*0.75);b=b*(1-tint*0.75);}
      const k=(yy*SW+xx)*4;
      d[k]=r|0;d[k+1]=g|0;d[k+2]=b|0;d[k+3]=255;
    }
  }
  cg.putImageData(im,0,0);
}

function pickHeroDir(fx,fy){
  const a=Math.atan2(fy,fx);
  const sec=Math.round(a/(Math.PI/4));
  if(sec===0)return 3;
  if(sec===1)return 4;
  if(sec===2)return 0;
  if(sec===3)return 5;
  if(sec===4||sec===-4)return 2;
  if(sec===-3)return 6;
  if(sec===-2)return 1;
  return 7;
}

function pickHeroFrame(p,view,t,ph){
  if(!HERO.anims||!HERO.grid)return HERO.frames[p.crouch?5:(view>3?0:view)];
  let anim='idle',fi=0;
  if(p.hp<=0||G.state==='dead'){
    anim='dead';fi=Math.min(3,Math.floor((t*6)%4));
  }else if(G.redFlash>0.25){
    anim='hurt';fi=G.redFlash>0.4?0:1;
  }else if(p.swing){
    anim='melee';const u=clamp(1-p.swing.t/0.18,0,0.99);fi=Math.floor(u*4);
  }else if(p.atkCd>0&&curWep().def.spd){
    anim='shoot';fi=p.atkCd>curWep().def.cd*0.6?1:(p.atkCd>curWep().def.cd*0.25?2:0);
  }else if(p.reload){
    anim='reload';const u=clamp(p.reload.t/p.reload.max,0,0.99);fi=Math.floor(u*4);
  }else if(G.eHeld&&G.prog>0){
    anim='interact';fi=Math.floor((t*7)%4);
  }else if(p.crouch){
    anim='crouch';fi=p.moving?(Math.floor(ph*0.75)%4):0;
  }else if(p.moving){
    anim=p.run?'run':'walk';fi=Math.floor(ph*0.85)%4;
  }else{
    anim='idle';fi=Math.floor(t*2.2)%4;
  }
  const meta=HERO.anims[anim];
  if(!meta)return HERO.frames[view>3?0:view];
  const dIdx=meta.dirs>1?(view%meta.dirs):0;
  const r=meta.row+dIdx;
  const row=HERO.grid[r];
  return (row&&row[fi%meta.frames])||HERO.frames[0];
}

function drawHeroWeapon(g,w,HX,HY,wx,wy){
  const px=-wy,py=wx;
  if(w==='pistol'||w==='revolver'){
    pxLine(g,HX,HY,HX+wx*6,HY+wy*6,w==='revolver'?'#42464c':'#2e3033',2);
    pxEll(g,HX+wx*1.2+wy*1.2,HY+wy*1.2-wx*1.2,1.1,1.1,'#22242a');
  }else if(w==='shotgun'){
    pxLine(g,HX-wx*2,HY-wy*2,HX+wx*9,HY+wy*9,'#54402a',2);
    pxLine(g,HX,HY,HX+wx*9,HY+wy*9,'#37393b',2);
  }else if(w==='smg'){
    pxLine(g,HX-wx*1.5,HY-wy*1.5,HX+wx*8,HY+wy*8,'#2a2d32',2);
    pxLine(g,HX+wx*3,HY+wy*3,HX+wx*3-wy*2.5,HY+wy*3+wx*2.5,'#1c1e22',1);
  }else if(w==='rifle'){
    pxLine(g,HX-wx*3,HY-wy*3,HX+wx*12,HY+wy*12,'#463522',2);
    pxLine(g,HX,HY,HX+wx*11,HY+wy*11,'#2f3236',2);
    pst(g,HX+Math.round(wx*5-wy*2),HY+Math.round(wy*5+wx*2),'#1d1f24');
  }else if(w==='lever'){
    pxLine(g,HX-wx*3,HY-wy*3,HX+wx*12,HY+wy*12,'#543d24',2);
    pxLine(g,HX,HY,HX+wx*12,HY+wy*12,'#34383d',2);
    pxLine(g,HX+wx*2,HY+wy*2,HX+wx*3+wy*2,HY+wy*3-wx*2,'#8b9095',1);
  }else if(w==='knife'){
    pxLine(g,HX,HY,HX+wx*5,HY+wy*5,'#b8bcc0',1);
    pxEll(g,HX+wx,HY+wy,1,1,'#3c2e1e');
  }else if(w==='saw'){
    pxLine(g,HX,HY,HX+wx*6,HY+wy*6,'#8f959c',2);
    pxEll(g,HX+wx,HY+wy,1,1,'#543d27');
  }else if(w==='axe'){
    pxLine(g,HX-wx,HY-wy,HX+wx*6,HY+wy*6,'#57402a',1);
    pxEll(g,HX+wx*6.5+px*1.2,HY+wy*6.5+py*1.2,1.8,1.6,'#8b9095');
  }
}

function drawPlayer(p){
  const g=bctx;
  const fx=Math.cos(p.face),fy=Math.sin(p.face),px=-fy,py=fx;
  const ph=p.anim||0;
  const X=Math.round(p.x),Y=Math.round(p.y);
  const t=performance.now()/1000;
  pxEll(g,X,Y+6,6,2.4,'rgba(4,6,3,.55)');

  let CX,CY,HX,HY,view=0;
  const w=G.eq[p.cur];
  let wx=fx,wy=fy;
  if(p.swing){
    const u=1-p.swing.t/0.18;
    const sa=p.swing.ang-0.85+u*1.7;
    wx=Math.cos(sa);wy=Math.sin(sa);
  }

  if(HERO.ready){
    view=pickHeroDir(fx,fy);
    const hyOff=p.crouch?-3:-8;
    if(view===0||view===1){ HX=X+(fx>=0?8:-9); HY=Y+hyOff; }
    else if(view===3){ HX=X+1; HY=Y+hyOff; }
    else if(view===2){ HX=X-1; HY=Y+hyOff; }
    else if(view===5||view===7){ HX=X+8; HY=Y+hyOff; }
    else { HX=X-8; HY=Y+hyOff; }

    const isBack=(view===1||view===6||view===7);
    if(isBack&&w) drawHeroWeapon(g,w,HX,HY,wx,wy);

    const f=pickHeroFrame(p,view,t,ph);
    const tint=G.redFlash>0.22?Math.min(0.45,G.redFlash*0.42):0;
    heroBlit(f,0,0,0,0,tint);
    const ox=(HERO.SW-HERO.CW)>>1, oy=(HERO.SH-HERO.CH)>>1;
    const DX=X-ox-Math.round((HERO.bx0+HERO.bx1)/2);
    const DY=Y+6-oy-HERO.by1;
    CX=DX+ox+Math.round((HERO.bx0+HERO.bx1)/2);
    CY=DY+oy+HERO.by0+6;
    g.drawImage(HERO.can,DX,DY);

    if(!isBack&&w) drawHeroWeapon(g,w,HX,HY,wx,wy);
    if(view!==1&&p.hp>0&&G.state!=='dead'){
      const br=(t*0.42+p.x*0.007)%1;
      if(br>0.42){
        const u=(br-0.42)/0.58;
        const a=Math.sin(u*Math.PI)*0.55;
        if(a>0.03){
          const nyOff=p.crouch?-17:-22;
          let nx=X+Math.round(fx*3), ny=Y+nyOff;
          if(view===3)nx=X+5; else if(view===2)nx=X-5;
          else if(view===5)nx=X+3; else if(view===4)nx=X-3;
          const windX=(3.8+Math.sin(t*0.4)*1.4)*u;
          const windY=-3.5*u+Math.sin(u*6+t*2)*0.7;
          const px0=nx+fx*u*2.8+windX, py0=ny+fy*u*1.0+windY;
          g.fillStyle='rgba(220,228,226,'+a.toFixed(2)+')';
          g.fillRect(Math.round(px0),Math.round(py0),u>0.2?2:1,u>0.3?2:1);
          if(u>0.18){
            g.fillStyle='rgba(210,220,218,'+(a*0.72).toFixed(2)+')';
            g.fillRect(Math.round(px0+1.5+windX*0.35),Math.round(py0-1.2),2,1);
          }
          if(u>0.38){
            g.fillStyle='rgba(200,212,210,'+(a*0.45).toFixed(2)+')';
            g.fillRect(Math.round(px0+3.2+windX*0.65),Math.round(py0-2.1),1,1);
          }
        }
      }
    }
  } else {
    if(p._ta===undefined)p._ta=p.face;
    let tda=p.face-p._ta;
    while(tda>Math.PI)tda-=6.2832;
    while(tda<-Math.PI)tda+=6.2832;
    p._ta+=tda*(p.moving?.10:.22);
    const ta=p._ta+Math.sin(ph*.7)*(p.moving?.24:.09);
    const tfx=Math.cos(ta),tfy=Math.sin(ta),tqx=-tfy,tqy=tfx;
    const rbx=X-tfx*1.6,rby=Y-tfy*1.6+2;
    const tcur=(p.moving?.45:0)+Math.sin(performance.now()/900+p.x*.2)*.3;
    const TSP=[];
    for(let i=0;i<=7;i++){
      const q=i/7,L=1.6+q*6.0,bend=tcur*q*q*2.4,tw=3.0-2.0*q;
      TSP.push([rbx-tfx*L+tqx*bend,rby-tfy*L+tqy*bend,tw]);
    }
    for(const s of TSP)pxEll(g,s[0],s[1],s[2]+.35,s[2]+.3,'#1b1710');
    for(const s of TSP)pxEll(g,s[0],s[1],s[2],s[2]*.9,'#544c38');
    for(const s of TSP)pxEll(g,s[0]+tfx*.3,s[1]+tfy*.3,s[2]*.5,s[2]*.42,'#675f49');
    for(const sd of [-2.5,2.5]){
      const st2=p.moving?Math.sin(ph*1.6+(sd<0?0:3.14))*2.2:0;
      pxEll(g,X-fy*sd+fx*st2,Y+fx*sd+fy*st2,1.6,1.8,'#3a342a');
    }
    const bx=X+fx*1.6,by=Y+fy*1.6;
    pxEll(g,bx,by,5.0,5.7,'#241f16');
    pxEll(g,bx,by,4.4,5.1,'#585141');
    CX=X+Math.round(fx*5.4);CY=Y+Math.round(fy*5.4)-1;
    pxEll(g,CX,CY,4.4,4.0,'#17130e');
    pxEll(g,CX,CY,3.6,3.3,'#615a48');
    HX=X+Math.round(fx*7);HY=Y+Math.round(fy*7);
    if(w) drawHeroWeapon(g,w,HX,HY,wx,wy);
    pxEll(g,HX+fy*2,HY-fx*2,1.2,1.2,'#5b5341');
    pxEll(g,HX-fy*2,HY+fx*2,1.2,1.2,'#5b5341');
  }
  if(p.swing){
    if(p.swing.claws){
      for(const rOff of [-4,0,4]){
        for(let a=-.75;a<=.75;a+=.22){
          pxEll(g,p.x+Math.cos(p.swing.ang+a)*(p.swing.reach+rOff),p.y+Math.sin(p.swing.ang+a)*(p.swing.reach+rOff),1,1,'rgba(215,175,160,'+(p.swing.t*3.5)+')');
        }
      }
    } else {
      for(let a=-.9;a<=.9;a+=.25){
        pxEll(g,p.x+Math.cos(p.swing.ang+a)*p.swing.reach,p.y+Math.sin(p.swing.ang+a)*p.swing.reach,1,1,'rgba(220,215,190,'+(p.swing.t*3)+')');}
    }
  }
  if(p.reload){for(let a=-1.57;a<4.7;a+=.55){
    const aa=-1.57+6.283*(p.reload.t/p.reload.max);
    if(a<=aa)pxEll(g,p.x+Math.cos(a)*5,p.y-14+Math.sin(a)*5,.8,.8,'rgba(170,178,140,.7)');}}
  if(p.flashOn)pxEll(g,p.x+fx*9,p.y+fy*9,1.6,1.6,'rgba(232,205,110,.5)');
}

// ---------- твари Тёмного Леса ----------
function drawEnemy(e){
  const g=bctx;
  const now=performance.now();
  let X=Math.round(e.x),Y=Math.round(e.y);
  const fx=Math.cos(e.face),fy=Math.sin(e.face),px=-fy,py=fx;
  const ph=now/145+e.x*.3;
  // судорожное подёргивание тварей в бою
  if(e.state==='fight'&&!e.dead){
    X+=Math.round(Math.sin(now/33+e.y)*.9);
    Y+=Math.round(Math.cos(now/39+e.x)*.9);
  }
  if(e.atkT>0){X+=Math.round(fx*4.2);Y+=Math.round(fy*4.2);}
  const dark=dayL(G.hours)<.6;
  if(e.dead){
    pxEll(g,X,Y+1,e.r+7,8.5,'rgba(64,8,6,.62)');
    pxEll(g,X+2,Y+2,e.r+4,5.5,'rgba(98,14,12,.52)');
    pxEll(g,X,Y,e.r+5,6.5,'rgba(4,6,3,.72)');
    furBall(g,X,Y,e.r+2,e.r-1,'#1e1612',e.x);
    pxEll(g,X,Y-1,4.2,2.8,'#5a1210');
    for(let i=-3;i<=3;i+=2)pxLine(g,X+i,Y-3,X+i+px*2.5,Y+2,'#a69c84');
    pxEll(g,X+fx*5,Y+fy*5,3,2.8,'#342a22');
    pxLine(g,X-5,Y-4,X-10,Y-8,'#282018');pxLine(g,X+5,Y-4,X+10,Y-8,'#282018');
    const flx=X+Math.round(Math.sin(now/160)*5),fly=Y-5+Math.round(Math.cos(now/130)*3.5);
    pst(g,flx,fly,'#080906');pst(g,X-flx+X,Y-fly+Y-7,'#080906');
    return;
  }
  pxEll(g,X,Y+7,e.r+4,e.r*.55,'rgba(2,3,1,.8)');
  if(e.state==='fight'){
    g.globalAlpha=.22+.1*Math.sin(now/105);
    pxEll(g,X,Y,e.r+8,e.r+5,'#4a0907');
    g.globalAlpha=1;
  }
  const bob=Math.sin(ph)*.7;
  if(e.type==='straf'){
    // ШТРАФ: огромный изуродованный лесной монстр-людоед с расщеплённой пастью и костяными рогами
    furBall(g,X-fx*1.5,Y-fy*1.5-2+bob,10.5,11,'#0a0c08',e.x+1);
    furBall(g,X-fx*1.5,Y-fy*1.5-2+bob,9.4,9.8,'#20251c',e.x+1);
    furBall(g,X-fx*5,Y-fy*5+1+bob*.5,6.4,6.8,'#151912',e.x+2);
    // содранная кровящая плоть и торчащие позвонки
    pxEll(g,X-fx*2.5,Y-fy*2.5-2+bob,4.8,3.8,'#5e1210');
    pxEll(g,X-fx*2.5,Y-fy*2.5-2+bob,3.0,2.2,'#8a1a16');
    for(let i=-4;i<=4;i+=2){
      pst(g,X+Math.round(fx*i+px*2),Y+Math.round(fy*i+py*2)-6+Math.round(bob),'#a89e88');
      pst(g,X+Math.round(fx*i-px*2),Y+Math.round(fy*i-py*2)-6+Math.round(bob),'#a89e88');
    }
    // массивные костяные рога-ветви с кровью
    pxLine(g,X-fx*3,Y-fy*3-5,X-fx*12+px*7,Y-fy*12+py*7-9,'#4a4234',2);
    pxLine(g,X-fx*8+px*4,Y-fy*8+py*4-7,X-fx*11+px*9,Y-fy*11+py*9-12,'#756b56',1);
    pxLine(g,X-fx*2,Y-fy*2-5,X-fx*10-px*7,Y-fy*10-py*7-8,'#3c352a',2);
    pxLine(g,X-fx*6-px*4,Y-fy*6-py*4-7,X-fx*9-px*9,Y-fy*9-py*9-11,'#665c49',1);
    pst(g,X-fx*10+px*6,Y-fy*10+py*6-8,'#7d1612');
    // огромная расщеплённая пасть с частыми клыками
    const hx=X+Math.round(fx*7.5),hy=Y+Math.round(fy*7.5)+1;
    const jaw=(e.state==='fight'||e.atkT>0)?4.8:3.2;
    furBall(g,hx,hy,4.8,4.2,'#10130e',e.x+3);
    pxEll(g,hx+fx,hy+fy,3.6,jaw,'#380807');
    pxLine(g,hx-fx+px*jaw,hy-fy+py*jaw,hx-fx-px*jaw,hy-fy-py*jaw,'#7a1612',2);
    for(let i=-3;i<=3;i++){
      pst(g,hx+Math.round(fx*1.8+px*i*1.1),hy+Math.round(fy*1.8+py*i*1.1),'#e6dec6');
      pst(g,hx-Math.round(fx*1.4-px*i*1.0),hy-Math.round(fy*1.4-py*i*1.0),'#cfc7b0');
    }
    // 3 горящих асимметричных глаза
    pst(g,hx+Math.round(fx*1.2+px*1.8),hy+Math.round(fy*1.2+py*1.8),'#ffbe38');
    pst(g,hx+Math.round(fx*1.2-px*1.7),hy+Math.round(fy*1.2-py*1.7),'#ffbe38');
    pst(g,hx+Math.round(fx*2.4),hy+Math.round(fy*2.4)-2,'#ff3824');
    if(dark){g.globalAlpha=.42;pxEll(g,hx+fx,hy+fy,4.6,3.4,'#e89c28');g.globalAlpha=1;}
    // длинные массивные когтистые лапы
    for(const s of [-1,1]){
      const reach=e.atkT>0?14:11;
      pxLine(g,X+px*s*7.5,Y+py*s*7.5,X+fx*reach+px*s*9.5,Y+fy*reach+py*s*9.5+5,'#1d2119',3);
      claw3(g,X+fx*(reach+1)+px*s*9.5,Y+fy*(reach+1)+py*s*9.5+6,fx,fy,px,py,'#d4ccb4');
      pst(g,X+Math.round(fx*(reach+2.5)+px*s*9.5),Y+Math.round(fy*(reach+2.5)+py*s*9.5)+6,'#8a1814');
    }
  } else if(e.type==='hound'){
    // ПЁС: крупная, тощая, бешеная тварь с торчащими рёбрами и окровавленной пастью
    furBall(g,X+fx*4.2,Y+fy*4.2,6.2,5.2,'#0f0c09',e.x+5);
    furBall(g,X+fx*4.2,Y+fy*4.2,5.3,4.4,'#29231a',e.x+5);
    furBall(g,X-fx*3.2,Y-fy*3.2+bob*.4,4.4,3.6,'#1f1a14',e.x+6);
    for(let i=-3;i<=3;i+=2){
      pxLine(g,X+fx*i-px*2.6,Y+fy*i-py*2.6-1,X+fx*i+px*2.6,Y+fy*i+py*2.6-1,'#99907a');
      pst(g,X+Math.round(fx*i),Y+Math.round(fy*i)-4,'#7a1814');
    }
    furBall(g,X+fx*9,Y+fy*9,3.3,2.8,'#383025',e.x+7);
    pxLine(g,X+fx*7+px*3.5,Y+fy*7+py*3.5,X+fx*7-px*3.5,Y+fy*7-py*3.5,'#751410',2);
    for(let i=-2;i<=2;i++)
      pst(g,X+Math.round(fx*8.5+px*i*1.4),Y+Math.round(fy*8.5+py*i*1.4),'#ebe3ce');
    pst(g,X+Math.round(fx*10.5),Y+Math.round(fy*10.5)+2,'#9c1a16');
    pst(g,X+Math.round(fx*6.5+px*2.1),Y+Math.round(fy*6.5+py*2.1),'#ff2818');
    pst(g,X+Math.round(fx*6.5-px*2.1),Y+Math.round(fy*6.5-py*2.1),'#ff2818');
    if(dark){g.globalAlpha=.44;pxEll(g,X+fx*6.5,Y+fy*6.5,4.6,3,'#e82414');g.globalAlpha=1;}
    for(const sd of [-2.8,2.8])for(const d of [-5,4]){
      const off=Math.sin(ph+(d<0?0:3.14)+(sd<0?0:1.57))*1.9;
      pxLine(g,X+px*sd+fx*d,Y+py*sd+fy*d,X+px*sd+fx*d+off,Y+py*sd+fy*d+6,'#19140f',2);
    }
  } else if(e.type==='leshy'){
    // ЛЕШИЙ: громадная корневая тварь с корявой корой, кровавой гнилью, щупальцами и глазами-сучками
    const sw=Math.sin(now/420+e.x)*1.2;
    furBall(g,X+sw,Y-2+bob,11.5,12,'#080a06',e.x+11);
    furBall(g,X+sw,Y-2+bob,10.2,10.8,'#1b140d',e.x+11);
    pxEll(g,X+sw-1,Y-2+bob,5.5,4.8,'#3a1412');
    // ползущие корни-щупальца во все стороны
    for(let i=0;i<6;i++){
      const a=e.face+(i-2.5)*.75+Math.sin(now/260+i)*0.18;
      const len=(e.atkT>0?18:14)+(i%2)*3;
      const rx=X+Math.cos(a)*len, ry=Y+Math.sin(a)*len;
      pxLine(g,X,Y,rx,ry,'#241910',2);
      pxLine(g,rx,ry,rx+Math.cos(a+.4)*4,ry+Math.sin(a+.4)*4,'#5c1612',1);
    }
    // корявые рога и пучки мха
    pxLine(g,X-3,Y-7,X-10,Y-16,'#2d2216',2);
    pxLine(g,X+3,Y-7,X+11,Y-15,'#2d2216',2);
    pxEll(g,X+sw+2,Y-5+bob,3.2,2.4,'#1d2614');
    // множество светящихся глаз-сучков на коре
    for(const [ox,oy,cl] of [[-3,-4,'#f0b840'],[3,-3,'#f0b840'],[0,-7,'#ff3824'],[-5,1,'#e89c28'],[4,2,'#ff3824']]){
      pst(g,X+Math.round(fx*4+ox+sw),Y+Math.round(fy*4+oy),cl);
    }
    if(dark){g.globalAlpha=.42;pxEll(g,X+fx*4,Y+fy*4-3,5.5,4,'#e89c28');g.globalAlpha=1;}
  } else if(e.type==='plague'){
    // ЧУМНОЙ: раздутый гнойный ползун на 6 паучьих лапах с кластером белых глаз
    const jit=Math.sin(now/50+e.x)*1.1;
    pxEll(g,X+jit,Y,6.5,5.5,'#0b0c09');
    pxEll(g,X+jit,Y,5.6,4.6,'#3d3c2e');
    pxEll(g,X+jit-1,Y-1,3.2,2.6,'#5c6632'); // гнойный нарост
    pxEll(g,X+jit+2,Y+1,2.2,1.8,'#6b1814'); // кровавая язва
    for(const s of [-1,1])for(let k=-1;k<=1;k++){
      const wigg=Math.sin(ph*1.8+k*1.5+s)*2.4;
      pxLine(g,X+px*s*4+fx*k*3,Y+py*s*4+fy*k*3,X+px*s*10+fx*k*5+wigg,Y+py*s*10+fy*k*5+3,'#24211a',2);
    }
    const hx=X+Math.round(fx*5.5+jit),hy=Y+Math.round(fy*5.5);
    pxEll(g,hx,hy,2.8,2.5,'#7d7864');
    for(const [ox,oy] of [[-1.5,-1],[1.5,-1],[0,1],[-1,1.5],[1,1.5]])
      pst(g,hx+Math.round(ox),hy+Math.round(oy),'#d8ff66');
    if(dark){g.globalAlpha=.38;pxEll(g,hx,hy,3.8,2.8,'#a8d838');g.globalAlpha=1;}
  } else {
    // НОЧЁЖКА: высокий бледный упырь со сломанной шеей, кричащей пастью и длинными паучьими руками
    const sway=Math.sin(now/480+e.x)*1.8;
    const twitch=Math.sin(now/60+e.y)>.82?(Math.random()>.5?1.5:-1.5):0;
    furBall(g,X+sway,Y-1,6.4,9.2,'#0e0d0a',e.x+9);
    furBall(g,X+sway,Y-1,5.4,8.2,'#2c2922',e.x+9);
    pxEll(g,X+fx+sway,Y+fy+2,3.6,4.6,'#736d5d');
    for(let i=-1;i<=4;i+=2)pxLine(g,X+sway-2.5,Y+i,X+sway+2.5,Y+i,'#1f1b16');
    for(let i=-4;i<=4;i+=2)pst(g,X+sway+i*1.6,Y+11,'#221f19');
    for(const s of [-1,1]){
      pxLine(g,X+px*s*4,Y+py*s*4,X+fx*3+px*s*11,Y+fy*15+py*s*7.5,'#454137',2);
      claw3(g,X+fx*3+px*s*11,Y+fy*15+py*s*7.5,fx,fy,px,py,'#d6ceb8');
    }
    const hx=X+Math.round(px*2.2+sway)+twitch,hy=Y-10;
    pxEll(g,hx,hy,3.8,3.9,'#968f7c');
    pxEll(g,hx,hy+1.6,1.8,2.1,'#070303');
    pst(g,hx,hy+2.6,'#7a1814');
    pst(g,hx+1.5,hy,'#ee2418');pst(g,hx-1.5,hy,'#ee2418');
    if(dark){g.globalAlpha=.44;pxEll(g,hx,hy,4.5,3.2,'#d92418');g.globalAlpha=1;}
    for(const s of [-2,2])
      pxLine(g,X+px*s*2.2,Y+py*s*2.2+6,X+px*s*3.4,Y+py*s*3.4+12,'#24211b',2);
  }
  if(e.state==='fight'){
    pxEll(g,X,Y-20,1.8,2.6,'rgba(225,50,36,.95)');
    pst(g,X,Y-16,'rgba(225,50,36,.95)');}
  if(e.hp<e.max){
    g.fillStyle='rgba(8,10,7,.9)';g.fillRect(X-10,Y-25,20,2);
    g.fillStyle='#992218';g.fillRect(X-10,Y-25,Math.round(20*(e.hp/e.max)),2);}
}

// ---------- мини-карта ----------
function drawMinimap(){
  const el=UI.el.mm; if(!el||!World||!World.mm)return;
  const g=UI.el.mmg,S=MM_S;
  g.imageSmoothingEnabled=false;
  g.drawImage(World.mm,0,0,MAPW,MAPH,0,0,MAPW*S,MAPH*S);
  const d=World.mmFogImg.data,ex=World.explored;
  for(let i=0;i<MAPW*MAPH;i++){const q=i*4;
    d[q]=5;d[q+1]=7;d[q+2]=5;
    d[q+3]=ex[i]===0?238:(ex[i]===1?105:28);}
  World.mmFogCtx.putImageData(World.mmFogImg,0,0);
  g.drawImage(World.mmFog,0,0,MAPW,MAPH,0,0,MAPW*S,MAPH*S);
  for(const c of World.conts){
    const ti=c.ty*MAPW+c.tx; if(ex[ti]===0)continue;
    let col='#55534a';
    if(c.base)col=c.type==='stash'?'#8a805f':'#55534a';
    else if(!c.searched&&c.items.length){
      let mr=0;for(const it of c.items)mr=Math.max(mr,ITEMS[it.id].r);
      col=RAR[mr];}
    g.fillStyle=col;g.fillRect(c.tx*S,c.ty*S,S,S);}
  const tent=World.tent;
  if(tent){g.fillStyle='#8fae72';g.fillRect(tent.x*S,tent.y*S,3*S/2,2*S/2+1);}
  for(const e of G.enemies){
    if(e.dead)continue;
    const ti=(e.y/TS|0)*MAPW+(e.x/TS|0);
    if(ex[ti]!==2)continue;
    g.fillStyle=e.state==='fight'?'#d05a44':'#a04a3a';
    g.fillRect((e.x/TS|0)*S-1,(e.y/TS|0)*S-1,S+2,S+2);}
  const pxr=G.p.x/TS,pyr=G.p.y/TS;
  g.fillStyle='#e8e4d0';
  g.fillRect(Math.round(pxr)*S-S/2,Math.round(pyr)*S-S/2,S+1,S+1);
  g.fillRect(Math.round(pxr+Math.cos(G.p.face)*2.6)*S,Math.round(pyr+Math.sin(G.p.face)*2.6)*S,1,1);
}

// ---------- расставленное, проломы, Торг ----------
function drawPlaced(pl){
  const g=bctx,x=Math.round(pl.x),y=Math.round(pl.y);
  if(pl.kind==='trap'){
    pxLine(g,x-4,y-3,x+4,y+3,'#8d9297');pxLine(g,x-4,y+3,x+4,y-3,'#8d9297');
    pst(g,x,y,'#b4b9be');
    pxLine(g,x-4,y-3,x-7,y-5,'#5a5341');pxLine(g,x+4,y+3,x+7,y+5,'#5a5341');
  } else {
    g.fillStyle='#7d848c';g.fillRect(x-1,y-2,3,4);
    pst(g,x,y-2,'#98a0a8');
    pxLine(g,x-3,y-5,x+3,y-5,'#5d564a');
    pst(g,x-3,y-4,'#4a453a');pst(g,x+3,y-4,'#4a453a');
  }
}
function drawBrokenFence(){
  const g=bctx;
  for(const s of World.segs){
    if(s.hp>0)continue;
    for(const ti of s.tiles){
      const x=(ti%MAPW)*TS,y=(ti/MAPW|0)*TS;
      g.fillStyle='#241d13';
      g.fillRect(x+2,y+10,3,5);g.fillRect(x+11,y+3,2,6);
      pxLine(g,x+1,y+13,x+8,y+5,'#31281a');
      pst(g,x+6,y+12,'#4a4030');
    }
  }
}
function drawTrader(){
  const tp=World.trader; if(!tp)return;
  const ti=tp.y*MAPW+tp.x;
  if(World.explored[ti]===0)return;
  const g=bctx,X=tp.x*TS+8,Y=tp.y*TS+8;
  pxEll(g,X,Y+7,5.5,2.2,'rgba(4,6,3,.5)');
  pxEll(g,X,Y,5.4,6.8,'#14100b');
  pxEll(g,X,Y,4.6,6,'#3d3830');
  g.fillStyle='#6e2f28';g.fillRect(X-2,Y-2,5,7);
  pst(g,X+1,Y+1,'#8a3b30');pst(g,X-1,Y+4,'#55241f');
  pxEll(g,X,Y-7,3.2,2.9,'#14100b');
  pxEll(g,X,Y-7,2.5,2.3,'#8b8577');
  pst(g,X-1,Y-8,'#a29b8a');
  pst(g,X-1,Y-6.5,'#3c2a20');pst(g,X+1,Y-6.5,'#3c2a20');
  pxLine(g,X+4,Y-1,X+7,Y-3,'#9aa0a6',1);
  g.fillStyle='#b4b9be';g.fillRect(X+6,Y-6,2,4);
}

// ---------- сон и смерть ----------
function doSleep(){
  const p=G.p;
  const threat=G.enemies.some(e=>!e.dead&&e.state==='fight'&&dst(e.x,e.y,p.x,p.y)<16*TS);
  if(dayL(G.hours)<.35&&(World.anyBreach||threat)){
    SFX.dry();
    log('Спать нельзя — забор проломлен или твари слишком близко!','c9584a');
    return;
  }
  G.paused=true;
  const tlv=(G.upg&&G.upg.tent)||1, td=BASE_UPG.tent[tlv];
  const hpGain=p.hunger>60?td.heal:td.healLow;
  p.hp=Math.min(100,p.hp+hpGain);
  p.hunger=Math.max(0,p.hunger-td.hLoss);
  p.thirst=Math.max(0,p.thirst-td.tLoss);
  p.bleed=0;
  if(td.vig>0)p.vigourT=td.vig;
  G.hours=DAY_START;G.day++;
  const traps=regenWorld();
  UI.el.exfil.classList.add('hidden');
  $('sleepStat').innerHTML=
    'День '+G.day+'. Вы проснулись — и лес за окном другой.<br>'+
    'Убежище: '+td.n+' · Здоровье +'+hpGain+(td.vig?' · Баф «БОДРЫЙ»!':'')+'<br>'+
    'Волк: пока ты спал, урочище переставило себя заново. Дорога, река, избушки, ящики — всё на новых местах.<br>'+
    'Схрон при вас: его '+((World.conts.find(c=>c.type==='stash')||{fixed:20}).fixed)+' ячеек лес не трогает.'+
    (traps?'<br>Собранные растяжки и жестянки ('+traps+' шт.) возвращены в рюкзак и схрон.':'')+
    '<br>Забор лагеря снова целый, хлипкий сегмент в этот раз '+(SIDE_N[World.campWeak]||'с другой стороны')+'.';
  $('sleepPanel').classList.remove('hidden');
}
function wakeUp(){
  $('sleepPanel').classList.add('hidden');
  G.paused=false;
  log('День '+G.day+'. Лес новый. Тропы другие.','97a17f');
  log('Волк: тут я ещё не ходил. Осмотрись.','b0a888');
  saveGame(true);
}
function die(){
  G.state='dead';
  if(G.ui.panel)closePanel();
  $('deadCause').textContent='причина: '+G.p.cause;
  $('deadStat').innerHTML=
    'Продержались в Сером Лесу: <b style="color:#a9a288">'+G.day+' дн.</b><br>'+
    'Сбито врагов: '+G.stats.kills+'<br>'+
    'Обыскано контейнеров: '+G.stats.looted+'<br>'+
    'Вынесено ценностей (на момент смерти): ~'+G.stats.value;
  $('deadPanel').classList.remove('hidden');
  if(SFX.musicUpdate)SFX.musicUpdate({mode:'dead',threat:0,hp:0});
  SFX.saw();
}

addEventListener('load',boot);
