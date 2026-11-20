// CAYO BRAVO — combat.js: fists and firearms. Raycast shooting from the
// camera, melee punches, weapon switching, ammo and reloads, and the damage
// that shooting does to peds, cars and the player's wanted level.

import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { killPed, panicNearbyPeds } from './pedestrians.js';
import { killCar } from './vehicles.js';
import { raiseWanted } from './police.js';

export function createCombatState() {
  return {
    slot: 1,                    // start with the P9
    ammo: WEAPONS.map((w) => w.ammo),
    cooldown: 0,
    raycaster: new THREE.Raycaster(),
  };
}

export function selectWeapon(G, slot) {
  if (slot < 0 || slot >= WEAPONS.length) return;
  G.combat.slot = slot;
  G.audio.weaponSwap();
}

export function currentWeapon(G) {
  return WEAPONS[G.combat.slot];
}

// Fire the current weapon toward the crosshair point in the world.
export function fireWeapon(G) {
  const c = G.combat;
  if (c.cooldown > 0 || G.player.onFoot === false) return;
  const w = currentWeapon(G);
  if (c.slot === 0) { punch(G); return; }
  if (c.ammo[c.slot] <= 0) { G.audio.dryFire(); G.hud.toast('NO AMMO — PRESS R TO RELOAD'); return; }
  c.ammo[c.slot] -= 1;
  c.cooldown = w.rate;
  const origin = new THREE.Vector3(G.player.x, 1.5, G.player.z);
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  dir.y = 0;
  dir.normalize();
  c.raycaster.set(origin, dir);
  c.raycaster.far = w.range;
  G.effects.muzzleFlash(origin.x + dir.x, 1.5, origin.z + dir.z, G.player.heading);
  G.audio.gunshot(1);
  G.effects.tracer(origin, dir, w.range);
  panicNearbyPeds(G, G.player.x, G.player.z, 30);
  raiseWanted(G, 1);

  // Hit test: nearest hostile or civilian ped in the line of fire.
  let bestPed = null, bestD = w.range;
  for (const ped of G.peds) {
    if (ped.dead) continue;
    const dx = ped.x - origin.x, dz = ped.z - origin.z;
    const along = dx * dir.x + dz * dir.z;
    if (along < 0 || along > bestD) continue;
    const perp = Math.abs(dx * dir.z - dz * dir.x);
    if (perp < 1.2) { bestPed = ped; bestD = along; }
  }
  // Hit test: cars.
  let bestCar = null, bestCd = w.range;
  for (const car of G.vehicles) {
    if (car.dead || car.isPlayer) continue;
    const dx = car.x - origin.x, dz = car.z - origin.z;
    const along = dx * dir.x + dz * dir.z;
    if (along < 0 || along > bestCd) continue;
    const perp = Math.abs(dx * dir.z - dz * dir.x);
    if (perp < 2.2) { bestCar = car; bestCd = along; }
  }
  if (bestPed && bestD <= bestCd) {
    bestPed.health -= w.damage;
    G.effects.addSparks(bestPed.x, 1.2, bestPed.z, 5);
    if (bestPed.health <= 0) {
      killPed(bestPed, G);
      if (bestPed.hostile) {
        G.missions.enemiesLeft = Math.max(0, G.missions.enemiesLeft - 1);
        G.player.addRp(40);
        G.hud.toast('TARGET DOWN — ' + G.missions.enemiesLeft + ' LEFT');
      }
    }
  } else if (bestCar) {
    bestCar.condition -= w.damage * 0.8;
    G.effects.addSparks(bestCar.x, 1, bestCar.z, 6);
    if (bestCar.condition <= 0) killCar(bestCar, G);
  }
}

export function punch(G) {
  const c = G.combat;
  c.cooldown = WEAPONS[0].rate;
  G.audio.punch();
  G.player.punchAnim = 0.25;
  let best = null, bestD = WEAPONS[0].range;
  for (const ped of G.peds) {
    if (ped.dead) continue;
    const d = Math.hypot(ped.x - G.player.x, ped.z - G.player.z);
    if (d < bestD) { best = ped; bestD = d; }
  }
  if (best) {
    best.health -= WEAPONS[0].damage;
    G.effects.addSparks(best.x, 1.2, best.z, 3);
    if (best.health <= 0) {
      killPed(best, G);
      if (best.hostile) G.missions.enemiesLeft = Math.max(0, G.missions.enemiesLeft - 1);
    }
  }
}

export function reloadWeapon(G) {
  const c = G.combat;
  const w = currentWeapon(G);
  if (c.slot === 0 || c.ammo[c.slot] >= w.ammo) return;
  c.ammo[c.slot] = w.ammo;
  c.cooldown = Math.max(c.cooldown, 0.8);
  G.audio.reload();
  G.hud.toast(w.name + ' RELOADED');
}

export function updateCombat(G, dt) {
  const c = G.combat;
  if (c.cooldown > 0) c.cooldown -= dt;
  // Hold-to-fire for automatics.
  if (G.input.mouseDown && G.player.onFoot && !G.paused && G.started) {
    const w = currentWeapon(G);
    if (w.auto) fireWeapon(G);
  }
}
