// Palmera Heat — pedestrians (and the foot cops who chase the player).
// Peds stroll the sidewalks, turn at intersections, and run when they hear
// gunfire or an explosion. A ped is a small articulated figure: torso, head,
// swinging legs. Foot cops reuse the same body with a dark uniform and a
// chase-and-shoot brain.

import * as THREE from 'three';
import { CITY, PED_SHIRTS, PED_SKINS, PED_PANTS } from './config.js';

function makePedMesh(shirt, skin, pants, isCop) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: isCop ? 0x1d3a5f : shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const pantsMat = new THREE.MeshLambertMaterial({ color: isCop ? 0x141c26 : pants });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), shirtMat);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skinMat);
  head.position.y = 1.78;
  head.castShadow = true;
  group.add(head);

  if (isCop) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.14, 10), pantsMat);
    cap.position.y = 1.96;
    group.add(cap);
  } else {
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 10, 8, 0, Math.PI * 2, 0, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x2b1d12 }),
    );
    hair.position.y = 1.82;
    group.add(hair);
  }

  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pantsMat);
    mesh.position.y = -0.36;
    mesh.castShadow = true;
    leg.add(mesh);
    leg.position.set(s * 0.17, 0.74, 0);
    group.add(leg);
    legs.push(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.2), shirtMat);
    arm.position.set(s * 0.42, 1.12, 0);
    group.add(arm);
  }
  return { group, legs };
}

export class Ped {
  constructor(scene, rng, x, z, isCop = false) {
    this.scene = scene;
    this.isCop = isCop;
    const built = makePedMesh(
      rng.pick(PED_SHIRTS),
      rng.pick(PED_SKINS),
      rng.pick(PED_PANTS),
      isCop,
    );
    this.mesh = built.group;
    this.legs = built.legs;
    this.mesh.position.set(x, 0, z);
    this.heading = rng.range(0, Math.PI * 2);
    this.mesh.rotation.y = this.heading;
    this.speed = isCop ? 0 : rng.range(1.1, 2.1);
    this.walkPhase = rng.range(0, Math.PI * 2);
    this.state = 'walk';
    this.stateTime = 0;
    this.fleeFrom = null;
    this.health = 100;
    this.dead = false;
    this.deadTime = 0;
    this.shootTimer = rng.range(0.3, 1);
    this.axis = rng.chance(0.5) ? 'x' : 'z';
    this.road = rng.pick(CITY.roads);
    this.dir = rng.chance(0.5) ? 1 : -1;
    this.side = rng.chance(0.5) ? 1 : -1;
    scene.add(this.mesh);
  }

  get pos() {
    return this.mesh.position;
  }

  fall() {
    if (this.dead) return;
    this.dead = true;
    this.deadTime = 0;
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.35;
  }

  damage(amount) {
    if (this.dead) return true;
    this.health -= amount;
    if (this.health <= 0) {
      this.fall();
      return true;
    }
    return false;
  }

  update(dt, world) {
    if (this.dead) {
      this.deadTime += dt;
      if (this.deadTime > 2.5) this.mesh.position.y -= dt * 0.5;
      return this.deadTime > 4;
    }
    this.stateTime += dt;
    const playerPos = world.player.pos;

    if (this.isCop) {
      return this._updateCop(dt, world, playerPos);
    }

    if (this.state === 'flee') {
      if (this.stateTime > 6) {
        this.state = 'walk';
        this.speed = 1.6;
      } else if (this.fleeFrom) {
        const dx = this.pos.x - this.fleeFrom.x;
        const dz = this.pos.z - this.fleeFrom.z;
        const d = Math.hypot(dx, dz) || 1;
        this.heading = Math.atan2(dx / d, dz / d);
        this.speed = 4.6;
      }
    }

    // Walk along the sidewalk: keep to the lane, turn at intersections.
    if (this.state === 'walk') {
      const coord = this.axis === 'x' ? this.pos.x : this.pos.z;
      const crossRoads = CITY.roads;
      let nearest = null;
      for (const r of crossRoads) {
        const d = (r - coord) * this.dir;
        if (d > 0 && d < 1.5) nearest = r;
      }
      if (nearest !== null && Math.random() < 0.3) {
        this.axis = this.axis === 'x' ? 'z' : 'x';
        this.road = nearest;
        this.dir = Math.random() < 0.5 ? 1 : -1;
        this.side = Math.random() < 0.5 ? 1 : -1;
      }
      const targetHeading = this.axis === 'x'
        ? (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
        : (this.dir > 0 ? 0 : Math.PI);
      this.heading = targetHeading;
      const lane = this.road + this.side * 9.5;
      if (this.axis === 'x') this.pos.z += (lane - this.pos.z) * Math.min(1, dt * 2);
      else this.pos.x += (lane - this.pos.x) * Math.min(1, dt * 2);
    }

    const f = { x: Math.sin(this.heading), z: Math.cos(this.heading) };
    this.pos.x += f.x * this.speed * dt;
    this.pos.z += f.z * this.speed * dt;
    this.mesh.rotation.y = this.heading;
    this.walkPhase += dt * this.speed * 2.4;
    const swing = Math.sin(this.walkPhase) * 0.55;
    this.legs[0].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    // Stay inside the world.
    this.pos.x = Math.max(-400, Math.min(390, this.pos.x));
    this.pos.z = Math.max(-400, Math.min(400, this.pos.z));
    return false;
  }

  _updateCop(dt, world, playerPos) {
    const dx = playerPos.x - this.pos.x;
    const dz = playerPos.z - this.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    this.heading = Math.atan2(dx / dist, dz / dist);
    const playerSpeed = world.player.inCar ? Math.abs(world.player.car.speed) : 0;
    if (dist > 26 || playerSpeed > 12) {
      // Run to catch up.
      this.speed = 7.5;
      const f = { x: Math.sin(this.heading), z: Math.cos(this.heading) };
      this.pos.x += f.x * this.speed * dt;
      this.pos.z += f.z * this.speed * dt;
    } else {
      // Close enough: stand and shoot.
      this.speed = 0;
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = 0.85;
        world.effects.muzzle(this.pos.x, 1.5, this.pos.z, this.heading);
        world.audio.distantShot();
        if (Math.random() < 0.4 && !world.player.inCar) {
          world.player.takeDamage(6, world);
        } else if (Math.random() < 0.4 && world.player.inCar) {
          if (world.player.car.damage(4)) world.onCarDestroyed(world.player.car, true);
        }
      }
    }
    this.mesh.rotation.y = this.heading;
    this.walkPhase += dt * Math.max(2, this.speed) * 2.4;
    const swing = Math.sin(this.walkPhase) * 0.55 * Math.min(1, this.speed / 3);
    this.legs[0].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    return false;
  }

