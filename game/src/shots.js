// Staged screenshot modes (?shot=cover|drive|chase|mission). Each one sets
// up a real, playable game state — a chase, a drive, a firefight — then lets
// the normal game loop run, so the screenshots are genuine renders.
import { S } from './config.js';
import { createCar } from './vehicles.js';
import { setWanted, spawnPoliceCarAt } from './police.js';
import { startMission, setMissionStep } from './missions.js';
import { spawnGang } from './combat.js';
import { HUD } from './hud.js';

function putPlayerInCar(type, x, z, heading, color) {
  const p = S.player;
  const car = createCar(type, x, z, heading, { driver: 'player', color });
  car.speed = 14;
  p.car = car;
  p.onFoot = false;
  p.mesh.visible = false;
  p.mesh.position.set(x, 0, z);
  p.heading = heading;
  return car;
}

function putPlayerOnFoot(x, z, heading) {
  const p = S.player;
  p.car = null;
  p.onFoot = true;
  p.mesh.visible = true;
  p.mesh.position.set(x, 0, z);
  p.heading = heading;
  p.mesh.rotation.y = heading;
}

export function applyShotMode(mode, cam) {
  S.shotMode = mode;
  S.started = true;
  HUD.hideStart();
  if (mode === 'cover') {
    // Dusk chase through downtown: wanted 3, two units behind, one more
    // closing head-on, a mission objective glowing ahead — every system in
    // one frame.
    S.timeHours = 18.55;
    S.player.money = 1250;
    putPlayerInCar('sport', -54, -50.5, Math.PI / 2, 0xc21807);
    setWanted(3);
    spawnPoliceCarAt(-92, -50.5, Math.PI / 2);
    spawnPoliceCarAt(-100, -47, Math.PI / 2);
    spawnPoliceCarAt(30, -57.5, -Math.PI / 2);
    startMission(0);
    cam.yaw = Math.PI / 2;
    cam.pitch = 0.32;
    HUD.notify('WANTED LEVEL 3 — the heat is on', '#ff6b6b');
  } else if (mode === 'drive') {
    // Golden morning cruise along the beach road.
    S.timeHours = 10.6;
    S.player.money = 480;
    putPlayerInCar('sedan', -120, 219.5, Math.PI / 2, 0x2e6fb0);
    cam.yaw = Math.PI / 2;
    cam.pitch = 0.3;
    HUD.notify('Solmar Bay — free roam', '#ffffff');
  } else if (mode === 'chase') {
    // Night pursuit, four stars, three units closing in. The camera looks
    // back down the road so the flashing pursuit fills the frame.
    S.timeHours = 21.8;
    S.player.money = 2320;
    putPlayerInCar('sport', 3.5, 108, Math.PI, 0xffd600);
    setWanted(4);
    spawnPoliceCarAt(3, 138, Math.PI);
    spawnPoliceCarAt(-4, 146, Math.PI);
    spawnPoliceCarAt(7, 154, Math.PI);
    cam.yaw = 0;
    cam.pitch = 0.3;
    cam.lockYaw = true;
    HUD.notify('WANTED LEVEL 4 — roadblock ahead!', '#ff6b6b');
  } else if (mode === 'mission') {
    // On foot at the harbor, Vultures ahead in the open, objective live.
    S.timeHours = 14.2;
    S.player.money = 940;
    S.player.weapon = 'smg';
    putPlayerOnFoot(196, 108, Math.PI / 2);
    setMissionStep(2, 1); // Harbor Heat: clear the Vultures
    cam.yaw = Math.PI / 2;
    cam.pitch = 0.22;
  }
  window.__shotReady = true;
}
