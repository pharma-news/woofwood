'use strict';
/* ============ сущности: игрок, твари, пули, частицы, предметы ============ */

function newPlayer(x,y){
  return {x,y,r:7,hp:100,hunger:88,thirst:82,stam:100,bleed:0,
    crouch:false,face:0,atkCd:0,stepT:0,anim:0,cause:'лес',
    flashOn:false,flashT:300,reload:null};
}

// ---- инвентарь ----
function addItem(id,n){
  const stk=ITEMS[id].stk||1;
  for(const s of G.inv){ if(s&&s.id===id&&s.n<stk){const add=Math.min(n,stk-s.n);s.n+=add;n-=add;if(!n)return 0;} }
  for(let i=0;i<G.inv.length&&n>0;i++){
    if(!G.inv[i]){const add=Math.min(n,stk);G.inv[i]={id,n:add};n-=add;}
  }
  return n; // сколько не влезло
}
function addItemToStash(id,n){
  if(!G.stash)return n;
  const stk=ITEMS[id].stk||1;
  for(const s of G.stash){ if(s&&s.id===id&&s.n<stk){const add=Math.min(n,stk-s.n);s.n+=add;n-=add;if(!n)return 0;} }
  for(let i=0;i<G.stash.length&&n>0;i++){
    if(!G.stash[i]){const add=Math.min(n,stk);G.stash[i]={id,n:add,known:true,cost:null};n-=add;}
  }
  return n;
}
function countItem(id){let c=0;for(const s of G.inv)if(s&&s.id===id)c+=s.n;return c;}
function countTotalItem(id){
  let c=countItem(id);
  if(G.stash)for(const s of G.stash)if(s&&s.id===id)c+=s.n;
  return c;
}
function removeItem(id,n){
  for(let i=0;i<G.inv.length&&n>0;i++){const s=G.inv[i];
    if(s&&s.id===id){const take=Math.min(n,s.n);s.n-=take;n-=take;if(s.n<=0)G.inv[i]=null;}}
}
function removeTotalItem(id,n){
  for(let i=0;i<G.inv.length&&n>0;i++){const s=G.inv[i];
    if(s&&s.id===id){const take=Math.min(n,s.n);s.n-=take;n-=take;if(s.n<=0)G.inv[i]=null;}}
  if(n>0&&G.stash){
    for(let i=0;i<G.stash.length&&n>0;i++){const s=G.stash[i];
      if(s&&s.id===id){const take=Math.min(n,s.n);s.n-=take;n-=take;if(s.n<=0)G.stash[i]=null;}}
  }
}
function invFree(){let c=0;for(const s of G.inv)if(!s)c++;return c;}
function canFitItem(id,n,extraFree){
  const stk=ITEMS[id].stk||1;
  let rem=n;
  for(const s of G.inv){if(s&&s.id===id&&s.n<stk)rem-=stk-s.n;if(rem<=0)return true;}
  const free=invFree()+(extraFree||0);
  return rem<=free*stk;
}

// ---- оружие игрока ----
function curWep(){
  const slot=G.p.cur;
  if(slot==='blade'&&G.eq.blade)return {slot,id:G.eq.blade,def:ITEMS[G.eq.blade].w,st:G.ws.blade};
  if((slot==='gunA'||slot==='gunB')&&G.eq[slot])return {slot,id:G.eq[slot],def:ITEMS[G.eq[slot]].w,st:G.ws[slot]};
  // Волчьи когти вместо безоружных кулаков
  return {slot:'fists',id:null,def:{dmg:14,cd:.48,reach:26,bleed:1},st:G.ws.fists};
}
function noiseAt(x,y,r){G.noises.push({x,y,r,t:0});G.rings.push({x,y,r,t:0});}

