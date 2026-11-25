'use strict';
/* ============ процедурный звук в духе Darkwood (WebAudio, без ассетов) ============ */
const SFX={ctx:null,master:null,wet:null,on:true};
let _nb=null;

function makeForestIR(c){
  const len=Math.floor(c.sampleRate*1.35);
  const buf=c.createBuffer(2,len,c.sampleRate);
  for(let ch=0;ch<2;ch++){
    const d=buf.getChannelData(ch);
    let lp=0;
    for(let i=0;i<len;i++){
      const t=i/len;
      const env=Math.pow(1-t,2.6)*(i<240?i/240:1);
      const wn=(Math.random()*2-1)*env;
      lp=lp*0.72+wn*0.28; // глухое лесное затухание высоких частот
      d[i]=lp;
    }
  }
  return buf;
}

function sfxInit(){
  if(SFX.ctx)return;
  const C=window.AudioContext||window.webkitAudioContext;
  if(!C)return;
  SFX.ctx=new C();
  SFX.master=SFX.ctx.createGain(); SFX.master.gain.value=.85;
  SFX.comp=SFX.ctx.createDynamicsCompressor();
  SFX.comp.threshold.value=-18; SFX.comp.ratio.value=5; SFX.comp.attack.value=.003; SFX.comp.release.value=.25;
  SFX.master.connect(SFX.comp);
  // лесная реверберация (глухое эхо среди стволов)
  try{
    const conv=SFX.ctx.createConvolver();
    conv.buffer=makeForestIR(SFX.ctx);
    const rf=SFX.ctx.createBiquadFilter();rf.type='lowpass';rf.frequency.value=1050;
    SFX.wet=SFX.ctx.createGain();SFX.wet.gain.value=.28;
    SFX.master.connect(SFX.wet);SFX.wet.connect(conv);conv.connect(rf);rf.connect(SFX.comp);
  }catch(e){}
  SFX.comp.connect(SFX.ctx.destination);
  const c=SFX.ctx, b=c.createBuffer(1,c.sampleRate,c.sampleRate), d=b.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  _nb=b;
  ambStart();
  musicInit();
}
function makeCurve(k){const n=256,c=new Float32Array(n);
  for(let i=0;i<n;i++){const x=i/(n-1)*2-1;c[i]=(1+k)*x/(1+k*Math.abs(x));}return c;}
function dist(node,k){const ws=SFX.ctx.createWaveShaper();
  ws.curve=makeCurve(k);ws.oversample='2x';node.connect(ws);return ws;}
function noiseSrc(){const s=SFX.ctx.createBufferSource();s.buffer=_nb;s.loop=true;return s;}
function env(g,t0,a,dec,peak){g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(peak,t0+a);g.gain.exponentialRampToValueAtTime(.0001,t0+a+dec);}

SFX.shot=function(kind){
  if(!SFX.ctx)return; const c=SFX.ctx,t=c.currentTime;
  const isShot=(kind==='shotgun'), isRifle=(kind==='rifle'||kind==='lever'), isRev=(kind==='revolver'), isSmg=(kind==='smg');
  // 1) Сверхзвуковой щелчок / треск пороховых газов
  const cr=noiseSrc(), cf=c.createBiquadFilter(), cg=c.createGain();
  cf.type='highpass'; cf.frequency.value=isShot?900:(isRifle?1800:1400);
  const cws=dist(cf,isRifle?14:9); cws.connect(cg); cg.connect(SFX.master);
  cr.connect(cf);
  env(cg,t,.001,isShot?.11:.055,isShot?.52:(isRifle?.48:.38));
  cr.start(t); cr.stop(t+.14);

  // 2) Основной пороховой хлопок с проседанием частоты
  const n=noiseSrc(), f=c.createBiquadFilter(), g=c.createGain();
  f.type='lowpass';
  const fHi=isShot?1650:(isRifle?3400:(isRev?2400:(isSmg?2600:2200)));
  const fLo=isShot?180:(isRifle?260:240);
  const dec=isShot?.44:(isRifle?.32:(isRev?.28:.19));
  f.frequency.setValueAtTime(fHi,t);
  f.frequency.exponentialRampToValueAtTime(fLo,t+dec);
  const ws=dist(f,isShot?12:8); ws.connect(g); g.connect(SFX.master);
  n.connect(f); n.playbackRate.value=isShot?.72:(isRifle?1.15:1);
  env(g,t,.002,dec,isShot?.68:(isRifle?.58:.46));
  n.start(t); n.stop(t+dec+.08);

  // 3) Грудной саб-удар отдачи
  const o=c.createOscillator(), og=c.createGain(); o.type='triangle';
  o.frequency.setValueAtTime(isShot?125:(isRifle?185:160),t);
  o.frequency.exponentialRampToValueAtTime(34,t+(isShot?.16:.11));
  env(og,t,.002,isShot?.18:.12,isShot?.62:(isRifle?.54:.42));
  o.connect(og); og.connect(SFX.master); o.start(t); o.stop(t+.24);

  // 4) Лязг затвора и звон гильзы о землю
  if(!isRev){
    const m=c.createOscillator(), mg=c.createGain(); m.type='square';
    m.frequency.setValueAtTime(isShot?1100:2200,t+.025);
    m.frequency.exponentialRampToValueAtTime(600,t+.055);
    env(mg,t+.025,.001,.03,.07); m.connect(mg); mg.connect(SFX.master); m.start(t+.025); m.stop(t+.07);
    // падение гильзы (для пистолета/ПП/винтовки)
    if(!isShot){
      for(let k=0;k<2;k++){
        const tt=t+.24+k*.07, co=c.createOscillator(), cg2=c.createGain();
        co.type='sine'; co.frequency.value=(3600+Math.random()*900)*(k?1.08:1);
        env(cg2,tt,.001,.045,.035/(k+1)); co.connect(cg2); cg2.connect(SFX.master); co.start(tt); co.stop(tt+.06);
      }
    }
  }
};

