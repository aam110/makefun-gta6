// CAYO BRAVO — missions.js: 8 staged story missions for Dario "Río" Voss and
// his crew, taking the island back from Don Aurelio Salas, the Harbormaster.
// Each mission is a chain of stages: drive, reach, wreck, eliminate, escape.

import { spawnVehicle } from './vehicles.js';
import { spawnPed } from './pedestrians.js';
import { raiseWanted } from './police.js';

export const MISSIONS = [
  {
    id: 1, name: 'FIRST LIGHT', pay: 800, rp: 300,
    intro: { who: 'NADIA KESTREL', role: 'DRIVER', text: "Río! You're back. Meet me at the marina — the Harbormaster's men are already asking about you." },
    stages: [
      { name: 'MEET NADIA', type: 'goto', x: 250, z: -160, radius: 10, text: 'Drive to the marina and meet Nadia.', next: 'Follow her to the garage' },
      { name: 'FOLLOW NADIA', type: 'drive', x: -90, z: -150, radius: 12, text: 'Follow Nadia to the garage in Mercado Viejo.', next: 'Park inside the garage' },
      { name: 'PARK UP', type: 'goto', x: -90, z: -150, radius: 8, text: 'Park inside the garage to end the day.', next: 'Mission complete' },
    ],
  },
  {
    id: 2, name: 'HOT PLATES', pay: 1200, rp: 400,
    intro: { who: 'TOMÁS IBARRA', role: 'MECHANIC', text: "I need a clean ride, Río. Any car off the street — just don't bring the whole CBPD with you." },
    stages: [
      { name: 'STEAL A RIDE', type: 'steal', text: 'Steal any car on the street (E to jack it).', next: 'Lose the heat' },
      { name: 'LOSE THE HEAT', type: 'lose', text: 'Break line of sight until your wanted level clears.', next: 'Deliver the car to Tomás' },
      { name: 'DELIVER', type: 'drive', x: -90, z: -150, radius: 12, text: 'Deliver the clean car to the garage.', next: 'Mission complete' },
    ],
  },
  {
    id: 3, name: 'SAND & SMOKE', pay: 1800, rp: 550,
    intro: { who: 'SELMA OKAFOR', role: 'LOOKOUT', text: "Salas's runners took the beach meet. Three of them, armed. Clear them out and the sand is ours." },
    stages: [
      { name: 'REACH THE BEACH', type: 'goto', x: -240, z: 90, radius: 14, text: 'Get to the beach meet at Puerto Arena.', next: 'Take out the runners' },
      { name: 'CLEAR THE RUNNERS', type: 'eliminate', count: 3, x: -240, z: 90, text: 'Take out the 3 armed runners on the sand.', next: 'Meet Selma at the boardwalk' },
      { name: 'DEBRIEF', type: 'goto', x: -225, z: 150, radius: 10, text: 'Meet Selma at the boardwalk.', next: 'Mission complete' },
    ],
  },
  {
    id: 4, name: "THE HARBORMASTER'S TOLL", pay: 2400, rp: 700,
    intro: { who: 'NADIA KESTREL', role: 'DRIVER', text: "Salas runs a toll convoy through Altavista every evening. Wreck the escort and the toll dies with it." },
    stages: [
      { name: 'FIND THE CONVOY', type: 'drive', x: 30, z: -120, radius: 16, text: 'Intercept the convoy in Altavista.', next: 'Wreck the escort' },
      { name: 'WRECK THE ESCORT', type: 'wreck', text: 'Ram the black escort SUV until it is scrap.', next: 'Escape the CBPD' },
      { name: 'ESCAPE', type: 'lose', text: 'Lose the CBPD and get clear.', next: 'Mission complete' },
    ],
  },
  {
    id: 5, name: 'MIDNIGHT FERRY', pay: 3000, rp: 850,
    intro: { who: 'TOMÁS IBARRA', role: 'MECHANIC', text: 'Cargo run, Río. Pier 2, before the ferry sails. The roadblocks will be out — drive like the sunset is chasing you.' },
    stages: [
      { name: 'LOAD THE CARGO', type: 'goto', x: -150, z: 210, radius: 10, text: 'Pick up the cargo at the Lumbre warehouse.', next: 'Race to Pier 2' },
      { name: 'RACE TO PIER 2', type: 'drive', x: 280, z: -90, radius: 14, timer: 150, text: 'Reach Pier 2 before the ferry sails.', next: 'Lose any pursuit' },
      { name: 'SLIP AWAY', type: 'lose', text: 'Slip away clean and the run is yours.', next: 'Mission complete' },
    ],
  },
  {
    id: 6, name: 'EMBER RUN', pay: 4200, rp: 1100,
    intro: { who: 'SELMA OKAFOR', role: 'LOOKOUT', text: "Salas's armoured limo is heading for the lighthouse road. Wreck it before it reaches El Faro — the whole island is watching." },
    stages: [
      { name: 'CATCH THE LIMO', type: 'drive', x: 60, z: 180, radius: 18, text: 'Catch up with the limo on Coral Row.', next: 'Wreck the limo' },
      { name: 'WRECK THE LIMO', type: 'wreck', text: 'Ram the armoured limo until it burns.', next: 'Vanish before the CBPD closes in' },
      { name: 'VANISH', type: 'lose', text: 'Vanish before the CBPD closes in.', next: 'Mission complete' },
    ],
  },
  {
    id: 7, name: 'BLACKOUT ON CORAL ROW', pay: 5200, rp: 1300,
    intro: { who: 'NADIA KESTREL', role: 'DRIVER', text: "The ledger is in Salas's Coral Row office. Guards on the door, cameras everywhere. Go in quiet — or go in loud, your call." },
    stages: [
      { name: 'REACH THE OFFICE', type: 'goto', x: 0, z: 180, radius: 12, text: 'Reach the Coral Row office on foot.', next: 'Take out the guards' },
      { name: 'TAKE THE GUARDS', type: 'eliminate', count: 4, x: 0, z: 180, text: 'Take out the 4 guards at the office.', next: 'Grab the ledger' },
      { name: 'GRAB THE LEDGER', type: 'goto', x: 0, z: 180, radius: 8, text: 'Grab the ledger from the office.', next: 'Get out clean' },
      { name: 'GET OUT CLEAN', type: 'lose', text: 'Get out clean — no stars, no tail.', next: 'Mission complete' },
    ],
  },
  {
    id: 8, name: 'GOLDEN HOUR', pay: 8000, rp: 2000,
    intro: { who: 'NADIA KESTREL', role: 'DRIVER', text: "The boat sails in two minutes, Río. Five stars, the whole island, one road to El Faro. Shake them all and get to the pier!" },
    stages: [
      { name: 'THE MANHUNT', type: 'lose', heat: 5, text: 'Lose the 5-star manhunt before the boat sails.', next: 'Reach the boat at El Faro' },
      { name: 'REACH THE BOAT', type: 'drive', x: 262, z: 262, radius: 16, timer: 150, text: 'Reach the boat at the El Faro pier.', next: 'Sail into the sunset' },
      { name: 'SAIL AWAY', type: 'goto', x: 262, z: 262, radius: 10, text: 'Board the boat and sail into the sunset.', next: 'Cayo Bravo is yours' },
    ],
  },
];

