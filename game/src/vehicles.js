// Cars: boxy low-poly builds with spinning wheels, arcade physics for the
// player's car, damage, smoke and headlights.
import * as THREE from 'three';
import { CFG, CAR_TYPES, S, clamp, pick, rand } from './config.js';
import { resolveCollisions } from './world.js';
import { burst, smokePuff, shake } from './effects.js';
import { AudioSys } from './audio.js';

const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });

export function makeCarMesh(type, color) {
  const t = CAR_TYPES[type];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(t.wid, t.h, t.len), bodyMat);
  body.position.y = 0.75;
  body.castShadow = true;
  g.add(body);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.1, metalness: 0.8 });
  const cabinH = type === 'van' || type === 'truck' ? t.h * 0.9 : 0.62;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(t.wid * 0.86, cabinH, t.len * 0.45), glassMat);
  cabin.position.set(0, 0.75 + t.h / 2 + cabinH / 2 - 0.05, type === 'truck' ? t.len * 0.28 : -t.len * 0.06);
  cabin.castShadow = true;
  g.add(cabin);
  // Cargo bed for the truck.
  if (type === 'truck') {
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(t.wid * 0.95, 0.9, t.len * 0.5),
      new THREE.MeshStandardMaterial({ color: 0x6d6d6d, roughness: 0.8 }),
    );
    bed.position.set(0, 1.15, -t.len * 0.22);
    g.add(bed);
  }
  // Taxi sign.
  if (type === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.28, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xf2c200, emissiveIntensity: 0.7 }),
    );
    sign.position.set(0, 0.75 + t.h + 0.55, 0);
    g.add(sign);
  }
  // Police light bar.
  if (type === 'police') {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2 }));
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 2 }));
    red.position.x = -0.3; blue.position.x = 0.3;
    bar.add(red, blue);
    bar.position.set(0, 0.75 + t.h + 0.5, 0);
    g.add(bar);
    g.userData.lightBar = bar;
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(t.wid + 0.02, 0.3, t.len * 0.9),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }),
    );
    stripe.position.y = 0.8;
    g.add(stripe);
  }
  // Headlights + taillights.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0x000000 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa1010, emissive: 0x550000 });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.1), headMat);
    hl.position.set(sx * (t.wid / 2 - 0.35), 0.72, t.len / 2 + 0.02);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.1), tailMat);
    tl.position.set(sx * (t.wid / 2 - 0.35), 0.78, -t.len / 2 - 0.02);
    g.add(tl);
  }
  g.userData.headMat = headMat;
  S.headlightMeshes.push(headMat);
  // Wheels.
  const wheels = [];
  for (const [wx, wz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx * (t.wid / 2 - 0.05), 0.38, wz * (t.len / 2 - 0.75));
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.type = type;
  return g;
}

