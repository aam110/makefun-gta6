// Palmera Heat — bootstrap, game loop and screens.
// This file wires the whole game together: renderer, sun and sky, the city,
// the player, traffic, pedestrians, police, missions, HUD, audio and the
// save. It owns the screen state machine (title / playing / paused /
// busted / wasted / complete) and the mission-start markers in free roam.

import * as THREE from 'three';
import { Rng } from './rng.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { City } from './city.js';
import { TrafficManager, Car } from './vehicles.js';
import { PedestrianManager } from './pedestrians.js';
import { Player } from './player.js';
import { PoliceManager } from './police.js';
import { MissionManager, MISSIONS } from './missions.js';
import { HUD } from './hud.js';
import { ChaseCamera } from './camera.js';
import { Effects } from './effects.js';
import { loadSave, saveGame, clearSave, defaultSave } from './save.js';
import { applyShot } from './staging.js';
import { PALETTE, LANDMARKS, ECONOMY, WANTED } from './config.js';

const params = new URLSearchParams(window.location.search);
const SEED = parseInt(params.get('seed') || '7', 10) || 7;
const SHOT = params.get('shot');

export class Game {
  constructor() {
    this.rng = new Rng(SEED);
    this.audio = new AudioEngine();
    this.input = new Input();
    this.state = 'title'; // title | playing | paused | busted | wasted | complete
    this.time = 0;
    this.cash = ECONOMY.startCash;
    this.nextMissionIndex = 0;
    this.completedMissions = [];
    this.storyComplete = false;
    this.stats = { kills: 0, carsStolen: 0, missionsDone: 0, playSeconds: 0, busted: 0, wasted: 0 };
    this.titleOrbit = 0;
    this.saveTimer = 0;
    this.missionStartPos = null;
    this.missionStartBeacon = null;

    this._setupRenderer();
    this._setupWorld();
    this._setupScreens();
    this._setupMissionStart();
    this.input.attach(this.renderer.domElement);

    if (SHOT) {
      applyShot(this, SHOT);
    } else {
      this._showTitle();
    }
    this.renderer.setAnimationLoop(() => this._loop());
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.sky);
    this.scene.fog = new THREE.Fog(PALETTE.fog, 200, 750);

    this.threeCamera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.threeCamera.position.set(0, 40, -80);