SFX.swing=function(claws){
  if(!SFX.ctx)return; const c=SFX.ctx,t=c.currentTime;
  const n=noiseSrc(), f=c.createBiquadFilter(), g=c.createGain();
  f.type='bandpass'; f.Q.value=claws?1.6:2.4;
  f.frequency.setValueAtTime(claws?340:520,t);
  f.frequency.exponentialRampToValueAtTime(claws?1550:2100,t+.06);
  f.frequency.exponentialRampToValueAtTime(280,t+.16);
  n.connect(f); f.connect(g); g.connect(SFX.master);
  env(g,t,.01,.15,claws?.16:.18); n.start(t); n.stop(t+.2);
};

SFX.reloadStart=function(kind){
  if(!SFX.ctx)return; const c=SFX.ctx,t=c.currentTime;
  // щелчок защёлки и извлечение магазина / перелом ствола
  const o=c.createOscillator(), g=c.createGain(); o.type='square';
  o.frequency.setValueAtTime(1600,t); o.frequency.exponentialRampToValueAtTime(420,t+.04);
  env(g,t,.001,.04,.12); o.connect(g); g.connect(SFX.master); o.start(t); o.stop(t+.06);
  const n=noiseSrc(), f=c.createBiquadFilter(), ng=c.createGain();
  f.type='bandpass'; f.frequency.setValueAtTime(kind==='shotgun'?650:1200,t+.06);
  f.frequency.linearRampToValueAtTime(500,t+.24); f.Q.value=2;
  n.connect(f); f.connect(ng); ng.connect(SFX.master);
  env(ng,t+.06,.01,.18,.11); n.start(t+.06); n.stop(t+.28);
};

SFX.reloadDone=function(kind){
  if(!SFX.ctx)return; const c=SFX.ctx,t=c.currentTime;
  // удар магазина + передёргивание затвора (клац-клац)
  const o=c.createOscillator(), g=c.createGain(); o.type='triangle';
  o.frequency.setValueAtTime(320,t); o.frequency.exponentialRampToValueAtTime(95,t+.06);
  env(g,t,.002,.06,.22); o.connect(g); g.connect(SFX.master); o.start(t); o.stop(t+.08);
  const pts=kind==='shotgun'?[0.12]:[0.14,0.25];
  pts.forEach((off,idx)=>{
    const tt=t+off, n=noiseSrc(), f=c.createBiquadFilter(), ng=c.createGain();
    f.type='bandpass'; f.frequency.value=idx?2100:1550; f.Q.value=2.5;
    n.connect(f); f.connect(ng); ng.connect(SFX.master);
    env(ng,tt,.002,.055,.16); n.start(tt); n.stop(tt+.07);
    const mo=c.createOscillator(), mg=c.createGain(); mo.type='square';
    mo.frequency.setValueAtTime(idx?1900:1300,tt); mo.frequency.exponentialRampToValueAtTime(480,tt+.04);
    env(mg,tt,.001,.04,.09); mo.connect(mg); mg.connect(SFX.master); mo.start(tt); mo.stop(tt+.06);
  });
};
SFX.dry=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();
  o.type='square';o.frequency.setValueAtTime(900,t);o.frequency.exponentialRampToValueAtTime(300,t+.05);
  env(g,t,.002,.05,.11);o.connect(g);g.connect(SFX.master);o.start(t);o.stop(t+.08);};
SFX.click=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();
  o.type='triangle';o.frequency.setValueAtTime(1400,t);o.frequency.exponentialRampToValueAtTime(480,t+.03);
  env(g,t,.001,.035,.14);o.connect(g);g.connect(SFX.master);o.start(t);o.stop(t+.05);};
SFX.uiOpen=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime,n=noiseSrc(),f=c.createBiquadFilter(),g=c.createGain();
  f.type='bandpass';f.frequency.setValueAtTime(900,t);f.frequency.linearRampToValueAtTime(1600,t+.08);f.Q.value=1.5;
  n.connect(f);f.connect(g);g.connect(SFX.master);env(g,t,.005,.09,.07);n.start(t);n.stop(t+.12);};
SFX.uiClose=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();
  o.type='sine';o.frequency.setValueAtTime(110,t);o.frequency.exponentialRampToValueAtTime(55,t+.08);
  env(g,t,.003,.08,.1);o.connect(g);g.connect(SFX.master);o.start(t);o.stop(t+.1);};
SFX.pick=function(r){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;
  const f=[480,580,700,840,980][r||0];
  for(let i=0;i<(r>=2?2:1);i++){const o=c.createOscillator(),g=c.createGain();
    o.type='triangle';o.frequency.value=f*(i?1.22:1);env(g,t+i*.07,.005,.13,.13);
    o.connect(g);g.connect(SFX.master);o.start(t+i*.07);o.stop(t+i*.07+.2);}};
SFX.hitFlesh=function(){
  if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;
  // глухой удар по плоти + влажный хруст разреза
  const o=c.createOscillator(), og=c.createGain(); o.type='sine';
  o.frequency.setValueAtTime(145,t); o.frequency.exponentialRampToValueAtTime(42,t+.09);
  env(og,t,.002,.09,.42); o.connect(og); og.connect(SFX.master); o.start(t); o.stop(t+.12);
  const n=noiseSrc(), f=c.createBiquadFilter(), g=c.createGain();
  f.type='bandpass'; f.frequency.setValueAtTime(1300,t); f.frequency.exponentialRampToValueAtTime(320,t+.13); f.Q.value=1.2;
  n.connect(f); f.connect(g); g.connect(SFX.master);
  env(g,t,.002,.13,.38); n.start(t); n.stop(t+.16);
};
SFX.hurt=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;
  const o=c.createOscillator(),g=c.createGain(),fl=c.createBiquadFilter();
  o.type='sawtooth';o.frequency.setValueAtTime(240,t);o.frequency.exponentialRampToValueAtTime(85,t+.32);
  fl.type='lowpass';fl.frequency.value=580;fl.Q.value=3;
  const ws=dist(fl,4);ws.connect(g);g.connect(SFX.master);
  env(g,t,.01,.32,.22);o.connect(fl);o.start(t);o.stop(t+.42);
  const n=noiseSrc(),nf=c.createBiquadFilter(),ng=c.createGain();
  nf.type='bandpass';nf.frequency.value=380;
  n.connect(nf);nf.connect(ng);ng.connect(SFX.master);env(ng,t,.02,.2,.08);n.start(t);n.stop(t+.25);};
