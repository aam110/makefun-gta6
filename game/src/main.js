// Solmar Bay — entry point. Wires every system together: renderer, camera,
// game loop, start/pause/game-over flow and the staged screenshot modes.
import * as THREE from 'three';
import { CFG, S, angleLerp, clamp, rand } from './config.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { buildCity, updateDayCycle, isNight } from './world.js';
import { createPlayer, updatePlayer, tryEnterCar, exitCar } from './player.js';
import { spawnTraffic, spawnParked, updateTraffic } from './traffic.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { updatePolice, clearWanted } from './police.js';
import { updateCombat, tryShoot, startReload, switchWeapon, spawnWorldPickups } from './combat.js';
import { updateMissions, armFirstMission, retryMission, freeRoamAfterFail, failMission } from './missions.js';
import { updateEffects, updateBeacon } from './effects.js';
import { carHeadlightGlow } from './vehicles.js';
import { HUD } from './hud.js';
import { applyShotMode } from './shots.js';
import { hasSave, loadGame, applySave, saveGame, clearSave } from './save.js';

const cam = { yaw: Math.PI, pitch: 0.34, dist: 9, lastLookAt: -99, lockYaw: false };
let overShown = false;
let autoSaveTimer = 0;
let framesRendered = 0;

function initRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.getElementById('app').appendChild(renderer.domElement);
  return renderer;
}

function updateCamera(dt) {
  const p = S.player;
  if (!p) return;
  const { dx, dy } = Input.consumeLook();
  if (dx !== 0 || dy !== 0) {
    cam.yaw -= dx * 0.0032;
    cam.pitch = clamp(cam.pitch + dy * 0.0022, 0.08, 1.1);
    cam.lastLookAt = S.elapsed;
  }
  // Behind the car when driving fast (unless the player just looked around,
  // or the shot staging locked the angle).
  if (!cam.lockYaw && !p.onFoot && p.car && Math.abs(p.car.speed) > 4 && S.elapsed - cam.lastLookAt > 2.5) {
    cam.yaw = angleLerp(cam.yaw, p.car.heading, Math.min(1, dt * 1.6));
  }
  const target = p.mesh.position.clone();
  target.y = p.onFoot ? 2.0 : 2.4;
  const wantDist = p.onFoot ? 8.5 : 11;
  cam.dist += (wantDist - cam.dist) * Math.min(1, dt * 3);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const off = new THREE.Vector3(
    -Math.sin(cam.yaw) * cp * cam.dist,
    sp * cam.dist,
    -Math.cos(cam.yaw) * cp * cam.dist,
  );
  const pos = target.clone().add(off);
  pos.y = Math.max(pos.y, 1.4);
  if (S.shake > 0) {
    pos.x += rand(-1, 1) * S.shake * 0.35;
    pos.y += rand(-1, 1) * S.shake * 0.25;
    pos.z += rand(-1, 1) * S.shake * 0.35;
  }
  S.camera.position.copy(pos);
  S.camera.lookAt(target);
}

function setPaused(paused) {
  if (!S.started || S.over) return;
  S.paused = paused;
  if (paused) { HUD.showPause(); AudioSys.engine(false, 0); }
  else HUD.hidePause();
}

function handleGameOver() {
  if (!S.over || overShown) return;
  overShown = true;
  if (S.mission) failMission();
  HUD.showOver(S.overKind);
  if (document.pointerLockElement) document.exitPointerLock();
}

function startGame(useSave) {
  AudioSys.init();
  AudioSys.click();
  if (useSave) {
    const d = loadGame();
    if (d) applySave(d);
  } else {
    clearSave();
  }
  HUD.hideStart();
  S.started = true;
  armFirstMission(3);
  HUD.notify('Welcome to Solmar Bay, Rio. Mara has work for you.', '#ffd23f');
  HUD.banner('SOLMAR BAY', 'Courier by day. Wheelman by night. The bay is yours — if you can take it.', 6000);
}