function fireWeapon(){
  const p=G.p, w=curWep(), d=w.def, st=w.st;
  if(p.atkCd>0)return;
  if(!w.id||d.dmg&&!d.spd){ // когти / холодное оружие
    p.atkCd=d.cd; p.swing={t:.18,ang:p.face,reach:d.reach,claws:!w.id};
    noiseAt(p.x,p.y,1.5*TS);
    let hit=false;
    for(const e of G.enemies){ if(e.dead)continue;
      const dd=dst(p.x,p.y,e.x,e.y);
      if(dd<d.reach+e.r&&Math.abs(angDiff(p.face,Math.atan2(e.y-p.y,e.x-p.x)))<1.25){
        hurtEnemy(e,d.dmg,true,d.bleed||0);hit=true;}
    }
    if(hit)SFX.hitFlesh(); else if(SFX.swing)SFX.swing(!w.id); else SFX.dry();
    return;
  }
  // огнестрел
  if(p.reload){return;}
  if(st.mag<=0){SFX.dry();startReload();return;}
  st.mag--; p.atkCd=d.cd;
  const n=d.pellets||1;
  for(let i=0;i<n;i++){
    const a=p.face+(Math.random()*2-1)*d.spread, s=d.spd*(0.9+Math.random()*.2);
    G.bullets.push({x:p.x+Math.cos(p.face)*12,y:p.y+Math.sin(p.face)*12,
      vx:Math.cos(a)*s,vy:Math.sin(a)*s,dmg:d.dmg,life:d.life,from:'p',bleed:d.bleed||0});
  }
  G.parts.push({x:p.x+Math.cos(p.face)*14,y:p.y+Math.sin(p.face)*14,vx:0,vy:0,t:.06,tl:.06,type:'muzzle'});
  G.shake=Math.min(8,(d.pellets?5:2.5));
  noiseAt(p.x,p.y,d.noise*TS);
  SFX.shot(w.id||'p');
}
function startReload(){
  const p=G.p, w=curWep(), d=w.def;
  if(!d.spd||!d.ammo)return;
  if(w.st.mag>=d.mag||countItem(d.ammo)<=0)return;
  p.reload={t:0,max:d.rel,slot:w.slot,ammo:d.ammo,id:w.id};
  if(SFX.reloadStart)SFX.reloadStart(w.id);else SFX.dry();
}
function angDiff(a,b){let d=a-b;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d;}

// ---- контейнеры ----
function pickWeighted(tab){
  let s=0;for(const q of tab)s+=q[1];
  let r=Math.random()*s;
  for(const q of tab){r-=q[1];if(r<=0)return q[0];}
  return tab[0][0];
}
function rollLoot(ctype){
  const def=CTYPE[ctype],list=[];
  for(const roll of def.rolls){
    const [tab,n,prob]=roll;
    if(prob!==undefined&&Math.random()>prob)continue;
    for(let i=0;i<n;i++){
      const id=pickWeighted(LOOT[tab]), d=ITEMS[id];
      const cnt=d.stk>3?1+Math.floor(Math.random()*Math.min(7,d.stk-1)):1;
      list.push({id,n:cnt});
    }
  }
  return list;
}
function addContainer(ctype,tx,ty){
  const def=CTYPE[ctype],its=rollLoot(ctype);
  for(const it of its){it.known=false;it.cost=null;}
  const c={type:ctype,x:tx*TS+8,y:ty*TS+8,tx,ty,items:its,searched:false,sacc:0,visited:false};
  if(def.own){ // своё хранилище: фиксированные ячейки, искать нечего, всё и так на виду
    c.base=true;c.fixed=def.slots||20;
    c.items=new Array(c.fixed).fill(null);
  }
  if(c.fixed){ // в фиксированном хранилище пустые ячейки — это null
    c.searched=unknownIdx(c)<0;
  } else if(!c.items.length)c.searched=true;
  if(World)World.conts.push(c);
  return c;
}

