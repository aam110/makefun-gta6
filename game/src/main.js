// SOLMAR BAY — boot, the one game loop, screens (menu / pause / busted /
// wasted / complete), save & continue, and the staged ?shot= scenes used for
// screenshots. Everything else lives in its own module; this file wires them.

import * as THREE from 'three';
import { START_MONEY, START_POS } from './config.js';
import { createInput, attachInput, wasPressed, isDown, endFrameInput, requestLookLock, releaseLookLock } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, hasSave, clearSave, defaultSave } from './save.js';
import { buildWorld, updateDayCycle } from './world.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';
import { createPlayer, updatePlayer, createCameraRig, updateCamera } from './player.js';
import { initTraffic, updateTraffic, spawnTrafficCar } from './traffic.js';
import { initPedestrians, updatePedestrians, scarePeds } from './pedestrians.js';
import { makeCar, removeCar } from './vehicles.js';
import * as police from './police.js';
import * as combat from './combat.js';
import * as missions from './missions.js';
import * as pedestrians from './pedestrians.js';
import * as vehicles from './vehicles.js';

const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot'); // cover | drive | chase | mission (staged screenshot)
const MAX_DT = 0.05;

// ---------- renderer / scene ----------
const container = document.getElementById('scene-container');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xff9a5c);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 30, 60);

// ---------- shared game state ----------
const G = {
  scene, camera, renderer,
  state: 'menu', // menu | playing | paused | ended
  hour: 17.5,
  elapsed: 0,
  wanted: 0,
  unseenTimer: 0,
  events: [],
  cars: [], peds: [], cops: [], enemies: [], pickups: [],
  mission: { index: 0, stepIndex: 0, active: false, missionsDone: 0, targetCar: null, dialogDone: false },
  player: {
    x: START_POS.x, z: START_POS.z, y: 0, heading: Math.PI,
    onFoot: true, health: 100, armor: 0, money: START_MONEY,
    weapon: 'pistol', ammoInMag: 12, magState: { pistol: 12, smg: 30 },
    reserve: { pistol: 48, smg: 0 }, reloading: false, reloadEndsAt: 0, nextShotAt: 0,
    smgUnlocked: false, car: null, group: null, jacket: '#18b7a6',
  },
  cameraRig: createCameraRig(),
  cameraSnapped: true,
  modules: { police, combat, missions, pedestrians, vehicles },
  input: createInput(),
  audio: createAudio(),
  shotMode: !!SHOT,
};

buildWorld(G);
createEffects(G);
createHud(G);
attachInput(G.input, renderer.domElement);
window.__solmar = G;

// ---------- screens ----------
const $ = (id) => document.getElementById(id);
const screens = { menu: $('menu'), pause: $('pause'), end: $('end-screen'), loading: $('loading') };
let jacketColor = '#18b7a6';

function showOnly(name) {
  for (const [key, el] of Object.entries(screens)) {
    if (key === 'loading') continue;
    el.classList.toggle('hidden', key !== name);
  }
  if (name === null) {
    screens.menu.classList.add('hidden');
    screens.pause.classList.add('hidden');
    screens.end.classList.add('hidden');
  }
}

function resetDynamicWorld() {
  for (const car of [...G.cars]) removeCar(G, car);
  for (const ped of [...G.peds]) G.scene.remove(ped.group);
  G.peds.length = 0;
  for (const cop of [...G.cops]) {
    if (cop.kind === 'car') { if (!cop.car.dead) removeCar(G, cop.car); }
    else G.scene.remove(cop.group);
  }
  G.cops.length = 0;
  for (const e of [...G.enemies]) G.scene.remove(e.group);
  G.enemies.length = 0;
  for (const pk of [...G.pickups]) { G.scene.remove(pk.mesh); G.scene.remove(pk.ring); }
  G.pickups.length = 0;
  if (G.player.group) { G.scene.remove(G.player.group); G.player.group = null; }
  G.events.length = 0;
  G.wanted = 0;
  G.unseenTimer = 0;
  missions.hideMarker(G);
  initTraffic(G);
  initPedestrians(G);
  missions.seedPickups(G);
}

function startGame(saveData) {
  resetDynamicWorld();
  const p = G.player;
  const s = saveData || defaultSave();
  p.x = s.x; p.z = s.z; p.y = 0; p.heading = s.heading;
  p.onFoot = true; p.car = null;
  p.health = s.health; p.armor = s.armor; p.money = s.money;
  p.weapon = 'pistol'; p.ammoInMag = 12;
  p.magState = { pistol: 12, smg: 30 };
  p.reserve = { pistol: 48, smg: s.smgReserve || 0 };
  p.reloading = false; p.smgUnlocked = s.smgUnlocked;
  p.jacket = saveData ? s.jacket : jacketColor;
  G.hour = s.hour;
  G.mission.index = s.missionIndex;
  G.mission.missionsDone = s.missionsDone;
  G.mission.stepIndex = 0;
  G.mission.active = false;
  G.mission.targetCar = null;
  G.cameraRig.yaw = p.heading;
  G.cameraRig.pitch = 0.32;
  G.cameraSnapped = true;
  createPlayer(G, p.jacket);
  G.hud.updateStars();
  showOnly(null);
  G.hud.show();
  G.state = 'playing';
  G.audio.ensure();
  if (!saveData) {
    G.hud.notify('Welcome to Solmar Bay, Rio.', 'good');
    setTimeout(() => G.hud.notify('Follow the yellow M to start your first job.', ''), 1600);
  } else {
    G.hud.notify('Welcome back to Solmar Bay.', 'good');
  }
}

