// CAYO BRAVO — pedestrians.js: islanders strolling the sidewalks and the
// beach, fleeing when shots ring out, plus mission enemies who shoot back.

import * as THREE from 'three';
import { WORLD, mulberry32, clamp } from './config.js';
import { resolveBuildingCollision } from './world.js';

const SKINS = [0x8a5a3a, 0xc98a5a, 0x6b4226, 0xe8b88a, 0x5a3220];
const SHIRTS = [0xff2f92, 0x2fdcff, 0xffd21f, 0x37e06a, 0xffffff, 0xff7a1a, 0xc02fff, 0x4a7dff];

export function buildPedMesh(rng) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: SKINS[Math.floor(rng() * SKINS.length)], roughness: 0.9 });
  const shirt = new THREE.MeshStandardMaterial({ color: SHIRTS[Math.floor(rng() * SHIRTS.length)], roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.34), shirt);
  torso.position.y = 1.12;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.82;
  head.castShadow = true;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.28), pants);
  legL.position.set(-0.17, 0.35, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  g.add(legR);
  g.userData.legs = [legL, legR];
  return g;
}

export function spawnPed(G, x, z, opts = {}) {
  const rng = G.rng;
  const mesh = buildPedMesh(rng);
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  const ped = {
    mesh, x, z,
    heading: rng() * Math.PI * 2,
    speed: opts.speed ?? (0.8 + rng() * 0.9),
    walkPhase: rng() * 6,
    state: opts.state ?? 'stroll',
    health: opts.health ?? 100,
    hostile: opts.hostile ?? false,
    name: opts.name ?? null,
    shootTimer: 1 + rng() * 2,
    panicTimer: 0,
    dead: false,
  };
  G.peds.push(ped);
  return ped;
}

export function spawnPedestrians(G, count, seed) {
  const rng = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    // Half on sidewalks along roads, half on the beach boardwalk.
    let x, z;
    if (i % 2 === 0) {
      const road = -240 + Math.floor(rng() * 9) * 60;
      const along = -270 + rng() * 540;
      if (rng() < 0.5) { x = road + 9; z = along; } else { x = along; z = road + 9; }
    } else {
      x = WORLD.beachX - 20 + rng() * 44;
      z = -270 + rng() * 540;
    }
    spawnPed(G, x, z, { speed: 0.8 + rng() * 1.1 });
  }
}

export function spawnFleeingPed(G, x, z) {
  const ped = spawnPed(G, x, z, { state: 'flee', speed: 4.2 });
  ped.panicTimer = 6;
  return ped;
}

// A strolling ped picks a new heading at random; a fleeing one runs from danger.
export function updatePed(ped, dt, G) {
  if (ped.dead) return;
  if (ped.state === 'flee') {
    ped.panicTimer -= dt;
    const dx = ped.x - G.player.x, dz = ped.z - G.player.z;
    const d = Math.hypot(dx, dz) || 1;
    ped.heading = Math.atan2(-dx / d, -dz / d);
    if (ped.panicTimer <= 0) ped.state = 'stroll';
  } else if (ped.state === 'stroll') {
    if (Math.random() < dt * 0.08) ped.heading += (Math.random() - 0.5) * 1.4;
  }
  const speed = ped.state === 'flee' ? 4.2 : ped.speed;
  let nx = ped.x - Math.sin(ped.heading) * speed * dt;
  let nz = ped.z - Math.cos(ped.heading) * speed * dt;
  nx = clamp(nx, -292, 292); nz = clamp(nz, -292, 292);
  const res = resolveBuildingCollision(G.world.colliders, nx, nz, 0.6);
  ped.x = res.x; ped.z = res.z;
  if (res.hit) ped.heading += Math.PI / 2;
  ped.walkPhase += dt * speed * 3.2;
  const swing = Math.sin(ped.walkPhase) * 0.45;
  const [legL, legR] = ped.mesh.userData.legs;
  legL.rotation.x = swing; legR.rotation.x = -swing;
  ped.mesh.position.set(ped.x, 0, ped.z);
  ped.mesh.rotation.y = ped.heading;
}

// Hostile mission enemies stand their ground and shoot at the player.
export function updateHostilePed(ped, dt, G) {
  if (ped.dead) return;
  const d = Math.hypot(ped.x - G.player.x, ped.z - G.player.z);
  ped.heading = Math.atan2(-(G.player.x - ped.x), -(G.player.z - ped.z));
  ped.mesh.rotation.y = ped.heading;
  ped.shootTimer -= dt;
  if (d < 55 && ped.shootTimer <= 0 && G.player.health > 0) {
    ped.shootTimer = 1.1 + Math.random() * 1.2;
    G.effects.muzzleFlash(ped.x, 1.5, ped.z, ped.heading);
    G.audio.gunshot(0.5);
    if (Math.random() < 0.35) G.player.damage(9, 'shot');
  }
}

export function panicNearbyPeds(G, x, z, radius) {
  for (const ped of G.peds) {
    if (ped.dead || ped.hostile) continue;
    if (Math.hypot(ped.x - x, ped.z - z) < radius) {
      ped.state = 'flee';
      ped.panicTimer = 5 + Math.random() * 4;
    }
  }
}

export function killPed(ped, G) {
  ped.dead = true;
  ped.mesh.rotation.x = -Math.PI / 2;
  ped.mesh.position.y = 0.4;
  G.effects.addSparks(ped.x, 1, ped.z, 4);
}
