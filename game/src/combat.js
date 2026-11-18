// Combat: hitscan shooting with tracers and muzzle flash, two weapons with
// magazines and reloads, drive-by fire from a car, gang enemies that shoot
// back, cash/health/armor pickups, and damage to the player.

import * as THREE from 'three';
import { WEAPONS, clamp, distXZ, pick, rand, chance } from './config.js';
import { createPersonMesh, scarePeds, knockPedDown } from './pedestrians.js';
import { damageCar, nearestCar } from './vehicles.js';
import { collideCircle } from './world.js';

const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _hit = new THREE.Vector3();

// Where the mouse is pointing on the ground (y = 1 plane).
export function aimPoint(G) {
  const rect = G.renderer.domElement.getBoundingClientRect();
  _ndc.x = ((G.input.mouseX - rect.left) / rect.width) * 2 - 1;
  _ndc.y = -((G.input.mouseY - rect.top) / rect.height) * 2 + 1;
  _ray.setFromCamera(_ndc, G.camera);
  if (_ray.ray.intersectPlane(_ground, _hit)) return _hit;
  return new THREE.Vector3(G.player.x, 1, G.player.z - 10);
}

function bulletBlocked(G, from, to) {
  // cheap wall check: sample the segment against building footprints
  const steps = Math.ceil(from.distanceTo(to) / 2);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    for (const c of G.world.colliders) {
      if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true;
    }
  }
  return false;
}

export function fireWeapon(G) {
  const p = G.player;
  const w = WEAPONS[p.weapon];
  const now = G.elapsed;
  if (now < p.nextShotAt) return;
  if (p.reloading) return;
  if (p.ammoInMag <= 0) { reloadWeapon(G); return; }
  p.nextShotAt = now + w.rate;
  p.ammoInMag--;

  const from = new THREE.Vector3();
  if (p.onFoot) from.set(p.x, 1.45, p.z);
  else { from.set(p.car.x, 1.35, p.car.z); }
  const aim = aimPoint(G);
  // spread
  aim.x += rand(-w.spread, w.spread) * 30;
  aim.z += rand(-w.spread, w.spread) * 30;
  const dir = new THREE.Vector3().subVectors(aim, from);
  dir.y = 0;
  if (dir.lengthSq() < 0.01) dir.set(0, 0, -1);
  dir.normalize();
  const end = from.clone().addScaledVector(dir, w.range);
  end.y = 1.2;

  G.fx.muzzle(from.x + dir.x * 0.8, from.y, from.z + dir.z * 0.8);
  G.fx.tracer(from.clone().addScaledVector(dir, 0.8), end.clone(), w.tracer);
  G.audio.shot(p.weapon);
  G.events.push({ type: 'shotFired', x: p.x, z: p.z });
  scarePeds(G, p.x, p.z, 28);

  // hit resolution: nearest hittable along the ray (enemies, peds, cars, cops)
  let bestDist = w.range;
  let best = null;
  let bestKind = null;
  function consider(x, z, radius, kind, ref) {
    const dx = x - from.x;
    const dz = z - from.z;
    const along = dx * dir.x + dz * dir.z;
    if (along < 0 || along > bestDist) return;
    const perp = Math.abs(dx * -dir.z + dz * dir.x);
    if (perp < radius + 0.5) { bestDist = along; best = ref; bestKind = kind; }
  }
  for (const e of G.enemies) if (!e.dead) consider(e.x, e.z, 0.9, 'enemy', e);
  for (const ped of G.peds) if (ped.state !== 'down') consider(ped.x, ped.z, 0.8, 'ped', ped);
  for (const cop of G.cops) {
    if (cop.kind === 'foot') consider(cop.x, cop.z, 0.9, 'cop', cop);
  }
  for (const car of G.cars) {
    if (car.dead || car === p.car) continue;
    consider(car.x, car.z, 2.0, 'car', car);
  }
  if (best && !bulletBlocked(G, from, new THREE.Vector3(best.x ?? best.car?.x ?? 0, 1.2, best.z ?? best.car?.z ?? 0))) {
    const hx = best.x ?? best.car.x;
    const hz = best.z ?? best.car.z;
    G.fx.burst(hx, 1.2, hz, 0xffd23e, 6, 3, { life: 0.3 });
    if (bestKind === 'enemy') damageEnemy(G, best, w.damage);
    else if (bestKind === 'ped') knockPedDown(G, best, true);
    else if (bestKind === 'cop') {
      G.hud.notify('You shot a cop! Maximum heat!', 'bad');
      G.modules.police.addWanted(G, 2, 'Cop down');
      // foot cop goes down and despawns
      G.scene.remove(best.group);
      G.cops.splice(G.cops.indexOf(best), 1);
    } else if (bestKind === 'car') {
      damageCar(G, best, w.damage * 0.8);
      if (best.driver === 'traffic' && chance(0.5)) {
        // driver bails out
        const driver = best;
        driver.driver = 'parked';
        driver.speed = 0;
        const { spawnPed } = G.modules.pedestrians;
        spawnPed(G, driver.x + 2, driver.z, { fleeFrom: { x: p.x, z: p.z } });
      }
    }
  } else {
    // ground impact puff at the end of the ray
    const gx = from.x + dir.x * Math.min(bestDist, w.range);
    const gz = from.z + dir.z * Math.min(bestDist, w.range);
    G.fx.burst(gx, 0.3, gz, 0xcccccc, 3, 2, { life: 0.25 });
  }
  if (p.ammoInMag === 0) reloadWeapon(G);
}

