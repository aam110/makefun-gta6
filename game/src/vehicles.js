// CAYO BRAVO — vehicles.js: car meshes, arcade driving physics, entering and
// exiting cars, damage and smoke. Every car is built from boxes and cylinders.

import * as THREE from 'three';
import { VEHICLE_MODELS, clamp, lerp } from './config.js';
import { resolveBuildingCollision, mergeGeometries } from './world.js';

function xform(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  m.setPosition(x, y, z);
  return geo.clone().applyMatrix4(m);
}

// Cars are built from merged geometry: body, cabin, two spinnable axles,
// merged headlights/taillights and one dark-trim mesh — ~6 draw calls a car.
export function buildCarMesh(model, rng) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: model.body, roughness: 0.35, metalness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x101828, roughness: 0.15, metalness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14141c, roughness: 0.9 });
  const bodyLen = model.kind === 'truck' ? 5.2 : 4.6;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, bodyLen), paint);
  body.position.y = 0.72;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, bodyLen * 0.5), glass);
  cabin.position.set(0, 1.35, model.kind === 'truck' ? -0.9 : -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  // Dark trim (spoiler + skirt + bed) merged into one mesh.
  const trimGeos = [];
  if (model.kind === 'sport') {
    trimGeos.push(xform(new THREE.BoxGeometry(1.9, 0.1, 0.5), 0, 1.15, bodyLen / 2 - 0.2));
    trimGeos.push(xform(new THREE.BoxGeometry(2.06, 0.22, bodyLen * 0.9), 0, 0.42, 0));
  }
  if (model.kind === 'truck') trimGeos.push(xform(new THREE.BoxGeometry(1.9, 0.5, 1.9), 0, 1.05, 1.4));
  if (trimGeos.length) g.add(new THREE.Mesh(mergeGeometries(trimGeos), dark));
  // Headlights + taillights, merged per colour.
  const headGeos = [-1, 1].map((s) => xform(new THREE.BoxGeometry(0.42, 0.22, 0.1), s * 0.68, 0.75, -bodyLen / 2 - 0.03));
  g.add(new THREE.Mesh(mergeGeometries(headGeos), new THREE.MeshBasicMaterial({ color: 0xfff6c8 })));
  const tailGeos = [-1, 1].map((s) => xform(new THREE.BoxGeometry(0.42, 0.22, 0.1), s * 0.68, 0.75, bodyLen / 2 + 0.03));
  g.add(new THREE.Mesh(mergeGeometries(tailGeos), new THREE.MeshBasicMaterial({ color: 0xff2f4e })));
  // Wheels: both wheels of an axle merged, spinning around the axle line.
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.9 });
  const axles = [];
  for (const wz of [-1.5, 1.5]) {
    const wheelGeos = [-0.95, 0.95].map((wx) =>
      xform(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10), wx, 0, 0, 0, 0, Math.PI / 2));
    const axle = new THREE.Mesh(mergeGeometries(wheelGeos), wheelMat);
    axle.position.set(0, 0.38, wz);
    axle.castShadow = true;
    g.add(axle);
    axles.push(axle);
  }
  if (model.kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    bar.position.set(0, 1.78, -0.2);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.26, 0.44),
      new THREE.MeshBasicMaterial({ color: 0xff2f4e }));
    red.position.set(-0.4, 1.78, -0.2);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.26, 0.44),
      new THREE.MeshBasicMaterial({ color: 0x2f7bff }));
    blue.position.set(0.4, 1.78, -0.2);
    g.add(blue);
    g.userData.lightbar = { red, blue };
  }
  g.userData.axles = axles;
  return g;
}

export function spawnVehicle(scene, modelIndex, x, z, heading, opts = {}) {
  const model = VEHICLE_MODELS[modelIndex];
  const mesh = buildCarMesh(model);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh, model, modelIndex,
    x, z, heading, speed: 0,
    condition: opts.condition ?? 100,
    isPolice: model.kind === 'police',
    isPlayer: false,
    driver: opts.driver ?? null, // 'traffic' | 'cop' | 'target' | null (parked)
    steering: 0, dead: false,
    smokeTimer: 0,
    flashTimer: 0,
  };
}

// Arcade car physics: accelerate, steer scaled by speed, grip drift, collisions.
export function updatePlayerCar(car, input, dt, G) {
  const m = car.model;
  const accelInput = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  if (accelInput > 0) car.speed += m.accel * dt * (car.speed < 0 ? 2.2 : 1);
  else if (accelInput < 0) car.speed -= (car.speed > 0.5 ? m.accel * 1.6 : m.accel * 0.6) * dt;
  else car.speed *= Math.pow(0.85, dt); // gentle rolling drag
  if (input.handbrake) { car.speed *= Math.pow(0.12, dt); }
  car.speed = clamp(car.speed, -14, m.top * (car.condition < 30 ? 0.6 : 1));
  const gripFactor = input.handbrake ? 0.35 : 1;
  const steerRate = steerInput * m.grip * clamp(Math.abs(car.speed) / 12, 0, 1) * gripFactor;
  car.heading += steerRate * dt * Math.sign(car.speed || 1);
  car.steering = lerp(car.steering, steerInput * 0.5, dt * 8);
  const nx = car.x - Math.sin(car.heading) * car.speed * dt;
  const nz = car.z - Math.cos(car.heading) * car.speed * dt;
  const hit = moveCarWithCollisions(car, nx, nz, G);
  if (hit) {
    car.speed *= 0.45;
    car.condition = Math.max(0, car.condition - Math.abs(car.speed) * 0.12 - 1.5);
    G.effects.addSparks(car.x, 1, car.z, 6);
    G.audio.thud();
    if (car.condition <= 0 && !car.dead) killCar(car, G);
  }
  syncCarMesh(car, dt);
}

