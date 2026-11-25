'use strict';
/* ============ интерфейс: HUD, сетки, лут, крафт, пиксельные иконки ============ */
var UI={el:null};
function $(id){return document.getElementById(id);}
function itemIcon(id,s){
  const c16=document.createElement('canvas');c16.width=c16.height=16;
  const g16=c16.getContext('2d');g16.imageSmoothingEnabled=false;
  drawItemIcon(g16,id,16);
  const im=g16.getImageData(0,0,16,16), d=im.data, out=new Uint8ClampedArray(d);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
    const i=(y*16+x)*4;
    if(d[i+3]>20){
      const avg=(d[i]+d[i+1]+d[i+2])/3;
      out[i]=Math.round((d[i]*.82+avg*.18)*.92);
      out[i+1]=Math.round((d[i+1]*.82+avg*.18)*.92);
      out[i+2]=Math.round((d[i+2]*.78+avg*.22)*.88);
    } else {
      let adj=false;
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
        const nx=x+dx,ny=y+dy;
        if(nx>=0&&nx<16&&ny>=0&&ny<16&&d[(ny*16+nx)*4+3]>40){adj=true;break;}
      }
      if(adj){out[i]=10;out[i+1]=12;out[i+2]=9;out[i+3]=235;}
    }
  }
  g16.putImageData(new ImageData(out,16,16),0,0);
  const c2=document.createElement('canvas');c2.width=c2.height=s;
  const g2=c2.getContext('2d');g2.imageSmoothingEnabled=false;
  g2.drawImage(c16,0,0,16,16,0,0,s,s);
  return c2;
}
function typeLabel(t){return({mat:'материал',food:'еда',water:'вода',med:'медицина',
  gear:'снаряжение',blade:'холодное оружие',gun:'огнестрельное',ammo:'боеприпасы',val:'ценность'})[t]||t;}

function initUI(){
  UI.el={hud:$('hud'),clock:$('clock'),dayLbl:$('dayLbl'),hint:$('hint'),prog:$('progWrap'),
    progF:$('progFill'),hot:$('hotbar'),log:$('log'),invP:$('invPanel'),invG:$('invGrid'),
    eqB:$('eqBlade'),eqA:$('eqGunA'),eqB2:$('eqGunB'),lootP:$('lootPanel'),lootT:$('lootTitle'),
    lootNote:$('lootNote'),lootBarF:$('lootBarF'),
    lootC:$('lootCon'),lootI:$('lootInv'),craftP:$('craftPanel'),craftT:$('craftTitle'),
    craftL:$('craftList'),tip:$('tip'),exfil:$('exfil'),mm:$('mm'),mmWrap:$('mmWrap'),
    tradeP:$('tradePanel'),tradeC:$('tradeCredit'),tradeGive:$('tradeGive'),tradeOffers:$('tradeOffers'),
    menuP:$('menuPanel'),menuStat:$('menuStat'),saveNote:$('saveNote'),
    saveBtn:$('saveBtn'),loadBtn:$('loadBtn'),exitBtn:$('exitBtn'),resumeBtn:$('resumeBtn'),
    bleedBadge:$('bleedBadge'),flashBadge:$('flashBadge'),vigourBadge:$('vigourBadge'),tentP:$('tentPanel'),tentT:$('tentTitle'),tentInfo:$('tentInfo'),tentUpgBox:$('tentUpgBox'),tentSleepBtn:$('tentSleepBtn'),stashUpg:$('stashUpgBox'),fenceP:$('fencePanel'),fenceT:$('fenceTitle'),fenceInfo:$('fenceInfo'),fenceRep:$('fenceRepairBox'),fenceUpg:$('fenceUpgBox')};
  $('closeBtn4').onclick=closePanel;$('closeBtn5').onclick=closePanel;if($('closeBtn6'))$('closeBtn6').onclick=closePanel;
  if($('tentSleepBtn'))$('tentSleepBtn').onclick=()=>{closePanel();doSleep();};
  $('resumeBtn').onclick=e=>{e.currentTarget.blur();closeMenu();};
  $('saveBtn').onclick=e=>{e.currentTarget.blur();saveGame();};
  $('loadBtn').onclick=e=>{e.currentTarget.blur();loadGame();};
  $('exitBtn').onclick=e=>{e.currentTarget.blur();exitToTitle();};
  $('contBtn').onclick=e=>{e.currentTarget.blur();if(typeof ensureAudio==='function')ensureAudio();if(!loadGame())startGame();};
  if(UI.el.mm){
    UI.el.mm.width=MAPW*MM_S;UI.el.mm.height=MAPH*MM_S;
    UI.el.mmg=UI.el.mm.getContext('2d');UI.el.mmg.imageSmoothingEnabled=false;}
  $('closeBtn').onclick=closePanel;$('closeBtn2').onclick=closePanel;$('closeBtn3').onclick=closePanel;
}

