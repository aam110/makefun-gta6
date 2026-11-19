// Palmera Heat — cars: mesh factory, arcade driving, traffic.
// A car is a small group of boxes (body, cabin, wheels, lights) with a
// heading and a speed. Player driving is arcade: accelerate, steer, brake,
// handbrake drift. Traffic cars follow road lanes and turn at intersections.

import * as THREE from 'three';
import { CITY, CAR, CAR_COLORS } from './config.js';
import { circleHits, resolveCircle } from './city.js';

const WHEEL_GEO = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
const WHEEL_MAT = new THREE.MeshLambertMaterial({ color: 0x181818 });
const GLASS_MAT = new THREE.MeshLambertMaterial({ color: 0x1d3038 });
const LIGHT_MAT = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
const TAIL_MAT = new THREE.MeshBasicMaterial({ color: 0xd21f1f });

export function makeCarMesh(kind, colorHex) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const isLimo = kind === 'limo';
  const isTruck = kind === 'truck';
  const isVan = kind === 'van';
  const length = isLimo ? 5.6 : isTruck ? 4.6 : 4.2;
  const width = isVan || isTruck ? 2.2 : 1.9;

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, 0.72, length), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);

  let cabin;
  if (isTruck) {
    cabin = new THREE.Mesh(new THREE.BoxGeometry(width * 0.94, 1.0, 1.4), bodyMat);
    cabin.position.set(0, 1.35, length / 2 - 1.0);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.5, length / 2), GLASS_MAT);
    bed.position.set(0, 1.05, -length / 4);
    group.add(bed);
  } else if (isVan) {
    cabin = new THREE.Mesh(new THREE.BoxGeometry(width * 0.94, 1.0, length * 0.8), bodyMat);
    cabin.position.set(0, 1.4, -0.2);
  } else {
    cabin = new THREE.Mesh(new THREE.BoxGeometry(width * 0.86, 0.66, length * 0.46), GLASS_MAT);
    cabin.position.set(0, 1.28, isLimo ? -0.2 : -0.25);
  }
  cabin.castShadow = true;
  group.add(cabin);

  // Headlights and taillights.
  for (const s of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), LIGHT_MAT);
    head.position.set(s * (width / 2 - 0.32), 0.66, length / 2 + 0.02);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.1), TAIL_MAT);
    tail.position.set(s * (width / 2 - 0.32), 0.66, -length / 2 - 0.02);
    group.add(tail);
  }

  // Wheels.
  const wheels = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const wheel = new THREE.Mesh(WHEEL_GEO, WHEEL_MAT);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx * (width / 2 - 0.05), 0.38, sz * (length / 2 - 0.75));
    group.add(wheel);
    wheels.push(wheel);
  }

  let lightbar = null;
  if (kind === 'police') {
    lightbar = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    red.position.x = -0.35;
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2266ff }),
    );
    blue.position.x = 0.35;
    lightbar.add(red, blue);
    lightbar.position.set(0, 1.72, -0.2);
    group.add(lightbar);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.02, 0.3, length * 0.9),
      new THREE.MeshLambertMaterial({ color: 0x1d3a5f }),
    );
    stripe.position.y = 0.62;
    group.add(stripe);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.28, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffe14d }),
    );
    sign.position.set(0, 1.78, -0.2);
    group.add(sign);
  }

  return { group, wheels, bodyMat, lightbar, length };
}

// ---------------------------------------------------------------------------

let CAR_ID = 1;

export class Car {
  constructor(scene, kind, colorHex, x, z, heading) {
    this.id = CAR_ID++;
    this.kind = kind;
    this.scene = scene;
    const built = makeCarMesh(kind, colorHex);
    this.mesh = built.group;
    this.wheels = built.wheels;
    this.bodyMat = built.bodyMat;
    this.lightbar = built.lightbar;
    this.length = built.length;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.health = CAR.maxHealth;
    this.maxHealth = kind === 'limo' ? 300 : CAR.maxHealth;
    this.health = this.maxHealth;
    this.dead = false;
    this.smoking = false;
    this.driver = 'parked';
    this.owned = false;
    this.isPlayerCar = false;
    this.colorHex = colorHex;
    scene.add(this.mesh);
  }

