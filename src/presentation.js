import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Cutout plants, water and crack decals must not turn into solid AO silhouettes.
class TerrainAO extends SSAOPass {
  _overrideVisibility() {
    super._overrideVisibility();
    this.excluded=[];
    this.scene.traverse(o=>{
      if(!o.isMesh || !o.visible)return;
      const materials=Array.isArray(o.material)?o.material:[o.material];
      if(o.userData.noAO || materials.some(m=>m.transparent||m.alphaTest>0)) {
        this.excluded.push(o);o.visible=false;
      }
    });
  }
  _restoreVisibility(){super._restoreVisibility();for(const o of this.excluded)o.visible=true;}
}

export class Presentation {
  constructor(renderer,scene,camera) {
    this.renderer=renderer;this.scene=scene;this.camera=camera;
    const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
    this.composer=new EffectComposer(renderer,target);
    this.composer.addPass(new RenderPass(scene,camera));
    this.ao=new TerrainAO(scene,camera,innerWidth,innerHeight,16);
    this.ao.kernelRadius=.85;this.ao.minDistance=.001;this.ao.maxDistance=.024;
    // Soften contact darkness without blurring the beauty image or its pixel art.
    this.ao.copyMaterial.fragmentShader=this.ao.copyMaterial.fragmentShader.replace('gl_FragColor = opacity * texel;', 'gl_FragColor = vec4(mix(vec3(1.0), texel.rgb, 0.58), 1.0);');
    this.composer.addPass(this.ao);this.composer.addPass(new OutputPass());
    this.composer.setSize(innerWidth,innerHeight);
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(150,16,10),new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,
      uniforms:{zenith:{value:new THREE.Color(0x4589ef)},horizon:{value:new THREE.Color(0xb5d4f4)}},
      vertexShader:'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'uniform vec3 zenith; uniform vec3 horizon; varying vec3 direction; void main(){float height=max(0.0,normalize(direction).y);gl_FragColor=vec4(mix(horizon,zenith,pow(height,0.45)),1.0);}',
    }));
    this.sky.userData.noAO=true;this.sky.renderOrder=-100;scene.add(this.sky);
    this.sunDisk=new THREE.Mesh(new THREE.PlaneGeometry(7,7),new THREE.MeshBasicMaterial({color:0xfff2c5,toneMapped:false,fog:false}));
    this.sunDisk.userData.noAO=true;scene.add(this.sunDisk);
  }
  resize(w,h){this.composer.setSize(w,h);}
  update(daylight,lightDirection) {
    this.sky.position.copy(this.camera.position);
    this.sky.material.uniforms.zenith.value.set(0x0a1935).lerp(new THREE.Color(0x4589ef),daylight);
    this.sky.material.uniforms.horizon.value.set(0x26314d).lerp(new THREE.Color(0xb5d4f4),daylight);
    this.sunDisk.position.copy(this.camera.position).addScaledVector(lightDirection.clone().normalize(),120);
    this.sunDisk.lookAt(this.camera.position);this.sunDisk.visible=daylight>.22;
    this.scene.fog.color.copy(this.sky.material.uniforms.horizon.value);
    this.ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix);
    this.ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(this.camera.projectionMatrixInverse);
  }
  render(){this.composer.render();}
}
