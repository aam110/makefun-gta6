// Juice: particles, tracers, muzzle flashes, objective beacons and camera shake.
import * as THREE from 'three';
import { S, rand, pick } from './config.js';

const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);

export function burst(x, y, z, color, n = 12, speed = 6, life = 0.7, gravity = -9) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    S.scene.add(m);
    S.particles.push({
      mesh: m, mat,
      vx: rand(-speed, speed), vy: rand(1, speed), vz: rand(-speed, speed),
      life: rand(life * 0.5, life), maxLife: life, gravity,
    });
  }
}

export function smokePuff(x, y, z) {
  burst(x, y, z, 0x666666, 5, 2.5, 1.2, 2.5);
}

export function muzzleFlash(x, y, z) {
  burst(x, y, z, 0xffd23f, 5, 3, 0.12, 0);
  burst(x, y, z, 0xff7b00, 3, 2, 0.1, 0);
}

export function tracer(from, to, color = 0xffe08a) {
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const g = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const line = new THREE.Line(g, mat);
  S.scene.add(line);
  S.tracers.push({ line, mat, life: 0.09 });
}

export function shake(amount) {
  S.shake = Math.min(1.2, S.shake + amount);
}

export function updateEffects(dt) {
  for (let i = S.particles.length - 1; i >= 0; i--) {
    const p = S.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      S.scene.remove(p.mesh);
      S.particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    if (p.mesh.position.y < 0.1) { p.mesh.position.y = 0.1; p.vy *= -0.4; }
    p.mat.opacity = Math.max(0, p.life / p.maxLife);
    p.mesh.rotation.x += dt * 6;
    p.mesh.rotation.y += dt * 5;
  }
  for (let i = S.tracers.length - 1; i >= 0; i--) {
    const t = S.tracers[i];
    t.life -= dt;
    if (t.life <= 0) {
      S.scene.remove(t.line);
      t.line.geometry.dispose();
      t.mat.dispose();
      S.tracers.splice(i, 1);
    }
  }
  S.shake = Math.max(0, S.shake - dt * 2.2);
}

// A tall golden light pillar + spinning diamond marking the objective.
export function makeBeacon(x, z, color = 0xffd23f) {
  const g = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.5, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 30;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color }),
  );
  diamond.position.y = 5.5;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  g.add(pillar, diamond, ring);
  g.position.set(x, 0, z);
  g.userData.diamond = diamond;
  g.userData.ring = ring;
  S.scene.add(g);
  return g;
}

export function updateBeacon(dt) {
  const b = S.beacon;
  if (!b) return;
  b.userData.diamond.rotation.y += dt * 2.4;
  b.userData.diamond.position.y = 5.5 + Math.sin(S.elapsed * 2) * 0.6;
  const s = 1 + Math.sin(S.elapsed * 3) * 0.08;
  b.userData.ring.scale.set(s, s, 1);
}

export function removeBeacon() {
  if (S.beacon) {
    S.scene.remove(S.beacon);
    S.beacon = null;
  }
}

export const BLOOD_COLORS = [0xc0392b, 0x922b21];
export function bloodBurst(x, y, z) { burst(x, y, z, pick(BLOOD_COLORS), 10, 4, 0.6); }