export function createMissionState() {
  return {
    index: 0,            // current mission (0-based)
    stage: 0,
    active: false,
    completed: 0,
    timer: 0,
    targetVehicle: null,
    enemies: [],
    enemiesLeft: 0,
    beaconOn: false,
  };
}

export function currentMission(G) {
  return MISSIONS[Math.min(G.missions.index, MISSIONS.length - 1)];
}

export function currentStage(G) {
  const m = currentMission(G);
  return m.stages[Math.min(G.missions.stage, m.stages.length - 1)];
}

export function startMission(G, index) {
  const ms = G.missions;
  ms.index = index;
  ms.stage = 0;
  ms.active = true;
  ms.timer = 0;
  cleanupMissionEntities(G);
  const m = MISSIONS[index];
  G.hud.toast('MISSION ' + m.id + ' · ' + m.name);
  G.hud.showDialogue(m.intro.who, m.intro.role, m.intro.text, 7);
  G.audio.missionStart();
  enterStage(G);
}

export function cleanupMissionEntities(G) {
  const ms = G.missions;
  if (ms.targetVehicle && !ms.targetVehicle.dead) {
    G.scene.remove(ms.targetVehicle.mesh);
    G.vehicles = G.vehicles.filter((v) => v !== ms.targetVehicle);
  }
  ms.targetVehicle = null;
  for (const e of ms.enemies) {
    if (!e.dead) { G.scene.remove(e.mesh); G.peds = G.peds.filter((p) => p !== e); }
  }
  ms.enemies = [];
  ms.enemiesLeft = 0;
}

// Entering a stage spawns whatever it needs: target cars, enemies, heat.
export function enterStage(G) {
  const ms = G.missions;
  const st = currentStage(G);
  ms.timer = st.timer ?? 0;
  if (st.heat) G.player.wanted = st.heat;
  if (st.type === 'wreck') {
    const m = currentMission(G);
    const tx = m.id === 6 ? 90 : 60;
    const tz = m.id === 6 ? 210 : -90;
    const target = spawnVehicle(G.scene, 4, tx, tz, Math.PI / 2, { condition: 100 });
    target.driver = 'target';
    target.cruiseSpeed = 24;
    target.vertical = false;
    target.dir = 1;
    target.road = tz;
    G.vehicles.push(target);
    ms.targetVehicle = target;
    G.hud.toast('TARGET MARKED — WRECK IT');
  }
  if (st.type === 'eliminate') {
    ms.enemiesLeft = st.count;
    for (let i = 0; i < st.count; i++) {
      const e = spawnPed(G, st.x + (i - 1) * 7, st.z + (i % 2) * 8 - 4, { hostile: true, health: 60, state: 'guard' });
      e.name = "Salas Runner";
      ms.enemies.push(e);
    }
    raiseWanted(G, 1);
  }
  updateBeacon(G);
}

