// CAYO BRAVO — main.js: entry point. Builds the renderer, the world and every
// system, runs the game loop, wires the menus, and handles the action keys.
// Play it: NEW GAME on the title screen, or ?shot=chase for a staged chase.

import * as THREE from 'three';
import { WORLD, CREW, RADIO_STATIONS, mulberry32 } from './config.js';
import { buildWorld } from './world.js';
import { createPlayer, updatePlayerOnFoot, updateChaseCamera, updateTitleCamera } from './player.js';
import { spawnVehicle, updatePlayerCar, enterCar, exitCar, nearestVehicle, spawnParkedCars, syncCarMesh } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPedestrians, spawnFleeingPed, updatePed, updateHostilePed } from './pedestrians.js';
import { createPoliceState, updatePolice, raiseWanted } from './police.js';
import { createMissionState, updateMissions, startMission } from './missions.js';
import { createCombatState, fireWeapon, punch, reloadWeapon, selectWeapon, updateCombat } from './combat.js';
import { createHud } from './hud.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { readSlot, writeSlot, slotSummary, snapshotGame, applySnapshot, readSettings, writeSettings } from './save.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SEED = parseInt(params.get('seed') || '7', 10);
const SHOT = params.get('shot') || '';

// ---------- Renderer / scene ----------
// ?aa=0 disables MSAA and ?noshadow=1 disables shadows (low-end / CI runs).
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: params.get('aa') !== '0', powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = params.get('noshadow') !== '1';
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(-160, 26, -40);

// ---------- Game state ----------
const G = {
  scene, camera, renderer,
  rng: mulberry32(SEED),
  clock: WORLD.sunsetHour,
  cameraYaw: Math.PI,
  started: false, paused: false, over: false,
  ghostTimer: 0, eyesOutTimer: 0, bustedTimer: 0,
  vehicles: [], peds: [],
  settings: { volume: 70, sensitivity: 100, quality: 'high', radio: 0, ...readSettings() },
};
G.world = buildWorld(scene, SEED);
G.player = createPlayer(scene, -90, -150);
G.police = createPoliceState();
G.missions = createMissionState();
G.combat = createCombatState();
G.input = createInput();
G.audio = createAudio();
G.effects = createEffects(scene);
G.hud = createHud();
G.pedestrians = { spawnFleeingPed: (x, z) => spawnFleeingPed(G, x, z) };
G.audio.setVolume(G.settings.volume / 100);
G.audio.setStation(G.settings.radio || 0);
G.input.sensitivity = (G.settings.sensitivity || 100) / 100;

spawnTraffic(G, 20, SEED + 11);
spawnParkedCars(G, mulberry32(SEED + 23), 12);
spawnPedestrians(G, 30, SEED + 37);
// The player's starter ride waits by the garage.
const starter = spawnVehicle(scene, 2, -82, -150, Math.PI / 2);
G.vehicles.push(starter);

window.__G = G;

// ---------- Menus ----------
const $ = (id) => document.getElementById(id);
let slotsMode = 'load';
let settingsReturn = 'title';

function showTitle() {
  $('title-screen').classList.remove('hidden');
  G.hud.hide();
  G.started = false;
  G.paused = false;
  G.over = false;
}

function startGame(fresh) {
  G.audio.init();
  if (G.audio.ctx && G.audio.ctx.state === 'suspended') G.audio.ctx.resume();
  $('title-screen').classList.add('hidden');
  $('slots-screen').classList.add('hidden');
  $('pause-screen').classList.add('hidden');
  $('end-screen').classList.add('hidden');
  G.hud.show();
  G.started = true;
  G.paused = false;
  G.over = false;
  if (fresh) {
    G.player.money = 250; G.player.rp = 0; G.player.rankIndex = 0;
    G.player.health = 100; G.player.armour = 0; G.player.wanted = 0;
    G.player.x = -90; G.player.z = -150; G.player.heading = Math.PI;
    G.player.mesh.position.set(-90, 0, -150);
    G.player.mesh.visible = true;
    G.player.onFoot = true;
    G.player.car = null;
    G.missions.index = 0; G.missions.completed = 0;
    G.clock = WORLD.sunsetHour;
  }
  G.missions.nextIndex = G.missions.index;
  G.missions.nextTimer = 1.2;
  G.audio.uiClick();
}

