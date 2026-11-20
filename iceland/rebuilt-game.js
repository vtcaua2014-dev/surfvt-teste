/* Iceland Rebuilt v1
 * Original Iceland mesh & texture assets exported from SurfVT14 Unity 2019.
 * This is a NEW Three.js playable scene with camera and collision logic,
 * not a modification of the compiled Transylvania Unity runtime.
 */
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const el = id => document.getElementById(id);
const $ = { canvas:el("scene"), loading:el("load-screen"), start:el("start-screen"),
  gameOver:el("game-over"), score:el("score"), distance:el("distance"),
  coins:el("coins"), best:el("best"), status:el("status"), pause:el("pause"),
  restart:el("restart"), hud:el("hud"), controls:el("touch-controls"),
  mode:el("mode-label"), progress:el("load-progress"), final:el("final-score"),
  overlay:el("overlay"), shield:el("shield"), fps:el("fps"), sound:el("sound") };
const BASE = new URL("./", import.meta.url);
const getUrl = path => new URL(path, BASE).href;
const LANES = [-6, 0, 6], GROUND_LENGTH = 180;
const PLAYER_Z = 12;
const ASSET_NAMES = [
  "ground","track","station_mid","station_start","station_end",
  "pillars_mid","station_platforms","train_standard","train_cargo",
  "train_sub","train_ramp","track_gates","lightSignal","rock01_mesh",
  "rock02_mesh","rock03_mesh"
];
const TEXTURES = ["1.117_Iceland_environment","1.117_Iceland_trains",
  "1.117_Iceland_train_start","Snow"];
const STORAGE_KEY = "surfvt14_iceland_rebuilt_best_v1";
const state = {
  mode:"classic", phase:"menu", started:false, time:0, distance:0, coins:0,
  speed:19, spawnTimer:1.3, coinTimer:0.6, lane:1, x:0, height:0, velocityY:0,
  crouch:0, invulnerable:0, board:0, collected:0, frame:0, lastTime:0, raf:0,
  best:0, world:[], obstacles:[], pickups:[], loadedAssets:{}, groundShader:null,
  renderer:null, scene:null, camera:null, player:null, snow:null, assetsReady:false,
  pendingAssets:false, audio:null, muted:false, touch:{id:null,x:0,y:0,t:0},
  renderMs:0, rendererLost:false, lastTap:0
};
try { state.best=Number(localStorage.getItem(STORAGE_KEY))||0; } catch (_) {}
$.best.textContent=Math.floor(state.best);
const rnd=(a,b)=>a+Math.random()*(b-a);
function clamp(x,a,b){return Math.min(b,Math.max(a,x));}
function status(msg){$.status.textContent=msg;}
function setLoading(p,text){$.progress.style.width=Math.round(clamp(p,0,1)*100)+"%";status(text);}
function chime(freq=400,duration=.1,type="sine"){
  if(state.muted)return;
  try{
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)return;
    if(!state.audio)state.audio=new Context();
    if(state.audio.state==="suspended")state.audio.resume().catch(()=>{});
    const oscillator=state.audio.createOscillator(),gain=state.audio.createGain(),now=state.audio.currentTime;
    oscillator.type=type;oscillator.frequency.setValueAtTime(freq,now);
    gain.gain.setValueAtTime(.06,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    oscillator.connect(gain).connect(state.audio.destination);
    oscillator.start(now);oscillator.stop(now+duration);
  }catch(_){}
}
function updateHud(){
  $.score.textContent=Math.floor(state.distance*9+state.coins*100);
  $.distance.textContent=Math.floor(state.distance)+"m";
  $.coins.textContent=state.coins;
  $.best.textContent=Math.floor(state.best);
  $.shield.textContent=state.board>0?"PRANCHA "+Math.ceil(state.board)+"s":"";
  $.fps.textContent=state.frame>0?Math.round(1000/Math.max(state.renderMs,1))+" FPS":"";
}
function saveBest(){
  const score=Math.floor(state.distance*9+state.coins*100);
  if(score>state.best){state.best=score;try{localStorage.setItem(STORAGE_KEY,String(score));}catch(_){}}
}

