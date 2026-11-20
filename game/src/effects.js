// CAYO BRAVO — effects.js: particles for smoke, sparks and explosions,
// muzzle flashes, bullet tracers, skid dust and camera shake. All pooled
// sprites — no textures loaded, everything procedural.

import * as THREE from 'three';

export function createEffects(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const pool = [];
  const geo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < 220; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const s = new THREE.Mesh(geo, mat);
    s.visible = false;
    group.add(s);
    pool.push({ mesh: s, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, grow: 0, size: 1 });
  }
  const flash = new THREE.PointLight(0xffc46b, 0, 26);
  scene.add(flash);
  return {
    scene, pool, flash,
    shake: 0,
    spawn(x, y, z, opts) {
      const p = this.pool.find((q) => q.life <= 0);
      if (!p) return;
      p.life = p.maxLife = opts.life ?? 0.8;
      p.mesh.visible = true;
      p.mesh.position.set(x, y, z);
      p.mesh.material.color.setHex(opts.color ?? 0xffffff);
      p.mesh.material.opacity = opts.opacity ?? 0.9;
      p.size = opts.size ?? 1;
      p.mesh.scale.set(p.size, p.size, 1);
      p.vx = opts.vx ?? 0; p.vy = opts.vy ?? 0; p.vz = opts.vz ?? 0;
      p.grow = opts.grow ?? 0;
    },
    addSmoke(x, y, z) {
      this.spawn(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5), {
        color: 0x4a4a55, life: 1.4, size: 1.4, vy: 1.6, grow: 1.6, opacity: 0.55,
      });
    },
    addSparks(x, y, z, n) {
      for (let i = 0; i < n; i++) {
        this.spawn(x, y, z, {
          color: [0xffd21f, 0xff7a1a, 0xffffff][i % 3], life: 0.4 + Math.random() * 0.3,
          size: 0.35, vx: (Math.random() - 0.5) * 8, vy: Math.random() * 5, vz: (Math.random() - 0.5) * 8,
        });
      }
    },
    addDust(x, y, z) {
      this.spawn(x, y, z, { color: 0xc9a06a, life: 0.7, size: 1.1, vy: 0.6, grow: 1.2, opacity: 0.5 });
    },
    muzzleFlash(x, y, z, heading) {
      this.flash.position.set(x, y, z);
      this.flash.intensity = 60;
      this.spawn(x - Math.sin(heading) * 0.8, y, z - Math.cos(heading) * 0.8, {
        color: 0xffe9a8, life: 0.08, size: 1.3, opacity: 1,
      });
    },
    tracer(origin, dir, range) {
      const end = origin.clone().add(dir.clone().multiplyScalar(Math.min(range, 60)));
      const geoLine = new THREE.BufferGeometry().setFromPoints([origin, end]);
      const line = new THREE.Line(geoLine, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
      this.scene.add(line);
      setTimeout(() => { this.scene.remove(line); geoLine.dispose(); }, 70);
    },
    explode(x, y, z) {
      this.flash.position.set(x, y + 1, z);
      this.flash.intensity = 220;
      for (let i = 0; i < 26; i++) {
        this.spawn(x, y, z, {
          color: [0xffd21f, 0xff7a1a, 0xff2f4e, 0x4a4a55][i % 4],
          life: 0.6 + Math.random() * 0.9, size: 1.2 + Math.random() * 1.6,
          vx: (Math.random() - 0.5) * 10, vy: 2 + Math.random() * 7, vz: (Math.random() - 0.5) * 10,
          grow: 2, opacity: 0.95,
        });
      }
      this.shake = Math.min(1, this.shake + 0.7);
    },
    addShake(amount) { this.shake = Math.min(1, this.shake + amount); },
    update(dt, camera) {
      for (const p of this.pool) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) { p.mesh.visible = false; continue; }
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.vy -= 1.2 * dt;
        const t = p.life / p.maxLife;
        p.mesh.material.opacity = t * 0.9;
        const s = p.size * (1 + (1 - t) * p.grow);
        p.mesh.scale.set(s, s, 1);
        p.mesh.lookAt(camera.position);
      }
      this.flash.intensity *= Math.pow(0.001, dt);
      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt * 1.8);
        camera.position.x += (Math.random() - 0.5) * this.shake * 0.5;
        camera.position.y += (Math.random() - 0.5) * this.shake * 0.4;
      }
    },
  };
}
