// Traffic: AI cars cruising the road grid on the correct side, turning at
// intersections, braking for the car ahead, respawning at the city edge.
import { CFG, S, clamp, pick, rand } from './config.js';
import { createCar } from './vehicles.js';
import { resolveCollisions, roadCenters, randomRoadPoint } from './world.js';

const TYPES = ['sedan', 'sedan', 'sedan', 'taxi', 'van', 'sport', 'truck'];

// Lane offset for right-hand traffic on a given axis + direction.
function laneFor(axis, dir) {
  if (axis === 'x') return dir > 0 ? CFG.LANE : -CFG.LANE;
  return dir > 0 ? -CFG.LANE : CFG.LANE;
}
function headingFor(axis, dir) {
  if (axis === 'x') return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  return dir > 0 ? 0 : Math.PI;
}

function spawnOne() {
  const p = randomRoadPoint(S.player ? S.player.mesh.position : null, 25);
  const axis = Math.random() < 0.5 ? 'x' : 'z';
  const dir = Math.random() < 0.5 ? 1 : -1;
  const road = pick(roadCenters());
  const lane = laneFor(axis, dir);
  const x = axis === 'x' ? rand(-CFG.CITY_R + 20, CFG.CITY_R - 20) : road + lane;
  const z = axis === 'x' ? road + lane : rand(-CFG.CITY_R + 20, CFG.CITY_R - 20);
  const car = createCar(pick(TYPES), x, z, headingFor(axis, dir), { driver: 'traffic' });
  return {
    car, axis, dir, lane, lat: lane,
    speed: rand(7, 11), targetSpeed: rand(8, 12),
    turnCooldown: rand(1, 3),
  };
}

export function spawnTraffic() {
  for (let i = 0; i < CFG.TRAFFIC_COUNT; i++) S.traffic.push(spawnOne());
}

function nearestIntersectionCoord(v) {
  // Nearest road centre line along the perpendicular axis.
  const centers = roadCenters();
  let best = centers[0], bd = Infinity;
  for (const c of centers) {
    const d = Math.abs(c - v);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function carAhead(t, dist) {
  const p = t.car.mesh.position;
  const fx = Math.sin(t.car.heading), fz = Math.cos(t.car.heading);
  const all = [
    ...S.traffic.map((o) => o.car),
    ...S.policeCars.map((o) => o.car),
    ...S.parked,
    ...(S.player && S.player.car ? [S.player.car] : []),
  ];
  for (const o of all) {
    if (o === t.car || o.dead) continue;
    const dx = o.mesh.position.x - p.x, dz = o.mesh.position.z - p.z;
    const along = dx * fx + dz * fz;
    if (along > 0 && along < dist) {
      const side = Math.abs(-dx * fz + dz * fx);
      if (side < 2.6) return true;
    }
  }
  return false;
}

export function updateTraffic(dt) {
  for (let i = S.traffic.length - 1; i >= 0; i--) {
    const t = S.traffic[i];
    const car = t.car;
    if (car.dead) {
      // Wrecked traffic is towed away and replaced.
      S.scene.remove(car.mesh);
      S.traffic.splice(i, 1);
      S.traffic.push(spawnOne());
      continue;
    }
    t.turnCooldown -= dt;
    // Ease toward the target lane after a turn.
    t.lat += clamp(t.lane - t.lat, -dt * 6, dt * 6);
    // Decide a turn at an intersection.
    const p = car.mesh.position;
    const along = t.axis === 'x' ? p.x : p.z;
    const cross = nearestIntersectionCoord(along);
    if (Math.abs(along - cross) < 2.5 && t.turnCooldown <= 0) {
      t.turnCooldown = rand(2, 5);
      if (Math.random() < 0.4) {
        const turnRight = Math.random() < 0.5;
        const newAxis = t.axis === 'x' ? 'z' : 'x';
        let newDir;
        if (t.axis === 'x') newDir = t.dir > 0 ? (turnRight ? 1 : -1) : (turnRight ? -1 : 1);
        else newDir = t.dir > 0 ? (turnRight ? -1 : 1) : (turnRight ? 1 : -1);
        t.axis = newAxis;
        t.dir = newDir;
        t.lane = laneFor(newAxis, newDir);
        car.heading = headingFor(newAxis, newDir);
      }
    }
    // Speed: brake for the car ahead, else cruise.
    const blocked = carAhead(t, 10);
    const want = blocked ? 0 : t.targetSpeed;
    t.speed += clamp(want - t.speed, -dt * 14, dt * 5);
    car.speed = t.speed;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    let nx = p.x + fx * t.speed * dt;
    let nz = p.z + fz * t.speed * dt;
    // Hold the lane: snap the lateral coordinate toward the lane line.
    if (t.axis === 'x') {
      const road = nearestIntersectionCoord(p.z);
      nz += (road + t.lat - nz) * Math.min(1, dt * 4);
    } else {
      const road = nearestIntersectionCoord(p.x);
      nx += (road + t.lat - nx) * Math.min(1, dt * 4);
    }
    const fixed = resolveCollisions(nx, nz, CFG.CAR_RADIUS);
    car.mesh.position.x = fixed.x;
    car.mesh.position.z = fixed.z;
    car.mesh.rotation.y = car.heading;
    const spin = (t.speed * dt) / 0.38;
    car.mesh.userData.wheels.forEach((w) => { w.rotation.x += spin; });
    // Wrap around the city edge.
    if (Math.abs(p.x) > CFG.CITY_R + 12 || Math.abs(p.z) > CFG.CITY_R + 12) {
      S.scene.remove(car.mesh);
      S.traffic.splice(i, 1);
      S.traffic.push(spawnOne());
    }
  }
}

// Parked cars the player can steal, parallel-parked on road edges.
export function spawnParked() {
  const spots = [
    { x: 59, z: -27, type: 'sedan' },
    { x: -59, z: 81, type: 'van' },
    { x: 113, z: 135, type: 'sedan' },
    { x: -113, z: -135, type: 'taxi' },
    { x: 167, z: -81, type: 'sport' },
    { x: -167, z: 27, type: 'sedan' },
    { x: 5, z: 189, type: 'sedan' },
    { x: 59, z: 27, type: 'sport', mission: true }, // Hot Wheels target
  ];
  for (const s of spots) {
    const car = createCar(s.type, s.x, s.z, 0, { driver: 'parked', color: s.mission ? 0xc21807 : undefined });
    car.parked = true;
    if (s.mission) { car.missionTarget = true; S.missionCar = car; }
    S.parked.push(car);
  }
}
