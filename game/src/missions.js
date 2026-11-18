// Story + missions. Rio Vale, a bike courier in Solmar Bay, gets pulled into
// a turf war between the Vultures and the Harbor Kings by Mara, a fixer who
// always pays. Five missions, sequential, each a list of small objective
// steps: go somewhere, pick something up, steal a car, fight, lose the cops.
// A light-beam marker + minimap blip + HUD text always show the next goal.

import * as THREE from 'three';
import { distXZ, fmtMoney, rand } from './config.js';
import { makeCar } from './vehicles.js';
import { spawnEnemy, spawnPickup } from './combat.js';

// Every mission: start marker ("M" on the map), briefing lines, steps, reward.
export const MISSIONS = [
  {
    id: 'm1',
    title: 'First Delivery',
    start: { x: 6, z: 26 },
    reward: 250,
    briefing: [
      ['MARA', 'Rio. Good, you still answer your phone. I need a courier with fast legs and a faster mouth.'],
      ['RIO', 'Mara. Last time you called, I ended up hiding in a dumpster.'],
      ['MARA', 'And you got paid. Pick up the parcel at the plaza, drop it at the boardwalk. Easy money. Don\'t open it.'],
    ],
    steps: [
      { type: 'goto', x: 0, z: 0, radius: 6, text: 'Pick up the parcel at Solmar Plaza', marker: 'parcel' },
      { type: 'goto', x: 0, z: 164, radius: 6, text: 'Deliver the parcel to the boardwalk', marker: 'drop' },
    ],
    onStart(G) {
      spawnPickup(G, 2, 2, 'health');
    },
  },
  {
    id: 'm2',
    title: 'Hot Wheels',
    start: { x: -40, z: 40 },
    reward: 400,
    briefing: [
      ['MARA', 'A client wants a Falcon GT. Not to buy — to borrow. Permanently. It\'s parked near the west garage.'],
      ['RIO', 'Stealing a sports car in broad daylight. Sure. What could go wrong.'],
      ['MARA', 'Bring it to the lockup on 4th. Cops see you, lose them first. The SMG in the glovebox is yours.'],
    ],
    steps: [
      { type: 'stealCar', x: -120, z: 80, radius: 5, text: 'Steal the Falcon GT (press F by the car)', marker: 'car' },
      { type: 'deliverCar', x: 40, z: -80, radius: 8, text: 'Deliver the Falcon GT to the lockup', marker: 'drop' },
    ],
    onStart(G) {
      // the target car, parked and waiting
      const car = makeCar(G, 'sport', -120, 80, Math.PI / 2, { driver: 'parked', missionCar: true, color: 0xd94f8a });
      G.mission.targetCar = car;
    },
  },
  {
    id: 'm3',
    title: 'Harbor Trouble',
    start: { x: 120, z: -40 },
    reward: 600,
    briefing: [
      ['MARA', 'The Vultures hit one of my harbor runners. Four of them, guarding a crate that belongs to me.'],
      ['RIO', 'So I go in, take the crate, and they just let me walk out?'],
      ['MARA', 'They won\'t. That\'s why you have the SMG now. Get the crate, Rio.'],
    ],
    steps: [
      { type: 'killAll', x: 150, z: -60, radius: 10, text: 'Clear the Vultures at the harbor yard', marker: 'fight' },
      { type: 'goto', x: 150, z: -60, radius: 5, text: 'Grab the crate', marker: 'parcel' },
      { type: 'goto', x: 120, z: -40, radius: 6, text: 'Bring the crate back to Mara', marker: 'drop' },
    ],
    onStart(G) {
      for (const [ex, ez] of [[144, -66], [156, -54], [146, -50], [158, -68]]) {
        spawnEnemy(G, ex, ez, { shirt: 0xc23b3b });
      }
    },
  },
  {
    id: 'm4',
    title: 'The Long Way Home',
    start: { x: -80, z: -120 },
    reward: 800,
    briefing: [
      ['MARA', 'Change of plan — the SBPD just raided the stash house. Your name is on a list now.'],
      ['RIO', 'My name is on a LIST? Mara!'],
      ['MARA', 'Lose the heat, then get to the safehouse in North Hills. Don\'t get caught. I\'ll make it worth your while.'],
    ],
    steps: [
      { type: 'loseCops', text: 'Lose the cops — stay out of sight until the stars clear', marker: 'hide' },
      { type: 'goto', x: -120, z: -160, radius: 7, text: 'Reach the safehouse in North Hills', marker: 'drop' },
    ],
    onStart(G) {
      G.modules.police.setWanted(G, 3, 'SBPD raid');
    },
  },
  {
    id: 'm5',
    title: 'Bay Showdown',
    start: { x: 0, z: 120 },
    reward: 1500,
    briefing: [
      ['MARA', 'Kestrel himself is at the pier tonight. End this, and the Vultures leave Solmar Bay for good.'],
      ['RIO', 'One courier against a gang boss. Fine. I\'ve had worse Tuesdays.'],
      ['MARA', 'Rio… come back alive. I still owe you dinner.'],
    ],
    steps: [
      { type: 'killAll', x: 0, z: 196, radius: 12, text: 'Take down Kestrel and his crew at the pier', marker: 'fight' },
      { type: 'goto', x: -160, z: 164, radius: 7, text: 'Escape to the west beach', marker: 'drop' },
    ],
    onStart(G) {
      spawnEnemy(G, 4, 200, { shirt: 0x8a1f2d, health: 260, damage: 14, boss: true });
      for (const [ex, ez] of [[-6, 190], [8, 186], [-10, 202], [12, 206], [0, 178]]) {
        spawnEnemy(G, ex, ez, { shirt: 0xc23b3b });
      }
    },
  },
];