  remove() {
    this.scene.remove(this.mesh);
  }
}

export class PedestrianManager {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.peds = [];
    this.cops = [];
    this.respawnTimer = 0;
  }

  spawnInitial(count, playerPos) {
    for (let i = 0; i < count; i++) {
      const p = this._sidewalkPoint(playerPos);
      if (p) this.peds.push(new Ped(this.scene, this.rng, p.x, p.z));
    }
  }

  _sidewalkPoint(near) {
    for (let tries = 0; tries < 12; tries++) {
      const alongX = this.rng.chance(0.5);
      const road = this.rng.pick(CITY.roads);
      const t = this.rng.range(-CITY.half, CITY.half);
      const side = this.rng.chance(0.5) ? 1 : -1;
      const p = alongX ? { x: t, z: road + side * 9.5 } : { x: road + side * 9.5, z: t };
      if (near && Math.hypot(p.x - near.x, p.z - near.z) > 260) continue;
      return p;
    }
    return { x: 0, z: -40 };
  }

  /** Everyone nearby runs from a bang at (x, z). */
  scare(x, z, radius = 30) {
    for (const ped of this.peds) {
      if (ped.dead) continue;
      const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
      if (d < radius) {
        ped.state = 'flee';
        ped.stateTime = 0;
        ped.fleeFrom = { x, z };
      }
    }
  }

  nearestPed(pos, radius) {
    let best = null;
    let bestD = radius;
    for (const ped of [...this.peds, ...this.cops]) {
      if (ped.dead) continue;
      const d = Math.hypot(ped.pos.x - pos.x, ped.pos.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    return best;
  }

  spawnCopNear(pos) {
    const angle = this.rng.range(0, Math.PI * 2);
    const dist = this.rng.range(28, 45);
    const cop = new Ped(this.scene, this.rng, pos.x + Math.sin(angle) * dist, pos.z + Math.cos(angle) * dist, true);
    this.cops.push(cop);
    return cop;
  }

  clearCops() {
    for (const cop of this.cops) cop.remove();
    this.cops = [];
  }

  update(dt, world) {
    const playerPos = world.player.pos;
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const ped = this.peds[i];
      const gone = ped.update(dt, world);
      const far = Math.hypot(ped.pos.x - playerPos.x, ped.pos.z - playerPos.z) > 300;
      if (gone || far) {
        ped.remove();
        this.peds.splice(i, 1);
      }
    }
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const cop = this.cops[i];
      const gone = cop.update(dt, world);
      const far = Math.hypot(cop.pos.x - playerPos.x, cop.pos.z - playerPos.z) > 220;
      if (gone || far) {
        cop.remove();
        this.cops.splice(i, 1);
      }
    }
    // Keep the streets populated near the player.
    this.respawnTimer -= dt;
    if (this.respawnTimer <= 0) {
      this.respawnTimer = 1.5;
      while (this.peds.length < 26) {
        const p = this._sidewalkPoint(playerPos);
        this.peds.push(new Ped(this.scene, this.rng, p.x, p.z));
      }
    }
  }
}