function initScene(){
  if(state.renderer)return;
  const renderer=new THREE.WebGLRenderer({canvas:$.canvas,antialias:!isMobile(),powerPreference:"high-performance",alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,isMobile()?1.35:1.8));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.4;
  state.renderer=renderer;
  const scene=new THREE.Scene();
  scene.background=new THREE.Color("#b2dce3");
  scene.fog=new THREE.FogExp2("#9ac8d8",.008);
  scene.add(new THREE.HemisphereLight(0xebfaff,0x346078,2.35));
  const sun=new THREE.DirectionalLight(0xfff5d8,2.05);
  sun.position.set(-20,75,55);scene.add(sun);
  const bounce=new THREE.DirectionalLight(0x9bc4fb,.65);bounce.position.set(40,15,-25);scene.add(bounce);
  state.scene=scene;
  state.camera=new THREE.PerspectiveCamera(isMobile()?68:61,1,.1,650);
  state.camera.position.set(0,7,-17);
  resize();
  window.addEventListener("resize",resize,{passive:true});
  $.canvas.addEventListener("webglcontextlost",e=>{
    e.preventDefault();state.rendererLost=true;state.phase="paused";
    showOverlay("A placa de vídeo interrompeu o WebGL.","Recarregue a página para recuperar o contexto gráfico.");
  });
  // soft snowy atmosphere: individual points, no external textures
  const count=isMobile()?220:580;
  const coords=new Float32Array(count*3);
  for(let i=0;i<count;i++){
    coords[i*3]=rnd(-55,55);coords[i*3+1]=rnd(1,40);coords[i*3+2]=rnd(-30,220);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.BufferAttribute(coords,3));
  const snow=new THREE.Points(geometry,new THREE.PointsMaterial({
    color:0xffffff,size:isMobile()?.32:.42,transparent:true,opacity:.75,depthWrite:false
  }));
  snow.frustumCulled=false;scene.add(snow);state.snow=snow;
  state.player=createPlayer();
  scene.add(state.player);
}
function isMobile(){return /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent)||navigator.maxTouchPoints>0;}
function resize(){
  if(!state.renderer)return;
  let w=Math.max(1,$.canvas.clientWidth),h=Math.max(1,$.canvas.clientHeight);
  state.renderer.setSize(w,h,false);state.camera.aspect=w/h;
  state.camera.fov=(w/h<.75)?72:61;
  state.camera.updateProjectionMatrix();
}
function createPlayer(){
  const group=new THREE.Group();
  const skin=new THREE.MeshStandardMaterial({color:"#e4a57e",roughness:.88});
  const jacket=new THREE.MeshStandardMaterial({color:"#1e657c",roughness:.78});
  const pants=new THREE.MeshStandardMaterial({color:"#162c4b",roughness:.82});
  const boot=new THREE.MeshStandardMaterial({color:"#fff3e3",roughness:.78});
  const hat=new THREE.MeshStandardMaterial({color:"#f8c656",roughness:.8});
  const add=(geometry,material,x,y,z)=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);group.add(mesh);return mesh;
  };
  add(new THREE.BoxGeometry(.9,.8,.48),jacket,0,1.5,0);
  add(new THREE.BoxGeometry(.29,.72,.32),jacket,-.64,1.52,0);
  add(new THREE.BoxGeometry(.29,.72,.32),jacket,.64,1.52,0);
  add(new THREE.BoxGeometry(.36,.72,.38),pants,-.24,.74,0);
  add(new THREE.BoxGeometry(.36,.72,.38),pants,.24,.74,0);
  add(new THREE.BoxGeometry(.44,.18,.7),boot,-.24,.32,.08);
  add(new THREE.BoxGeometry(.44,.18,.7),boot,.24,.32,.08);
  add(new THREE.SphereGeometry(.39,12,10),skin,0,2.3,0);
  add(new THREE.BoxGeometry(.83,.22,.8),hat,0,2.57,-.03);
  const eyeMat=new THREE.MeshBasicMaterial({color:0x22293a});
  add(new THREE.BoxGeometry(.08,.07,.04),eyeMat,-.14,2.33,-.37);
  add(new THREE.BoxGeometry(.08,.07,.04),eyeMat,.14,2.33,-.37);
  group.position.set(0,0,PLAYER_Z);
  return group;
}