let beamMesh = null;
let ringMesh = null;
let startMesh = null;

function ensureMarkerMeshes(G) {
  if (beamMesh) return;
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
  });
  beamMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 40, 12, 1, true), beamMat);
  beamMesh.position.y = 20;
  beamMesh.visible = false;
  G.scene.add(beamMesh);
  ringMesh = new THREE.Mesh(new THREE.TorusGeometry(3, 0.25, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.y = 0.25;
  ringMesh.visible = false;
  G.scene.add(ringMesh);
  // the "M" start marker: a floating yellow diamond
  const startMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  startMesh = new THREE.Group();
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.4), startMat);
  startMesh.add(diamond);
  const beam2 = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 30, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
  beam2.position.y = 12;
  startMesh.add(beam2);
  startMesh.visible = false;
  G.scene.add(startMesh);
}

export function currentMission(G) {
  return MISSIONS[G.mission.index] ?? null;
}

export function missionObjective(G) {
  const m = currentMission(G);
  if (!m) return null;
  if (!G.mission.active) return { title: m.title, text: `Go to the yellow M to start: ${m.title}`, x: m.start.x, z: m.start.z, dist: true };
  const step = m.steps[G.mission.stepIndex];
  if (!step) return null;
  return { title: m.title, text: step.text, x: step.x, z: step.z, dist: step.x !== undefined };
}

export function startMission(G, index) {
  const m = MISSIONS[index];
  if (!m) return;
  G.mission.index = index;
  G.mission.stepIndex = 0;
  G.mission.active = true;
  G.mission.targetCar = null;
  G.mission.dialogDone = false;
  if (m.onStart) m.onStart(G);
  G.hud.showMissionTitle(m.title);
  G.hud.showDialog(m.briefing, () => { G.mission.dialogDone = true; });
  G.hud.notify(`Mission started: ${m.title}`, 'good');
  G.audio.missionDone();
}

export function completeMission(G) {
  const m = currentMission(G);
  if (!m) return;
  G.player.money += m.reward;
  G.mission.missionsDone++;
  G.mission.active = false;
  G.mission.index++;
  G.mission.stepIndex = 0;
  G.hud.notify(`Mission complete! +${fmtMoney(m.reward)}`, 'good');
  G.audio.missionDone();
  hideMarker(G);
  if (m.id === 'm2') {
    G.player.smgUnlocked = true;
    G.player.reserve.smg = 120;
    G.hud.notify('SMG unlocked! Press 2 to equip.', 'good');
  }
  G.saveGame();
  if (G.mission.index >= MISSIONS.length) {
    G.hud.showDialog([
      ['MARA', 'It\'s over, Rio. Kestrel\'s gone, the Vultures are finished, and Solmar Bay is ours.'],
      ['RIO', 'Ours? I think I\'ll take a holiday. Somewhere with fewer sirens.'],
      ['MARA', 'Ha. You\'d be bored in a week. The city still needs its best courier…'],
    ], () => {
      G.endGame('complete', {
        title: 'SOLMAR BAY IS YOURS',
        sub: `All five missions complete. Rio Vale went from courier to legend — and the city is still wide open. Free roam continues: keep driving, keep earning.`,
      });
    });
  }
}