G.endGame = function endGame(win, kind) {
  if (G.over) return;
  G.over = true;
  G.started = false;
  const box = $('end-screen');
  box.classList.remove('hidden');
  if (win) {
    $('end-title').textContent = 'CAYO BRAVO IS YOURS';
    $('end-title').style.color = '#ffd21f';
    $('end-text').textContent = 'All 8 missions complete. Salas is finished, the sunset is yours, and the island remembers the name Río. Final purse: $' + G.player.money.toLocaleString('en-US') + '.';
    G.audio.missionComplete();
  } else if (kind === 'busted') {
    $('end-title').textContent = 'BUSTED';
    $('end-title').style.color = '#2f7bff';
    $('end-text').textContent = 'The CBPD dragged you in. Bail is $500 — the crew will spring you, but the mission restarts.';
    G.player.money = Math.max(0, G.player.money - 500);
  } else {
    $('end-title').textContent = 'WASTED';
    $('end-title').style.color = '#ff3b30';
    $('end-text').textContent = 'Río went down on the streets of Cayo Bravo. The crew pulls him out — the mission restarts.';
    G.audio.missionFail();
  }
};

function retryMission() {
  $('end-screen').classList.add('hidden');
  G.player.health = 100;
  G.player.armour = 50;
  G.player.wanted = 0;
  G.player.dead = false;
  if (G.player.car) { G.player.car.isPlayer = false; G.player.car = null; }
  G.player.onFoot = true;
  G.player.mesh.visible = true;
  G.player.x = -90; G.player.z = -150;
  G.player.mesh.position.set(-90, 0, -150);
  G.over = false;
  G.started = true;
  G.hud.show();
  startMission(G, G.missions.index);
}

function renderSlots() {
  const list = $('slot-list');
  list.innerHTML = '';
  for (let i = 1; i <= 3; i++) {
    const s = slotSummary(i);
    const btn = document.createElement('button');
    btn.className = 'slot-btn';
    btn.innerHTML = s
      ? `<b>SLOT ${i} — MISSION ${s.mission} · $${s.money.toLocaleString('en-US')}</b><span>Saved ${s.when}</span>`
      : `<b>SLOT ${i} — EMPTY</b><span>No save yet</span>`;
    btn.addEventListener('click', () => {
      G.audio.uiClick();
      if (slotsMode === 'save') {
        writeSlot(i, snapshotGame(G));
        G.hud.toast('GAME SAVED — SLOT ' + i);
        $('slots-screen').classList.add('hidden');
        if (G.paused) $('pause-screen').classList.remove('hidden');
        renderSlots();
      } else if (s) {
        const data = readSlot(i);
        applySnapshot(G, data);
        startGame(false);
        startMission(G, data.missionIndex);
        G.hud.toast('LOADED SLOT ' + i + ' — MISSION ' + (data.missionIndex + 1));
      }
    });
    list.appendChild(btn);
  }
}

function openSlots(mode) {
  slotsMode = mode;
  renderSlots();
  $('slots-screen').classList.remove('hidden');
}