SFX.step=function(mat,run,crouch){
  if(!SFX.ctx)return; const c=SFX.ctx,t=c.currentTime,v=Math.random();
  const mul=crouch?.45:(run?1.65:1);
  // низкий толчок пятки (особенно слышен при беге и на досках)
  const o=c.createOscillator(), og=c.createGain(); o.type='sine';
  o.frequency.setValueAtTime(mat===TILE.WFLOOR?115:78,t);
  o.frequency.exponentialRampToValueAtTime(34,t+.055);
  env(og,t,.002,.055,.065*mul); o.connect(og); og.connect(SFX.master); o.start(t); o.stop(t+.07);

  // шорох/хруст поверхности (листва, трава, гравий, доски)
  const n=noiseSrc(), f=c.createBiquadFilter(), g=c.createGain();
  f.type=mat===TILE.WFLOOR?'bandpass':'lowpass';
  f.frequency.value=mat===TILE.WFLOOR?(720+v*360):(mat===TILE.ROAD||mat===TILE.DIRT?(950+v*450):(mat===TILE.TALL?520+v*260:640+v*320));
  f.Q.value=1.1; n.connect(f); f.connect(g); g.connect(SFX.master);
  env(g,t,.003,run?.085:.065,(.065+v*.035)*mul); n.playbackRate.value=.85+v*.45;
  n.start(t); n.stop(t+.12);

  // хруст сухой ветки / листвы под ногами
  if(mat<=TILE.TALL&&(run||Math.random()<.42)){
    const n2=noiseSrc(), f2=c.createBiquadFilter(), g2=c.createGain();
    f2.type='bandpass'; f2.frequency.value=1850+Math.random()*1300; f2.Q.value=2.2;
    n2.connect(f2); f2.connect(g2); g2.connect(SFX.master);
    env(g2,t+.012,.001,.035,(.045+v*.03)*mul); n2.start(t+.012); n2.stop(t+.065);
  }
};
SFX.eat=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;for(let i=0;i<3;i++){
  const o=c.createOscillator(),g=c.createGain();o.type='square';o.frequency.value=160+i*40;
  env(g,t+i*.11,.01,.07,.08);o.connect(g);g.connect(SFX.master);o.start(t+i*.11);o.stop(t+i*.11+.12);}};
SFX.drink=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;for(let i=0;i<3;i++){
  const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(300+i*80,t+i*.14);
  o.frequency.exponentialRampToValueAtTime(160+i*40,t+i*.14+.1);env(g,t+i*.14,.005,.1,.12);
  o.connect(g);g.connect(SFX.master);o.start(t+i*.14);o.stop(t+i*.14+.2);}};
SFX.search=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime,n=noiseSrc(),f=c.createBiquadFilter(),g=c.createGain();
  f.type='bandpass';f.frequency.setValueAtTime(300,t);f.frequency.linearRampToValueAtTime(700,t+.3);
  n.connect(f);f.connect(g);g.connect(SFX.master);env(g,t,.02,.35,.1);n.start(t);n.stop(t+.4);};
SFX.craft=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;
  [330,495].forEach((fr,i)=>{const o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.value=fr;
    env(g,t+i*.09,.003,.16,.15);o.connect(g);g.connect(SFX.master);o.start(t+i*.09);o.stop(t+i*.09+.25);});};
SFX.alert=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;[700,950].forEach((fr,i)=>{
  const o=c.createOscillator(),g=c.createGain();o.type='square';o.frequency.value=fr;
  env(g,t+i*.09,.004,.09,.1);o.connect(g);g.connect(SFX.master);o.start(t+i*.09);o.stop(t+i*.09+.12);});};
SFX.saw=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();
  o.type='sawtooth';o.frequency.setValueAtTime(68,t);o.frequency.linearRampToValueAtTime(52,t+.8);
  env(g,t,.2,.8,.22);o.connect(g);g.connect(SFX.master);o.start(t);o.stop(t+1.1);};
SFX.growl=function(kind,vol){
  if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime,v=vol||1;
  // Хелпер для пронзительного крика с вибрато и эхом
  const scream=(fStart,fPeak,fEnd,dur,peak,qVal,vibF,vibA)=>{
    const o=c.createOscillator(),o2=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();
    o.type='sawtooth';o2.type='triangle';
    o.frequency.setValueAtTime(fStart,t);
    o.frequency.linearRampToValueAtTime(fPeak,t+dur*.22);
    o.frequency.exponentialRampToValueAtTime(fEnd,t+dur);
    o2.frequency.setValueAtTime(fStart*1.018,t);
    o2.frequency.linearRampToValueAtTime(fPeak*1.018,t+dur*.22);
    o2.frequency.exponentialRampToValueAtTime(fEnd*1.015,t+dur);
    if(vibF){
      const vb=c.createOscillator(),vg=c.createGain();vb.frequency.value=vibF;vg.gain.value=vibA;
      vb.connect(vg);vg.connect(o.frequency);vb.start(t);vb.stop(t+dur+.05);
    }
    f.type='bandpass';f.frequency.setValueAtTime(Math.max(fStart,fPeak)*1.1,t);
    f.frequency.exponentialRampToValueAtTime(Math.max(420,fEnd*1.2),t+dur);
    f.Q.value=qVal||1.1;
    o.connect(f);o2.connect(f);f.connect(g);
    g.connect(SFX.master);if(SFX.wet)g.connect(SFX.wet);
    env(g,t,.015,dur,peak*v);
    o.start(t);o2.start(t);o.stop(t+dur+.06);o2.stop(t+dur+.06);
  };
  if(kind==='hound'){
    scream(620,1380,440,.48,.62,1.2,28,55);
    return;
  }
  if(kind==='scav'){
    scream(880,1720,690,.78,.58,1.3,22,70);
    return;
  }
  if(kind==='leshy'){
    scream(480,980,390,1.05,.60,1.2,16,38);
    return;
  }
  if(kind==='plague'){
    scream(1240,2250,860,.45,.55,1.3,38,90);
    return;
  }
  // Штраф: мощный пронзительный звериный вопль
  scream(440,920,310,.88,.66,1.1,24,48);
};