export function createCar(type, x, z, heading, opts = {}) {
  const t = CAR_TYPES[type];
  const color = opts.color ?? pick(t.colors);
  const mesh = makeCarMesh(type, color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  S.scene.add(mesh);
  const car = {
    mesh, type, heading, speed: 0, steer: 0,
    health: 100, color, dead: false, smokeTimer: 0,
    topSpeed: t.top * (opts.topMul ?? 1),
    accelMul: t.acc,
    driver: opts.driver ?? null, // 'player' | 'traffic' | 'police' | 'parked' | null
    ...opts.extra,
  };
  mesh.userData.car = car;
  return car;
}

export function destroyCar(car) {
  if (car.dead) return;
  car.dead = true;
  const p = car.mesh.position;
  burst(p.x, 1, p.z, 0xff7b00, 30, 9, 1.0);
  burst(p.x, 1, p.z, 0x444444, 20, 5, 1.6, 2);
  burst(p.x, 1, p.z, 0xffd23f, 16, 7, 0.5);
  shake(0.7);
  AudioSys.crash();
  car.mesh.rotation.z = 0.12;
  car.mesh.children.forEach((c) => {
    if (c.material && c.material.color) c.material.color.multiplyScalar(0.4);
  });
}

export function damageCar(car, amount, fromX = null, fromZ = null) {
  if (car.dead) return;
  car.health -= amount;
  if (car.health <= 0) destroyCar(car);
}

function allCars() {
  const out = [...S.traffic.map((t) => t.car), ...S.policeCars.map((p) => p.car), ...S.parked];
  if (S.player && S.player.car) out.push(S.player.car);
  return out;
}

// Arcade driving for the player's car. f: throttle -1..1, s: steer -1..1.
export function updatePlayerCar(dt, f, s) {
  const car = S.player.car;
  if (!car || car.dead) return;
  const t = CAR_TYPES[car.type];
  // Steering: sharper at low speed, gentle at high speed.
  const steerTarget = s * CFG.CAR_TURN * clamp(1.2 - Math.abs(car.speed) / car.topSpeed, 0.35, 1.2);
  car.steer = THREE.MathUtils.lerp(car.steer, steerTarget, Math.min(1, dt * 8));
  car.heading += car.steer * (car.speed / Math.max(6, Math.abs(car.speed))) * dt * clamp(Math.abs(car.speed) / 6, 0, 1) * (car.speed < 0 ? -1 : 1);
  if (f > 0) car.speed += CFG.CAR_ACCEL * car.accelMul * f * dt;
  else if (f < 0) {
    if (car.speed > 1) car.speed -= CFG.CAR_ACCEL * 2.2 * dt; // brake
    else car.speed -= CFG.CAR_ACCEL * 0.6 * dt; // reverse
  } else {
    car.speed -= car.speed * 0.6 * dt; // drag
    if (Math.abs(car.speed) < 0.15) car.speed = 0;
  }
  car.speed = clamp(car.speed, -CFG.CAR_REVERSE, car.topSpeed);
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  let nx = car.mesh.position.x + fx * car.speed * dt;
  let nz = car.mesh.position.z + fz * car.speed * dt;
  nx = clamp(nx, -CFG.CITY_R - 30, CFG.CITY_R + 30);
  nz = clamp(nz, -CFG.CITY_R - 30, CFG.CITY_R + 55);
  const before = { x: nx, z: nz };
  const fixed = resolveCollisions(nx, nz, CFG.CAR_RADIUS);
  nx = fixed.x; nz = fixed.z;
  const hitWall = Math.abs(before.x - nx) > 0.01 || Math.abs(before.z - nz) > 0.01;
  if (hitWall && Math.abs(car.speed) > 4) {
    damageCar(car, Math.abs(car.speed) * 0.55);
    burst(nx, 1, nz, 0xffd23f, 8, 5, 0.5);
    shake(Math.min(0.6, Math.abs(car.speed) * 0.02));
    AudioSys.crash();
    car.speed *= -0.25;
  }
  // Bumping other cars.
  for (const other of allCars()) {
    if (other === car || other.dead) continue;
    const o = other.mesh.position;
    const d2 = (o.x - nx) ** 2 + (o.z - nz) ** 2;
    if (d2 < (CFG.CAR_RADIUS * 2) ** 2) {
      const d = Math.sqrt(d2) || 0.01;
      const push = (CFG.CAR_RADIUS * 2 - d) / 2;
      const px = ((nx - o.x) / d) * push, pz = ((nz - o.z) / d) * push;
      nx += px; nz += pz;
      if (Math.abs(car.speed) > 3) {
        damageCar(car, 3);
        damageCar(other, 4);
        burst(nx, 1, nz, 0xffd23f, 6, 4, 0.4);
        AudioSys.crash();
        car.speed *= 0.55;
      }
    }
  }
  car.mesh.position.x = nx;
  car.mesh.position.z = nz;
  car.mesh.rotation.y = car.heading;
  // Wheel spin + front-wheel yaw.
  const spin = (car.speed * dt) / 0.38;
  car.mesh.userData.wheels.forEach((w, i) => {
    w.rotation.x += spin;
    if (i < 2) w.rotation.y = car.steer * 0.35;
  });
  // Smoke when battered.
  if (car.health < 45) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.12;
      smokePuff(nx + fx * 1.5, 1.2, nz + fz * 1.5);
    }
  }
  AudioSys.engine(true, Math.abs(car.speed) / car.topSpeed);
}

export function carHeadlightGlow(on) {
  for (const m of S.headlightMeshes) m.emissive.setHex(on ? 0xfff2a0 : 0x000000);
}