  get pos() {
    return this.mesh.position;
  }

  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  get maxSpeed() {
    if (this.kind === 'sport') return CAR.sportMaxSpeed;
    if (this.kind === 'police') return 38;
    if (this.kind === 'truck' || this.kind === 'van') return 27;
    return CAR.maxSpeed;
  }

  spinWheels(dt) {
    const spin = (this.speed / 0.38) * dt;
    for (const w of this.wheels) w.rotation.x += spin;
  }

  /** Arcade driving step for a car the player (or police AI) steers. */
  drive(dt, throttle, steerInput, handbrake, colliders) {
    if (this.dead) {
      this.speed *= Math.max(0, 1 - 2 * dt);
      return;
    }
    const max = this.maxSpeed;
    if (throttle > 0) this.speed += CAR.accel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= CAR.brake * dt;
      else this.speed = Math.max(this.speed + CAR.accel * 0.6 * throttle * dt, -CAR.reverseMax);
    } else {
      this.speed -= this.speed * 0.55 * dt;
      if (Math.abs(this.speed) < 0.05) this.speed = 0;
    }
    if (handbrake) this.speed -= this.speed * 1.6 * dt;
    this.speed = Math.max(-CAR.reverseMax, Math.min(max, this.speed));

    const speedFactor = Math.min(1, Math.abs(this.speed) / 9);
    const grip = handbrake ? 1.9 : 1;
    this.steer += (steerInput - this.steer) * Math.min(1, dt * 8);
    this.heading += this.steer * CAR.steerRate * speedFactor * grip * dt * Math.sign(this.speed || 1);

    const f = this.forward();
    const step = this.speed * dt;
    const next = { x: this.pos.x + f.x * step, z: this.pos.z + f.z * step };
    if (circleHits(next, CAR.radius, colliders)) {
      // Crash: bounce back, lose speed, take damage.
      if (Math.abs(this.speed) > 6) {
        this.damage(Math.abs(this.speed) * 1.1);
        this.speed *= -0.25;
        return 'crash';
      }
      this.speed *= 0.4;
      return null;
    }
    this.pos.x = next.x;
    this.pos.z = next.z;
    this.mesh.rotation.y = this.heading;
    this.spinWheels(dt);
    return null;
  }

  damage(amount) {
    if (this.dead) return false;
    this.health -= amount;
    if (this.health <= 35 && !this.smoking) this.smoking = true;
    if (this.health <= 0) {
      this.dead = true;
      this.speed = 0;
      this.bodyMat.color.setHex(0x1a1a1a);
      return true;
    }
    return false;
  }

  remove() {
    this.scene.remove(this.mesh);
  }
}

// --- Traffic ----------------------------------------------------------------

