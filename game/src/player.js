// Palmera Heat — Mara Voss, on foot and behind the wheel.
// On foot Mara runs, jumps and shoots; near a car, E steals it and the
// camera switches to a driving chase view. Shooting is a raycast from the
// camera through the crosshair: peds fall, cars take damage, and every shot
// is a crime the police notice.

import * as THREE from 'three';
import { PLAYER, CAR, WANTED } from './config.js';
import { resolveCircle } from './city.js';

function makePlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xd94f3d });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc68642 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.8, 0.36), jacket);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), skin);
  head.position.y = 1.8;
  head.castShadow = true;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10, 0, Math.PI * 2, 0, 1.5), hairMat);
  hair.position.y = 1.84;
  group.add(hair);
  const ponytail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), hairMat);
  ponytail.position.set(0, 1.62, -0.26);
  ponytail.rotation.x = 0.3;
  group.add(ponytail);

  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.74, 0.28), jeans);
    mesh.position.y = -0.37;
    mesh.castShadow = true;
    leg.add(mesh);
    leg.position.set(s * 0.18, 0.76, 0);
    group.add(leg);
    legs.push(leg);
    const arm = new THREE.Group();
    const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.68, 0.22), jacket);
    armMesh.position.y = -0.3;
    arm.add(armMesh);
    arm.position.set(s * 0.44, 1.46, 0);
    group.add(arm);
  }
  // The pistol, held in the right hand.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.42), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  gun.position.set(0.44, 1.05, 0.3);
  group.add(gun);
  return { group, legs, gun };
}

export class Player {
  constructor(scene, x, z, heading) {
    this.scene = scene;
    const built = makePlayerMesh();
    this.mesh = built.group;
    this.legs = built.legs;
    this.mesh.position.set(x, 0, z);
    this.heading = heading;
    this.mesh.rotation.y = heading;
    this.health = PLAYER.maxHealth;
    this.inCar = false;
    this.car = null;
    this.verticalSpeed = 0;
    this.grounded = true;
    this.walkPhase = 0;
    this.shootCooldown = 0;
    this.punchCooldown = 0;
    this.aiming = false;
    this.raycaster = new THREE.Raycaster();
    scene.add(this.mesh);
  }

  get pos() {
    return this.inCar && this.car ? this.car.pos : this.mesh.position;
  }

  get speed() {
    return this.inCar && this.car ? Math.abs(this.car.speed) : 0;
  }

  takeDamage(amount, world) {
    if (this.health <= 0) return;
    this.health = Math.max(0, this.health - amount);
    world.hud.flashDamage();
    if (this.health <= 0) world.onPlayerWasted();
  }

  heal(amount) {
    this.health = Math.min(PLAYER.maxHealth, this.health + amount);
  }

  update(dt, world) {
    const { input, city } = world;
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);

    if (this.inCar && this.car) {
      this._updateDriving(dt, world);
      return;
    }

    // --- On foot -----------------------------------------------------------
    const camYaw = world.camera.yaw;
    let mx = 0;
    let mz = 0;
    if (input.isDown('KeyW')) { mx += Math.sin(camYaw); mz += Math.cos(camYaw); }
    if (input.isDown('KeyS')) { mx -= Math.sin(camYaw); mz -= Math.cos(camYaw); }
    if (input.isDown('KeyA')) { mx += Math.sin(camYaw - Math.PI / 2); mz += Math.cos(camYaw - Math.PI / 2); }
    if (input.isDown('KeyD')) { mx += Math.sin(camYaw + Math.PI / 2); mz += Math.cos(camYaw + Math.PI / 2); }
    const moving = mx !== 0 || mz !== 0;
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;