SFX.monsterAmbient=function(kind,prox,fighting){
  if(!SFX.ctx)return;
  const v=Math.max(.42,prox);
  if(fighting||Math.random()<.65){SFX.growl(kind,v*(fighting?.95:.65));return;}
  // жуткий приглушённый вскрик в лесу
  const c=SFX.ctx,t=c.currentTime,o=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();
  o.type='sawtooth';o.frequency.setValueAtTime(720,t);o.frequency.linearRampToValueAtTime(1180,t+.22);o.frequency.exponentialRampToValueAtTime(520,t+.65);
  f.type='bandpass';f.frequency.value=1250;f.Q.value=1.8;
  o.connect(f);f.connect(g);g.connect(SFX.master);if(SFX.wet)g.connect(SFX.wet);
  env(g,t,.03,.6,.32*v);o.start(t);o.stop(t+.68);
};


SFX.ghostScream=function(){
  if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;
  const o=c.createOscillator(),o2=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();
  o.type='sawtooth';o2.type='sine';
  o.frequency.setValueAtTime(1120,t);o.frequency.exponentialRampToValueAtTime(1880,t+.15);o.frequency.exponentialRampToValueAtTime(540,t+.7);
  o2.frequency.setValueAtTime(1145,t);o2.frequency.exponentialRampToValueAtTime(1910,t+.15);o2.frequency.exponentialRampToValueAtTime(550,t+.7);
  f.type='bandpass';f.frequency.value=1650;f.Q.value=1.5;
  o.connect(f);o2.connect(f);f.connect(g);g.connect(SFX.master);if(SFX.wet)g.connect(SFX.wet);
  env(g,t,.015,.68,.55);o.start(t);o2.start(t);o.stop(t+.74);o2.stop(t+.74);
};

SFX.death=function(kind){
  if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;
  const f0=kind==='scav'?1450:(kind==='plague'?1800:(kind==='hound'?1100:820));
  const o=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();
  o.type='sawtooth';o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(220,t+.65);
  f.type='bandpass';f.frequency.value=f0*.9;f.Q.value=1.2;
  o.connect(f);f.connect(g);g.connect(SFX.master);if(SFX.wet)g.connect(SFX.wet);
  env(g,t,.01,.62,.52);o.start(t);o.stop(t+.68);
};
SFX.breath=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;
  const n=noiseSrc(),f=c.createBiquadFilter(),g=c.createGain();
  f.type='bandpass';f.frequency.setValueAtTime(500,t);f.frequency.linearRampToValueAtTime(900,t+.2);f.frequency.linearRampToValueAtTime(400,t+.5);
  f.Q.value=1.2;n.connect(f);f.connect(g);g.connect(SFX.master);
  env(g,t,.12,.35,.05);n.playbackRate.value=.7;n.start(t);n.stop(t+.55);};
SFX.rustle=function(){if(!SFX.ctx)return;const c=SFX.ctx;
  for(let i=0;i<5;i++){const t=c.currentTime+Math.random()*.22;
    const n=noiseSrc(),f=c.createBiquadFilter(),g=c.createGain();
    f.type='highpass';f.frequency.value=2600+Math.random()*1800;
    n.connect(f);f.connect(g);g.connect(SFX.master);
    env(g,t,.001,.02,.028);n.start(t);n.stop(t+.04);}};
SFX.creak=function(){
  if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;
  const o=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();
  o.type='sawtooth';
  o.frequency.setValueAtTime(82,t);
  o.frequency.linearRampToValueAtTime(104,t+.5);
  o.frequency.linearRampToValueAtTime(74,t+1);
  f.type='bandpass';f.frequency.value=320;f.Q.value=7;
  const lfo=c.createOscillator(),lg=c.createGain();lfo.frequency.value=17;lg.gain.value=.02;
  lfo.connect(lg);o.connect(f);f.connect(g);g.connect(SFX.master);
  env(g,t,.15,.8,.055);lg.connect(g.gain);
  lfo.start(t);lfo.stop(t+1.1);o.start(t);o.stop(t+1.1);
  const n=noiseSrc(),nf=c.createBiquadFilter(),ng=c.createGain();
  nf.type='bandpass';nf.frequency.value=1400;
  n.connect(nf);nf.connect(ng);ng.connect(SFX.master);
  env(ng,t+.85,.002,.06,.12);n.start(t+.85);n.stop(t+.95);};
SFX.distantThump=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;
  const o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();
  f.type='lowpass';f.frequency.value=180;
  o.type='sine';o.frequency.setValueAtTime(58,t);o.frequency.exponentialRampToValueAtTime(34,t+.32);
  o.connect(f);f.connect(g);g.connect(SFX.master);
  env(g,t,.008,.35,.15);o.start(t);o.stop(t+.45);};

