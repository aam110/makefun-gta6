// SOLMAR BAY — the city itself: road grid, buildings, beach, pier, harbor,
// palms, streetlights, distant hills, and the day/night sun cycle.
// Also owns collision: every building registers an axis-aligned footprint,
// and collideCircle() pushes circles (people, cars) out of them.

import * as THREE from 'three';
import {
  BEACH_Z, CITY_HALF, PALETTE, ROAD_COORDS, ROAD_HALF, WATER_Z, TAU,
  clamp, lerp, pick, rand, randInt,
} from './config.js';

// ---- Canvas textures (generated once, no files, no network) ----

function windowTexture(baseColor, litRatio) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 128, 256);
  // subtle vertical shading
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.18)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 22) {
    for (let x = 10; x < 118; x += 20) {
      const lit = Math.random() < litRatio;
      g.fillStyle = lit ? (Math.random() < 0.7 ? '#ffd98a' : '#bfe6ff') : '#1c2433';
      g.fillRect(x, y, 12, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2b2f38';
  g.fillRect(0, 0, 64, 256);
  // asphalt speckle
  for (let i = 0; i < 500; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.18)';
    g.fillRect(Math.random() * 64, Math.random() * 256, 2, 2);
  }
  // edge lines
  g.fillStyle = '#e8e8e8';
  g.fillRect(2, 0, 2, 256);
  g.fillRect(60, 0, 2, 256);
  // dashed centre line
  g.fillStyle = '#ffd23e';
  for (let y = 0; y < 256; y += 42) g.fillRect(30, y, 4, 24);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function boardwalkTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#9a6b45';
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) {
    g.fillStyle = y % 32 === 0 ? '#8a5f3c' : '#a5764f';
    g.fillRect(0, y, 128, 14);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, y + 14, 128, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---- City construction ----

export function buildWorld(G) {
  const scene = G.scene;
  const W = {
    colliders: [],       // {minX, maxX, minZ, maxZ}
    lamps: [],           // lamp head materials (glow at night)
    water: null,
    sun: null, hemi: null,
    skyColors: null,
  };
  G.world = W;

  const roadTex = roadTexture();
  const bwTex = boardwalkTexture();
  const facadeMats = [];
  const facadeBases = ['#d8d3c8', '#c9b8a3', '#a8b6c4', '#8fa3b8', '#b8a88f', '#9fb0a0'];
  for (const base of facadeBases) {
    facadeMats.push(new THREE.MeshLambertMaterial({ map: windowTexture(base, 0.45) }));
  }
  const downtownMats = [];
  for (const base of ['#5b6b82', '#7486a0', '#4a5a70', '#8fa0b5', '#64748f']) {
    downtownMats.push(new THREE.MeshLambertMaterial({ map: windowTexture(base, 0.55) }));
  }

  // Ground (grass/concrete base under everything)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 120, CITY_HALF * 2 + 220),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  ground.receiveShadow = true;
  scene.add(ground);

  // Sidewalk slabs under each road, then asphalt on top
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const asphaltMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const roadLen = CITY_HALF * 2 + 40;
  for (const c of ROAD_COORDS) {
    const swNS = new THREE.Mesh(new THREE.PlaneGeometry(19, roadLen), sidewalkMat);
    swNS.rotation.x = -Math.PI / 2;
    swNS.position.set(c, 0.0, 0);
    scene.add(swNS);
    const swEW = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, 19), sidewalkMat);
    swEW.rotation.x = -Math.PI / 2;
    swEW.position.set(0, 0.0, c);
    scene.add(swEW);
    const rNS = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, roadLen), asphaltMat.clone());
    rNS.material.map = roadTex.clone();
    rNS.material.map.repeat.set(1, roadLen / 24);
    rNS.material.map.needsUpdate = true;
    rNS.rotation.x = -Math.PI / 2;
    rNS.position.set(c, 0.06, 0);
    rNS.receiveShadow = true;
    scene.add(rNS);
    const rEW = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, ROAD_HALF * 2), asphaltMat.clone());
    rEW.material.map = roadTex.clone();
    // NOTE: three.js applies repeat BEFORE rotation in the UV transform, so
    // the long repeat stays on V (the texture's dash direction) and the
    // rotation turns it onto the road's length. repeat.set(len, 1) here
    // would tile the dashes across the width instead.
    rEW.material.map.repeat.set(1, roadLen / 24);
    rEW.material.map.rotation = Math.PI / 2;
    rEW.material.map.center.set(0.5, 0.5);
    rEW.material.map.needsUpdate = true;
    rEW.rotation.x = -Math.PI / 2;
    rEW.position.set(0, 0.06, c);
    rEW.receiveShadow = true;
    scene.add(rEW);
  }

  // Buildings: one or two per block between roads
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4f58 });
  const blocks = [];
  for (let i = 0; i < ROAD_COORDS.length - 1; i++) {
    for (let j = 0; j < ROAD_COORDS.length - 1; j++) {
      const x0 = ROAD_COORDS[i] + 11;
      const x1 = ROAD_COORDS[i + 1] - 11;
      const z0 = ROAD_COORDS[j] + 11;
      const z1 = ROAD_COORDS[j + 1] - 11;
      blocks.push({ x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 });
    }
  }
  for (const b of blocks) {
    // leave the beach strip and the central plaza open
    if (b.cz > 150) continue;
    if (Math.abs(b.cx) < 22 && Math.abs(b.cz) < 22) continue; // Solmar Plaza
    const downtown = Math.abs(b.cx) <= 80 && Math.abs(b.cz) <= 80;
    const harbor = b.cx >= 120;
    const count = downtown || harbor ? 1 : (Math.random() < 0.55 ? 2 : 1);
    for (let k = 0; k < count; k++) {
      const w = count === 1 ? (b.x1 - b.x0) * rand(0.7, 0.95) : (b.x1 - b.x0) * rand(0.38, 0.46);
      const d = count === 1 ? (b.z1 - b.z0) * rand(0.7, 0.95) : (b.z1 - b.z0) * rand(0.7, 0.9);
      const x = count === 1 ? b.cx : b.cx + (k === 0 ? -1 : 1) * (b.x1 - b.x0) * 0.25;
      const z = b.cz + rand(-1.5, 1.5);
      let h;
      if (downtown) h = rand(22, 58);
      else if (harbor) h = rand(6, 12);
      else h = rand(7, 18);
      const mat = downtown ? pick(downtownMats) : pick(facadeMats);
      const m = new THREE.Mesh(boxGeo, mat);
      m.scale.set(w, h, d);
      m.position.set(x, h / 2, z);
      m.castShadow = h > 20;
      scene.add(m);
      // rooftop box (AC unit / water tank) for silhouette
      if (h > 14) {
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(rand(2, 5), rand(1.2, 2.5), rand(2, 5));
        roof.position.set(x + rand(-w / 4, w / 4), h + roof.scale.y / 2, z + rand(-d / 4, d / 4));
        scene.add(roof);
      }
      // neon sign strip on some downtown towers
      if (downtown && Math.random() < 0.4) {
        const neon = new THREE.Mesh(
          new THREE.BoxGeometry(Math.min(w * 0.7, 12), 1.1, 0.4),
          new THREE.MeshBasicMaterial({ color: pick([0xff5e3a, 0x18e0d0, 0xffd23e, 0xff4fd8]) }),
        );
        neon.position.set(x, h * rand(0.55, 0.85), z + d / 2 + 0.25);
        scene.add(neon);
      }
      W.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    }
  }

  // Solmar Plaza: a roundabout ring with a fountain at the centre of downtown.
  // Radius 8 keeps it inside the intersection so it reads as a roundabout,
  // not a disc floating over the roads.
  const plazaBase = new THREE.Mesh(
    new THREE.CylinderGeometry(8, 8, 0.4, 24),
    new THREE.MeshLambertMaterial({ color: 0xb9b3a4 }),
  );
  plazaBase.position.set(0, 0.2, 0);
  scene.add(plazaBase);
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(4.5, 5, 1.2, 20),
    new THREE.MeshLambertMaterial({ color: 0x7fb2d9 }),
  );
  fountain.position.set(0, 0.9, 0);
  scene.add(fountain);
  const fountainTop = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 2.4, 12),
    new THREE.MeshLambertMaterial({ color: 0xd8d3c8 }),
  );
  fountainTop.position.set(0, 2, 0);
  scene.add(fountainTop);
  W.colliders.push({ minX: -5, maxX: 5, minZ: -5, maxZ: 5 });

  // Beach: sand, sea, boardwalk, pier, palms
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 120, 60),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, BEACH_Z + 22);
  scene.add(sand);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 400, 260),
    new THREE.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.05, WATER_Z + 120);
  scene.add(water);
  W.water = water;

  const bw = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2, 10), new THREE.MeshLambertMaterial({ map: bwTex }));
  bw.material.map.repeat.set(30, 1);
  bw.rotation.x = -Math.PI / 2;
  bw.position.set(0, 0.08, BEACH_Z - 4);
  scene.add(bw);

  // Pier at x = 0, reaching into the sea
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a5f3c });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(8, 0.8, 70), pierMat);
  pier.position.set(0, 1.2, WATER_Z + 28);
  scene.add(pier);
  for (let z = WATER_Z + 2; z < WATER_Z + 62; z += 8) {
    for (const dx of [-3.4, 3.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.4, 6), pierMat);
      post.position.set(dx, 0.4, z);
      scene.add(post);
    }
  }
  // Ferris wheel silhouette at the pier end (pure decoration, slowly turns)
  const wheel = new THREE.Group();
  const rimMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(9, 0.35, 6, 24), rimMat);
  wheel.add(rim);
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.3, 18, 0.3), rimMat);
    spoke.rotation.z = (i / 6) * Math.PI;
    wheel.add(spoke);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6),
      new THREE.MeshLambertMaterial({ color: pick(PALETTE.car) }));
    cab.position.set(Math.cos(a) * 9, Math.sin(a) * 9, 0);
    wheel.add(cab);
  }
  wheel.position.set(14, 13, WATER_Z + 52);
  scene.add(wheel);
  W.ferris = wheel;
  const wheelLegA = new THREE.Mesh(new THREE.BoxGeometry(0.8, 14, 0.8), pierMat);
  wheelLegA.position.set(14, 6, WATER_Z + 52);
  wheelLegA.rotation.z = 0.25;
  scene.add(wheelLegA);
  const wheelLegB = wheelLegA.clone();
  wheelLegB.rotation.z = -0.25;
  scene.add(wheelLegB);

  // Palms along the boardwalk and beach
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
  function palm(x, z, s = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 5 * s, 6), trunkMat);
    trunk.position.y = 2.5 * s;
    trunk.rotation.z = rand(-0.12, 0.12);
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.9 * s, 3.4 * s, 4), frondMat);
      const a = (i / 6) * TAU;
      frond.position.set(Math.cos(a) * 1.1 * s, 5.2 * s, Math.sin(a) * 1.1 * s);
      frond.rotation.set(Math.sin(a) * 1.1, 0, Math.cos(a) * 1.1 + Math.PI);
      g.add(frond);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
  }
  for (let x = -170; x <= 170; x += 17) {
    if (Math.abs(x) < 8) continue;
    palm(x + rand(-2, 2), BEACH_Z - 11, rand(0.9, 1.25));
    if (Math.random() < 0.6) palm(x + rand(-3, 3), BEACH_Z + 14, rand(0.8, 1.1));
  }
  // (Palms stay at the beach: random downtown palms kept landing in front
  // of the third-person camera on the avenues.)

  // Harbor: container stacks + cranes on the east side
  const containerColors = [0xc23b3b, 0x2e7fd9, 0xf2c230, 0x35b06a, 0xef7d1a];
  for (let i = 0; i < 14; i++) {
    const cx = 140 + rand(-14, 14);
    const cz = -100 + i * 14 + rand(-3, 3);
    const stack = randInt(1, 3);
    for (let s = 0; s < stack; s++) {
      const cont = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: pick(containerColors) }));
      cont.scale.set(10, 2.6, 3);
      cont.position.set(cx, 1.3 + s * 2.7, cz);
      cont.rotation.y = Math.random() < 0.5 ? 0 : Math.PI / 2;
      scene.add(cont);
    }
    W.colliders.push({ minX: cx - 5.5, maxX: cx + 5.5, minZ: cz - 5.5, maxZ: cz + 5.5 });
  }
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xf2c230 });
  for (const cz of [-60, 20, 100]) {
    const leg = new THREE.Mesh(boxGeo, craneMat);
    leg.scale.set(3, 26, 3);
    leg.position.set(168, 13, cz);
    scene.add(leg);
    const arm = new THREE.Mesh(boxGeo, craneMat);
    arm.scale.set(30, 1.6, 1.6);
    arm.position.set(156, 26, cz);
    scene.add(arm);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 10, 4),
      new THREE.MeshBasicMaterial({ color: 0x222222 }));
    cable.position.set(144, 21, cz);
    scene.add(cable);
    W.colliders.push({ minX: 166, maxX: 170, minZ: cz - 2, maxZ: cz + 2 });
  }

  // Streetlights along every road (every other intersection)
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f47 });
  const lampHeadGeo = new THREE.SphereGeometry(0.5, 8, 6);
  for (const c of ROAD_COORDS) {
    for (const d of [-160, -80, 0, 80, 160]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 6), poleMat);
      pole.position.set(c + 8.4, 3.5, d);
      scene.add(pole);
      const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
      const head = new THREE.Mesh(lampHeadGeo, headMat);
      head.position.set(c + 8.4, 7.2, d);
      scene.add(head);
      W.lamps.push(headMat);
    }
  }

  // Distant hills to the north + a sunset sun disc backdrop
  const hillMat = new THREE.MeshLambertMaterial({ color: 0x2c4a3a });
  for (let i = 0; i < 7; i++) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(rand(40, 70), rand(24, 44), 5), hillMat);
    hill.position.set(-260 + i * 85 + rand(-15, 15), 0, -260 + rand(-20, 20));
    scene.add(hill);
  }

  // Lights
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
  sun.position.set(-120, 90, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -120;
  sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 120;
  sun.shadow.camera.bottom = -120;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a2f28, 0.9);
  scene.add(hemi);
  W.sun = sun;
  W.hemi = hemi;

  scene.fog = new THREE.Fog(0x1c2438, 160, 420);
  return W;
}