const fileFor=(inventory,name,type)=>{
  const entry=inventory.assets.find(a=>a.name===name&&a.type===type&&a.file);
  return entry?entry.file:null;
};
async function loadAssets(){
  if(state.assetsReady)return;
  if(state.pendingAssets)return;
  state.pendingAssets=true;
  $.loading.hidden=false;
  setLoading(.02,"Preparando cenário Iceland original…");
  initScene();
  let manifest;
  try{
    const response=await fetch(getUrl("extracted/manifest.json"),{cache:"no-store"});
    if(!response.ok)throw Error("Manifesto HTTP "+response.status);
    manifest=await response.json();
  }catch(error){state.pendingAssets=false;$.loading.hidden=true;throw Error("Não foi possível localizar os recursos Iceland extraídos: "+error);}
  const objLoader=new OBJLoader();
  const textureLoader=new THREE.TextureLoader();
  const total=ASSET_NAMES.length+TEXTURES.length;let done=0;
  const progress=()=>setLoading(.05+.88*done/total,"Importando recursos Iceland: "+done+"/"+total);
  const assets=state.loadedAssets;
  const loads=[
    ...ASSET_NAMES.map(async name=>{
      try{
        const f=fileFor(manifest,name,"Mesh");
        if(!f)throw Error("OBJ não encontrado");
        assets[name]=await objLoader.loadAsync(getUrl("extracted/"+f));
        assets[name].traverse(c=>{if(c.isMesh){c.geometry.computeBoundingBox();c.frustumCulled=true;}});
      }catch(e){console.warn("[Iceland] OBJ unavailable",name,e);}
      finally{done++;progress();}
    }),
    ...TEXTURES.map(async name=>{
      try{
        const f=fileFor(manifest,name,"Texture2D");
        if(!f)throw Error("PNG não encontrado");
        const tex=await textureLoader.loadAsync(getUrl("extracted/"+f));
        tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=THREE.RepeatWrapping;
        tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=2;
        assets["tex:"+name]=tex;
      }catch(e){console.warn("[Iceland] Texture unavailable",name,e);}
      finally{done++;progress();}
    })
  ];
  await Promise.all(loads);
  const available=ASSET_NAMES.filter(name=>!!assets[name]);
  if(available.length<5){state.pendingAssets=false;$.loading.hidden=true;throw Error("Apenas "+available.length+" meshes Iceland disponíveis; importação insuficiente.");}
  buildEnvironment();
  state.assetsReady=true;state.pendingAssets=false;
  $.loading.hidden=true;
  status("Iceland reconstruído: "+available.length+" modelos do jogo e "+TEXTURES.filter(n=>!!assets["tex:"+n]).length+" texturas");
}
function materialFor(name,opacity=1){
  const texture=state.loadedAssets["tex:"+name];
  return new THREE.MeshStandardMaterial({map:texture||null,color:texture?0xffffff:0x8bbbc7,
    side:THREE.DoubleSide,roughness:.93,metalness:.02,transparent:opacity<1,opacity});
}
function cloneAsset(name,material,scale=[1,1,1]){
  const asset=state.loadedAssets[name];
  if(!asset)return null;
  const obj=asset.clone(true);
  obj.scale.set(...scale);
  obj.traverse(child=>{if(child.isMesh){child.material=material;child.castShadow=false;}});
  return obj;
}
function buildEnvironment(){
  const env=materialFor("1.117_Iceland_environment");
  const trains=materialFor("1.117_Iceland_trains");
  const startTrain=materialFor("1.117_Iceland_train_start");
  state.mats={env,trains,startTrain};
  state.world=[];
  for(let i=0;i<3;i++){
    const seg=new THREE.Group();seg.position.z=(i-1)*GROUND_LENGTH+90;
    const ground=cloneAsset("ground",env);
    if(ground)seg.add(ground);
    const track=cloneAsset("track",env);
    if(track)seg.add(track);
    const station=cloneAsset(i===0?"station_start":i===2?"station_end":"station_mid",env,[.11,.13,1]);
    if(station){station.position.y=-1.5;seg.add(station);}
    const pillars=cloneAsset("pillars_mid",env,[.022,.085,1]);
    if(pillars){pillars.position.y=-1.5;seg.add(pillars);}
    const platform=cloneAsset("station_platforms",env,[.15,.13,1]);
    if(platform){platform.position.y=-1.5;seg.add(platform);}
    const signal=cloneAsset("lightSignal",env,[.3,.3,.3]);
    if(signal){signal.position.set(-9,0,58);seg.add(signal);}
    for(let j=0;j<5;j++){
      const rock=cloneAsset("rock0"+(1+j%3)+"_mesh",env,[rnd(4,10),rnd(4,10),rnd(4,10)]);
      if(rock){rock.position.set((j%2?-1:1)*rnd(15,20),-.5,12+j*31);seg.add(rock);}
    }
    if(!ground) {
      // Ground collision remains deterministic if a decorative OBJ is unavailable.
      const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,GROUND_LENGTH),
        new THREE.MeshStandardMaterial({color:0x9ac8ca,roughness:1}));
      floor.rotation.x=-Math.PI/2;floor.position.z=90;seg.add(floor);
    }
    state.scene.add(seg);state.world.push(seg);
  }
}
function clearDynamic(){
  for(const ob of state.obstacles){state.scene.remove(ob.root);}
  for(const coin of state.pickups){state.scene.remove(coin.root);}
  state.obstacles=[];state.pickups=[];
}
function createTrain(lane,z,variant){
  const root=new THREE.Group(),index=variant%3;
  const name=["train_standard","train_cargo","train_sub"][index];
  const obj=cloneAsset(name,state.mats.trains,[.23,.23,.23]);
  if(obj){obj.rotation.y=Math.PI;root.add(obj);}
  else{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(4.4,5,10),state.mats.trains);
    mesh.position.y=2.6;root.add(mesh);
  }
  root.position.set(LANES[lane],0,z);
  state.scene.add(root);
  const ob={root,lane,kind:"train",alive:true,z,depth:6.5,height:6.5,width:2.1};
  state.obstacles.push(ob);
  return ob;
}
function createBarrier(lane,z){
  const root=new THREE.Group();
  const barMat=new THREE.MeshStandardMaterial({color:0xc66b4b,roughness:.72});
  const bar=new THREE.Mesh(new THREE.BoxGeometry(4.1,1.15,.68),barMat);
  bar.position.set(0,.8,0);root.add(bar);
  const tape=new THREE.Mesh(new THREE.BoxGeometry(4.2,.16,.72),
    new THREE.MeshStandardMaterial({color:0xffe7ba}));
  tape.position.y=1.08;root.add(tape);
  for(const x of [-1.85,1.85]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.18,1.4,.38),barMat);
    leg.position.set(x,.75,0);root.add(leg);
  }
  root.position.set(LANES[lane],0,z);state.scene.add(root);
  const ob={root,lane,kind:"barrier",alive:true,z,depth:1.4,height:1.5,width:2.4};
  state.obstacles.push(ob);
  return ob;
}
function createCoin(lane,z){
  const root=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.65,.14,6,12),
    new THREE.MeshStandardMaterial({color:0xffd36f,metalness:.5,roughness:.23,
      emissive:0x574000,emissiveIntensity:.3}));
  root.add(ring);root.position.set(LANES[lane],1.8,z);
  state.scene.add(root);
  state.pickups.push({root,lane,z,alive:true});
}
function reset(mode){
  state.mode=mode;state.phase="playing";state.time=0;state.distance=0;
  state.coins=0;state.speed=19;state.spawnTimer=2;state.coinTimer=.7;
  state.lane=1;state.x=0;state.height=0;state.velocityY=0;state.crouch=0;
  state.invulnerable=1.1;state.board=0;state.lastTime=0;
  clearDynamic();
  state.world.forEach((seg,i)=>{seg.position.z=(i-1)*GROUND_LENGTH+90;});
  state.player.position.set(0,0,PLAYER_Z);
  $.mode.textContent=mode==="nocoin"?"NO COIN":"CLÁSSICO";
  $.overlay.hidden=true;$.gameOver.hidden=true;$.hud.hidden=false;
  $.controls.hidden=false;$.pause.textContent="Pausar";
  chime(570,.12);updateHud();
}
async function launch(mode){
  if(state.phase==="loading")return;
  state.phase="loading";$.start.hidden=true;$.gameOver.hidden=true;
  try{await loadAssets();reset(mode);}
  catch(error){
    state.phase="menu";$.start.hidden=false;$.loading.hidden=true;
    status(String(error));$.start.querySelector(".error").textContent=String(error);
    console.error("[Iceland] Asset load error",error);
  }
}
function die(reason){
  if(state.phase!=="playing")return;
  if(state.board>0){state.board=0;state.invulnerable=2;
    state.obstacles.forEach(o=>{if(Math.abs(o.root.position.z-PLAYER_Z)<10)o.alive=false;});
    chime(270,.2,"sawtooth");return;
  }
  saveBest();state.phase="dead";$.gameOver.hidden=false;$.final.textContent=
    "Pontuação "+Math.floor(state.distance*9+state.coins*100)+
    " · "+Math.floor(state.distance)+" m · "+state.coins+" moedas";
  $.controls.hidden=true;chime(150,.35,"sawtooth");
  status(reason||"Colisão com obstáculo");
}
function jump(){
  if(state.phase!=="playing")return;
  if(state.height<.12&&state.crouch<=0){state.velocityY=9.5;chime(510,.1);}
}
function roll(){
  if(state.phase!=="playing")return;
  if(state.height>.15){state.velocityY=-13;}
  else {state.crouch=.55;chime(180,.1);}
}
function moveLane(direction){
  if(state.phase!=="playing")return;
  const target=clamp(state.lane+direction,0,2);
  if(target!==state.lane){state.lane=target;chime(260,.045);}
}
function toggleBoard(){
  if(state.phase!=="playing"||state.board>0)return;
  state.board=7;chime(620,.15,"triangle");
}
function pause(){
  if(state.phase==="playing"){state.phase="paused";$.pause.textContent="Continuar";
    showOverlay("Jogo pausado","Pressione Continuar ou P para voltar.");
  }else if(state.phase==="paused"&&!state.rendererLost){
    state.phase="playing";$.pause.textContent="Pausar";$.overlay.hidden=true;state.lastTime=0;
  }
}
function showOverlay(title,caption){
  $.overlay.hidden=false;
  $.overlay.querySelector("h2").textContent=title;
  $.overlay.querySelector("p").textContent=caption;
}
function tick(dt){
  state.time+=dt;state.speed=clamp(19+state.time*.085,19,33);
  const advance=state.speed*dt;
  state.distance+=advance/3;
  for(const seg of state.world){
    seg.position.z-=advance;
    if(seg.position.z < -GROUND_LENGTH-5)seg.position.z+=GROUND_LENGTH*3;
  }
  const snowAttr=state.snow.geometry.getAttribute("position");
  for(let i=0;i<snowAttr.count;i++){
    let z=snowAttr.getZ(i)-advance*.27;
    let y=snowAttr.getY(i)-dt*.9;
    if(z<-40)z+=250;
    if(y<.1)y=36;
    snowAttr.setZ(i,z);snowAttr.setY(i,y);
  }
  snowAttr.needsUpdate=true;
  state.spawnTimer-=dt;
  if(state.spawnTimer<=0){
    const lane=Math.floor(Math.random()*3);
    const z=140+rnd(0,25);
    if(Math.random()<.7)createTrain(lane,z,Math.floor(Math.random()*3));
    else createBarrier(lane,z);
    if(state.distance>130&&Math.random()<.26){
      const other=(lane+1+Math.floor(Math.random()*2))%3;
      createBarrier(other,z+1.5);
    }
    state.spawnTimer=rnd(1.7,2.5)*(19/state.speed);
  }
  if(state.mode==="classic"){
    state.coinTimer-=dt;
    if(state.coinTimer<=0){createCoin(Math.floor(Math.random()*3),133+rnd(0,20));state.coinTimer=rnd(.38,.66);}
  }
  const smoothing=Math.min(1,dt*12);
  state.x=THREE.MathUtils.lerp(state.x,LANES[state.lane],smoothing);
  if(state.height>.001||state.velocityY>0){
    state.velocityY-=26*dt;state.height+=state.velocityY*dt;
    if(state.height<=0){state.height=0;state.velocityY=0;}
  }
  if(state.crouch>0)state.crouch-=dt;
  if(state.invulnerable>0)state.invulnerable-=dt;
  if(state.board>0)state.board-=dt;
  const crouching=state.crouch>0;
  state.player.position.set(state.x,state.height,PLAYER_Z);
  state.player.scale.y=THREE.MathUtils.lerp(state.player.scale.y,crouching?.62:1,smoothing);
  state.player.rotation.z=THREE.MathUtils.lerp(state.player.rotation.z,
    clamp((LANES[state.lane]-state.x)*-.037,-.14,.14),smoothing);
  state.player.visible=state.invulnerable<=0||Math.floor(state.time*10)%2===0;
  // AABB collider: use rendered mesh's spatial dimensions (trains) and small
  // deterministic blocker volumes for barriers. The player can jump barriers.
  const playerBox=new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(state.x,state.height+(crouching?.7:1.2),PLAYER_Z),
    new THREE.Vector3(1.05,crouching?1.35:2.25,1.05));
  for(const ob of state.obstacles){
    if(!ob.alive)continue;
    ob.root.position.z-=advance;
    if(ob.root.position.z<PLAYER_Z-18){ob.alive=false;continue;}
    if(state.invulnerable>0)continue;
    const bbox=new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(ob.root.position.x,ob.height*.5,ob.root.position.z),
      new THREE.Vector3(ob.width*2,ob.height,ob.depth*2)
    );
    if(playerBox.intersectsBox(bbox)){
      if(ob.kind==="barrier"&&state.height>=1.5){ob.alive=false;continue;}
      die("Colisão: "+(ob.kind==="train"?"trem":"barreira"));return;
    }
  }
  for(const coin of state.pickups){
    if(!coin.alive)continue;
    coin.root.position.z-=advance;
    coin.root.rotation.y+=dt*4;
    if(coin.root.position.z<PLAYER_Z-4){coin.alive=false;continue;}
    const dx=Math.abs(coin.root.position.x-state.x);
    if(dx<1.2&&Math.abs(coin.root.position.z-PLAYER_Z)<1.7&&state.height<2.7){
      coin.alive=false;state.coins++;chime(840,.06);
    }
  }
  state.obstacles=state.obstacles.filter(ob=>{
    if(ob.alive)return true;state.scene.remove(ob.root);return false;
  });
  state.pickups=state.pickups.filter(c=>{
    if(c.alive)return true;state.scene.remove(c.root);return false;
  });
  const target=new THREE.Vector3(state.x*.22,6.8+state.height*.08,PLAYER_Z-23);
  state.camera.position.lerp(target,Math.min(1,dt*4));
  state.camera.lookAt(state.x*.38,2.4+state.height*.3,PLAYER_Z+26);
  saveBest();updateHud();
}
function loop(time){
  state.raf=requestAnimationFrame(loop);
  if(!state.renderer)return;
  const dt=state.lastTime?clamp((time-state.lastTime)/1000,0,.04):0;
  state.lastTime=time;
  if(state.phase==="playing")tick(dt);
  // Keep static camera and scene preview visible before the first run.
  state.renderer.render(state.scene,state.camera);
  state.renderMs=(state.renderMs||16)*.8+Math.max(1,time-(state.frameTime||time))*.2;
  state.frameTime=time;state.frame++;
}
function onKeyDown(event){
  const k=event.key.toLowerCase();
  if(["arrowleft","arrowright","arrowup","arrowdown"," ","w","a","s","d"].includes(k))event.preventDefault();
  if(k==="p"||k==="escape"){pause();return;}
  if(k==="enter"&&state.phase==="menu"){launch("classic");return;}
  if(k==="arrowleft"||k==="a")moveLane(-1);
  if(k==="arrowright"||k==="d")moveLane(1);
  if(k==="arrowup"||k==="w")jump();
  if(k==="arrowdown"||k==="s")roll();
  if(k===" ")toggleBoard();
}
window.addEventListener("keydown",onKeyDown,{passive:false});
$.canvas.addEventListener("pointerdown",event=>{
  state.touch={id:event.pointerId,x:event.clientX,y:event.clientY,t:performance.now()};
  try{$.canvas.setPointerCapture(event.pointerId);}catch(_){}
});
$.canvas.addEventListener("pointerup",event=>{
  if(state.touch.id!==event.pointerId)return;
  const dx=event.clientX-state.touch.x,dy=event.clientY-state.touch.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))>35){
    if(Math.abs(dx)>Math.abs(dy))moveLane(dx>0?1:-1);
    else if(dy<0)jump();else roll();
  }else{
    const now=performance.now();
    if(now-state.lastTap<340)toggleBoard();
    state.lastTap=now;
  }
  state.touch.id=null;
});
$.canvas.addEventListener("contextmenu",event=>event.preventDefault());
for(const [name,handler] of Object.entries({
  left:()=>moveLane(-1),right:()=>moveLane(1),up:jump,down:roll,board:toggleBoard
})){
  const btn=el("touch-"+name);if(!btn)continue;
  btn.addEventListener("pointerdown",event=>{event.preventDefault();handler();});
}
el("play-classic").addEventListener("click",()=>launch("classic"));
el("play-nocoin").addEventListener("click",()=>launch("nocoin"));
el("try-again").addEventListener("click",()=>launch(state.mode));
$.pause.addEventListener("click",pause);
el("continue").addEventListener("click",pause);
$.restart.addEventListener("click",()=>launch(state.mode));
$.sound.addEventListener("click",()=>{
  state.muted=!state.muted;$.sound.textContent=state.muted?"Som desligado":"Som ligado";
});
document.addEventListener("visibilitychange",()=>{
  if(document.hidden&&state.phase==="playing")pause();
});
updateHud();
status("Cena Iceland pronta para importar.");
initScene();
state.raf=requestAnimationFrame(loop);