SFX.weirdForest=function(){
  if(!SFX.ctx)return;
  const c=SFX.ctx, t=c.currentTime, r=Math.random();
  const pan=c.createStereoPanner?c.createStereoPanner():null;
  const dest=pan||SFX.master;
  if(pan){pan.pan.value=Math.random()*1.8-.9;pan.connect(SFX.master);}

  if(r<.28){
    // глухой пугающий стук по дереву вдали (2-4 удара)
    const cnt=2+(Math.random()*3|0);
    for(let i=0;i<cnt;i++){
      const tt=t+i*(.18+Math.random()*.16);
      const o=c.createOscillator(), g=c.createGain();
      o.type='triangle'; o.frequency.setValueAtTime(160+Math.random()*60,tt);
      o.frequency.exponentialRampToValueAtTime(58,tt+.09);
      env(g,tt,.003,.1,.14); o.connect(g); g.connect(dest); o.start(tt); o.stop(tt+.12);
    }
  } else if(r<.54){
    // чьи-то невидимые шаги в листве рядом
    const cnt=3+(Math.random()*3|0);
    for(let i=0;i<cnt;i++){
      const tt=t+i*(.26+Math.random()*.08);
      const n=noiseSrc(), f=c.createBiquadFilter(), g=c.createGain();
      f.type='bandpass'; f.frequency.value=1100+Math.random()*700; f.Q.value=1.8;
      n.connect(f); f.connect(g); g.connect(dest);
      env(g,tt,.004,.07,.065); n.start(tt); n.stop(tt+.09);
    }
  } else if(r<.78){
    // тревожный металлический/стеклянный гул среди стволов
    const o=c.createOscillator(), f=c.createBiquadFilter(), g=c.createGain();
    const fr=310+Math.random()*280;
    o.type='sawtooth'; o.frequency.setValueAtTime(fr,t); o.frequency.linearRampToValueAtTime(fr*.88,t+1.8);
    f.type='bandpass'; f.frequency.value=fr*2; f.Q.value=9;
    o.connect(f); f.connect(g); g.connect(dest);
    env(g,t,.55,1.2,.055); o.start(t); o.stop(t+1.85);
  } else {
    // странное щёлканье в кронах над головой
    for(let i=0;i<5;i++){
      const tt=t+i*.065+Math.random()*.03;
      const o=c.createOscillator(), g=c.createGain();
      o.type='square'; o.frequency.setValueAtTime(2200+Math.random()*1200,tt);
      o.frequency.exponentialRampToValueAtTime(750,tt+.025);
      env(g,tt,.001,.025,.045); o.connect(g); g.connect(dest); o.start(tt); o.stop(tt+.04);
    }
  }
};

SFX.owl=function(){if(!SFX.ctx)return;const c=SFX.ctx;
  const pan=c.createStereoPanner?c.createStereoPanner():null;
  const pVal=Math.random()*1.6-.8;
  [0,.48,1.08].forEach((off,k)=>{const t=c.currentTime+off;
    const o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();
    o.type='triangle';
    const base=k===2?520:(740-k*110);
    o.frequency.setValueAtTime(base,t);
    o.frequency.linearRampToValueAtTime(base*.84,t+(k===2?.55:.36));
    f.type='lowpass';f.frequency.value=1500;
    const vib=c.createOscillator(),vg=c.createGain();vib.frequency.value=5.5;vg.gain.value=14;
    vib.connect(vg);vg.connect(o.frequency);vib.start(t);vib.stop(t+.6);
    o.connect(f);f.connect(g);
    if(pan){g.connect(pan);pan.pan.value=pVal;pan.connect(SFX.master);}else g.connect(SFX.master);
    env(g,t,.07,k===2?.48:.3,.075);o.start(t);o.stop(t+.6);});};

SFX.wolfHowl=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;
  const pan=c.createStereoPanner?c.createStereoPanner():null;
  const o=c.createOscillator(),o2=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();
  o.type='sawtooth';o2.type='triangle';
  const f0=210+Math.random()*45;
  o.frequency.setValueAtTime(f0,t);
  o.frequency.linearRampToValueAtTime(f0*1.48,t+.65);
  o.frequency.linearRampToValueAtTime(f0*1.36,t+1.6);
  o.frequency.exponentialRampToValueAtTime(f0*.75,t+2.7);
  o2.frequency.setValueAtTime(f0*1.006,t);
  o2.frequency.linearRampToValueAtTime(f0*1.49,t+.65);
  o2.frequency.exponentialRampToValueAtTime(f0*.75,t+2.7);
  f.type='bandpass';f.frequency.value=580;f.Q.value=2.4;
  o.connect(f);o2.connect(f);f.connect(g);
  if(pan){g.connect(pan);pan.pan.value=Math.random()*1.6-.8;pan.connect(SFX.master);}else g.connect(SFX.master);
  env(g,t,.45,2.2,.09);
  o.start(t);o2.start(t);o.stop(t+2.8);o2.stop(t+2.8);};

SFX.branchSnap=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;
  const pan=c.createStereoPanner?c.createStereoPanner():null;
  const n=noiseSrc(),f=c.createBiquadFilter(),g=c.createGain();
  f.type='bandpass';f.frequency.value=1900+Math.random()*900;f.Q.value=2.5;
  n.connect(f);f.connect(g);
  if(pan){g.connect(pan);pan.pan.value=Math.random()*1.8-.9;pan.connect(SFX.master);}else g.connect(SFX.master);
  env(g,t,.001,.045,.08);n.start(t);n.stop(t+.06);};

SFX.thunder=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;
  const n=noiseSrc(),f=c.createBiquadFilter(),g=c.createGain();
  f.type='lowpass';f.frequency.setValueAtTime(520,t);f.frequency.exponentialRampToValueAtTime(68,t+2.6);
  n.connect(f);f.connect(g);g.connect(SFX.master);
  env(g,t,.03,2.5,.38);n.playbackRate.value=.55;n.start(t);n.stop(t+2.7);};

