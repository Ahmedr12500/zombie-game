// Dead Night — real 3D first-person renderer (three.js). Game logic stays in index.html.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as skClone} from 'three/addons/utils/SkeletonUtils.js';

const G={ok:false,err:null,frame:null,project:null};
window.GAME3D=G;

function bridge(){return window.__g3}
const V3=THREE.Vector3;

async function boot(){
  // wait for the game script's bridge
  for(let i=0;i<200&&!bridge();i++)await new Promise(r=>setTimeout(r,50));
  const B=bridge();if(!B){G.err='no bridge';return}
  const cv=document.getElementById('g3');if(!cv){G.err='no canvas';return}
  const VW=B.VW,VH=B.VH,WW=B.WW,WH=B.WH;

  const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,powerPreference:'high-performance'});
  renderer.setSize(VW,VH,false);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;

  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x04060a);
  scene.fog=new THREE.Fog(0x05070a,140,980);
  const camera=new THREE.PerspectiveCamera(44,VW/VH,2,2200);
  camera.rotation.order='YXZ';

  const texOf=c=>{const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t};

  // ---- ground: the game's own 2D ground canvas (with all decals/blood) as texture ----
  const gTex=texOf(B.ground);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(WW,WH),new THREE.MeshStandardMaterial({map:gTex,roughness:.92,metalness:.05}));
  ground.geometry.rotateX(-Math.PI/2);ground.position.set(WW/2,0,WH/2);ground.receiveShadow=true;scene.add(ground);

  // ---- helpers ----
  const flat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.95});
  function box(x,y,w,h,hgt,mats,yBase=0){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,hgt,h),mats);
    m.position.set(x+w/2,yBase+hgt/2,y+h/2);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m}
  const M=c=>new THREE.MeshStandardMaterial({map:texOf(c),roughness:.85,metalness:.08});

  // cars
  for(const c of B.CARS){
    const vert=c.h>c.w,side=M(B.tex.carSide(c.police?'#e6e6e6':c.c,c.police,c.smash)),end=M(B.tex.carEnd(c.police?'#e6e6e6':c.c)),top=flat(c.police?'#555':c.c);
    top.color.multiplyScalar(.35);
    const mats=vert?[side,side,top,top,end,end]:[end,end,top,top,side,side];
    box(c.x,c.y,c.w,c.h,42,mats);
  }
  // store walls / shelves / counters / dumps
  const sWall=M(B.tex.TX.storeWall),sFront=M(B.tex.TX.storeFront),sIn=M(B.tex.TX.storeIn),sTop=flat('#1b1d1f');
  sFront.emissive=new THREE.Color(0x443322);sFront.emissiveMap=sFront.map;sFront.emissiveIntensity=.22;
  for(const c of B.PROPS){
    if(c.store){
      const f=c.fx,ex=c.front?sFront:sWall;
      const mats=[f==='E'?ex:sIn,f==='W'?ex:sIn,sTop,sTop,f==='S'?ex:sIn,f==='N'?ex:sIn];
      box(c.x,c.y,c.w,c.h,120,mats);
    }else if(c.shelf){const sh=M(B.tex.TX.shelf);box(c.x,c.y,c.w,c.h,30,[sh,sh,flat('#232527'),flat('#232527'),sh,sh])}
    else if(c.counter){const co=M(B.tex.TX.counter);box(c.x,c.y,c.w,c.h,38,[co,co,flat('#5a4328'),flat('#333'),co,co])}
    else if(c.dump){const d=M(c.c==='#2f4a3a'?B.tex.TX.dump:B.tex.TX.dump2);box(c.x,c.y,c.w,c.h,40,[d,d,flat('#20352a'),flat('#111'),d,d])}
  }
  // store roof slab + interior lights
  {const st=B.STORE;const roof=new THREE.Mesh(new THREE.BoxGeometry(st.w,6,st.h),flat('#141618'));
   roof.position.set(st.x+st.w/2,120,st.y+st.h/2);roof.castShadow=false;scene.add(roof);
   for(const lx of[st.x+70,st.x+180]){const li=new THREE.PointLight(0xffe7c0,1100,360,1);li.position.set(lx,105,st.y+115);scene.add(li)}}
  // tower
  const twTex=M(B.tex.towerTex),twTop=flat('#5e452c');
  const tower=box(B.TOWER.x,B.TOWER.y,B.TOWER.w,B.TOWER.h,105,[twTex,twTex,twTop,twTop,twTex,twTex]);
  // fences + skyline
  {const fTex=texOf(B.tex.fenceTex);fTex.wrapS=THREE.RepeatWrapping;
   const skyTex=texOf(B.tex.skyline);
   const mkWall=(len,x,z,ry)=>{
     const t=fTex.clone();t.needsUpdate=true;t.repeat.set(len/256,1);
     const m=new THREE.Mesh(new THREE.PlaneGeometry(len,95),new THREE.MeshStandardMaterial({map:t,roughness:1,side:THREE.DoubleSide}));
     m.position.set(x,47,z);m.rotation.y=ry;scene.add(m);
     const s=new THREE.Mesh(new THREE.PlaneGeometry(len*1.4,150),new THREE.MeshBasicMaterial({map:skyTex,fog:false,side:THREE.DoubleSide}));
     const off=120,dx=Math.sin(ry+Math.PI/2),dz=Math.cos(ry+Math.PI/2);
     s.position.set(x- dz*off*(ry===0?1:0)-(ry!==0?dx*0:0),72,z);
     // place skyline behind the fence, outward from map center
     const cx=WW/2,cz=WH/2;const ox=x-cx,oz=z-cz;const L=Math.hypot(ox,oz)||1;
     s.position.set(x+ox/L*140,72,z+oz/L*140);s.rotation.y=ry;scene.add(s)}
   mkWall(WW+300,WW/2,-8,0);mkWall(WW+300,WW/2,WH+8,0);mkWall(WH+300,-8,WH/2,Math.PI/2);mkWall(WH+300,WW+8,WH/2,Math.PI/2)}
  // trees & bushes: crossed billboards + trunk
  function crossed(c,x,z,wd,hg){
    const t=texOf(c);const mat=new THREE.MeshStandardMaterial({map:t,transparent:true,alphaTest:.35,side:THREE.DoubleSide,roughness:1,color:0x8a8a8a});
    for(const ry of[0,Math.PI/2]){const m=new THREE.Mesh(new THREE.PlaneGeometry(wd,hg),mat);m.position.set(x,hg/2,z);m.rotation.y=ry;m.castShadow=true;scene.add(m)}}
  for(const t of B.TREES)crossed(B.tex.treeTex,t.x+7,t.y+7,150*t.s,190*t.s);
  for(const b of B.BUSHES)crossed(B.tex.bushTex,b[0],b[1],78,42);
  // lamps
  const lampLights=[];
  for(const l of B.LAMPS){
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(2.4,3.2,178,8),flat('#3c3e3a'));
    pole.position.set(l.x,89,l.y);pole.castShadow=true;scene.add(pole);
    const arm=new THREE.Mesh(new THREE.BoxGeometry(26,4,6),flat('#44463f'));arm.position.set(l.x+12,176,l.y);scene.add(arm);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(4,8,6),new THREE.MeshBasicMaterial({color:0xffd9a0}));bulb.position.set(l.x+22,172,l.y);scene.add(bulb);
    const li=new THREE.PointLight(0xffb866,2400,l.r*2.6,1);li.position.set(l.x+22,168,l.y);scene.add(li);
    lampLights.push({l,li,bulb});
  }
  // hazard + police lights
  const hz=B.HAZ,po=B.POLICE;
  const hzL=new THREE.PointLight(0xffa030,0,240,1);hzL.position.set(hz.x+hz.w/2,40,hz.y+hz.h/2);scene.add(hzL);
  const poL=new THREE.PointLight(0xff3030,0,340,1);poL.position.set(po.x+po.w/2,52,po.y+po.h/2);scene.add(poL);
  // ambient + flashlight
  const hemi=new THREE.HemisphereLight(0x33405a,0x0c0e0a,.6);scene.add(hemi);
  const flash=new THREE.SpotLight(0xfff2d8,0,820,.52,.5,1);
  flash.castShadow=true;flash.shadow.mapSize.set(1024,1024);flash.shadow.bias=-.004;flash.shadow.camera.near=10;flash.shadow.camera.far=800;
  const flashTgt=new THREE.Object3D();scene.add(flashTgt);flash.target=flashTgt;scene.add(flash);
  const muzzle=new THREE.PointLight(0xffc070,0,300,1);scene.add(muzzle);
  // event light pool (explosions / vaporize)
  const evL=[...Array(4)].map(()=>{const p=new THREE.PointLight(0xffaa50,0,460,1);scene.add(p);return p});

  // ---- dynamic simple objects ----
  const sph=new THREE.SphereGeometry(4.5,8,6),gMat=flat('#3d4a2e');
  const grenPool=[...Array(8)].map(()=>{const m=new THREE.Mesh(sph,gMat);m.visible=false;scene.add(m);return m});
  const gibGeo=new THREE.BoxGeometry(6,4,5),gibMat=flat('#6e0f12');
  const gibPool=[...Array(24)].map(()=>{const m=new THREE.Mesh(gibGeo,gibMat);m.visible=false;m.castShadow=true;scene.add(m);return m});
  // picks
  function iconCanvas(g){const c=document.createElement('canvas');c.width=c.height=48;const x=c.getContext('2d');
    if(g){x.fillStyle='#4b5a36';x.fillRect(4,12,40,26);x.fillStyle='#2b3320';x.fillRect(4,23,40,4);x.fillStyle='#e6d9a8';x.font='700 11px sans-serif';x.fillText('FRAG',10,21)}
    else{x.fillStyle='#ecebe2';x.fillRect(4,10,40,30);x.fillStyle='#c41f33';x.fillRect(20,14,8,22);x.fillRect(13,21,22,8)}return c}
  const pickMats=[new THREE.SpriteMaterial({map:texOf(iconCanvas(false))}),new THREE.SpriteMaterial({map:texOf(iconCanvas(true))})];
  const pickPool=[...Array(10)].map(()=>{const s=new THREE.Sprite(pickMats[0]);s.scale.set(16,13,1);s.visible=false;scene.add(s);return s});
  // smoke sprites
  const smokeC=document.createElement('canvas');smokeC.width=smokeC.height=64;{const x=smokeC.getContext('2d');const g2=x.createRadialGradient(32,32,2,32,32,30);g2.addColorStop(0,'rgba(140,140,135,.8)');g2.addColorStop(1,'rgba(120,120,115,0)');x.fillStyle=g2;x.fillRect(0,0,64,64)}
  const smokePool=[...Array(40)].map(()=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:texOf(smokeC),transparent:true,depthWrite:false}));s.visible=false;scene.add(s);return s});
  // particles
  const PMAX=400,pGeo=new THREE.BufferGeometry();
  pGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(PMAX*3),3));
  pGeo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(PMAX*3),3));
  const pts=new THREE.Points(pGeo,new THREE.PointsMaterial({size:3.4,vertexColors:true,transparent:true,opacity:.95,depthWrite:false}));
  pts.frustumCulled=false;scene.add(pts);
  const colCache={};
  function pcol(s){let v=colCache[s];if(v)return v;const c=new THREE.Color(s.startsWith('#')?s:'#888');colCache[s]=v=[c.r,c.g,c.b];return v}
  // bullets
  const BMAX=80,bGeo=new THREE.BufferGeometry();
  bGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(BMAX*6),3));
  const blines=new THREE.LineSegments(bGeo,new THREE.LineBasicMaterial({color:0xffe6a6,transparent:true,opacity:.9}));
  blines.frustumCulled=false;scene.add(blines);
  // fx rings
  const ringPool=[...Array(4)].map(()=>{const m=new THREE.Mesh(new THREE.RingGeometry(.9,1,48),new THREE.MeshBasicMaterial({color:0xffc878,transparent:true,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=-Math.PI/2;m.visible=false;scene.add(m);return m});

  // ---- dog (primitives) ----
  const dog=new THREE.Group();
  {const bod=new THREE.Mesh(new THREE.BoxGeometry(30,13,11),flat('#8a6a3e'));bod.position.y=20;bod.castShadow=true;dog.add(bod);
   const hd=new THREE.Mesh(new THREE.BoxGeometry(11,10,9),flat('#7a5c34'));hd.position.set(19,27,0);dog.add(hd);
   const sn=new THREE.Mesh(new THREE.BoxGeometry(6,4.5,5),flat('#2a2119'));sn.position.set(26,25,0);dog.add(sn);
   for(const s of[-1,1]){const ear=new THREE.Mesh(new THREE.ConeGeometry(2.4,6,4),flat('#3a2a1a'));ear.position.set(17,33,s*3);dog.add(ear)}
   dog.legs=[];for(const[lx,lz]of[[-10,-4],[-10,4],[10,-4],[10,4]]){const leg=new THREE.Mesh(new THREE.BoxGeometry(3.5,14,3.5),flat('#6a4e2c'));leg.position.set(lx,8,lz);dog.add(leg);dog.legs.push(leg)}
   const tail=new THREE.Mesh(new THREE.BoxGeometry(12,3,3),flat('#5a4128'));tail.position.set(-19,25,0);dog.add(tail);dog.tail=tail;
   dog.visible=false;scene.add(dog)}

  // ---- zombies: animated GLB ----
  let base=null,clips=null;
  try{
    const gltf=await new GLTFLoader().loadAsync('assets/soldier.glb');
    base=gltf.scene;clips=gltf.animations;
    base.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false}});
  }catch(e){G.err='glb: '+e;console.warn('GLB load failed',e)}
  const clipByName=n=>clips&&(clips.find(c=>c.name===n)||clips[0]);
  const Z=new Map();
  const tints=[0x4d5844,0x535c4b,0x47523e,0x58564a,0x4c4f45];
