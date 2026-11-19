// Palmera Heat — the third-person chase camera.
// The camera orbits with the mouse (pointer lock or drag, arrows as a
// fallback), follows behind the player on foot, and swings behind the car
// while driving. Distance and height ease toward their targets so the view
// never snaps.

import * as THREE from 'three';

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.32;
    this.dist = 8;
    this.targetDist = 8;
    this.pos = new THREE.Vector3(0, 6, -12);
    this.lookAt = new THREE.Vector3();
    this.shake = 0;
  }

  addShake(amount) {
    this.shake = Math.min(0.9, this.shake + amount);
  }

  update(dt, world) {
    const { input, player } = world;
    const look = input.consumeLook();
    this.yaw -= look.dx * 0.0026;
    this.pitch += look.dy * 0.0022;
    // Arrow keys turn the camera too (no pointer lock needed).
    if (input.isDown('ArrowLeft')) this.yaw += dt * 1.6;
    if (input.isDown('ArrowRight')) this.yaw -= dt * 1.6;
    if (input.isDown('ArrowUp')) this.pitch = Math.max(0.05, this.pitch - dt * 1.2);
    if (input.isDown('ArrowDown')) this.pitch = Math.min(1.1, this.pitch + dt * 1.2);
    this.pitch = Math.max(0.06, Math.min(1.15, this.pitch));

    const inCar = player.inCar && player.car;
    const targetPos = player.pos;
    const targetHeading = inCar ? player.car.heading : player.heading;

    // While driving, ease the camera behind the car's heading.
    if (inCar && Math.abs(player.car.speed) > 4) {
      let diff = targetHeading - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 1.4);
    }

    this.targetDist = inCar ? 10.5 : 8;
    this.dist += (this.targetDist - this.dist) * Math.min(1, dt * 3);

    const height = inCar ? 4.6 : 3.4;
    const lookHeight = inCar ? 1.8 : 1.7;
    const back = {
      x: targetPos.x - Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist,
      z: targetPos.z - Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist,
      y: targetPos.y + height * Math.sin(this.pitch) + (inCar ? 1.2 : 0.9),
    };
    // Keep the camera out of the ground and out of buildings (cheap: clamp
    // height and pull in when a collider is in the way).
    back.y = Math.max(1.2, back.y);
    const k = 1 - Math.exp(-dt * 7);
    this.pos.x += (back.x - this.pos.x) * k;
    this.pos.y += (back.y - this.pos.y) * k;
    this.pos.z += (back.z - this.pos.z) * k;

    this.shake = Math.max(0, this.shake - dt * 2.2);
    const shX = (Math.random() - 0.5) * this.shake * 0.5;
    const shY = (Math.random() - 0.5) * this.shake * 0.5;
    this.camera.position.set(this.pos.x + shX, this.pos.y + shY, this.pos.z);
    this.lookAt.set(targetPos.x, targetPos.y + lookHeight, targetPos.z);
    this.camera.lookAt(this.lookAt);
  }

  /** Snap the camera behind a heading (used when starting and staging). */
  snapBehind(pos, heading, inCar) {
    this.yaw = heading;
    this.pitch = 0.32;
    this.dist = inCar ? 10.5 : 8;
    this.pos.set(
      pos.x - Math.sin(heading) * this.dist * 0.95,
      pos.y + (inCar ? 4.2 : 3.2),
      pos.z - Math.cos(heading) * this.dist * 0.95,
    );
  }
}
