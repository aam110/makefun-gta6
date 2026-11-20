// CAYO BRAVO — player.js: Dario "Río" Voss on foot (walk, run, punch anim)
// and the third-person chase camera that follows him and his car. Also owns
// health, armour, money, RP and the wanted level.

import * as THREE from 'three';
import { RANKS, clamp, lerp } from './config.js';
import { resolveBuildingCollision } from './world.js';

export function buildPlayerMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5a, roughness: 0.85 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xffd21f, roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x1e2a4a, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.9, 0.36), shirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skin);
  head.position.y = 1.88;
  head.castShadow = true;
  g.add(head);
  // Signature sunset-orange cap.
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.48),
    new THREE.MeshStandardMaterial({ color: 0xff5a1a, roughness: 0.8 }));
  cap.position.y = 2.12;
  g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.72, 0.3), pants);
  legL.position.set(-0.18, 0.36, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.18;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), skin);
  armL.position.set(-0.44, 1.15, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.44;
  g.add(armR);
  g.userData.legs = [legL, legR];
  g.userData.arms = [armL, armR];
  return g;
}

export function createPlayer(scene, x, z) {
  const mesh = buildPlayerMesh();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh, x, z, heading: Math.PI,
    onFoot: true, car: null,
    health: 100, armour: 50,
    money: 1250, wanted: 0,
    rp: 1850, rankIndex: 2,
    walkPhase: 0, punchAnim: 0,
    speedKmh: 0,
    addRp(amount) {
      this.rp += amount;
      while (this.rankIndex < RANKS.length - 1 && this.rp >= RANKS[this.rankIndex + 1].rp) {
        this.rankIndex += 1;
      }
    },
    rank() { return RANKS[this.rankIndex]; },
    nextRankRp() {
      return this.rankIndex < RANKS.length - 1 ? RANKS[this.rankIndex + 1].rp : this.rp;
    },
    damage(amount, cause) {
      if (this.armour > 0) {
        const absorbed = Math.min(this.armour, amount * 0.6);
        this.armour -= absorbed;
        amount -= absorbed;
      }
      this.health = Math.max(0, this.health - amount);
      if (this.health <= 0 && cause) this.dead = true;
    },
    heal(amount) { this.health = Math.min(100, this.health + amount); },
  };
}

// On-foot movement: WASD relative to the camera yaw, run with Shift.
export function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  const fwd = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (fwd === 0 && strafe === 0) {
    p.speedKmh = 0;
    p.walkPhase *= 0.9;
    animatePlayerMesh(p, dt, 0);
    return;
  }
  const camYaw = G.cameraYaw;
  const moveX = -Math.sin(camYaw) * fwd + Math.cos(camYaw) * strafe;
  const moveZ = -Math.cos(camYaw) * fwd - Math.sin(camYaw) * strafe;
  const len = Math.hypot(moveX, moveZ) || 1;
  const speed = input.run ? 8.5 : 4.6;
  p.heading = Math.atan2(-moveX / len, -moveZ / len);
  let nx = p.x + (moveX / len) * speed * dt;
  let nz = p.z + (moveZ / len) * speed * dt;
  nx = clamp(nx, -292, 292); nz = clamp(nz, -292, 292);
  const res = resolveBuildingCollision(G.world.colliders, nx, nz, 0.7);
  p.x = res.x; p.z = res.z;
  p.speedKmh = speed * 3.6;
  p.walkPhase += dt * speed * 1.9;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
  animatePlayerMesh(p, dt, speed);
  if (input.run && Math.random() < dt * 6) G.effects.addDust(p.x, 0.2, p.z);
}

function animatePlayerMesh(p, dt, speed) {
  const [legL, legR] = p.mesh.userData.legs;
  const [armL, armR] = p.mesh.userData.arms;
  const swing = speed > 0 ? Math.sin(p.walkPhase) * 0.6 : 0;
  legL.rotation.x = swing; legR.rotation.x = -swing;
  if (p.punchAnim > 0) {
    p.punchAnim -= dt;
    armR.rotation.x = -1.6 * Math.sin((p.punchAnim / 0.25) * Math.PI);
  } else {
    armL.rotation.x = -swing * 0.7;
    armR.rotation.x = swing * 0.7;
  }
}

// Third-person chase camera: behind the car or the player, mouse-orbitable.
export function updateChaseCamera(G, dt) {
  const p = G.player;
  const input = G.input;
  const target = p.car ?? p;
  const heading = target.heading;
  const desiredYaw = heading + input.camYawOffset;
  let dyaw = desiredYaw - G.cameraYaw;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;
  G.cameraYaw += dyaw * Math.min(1, dt * (p.car ? 3.2 : 5));
  const dist = p.car ? 11.5 : 7.5;
  const height = p.car ? 4.8 : 3.4;
  const pitch = input.camPitch;
  const cx = target.x + Math.sin(G.cameraYaw) * dist * Math.cos(pitch);
  const cz = target.z + Math.cos(G.cameraYaw) * dist * Math.cos(pitch);
  const cy = height + Math.sin(pitch) * dist * 0.6;
  G.camera.position.x = lerp(G.camera.position.x, cx, Math.min(1, dt * 8));
  G.camera.position.y = lerp(G.camera.position.y, cy, Math.min(1, dt * 8));
  G.camera.position.z = lerp(G.camera.position.z, cz, Math.min(1, dt * 8));
  const lookX = target.x - Math.sin(heading) * 4;
  const lookZ = target.z - Math.cos(heading) * 4;
  G.camera.lookAt(lookX, 3.0, lookZ); // level enough to show the skyline — and the helicopter
}

// Slow cinematic orbit used behind the title screen.
export function updateTitleCamera(G, dt, t) {
  const cx = -180 + Math.sin(t * 0.05) * 60;
  const cz = -60 + Math.cos(t * 0.04) * 90;
  G.camera.position.set(cx, 26 + Math.sin(t * 0.07) * 4, cz);
  G.camera.lookAt(40, 8, 0);
}
