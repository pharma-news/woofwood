'use strict';
/* ============ мир: тайлы, постройки, видимость, пиксель-рендер ============ */
var World=null;

/* ---- местность: дорога, река, мост. Пересоздаются каждое утро ---- */
var LY={roadY0:40,roadA:2,roadP:16,rvA:74,rvB:60,rvW:3,rvP:9,rvPh:0,brY:40};
function roadYAt(x){return Math.round(LY.roadY0+LY.roadA*Math.sin(x/LY.roadP));}
function streamXAt(y){return LY.rvA+(LY.rvB-LY.rvA)*(y/MAPH)+Math.sin(y/LY.rvP+LY.rvPh)*LY.rvW;}

/* ---- пиксельные примитивы (без сглаживания) ---- */
function pst(g,x,y,c){g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),1,1);}
function pxEll(g,cx,cy,rx,ry,c){
  g.fillStyle=c;cx=Math.round(cx);cy=Math.round(cy);
  rx=Math.max(.6,rx);ry=Math.max(.6,ry);
  for(let y=-Math.ceil(ry);y<=Math.ceil(ry);y++)
    for(let x=-Math.ceil(rx);x<=Math.ceil(rx);x++)
      if((x*x)/(rx*rx)+(y*y)/(ry*ry)<=1)g.fillRect(cx+x,cy+y,1,1);
}
function pxLine(g,x0,y0,x1,y1,c,th){
  g.fillStyle=c;x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
  const n=Math.max(1,Math.max(Math.abs(x1-x0),Math.abs(y1-y0)));
  th=th||1;
  for(let i=0;i<=n;i++){
    const x=x0+Math.round((x1-x0)*i/n),y=y0+Math.round((y1-y0)*i/n);
    g.fillRect(x-(th>>1),y-(th>>1),th,th);
  }
}
function pxCirc(g,cx,cy,r,c){
  g.fillStyle=c;const n=Math.max(8,Math.round(r*6));
  for(let i=0;i<n;i++){const a=i/n*6.2832;g.fillRect(Math.round(cx+Math.cos(a)*r),Math.round(cy+Math.sin(a)*r),1,1);}
}
function pxTri(g,x0,y0,x1,y1,x2,y2,c){ // залитый пиксельный треугольник (уши, кисти)
  g.fillStyle=c;
  const ax=Math.floor(Math.min(x0,x1,x2)),bx=Math.ceil(Math.max(x0,x1,x2));
  const ay=Math.floor(Math.min(y0,y1,y2)),by=Math.ceil(Math.max(y0,y1,y2));
  const cr=(px,py,qx,qy,rx,ry)=>(qx-px)*(ry-py)-(qy-py)*(rx-px);
  let sg=cr(x0,y0,x1,y1,x2,y2);if(!sg)sg=1;
  for(let y=ay;y<=by;y++)for(let x=ax;x<=bx;x++){
    const cxp=x+.5,cyp=y+.5;
    if(cr(x0,y0,x1,y1,cxp,cyp)*sg>=0&&cr(x1,y1,x2,y2,cxp,cyp)*sg>=0&&cr(x2,y2,x0,y0,cxp,cyp)*sg>=0)
      g.fillRect(x,y,1,1);
  }
}
function pxRect(g,x,y,w,h,c){
  g.fillStyle=c;
  g.fillRect(x,y,w,1);g.fillRect(x,y+h-1,w,1);
  g.fillRect(x,y,1,h);g.fillRect(x+w-1,y,1,h);
}