export function updateBeacon(G) {
  const ms = G.missions;
  const st = currentStage(G);
  const b = G.world.beacon;
  if (!ms.active) { b.visible = false; return; }
  if (st.type === 'wreck' && ms.targetVehicle) {
    b.position.set(ms.targetVehicle.x, 0, ms.targetVehicle.z);
    b.visible = true;
  } else if (st.x !== undefined) {
    b.position.set(st.x, 0, st.z);
    b.visible = true;
  } else b.visible = false;
}

function advanceStage(G) {
  const ms = G.missions;
  const m = currentMission(G);
  ms.stage += 1;
  G.audio.stageClear();
  if (ms.stage >= m.stages.length) {
    completeMission(G);
    return;
  }
  const st = currentStage(G);
  G.hud.toast('STAGE ' + (ms.stage + 1) + '/' + m.stages.length + ' · ' + st.name);
  enterStage(G);
}

export function completeMission(G) {
  const ms = G.missions;
  const m = currentMission(G);
  ms.active = false;
  ms.completed += 1;
  cleanupMissionEntities(G);
  G.player.money += m.pay;
  G.player.addRp(m.rp);
  G.world.beacon.visible = false;
  G.hud.toast('MISSION COMPLETE · +$' + m.pay.toLocaleString('en-US') + ' · +' + m.rp + ' RP');
  G.audio.missionComplete();
  G.player.wanted = Math.max(0, G.player.wanted - 1);
  if (ms.index + 1 < MISSIONS.length) {
    // Next mission starts after a breather.
    ms.nextIndex = ms.index + 1;
    ms.nextTimer = 6;
  } else {
    G.endGame(true);
  }
}

export function failMission(G, reason) {
  const ms = G.missions;
  ms.active = false;
  cleanupMissionEntities(G);
  G.world.beacon.visible = false;
  G.hud.toast('MISSION FAILED — ' + reason);
  G.audio.missionFail();
  ms.nextIndex = ms.index; // retry the same mission shortly
  ms.nextTimer = 4;
}

// Target vehicles flee along the road grid like traffic, but faster.
export function updateTargetVehicle(car, dt, G) {
  if (car.dead) return;
  const p = G.player;
  const dx = p.x - car.x, dz = p.z - car.z;
  const d = Math.hypot(dx, dz);
  // Flee: steer away from the player, keep to the roads by snapping heading.
  const fleeHeading = Math.atan2(dx, dz);
  let dh = fleeHeading - car.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  car.heading += Math.max(-1.8 * dt, Math.min(1.8 * dt, dh));
  car.speed += ((d < 60 ? 30 : 20) - car.speed) * Math.min(1, dt * 1.5);
  const nx = car.x - Math.sin(car.heading) * car.speed * dt;
  const nz = car.z - Math.cos(car.heading) * car.speed * dt;
  car.x = Math.max(-288, Math.min(288, nx));
  car.z = Math.max(-288, Math.min(288, nz));
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  if (car.condition < 45) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) { car.smokeTimer = 0.15; G.effects.addSmoke(car.x, 1.4, car.z); }
  }
}

export function updateMissions(G, dt) {
  const ms = G.missions;
  if (!ms.active) {
    if (ms.nextTimer !== undefined) {
      ms.nextTimer -= dt;
      if (ms.nextTimer <= 0) {
        ms.nextTimer = undefined;
        startMission(G, ms.nextIndex ?? ms.index);
      }
    }
    return;
  }
  const st = currentStage(G);
  const p = G.player;
  if (ms.timer > 0) {
    ms.timer -= dt;
    if (ms.timer <= 0) { failMission(G, 'OUT OF TIME'); return; }
  }
  if (st.type === 'goto' || st.type === 'drive') {
    const d = Math.hypot(p.x - st.x, p.z - st.z);
    if (d < st.radius) advanceStage(G);
  } else if (st.type === 'steal') {
    if (p.car) advanceStage(G);
  } else if (st.type === 'lose') {
    if (p.wanted === 0) advanceStage(G);
  } else if (st.type === 'wreck') {
    if (ms.targetVehicle && ms.targetVehicle.dead) advanceStage(G);
    else if (ms.targetVehicle) updateTargetVehicle(ms.targetVehicle, dt, G);
  } else if (st.type === 'eliminate') {
    if (ms.enemiesLeft <= 0) advanceStage(G);
  }
  updateBeacon(G);
  // Beacon pulse.
  if (G.world.beacon.visible) {
    const s = 1 + Math.sin(performance.now() / 280) * 0.08;
    G.world.beacon.scale.set(s, 1, s);
  }
}