    const hemi = new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, PALETTE.hemiIntensity);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(PALETTE.sun, PALETTE.sunIntensity);
    this.sun.position.set(120, 180, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -110;
    this.sun.shadow.camera.right = 110;
    this.sun.shadow.camera.top = 110;
    this.sun.shadow.camera.bottom = -110;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 500;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    window.addEventListener('resize', () => {
      this.threeCamera.aspect = window.innerWidth / window.innerHeight;
      this.threeCamera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _setupWorld() {
    this.city = new City(this.scene, this.rng);
    this.effects = new Effects(this.scene);
    this.traffic = new TrafficManager(this.scene, this.city, this.rng.fork());
    this.peds = new PedestrianManager(this.scene, this.city, this.rng.fork());
    this.police = new PoliceManager(this.scene, this.city, this.rng.fork());
    this.missions = new MissionManager(this.scene, this.city, this.rng.fork());
    this.hud = new HUD();
    this.camera = new ChaseCamera(this.threeCamera);

    const saved = loadSave();
    const start = saved ? saved.player : { x: 0, z: 180, heading: Math.PI };
    this.player = new Player(this.scene, start.x, start.z, start.heading);
    if (saved) {
      this.cash = saved.cash;
      this.nextMissionIndex = saved.nextMission;
      this.completedMissions = saved.completedMissions;
      this.storyComplete = saved.storyComplete;
      this.stats = saved.stats;
      this.player.health = saved.health;
      this._savedGame = saved;
    }
    this.traffic.spawnInitial(18, this.player.pos);
    this.peds.spawnInitial(26, this.player.pos);

    // The world object every system reads.
    this.world = {
      scene: this.scene,
      threeCamera: this.threeCamera,
      city: this.city,
      traffic: this.traffic,
      peds: this.peds,
      police: this.police,
      missions: this.missions,
      hud: this.hud,
      effects: this.effects,
      audio: this.audio,
      input: this.input,
      camera: this.camera,
      player: this.player,
      time: 0,
      cash: this.cash,
      nextMission: this.nextMission,
      missionStartPos: null,
      onEnterCar: (car) => this.onEnterCar(car),
      onExitCar: () => this.onExitCar(),
      onInteractKey: () => this.onInteractKey(),
      onPedKilled: (ped) => this.onPedKilled(ped),
      onCarDestroyed: (car, byPlayer) => this.onCarDestroyed(car, byPlayer),
      onPlayerWasted: () => this.onPlayerWasted(),
      onPlayerBusted: () => this.onPlayerBusted(),
      onMissionPassed: (m) => this.onMissionPassed(m),
      onMissionFailed: (reason) => this.onMissionFailed(reason),
    };
    this.camera.snapBehind(this.player.pos, this.player.heading, false);
  }

  get nextMission() {
    return this.nextMissionIndex < MISSIONS.length ? MISSIONS[this.nextMissionIndex] : null;
  }

  _setupMissionStart() {
    // A golden M beacon marks where the next mission begins.
    const beacon = new THREE.Group();
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 50, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd24d, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    column.position.y = 25;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 3.4, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd24d, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    beacon.add(column, ring);
    beacon.visible = false;
    this.scene.add(beacon);
    this.missionStartBeacon = beacon;
    this._updateMissionStart();
  }

  _updateMissionStart() {
    const starts = [
      { x: LANDMARKS.garage.x + 14, z: LANDMARKS.garage.z },
      { x: LANDMARKS.apartment.x, z: LANDMARKS.apartment.z + 16 },
      { x: LANDMARKS.boardwalk.x, z: LANDMARKS.boardwalk.z },
      { x: LANDMARKS.casino.x, z: LANDMARKS.casino.z + 22 },
      { x: LANDMARKS.safehouse.x, z: LANDMARKS.safehouse.z + 12 },
    ];
    const next = this.nextMission;
    if (next && this.missions.state === 'free') {
      this.missionStartPos = starts[next.id];
      this.world.missionStartPos = this.missionStartPos;
      this.missionStartBeacon.visible = true;
      this.missionStartBeacon.position.set(this.missionStartPos.x, 0, this.missionStartPos.z);
    } else {
      this.missionStartPos = null;
      this.world.missionStartPos = null;
      this.missionStartBeacon.visible = false;
    }
  }

  // --- Screens ---------------------------------------------------------------

  _setupScreens() {
    const $ = (id) => document.getElementById(id);
    $('btn-new').addEventListener('click', () => {
      this.audio.init();
      this.audio.uiClick();
      clearSave();
      const fresh = defaultSave();
      this.cash = fresh.cash;
      this.nextMissionIndex = 0;
      this.completedMissions = [];
      this.storyComplete = false;
      this.stats = fresh.stats;
      this.player.health = 100;
      this.player.mesh.position.set(0, 0, 180);
      this.player.heading = Math.PI;
      this.startGame();
    });
    const continueBtn = $('btn-continue');
    if (this._savedGame) {
      continueBtn.classList.remove('hidden');
      $('save-info').textContent = `Continue — $${this._savedGame.cash.toLocaleString('en-US')} · Mission ${this._savedGame.nextMission + 1} of ${MISSIONS.length}`;
      continueBtn.addEventListener('click', () => {
        this.audio.init();
        this.audio.uiClick();
        this.startGame();
      });
    }
    $('btn-help').addEventListener('click', () => {
      this.audio.init();
      this.audio.uiClick();
      $('help-screen').classList.remove('hidden');
    });
    $('btn-help-close').addEventListener('click', () => {
      this.audio.uiClick();
      $('help-screen').classList.add('hidden');
    });
    $('btn-resume').addEventListener('click', () => this.resumeGame());
    $('btn-save').addEventListener('click', () => {
      this._doSave();
      this.hud.showToast('Game saved.');
    });
    $('btn-restart-mission').addEventListener('click', () => {
      this.audio.uiClick();
      if (this.missions.state === 'active') {
        this.missions.retry(this.world);
        this.hud.showToast('Mission restarted.');
      }
      this.resumeGame();
    });
    $('btn-quit').addEventListener('click', () => {
      this.audio.uiClick();
      this._doSave();
      this._showTitle();
    });
    $('btn-retry').addEventListener('click', () => {
      this.audio.uiClick();
      this._hideEndScreens();
      this.player.health = 100;
      this.police.setStars(0);
      this.peds.clearCops();
      if (this.missions.state === 'failed') this.missions.retry(this.world);
      this.state = 'playing';
      this.hud.show();
    });
    $('btn-freeroam').addEventListener('click', () => {
      this.audio.uiClick();
      this._hideEndScreens();
      this.player.health = 100;
      this.police.setStars(0);
      this.peds.clearCops();
      this.missions.state = 'free';
      this._updateMissionStart();
      this.state = 'playing';
      this.hud.show();
    });
    $('btn-complete-continue').addEventListener('click', () => {
      this.audio.uiClick();
      $('complete-screen').classList.add('hidden');
      this.state = 'playing';
      this.hud.show();
    });
    $('btn-sound').addEventListener('click', () => {
      const muted = !this.audio.muted;
      this.audio.setMuted(muted);
      $('btn-sound').textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
    });
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') {
        const muted = !this.audio.muted;
        this.audio.setMuted(muted);
        this.hud.showToast(muted ? 'Sound off' : 'Sound on');
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === 'playing') this.pauseGame();
        else if (this.state === 'paused') this.resumeGame();
      }
    });
  }

  _showTitle() {
    this.state = 'title';
    this.input.releasePointerLock();
    this.hud.hide();
    document.getElementById('pause-screen').classList.add('hidden');
    this._hideEndScreens();
    document.getElementById('title-screen').classList.remove('hidden');
    this.audio.stopMusic();
  }

  _hideEndScreens() {
    document.getElementById('end-screen').classList.add('hidden');
    document.getElementById('complete-screen').classList.add('hidden');
  }

  startGame({ skipTitle = false } = {}) {
    this.audio.init();
    this.audio.startMusic();
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    this._hideEndScreens();
    this.state = 'playing';
    this.hud.show();
    this._updateMissionStart();
    if (!skipTitle) {
      this.hud.showBanner('PALMERA CITY', 'Welcome back, Mara.', 3200);
      this.hud.showSubtitle('Theo', 'Mara! Get to my garage — the yellow M on your map.', 5000);
    }
    this.camera.snapBehind(this.player.pos, this.player.heading, this.player.inCar);
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.releasePointerLock();
    document.getElementById('pause-screen').classList.remove('hidden');
    this.audio.setEngine(0, false);
    this.audio.setSiren(0, 0);
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.audio.uiClick();
    this.state = 'playing';
    document.getElementById('pause-screen').classList.add('hidden');
  }

  _doSave() {
    const ok = saveGame({
      cash: this.cash,
      nextMission: this.nextMissionIndex,
      completedMissions: this.completedMissions,
      storyComplete: this.storyComplete,
      player: { x: this.player.pos.x, z: this.player.pos.z, heading: this.player.heading },
      health: this.player.health,
      stats: this.stats,
    });
    return ok;
  }

  // --- Game events -----------------------------------------------------------

  onEnterCar(car) {
    const wasTraffic = car.driver === 'traffic';
    const wasParked = car.driver === 'parked';
    this.player.enterCar(car);
    this.audio.uiClick();
    if (wasTraffic || wasParked) {
      this.stats.carsStolen++;
      // Stealing in front of a cop or a crowd draws heat.
      const copNear = this.police.nearestOfficerDist(this.player.pos, this.peds) < 80;
      const pedNear = this.peds.nearestPed(this.player.pos, 16);
      if (copNear || pedNear) {
        this.police.addHeat(WANTED.steal, 'stolen car');
        this.hud.showToast('Car stolen — the cops noticed!');
      } else {
        this.hud.showToast('Car stolen. Nice and quiet.');
      }
      if (wasTraffic) {
        // Pull the traffic car out of the traffic list.
        const i = this.traffic.cars.indexOf(car);
        if (i >= 0) this.traffic.cars.splice(i, 1);
        this.traffic.parked.push(car);
      }
    }
    this.camera.snapBehind(this.player.pos, car.heading, true);
  }

  onExitCar() {
    this.player.exitCar();
    this.camera.snapBehind(this.player.pos, this.player.heading, false);
  }

  onInteractKey() {
    if (this.missions.tryInteract(this.world)) return;
    // Safehouse: heal up and save.
    const s = LANDMARKS.safehouse;
    if (Math.hypot(this.player.pos.x - s.x, this.player.pos.z - s.z) < 10) {
      this.player.heal(100);
      this._doSave();
      this.hud.showToast('Safehouse — healed and saved.');
    }
  }

  onPedKilled(ped) {
    this.stats.kills++;
    if (ped.isCop) {
      this.police.addHeat(WANTED.killCop, 'killed officer');
      this.hud.showToast('You killed a cop. The whole city is coming.');
    } else {
      this.police.addHeat(WANTED.killPed, 'killed pedestrian');
    }
    this.peds.scare(ped.pos.x, ped.pos.z, 35);
  }

  onCarDestroyed(car, byPlayer) {
    this.effects.explosion(car.pos.x, 1, car.pos.z);
    this.audio.explosion();
    this.camera.addShake(0.7);
    this.peds.scare(car.pos.x, car.pos.z, 40);
    if (car === this.player.car) {
      this.player.exitCar();
      this.player.takeDamage(25, this.world);
      this.hud.showToast('Your car is wrecked!');
    }
    if (car.kind === 'police') {
      this.police.addHeat(byPlayer ? 60 : 20, 'destroyed police car');
    }
  }

  onPlayerWasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.stats.wasted++;
    this.cash = Math.max(0, this.cash - ECONOMY.wastedBill);
    this.input.releasePointerLock();
    this.audio.missionFail();
    this.audio.stopMusic();
    if (this.player.inCar) this.player.exitCar();
    this.player.mesh.position.set(LANDMARKS.hospital.x, 0, LANDMARKS.hospital.z + 18);
    this.player.health = 100;
    this.police.setStars(0);
    this.peds.clearCops();
    this._showEndScreen('WASTED', `The hospital patched you up. Bill: $${ECONOMY.wastedBill}.`);
    if (this.missions.state === 'active') this.missions.failMission(this.world, 'wasted');
  }

  onPlayerBusted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.stats.busted++;
    this.cash = Math.max(0, this.cash - ECONOMY.bustedFine);
    this.input.releasePointerLock();
    this.audio.missionFail();
    this.audio.stopMusic();
    if (this.player.inCar) this.player.exitCar();
    this.player.mesh.position.set(LANDMARKS.policeStation.x, 0, LANDMARKS.policeStation.z + 18);
    this.player.health = 100;
    this.police.setStars(0);
    this.peds.clearCops();
    this._showEndScreen('BUSTED', `Palmera PD let you go. Fine: $${ECONOMY.bustedFine}.`);
    if (this.missions.state === 'active') this.missions.failMission(this.world, 'busted');
  }

  _showEndScreen(title, sub) {
    document.getElementById('end-title').textContent = title;
    document.getElementById('end-sub').textContent = sub;
    document.getElementById('end-screen').classList.remove('hidden');
    this.hud.hide();
  }

  onMissionPassed(mission) {
    this.cash += mission.reward;
    this.world.cash = this.cash;
    this.stats.missionsDone++;
    this.completedMissions.push(mission.id);
    this.nextMissionIndex = mission.id + 1;
    this.audio.cashRegister();
    this.audio.missionPass();
    this._doSave();
    this.hud.showBanner('MISSION PASSED', `${mission.title}  ·  +$${mission.reward.toLocaleString('en-US')}`, 4200);
    if (this.nextMissionIndex >= MISSIONS.length) {
      this.storyComplete = true;
      this._doSave();
      setTimeout(() => {
        if (this.state !== 'playing') return;
        this.state = 'complete';
        this.input.releasePointerLock();
        document.getElementById('complete-screen').classList.remove('hidden');
        document.getElementById('complete-stats').textContent =
          `Missions: ${this.stats.missionsDone} · Cars stolen: ${this.stats.carsStolen} · Cash: $${Math.round(this.cash).toLocaleString('en-US')}`;
      }, 4500);
    } else {
      this.missions.state = 'free';
      this._updateMissionStart();
    }
  }

  onMissionFailed(reason) {
    this.audio.missionFail();
    this.hud.showBanner('MISSION FAILED', reason, 4200);
    // The failed screen offers retry; free-roam players get the banner only.
    if (this.state === 'playing') {
      setTimeout(() => {
        if (this.missions.state === 'failed' && this.state === 'playing') {
          this.state = 'wasted';
          this._showEndScreen('MISSION FAILED', reason);
        }
      }, 4200);
    }
  }

  // --- Loop -------------------------------------------------------------------

  _loop() {
    const dt = Math.min(0.05, this.renderer.info.render.frame === 0 ? 0.016 : this._clockDelta());
    this.time += dt;
    this.world.time = this.time;

    if (this.state === 'title') {
      // Slow cinematic orbit over the city behind the title screen.
      this.titleOrbit += dt * 0.02;
      const cx = 60 + Math.sin(this.titleOrbit) * 120;
      const cz = -40 + Math.cos(this.titleOrbit) * 120;
      this.threeCamera.position.set(cx, 55, cz);
      this.threeCamera.lookAt(60, 0, -60);
      this.city.update(dt, this.time);
      this.effects.update(dt, this.threeCamera);
      this.renderer.render(this.scene, this.threeCamera);
      return;
    }
    if (this.state === 'paused') {
      this.renderer.render(this.scene, this.threeCamera);
      this.input.endFrame();
      return;
    }
    if (this.state === 'busted' || this.state === 'wasted' || this.state === 'complete') {
      this.city.update(dt, this.time);
      this.effects.update(dt, this.threeCamera);
      this.camera.update(dt, this.world);
      this.renderer.render(this.scene, this.threeCamera);
      this.input.endFrame();
      return;
    }

    // Playing.
    this.stats.playSeconds += dt;
    this.player.update(dt, this.world);
    this.traffic.update(dt, this.player.pos, this.player.inCar ? this.player.car : null, this.police.cars, this.effects);
    this.peds.update(dt, this.world);
    this.police.update(dt, this.world);
    this.missions.update(dt, this.world);
    this.city.update(dt, this.time);
    this.effects.update(dt, this.threeCamera);
    this.camera.update(dt, this.world);

    // Interaction prompt.
    if (!this.player.inCar) {
      const car = this.traffic.stealableNear(this.player.pos, 4);
      const step = this.missions.step;
      const nearInteract = this.missions.state === 'active' && step && (step.type === 'talk' || step.type === 'grab') && step.pos
        && Math.hypot(this.player.pos.x - step.pos.x, this.player.pos.z - step.pos.z) < 5;
      if (car) this.hud.setPrompt('Press E — Steal Car');
      else if (nearInteract) this.hud.setPrompt('Press E — Interact');
      else this.hud.setPrompt(null);
    } else {
      this.hud.setPrompt(null);
    }

    // Mission start: walk or drive into the golden M.
    if (this.missions.state === 'free' && this.missionStartPos) {
      const d = Math.hypot(this.player.pos.x - this.missionStartPos.x, this.player.pos.z - this.missionStartPos.z);
      if (d < 7) {
        this.missionStartBeacon.visible = false;
        this.missions.startMission(this.nextMissionIndex, this.world);
        this._updateMissionStart();
      }
    }

    // Engine sound follows the player's car.
    if (this.player.inCar && this.player.car) {
      this.audio.setEngine(Math.abs(this.player.car.speed) / this.player.car.maxSpeed, true);
    } else {
      this.audio.setEngine(0, false);
    }

    // The sun follows the player so shadows stay crisp.
    this.sun.position.set(this.player.pos.x + 120, 180, this.player.pos.z + 60);
    this.sun.target.position.set(this.player.pos.x, 0, this.player.pos.z);
    this.sun.target.updateMatrixWorld();

    // Autosave every 45 seconds.
    this.saveTimer += dt;
    if (this.saveTimer > 45) {
      this.saveTimer = 0;
      this._doSave();
    }

    this.world.cash = this.cash;
    this.world.nextMission = this.nextMission;
    this.hud.update(dt, this.world);
    this.renderer.render(this.scene, this.threeCamera);
    this.input.endFrame();
  }

  _clockDelta() {
    const now = performance.now();
    if (!this._lastNow) this._lastNow = now;
    const dt = Math.min(0.05, (now - this._lastNow) / 1000);
    this._lastNow = now;
    return dt || 0.016;
  }
}

window.__palmeraGame = new Game();