function buildWorld(seed){
  if(seed===undefined)seed=((Math.random()*1e9)|0);
  const rng=mulberry32(seed);
  const t=new Uint8Array(MAPW*MAPH);
  const set=(x,y,v)=>{if(x>=0&&y>=0&&x<MAPW&&y<MAPH)t[x+y*MAPW]=v;};
  const at=(x,y)=>(x>=0&&y>=0&&x<MAPW&&y<MAPH)?t[x+y*MAPW]:TILE.TREE;
  const ri=n=>Math.floor(rng()*n);
  const pick1=a=>a[ri(a.length)];
  const path=new Uint8Array(MAPW*MAPH);   // проходы, которые нельзя перекрывать объектами

  // тайл, по которому вообще можно идти (без учёта объектов-проps)
  const openT=(x,y)=>{
    if(x<1||y<1||x>MAPW-2||y>MAPH-2)return false;
    const c=t[x+y*MAPW];
    return c!==TILE.TREE&&c!==TILE.BUSH&&c!==TILE.WATER&&
           c!==TILE.WALL&&c!==TILE.WWALL&&c!==TILE.FENCE;
  };
  // широкая полоса: игрок с радиусом 7 пройдёт только там, где есть разгон по 2 тайла
  const wide=(x,y)=>openT(x,y)&&((openT(x,y-1)&&openT(x,y+1))||(openT(x-1,y)&&openT(x+1,y)));
  // прорубить просеку 2 тайла шириной (лес и траву — да, стены и воду — нет)
  const carve=(x0,y0,x1,y1)=>{
    const n=Math.max(1,Math.max(Math.abs(x1-x0),Math.abs(y1-y0)));
    for(let i=0;i<=n;i++){
      const x=Math.round(x0+(x1-x0)*i/n),y=Math.round(y0+(y1-y0)*i/n);
      for(const d of[[0,0],[1,0],[0,1],[1,1]]){
        const tx=x+d[0],ty=y+d[1];
        if(tx<1||ty<1||tx>MAPW-2||ty>MAPH-2)continue;
        const c=t[tx+ty*MAPW];
        if(c===TILE.WATER||c===TILE.WALL||c===TILE.WWALL||c===TILE.FENCE||
           c===TILE.BRIDGE||c===TILE.ROAD)continue;
        if(c!==TILE.TALL)set(tx,ty,TILE.DIRT);
        path[tx+ty*MAPW]=1;
      }
    }
  };
  // просека от точки к дороге (дорога — главный связный коридор через всё урочище)
  const carveToRoad=(x,y)=>{
    const yc=roadYAt(x);
    const ty=clamp(y<=yc?yc-3:yc+2,2,MAPH-3);
    carve(x,y,x,ty);
    carve(x,ty,clamp(x+12,2,MAPW-3),ty);
  };

  /* ---- местность: дорога, река, мост — каждый день новые ---- */
  LY.roadY0=28+ri(26); LY.roadA=1+rng()*2.6; LY.roadP=9+rng()*13;
  LY.rvA=20+ri(66); LY.rvB=18+ri(68);
  LY.rvW=1.4+rng()*2.6; LY.rvP=5+rng()*7; LY.rvPh=rng()*6.283;
  let by=LY.roadY0;
  for(let i=0;i<24;i++){const nb=streamXAt(roadYAt(by));if(Math.abs(nb-by)<.4){by=nb;break;}by=nb;}
  LY.brY=Math.round(clamp(by,9,MAPH-10));

  const grassD=.26+rng()*.2;
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++)if(rng()<grassD)set(x,y,TILE.GRASS_B);
  for(let y=0;y<MAPH;y++){const xc=streamXAt(y);
    for(let x=Math.floor(xc-1.5);x<=Math.ceil(xc+1.5);x++)set(x,y,TILE.WATER);}
  for(let x=0;x<MAPW;x++){const yc=roadYAt(x);
    for(let y=yc-2;y<=yc+1;y++)set(x,y,TILE.ROAD);
    [yc-3,yc+2].forEach(yy=>{const c=at(x,yy);if(c<=TILE.TALL)set(x,yy,TILE.DIRT);});}
  for(let y=LY.brY-3;y<=LY.brY+3;y++){const xc=streamXAt(y);
    for(let x=Math.floor(xc-1.5);x<=Math.ceil(xc+1.5);x++)set(x,y,TILE.BRIDGE);}

  const nearRoad=(x,y)=>{const yc=roadYAt(x);return y>=yc-4&&y<=yc+3;};
  const nearStr=(x,y)=>Math.abs(x-streamXAt(y))<3.4;

  /* ---- поляны ---- */
  const clearings=[];
  for(let i=0;i<5;i++){const w=14+ri(20),h=11+ri(16);
    clearings.push([3+ri(MAPW-w-6),3+ri(MAPH-h-6),w,h]);}
  const inCl=(x,y)=>{for(const c of clearings)if(x>=c[0]&&y>=c[1]&&x<c[0]+c[2]&&y<c[1]+c[3])return true;return false;};

  /* ---- лес: густота своя, но сплошные заросли прореживаем, чтобы можно было ходить ---- */
  const treeD=.28+rng()*.16;
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++){
    if(inCl(x,y)||nearRoad(x,y)||nearStr(x,y))continue;
    let d=treeD;
    if(x<5||y<5||x>MAPW-6||y>MAPH-6)d=Math.min(.72,treeD+.4);
    if(rng()<d)set(x,y,TILE.TREE);
    else if(rng()<.05)set(x,y,TILE.BUSH);
  }
  // любой сплошной квадрат 2x2 из деревьев прореживаем: иначе игроку шириной 14px не протиснуться
  for(let y=1;y<MAPH-2;y++)for(let x=1;x<MAPW-2;x++){
    if(at(x,y)>TILE.BUSH)continue;
    if(at(x+1,y)>TILE.BUSH||at(x,y+1)>TILE.BUSH||at(x+1,y+1)>TILE.BUSH)continue;
    if(rng()<.85)set(x,y,TILE.GRASS_A);
  }
  for(let i=0;i<80;i++){const c=clearings[i%clearings.length];
    const cx=c[0]+2+rng()*(c[2]-4), cy=c[1]+2+rng()*(c[3]-4);
    for(let y=Math.floor(cy-2);y<=cy+2;y++)for(let x=Math.floor(cx-2);x<=cx+2;x++){
      if(at(x,y)<=TILE.GRASS_B&&Math.hypot(x-cx,y-cy)<2.1+rng())set(x,y,TILE.TALL);}
  }

  /* ---- участки построек ---- */
  const blds=[];
  const blocked=(x,y,w,h,pad)=>{
    if(x<3||y<3||x+w>MAPW-3||y+h>MAPH-3)return true;
    for(let j=y-pad;j<y+h+pad;j++)for(let i=x-pad;i<x+w+pad;i++){
      if(i<0||j<0||i>=MAPW||j>=MAPH)continue;
      const c=at(i,j);
      if(c===TILE.WATER||c===TILE.ROAD||c===TILE.BRIDGE)return true;}
    for(const b of blds)
      if(x<b.x+b.w+pad&&x+w+pad>b.x&&y<b.y+b.h+pad&&y+h+pad>b.y)return true;
    return false;};
  const place=(w,h,pad,mode)=>{
    let fb=null;
    for(let k=0;k<600;k++){
      let x,y;
      if(mode==='road'){x=5+ri(MAPW-w-10);y=roadYAt(x)+(rng()<.5?-h-4:4);}
      else{x=5+ri(MAPW-w-10);y=5+ri(MAPH-h-10);}
      if(x<3||y<3||y+h>MAPH-3)continue;
      if(mode==='farCamp'&&dst(x,y,CAMP.x,CAMP.y)<34){if(!fb)fb={x,y,w,h};continue;}
      if(blocked(x,y,w,h,pad))continue;
      const b={x,y,w,h};blds.push(b);return b;
    }
    if(fb){blds.push(fb);return fb;}
    return null;
  };

  const campW=15+ri(4),campH=13+ri(4);
  const camp=place(campW,campH,2)||{x:CAMP.x,y:CAMP.y,w:campW,h:campH};
  CAMP.x=camp.x;CAMP.y=camp.y;CAMP.w=camp.w;CAMP.h=camp.h;
  camp.wall=TILE.FENCE;
  // какие из построек встанут в этом лесу — каждый раз свои
  const kinds=['склад','сарай','изба','будка'];
  for(let i=kinds.length-1;i>0;i--){const j=ri(i+1),q=kinds[i];kinds[i]=kinds[j];kinds[j]=q;}
  const keep=3+ri(2),has=n=>kinds.indexOf(n)<keep;
  const S=n=>({склад:[11+ri(4),10+ri(3)],сарай:[10+ri(4),8+ri(3)],
               изба:[9+ri(4),7+ri(3)],будка:[5+ri(3),3+ri(3)]}[n]);
  const R=n=>{const q=S(n);return[q[0],q[1]];};
  const rs=R('склад'),rd=R('сарай'),ru=R('изба'),rb=R('будка');
  const store=has('склад')?place(rs[0],rs[1],2):null;
  const shed=has('сарай')?place(rd[0],rd[1],2):null;
  const house=has('изба')?place(ru[0],ru[1],2):null;
  const booth=has('будка')?place(rb[0],rb[1],1,'road'):null;
  const traderB=place(7+ri(4),5+ri(3),2,'farCamp');

  const FLOOR_T=[TILE.WFLOOR,TILE.CFLOOR,TILE.DIRT];
  const doors=[];   // {x,y,ox,oy} — тайл двери и тайл снаружи неё
  function walls(b,wall,floor){
    for(let j=0;j<b.h;j++)for(let i=0;i<b.w;i++)
      set(b.x+i,b.y+j,(i===0||j===0||i===b.w-1||j===b.h-1)?wall:floor);
    b.wall=wall;b.floor=floor;b.roofH=wall===TILE.WALL?3:2;
    // северная сторона занята крышей — дверь только с юга, запада или востока
    const s=ri(3);
    if(s===0){const dx=b.x+1+ri(Math.max(1,b.w-3)),dy=b.y+b.h-1;
      set(dx,dy,TILE.DOOR);set(dx+1,dy,TILE.DOOR);doors.push({x:dx,y:dy,ox:dx,oy:dy+1});}
    else if(s===1){const dx=b.x+b.w-1,dy=b.y+1+ri(Math.max(1,b.h-3));
      set(dx,dy,TILE.DOOR);set(dx,dy+1,TILE.DOOR);doors.push({x:dx,y:dy,ox:dx+1,oy:dy});}
    else{const dx=b.x,dy=b.y+1+ri(Math.max(1,b.h-3));
      set(dx,dy,TILE.DOOR);set(dx,dy+1,TILE.DOOR);doors.push({x:dx,y:dy,ox:dx-1,oy:dy});}
    return b;
  }
  if(store)walls(store,TILE.WALL,TILE.CFLOOR);
  if(shed)walls(shed,TILE.WWALL,TILE.DIRT);
  if(house)walls(house,TILE.WWALL,TILE.WFLOOR);
  if(traderB)walls(traderB,TILE.WWALL,TILE.WFLOOR);
  if(booth)walls(booth,TILE.WWALL,TILE.WFLOOR);
  // стеллажи-перегородки на складе
  if(store)for(const cx of[store.x+3,store.x+6,store.x+9])
    for(let y=store.y+2;y<=Math.min(store.y+6,store.y+store.h-3);y++)if(rng()<.75)set(cx,y,TILE.WALL);
  // матрас в избе, мусор вокруг
  if(house){set(house.x+2+ri(Math.max(1,house.w-4)),house.y+2,TILE.MAT);
    set(house.x+2+ri(Math.max(1,house.w-4)),house.y+3,TILE.MAT);}
  for(let i=0;i<40;i++){
    const bx=house?house.x:20,byy=house?house.y:16;
    const x=bx-3+ri(14),y=byy-3+ri(14);
    if(at(x,y)<=TILE.GRASS_B)set(x,y,TILE.RUBBLE);}

  /* ---- лагерь: забор, weak-сегмент, ворота ---- */
  for(let j=0;j<camp.h;j++)for(let i=0;i<camp.w;i++)
    set(camp.x+i,camp.y+j,(i===0||j===0||i===camp.w-1||j===camp.h-1)?TILE.FENCE:TILE.DIRT);
  const SIDES=['N','E','S','W'];
  const weakSide=pick1(SIDES),gateSide=pick1(SIDES.filter(s=>s!==weakSide));
  const campDoors={};
  const mx=camp.x+(camp.w>>1), my=camp.y+(camp.h>>1);
  // 4 выхода со всех 4 сторон лагеря
  campDoors.N=[mx-1+camp.y*MAPW, mx+camp.y*MAPW];
  campDoors.S=[mx-1+(camp.y+camp.h-1)*MAPW, mx+(camp.y+camp.h-1)*MAPW];
  campDoors.W=[camp.x+(my-1)*MAPW, camp.x+my*MAPW];
  campDoors.E=[camp.x+camp.w-1+(my-1)*MAPW, camp.x+camp.w-1+my*MAPW];
  for(const k of SIDES)for(const ti of campDoors[k]){
    t[ti]=TILE.DOOR;
  }
  const gateOut={x:mx,y:camp.y+camp.h};

  /* ---- просеки: от всех 4 выходов лагеря и от каждой двери к дороге ---- */
  carveToRoad(mx,camp.y-1);carveToRoad(mx,camp.y+camp.h);
  carveToRoad(camp.x-1,my);carveToRoad(camp.x+camp.w,my);
  for(const d of doors)carveToRoad(d.ox,d.oy);
  // пара лишних просек в чаще, чтобы лес не был сплошной стеной
  for(let i=0;i<3;i++){
    const x=8+ri(MAPW-16),y=8+ri(MAPH-16);
    carve(x,y,clamp(x+24+ri(24),2,MAPW-3),clamp(y+ri(24)-12,2,MAPH-3));
  }

  /* ---- тропа от ворот лагеря к Торгу ---- */
  if(traderB){
    const ax=gateOut.x,ay=gateOut.y;
    const bx=traderB.x+(traderB.w/2|0),bby=traderB.y+(traderB.h/2|0);
    const m1x=Math.round(lerp(ax,bx,.35)),m1y=Math.round(clamp(lerp(ay,bby,.35)+(rng()*16-8),3,MAPH-4));
    const m2x=Math.round(lerp(ax,bx,.7)),m2y=Math.round(clamp(lerp(ay,bby,.7)+(rng()*16-8),3,MAPH-4));
    carve(ax,ay,m1x,m1y);carve(m1x,m1y,m2x,m2y);carve(m2x,m2y,bx,bby);
  }

  /* ---- объекты: внутри построек и в урочище ---- */
  const props=[],used=[];
  const tooClose=(x,y,d)=>{for(const q of used)if(Math.abs(q.x-x)<d&&Math.abs(q.y-y)<d)return true;return false;};
  const nearDoor=(x,y,d)=>{for(const q of doors)if(Math.abs(q.x-x)<=d&&Math.abs(q.y-y)<=d)return true;return false;};
  const freeIn=(b,inset,only)=>{
    if(!b)return null;
    for(let k=0;k<90;k++){
      const x=b.x+inset+ri(Math.max(1,b.w-inset*2)),y=b.y+inset+ri(Math.max(1,b.h-inset*2));
      const c=at(x,y);
      if(only&&only.indexOf(c)<0)continue;
      if(!only&&FLOOR_T.indexOf(c)<0)continue;
      if(nearDoor(x,y,1))continue;              // не перегораживать вход в постройку
      if(tooClose(x,y,2))continue;
      used.push({x,y});return {x,y};
    }
    return null;
  };
  const freeOut=(minCamp)=>{
    for(let k=0;k<400;k++){
      const x=5+ri(MAPW-10),y=5+ri(MAPH-10);
      if(at(x,y)>TILE.TALL)continue;             // только открытая земля/трава
      if(path[y*MAPW+x])continue;                // не перекрывать просеки
      if(nearDoor(x,y,2))continue;
      if(inCamp(x,y))continue;
      if(dst(x,y,CAMP.x+CAMP.w/2,CAMP.y+CAMP.h/2)<minCamp)continue;
      let clash=false;
      for(const b of blds)if(x>=b.x-1&&x<b.x+b.w+1&&y>=b.y-1&&y<b.y+b.h+1)clash=true;
      if(clash||tooClose(x,y,3))continue;
      used.push({x,y});return {x,y};
    }
    return null;
  };
  const push=(o)=>{props.push(o);used.push({x:o.x,y:o.y});return o;};

  const tp=freeIn(traderB,1);
  if(tp){
    push({type:'trader',x:tp.x,y:tp.y,w:1,h:1,solid:1,act:'trade',label:'поговорить с Торгом'});
    const lp=freeIn(traderB,1);
    if(lp)push({type:'lantern',x:lp.x,y:lp.y,w:1,h:1,solid:0,light:58});
    const fp=freeOut(4);
    if(fp)push({type:'traderfire',x:fp.x,y:fp.y,w:1,h:1,solid:0,light:90});
  }
  const bp=freeIn(house,1);
  if(bp)push({type:'bed',x:bp.x,y:bp.y,w:2,h:3,solid:1});
  const wp=freeOut(9);
  if(wp)push({type:'well',x:wp.x,y:wp.y,w:2,h:2,solid:1,act:'drink',label:'напиться из колодца'});
  for(let i=0;i<3;i++){
    for(let k=0;k<40;k++){
      const x=6+ri(MAPW-12);
      if(Math.abs(x-streamXAt(LY.brY))<7)continue;
      const y=roadYAt(x)+(rng()<.5?-4:3);
      if(y<3||y>MAPH-4)continue;
      if(inCamp(x,y))continue;
      if(path[y*MAPW+x]||path[(y+2)*MAPW+x+2])continue;   // не перегораживать просеки
      if(Math.abs(x-CAMP.x-CAMP.w/2)<12&&Math.abs(y-CAMP.y-CAMP.h/2)<12)continue;
      push({type:'car',x,y,w:3,h:2,solid:1,los:1});break;
    }
  }
  // лагерные объекты (внутри забора всегда есть место под палатку, верстак, костёр и схрон)
  const campSpot=()=>freeIn(camp,2,[TILE.DIRT])||{x:camp.x+3+ri(camp.w-6),y:camp.y+3+ri(camp.h-6)};
  const tent=campSpot();
  const tentProp=push({type:'tent',x:tent.x,y:tent.y,w:3,h:2,solid:1,act:'sleep',label:'спать в палатке'});
  const wb=campSpot();
  push({type:'workbench',x:wb.x,y:wb.y,w:2,h:1,solid:1,act:'craft',label:'поработать за верстаком'});
  const fr=campSpot();
  push({type:'fire',x:fr.x,y:fr.y,w:1,h:1,solid:1,light:105,act:'cook',label:'погреть еду у костра'});
  const sp=campSpot();

  // крыши построек: блокируют ходьбу и обзор, рисуются поверх сущностей
  for(const b of blds)if(b.wall&&b.wall!==TILE.FENCE)
    props.push({type:'roof',x:b.x,y:b.y-b.roofH,w:b.w,h:b.roofH,solid:1,los:1});

  /* ---- 4 двери лагеря (железный забор непробиваем, ломаются только 4 двери) ---- */
  const segs=[],segMap=new Int16Array(MAPW*MAPH).fill(-1);
  for(const k of['N','S','E','W']){
    const s={side:k,tiles:campDoors[k],max:60,hp:60};
    const id=segs.length;segs.push(s);
    for(const ti of s.tiles)segMap[ti]=id;
  }

  // мир уже существует: контейнеры добавляются в него
  World={t,explored:new Uint8Array(MAPW*MAPH),props,blds,conts:[],canvas:null,g:null,
    fog:null,fctx:null,fogImg:null,roof:null,segs,segMap,anyBreach:false,placed:[],
    camp:{x:camp.x,y:camp.y,w:camp.w,h:camp.h},campWeak:weakSide,gateSide,trader:tp?{x:tp.x,y:tp.y}:null,
    seed:seed,
    spawns:[],nightXs:[],tent:tentProp,tileAt:(x,y)=>at(x,y)};

  /* ---- контейнеры ---- */
  // состав лута в постройке: [тип, минимум, максимум] — каждый лес свой
  const fill=(b,spec)=>{
    if(!b)return;
    const list=[];
    for(const q of spec)for(let k=0;k<q[1]+ri(q[2]-q[1]+1);k++)list.push(q[0]);
    for(const ty of list){const p=freeIn(b,1);if(p)addContainer(ty,p.x,p.y);}
  };
  fill(store,[['safe',rng()<.7?1:0,1],['shelf',1,3],['crate',1,2],
              ['bigcrate',rng()<.6?1:0,1],['barrel',0,1]]);
  fill(shed,[['toolbox',1,1],['crate',1,3],['bigcrate',rng()<.6?1:0,1],['barrel',0,1]]);
  fill(house,[['cupboard',1,2],['crate',0,2]]);
  fill(booth,[['crate',1,1],['toolbox',rng()<.6?1:0,1]]);
  if(sp){const q=addContainer('stash',sp.x,sp.y);q.base=true;}
  for(let i=0;i<4+ri(5);i++){const p=freeOut(9);if(p)addContainer('ground',p.x,p.y);}

  /* ---- точки появления тварей этого леса ---- */
  const openNear=(x,y)=>{
    for(let r=0;r<10;r++)for(let a=0;a<16;a++){
      const nx=Math.round(x+Math.cos(a/16*6.283)*r),ny=Math.round(y+Math.sin(a/16*6.283)*r);
      const c=at(nx,ny);
      if(c===TILE.GRASS_A||c===TILE.GRASS_B||c===TILE.TALL||c===TILE.DIRT||c===TILE.ROAD)
        return {x:nx,y:ny};
    }
    return {x,y};
  };
  const mid=b=>({x:b.x+(b.w/2|0),y:b.y+(b.h/2|0)});
  const spawns=[];
  for(const b of[store,house,shed])if(b){const m=openNear(mid(b).x,mid(b).y+2);
    spawns.push(['straf',m.x,m.y]);}
  const hx=Math.round(clamp(streamXAt(LY.brY+8)+6,6,MAPW-7));
  const hm=openNear(hx,roadYAt(hx)+1);
  spawns.push(['hound',hm.x,hm.y]);
  const nightXs=[];
  for(const off of[-16,18]){
    const x=Math.round(clamp(CAMP.x+CAMP.w/2+off+rng()*8-4,6,MAPW-7));
    nightXs.push(x);}

  World.spawns=spawns;World.nightXs=nightXs;

  /* ---- проходимость: до всех ящиков, дверей и важных объектов можно дойти ---- */
  const solidHere=(x,y)=>{
    if(!openT(x,y))return true;
    for(const p of props)if(p.solid&&x>=p.x&&x<p.x+p.w&&y>=p.y&&y<p.y+p.h)return true;
    return false;
  };
  const wide2=(x,y)=>!solidHere(x,y)&&
    ((!solidHere(x,y-1)&&!solidHere(x,y+1))||(!solidHere(x-1,y)&&!solidHere(x+1,y)));
  const flood=(sx,sy)=>{
    const seen=new Uint8Array(MAPW*MAPH);
    let q=[];
    if(wide2(sx,sy))q=[[sx,sy]];
    else for(let r=1;r<14&&!q.length;r++)for(let a=0;a<24&&!q.length;a++){
      const nx=sx+Math.round(Math.cos(a/24*6.283)*r),ny=sy+Math.round(Math.sin(a/24*6.283)*r);
      if(wide2(nx,ny))q=[[nx,ny]];
    }
    for(const p of q)seen[p[0]+p[1]*MAPW]=1;
    while(q.length){
      const p=q.pop();
      for(const d of[[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=p[0]+d[0],ny=p[1]+d[1];
        if(nx<1||ny<1||nx>MAPW-2||ny>MAPH-2)continue;
        if(seen[nx+ny*MAPW]||!wide2(nx,ny))continue;
        seen[nx+ny*MAPW]=1;q.push([nx,ny]);
      }
    }
    return seen;
  };
  const nearSeen=(seen,x,y)=>{
    if(seen[clamp(x,0,MAPW-1)+clamp(y,0,MAPH-1)*MAPW])return true;
    for(const d of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]])
      if(seen[clamp(x+d[0],0,MAPW-1)+clamp(y+d[1],0,MAPH-1)*MAPW])return true;
    return false;
  };
  const nearestSeen=(seen,x,y)=>{
    for(let r=1;r<34;r++)for(let a=0;a<20;a++){
      const nx=clamp(Math.round(x+Math.cos(a/20*6.283)*r),1,MAPW-2),
            ny=clamp(Math.round(y+Math.sin(a/20*6.283)*r),1,MAPH-2);
      if(seen[nx+ny*MAPW])return {x:nx,y:ny};
    }
    return null;
  };
  const campMid={x:camp.x+(camp.w/2|0),y:camp.y+(camp.h/2|0)};
  let seen=flood(campMid.x,campMid.y),seenTiles=0;
  for(let i=0;i<seen.length;i++)seenTiles+=seen[i];
  const pois=[];
  for(const c of World.conts)pois.push({kind:'c',ref:c,x:c.tx,y:c.ty});
  for(const p of props)if(p.act)pois.push({kind:'p',ref:p,x:p.x,y:p.y});
  for(const d of doors)pois.push({kind:'d',ref:d,x:d.x,y:d.y});
  pois.push({kind:'d',ref:gateOut,x:gateOut.x,y:gateOut.y});
  // прорубаем просеки к недоступному, при необходимости — переносим объект
  for(let round=0;round<4;round++){
    const bad=pois.filter(q=>!nearSeen(seen,q.x,q.y));
    if(!bad.length)break;
    for(const q of bad){
      const n=nearestSeen(seen,q.x,q.y);
      if(n)carve(q.x,q.y,n.x,n.y);
    }
    seen=flood(campMid.x,campMid.y);
    seenTiles=0;for(let i=0;i<seen.length;i++)seenTiles+=seen[i];
  }
  for(const q of pois){
    if(nearSeen(seen,q.x,q.y))continue;
    let done=false;
    for(let r=1;r<26&&!done;r++)for(let a=0;a<20&&!done;a++){
      const nx=clamp(Math.round(q.x+Math.cos(a/20*6.283)*r),2,MAPW-3),
            ny=clamp(Math.round(q.y+Math.sin(a/20*6.283)*r),2,MAPH-3);
      if(!seen[nx+ny*MAPW])continue;
      if(q.kind==='c'){q.ref.tx=nx;q.ref.ty=ny;q.ref.x=nx*TS+8;q.ref.y=ny*TS+8;}
      else if(q.kind==='p'){q.ref.x=nx;q.ref.y=ny;}
      done=true;
    }
  }
  World.walked=seenTiles;
  renderWorldCanvas();
  return World;
}

