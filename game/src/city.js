// Palmera Heat — the city itself.
// Palmera City is a seeded procedural grid: a canvas-painted ground plan
// (roads, sidewalks, crosswalks, beach, ocean), instanced buildings with a
// shared window texture, palm avenues, and hand-placed landmarks — the
// Meridian Casino tower, Theo's garage, the marina, the lighthouse. This
// module also owns collision: every solid structure registers an AABB.

import * as THREE from 'three';
import { CITY, BLOCK_CENTERS, LANDMARKS, LANDMARK_BLOCKS, PALETTE } from './config.js';

const WORLD_W = CITY.groundMaxX - CITY.groundMinX;
const WORLD_D = CITY.groundMaxZ - CITY.groundMinZ;

function px(x) {
  return ((x - CITY.groundMinX) / WORLD_W) * 2048;
}
function pz(z) {
  return ((z - CITY.groundMinZ) / WORLD_D) * 1536;
}
function pw(w) {
  return (w / WORLD_W) * 2048;
}
function pd(d) {
  return (d / WORLD_D) * 1536;
}

// --- Ground plan -----------------------------------------------------------

function paintGround(ctx, rng) {
  // Base: dry grass.
  ctx.fillStyle = '#8fae62';
  ctx.fillRect(0, 0, 2048, 1536);
  // Mow the lawn with subtle patches.
  for (let i = 0; i < 900; i++) {
    const x = rng.range(0, 2048);
    const y = rng.range(0, 1536);
    const r = rng.range(6, 30);
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(120,160,80,0.25)' : 'rgba(170,190,110,0.22)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ocean: deep gradient to the east, foam where it meets the sand.
  const ocean = ctx.createLinearGradient(px(CITY.oceanX), 0, 2048, 0);
  ocean.addColorStop(0, '#3fb3d9');
  ocean.addColorStop(0.25, '#2f9bc4');
  ocean.addColorStop(1, '#155a8a');
  ctx.fillStyle = ocean;
  ctx.fillRect(px(CITY.oceanX), 0, 2048 - px(CITY.oceanX), 1536);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let y = 0; y < 1536; y += 14) {
    const wobble = Math.sin(y * 0.02) * 6 + rng.range(-4, 4);
    ctx.fillRect(px(CITY.oceanX) + wobble, y, rng.range(4, 12), 7);
  }

  // Sand: the whole beach strip.
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(px(CITY.beachX), 0, px(CITY.oceanX) - px(CITY.beachX), 1536);
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(200,170,100,0.3)' : 'rgba(255,240,190,0.35)';
    const x = rng.range(px(CITY.beachX), px(CITY.oceanX));
    const y = rng.range(0, 1536);
    ctx.fillRect(x, y, rng.range(2, 5), rng.range(2, 5));
  }

  // Boardwalk planks along the beach road.
  ctx.fillStyle = '#c9a06b';
  ctx.fillRect(px(CITY.beachX), 0, pw(8), 1536);
  ctx.strokeStyle = 'rgba(120,80,40,0.35)';
  ctx.lineWidth = 1;
  for (let y = 0; y < 1536; y += 10) {
    ctx.beginPath();
    ctx.moveTo(px(CITY.beachX), y);
    ctx.lineTo(px(CITY.beachX) + pw(8), y);
    ctx.stroke();
  }

  // City blocks: warm concrete pads.
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      ctx.fillStyle = '#cfc3a8';
      ctx.fillRect(px(bx - 25), pz(bz - 25), pw(50), pd(50));
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(px(bx - 25), pz(bz - 25), pw(50), pd(4));
    }
  }

  // Coral Gardens park block: lawn, pond, paths.
  const park = LANDMARKS.park;
  ctx.fillStyle = '#5d9b4a';
  ctx.fillRect(px(park.x - 25), pz(park.z - 25), pw(50), pd(50));
  ctx.fillStyle = '#4a90c2';
  ctx.beginPath();
  ctx.ellipse(px(park.x + 8), pz(park.z - 6), pw(9), pd(7), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8dcc0';
  ctx.lineWidth = pw(2.5);
  ctx.beginPath();
  ctx.moveTo(px(park.x - 25), pz(park.z));
  ctx.lineTo(px(park.x + 25), pz(park.z));
  ctx.moveTo(px(park.x), pz(park.z - 25));
  ctx.lineTo(px(park.x), pz(park.z + 25));
  ctx.stroke();

  // Meridian Plaza: tiled square in front of the casino.
  const plaza = LANDMARKS.plaza;
  ctx.fillStyle = '#d8cdb4';
  ctx.fillRect(px(plaza.x - 25), pz(plaza.z - 25), pw(50), pd(50));
  ctx.strokeStyle = 'rgba(120,100,70,0.4)';
  ctx.lineWidth = 1;
  for (let i = -20; i <= 20; i += 8) {
    ctx.beginPath();
    ctx.moveTo(px(plaza.x + i), pz(plaza.z - 25));
    ctx.lineTo(px(plaza.x + i), pz(plaza.z + 25));
    ctx.moveTo(px(plaza.x - 25), pz(plaza.z + i));
    ctx.lineTo(px(plaza.x + 25), pz(plaza.z + i));
    ctx.stroke();
  }
  ctx.fillStyle = '#2f9bc4';
  ctx.beginPath();
  ctx.arc(px(plaza.x), pz(plaza.z), pw(6), 0, Math.PI * 2);
  ctx.fill();

  // Roads: sidewalk bed first, asphalt on top, then markings.
  const allRoadX = [...CITY.roads, CITY.beachRoadX];
  for (const rx of allRoadX) {
    ctx.fillStyle = '#d9cfb8';
    ctx.fillRect(px(rx - 12), 0, pw(24), 1536);
    ctx.fillStyle = '#3d4148';
    ctx.fillRect(px(rx - 7), 0, pw(14), 1536);
  }
  for (const rz of CITY.roads) {
    ctx.fillStyle = '#d9cfb8';
    ctx.fillRect(0, pz(rz - 12), px(CITY.beachX), pd(24));
    ctx.fillStyle = '#3d4148';
    ctx.fillRect(0, pz(rz - 7), px(CITY.beachX), pd(14));
  }

  // Lane dashes.
  ctx.strokeStyle = 'rgba(240,230,180,0.85)';
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 20]);
  for (const rx of allRoadX) {
    ctx.beginPath();
    ctx.moveTo(px(rx), 0);
    ctx.lineTo(px(rx), 1536);
    ctx.stroke();
  }
  for (const rz of CITY.roads) {
    ctx.beginPath();
    ctx.moveTo(0, pz(rz));
    ctx.lineTo(px(CITY.beachX), pz(rz));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const rx of CITY.roads) {
    for (const rz of CITY.roads) {
      for (let s = -3; s <= 3; s++) {
        ctx.fillRect(px(rx + s * 2 - 0.8), pz(rz - 10), pw(1.6), pd(3.4));
        ctx.fillRect(px(rx + s * 2 - 0.8), pz(rz + 6.6), pw(1.6), pd(3.4));
        ctx.fillRect(px(rx - 10), pz(rz + s * 2 - 0.8), pw(3.4), pd(1.6));
        ctx.fillRect(px(rx + 6.6), pz(rz + s * 2 - 0.8), pw(3.4), pd(1.6));
      }
    }
  }

  // Parking lots: the garage forecourt and the casino lot.
  const lot = (cx, cz, w, d) => {
    ctx.fillStyle = '#565b63';
    ctx.fillRect(px(cx - w / 2), pz(cz - d / 2), pw(w), pd(d));
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    for (let i = -w / 2 + 3; i < w / 2; i += 4.5) {
      ctx.beginPath();
      ctx.moveTo(px(cx + i), pz(cz - d / 2 + 1));
      ctx.lineTo(px(cx + i), pz(cz + d / 2 - 1));
      ctx.stroke();
    }
  };
  lot(LANDMARKS.garage.x + 14, LANDMARKS.garage.z, 20, 30);
  // The casino's parking lot gets its own block across the street, so no
  // parked car ever sits on a road.
  lot(160, -96, 44, 40);
}

