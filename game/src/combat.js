// Combat: hitscan pistol/SMG with ray-vs-AABB wall blocking, gang enemies
// with health bars and return fire, drive-by shooting, and pickups.
import * as THREE from 'three';
import { CFG, S, WEAPONS, clamp, rand, randInt, pick } from './config.js';
import { makePersonMesh, animateWalk, hurtPed, scarePeds } from './pedestrians.js';
import { addWanted, hurtCop } from './police.js';
import { hurtPlayer, healPlayer, addMoney } from './player.js';
import { damageCar } from './vehicles.js';
import { burst, bloodBurst, muzzleFlash, tracer, smokePuff } from './effects.js';
import { AudioSys } from './audio.js';

const raycaster = new THREE.Raycaster();
let shootCooldown = 0;
let reloadTimer = 0;
let reloading = false;

const ENEMY_SHIRTS = { vulture: 0x6a1b9a, king: 0x1565c0, boss: 0xb71c1c };

export function spawnGang(x, z, count, opts = {}) {
  const gang = opts.gang ?? 'vulture';
  const spawned = [];
  for (let i = 0; i < count; i++) {
    const isBoss = opts.boss && i === 0;
    const mesh = makePersonMesh({
      shirt: isBoss ? ENEMY_SHIRTS.boss : ENEMY_SHIRTS[gang],
      pants: 0x1a1a1a,
      hair: 0x111111,
    });
    if (isBoss) mesh.scale.setScalar(1.18);
    const px = x + rand(-9, 9), pz = z + rand(-9, 9);
    mesh.position.set(px, 0, pz);
    S.scene.add(mesh);
    // Health bar: two camera-facing sprites (hidden behind walls, never shot).
    const barBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x111111 }));
    barBg.scale.set(1.5, 0.16, 1);
    barBg.position.y = 2.6;
    barBg.raycast = () => {};
    const barFg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x2ecc71 }));
    barFg.scale.set(1.4, 0.1, 1);
    barFg.position.y = 2.6;
    barFg.raycast = () => {};
    mesh.add(barBg, barFg);
    const e = {
      mesh, barFg, health: isBoss ? 350 : 100, maxHealth: isBoss ? 350 : 100,
      dead: false, deadTimer: 0, gang, boss: isBoss,
      shootTimer: rand(0.6, 1.6), heading: 0, phase: rand(0, 6),
    };
    S.enemies.push(e);
    spawned.push(e);
  }
  return spawned;
}

export function enemiesAlive() {
  return S.enemies.filter((e) => !e.dead).length;
}

export function clearEnemies() {
  for (const e of S.enemies) S.scene.remove(e.mesh);
  S.enemies = [];
}

// Ray vs the building AABBs (extruded to 80 high): the nearest wall distance.
function wallDistance(origin, dir) {
  let best = Infinity;
  for (const c of S.colliders) {
    const minX = c.minX, maxX = c.maxX, minZ = c.minZ, maxZ = c.maxZ;
    const minY = 0, maxY = 80;
    let tmin = 0, tmax = Infinity;
    const o = [origin.x, origin.y, origin.z];
    const d = [dir.x, dir.y, dir.z];
    const mn = [minX, minY, minZ], mx = [maxX, maxY, maxZ];
    let ok = true;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-8) {
        if (o[a] < mn[a] || o[a] > mx[a]) { ok = false; break; }
      } else {
        let t1 = (mn[a] - o[a]) / d[a];
        let t2 = (mx[a] - o[a]) / d[a];
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) { ok = false; break; }
      }
    }
    if (ok && tmin < best) best = tmin;
  }
  return best;
}

function collectTargets() {
  const out = [];
  for (const e of S.enemies) if (!e.dead) out.push({ mesh: e.mesh, kind: 'enemy', ref: e });
  for (const p of S.peds) if (!p.dead) out.push({ mesh: p.mesh, kind: 'ped', ref: p });
  for (const c of S.footCops) if (!c.dead) out.push({ mesh: c.mesh, kind: 'cop', ref: c });
  const cars = [...S.traffic.map((t) => t.car), ...S.policeCars.map((p) => p.car), ...S.parked];
  if (S.player && S.player.car) cars.push(S.player.car);
  for (const car of cars) if (!car.dead) out.push({ mesh: car.mesh, kind: 'car', ref: car });
  return out;
}

