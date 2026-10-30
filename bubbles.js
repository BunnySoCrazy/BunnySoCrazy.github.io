import {Arena,COLS,ROWS,isSplashActive} from './bubbles-engine.mjs?v=blast2';

const canvas=document.getElementById('board'),ctx=canvas.getContext('2d');
const game=new Arena(),unit=60;
const overlay=document.getElementById('overlay'),play=document.getElementById('play'),pause=document.getElementById('pause');
const feedback=document.getElementById('feedback'),status=document.getElementById('status-label');
let mode='ready',last=0,accumulator=0,held=[],muted=true,audio=null,noticeUntil=0,lastHud='';
const directions={ArrowUp:[0,-1],w:[0,-1],ArrowLeft:[-1,0],a:[-1,0],ArrowDown:[0,1],s:[0,1],ArrowRight:[1,0],d:[1,0]};
const palette=()=>document.documentElement.dataset.theme==='dark'
  ?{floor:'#111b28',grid:'#1a2735',wall:'#243444',wallTop:'#314858',crate:'#576267',crateTop:'#738080',line:'#8b9b99',ink:'#e2f1ed',water:'#7edbdc'}
  :{floor:'#e8ece3',grid:'#dce3d8',wall:'#b6c7bf',wallTop:'#d0dcd4',crate:'#b7ab91',crateTop:'#d7cbb0',line:'#eee4ce',ink:'#264b48',water:'#439fa6'};