// ---------- пиксельные иконки (сетка 16, без сглаживания) ----------
function drawItemIcon(g,id,s){
  g.clearRect(0,0,s,s);
  const u=s/16;
  const q=(x,y,c,w,h)=>{g.fillStyle=c;
    g.fillRect(Math.round(x*u),Math.round(y*u),
      Math.max(1,Math.round((w===undefined?1:w)*u)),
      Math.max(1,Math.round((h===undefined?(w===undefined?1:w):h)*u)));};
  const cir=(cx,cy,r,c)=>{g.fillStyle=c;
    for(let y=-Math.ceil(r);y<=Math.ceil(r);y++)for(let x=-Math.ceil(r);x<=Math.ceil(r);x++)
      if(x*x+y*y<=r*r)g.fillRect(Math.round((cx+x)*u),Math.round((cy+y)*u),Math.ceil(u),Math.ceil(u));};
  const lin=(x0,y0,x1,y1,c)=>{const n=Math.max(1,Math.max(Math.abs(x1-x0),Math.abs(y1-y0)));
    for(let i=0;i<=n;i++)q(Math.round(x0+(x1-x0)*i/n),Math.round(y0+(y1-y0)*i/n),c);};
  const ring=(cx,cy,r,c)=>{const n=Math.max(10,Math.round(r*6));
    for(let i=0;i<n;i++){const a=i/n*6.283;q(cx+Math.round(Math.cos(a)*r),cy+Math.round(Math.sin(a)*r),c);}};
  switch(id){
    case 'scrap':
      lin(3,12,6,5,'#82878c');lin(6,5,9,9,'#82878c');lin(9,9,13,4,'#82878c');
      q(5,10,'#676c72',6,3);q(5,12,'#4c5055',6,1);break;
    case 'wood':
      q(2,6,'#66492a',11,3);q(2,6,'#7d5c38',11,1);q(2,8,'#46321d',11,1);
      q(3,10,'#5a4126',9,3);q(3,10,'#755634',9,1);
      cir(13,7.5,1.4,'#8a6c42');cir(12,11.5,1.4,'#7d5c38');break;
    case 'cloth':
      q(5,4,'#93999f',4,1);q(3,5,'#93999f',9,2);q(3,7,'#848a90',10,3);
      q(4,10,'#6f757b',8,1);q(5,11,'#6f757b',6,1);q(6,7,'#5f656b',4,1);break;
    case 'beans': case 'hotbeans': case 'stew': case 'hotstew': {
      const hot=id.indexOf('hot')===0;
      q(5,4,'#8a9098',7,1);q(5,5,'#6e747c',7,1);q(5,6,'#7d848c',7,8);
      q(5,6,'#98a0a8',1,6);q(11,6,'#5d636a',1,8);
      q(6,8,id==='stew'||id==='hotstew'?'#6e5230':'#a8683a',5,4);
      q(6,10,'#4c442e',5,1);
      if(hot){q(6,2,'#b9b4a4',1,2);q(10,1,'#b9b4a4',1,2);q(8,2,'#8f8b7e',1,1);}
      break;}
    case 'water':
      q(6,2,'#5a6169',4,1);q(6,3,'#46767c',4,2);q(5,5,'#3f6b70',6,9);
      q(5,5,'#5b8b90',1,7);q(5,13,'#2e5156',6,1);q(6,6,'#6798a0',4,1);break;
    case 'bandage':
      q(3,5,'#e0d8c4',10,1);q(3,6,'#c8c0ac',10,6);q(3,11,'#9a927e',10,1);
      q(7,6,'#a83a30',2,5);q(5,8,'#a83a30',6,2);break;
    case 'painkillers':
      q(3,5,'#8fa3b8',10,7);q(3,11,'#6d7f92',10,1);
      for(let i=0;i<3;i++)for(let j=0;j<2;j++)q(4+i*3,6+j*3,'#d3dbe0',2,2);break;
    case 'medkit':
      q(3,4,'#cfc9b8',10,1);q(3,5,'#b8b2a2',10,8);q(3,12,'#8e887a',10,1);
      q(7,5,'#a83a30',2,7);q(4,8,'#a83a30',8,2);break;
    case 'battery':
      q(6,2,'#8a8f86',4,1);q(5,3,'#3c4c3c',6,11);q(5,3,'#4d5f4b',1,11);
      q(5,5,'#c9b04a',6,3);q(5,7,'#a08a3a',6,1);q(5,12,'#2a352a',6,2);break;
    case 'flashlight':
      q(2,6,'#666b70',7,1);q(2,7,'#4e5358',7,4);q(9,5,'#e8cf6e',2,1);
      q(9,6,'#c9b04a',2,5);q(12,7,'#8a7a3c',1,3);q(13,6,'#6e6232',1,5);q(14,5,'#544b27',1,7);break;
    case 'knife':
      for(let i=0;i<7;i++)q(4+i,11-i,'#aeb2b6');
      for(let i=0;i<5;i++)q(5+i,10-i,'#c6cacc');
      q(10,3,'#5f5648',1,3);q(11,2,'#3c2e1e',3,2);break;
    case 'axe':
      lin(4,13,10,6,'#5f4626');q(8,2,'#8d9297',5,4);q(11,2,'#b4b9be',2,4);q(8,5,'#5f6367',5,1);break;
    case 'pistol':
      q(3,6,'#4b4e53',10,1);q(3,7,'#33363a',10,2);q(5,9,'#2a2c30',3,4);
      q(8,10,'#1d1f22',2,1);q(12,6,'#23262a',1,2);break;
    case 'shotgun':
      q(2,7,'#5e492e',4,1);q(2,8,'#4c3a24',4,2);q(6,7,'#4c3a24',3,2);
      q(5,5,'#45474a',10,1);q(5,6,'#2c2e30',7,1);q(14,5,'#232527',1,2);break;
    case 'rifle':
      q(3,6,'#4c3a25',3,1);q(2,7,'#4c3a25',4,3);q(5,6,'#3a3d42',10,1);
      q(5,7,'#2f3236',10,2);q(8,4,'#3a3e46',3,1);q(8,5,'#1e2024',3,1);q(11,7,'#494d52',1,2);break;
    case 'ammo_p':
      for(const x of[3,6,9]){q(x,5,'#c9a456',2,2);q(x,7,'#a5813a',2,5);q(x,11,'#8f6f2e',2,1);}break;
    case 'ammo_s':
      for(const x of[3,6,9]){q(x,5,'#a04a38',2,1);q(x,6,'#96402f',2,5);q(x,11,'#b08c3e',2,2);}break;
    case 'ammo_r':
      for(const x of[3,6,9]){q(x,4,'#8d7a4e',2,2);q(x,6,'#6e5c34',2,6);q(x,11,'#57492a',2,2);}break;
    case 'coins':
      cir(8,11,3,'#8f7a38');cir(8,10,3,'#c9a84a');q(6,10,4,1,'#b09040');
      cir(8,8,3,'#8f7a38');cir(8,7,3,'#c9a84a');
      cir(8,5,3,'#9a8544');cir(8,4,3,'#cfae52');q(6,4,4,1,'#b09040');break;
    case 'ring':
      ring(7,9,3,'#c9a84a');ring(7,9,2,'#8f7a38');
      q(10,3,'#7dc2a8',2,2);q(10,3,'#a4e0c8',2,1);break;
    case 'watch':
      ring(8,9,3.4,'#8f8d7e');ring(8,9,3,'#c9b04a');
      q(6,7,'#3a3d40',4,4);q(8,7,'#c9b04a',1,2);q(8,9,'#c9b04a',2,1);
      q(7,4,'#8f8d7e',2,1);break;
    case 'tape':
      cir(7,8,4.4,'#23262a');cir(7,8,2,'#4c5055');
      q(11,4,'#2b2e33',3,1);q(13,4,'#1d2024',1,6);
      q(4,4,'#3a3e44',3,1);break;
    case 'rope':
      ring(8,8,4,'#9a8a5e');ring(8,8,2.4,'#8a7a50');
      lin(9,4,13,2,'#a89868');q(12,1,'#8a7a50',2,2);break;
    case 'pipe':
      q(2,6,'#5d6166',12,4);q(2,6,'#767b80',12,1);q(2,9,'#43474c',12,1);
      q(1,5,'#6a6f74',2,6);q(13,5,'#6a6f74',2,6);
      q(4,7,'#6b4a2e',3,1);q(9,8,'#6b4a2e',2,1);break;
    case 'groats':
      q(4,5,'#8d7a4e',8,9);q(4,5,'#a08c5c',8,1);q(4,13,'#6e5c34',8,1);
      q(6,3,'#8d7a4e',4,2);
      for(const p of[[6,8],[8,9],[10,7],[7,11],[10,11]])q(p[0],p[1],'#d8cfa8');break;
    case 'cookies':
      cir(6,9,3.2,'#a8763e');cir(11,7,2.8,'#96682f');
      for(const p of[[5,8],[7,10],[11,6]])q(p[0],p[1],'#5d3f1c');break;
    case 'broth':
      cir(8,10,4.5,'#7d4a26');q(4,9,'#a84a2a',8,2);q(5,8,'#c96b38',6,2);
      q(6,9,'#d8cfa8',1,1);q(9,10,'#8a9a5a',1,1);
      q(6,3,'#b9b4a4',1,2);q(9,2,'#b9b4a4',1,3);break;
    case 'porridge':
      cir(8,10,4.2,'#b8b2a2');q(4,9,'#cfc9b8',8,2);q(5,8,'#d8cfa8',6,2);
      q(6,3,'#8f8b7e',1,2);q(9,2,'#8f8b7e',1,3);break;
    case 'mre':
      q(3,4,'#5d6446',10,9);q(3,4,'#6e7752',10,1);q(3,12,'#454b34',10,1);
      q(4,6,'#8f9a6b',8,1);q(6,8,'#c9c2ae',4,3);q(7,9,'#a83a30',2,1);break;
    case 'tea':
      q(4,6,'#8a6c42',7,7);q(4,6,'#9a7c4e',7,1);q(4,12,'#5d4526',8,1);
      q(11,7,'#8a6c42',2,1);q(12,7,'#8a6c42',1,4);
      q(5,8,'#3f2f1a',5,2);q(6,2,'#8f8b7e',1,2);q(9,1,'#8f8b7e',1,3);break;
    case 'thermos':
      q(5,3,'#6a6f74',6,2);q(5,5,'#82878c',6,9);q(5,5,'#9a9fa4',2,9);
      q(5,13,'#5d6166',6,1);q(6,7,'#4c5055',4,1);break;
    case 'tincture':
      q(6,2,'#4c3a25',4,2);q(5,4,'#6e4f2e',6,9);q(5,4,'#8a6c42',2,9);
      q(6,7,'#c9b04a',4,3);q(7,8,'#e8cf6e',2,1);break;
    case 'morphine':
      lin(3,12,10,5,'#b8bdc2');q(10,4,'#8f9499',3,3);lin(11,3,13,1,'#d8d4c4');
      q(4,4,'#cfc9b8',2,4);q(4,3,'#8f9499',2,1);break;
    case 'surgical':
      q(2,4,'#8e3a30',12,9);q(2,4,'#a8483a',12,1);q(2,12,'#5d2620',12,1);
      q(7,5,'#e0d8c4',2,7);q(4,8,'#e0d8c4',8,2);q(6,3,'#c9c2ae',4,1);break;
    case 'saw':
      q(2,9,'#4c5055',11,2);
      for(let i=0;i<6;i++)q(2+i*2,11,'#5d6166');
      q(11,5,'#5f4626',4,4);q(12,6,'#7d5c38',2,2);break;
    case 'revolver':
      q(3,6,'#4b4e53',9,1);q(3,7,'#33363a',9,2);
      cir(6,8,2.2,'#5d6166');cir(6,8,1,'#23262a');
      q(5,9,'#2a2c30',3,4);q(9,9,'#1d1f22',1,2);q(12,6,'#23262a',1,2);break;
    case 'smg':
      q(2,6,'#3f4247',10,2);q(12,6,'#5d6166',2,1);
      q(4,8,'#2a2c30',3,4);q(8,8,'#33363a',2,3);
      q(2,5,'#54585d',3,1);q(9,4,'#54585d',2,2);break;
    case 'lever':
      q(1,7,'#5f4626',5,3);q(5,6,'#3a3d42',10,2);q(5,8,'#2f3236',8,1);
      q(8,4,'#43474c',4,1);q(8,5,'#1e2024',4,1);
      cir(7,10,1.6,'#8b9095');lin(7,10,10,11,'#8b9095');q(14,6,'#232527',1,2);break;
    case 'pouch':
      q(4,5,'#6b5330',8,8);q(4,5,'#7d6138',8,1);q(4,12,'#4c3a21',8,1);
      q(6,4,'#6b5330',4,2);q(7,7,'#c9a84a',2,2);break;
    case 'necklace':
      ring(8,7,4,'#c9a84a');q(4,11,'#c9a84a',1,2);q(11,11,'#c9a84a',1,2);
      cir(8,12,2,'#5aa7e0');cir(8,12,1,'#a8d4f0');break;
    case 'idol':
      q(6,3,'#4a3a22',4,3);q(5,6,'#5d4a2a',6,7);q(5,13,'#3a2e1b',6,1);
      q(6,7,'#c9c2ae',1,1);q(9,7,'#c9c2ae',1,1);q(7,10,'#2a2114',2,1);
      q(4,8,'#4a3a22',1,4);q(11,8,'#4a3a22',1,4);break;
    case 'gold_bar':
      q(3,7,'#c9a84a',10,5);q(3,7,'#e0c46a',10,1);q(3,11,'#9a7f38',10,1);
      q(5,6,'#cfae52',6,1);q(6,9,'#8f7a38',4,1);break;
    case 'meat': case 'hotmeat': {
      const hot=id==='hotmeat';
      q(3,5,'#8e3a30',10,7);q(3,5,'#a84a3a',10,1);q(3,11,'#6e2a22',10,1);
      q(5,7,'#c98a72',5,2);q(12,8,'#e0d8c4',2,3);
      if(hot){q(4,3,'#8f8b7e',1,2);q(8,2,'#8f8b7e',1,2);q(11,3,'#8f8b7e',1,1);
        q(3,5,'#b06a3a',10,1);}break;}
    case 'trap':
      q(2,10,'#5d6166',12,2);q(2,10,'#767b80',12,1);
      lin(3,10,8,4,'#8b9095');lin(8,4,13,10,'#8b9095');
      cir(8,4,1.6,'#c9c2ae');q(4,12,'#a83a30',2,2);q(10,12,'#a83a30',2,2);
      lin(1,8,3,10,'#9a8a5e');break;
    case 'cans':
      q(5,6,'#8a8f86',6,7);q(5,6,'#a8ada4',2,7);q(5,12,'#5d6166',6,1);
      q(6,5,'#6a6f74',4,1);lin(1,3,5,6,'#9a9a8a');
      q(10,9,'#a83a30',1,2);break;
    default:
      q(4,4,'#c9c2ae',8,8);
  }
}