// ---- твари Тёмного Леса: никакого огнестрела, только когти и пасть ----
const ENAMES={straf:'Штраф',hound:'Пёс',scav:'Ночёжка',leshy:'Леший',plague:'Чумной'};
const EVERB={scav:{felt:'почуяла',killed:'сбита'},def:{felt:'почуял',killed:'сбит'}};
const EBASE={
  straf:{hp:115,r:15,spd:28,dmg:19,cd:1.1,bleed:1,sight:10.5},
  hound:{hp:42,r:10,spd:66,dmg:12,cd:.75,bleed:1,sight:9.5},
  scav:{hp:68,r:12,spd:36,dmg:14,cd:.95,bleed:0,sight:9.5},
  leshy:{hp:155,r:16,spd:22,dmg:24,cd:1.25,bleed:2,sight:10.5},
  plague:{hp:54,r:10,spd:48,dmg:15,cd:.82,bleed:1,sight:9.5},
};
function makeEnemy(x,y,type,role){
  const s=1+(G.day-1)*.15,b=EBASE[type];
  const e={type,role,x,y,r:b.r,face:0,dead:false,state:'wander',
    t:0,tx:x,ty:y,atkCd:0,atkT:0,alerted:false,anchor:{x,y},
    hp:b.hp*s,max:b.hp*s,spd:b.spd,dmg:b.dmg*s,cd:b.cd,bleed:b.bleed,
    eBleed:0,_blT:0,sight:b.sight,stealN:0,searchT:0,goal:null,fenceCd:0,slowT:0};
  G.enemies.push(e);
  return e;
}
function spawnPatrols(){
  let alive=0;for(const e of G.enemies)if(!e.dead&&e.role==='patrol')alive++;
  const need=Math.max(0,7-alive);
  const pts=(World&&World.spawns.length)?World.spawns:[['straf',40,30],['leshy',18,28],['plague',62,22]];
  const kinds=['straf','leshy','plague','hound','straf','plague','leshy'];
  for(let i=0;i<need;i++){
    const q=pts[i%pts.length];
    const kind=(i<pts.length&&i%2===0)?q[0]:kinds[i%kinds.length];
    const ox=((i*17)%9)-4, oy=((i*13)%7)-3;
    const tx=clamp(q[1]+ox,4,MAPW-5), ty=clamp(q[2]+oy,4,MAPH-5);
    const e=makeEnemy(tx*TS+8,ty*TS+8,kind,'patrol');
    e.anchor={x:e.x,y:e.y};e.tx=e.anchor.x;e.ty=e.anchor.y;
  }
  if(need>0&&G.day>1)log('К утру в урочище снова пробираются твари.','8aa06b');
}
function spawnNights(){ // ночные охотники: псы, чумные и лешие
  const xs=(World&&World.nightXs.length)?World.nightXs:[42,58,74,90];
  const nKinds=['hound','plague','hound','leshy'];
  xs.forEach((x,i)=>{
    const y=roadYAt(x)+1;
    const e=makeEnemy(x*TS+8,y*TS+8,nKinds[i%nKinds.length],'night');
    e.anchor={x:e.x,y:e.y};
  });
  log('У реки воют псы. Ночью урочище кишит тварями.','c9584a');
  log('Волк: чужие вышли на охоту.','b0a888');
}
function spawnScavs(){ // 21:00 — ночёжки идут рыться в припасах
  const a=makeEnemy(3*TS,roadYAt(3)*TS,'scav','scav');
  const b=makeEnemy((MAPW-3)*TS,roadYAt(MAPW-3)*TS,'scav','scav');
  const c=makeEnemy(Math.round(MAPW*.5)*TS,3*TS,'scav','scav');
  for(const e of [a,b,c]){
    let best=null,bd=1e9;
    for(const c of World.conts){
      if(c.type==='corpse'||c.items.length===0)continue;
      if(c.base||inCamp(c.x,c.y))continue; // лагерь и схрон для них закрыты
      const d=dst(e.x,e.y,c.x,c.y);
      if(d<bd&&d<55*TS){bd=d;best=c;}
    }
    e.goal=best;
  }
  log('Волк: ночёжки проснулись. Они роются в наших припасах.','b0a888');
}
function seePlayer(e){
  const p=G.p, d=dst(e.x,e.y,p.x,p.y);
  const L=dayL(G.hours);
  let sight=e.sight*TS*(0.7+0.3*L);
  const tile=World.tileAt(p.x/TS|0,p.y/TS|0);
  if(p.crouch){ if(tile===TILE.TALL)sight=Math.min(sight,3.4*TS); else sight*=.55; }
  if(d>sight)return false;
  if(d<2*TS)return true;
  return losClear(e.x/TS,e.y/TS,p.x/TS,p.y/TS);
}
function stepTo(e,tx,ty,spd,dt){
  const a0=Math.atan2(ty-e.y,tx-e.x);
  for(const off of [0,.65,-.65,1.4,-1.4,2.2,-2.2]){
    const a=a0+off,nx=e.x+Math.cos(a)*spd*dt,ny=e.y+Math.sin(a)*spd*dt;
    if(!collidesE(nx,ny,e.r)){e.x=nx;e.y=ny;e.face=a;return true;}
  }
  return false;
}
function hurtEnemy(e,dmg,melee,bleed){
  if(dmg>0){
    e.hp-=dmg;e.alerted=true;e.state='fight';e.tx=G.p.x;e.ty=G.p.y;
    bloodAt(e.x,e.y);
  }
  if(bleed&&!e.dead)e.eBleed=Math.min(3,(e.eBleed||0)+bleed);
  if(e.hp<=0&&!e.dead){
    e.dead=true;e.t=8;
    SFX.death(e.type);
    const c=addContainer('corpse',0,0);
    c.x=e.x;c.y=e.y;c.tx=e.x/TS|0;c.ty=e.y/TS|0;
    c.items=[{id:'meat',n:1+(Math.random()*2|0),known:false,cost:null}];
    if(Math.random()<.3)c.items.push({id:pickWeighted([['painkillers',3],['coins',4],['ring',2],['battery',3],['cloth',4]]),n:1,known:false,cost:null});
    c.searched=false;c.sacc=0;
    G.stats.kills++;
    const vb=(EVERB[e.type]||EVERB.def).killed;
    log(ENAMES[e.type]+' '+vb+'.','b9b4a7');
  }
}
function bloodAt(x,y){
  for(let i=0;i<7;i++)
    pxEll(World.g,x+(Math.random()*14-7),y+(Math.random()*14-7),
      1+Math.random()*2.5,1+Math.random()*2,'rgba(96,22,18,.5)');
  for(let i=0;i<12;i++)G.parts.push({x,y,vx:(Math.random()*2-1)*60,vy:(Math.random()*2-1)*60,t:.3,tl:.3,type:'blood'});
}
function hurtPlayer(dmg,cause,bleed){
  const p=G.p;
  if(G.state!=='play')return;
  p.hp-=dmg;p.cause=cause;G.redFlash=Math.min(.6,G.redFlash+dmg/60);
  G.shake=Math.max(G.shake,3);SFX.hurt();bloodAt(p.x,p.y);
  if(bleed)p.bleed=Math.min(4,p.bleed+bleed);
}