const AX={x:new THREE.Vector3(1,0,0),y:new THREE.Vector3(0,1,0),z:new THREE.Vector3(0,0,1)};let zi=0;
  function mkZ(z){
    if(!base)return null;
    const root=skClone(base);
    const inst={root,mixer:new THREE.AnimationMixer(root),bones:{},mats:[],dead:0,wrap:new THREE.Group()};
    inst.wrap.add(root);scene.add(inst.wrap);
    const tint=new THREE.Color(tints[(Math.random()*tints.length)|0]);
    root.traverse(o=>{
      if(o.isBone){const n=o.name;
        if(/HeadTop|Head$/.test(n))inst.bones.head=inst.bones.head||o;
        if(/LeftArm$/.test(n))inst.bones.la=o;if(/RightArm$/.test(n))inst.bones.ra=o;
        if(/LeftForeArm$/.test(n))inst.bones.lf=o;if(/RightForeArm$/.test(n))inst.bones.rf=o;
        if(/LeftUpLeg$/.test(n))inst.bones.ll=o;if(/RightUpLeg$/.test(n))inst.bones.rl=o;
        if(/Spine1$/.test(n))inst.bones.sp=o}
      if(o.isMesh){o.material=o.material.clone();o.material.color.multiply(tint);o.material.roughness=1;o.material.metalness=0;inst.mats.push(o.material)}});
    const sc={walker:32,runner:31,brute:42,boss:56}[z.k]||32;
    root.scale.setScalar(sc);
    const cn=z.k==='runner'?'Run':'Walk';
    const act=inst.mixer.clipAction(clipByName(cn));
    act.timeScale=({walker:.55,runner:.95,brute:.42,boss:.5}[z.k]||.6)*(.9+Math.random()*.2);
    act.play();inst.act=act;
    inst.phase=Math.random()*10;inst.vi=zi++;inst.q=new THREE.Quaternion();
    return inst;
  }
  function syncZ(z,inst,dt,t){
    const w=inst.wrap;w.visible=true;
    w.position.set(z.x,0,z.y);
    w.rotation.y=-z.a-Math.PI/2+ (z.tw>0?(Math.random()-.5)*.2:0);
    const lb=z.limb,bs=inst.bones;
    inst.mixer.update(dt*(z.stag>0?.35:1));
    // zombie arm pose (post-anim override, composed after animation)
    if(!z.crawl){
      const sw2=Math.sin(t*1.6+inst.phase)*.07;
      const VAR=[-0.75,'z',0.9+Math.sin(inst.phase)*.15,-0.9+Math.cos(inst.phase)*.15];
      inst.q.setFromAxisAngle(AX.x,VAR[0]+sw2);inst.q2=inst.q2||new THREE.Quaternion();
      inst.q2.setFromAxisAngle(AX[VAR[1]],VAR[2]);inst.q.multiply(inst.q2);
      if(lb.la&&bs.la)bs.la.quaternion.copy(inst.q);
      inst.q.setFromAxisAngle(AX.x,VAR[0]-sw2);
      inst.q2.setFromAxisAngle(AX[VAR[1]],VAR[3]);inst.q.multiply(inst.q2);
      if(lb.ra&&bs.ra)bs.ra.quaternion.copy(inst.q);
      if(bs.lf&&lb.la)bs.lf.quaternion.identity();
      if(bs.rf&&lb.ra)bs.rf.quaternion.identity();
    }
    if(bs.sp)bs.sp.rotation.x=.28+(z.k==='boss'?.1:0);
    // severed limbs / head
    const sc1=(b,on)=>{if(b)b.scale.setScalar(on?1:.001)};
    sc1(bs.la,lb.la);sc1(bs.ra,lb.ra);sc1(bs.ll,lb.ll||z.crawl?lb.ll:lb.ll);sc1(bs.ll,lb.ll);sc1(bs.rl,lb.rl);
    if(bs.head)bs.head.scale.setScalar(lb.head?1:.001);
    // crawl: prone
    if(z.crawl){w.rotation.x=0;inst.root.rotation.x=-1.25;inst.root.position.y=10;sc1(bs.ll,false);sc1(bs.rl,false)}
    else{inst.root.rotation.x=0;inst.root.position.y=0}
    // dying: topple
    if(z.dying>0){const k=1-z.dying/.4;inst.root.rotation.x=(z.crawl?-1.25:0)-k*1.5;inst.root.position.y=(z.crawl?10:0)-k*2}
    // hit flash / vapor
    const hit=z.hit>0;
    for(const m of inst.mats){
      m.emissive.setRGB(hit?.55:0,0,0);
      const vp=z.vapor>0;m.transparent=vp;m.opacity=vp?z.vapor/.6:1;
    }
  }

  // ---- per-frame ----
  const _v=new V3();
  G.project=(x,h,y)=>{
    _v.set(x,h,y).project(camera);
    if(_v.z>1)return null;
    return[(_v.x*.5+.5)*VW,(-_v.y*.5+.5)*VH];
  };
  let lastT=performance.now();
  G.frame=st=>{
    const B2=bridge(),S=B2.S();if(!S)return;
    const now=performance.now(),dt=Math.min(.05,(now-lastT)/1000);lastT=now;
    const t=st.t;
    // camera
    camera.position.set(st.x,st.eye,st.y);
    camera.rotation.y=-st.a-Math.PI/2;
    camera.rotation.x=st.pitchRad;
    camera.rotation.z=(st.moving?Math.sin(st.step)*.004:0);
    // ground decals refresh
    if(window.__gd){gTex.needsUpdate=true;window.__gd=0}
    // lights
    const lf=Math.min(1,st.lf||0);
    hemi.intensity=.5+(1-st.dark)*.55+lf*5;
    scene.fog.color.setRGB(.02+lf*.3,.027+lf*.33,.04+lf*.42);
    flash.intensity=st.inTower?6500:7000;
    flash.position.copy(camera.position);
    flashTgt.position.set(st.x+Math.cos(st.a)*200,st.eye-34-Math.tan(st.pitchRad||0)*-200,st.y+Math.sin(st.a)*200);
    flashTgt.position.y=st.eye+Math.tan(st.pitchRad)*200-30;
    muzzle.position.set(st.x+Math.cos(st.a)*30,st.eye-6,st.y+Math.sin(st.a)*30);
    muzzle.intensity=st.flash>0?5200:0;
    for(const{l,li,bulb}of lampLights){const on=l.fl?(Math.sin(t*23)>-.2||Math.sin(t*1.7)>.4?1:.22):1;li.intensity=2400*on;bulb.material.color.setScalar(on)}
    hzL.intensity=Math.sin(t*6)>0?900:0;
    const ph=Math.floor(t*7)%2;poL.color.setHex(ph?0xff3030:0x3050ff);poL.intensity=1500;
    // event lights
    const fl=S.flashes||[];
    for(let i=0;i<evL.length;i++){const f=fl[i];if(f){evL[i].intensity=9000*(f.t/f.max);evL[i].position.set(f.x,30,f.y);evL[i].color.set(f.c?`rgb(${f.c})`:'#ffaa50')}else evL[i].intensity=0}
    // tower
    tower.visible=!S.tower.dead;
    // zombies
    const seen=new Set();
    for(const z of S.zs){
      if(z.gone)continue;
      let inst=Z.get(z);
      if(!inst){inst=mkZ(z);if(!inst)continue;Z.set(z,inst)}
      seen.add(z);syncZ(z,inst,dt,t);
    }
    for(const[z,inst]of Z)if(!seen.has(z)){scene.remove(inst.wrap);Z.delete(z)}
    // dog
    const d=S.dog;
    if(d&&!d.dead){dog.visible=true;dog.position.set(d.x,0,d.y);dog.rotation.y=-d.a;
      for(let i=0;i<4;i++)dog.legs[i].rotation.x=Math.sin(d.step+(i%2?Math.PI:0))*.7;
      dog.tail.rotation.z=Math.sin(t*14)*.4}
    else dog.visible=false;
    // grenades
    for(let i=0;i<grenPool.length;i++){const g=S.gren[i];const m=grenPool[i];
      if(g){m.visible=true;m.position.set(g.x,6+g.z,g.y)}else m.visible=false}
    // gibs
    for(let i=0;i<gibPool.length;i++){const g=S.gibs[i];const m=gibPool[i];
      if(g){m.visible=true;m.position.set(g.x,5,g.y);m.rotation.set(g.rot,g.rot*1.3,0)}else m.visible=false}
    // picks
    for(let i=0;i<pickPool.length;i++){const k=S.picks[i];const m=pickPool[i];
      if(k&&!(k.t<3&&Math.floor(k.t*8)%2)){m.visible=true;m.material=pickMats[k.g?1:0];m.position.set(k.x,11+Math.sin(t*4)*2,k.y)}else m.visible=false}
    // smoke
    for(let i=0;i<smokePool.length;i++){const q=S.smoke[i];const m=smokePool[i];
      if(q){m.visible=true;m.position.set(q.x,18,q.y);const s=q.r*2.6;m.scale.set(s,s,1);m.material.opacity=.5*q.life/q.max}else m.visible=false}
    // particles
    {const pos=pGeo.attributes.position.array,col=pGeo.attributes.color.array;let n=0;
     for(const q of S.parts){if(n>=PMAX)break;pos[n*3]=q.x;pos[n*3+1]=26;pos[n*3+2]=q.y;const c=pcol(q.col);col[n*3]=c[0];col[n*3+1]=c[1];col[n*3+2]=c[2];n++}
     pGeo.setDrawRange(0,n);pGeo.attributes.position.needsUpdate=true;pGeo.attributes.color.needsUpdate=true}
    // bullets
    {const pos=bGeo.attributes.position.array;let n=0;
     for(const b of S.bullets){if(n>=BMAX)break;const h=b.elev?120:44;
       pos[n*6]=b.x-b.vx*.02;pos[n*6+1]=h;pos[n*6+2]=b.y-b.vy*.02;pos[n*6+3]=b.x;pos[n*6+4]=h;pos[n*6+5]=b.y;n++}
     bGeo.setDrawRange(0,n*2);bGeo.attributes.position.needsUpdate=true}
    // fx rings
    for(let i=0;i<ringPool.length;i++){const f=S.fx[i];const m=ringPool[i];
      if(f){m.visible=true;m.position.set(f.x,2,f.y);m.scale.set(f.r,f.r,1);
        m.material.color.setHex(f.type==='vap'?0xbfe6ff:0xffc878);m.material.opacity=1-(f.t/f.dur)}
      else m.visible=false}
    renderer.render(scene,camera);
  };
  G.ok=true;console.log('GAME3D ready, clips:',clips&&clips.map(c=>c.name).join(','));
}
boot().catch(e=>{G.err=String(e);console.warn('3D init failed',e)});