// ---- Day / sunset / night cycle ----

const SKY_STOPS = [
  { h: 0, sky: 0x0b1026, fog: 0x0b1026, sun: 0x8fa8ff, sunI: 0.25, hemi: 0.25 },
  { h: 6, sky: 0x8fb4d9, fog: 0x8fb4d9, sun: 0xffe0b0, sunI: 1.6, hemi: 0.8 },
  { h: 12, sky: 0x7ec0ee, fog: 0x9ec8e8, sun: 0xfff3d0, sunI: 2.4, hemi: 1.0 },
  { h: 17.5, sky: 0xff9a5c, fog: 0xe88a5c, sun: 0xffb36b, sunI: 2.0, hemi: 0.75 },
  { h: 19.5, sky: 0x4a2d5e, fog: 0x4a2d5e, sun: 0xff7a4d, sunI: 0.9, hemi: 0.45 },
  { h: 21, sky: 0x0b1026, fog: 0x0b1026, sun: 0x8fa8ff, sunI: 0.25, hemi: 0.25 },
  { h: 24, sky: 0x0b1026, fog: 0x0b1026, sun: 0x8fa8ff, sunI: 0.25, hemi: 0.25 },
];
const _cA = new THREE.Color();
const _cB = new THREE.Color();

export function updateDayCycle(G, dt) {
  const W = G.world;
  G.hour = (G.hour + (dt / 60) * 8) % 24; // 1 real minute = 8 game minutes
  const h = G.hour;
  let a = SKY_STOPS[0];
  let b = SKY_STOPS[SKY_STOPS.length - 1];
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    if (h >= SKY_STOPS[i].h && h <= SKY_STOPS[i + 1].h) { a = SKY_STOPS[i]; b = SKY_STOPS[i + 1]; break; }
  }
  const t = clamp((h - a.h) / Math.max(0.001, b.h - a.h), 0, 1);
  _cA.setHex(a.sky); _cB.setHex(b.sky);
  G.scene.background = _cA.clone().lerp(_cB, t);
  _cA.setHex(a.fog); _cB.setHex(b.fog);
  G.scene.fog.color.copy(_cA.lerp(_cB, t));
  _cA.setHex(a.sun); _cB.setHex(b.sun);
  W.sun.color.copy(_cA.lerp(_cB, t));
  W.sun.intensity = lerp(a.sunI, b.sunI, t);
  W.hemi.intensity = lerp(a.hemi, b.hemi, t);
  // sun travels east -> west across the sky
  const sunAngle = ((h - 6) / 12) * Math.PI; // 6h sunrise, 18h sunset
  W.sun.position.set(Math.cos(sunAngle) * 160, Math.max(12, Math.sin(sunAngle) * 140 + 20), 60);
  // lamps glow after dusk
  const night = h >= 19 || h < 5.5;
  for (const m of W.lamps) m.color.setHex(night ? 0xffe9a0 : 0x8a8f98);
  if (W.water) W.water.material.opacity = 0.88 + Math.sin(G.elapsed * 0.6) * 0.04;
  if (W.ferris) W.ferris.rotation.z += dt * 0.12;
}