function spdOf(e){return e.spd*(e.slowT>0?.5:1);}
function nearestSeg(e){
  let best=null,bd=1e9;
  for(const s of World.segs){
    if(s.hp<=0)continue;
    for(const ti of s.tiles){
      const d=dst(e.x,e.y,(ti%MAPW)*TS+8,(ti/MAPW|0)*TS+8);
      if(d<bd){bd=d;best=s;}}
  }
  return best;
}
function updPlaced(dt){
  for(const pl of World.placed){
    if(pl.cd>0){pl.cd-=dt;continue;}
    for(const e of G.enemies){
      if(e.dead)continue;
      if(dst(pl.x,pl.y,e.x,e.y)<16){
        if(pl.kind==='trap'){
          pl.used=true;
          noiseAt(pl.x,pl.y,11*TS);SFX.trap();
          G.parts.push({x:pl.x,y:pl.y,vx:0,vy:0,t:.12,tl:.12,type:'muzzle'});
          for(let i=0;i<9;i++)G.parts.push({x:pl.x,y:pl.y,vx:(Math.random()*2-1)*90,vy:(Math.random()*2-1)*90,t:.35,tl:.35,type:'spark'});
          hurtEnemy(e,55,false,2);
          log('Ловушка сработала!','d8c07a');
        } else {
          pl.cd=9;
          noiseAt(pl.x,pl.y,7*TS);SFX.rattle();
          e.slowT=2.2;
          log('Жестянка звякнула — кто-то у периметра.','d8c07a');
        }
        break;
      }
    }
  }
  World.placed=World.placed.filter(q=>!q.used);
}