export function moveCarWithCollisions(car, nx, nz, G) {
  const H = 292;
  nx = clamp(nx, -H, H); nz = clamp(nz, -H, H);
  const res = resolveBuildingCollision(G.world.colliders, nx, nz, 2.2);
  car.x = res.x; car.z = res.z;
  // Bump into other cars: simple circle push.
  let hit = res.hit;
  for (const other of G.vehicles) {
    if (other === car || other.dead) continue;
    const dx = car.x - other.x, dz = car.z - other.z;
    const d = Math.hypot(dx, dz);
    if (d < 4.2 && d > 0.01) {
      const push = (4.2 - d) / 2;
      car.x += (dx / d) * push; car.z += (dz / d) * push;
      other.x -= (dx / d) * push; other.z -= (dz / d) * push;
      other.mesh.position.set(other.x, 0, other.z);
      car.speed *= 0.7;
      // Ramming damages the other car — this is how wreck missions are won.
      if (car.isPlayer && !other.isPlayer && !other.dead) {
        other.condition = Math.max(0, other.condition - 8);
        if (other.condition <= 0) killCar(other, G);
      }
      hit = true;
    }
  }
  return hit;
}

export function syncCarMesh(car, dt) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const axles = car.mesh.userData.axles;
  if (axles) for (const a of axles) a.rotation.x += (car.speed * dt) / 0.38;
  // Police lightbar strobe.
  if (car.isPolice && car.mesh.userData.lightbar) {
    car.flashTimer += dt;
    const on = Math.floor(car.flashTimer * 6) % 2 === 0;
    car.mesh.userData.lightbar.red.material.color.setHex(on ? 0xff2f4e : 0x551018);
    car.mesh.userData.lightbar.blue.material.color.setHex(on ? 0x102a55 : 0x2f7bff);
  }
  // Damage smoke.
  if (car.condition < 45 && !car.dead) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.12;
      return true; // caller spawns a smoke puff
    }
  }
  return false;
}

export function killCar(car, G) {
  car.dead = true;
  car.speed = 0;
  G.effects.explode(car.x, 1, car.z);
  G.audio.explosion();
  car.mesh.rotation.z = 0.12;
  const mat = car.mesh.children[0].material;
  if (mat) mat.color.setHex(0x2a2a2a);
}

export function nearestVehicle(G, x, z, maxDist) {
  let best = null, bestD = maxDist;
  for (const v of G.vehicles) {
    if (v.dead) continue;
    const d = Math.hypot(v.x - x, v.z - z);
    if (d < bestD) { best = v; bestD = d; }
  }
  return best;
}

// Steal / enter a car: pull the driver out if it has one, sit the player in.
export function enterCar(G, car) {
  if (car.driver === 'traffic') {
    // The driver flees on foot.
    G.pedestrians.spawnFleeingPed(G, car.x + 2, car.z + 2);
    car.driver = null;
    G.player.wanted = Math.max(G.player.wanted, 1);
    G.hud.toast('CAR JACKED — CBPD ALERTED');
    G.audio.sirenBlip();
  }
  car.isPlayer = true;
  car.driver = 'player';
  G.player.car = car;
  G.player.onFoot = false;
  G.player.mesh.visible = false;
  G.audio.engineStart();
}

export function exitCar(G) {
  const car = G.player.car;
  if (!car) return;
  car.isPlayer = false;
  car.driver = null;
  car.speed = 0;
  G.player.car = null;
  G.player.onFoot = true;
  G.player.mesh.visible = true;
  G.player.x = car.x + Math.cos(car.heading) * 3;
  G.player.z = car.z - Math.sin(car.heading) * 3;
  G.player.heading = car.heading;
  G.player.mesh.position.set(G.player.x, 0, G.player.z);
}

// Parked cars scattered around the city for the player to steal.
export function spawnParkedCars(G, rng, count) {
  const spots = [];
  for (let i = 0; i < count; i++) {
    const road = -240 + Math.floor(rng() * 9) * 60;
    const along = -260 + rng() * 520;
    const vertical = rng() < 0.5;
    const x = vertical ? road + 5.5 : along;
    const z = vertical ? along : road + 5.5;
    const modelIndex = Math.floor(rng() * 7);
    const car = spawnVehicle(G.scene, modelIndex, x, z, vertical ? 0 : Math.PI / 2);
    car.driver = null;
    G.vehicles.push(car);
    spots.push(car);
  }
  return spots;
}
