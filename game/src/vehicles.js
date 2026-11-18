// Cars: low-poly mesh factory, arcade driving physics shared by the player,
// traffic and police, plus enter / exit / carjack. A car is one plain object:
// { group, wheels[], x, z, heading, speed, kind, color, health, driver, ... }

import * as THREE from 'three';
import { PALETTE, clamp, lerp, pick, rand, angleLerp, distXZ } from './config.js';
import { collideCircle } from './world.js';

export const CAR_KINDS = {
  sedan: { name: 'Meridian Sedan', topSpeed: 34, accel: 16, brake: 30, grip: 2.4, body: [1.9, 0.75, 4.4], cabin: [1.7, 0.65, 2.2] },
  sport: { name: 'Falcon GT', topSpeed: 46, accel: 24, brake: 34, grip: 3.0, body: [1.9, 0.6, 4.3], cabin: [1.6, 0.55, 1.9] },
  taxi: { name: 'Sun Cab', topSpeed: 33, accel: 15, brake: 30, grip: 2.4, body: [1.9, 0.75, 4.4], cabin: [1.7, 0.65, 2.2] },
  van: { name: 'Harbor Van', topSpeed: 27, accel: 11, brake: 26, grip: 2.0, body: [2.0, 1.1, 4.8], cabin: [1.9, 0.8, 2.6] },
  police: { name: 'SBPD Interceptor', topSpeed: 40, accel: 21, brake: 36, grip: 2.9, body: [1.9, 0.72, 4.5], cabin: [1.7, 0.62, 2.2] },
  muscle: { name: 'Vulture Muscle', topSpeed: 42, accel: 22, brake: 30, grip: 2.6, body: [2.0, 0.7, 4.6], cabin: [1.7, 0.6, 2.0] },
};

const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x15161a });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x16222e });
const chromeMat = new THREE.MeshLambertMaterial({ color: 0xd8dce2 });

export function createCarMesh(kind, colorHex) {
  const spec = CAR_KINDS[kind];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const [bw, bh, bl] = spec.body;
  const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bl), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const [cw, ch, cl] = spec.cabin;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cl), glassMat);
  cabin.position.set(0, 0.62 + bh / 2 + ch / 2 - 0.05, kind === 'van' ? 0.4 : -0.2);
  g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.06, 0.1, cl * 0.8), bodyMat);
  roof.position.set(0, cabin.position.y + ch / 2 + 0.03, cabin.position.z);
  g.add(roof);
  // bumpers + lights
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.06, 0.22, 0.25), chromeMat);
  bumperF.position.set(0, 0.42, -bl / 2 - 0.08);
  g.add(bumperF);
  const bumperR = bumperF.clone();
  bumperR.position.z = bl / 2 + 0.08;
  g.add(bumperR);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const sx of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.1), headMat);
    head.position.set(sx * (bw / 2 - 0.3), 0.68, -bl / 2 - 0.03);
    g.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    tail.position.set(sx * (bw / 2 - 0.3), 0.68, bl / 2 + 0.03);
    g.add(tail);
  }
  // wheels
  const wheels = [];
  for (const [wx, wz] of [[-bw / 2, -bl / 2 + 0.7], [bw / 2, -bl / 2 + 0.7], [-bw / 2, bl / 2 - 0.7], [bw / 2, bl / 2 - 0.7]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
    wheels.push(w);
  }
  // kind extras
  let lightBar = null;
  if (kind === 'police') {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.3;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.x = 0.3;
    bar.add(red); bar.add(blue);
    bar.position.set(0, cabin.position.y + ch / 2 + 0.18, cabin.position.z);
    g.add(bar);
    lightBar = { red: red.material, blue: blue.material };
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.04, 0.3, bl * 0.9),
      new THREE.MeshLambertMaterial({ color: 0x1a3a8a }));
    stripe.position.y = 0.62;
    g.add(stripe);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffe066 }));
    sign.position.set(0, cabin.position.y + ch / 2 + 0.18, cabin.position.z);
    g.add(sign);
  }
  if (kind === 'sport' || kind === 'muscle') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.4), bodyMat);
    spoiler.position.set(0, 1.15, bl / 2 - 0.2);
    g.add(spoiler);
  }
  return { group: g, wheels, lightBar };
}

