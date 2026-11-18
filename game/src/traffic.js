// Ambient traffic: cars that follow the road grid, turn at intersections,
// brake for the car ahead and for the player, honk when stuck, and respawn
// far from the player so the streets always feel alive.

import { LANE, ROAD_COORDS, clamp, pick, rand, chance, distXZ } from './config.js';
import { makeCar, driveCar, removeCar } from './vehicles.js';

const TRAFFIC_COUNT = 14;
const TRAFFIC_KINDS = ['sedan', 'sedan', 'taxi', 'van', 'sport', 'sedan', 'muscle'];

function randomLaneStart(G) {
  const vertical = Math.random() < 0.5;
  const road = pick(ROAD_COORDS);
  const dir = Math.random() < 0.5 ? 1 : -1;
  const along = rand(-160, 160);
  // right-hand traffic: lane offset depends on direction
  const off = dir === 1 ? LANE : -LANE;
  return {
    x: vertical ? road + off : along,
    z: vertical ? along : road + off,
    axis: vertical ? 'z' : 'x',
    dir,
  };
}

export function spawnTrafficCar(G, nearPlayer = false) {
  let s = randomLaneStart(G);
  if (nearPlayer) {
    // try a few times to land on a road within sight of the player
    for (let i = 0; i < 8; i++) {
      const t = randomLaneStart(G);
      const d = distXZ(t.x, t.z, G.player.x, G.player.z);
      if (d > 25 && d < 110) { s = t; break; }
    }
  }
  const heading = s.axis === 'z' ? (s.dir === 1 ? Math.PI : 0) : (s.dir === 1 ? -Math.PI / 2 : Math.PI / 2);
  const car = makeCar(G, pick(TRAFFIC_KINDS), s.x, s.z, heading, { driver: 'traffic' });
  car.ai = {
    axis: s.axis, dir: s.dir,
    targetSpeed: rand(9, 14),
    stuckTimer: 0,
    nextTurnAt: null,
  };
  car.speed = car.ai.targetSpeed;
  return car;
}

export function initTraffic(G) {
  for (let i = 0; i < TRAFFIC_COUNT; i++) spawnTrafficCar(G, i < 6);
}

function carAhead(G, car) {
  const fx = -Math.sin(car.heading);
  const fz = -Math.cos(car.heading);
  let best = Infinity;
  for (const other of G.cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const ahead = dx * fx + dz * fz;
    if (ahead < 0.5 || ahead > 11) continue;
    const side = Math.abs(dx * -fz + dz * fx);
    if (side < 2.2 && ahead < best) best = ahead;
  }
  return best;
}

export function updateTraffic(G, dt) {
  let count = 0;
  for (const car of [...G.cars]) {
    if (car.driver !== 'traffic' || car.dead) continue;
    count++;
    const ai = car.ai;
    // too far from the player? recycle to a fresh road near them
    if (distXZ(car.x, car.z, G.player.x, G.player.z) > 230) {
      removeCar(G, car);
      spawnTrafficCar(G, true);
      continue;
    }
    // at an intersection, sometimes turn onto the cross street
    const alongCoord = ai.axis === 'z' ? car.z : car.x;
    const crossCoord = ai.axis === 'z' ? car.x : car.z;
    let nearCross = false;
    for (const c of ROAD_COORDS) {
      if (Math.abs(alongCoord - c) < 1.6) { nearCross = true; break; }
    }
    if (nearCross && ai.nextTurnAt === null) {
      ai.nextTurnAt = alongCoord; // mark so we only decide once per intersection
      if (chance(0.45)) {
        const newAxis = ai.axis === 'z' ? 'x' : 'z';
        const newDir = Math.random() < 0.5 ? 1 : -1;
        const road = (() => {
          let best = ROAD_COORDS[0];
          let bd = Infinity;
          for (const c of ROAD_COORDS) {
            const d = Math.abs(c - alongCoord);
            if (d < bd) { bd = d; best = c; }
          }
          return best;
        })();
        const off = newDir === 1 ? LANE : -LANE;
        ai.axis = newAxis;
        ai.dir = newDir;
        if (newAxis === 'x') car.z = road + off;
        else car.x = road + off;
      }
    } else if (!nearCross) {
      ai.nextTurnAt = null;
    }
    // desired heading from axis + direction
    const wantHeading = ai.axis === 'z'
      ? (ai.dir === 1 ? Math.PI : 0)
      : (ai.dir === 1 ? -Math.PI / 2 : Math.PI / 2);
    let dH = wantHeading - car.heading;
    while (dH > Math.PI) dH -= Math.PI * 2;
    while (dH < -Math.PI) dH += Math.PI * 2;
    const steer = clamp(dH * 2.2, -1, 1);
    // brake for the car ahead / the player's car
    const ahead = carAhead(G, car);
    let throttle = 1;
    if (ahead < 9) throttle = ahead < 5 ? -1 : 0.15;
    if (Math.abs(dH) > 0.5) throttle = Math.min(throttle, 0.35);
    // edge of the map: turn around
    if (Math.abs(car.x) > 168 || Math.abs(car.z) > 168) {
      ai.dir *= -1;
      car.heading += Math.PI;
    }
    const prevSpeed = car.speed;
    driveCar(G, car, dt, throttle, steer);
    // stuck detection: honk, then nudge forward
    if (Math.abs(car.speed) < 0.4 && throttle > 0.5) {
      ai.stuckTimer += dt;
      if (ai.stuckTimer > 2.5 && distXZ(car.x, car.z, G.player.x, G.player.z) < 45) {
        G.audio.horn();
        ai.stuckTimer = 0;
      }
    } else ai.stuckTimer = 0;
    void prevSpeed;
  }
  // top the streets back up if cars were stolen or wrecked
  while (count < TRAFFIC_COUNT) {
    spawnTrafficCar(G, true);
    count++;
  }
}
