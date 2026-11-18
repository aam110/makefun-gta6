// The story: five sequential missions for fixer Mara against the Vultures.
// Steps are goto / steal / deliver-car / kill / escape; each step owns its
// beacon, its blip and its completion rule.
import { MISSIONS, S, fmtMoney, rand } from './config.js';
import { makeBeacon, removeBeacon } from './effects.js';
import { spawnGang, enemiesAlive, clearEnemies } from './combat.js';
import { setWanted, clearWanted } from './police.js';
import { addMoney, healPlayer } from './player.js';
import { createCar } from './vehicles.js';
import { saveGame } from './save.js';
import { AudioSys } from './audio.js';
import { HUD } from './hud.js';

let nextMissionAt = 0;
let escapeAnnounced = false;

export function currentStep() {
  if (!S.mission) return null;
  return S.mission.def.steps[S.mission.step] ?? null;
}

export function missionTarget() {
  const step = currentStep();
  if (!step || step.x === undefined) return null;
  return { x: step.x, z: step.z };
}

export function startMission(index) {
  const def = MISSIONS[index];
  if (!def) return;
  S.mission = { def, step: 0, killsNeeded: 0, startedAt: S.elapsed };
  S.missionIndex = index;
  AudioSys.missionStart();
  HUD.banner(def.title, def.brief, 6000);
  HUD.notify('Mission started: ' + def.title, '#ffd23f');
  beginStep();
}

function beginStep() {
  const step = currentStep();
  removeBeacon();
  if (!step) { completeMission(); return; }
  escapeAnnounced = false;
  if (step.x !== undefined) S.beacon = makeBeacon(step.x, step.z);
  if (step.kind === 'kill') {
    const n = step.count ?? 4;
    S.mission.killsNeeded = n;
    spawnGang(step.x, step.z, n, { boss: !!step.boss, gang: 'vulture' });
    HUD.notify('Hostiles incoming — ' + n + ' Vultures', '#ff6b6b');
  }
  if (step.kind === 'escape') {
    setWanted(3);
    HUD.notify('WANTED LEVEL 3 — lose the heat!', '#ff6b6b');
  }
  if (step.kind === 'steal' && S.player.car === S.missionCar) advanceStep();
}

function advanceStep() {
  if (!S.mission) return;
  S.mission.step++;
  if (S.mission.step >= S.mission.def.steps.length) completeMission();
  else beginStep();
}

function completeMission() {
  const def = S.mission.def;
  removeBeacon();
  addMoney(def.pay);
  S.stats.missionsDone++;
  AudioSys.missionDone();
  HUD.banner('MISSION COMPLETE', def.title + ' — ' + fmtMoney(def.pay) + ' earned', 5000);
  HUD.notify('+' + fmtMoney(def.pay) + ' — ' + def.title, '#2ecc71');
  saveGame();
  S.mission = null;
  S.missionIndex++;
  if (S.missionIndex >= MISSIONS.length) {
    S.storyDone = true;
    saveGame();
    HUD.showStoryComplete();
  } else {
    nextMissionAt = S.elapsed + 5;
  }
}

export function failMission() {
  if (!S.mission) return;
  removeBeacon();
  clearEnemies();
  HUD.notify('Mission failed: ' + S.mission.def.title, '#ff6b6b');
  S.mission = null;
}

export function retryMission() {
  clearWanted();
  clearEnemies();
  healPlayer(100);
  const p = S.player;
  if (p.car) { p.car = null; p.onFoot = true; p.mesh.visible = true; }
  // The Hot Wheels car must exist for its mission.
  const def = MISSIONS[S.missionIndex];
  if (def && def.id === 'hot-wheels' && (!S.missionCar || S.missionCar.dead)) {
    const car = createCar('sport', 59, 27, 0, { driver: 'parked', color: 0xc21807 });
    car.parked = true;
    car.missionTarget = true;
    S.missionCar = car;
    S.parked.push(car);
  }
  S.over = false;
  S.overKind = null;
  // Respawn on the mission's first objective (all objectives sit on roads
  // or the open plaza, never inside a building).
  const first = def ? def.steps[0] : null;
  if (first && first.x !== undefined) {
    p.mesh.position.set(first.x, 0, first.z);
  } else {
    p.mesh.position.set(0, 0, 60);
  }
  startMission(S.missionIndex);
}

export function freeRoamAfterFail() {
  failMission();
  clearWanted();
  clearEnemies();
  healPlayer(100);
  const p = S.player;
  if (p.car) { p.car = null; p.onFoot = true; p.mesh.visible = true; }
  p.mesh.position.set(0, 0, 60);
  S.over = false;
  S.overKind = null;
  nextMissionAt = S.elapsed + 20;
}

export function updateMissions(dt) {
  if (!S.started || S.over) return;
  if (!S.mission) {
    if (!S.storyDone && S.missionIndex < MISSIONS.length && S.elapsed >= nextMissionAt) {
      startMission(S.missionIndex);
    }
    return;
  }
  const step = currentStep();
  if (!step) return;
  const p = S.player;
  const pp = p.mesh.position;
  if (step.kind === 'goto') {
    const d2 = (pp.x - step.x) ** 2 + (pp.z - step.z) ** 2;
    const r = step.radius ?? 6;
    if (d2 < r * r) {
      if (step.interact) {
        S.interactTarget = { label: 'Press E — ' + step.interact, kind: 'mission', fn: () => advanceStep() };
      } else advanceStep();
    }
  } else if (step.kind === 'steal') {
    if (p.car === S.missionCar) advanceStep();
  } else if (step.kind === 'deliver-car') {
    if (p.car === S.missionCar) {
      const d2 = (pp.x - step.x) ** 2 + (pp.z - step.z) ** 2;
      if (d2 < (step.radius ?? 8) ** 2) {
        // Hand the car over: it is chopped, the player steps out.
        const car = S.missionCar;
        S.scene.remove(car.mesh);
        p.car = null;
        p.onFoot = true;
        p.mesh.visible = true;
        S.missionCar = null;
        advanceStep();
      }
    }
  } else if (step.kind === 'kill') {
    const alive = enemiesAlive();
    S.mission.killsLeft = alive;
    if (alive === 0) advanceStep();
  } else if (step.kind === 'escape') {
    if (!escapeAnnounced && S.wanted === 0) escapeAnnounced = true;
    if (S.wanted === 0) advanceStep();
  }
}

// Wired from player.js when the marked car is stolen.
window.__onMissionCarStolen = () => {
  const step = currentStep();
  if (step && step.kind === 'steal') advanceStep();
};

export function armFirstMission(delaySec = 3) {
  nextMissionAt = S.elapsed + delaySec;
}

// Jump straight to a mission + step (used by the staged screenshot modes).
export function setMissionStep(index, step) {
  const def = MISSIONS[index];
  if (!def) return;
  removeBeacon();
  clearEnemies();
  S.mission = { def, step, killsNeeded: 0, startedAt: S.elapsed };
  S.missionIndex = index;
  beginStep();
}
