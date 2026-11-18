// Rio Vale: on-foot movement, stealing and driving cars, health and money.
import * as THREE from 'three';
import { CFG, S, clamp } from './config.js';
import { makePersonMesh, animateWalk, hurtPed } from './pedestrians.js';
import { resolveCollisions } from './world.js';
import { updatePlayerCar, destroyCar } from './vehicles.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { addWanted } from './police.js';

export function createPlayer(x = 0, z = 60) {
  const mesh = makePersonMesh({ shirt: 0x1b9aaa, pants: 0x2c3e50, hair: 0x2b1d12 });
  mesh.position.set(x, 0, z);
  S.scene.add(mesh);
  S.player = {
    mesh,
    heading: Math.PI,
    health: CFG.PLAYER_HEALTH,
    money: 0,
    weapon: 'pistol',
    ammo: { pistol: { mag: 12, res: 96 }, smg: { mag: 30, res: 120 } },
    car: null,
    onFoot: true,
    walkPhase: 0,
    speed: 0,
    hurtFlash: 0,
    invuln: 0,
  };
  return S.player;
}

function nearestStealable(maxDist) {
  const p = S.player.mesh.position;
  let best = null, bd = maxDist * maxDist;
  const cands = [
    ...S.parked,
    ...S.traffic.map((t) => t.car),
  ];
  for (const car of cands) {
    if (car.dead || car.driver === 'player') continue;
    if (car.driver === 'traffic' && Math.abs(car.speed) > 2) continue;
    const d2 = (car.mesh.position.x - p.x) ** 2 + (car.mesh.position.z - p.z) ** 2;
    if (d2 < bd) { bd = d2; best = car; }
  }
  return best;
}

export function tryEnterCar() {
  const p = S.player;
  if (!p.onFoot) return;
  const car = nearestStealable(4.5);
  if (!car) return;
  // Leaving a traffic car driverless: remove it from the traffic roster.
  const ti = S.traffic.findIndex((t) => t.car === car);
  if (ti !== -1) S.traffic.splice(ti, 1);
  const pi = S.parked.indexOf(car);
  if (pi !== -1) S.parked.splice(pi, 1);
  car.driver = 'player';
  car.parked = false;
  p.car = car;
  p.onFoot = false;
  p.mesh.visible = false;
  S.stats.carsStolen++;
  AudioSys.click();
  if (car.missionTarget) {
    // Hot Wheels: the alarm screams.
    addWanted(1, 'car alarm');
    if (window.__onMissionCarStolen) window.__onMissionCarStolen();
  } else if (car.driverWasTraffic || ti !== -1) {
    addWanted(1, 'carjacking');
  } else {
    addWanted(1, 'theft');
  }
}

export function exitCar() {
  const p = S.player;
  if (p.onFoot || !p.car) return;
  const car = p.car;
  car.speed = 0;
  const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
  const px = car.mesh.position.x + side.x * 2.6;
  const pz = car.mesh.position.z + side.z * 2.6;
  const fixed = resolveCollisions(px, pz, CFG.PLAYER_RADIUS);
  p.mesh.position.set(fixed.x, 0, fixed.z);
  p.mesh.visible = true;
  p.heading = car.heading;
  p.mesh.rotation.y = p.heading;
  p.car = null;
  p.onFoot = true;
  AudioSys.engine(false, 0);
  AudioSys.click();
}

export function hurtPlayer(amount) {
  const p = S.player;
  if (!p || S.over || p.invuln > 0) return;
  p.health = Math.max(0, p.health - amount);
  p.hurtFlash = 1;
  p.invuln = 0.15;
  if (p.health <= 0) {
    S.over = true;
    S.overKind = 'wasted';
    AudioSys.wasted();
    AudioSys.engine(false, 0);
  }
}

export function healPlayer(amount) {
  const p = S.player;
  p.health = Math.min(CFG.PLAYER_HEALTH, p.health + amount);
}

export function addMoney(amount) {
  S.player.money += amount;
  AudioSys.cash();
}

export function updatePlayer(dt, camYaw) {
  const p = S.player;
  if (!p || S.over) return;
  p.hurtFlash = Math.max(0, p.hurtFlash - dt * 2);
  p.invuln = Math.max(0, p.invuln - dt);
  // Slow health regen out of combat.
  if (p.health > 0 && p.health < CFG.PLAYER_HEALTH && S.wanted === 0) {
    p.health = Math.min(CFG.PLAYER_HEALTH, p.health + dt * 1.2);
  }
  if (!p.onFoot && p.car) {
    const { f, s } = Input.axis();
    updatePlayerCar(dt, f, s);
    p.mesh.position.copy(p.car.mesh.position);
    p.heading = p.car.heading;
    p.speed = Math.abs(p.car.speed);
    // Running over pedestrians is a crime.
    for (const ped of S.peds) {
      if (ped.dead) continue;
      const d2 = (ped.mesh.position.x - p.mesh.position.x) ** 2 + (ped.mesh.position.z - p.mesh.position.z) ** 2;
      if (d2 < 3.2 && p.speed > 4) {
        const wasAlive = ped.health > 0;
        hurtPed(ped, 200, p.mesh.position.x, p.mesh.position.z);
        if (wasAlive) addWanted(1, 'hit and run');
      }
    }
    return;
  }
  // On foot.
  const { f, s } = Input.axis();
  const sprint = Input.down('ShiftLeft') || Input.down('ShiftRight');
  const speed = sprint ? CFG.SPRINT_SPEED : CFG.WALK_SPEED;
  let mx = 0, mz = 0;
  if (f !== 0 || s !== 0) {
    // Camera-relative movement: forward is where the camera looks.
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    mx = fx * f + rx * s;
    mz = fz * f + rz * s;
    const len = Math.hypot(mx, mz) || 1;
    mx /= len; mz /= len;
    p.heading = Math.atan2(mx, mz);
    p.mesh.rotation.y = p.heading;
    const nx = p.mesh.position.x + mx * speed * dt;
    const nz = p.mesh.position.z + mz * speed * dt;
    const fixed = resolveCollisions(
      clamp(nx, -CFG.CITY_R - 30, CFG.CITY_R + 30),
      clamp(nz, -CFG.CITY_R - 30, CFG.CITY_R + 55),
      CFG.PLAYER_RADIUS,
    );
    p.mesh.position.x = fixed.x;
    p.mesh.position.z = fixed.z;
    p.speed = speed;
    p.walkPhase += dt * (sprint ? 13 : 9);
    animateWalk(p.mesh, p.walkPhase, sprint ? 0.85 : 0.6);
    p.mesh.position.y = Math.abs(Math.sin(p.walkPhase)) * 0.06;
  } else {
    p.speed = 0;
    p.mesh.position.y = 0;
    animateWalk(p.mesh, p.walkPhase, 0);
  }
  // Interact prompt for nearby cars.
  if (!S.interactTarget) {
    const car = nearestStealable(4.5);
    if (car) S.interactTarget = { label: car.missionTarget ? 'Press F — steal the marked car' : 'Press F — steal car', fn: tryEnterCar, kind: 'car' };
  }
}