SFX.rainUpdate=function(rain){
  if(!SFX.ctx||!SFX._rainG)return;
  const target=rain>.04?(rain*.13):0;
  SFX._rainG.gain.setTargetAtTime(target,SFX.ctx.currentTime,.6);
};
SFX.heartOn=function(fast){
  SFX._hbMs=fast?680:980;
  if(SFX._hb||!SFX.ctx)return;SFX._hb=1;
  (function beat(){if(!SFX._hb)return;const c=SFX.ctx,t=c.currentTime;
    for(const pair of [[0,.22],[.2,.14]]){const off=pair[0],gv=pair[1];
      const o=c.createOscillator(),g=c.createGain();o.type='sine';
      o.frequency.setValueAtTime(58,t+off);o.frequency.exponentialRampToValueAtTime(36,t+off+.16);
      env(g,t+off,.004,.17,gv);o.connect(g);g.connect(SFX.master);o.start(t+off);o.stop(t+off+.35);}
    SFX._hbT=setTimeout(beat,SFX._hbMs||980);})();};
SFX.heartOff=function(){SFX._hb=0;clearTimeout(SFX._hbT);};
SFX.nightAmbOn=function(){
  if(SFX._na||!SFX.ctx)return;SFX._na=1;
  if(SFX._windG)SFX._windG.gain.setTargetAtTime(.065,SFX.ctx.currentTime,3);
  if(SFX._droneG)SFX._droneG.gain.setTargetAtTime(.06,SFX.ctx.currentTime,3);
  (function sting(){if(!SFX._na)return;
    const r=Math.random();
    if(r<.24)SFX.creak();
    else if(r<.42)SFX.owl();
    else if(r<.58)SFX.wolfHowl();
    else if(r<.74)SFX.distantThump();
    else if(r<.86)SFX.branchSnap();
    else if(r<.92)SFX.weirdForest();
    else SFX.whisper();
    SFX._naT=setTimeout(sting,3500+Math.random()*7500);})();};
SFX.nightAmbOff=function(){
  SFX._na=0;clearTimeout(SFX._naT);
  if(SFX._windG)SFX._windG.gain.setTargetAtTime(.028,SFX.ctx.currentTime,4);
  if(SFX._droneG)SFX._droneG.gain.setTargetAtTime(.035,SFX.ctx.currentTime,4);};
SFX.bite=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;
  const n=noiseSrc(),f=c.createBiquadFilter(),g=c.createGain();
  f.type='lowpass';f.frequency.setValueAtTime(700,t);f.frequency.exponentialRampToValueAtTime(220,t+.12);
  n.connect(f);f.connect(g);g.connect(SFX.master);env(g,t,.002,.12,.35);n.start(t);n.stop(t+.18);
  const n2=noiseSrc(),f2=c.createBiquadFilter(),g2=c.createGain();
  f2.type='highpass';f2.frequency.value=2400;
  n2.connect(f2);f2.connect(g2);g2.connect(SFX.master);env(g2,t+.03,.001,.03,.18);n2.start(t+.03);n2.stop(t+.08);
  const o=c.createOscillator(),og=c.createGain();o.type='sine';
  o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(70,t+.14);
  env(og,t,.002,.12,.28);o.connect(og);og.connect(SFX.master);o.start(t);o.stop(t+.2);};
SFX.knock=function(){if(!SFX.ctx)return;const c=SFX.ctx;
  for(let i=0;i<3;i++){const t=c.currentTime+i*.22;
    const o=c.createOscillator(),g=c.createGain();o.type='sine';
    o.frequency.setValueAtTime(120,t);o.frequency.exponentialRampToValueAtTime(60,t+.12);
    env(g,t,.004,.16,.3);o.connect(g);g.connect(SFX.master);o.start(t);o.stop(t+.25);} };
SFX.thud=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;
  const o=c.createOscillator(),g=c.createGain();o.type='sine';
  o.frequency.setValueAtTime(90,t);o.frequency.exponentialRampToValueAtTime(38,t+.3);
  env(g,t,.006,.35,.5);o.connect(g);g.connect(SFX.master);o.start(t);o.stop(t+.5);};
SFX.scratch=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;
  const n=noiseSrc(),f=c.createBiquadFilter(),g=c.createGain();
  f.type='bandpass';f.frequency.setValueAtTime(2400,t);f.Q.value=4;
  f.frequency.linearRampToValueAtTime(1200,t+.4);
  n.connect(f);f.connect(g);g.connect(SFX.master);env(g,t,.02,.4,.12);
  n.playbackRate.value=.6;n.start(t);n.stop(t+.5);};
SFX.whisper=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;
  const n=noiseSrc(),f=c.createBiquadFilter(),g=c.createGain();
  f.type='bandpass';f.frequency.value=1800;f.Q.value=8;
  const lfo=c.createOscillator(),lg=c.createGain();lfo.frequency.value=7;lg.gain.value=900;
  lfo.connect(lg);lg.connect(f.frequency);lfo.start(t);lfo.stop(t+1.2);
  n.connect(f);f.connect(g);g.connect(SFX.master);env(g,t,.15,.8,.06);
  n.start(t);n.stop(t+1.1);};
SFX.trap=function(){if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;
  const o=c.createOscillator(),g=c.createGain();o.type='square';
  o.frequency.setValueAtTime(2200,t);o.frequency.exponentialRampToValueAtTime(400,t+.08);
  env(g,t,.002,.08,.12);o.connect(g);g.connect(SFX.master);o.start(t);o.stop(t+.12);
  const n=noiseSrc(),f=c.createBiquadFilter(),ng=c.createGain();
  f.type='lowpass';f.frequency.value=900;n.connect(f);f.connect(ng);ng.connect(SFX.master);
  env(ng,t,.004,.2,.4);n.start(t);n.stop(t+.3);};
SFX.rattle=function(){if(!SFX.ctx)return;const c=SFX.ctx;
  for(let i=0;i<5;i++){const t=c.currentTime+i*.06+Math.random()*.02;
    const o=c.createOscillator(),g=c.createGain();o.type='triangle';
    o.frequency.value=1900+Math.random()*1400;
    env(g,t,.001,.06,.08);o.connect(g);g.connect(SFX.master);o.start(t);o.stop(t+.1);} };
