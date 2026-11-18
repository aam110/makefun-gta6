// Wanted level, police pursuit cars, foot cops, arrests and the roadblock
// at five stars. Heat decays once the player stays out of sight.
import * as THREE from 'three';
import { CFG, S, clamp, rand } from './config.js';
import { createCar, damageCar } from './vehicles.js';
import { makePersonMesh, animateWalk } from './pedestrians.js';
import { resolveCollisions, randomRoadPoint } from './world.js';
import { burst, shake } from './effects.js';
import { AudioSys } from './audio.js';
import { hurtPlayer } from './player.js';

let roadblockDone = false;

export function addWanted(n, reason = '') {
  if (S.over) return;
  const before = S.wanted;
  S.wantedHeat = clamp(S.wantedHeat + n, 0, CFG.WANTED_MAX + 0.99);
  S.wanted = Math.floor(S.wantedHeat);
  S.lastSeenAt = S.elapsed;
  if (S.wanted > before && window.__onWantedUp) window.__onWantedUp(S.wanted, reason);
}

export function setWanted(n) {
  S.wantedHeat = n;
  S.wanted = clamp(n, 0, CFG.WANTED_MAX);
  S.lastSeenAt = S.elapsed;
}

export function clearWanted() {
  S.wantedHeat = 0;
  S.wanted = 0;
  for (const pc of S.policeCars) S.scene.remove(pc.car.mesh);
  for (const c of S.footCops) S.scene.remove(c.mesh);
  S.policeCars = [];
  S.footCops = [];
  roadblockDone = false;
  AudioSys.siren(false, 0);
}

function spawnPoliceCar() {
  const p = S.player.mesh.position;
  const spot = randomRoadPoint(p, 45);
  const car = createCar('police', spot.x, spot.z, spot.heading, { driver: 'police' });
  S.policeCars.push({ car, stuckTimer: 0, ramCooldown: 0 });
}

// Place a pursuit car at an exact spot (used by the staged screenshot modes).
export function spawnPoliceCarAt(x, z, heading) {
  const car = createCar('police', x, z, heading, { driver: 'police' });
  car.speed = 20;
  S.policeCars.push({ car, stuckTimer: 0, ramCooldown: 0 });
  return car;
}

function spawnFootCop() {
  const p = S.player.mesh.position;
  const a = rand(0, Math.PI * 2);
  const d = rand(14, 26);
  const x = clamp(p.x + Math.cos(a) * d, -CFG.CITY_R, CFG.CITY_R);
  const z = clamp(p.z + Math.sin(a) * d, -CFG.CITY_R, CFG.CITY_R);
  const mesh = makePersonMesh({ shirt: 0x1f3a93, pants: 0x14181f, hair: 0x1a1a1a });
  mesh.position.set(x, 0, z);
  S.scene.add(mesh);
  S.footCops.push({
    mesh, health: 100, dead: false, deadTimer: 0,
    heading: 0, phase: rand(0, 6), arrestTimer: 0, shootTimer: rand(0.5, 1.5),
  });
}

function placeRoadblock() {
  const p = S.player.mesh.position;
  const h = S.player.heading;
  const fx = Math.sin(h), fz = Math.cos(h);
  for (const side of [-1, 1]) {
    const bx = p.x + fx * 32 + -fz * side * 2.2;
    const bz = p.z + fz * 32 + fx * side * 2.2;
    const car = createCar('police', bx, bz, h + Math.PI / 2, { driver: 'police' });
    S.policeCars.push({ car, stuckTimer: 0, ramCooldown: 0, parked: true });
  }
  roadblockDone = true;
}

function bustPlayer() {
  if (S.over) return;
  S.over = true;
  S.overKind = 'busted';
  AudioSys.busted();
  AudioSys.engine(false, 0);
  AudioSys.siren(false, 0);
}