// --- Textures ---------------------------------------------------------------

function makeWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4efe4';
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 20) {
    for (let x = 8; x < 120; x += 16) {
      const lit = Math.random() < 0.22;
      ctx.fillStyle = lit ? '#ffd98a' : '#33506b';
      ctx.fillRect(x, y, 10, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, y, 10, 3);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSignTexture(text, { bg = '#1d2b36', fg = '#ffd76a', font = 64 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 112);
  ctx.fillStyle = fg;
  ctx.font = `bold ${font}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// --- Collision --------------------------------------------------------------

/** Push a circle (x, z, radius) out of every AABB it overlaps. Mutates pos. */
export function resolveCircle(pos, radius, colliders) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = radius - d;
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push;
      } else {
        // Centre inside the box: shove out along the smallest penetration.
        const pl = pos.x - c.minX;
        const pr = c.maxX - pos.x;
        const pt = pos.z - c.minZ;
        const pb = c.maxZ - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.minX - radius;
        else if (m === pr) pos.x = c.maxX + radius;
        else if (m === pt) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
  }
}

export function circleHits(pos, radius, colliders) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

// --- City builder -----------------------------------------------------------

export class City {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = [];
    this.animated = [];
    this.buildingCount = 0;
    this.palmCount = 0;
    this._buildGround();
    this._buildBuildings();
    this._buildPalmsAndTrees();
    this._buildStreetlights();
    this._buildLandmarks();
    this._buildClouds();
    this._buildBounds();
  }

  _buildGround() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1536;
    paintGround(canvas.getContext('2d'), this.rng.fork());
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_W, WORLD_D),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((CITY.groundMinX + CITY.groundMaxX) / 2, 0, 0);
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  _addCollider(minX, maxX, minZ, maxZ) {
    this.colliders.push({ minX, maxX, minZ, maxZ });
  }

  _buildBuildings() {
    const rng = this.rng.fork();
    const windowTex = makeWindowTexture();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshLambertMaterial({ map: windowTex });
    const placements = [];
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (const bx of BLOCK_CENTERS) {
      for (const bz of BLOCK_CENTERS) {
        if (LANDMARK_BLOCKS.has(`${bx},${bz}`)) continue;
        const distCenter = Math.hypot(bx, bz);
        const downtown = distCenter < 190;
        const lots = rng.chance(0.55) ? 1 : rng.chance(0.7) ? 2 : 4;
        const slots = [];
        if (lots === 1) slots.push({ x: bx, z: bz, w: 42, d: 42 });
        else if (lots === 2) {
          slots.push({ x: bx - 11, z: bz, w: 20, d: 42 });
          slots.push({ x: bx + 11, z: bz, w: 20, d: 42 });
        } else {
          slots.push({ x: bx - 11, z: bz - 11, w: 20, d: 20 });
          slots.push({ x: bx + 11, z: bz - 11, w: 20, d: 20 });
          slots.push({ x: bx - 11, z: bz + 11, w: 20, d: 20 });
          slots.push({ x: bx + 11, z: bz + 11, w: 20, d: 20 });
        }
        for (const s of slots) {
          const h = downtown
            ? rng.range(22, 62) * (1 - distCenter / 700)
            : rng.range(7, 22);
          const palette = downtown && h > 34 ? PALETTE.downtown : PALETTE.building;
          placements.push({ ...s, h, color: rng.pick(palette) });
          this._addCollider(s.x - s.w / 2, s.x + s.w / 2, s.z - s.d / 2, s.z + s.d / 2);
        }
      }
    }

    const mesh = new THREE.InstancedMesh(geo, mat, placements.length);
    placements.forEach((p, i) => {
      dummy.position.set(p.x, 0, p.z);
      dummy.scale.set(p.w, p.h, p.d);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.setHex(p.color));
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    this.buildingCount = placements.length;

    // Rooftop antennas on the tallest towers.
    const antGeo = new THREE.CylinderGeometry(0.12, 0.12, 8, 5);
    const antMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const tall = placements.filter((p) => p.h > 40);
    const ants = new THREE.InstancedMesh(antGeo, antMat, tall.length);
    tall.forEach((p, i) => {
      dummy.position.set(p.x + p.w * 0.25, p.h + 4, p.z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      ants.setMatrixAt(i, dummy.matrix);
    });
    ants.instanceMatrix.needsUpdate = true;
    this.scene.add(ants);
  }

  _buildPalmsAndTrees() {
    const rng = this.rng.fork();
    const dummy = new THREE.Object3D();
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 5.5, 6);
    trunkGeo.translate(0, 2.75, 0);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });

    // Frond: a bent plane, bright green, double sided.
    const frondGeo = new THREE.PlaneGeometry(0.9, 3.4, 1, 4);
    frondGeo.translate(0, 1.7, 0);
    const posAttr = frondGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      posAttr.setZ(i, -((y / 3.4) ** 2) * 1.1);
    }
    frondGeo.computeVertexNormals();
    const frondMat = new THREE.MeshLambertMaterial({ color: 0x2e8b4a, side: THREE.DoubleSide });

    const spots = [];
    // Beach avenue palms, both sides of the beach road.
    for (let z = -320; z <= 320; z += 16) {
      spots.push({ x: 341, z: z + rng.range(-1, 1) });
      if (rng.chance(0.8)) spots.push({ x: 363, z: z + 8 + rng.range(-1, 1) });
    }
    // Palms along the central avenue (x = 0) and the plaza road.
    for (let z = -288; z <= 288; z += 32) {
      spots.push({ x: -10, z });
      spots.push({ x: 10, z: z + 16 });
    }
    for (let x = -288; x <= 288; x += 32) {
      spots.push({ x, z: -10 });
    }

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    const fronds = new THREE.InstancedMesh(frondGeo, frondMat, spots.length * 6);
    let fi = 0;
    spots.forEach((s, i) => {
      const lean = rng.range(-0.12, 0.12);
      dummy.position.set(s.x, 0, s.z);
      dummy.scale.set(1, rng.range(0.85, 1.3), 1);
      dummy.rotation.set(lean, rng.range(0, Math.PI * 2), lean * 0.7);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      const topY = 5.5 * dummy.scale.y;
      for (let f = 0; f < 6; f++) {
        dummy.position.set(s.x, topY, s.z);
        dummy.rotation.set(-0.9 - rng.range(0, 0.35), (f / 6) * Math.PI * 2 + rng.range(0, 0.4), 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        fronds.setMatrixAt(fi++, dummy.matrix);
      }
    });
    trunks.castShadow = true;
    fronds.castShadow = false;
    trunks.instanceMatrix.needsUpdate = true;
    fronds.instanceMatrix.needsUpdate = true;
    this.scene.add(trunks);
    this.scene.add(fronds);
    this.palmCount = spots.length;

    // Round trees in Coral Gardens.
    const treeTrunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 3, 6);
    treeTrunkGeo.translate(0, 1.5, 0);
    const canopyGeo = new THREE.IcosahedronGeometry(2.6, 0);
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x3f8f3a });
    const park = LANDMARKS.park;
    const treeSpots = [];
    for (let i = 0; i < 26; i++) {
      treeSpots.push({
        x: park.x + rng.range(-22, 22),
        z: park.z + rng.range(-22, 22),
        s: rng.range(0.7, 1.4),
      });
    }
    const treeTrunks = new THREE.InstancedMesh(treeTrunkGeo, trunkMat, treeSpots.length);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeSpots.length);
    treeSpots.forEach((t, i) => {
      dummy.position.set(t.x, 0, t.z);
      dummy.scale.set(t.s, t.s, t.s);
      dummy.rotation.set(0, rng.range(0, Math.PI * 2), 0);
      dummy.updateMatrix();
      treeTrunks.setMatrixAt(i, dummy.matrix);
      dummy.position.set(t.x, 3.4 * t.s, t.z);
      dummy.scale.set(t.s, t.s * 0.8, t.s);
      dummy.updateMatrix();
      canopies.setMatrixAt(i, dummy.matrix);
      this._addCollider(t.x - 0.6, t.x + 0.6, t.z - 0.6, t.z + 0.6);
    });
    treeTrunks.castShadow = true;
    canopies.castShadow = true;
    treeTrunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    this.scene.add(treeTrunks);
    this.scene.add(canopies);
  }

  _buildStreetlights() {
    const dummy = new THREE.Object3D();
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 5);
    poleGeo.translate(0, 3.5, 0);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
    const headGeo = new THREE.BoxGeometry(1.6, 0.25, 0.4);
    const headMat = new THREE.MeshLambertMaterial({ color: 0x555b62 });
    const spots = [];
    for (const rx of CITY.roads) {
      for (const rz of CITY.roads) {
        if ((rx + rz) % 128 !== 0) continue;
        spots.push({ x: rx + 9, z: rz + 9 });
        spots.push({ x: rx - 9, z: rz - 9 });
      }
    }
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);
    const heads = new THREE.InstancedMesh(headGeo, headMat, spots.length);
    spots.forEach((s, i) => {
      dummy.position.set(s.x, 0, s.z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);
      dummy.position.set(s.x, 7, s.z);
      dummy.rotation.set(0, Math.PI / 4, 0);
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
    });
    poles.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    this.scene.add(poles);
    this.scene.add(heads);
  }

  _sign(text, w, h, opts) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: makeSignTexture(text, opts), side: THREE.DoubleSide }),
    );
    return mesh;
  }

  _box(w, h, d, color, x, z, y = 0) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color }),
    );
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  _buildLandmarks() {
    // Meridian Casino: glass tower with a gold crown and a glowing sign.
    const c = LANDMARKS.casino;
    const tower = this._box(26, 78, 26, PALETTE.casinoGlass, c.x, c.z);
    tower.material = new THREE.MeshLambertMaterial({ color: PALETTE.casinoGlass });
    this._box(30, 4, 30, PALETTE.casinoGold, c.x, c.z, 78);
    // Low podium, light enough that the street view reads as a tower, not a wall.
    this._box(30, 4, 30, 0x3a6a8a, c.x, c.z, 0);
    this._box(31, 0.8, 31, PALETTE.casinoGold, c.x, c.z, 4);
    const sign = this._sign('MERIDIAN', 30, 7.5);
    sign.position.set(c.x, 58, c.z + 13.2);
    this.scene.add(sign);
    const sign2 = this._sign('MERIDIAN', 30, 7.5);
    sign2.position.set(c.x, 58, c.z - 13.2);
    sign2.rotation.y = Math.PI;
    this.scene.add(sign2);
    // Gold trim stripes up the tower.
    for (const sx of [-8, 0, 8]) {
      this._box(1.2, 78, 0.6, PALETTE.casinoGold, c.x + sx, c.z + 13.1, 0);
    }
    this._addCollider(c.x - 17, c.x + 17, c.z - 17, c.z + 17);

    // Theo's Garage: low workshop with a forecourt.
    const g = LANDMARKS.garage;
    this._box(24, 7, 16, 0xd96a4a, g.x - 8, g.z);
    this._box(24, 1, 18, 0x8a4a30, g.x - 8, g.z, 7);
    const gsign = this._sign("THEO'S GARAGE", 22, 5.5, { bg: '#232a30', fg: '#7fe0a8', font: 44 });
    gsign.position.set(g.x - 8, 5.2, g.z + 8.2);
    this.scene.add(gsign);
    this._addCollider(g.x - 20, g.x + 4, g.z - 8, g.z + 8);

    // Lena's apartment block.
    const a = LANDMARKS.apartment;
    this._box(22, 26, 20, 0xe8b4a0, a.x, a.z);
    this._box(22, 2, 20, 0xc96f5a, a.x, a.z, 26);
    this._addCollider(a.x - 11, a.x + 11, a.z - 10, a.z + 10);

    // Mara's safehouse: a warm two-storey house with a terrace.
    const s = LANDMARKS.safehouse;
    this._box(14, 8, 12, 0xf2e3c9, s.x, s.z);
    this._box(15, 1.5, 13, 0xc96f5a, s.x, s.z, 8);
    this._box(6, 5, 4, 0x9fc8c0, s.x + 9, s.z + 2);
    this._addCollider(s.x - 7, s.x + 7, s.z - 6, s.z + 6);

    // Palmera Bowl stadium: a wide drum with a coloured band.
    const st = LANDMARKS.stadium;
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(24, 24, 12, 24),
      new THREE.MeshLambertMaterial({ color: 0xe8e2d4 }),
    );
    drum.position.set(st.x, 6, st.z);
    drum.castShadow = true;
    drum.receiveShadow = true;
    this.scene.add(drum);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(24.4, 24.4, 2.4, 24),
      new THREE.MeshLambertMaterial({ color: 0x2e6fc2 }),
    );
    band.position.set(st.x, 10, st.z);
    this.scene.add(band);
    this._addCollider(st.x - 22, st.x + 22, st.z - 22, st.z + 22);

    // Palmera PD: blue-grey station with a sign.
    const p = LANDMARKS.policeStation;
    this._box(26, 10, 20, 0x7a8ba0, p.x, p.z);
    const psign = this._sign('PALMERA PD', 20, 5, { bg: '#1d3a5f', fg: '#ffffff', font: 48 });
    psign.position.set(p.x, 7.5, p.z + 10.2);
    this.scene.add(psign);
    this._addCollider(p.x - 13, p.x + 13, p.z - 10, p.z + 10);

    // St. Selma Hospital: white block, red cross.
    const h = LANDMARKS.hospital;
    this._box(24, 16, 20, 0xf5f5f0, h.x, h.z);
    this._box(6, 2, 0.6, 0xc23b2e, h.x, h.z + 10.2, 10);
    this._box(2, 6, 0.6, 0xc23b2e, h.x, h.z + 10.2, 8);
    this._addCollider(h.x - 12, h.x + 12, h.z - 10, h.z + 10);

    // North Point lighthouse: striped tower on the sand.
    const l = LANDMARKS.lighthouse;
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(2.6 - i * 0.25, 2.9 - i * 0.25, 4, 12),
        new THREE.MeshLambertMaterial({ color: i % 2 === 0 ? 0xf5f0e6 : 0xc23b2e }),
      );
      seg.position.set(l.x, 2 + i * 4, l.z);
      seg.castShadow = true;
      this.scene.add(seg);
    }
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
    );
    lamp.position.set(l.x, 21.5, l.z);
    this.scene.add(lamp);
    this.animated.push({ mesh: lamp, kind: 'pulse' });
    this._addCollider(l.x - 3, l.x + 3, l.z - 3, l.z + 3);

    // Sunset Marina: wooden docks and bobbing boats.
    const m = LANDMARKS.marina;
    this._box(30, 0.6, 4, 0x8a6a44, m.x + 18, m.z, 0.4);
    this._box(4, 0.6, 20, 0x8a6a44, m.x + 30, m.z + 8, 0.4);
    const hullMat = new THREE.MeshLambertMaterial({ color: 0xf5f0e6 });
    const cabinMat = new THREE.MeshLambertMaterial({ color: 0x2e6fc2 });
    const boatColors = [0x2e6fc2, 0xc23b2e, 0x3aa655, 0xe8c33c];
    boatColors.forEach((col, i) => {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 9), hullMat);
      hull.position.y = 0.6;
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 1.6, 3.4),
        new THREE.MeshLambertMaterial({ color: col }),
      );
      cabin.position.set(0, 2, -1);
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 7, 5),
        cabinMat,
      );
      mast.position.set(0, 4.5, 1.5);
      boat.add(hull, cabin, mast);
      boat.position.set(m.x + 20 + i * 7, 0, m.z - 8 + (i % 2) * 16);
      boat.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.3;
      this.scene.add(boat);
      this.animated.push({ mesh: boat, kind: 'bob', phase: i * 1.3, baseY: 0 });
    });
    this._addCollider(m.x + 2, m.x + 34, m.z - 2, m.z + 2);
  }

  _buildClouds() {
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
    const rng = this.rng.fork();
    for (let i = 0; i < 14; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(rng.range(0, 3));
      for (let j = 0; j < puffs; j++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(5, 11), 10, 8), cloudMat);
        puff.position.set(j * rng.range(6, 10) - puffs * 4, rng.range(-1.5, 1.5), rng.range(-3, 3));
        puff.scale.y = 0.45;
        cloud.add(puff);
      }
      cloud.position.set(
        rng.range(CITY.groundMinX, CITY.groundMaxX),
        rng.range(70, 110),
        rng.range(CITY.groundMinZ, CITY.groundMaxZ),
      );
      this.scene.add(cloud);
      this.animated.push({ mesh: cloud, kind: 'drift', speed: rng.range(0.6, 1.4) });
    }
  }

  _buildBounds() {
    // Invisible walls at the map edges, and the ocean line: nobody swims.
    const B = 420;
    this._addCollider(-B - 20, -B, -B, B);
    this._addCollider(B, B + 20, -B, B);
    this._addCollider(-B, B, -B - 20, -B);
    this._addCollider(-B, B, B, B + 20);
    this._addCollider(CITY.oceanX - 2, CITY.oceanX + 40, -B, B);
  }

  /** Gentle life: bobbing boats, drifting clouds, the lighthouse lamp. */
  update(dt, time) {
    for (const a of this.animated) {
      if (a.kind === 'bob') {
        a.mesh.position.y = a.baseY + Math.sin(time * 0.9 + a.phase) * 0.25;
        a.mesh.rotation.z = Math.sin(time * 0.7 + a.phase) * 0.03;
      } else if (a.kind === 'drift') {
        a.mesh.position.x += a.speed * dt;
        if (a.mesh.position.x > CITY.groundMaxX + 60) a.mesh.position.x = CITY.groundMinX - 60;
      } else if (a.kind === 'pulse') {
        const s = 1 + Math.sin(time * 2.4) * 0.12;
        a.mesh.scale.set(s, s, s);
      }
    }
  }

  // --- Spawning helpers -----------------------------------------------------

  /** A random point on a random road lane. */
  randomRoadPoint(rng, near, minDist = 0, maxDist = 400) {
    for (let tries = 0; tries < 24; tries++) {
      const alongX = rng.chance(0.5);
      const road = rng.pick(CITY.roads);
      const t = rng.range(-CITY.half, CITY.half);
      const lane = rng.chance(0.5) ? -3.5 : 3.5;
      const p = alongX ? { x: t, z: road + lane } : { x: road + lane, z: t };
      if (near) {
        const d = Math.hypot(p.x - near.x, p.z - near.z);
        if (d < minDist || d > maxDist) continue;
      }
      return p;
    }
    return { x: 0, z: -60 };
  }

  /** The nearest road coordinate to a position, on the given axis. */
  nearestRoad(value) {
    let best = CITY.roads[0];
    let bestD = Infinity;
    for (const r of CITY.roads) {
      const d = Math.abs(r - value);
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
    return best;
  }
}