// ---------- слоты и подсказки (с перетаскиванием) ----------
var _drag=null;
function handleSlotDrop(dst){
  if(!_drag||!dst)return;
  const src=_drag; _drag=null;
  if(src.src===dst.src&&src.idx===dst.idx)return;
  const getArr=(kind)=>kind==='inv'?G.inv:(G.ui.con?G.ui.con.items:null);
  const a1=getArr(src.src), a2=getArr(dst.src);
  if(!a1||!a2)return;
  const it1=a1[src.idx], it2=a2[dst.idx];
  if(!it1)return;
  if(src.src==='con'&&!it1.known)return;
  if(dst.src==='con'&&it2&&!it2.known)return;
  if(dst.src==='con'&&G.ui.con&&!G.ui.con.fixed&&!it2&&dst.idx>=a2.length)return;
  const stk=ITEMS[it1.id].stk||1;
  if(it2&&it2.id===it1.id&&it2.n<stk){
    const add=Math.min(it1.n,stk-it2.n);
    it2.n+=add; it1.n-=add;
    if(it1.n<=0)a1[src.idx]=null;
  } else {
    if(dst.src==='con'){it1.known=true;it1.cost=null;}
    a2[dst.idx]=it1;
    a1[src.idx]=it2||null;
  }
  SFX.click();
  if(G.ui.panel===UI.el.invP)renderInv();
  if(G.ui.panel===UI.el.lootP)renderLoot();
  renderHUD();
}
function slotEl(it,cb,rcb,extraCls,dragInfo,iconSize){
  const d=document.createElement('div');d.className='slot'+(extraCls?' '+extraCls:'');
  if(it){d.appendChild(itemIcon(it.id,iconSize||40));d.style.borderColor=RAR[ITEMS[it.id].r];
    if(it.n>1){const s=document.createElement('span');s.className='cnt';s.textContent=it.n;d.appendChild(s);}
    d.onmouseenter=e=>showTip(it.id,e);d.onmousemove=moveTip;d.onmouseleave=hideTip;
    if(typeof TOUCH!=='undefined'&&TOUCH.on)d.addEventListener('touchstart',e=>{showTip(it.id,e);setTimeout(hideTip,1600);},{passive:true});}
  if(dragInfo){
    if(it&&it.known!==false){
      d.draggable=true;
      d.ondragstart=e=>{_drag=dragInfo;if(e.dataTransfer)e.dataTransfer.effectAllowed='move';hideTip();};
    }
    d.ondragover=e=>{e.preventDefault();d.style.outline='1px solid #96a878';};
    d.ondragleave=()=>{d.style.outline='';};
    d.ondrop=e=>{e.preventDefault();d.style.outline='';handleSlotDrop(dragInfo);};
  }
  if(cb)d.onclick=cb;
  if(rcb)d.oncontextmenu=e=>{e.preventDefault();rcb();};
  return d;
}
function showTip(id,e){const d=ITEMS[id],t=UI.el.tip;
  t.innerHTML='<div class="nm" style="color:'+RAR[d.r]+'">'+d.n+'</div>'+
    '<div class="ds" style="color:'+RAR[d.r]+'">редкость: '+RAR_N[d.r]+'</div>'+
    (d.d?'<div class="ds">'+d.d+'</div>':'')+
    (d.w?'<div class="ds">урон '+d.w.dmg+(d.w.pellets?'×'+d.w.pellets:'')+(d.w.mag?' · магазин '+d.w.mag:'')+'</div>':'')+
    (d.food?'<div class="ds">+'+d.food+' сытости'+(d.hp?' · +'+d.hp+' здоровья':'')+'</div>':'')+
    (d.thirst?'<div class="ds">+'+d.thirst+' жажды</div>':'')+
    (d.heal?'<div class="ds">+'+d.heal+' здоровья'+(d.bleed?', останавливает кровь':'')+'</div>':'')+
    (d.v?'<div class="ds">Ценность ~ '+d.v+'</div>':'')+
    '<div class="tp">'+typeLabel(d.t)+'</div>';
  t.classList.remove('hidden');moveTip(e);}
