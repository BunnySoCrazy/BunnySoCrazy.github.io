export const COLS = 13, ROWS = 11;
export const DIRS = [[0,-1],[-1,0],[0,1],[1,0]];
export const SPLASH_ACTIVE = .28, SPLASH_VISUAL = .46;
export const isSplashActive = (s,time) => time>=s.born&&time<s.harmfulUntil;
const key = (x,y) => `${x},${y}`;

export class Arena {
  constructor(random = Math.random) { this.random = random; this.reset(); }
  reset() {
    this.time=0; this.remaining=150; this.result=null; this.bombs=[]; this.splashes=[]; this.drops=[]; this.events=[];
    this.actors=[this.actor(0,1,1),this.actor(1,11,9),this.actor(2,11,1)];
    this.map=Array.from({length:ROWS},(_,y)=>Array.from({length:COLS},(_,x)=>{
      if(x===0||y===0||x===COLS-1||y===ROWS-1||(x%2===0&&y%2===0)) return 1;
      if(this.actors.some(a=>Math.abs(a.x-x)<=2&&Math.abs(a.y-y)<=2)) return 0;
      return this.random()<.61?2:0;
    }));
  }
  actor(id,x,y) { return {id,x,y,px:x,py:y,moved:-1,next:0,alive:true,capacity:1,reach:2,speed:.16,trapped:0,taps:0,shield:1}; }
  cells(x,y,reach) {
    const cells=[[x,y]];
    for(const [dx,dy] of DIRS) for(let i=1;i<=reach;i++) {
      const nx=x+dx*i,ny=y+dy*i,t=this.map[ny]?.[nx];
      if(t===undefined||t===1) break;
      cells.push([nx,ny]); if(t===2) break;
    }
    return cells;
  }
  hazards(extra) {
    const danger=new Set();
    for(const b of extra?[...this.bombs,extra]:this.bombs) for(const [x,y] of this.cells(b.x,b.y,b.reach)) danger.add(key(x,y));
    for(const s of this.splashes) if(isSplashActive(s,this.time)) for(const [x,y] of s.cells) danger.add(key(x,y));
    return danger;
  }
  passable(x,y) { return this.map[y]?.[x]===0&&!this.bombs.some(b=>b.x===x&&b.y===y); }
  move(a,dx,dy) {
    if(!a.alive||a.trapped||this.result||this.time<a.next||!this.passable(a.x+dx,a.y+dy)) return false;
    a.px=a.x; a.py=a.y; a.x+=dx; a.y+=dy; a.moved=this.time; a.next=this.time+a.speed;
    const i=this.drops.findIndex(d=>d.x===a.x&&d.y===a.y);
    if(i>=0) {
      const d=this.drops.splice(i,1)[0];
      if(d.type==='reach') a.reach=Math.min(5,a.reach+1);
      if(d.type==='capacity') a.capacity=Math.min(4,a.capacity+1);
      if(d.type==='speed') a.speed=Math.max(.105,a.speed-.018);
      if(a.id===0) this.events.push({type:'upgrade',upgrade:d.type});
    }
    return true;
  }
  place(a) {
    if(!a.alive||a.trapped||this.result||this.bombs.filter(b=>b.owner===a.id).length>=a.capacity||this.bombs.some(b=>b.x===a.x&&b.y===a.y)) return false;
    this.bombs.push({x:a.x,y:a.y,reach:a.reach,owner:a.id,at:this.time+2.2,born:this.time});
    this.events.push({type:'place'}); return true;
  }
  action() {
    const a=this.actors[0];
    if(a.trapped&&a.alive&&!this.result) {
      a.taps++;
      if(a.taps>=4) { a.trapped=0; a.shield=this.time+1.1; this.events.push({type:'escape'}); }
    } else this.place(a);
  }
  escapeRoute(a,extra) {
    const danger=this.hazards(extra),queue=[{x:a.x,y:a.y,first:null,steps:0}],seen=new Set([key(a.x,a.y)]);
    while(queue.length) {
      const n=queue.shift();
      if(n.steps>0&&!danger.has(key(n.x,n.y))) return n.first;
      if(n.steps>=9) continue;
      for(const d of DIRS) {
        const x=n.x+d[0],y=n.y+d[1],k=key(x,y);
        if(seen.has(k)||!this.passable(x,y)||this.splashes.some(s=>isSplashActive(s,this.time)&&s.cells.some(c=>c[0]===x&&c[1]===y))) continue;
        seen.add(k); queue.push({x,y,first:n.first||d,steps:n.steps+1});
      }
    }
    return null;
  }
  bot(a) {
    if(!a.alive||a.trapped||this.time<a.next) return;
    const danger=this.hazards();
    if(danger.has(key(a.x,a.y))) { const d=this.escapeRoute(a); if(d) this.move(a,...d); return; }
    const threatened=this.cells(a.x,a.y,a.reach).some(([x,y])=>this.map[y][x]===2||this.actors.some(b=>b.id!==a.id&&b.alive&&b.x===x&&b.y===y));
    if(threatened&&this.random()<.6&&this.escapeRoute(a,{x:a.x,y:a.y,reach:a.reach})&&this.place(a)) { a.next=this.time+.18; return; }
    const options=DIRS.filter(([dx,dy])=>this.passable(a.x+dx,a.y+dy)&&!danger.has(key(a.x+dx,a.y+dy)));
    if(options.length) {
      const targets=[...this.drops,...this.actors.filter(b=>b.alive&&b.id!==a.id)];
      const distance=(x,y)=>Math.min(...targets.map(t=>Math.abs(t.x-x)+Math.abs(t.y-y)));
      options.sort((d,e)=>distance(a.x+d[0],a.y+d[1])-distance(a.x+e[0],a.y+e[1]));
      const d=this.random()<.65?options[0]:options[Math.floor(this.random()*options.length)];
      this.move(a,...d); a.next=this.time+.23+this.random()*.12;
    } else a.next=this.time+.2;
  }
  explode(b) {
    if(!this.bombs.includes(b)) return;
    this.bombs.splice(this.bombs.indexOf(b),1);
    const cells=this.cells(b.x,b.y,b.reach);
    this.splashes.push({cells,born:this.time,harmfulUntil:this.time+SPLASH_ACTIVE,until:this.time+SPLASH_VISUAL});
    this.events.push({type:'pop'});
    for(const [x,y] of cells) {
      this.drops=this.drops.filter(d=>d.x!==x||d.y!==y);
      if(this.map[y][x]===2) {
        this.map[y][x]=0;
        if(this.random()<.36) this.drops.push({x,y,type:['reach','capacity','speed'][Math.floor(this.random()*3)]});
      }
      const chain=this.bombs.find(other=>other.x===x&&other.y===y); if(chain) this.explode(chain);
    }
  }
  step(dt,dir) {
    if(this.result) return;
    this.time+=dt; this.remaining=Math.max(0,150-this.time);
    this.splashes=this.splashes.filter(s=>s.until>this.time);
    if(dir) this.move(this.actors[0],...dir);
    for(const a of this.actors.slice(1)) this.bot(a);
    for(const b of [...this.bombs]) if(b.at<=this.time) this.explode(b);
    for(const a of this.actors) {
      if(!a.alive) continue;
      if(a.trapped) {
        if(this.time>=a.trapped) { a.alive=false; this.events.push({type:'out',id:a.id}); }
      } else if(this.time>a.shield&&this.splashes.some(s=>isSplashActive(s,this.time)&&s.cells.some(([x,y])=>x===a.x&&y===a.y))) {
        a.trapped=this.time+2.4; a.taps=0; this.events.push({type:'trapped',id:a.id});
      }
    }
    if(!this.actors[0].alive) this.result='lost';
    else if(this.actors.slice(1).every(a=>!a.alive)) this.result='won';
    else if(!this.remaining) this.result='draw';
  }
}