SFX.flip=function(){
  if(!SFX.ctx)return;const c=SFX.ctx,t=c.currentTime;
  const n=noiseSrc(),f=c.createBiquadFilter(),g=c.createGain();
  f.type='bandpass';f.frequency.setValueAtTime(1800,t);
  f.frequency.exponentialRampToValueAtTime(700,t+.08);
  n.connect(f);f.connect(g);g.connect(SFX.master);env(g,t,.003,.08,.07);n.start(t);n.stop(t+.12);
  const o=c.createOscillator(),og=c.createGain();o.type='triangle';
  o.frequency.value=420+Math.random()*200;
  env(og,t,.002,.06,.045);o.connect(og);og.connect(SFX.master);o.start(t);o.stop(t+.1);};

function ambStart(){ // мрачный эмбиент Darkwood: саб-гул + глухой ветер + вороны
  if(SFX._amb)return; SFX._amb=1;
  const c=SFX.ctx;
  const dg=c.createGain();dg.gain.value=.035;dg.connect(SFX.master);
  SFX._droneG=dg;
  // тревожный диссонирующий гул (пониженная квинта/тритон в низах)
  [46,46.6,65.4].forEach(fr=>{const o=c.createOscillator(),f=c.createBiquadFilter();
    o.type='sawtooth';o.frequency.value=fr;f.type='lowpass';f.frequency.value=140;
    o.connect(f);f.connect(dg);o.start();});
  const w=noiseSrc(),wf=c.createBiquadFilter(),wg=c.createGain();
  wf.type='bandpass';wf.frequency.value=390;wf.Q.value=.65;wg.gain.value=.028;
  SFX._windG=wg;
  const lfo=c.createOscillator(),lg=c.createGain();lfo.frequency.value=.06;lg.gain.value=160;
  lfo.connect(lg);lg.connect(wf.frequency);lfo.start();
  w.connect(wf);wf.connect(wg);wg.connect(SFX.master);w.start();
  // динамический слой дождя (громкость зависит от G.wx.rain)
  const rn=noiseSrc(),rf=c.createBiquadFilter(),rg=c.createGain();
  rf.type='bandpass';rf.frequency.value=1450;rf.Q.value=.45;rg.gain.value=0;
  SFX._rainG=rg;
  rn.connect(rf);rf.connect(rg);rg.connect(SFX.master);rn.start();
  // постоянный дневной/лесной эмбиент: вороны, сова, сучья, далёкий вой
  (function forestLoop(){ setTimeout(()=>{ if(SFX.ctx){
    const r=Math.random();
    if(r<.32){const t=c.currentTime,pan=c.createStereoPanner?c.createStereoPanner():null;
      const g=c.createGain(),n=noiseSrc(),f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=1050;f.Q.value=6;
      n.connect(f);f.connect(g); if(pan){g.connect(pan);pan.pan.value=Math.random()*2-1;pan.connect(SFX.master);}else g.connect(SFX.master);
      env(g,t,.01,.26,.11);n.start(t);n.stop(t+.32);}
    else if(r<.56)SFX.owl();
    else if(r<.76)SFX.branchSnap();
    else if(r<.82)SFX.creak();
    else if(r<.94)SFX.weirdForest();
    else SFX.wolfHowl();
  } forestLoop(); },6500+Math.random()*11500); })();
}

/* ============ мрачная тревожная музыка в духе Darkwood (WebAudio) ============ */
const MUS={
  on:false, mode:'day', threat:0, hp:100,
  g:null, droneG:null, droneF:null, tensG:null,
  noteT:null, swellT:null, pulseT:null, deadPlayed:false
};

SFX.toggleMute=function(){
  SFX.on=!SFX.on;
  if(SFX.ctx&&SFX.master){
    SFX.master.gain.setTargetAtTime(SFX.on?.85:0,SFX.ctx.currentTime,.06);
  }
  return SFX.on;
};

function musicInit(){
  if(MUS.on||!SFX.ctx)return;
  MUS.on=true;
  const c=SFX.ctx, t=c.currentTime;
  MUS.g=c.createGain();
  MUS.g.gain.value=.55;
  MUS.g.connect(SFX.master);
  if(SFX.wet){
    const mw=c.createGain();mw.gain.value=.45;
    MUS.g.connect(mw);mw.connect(SFX.wet);
  }

  // 1) Слой смычкового баса / мрачного гула (D1, Eb1, G#1 — тритон и малая секунда)
  MUS.droneG=c.createGain();MUS.droneG.gain.value=.075;
  MUS.droneF=c.createBiquadFilter();MUS.droneF.type='lowpass';MUS.droneF.frequency.value=135;MUS.droneF.Q.value=2.4;
  MUS.droneF.connect(MUS.droneG);MUS.droneG.connect(MUS.g);

  const lfo=c.createOscillator(),lg=c.createGain();
  lfo.frequency.value=.045;lg.gain.value=48;
  lfo.connect(lg);lg.connect(MUS.droneF.frequency);lfo.start(t);

  [[36.71,'sawtooth'],[36.92,'triangle'],[55.0,'sawtooth'],[51.91,'sawtooth']].forEach(([fr,tp])=>{
    const o=c.createOscillator(),og=c.createGain();
    o.type=tp;o.frequency.value=fr;og.gain.value=fr<40?.34:.16;
    o.connect(og);og.connect(MUS.droneF);o.start(t);
  });

  // 2) Слой тревожного напряжения (диссонирующее тремоло)
  MUS.tensG=c.createGain();MUS.tensG.gain.value=.001;
  MUS.tensG.connect(MUS.g);

  // Запуск генеративных циклов
  musicScheduleNote();
  musicScheduleSwell();
  musicSchedulePulse();
}

