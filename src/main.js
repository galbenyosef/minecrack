import * as THREE from "three";
import { HexWorld } from "./world.js";
import { ITEMS, getItem } from "./items.js";
import { Inventory, BLOCKS, RECIPES } from "./inventory.js";
import { Player } from "./player.js";
import { Entities } from "./entities.js";
import { Effects } from "./effects.js";
import { GameAudio } from "./audio.js";
import { GameUI } from "./ui.js";
import { createPlayerAvatar, updatePlayerAvatar } from "./avatar.js";
import { FirstPersonView } from "./viewmodel.js";
import { MiningOverlay } from "./mining-overlay.js";
import { Presentation } from "./presentation.js";
import { MouseLook } from "./mouse-look.js";
import { ItemUse, getItemUse } from "./item-use.js";

const SAVE_KEY = "minecrack-save-v1";
const NAMES = {
  grass: "Herbe",
  dirt: "Terre",
  stone: "Roche",
  sand: "Sable",
  wood: "Bois",
  birch: "Bouleau",
  leaves: "Feuillage",
  pine: "Épicéa",
  ore: "Minerai",
  water: "Eau",
  bedrock: "Socle",
  lucky: "Lucky Block",
  pickaxe: "Pioche",
};
const COLORS = {
  grass: 0x7ba441,
  dirt: 0x99734c,
  stone: 0xacb1a1,
  wood: 0x735237,
  sand: 0xdfd2a1,
  leaves: 0x548b36,
  pine: 0x376949,
  ore: 0x49bcb0,
  lucky: 0xffcc49,
};
const legalIds = new Set([...BLOCKS, "pickaxe", ...ITEMS.map((i) => i.id)]);
const safeSave = () => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d.version === 1 &&
      typeof d.seed === "string" &&
      d.player &&
      d.inventory
      ? d
      : null;
  } catch {
    return null;
  }
};

