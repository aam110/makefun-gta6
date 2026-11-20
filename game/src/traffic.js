// CAYO BRAVO — traffic.js: ambient cars cruising the street grid, obeying the
// road lines, braking for the car ahead, and respawning when they leave town.

import { WORLD, mulberry32 } from './config.js';
import { spawnVehicle, syncCarMesh } from './vehicles.js';

const ROADS = [];
for (let v = -240; v <= 240; v += WORLD.roadGap) ROADS.push(v);

export function spawnTrafficCar(G, rng) {
  const vertical = rng() < 0.5;
  const road = ROADS[Math.floor(rng() * ROADS.length)];
  const dir = rng() < 0.5 ? 1 : -1;
  const along = -280 + rng() * 560;
  const modelIndex = Math.floor(rng() * 7);
  const x = vertical ? road + (dir > 0 ? 3.2 : -3.2) : along;
  const z = vertical ? along : road + (dir > 0 ? 3.2 : -3.2);
  const heading = vertical ? (dir > 0 ? Math.PI : 0) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
  const car = spawnVehicle(G.scene, modelIndex, x, z, heading);
  car.driver = 'traffic';
  car.speed = 9 + rng() * 6;
  car.cruiseSpeed = car.speed;
  car.vertical = vertical;
  car.dir = dir;
  car.road = road;
  G.vehicles.push(car);
  return car;
}

export function spawnTraffic(G, count, seed) {
  const rng = mulberry32(seed);
  for (let i = 0; i < count; i++) spawnTrafficCar(G, rng);
}

// One traffic car: drive its lane, slow for a car ahead, wrap at the edge.
export function updateTrafficCar(car, dt, G) {
  if (car.dead) return;
  let target = car.cruiseSpeed;
  // Look ahead for another car in the same lane.
  for (const other of G.vehicles) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x, dz = other.z - car.z;
    const ahead = car.vertical ? dz * -car.dir : dx * car.dir;
    const lateral = car.vertical ? Math.abs(dx) : Math.abs(dz);
    if (ahead > 0 && ahead < 14 && lateral < 4) { target = 0; break; }
    if (ahead > 0 && ahead < 26 && lateral < 4) target = Math.min(target, 4);
  }
  car.speed += (target - car.speed) * Math.min(1, dt * 2.2);
  const nx = car.x - Math.sin(car.heading) * car.speed * dt;
  const nz = car.z - Math.cos(car.heading) * car.speed * dt;
  car.x = nx; car.z = nz;
  // Wrap around the map edge: reappear on the far side.
  if (car.x > 290 || car.x < -290 || car.z > 290 || car.z < -290) {
    if (car.vertical) car.z = car.dir > 0 ? -285 : 285;
    else car.x = car.dir > 0 ? -285 : 285;
  }
  syncCarMesh(car, dt);
}

export function updateTraffic(G, dt) {
  for (const car of G.vehicles) {
    if (car.driver === 'traffic') updateTrafficCar(car, dt, G);
  }
}
