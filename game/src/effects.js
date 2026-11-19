// Palmera Heat — particles and flashes.
// One pooled set of small billboards serves every burst: explosions, hit
// sparks, tyre smoke, muzzle flashes. A pooled point light gives explosions
// their punch without adding a light per blast.

import * as THREE from 'three';

const MAX_PARTICLES = 260;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    const geo = new THREE.PlaneGeometry(0.5, 0.5);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({
        mesh, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0,
        gravity: 0, grow: 0, size: 1, fade: true,
      });
    }
    this.flash = new THREE.PointLight(0xffa040, 0, 40, 1.6);
    this.scene.add(this.flash);
    this.flashLife = 0;
  }

  _spawn(x, y, z, opts) {
    const p = this.pool.find((q) => q.life <= 0);
    if (!p) return;
    p.mesh.visible = true;
    p.mesh.position.set(x, y, z);
    p.mesh.material.color.setHex(opts.color);
    p.mesh.material.opacity = opts.opacity ?? 0.95;
    p.mesh.scale.setScalar(opts.size ?? 1);
    p.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    p.vx = opts.vx ?? 0;
    p.vy = opts.vy ?? 0;
    p.vz = opts.vz ?? 0;
    p.gravity = opts.gravity ?? 0;
    p.grow = opts.grow ?? 0;
    p.size = opts.size ?? 1;
    p.maxLife = opts.life ?? 0.8;
    p.life = p.maxLife;
    p.fade = opts.fade !== false;
  }

  burst(x, y, z, color, count, speed, life = 0.7, size = 1) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.1;
      const s = speed * (0.4 + Math.random() * 0.8);
      this._spawn(x, y, z, {
        color,
        vx: Math.sin(a) * s,
        vy: up * s,
        vz: Math.cos(a) * s,
        gravity: -9,
        life: life * (0.6 + Math.random() * 0.7),
        size: size * (0.6 + Math.random() * 0.8),
      });
    }
  }

  sparks(x, y, z) {
    this.burst(x, y, z, 0xffd24d, 10, 7, 0.45, 0.5);
  }

  hitPuff(x, y, z) {
    this.burst(x, y, z, 0xc23b2e, 8, 3.5, 0.5, 0.7);
  }

  smoke(x, y, z) {
    this._spawn(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6, {
      color: 0x555555,
      vx: (Math.random() - 0.5) * 0.6,
      vy: 1.6 + Math.random(),
      vz: (Math.random() - 0.5) * 0.6,
      gravity: 1.2,
      grow: 1.8,
      life: 1.4,
      size: 0.8,
      opacity: 0.5,
    });
  }

  tyreSmoke(x, y, z) {
    this._spawn(x, y + 0.2, z, {
      color: 0xcccccc,
      vx: (Math.random() - 0.5) * 1.2,
      vy: 0.8,
      vz: (Math.random() - 0.5) * 1.2,
      grow: 1.4,
      life: 0.8,
      size: 0.7,
      opacity: 0.55,
    });
  }

  explosion(x, y, z) {
    this.burst(x, y + 0.5, z, 0xff7b1c, 26, 9, 0.9, 1.6);
    this.burst(x, y + 0.5, z, 0xffd24d, 16, 6, 0.6, 1.2);
    this.burst(x, y + 0.5, z, 0x333333, 14, 4, 1.6, 2.2);
    this.flash.position.set(x, y + 2, z);
    this.flash.intensity = 90;
    this.flashLife = 0.35;
  }

  muzzle(x, y, z, heading) {
    const fx = x + Math.sin(heading) * 0.8;
    const fz = z + Math.cos(heading) * 0.8;
    this._spawn(fx, y, fz, {
      color: 0xffe27a, life: 0.07, size: 0.9, opacity: 1, fade: true,
    });
    this.flash.position.set(fx, y, fz);
    this.flash.intensity = Math.max(this.flash.intensity, 12);
    this.flashLife = Math.max(this.flashLife, 0.06);
  }

  update(dt, camera) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.1 && p.gravity < 0) {
        p.mesh.position.y = 0.1;
        p.vy *= -0.3;
      }
      const k = p.life / p.maxLife;
      if (p.fade) p.mesh.material.opacity = 0.95 * k;
      if (p.grow) p.mesh.scale.setScalar(p.size + p.grow * (1 - k));
      p.mesh.lookAt(camera.position);
    }
    if (this.flashLife > 0) {
      this.flashLife -= dt;
      if (this.flashLife <= 0) this.flash.intensity = 0;
    }
  }
}