function moveTip(e){const t=UI.el.tip;
  t.style.left=Math.min(innerWidth-250,e.clientX+14)+'px';
  t.style.top=Math.min(innerHeight-150,e.clientY+14)+'px';}
function hideTip(){UI.el.tip.classList.add('hidden');}

// ---------- панели ----------
function openPanel(p){if(G.ui.panel&&G.ui.panel!==p)closePanel();
  G.ui.panel=p;G.paused=true;
  [UI.el.invP,UI.el.lootP,UI.el.craftP,UI.el.tradeP].forEach(q=>q&&q.classList.add('hidden'));
  p.classList.remove('hidden');hideTip();SFX.uiOpen();}
function closePanel(){if(!G)return;
  const c=G.ui.con;
  if(c&&unknownIdx(c)>=0){
    c.sacc-=1.2;
    log('Обыск прерван — в '+CTYPE[c.type].n.toLowerCase()+' ещё что-то лежит. Заново: E у контейнера.','a06a5a');
  }
  if(G.ui.panel){G.ui.panel.classList.add('hidden');G.ui.panel=null;G.ui.con=null;G.paused=false;G.eHeld=false;hideTip();SFX.uiClose();}
  else hideTip();}
function openInv(){renderInv();openPanel(UI.el.invP);}

// ---------- меню паузы: сохранение, загрузка, выход ----------
function openMenu(){
  if(!G||G.ui.menu)return;
  if(G.ui.panel)closePanel();
  G.ui.menu=true;G.paused=true;G.eHeld=false;
  UI.el.menuStat.innerHTML=
    'День '+G.day+', '+fmtTime(G.hours)+'. Здоровье '+Math.round(G.p.hp)+
    ' · в рюкзаке '+G.inv.filter(s=>s).length+' вещей · схрон '+
    ((G.stash||[]).filter(s=>s).length)+'/'+(G.stash?G.stash.length:40)+' ячеек.<br>'+
    'ЦЕННОСТИ ~'+G.stats.value+' · сбито '+G.stats.kills+' · обыскано '+G.stats.looted+'.';
  const inf=saveInfo();
  UI.el.loadBtn.disabled=!inf;
  UI.el.saveNote.textContent=inf
    ? ('сохранено раньше: день '+inf.day+', '+fmtTime(inf.hours)+' · '+
      new Date(inf.when).toLocaleDateString('ru-RU')+' '+
      new Date(inf.when).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}))
    : 'сохранений пока нет';
  UI.el.menuP.classList.remove('hidden');
  hideTip();SFX.uiOpen();
}
function closeMenu(){
  if(!G||!G.ui.menu)return;
  G.ui.menu=false;G.paused=false;
  UI.el.menuP.classList.add('hidden');SFX.uiClose();
}
function refreshTitle(){
  const btn=$('contBtn');if(!btn)return;
  const inf=saveInfo();
  btn.classList.toggle('hidden',!inf);
  if(inf)btn.textContent='ПРОДОЛЖИТЬ — ДЕНЬ '+inf.day+', '+fmtTime(inf.hours);
}
function openLoot(c){G.ui.con=c;startSearch(c);renderLoot();openPanel(UI.el.lootP);}

// ---------- обыск ----------
function unknownIdx(c){for(let i=0;i<c.items.length;i++){const it=c.items[i];if(it&&!it.known)return i;}return -1;}
function itemCost(c,it){return (CTYPE[c.type].srch||1.5)*(1+.16*(ITEMS[it.id].r||0));}
function knownCount(c){let n=0;for(const it of c.items)if(it)if(it.known)n++;return n;}
function startSearch(c){
  if(c.fixed){c.searched=unknownIdx(c)<0;return;}
  if(!c.items.length){c.searched=true;return;}
  c.searched=unknownIdx(c)<0;
  SFX.search();
  const nz=CTYPE[c.type].noise;
  if(nz)noiseAt(G.p.x,G.p.y,nz*TS);
  if(!c.searched)log('Роемся в '+CTYPE[c.type].n.toLowerCase()+'. Быстро всё не разобрать — ищем по очереди.','97a17f');
}
function tickSearch(dt){
  const c=G.ui.con;
  if(!c||G.ui.panel!==UI.el.lootP||G.state!=='play')return;
  const i=unknownIdx(c);
  if(i<0){c.searched=true;setSearchHud(c,-1,1);return;}
  const it=c.items[i];
  if(it.cost==null)it.cost=itemCost(c,it);
  c.sacc+=dt;
  const k=Math.min(1,c.sacc/it.cost);
  if(c.sacc>=it.cost){
    c.sacc=0;it.known=true;SFX.flip();
    renderLoot();
    if(unknownIdx(c)<0){c.searched=true;
      log('В '+CTYPE[c.type].n.toLowerCase()+' больше ничего нет.','8f8d7e');}
  } else setSearchHud(c,i,k);
}
function setSearchHud(c,idx){
  const total=c.items.length,found=knownCount(c);
  if(c.fixed){
    UI.el.lootT.textContent=CTYPE[c.type].n+' — '+found+'/'+c.fixed+' ячеек занято';
    UI.el.lootNote.classList.remove('busy');
    UI.el.lootNote.textContent=found?'Ваше всё на виду: клик по вещи — взять, клик по рюкзаку — доложить'
      :'Схрон пуст. Складывайте сюда лишнее — до '+c.fixed+' ячеек.';
    UI.el.lootBarF.style.width=Math.round(found/c.fixed*100)+'%';return;
  }
  UI.el.lootT.textContent=CTYPE[c.type].n+' — найдено '+found+'/'+total;
  if(idx<0||!total){
    UI.el.lootNote.classList.remove('busy');
    UI.el.lootNote.textContent=total?'ОБЫСКАНО ДО ДНА — больше тут ничего нет':'ПУСТО';
    UI.el.lootBarF.style.width='100%';return;
  }
  const it=c.items[idx],cost=it.cost||itemCost(c,it);
  UI.el.lootNote.classList.add('busy');
  UI.el.lootNote.textContent='ИЩЕМ… до следующей находки ещё ~'+Math.max(.1,cost-c.sacc).toFixed(1)+' с';
  UI.el.lootBarF.style.width=Math.min(100,(found+c.sacc/cost)/total*100)+'%';
  if(UI._rf)UI._rf.style.width=Math.round(Math.min(1,c.sacc/cost)*100)+'%';
}