export function tryShoot() {
  const p = S.player;
  if (!p || S.over || S.paused) return;
  if (shootCooldown > 0 || reloading) return;
  const w = WEAPONS[p.weapon];
  const ammo = p.ammo[p.weapon];
  if (ammo.mag <= 0) {
    startReload();
    return;
  }
  shootCooldown = w.rate;
  ammo.mag--;
  S.stats.shots++;
  const spread = p.onFoot ? w.spread : w.spread * 2.5;
  const dir = new THREE.Vector3();
  S.camera.getWorldDirection(dir);
  dir.x += rand(-spread, spread);
  dir.y += rand(-spread, spread);
  dir.z += rand(-spread, spread);
  dir.normalize();
  const origin = S.camera.position.clone();
  // Muzzle position: the player's gun hand (or the car window).
  const gunPos = p.mesh.position.clone();
  gunPos.y = 1.45;
  if (!p.onFoot) gunPos.y = 1.2;
  muzzleFlash(gunPos.x, gunPos.y, gunPos.z);
  AudioSys.shot(p.weapon);
  scarePeds(p.mesh.position.x, p.mesh.position.z, 30);
  if (Math.random() < 0.6) addWanted(0.5, 'shots fired');

  raycaster.set(origin, dir);
  raycaster.far = w.range;
  raycaster.camera = S.camera;
  let bestDist = wallDistance(origin, dir);
  let bestHit = null;
  for (const t of collectTargets()) {
    const hits = raycaster.intersectObject(t.mesh, true);
    if (hits.length && hits[0].distance < bestDist) {
      bestDist = hits[0].distance;
      bestHit = { target: t, point: hits[0].point.clone() };
    }
  }
  const end = origin.clone().add(dir.clone().multiplyScalar(Math.min(bestDist, w.range)));
  tracer(gunPos, end);
  if (!bestHit) {
    if (bestDist < w.range) burst(end.x, end.y, end.z, 0xd8d8d8, 4, 3, 0.4);
    return;
  }
  S.stats.hits++;
  const { kind, ref } = bestHit.target;
  const pt = bestHit.point;
  if (kind === 'enemy') {
    ref.health -= w.damage;
    bloodBurst(pt.x, pt.y, pt.z);
    if (ref.health <= 0 && !ref.dead) {
      ref.dead = true;
      ref.deadTimer = 6;
      ref.mesh.rotation.x = -Math.PI / 2;
      ref.mesh.position.y = 0.25;
      ref.barFg.visible = false;
      S.stats.kills++;
      spawnPickup('cash', ref.mesh.position.x + rand(-1, 1), ref.mesh.position.z + rand(-1, 1), randInt(20, 60));
      if (Math.random() < 0.4) spawnPickup('health', ref.mesh.position.x, ref.mesh.position.z);
      if (window.__onEnemyKilled) window.__onEnemyKilled(ref);
    }
  } else if (kind === 'ped') {
    const wasAlive = ref.health > 0;
    hurtPed(ref, w.damage, p.mesh.position.x, p.mesh.position.z);
    if (wasAlive && ref.dead) addWanted(2, 'civilian down');
  } else if (kind === 'cop') {
    hurtCop(ref, w.damage);
  } else if (kind === 'car') {
    damageCar(ref, w.damage * 0.5);
    burst(pt.x, pt.y, pt.z, 0xffd23f, 5, 4, 0.4);
    if (ref.driver === 'police') addWanted(0.5, 'shooting at police');
  }
}

export function startReload() {
  const p = S.player;
  if (!p || reloading) return;
  const ammo = p.ammo[p.weapon];
  const w = WEAPONS[p.weapon];
  if (ammo.mag >= w.mag || ammo.res <= 0) return;
  reloading = true;
  reloadTimer = 0.9;
  AudioSys.reload();
}

export function switchWeapon(name) {
  const p = S.player;
  if (!p || !WEAPONS[name]) return;
  p.weapon = name;
  reloading = false;
  AudioSys.click();
}

export function isReloading() { return reloading; }

// ---- pickups ------------------------------------------------------------
const PICKUP_STYLE = {
  health: { color: 0x2ecc71, label: '+50 HP' },
  ammo: { color: 0xf1c40f, label: '+SMG ammo' },
  cash: { color: 0x2ecc71, label: 'cash' },
  smg: { color: 0xe67e22, label: 'SMG!' },
};