// ---- Collision ----

// Push a circle (x, z, radius) out of every building footprint + the world edge.
// Mutates pos {x, z}. Returns true if a collision happened.
export function collideCircle(G, pos, radius) {
  let hit = false;
  for (const c of G.world.colliders) {
    const nx = clamp(pos.x, c.minX, c.maxX);
    const nz = clamp(pos.z, c.minZ, c.maxZ);
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // centre inside the box: push out along the smallest penetration axis
        const pl = pos.x - c.minX + radius;
        const pr = c.maxX - pos.x + radius;
        const pt = pos.z - c.minZ + radius;
        const pb = c.maxZ - pos.z + radius;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.minX - radius;
        else if (m === pr) pos.x = c.maxX + radius;
        else if (m === pt) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
      hit = true;
    }
  }
  const lim = CITY_HALF + 8;
  if (pos.x < -lim) { pos.x = -lim; hit = true; }
  if (pos.x > lim) { pos.x = lim; hit = true; }
  if (pos.z < -lim) { pos.z = -lim; hit = true; }
  if (pos.z > WATER_Z + 6) { pos.z = WATER_Z + 6; hit = true; } // don't swim away
  return hit;
}

// A random point on a road, at least minDist from (px, pz).
export function randomRoadPoint(G, px, pz, minDist, maxDist) {
  for (let tries = 0; tries < 24; tries++) {
    const vertical = Math.random() < 0.5;
    const c = pick(ROAD_COORDS);
    const along = rand(-160, 160);
    const x = vertical ? c : along;
    const z = vertical ? along : c;
    const d = Math.hypot(x - px, z - pz);
    if (d >= minDist && d <= maxDist) return { x, z };
  }
  return { x: pick(ROAD_COORDS), z: rand(-120, 120) };
}