function upgCostHtml(cost){
  return cost.map(q=>'<span class="'+(countTotalItem(q[0])>=q[1]?'ok':'no')+'">'+
    ITEMS[q[0]].n+' '+countTotalItem(q[0])+'/'+q[1]+'</span>').join(', ');
}
function upgradeBase(key){
  if(!G.upg)G.upg={bench:1,stash:1,tent:1,fire:1};
  const lv=G.upg[key]||1;
  if(lv>=3)return;
  const next=BASE_UPG[key][lv+1];
  if(!next||!next.cost.every(q=>countTotalItem(q[0])>=q[1])){SFX.dry();return;}
  for(const q of next.cost)removeTotalItem(q[0],q[1]);
  G.upg[key]=lv+1;
  if(key==='stash'){
    const ns=next.slots;
    if(G.stash)while(G.stash.length<ns)G.stash.push(null);
    const sc=World&&World.conts.find(c=>c.type==='stash');
    if(sc){sc.fixed=ns;sc.items=G.stash;sc.searched=true;}
  }
  if(key==='fire'&&World){
    const fp=World.props.find(p=>p.type==='fire');
    if(fp)fp.light=next.light;
  }

  SFX.craft();
  log('Улучшено: '+next.n+' (Ур. '+(lv+1)+')!','8aa06b');
  if(G.ui.panel===UI.el.craftP)renderCraft();
  if(G.ui.panel===UI.el.lootP)renderLoot();
  if(G.ui.panel===UI.el.tentP)renderTent();
  if(G.ui.panel===UI.el.fenceP)renderFence();
  renderHUD();
}

var _curFenceSeg=null;
function upgradeDoor(side){
  if(!G.upg)G.upg={bench:1,stash:1,tent:1,fire:1,doors:{N:1,S:1,E:1,W:1}};
  if(!G.upg.doors)G.upg.doors={N:1,S:1,E:1,W:1};
  const lv=G.upg.doors[side]||1;
  if(lv>=5)return;
  const next=BASE_UPG.door[lv+1];
  if(!next||!next.cost.every(q=>countTotalItem(q[0])>=q[1])){SFX.dry();return;}
  for(const q of next.cost)removeTotalItem(q[0],q[1]);
  G.upg.doors[side]=lv+1;
  const seg=World&&World.segs.find(s=>s.side===side);
  if(seg){seg.max=next.maxHp;seg.hp=next.maxHp;World.anyBreach=World.segs.some(s=>s.hp<=0);}
  SFX.craft();
  log('Дверь ('+SIDE_N[side]+') улучшена: '+next.n+'!','8aa06b');
  if(G.ui.panel===UI.el.fenceP)renderFence();
  renderHUD();
}
function openFence(seg){_curFenceSeg=seg;renderFence();openPanel(UI.el.fenceP);}
function renderFence(){
  const s=_curFenceSeg||(World&&World.segs[0]); if(!s)return;
  const lv=(G.upg&&G.upg.doors&&G.upg.doors[s.side])||1, cur=BASE_UPG.door[lv], nxt=BASE_UPG.door[lv+1];
  UI.el.fenceT.textContent='Дверь ('+SIDE_N[s.side]+') · Ур. '+lv+'/5';
  UI.el.fenceInfo.innerHTML=cur.n+' · Прочность: <b style="color:#c9cfb4">'+s.hp+'/'+s.max+'</b><br>'+cur.desc;

  const repBox=UI.el.fenceRep; repBox.innerHTML='';
  const needRep=s.hp<s.max, hasWood=countTotalItem('wood')>=4;
  const rr=document.createElement('div');rr.className='rec';rr.style.borderBottom='none';
  rr.innerHTML='<div style="flex:1"><div style="color:#c9cfb4;font-size:12px">Починить дверь</div><div class="ing">'+
    (needRep?upgCostHtml([['wood',4]]):'<span class="ok">Дверь полностью цела</span>')+'</div></div>';
  const rb=document.createElement('button');rb.textContent='ПОЧИНИТЬ';rb.disabled=!needRep||!hasWood;
  rb.onclick=()=>{
    removeTotalItem('wood',4);s.hp=s.max;
    World.anyBreach=World.segs.some(q=>q.hp<=0);
    SFX.craft();log('Дверь ('+SIDE_N[s.side]+') восстановлена.','8aa06b');
    renderFence();renderHUD();
  };
  rr.appendChild(rb);repBox.appendChild(rr);

  const uBox=UI.el.fenceUpg; uBox.innerHTML='';
  if(!nxt){
    uBox.innerHTML='<div style="font-size:11px;color:#8aa06b">Максимальный уровень: бетонный шлюз.</div>';
    return;
  }
  const ok=nxt.cost.every(q=>countTotalItem(q[0])>=q[1]);
  const ur=document.createElement('div');ur.className='rec';ur.style.borderBottom='none';
  ur.innerHTML='<div style="flex:1"><div style="color:#c9cfb4;font-size:12px">Ур. '+(lv+1)+': '+nxt.n+'</div>'+
    '<div style="font-size:10px;color:#7d7a6b;margin:2px 0">'+nxt.desc+'</div>'+
    '<div class="ing">'+upgCostHtml(nxt.cost)+'</div></div>';
  const ub=document.createElement('button');ub.textContent='УЛУЧШИТЬ';ub.disabled=!ok;
  ub.onclick=()=>upgradeDoor(s.side);
  ur.appendChild(ub);uBox.appendChild(ur);
}