const colors=['#64bbae','#e3a08c','#a79ed4'];
function round(x,y,w,h,r,fill,stroke) {
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.2;ctx.stroke();}
}
function circle(x,y,r,fill,stroke,width=1) {
  ctx.beginPath();ctx.arc(x,y,Math.max(.1,r),0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.lineWidth=width;ctx.strokeStyle=stroke;ctx.stroke();}
}
function bubble(x,y,r,progress=0) {
  const gradient=ctx.createRadialGradient(x-r*.35,y-r*.4,1,x,y,r);
  gradient.addColorStop(0,'rgba(238,255,255,.85)');gradient.addColorStop(.32,'rgba(148,226,226,.4)');gradient.addColorStop(.8,'rgba(92,184,197,.25)');gradient.addColorStop(1,'rgba(123,220,227,.7)');
  circle(x,y,r,gradient,'rgba(155,234,236,.95)',1.4);
  ctx.beginPath();ctx.arc(x,y,r*.73,Math.PI*1.1,Math.PI*1.5);ctx.lineWidth=2.5;ctx.strokeStyle='rgba(255,255,255,.8)';ctx.stroke();
  if(progress){ctx.beginPath();ctx.arc(x,y,r+4,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);ctx.strokeStyle='#79bdbb';ctx.lineWidth=2;ctx.stroke();}
}
function render() {
  const p=palette();ctx.clearRect(0,0,780,660);ctx.fillStyle=p.floor;ctx.fillRect(0,0,780,660);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++) {
    const bx=x*unit,by=y*unit,t=game.map[y][x];
    if((x+y)%2===0){ctx.fillStyle=p.grid;ctx.globalAlpha=.38;ctx.fillRect(bx,by,unit,unit);ctx.globalAlpha=1;}
    if(t===1){round(bx+5,by+8,50,48,8,p.wall);round(bx+5,by+4,50,44,8,p.wallTop);ctx.fillStyle=p.wall;ctx.globalAlpha=.5;ctx.fillRect(bx+20,by+21,20,2);ctx.globalAlpha=1;}
    if(t===2){round(bx+8,by+12,44,42,5,p.crate);round(bx+8,by+6,44,42,5,p.crateTop);round(bx+15,by+13,30,28,2,null,p.line);ctx.strokeStyle=p.line;ctx.beginPath();ctx.moveTo(bx+15,by+13);ctx.lineTo(bx+45,by+41);ctx.moveTo(bx+45,by+13);ctx.lineTo(bx+15,by+41);ctx.stroke();}
  }
  for(const d of game.drops){const x=d.x*unit+30,y=d.y*unit+30;circle(x,y,15,p.wallTop,p.water);ctx.fillStyle=p.ink;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 18px system-ui';ctx.fillText(d.type==='reach'?'+':d.type==='capacity'?'Ⅱ':'»',x,y);}
  for(const s of game.splashes){
    const active=isSplashActive(s,game.time),k=(game.time-s.born)/(s.until-s.born);
    const fade=active?1:Math.max(0,(s.until-game.time)/(s.until-s.harmfulUntil));
    for(const [x,y]of s.cells){
      // Solid water is dangerous; the fading outline is only a harmless after-effect.
      if(active){ctx.globalAlpha=.58;round(x*unit+2,y*unit+2,56,56,14,p.water);}
      ctx.globalAlpha=active?.85:.3*fade;
      circle(x*unit+30,y*unit+30,12+k*17,null,p.water,active?2.5:1.3);
      ctx.globalAlpha=1;
    }
  }
  for(const b of game.bombs){const progress=Math.min(1,(game.time-b.born)/2.2),r=18+Math.sin(progress*18)*1.7;circle(b.x*unit+31,b.y*unit+40,18,'rgba(14,40,42,.09)');bubble(b.x*unit+30,b.y*unit+29,r,progress);}
  for(const a of game.actors){
    if(!a.alive)continue;
    const k=Math.min(1,(game.time-a.moved)/.11),x=(a.px+(a.x-a.px)*k)*unit+30,y=(a.py+(a.y-a.py)*k)*unit+29;
    ctx.globalAlpha=a.shield>game.time&&mode==='playing'?.65:1;
    ctx.save();ctx.translate(x,y);ctx.scale(1, .35);circle(0,43,18,'rgba(15,40,44,.16)');ctx.restore();
    round(x-15,y-13,30,33,13,colors[a.id]);
    circle(x-7,y-9,5,'rgba(255,255,255,.3)');circle(x-5,y+1,2.1,'#203f42');circle(x+6,y+1,2.1,'#203f42');
    ctx.beginPath();ctx.arc(x+1,y+7,4,0,Math.PI);ctx.strokeStyle='#2d5658';ctx.lineWidth=1.3;ctx.stroke();
    round(x-13,y+17,10,5,2,colors[a.id]);round(x+4,y+17,10,5,2,colors[a.id]);ctx.globalAlpha=1;
    if(a.id===0){circle(x,y-23,2.5,p.ink);}
    if(a.trapped){bubble(x,y,27);ctx.beginPath();ctx.arc(x,y,31,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,(a.trapped-game.time)/2.4));ctx.strokeStyle=colors[a.id];ctx.lineWidth=3;ctx.stroke();}
  }
}
function tone(type) {
  if(muted)return;
  try{
    audio ||= new (window.AudioContext||window.webkitAudioContext)();
    if(audio.state==='suspended')audio.resume();
    const o=audio.createOscillator(),g=audio.createGain(),now=audio.currentTime;
    o.type='sine';o.frequency.setValueAtTime(type==='pop'?250:type==='upgrade'?680:440,now);o.frequency.exponentialRampToValueAtTime(type==='pop'?70:880,now+.12);g.gain.setValueAtTime(.045,now);g.gain.exponentialRampToValueAtTime(.001,now+.17);o.connect(g);g.connect(audio.destination);o.start();o.stop(now+.18);
  }catch{}
}
function notice(text){feedback.textContent=text;noticeUntil=game.time+3;}
function hud(){
  const a=game.actors[0],seconds=Math.ceil(game.remaining),rivals=game.actors.slice(1).filter(a=>a.alive).length;
  document.getElementById('clock').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  document.getElementById('power').textContent=`Bubbles ${a.capacity} · Reach ${a.reach}`;
  const label=a.trapped?'Trapped — tap to escape':`${rivals} rival${rivals===1?'':'s'} remaining`;
  if(label!==lastHud){status.textContent=label;lastHud=label;}
  if(a.trapped)feedback.textContent=`Tap Space / Bubble · ${Math.max(0,4-a.taps)} to escape`;
  else if(game.time>noticeUntil)feedback.textContent='';
}
function show(title,copy,label){
  const heading=document.getElementById('overlay-title'),description=document.getElementById('overlay-copy');
  heading.textContent=title;heading.hidden=!title;description.textContent=copy;description.hidden=!copy;play.textContent=label;overlay.hidden=false;held=[];play.focus({preventScroll:true});
}
function start(){game.reset();mode='playing';accumulator=0;noticeUntil=0;lastHud='';overlay.hidden=true;pause.disabled=false;pause.textContent='Pause';held=[];hud();canvas.focus({preventScroll:true});tone('start');}
function togglePause(){
  if(mode==='playing'){mode='paused';pause.textContent='Resume';show('Paused','','Resume');}
  else if(mode==='paused'){mode='playing';overlay.hidden=true;pause.textContent='Pause';accumulator=0;canvas.focus({preventScroll:true});}
}
function finish(){
  mode='finished';pause.disabled=true;
  const result=game.result;
  show(result==='won'?'You win':result==='lost'?'Game over':'Draw','','Play again');
}
function action(){if(mode==='playing'){game.action();hud();}}
function frame(now){
  const dt=Math.min(.08,(now-(last||now))/1000);last=now;
  if(mode==='playing'){
    accumulator+=dt;
    while(accumulator>=1/60){game.step(1/60,held.length?directions[held[held.length-1]]:null);accumulator-=1/60;}
    for(const e of game.events.splice(0)){
      if(e.type==='pop'||e.type==='place')tone(e.type);
      if(e.type==='upgrade'){notice(e.upgrade==='reach'?'Reach increased':e.upgrade==='capacity'?'Bubble capacity increased':'Speed increased');tone('upgrade');}
      if(e.type==='escape'){notice('Escaped');tone('upgrade');}
    }
    hud();if(game.result)finish();
  }
  render();requestAnimationFrame(frame);
}
play.addEventListener('click',()=>mode==='paused'?togglePause():start());
pause.addEventListener('click',togglePause);
document.getElementById('restart').addEventListener('click',start);
document.getElementById('sound').addEventListener('click',event=>{muted=!muted;event.currentTarget.textContent=muted?'Sound off':'Sound on';event.currentTarget.setAttribute('aria-pressed',String(!muted));tone('start');});
window.addEventListener('keydown',e=>{
  const k=e.key.length===1?e.key.toLowerCase():e.key;
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(k==='p'||k==='Escape'){if(mode==='playing'||mode==='paused'){e.preventDefault();if(!e.repeat)togglePause();}return;}
  if(mode!=='playing'||e.target.closest('button,a'))return;
  if(directions[k]){e.preventDefault();if(!held.includes(k))held.push(k);}
  if(k===' '){e.preventDefault();if(!e.repeat)action();}
});
window.addEventListener('keyup',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;held=held.filter(h=>h!==k);});
const touchKeys={up:'w',left:'a',down:'s',right:'d'};
document.querySelectorAll('[data-dir]').forEach(button=>{
  const k=touchKeys[button.dataset.dir];
  button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);if(mode==='playing'&&!held.includes(k))held.push(k);});
  const clear=()=>{held=held.filter(h=>h!==k);};
  button.addEventListener('pointerup',clear);button.addEventListener('pointercancel',clear);button.addEventListener('lostpointercapture',clear);
});
document.getElementById('drop').addEventListener('pointerdown',e=>{e.preventDefault();action();});
document.getElementById('drop').addEventListener('click',e=>{if(e.detail===0)action();});
window.addEventListener('blur',()=>{held=[];if(mode==='playing')togglePause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')togglePause();});
requestAnimationFrame(frame);
