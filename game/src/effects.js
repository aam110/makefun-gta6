// Juice: pooled particles (sparks, smoke, explosion, blood-free hit puffs),
// skid marks, muzzle flashes, tracers and camera shake. Everything is pooled
// up front so the frame loop never allocates.

import * as THREE from 'three';
import { rand, TAU } from './config.js';

export function createEffects(G) {
  const scene = G.scene;
  const P_COUNT = 260;
  const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  const particles = [];
  for (let i = 0; i < P_COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    scene.add(mesh);
    particles.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, grav: 0, grow: 0, base: 1 });
  }
  let pCursor = 0;

  // Skid marks: flat dark quads that fade out.
  const skids = [];
  const skidGeo = new THREE.PlaneGeometry(0.5, 2.2);
  for (let i = 0; i < 60; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x0a0a0c, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(skidGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    scene.add(mesh);
    skids.push({ mesh, life: 0 });
  }
  let sCursor = 0;

  // Tracers: stretched glowing boxes that fade in a blink.
  const tracers = [];
  const tracerGeo = new THREE.BoxGeometry(0.08, 0.08, 1);
  for (let i = 0; i < 24; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(tracerGeo, mat);
    mesh.visible = false;
    scene.add(mesh);
    tracers.push({ mesh, life: 0 });
  }
  let tCursor = 0;

  // Muzzle flash: a point light + a bright sprite quad, shown for ~50ms.
  const flashLight = new THREE.PointLight(0xffc46b, 0, 14);
  scene.add(flashLight);
  let flashTime = 0;

  const FX = {
    shake: 0,
    spawn(x, y, z, opts = {}) {
      const p = particles[pCursor];
      pCursor = (pCursor + 1) % P_COUNT;
      p.mesh.visible = true;
      p.mesh.position.set(x, y, z);
      p.mesh.material.color.setHex(opts.color ?? 0xffffff);
      p.mesh.material.opacity = opts.opacity ?? 1;
      p.base = opts.size ?? 1;
      p.mesh.scale.setScalar(p.base);
      const sp = opts.speed ?? 4;
      const a = rand(TAU);
      const up = opts.up ?? 2;
      p.vx = Math.cos(a) * sp * rand(0.4, 1);
      p.vz = Math.sin(a) * sp * rand(0.4, 1);
      p.vy = rand(0.2, 1) * up + (opts.vy ?? 0);
      p.maxLife = opts.life ?? rand(0.4, 0.9);
      p.life = p.maxLife;
      p.grav = opts.grav ?? -6;
      p.grow = opts.grow ?? 0;
    },
    burst(x, y, z, color, n = 12, speed = 5, opts = {}) {
      for (let i = 0; i < n; i++) this.spawn(x, y, z, { color, speed, ...opts });
    },
    smoke(x, y, z, n = 1) {
      for (let i = 0; i < n; i++) {
        this.spawn(x + rand(-0.3, 0.3), y, z + rand(-0.3, 0.3), {
          color: 0x555560, speed: 0.7, up: 2.2, life: rand(0.8, 1.5), size: rand(1.4, 2.4), grow: 1.5, grav: 1.2, opacity: 0.55,
        });
      }
    },
    explosion(x, y, z) {
      this.burst(x, y + 0.5, z, 0xff7a1a, 26, 9, { life: 0.7, size: 1.8 });
      this.burst(x, y + 0.5, z, 0xffd23e, 16, 6, { life: 0.5, size: 1.4 });
      this.burst(x, y + 0.5, z, 0x333333, 14, 3, { life: 1.4, size: 2.6, grow: 2, grav: 1.5, opacity: 0.7 });
      this.shake = Math.min(1, this.shake + 0.7);
      flashLight.position.set(x, y + 2, z);
      flashLight.intensity = 60;
      flashTime = 0.12;
    },
    skid(x, z, heading) {
      const s = skids[sCursor];
      sCursor = (sCursor + 1) % skids.length;
      s.mesh.visible = true;
      s.mesh.position.set(x, 0.12, z);
      s.mesh.rotation.z = -heading;
      s.mesh.material.opacity = 0.55;
      s.life = 6;
    },
    tracer(from, to, color = 0xffe08a) {
      const t = tracers[tCursor];
      tCursor = (tCursor + 1) % tracers.length;
      const dir = new THREE.Vector3().subVectors(to, from);
      const len = dir.length();
      if (len < 0.5) return;
      t.mesh.visible = true;
      t.mesh.material.color.setHex(color);
      t.mesh.material.opacity = 0.95;
      t.mesh.position.copy(from).addScaledVector(dir, 0.5);
      t.mesh.scale.set(1, 1, len);
      t.mesh.lookAt(to);
      t.life = 0.09;
    },
    muzzle(x, y, z) {
      flashLight.position.set(x, y, z);
      flashLight.intensity = 26;
      flashTime = 0.05;
      this.burst(x, y, z, 0xffc46b, 3, 2, { life: 0.12, size: 0.9 });
    },
    addShake(v) { this.shake = Math.min(1, this.shake + v); },
    update(dt) {
      for (const p of particles) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) { p.mesh.visible = false; continue; }
        p.vy += p.grav * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        if (p.mesh.position.y < 0.1) { p.mesh.position.y = 0.1; p.vy *= -0.3; }
        if (p.grow) p.mesh.scale.setScalar(p.base * (1 + (1 - p.life / p.maxLife) * p.grow));
        p.mesh.material.opacity = Math.min(1, (p.life / p.maxLife) * 1.4) * (p.mesh.material.opacity > 0.6 ? 1 : 0.55);
      }
      for (const s of skids) {
        if (s.life <= 0) continue;
        s.life -= dt;
        s.mesh.material.opacity = Math.max(0, s.life / 6) * 0.55;
        if (s.life <= 0) s.mesh.visible = false;
      }
      for (const t of tracers) {
        if (t.life <= 0) continue;
        t.life -= dt;
        if (t.life <= 0) t.mesh.visible = false;
      }
      if (flashTime > 0) {
        flashTime -= dt;
        if (flashTime <= 0) flashLight.intensity = 0;
      }
      this.shake = Math.max(0, this.shake - dt * 1.8);
    },
  };
  G.fx = FX;
  return FX;
}