class Minecrack {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x91cbd5);
    this.scene.fog = new THREE.Fog(0xadd7d7, 48, 106);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.id = "game-canvas";
    this.renderer.domElement.tabIndex = -1;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Monde de Minecrack en trois dimensions",
    );
    document.body.prepend(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(
      73,
      innerWidth / innerHeight,
      0.06,
      180,
    );
    this.scene.add(this.camera);
    this.hemisphere = new THREE.HemisphereLight(0xddeaff, 0x77777f, 1.3);
    this.scene.add(this.hemisphere);
    this.sun = new THREE.DirectionalLight(0xffefd0, 3.4);
    this.sun.position.set(-28, 53, 18);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -43;
    this.sun.shadow.camera.right = 43;
    this.sun.shadow.camera.top = 43;
    this.sun.shadow.camera.bottom = -43;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 120;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.025;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.audio = new GameAudio();
    this.fx = new Effects(this.scene);
    this.keys = new Set();
    this.mouseLook = new MouseLook();
    this.itemUse = new ItemUse();
    this.rightHeld = false;
    this.nextPlaceAt = 0;
    this.inv = new Inventory();
    this.time = 0;
    this.elapsed = 0;
    this.health = 100;
    this.hunger = 100;
    this.air = 100;
    this.buffs = {};
    this.discovered = new Set();
    this.mode = "survival";
    this.seed = "MINECRACK";
    this.started = false;
    this.paused = true;
    this.overlay = "menu";
    this.target = null;
    this.miningProgress = 0;
    this.miningKey = "";
    this.leftHeld = false;
    this.lastAttack = -1;
    this.lastUse = -1;
    this.lastMineSound = -1;
    this.shake = 0;
    this.swing = 0;
    this.nextSpawn = 90;
    this.nextShare = 0;
    this.nextSave = 30;
    this.nextHUD = 0;
    this.nextRay = 0;
    this.fps = 60;
    this.screenshotMode = false;
    this.ui = new GameUI({
      onPlay: (o) => this.play(o),
      onResume: () => this.resume(),
      onRetryCapture: () => this.resume(),
      onDesktop: () => this.openDesktop(),
      onRespawn: () => this.respawn(),
      onSave: () => this.save(true),
      onNewGame: (seed, mode) => {
        this.newGame(seed || "MINECRACK", mode || this.mode);
        this.resume();
      },
      onMenu: () => {
        this.save();
        this.started = false;
        this.pause("menu");
      },
      onSelect: (i) => this.select(i),
      onAssign: (id, index) => {
        if (legalIds.has(id) && (this.inv.counts[id] || 0) > 0) {
          this.inv.slots[index] = id;
          this.select(index);
          this.ui.renderInventory(this.state());
        }
      },
      onCraft: (id) => {
        if (this.inv.craft(id)) {
          this.audio.play("lucky");
          this.ui.notify(`${this.name(id)} fabriqué.`);
          this.ui.renderInventory(this.state());
          this.syncHand();
        } else this.ui.notify("Il manque des matériaux.", { tone: "danger" });
      },
      onVolume: (v) => this.audio.setVolume(v),
      onMusicFile: (file) => {
        this.audio.loadMusic(file);
        this.ui.notify(
          "Musique locale chargée. Tenez ou posez la radio pour l’écouter.",
        );
      },
    });
    this.world = new HexWorld(this.scene, { seed: this.seed, radius: 34 });
    this.world.generate();
    this.fx.setWorld(this.world);
    this.miningOverlay = new MiningOverlay(this.scene);
    this.player = new Player(this.world, this.camera, this.audio);
    this.player.onFall = (n) => this.hurt(n);
    this.entities = new Entities(this);
    const edgeGeometry = new THREE.EdgesGeometry(
      new THREE.CylinderGeometry(1.02, 1.02, 1.02, 6),
    );
    this.selection = new THREE.LineSegments(
      edgeGeometry,
      new THREE.LineBasicMaterial({
        color: 0xfff6c1,
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.selection.visible = false;
    this.scene.add(this.selection);
    this.viewModel = new FirstPersonView(this.renderer);
    this.hand = this.viewModel.group;
    this.lookDelta = {x:0,y:0};
    this.syncHand();
    this.createAtmosphere();
    this.presentation = new Presentation(this.renderer,this.scene,this.camera);
    this.bind();
    this.ui.setOverlay("menu", this.state());
    this.previous = performance.now();
    this.renderer.setAnimationLoop((t) => this.frame(t));
    if (import.meta.env.DEV || new URLSearchParams(location.search).has("qa"))
      this.installDiagnostics();
    this.receiveHandoff();
  }
  name(id) {
    return NAMES[id] || getItem(id)?.name || id;
  }
  activeItem() {
    const id=this.inv.active;
    return id && this.inv.counts[id]>0 ? id : null;
  }
  applyLook({x,y}) {
    if(!x&&!y)return;
    this.player.look(x,y);this.lookDelta.x+=x;this.lookDelta.y+=y;
  }
  canUseItem(id) {
    const item=getItemUse(id);
    if(!item)return false;
    return item.kind!=='eat'||this.mode==='creative'||this.hunger<99.9||this.health<100;
  }
  cancelUse() { this.itemUse?.cancel(); }
  actionHint() {
    const id=this.activeItem(),use=getItemUse(id);
    if(!id)return 'Clic gauche · Frapper avec la main';
    if(use?.kind==='eat')return this.canUseItem(id)?'Maintenir clic droit · Manger':'Faim pleine · Vous êtes rassasié';
    if(use?.kind==='read')return 'Maintenir clic droit · Activer le bonus';
    if(BLOCKS.has(id))return 'Maintenir clic droit · Construire';
    if(id==='pickaxe')return 'Maintenir clic gauche · Miner';
    if(id==='poche')return 'Clic gauche · Frapper';
    if(['radio','gnome','nucleaire'].includes(id))return 'Clic droit sur le sol · Poser';
    if(id==='journal')return 'Clic droit · Lancer';
    if(id==='furry')return 'Clic droit · Équiper / retirer';
    if(id==='cuir')return 'E · Artisanat';
    return 'Clic droit · Utiliser';
  }
  updateUse(dt) {
    const id=this.activeItem(),descriptor=getItemUse(id);
    if(this.rightHeld && descriptor && !this.itemUse.active && this.canUseItem(id))
      this.itemUse.begin(id,{count:this.inv.counts[id],canUse:true});
    const result=this.itemUse.update(dt,{held:this.rightHeld,id,count:this.inv.counts[id]||0,canUse:this.canUseItem(id)});
    if(result.justBite&&result.kind==='eat'){
      this.audio.play('eat');
      const crumbs=this.camera.position.clone().addScaledVector(this.player.direction(),.7);crumbs.y-=.24;
      this.fx.burst(crumbs,0xc78a42,3,.55);
    }
    if(result.completedId){
      const item=getItemUse(result.completedId);
      if(this.consume(result.completedId)){
        if(item.kind==='eat'){
          this.hunger=Math.min(100,this.hunger+item.hunger);
          this.health=Math.min(100,this.health+item.health);
          this.ui.notify(`${this.name(item.id)} mangée · +${item.hunger} faim`);
        }else{
          this.buffs.impots=this.time+item.buffDuration;this.audio.play('lucky');
          this.ui.notify('Vitesse accrue et invulnérabilité pendant 18 secondes.');
        }
        this.ui.update(this.state());
      }
    }
    if(this.rightHeld&&BLOCKS.has(id)&&this.time>=this.nextPlaceAt&&!this.viewModel.motion.action){
      this.use({repeat:true});this.nextPlaceAt=this.time+.25;
    }
  }
  createAtmosphere() {
    this.atmosphere = new THREE.Group();
    this.scene.add(this.atmosphere);
    this.clouds = [];
    const mat = [0xf0f4fa,0xf0f4fa,0xffffff,0xbccbdc,0xf5f7fb,0xe3ecf6].map(color=>new THREE.MeshBasicMaterial({color})),
      box = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 28; i++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 5; j++) {
        const m = new THREE.Mesh(box, mat);
        m.scale.set(3 + (j % 3) * 2, 1 + (j % 2) * 1.1, 2 + (j % 2) * 2);
        m.position.set((j - 2) * 2.3, (j % 2) * 0.5, Math.sin(j * 4 + i) * 2);
        cloud.add(m);
      }
      cloud.position.set(
        Math.sin(i * 21.37) * 95,
        29 + (i % 5) * 3,
        Math.cos(i * 8.71) * 95,
      );
      this.atmosphere.add(cloud);
      this.clouds.push(cloud);
    }
    const ocean = new THREE.Mesh(
      new THREE.CircleGeometry(145, 80),
      new THREE.MeshStandardMaterial({
        color: 0x397bac,
        roughness: 0.9,
        metalness: 0.05,
      }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = this.world.seaLevel + 0.85;
    this.atmosphere.add(ocean);
    const mountainMaterial = new THREE.MeshLambertMaterial({
      color: 0x6d9990,
      flatShading: true,
    });
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const mountain = new THREE.Mesh(
        new THREE.ConeGeometry(9 + (i % 4) * 3, 10 + (i % 5) * 5, 6),
        mountainMaterial,
      );
      mountain.position.set(Math.cos(angle) * 112, 4, Math.sin(angle) * 112);
      mountain.rotation.y = angle;
      this.atmosphere.add(mountain);
    }
  }
  bind() {
    addEventListener("resize", () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      this.viewModel.resize(innerWidth, innerHeight);
      this.presentation.resize(innerWidth,innerHeight);
    });
    addEventListener("keydown", (e) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (["F1", "F2", "F3", "F5", "KeyE"].includes(e.code) ||
          (!this.paused && ["Space","Tab","KeyW","KeyA","KeyS","KeyD","KeyQ","ControlLeft","ControlRight","ShiftLeft","ShiftRight"].includes(e.code)))
        e.preventDefault();
      if (e.code === "KeyE" && !e.repeat && this.started) {
        if (this.overlay === "inventory") this.resume();
        else if (!this.paused) this.pause("inventory");
        return;
      }
      if (e.code === "Escape" && !e.repeat && this.started) {
        e.preventDefault();
        if (this.overlay === "inventory" || this.overlay === "pause") this.resume();
        else if (this.overlay === "capture" || !this.paused) this.pause("pause");
        return;
      }
      if (e.code === "F3" && !e.repeat) {
        this.ui.toggleDebug?.();
        return;
      }
      if (e.code === "F1" && !e.repeat && !this.paused) {
        this.screenshotMode = !this.screenshotMode;
        document.body.classList.toggle("photo-mode", this.screenshotMode);
        return;
      }
      if (e.code === "F2" && !e.repeat && !this.paused) {
        this.captureScreenshot();return;
      }
      if (e.code === "F5" && !e.repeat && this.started && !this.paused) {
        this.perspective=((this.perspective||0)+1)%3;
        this.thirdPerson=this.perspective!==0;
        this.updateView();
        this.ui.notify(
          this.thirdPerson
            ? "Vue du personnage · F5 pour changer de perspective."
            : "Vue à la première personne.",
        );
        return;
      }
      if (e.code === "KeyQ" && !e.repeat && !this.paused) {this.dropHeld(e.ctrlKey);return;}
      if (!this.paused && e.code.startsWith("Digit")) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 9) this.select(n - 1);
      }
      if (!this.paused) this.keys.add(e.code);
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => {
      if (this.started && !this.paused) this.pause("pause");
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.started) {
        this.save();
        this.pause("pause");
      }
    });
    addEventListener("beforeunload", () => {
      if (this.started) this.save();
    });
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === this.renderer.domElement) {
        this.mouseLook.reset();
        if(!this.wantsPointerLock){this.expectedUnlock=true;document.exitPointerLock();}
        else this.activateCapturedPlay();
        return;
      }
      if (this.expectedUnlock) {
        this.expectedUnlock=false;
        if(this.wantsPointerLock)this.lockPointer();
        return;
      }
      if (this.started && !this.paused) this.pause("pause");
    });
    // Promise rejection identifies transient throttling. Legacy browsers that
    // return no promise are covered by the bounded acquisition timeout below.
    this.renderer.domElement.addEventListener("click", () => {
      if (this.started && this.paused && this.overlay === null) this.resume();
    });
    addEventListener("mousemove", (e) => {
      if(this.paused)return;
      const locked=document.pointerLockElement===this.renderer.domElement;
      if(!locked)return;
      const delta=this.mouseLook.move(e,{locked});
      this.applyLook(delta);
    });
    document.addEventListener("contextmenu", (e) => {
      if(e.target===this.renderer.domElement || document.pointerLockElement===this.renderer.domElement){e.preventDefault();e.stopPropagation();}
    },true);
    addEventListener("mousedown", (e) => {
      if (
        this.paused || document.pointerLockElement !== this.renderer.domElement
      )
        return;
      e.preventDefault();
      if (e.button === 1) {this.pickBlock();return;}
      if (e.button === 0) {
        if(this.rightHeld)return;
        this.leftHeld = true;
        this.attack();
      }
      if (e.button === 2) {
        e.preventDefault();this.rightHeld=true;this.leftHeld=false;this.clearMining();
        this.pendingMelee=false;this.viewModel.motion.reset();this.use();this.nextPlaceAt=this.time+.25;
      }
    });
    addEventListener("mouseup", (e) => {
      if(e.button===2){this.rightHeld=false;this.cancelUse();}
      if (e.button === 0) {
        this.leftHeld = false;
        this.clearMining();
      }
    });
    addEventListener(
      "wheel",
      (e) => {
        if (this.paused) return;
        e.preventDefault();
        this.select((this.inv.selected + (e.deltaY > 0 ? 1 : 8)) % 9);
      },
      { passive: false },
    );
  }
  newGame(seed = "MINECRACK", mode = "survival") {
    this.entities.clear();
    this.cancelUse();this.rightHeld=false;this.leftHeld=false;this.mouseLook.reset();
    this.fx.clear();
    this.world.dispose();
    this.seed = String(seed).slice(0, 64) || "MINECRACK";
    this.mode = mode === "creative" ? "creative" : "survival";
    this.world = new HexWorld(this.scene, { seed: this.seed, radius: 34 });
    this.world.generate();
    this.fx.setWorld(this.world);
    this.clearMining();
    this.viewModel.motion.reset();
    this.pendingMelee = false;
    this.player.world = this.world;
    this.player.reset(this.world.spawn);
    this.inv = new Inventory(this.mode === "creative");
    if (this.mode === "creative") {
      for (const i of ITEMS) this.inv.add(i.id, 10);
      this.inv.slots = [
        "pickaxe",
        "grass",
        "stone",
        "lucky",
        "chocolatine",
        "journal",
        "gnome",
        "radio",
        "zerator",
      ];
    }
    this.time = 0;
    this.elapsed = 0;
    this.health = 100;
    this.hunger = 100;
    this.air = 100;
    this.buffs = {};
    this.discovered = new Set();
    this.nextSpawn = 90;
    this.nextSave = 30;
    this.nextShare = 0;
    this.nextHUD = 0;
    this.nextRay = 0;
    this.target = null;
    this.miningProgress = 0;
    this.lastAttack = -1;
    this.lastUse = -1;
    this.lastMineSound = -1;
    this.syncHand();
    const p = this.world.spawn.clone().add(new THREE.Vector3(-5, 0, -4));
    p.y = this.world.getGroundHeight(p.x, p.z);
    if (Number.isFinite(p.y)) this.entities.spawn("friend", p);
  }
  play(options = {}) {
    this.audio.init();
    if (options.continueSave) {
      if (!this.load()) this.newGame(options.seed, options.mode);
    } else
      this.newGame(options.seed || "MINECRACK", options.mode || "survival");
    this.started = true;
    this.resume();
    this.ui.notify(
      this.mode === "creative"
        ? "Tous les Lucky Drops sont disponibles dans E · Inventaire."
        : "Explorez les rives et ouvrez votre premier Lucky Block.",
      {
        title:
          this.mode === "creative"
            ? "ATELIER CRÉATIF"
            : "BIENVENUE DANS MINECRACK",
      },
    );
  }
  resume() {
    if (this.health <= 0) {
      this.pause("death");
      return;
    }
    this.audio.init();
    this.started = true;
    this.paused = true;
    this.overlay = 'capture';
    this.captureStatus='pending';this.captureMessage='';
    this.keys.clear();
    this.wantsPointerLock=true;this.mouseLook.reset();
    if(document.pointerLockElement===this.renderer.domElement)this.activateCapturedPlay();
    else {
      this.ui.setOverlay('capture',this.state());
      if(!this.expectedUnlock)this.lockPointer();
    }
  }
  activateCapturedPlay() {
    clearTimeout(this.lockTimer);
    this.captureStatus=null;this.captureMessage='';
    this.paused=false;this.overlay=null;this.keys.clear();
    this.ui.setOverlay(null,this.state());
    document.body.classList.add('playing-fps');
    this.renderer.domElement.focus({preventScroll:true});
  }
  lockPointer(retries = 0) {
    if(!this.wantsPointerLock)return;
    const requestId=this.captureRequestId=(this.captureRequestId||0)+1;
    clearTimeout(this.lockTimer);
    this.lockTimer=setTimeout(()=>this.captureBlocked(),1500);
    const failed=error=>{
      if(requestId!==this.captureRequestId || !this.wantsPointerLock || document.pointerLockElement===this.renderer.domElement)return;
      clearTimeout(this.lockTimer);
      if(retries<3 && /Too many pointer lock requests/i.test(error?.message||'')) {
        this.lockTimer=setTimeout(()=>this.lockPointer(retries+1),1100);
      } else this.captureBlocked();
    };
    try {
      this.renderer.domElement.focus({preventScroll:true});
      const promise = this.renderer.domElement.requestPointerLock();
      promise?.catch(failed);
    } catch(error) {
      failed(error);
    }
  }
  captureBlocked() {
    if(!this.wantsPointerLock || document.pointerLockElement===this.renderer.domElement)return;
    this.pause('capture');this.captureStatus='blocked';
    this.ui.setOverlay('capture',this.state());
  }
  async openDesktop() {
    if(this.captureStatus==='launching')return;
    this.pause('capture');this.captureStatus='launching';this.captureMessage='';
    this.ui.setOverlay('capture',this.state());
    try {
      const response=await fetch('/api/launch-desktop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({save:this.started?this.saveData():safeSave()})});
      const result=await response.json();
      if(!response.ok||!result.opened)throw new Error(result.error||'Ouverture impossible. Lancez Lancer-Minecrack.cmd.');
      this.captureStatus='opened';this.captureMessage=result.message||'Votre partie est prête dans la fenêtre de jeu.';
      this.save();
    } catch(error) {this.captureStatus='error';this.captureMessage=error.message;}
    this.ui.setOverlay('capture',this.state());
  }
  async receiveHandoff() {
    const url=new URL(location.href),token=url.searchParams.get('handoff');
    if(!token)return;
    url.searchParams.delete('handoff');history.replaceState(null,'',url.pathname+url.search+url.hash);
    this.ui.setOverlay('loading',this.state());
    try {
      const response=await fetch(`/api/handoff?token=${encodeURIComponent(token)}`,{cache:'no-store'});
      if(!response.ok)throw new Error('Le transfert a expiré. Revenez dans la première fenêtre pour le relancer.');
      const {save}=await response.json();
      if(save && !this.load(save))throw new Error('Cette sauvegarde ne peut pas être transférée.');
      if(save){
        const previous=localStorage.getItem(SAVE_KEY);
        if(previous)localStorage.setItem(`${SAVE_KEY}-before-transfer`,previous);
        this.started=true;this.save();this.pause('pause');
      }
      else this.pause('menu');
      this.ui.notify('Partie transférée. Cliquez pour capturer la souris et jouer.');
    } catch(error) {this.pause('menu');this.ui.notify(error.message,{tone:'danger'});}
  }
  pause(kind = "pause") {
    this.paused = true;
    this.wantsPointerLock=false;
    this.captureRequestId=(this.captureRequestId||0)+1;
    clearTimeout(this.lockTimer);this.mouseLook.reset();this.rightHeld=false;this.cancelUse();
    document.body.classList.remove("playing-fps");
    this.overlay = kind;
    this.keys.clear();
    this.leftHeld = false;
    this.clearMining();
    this.viewModel.motion.reset();
    this.pendingMelee = false;
    this.selection.visible = false;
    if (document.pointerLockElement===this.renderer.domElement) {this.expectedUnlock=true;document.exitPointerLock();}
    this.audio.updateRadio(false, this.time);
    this.ui.setOverlay(kind, this.state());
  }
  respawn() {
    this.health = 100;
    this.hunger = 80;
    this.air = 100;
    this.player.reset(this.world.spawn);
    this.buffs.impots = this.time + 6;
    this.resume();
    this.ui.notify(
      "Vous reprenez votre souffle au point de départ. Inventaire conservé.",
    );
  }
  invulnerable() {
    return this.mode === "creative" || this.buffs.impots > this.time;
  }
  hurt(amount) {
    if (this.invulnerable() || this.health <= 0) return;
    const mitigation = this.buffs.furry ? 0.72 : 1;
    this.health = Math.max(0, this.health - Math.round(amount * mitigation));
    this.shake = 0.15;
    this.audio.play("hit");
    this.ui.damageFlash?.();
    if (this.health <= 0) {
      this.save();
      this.pause("death");
    }
  }
  select(i) {
    this.cancelUse();this.rightHeld=false;
    this.clearMining();
    this.viewModel.motion.reset();
    this.pendingMelee = false;
    this.inv.selected = Math.max(0, Math.min(8, i));
    this.syncHand();
    this.ui.update(this.state());
  }
  dropHeld(entireStack=false) {
    const id=this.activeItem();if(!id)return;
    const count=entireStack?this.inv.counts[id]:1;
    const direction=this.player.direction();
    const p=this.camera.position.clone().addScaledVector(direction,2.1);
    // Avoid throwing through a wall; leave a collectible just in front of it.
    const hit=this.world.raycast(new THREE.Raycaster(this.camera.position,direction,0,2.1),2.1);
    if(hit)p.copy(hit.point).addScaledVector(direction,-.3);
    if(this.inv.remove(id,count)){
      this.cancelUse();this.rightHeld=false;this.clearMining();this.pendingMelee=false;
      this.entities.drop(id,p,count).pickupDelay=2;this.viewModel.trigger('throw');
      this.ui.update(this.state());
    }
  }
  pickBlock() {
    this.updateTarget();const type=this.target?.type;
    const id=type==='birch'?'wood':type==='pine'?'leaves':type;
    if(!BLOCKS.has(id))return;
    const slot=this.inv.slots.indexOf(id);
    if(this.inv.counts[id]>0&&slot>=0){this.select(slot);return;}
    if(this.mode==='creative'&&!this.inv.counts[id])this.inv.add(id,1);
    if(this.inv.counts[id]>0){this.inv.slots[this.inv.selected]=id;this.select(this.inv.selected);}
  }
  captureScreenshot() {
    // Render on demand so the default non-preserved WebGL backbuffer is current.
    this.presentation.render();
    this.viewModel.render();
    this.renderer.domElement.toBlob(blob=>{
      if(!blob)return;
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=`Minecrack-${new Date().toISOString().replace(/[:.]/g,'-')}.png`;link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    },'image/png');
  }
  syncHand() {
    if (!this.viewModel) return;
    this.viewModel.setItem(this.inv.active, this.inv.counts[this.inv.active] || 0, this.world, !!this.buffs.furry);
    if (!this.avatar || this.avatarFurry !== !!this.buffs.furry) {
      if (this.avatar) this.scene.remove(this.avatar);
      this.avatarFurry = !!this.buffs.furry;
      this.avatar = createPlayerAvatar(this.avatarFurry);
      this.scene.add(this.avatar);
      this.avatar.visible = !!this.thirdPerson;
    }
  }
  updateView() {
    if (!this.avatar) return;
    this.avatar.position.copy(this.player.position);
    this.avatar.rotation.y = this.player.yaw + Math.PI;
    this.avatar.visible = !!this.thirdPerson && this.started;
    if (this.thirdPerson) {
      const target = this.player.position
          .clone()
          .add(new THREE.Vector3(0, 1.2, 0)),
        offset = this.player.direction().multiplyScalar(this.perspective===2?4:-4),
        ray = new THREE.Raycaster(
          target,
          offset.clone().normalize(),
          0,
          offset.length(),
        ),
        hit = this.world.raycast(ray, offset.length());
      const distance = hit
        ? Math.max(0.45, hit.distance - 0.25)
        : offset.length();
      this.camera.position
        .copy(target)
        .addScaledVector(offset.normalize(), distance);
      this.camera.lookAt(target);
      this.avatar.visible = distance > 0.9;
    }
  }
  updateTarget() {
    this.camera.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.target = this.world.raycast(ray, 6);
    const et = this.entities.target(ray, 4.5);
    this.entityTarget =
      et &&
      (!this.target ||
        et.distance < this.target.point.distanceTo(this.camera.position))
        ? et
        : null;
    this.selection.visible =
      !!this.target && !this.entityTarget && !this.paused;
    if (this.selection.visible) {
      const p = this.world.hexToWorld(this.target.q, this.target.r);
      this.selection.position.set(p.x, this.target.y + 0.5, p.z);
    }
  }
  clearMining() {
    this.miningProgress = 0;
    this.miningKey = '';
    this.miningOverlay?.clear();
  }
  attack() {
    if (this.time - this.lastAttack < 0.34) return;
    this.updateTarget();
    this.lastAttack = this.time;
    if (!this.viewModel.motion.action) {
      this.viewModel.trigger(this.target && !this.entityTarget ? 'mine' : 'attack');
      this.audio.play('swing');
    }
    // Damage is applied at the contact keyframe in the render loop.
    this.pendingMelee = !!this.entityTarget;
  }
  strike(handMotion) {
    if (!handMotion.hit || !['mine', 'attack'].includes(handMotion.action)) return;
    this.updateTarget();
    if (this.entityTarget && (this.leftHeld || this.pendingMelee)) {
      const id = this.activeItem();
      this.entities.damage(this.entityTarget.entity, id === 'poche' ? 13 : id === 'pickaxe' ? 18 : 7,
        id === 'poche' ? 0.65 : 0.3, this.player.direction());
      this.audio.play('hit');
      this.pendingMelee = false;
    } else if (this.target && this.leftHeld) {
      const b=this.target;
      this.fx.hitBlock(b.point,b.normal,b.type,this.world.materials[b.type]?.[0]?.map);
      this.audio.play('mine',b.type);
    }
  }
  mine(dt) {
    if (!this.leftHeld || this.rightHeld || this.itemUse.active || this.entityTarget || !this.target) { this.clearMining(); return; }
    const b=this.target;
    if (b.type === 'bedrock') {
      this.clearMining();
      if (this.time-this.lastMineSound>.8) {this.lastMineSound=this.time;this.ui.notify('Le socle est indestructible.');}
      return;
    }
    const key = b.q+','+b.r+','+b.y;
    if (key !== this.miningKey) {this.clearMining();this.miningKey=key;}
    const hardness={stone:.85,ore:1.1,lucky:.55,wood:.65,birch:.65,water:.15};
    const duration=this.mode==='creative'?.18:(hardness[b.type]||.38)*(this.activeItem()==='pickaxe'?1:2.1);
    this.miningProgress += dt/duration;
    this.miningOverlay.update(b, this.miningProgress, this.world);
    if (this.miningProgress>=1) {this.breakBlock(b);this.clearMining();this.nextRay=0;}
  }
  breakBlock(b) {
    const old = this.world.removeBlock(b.q, b.r, b.y);
    if (!old) return false;
    this.world.rebuild();
    const p = this.world.hexToWorld(b.q, b.r),
      pos = new THREE.Vector3(p.x, b.y + 0.6, p.z);
    this.fx.breakBlock(pos, b.type, this.world.materials[b.type]?.[0]?.map);
    this.audio.play("break", b.type);
    if (b.type === "lucky") this.openLucky(pos);
    else if (b.type !== "water") {
      const id =
        b.type === "birch" ? "wood" : b.type === "pine" ? "leaves" : b.type;
      this.inv.add(id);
    }
    return true;
  }
  openLucky(position, forcedId = null) {
    const id = forcedId || ITEMS[Math.floor(Math.random() * ITEMS.length)].id,
      item = getItem(id);
    this.discovered.add(id);
    this.audio.play("lucky");
    this.fx.burst(position, 0xffd153, 45, 5);
    this.fx.ring(position, 2.8, 0xffdc69);
    if (id === "urssaf") {
      this.entities.spawn(
        "hostile",
        position
          .clone()
          .setY(this.world.getGroundHeight(position.x, position.z)),
      );
      this.ui.notify(
        "Un agent approche. Chaque coup peut saisir vos ressources !",
        { title: item.name, icon: item.icon, tone: "danger" },
      );
    } else if (id === "b2") {
      this.summonBomber(position);
      this.ui.notify("Bombardement entrant ! Quittez la zone.", {
        title: item.name,
        icon: item.icon,
        tone: "danger",
      });
    } else {
      this.entities.drop(id, position);
      this.ui.notify(item.description, {
        title: item.name,
        icon: item.icon,
        tone: "lucky",
      });
    }
  }
  aimPosition() {
    return this.target
      ? this.target.point.clone()
      : this.player.position
          .clone()
          .addScaledVector(this.player.direction().setY(0).normalize(), 4);
  }
  summonBomber(target) {
    const p = target.clone();
    p.y = Math.max(this.player.position.y + 20, 28);
    p.z += 24;
    this.entities.spawn("b2", p);
    this.fx.ring(target, 4, 0xff6245);
  }
  placement() {
    if (this.target?.place) {
      const p = this.world.hexToWorld(this.target.place.q, this.target.place.r);
      return {
        position: new THREE.Vector3(p.x, this.target.place.y, p.z),
        cell: this.target.place,
      };
    }
    const dir = this.player.direction().setY(0).normalize();
    const pos = this.player.position.clone().addScaledVector(dir, 3);
    const h = this.world.worldToHex(pos.x, pos.z),
      p = this.world.hexToWorld(h.q, h.r),
      y = this.world.getGroundHeight(p.x, p.z);
    return {
      position: new THREE.Vector3(p.x, y, p.z),
      cell: { q: h.q, r: h.r, y },
    };
  }
  consume(id) {
    return this.mode === "creative" || this.inv.remove(id);
  }
  canStandAt(position, height = 1) {
    if (!Number.isFinite(position.y)) return false;
    const cell=this.world.worldToHex(position.x,position.z);
    const support=this.world.getBlock(cell.q,cell.r,position.y-1);
    if (!support || support.type==='water') return false;
    for(let y=position.y;y<position.y+height;y++) {
      const block=this.world.getBlock(cell.q,cell.r,y);
      if(block&&block.type!=='water')return false;
    }
    const overlaps=(p,otherHeight)=>Math.hypot(position.x-p.x,position.z-p.z)<1.15&&position.y<p.y+otherHeight&&position.y+height>p.y;
    return !overlaps(this.player.position,1.8)&&!this.entities.all.some(e=>!e.pickup&&e.kind!=='b2'&&overlaps(e.model.position,1.7));
  }
  use({repeat=false}={}) {
    const heldId=this.activeItem();
    if(getItemUse(heldId)){
      if(!this.canUseItem(heldId)){this.ui.notify('Vous êtes rassasié. La nourriture reste dans votre inventaire.');return false;}
      this.clearMining();this.pendingMelee=false;
      return this.itemUse.begin(heldId,{count:this.inv.counts[heldId],canUse:true});
    }
    if (this.time - this.lastUse < 0.24) return false;
    this.lastUse = this.time;
    this.updateTarget();
    const id = this.inv.active;
    if (!id || (this.inv.counts[id] || 0) < 1) return;
    if (BLOCKS.has(id)) {
      if (!this.target) {
        if(!repeat)this.ui.notify("Visez la face d’un bloc pour construire.");
        return;
      }
      const cell = this.target.place;
      if (!cell) return;
      const center = this.world.hexToWorld(cell.q, cell.r),
        p = this.player.position;
      if (
        Math.hypot(center.x - p.x, center.z - p.z) < 1.25 &&
        cell.y < p.y + 1.8 &&
        cell.y + 1 > p.y
      ) {
        if(!repeat)this.ui.notify("Cet emplacement est occupé par votre personnage.");
        return;
      }
      if (
        this.world.getBlock(cell.q, cell.r, cell.y)?.type !== "water" &&
        this.world.getBlock(cell.q, cell.r, cell.y)
      )
        return;
      if(this.entities.all.some(e=>!e.pickup&&e.kind!=='b2'&&Math.hypot(e.model.position.x-center.x,e.model.position.z-center.z)<1.05&&cell.y<e.model.position.y+1.7&&cell.y+1>e.model.position.y)) {
        if(!repeat)this.ui.notify('Un personnage occupe cet emplacement.');return false;
      }
      if (this.world.setBlock(cell.q, cell.r, cell.y, id)) {
        this.consume(id);
        this.world.rebuild();
        this.audio.play("place");
        this.viewModel.trigger("place");
        return true;
      }
      return false;
    }
    if (id === "pickaxe" || id === "poche") return false;
    if (id === "journal") {
      if (this.consume(id)) {
        this.viewModel.trigger("throw");
        this.entities.throwItem(
          id,
          this.camera.position
            .clone()
            .addScaledVector(this.player.direction(), 0.7),
          this.player
            .direction()
            .multiplyScalar(17)
            .add(new THREE.Vector3(0, 3, 0)),
        );
        this.ui.notify("Un récit qui fait du bruit.");
      }
      return;
    }
    if (id === "urssaf") {
      const p = this.placement().position;
      if(!this.canStandAt(p,2)){this.ui.notify('Visez un sol libre avec assez de place pour un personnage.');return false;}
      if (this.consume(id)) {
        this.viewModel.trigger("place");
        this.entities.spawn("hostile", p);
        this.ui.notify("Un contrôleur vient d’arriver.", { tone: "danger" });
      }
      return;
    }
    if (id === "b2") {
      if (this.consume(id)) {
        this.viewModel.trigger("recoil");
        this.summonBomber(this.aimPosition());
        this.ui.notify("B2 appelé sur la zone visée. Éloignez-vous !", {
          tone: "danger",
        });
      }
      return;
    }
    if (["gnome", "nucleaire", "radio"].includes(id)) {
      const pos = this.placement().position;
      if(!this.target || !this.canStandAt(pos,id==='nucleaire'?2:1)){
        this.ui.notify('Visez le dessus d’un bloc libre, à côté de vous, pour poser cet objet.');return false;
      }
      if (this.consume(id)) {
        this.viewModel.trigger("place");
        this.entities.spawn(id, pos);
        this.audio.play("place");
        this.ui.notify(
          id === "nucleaire"
            ? "Réacteur en service. Attention : le détruire provoque une explosion."
            : `${this.name(id)} posé. Frappez-le pour le récupérer.`,
        );
      }
      return;
    }
    if (id === "zerator") {
      const pos = this.placement().position;
      if(!this.canStandAt(pos,2)){this.ui.notify('Visez un sol libre avec assez de place pour un compagnon.');return false;}
      if (this.consume(id)) {
        this.viewModel.trigger("throw");
        this.fx.burst(pos, 0xbcea5d, 35, 4);
        this.entities.spawn("friend", pos);
        this.ui.notify("L’œuf a éclos : un compagnon vous suit !", {
          title: "ŒUF DE ZERATOR",
        });
      }
      return;
    }
    if (id === "megaphone") {
      this.viewModel.trigger("recoil");
      this.audio.play("mega");
      const forward = this.player.direction().setY(0).normalize();
      let count = 0;
      for (const e of this.entities.nearby(this.player.position, 9)) {
        const delta = e.model.position
          .clone()
          .sub(this.player.position)
          .setY(0)
          .normalize();
        if (delta.dot(forward) > 0.55) {
          this.entities.damage(e, 5, 4.5, forward);
          e.fear = 2;
          count++;
        }
      }
      this.fx.ring(
        this.camera.position.clone().addScaledVector(forward, 3),
        4,
        0xa0f7c6,
      );
      this.ui.notify(
        `${count} PNJ repoussé${count > 1 ? "s" : ""} par le mégaphone.`,
      );
      return;
    }
    if (id === "tgv") {
      this.viewModel.trigger("recoil");
      this.audio.play("horn");
      for (const e of this.entities.nearby(this.player.position, 55))
        if (e.kind === "hostile") e.fear = 10;
      this.fx.ring(this.player.position, 12, 0xf6f3a4);
      this.ui.notify(
        "Le klaxon effraie les agents à 55 mètres pendant 10 secondes.",
      );
      return;
    }
    if (id === "furry") {
      this.viewModel.trigger("equip");
      this.buffs.furry = !this.buffs.furry;
      this.syncHand();
      this.audio.play("place");
      this.ui.notify(
        this.buffs.furry
          ? "Costume équipé : saut augmenté et dégâts réduits de 28 %."
          : "Costume retiré.",
      );
      return;
    }
    if (id === "socialiste") {
      this.viewModel.trigger("read");
      this.shareResources(true);
      return;
    }
    if (id === "cuir") {
      this.pause("inventory");
      this.ui.notify("Le cuir permet de fabriquer un costume dans Artisanat.");
    }
  }
  shareResources(manual = false) {
    if ((this.inv.counts.socialiste || 0) < 1) return;
    const recipients = this.entities.nearby(this.player.position, 8);
    if (!recipients.length) {
      if (manual)
        this.ui.notify("Rapprochez-vous d’un PNJ à moins de 8 mètres.");
      return;
    }
    let moved = 0;
    for (const id of [
      "grass",
      "dirt",
      "stone",
      "sand",
      "wood",
      "ore",
      "cuir",
    ]) {
      const total =
        (this.inv.counts[id] || 0) +
        recipients.reduce((sum, e) => sum + (Number(e.inventory[id]) || 0), 0);
      const share = Math.floor(total / (recipients.length + 1)),
        remainder = total % (recipients.length + 1),
        old = this.inv.counts[id] || 0;
      this.inv.counts[id] = share + remainder;
      for (const e of recipients) e.inventory[id] = share;
      moved += Math.abs(old - this.inv.counts[id]);
    }
    if (moved || manual) {
      this.audio.play("place");
      this.ui.notify(
        `Ressources réparties équitablement avec ${recipients.length} PNJ proche${recipients.length > 1 ? "s" : ""}.`,
        { title: "CARTE DU PARTI SOCIALISTE" },
      );
    }
  }
  state() {
    const totalMinutes = 8 * 60 + 42 + Math.floor(this.time * 1.2),
      hours = Math.floor(totalMinutes / 60) % 24,
      minutes = totalMinutes % 60;
    return {
      actionHint:this.actionHint(),usingItem:this.itemUse.active,useProgress:this.itemUse.progress,canEat:this.canUseItem(this.inv.active),
      controlMode:this.paused?"paused":"locked",
      captureStatus:this.captureStatus,captureMessage:this.captureMessage,
      health: this.health,
      hunger: this.hunger,
      air: this.air,
      hotbar: this.inv.hotbar,
      selected: this.inv.selected,
      inventory: this.inv.counts,
      discovered: [...this.discovered],
      seed: this.seed,
      mode: this.mode,
      time: this.time,
      day: 1 + Math.floor(totalMinutes / 1440),
      clock: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
      biome:
        this.player &&
        this.world.isWater(
          this.player.position.x,
          this.player.position.y + 0.2,
          this.player.position.z,
        )
          ? "RIVES TURQUOISE"
          : "PLAINE VERDOYANTE",
      position: this.player?.position || { x: 0, y: 0, z: 0 },
      yaw: this.player?.yaw || 0,
      buffs: [
        ...(this.buffs.impots > this.time
          ? [
              {
                id: "impots",
                name: "Immunité",
                remaining: Math.ceil(this.buffs.impots - this.time),
              },
            ]
          : []),
        ...(this.buffs.furry
          ? [{ id: "furry", name: "Costume furry", remaining: null }]
          : []),
      ],
      targetName: this.entityTarget
        ? this.name(
            this.entityTarget.entity.kind === "hostile"
              ? "urssaf"
              : this.entityTarget.entity.kind,
          )
        : this.name(this.target?.type || ""),
      miningProgress: this.miningProgress,
      fps: this.fps,
      hasSave: !!safeSave(),
      objective: this.discovered.size
        ? `${this.discovered.size} / 16 Lucky Drops découverts`
        : "Trouvez un Lucky Block",
      paused: this.paused,
      stats: this.world?.stats,
      recipes: Object.entries(RECIPES).map(([id, cost]) => ({
        id,
        name: this.name(id),
        cost,
        description:
          id === "chocolatine"
            ? "Cuisine de camp : une recette de survie un peu magique."
            : id === "lucky"
              ? "Un peu de minerai, beaucoup de hasard."
              : "Fabrication artisanale",
        yield: 1,
      })),
    };
  }
  saveData() {
    return {
        version: 1,
        seed: this.seed,
        mode: this.mode,
        time: this.time,
        health: this.health,
        hunger: this.hunger,
        air: this.air,
        buffs: { ...this.buffs },
        discovered: [...this.discovered],
        player: {
          position: this.player.position.toArray(),
          yaw: this.player.yaw,
          pitch: this.player.pitch,
        },
        inventory: this.inv.serialize(),
        world: this.world.serialize(),
        entities: this.entities.serialize(),
    };
  }
  save(notify = false) {
    if (!this.started) return false;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.saveData()));
      if (notify)
        this.ui.notify(
          "Monde, inventaire et objets sauvegardés sur cet appareil.",
          { title: "SAUVEGARDE RÉUSSIE" },
        );
      return true;
    } catch {
      if (notify)
        this.ui.notify("La sauvegarde locale est indisponible ou pleine.", {
          tone: "danger",
        });
      return false;
    }
  }
  load(d = safeSave()) {
    if (!d || d.version!==1 || typeof d.seed!=='string' || !d.player || !d.inventory) return false;
    try {
      this.newGame(d.seed, d.mode);
      this.world.restore(d.world);
      this.world.rebuild();
      this.inv.restore(d.inventory, legalIds);
      const number = (v, fallback) =>
        Number.isFinite(Number(v)) ? Number(v) : fallback;
      this.time = Math.max(0, number(d.time, 0));
      this.health = THREE.MathUtils.clamp(number(d.health, 100), 1, 100);
      this.hunger = THREE.MathUtils.clamp(number(d.hunger, 0), 0, 100);
      this.air = 100;
      this.buffs = {
        impots: Math.min(this.time + 18, number(d.buffs?.impots, 0)),
        furry: !!d.buffs?.furry,
      };
      this.discovered = new Set(
        (Array.isArray(d.discovered) ? d.discovered : []).filter((id) =>
          getItem(id),
        ),
      );
      if (
        Array.isArray(d.player.position) &&
        d.player.position.length === 3 &&
        d.player.position.every(Number.isFinite)
      ) {
        const [x, y, z] = d.player.position,
          h = this.world.worldToHex(x, z),
          inside =
            Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r)) <=
            this.world.radius - 1;
        if (inside && y >= 0 && y <= 68 && !this.player.collides(x, y, z))
          this.player.position.set(x, y, z);
      }
      this.player.yaw = number(d.player.yaw, 0);
      this.player.pitch = THREE.MathUtils.clamp(
        number(d.player.pitch, 0),
        -1.48,
        1.48,
      );
      this.player.updateCamera();
      this.entities.restore(d.entities);
      this.nextSpawn = this.time + 30;
      this.nextSave = this.time + 30;
      this.syncHand();
      return true;
    } catch {
      this.ui.notify("Sauvegarde illisible. Un nouveau monde a été créé.", {
        tone: "danger",
      });
      return false;
    }
  }
  frame(now) {
    const rawDelta = (now - this.previous) / 1000;
    let dt = Math.min(rawDelta, 0.04);
    this.previous = now;
    if (!Number.isFinite(dt) || dt <= 0) dt = 0.016;
    this.elapsed += dt;
    this.fps = Math.round(
      THREE.MathUtils.lerp(
        this.fps,
        1 / Math.max(0.001, rawDelta || 0.016),
        0.025,
      ),
    );
    if (!this.paused) {
      this.time += dt;
      this.updateUse(dt);
      const motion = this.player.update(dt, this.keys, {
        using:this.itemUse.active,canSprint:this.mode==="creative"||this.hunger>30,
        speed: this.buffs.impots > this.time,
        furry: this.buffs.furry,
        creative: this.mode === "creative",
      });
      if (this.mode !== "creative") {
        this.hunger = Math.max(
          0,
          this.hunger -
            dt * (motion.moving ? (motion.sprinting ? 0.105 : 0.063) : 0.027),
        );
        if (this.hunger > 72)
          this.health = Math.min(100, this.health + dt * 0.48);
        if (
          this.hunger === 0 &&
          Math.floor(this.time) !== Math.floor(this.time - dt)
        )
          this.hurt(1);
        this.air = motion.submerged
          ? Math.max(0, this.air - dt * 9)
          : Math.min(100, this.air + dt * 30);
        if (
          this.air === 0 &&
          Math.floor(this.time) !== Math.floor(this.time - dt)
        )
          this.hurt(5);
      }
      this.updateView();
      if (this.time >= this.nextRay) {
        this.updateTarget();
        this.nextRay = this.time + 0.07;
      }
      this.viewModel.visible=this.started&&!this.paused&&!this.screenshotMode&&!this.thirdPerson;
      this.syncHand();
      const handMotion=this.viewModel.update(dt, {mining:this.leftHeld&&!this.rightHeld,usingItem:this.itemUse.active,useProgress:this.itemUse.progress,useKind:getItemUse(this.itemUse.id)?.kind,moving:motion.moving,grounded:this.player.grounded,
        time:this.time,walkTime:this.player.walkTime,lookX:this.lookDelta.x,lookY:this.lookDelta.y,verticalVelocity:this.player.velocity.y});
      this.lookDelta.x=0;this.lookDelta.y=0;
      this.strike(handMotion);
      if(handMotion.phase>=1)this.pendingMelee=false;
      this.mine(dt);
      updatePlayerAvatar(this.avatar,{time:this.time,moving:motion.moving,speed:Math.hypot(this.player.velocity.x,this.player.velocity.z),
        grounded:this.player.grounded,attack:['mine','attack'].includes(handMotion.action)?handMotion.phase:0,jump:this.player.velocity.y});
      const fov=motion.sprinting&&motion.moving?78:73;
      this.camera.fov=THREE.MathUtils.damp(this.camera.fov,fov,8,dt);this.camera.updateProjectionMatrix();
      this.entities.update(dt);
      this.fx.update(dt);
      if (this.time >= this.nextShare) {
        this.nextShare = this.time + 8;
        this.shareResources();
      }
      if (this.time >= this.nextSave) {
        this.save();
        this.nextSave = this.time + 30;
      }
      if (this.time >= this.nextSpawn && this.mode === "survival") {
        this.nextSpawn = this.time + 55;
        const count = this.entities.all.filter(
          (e) => e.kind === "hostile",
        ).length;
        if (count < 5) {
          for (let j = 0; j < 12; j++) {
            const a = Math.random() * Math.PI * 2,
              spawn = this.player.position
                .clone()
                .add(new THREE.Vector3(Math.cos(a) * 20, 0, Math.sin(a) * 20));
            spawn.y = this.world.getGroundHeight(spawn.x, spawn.z);
            if (Number.isFinite(spawn.y) && spawn.y > this.world.seaLevel) {
              this.entities.spawn("hostile", spawn);
              break;
            }
          }
        }
      }
      const radio =
        (this.inv.active === "radio" && (this.inv.counts.radio || 0) > 0) ||
        this.entities.all.some(
          (e) =>
            e.kind === "radio" &&
            !e.pickup &&
            e.model.position.distanceTo(this.player.position) < 10,
        );
      this.audio.updateRadio(radio, this.time);
      this.shake = Math.max(0, this.shake - dt);
      if (this.shake)
        this.camera.rotation.z = (Math.random() - 0.5) * this.shake * 0.07;
    } else {
      this.hand.visible = false;
      this.selection.visible = false;
    }
    this.viewModel.visible = this.hand.visible =
      this.started && !this.paused && !this.screenshotMode && !this.thirdPerson;
    for (const c of this.clouds) {
      c.position.x += dt * 0.13;
      if (c.position.x > 115) c.position.x = -115;
    }
    const dayPhase = ((8 * 60 + 42 + this.time * 1.2) % 1440) / 1440,
      daylight = THREE.MathUtils.clamp(
        Math.sin(dayPhase * Math.PI * 2 - Math.PI / 2) * 1.8 + 0.3,
        0.12,
        1,
      );
    this.sun.intensity = 2.8 * daylight;
    this.hemisphere.intensity = 0.5 + 1.05 * daylight;
    const sky = new THREE.Color(0x142843).lerp(
      new THREE.Color(0x91cbd5),
      daylight,
    );
    this.scene.background.copy(sky);
    this.scene.fog.color
      .copy(sky)
      .lerp(new THREE.Color(0xd6e0cb), daylight * 0.3);
    this.world.updateVisuals(this.time);
    this.presentation.update(daylight,this.sun.position);
    if (this.elapsed >= this.nextHUD) {
      this.ui.update(this.state());
      this.nextHUD = this.elapsed + 0.1;
    }
    this.presentation.render();
    this.viewModel.render();
  }
  installDiagnostics() {
    window.__minecrack = {
      game: this,
      snapshot: () => ({
        state: this.state(),
        world: this.world.stats,
        blocks: this.world.blocks.size,
        entities: this.entities.all.map((e) => ({
          kind: e.kind,
          health: e.health,
          position: e.model.position.toArray(),
          inventory: e.inventory,
          pickup: !!e.pickup,
        })),
        renderer: this.renderer.info.render,
        position: this.player.position.toArray(),
        pointerLocked: !!document.pointerLockElement,
      }),
      start: (mode = "creative", seed = "MINECRACK") => {
        this.newGame(seed, mode);
        this.started = true;
        this.paused = false;
        this.overlay = null;
        this.ui.setOverlay(null, this.state());
        document.body.classList.add("playing-fps");
      },
      pause: () => this.pause(),
      give: (id, n = 1) => {
        if (legalIds.has(id)) {
          this.inv.add(id, n);
          this.syncHand();
        }
      },
      lucky: (id) => {
        if (getItem(id))
          this.openLucky(
            this.player.position
              .clone()
              .addScaledVector(this.player.direction().setY(0), 2),
            id,
          );
      },
      teleport: (x, y, z) => {
        this.player.position.set(x, y, z);
        this.player.velocity.set(0, 0, 0);
        this.player.updateCamera();
      },
      aim: (yaw, pitch) => {
        this.player.yaw = yaw;
        this.player.pitch = pitch;
        this.player.updateCamera();
        this.updateTarget();
      },
      use: (id) => {
        if (legalIds.has(id)) {
          if (!this.inv.counts[id]) this.inv.add(id);
          this.inv.slots[this.inv.selected] = id;
          this.select(this.inv.selected);
          this.lastUse = -Infinity;
          this.use();
        }
      },
      save: () => this.save(),
      load: () => this.load(),
    };
  }
}

try {
  new Minecrack();
} catch (error) {
  console.error(error);
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;inset:0;background:#182b28;color:#fff;display:grid;place-content:center;font:18px system-ui;padding:40px;z-index:9999";
  el.innerHTML =
    "<h1>Minecrack</h1><p>Le moteur 3D n’a pas pu démarrer.</p><p>Vérifiez que l’accélération graphique est activée dans votre navigateur.</p>";
  document.body.append(el);
}