export function makeCar(G, kind, x, z, heading, opts = {}) {
  const color = opts.color ?? (kind === 'police' ? 0xf2f4f6 : kind === 'taxi' ? 0xf2c230 : pick(PALETTE.car));
  const { group, wheels, lightBar } = createCarMesh(kind, color);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  G.scene.add(group);
  const car = {
    kind, color, group, wheels, lightBar,
    spec: CAR_KINDS[kind],
    x, z, heading, speed: 0, steer: 0,
    health: 100, driver: opts.driver ?? null, // 'player' | 'traffic' | 'police' | 'parked' | null
    ai: opts.ai ?? null,
    dead: false, smokeTimer: 0, skidTimer: 0, honkTimer: 0,
    name: CAR_KINDS[kind].name,
    missionCar: opts.missionCar ?? false,
  };
  G.cars.push(car);
  return car;
}

export function removeCar(G, car) {
  G.scene.remove(car.group);
  const i = G.cars.indexOf(car);
  if (i !== -1) G.cars.splice(i, 1);
  car.dead = true;
}

// Arcade driving step shared by every driver. throttle -1..1, steer -1..1.
export function driveCar(G, car, dt, throttle, steer, handbrake = false) {
  const spec = car.spec;
  const targetSteer = clamp(steer, -1, 1);
  car.steer = lerp(car.steer, targetSteer, Math.min(1, dt * 8));
  const speed01 = clamp(Math.abs(car.speed) / spec.topSpeed, 0, 1);
  if (throttle > 0) car.speed += spec.accel * throttle * dt * (1 - speed01 * 0.55);
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed += spec.brake * throttle * dt; // braking
    else car.speed += spec.accel * 0.55 * throttle * dt; // reversing
  }
  // drag + rolling resistance
  car.speed -= car.speed * (handbrake ? 1.6 : 0.35) * dt;
  if (Math.abs(car.speed) < 0.05 && throttle === 0) car.speed = 0;
  car.speed = clamp(car.speed, -spec.topSpeed * 0.4, spec.topSpeed);
  const turnRate = car.steer * spec.grip * clamp(Math.abs(car.speed) / 8, 0, 1) * (car.speed >= 0 ? 1 : -1);
  car.heading += turnRate * dt * (handbrake ? 1.5 : 1);
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  const nx = car.x - fx * car.speed * dt;
  const nz = car.z - fz * car.speed * dt;
  const pos = { x: nx, z: nz };
  const hitWall = collideCircle(G, pos, 2.1);
  car.x = pos.x;
  car.z = pos.z;
  if (hitWall && Math.abs(car.speed) > 6) {
    const impact = Math.abs(car.speed);
    car.speed *= -0.25;
    damageCar(G, car, impact * 0.9);
    G.fx.burst(car.x - fx * 2, 0.8, car.z - fz * 2, 0xffd23e, 8, 4);
    G.fx.addShake(Math.min(0.5, impact * 0.02));
    if (car.driver === 'player') G.audio.crash(impact > 18);
    if (impact > 12) G.events.push({ type: 'crash', x: car.x, z: car.z });
  }
  // car-vs-car soft push
  for (const other of G.cars) {
    if (other === car || other.dead) continue;
    const d = distXZ(car.x, car.z, other.x, other.z);
    if (d < 3.4 && d > 0.01) {
      const push = (3.4 - d) * 0.5;
      const px = (car.x - other.x) / d;
      const pz = (car.z - other.z) / d;
      car.x += px * push;
      car.z += pz * push;
      if (other.driver !== 'player') { other.x -= px * push * 0.4; other.z -= pz * push * 0.4; }
      const rel = Math.abs(car.speed - other.speed);
      if (rel > 8) {
        damageCar(G, car, rel * 0.5);
        damageCar(G, other, rel * 0.5);
        car.speed *= 0.6;
        G.events.push({ type: 'crash', x: car.x, z: car.z });
        if (car.driver === 'player' || other.driver === 'player') G.audio.crash(rel > 16);
      }
    }
  }
  // visuals
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  const wheelSpin = car.speed * dt * 2.4;
  for (const w of car.wheels) w.rotation.x += wheelSpin;
  // skid marks + smoke when drifting or damaged
  car.skidTimer -= dt;
  if ((handbrake && Math.abs(car.speed) > 10) || (Math.abs(car.steer) > 0.85 && Math.abs(car.speed) > 22)) {
    if (car.skidTimer <= 0) {
      car.skidTimer = 0.09;
      G.fx.skid(car.x + fx * 1.6, car.z + fz * 1.6, car.heading);
      G.fx.smoke(car.x + fx * 1.8, 0.3, car.z + fz * 1.8, 1);
    }
  }
  car.smokeTimer -= dt;
  if (car.health < 40 && car.smokeTimer <= 0) {
    car.smokeTimer = 0.12;
    G.fx.smoke(car.x - fx * 1.8, 1.1, car.z - fz * 1.8, 1);
  }
  // police light bar strobe
  if (car.lightBar) {
    const on = Math.floor(G.elapsed * 6) % 2 === 0;
    car.lightBar.red.color.setHex(on ? 0xff2222 : 0x551111);
    car.lightBar.blue.color.setHex(on ? 0x112266 : 0x2244ff);
  }
}