function updEnemies(dt){
  const p=G.p;
  for(const e of G.enemies){
    if(e.dead){e.t-=dt;continue;}
    if(e.eBleed>0){
      e.hp-=2.0*e.eBleed*dt;
      e._blT-=dt;
      if(e._blT<=0){
        e._blT=.7;
        G.parts.push({x:e.x,y:e.y,vx:(Math.random()*2-1)*18,vy:(Math.random()*2-1)*18,t:.35,tl:.35,type:'blood'});
      }
      if(e.hp<=0){hurtEnemy(e,0,false,0);continue;}
    }
    if(e.atkCd>0)e.atkCd-=dt;
    if(e.atkT>0)e.atkT-=dt;
    if(e.slowT>0)e.slowT-=dt;
    e._vocT=(e._vocT!==undefined?e._vocT:(2+Math.random()*6))-dt;
    if(e._vocT<=0){
      const dToP=dst(e.x,e.y,p.x,p.y);
      if(dToP<16*TS&&SFX.monsterAmbient)SFX.monsterAmbient(e.type,Math.max(.15,1-dToP/(16*TS)),e.state==='fight');
      e._vocT=(e.state==='fight'?2.8:5.5)+Math.random()*5.5;
    }
    // слух
    for(const no of G.noises){
      if(dst(e.x,e.y,no.x,no.y)<no.r&&e.state!=='fight'){e.state='move';e.tx=no.x;e.ty=no.y;}
    }
    const sees=seePlayer(e);
    if(sees&&e.state!=='fight'){
      if(!e.alerted){e.alerted=true;SFX.growl(e.type);
        G.parts.push({x:e.x,y:e.y-14,vx:0,vy:0,t:1,tl:1,type:'bang'});
        const vb=(EVERB[e.type]||EVERB.def).felt;
        log(ENAMES[e.type]+' вас '+vb+'!','c9584a');}
      e.state='fight';
    }
    if(e.state==='fight'){
      if(sees){e.tx=p.x;e.ty=p.y;}
      const d=dst(e.x,e.y,p.x,p.y);
      const safe=inCamp(p.x,p.y)!==inCamp(e.x,e.y); // через забор кусать нельзя
      if(d<e.r+p.r+10&&!safe){
        if(e.atkCd<=0){e.atkCd=e.cd;e.atkT=.25;SFX.bite();
          hurtPlayer(e.dmg,ENAMES[e.type].toLowerCase(),e.bleed);}
        stepTo(e,p.x,p.y,spdOf(e)*.3,dt);
      } else {
        const cornered=inCamp(e.tx,e.ty)&&!inCamp(e.x,e.y);
        stepTo(e,e.tx,e.ty,spdOf(e),dt);
        if(cornered){
          if(G._fenceMsg!==G.day){G._fenceMsg=G.day;
            log('Что-то ломится в дверь лагеря!','c9584a');}
          e.fenceCd-=dt;
          if(e.fenceCd<=0){
            e.fenceCd=1.3;e.atkT=.25;SFX.scratch();
            const s=nearestSeg(e);
            if(s&&s.hp>0){
              s.hp=Math.max(0,s.hp-Math.max(4,Math.round(e.dmg*.55)));
              const dlv=(G.upg&&G.upg.doors&&G.upg.doors[s.side])||1, th=BASE_UPG.door[dlv].thorns||0;
              if(th>0){
                hurtEnemy(e,th,false,dlv>=4?1:0);
                if(dlv>=5)e.slowT=1.5;
                G.parts.push({x:e.x,y:e.y,vx:0,vy:0,t:.12,tl:.12,type:'spark'});
              }
              if(s.hp===0){World.anyBreach=true;
                log('ДВЕРЬ ПРОЛОМАНА с '+SIDE_N[s.side]+' стороны!','c9584a');
                SFX.thud();noiseAt(e.x,e.y,12*TS);}
            }
          }
        }
      }
    } else if(e.role==='scav'){
      if(e.state==='wander'||e.state==='move'){
        if(e.goal&&dst(e.x,e.y,e.goal.x,e.goal.y)<16){e.state='loot';e.searchT=4;
          log('Ночёжка обшаривает: '+CTYPE[e.goal.type].n.toLowerCase(),'c9584a');}
        else if(e.goal)stepTo(e,e.goal.x,e.goal.y,spdOf(e),dt);
        else e.state='leave';
      } else if(e.state==='loot'){
        e.searchT-=dt;
        if(e.searchT<=0){
          for(let i=0;i<3&&e.goal.items.length;i++){e.goal.items.pop();e.stealN++;}
          e.searchT=2.5;
          if(e.goal.items.length===0)e.state='leave';
        }
      } else if(e.state==='leave'){
        const ex=e.x>World.canvas.width/2?(MAPW-4)*TS:4*TS;
        if(!stepTo(e,ex,roadYAt(ex/TS|0)*TS,spdOf(e),dt))stepTo(e,ex,40*TS,spdOf(e),dt);
        if(e.x<5*TS||e.x>(MAPW-5)*TS){
          e.dead=true;e.t=0.1;
          if(e.stealN)log('Ночёжки утащили/изгадили вещей: '+e.stealN,'c9584a');
        }
      }
    } else if((G.hours>=21||G.hours<5)&&e.role!=='scav'){
      // ночная осада: твари стягиваются к периметру лагеря
      stepTo(e,p.x,p.y,spdOf(e)*(e.type==='hound'?1:.85),dt);e.state='fight';
    } else {
      // блуждание у своей тропы
      e.t-=dt;
      if(e.t<=0){e.t=3+Math.random()*5;
        e.tx=e.anchor.x+(Math.random()*2-1)*9*TS;
        e.ty=e.anchor.y+(Math.random()*2-1)*9*TS;}
      stepTo(e,e.tx,e.ty,spdOf(e)*.55,dt);
    }
  }
  G.enemies=G.enemies.filter(e=>!(e.dead&&e.t<=0));
}