function init() {
  S.renderer = initRenderer();
  S.scene = new THREE.Scene();
  S.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  S.camera.position.set(0, 12, 80);

  buildCity();
  createPlayer(0, 60);
  spawnTraffic();
  spawnParked();
  spawnPeds();
  spawnWorldPickups();

  Input.init(S.renderer.domElement);
  HUD.init({
    onStart: (useSave) => startGame(useSave),
    onResume: () => setPaused(false),
    onSave: () => saveGame(),
    onRestart: () => { clearSave(); location.reload(); },
    onRetry: () => {
      overShown = false;
      HUD.hideOver();
      retryMission();
    },
    onFreeRoam: () => {
      overShown = false;
      HUD.hideOver();
      freeRoamAfterFail();
    },
    onKeepPlaying: () => HUD.hideComplete(),
    onMute: () => {
      AudioSys.setMuted(!S.muted);
      HUD.notify(S.muted ? 'Sound off' : 'Sound on', '#ffffff');
    },
  });

  // Edge-triggered keys.
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (!S.started || S.over) {
      if (e.code === 'Enter' && !S.started) startGame(hasSave());
      return;
    }
    switch (e.code) {
      case 'KeyF':
        if (S.player.onFoot) tryEnterCar();
        else exitCar();
        break;
      case 'KeyE':
        if (S.interactTarget) S.interactTarget.fn();
        break;
      case 'KeyR': startReload(); break;
      case 'Digit1': switchWeapon('pistol'); break;
      case 'Digit2': switchWeapon('smg'); break;
      case 'KeyP':
      case 'Escape': setPaused(!S.paused); break;
      case 'KeyM': AudioSys.setMuted(!S.muted); break;
      default: break;
    }
  });

  window.addEventListener('resize', () => {
    S.camera.aspect = window.innerWidth / window.innerHeight;
    S.camera.updateProjectionMatrix();
    S.renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Wanted-level toasts.
  window.__onWantedUp = (level, reason) => {
    HUD.notify('WANTED LEVEL ' + level + (reason ? ' — ' + reason : ''), '#ff6b6b');
  };
  window.__onWantedDown = (level) => {
    HUD.notify(level === 0 ? 'You lost them. The heat is off.' : 'Wanted level down: ' + level, '#2ecc71');
  };
  window.__onPickup = (kind) => {
    if (kind === 'smg') HUD.notify('Picked up an SMG — press 2 to use it', '#f1c40f');
    else if (kind === 'health') HUD.notify('+50 health', '#2ecc71');
    else if (kind === 'ammo') HUD.notify('+90 SMG ammo', '#f1c40f');
  };

  // Staged screenshot mode, or the start screen.
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (shot && ['cover', 'drive', 'chase', 'mission'].includes(shot)) {
    applyShotMode(shot, cam);
  } else {
    HUD.showStart(hasSave());
  }

  window.__game = { S, cam };
  requestAnimationFrame(loop);
}

const clock = new THREE.Clock();

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  framesRendered++;
  if (S.started && !S.paused) {
    S.elapsed += dt;
    S.interactTarget = null;
    updateDayCycle(dt);
    carHeadlightGlow(isNight());
    if (!S.over) {
      updatePlayer(dt, cam.yaw);
      updateTraffic(dt);
      updatePeds(dt);
      updatePolice(dt);
      updateCombat(dt);
      updateMissions(dt);
      // Shooting: click, or hold for automatics.
      if (Input.mouseDownEdge) tryShoot();
      else if (Input.mouseDown && S.player.weapon === 'smg') tryShoot();
      // Prompt for whatever is in reach.
      HUD.setPrompt(S.interactTarget ? S.interactTarget.label : null);
      autoSaveTimer += dt;
      if (autoSaveTimer > 45) { autoSaveTimer = 0; saveGame(); }
    }
    updateEffects(dt);
    updateBeacon(dt);
    handleGameOver();
    HUD.update(dt);
  }
  updateCamera(S.started ? dt : 0.016);
  S.renderer.render(S.scene, S.camera);
  Input.endFrame();
  if (framesRendered === 3 && S.shotMode) window.__shotSettled = true;
}

init();