export function damageCar(G, car, amount) {
  if (car.dead) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    G.fx.explosion(car.x, 1, car.z);
    G.audio.explosion();
    G.events.push({ type: 'explosion', x: car.x, z: car.z });
    // hurt anyone close
    const p = G.player;
    if (distXZ(p.x, p.z, car.x, car.z) < 9) hurtPlayer(G, 40, 'explosion');
    for (const e of G.enemies) {
      if (distXZ(e.x, e.z, car.x, car.z) < 9) damageEnemy(G, e, 120);
    }
    if (car.driver === 'player') {
      exitCar(G, true);
      G.hud.notify('Your ride blew up!', 'bad');
    }
    removeCar(G, car);
  }
}

// ---- Player enter / exit / carjack ----

export function nearestCar(G, x, z, maxDist) {
  let best = null;
  let bd = maxDist;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = distXZ(x, z, car.x, car.z);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

export function tryEnterCar(G) {
  const p = G.player;
  const car = nearestCar(G, p.x, p.z, 4.2);
  if (!car) return false;
  if (car.driver === 'traffic' || car.driver === 'police') {
    // CARJACK: yank the driver out, they flee on foot
    carjackCar(G, car);
  } else if (car.driver === 'parked') {
    G.hud.notify(`You took the ${car.name}`, 'good');
    G.events.push({ type: 'steal', x: car.x, z: car.z });
  }
  car.driver = 'player';
  p.car = car;
  p.onFoot = false;
  p.group.visible = false;
  car.speed = 0;
  G.audio.click();
  return true;
}

export function carjackCar(G, car) {
  // the driver becomes a fleeing pedestrian
  const { spawnPed } = G.modules.pedestrians;
  const ped = spawnPed(G, car.x + 2, car.z + 1, { fleeFrom: { x: car.x, z: car.z } });
  if (ped) ped.fleeTime = 6;
  G.hud.notify('Carjacked! The driver ran for it.', 'bad');
  G.events.push({ type: 'steal', x: car.x, z: car.z });
  G.audio.horn();
}

export function exitCar(G, forced = false) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  car.driver = 'parked';
  car.speed = 0;
  p.car = null;
  p.onFoot = true;
  p.group.visible = true;
  // step out on the left side
  p.x = car.x + Math.cos(car.heading) * 2.4;
  p.z = car.z - Math.sin(car.heading) * 2.4;
  const pos = { x: p.x, z: p.z };
  collideCircle(G, pos, 0.6);
  p.x = pos.x; p.z = pos.z;
  p.heading = car.heading;
  if (!forced) G.audio.click();
}

// imported lazily to avoid a cycle: combat.js imports vehicles.js
import { hurtPlayer, damageEnemy } from './combat.js';
export { hurtPlayer, damageEnemy };