function updBullets(dt){
  const p=G.p;
  for(const b of G.bullets){
    let rem=Math.hypot(b.vx,b.vy)*dt;
    const st=6;
    while(rem>0&&b.life>0){
      const step=Math.min(st,rem);rem-=step;b.life-=step/Math.hypot(b.vx,b.vy);
      b.x+=b.vx/Math.hypot(b.vx,b.vy)*step;b.y+=b.vy/Math.hypot(b.vx,b.vy)*step;
      if(losSolid(b.x/TS|0,b.y/TS|0)){
        G.parts.push({x:b.x,y:b.y,vx:0,vy:0,t:.1,tl:.1,type:'spark'});b.life=-1;break;}
      if(b.from==='p'){
        for(const e of G.enemies){if(e.dead)continue;
          if(dst(b.x,b.y,e.x,e.y)<e.r+2){hurtEnemy(e,b.dmg,false,b.bleed);b.life=-1;break;}}
      } else {
        if(dst(b.x,b.y,p.x,p.y)<p.r+2){
          hurtPlayer(b.dmg,'ночёжка',0);b.life=-1;}
      }
    }
  }
  G.bullets=G.bullets.filter(b=>b.life>0);
}
function updParts(dt){
  for(const q of G.parts){q.t-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;
    if(q.type==='smoke'){q.vy-=8*dt;q.vx+=Math.sin(q.t*4)*4*dt;}}
  G.parts=G.parts.filter(q=>q.t>0);
  for(const r of G.rings){r.t+=dt;}
  G.rings=G.rings.filter(r=>r.t<r.r/120);
  for(const no of G.noises){no.t+=dt;}
  G.noises=G.noises.filter(n=>n.t<6);
}
