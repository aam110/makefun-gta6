// CAYO BRAVO — police.js: the CBPD wanted system. Stars rise with crime;
// pursuit cars ram and flank, roadblocks close the road ahead, and at 4 stars
// the AIR-1 helicopter joins with a spotlight. Breaking line of sight cools
// the heat down — the manhunt is a real chase, not a timer.

import * as THREE from 'three';
import { POLICE_CALLSIGNS, POLICE_TACTICS, clamp } from './config.js';
import { spawnVehicle, syncCarMesh, moveCarWithCollisions } from './vehicles.js';

export function createPoliceState() {
  return {
    units: [],          // { car, callsign, tactic }
    heli: null,         // { mesh, rotor, angle }
    roadblock: null,    // { cars, x, z, heading }
    losTimer: 0,        // seconds since any unit last saw the player
    coolTimer: 0,       // seconds of being unseen before a star drops
    spawnTimer: 0,
    searchRadius: 60,
  };
}

function pickTactic(stars, rng) {
  if (stars >= 3 && rng() < 0.3) return 'ROADBLOCK';
  if (stars >= 2 && rng() < 0.35) return 'RAMMING';
  if (stars >= 4 && rng() < 0.3) return 'MARKSMAN';
  return POLICE_TACTICS[Math.floor(rng() * 3)]; // CHASING / RAMMING / FLANKING
}

function pickCallsign(G) {
  const used = new Set(G.police.units.map((u) => u.callsign));
  const free = POLICE_CALLSIGNS.filter((c) => !used.has(c));
  return free.length ? free[Math.floor(Math.random() * free.length)] : POLICE_CALLSIGNS[Math.floor(Math.random() * POLICE_CALLSIGNS.length)];
}

export function spawnCopCar(G, nearPlayer = true) {
  const p = G.player;
  const a = Math.random() * Math.PI * 2;
  const d = nearPlayer ? 45 + Math.random() * 30 : 120;
  const x = clamp(p.x + Math.cos(a) * d, -285, 285);
  const z = clamp(p.z + Math.sin(a) * d, -285, 285);
  const car = spawnVehicle(G.scene, 7, x, z, Math.atan2(-(p.x - x), -(p.z - z)));
  car.driver = 'cop';
  car.cruiseSpeed = 30;
  G.vehicles.push(car);
  const unit = {
    car,
    callsign: pickCallsign(G),
    tactic: pickTactic(G.player.wanted, Math.random),
    ramTimer: 0,
  };
  G.police.units.push(unit);
  return unit;
}

export function buildHelicopter(scene) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 5.2), bodyMat);
  body.castShadow = true;
  g.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.1, metalness: 0.6 }));
  glass.position.set(0, 0.3, -2.0);
  g.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.4),
    new THREE.MeshStandardMaterial({ color: 0x2f7bff, roughness: 0.5, metalness: 0.3 }));
  tail.position.set(0, 0.3, 4.4);
  g.add(tail);
  const rotor = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.6 });
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.4), bladeMat);
    blade.rotation.y = a;
    rotor.add(blade);
  }
  rotor.position.y = 1.1;
  g.add(rotor);
  // Spotlight cone under the belly: apex at the helicopter, wide base on the
  // ground below. Kept small and faint so it never fogs the camera view.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(4, 14, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.position.y = -7;
  g.add(cone);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(4, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.3 }));
  spot.rotation.x = -Math.PI / 2;
  spot.position.y = -13.5;
  g.add(spot);
  g.scale.set(1.4, 1.4, 1.4);
  scene.add(g);
  return { mesh: g, rotor, angle: 0 };
}

export function ensureHelicopter(G) {
  if (G.police.heli) return;
  G.police.heli = buildHelicopter(G.scene);
  G.hud.toast('▲ AIR UNIT AIR-1 DEPLOYED');
}

export function removeHelicopter(G) {
  if (!G.police.heli) return;
  G.scene.remove(G.police.heli.mesh);
  G.police.heli = null;
}

export function placeRoadblock(G) {
  const p = G.player;
  const ahead = 55;
  const hx = p.x - Math.sin(p.heading) * ahead;
  const hz = p.z - Math.cos(p.heading) * ahead;
  const cars = [];
  for (const off of [-4, 4]) {
    const px = hx + Math.cos(p.heading) * off;
    const pz = hz - Math.sin(p.heading) * off;
    const car = spawnVehicle(G.scene, 7, px, pz, p.heading + Math.PI / 2);
    car.driver = 'cop';
    car.speed = 0;
    G.vehicles.push(car);
    const unit = { car, callsign: pickCallsign(G), tactic: 'ROADBLOCK', ramTimer: 0, blocking: true };
    G.police.units.push(unit);
    cars.push(car);
  }
  G.police.roadblock = { cars, x: hx, z: hz, heading: p.heading, timer: 25 };
  G.hud.toast('!! ROADBLOCK AHEAD !!');
}

export function clearRoadblock(G) {
  if (!G.police.roadblock) return;
  for (const car of G.police.roadblock.cars) {
    const u = G.police.units.find((unit) => unit.car === car);
    if (u) { u.blocking = false; u.tactic = 'CHASING'; }
  }
  G.police.roadblock = null;
}

// Line of sight: any cop within range with a clear-ish view sees the player.
// Selma's EYES OUT (ghostTimer) blinds ground units for a few seconds.
export function playerIsSeen(G) {
  const p = G.player;
  if (G.police.heli) return true; // the eye in the sky always sees you
  if (G.ghostTimer > 0) return false; // Selma has the units looking elsewhere
  for (const u of G.police.units) {
    if (u.car.dead) continue;
    const d = Math.hypot(u.car.x - p.x, u.car.z - p.z);
    if (d < 70) return true;
  }
  return false;
}