function openTent(){renderTent();openPanel(UI.el.tentP);}
function renderTent(){
  const lv=(G.upg&&G.upg.tent)||1, cur=BASE_UPG.tent[lv], nxt=BASE_UPG.tent[lv+1];
  UI.el.tentT.textContent='Палатка · Ур. '+lv+'/3 ('+cur.n+')';
  UI.el.tentInfo.textContent=cur.desc;
  const box=UI.el.tentUpgBox; box.innerHTML='';
  if(!nxt){
    box.innerHTML='<div style="font-size:11px;color:#8aa06b">Максимальный уровень убежища.</div>';
    return;
  }
  const ok=nxt.cost.every(q=>countTotalItem(q[0])>=q[1]);
  const row=document.createElement('div');row.className='rec';row.style.borderBottom='none';
  row.innerHTML='<div style="flex:1"><div style="color:#c9cfb4;font-size:12px">Ур. '+(lv+1)+': '+nxt.n+'</div>'+
    '<div style="font-size:10px;color:#7d7a6b;margin:2px 0">'+nxt.desc+'</div>'+
    '<div class="ing">'+upgCostHtml(nxt.cost)+'</div></div>';
  const btn=document.createElement('button');btn.textContent='УЛУЧШИТЬ';btn.disabled=!ok;
  btn.onclick=()=>upgradeBase('tent');
  row.appendChild(btn);box.appendChild(row);
}

function openCraft(cook){G.ui.cook=cook;renderCraft();openPanel(UI.el.craftP);}

function renderInv(){
  hideTip();
  UI.el.invG.innerHTML='';
  for(let i=0;i<G.inv.length;i++)
    UI.el.invG.appendChild(slotEl(G.inv[i],()=>useOrEquip(i),()=>dropItem(i),null,{src:'inv',idx:i}));
  for(const pair of [[UI.el.eqB,'blade'],[UI.el.eqA,'gunA'],[UI.el.eqB2,'gunB']]){
    const el=pair[0],k=pair[1];el.innerHTML='';
    const w=G.eq[k];
    if(w){el.appendChild(itemIcon(w,40));el.style.borderColor=RAR[ITEMS[w].r];el.title='';
      el.onclick=()=>unequip(k);
      el.onmouseenter=e=>showTip(w,e);el.onmousemove=moveTip;el.onmouseleave=hideTip;}
    else el.style.borderColor='';
  }
}
function useOrEquip(i){
  const s=G.inv[i];if(!s)return;const d=ITEMS[s.id];
  const take=()=>{s.n--;if(s.n<=0)G.inv[i]=null;};
  if(s.id==='battery'){
    if(countItem('flashlight')<=0){log('Фонаря нет — заряжать нечего.','a06a5a');}
    else if(G.p.flashT>=295){log('Фонарь уже полностью заряжен.');}
    else{G.p.flashT=300;take();SFX.craft();log('Фонарь заряжен свежей батарейкой (100%).','8aa06b');}
  }
  else if(d.food){G.p.hunger=Math.min(100,G.p.hunger+d.food);if(d.thirst)G.p.thirst=Math.min(100,G.p.thirst+d.thirst);if(d.hp)G.p.hp=Math.min(100,G.p.hp+d.hp);
    take();SFX.eat();log('Съедено: '+d.n+'.');}
  else if(d.thirst){G.p.thirst=Math.min(100,G.p.thirst+d.thirst);take();SFX.drink();log('Выпито: '+d.n+'.');}
  else if(d.heal){G.p.hp=Math.min(100,G.p.hp+d.heal);if(d.bleed){G.p.bleed=0;log('Кровотечение остановлено.','8aa06b');}
    take();SFX.craft();log('Применено: '+d.n+'.');}
  else if(d.t==='gun')equipGun(i);
  else if(d.t==='blade')swapBlade(i);
  else if(d.t==='place'){if(placeSpotOK(G.p)){take();World.placed.push({kind:s.id==='trap'?'trap':'can',x:G.p.x,y:G.p.y+8,cd:0});SFX.craft();log('Установлено: '+d.n+'.','8aa06b');}else{SFX.dry();log('Здесь нельзя поставить — отойдите на свободное место.','a06a5a');}}
  else if(d.t==='gear')log(d.n+' работает пассивно. F — включить.');
  else if(d.t==='val')log('Ценность. Когда-нибудь пригодится для обмена.');
  else log(d.n+' — материал для верстака.');
  if(G.ui.panel===UI.el.invP)renderInv();
  renderHUD();
}
function quickHeal(){
  if(!G||G.state!=='play')return;
  const p=G.p;
  if(p.bleed<=0&&p.hp>=100){log('Ранений нет.');return;}
  const order=p.bleed>0
    ?['bandage','painkillers','tincture','medkit','morphine','surgical']
    :['painkillers','tincture','bandage','medkit','morphine','surgical'];
  for(const id of order){
    const idx=G.inv.findIndex(s=>s&&s.id===id);
    if(idx>=0){useOrEquip(idx);return;}
  }
  log('Нет бинтов и медикаментов!','a06a5a');SFX.dry();
}
function equipGun(i){
  const s=G.inv[i];let slot=null;
  if(!G.eq.gunA)slot='gunA';else if(!G.eq.gunB)slot='gunB';
  if(slot){G.eq[slot]=s.id;G.ws[slot].mag=0;
    s.n--;if(s.n<=0)G.inv[i]=null;G.p.cur=slot;log('Взяли в руки: '+ITEMS[s.id].n+'.');}
  else if(G.p.cur==='gunA'||G.p.cur==='gunB'){
    const k=G.p.cur,old=G.eq[k];G.eq[k]=s.id;G.ws[k].mag=0;
    G.inv[i]={id:old,n:1};log('Оружие заменено.');}
  else log('Обе оружейные ячейки заняты.');
}
function swapBlade(i){
  const s=G.inv[i],old=G.eq.blade;G.eq.blade=s.id;
  if(old)G.inv[i]={id:old,n:1};else{s.n--;if(s.n<=0)G.inv[i]=null;}
  G.p.cur='blade';log('Взяли в руки: '+ITEMS[G.eq.blade].n+'.');
}
function unequip(k){
  if(!G.eq[k])return;
  const i=G.inv.findIndex(s=>!s);
  if(i<0){log('Рюкзак переполнен.');return;}
  G.inv[i]={id:G.eq[k],n:1};G.eq[k]=null;G.ws[k].mag=0;
  if(G.p.cur===k)G.p.cur='blade';
  renderInv();renderHotbar();
}
function dropItem(i){const s=G.inv[i];if(!s)return;
  log('Выкинули: '+ITEMS[s.id].n+'.','a06a5a');G.inv[i]=null;renderInv();}