G.saveGame = function saveGame() {
  const p = G.player;
  const ok = writeSave({
    money: p.money, missionIndex: G.mission.index, missionsDone: G.mission.missionsDone,
    x: p.x, z: p.z, heading: p.heading, health: p.health, armor: p.armor,
    wanted: 0, hour: G.hour, jacket: p.jacket,
    smgUnlocked: p.smgUnlocked, smgReserve: p.reserve.smg,
  });
  return ok;
};

G.endGame = function endGame(kind, info) {
  G.state = 'ended';
  releaseLookLock();
  G.audio.setEngine(0, false);
  G.audio.setSiren(false);
  $('end-title').textContent = info.title;
  $('end-sub').textContent = info.sub;
  const p = G.player;
  $('end-stats').textContent = `Cash ${'$' + Math.floor(p.money).toLocaleString('en-US')} · Missions ${G.mission.missionsDone}/5 · Wanted ${'★'.repeat(G.wanted) || 'clear'}`;
  G.hud.hide();
  showOnly('end');
  G._endKind = kind;
};

function resumeFromEnd() {
  showOnly(null);
  G.hud.show();
  G.state = 'playing';
  G.audio.ensure();
}

function pauseGame() {
  if (G.state !== 'playing') return;
  G.state = 'paused';
  releaseLookLock();
  G.audio.setEngine(0, false);
  G.audio.setSiren(false);
  showOnly('pause');
}

function resumeGame() {
  if (G.state !== 'paused') return;
  showOnly(null);
  G.state = 'playing';
  G.audio.ensure();
}

// ---------- menu wiring ----------
$('btn-new').addEventListener('click', () => {
  G.audio.ensure();
  G.audio.click();
  clearSave();
  startGame(null);
});
const continueBtn = $('btn-continue');
function refreshContinue() {
  continueBtn.disabled = !hasSave();
  const s = loadSave();
  continueBtn.textContent = s ? `CONTINUE — Mission ${Math.min(s.missionIndex + 1, 5)}/5 · $${Math.floor(s.money).toLocaleString('en-US')}` : 'CONTINUE';
}
refreshContinue();
continueBtn.addEventListener('click', () => {
  const s = loadSave();
  if (!s) return;
  G.audio.ensure();
  G.audio.click();
  startGame(s);
});
document.querySelectorAll('#jacket-row .swatch').forEach((sw) => {
  sw.addEventListener('click', () => {
    document.querySelectorAll('#jacket-row .swatch').forEach((x) => x.classList.remove('sel'));
    sw.classList.add('sel');
    jacketColor = sw.dataset.color;
    G.audio.ensure();
    G.audio.click();
  });
});
$('btn-resume').addEventListener('click', () => { G.audio.click(); resumeGame(); });
$('btn-save').addEventListener('click', () => {
  const ok = G.saveGame();
  G.hud.notify(ok ? 'Game saved.' : 'Save failed (storage unavailable).', ok ? 'good' : 'bad');
  refreshContinue();
});
$('btn-quit').addEventListener('click', () => {
  G.saveGame();
  G.state = 'menu';
  G.hud.hide();
  showOnly('menu');
  refreshContinue();
});
$('btn-retry').addEventListener('click', () => { G.audio.click(); resumeFromEnd(); });
$('btn-end-menu').addEventListener('click', () => {
  G.audio.click();
  G.state = 'menu';
  G.hud.hide();
  showOnly('menu');
  refreshContinue();
});

