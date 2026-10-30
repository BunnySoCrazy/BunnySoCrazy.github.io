import * as THREE from './assets/vendor/three-0.170.0.min.js';

// Visual parts use metres and face -Z; gameplay remains in the match engine.
export function createWeapons(parent){
  const mat=(color,roughness,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const m={steel:mat('#41474b',.32,.65),edge:mat('#687075',.28,.7),black:mat('#20272b',.58,.25),polymer:mat('#313a3a',.88),rubber:mat('#181e20',.96),tan:mat('#807665',.82),port:mat('#0b1115',.9),glove:mat('#444a43',.98),cloth:mat('#62675b',1),mark:mat('#d2d5bf',.55),red:new THREE.MeshBasicMaterial({color:'#ef714d'})};
  const geoCache=new Map();
  function part(g,geo,material,x,y,z){const o=new THREE.Mesh(geo,material);o.position.set(x,y,z);g.add(o);return o;}
  function block(g,x,y,z,w,h,d,material=m.steel,b=.006){
    const key=[w,h,d,b].join('/');let geo=geoCache.get(key);
    if(!geo){const s=new THREE.Shape(),r=Math.min(b,w/4,h/4,d/4);s.moveTo(-w/2+r,-h/2+r);s.lineTo(w/2-r,-h/2+r);s.lineTo(w/2-r,h/2-r);s.lineTo(-w/2+r,h/2-r);s.closePath();geo=new THREE.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:r,bevelThickness:r,curveSegments:1});geo.translate(0,0,-d/2+r);geoCache.set(key,geo);}
    return part(g,geo,material,x,y,z);
  }
  function tube(g,x,y,z,r,length,material=m.steel,inner=0){
    if(inner){const s=new THREE.Shape();s.absarc(0,0,r,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);s.holes.push(hole);const geo=new THREE.ExtrudeGeometry(s,{depth:length,bevelEnabled:false,curveSegments:16});geo.translate(0,0,-length/2);return part(g,geo,material,x,y,z);}
    const o=part(g,new THREE.CylinderGeometry(r,r,length,20),material,x,y,z);o.rotation.x=Math.PI/2;return o;
  }
  function screw(g,x,y,z){const o=tube(g,x,y,z,.007,.003,m.edge);o.rotation.set(0,0,Math.PI/2);block(g,x+.002,y,z,.001,.002,.009,m.port,.0003);}
  function guard(g,z,y=-.11){block(g,0,y-.05,z,.067,.017,.14,m.black);block(g,0,y,z-.063,.067,.1,.017,m.black);const t=block(g,0,y+.009,z-.015,.016,.065,.018,m.steel);t.rotation.x=-.25;}
  function rail(g,y,z,length){block(g,0,y,z,.074,.018,length,m.black);for(let q=z-length/2+.012;q<z+length/2;q+=.024)block(g,0,y+.012,q,.084,.012,.013,m.edge,.002);}
  function rearSight(g,y,z){for(const x of [-.024,.024])block(g,x,y,z,.018,.04,.032,m.black,.003);block(g,0,y-.017,z,.064,.014,.032,m.black,.002);}
  function grip(g,z,y=-.16){const o=block(g,0,y,z,.09,.22,.11,m.polymer,.012);o.rotation.x=-.24;for(let i=0;i<5;i++){const p=block(g,.047,y-.07+i*.028,z,.008,.012,.082,m.rubber,.002);p.rotation.x=-.24;}}
  function hands(g,long){
    function palm(x,y,z,rotate){const h=new THREE.Group();h.position.set(x,y,z);h.rotation.z=rotate;g.add(h);const p=part(h,new THREE.SphereGeometry(1,16,12),m.glove,0,0,0);p.scale.set(.06,.077,.055);for(let i=0;i<4;i++){const f=part(h,new THREE.CapsuleGeometry(.014,.053,3,8),m.glove,-.018,-.044+i*.026,-.048);f.rotation.z=Math.PI/2;}const thumb=part(h,new THREE.CapsuleGeometry(.02,.047,4,10),m.glove,.049,.012,-.013);thumb.rotation.z=-.35;if(!long){const sleeve=part(h,new THREE.CylinderGeometry(.059,.078,.23,12),m.cloth,.016,-.16,.046);sleeve.rotation.x=-.3;}block(h,.008,-.058,.025,.122,.03,.115,m.rubber,.01);return h;}
    function sleeve(hand,elbow,exit){
      hand.updateMatrix();
      const wrist=new THREE.Vector3(.008,-.06,.025).applyMatrix4(hand.matrix);
      const lead=new THREE.Vector3(.008,-.14,.045).applyMatrix4(hand.matrix);
      // A continuous tapered sleeve overlaps the cuff and ends below the frame,
      // including during recoil and the reload tilt. No visible cut-off cylinder.
      const curve=new THREE.CatmullRomCurve3([wrist,lead,new THREE.Vector3(...elbow),new THREE.Vector3(...exit)]);
      const segments=32,sides=12,geo=new THREE.TubeGeometry(curve,segments,1,sides,false),positions=geo.attributes.position;
      for(let ring=0;ring<=segments;ring++){
        const t=ring/segments,center=curve.getPointAt(t),radius=.057+.045*Math.sin(t*Math.PI/2);
        for(let side=0;side<=sides;side++){
          const index=ring*(sides+1)+side,v=new THREE.Vector3().fromBufferAttribute(positions,index).sub(center).multiplyScalar(radius).add(center);
          positions.setXYZ(index,v.x,v.y,v.z);
        }
      }
      geo.computeVertexNormals();part(g,geo,m.cloth,0,0,0);
    }
    const firingHand=palm(.012,-.205,.105,-.14);
    if(long){
      const supportHand=palm(-.015,-.13,-.36,-.9);
      sleeve(firingHand,[.13,-.57,.2],[.28,-1.25,.28]);
      sleeve(supportHand,[-.28,-.49,-.15],[-.44,-1.25,.16]);
    }
  }
  const guns=[];
  for(let i=0;i<3;i++){const g=new THREE.Group();parent.add(g);guns.push(g);g.userData.muzzle=new THREE.Vector3();}
  const pistol=guns[0],slide=new THREE.Group();pistol.add(slide);
  block(pistol,0,-.035,-.02,.106,.095,.34,m.polymer,.01);grip(pistol,.1);guard(pistol,-.035);hands(pistol,false);
  block(slide,0,.035,-.035,.112,.092,.365,m.steel,.011);
  block(slide,.057,.055,.015,.002,.033,.067,m.port,.001);block(slide,.058,.051,.012,.003,.016,.042,m.edge,.001);
  for(const side of [-1,1])for(let i=0;i<7;i++)block(slide,side*.056,.032,.075-i*.012,.003,.059,.004,m.port,.001);
  tube(pistol,0,.024,-.227,.034,.06,m.edge,.023);tube(pistol,0,.024,-.218,.023,.023,m.port);
  rearSight(slide,.101,.105);block(slide,0,.096,-.17,.017,.027,.023,m.black,.003);block(slide,0,.112,-.17,.008,.005,.01,m.mark,.001);
  for(const x of [-.024,.024])block(slide,x,.111,.122,.007,.008,.002,m.mark,.001);
  block(pistol,.057,-.019,.064,.009,.015,.048,m.edge,.002);screw(pistol,.055,-.052,.11);
  pistol.userData.slide=slide;pistol.userData.muzzle.set(0,.024,-.267);

  const shotgun=guns[1],pump=new THREE.Group();shotgun.add(pump);
  block(shotgun,0,.018,-.015,.132,.15,.32,m.steel,.013);block(shotgun,0,-.071,.005,.105,.036,.28,m.black);
  grip(shotgun,.12);guard(shotgun,-.025);hands(shotgun,true);
  tube(shotgun,0,.047,-.52,.033,.72,m.steel,.025);tube(shotgun,0,-.037,-.46,.029,.56,m.black);
  tube(shotgun,0,.047,-.873,.04,.034,m.edge,.026);tube(shotgun,0,-.037,-.747,.032,.018,m.edge);
  block(pump,0,-.035,-.39,.124,.115,.24,m.tan,.018);
  for(let i=0;i<8;i++)block(pump,0,-.034,-.49+i*.027,.131,.117,.009,m.black,.003);
  block(shotgun,.068,.03,.025,.003,.058,.105,m.port,.002);block(shotgun,.082,.019,.055,.043,.018,.034,m.edge);
  rail(shotgun,.105,.015,.19);rearSight(shotgun,.151,.065);block(shotgun,0,.09,-.81,.025,.06,.03,m.black);tube(shotgun,0,.125,-.81,.006,.025,m.mark);
  block(shotgun,0,-.05,.255,.1,.13,.21,m.tan,.014);block(shotgun,0,-.072,.367,.13,.2,.034,m.rubber,.012);
  for(const z of [-.1,.08])screw(shotgun,.069,.005,z);
  shotgun.userData.pump=pump;shotgun.userData.muzzle.set(0,.047,-.903);

  const rifle=guns[2];
  block(rifle,0,.024,-.035,.125,.145,.37,m.tan,.012);block(rifle,0,-.063,.015,.112,.06,.29,m.black);
  grip(rifle,.115);guard(rifle,-.025);hands(rifle,true);
  const mag=block(rifle,0,-.192,-.105,.083,.238,.125,m.steel,.011);mag.rotation.x=.16;
  for(let i=0;i<3;i++)block(rifle,.044,-.19,-.14+i*.032,.004,.16,.01,m.black,.001);
  block(rifle,0,-.3,-.085,.095,.027,.13,m.black);
  block(rifle,0,.017,-.407,.133,.14,.35,m.tan,.012);
  for(const side of [-1,1])for(let i=0;i<6;i++){block(rifle,side*.067,.036,-.27-i*.047,.003,.026,.029,m.port,.004);block(rifle,side*.067,-.017,-.27-i*.047,.003,.016,.03,m.port,.003);}
  rail(rifle,.112,-.21,.67);tube(rifle,0,.029,-.674,.025,.21,m.steel);tube(rifle,0,.029,-.795,.035,.065,m.black,.022);
  for(let i=0;i<3;i++)block(rifle,.034,.029,-.775-i*.015,.002,.025,.007,m.port,.001);
  block(rifle,.065,.043,.025,.003,.044,.093,m.port,.002);const bolt=block(rifle,.069,.036,.025,.006,.027,.065,m.edge);block(rifle,.084,-.008,.063,.03,.02,.026,m.black);
  tube(rifle,0,.008,.242,.034,.2,m.steel);block(rifle,0,-.015,.3,.095,.13,.2,m.polymer,.01);block(rifle,0,-.047,.403,.12,.2,.031,m.rubber,.009);
  // Open reflex sight with a fine hood and a tinted pane.
  block(rifle,0,.147,.015,.095,.032,.12,m.black);
  for(const side of [-1,1])block(rifle,side*.047,.206,-.004,.013,.102,.045,m.black,.004);
  block(rifle,0,.257,-.004,.104,.014,.045,m.black,.005);
  const glass=new THREE.MeshPhysicalMaterial({color:'#91b8b6',transparent:true,opacity:.17,roughness:.08,metalness:.1,depthWrite:false,side:THREE.DoubleSide});
  part(rifle,new THREE.PlaneGeometry(.08,.085),glass,0,.208,-.007);part(rifle,new THREE.CircleGeometry(.0028,12),m.red,0,.207,.018);
  for(const z of [-.13,.09])screw(rifle,.065,-.032,z);
  rifle.userData.bolt=bolt;rifle.userData.muzzle.set(0,.029,-.84);
  for(const g of guns)g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
  return guns;
}

export function animateWeapon(g,index,recoil){
  if(index===0)g.userData.slide.position.z=Math.min(.042,recoil*.7);
  if(index===1)g.userData.pump.position.z=Math.sin(Math.min(1,recoil/.1)*Math.PI)*.075;
  if(index===2)g.userData.bolt.position.z=.025+Math.min(.025,recoil*.35);
}