function applySettings() {
  const s = G.settings;
  G.audio.setVolume(s.volume / 100);
  G.input.sensitivity = s.sensitivity / 100;
  if (s.quality === 'low') {
    renderer.shadowMap.enabled = false;
    renderer.setPixelRatio(1);
  } else {
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
  G.audio.setStation(s.radio);
  writeSettings(s);
}

$('btn-new').addEventListener('click', () => startGame(true));
$('btn-load').addEventListener('click', () => { G.audio.init(); G.audio.uiClick(); openSlots('load'); });
$('btn-settings').addEventListener('click', () => { settingsReturn = 'title'; $('settings-screen').classList.remove('hidden'); });
$('btn-how').addEventListener('click', () => $('how-screen').classList.remove('hidden'));
$('btn-how-back').addEventListener('click', () => $('how-screen').classList.add('hidden'));
$('btn-slots-back').addEventListener('click', () => $('slots-screen').classList.add('hidden'));
$('btn-settings-back').addEventListener('click', () => {
  G.settings.volume = +$('set-volume').value;
  G.settings.sensitivity = +$('set-sens').value;
  G.settings.quality = $('set-quality').value;
  G.settings.radio = $('set-radio').selectedIndex;
  applySettings();
  $('settings-screen').classList.add('hidden');
  if (settingsReturn === 'pause') $('pause-screen').classList.remove('hidden');
});
$('btn-resume').addEventListener('click', () => togglePause(false));
$('btn-save').addEventListener('click', () => { $('pause-screen').classList.add('hidden'); openSlots('save'); });
$('btn-pause-settings').addEventListener('click', () => { settingsReturn = 'pause'; $('pause-screen').classList.add('hidden'); $('settings-screen').classList.remove('hidden'); });
$('btn-quit').addEventListener('click', () => { $('pause-screen').classList.add('hidden'); showTitle(); });
$('btn-end-retry').addEventListener('click', retryMission);
$('btn-end-title').addEventListener('click', () => { $('end-screen').classList.add('hidden'); showTitle(); });

// Sync settings controls with stored values.
$('set-volume').value = G.settings.volume;
$('set-sens').value = G.settings.sensitivity;
$('set-quality').value = G.settings.quality;
$('set-radio').selectedIndex = G.settings.radio || 0;

function togglePause(force) {
  if (!G.started || G.over) return;
  G.paused = force !== undefined ? force : !G.paused;
  $('pause-screen').classList.toggle('hidden', !G.paused);
  if (G.paused) {
    const m = G.missions;
    $('pause-stats').innerHTML =
      `Money: $${G.player.money.toLocaleString('en-US')} · Rank: ${G.player.rank().name} (${G.player.rp} RP)<br>` +
      `Missions complete: ${m.completed} / 8 · Current: Mission ${m.index + 1} · Wanted: ${'★'.repeat(G.player.wanted) || 'clean'}<br>` +
      `Health ${Math.round(G.player.health)} · Armour ${Math.round(G.player.armour)} · Time ${$('clock').textContent}`;
  }
  G.audio.uiClick();
}

// ---------- Crew abilities ----------
function useCrewAbility(index) {
  const crew = CREW[index];
  if (G.hud.crewCooldowns[index] > 0) return;
  if (index === 0) { // Swap Plates
    if (G.player.wanted === 0) { G.hud.toast('NO HEAT TO LOSE'); return; }
    G.player.wanted = Math.max(0, G.player.wanted - 1);
  } else if (index === 1) { // Quick Fix
    if (!G.player.car) { G.hud.toast('QUICK FIX NEEDS A CAR'); return; }
    G.player.car.condition = 100;
    G.player.car.dead = false;
  } else { // Eyes Out
    G.ghostTimer = 10;
    G.eyesOutTimer = 15;
  }
  G.hud.crewCooldowns[index] = crew.cooldown;
  G.hud.showDialogue(crew.name.toUpperCase(), crew.role, crew.lines[Math.floor(Math.random() * crew.lines.length)], 5);
  G.audio.stageClear();
}

// ---------- Action keys (edge-triggered) ----------
function handleActionKeys() {
  const input = G.input;
  if (input.consume('KeyP') || input.consume('Escape')) { togglePause(); return; }
  if (G.paused) return;
  if (input.consume('KeyE')) {
    if (G.player.onFoot) {
      const car = nearestVehicle(G, G.player.x, G.player.z, 4.5);
      if (car) enterCar(G, car);
    } else exitCar(G);
  }
  if (input.consume('KeyF') && G.player.onFoot) punch(G);
  if (input.consume('KeyR')) reloadWeapon(G);
  if (input.consume('KeyM')) {
    G.audio.setStation(G.audio.station + 1);
    const st = RADIO_STATIONS[G.audio.station];
    G.hud.toast('♪ ' + st.name + ' — ' + st.genre);
  }
  for (let i = 0; i < 5; i++) if (input.consume('Digit' + (i + 1))) selectWeapon(G, i);
  if (input.consume('KeyZ')) useCrewAbility(0);
  if (input.consume('KeyX')) useCrewAbility(1);
  if (input.consume('KeyC')) useCrewAbility(2);
  if (input.consume('MouseDown') && G.player.onFoot && G.started && !G.paused) fireWeapon(G);
}

// ---------- Interaction prompt ----------
function updatePrompt() {
  if (!G.started || G.paused) { G.hud.setPrompt(null); return; }
  if (G.player.onFoot) {
    const car = nearestVehicle(G, G.player.x, G.player.z, 4.5);
    if (car) G.hud.setPrompt(car.driver === 'traffic' ? `<b>E</b> — JACK THE ${car.model.name}` : `<b>E</b> — ENTER THE ${car.model.name}`);
    else G.hud.setPrompt(null);
  } else if (Math.abs(G.player.car.speed) < 1) {
    G.hud.setPrompt('<b>E</b> — EXIT VEHICLE');
  } else G.hud.setPrompt(null);
}

// ---------- Busted / wasted checks ----------
function updateArrestAndDeath(dt) {
  const p = G.player;
  if (p.health <= 0 || p.dead) { G.endGame(false, 'wasted'); return; }
  if (p.onFoot && p.wanted > 0) {
    let nearest = 1e9;
    for (const u of G.police.units) {
      if (u.car.dead) continue;
      nearest = Math.min(nearest, Math.hypot(u.car.x - p.x, u.car.z - p.z));
    }
    if (nearest < 5 && p.speedKmh < 2) {
      G.bustedTimer += dt;
      if (G.bustedTimer > 0.5) G.hud.toast('THE CBPD ARE ON YOU — RUN!');
      if (G.bustedTimer > 2.5) { G.endGame(false, 'busted'); return; }
    } else G.bustedTimer = 0;
  } else G.bustedTimer = 0;
  // Car wrecked under the player: bail out, hurt.
  if (p.car && p.car.dead) {
    const wreck = p.car;
    exitCar(G);
    p.x = wreck.x + 3; p.z = wreck.z + 3;
    p.mesh.position.set(p.x, 0, p.z);
    p.damage(25, 'crash');
    G.hud.toast('YOUR RIDE IS SCRAP — BAIL OUT!');
  }
}

// ---------- Fixed-timestep simulation ----------
// The world simulates in 1/30 s steps driven by real elapsed time, so the game
// runs at full speed even when the renderer is slow (software WebGL), and the
// physics never sees a giant unstable dt.
let simAcc = 0;
const SIM_STEP = 1 / 30;

function simulateStep(G, dt) {
  G.clock += dt / 240; // one game hour per 4 real minutes
  if (G.ghostTimer > 0) G.ghostTimer -= dt;
  if (G.eyesOutTimer > 0) G.eyesOutTimer -= dt;
  if (G.player.car) {
    // Screenshot staging: cruise at ~110 km/h with no driver input.
    if (G.autoDrive && G.player.car.speed < 31) G.input.forward = true;
    else if (G.autoDrive) G.input.forward = false;
    updatePlayerCar(G.player.car, G.input, dt, G);
    if (syncCarMesh(G.player.car, dt)) G.effects.addSmoke(G.player.car.x, 1.4, G.player.car.z);
    G.player.x = G.player.car.x; G.player.z = G.player.car.z; G.player.heading = G.player.car.heading;
    G.player.speedKmh = Math.abs(G.player.car.speed) * 3.6;
    if (G.input.handbrake && Math.abs(G.player.car.speed) > 8 && Math.random() < dt * 20) {
      G.effects.addDust(G.player.car.x, 0.3, G.player.car.z);
    }
  } else {
    updatePlayerOnFoot(G, dt);
  }
  updateTraffic(G, dt);
  for (const ped of G.peds) {
    if (ped.hostile) updateHostilePed(ped, dt, G);
    else updatePed(ped, dt, G);
  }
  updatePolice(G, dt);
  updateMissions(G, dt);
  updateCombat(G, dt);
  updateArrestAndDeath(dt);
}

// ---------- Main loop ----------
const clock3 = new THREE.Clock();
let elapsed = 0;
let firstFrame = true;
let frameCount = 0;
const perfProbe = { updateMs: 0, renderMs: 0, frames: 0 };
const renderTimes = [];

function animate() {
  requestAnimationFrame(animate);
  const tStart = performance.now();
  const rawDt = Math.min(clock3.getDelta(), 0.5);
  elapsed += rawDt;
  G.input.update(rawDt);
  G.input.beginFrame();

  if (G.started && !G.over) {
    handleActionKeys(); // P/Esc works even while paused; the rest returns early
  }
  if (G.started && !G.paused && !G.over) {
    simAcc += rawDt;
    let steps = 0;
    while (simAcc >= SIM_STEP && steps < 20) {
      simulateStep(G, SIM_STEP);
      simAcc -= SIM_STEP;
      steps += 1;
    }
    if (steps >= 20) simAcc = 0; // drop backlog: never spiral on a slow frame
    updatePrompt();
    updateChaseCamera(G, rawDt);
    // Audio follows the action.
    const driving = !!G.player.car;
    G.audio.updateEngine(G.player.speedKmh, driving);
    G.audio.updateRadio(rawDt, driving);
    G.audio.updateSiren(G.player.wanted);
    // HUD text/minimap refresh at ~20 Hz: plenty for panels, kinder to the CPU.
    frameCount += 1;
    if (frameCount % 3 === 0) G.hud.update(G, rawDt * 3);
  } else if (!G.started) {
    // Living title-screen backdrop: traffic rolls, peds stroll, camera orbits.
    updateTraffic(G, rawDt);
    for (const ped of G.peds) if (!ped.hostile) updatePed(ped, rawDt, G);
    updateTitleCamera(G, rawDt, elapsed);
  }

  G.effects.update(rawDt, camera);
  const tBeforeRender = performance.now();
  renderer.render(scene, camera);
  const tEnd = performance.now();
  perfProbe.updateMs += tBeforeRender - tStart;
  perfProbe.renderMs += tEnd - tBeforeRender;
  perfProbe.frames += 1;
  // Rolling window: the last 5 frames, refreshed every frame.
  renderTimes.push(tEnd - tBeforeRender);
  if (renderTimes.length > 5) renderTimes.shift();
  window.__perf = {
    updateMs: +(perfProbe.updateMs / perfProbe.frames).toFixed(1),
    renderMs: +(renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length).toFixed(1),
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
  };

  if (firstFrame) {
    firstFrame = false;
    document.getElementById('loading').style.display = 'none';
    window.__gameReady = true;
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

applySettings();
animate();

// Screenshot staging: auto-start into a real game state (title stays for ?shot=title).
if (SHOT && SHOT !== 'title') {
  startGame(true);
  applyShot(G, SHOT);
  // Let the camera settle behind the action before the shot.
  for (let i = 0; i < 30; i++) updateChaseCamera(G, 1 / 30);
}
