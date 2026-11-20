// CAYO BRAVO — shots.js: screenshot staging. URL params (?shot=chase etc.)
// set up real game states — a sunset police chase, a city drive, a roadblock
// chase, an on-foot mission — rendered live by the game's own code, so the
// screenshots show the systems working, not a mock-up.

import { spawnVehicle } from './vehicles.js';
import { spawnCopCar, ensureHelicopter, placeRoadblock } from './police.js';
import { startMission, enterStage } from './missions.js';
import { spawnPed } from './pedestrians.js';

function putPlayerInCar(G, modelIndex, x, z, heading, speed) {
  const car = spawnVehicle(G.scene, modelIndex, x, z, heading, { condition: 100 });
  car.isPlayer = true;
  car.driver = 'player';
  car.speed = speed;
  G.vehicles.push(car);
  G.player.car = car;
  G.player.onFoot = false;
  G.player.mesh.visible = false;
  G.player.x = x; G.player.z = z; G.player.heading = heading;
  G.cameraYaw = heading;
  return car;
}

function setChaseDressing(G, money, rp, rankIndex) {
  G.player.money = money;
  G.player.rp = rp;
  G.player.rankIndex = rankIndex;
  G.player.health = 72;
  G.player.armour = 55;
}

// COVER: sunset police chase on the beach boulevard — mission 6, 4 stars,
// helicopter overhead, limo target ahead, dialogue live.
export function stageChase(G) {
  putPlayerInCar(G, 0, -240, 140, 0.12, 31);
  setChaseDressing(G, 42680, 3900, 3);
  G.player.wanted = 4;
  startMission(G, 5); // EMBER RUN
  G.missions.stage = 1; // WRECK THE LIMO
  enterStage(G);
  if (G.missions.targetVehicle) {
    const t = G.missions.targetVehicle;
    t.x = -240; t.z = 60;
    t.mesh.position.set(-240, 0, 60);
    t.condition = 62;
  }
  for (let i = 0; i < 4; i++) spawnCopCar(G);
  // Two units close in the frame, holding front slots (ahead-left / ahead-right)
  // so the pursuit reads on camera instead of hiding behind it.
  const units = G.police.units;
  if (units[0]) { units[0].car.x = -232; units[0].car.z = 108; units[0].tactic = 'FLANKING'; units[0].slot = -Math.PI / 2 - 0.5; }
  if (units[1]) { units[1].car.x = -246; units[1].car.z = 168; units[1].tactic = 'RAMMING'; units[1].slot = -Math.PI / 2 + 0.5; }
  if (units[2]) units[2].slot = -Math.PI / 2 - 1.0;
  if (units[3]) units[3].slot = -Math.PI / 2 + 1.0;
  ensureHelicopter(G);
  G.police.heli.angle = Math.PI; // start over the beach, against the sunset
  G.autoDrive = true;
  G.noRoadblocks = true; // keep the beach boulevard clear for the chase
  G.hud.showDialogue('SELMA OKAFOR', 'LOOKOUT', "He's making for El Faro! Wreck the limo before it reaches the lighthouse road!", 30);
}

// CITY DRIVE: golden-hour cruise through Altavista, no heat, mission 1 open.
export function stageDrive(G) {
  putPlayerInCar(G, 1, 60, 60, 0.05, 18);
  setChaseDressing(G, 12850, 2100, 2);
  G.player.health = 100;
  G.player.armour = 50;
  startMission(G, 0); // FIRST LIGHT
  G.missions.stage = 1; // FOLLOW NADIA (a drive stage: never auto-advances)
  enterStage(G);
  G.autoDrive = true;
  G.hud.showDialogue('TOMÁS IBARRA', 'MECHANIC', "Nice wheels, Río. Now lose the tail and bring her home clean.", 30);
}

// ROADBLOCK CHASE: downtown canyon, 3 stars, a roadblock ahead, mission 4.
export function stageRoadblock(G) {
  putPlayerInCar(G, 2, 60, 150, 0, 27);
  setChaseDressing(G, 24300, 2900, 2);
  G.player.wanted = 3;
  startMission(G, 3); // THE HARBORMASTER'S TOLL
  G.missions.stage = 1; // WRECK THE ESCORT
  enterStage(G);
  if (G.missions.targetVehicle) {
    const t = G.missions.targetVehicle;
    t.x = 60; t.z = 40;
    t.mesh.position.set(60, 0, 40);
    t.condition = 48;
  }
  for (let i = 0; i < 3; i++) spawnCopCar(G);
  const units = G.police.units;
  if (units[0]) { units[0].car.x = 52; units[0].car.z = 122; units[0].tactic = 'RAMMING'; }
  if (units[1]) { units[1].car.x = 68; units[1].car.z = 178; units[1].tactic = 'CHASING'; }
  placeRoadblock(G);
  G.hud.showDialogue('NADIA KESTREL', 'DRIVER', "Roadblock on Coral Row! Thread it or ram it — your call, Río!", 30);
}

// ON-FOOT MISSION: beach firefight, mission 3, 2 stars, enemies in view.
export function stageMission(G) {
  G.player.x = -238; G.player.z = 112;
  G.player.heading = 0; // face north, toward the runners on the sand
  G.player.mesh.position.set(-238, 0, 112);
  G.player.mesh.rotation.y = 0;
  G.cameraYaw = 0;
  setChaseDressing(G, 8600, 1750, 2);
  G.player.wanted = 2;
  G.combat.slot = 2; // VIPER SMG
  startMission(G, 2); // SAND & SMOKE
  G.missions.stage = 1; // CLEAR THE RUNNERS
  enterStage(G);
  for (let i = 0; i < 2; i++) spawnCopCar(G);
  // A couple of beach-goers fleeing for life in the frame.
  spawnPed(G, -250, 110, { state: 'flee', speed: 4 });
  spawnPed(G, -226, 105, { state: 'flee', speed: 4 });
  G.hud.showDialogue('SELMA OKAFOR', 'LOOKOUT', 'Three runners on the sand, Río. Take them down — the beach is ours!', 30);
}

export function applyShot(G, shot) {
  if (shot === 'chase') stageChase(G);
  else if (shot === 'drive') stageDrive(G);
  else if (shot === 'roadblock') stageRoadblock(G);
  else if (shot === 'mission') stageMission(G);
  // 'title' and anything else: leave the title screen up.
}