export function hideMarker(G) {
  if (beamMesh) beamMesh.visible = false;
  if (ringMesh) ringMesh.visible = false;
}

function showMarkerAt(G, x, z, color = 0xffd23e) {
  ensureMarkerMeshes(G);
  beamMesh.visible = true;
  ringMesh.visible = true;
  beamMesh.position.x = x;
  beamMesh.position.z = z;
  ringMesh.position.x = x;
  ringMesh.position.z = z;
  beamMesh.material.color.setHex(color);
  ringMesh.material.color.setHex(color);
}

export function updateMissions(G, dt) {
  ensureMarkerMeshes(G);
  const m = currentMission(G);
  const p = G.player;
  // animate marker meshes
  if (beamMesh?.visible) {
    beamMesh.rotation.y += dt * 0.8;
    ringMesh.rotation.z += dt * 1.2;
    const s = 1 + Math.sin(G.elapsed * 3) * 0.08;
    ringMesh.scale.setScalar(s);
  }
  if (startMesh?.visible) {
    startMesh.position.y = 3 + Math.sin(G.elapsed * 2) * 0.4;
    startMesh.rotation.y += dt * 1.5;
  }
  if (!m) {
    hideMarker(G);
    if (startMesh) startMesh.visible = false;
    return;
  }
  if (!G.mission.active) {
    // waiting at the start marker
    startMesh.visible = true;
    startMesh.position.x = m.start.x;
    startMesh.position.z = m.start.z;
    hideMarker(G);
    if (distXZ(p.x, p.z, m.start.x, m.start.z) < 5) {
      startMission(G, G.mission.index);
    }
    return;
  }
  if (startMesh) startMesh.visible = false;
  const step = m.steps[G.mission.stepIndex];
  if (!step) { completeMission(G); return; }

  // marker colour by step type
  const colors = { goto: 0xffd23e, parcel: 0xffd23e, drop: 0x37d67a, car: 0x3aa7ff, fight: 0xff5252, hide: 0x9fd8ff };
  if (step.x !== undefined) showMarkerAt(G, step.x, step.z, colors[step.marker] ?? 0xffd23e);
  else hideMarker(G);

  let done = false;
  switch (step.type) {
    case 'goto':
      done = distXZ(p.x, p.z, step.x, step.z) < step.radius;
      break;
    case 'stealCar': {
      const car = G.mission.targetCar;
      done = !!car && p.car === car;
      if (car && !car.dead) { step.x = car.x; step.z = car.z; }
      break;
    }
    case 'deliverCar': {
      const car = G.mission.targetCar;
      done = !!car && p.car === car && distXZ(car.x, car.z, step.x, step.z) < step.radius;
      if (car && !car.dead && p.car !== car) { step.x = car.x; step.z = car.z; }
      break;
    }
    case 'killAll':
      done = G.enemies.filter((e) => !e.dead).length === 0;
      break;
    case 'loseCops':
      done = G.wanted === 0;
      break;
    default:
      done = false;
  }
  if (done) {
    G.mission.stepIndex++;
    if (G.mission.stepIndex >= m.steps.length) {
      completeMission(G);
    } else {
      G.hud.notify('Objective complete', 'good');
      G.audio.pickup();
    }
  }
}

// Place a few ambient pickups around the city at boot.
export function seedPickups(G) {
  spawnPickup(G, -40, 120, 'health');
  spawnPickup(G, 80, -120, 'armor');
  spawnPickup(G, 160, 120, 'ammo');
  spawnPickup(G, -160, -40, 'health');
  spawnPickup(G, 0, 164, 'armor');
  spawnPickup(G, 120, 160, 'cash');
}