// ---------- лут ----------
function renderLoot(){
  hideTip();
  const c=G.ui.con;
  const ti=unknownIdx(c);
  const n=c.fixed||Math.max(5,c.items.length);
  const bigStash=!!(c.fixed&&c.fixed>=40);
  if(bigStash){
    UI.el.lootC.style.gridTemplateColumns='repeat(10,32px)';
    UI.el.lootC.style.maxHeight='';
    UI.el.lootC.style.overflowY='visible';
  } else {
    UI.el.lootC.style.gridTemplateColumns='repeat(5,52px)';
    UI.el.lootC.style.maxHeight='';
    UI.el.lootC.style.overflowY='';
  }
  const sz=bigStash?26:40, cls=bigStash?'mini':null;
  if(c.type==='stash'){
    const slv=(G.upg&&G.upg.stash)||1, curS=BASE_UPG.stash[slv], nxtS=BASE_UPG.stash[slv+1];
    UI.el.lootT.textContent=curS.n+' · Ур. '+slv+'/3 ('+c.fixed+' яч.)';
    UI.el.stashUpg.classList.remove('hidden');
    UI.el.stashUpg.innerHTML='';
    if(nxtS){
      const ok=nxtS.cost.every(q=>countTotalItem(q[0])>=q[1]);
      const row=document.createElement('div');row.className='rec';row.style.borderBottom='none';row.style.padding='2px 0';
      row.innerHTML='<div style="flex:1"><div style="color:#b8c49a;font-size:11px">Улучшить до '+nxtS.slots+' яч. ('+nxtS.n+')</div><div class="ing">'+upgCostHtml(nxtS.cost)+'</div></div>';
      const ub=document.createElement('button');ub.textContent='УЛУЧШИТЬ';ub.disabled=!ok;
      ub.onclick=()=>upgradeBase('stash');
      row.appendChild(ub);UI.el.stashUpg.appendChild(row);
    } else {
      UI.el.stashUpg.innerHTML='<div style="font-size:11px;color:#8aa06b">Схрон улучшен до максимума (100 яч.).</div>';
    }
  } else {
    UI.el.stashUpg.classList.add('hidden');
  }
  UI.el.lootC.innerHTML='';UI._rf=null;
  for(let i=0;i<n;i++){
    const it=c.items[i];
    const di={src:'con',idx:i};
    if(!it){UI.el.lootC.appendChild(slotEl(null,null,null,cls,di,sz));continue;}
    if(it.known){UI.el.lootC.appendChild(slotEl(it,()=>takeFromCon(i),null,cls,di,sz));continue;}
    const d=document.createElement('div');
    if(i===ti){
      d.className='slot live';
      d.innerHTML='<div class="ring"></div><div class="ring2"></div>'+
        '<svg class="mag" width="24" height="24" viewBox="0 0 24 24">'+
        '<circle cx="10" cy="10" r="6.3" fill="none" stroke="#b8c69a" stroke-width="1.7"/>'+
        '<path d="M14.7 14.7 L20.4 20.4" stroke="#b8c69a" stroke-width="2.3" fill="none" stroke-linecap="round"/>'+
        '<path d="M7.5 8.7a3.6 3.6 0 0 1 3.3-2.2" stroke="#e7ecd8" stroke-width="1.2" fill="none"/></svg>'+
        '<div class="rf"><i></i></div>';
      UI._rf=d.querySelector('.rf i');
    } else d.className='slot dim';
    UI.el.lootC.appendChild(d);
  }
  UI.el.lootI.innerHTML='';
  for(let i=0;i<G.inv.length;i++)
    UI.el.lootI.appendChild(slotEl(G.inv[i],i<G.inv.length?(()=>putToCon(i)):null,null,null,{src:'inv',idx:i}));
  if(c.type!=='stash')setSearchHud(c,ti); else UI.el.lootBarF.style.width='100%';
}
function takeFromCon(i){
  const c=G.ui.con,it=c.items[i];
  if(!it||!it.known)return;
  const rem=addItem(it.id,it.n),taken=it.n-rem;
  if(taken>0){
    if(rem>0)it.n=rem;
    else if(c.fixed)c.items[i]=null;
    else c.items.splice(i,1);
    SFX.pick(ITEMS[it.id].r);
    if(ITEMS[it.id].v)G.stats.value+=ITEMS[it.id].v*taken;
    autoEquip(it.id);
    if(!c.fixed&&!c.items.length)c.searched=true;}
  else SFX.dry();
  renderLoot();renderHUD();
}
function putToCon(i){
  const c=G.ui.con,s=G.inv[i];if(!s)return;
  s.known=true;s.cost=null;
  if(c.fixed){
    const stk=ITEMS[s.id].stk||1;
    let at=-1;
    for(let k=0;k<c.fixed;k++){const q=c.items[k];
      if(q&&q.id===s.id&&q.n<stk){at=k;break;}}
    if(at<0)at=c.items.findIndex(q=>!q);
    if(at<0){SFX.dry();log('Схрон забит: все '+c.fixed+' ячеек заняты.','a06a5a');return;}
    const q=c.items[at];
    if(q){const add=Math.min(s.n,stk-q.n);q.n+=add;s.n-=add;if(s.n<=0)G.inv[i]=null;}
    else{c.items[at]=s;G.inv[i]=null;}
    SFX.pick(ITEMS[s.id].r);
    renderLoot();renderHUD();return;
  }
  c.items.push(s);G.inv[i]=null;
  renderLoot();
}
function autoEquip(id){
  const d=ITEMS[id];
  if(d.t==='gun'){
    let sl=null;if(!G.eq.gunA)sl='gunA';else if(!G.eq.gunB)sl='gunB';
    if(!sl)return;const i=G.inv.findIndex(s=>s&&s.id===id);if(i<0)return;
    G.inv[i].n--;if(G.inv[i].n<=0)G.inv[i]=null;
    G.eq[sl]=id;G.ws[sl].mag=0;log('Сразу взяли в руки: '+d.n+'.');}
  else if(d.t==='blade'&&!G.eq.blade){
    const i=G.inv.findIndex(s=>s&&s.id===id);if(i<0)return;
    G.inv[i].n--;if(G.inv[i].n<=0)G.inv[i]=null;
    G.eq.blade=id;log('Сразу взяли в руки: '+d.n+'.');}
}

// ---------- крафт (учитывает и рюкзак, и схрон) ----------
function renderCraft(){
  const key=G.ui.cook?'fire':'bench';
  const lv=(G.upg&&G.upg[key])||1, cur=BASE_UPG[key][lv], nxt=BASE_UPG[key][lv+1];
  UI.el.craftT.textContent=cur.n+' · Ур. '+lv+'/3';
  const list=G.ui.cook?COOK:RECIPES;
  UI.el.craftL.innerHTML='';
  if(nxt){
    const ok=nxt.cost.every(q=>countTotalItem(q[0])>=q[1]);
    const u=document.createElement('div');u.className='rec';
    u.style.cssText='background:#11150e;border:1px solid #2b3224;padding:7px 8px;margin-bottom:8px';
    u.innerHTML='<div style="flex:1"><div style="color:#b8c49a;font-size:12px">Ур. '+(lv+1)+': '+nxt.n+'</div>'+
      '<div style="font-size:10px;color:#7d7a6b;margin:2px 0">'+nxt.desc+'</div>'+
      '<div class="ing">'+upgCostHtml(nxt.cost)+'</div></div>';
    const ub=document.createElement('button');ub.textContent='УЛУЧШИТЬ';ub.disabled=!ok;
    ub.onclick=()=>upgradeBase(key);
    u.appendChild(ub);UI.el.craftL.appendChild(u);
  }
  for(const r of list)UI.el.craftL.appendChild(craftRow(r,lv));
}
function craftRow(r,curLv){
  const d=document.createElement('div');d.className='rec';
  const locked=(r.lv||1)>(curLv||1);
  if(locked)d.style.opacity='.48';
  d.appendChild(itemIcon(r.out[0],30));
  const nm=document.createElement('span');
  nm.textContent=ITEMS[r.out[0]].n+(r.out[1]>1?' ×'+r.out[1]:'');
  nm.style.color=RAR[ITEMS[r.out[0]].r];
  const ing=document.createElement('span');ing.className='ing';
  ing.innerHTML=r.in.map(q=>'<span class="'+(countTotalItem(q[0])>=q[1]?'ok':'no')+'">'+
    ITEMS[q[0]].n+' '+countTotalItem(q[0])+'/'+q[1]+'</span>').join(', ');
  const b=document.createElement('button');b.textContent=locked?('УР. '+r.lv):'ДЕЛАТЬ';
  b.disabled=locked||!r.in.every(q=>countTotalItem(q[0])>=q[1]);
  b.onclick=()=>{
    let freed=0;
    for(const q of r.in){
      let need=q[1];
      for(const s of G.inv){if(s&&s.id===q[0]){const t=Math.min(need,s.n);if(t===s.n)freed++;need-=t;if(need<=0)break;}}
    }
    if(!canFitItem(r.out[0],r.out[1],freed)){
      SFX.dry();log('В рюкзаке нет места для: '+ITEMS[r.out[0]].n+'.','a06a5a');return;
    }
    r.in.forEach(q=>removeTotalItem(q[0],q[1]));
    addItem(r.out[0],r.out[1]);
    if(r.out[0]==='flashlight')G.p.flashT=300;
    autoEquip(r.out[0]);
    SFX.craft();renderCraft();renderHUD();
  };
  d.appendChild(nm);d.appendChild(ing);d.appendChild(b);
  return d;
}

