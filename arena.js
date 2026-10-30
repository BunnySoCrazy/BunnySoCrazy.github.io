import * as THREE from './assets/vendor/three-0.170.0.min.js';
import {Match,COVER,WEAPONS} from './arena-engine.mjs';
import {createWeapons,animateWeapon} from './arena-weapons.mjs?v=arms2';

const $=id=>document.getElementById(id),canvas=$('scene'),overlay=$('overlay'),start=$('start');
document.body.classList.add('menu-open');
try{boot();}catch(error){start.hidden=true;$('overlay-copy').textContent='This game needs WebGL 2. Try a desktop browser with hardware acceleration enabled.';console.error(error);}
function boot(){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#263843');scene.fog=new THREE.Fog('#263843',18,65);
  const camera=new THREE.PerspectiveCamera(76,1,.055,100);camera.rotation.order='YXZ';scene.add(camera);
  scene.add(new THREE.HemisphereLight('#d8ede9','#536368',2.3));
  const sun=new THREE.DirectionalLight('#fff0d7',3.2);sun.position.set(-8,20,7);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-22;sun.shadow.camera.right=22;sun.shadow.camera.top=22;sun.shadow.camera.bottom=-22;sun.shadow.normalBias=.04;scene.add(sun);
  const geometry={box:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,12,8),body:new THREE.CapsuleGeometry(.32,.66,4,8),head:new THREE.BoxGeometry(.5,.42,.44)};
  const material=(color,extras={})=>new THREE.MeshStandardMaterial({color,roughness:.78,metalness:.12,...extras});
  const materials={floor:material('#576568'),wall:material('#889490'),dark:material('#25363d'),edge:material('#b0bdb5'),glow:material('#96dcce',{emissive:'#61b6a8',emissiveIntensity:1.4}),orange:material('#d9956b',{emissive:'#e35c26',emissiveIntensity:.15}),purple:material('#9da7c6'),runner:material('#cdad83'),eye:material('#ffc9a3',{emissive:'#ff702f',emissiveIntensity:2}),gun:material('#24373c',{metalness:.65,roughness:.35}),white:material('#d6e2d9'),bullet:new THREE.MeshBasicMaterial({color:'#ffaf7f'}),heal:material('#6cd4ac',{emissive:'#65dfb6',emissiveIntensity:1.2})};
  function box(parent,x,y,z,w,h,d,mat,shadow=true){const m=new THREE.Mesh(geometry.box,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=shadow;m.receiveShadow=true;parent.add(m);return m;}
  box(scene,0,-.16,0,34,.3,34,materials.floor,false);
  const grid=new THREE.GridHelper(32,32,'#748787','#64777b');grid.position.y=.006;grid.material.transparent=true;grid.material.opacity=.35;scene.add(grid);
  for(const c of COVER){
    box(scene,c.x,c.h/2,c.z,c.w,c.h,c.d,materials.wall);
    box(scene,c.x,c.h+.035,c.z,c.w+.04,.07,c.d+.04,materials.edge);
    if(c.h>3){box(scene,c.x,c.h*.56,c.z+c.d/2+.015,c.w*.5,.07,.03,materials.glow,false);box(scene,c.x-c.w/2-.015,c.h*.56,c.z,.03,.07,c.d*.5,materials.glow,false);}
  }
  for(const side of [-1,1]){
    box(scene,side*16.5,3,0,1,6,34,materials.wall);box(scene,0,3,side*16.5,34,6,1,materials.wall);
    box(scene,side*15.98,.25,0,.025,.05,30,materials.glow,false);box(scene,0,.25,side*15.98,30,.05,.025,materials.glow,false);
    for(const z of [-12,-4,4,12])box(scene,side*15.97,3.2,z,.04,1.8,.1,materials.dark,false);
    for(const x of [-12,-4,4,12])box(scene,x,3.2,side*15.97,.1,1.8,.04,materials.dark,false);
    box(scene,0,1.5,side*15.95,2.4,3,.05,materials.dark,false);
    box(scene,0,2.98,side*15.9,2.2,.06,.06,materials.glow,false);
  }
  // A separate view-model keeps weapon movement independent of world collision.
  const weaponScene=new THREE.Scene(),weaponCamera=new THREE.PerspectiveCamera(76,1,.055,10);
  weaponScene.add(weaponCamera,new THREE.HemisphereLight('#e3eaf1','#77766c',2.4));
  const hand=new THREE.Group();weaponCamera.add(hand);const guns=createWeapons(hand);
  const weaponLight=new THREE.DirectionalLight('#e5efff',2.6),weaponLightTarget=new THREE.Object3D();
  weaponLight.position.set(-1,1.2,.4);weaponLightTarget.position.set(0,-.2,-1);weaponLight.target=weaponLightTarget;weaponScene.add(weaponLight,weaponLightTarget);
  const muzzle=new THREE.Mesh(geometry.sphere,new THREE.MeshBasicMaterial({color:'#c5fff2',transparent:true,opacity:.85}));muzzle.scale.set(.06,.045,.13);muzzle.position.set(0,.02,-.4);hand.add(muzzle);muzzle.visible=false;
  const enemyViews=new Map(),projectileViews=new Map(),pickupViews=new Map(),effects=[];
  const game=new Match();let mode='ready',yaw=0,pitch=0,fire=false,keys=new Set(),last=0,acc=0,recoil=0,flash=0,hitUntil=0,damageUntil=0,noticeUntil=0,muted=false,audio=null,moved=0,dragAim=false,dragging=false,mouseX=0,mouseY=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sights=[{y:.111,tilt:0,z:-.48,fov:60},{y:.149,tilt:.03,z:-.58,fov:64},{y:.207,tilt:0,z:-.58,fov:52}];
  let aimHeld=false,aimToggle=false,aimBlend=0;
  let lookSettings={sensitivity:1,aimSensitivity:.7};
  try{const saved=JSON.parse(localStorage.getItem('crossline-controls')||'{}');for(const [key,min,max]of [['sensitivity',.25,3],['aimSensitivity',.3,1.2]])if(typeof saved[key]==='number'&&Number.isFinite(saved[key]))lookSettings[key]=THREE.MathUtils.clamp(saved[key],min,max);}catch{}
  for(const [id,key]of [['sensitivity','sensitivity'],['aim-sensitivity','aimSensitivity']]){
    const input=$(id),output=$(id+'-value');input.value=lookSettings[key];output.value=lookSettings[key].toFixed(2)+'×';
    input.addEventListener('input',()=>{lookSettings[key]=Number(input.value);output.value=lookSettings[key].toFixed(2)+'×';try{localStorage.setItem('crossline-controls',JSON.stringify(lookSettings));}catch{}});
  }
  function clearAim(){aimHeld=false;aimToggle=false;aimBlend=0;document.body.classList.remove('aiming');}
  function wantsAim(){return mode==='playing'&&(aimHeld||aimToggle)&&!game.reloadAt&&game.time>=game.player.dashUntil;}
  function createEnemy(e){
    const g=new THREE.Group(),armor=e.type==='runner'?materials.runner:e.type==='flanker'?materials.purple:materials.orange;
    const torso=new THREE.Mesh(geometry.body,armor);torso.position.y=1.05;torso.castShadow=true;g.add(torso);
    const head=new THREE.Mesh(geometry.head,materials.dark);head.position.y=1.85;head.castShadow=true;g.add(head);
    const eye=box(g,0,1.88,-.23,.32,.07,.035,materials.eye,false);
    const core=box(g,0,1.13,-.32,.15,.16,.03,materials.eye,false);
    const legs=[box(g,-.17,.3,0,.18,.55,.24,materials.dark),box(g,.17,.3,0,.18,.55,.24,materials.dark)];
    box(g,-.43,1.05,0,.17,.55,.21,armor);box(g,.43,1.05,0,.17,.55,.21,armor);
    box(g,.43,.93,-.2,.14,.13,.45,materials.gun);scene.add(g);return {g,eye,core,legs};
  }
  function sound(kind){
    if(muted)return;
    try{
      audio ||= new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();
      const now=audio.currentTime,o=audio.createOscillator(),gain=audio.createGain();
      o.type=kind==='shot'?'triangle':'sine';const f=kind==='shot'?(game.weapon===1?90:180):kind==='hit'?720:kind==='damage'?95:kind==='loaded'?480:kind==='kill'?940:330;
      o.frequency.setValueAtTime(f,now);o.frequency.exponentialRampToValueAtTime(Math.max(35,f*.38),now+.1);gain.gain.setValueAtTime(kind==='shot'?.12:.055,now);gain.gain.exponentialRampToValueAtTime(.001,now+.14);o.connect(gain);gain.connect(audio.destination);o.start();o.stop(now+.15);
      if(kind==='shot'){
        const length=Math.floor(audio.sampleRate*.08),buffer=audio.createBuffer(1,length,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);
        const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),g=audio.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=game.weapon===1?700:1800;g.gain.value=.1;source.connect(filter);filter.connect(g);g.connect(audio.destination);source.start();
      }
    }catch{}
  }
  function showMenu(title,copy,label){clearAim();$('overlay-title').textContent=title;$('overlay-copy').textContent=copy;start.textContent=label;overlay.hidden=false;document.body.classList.add('menu-open');document.body.classList.remove('playing');$('restart').hidden=mode!=='paused';$('pause').disabled=true;keys.clear();fire=false;}
  function pauseGame(){if(mode==='playing'){mode='paused';dragging=false;showMenu('Paused','', 'Resume');if(document.pointerLockElement===canvas)document.exitPointerLock();}}
  function clearEffects(){for(const e of effects){scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();}effects.length=0;}
  function newRound(){game.reset();clearAim();yaw=0;pitch=0;acc=0;recoil=0;hitUntil=0;damageUntil=0;clearEffects();}
  async function enter(){
    if(mode==='ready'||mode==='finished')newRound();
    if(!canvas.requestPointerLock){begin(true);return;}
    try{await canvas.requestPointerLock();}catch{begin(true);}
  }
  function begin(fallback=false){
    if(mode==='playing')return;
    dragAim=fallback;dragging=false;mode='playing';overlay.hidden=true;document.body.classList.remove('menu-open');document.body.classList.add('playing');$('pause').disabled=false;acc=0;last=performance.now();canvas.focus();sound('loaded');
    document.querySelector('.menu-note').textContent=fallback?'Right-drag to look. Q toggles sights. Esc pauses.':'Hold right click to aim, or toggle with Q. Esc pauses.';
    $('aim-key').textContent=fallback?'Q':'RMB / Q';
    if(fallback){$('notice').textContent='Right-drag to look · Q to aim';noticeUntil=game.time+6;}
  }
  document.addEventListener('pointerlockchange',()=>{
    if(document.pointerLockElement===canvas)begin();
    else if(!dragAim)pauseGame();
  });
  document.addEventListener('pointerlockerror',()=>{begin(true);});
  start.addEventListener('click',enter);$('restart').addEventListener('click',()=>{mode='ready';enter();});$('pause').addEventListener('click',pauseGame);
  $('sound').addEventListener('click',()=>{muted=!muted;$('sound').textContent=muted?'Sound off':'Sound on';$('sound').setAttribute('aria-pressed',String(!muted));});
  document.addEventListener('mousemove',e=>{
    if(mode==='playing'&&(document.pointerLockElement===canvas||(dragAim&&dragging))){const dx=dragAim?e.clientX-mouseX:e.movementX,dy=dragAim?e.clientY-mouseY:e.movementY;const zoomScale=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.tan(THREE.MathUtils.degToRad(38)),speed=.0021*lookSettings.sensitivity*THREE.MathUtils.lerp(1,lookSettings.aimSensitivity,aimBlend)*zoomScale;yaw-=dx*speed;pitch=THREE.MathUtils.clamp(pitch-dy*speed,-1.35,1.35);}
    mouseX=e.clientX;mouseY=e.clientY;
  });
  canvas.addEventListener('mousedown',e=>{if(mode!=='playing')return;canvas.focus();if(e.button===0)fire=true;if(e.button===2){if(dragAim){dragging=true;mouseX=e.clientX;mouseY=e.clientY;}else{aimHeld=true;aimToggle=false;}}});window.addEventListener('mouseup',e=>{if(e.button===0)fire=false;if(e.button===2){dragging=false;aimHeld=false;}});canvas.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('keydown',e=>{
    if(mode!=='playing'||e.ctrlKey||e.metaKey||e.altKey)return;
    const k=e.key.toLowerCase();if(['w','a','s','d',' ','shift','r','q','1','2','3','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();keys.add(k);
    if(k==='q'&&!e.repeat){aimToggle=!(aimToggle||aimHeld);aimHeld=false;}
    if(k==='r'&&!e.repeat)game.reload();if(['1','2','3'].includes(k)&&!e.repeat)game.select(Number(k)-1);
    if(k==='escape'||k==='p')pauseGame();
  });
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',pauseGame);document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});
  function spark(position,color,count=5){
    for(let i=0;i<count;i++){
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(.055,.055,.055),new THREE.MeshBasicMaterial({color,transparent:true}));mesh.position.copy(position);scene.add(mesh);
      effects.push({mesh,until:game.time+.35,life:.35,velocity:new THREE.Vector3((Math.random()-.5)*3,Math.random()*2,(Math.random()-.5)*3)});
    }
  }
  function handleEvents(){for(const e of game.events.splice(0)){
    if(e.type==='shot'){
      recoil=Math.min(.13,recoil+(game.weapon===1?.1:.045));flash=game.time+.045;sound('shot');
      camera.updateMatrixWorld();const origin=camera.localToWorld(hand.localToWorld(guns[game.weapon].userData.muzzle.clone()));
      for(const t of e.traces){
        const end=new THREE.Vector3(t.x,t.y,t.z),line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin,end]),new THREE.LineBasicMaterial({color:t.hit?'#baffdf':'#c9e7dc',transparent:true,opacity:.42}));scene.add(line);effects.push({mesh:line,until:game.time+.045,life:.045});spark(end,t.hit?'#f6c79c':'#becfc7',t.hit?3:1);
      }
      if(e.hits){hitUntil=game.time+.12;sound('hit');}
    }
    if(e.type==='kill'){spark(new THREE.Vector3(e.x,1,e.z),'#e5c29d',10);sound('kill');}
    if(e.type==='damage'){damageUntil=game.time+.2;sound('damage');}
    if(e.type==='wave'){if(game.time>=noticeUntil){$('notice').textContent=`Wave ${e.wave}`;noticeUntil=game.time+2;}}
    if(e.type==='heal'){$('notice').textContent='Health restored';noticeUntil=game.time+1.1;sound('loaded');}
    if(e.type==='loaded'||e.type==='reload'||e.type==='switch')sound(e.type);
  }}
  function draw(dt){
    const p=game.player;if(mode==='playing')moved+=dt*Math.hypot((keys.has('w')?1:0)-(keys.has('s')?1:0),(keys.has('a')?1:0)-(keys.has('d')?1:0));
    camera.position.set(p.x,1.65+p.y,p.z);camera.rotation.set(pitch,yaw,0);
    const sight=sights[game.weapon],target=wantsAim()?1:0;
    aimBlend=reduced?target:THREE.MathUtils.lerp(aimBlend,target,1-Math.exp(-dt*18));
    if(Math.abs(aimBlend-target)<.001)aimBlend=target;
    document.body.classList.toggle('aiming',aimBlend>.7);
    const fov=THREE.MathUtils.lerp(76,sight.fov,aimBlend);if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
    recoil=Math.max(0,recoil-dt*.5);const bob=(reduced?0:.008)*(1-aimBlend*.9),kick=recoil*(1-aimBlend*.6);
    hand.position.set(.23*(1-aimBlend)+Math.sin(moved*9)*bob,THREE.MathUtils.lerp(-.24,-sight.y,aimBlend)+Math.abs(Math.cos(moved*9))*bob-kick*.25,THREE.MathUtils.lerp(-.61,sight.z,aimBlend)+kick);hand.rotation.x=kick*.9+sight.tilt*aimBlend;hand.rotation.y=.07*(1-aimBlend);
    if(game.reloadAt){const t=1-(game.reloadAt-game.time)/WEAPONS[game.weapon].reload;hand.rotation.z=-Math.sin(t*Math.PI)*.6;hand.position.y-=Math.sin(t*Math.PI)*.16;}else hand.rotation.z=0;
    guns.forEach((g,i)=>{g.visible=i===game.weapon;if(g.visible)animateWeapon(g,i,recoil);});muzzle.position.copy(guns[game.weapon].userData.muzzle);muzzle.visible=mode==='playing'&&game.time<flash;
    const alive=new Set(game.enemies.map(e=>e.id));for(const [id,v]of enemyViews)if(!alive.has(id)){scene.remove(v.g);enemyViews.delete(id);}
    for(const e of game.enemies){let v=enemyViews.get(e.id);if(!v){v=createEnemy(e);enemyViews.set(e.id,v);}v.g.position.set(e.x,0,e.z);v.g.rotation.y=Math.atan2(game.player.x-e.x,game.player.z-e.z)+Math.PI;v.legs[0].rotation.x=Math.sin(game.time*7+e.id)*.15;v.legs[1].rotation.x=-v.legs[0].rotation.x;v.core.scale.set(e.charging?.24:.15,e.charging?.24:.16,.03);v.eye.visible=game.time>e.hit||Math.floor(game.time*40)%2===0;}
    syncObjects(game.projectiles,projectileViews,()=>{const m=new THREE.Mesh(geometry.sphere,materials.bullet);m.scale.setScalar(.11);return m;},(m,b)=>m.position.set(b.x,b.y,b.z));
    syncObjects(game.pickups,pickupViews,()=>{const g=new THREE.Group();box(g,0,0,0,.35,.1,.12,materials.heal,false);box(g,0,0,0,.1,.35,.12,materials.heal,false);return g;},(m,b)=>{m.position.set(b.x,.65+Math.sin(game.time*2)*.06,b.z);m.rotation.y=game.time*.8;});
    for(let i=effects.length-1;i>=0;i--){const e=effects[i];if(game.time>e.until){scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();effects.splice(i,1);}else{e.mesh.material.opacity=Math.max(0,(e.until-game.time)/e.life);if(e.velocity&&mode==='playing'){e.mesh.position.addScaledVector(e.velocity,dt);e.velocity.y-=5*dt;}}}
    $('health').textContent=Math.ceil(p.hp);$('health-bar').style.width=`${p.hp}%`;$('health-bar').style.background=p.hp<30?'#e99a7d':'#8ed7ca';
    $('wave').textContent=`Wave ${game.wave}`;$('score').textContent=`${game.score} pts`;const seconds=Math.max(0,Math.ceil(180-game.time));$('remaining').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
    $('weapon-name').textContent=WEAPONS[game.weapon].name.toUpperCase();$('ammo').textContent=game.ammo[game.weapon];$('magazine').textContent=`/ ${WEAPONS[game.weapon].size}`;$('reload-status').textContent=game.reloadAt?'Reloading':!game.ammo[game.weapon]?'R to reload':'';
    document.querySelectorAll('[data-weapon]').forEach(n=>n.classList.toggle('selected',Number(n.dataset.weapon)===game.weapon));
    $('hit').classList.toggle('visible',game.time<hitUntil);$('damage').style.opacity=game.time<damageUntil?'1':'0';if(game.time>noticeUntil)$('notice').textContent='';
    renderer.render(scene,camera);renderer.autoClear=false;renderer.clearDepth();renderer.render(weaponScene,weaponCamera);renderer.autoClear=true;
  }
  function syncObjects(items,views,make,update){const present=new Set(items);for(const [item,mesh]of views)if(!present.has(item)){scene.remove(mesh);views.delete(item);}for(const item of items){let mesh=views.get(item);if(!mesh){mesh=make();scene.add(mesh);views.set(item,mesh);}update(mesh,item);}}
  function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();weaponCamera.aspect=w/h;weaponCamera.updateProjectionMatrix();}
  window.addEventListener('resize',resize);resize();
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();pauseGame();$('overlay-copy').textContent='Graphics paused. Reload the page to restore the arena.';start.disabled=true;});
  function frame(now){const dt=Math.min(.05,(now-(last||now))/1000);last=now;
    if(mode==='playing'){
      acc+=dt;while(acc>=1/60){game.step(1/60,{yaw,pitch,forward:Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown')),right:Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),fire,jump:keys.has(' '),dash:keys.has('shift')});acc-=1/60;}handleEvents();
      if(game.result){mode='finished';if(document.pointerLockElement===canvas)document.exitPointerLock();showMenu(game.result==='won'?'Survived':'Round over',`${game.kills} eliminations · ${game.score} points`,'Play again');}
    }
    draw(dt);requestAnimationFrame(frame);
  }
  start.disabled=false;start.textContent='Play';if(matchMedia('(pointer:coarse)').matches)$('device-note').hidden=false;
  requestAnimationFrame(frame);
}