export function spawnPickup(kind, x, z, value = 0) {
  const style = PICKUP_STYLE[kind];
  const g = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.7, 0.7),
    new THREE.MeshStandardMaterial({ color: style.color, emissive: style.color, emissiveIntensity: 0.5 }),
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.08, 8, 24),
    new THREE.MeshBasicMaterial({ color: style.color }),
  );
  ring.rotation.x = Math.PI / 2;
  g.add(box, ring);
  g.position.set(x, 1, z);
  S.scene.add(g);
  S.pickups.push({ mesh: g, kind, value, t: rand(0, 6) });
}

export function spawnWorldPickups() {
  // All on road intersections, so nothing hides inside a building.
  spawnPickup('smg', 54, 81);
  spawnPickup('health', -27, -27);
  spawnPickup('health', 108, -108);
  spawnPickup('ammo', -108, 108);
  spawnPickup('health', 162, -54);
  spawnPickup('ammo', 54, 162);
}

function collectPickup(pk) {
  const p = S.player;
  if (pk.kind === 'health') { healPlayer(50); }
  else if (pk.kind === 'ammo') { p.ammo.smg.res += 90; }
  else if (pk.kind === 'cash') { addMoney(pk.value); }
  else if (pk.kind === 'smg') { p.ammo.smg.res += 120; switchWeapon('smg'); }
  AudioSys.pickup();
  if (window.__onPickup) window.__onPickup(pk.kind);
  S.scene.remove(pk.mesh);
  S.pickups.splice(S.pickups.indexOf(pk), 1);
}

export function updateCombat(dt) {
  shootCooldown = Math.max(0, shootCooldown - dt);
  if (reloading) {
    reloadTimer -= dt;
    if (reloadTimer <= 0) {
      reloading = false;
      const p = S.player;
      const ammo = p.ammo[p.weapon];
      const w = WEAPONS[p.weapon];
      const need = w.mag - ammo.mag;
      const take = Math.min(need, ammo.res);
      ammo.mag += take;
      ammo.res -= take;
    }
  }
  const p = S.player;
  const pp = p ? p.mesh.position : null;
  // Enemy AI: close in, then shoot.
  for (let i = S.enemies.length - 1; i >= 0; i--) {
    const e = S.enemies[i];
    if (e.dead) {
      e.deadTimer -= dt;
      if (e.deadTimer <= 0) { S.scene.remove(e.mesh); S.enemies.splice(i, 1); }
      continue;
    }
    if (!pp || S.over) continue;
    const ep = e.mesh.position;
    const dx = pp.x - ep.x, dz = pp.z - ep.z;
    const dist = Math.hypot(dx, dz);
    e.heading = Math.atan2(dx, dz);
    e.mesh.rotation.y = e.heading;
    // Health bar width by remaining health.
    const frac = clamp(e.health / e.maxHealth, 0, 1);
    e.barFg.scale.x = 1.4 * frac;
    e.barFg.material.color.setHex(frac > 0.5 ? 0x2ecc71 : frac > 0.25 ? 0xf1c40f : 0xe74c3c);
    if (dist > 16) {
      const sp = e.boss ? 5.2 : 6.2;
      const nx = ep.x + (dx / dist) * sp * dt;
      const nz = ep.z + (dz / dist) * sp * dt;
      e.mesh.position.x = nx;
      e.mesh.position.z = nz;
      e.phase += dt * 12;
      animateWalk(e.mesh, e.phase, 0.8);
    } else {
      animateWalk(e.mesh, e.phase, 0);
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = rand(1.1, 2.1);
        const gun = ep.clone(); gun.y = 1.5;
        const target = pp.clone(); target.y = 1.2;
        tracer(gun, target, 0xff9a7a);
        muzzleFlash(gun.x, gun.y, gun.z);
        AudioSys.enemyShot();
        const hitChance = clamp(0.42 - dist * 0.012, 0.12, 0.42);
        if (Math.random() < hitChance) hurtPlayer(rand(6, e.boss ? 16 : 11));
      }
    }
  }
  // Pickups bob, spin and get collected.
  for (let i = S.pickups.length - 1; i >= 0; i--) {
    const pk = S.pickups[i];
    pk.t += dt;
    pk.mesh.rotation.y += dt * 2.2;
    pk.mesh.position.y = 1 + Math.sin(pk.t * 2.5) * 0.18;
    if (pp && p.onFoot) {
      const d2 = (pk.mesh.position.x - pp.x) ** 2 + (pk.mesh.position.z - pp.z) ** 2;
      if (d2 < 2.6) collectPickup(pk);
    }
  }
}