export class TrafficManager {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.parked = [];
  }

  spawnInitial(count, playerPos) {
    for (let i = 0; i < count; i++) {
      const car = this._spawnTrafficCar(playerPos);
      if (car) this.cars.push(car);
    }
    this._spawnParked();
  }

  _randomLaneCar(x, z, heading) {
    const kind = this.rng.pick(['sedan', 'sedan', 'sedan', 'sport', 'taxi', 'truck', 'van']);
    const color = kind === 'taxi' ? 0xe8c33c : this.rng.pick(CAR_COLORS);
    const car = new Car(this.scene, kind, color, x, z, heading);
    car.driver = 'traffic';
    return car;
  }

  _spawnTrafficCar(playerPos) {
    const p = this.city.randomRoadPoint(this.rng, playerPos, 25, 320);
    const alongX = Math.abs(p.z - this.city.nearestRoad(p.z)) < Math.abs(p.x - this.city.nearestRoad(p.x));
    let heading;
    if (alongX) heading = p.z > this.city.nearestRoad(p.z) ? 0 : Math.PI;
    else heading = p.x > this.city.nearestRoad(p.x) ? -Math.PI / 2 : Math.PI / 2;
    const car = this._randomLaneCar(p.x, p.z, heading);
    car.traffic = {
      axis: alongX ? 'x' : 'z',
      road: alongX ? this.city.nearestRoad(p.z) : this.city.nearestRoad(p.x),
      dir: 1,
      targetSpeed: this.rng.range(9, 14),
      turning: 0,
      turnFrom: 0,
      turnTo: 0,
      turnX: 0,
      turnZ: 0,
    };
    // Direction follows the lane: right-hand traffic.
    if (alongX) car.traffic.dir = p.z > car.traffic.road ? 1 : -1;
    else car.traffic.dir = p.x > car.traffic.road ? -1 : 1;
    car.speed = car.traffic.targetSpeed;
    return car;
  }

  _spawnParked() {
    const spots = [];
    // Garage forecourt.
    spots.push({ x: -82, z: 88 }, { x: -82, z: 96 }, { x: -82, z: 104 });
    // Casino lot (its own block across the street from the tower).
    spots.push(
      { x: 148, z: -104 }, { x: 156, z: -104 }, { x: 164, z: -104 }, { x: 172, z: -104 },
      { x: 148, z: -88 }, { x: 156, z: -88 }, { x: 164, z: -88 }, { x: 172, z: -88 },
    );
    // Curbside spots along a few roads.
    for (let i = 0; i < 14; i++) {
      const road = this.rng.pick(CITY.roads);
      const t = this.rng.range(-300, 300);
      const side = this.rng.chance(0.5) ? 1 : -1;
      if (this.rng.chance(0.5)) spots.push({ x: t, z: road + side * 5.4 });
      else spots.push({ x: road + side * 5.4, z: t });
    }
    for (const s of spots) {
      const kind = this.rng.pick(['sedan', 'sedan', 'sport', 'truck', 'van']);
      const car = new Car(this.scene, kind, this.rng.pick(CAR_COLORS), s.x, s.z, this.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]));
      car.driver = 'parked';
      this.parked.push(car);
    }
  }

  /** Cars the player can steal: parked cars plus slow traffic cars. */
  stealableNear(pos, radius) {
    let best = null;
    let bestD = radius;
    const consider = (car) => {
      if (car.dead || car.isPlayerCar) return;
      const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    };
    for (const c of this.parked) consider(c);
    for (const c of this.cars) {
      if (Math.abs(c.speed) < 3) consider(c);
    }
    return best;
  }

  allCars() {
    return [...this.cars, ...this.parked];
  }

  update(dt, playerPos, playerCar, policeCars, effects) {
    const others = [...this.cars, ...this.parked, ...(policeCars || [])];
    if (playerCar) others.push(playerCar);

    for (const car of this.cars) {
      if (car.dead) continue;
      const t = car.traffic;
      // Car ahead? Brake.
      const f = car.forward();
      let blocked = false;
      for (const o of others) {
        if (o === car || o.dead) continue;
        const dx = o.pos.x - car.pos.x;
        const dz = o.pos.z - car.pos.z;
        const ahead = dx * f.x + dz * f.z;
        const side = Math.abs(dx * f.z - dz * f.x);
        if (ahead > 0 && ahead < 9 && side < 2.6) {
          blocked = true;
          break;
        }
      }
      const target = blocked ? 0 : t.targetSpeed;
      car.speed += (target - car.speed) * Math.min(1, dt * 1.6);

      if (t.turning > 0) {
        // Mid-turn: rotate toward the new heading, drift to the new lane.
        t.turning -= dt;
        const k = 1 - Math.max(0, t.turning) / 0.9;
        car.heading = t.turnFrom + (t.turnTo - t.turnFrom) * k;
        car.pos.x += (t.turnX - car.pos.x) * Math.min(1, dt * 2.2);
        car.pos.z += (t.turnZ - car.pos.z) * Math.min(1, dt * 2.2);
        const f2 = car.forward();
        car.pos.x += f2.x * car.speed * dt;
        car.pos.z += f2.z * car.speed * dt;
        car.mesh.rotation.y = car.heading;
        car.spinWheels(dt);
        continue;
      }

      // Approaching an intersection? Maybe turn.
      const coord = t.axis === 'x' ? car.pos.x : car.pos.z;
      const cross = t.axis === 'x' ? car.pos.z : car.pos.x;
      const nextRoad = this._nextRoad(coord, t.dir);
      if (nextRoad !== null && Math.abs(coord - nextRoad) < 1.2) {
        const roll = this.rng.float();
        if (roll < 0.45) {
          this._startTurn(car, nextRoad, roll < 0.225 ? -1 : 1);
        }
      }

      // Drive along the lane, gently centred.
      const f3 = car.forward();
      car.pos.x += f3.x * car.speed * dt;
      car.pos.z += f3.z * car.speed * dt;
      if (t.axis === 'x') {
        const lane = t.road + (t.dir > 0 ? 3.5 : -3.5);
        car.pos.z += (lane - car.pos.z) * Math.min(1, dt * 1.5);
      } else {
        const lane = t.road + (t.dir > 0 ? -3.5 : 3.5);
        car.pos.x += (lane - car.pos.x) * Math.min(1, dt * 1.5);
      }
      car.mesh.rotation.y = car.heading;
      car.spinWheels(dt);

      // Wrap around: recycle cars that leave the city or stray too far.
      const dPlayer = Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z);
      if (dPlayer > 340 || Math.abs(car.pos.x) > 400 || Math.abs(car.pos.z) > 400) {
        this._respawn(car, playerPos);
      }
    }

    // Smoke from damaged cars.
    for (const car of others) {
      if (car.smoking && !car.dead && effects && Math.random() < dt * 14) {
        effects.smoke(car.pos.x, 1.4, car.pos.z);
      }
    }
  }

  _nextRoad(coord, dir) {
    let best = null;
    for (const r of CITY.roads) {
      const d = (r - coord) * dir;
      if (d > 0 && (best === null || d < Math.abs(best - coord))) best = r;
    }
    return best;
  }

  _startTurn(car, crossRoad, side) {
    const t = car.traffic;
    const newAxis = t.axis === 'x' ? 'z' : 'x';
    // New heading: turning left or right from the current heading.
    const delta = side * Math.PI / 2;
    let newHeading = car.heading + delta;
    // Normalise to the nearest cardinal direction.
    newHeading = Math.round(newHeading / (Math.PI / 2)) * (Math.PI / 2);
    const newDir = newAxis === 'x'
      ? (Math.sin(newHeading) > 0 ? 1 : -1)
      : (Math.cos(newHeading) > 0 ? 1 : -1);
    const laneOffset = newAxis === 'x' ? (newDir > 0 ? 3.5 : -3.5) : (newDir > 0 ? -3.5 : 3.5);
    t.turning = 0.9;
    t.turnFrom = car.heading;
    t.turnTo = newHeading;
    if (newAxis === 'x') {
      t.turnX = car.pos.x;
      t.turnZ = crossRoad + laneOffset;
    } else {
      t.turnX = crossRoad + laneOffset;
      t.turnZ = car.pos.z;
    }
    t.axis = newAxis;
    t.road = crossRoad;
    t.dir = newDir;
  }

  _respawn(car, playerPos) {
    const p = this.city.randomRoadPoint(this.rng, playerPos, 90, 300);
    const alongX = Math.abs(p.z - this.city.nearestRoad(p.z)) < Math.abs(p.x - this.city.nearestRoad(p.x));
    car.pos.x = p.x;
    car.pos.z = p.z;
    car.heading = alongX ? (p.z > this.city.nearestRoad(p.z) ? 0 : Math.PI) : (p.x > this.city.nearestRoad(p.x) ? -Math.PI / 2 : Math.PI / 2);
    car.mesh.rotation.y = car.heading;
    car.traffic.axis = alongX ? 'x' : 'z';
    car.traffic.road = alongX ? this.city.nearestRoad(p.z) : this.city.nearestRoad(p.x);
    car.traffic.dir = alongX ? (p.z > car.traffic.road ? 1 : -1) : (p.x > car.traffic.road ? -1 : 1);
    car.traffic.turning = 0;
    car.speed = car.traffic.targetSpeed;
    if (car.dead) {
      car.dead = false;
      car.health = car.maxHealth;
      car.smoking = false;
      car.bodyMat.color.setHex(car.colorHex);
    }
  }
}