export function updatePolice(dt) {
  const p = S.player;
  if (!p || S.over) { AudioSys.siren(false, dt); return; }
  const pp = p.mesh.position;
  // Are the police on to us right now?
  let nearest = Infinity;
  for (const pc of S.policeCars) {
    const d = Math.hypot(pc.car.mesh.position.x - pp.x, pc.car.mesh.position.z - pp.z);
    nearest = Math.min(nearest, d);
  }
  for (const c of S.footCops) {
    if (c.dead) continue;
    const d = Math.hypot(c.mesh.position.x - pp.x, c.mesh.position.z - pp.z);
    nearest = Math.min(nearest, d);
  }
  if (nearest < 38) S.lastSeenAt = S.elapsed;
  // Heat decays after 8 unseen seconds.
  if (S.wanted > 0 && S.elapsed - S.lastSeenAt > 8) {
    S.wantedHeat = Math.max(0, S.wantedHeat - dt * 0.16);
    const w = Math.floor(S.wantedHeat);
    if (w < S.wanted) {
      S.wanted = w;
      if (window.__onWantedDown) window.__onWantedDown(w);
    }
    if (S.wanted === 0) clearWanted();
  }
  // Desired force.
  const wantCars = S.wanted === 0 ? 0 : Math.min(S.wanted + (S.wanted >= 3 ? 1 : 0), 4);
  const wantCops = S.wanted >= 2 ? Math.min(S.wanted - 1, 3) : 0;
  if (S.policeCars.length < wantCars && Math.random() < dt * 0.9) spawnPoliceCar();
  if (S.footCops.filter((c) => !c.dead).length < wantCops && Math.random() < dt * 0.7) spawnFootCop();
  if (S.wanted >= 5 && !roadblockDone) placeRoadblock();

  AudioSys.siren(S.policeCars.length > 0, dt);

  // Pursuit cars.
  for (let i = S.policeCars.length - 1; i >= 0; i--) {
    const pc = S.policeCars[i];
    const car = pc.car;
    if (car.dead) {
      S.scene.remove(car.mesh);
      S.policeCars.splice(i, 1);
      continue;
    }
    // Flash the light bar.
    const bar = car.mesh.userData.lightBar;
    if (bar) {
      const on = Math.floor(S.elapsed * 4) % 2 === 0;
      bar.children[0].material.emissiveIntensity = on ? 3 : 0.2;
      bar.children[1].material.emissiveIntensity = on ? 0.2 : 3;
    }
    if (pc.parked) continue; // roadblock cars hold their ground
    const cp = car.mesh.position;
    const dx = pp.x - cp.x, dz = pp.z - cp.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
    const targetSpeed = dist > 60 ? 38 : 26 + S.wanted * 1.6;
    car.speed += clamp(targetSpeed - car.speed, -dt * 18, dt * 10);
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    const nx = cp.x + fx * car.speed * dt;
    const nz = cp.z + fz * car.speed * dt;
    const fixed = resolveCollisions(nx, nz, CFG.CAR_RADIUS);
    const hit = Math.abs(fixed.x - nx) > 0.05 || Math.abs(fixed.z - nz) > 0.05;
    if (hit) {
      pc.stuckTimer += dt;
      car.speed *= 0.4;
      if (pc.stuckTimer > 1.2) { car.heading += Math.PI / 2; pc.stuckTimer = 0; }
    } else pc.stuckTimer = 0;
    car.mesh.position.x = fixed.x;
    car.mesh.position.z = fixed.z;
    car.mesh.rotation.y = car.heading;
    const spin = (car.speed * dt) / 0.38;
    car.mesh.userData.wheels.forEach((w) => { w.rotation.x += spin; });
    // Ram the player's car.
    pc.ramCooldown -= dt;
    if (dist < 3.6 && pc.ramCooldown <= 0) {
      pc.ramCooldown = 0.8;
      if (p.car) {
        damageCar(p.car, 6);
        burst(cp.x, 1, cp.z, 0xffd23f, 6, 4, 0.4);
        AudioSys.crash();
        shake(0.35);
        p.car.speed *= 0.6;
      } else if (p.speed < 1.5) {
        hurtPlayer(6);
        shake(0.3);
      }
    }
    // Busted: boxed in while stopped.
    if (p.car && p.speed < 0.5 && dist < 4 && S.wanted <= 2) {
      pc.arrestTimer = (pc.arrestTimer ?? 0) + dt;
      if (pc.arrestTimer > 3) bustPlayer();
    } else pc.arrestTimer = 0;
  }

  // Foot cops.
  for (let i = S.footCops.length - 1; i >= 0; i--) {
    const c = S.footCops[i];
    if (c.dead) {
      c.deadTimer -= dt;
      if (c.deadTimer <= 0) { S.scene.remove(c.mesh); S.footCops.splice(i, 1); }
      continue;
    }
    const cp = c.mesh.position;
    const dx = pp.x - cp.x, dz = pp.z - cp.z;
    const dist = Math.hypot(dx, dz);
    const speed = 8.6;
    if (dist > 2.2) {
      c.heading = Math.atan2(dx / (dist || 1), dz / (dist || 1));
      c.mesh.rotation.y = c.heading;
      const nx = cp.x + (dx / dist) * speed * dt;
      const nz = cp.z + (dz / dist) * speed * dt;
      const fixed = resolveCollisions(nx, nz, 0.6);
      c.mesh.position.x = fixed.x;
      c.mesh.position.z = fixed.z;
      c.phase += dt * 13;
      animateWalk(c.mesh, c.phase, 0.85);
      c.arrestTimer = 0;
    } else {
      // On top of the player: arrest, or shoot at high wanted.
      animateWalk(c.mesh, c.phase, 0);
      if (S.wanted >= 3) {
        c.shootTimer -= dt;
        if (c.shootTimer <= 0) {
          c.shootTimer = rand(1.0, 1.8);
          if (Math.random() < 0.3) hurtPlayer(rand(6, 11));
          AudioSys.enemyShot();
        }
      } else if (p.speed < 2) {
        c.arrestTimer += dt;
        if (c.arrestTimer > CFG.BUST_TIME) bustPlayer();
      }
    }
  }
}

export function hurtCop(cop, dmg) {
  if (cop.dead) return;
  cop.health -= dmg;
  if (cop.health <= 0) {
    cop.dead = true;
    cop.deadTimer = 8;
    cop.mesh.rotation.x = -Math.PI / 2;
    cop.mesh.position.y = 0.25;
    addWanted(2, 'officer down');
  }
}