// ---- проверка тайлов ----
function losSolid(tx,ty){
  if(LOS_T.has(World.tileAt(tx,ty)))return true;
  for(const p of World.props)if(p.los&&tx>=p.x&&ty>=p.y&&tx<p.x+p.w&&ty<p.y+p.h)return true;
  return false;
}
function pointSolid(px,py){
  const tx=px/TS|0, ty=py/TS|0;
  const tile=World.tileAt(tx,ty);
  if(tile===TILE.FENCE){
    const si=World.segMap[tx+ty*MAPW];
    if(si>=0&&World.segs[si].hp>0)return true; // сломанный сегмент — проходим
    if(si<0)return true;
  } else if(SOLID_T.has(tile))return true;
  for(const p of World.props)if(p.solid&&tx>=p.x&&ty>=p.y&&tx<p.x+p.w&&ty<p.y+p.h)return true;
  return false;
}
function collides(x,y,r){
  const pts=[[0,0],[r,0],[-r,0],[0,r],[0,-r],[r*.6,r*.6],[-r*.6,r*.6],[r*.6,-r*.6],[-r*.6,-r*.6]];
  for(const q of pts)if(pointSolid(x+q[0],y+q[1]))return true;
  return false;
}
function losClear(x0,y0,x1,y1){ // тайловые координаты
  const dx=x1-x0, dy=y1-y0, n=Math.ceil(Math.hypot(dx,dy)*2);
  for(let i=1;i<n;i++){
    if(losSolid(Math.floor(x0+dx*i/n),Math.floor(y0+dy*i/n)))return false;}
  return true;
}