export function reloadWeapon(G) {
  const p = G.player;
  const w = WEAPONS[p.weapon];
  if (p.reloading || p.ammoInMag >= w.mag) return;
  if (p.reserve[p.weapon] <= 0) {
    G.hud.notify(`No ${w.name} ammo left — find a pickup`, 'bad');
    return;
  }
  p.reloading = true;
  p.reloadEndsAt = G.elapsed + w.reload;
  G.hud.notify('Reloading…');
}

export function finishReload(G) {
  const p = G.player;
  const w = WEAPONS[p.weapon];
  const need = w.mag - p.ammoInMag;
  const take = Math.min(need, p.reserve[p.weapon]);
  p.ammoInMag += take;
  p.reserve[p.weapon] -= take;
  p.reloading = false;
}

export function switchWeapon(G, name) {
  const p = G.player;
  if (!WEAPONS[name] || p.weapon === name) return;
  if (name === 'smg' && !p.smgUnlocked) {
    G.hud.notify('SMG unlocks after Mission 2', 'bad');
    return;
  }
  p.weapon = name;
  p.reloading = false;
  p.ammoInMag = p.magState[name];
  G.audio.click();
  G.hud.notify(WEAPONS[name].name);
}

// ---- Enemies (gang members) ----

export function spawnEnemy(G, x, z, opts = {}) {
  const parts = createPersonMesh(opts.shirt ?? 0xc23b3b, pick([0xf2c49b, 0xc98d5e, 0x8a5a3b, 0x6b4426]), {
    pants: 0x1c1c22, hat: chance(0.4) ? 0x222222 : null,
  });
  parts.group.position.set(x, 0, z);
  G.scene.add(parts.group);
  const e = {
    ...parts,
    x, z, heading: rand(6.28),
    health: opts.health ?? 100,
    maxHealth: opts.health ?? 100,
    shootTimer: rand(0.6, 1.8),
    walkPhase: rand(6.28),
    speed: opts.speed ?? 4.2,
    damage: opts.damage ?? 10,
    boss: opts.boss ?? false,
    dead: false,
    deathTimer: 0,
    homeX: x, homeZ: z,
  };
  G.enemies.push(e);
  return e;
}

export function damageEnemy(G, e, amount) {
  if (e.dead) return;
  e.health -= amount;
  G.fx.burst(e.x, 1.3, e.z, 0xff5252, 5, 3, { life: 0.3 });
  if (e.health <= 0) {
    e.dead = true;
    e.deathTimer = 2.5;
    e.group.rotation.x = -Math.PI / 2;
    e.group.position.y = 0.3;
    G.audio.cash();
    spawnPickup(G, e.x + rand(-1, 1), e.z + rand(-1, 1), chance(0.5) ? 'cash' : 'ammo');
    G.hud.notify(e.boss ? 'KESTREL IS DOWN!' : 'Gang member down', 'good');
    G.events.push({ type: 'enemyDown', x: e.x, z: e.z });
  }
}

// An NPC (cop or enemy) shoots at the player with distance-based inaccuracy.
export function enemyShootAt(G, x, y, z, damage) {
  const p = G.player;
  const from = new THREE.Vector3(x, y, z);
  const to = new THREE.Vector3(p.x, 1.3, p.z);
  const dist = from.distanceTo(to);
  G.fx.tracer(from, to, 0xff8a8a);
  G.fx.muzzle(x, y, z);
  G.audio.enemyShot();
  const hitChance = clamp(0.55 - dist * 0.011, 0.08, 0.55);
  if (Math.random() < hitChance) {
    hurtPlayer(G, damage * rand(0.7, 1.3), 'shot');
    G.fx.burst(p.x, 1.3, p.z, 0xff5252, 5, 3, { life: 0.3 });
  } else {
    G.fx.burst(p.x + rand(-2, 2), 0.4, p.z + rand(-2, 2), 0xcccccc, 2, 2, { life: 0.2 });
  }
}