    if (moving) {
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      this.heading = Math.atan2(mx, mz);
      const next = { x: this.mesh.position.x + mx * speed * dt, z: this.mesh.position.z + mz * speed * dt };
      resolveCircle(next, PLAYER.radius, city.colliders);
      // Do not walk through cars.
      for (const car of world.traffic.allCars()) {
        if (car.dead) continue;
        const dx = next.x - car.pos.x;
        const dz = next.z - car.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < CAR.radius + 0.4 && d > 0.01) {
          next.x = car.pos.x + (dx / d) * (CAR.radius + 0.4);
          next.z = car.pos.z + (dz / d) * (CAR.radius + 0.4);
        }
      }
      this.mesh.position.x = next.x;
      this.mesh.position.z = next.z;
      this.walkPhase += dt * speed * 1.6;
    }
    const swing = moving ? Math.sin(this.walkPhase) * 0.6 : 0;
    this.legs[0].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    this.mesh.rotation.y = this.heading;

    // Jump and gravity.
    if (input.wasPressed('Space') && this.grounded) {
      this.verticalSpeed = PLAYER.jumpSpeed;
      this.grounded = false;
    }
    if (!this.grounded) {
      this.verticalSpeed -= PLAYER.gravity * dt;
      this.mesh.position.y += this.verticalSpeed * dt;
      if (this.mesh.position.y <= 0) {
        this.mesh.position.y = 0;
        this.verticalSpeed = 0;
        this.grounded = true;
      }
    }

    // Enter a car.
    if (input.wasPressed('KeyE')) {
      const car = world.traffic.stealableNear(this.mesh.position, 4);
      if (car) {
        world.onEnterCar(car);
      } else {
        world.onInteractKey();
      }
    }

    // Punch: F, short range.
    if (input.wasPressed('KeyF') && this.punchCooldown <= 0) {
      this.punchCooldown = 0.45;
      const ped = world.peds.nearestPed(this.mesh.position, 2.4);
      if (ped) {
        world.audio.punch();
        world.effects.hitPuff(ped.pos.x, 1.3, ped.pos.z);
        if (ped.damage(50)) world.onPedKilled(ped);
        else world.police.addHeat(WANTED.hitPed / 2, 'assault');
      }
    }

    // Shoot: hold or click the mouse.
    this.aiming = input.mouseDown;
    if (input.mouseDown && this.shootCooldown <= 0) {
      this.shootCooldown = 0.22;
      this._shoot(world);
    }
  }

  _updateDriving(dt, world) {
    const { input, city } = world;
    const car = this.car;
    let throttle = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) throttle = 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) throttle = -1;
    let steer = 0;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) steer = 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) steer = -1;
    const handbrake = input.isDown('Space');
    const result = car.drive(dt, throttle, steer, handbrake, city.colliders);
    if (result === 'crash') {
      world.audio.crash();
      world.effects.sparks(car.pos.x, 1, car.pos.z);
      world.police.addHeat(12, 'crash');
      if (car.dead) world.onCarDestroyed(car, false);
    }
    // Car-to-car collisions.
    for (const other of world.traffic.allCars()) {
      if (other === car || other.dead) continue;
      const dx = car.pos.x - other.pos.x;
      const dz = car.pos.z - other.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < CAR.radius * 2 && d > 0.01) {
        const push = (CAR.radius * 2 - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        car.pos.x += nx * push;
        car.pos.z += nz * push;
        if (other.driver === 'traffic' || other.driver === 'parked') {
          other.pos.x -= nx * push;
          other.pos.z -= nz * push;
        }
        const impact = Math.abs(car.speed - other.speed);
        // Cooldown per pair of cars: one crash, one damage event.
        const now = world.time;
        if (impact > 4 && now - (car.lastCrash || 0) > 0.6) {
          car.lastCrash = now;
          world.audio.crash();
          world.effects.sparks(car.pos.x, 1, car.pos.z);
          if (car.damage(impact * 0.8)) world.onCarDestroyed(car, false);
          if (other.damage(impact * 0.8)) world.onCarDestroyed(other, false);
          car.speed *= 0.5;
        }
      }
    }
    // Running over pedestrians.
    for (const ped of world.peds.peds) {
      if (ped.dead) continue;
      const d = Math.hypot(ped.pos.x - car.pos.x, ped.pos.z - car.pos.z);
      if (d < 2.2 && Math.abs(car.speed) > 3) {
        if (ped.damage(100)) world.onPedKilled(ped);
        world.effects.hitPuff(ped.pos.x, 1, ped.pos.z);
        world.peds.scare(car.pos.x, car.pos.z, 25);
      }
    }
    // Drift smoke.
    if (handbrake && Math.abs(car.speed) > 10 && Math.random() < dt * 20) {
      world.effects.tyreSmoke(car.pos.x, 0.4, car.pos.z);
    }
    // Horn.
    if (input.wasPressed('KeyH')) world.audio.horn();
    // Exit the car.
    if (input.wasPressed('KeyE')) {
      world.onExitCar();
    }
    // Hide the on-foot body while driving.
    this.mesh.visible = false;
    this.mesh.position.set(car.pos.x, 0, car.pos.z);
  }

  enterCar(car) {
    this.inCar = true;
    this.car = car;
    car.isPlayerCar = true;
    car.driver = 'player';
    this.mesh.visible = false;
  }

  exitCar() {
    if (!this.car) return;
    const car = this.car;
    car.isPlayerCar = false;
    car.driver = 'parked';
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    this.mesh.position.set(car.pos.x + side.x * 2.6, 0, car.pos.z + side.z * 2.6);
    this.mesh.visible = true;
    this.heading = car.heading;
    this.mesh.rotation.y = this.heading;
    this.inCar = false;
    this.car = null;
  }

  _shoot(world) {
    const camera = world.threeCamera;
    this.raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    this.raycaster.far = 90;
    world.audio.gunshot();
    world.police.addHeat(WANTED.shoot, 'gunfire');
    world.peds.scare(this.mesh.position.x, this.mesh.position.z, 35);
    const from = this.mesh.position.clone();
    from.y = 1.45;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    world.effects.muzzle(from.x + dir.x, from.y, from.z + dir.z, this.heading);

    // Targets: peds, cops, cars. Nearest hit wins.
    let bestDist = 90;
    let bestPed = null;
    let bestCar = null;
    const allPeds = [...world.peds.peds, ...world.peds.cops];
    for (const ped of allPeds) {
      if (ped.dead) continue;
      const to = new THREE.Vector3(ped.pos.x, 1.2, ped.pos.z).sub(from);
      const dist = to.length();
      if (dist > bestDist) continue;
      to.normalize();
      if (to.dot(dir) > 0.985) {
        bestDist = dist;
        bestPed = ped;
        bestCar = null;
      }
    }
    for (const car of world.traffic.allCars()) {
      if (car.dead) continue;
      const to = new THREE.Vector3(car.pos.x, 1, car.pos.z).sub(from);
      const dist = to.length();
      if (dist > bestDist) continue;
      to.normalize();
      if (to.dot(dir) > 0.975) {
        bestDist = dist;
        bestCar = car;
        bestPed = null;
      }
    }
    for (const copCar of world.police.cars) {
      if (copCar.dead) continue;
      const to = new THREE.Vector3(copCar.pos.x, 1, copCar.pos.z).sub(from);
      const dist = to.length();
      if (dist > bestDist) continue;
      to.normalize();
      if (to.dot(dir) > 0.975) {
        bestDist = dist;
        bestCar = copCar;
        bestPed = null;
      }
    }
    if (world.missions.targetCar && !world.missions.targetCar.dead) {
      const car = world.missions.targetCar;
      const to = new THREE.Vector3(car.pos.x, 1, car.pos.z).sub(from);
      const dist = to.length();
      if (dist < bestDist) {
        to.normalize();
        if (to.dot(dir) > 0.975) {
          bestDist = dist;
          bestCar = car;
          bestPed = null;
        }
      }
    }

    const hitPoint = from.clone().add(dir.clone().multiplyScalar(bestDist));
    if (bestPed) {
      world.effects.hitPuff(bestPed.pos.x, 1.3, bestPed.pos.z);
      if (bestPed.damage(100)) world.onPedKilled(bestPed);
    } else if (bestCar) {
      world.effects.sparks(hitPoint.x, hitPoint.y, hitPoint.z);
      if (bestCar.kind === 'police') world.police.addHeat(WANTED.ramCop, 'shot police');
      if (bestCar.damage(34)) world.onCarDestroyed(bestCar, true);
    } else {
      world.effects.sparks(hitPoint.x, hitPoint.y, hitPoint.z);
    }
  }
}
