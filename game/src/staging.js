// Palmera Heat — deterministic staging for screenshots.
// ?shot=cover|drive|chase|mission (plus &seed=N) skips the title screen and
// arranges a composed scene: the player's car, the wanted level, police
// cars and the active mission. When the scene has settled, the hook sets
// window.__shotReady so an automated capture knows when to shoot.

import { Car } from './vehicles.js';
import { LANDMARKS } from './config.js';

function putPlayerInCar(world, x, z, heading, kind, color) {
  const car = new Car(world.scene, kind, color, x, z, heading);
  car.driver = 'player';
  car.owned = true;
  world.traffic.parked.push(car);
  world.player.mesh.position.set(x, 0, z);
  world.player.enterCar(car);
  world.player.car = car;
  car.speed = 0;
  return car;
}

// Police cars placed where the chase camera can see them: flanking and
// ahead of the player, not behind the camera. Each entry is [ahead, side]
// in units relative to the player's heading.
function spawnPoliceFlank(world, playerPos, heading, spots) {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const rx = Math.cos(heading);
  const rz = -Math.sin(heading);
  for (const [ahead, side] of spots) {
    const x = playerPos.x + fx * ahead + rx * side;
    const z = playerPos.z + fz * ahead + rz * side;
    const car = new Car(world.scene, 'police', 0xf5f5f0, x, z, heading);
    car.driver = 'police';
    car.speed = 10;
    world.police.cars.push(car);
  }
}

export function applyShot(game, shot) {
  const world = game.world;
  const player = world.player;

  const startPlaying = () => {
    game.startGame({ skipTitle: true });
  };

  if (shot === 'cover') {
    // The cover: Mara driving her red sportscar down the palm-lined beach
    // road, mission active, two stars, a police car in pursuit, the city
    // skyline and the ocean in frame.
    startPlaying();
    world.missions.startMission(1, world);
    world.missions.stepIndex = 2;
    world.missions._enterStep(world);
    const car = putPlayerInCar(world, 352, 40, 0, 'sport', 0xc23b2e);
    car.speed = 16;
    world.police.setStars(2);
    spawnPoliceFlank(world, player.pos, 0, [[20, -7], [6, 8]]);
    world.camera.snapBehind(player.pos, 0, true);
    world.camera.yaw = 0.35;
    world.hud.showSubtitle('Lena', 'Three drops, three ledgers. Grab them all!', 6000);
    world.hud.showToast('MISSION: THE LEDGER RUN — collect the dead drops');
  } else if (shot === 'drive') {
    // Pure driving: top speed down the beach avenue, palms and ocean.
    startPlaying();
    const car = putPlayerInCar(world, 352, -120, 0, 'sport', 0x2e6fc2);
    car.speed = 30;
    world.camera.snapBehind(player.pos, 0, true);
    world.camera.yaw = 0.12;
    world.hud.showToast('Palmera City — free roam. Steal a car, explore, start a mission.');
  } else if (shot === 'chase') {
    // The heat: four stars, three police cars closing in on a main avenue.
    startPlaying();
    const car = putPlayerInCar(world, 0, 60, Math.PI, 'sedan', 0xe8c33c);
    car.speed = 18;
    car.damage(70);
    world.police.setStars(4);
    spawnPoliceFlank(world, player.pos, Math.PI, [[22, -7], [30, 7], [4, -9], [48, 0]]);
    world.camera.snapBehind(player.pos, Math.PI, true);
    world.camera.yaw = Math.PI + 0.3;
    world.hud.showSubtitle('Mara', 'Four stars. They really want me today.', 6000);
  } else if (shot === 'mission') {
    // On foot at the casino: the Meridian Job, beacon up, objective live.
    startPlaying();
    world.missions.startMission(3, world);
    // Stand on the casino lot south of the entrance, facing the tower: the
    // beacon, the entrance and the tower all read in one frame, and no
    // traffic drives through the shot.
    player.mesh.position.set(LANDMARKS.casino.x + 4, 0, -70);
    player.heading = Math.PI;
    player.mesh.rotation.y = Math.PI;
    world.camera.snapBehind(player.pos, Math.PI, false);
    world.camera.yaw = Math.PI + 0.22;
    world.camera.pitch = 0.3;
    world.hud.showSubtitle('Lena', 'The case is in the lobby vault. Go.', 6000);
  } else {
    startPlaying();
  }

  // Let the world settle for a moment, then signal the capture.
  setTimeout(() => {
    window.__shotReady = true;
  }, 1600);
}