export function updateEnemies(G, dt) {
  const p = G.player;
  for (const e of [...G.enemies]) {
    if (e.dead) {
      e.deathTimer -= dt;
      if (e.deathTimer <= 0) {
        G.scene.remove(e.group);
        G.enemies.splice(G.enemies.indexOf(e), 1);
      }
      continue;
    }
    const dist = distXZ(e.x, e.z, p.x, p.z);
    const dx = p.x - e.x;
    const dz = p.z - e.z;
    e.heading = Math.atan2(-dx / (dist || 1), -dz / (dist || 1));
    // close in until in range, then stand and shoot
    if (dist > 16) {
      const pos = {
        x: e.x - Math.sin(e.heading) * e.speed * dt,
        z: e.z - Math.cos(e.heading) * e.speed * dt,
      };
      collideCircle(G, pos, 0.5);
      e.x = pos.x; e.z = pos.z;
      e.walkPhase += dt * e.speed * 3;
      const swing = Math.sin(e.walkPhase) * 0.7;
      e.legL.rotation.x = swing;
      e.legR.rotation.x = -swing;
    }
    e.group.position.set(e.x, 0, e.z);
    e.group.rotation.y = e.heading;
    if (dist < 38) {
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = rand(0.9, 1.9);
        enemyShootAt(G, e.x, 1.5, e.z, e.damage);
      }
    }
  }
}

// ---- Pickups ----

const pickupGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
export function spawnPickup(G, x, z, kind) {
  const colors = { cash: 0x37d67a, health: 0xff5252, armor: 0x3aa7ff, ammo: 0xffd23e };
  const mat = new THREE.MeshBasicMaterial({ color: colors[kind] ?? 0xffffff });
  const mesh = new THREE.Mesh(pickupGeo, mat);
  mesh.position.set(x, 0.9, z);
  G.scene.add(mesh);
  // glow ring underneath
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.08, 6, 20), mat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, 0.15, z);
  G.scene.add(ring);
  G.pickups.push({ mesh, ring, x, z, kind, spin: rand(6.28) });
}

export function updatePickups(G, dt) {
  const p = G.player;
  for (const pk of [...G.pickups]) {
    pk.spin += dt * 3;
    pk.mesh.rotation.y = pk.spin;
    pk.mesh.position.y = 0.9 + Math.sin(pk.spin * 1.4) * 0.15;
    if (distXZ(p.x, p.z, pk.x, pk.z) < 1.8) {
      applyPickup(G, pk.kind);
      G.scene.remove(pk.mesh);
      G.scene.remove(pk.ring);
      G.pickups.splice(G.pickups.indexOf(pk), 1);
    }
  }
}

export function applyPickup(G, kind) {
  const p = G.player;
  if (kind === 'cash') {
    const amount = randInt(15, 60);
    p.money += amount;
    G.hud.notify(`+$${amount} cash`, 'good');
    G.audio.cash();
  } else if (kind === 'health') {
    p.health = Math.min(100, p.health + 50);
    G.hud.notify('Health +50', 'good');
    G.audio.pickup();
  } else if (kind === 'armor') {
    p.armor = Math.min(100, p.armor + 50);
    G.hud.notify('Armor +50', 'good');
    G.audio.pickup();
  } else if (kind === 'ammo') {
    p.reserve.smg += 60;
    p.reserve.pistol += 24;
    G.hud.notify('Ammo restocked', 'good');
    G.audio.pickup();
  }
}

// ---- Player damage / death ----

export function hurtPlayer(G, amount, cause) {
  const p = G.player;
  if (G.state !== 'playing' || p.health <= 0) return;
  let rest = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest * 0.7);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.health -= rest;
  G.fx.addShake(0.25);
  G.hud.flashDamage();
  if (p.health <= 0) {
    p.health = 0;
    G.audio.busted();
    const lost = Math.floor(p.money * 0.1);
    p.money -= lost;
    G.endGame('wasted', {
      title: 'WASTED',
      sub: `You went down in Solmar Bay. The medics patched you up — minus $${lost.toLocaleString('en-US')} in "fees". Get back out there.`,
    });
    p.health = 100;
    p.armor = 0;
    if (p.car) { p.car.driver = 'parked'; p.car = null; p.onFoot = true; p.group.visible = true; }
    p.x = -14; p.z = 44; // outside Solmar General
    G.modules.police.clearAllCops(G);
  }
  void cause;
}