// ---- лагерь: зона, недоступная для тварей ----
// границы лагеря меняются каждый день вместе с лесом
var CAMP={x:86,y:52,w:17,h:15};
const MM_S=2;
function inCamp(x,y){const tx=x/TS,ty=y/TS;
  return tx>=CAMP.x&&tx<CAMP.x+CAMP.w&&ty>=CAMP.y&&ty<CAMP.y+CAMP.h;}
function fenceSide(x,y){const c=World?World.camp:CAMP;
  return x===c.x?'W':x===c.x+c.w-1?'E':y===c.y?'N':'S';}
function collidesE(x,y,r){ // коллизии для врагов: периметр лагеря непроницаем, пока забор цел
  if(inCamp(x,y)&&!World.anyBreach)return true;
  return collides(x,y,r);
}

/* ---- палитра Darkwood (мрачная, сырая, приглушённая) ---- */
const DW={
  g1:'#181b12',g2:'#1d2116',g3:'#11150d',dry:'#3b3520',
  dirt:'#1b1610',dirt2:'#241e15',road:'#242018',road2:'#2d281e',road3:'#18140f',
  wood:'#291e13',wood2:'#35271a',wood3:'#150f09',wood4:'#413121',
  stone:'#2e2d27',stone2:'#21201b',stone3:'#3c3a33',
  leaf:'#11180d',leaf2:'#0a0f07',leaf3:'#192213',leaf4:'#222c19',
  trunk:'#1d140c',trunk2:'#2a1e13',root:'#120c07',
  shade:'#050704',
  metal:'#2e3134',metal2:'#1b1e20',metal3:'#414549',
  water:'#0c1412',water2:'#121d1a',water3:'#1a2824',
  moss:'#1d2614',rust:'#482013',rot:'#3c1412',rot2:'#581c18',bone:'#756e5c'
};