function playPreparedPiano(freq,dur,vol,panVal){
  if(!SFX.ctx||!MUS.g)return;
  const c=SFX.ctx, t=c.currentTime;
  const pan=c.createStereoPanner?c.createStereoPanner():null;
  const g=c.createGain();
  const f=c.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(1400,t);f.frequency.exponentialRampToValueAtTime(280,t+dur);

  // Основной тон + расстроенный обертон (эффект старой плёнки / расстроенного пианино)
  const o1=c.createOscillator(), o2=c.createOscillator();
  o1.type='triangle'; o2.type='sine';
  const drift=(Math.random()-.5)*1.8;
  o1.frequency.setValueAtTime(freq,t);
  o1.frequency.linearRampToValueAtTime(freq+drift,t+dur*.8);
  o2.frequency.setValueAtTime(freq*2.015,t);
  o2.frequency.linearRampToValueAtTime(freq*1.99,t+dur);

  const g2=c.createGain();g2.gain.value=.28;
  o1.connect(f);o2.connect(g2);g2.connect(f);
  f.connect(g);
  if(pan){pan.pan.value=panVal;g.connect(pan);pan.connect(MUS.g);}
  else g.connect(MUS.g);

  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(vol,t+.018);
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o1.start(t);o2.start(t);o1.stop(t+dur+.05);o2.stop(t+dur+.05);
}

function musicScheduleNote(){
  clearTimeout(MUS.noteT);
  if(!MUS.on)return;
  const m=MUS.mode;
  if(m!=='dead'){
    // D Локрийский / Фригийский мрачный звукоряд
    const scaleDay=[146.83,155.56,174.61,207.65,220.00,293.66];
    const scaleDark=[73.42,77.78,110.00,146.83,155.56,164.81,207.65,277.18,311.13];
    const sc=(m==='night'||m==='combat'||m==='dusk')?scaleDark:scaleDay;
    const fr=sc[(Math.random()*sc.length)|0];
    const vol=(m==='combat')?.11:((m==='night'||m==='dusk')?.095:.07);
    playPreparedPiano(fr,2.8+Math.random()*2.2,vol,(Math.random()*1.4-.7));
    // иногда — тревожный диссонирующий кластер через малую секунду
    if((m==='night'||m==='combat')&&Math.random()<.42){
      setTimeout(()=>playPreparedPiano(fr*1.05946,2.2,vol*.75,(Math.random()*1.4-.7)),260+Math.random()*320);
    }
  }
  const delay=m==='combat'?(1100+Math.random()*1300):(m==='night'?(1700+Math.random()*2200):(2600+Math.random()*3400));
  MUS.noteT=setTimeout(musicScheduleNote,delay);
}

function musicScheduleSwell(){
  clearTimeout(MUS.swellT);
  if(!MUS.on)return;
  const m=MUS.mode;
  if(SFX.ctx&&(m==='dusk'||m==='night'||m==='combat'||MUS.hp<35)){
    const c=SFX.ctx, t=c.currentTime;
    const dur=3.4+Math.random()*2.2;
    const fr=[293.66,311.13,415.30,587.33,622.25][(Math.random()*5)|0];
    const o1=c.createOscillator(),o2=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();
    o1.type='sawtooth';o2.type='sawtooth';
    o1.frequency.setValueAtTime(fr,t);o1.frequency.linearRampToValueAtTime(fr*(Math.random()<.5?.97:1.03),t+dur);
    o2.frequency.setValueAtTime(fr*1.012,t);
    f.type='bandpass';f.frequency.setValueAtTime(fr*1.4,t);f.Q.value=4.5;
    o1.connect(f);o2.connect(f);f.connect(g);g.connect(MUS.tensG);
    const pk=m==='combat'?.14:(m==='night'?.10:.06);
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(pk,t+dur*.45);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o1.start(t);o2.start(t);o1.stop(t+dur+.1);o2.stop(t+dur+.1);
  }
  MUS.swellT=setTimeout(musicScheduleSwell,4200+Math.random()*4800);
}

function musicSchedulePulse(){
  clearTimeout(MUS.pulseT);
  if(!MUS.on)return;
  const m=MUS.mode;
  if(SFX.ctx&&(m==='combat'||MUS.threat>.35||MUS.hp<30)){
    const c=SFX.ctx, t=c.currentTime;
    const o=c.createOscillator(),g=c.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(62,t);
    o.frequency.exponentialRampToValueAtTime(34,t+.18);
    const pk=Math.min(.26,.08+MUS.threat*.18+(MUS.hp<30?.08:0));
    env(g,t,.006,.22,pk);
    o.connect(g);g.connect(MUS.g);
    o.start(t);o.stop(t+.28);
  }
  const ms=m==='combat'?430:(MUS.hp<30?500:640);
  MUS.pulseT=setTimeout(musicSchedulePulse,ms);
}

SFX.musicUpdate=function(st){
  if(!MUS.on||!SFX.ctx)return;
  const c=SFX.ctx, t=c.currentTime;
  MUS.mode=st.mode||'day';
  MUS.threat=st.threat||0;
  MUS.hp=(st.hp===undefined)?100:st.hp;

  if(MUS.mode==='dead'){
    if(!MUS.deadPlayed){
      MUS.deadPlayed=true;
      playPreparedPiano(73.42,5.5,.18,0);
      playPreparedPiano(77.78,5.2,.14,.2);
      playPreparedPiano(110.00,4.8,.11,-.2);
    }
    MUS.droneG.gain.setTargetAtTime(.03,t,1.5);
    MUS.tensG.gain.setTargetAtTime(.001,t,1.0);
    return;
  }
  MUS.deadPlayed=false;

  const dg=MUS.mode==='combat'?.14:(MUS.mode==='night'?.11:(MUS.mode==='dusk'?.09:.065));
  const df=MUS.mode==='combat'?240:(MUS.mode==='night'?180:130);
  const tg=(MUS.mode==='combat'||MUS.mode==='night'||MUS.mode==='dusk'||MUS.hp<35)?1:.05;
  MUS.droneG.gain.setTargetAtTime(dg,t,.8);
  MUS.droneF.frequency.setTargetAtTime(df,t,.8);
  MUS.tensG.gain.setTargetAtTime(tg,t,1.0);
};
