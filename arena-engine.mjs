export const COVER = [
  {x:-6,z:-6,w:2.4,d:2.4,h:4}, {x:6,z:-6,w:2.4,d:2.4,h:4},
  {x:-6,z:6,w:2.4,d:2.4,h:4}, {x:6,z:6,w:2.4,d:2.4,h:4},
  {x:0,z:0,w:4,d:2,h:1.25}, {x:-11,z:0,w:1.5,d:7,h:2.5}, {x:11,z:0,w:1.5,d:7,h:2.5},
  {x:-2.5,z:-10,w:4,d:1.4,h:1.15}, {x:3,z:9,w:3.5,d:1.4,h:1.15},
  {x:-11,z:10,w:2,d:2,h:1.8}, {x:11,z:-11,w:2,d:2,h:1.8}
];
export const WEAPONS=[
  {name:'Sidearm',size:12,damage:34,interval:.26,reload:1.05,pellets:1,spread:.004,range:60},
  {name:'Scatter',size:6,damage:16,interval:.72,reload:1.5,pellets:8,spread:.065,range:24},
  {name:'Pulse',size:28,damage:15,interval:.095,reload:1.35,pellets:1,spread:.014,range:50}
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function rayBox(o,d,b,max=100){
  let lo=0,hi=max;
  for(const k of ['x','y','z']){
    if(Math.abs(d[k])<1e-8){if(o[k]<b.min[k]||o[k]>b.max[k])return Infinity;continue;}
    let a=(b.min[k]-o[k])/d[k],c=(b.max[k]-o[k])/d[k];if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(lo>hi)return Infinity;
  }return lo;
}
export function raySphere(o,d,c,r){
  const x=o.x-c.x,y=o.y-c.y,z=o.z-c.z,b=x*d.x+y*d.y+z*d.z,t=b*b-x*x-y*y-z*z+r*r;
  return t<0?Infinity:(-b-Math.sqrt(t)>=0?-b-Math.sqrt(t):Infinity);
}
const boxes=COVER.map(c=>({min:{x:c.x-c.w/2,y:0,z:c.z-c.d/2},max:{x:c.x+c.w/2,y:c.h,z:c.z+c.d/2}}));
boxes.push(
  {min:{x:-17,y:0,z:-17},max:{x:-16,y:7,z:17}}, {min:{x:16,y:0,z:-17},max:{x:17,y:7,z:17}},
  {min:{x:-17,y:0,z:-17},max:{x:17,y:7,z:-16}}, {min:{x:-17,y:0,z:16},max:{x:17,y:7,z:17}}
);
export function wallDistance(o,d,max=100){return Math.min(max,...boxes.map(b=>rayBox(o,d,b,max)));}
export function blocked(x,z,r=.36){return Math.abs(x)>16-r||Math.abs(z)>16-r||COVER.some(c=>Math.abs(x-c.x)<c.w/2+r&&Math.abs(z-c.z)<c.d/2+r);}
export function move(entity,dx,dz,r=.36){if(!blocked(entity.x+dx,entity.z,r))entity.x+=dx;if(!blocked(entity.x,entity.z+dz,r))entity.z+=dz;}
function nextPoint(x,z,tx,tz){
  const sx=Math.floor(x)+16,sz=Math.floor(z)+16,gx=clamp(Math.floor(tx)+16,0,31),gz=clamp(Math.floor(tz)+16,0,31);
  const start=sz*32+sx,goal=gz*32+gx,queue=[start],seen=new Set([start]),parent=new Map();let reached=start;
  for(let i=0;i<queue.length;i++){
    const cell=queue[i],cx=cell%32,cz=Math.floor(cell/32);reached=cell;if(cell===goal)break;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=cx+dx,nz=cz+dz,n=nz*32+nx;
      if(nx<0||nz<0||nx>31||nz>31||seen.has(n)||blocked(nx-15.5,nz-15.5,.4))continue;
      seen.add(n);parent.set(n,cell);queue.push(n);
    }
  }
  if(!seen.has(goal))return {x,z};reached=goal;
  while(parent.has(reached)&&parent.get(reached)!==start)reached=parent.get(reached);
  return {x:reached%32-15.5,z:Math.floor(reached/32)-15.5};
}
export class Match {
  constructor(random=Math.random){this.random=random;this.reset();}
  reset(){
    this.time=0;this.wave=0;this.kills=0;this.score=0;this.id=0;this.pending=0;this.spawnAt=0;this.nextWave=0;this.result=null;
    this.player={x:0,z:12,hp:100,y:0,vy:0,invulnerable:0,dash:0,dashUntil:0};
    this.weapon=0;this.ammo=WEAPONS.map(w=>w.size);this.reloadAt=0;this.fireAt=0;this.enemies=[];this.projectiles=[];this.pickups=[];this.events=[];this.startWave();
  }
  startWave(){this.wave++;this.pending=Math.min(3+this.wave,9);this.spawnAt=this.time+.7;this.nextWave=0;this.player.hp=Math.min(100,this.player.hp+(this.wave>1?20:0));this.events.push({type:'wave',wave:this.wave});}
  spawn(){
    const points=[[0,-13],[-13,-12],[13,-8],[-13,7],[12,12],[0,13],[8,-13],[-8,-13]],p=this.player;
    const candidates=points.filter(([x,z])=>Math.hypot(x-p.x,z-p.z)>9&&!this.enemies.some(e=>Math.hypot(e.x-x,e.z-z)<2));
    const [x,z]=(candidates.length?candidates:points)[Math.floor(this.random()*(candidates.length||points.length))];
    const type=this.id%3===2?'runner':this.id%3===1?'flanker':'ranger';
    this.enemies.push({id:++this.id,x,z,hp:type==='runner'?65:85,type,fireAt:this.time+1.2,charging:0,navAt:0,target:{x,z},side:this.random()<.5?-1:1,hit:0});this.pending--;
  }
  select(i){if(i<0||i>=WEAPONS.length||i===this.weapon)return;this.weapon=i;this.reloadAt=0;this.fireAt=Math.max(this.fireAt,this.time+.16);this.events.push({type:'switch'});}
  reload(){const w=WEAPONS[this.weapon];if(!this.reloadAt&&this.ammo[this.weapon]<w.size){this.reloadAt=this.time+w.reload;this.events.push({type:'reload'});}}
  shoot(yaw,pitch){
    const w=WEAPONS[this.weapon];if(this.result||this.reloadAt||this.time<this.fireAt)return;
    if(!this.ammo[this.weapon]){this.reload();return;}
    this.ammo[this.weapon]--;this.fireAt=this.time+w.interval;
    const o={x:this.player.x,y:1.65+this.player.y,z:this.player.z},traces=[];let hits=0,head=false;
    for(let n=0;n<w.pellets;n++){
      const ya=yaw+(this.random()-.5)*w.spread*2,pi=pitch+(this.random()-.5)*w.spread*2;
      const d={x:-Math.sin(ya)*Math.cos(pi),y:Math.sin(pi),z:-Math.cos(ya)*Math.cos(pi)};
      let dist=wallDistance(o,d,w.range),target=null,headshot=false;
      for(const e of this.enemies){
        if(e.hp<=0)continue;
        const body=rayBox(o,d,{min:{x:e.x-.36,y:.25,z:e.z-.36},max:{x:e.x+.36,y:1.55,z:e.z+.36}},w.range);
        const skull=raySphere(o,d,{x:e.x,y:1.85,z:e.z},.3),t=Math.min(body,skull);
        if(t<dist){dist=t;target=e;headshot=skull<body;}
      }
      if(target){
        hits++;head ||= headshot;target.hp-=w.damage*(headshot?1.7:1);target.hit=this.time+.09;
        if(target.hp<=0){this.kills++;this.score+=headshot?150:100;this.events.push({type:'kill',x:target.x,z:target.z,color:target.type});if(this.random()<.4)this.pickups.push({x:target.x,z:target.z,until:this.time+15});}
      }
      traces.push({x:o.x+d.x*dist,y:o.y+d.y*dist,z:o.z+d.z*dist,hit:!!target});
    }
    this.events.push({type:'shot',weapon:this.weapon,traces,hits,head});
  }
  damage(amount){const p=this.player;if(this.time<p.invulnerable||this.result)return;p.hp=Math.max(0,p.hp-amount);p.invulnerable=this.time+.22;this.events.push({type:'damage'});}
  step(dt,input={}){
    if(this.result)return;this.time+=dt;
    const p=this.player,yaw=input.yaw||0;
    if(input.jump&&p.y===0){p.vy=5.6;}
    p.vy-=17*dt;p.y=Math.max(0,p.y+p.vy*dt);if(!p.y)p.vy=0;
    if(input.dash&&this.time>=p.dash){p.dashUntil=this.time+.18;p.dash=this.time+1.6;this.events.push({type:'dash'});}
    let dx=(input.right||0)*Math.cos(yaw)-(input.forward||0)*Math.sin(yaw),dz=-(input.right||0)*Math.sin(yaw)-(input.forward||0)*Math.cos(yaw);
    const len=Math.hypot(dx,dz);if(len){const speed=this.time<p.dashUntil?12:4.6;move(p,dx/len*speed*dt,dz/len*speed*dt);}
    if(this.reloadAt&&this.time>=this.reloadAt){this.ammo[this.weapon]=WEAPONS[this.weapon].size;this.reloadAt=0;this.events.push({type:'loaded'});}
    if(input.fire)this.shoot(yaw,input.pitch||0);
    this.enemies=this.enemies.filter(e=>e.hp>0);
    if(this.pending&&this.time>=this.spawnAt&&this.enemies.length<6){this.spawn();this.spawnAt=this.time+1.3;}
    for(const e of this.enemies){
      const ex=p.x-e.x,ez=p.z-e.z,distance=Math.hypot(ex,ez)||.001,dir={x:ex/distance,y:0,z:ez/distance};
      const visible=wallDistance({x:e.x,y:1.4,z:e.z},dir,distance+.1)>=distance;
      if(e.type==='runner'&&distance<1.25&&visible){if(this.time>=e.fireAt){this.damage(16);e.fireAt=this.time+.85;}}
      else{
        let tx=p.x,tz=p.z;
        if(visible&&distance<12&&e.type!=='runner'){
          const retreat=distance<5?-1:distance>9?1:0;
          tx=e.x+dir.x*retreat-dir.z*e.side*.8;tz=e.z+dir.z*retreat+dir.x*e.side*.8;
        }else if(!visible){if(this.time>e.navAt){e.target=nextPoint(e.x,e.z,p.x,p.z);e.navAt=this.time+.45;}tx=e.target.x;tz=e.target.z;}
        const mx=tx-e.x,mz=tz-e.z,l=Math.hypot(mx,mz),speed=(e.type==='runner'?2.7:e.type==='flanker'?2:1.65)*Math.min(1.45,1+this.wave*.035);
        if(l>.1)move(e,mx/l*speed*dt,mz/l*speed*dt,.4);
      }
      if(e.type!=='runner'&&visible&&distance<24){
        if(!e.charging&&this.time>=e.fireAt)e.charging=this.time+.55;
        if(e.charging&&this.time>=e.charging){
          const target={x:p.x+(this.random()-.5)*.65,y:1.1+p.y,z:p.z+(this.random()-.5)*.65},dx=target.x-e.x,dy=target.y-1.4,dz=target.z-e.z,l=Math.hypot(dx,dy,dz);
          this.projectiles.push({x:e.x,y:1.4,z:e.z,dx:dx/l,dy:dy/l,dz:dz/l,until:this.time+4});
          e.charging=0;e.fireAt=this.time+Math.max(.8,2.3-this.wave*.12);this.events.push({type:'enemyshot'});
        }
      }else e.charging=0;
    }
    for(const b of this.projectiles){
      const d={x:b.dx,y:b.dy,z:b.dz},travel=12*dt,wall=wallDistance(b,d,travel);
      const hit=rayBox(b,d,{min:{x:p.x-.32,y:p.y+.15,z:p.z-.32},max:{x:p.x+.32,y:p.y+1.85,z:p.z+.32}},travel);
      if(hit<=travel&&hit<wall){this.damage(9);b.until=0;}else if(wall<travel)b.until=0;
      b.x+=b.dx*travel;b.y+=b.dy*travel;b.z+=b.dz*travel;
    }
    this.projectiles=this.projectiles.filter(b=>b.until>this.time);
    this.pickups=this.pickups.filter(c=>{if(Math.hypot(c.x-p.x,c.z-p.z)<.85){p.hp=Math.min(100,p.hp+18);this.events.push({type:'heal'});return false;}return c.until>this.time;});
    if(!this.pending&&!this.enemies.length&&!this.nextWave)this.nextWave=this.time+3;
    if(this.nextWave&&this.time>=this.nextWave)this.startWave();
    if(!p.hp)this.result='lost';else if(this.time>=180)this.result='won';
  }
}