// ---- пред-рендер мира: земля, постройки, деревья, корни, крыши и кроны ----
function renderWorldCanvas(){
  const cv=document.createElement('canvas');
  cv.width=MAPW*TS; cv.height=MAPH*TS;
  const g=cv.getContext('2d'); World.canvas=cv; World.g=g;
  const at=(x,y)=>(x>=0&&y>=0&&x<MAPW&&y<MAPH)?World.t[x+y*MAPW]:TILE.TREE;

  // 1) Базовый слой земли, дорог, воды, стен и полов
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++){
    const c=World.t[x+y*MAPW], px=x*TS, py=y*TS;
    g._seed=(x*73856093)^(y*19349663)^1337;
    const rv=()=>{g._seed=(g._seed*1103515245+12345)&0x7fffffff;return g._seed/0x7fffffff;};

    if(c===TILE.WATER){
      g.fillStyle=DW.water;g.fillRect(px,py,TS,TS);
      // тёмная глубина и мутные ряби
      for(let i=0;i<4;i++){
        const wy=py+(rv()*14|0)+1,wx=px+(rv()*9|0);
        pxLine(g,wx,wy,wx+3+(rv()*4|0),wy,rv()<.35?DW.water3:DW.water2);
      }
      // прибрежная тина и камыш у берега
      const nN=at(x,y-1)!==TILE.WATER, nS=at(x,y+1)!==TILE.WATER, nW=at(x-1,y)!==TILE.WATER, nE=at(x+1,y)!==TILE.WATER;
      g.fillStyle='#0d1412';
      if(nN)g.fillRect(px,py,TS,2);
      if(nS)g.fillRect(px,py+TS-2,TS,2);
      if(nW)g.fillRect(px,py,2,TS);
      if(nE)g.fillRect(px+TS-2,py,2,TS);
      if((nN||nS||nW||nE)&&rv()<.65){
        const rx=px+2+(rv()*11|0),ry=py+3+(rv()*10|0);
        pxLine(g,rx,ry,rx+(rv()<.5?-1:1),ry-3,'#2a3320');
        pst(g,rx,ry-4,'#3c3420');
      }
      continue;
    }

    let base=DW.g1;
    if(c===TILE.GRASS_B)base=DW.g2; else if(c===TILE.TALL)base=DW.g3;
    else if(c===TILE.DIRT)base=DW.dirt; else if(c===TILE.ROAD)base=DW.road;
    else if(c===TILE.BRIDGE)base=DW.wood; else if(c===TILE.WFLOOR)base=DW.wood;
    else if(c===TILE.CFLOOR)base=DW.stone2; else if(c===TILE.RUBBLE)base=DW.stone2;
    else if(c===TILE.MAT)base='#3a301f';
    g.fillStyle=base;g.fillRect(px,py,TS,TS);

    if(c<=TILE.TALL){
      // плотный органичный дизертинг тёмного подлеска + палая листва
      const sp=['#26291c','#1e2116','#2d3122','#181b12','#2c2419'];
      for(let i=0;i<14;i++){g.fillStyle=sp[rv()*5|0];g.fillRect(px+(rv()*15|0),py+(rv()*15|0),1+(rv()<.3?1:0),1);}
      if(rv()<.18){ // влажная лужица / пятно грязи
        pxEll(g,px+4+(rv()*8|0),py+4+(rv()*8|0),2.6,1.8,'#1b1912');
      }
      if(c===TILE.TALL){
        // густая высокая трава / папоротник / сухие стебли для стелса
        g.fillStyle='#0f140c';
        for(let i=0;i<7;i++)g.fillRect(px+(rv()*13|0),py+(rv()*13|0),2,2);
        for(let i=0;i<16;i++){
          const bx=px+(rv()*15|0),by=py+3+(rv()*12|0);
          const cl=TALL_DRY(rv)?DW.dry:(rv()<.45?'#2c381f':(rv()<.5?'#1e2815':'#161e10'));
          g.fillStyle='#0c1009';g.fillRect(bx,by+1,1,1);
          g.fillStyle=cl;g.fillRect(bx,by,1,2);
          g.fillRect(bx+(rv()<.5?-1:1),by-2,1,2);
        }
      } else {
        for(let i=0;i<9;i++){
          const bx=px+(rv()*15|0),by=py+2+(rv()*13|0);
          const cl=TALL_DRY(rv)?DW.dry:(rv()<.5?'#28301c':'#1d2414');
          g.fillStyle='#0f130c';g.fillRect(bx,by+1,1,1);
          g.fillStyle=cl;g.fillRect(bx,by,1,1);
          if(rv()<.55)g.fillRect(bx+(rv()<.3?1:0),by-1,1,1);
        }
        if(rv()<.22){ // трещинки в сырой земле / мшистые кочки
          pxEll(g,px+3+(rv()*9|0),py+4+(rv()*8|0),2.2,1.3,'#13170e');
        }
      }
      // палые листья и хвоя
      if(rv()<.32){
        g.fillStyle=rv()<.5?'#43331e':'#362817';
        g.fillRect(px+(rv()*13|0),py+(rv()*13|0),2,1);
      }
      const hsh=x*73+y*151;
      if(c<=TILE.GRASS_B&&hsh%41===0){ // мшистый валун
        pxEll(g,px+8,py+10,3,2,DW.shade);
        pxEll(g,px+8,py+9,2.6,1.9,DW.stone2);
        pxEll(g,px+7.5,py+8.2,1.8,1.3,DW.stone);
        pst(g,px+7,py+7,DW.moss);pst(g,px+9,py+8,DW.stone3);
      } else if(c<=TILE.GRASS_B&&hsh%41===5){ // гнилой пень с корнями
        pxEll(g,px+8,py+10,3.4,2.2,DW.shade);
        pxLine(g,px+4,py+10,px+7,py+9,DW.root);pxLine(g,px+12,py+10,px+9,py+9,DW.root);
        pxEll(g,px+8,py+9,2.6,2,DW.trunk);pxEll(g,px+8,py+8.5,1.6,1.1,DW.trunk2);
        pst(g,px+8,py+8,'#16100a');
      } else if(c<=TILE.GRASS_B&&hsh%31===3){ // сухая коряга
        pxLine(g,px+3,py+11,px+12,py+9,DW.trunk);
        pxLine(g,px+7,py+10,px+9,py+7,DW.root);
      } else if(c<=TILE.GRASS_B&&hsh%79===7){ // побелевшие кости и череп в траве
        pxEll(g,px+8,py+9,2.2,2,DW.bone);
        pst(g,px+7,py+9,'#14120e');pst(g,px+9,py+9,'#14120e');
        pxLine(g,px+4,py+12,px+11,py+11,'#5a5445');
        pxEll(g,px+6,py+10,3,1.5,'rgba(44,10,9,.32)');
      } else if(c<=TILE.GRASS_B&&hsh%67===11){ // красная гниль / нарост Darkwood
        pxEll(g,px+8,py+9,3.2,2.4,'#0d0807');
        pxEll(g,px+8,py+9,2.4,1.7,DW.rot);
        pxEll(g,px+7,py+8,1.2,1,DW.rot2);
        pst(g,px+9,py+10,'#6e241d');
      } else if(c<=TILE.GRASS_B&&hsh%53===19){ // пятно засохшей крови и пепла
        pxEll(g,px+7,py+8,3.5,2.2,'rgba(42,10,9,.45)');
        pxEll(g,px+9,py+9,1.8,1.2,'rgba(18,16,14,.55)');
      }
    }

    if(c===TILE.ROAD||c===TILE.DIRT){
      const n=c===TILE.ROAD?9:6;
      for(let i=0;i<n;i++){
        g.fillStyle=rv()<.5?DW.road2:DW.road3;
        g.fillRect(px+(rv()*14|0),py+(rv()*14|0),1+(rv()*2|0),1);
      }
      if(c===TILE.ROAD&&y%2===0){ // колеи на дороге
        g.fillStyle='rgba(14,12,8,.35)';
        g.fillRect(px,py+4,TS,2);g.fillRect(px,py+11,TS,2);
      }
      if(rv()<.14)pxEll(g,px+(rv()*9|0)+3,py+(rv()*9|0)+3,1.8,1.2,DW.stone2);
      if(rv()<.12)pxEll(g,px+(rv()*9|0)+3,py+(rv()*9|0)+3,2.2,1.4,'#18150f');
    }

    if(c===TILE.RUBBLE){
      for(let i=0;i<8;i++){
        g.fillStyle=rv()<.45?DW.stone:(rv()<.5?'#211f1a':'#342a1e');
        g.fillRect(px+(rv()*12|0),py+(rv()*12|0),2+(rv()*2|0),1+(rv()*2|0));
      }
    }

    if(c===TILE.BRIDGE){
      for(let yy=2;yy<TS;yy+=4){
        pxLine(g,px,py+yy+1,px+15,py+yy+1,'#161009');
        pxLine(g,px,py+yy,px+15,py+yy,DW.wood2);
        pst(g,px+(rv()*14|0),py+yy,DW.wood4);
      }
      // перила / гвозди
      g.fillStyle=DW.wood3;g.fillRect(px,py,TS,2);g.fillRect(px,py+TS-2,TS,2);
      pst(g,px+2,py+4,'#5d5848');pst(g,px+13,py+12,'#5d5848');
    }

    if(c===TILE.WFLOOR){
      pxLine(g,px,py+8,px+15,py+8,DW.wood3);pxLine(g,px,py+7,px+15,py+7,DW.wood2);
      pxLine(g,px,py+15,px+15,py+15,DW.wood3);
      if(rv()<.5){g.fillStyle=DW.wood3;g.fillRect(px+(rv()*11|0),py+(rv()<.5?2:11),3,1);}
      if(rv()<.25){g.fillStyle='rgba(12,15,10,.45)';g.fillRect(px+(rv()*10|0),py+(rv()*10|0),4,3);} // грязь/плесень
      pst(g,px+(rv()*14|0),py+(rv()<.5?4:13),'#1a130b');
    }

    if(c===TILE.CFLOOR){
      pxLine(g,px,py+15,px+15,py+15,'#201f1b');
      pxLine(g,px+15,py,px+15,py+15,'#201f1b');
      if(rv()<.6){pxLine(g,px+3,py+3,px+7,py+8,'#1d1c18');pxLine(g,px+7,py+8,px+12,py+6,'#1d1c18');}
      for(let i=0;i<4;i++){g.fillStyle='#36352f';g.fillRect(px+(rv()*13|0),py+(rv()*13|0),1+(rv()*2|0),1);}
      if(rv()<.22)pxEll(g,px+8,py+8,3,2,'rgba(24,30,18,.45)');
    }

    if(c===TILE.MAT){
      g.fillStyle='#2a2216';g.fillRect(px+1,py+1,14,14);
      for(let yy=2;yy<TS;yy+=3)pxLine(g,px+1,py+yy,px+14,py+yy,'#3d3120');
      pxLine(g,px+1,py+2,px+1,py+14,'#4d3e28');
      pxEll(g,px+9,py+8,2.5,2,'#221912');
    }

    if(c===TILE.WWALL){
      g.fillStyle=DW.wood;g.fillRect(px,py,TS,TS);
      pxLine(g,px,py+1,px+15,py+1,DW.wood4);
      pxLine(g,px,py+5,px+15,py+5,DW.wood3);
      pxLine(g,px,py+10,px+15,py+10,DW.wood3);
      pxLine(g,px,py+15,px+15,py+15,'#140e08');
      if(rv()<.45)pxEll(g,px+(3+rv()*9|0),py+4,1.6,1.2,DW.moss);
      if(rv()<.35){g.fillStyle='#19120a';g.fillRect(px+(rv()*12|0),py+2,1,11);}
      g.fillStyle='#140e08';g.fillRect(px,py+TS-2,TS,2);
    }

    if(c===TILE.WALL){
      g.fillStyle=DW.stone;g.fillRect(px,py,TS,TS);
      pxLine(g,px,py+4,px+15,py+4,DW.stone2);pxLine(g,px,py+9,px+15,py+9,DW.stone2);
      pxLine(g,px+4,py,px+4,py+4,DW.stone2);pxLine(g,px+11,py+5,px+11,py+9,DW.stone2);
      pxLine(g,px+6,py+10,px+6,py+14,DW.stone2);
      pxLine(g,px,py,px+15,py,DW.stone3);
      if(rv()<.4){g.fillStyle=DW.moss;g.fillRect(px+(rv()*10|0),py+11,3,3);}
      if(rv()<.3){pxLine(g,px+2,py+2,px+6,py+7,'#1d1c18');}
      g.fillStyle='#1e1d18';g.fillRect(px,py+TS-2,TS,2);
    }

    if(false&&c===TILE.FENCE){
      const weak=(fenceSide(x,y)===World.campWeak);
      for(let i=0;i<(weak?3:4);i++){
        const sx=px+1+i*(weak?5:4);
        g.fillStyle=weak?'#332b1e':DW.wood2;g.fillRect(sx,py+(weak?4:2),2,TS-(weak?5:3));
        g.fillStyle=weak?'#1d170e':DW.wood3;g.fillRect(sx+1,py+(weak?4:2),1,TS-(weak?5:3));
        if(!weak)pst(g,sx,py+2,DW.wood4);
      }
      if(weak){
        pxLine(g,px+2,py+12,px+13,py+4,'#18130c');
        pxLine(g,px+3,py+3,px+12,py+13,'#18130c');
      } else {
        pxLine(g,px,py+6,px+15,py+6,'#1f1910');
        pxLine(g,px,py+11,px+15,py+11,'#1f1910');
        // колючая проволока сверху
        pxLine(g,px,py+2,px+15,py+2,'#3a3d40');
        pst(g,px+4,py+1,'#52565a');pst(g,px+11,py+3,'#52565a');
      }
    }

    if(c===TILE.DOOR&&World.segMap[x+y*MAPW]<0){
      g.fillStyle=DW.wood;g.fillRect(px+2,py+2,12,13);
      pxRect(g,px+2,py+2,12,13,'#17110a');
      pxLine(g,px+6,py+2,px+6,py+14,DW.wood3);pxLine(g,px+10,py+2,px+10,py+14,DW.wood3);
      pxLine(g,px+2,py+5,px+13,py+5,'#252729'); // железная скоба
      pxLine(g,px+2,py+11,px+13,py+11,'#252729');
      pst(g,px+12,py+8,'#8f825b');pst(g,px+3,py+3,DW.wood4);
    }

    // Ambient Occlusion внутри помещений и вдоль стен
    if(c===TILE.WFLOOR||c===TILE.CFLOOR||c===TILE.MAT||c===TILE.DIRT){
      const wN=at(x,y-1)===TILE.WALL||at(x,y-1)===TILE.WWALL;
      const wS=at(x,y+1)===TILE.WALL||at(x,y+1)===TILE.WWALL;
      const wW=at(x-1,y)===TILE.WALL||at(x-1,y)===TILE.WWALL;
      const wE=at(x+1,y)===TILE.WALL||at(x+1,y)===TILE.WWALL;
      g.fillStyle='rgba(3,4,2,.62)';
      if(wN)g.fillRect(px,py,TS,3);
      if(wS)g.fillRect(px,py+TS-2,TS,2);
      if(wW)g.fillRect(px,py,3,TS);
      if(wE)g.fillRect(px+TS-2,py,2,TS);
    }
  }

  // 2) Корни, тени и стволы деревьев на земле + отдельный холст крон (World.canopy)
  const cc=document.createElement('canvas');cc.width=cv.width;cc.height=cv.height;
  const cg=cc.getContext('2d');
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++){
    const c=World.t[x+y*MAPW];
    if(c!==TILE.TREE&&c!==TILE.BUSH)continue;
    const px=x*TS, py=y*TS;
    g._seed=(x*92821)^(y*68917)^42;
    const rv=()=>{g._seed=(g._seed*1103515245+12345)&0x7fffffff;return g._seed/0x7fffffff;};
    const big=c===TILE.TREE;
    if(big){
      // длинная тень от гигантского дерева и мощные ползущие корни
      pxEll(g,px+14,py+15,15,9,'rgba(2,3,1,.80)');
      const infected=rv()<.16;
      for(let r=0;r<6;r++){
        const a=r*1.047+(rv()-.5)*.7, len=9+rv()*9;
        const rx=px+8+Math.cos(a)*len, ry=py+12+Math.sin(a)*len*.68;
        pxLine(g,px+8,py+12,rx,ry,infected&&r%2===0?DW.rot:DW.root,1);
        if(rv()<.75)pxLine(g,rx,ry,rx+Math.cos(a+.55)*4.5,ry+Math.sin(a+.55)*3,'#090603',1);
      }
      // массивное основание ствола на земле
      g.fillStyle=DW.trunk;g.fillRect(px+5,py+6,6,9);
      g.fillStyle=infected?DW.rot:DW.trunk2;g.fillRect(px+6,py+6,2,8);
      g.fillStyle='#0b0704';g.fillRect(px+9,py+7,2,8);

      // очень высокий ствол (в 2.5-3 раза выше) уходит вверх на слой крон
      const trunkH=Math.round(36+rv()*22);
      const dead=rv()<.26;
      const lean=(rv()-.5)*4;
      const cx=px+8+lean, cy=Math.max(8,py+8-trunkH);
      const midx=px+8+lean*.45, midy=(py+10+cy)/2;
      pxLine(cg,px+8,py+10,midx,midy,DW.trunk,5);
      pxLine(cg,midx,midy,cx,cy+3,DW.trunk,4);
      pxLine(cg,px+7,py+10,cx-1,cy+3,infected?DW.rot:DW.trunk2,1);
      pxLine(cg,px+10,py+10,cx+2,cy+3,'#0a0704',1);

      if(dead){
        pxEll(cg,cx,cy+4,11,8,'rgba(3,5,2,.52)');
        for(let b=0;b<7;b++){
          const a=(b/7)*6.283+rv()*.45, l1=10+rv()*6, l2=6+rv()*4.5;
          const x1=cx+Math.cos(a)*l1, y1=cy+Math.sin(a)*l1*.8;
          pxLine(cg,cx,cy,x1,y1,DW.trunk,2);
          pxLine(cg,x1,y1,x1+Math.cos(a+.5)*l2,y1+Math.sin(a+.5)*l2*.8,DW.root,1);
          pxLine(cg,x1,y1,x1+Math.cos(a-.6)*l2,y1+Math.sin(a-.6)*l2*.8,DW.root,1);
        }
        pxEll(cg,cx,cy,3.5,3,DW.trunk2);
      } else {
        // многоярусная гигантская тёмная крона высоко над землёй
        const rx=12.5+rv()*4.5, ry=10.5+rv()*3.5;
        pxEll(cg,cx,cy+4,rx+2,ry+2,'rgba(3,5,2,.68)');
        pxEll(cg,cx,cy+1,rx+1,ry+1,'#060904');
        pxEll(cg,cx,cy,rx,ry,DW.leaf2);
        for(let i=0;i<9;i++){
          const a=i/9*6.283+rv()*.4;
          pxEll(cg,cx+Math.cos(a)*rx*.7,cy+Math.sin(a)*ry*.7,4.8,3.8,DW.leaf);
        }
        pxEll(cg,cx-1.5,cy-2.5,rx*.76,ry*.7,DW.leaf);
        pxEll(cg,cx+2,cy-5.5,rx*.54,ry*.48,DW.leaf3);
        pxEll(cg,cx+2.5,cy-7,3.4,2.5,DW.leaf4);
        pst(cg,cx+3,cy-7.5,'#354228');
      }
    } else {
      // колючий тёмный куст
      pxEll(g,px+8,py+12,5.5,3,'rgba(5,7,4,.5)');
      g.fillStyle=DW.trunk;g.fillRect(px+7,py+9,2,4);
      const cx=px+8, cy=py+8;
      pxEll(g,cx,cy,5.4,4.2,'#0c1009');
      pxEll(g,cx,cy-0.5,4.6,3.5,DW.leaf);
      pxEll(g,cx-1,cy+1,2.8,2,DW.leaf2);
      pxEll(g,cx+1.5,cy-1.2,2.2,1.6,DW.leaf3);
      pst(g,cx+2,cy-1.5,DW.leaf4);
    }
  }
  World.canopy=cc;

  // 3) Статичные пропы (детализированные, обветшалые)
  for(const p of World.props){
    const px=p.x*TS, py=p.y*TS, w=p.w*TS, h=p.h*TS;
    if(p.type==='car'){
      // ржавый остов машины с разбитым стеклом и мхом
      pxEll(g,px+w/2,py+h/2+4,w/2+2,h/2+2,'rgba(4,6,3,.62)');
      g.fillStyle='#141714';
      g.fillRect(px+4,py+1,5,5);g.fillRect(px+w-9,py+1,5,5);
      g.fillRect(px+4,py+h-6,5,5);g.fillRect(px+w-9,py+h-6,5,5);
      g.fillStyle=DW.metal2;g.fillRect(px+3,py+2,w-6,h-4);
      g.fillStyle='#2a3026';g.fillRect(px+4,py+3,w-8,h-6);
      g.fillStyle='#353c31';g.fillRect(px+8,py+5,w-16,h-10);
      g.fillStyle='#141918';g.fillRect(px+10,py+6,w-20,h-12); // разбитая кабина
      pxLine(g,px+10,py+6,px+15,py+10,'#3f4844'); // трещина стекла
      g.fillStyle=DW.rust;g.fillRect(px+5,py+4,4,2);g.fillRect(px+w-11,py+h-6,5,2);
      g.fillStyle=DW.moss;g.fillRect(px+7,py+h-5,4,2);
    } else if(p.type==='bed'){
      pxEll(g,px+w/2,py+h/2+2,w/2+1,h/2,'rgba(4,6,3,.5)');
      g.fillStyle=DW.wood3;g.fillRect(px+1,py+1,w-2,h-2);
      g.fillStyle='#32271b';g.fillRect(px+2,py+2,w-4,h-4);
      g.fillStyle='#2c2433';g.fillRect(px+3,py+8,w-6,h-11);
      pxLine(g,px+3,py+11,px+w-4,py+11,'#3a3042');
      g.fillStyle='#5c5648';g.fillRect(px+4,py+3,w-8,5);
      g.fillStyle='#3c362a';g.fillRect(px+6,py+4,3,2); // пятно на подушке
    } else if(false&&p.type==='tent'){
      pxEll(g,px+w/2,py+h-1,w/2+4,5,'rgba(4,6,3,.6)');
      for(let yy=0;yy<h;yy++){
        const hw=Math.max(1,Math.round(((yy+1)/h)*(w/2)));
        g.fillStyle=yy<h/2?'#2c3625':'#232c1d';
        g.fillRect(px+w/2-hw,py+yy,hw*2,1);
        g.fillStyle='#171e13';
        g.fillRect(px+w/2-hw,py+yy,1,1);g.fillRect(px+w/2+hw-1,py+yy,1,1);
      }
      // заплатка и гребень
      g.fillStyle='#38402d';g.fillRect(px+w/2-6,py+h/2,4,3);
      pxLine(g,px+w/2,py,px+w/2,py+h-1,'#3f4c36');
      // растяжки
      pxLine(g,px+4,py+h-2,px-2,py+h+2,'#2a241a');
      pxLine(g,px+w-4,py+h-2,px+w+2,py+h+2,'#2a241a');
      g.fillStyle='#11160f';g.fillRect(px+w/2-4,py+h-7,8,7);
    } else if(false&&p.type==='workbench'){
      pxEll(g,px+w/2,py+TS-2,w/2+1,3,'rgba(4,6,3,.5)');
      g.fillStyle='#18120b';g.fillRect(px+2,py+4,3,TS-4);g.fillRect(px+w-5,py+4,3,TS-4);
      g.fillStyle=DW.wood2;g.fillRect(px,py,w-1,5);
      g.fillStyle=DW.wood4;g.fillRect(px,py,w-1,1);
      g.fillStyle=DW.wood3;g.fillRect(px,py+4,w-1,1);
      g.fillStyle='#4f4c43';g.fillRect(px+w-8,py-2,5,3); // тиски
      g.fillStyle=DW.rust;g.fillRect(px+4,py+1,4,2);
      pst(g,px+10,py+2,'#6b6659');
    } else if(false&&p.type==='fire'){
      pxEll(g,px+8,py+8,8.5,7.2,'rgba(8,6,4,.65)'); // выжженный круг земли
      for(let i=0;i<8;i++){const a=i/8*6.283;
        pxEll(g,px+8+Math.cos(a)*7,py+8+Math.sin(a)*6,2.1,1.7,DW.stone2);
        pst(g,px+8+Math.round(Math.cos(a)*7),py+8+Math.round(Math.sin(a)*6)-1,DW.stone3);}
      pxLine(g,px+4,py+9,px+12,py+7,'#1d150c',2);
      pxLine(g,px+5,py+6,px+11,py+10,'#241a10',2);
      pxEll(g,px+8,py+8,3.2,2.5,'#2a1108');
      pxEll(g,px+8,py+8,1.8,1.3,'#8c3d18');
      pst(g,px+8,py+8,'#d8822e');
    } else if(p.type==='well'){
      pxEll(g,px+w/2,py+h/2+1,w/2+2,h/2+2,'rgba(4,6,3,.6)');
      pxEll(g,px+w/2,py+h/2-1,w/2+1,h/2,'#3b3a33');
      pxEll(g,px+w/2,py+h/2-1,w/2-3,h/2-3,DW.stone2);
      pxEll(g,px+w/2,py+h/2-1,w/2-4,h/2-4,'#070a08');
      pst(g,px+4,py+6,DW.moss);pst(g,px+w-5,py+9,DW.moss);
      g.fillStyle=DW.trunk;g.fillRect(px+3,py-5,2,8);g.fillRect(px+w-5,py-5,2,8);
      g.fillStyle='#241c16';g.fillRect(px-1,py-9,w+2,5);
      g.fillStyle='#31271e';g.fillRect(px-1,py-9,w+2,2);
      g.fillStyle=DW.moss;g.fillRect(px+2,py-8,4,2);
    } else if(p.type==='lantern'){
      g.fillStyle=DW.trunk;g.fillRect(px+7,py+3,2,12);
      g.fillStyle='#262018';g.fillRect(px+5,py-1,6,1);
      g.fillStyle='#c9933a';g.fillRect(px+6,py,4,4);
      g.fillStyle='#f0c966';g.fillRect(px+7,py+1,2,2);
    } else if(p.type==='traderfire'){
      pxEll(g,px+8,py+8,7.5,6.5,'rgba(8,6,4,.6)');
      for(let i=0;i<6;i++){const a=i/6*6.283;
        pxEll(g,px+8+Math.cos(a)*6,py+8+Math.sin(a)*5,1.7,1.4,DW.stone2);}
      pxEll(g,px+8,py+8,2.8,2,'#261008');
      pxEll(g,px+8,py+8,1.5,1.2,'#9a461c');
    }
  }

  // 4) Крыши построек: обветшалая черепица/шифер, мох, дымоходы и глубокая тень
  const rc=document.createElement('canvas');rc.width=cv.width;rc.height=cv.height;
  const rg=rc.getContext('2d');
  for(const b of World.blds){
    if(!b.wall||b.wall===TILE.FENCE)continue;
    const rh=b.roofH||2;
    const px=b.x*TS-2, py=(b.y-rh)*TS, w=b.w*TS+4, h=rh*TS+2;
    rg._seed=b.x*911+b.y*577;
    const rv=()=>{rg._seed=(rg._seed*1103515245+12345)&0x7fffffff;return rg._seed/0x7fffffff;};
    // отбрасываемая тень от свеса крыши
    rg.fillStyle='rgba(4,6,3,.55)';rg.fillRect(px+2,py+h,w,4);
    rg.fillStyle='#191510';rg.fillRect(px,py,w,h);
    rg.fillStyle='#252018';rg.fillRect(px,py,w,3); // конёк
    for(let yy=py+5;yy<py+h;yy+=4){
      pxLine(rg,px,yy,px+w,yy,'#100d0a');
      for(let xx=px+4+((yy/4|0)%2)*6;xx<px+w-2;xx+=12)
        pxLine(rg,xx,yy,xx,yy+3,'#100d0a');
      for(let xx=px+8+((yy/4|0)%2)*6;xx<px+w-2;xx+=12)
        pst(rg,xx,yy-1,'#2b251c');
    }
    // мох, ржавчина и дымоход
    rg.fillStyle='#0e0b08';rg.fillRect(px,py,2,h);rg.fillRect(px+w-2,py,2,h);
    rg.fillStyle='#2a2419';rg.fillRect(px,py+h-2,w,2);
    for(let i=0;i<w/6;i++){
      if(rv()<.5){rg.fillStyle=rv()<.65?DW.moss:DW.rust;
        rg.fillRect(px+2+(rv()*(w-7)|0),py+2+(rv()*(h-5)|0),2+(rv()*4|0),1+(rv()*2|0));}
    }
    if(b.w>=8){ // труба
      const chx=px+Math.round(w*.7),chy=py+3;
      rg.fillStyle='#2e2c26';rg.fillRect(chx,chy,6,5);
      pxRect(rg,chx,chy,6,5,'#141310');
      rg.fillStyle='#0b0a08';rg.fillRect(chx+1,chy+1,4,2);
    }
    pxRect(rg,px,py,w,h,'#090705');
  }
  World.roof=rc;

  // ---- мини-карта: база ----
  const mm=document.createElement('canvas');mm.width=MAPW;mm.height=MAPH;
  const mg=mm.getContext('2d');
  const MMC={0:'#23271b',1:'#272b1d',2:'#1e2317',3:'#12170e',4:'#192014',5:'#131d1b',
    6:'#34271a',7:'#312c22',8:'#262118',9:'#34271a',10:'#2d2c26',11:'#3b3a33',
    12:'#3a2d21',13:'#322618',14:'#272621',15:'#3a301f',16:'#2e271c'};
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++){
    mg.fillStyle=MMC[World.t[x+y*MAPW]]||'#181a15';mg.fillRect(x,y,1,1);}
  for(const b of World.blds){
    const rh=b.roofH||2;
    mg.fillStyle='#2a2720';mg.fillRect(b.x,b.y,b.w,b.h);
    if(b.wall&&b.wall!==TILE.FENCE){mg.fillStyle='#14110d';mg.fillRect(b.x,b.y-rh,b.w,rh);}}
  for(const p of World.props){
    if(p.type==='tent')mg.fillStyle='#4a613c';
    else if(p.type==='workbench')mg.fillStyle='#55472d';
    else if(p.type==='fire')mg.fillStyle='#a84c24';
    else if(p.type==='well')mg.fillStyle='#45443c';
    else if(p.type==='car')mg.fillStyle='#2c302b';
    else if(p.type==='lantern'||p.type==='traderfire')mg.fillStyle='#c9933a';
    else continue;
    mg.fillRect(p.x,p.y,Math.max(1,p.w),Math.max(1,p.h));
  }
  const mmFog=document.createElement('canvas');mmFog.width=MAPW;mmFog.height=MAPH;
  World.mm=mm;World.mmFog=mmFog;
  World.mmFogCtx=mmFog.getContext('2d');
  World.mmFogImg=World.mmFogCtx.createImageData(MAPW,MAPH);
  const fog=document.createElement('canvas');fog.width=MAPW;fog.height=MAPH;
  World.fog=fog;World.fctx=fog.getContext('2d');
  World.fogImg=World.fctx.createImageData(MAPW,MAPH);
}
function TALL_DRY(rv){return rv()<.32;}