// click the 3D view to capture the mouse for looking around
renderer.domElement.addEventListener('click', () => {
  if (G.state === 'playing' && !G.hud.dialogActive) requestLookLock(renderer.domElement);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.state === 'playing' && !G.shotMode) pauseGame();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- staged screenshot scenes ----------

function putPlayerInCar(G, kind, x, z, heading, speed, color) {
  const car = makeCar(G, kind, x, z, heading, { driver: 'player', color });
  car.speed = speed;
  const p = G.player;
  p.car = car;
  p.onFoot = false;
  p.group.visible = false;
  p.x = x; p.z = z; p.heading = heading;
  G.cameraRig.yaw = heading;
  G.cameraSnapped = true;
  return car;
}

function spawnChasers(G, spots) {
  for (const [x, z] of spots) {
    const p = G.player;
    const heading = Math.atan2(-(p.x - x), -(p.z - z));
    const car = makeCar(G, 'police', x, z, heading, { driver: 'police' });
    car.speed = 22;
    car.ai = { mode: 'chase' };
    G.cops.push({ kind: 'car', car, arrestTimer: 0, shootTimer: 1 });
  }
}

function stageShot(name) {
  startGame(null);
  const p = G.player;
  if (name === 'cover') {
    // sunset police chase down a downtown avenue, wanted 3, mission objective live.
    // Two patrol cars are ahead of the player so the chase reads in frame;
    // one more closes in from behind (visible on the minimap).
    G.hour = 17.8;
    putPlayerInCar(G, 'sport', 40, 70, 0, 24, 0xd94f8a);
    police.setWanted(G, 3, 'Stolen Falcon GT');
    spawnChasers(G, [[34, 38], [48, 28], [40, 105]]);
    spawnTrafficCar(G, true);
    spawnTrafficCar(G, true);
    G.mission.index = 0;
    G.mission.active = true;
    G.mission.stepIndex = 1; // deliver the parcel
    G.hud.notify('Mission: First Delivery', 'good');
  } else if (name === 'drive') {
    // fast cruise down a busy avenue at golden hour
    G.hour = 17.4;
    putPlayerInCar(G, 'muscle', 40, -60, Math.PI, 30, 0xef7d1a);
    for (let i = 0; i < 5; i++) spawnTrafficCar(G, true);
    p.money = 1250;
  } else if (name === 'chase') {
    // full manhunt on the north edge, wanted 4. Player x=30 keeps the
    // camera off the streetlight line (lamps sit at road+8.4); two patrol
    // cars are ahead in frame, one closes from behind.
    G.hour = 18.5;
    putPlayerInCar(G, 'sedan', 30, -160, -Math.PI / 2, 32, 0x2e7fd9);
    police.setWanted(G, 4, 'Manhunt');
    spawnChasers(G, [[70, -154], [58, -166], [-14, -160]]);
    p.money = 3400;
  } else if (name === 'mission') {
    // on foot south of the plaza, briefing dialog open, downtown ahead
    G.hour = 17.6;
    p.x = 6; p.z = 30; p.heading = 0;
    p.group.position.set(p.x, 0, p.z);
    p.group.rotation.y = 0;
    G.cameraRig.yaw = 0; // camera behind Rio, looking north into downtown
    G.cameraSnapped = true;
    missions.startMission(G, 0);
  }
  // let the world settle a few frames, then signal the screenshot tool
  setTimeout(() => { window.__shotReady = true; }, 2600);
}

// ---------- main loop ----------

let last = performance.now();
let firstFrame = true;
let autoSaveTimer = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, MAX_DT);
  last = now;
  G.elapsed += dt;

  if (G.state === 'playing') {
    updateDayCycle(G, dt);
    // pause keys
    if (wasPressed(G.input, 'Escape') || wasPressed(G.input, 'KeyP')) pauseGame();
    // story dialog advances on Enter / click / Space
    if (G.hud.dialogActive) {
      if (wasPressed(G.input, 'Enter') || wasPressed(G.input, 'Space') || G.input.mouseClicked) {
        G.hud.advanceDialog();
      }
    } else {
      updatePlayer(G, dt);
    }
    updateTraffic(G, dt);
    updatePedestrians(G, dt);
    // world events: scare crowds, then let the law react
    for (const e of G.events) {
      if (e.type === 'explosion') scarePeds(G, e.x, e.z, 45);
      else if (e.type === 'crash') scarePeds(G, e.x, e.z, 20);
    }
    police.handleCrimeEvents(G);
    G.events.length = 0;
    if (G.state === 'playing') {
      police.updatePolice(G, dt);
      combat.updateEnemies(G, dt);
      combat.updatePickups(G, dt);
      missions.updateMissions(G, dt);
      updateCamera(G, dt);
      G.fx.update(dt);
      G.hud.update(dt);
    }
    autoSaveTimer += dt;
    if (autoSaveTimer > 30) { autoSaveTimer = 0; G.saveGame(); }
  } else if (G.state === 'menu') {
    // living backdrop behind the title: traffic, crowds, slow orbit
    updateDayCycle(G, dt);
    updateTraffic(G, dt);
    updatePedestrians(G, dt);
    G.fx.update(dt);
    const t = G.elapsed * 0.045;
    camera.position.set(Math.sin(t) * 62, 30, Math.cos(t) * 62);
    camera.lookAt(0, 4, 0);
  } else if (G.state === 'paused' || G.state === 'ended') {
    // frozen world, still rendering
  }

  renderer.render(scene, camera);
  endFrameInput(G.input);

  if (firstFrame) {
    firstFrame = false;
    screens.loading.classList.add('hidden');
  }
  void isDown;
}

// boot: ambient city behind the menu, or straight into a staged shot
resetDynamicWorld();
createPlayer(G, jacketColor);
if (SHOT) stageShot(SHOT);
requestAnimationFrame(frame);