// ---------- Торг (меняла) ----------
function openTrade(){
  log(TRADER_LINES[Math.random()*TRADER_LINES.length|0],'b0a888');
  renderTrade();openPanel(UI.el.tradeP);
}
function renderTrade(){
  hideTip();
  UI.el.tradeC.textContent='Торг записал на дощечку: '+G.tradeC;
  UI.el.tradeGive.innerHTML='';
  let any=false;
  for(let i=0;i<G.inv.length;i++){
    const s=G.inv[i];
    if(s&&(ITEMS[s.id].v||s.id==='meat')){any=true;
      UI.el.tradeGive.appendChild(slotEl(s,()=>giveVal(i),null));}
  }
  if(!any){
    const d=document.createElement('div');
    d.style.cssText='color:#6f765c;font-size:11px;grid-column:1/6;padding:8px';
    d.textContent='Дать нечего. Несите кольца, монеты, часы, мясо.';
    UI.el.tradeGive.appendChild(d);
  }
  UI.el.tradeOffers.innerHTML='';
  for(const o of TRADE_OFFERS){
    const row=document.createElement('div');row.className='rec';
    row.appendChild(itemIcon(o.get[0],30));
    const nm=document.createElement('span');
    nm.textContent=ITEMS[o.get[0]].n+(o.get[1]>1?' ×'+o.get[1]:'');
    nm.style.color=RAR[ITEMS[o.get[0]].r];
    const cost=document.createElement('span');cost.className='ing';
    cost.innerHTML='<span class="'+(G.tradeC>=o.cost?'ok':'no')+'">цена: '+o.cost+'</span>';
    const b=document.createElement('button');b.textContent='ВЗЯТЬ';
    b.disabled=G.tradeC<o.cost;
    b.onclick=()=>{
      if(G.tradeC<o.cost)return;
      if(!canFitItem(o.get[0],o.get[1],0)){
        SFX.dry();log('Освободите место в рюкзаке.','a06a5a');return;
      }
      G.tradeC-=o.cost;addItem(o.get[0],o.get[1]);
      if(o.get[0]==='flashlight')G.p.flashT=300;
      autoEquip(o.get[0]);
      SFX.craft();
      log(TRADER_BUY[Math.random()*TRADER_BUY.length|0],'b0a888');
      renderTrade();renderHUD();
    };
    row.appendChild(nm);row.appendChild(cost);row.appendChild(b);
    UI.el.tradeOffers.appendChild(row);
  }
}
function giveVal(i){
  const s=G.inv[i];if(!s)return;
  const d=ITEMS[s.id];const val=d.v||12;
  G.tradeC+=val*s.n;
  log('Отдано: '+d.n+' ×'+s.n+' (+'+(val*s.n)+')','8aa06b');
  G.inv[i]=null;
  if(Math.random()<.5)log(TRADER_LINES[Math.random()*TRADER_LINES.length|0],'b0a888');
  renderTrade();renderHUD();
}

// ---------- HUD ----------
function renderHUD(){
  if(!G||!UI.el)return;const p=G.p;
  $('hpFill').style.width=Math.max(0,p.hp)+'%';
  $('hungerFill').style.width=Math.max(0,p.hunger)+'%';
  $('thirstFill').style.width=Math.max(0,p.thirst)+'%';
  $('stamFill').style.width=Math.max(0,p.stam)+'%';
  if(UI.el.bleedBadge)UI.el.bleedBadge.classList.toggle('hidden',p.bleed<=0);
  if(UI.el.vigourBadge){const vt=Math.ceil(p.vigourT||0);UI.el.vigourBadge.classList.toggle('hidden',vt<=0);if(vt>0)UI.el.vigourBadge.textContent='БОДРЫЙ '+vt+'с';}
  if(UI.el.flashBadge){
    const hasF=countItem('flashlight')>0;
    UI.el.flashBadge.classList.toggle('hidden',!hasF);
    if(hasF){
      const pct=Math.max(0,Math.ceil(p.flashT/3));
      UI.el.flashBadge.textContent='ФОНАРЬ '+pct+'%'+(p.flashOn?' · ВКЛ':'');
      UI.el.flashBadge.style.color=pct<20?'#c9584a':(p.flashOn?'#d8c07a':'#8f8d7e');
    }
  }
  const hh=Math.floor(G.hours),mm=Math.floor((G.hours%1)*60);
  UI.el.clock.textContent=(hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm;
  UI.el.dayLbl.textContent='День '+G.day+(dayL(G.hours)<.3?' · НОЧЬ':'');
  renderHotbar();
}
function renderHotbar(){
  if(!G||!UI.el||!UI.el.hot)return;
  UI.el.hot.innerHTML='';
  for(const pair of [['blade','1'],['gunA','2'],['gunB','3']]){
    const k=pair[0];
    const d=document.createElement('div');d.className='hs'+(G.p.cur===k?' sel':'');
    const w=G.eq[k];
    if(w){d.appendChild(itemIcon(w,40));d.style.borderColor=RAR[ITEMS[w].r];
      d.onclick=()=>selectW(k);}
    else{d.style.borderColor='';d.onclick=()=>{openInv();log('Ячейка '+pair[1]+' пуста: оружие нужно взять в рюкзаке.','a06a5a');};}
    const kl=document.createElement('span');kl.className='k';kl.textContent=pair[1];d.appendChild(kl);
    if(w&&ITEMS[w].t==='gun'){const a=document.createElement('span');a.className='amt';
      a.textContent=G.ws[k].mag+'/'+countItem(ITEMS[w].w.ammo);d.appendChild(a);}
    UI.el.hot.appendChild(d);
  }
  if(typeof renderTouchWeapons==='function')renderTouchWeapons();
}
function selectW(k){if(G&&G.eq[k]){G.p.cur=k;G.p.reload=null;renderHotbar();}}

function log(m,col){
  if(!UI.el)return;
  const d=document.createElement('div');d.textContent=m;d.style.color=col||'#9a9684';
  UI.el.log.appendChild(d);
  while(UI.el.log.children.length>7)UI.el.log.removeChild(UI.el.log.firstChild);
  setTimeout(()=>{if(d.parentNode)d.remove();},16000);
}