export function updateCopCar(unit, dt, G) {
  const car = unit.car;
  if (car.dead) return;
  const p = G.player;
  if (unit.blocking) { syncCarMesh(car, dt); return; }
  // Each unit holds a slot around the player (flank / rear / nose) instead of
  // all piling onto the same point — a surrounding pack, not a dogpile.
  if (unit.slot === undefined) unit.slot = Math.random() * Math.PI * 2;
  const ox = Math.cos(unit.slot) * 7, oz = Math.sin(unit.slot) * 7;
  const rx = ox * Math.cos(p.heading) - oz * Math.sin(p.heading);
  const rz = ox * Math.sin(p.heading) + oz * Math.cos(p.heading);
  const tx = p.x + rx, tz = p.z + rz;
  const dx = tx - car.x, dz = tz - car.z;
  const dist = Math.hypot(dx, dz) || 1;
  const wantHeading = Math.atan2(-dx, -dz);
  let dh = wantHeading - car.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  const ramming = unit.tactic === 'RAMMING' && dist < 26;
  const top = ramming ? 52 : 42 + G.player.wanted * 2;
  car.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
  car.speed += ((dist > 8 ? top : top * 0.4) - car.speed) * Math.min(1, dt * 1.6);
  const nx = car.x - Math.sin(car.heading) * car.speed * dt;
  const nz = car.z - Math.cos(car.heading) * car.speed * dt;
  moveCarWithCollisions(car, nx, nz, G);
  // Contact with the player's car scrapes paint and slows the chase.
  const playerDist = Math.hypot(p.x - car.x, p.z - car.z);
  if (p.car && playerDist < 4.4 && car.speed > 5) {
    p.car.condition = Math.max(0, p.car.condition - 3 * dt);
    p.car.speed *= 0.995;
    car.speed *= 0.9;
    if (Math.random() < dt * 3) G.effects.addSparks(car.x, 1, car.z, 3);
  }
  if (syncCarMesh(car, dt)) G.effects.addSmoke(car.x, 1.4, car.z);
  // Retask now and then so the panel tactics stay lively.
  unit.ramTimer -= dt;
  if (unit.ramTimer <= 0) {
    unit.ramTimer = 4 + Math.random() * 5;
    unit.tactic = pickTactic(G.player.wanted, Math.random);
  }
}

export function updatePolice(G, dt) {
  const P = G.police;
  const wanted = G.player.wanted;
  // Desired unit count scales with stars.
  const desired = wanted === 0 ? 0 : 1 + wanted;
  P.spawnTimer -= dt;
  if (G.player.wanted > 0 && P.units.filter((u) => !u.car.dead).length < desired && P.spawnTimer <= 0) {
    P.spawnTimer = 1.2;
    spawnCopCar(G);
  }
  // Helicopter at 4+ stars.
  if (wanted >= 4) ensureHelicopter(G);
  else if (wanted <= 2) removeHelicopter(G);
  // Roadblock at 3+ stars, refreshed while the chase runs (unless staging
  // disabled them for a clean screenshot chase).
  if (wanted >= 3 && !P.roadblock && !G.noRoadblocks && Math.random() < dt * 0.12) placeRoadblock(G);
  if (P.roadblock) {
    P.roadblock.timer -= dt;
    if (P.roadblock.timer <= 0 || wanted === 0) clearRoadblock(G);
  }
  for (const u of P.units) updateCopCar(u, dt, G);
  // Remove wrecked units.
  P.units = P.units.filter((u) => !u.car.dead);
  // Helicopter circles ahead of the player, near the forward axis so it stays
  // in the chase camera's view, slow enough to read.
  if (P.heli) {
    P.heli.angle += dt * 0.12;
    const r = 8;
    const fx = -Math.sin(G.player.heading), fz = -Math.cos(G.player.heading);
    const cx = G.player.x + fx * 26, cz = G.player.z + fz * 26;
    P.heli.mesh.position.set(
      cx + Math.cos(P.heli.angle) * r,
      14,
      cz + Math.sin(P.heli.angle) * r,
    );
    P.heli.mesh.lookAt(G.player.x, 0, G.player.z);
    P.heli.rotor.rotation.y += dt * 28;
  }
  // Manhunt: unseen for a while, a star drops. Seen again, the clock resets.
  if (wanted > 0) {
    if (playerIsSeen(G)) { P.losTimer = 0; P.coolTimer = 0; }
    else {
      P.losTimer += dt;
      P.coolTimer += dt;
      if (P.coolTimer > 14) {
        P.coolTimer = 0;
        G.player.wanted = Math.max(0, wanted - 1);
        if (G.player.wanted === 0) {
          G.hud.toast('YOU LOST THEM — HEAT IS OFF');
          G.player.addRp(120);
        } else G.hud.toast('HEAT DROPPING — ' + G.player.wanted + '★');
      }
    }
  }
}

export function raiseWanted(G, stars) {
  const before = G.player.wanted;
  G.player.wanted = clamp(G.player.wanted + stars, 0, 5);
  if (G.player.wanted > before) {
    G.hud.showWantedBanner(G.player.wanted);
    G.audio.sirenBlip();
  }
}

export function policePanelRows(G) {
  return G.police.units.slice(0, 5).map((u) => ({
    callsign: u.callsign,
    tactic: u.tactic,
    dist: Math.round(Math.hypot(u.car.x - G.player.x, u.car.z - G.player.z)),
  }));
}
