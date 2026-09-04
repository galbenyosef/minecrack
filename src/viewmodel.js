import * as THREE from 'three';
import { BLOCKS } from './inventory.js';
import { createItemModel, getItem } from './items.js';
import { animateRadio } from './animation-rig.js';

const REST = {x:.53,y:-.63,z:-1.1,rx:-.12,ry:-.3,rz:-.22};
const clamp = THREE.MathUtils.clamp;
const smooth = x => {x=clamp(x,0,1);return x*x*(3-2*x);};
const durations={mine:.34,attack:.34,place:.32,eat:.78,read:.66,throw:.4,recoil:.38,equip:.38};
const swings=[
  [0,REST],
  [.23,{x:.61,y:-.4,z:-1.14,rx:.36,ry:-.46,rz:.3}],
  [.48,{x:.15,y:-.6,z:-.94,rx:-1.05,ry:.28,rz:-.76}],
  [.72,{x:.34,y:-.71,z:-1.02,rx:-.55,ry:.1,rz:-.5}],
  [1,REST],
];

/** Time-based strokes: holding mine never pins the arm at a single rotation. */
export class HandMotion {
  constructor(){this.action=null;this.elapsed=0;this.duration=1;this.phase=0;this.strokeCount=0;this.impactCount=0;this.equip=0;this.walkBlend=0;this.swayX=0;this.swayY=0;this.usingItem=false;this.useBlend=0;this.useProgress=0;this.useKind='eat';this.pose={...REST};}
  trigger(action='attack'){this.action=action;this.elapsed=0;this.duration=durations[action]||.34;this.phase=0;this.strokeCount++;}
  reset(){this.action=null;this.elapsed=0;this.phase=0;this.walkBlend=0;this.swayX=0;this.swayY=0;this.usingItem=false;this.useBlend=0;this.useProgress=0;this.equip=0;this.pose={...REST};}
  changeItem(){this.equip=.28;}
  update(dt,{mining=false,moving=false,grounded=true,time=0,walkTime=0,lookX=0,lookY=0,verticalVelocity=0,usingItem=false,useProgress=0,useKind='eat'}={}){
    let hit=false;
    if(usingItem){
      this.usingItem=true;this.action=useKind==='read'?'read':'eat';this.useKind=this.action;
      this.useProgress=clamp(Number.isFinite(useProgress)?useProgress:0,0,1);
      this.useBlend=Math.max(this.useBlend,smooth(this.useProgress/.12));this.phase=this.useProgress;
      this.equip=0;
    }else{
      if(this.usingItem){this.action=null;this.elapsed=0;this.phase=0;this.usingItem=false;}
      this.useBlend=THREE.MathUtils.damp(this.useBlend,0,20,dt);
      if(this.useBlend<.001)this.useBlend=0;
    }
    if(!this.action&&mining&&!usingItem&&this.useBlend<.04)this.trigger('mine');
    const before=this.phase;
    if(this.action&&!usingItem){this.elapsed+=dt;this.phase=clamp(this.elapsed/this.duration,0,1);if(before<.48&&this.phase>=.48){hit=true;this.impactCount++;}}
    const action=this.action,p=this.phase;
    let pose={...REST};
    if(!usingItem&&(action==='mine'||action==='attack')){
      for(let i=1;i<swings.length;i++)if(p<=swings[i][0]){const [t0,a]=swings[i-1],[t1,b]=swings[i],blend=smooth((p-t0)/(t1-t0));for(const k of Object.keys(REST))pose[k]=THREE.MathUtils.lerp(a[k],b[k],blend);break;}
    }else if(action&&!usingItem){
      const pulse=Math.sin(Math.PI*p),snap=Math.sin(Math.PI*smooth(p));
      if(action==='eat'){pose.x-=pulse*.35;pose.y+=pulse*.24;pose.z+=pulse*.22;pose.rx-=pulse*.8;pose.rz-=pulse*.48;pose.y+=Math.sin(p*Math.PI*8)*.027*pulse;}
      else if(action==='read'){pose.x-=pulse*.34;pose.y+=pulse*.17;pose.rx+=pulse*.2;pose.ry+=pulse*.35;pose.rz+=pulse*.22;}
      else if(action==='throw'){pose.x-=snap*.33;pose.y+=snap*.05;pose.z-=snap*.3;pose.rx-=snap*1.3;pose.rz-=snap*.6;}
      else if(action==='recoil'){pose.z+=Math.sin(p*Math.PI)*.24;pose.y+=pulse*.08;pose.rx+=pulse*.32;}
      else if(action==='equip'){pose.y-=pulse*.32;pose.rx+=pulse*.55;}
      else {pose.x-=pulse*.15;pose.z-=pulse*.24;pose.y+=pulse*.06;pose.rx-=pulse*.46;}
    }
    if(this.useBlend>0){
      const held={...REST},bite=Math.sin(this.useProgress*Math.PI*10);
      if(this.useKind==='read'){
        held.x-=.33;held.y+=.22;held.z+=.08;held.rx+=.16;held.ry+=.4;
        held.rz+=.18+Math.sin(this.useProgress*Math.PI*4)*.025;
      }else{
        held.x-=.35;held.y+=.26+bite*.026;held.z+=.19+bite*.045;
        held.rx-=.76+bite*.07;held.rz-=.46;held.ry+=.16;
      }
      for(const key of Object.keys(REST))pose[key]=THREE.MathUtils.lerp(pose[key],held[key],this.useBlend);
    }
    this.walkBlend=THREE.MathUtils.damp(this.walkBlend,moving&&grounded?1:0,10,dt);
    this.swayX=THREE.MathUtils.damp(this.swayX,clamp(-lookX*.015,-.055,.055),12,dt);
    this.swayY=THREE.MathUtils.damp(this.swayY,clamp(lookY*.012,-.04,.04),12,dt);
    pose.x+=Math.sin(walkTime*6)*.026*this.walkBlend+this.swayX;
    pose.y+=Math.abs(Math.cos(walkTime*6))*.03*this.walkBlend+Math.sin(time*2.1)*.006+this.swayY;
    pose.rz+=Math.sin(walkTime*6)*.045*this.walkBlend;
    pose.y-=clamp(verticalVelocity*.007,-.045,.045);
    this.equip=Math.max(0,this.equip-dt);pose.y-=Math.sin(Math.min(1,this.equip/.28)*Math.PI*.5)*.34;
    this.pose=pose;
    if(this.phase>=1&&!usingItem){this.action=null;this.phase=0;}
    return {pose,hit,action,phase:p,usingItem:this.usingItem};
  }
}

