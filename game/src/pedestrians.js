// Pedestrians: low-poly walkers strolling the sidewalks, idling at corners,
// fleeing gunfire and near-misses. Also exports the person builder that the
// player and the gang enemies reuse.
import * as THREE from 'three';
import { CFG, S, clamp, pick, rand, randInt } from './config.js';
import { roadCenters } from './world.js';
import { bloodBurst } from './effects.js';
import { AudioSys } from './audio.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xecf0f1, 0x34495e];
const PANTS = [0x2c3e50, 0x5d4037, 0x37474f, 0x1a1a2e, 0x4e342e];
const SKINS = [0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac, 0xc68642];

export function makePersonMesh(opts = {}) {
  const g = new THREE.Group();
  const shirt = opts.shirt ?? pick(SHIRTS);
  const pants = opts.pants ?? pick(PANTS);
  const skin = opts.skin ?? pick(SKINS);
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), shirtMat);
  torso.position.y = 1.22;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skinMat);
  head.position.y = 1.85;
  head.castShadow = true;
  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.16, 0.42),
    new THREE.MeshStandardMaterial({ color: opts.hair ?? pick([0x1a1a1a, 0x4a3226, 0x8a6a3a, 0xd8d8d8]), roughness: 1 }),
  );
  hair.position.y = 2.08;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.82, 0.28), pantsMat);
  legL.geometry.translate(0, -0.41, 0);
  legL.position.set(-0.17, 0.84, 0);
  const legR = legL.clone();
  legR.position.x = 0.17;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.22), shirtMat);
  armL.geometry.translate(0, -0.36, 0);
  armL.position.set(-0.42, 1.56, 0);
  const armR = armL.clone();
  armR.position.x = 0.42;
  g.add(torso, head, hair, legL, legR, armL, armR);
  g.userData = { legL, legR, armL, armR, torso, head };
  return g;
}

export function animateWalk(mesh, phase, amount) {
  const u = mesh.userData;
  const s = Math.sin(phase) * amount;
  u.legL.rotation.x = s;
  u.legR.rotation.x = -s;
  u.armL.rotation.x = -s * 0.8;
  u.armR.rotation.x = s * 0.8;
}

// Sidewalk lines run 9.5 units off each road centre, both axes.
function randomSidewalkPoint() {
  const axis = Math.random() < 0.5 ? 'x' : 'z';
  const c = pick(roadCenters());
  const off = pick([-9.5, 9.5]);
  const along = rand(-CFG.CITY_R + 10, CFG.CITY_R - 10);
  return axis === 'x' ? { x: along, z: c + off } : { x: c + off, z: along };
}

function planPath(from, to) {
  // Walk the sidewalk network: at most two legs via the crossing of the
  // target's line. Keeps pedestrians out of buildings.
  const fromAxis = Math.abs(from.x % CFG.PITCH) < 12 ? 'z' : 'x';
  const toAxis = Math.abs(to.x % CFG.PITCH) < 12 ? 'z' : 'x';
  if (fromAxis === toAxis) return [to];
  if (fromAxis === 'x') return [{ x: to.x, z: from.z }, to];
  return [{ x: from.x, z: to.z }, to];
}

export function spawnPeds() {
  for (let i = 0; i < CFG.PED_COUNT; i++) {
    const p = randomSidewalkPoint();
    const mesh = makePersonMesh();
    mesh.position.set(p.x, 0, p.z);
    S.scene.add(mesh);
    S.peds.push({
      mesh, health: 100, dead: false, deadTimer: 0,
      state: 'walk', speed: rand(1.4, 2.4),
      path: [], pathI: 0, idleTimer: rand(0, 2),
      heading: rand(0, Math.PI * 2), phase: rand(0, 6),
      fleeFrom: null, fleeTimer: 0,
    });
  }
}

export function scarePeds(x, z, radius) {
  for (const p of S.peds) {
    if (p.dead) continue;
    const d2 = (p.mesh.position.x - x) ** 2 + (p.mesh.position.z - z) ** 2;
    if (d2 < radius * radius) {
      p.state = 'flee';
      p.fleeFrom = { x, z };
      p.fleeTimer = rand(2.5, 4);
    }
  }
}

export function hurtPed(ped, dmg, fromX, fromZ) {
  if (ped.dead) return;
  ped.health -= dmg;
  bloodBurst(ped.mesh.position.x, 1.3, ped.mesh.position.z);
  if (ped.health <= 0) {
    ped.dead = true;
    ped.deadTimer = 6;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.25;
    scarePeds(ped.mesh.position.x, ped.mesh.position.z, 25);
  } else {
    ped.state = 'flee';
    ped.fleeFrom = { x: fromX, z: fromZ };
    ped.fleeTimer = 3;
  }
}

function pickNewTarget(p) {
  const to = randomSidewalkPoint();
  p.path = planPath(p.mesh.position, to);
  p.pathI = 0;
  p.state = 'walk';
}

export function updatePeds(dt) {
  for (const p of S.peds) {
    if (p.dead) {
      p.deadTimer -= dt;
      if (p.deadTimer <= 0) {
        // A fresh pedestrian wanders in from elsewhere.
        const spot = randomSidewalkPoint();
        p.mesh.position.set(spot.x, 0, spot.z);
        p.mesh.rotation.x = 0;
        p.dead = false;
        p.health = 100;
        p.state = 'walk';
        p.path = [];
      }
      continue;
    }
    if (p.state === 'flee') {
      p.fleeTimer -= dt;
      const dx = p.mesh.position.x - p.fleeFrom.x;
      const dz = p.mesh.position.z - p.fleeFrom.z;
      const d = Math.hypot(dx, dz) || 1;
      const sp = 6.5;
      p.mesh.position.x += (dx / d) * sp * dt;
      p.mesh.position.z += (dz / d) * sp * dt;
      p.heading = Math.atan2(dx / d, dz / d);
      p.mesh.rotation.y = p.heading;
      p.phase += dt * 14;
      animateWalk(p.mesh, p.phase, 0.9);
      if (p.fleeTimer <= 0) pickNewTarget(p);
      continue;
    }
    if (p.state === 'idle') {
      p.idleTimer -= dt;
      animateWalk(p.mesh, p.phase, 0);
      if (p.idleTimer <= 0) pickNewTarget(p);
      continue;
    }
    // Walking.
    if (!p.path.length || p.pathI >= p.path.length) {
      if (Math.random() < 0.25) { p.state = 'idle'; p.idleTimer = rand(1, 3); }
      else pickNewTarget(p);
      continue;
    }
    const target = p.path[p.pathI];
    const dx = target.x - p.mesh.position.x;
    const dz = target.z - p.mesh.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.2) { p.pathI++; continue; }
    p.heading = Math.atan2(dx / d, dz / d);
    p.mesh.rotation.y = p.heading;
    p.mesh.position.x += (dx / d) * p.speed * dt;
    p.mesh.position.z += (dz / d) * p.speed * dt;
    p.phase += dt * 7;
    animateWalk(p.mesh, p.phase, 0.55);
    // Dodge a speeding car bearing down on them.
    if (S.player && S.player.car) {
      const c = S.player.car.mesh.position;
      const cd = Math.hypot(c.x - p.mesh.position.x, c.z - p.mesh.position.z);
      if (cd < 6 && Math.abs(S.player.car.speed) > 8) {
        p.state = 'flee';
        p.fleeFrom = { x: c.x, z: c.z };
        p.fleeTimer = 2;
        AudioSys.horn();
      }
    }
  }
}