const box=new THREE.BoxGeometry(1,1,1),materials=new Map();
function mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshLambertMaterial({color,flatShading:true}));return materials.get(color);}
function voxel(parent,color,size,p){const m=new THREE.Mesh(box,mat(color));m.scale.set(...size);m.position.set(...p);parent.add(m);return m;}
function pickaxe(){
  const g=new THREE.Group();
  voxel(g,0x734620,[.075,.74,.075],[0,.3,0]);
  voxel(g,0xba8343,[.035,.68,.008],[.012,.3,.042]);
  for(let y=0;y<5;y++)voxel(g,0x52351e,[.081,.019,.081],[0,.08+y*.1,0]);
  for(let i=-4;i<=4;i++){
    const y=.68-Math.max(0,Math.abs(i)-2)*.06;
    voxel(g,i<0?0x89a4a5:0xc4d3cd,[.078,.075,.09],[i*.073,y,0]);
    voxel(g,0x4e6266,[.078,.024,.09],[i*.073,y-.05,0]);
  }
  voxel(g,0xd8e2d9,[.13,.12,.1],[0,.61,0]);
  return g;
}

export class FirstPersonView {
  constructor(renderer){
    this.renderer=renderer;this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.02,10);
    this.scene.add(new THREE.HemisphereLight(0xe8f3ff,0x62656a,2));
    const light=new THREE.DirectionalLight(0xffead0,2.1);light.position.set(-3,5,4);this.scene.add(light);
    this.group=new THREE.Group();this.group.name='first-person-hand';this.scene.add(this.group);this.motion=new HandMotion();this.itemId=null;this.costume=false;this.visible=false;
  }
  resize(width,height){this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
  setItem(id,count,world,furry=false,force=false){
    const shown=count>0?id:null;
    if(!force&&shown===this.itemId&&furry===this.costume&&world===this.world)return;
    if(!force&&shown===null&&id===this.itemId&&(this.motion.action||this.motion.usingItem||this.motion.useBlend>.02))return;
    this.group.clear();this.itemId=shown;this.costume=furry;this.world=world;
    let model;
    if(shown==='pickaxe'){model=pickaxe();model.scale.setScalar(.85);}
    else if(BLOCKS.has(shown)){model=new THREE.Mesh(world.geometry,world.materials[shown]);model.scale.set(.26,.34,.26);model.position.set(0,.22,0);model.rotation.y=.12;}
    else if(getItem(shown)){model=createItemModel(shown);model.scale.setScalar(.48);model.position.set(0,.13,0);}
    this.itemModel=model;
    if(model)this.group.add(model);
    const arm=new THREE.Group();
    voxel(arm,furry?0xc17a32:0x326270,[.17,.26,.19],[.035,-.19,.05]);
    voxel(arm,furry?0xeaa34c:0xc99468,[.18,.2,.19],[.035,.015,.05]);
    if(furry)for(let i=0;i<3;i++)voxel(arm,0xf2dec0,[.043,.052,.044],[-.025+i*.053,.09,.16]);
    else voxel(arm,0xe2b486,[.095,.045,.2],[.008,.077,.055]);
    arm.rotation.x=-.23;this.group.add(arm);this.motion.changeItem();
  }
  trigger(action){this.motion.trigger(action);}
  update(dt,state){
    if(this.itemId==='radio'&&this.itemModel)animateRadio(this.itemModel,state.time,true);
    const result=this.motion.update(dt,state),p=result.pose;
    // Keep the weapon inside a narrow desktop panel as well as a widescreen view.
    const anchor=Math.min(1,this.camera.aspect/1.4);
    this.group.scale.setScalar(Math.min(1,Math.max(.55,this.camera.aspect/1.15)));
    this.group.position.set(p.x*anchor,p.y,p.z);this.group.rotation.set(p.rx,p.ry,p.rz);
    this.group.visible=this.visible;return result;
  }
  render(){if(!this.visible)return;const previous=this.renderer.autoClear;this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.scene,this.camera);this.renderer.autoClear=previous;}
}
