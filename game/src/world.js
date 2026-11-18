// Solmar Bay itself: a 9x9 road grid with four districts — downtown towers,
// the harbor docks, the beach boardwalk and the central plaza — plus the
// day/dusk/night cycle that relights the whole city.
import * as THREE from 'three';
import { CFG, PALETTE, S, clamp, lerp, rand, randInt, pick } from './config.js';

let sun = null;
let hemi = null;
let skyMesh = null;
const buildingMats = [];
const windowTexCache = new Map();

function windowTexture(base, litRatio) {
  const key = base + '|' + litRatio;
  if (windowTexCache.has(key)) return windowTexCache.get(key);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 22) {
    for (let x = 8; x < 120; x += 18) {
      const lit = Math.random() < litRatio;
      g.fillStyle = lit ? '#ffd97a' : '#1d2733';
      if (Math.random() < 0.12) g.fillStyle = '#9fd8e8';
      g.fillRect(x, y, 12, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  windowTexCache.set(key, tex);
  return tex;
}

function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2e3138';
  g.fillRect(0, 0, 128, 128);
  // speckle
  for (let i = 0; i < 500; i++) {
    g.fillStyle = Math.random() < 0.5 ? '#33363d' : '#2a2d33';
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  // Edge lines + centre dashes (dashes run along the canvas X axis, i.e.
  // along the road's length once the texture repeats down the strip).
  g.fillStyle = '#c8c8c8';
  g.fillRect(0, 2, 128, 2);
  g.fillRect(0, 124, 128, 2);
  g.fillStyle = '#e8d44d';
  g.fillRect(0, 62, 44, 4);
  g.fillRect(84, 62, 44, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addCollider(minX, maxX, minZ, maxZ) {
  S.colliders.push({ minX, maxX, minZ, maxZ });
}

function addBuilding(x, z, w, d, h, mat) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  S.scene.add(mesh);
  // rooftop box / AC unit for silhouette variety
  if (h > 18 && Math.random() < 0.7) {
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.3, 2.5, d * 0.3),
      new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.9 }),
    );
    top.position.set(x + rand(-w * 0.2, w * 0.2), h + 1.2, z + rand(-d * 0.2, d * 0.2));
    S.scene.add(top);
  }
  addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  return mesh;
}

function addLamp(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 7, 6),
    new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.7, metalness: 0.4 }),
  );
  pole.position.y = 3.5;
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0x000000 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), headMat);
  head.position.y = 7.1;
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.15, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x2b2f36 }),
  );
  arm.position.set(0.7, 6.9, 0);
  g.add(pole, head, arm);
  g.position.set(x, 0, z);
  S.scene.add(g);
  S.lamps.push(headMat);
}

function addPalm(x, z, scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.28, 6.5, 7),
    new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 }),
  );
  trunk.position.y = 3.25;
  trunk.rotation.z = rand(-0.12, 0.12);
  g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 1, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 4.2, 4), leafMat);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.3, 6.4, Math.sin(a) * 1.3);
    leaf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
    leaf.scale.set(1, 1, 0.25);
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  S.scene.add(g);
}

function addTree(x, z) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.3, 2.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 }),
  );
  trunk.position.y = 1.1;
  const crown = new THREE.Mesh(
    new THREE.IcosahedronGeometry(rand(1.4, 2.1), 0),
    new THREE.MeshStandardMaterial({ color: pick([0x4c8a3f, 0x5d9c4a, 0x3d7a35]), roughness: 1, flatShading: true }),
  );
  crown.position.y = 3.2;
  crown.castShadow = true;
  g.add(trunk, crown);
  g.position.set(x, 0, z);
  S.scene.add(g);
}

function buildDowntown(cx, cz) {
  // Tall towers with lit windows; the city skyline.
  const palette = ['#7a8ba0', '#5d6d7e', '#8d9db0', '#6b7f95', '#a08a7a', '#75828f'];
  const h = randInt(26, 68);
  const w = rand(16, 26), d = rand(16, 26);
  const mat = new THREE.MeshStandardMaterial({
    map: windowTexture(pick(palette), 0.35),
    roughness: 0.6, metalness: 0.15,
  });
  buildingMats.push(mat);
  addBuilding(cx, cz, w, d, h, mat);
  if (Math.random() < 0.5) {
    const h2 = randInt(10, 20);
    const mat2 = new THREE.MeshStandardMaterial({
      map: windowTexture(pick(palette), 0.3), roughness: 0.7,
    });
    buildingMats.push(mat2);
    addBuilding(cx + rand(-8, 8), cz + rand(-8, 8), rand(10, 14), rand(10, 14), h2, mat2);
  }
}

function buildBlock(cx, cz) {
  // Ordinary mid-rise block: 2-4 buildings around a small courtyard.
  const palette = ['#b0a08a', '#9a8f7a', '#c0b49a', '#8fa0a8', '#a89a88'];
  const n = randInt(2, 4);
  for (let i = 0; i < n; i++) {
    const ox = (i % 2 === 0 ? -1 : 1) * 9;
    const oz = (i < 2 ? -1 : 1) * 9;
    const h = randInt(7, 16);
    const mat = new THREE.MeshStandardMaterial({
      map: windowTexture(pick(palette), 0.25), roughness: 0.8,
    });
    buildingMats.push(mat);
    addBuilding(cx + ox + rand(-2, 2), cz + oz + rand(-2, 2), rand(12, 16), rand(12, 16), h, mat);
  }
  if (Math.random() < 0.6) addTree(cx + rand(-6, 6), cz + rand(-6, 6));
}

function buildHarbor(cx, cz) {
  // Warehouses, stacked containers, cranes.
  const whMat = new THREE.MeshStandardMaterial({ color: pick([0x7d8c99, 0x99a7ad, 0x8a7f74]), roughness: 0.85 });
  addBuilding(cx, cz, rand(22, 30), rand(12, 16), randInt(7, 10), whMat);
  const contColors = [0xc0392b, 0x2471a3, 0x229954, 0xd4ac0d, 0x7d3c98];
  for (let i = 0; i < 6; i++) {
    const cont = new THREE.Mesh(
      new THREE.BoxGeometry(6, 2.6, 2.6),
      new THREE.MeshStandardMaterial({ color: pick(contColors), roughness: 0.7, metalness: 0.2 }),
    );
    const px = cx + rand(-16, 16), pz = cz + rand(-16, 16);
    cont.position.set(px, 1.3 + (Math.random() < 0.3 ? 2.6 : 0), pz);
    cont.rotation.y = Math.random() < 0.5 ? 0 : Math.PI / 2;
    cont.castShadow = true;
    S.scene.add(cont);
    addCollider(px - 3.2, px + 3.2, pz - 3.2, pz + 3.2);
  }
}

function buildPlaza() {
  // Central plaza: open ground, fountain, benches, trees, flag poles.
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(14, 15, 0.5, 24),
    new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.9 }),
  );
  base.position.set(0, 0.25, 0);
  base.receiveShadow = true;
  S.scene.add(base);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6, 0.4, 24),
    new THREE.MeshStandardMaterial({ color: 0x3aa7c9, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.9 }),
  );
  water.position.set(0, 0.6, 0);
  S.scene.add(water);
  const spout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.8, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.8 }),
  );
  spout.position.set(0, 2.4, 0);
  S.scene.add(spout);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    addTree(Math.cos(a) * 20, Math.sin(a) * 20);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 10, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.6, roughness: 0.4 }),
    );
    pole.position.set(Math.cos(a) * 16, 5, Math.sin(a) * 16);
    S.scene.add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.4),
      new THREE.MeshStandardMaterial({ color: pick([0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71]), side: THREE.DoubleSide }),
    );
    flag.position.set(Math.cos(a) * 16 + 1.2, 9.2, Math.sin(a) * 16);
    S.scene.add(flag);
  }
}

function buildBeach() {
  // Sand strip, boardwalk, palms and the ocean beyond the south edge.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.CITY_R * 2 + 120, 90),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, CFG.CITY_R + 20);
  sand.receiveShadow = true;
  S.scene.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.CITY_R * 2 + 600, 600),
    new THREE.MeshStandardMaterial({ color: PALETTE.ocean, roughness: 0.25, metalness: 0.1 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.4, CFG.CITY_R + 360);
  S.scene.add(ocean);
  for (let x = -CFG.CITY_R; x <= CFG.CITY_R; x += randInt(14, 22)) {
    addPalm(x + rand(-4, 4), CFG.CITY_R + rand(2, 40), rand(0.9, 1.4));
  }
  // Boardwalk planks along the shore road.
  const walk = new THREE.Mesh(
    new THREE.BoxGeometry(CFG.CITY_R * 2, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xa9805a, roughness: 1 }),
  );
  walk.position.set(0, 0.2, CFG.CITY_R - 6);
  walk.receiveShadow = true;
  S.scene.add(walk);
}

export function buildCity() {
  const scene = S.scene;
  // Ground slab.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.CITY_R * 2 + 200, CFG.CITY_R * 2 + 200),
    new THREE.MeshStandardMaterial({ color: 0x6f7d5a, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  scene.add(ground);
  // Concrete city slab.
  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.CITY_R * 2 + 30, CFG.CITY_R * 2 + 30),
    new THREE.MeshStandardMaterial({ color: 0x8d8578, roughness: 1 }),
  );
  slab.rotation.x = -Math.PI / 2;
  slab.position.y = 0;
  slab.receiveShadow = true;
  scene.add(slab);

  // Roads: textured strips along every grid line. Each strip is built lying
  // flat along X, then its group is turned 90 degrees for the north-south
  // roads, so the dashes always run down the road's length.
  const tex = roadTexture();
  const span = CFG.CITY_R * 2 + 30;
  function addRoad(x, z, vertical) {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(span / 14, 1);
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(span, CFG.ROAD_W),
      new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }),
    );
    strip.rotation.x = -Math.PI / 2;
    strip.receiveShadow = true;
    const g = new THREE.Group();
    g.add(strip);
    if (vertical) g.rotation.y = Math.PI / 2;
    g.position.set(x, 0.06, z);
    scene.add(g);
  }
  for (let i = -CFG.GRID; i <= CFG.GRID; i++) {
    const c = i * CFG.PITCH;
    addRoad(0, c, false); // east-west road at z = c
    addRoad(c, 0, true);  // north-south road at x = c
  }

  // Blocks.
  for (let ix = -CFG.GRID; ix < CFG.GRID; ix++) {
    for (let iz = -CFG.GRID; iz < CFG.GRID; iz++) {
      const cx = ix * CFG.PITCH + CFG.PITCH / 2;
      const cz = iz * CFG.PITCH + CFG.PITCH / 2;
      const downtown = Math.abs(ix) <= 1 && Math.abs(iz) <= 1 && !(ix === -1 && iz === -1);
      const plaza = ix === -1 && iz === -1;
      const harbor = cx > 130;
      const beach = cz > 160;
      if (plaza) continue; // plaza built separately at the origin block
      if (downtown) buildDowntown(cx, cz);
      else if (harbor) buildHarbor(cx, cz);
      else if (beach) { /* beachfront low blocks */ buildBlock(cx, cz); }
      else buildBlock(cx, cz);
    }
  }
  buildPlaza();
  buildBeach();

  // Street lamps at intersections.
  for (let i = -CFG.GRID; i <= CFG.GRID; i++) {
    for (let j = -CFG.GRID; j <= CFG.GRID; j++) {
      if ((i + j) % 2 === 0) addLamp(i * CFG.PITCH + 8, j * CFG.PITCH + 8);
    }
  }
  // Trees along the beach road and plaza approaches.
  for (let x = -200; x <= 200; x += 27) addTree(x, CFG.CITY_R - 16);

  // Sky dome + lights.
  skyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(900, 16, 12),
    new THREE.MeshBasicMaterial({ color: PALETTE.skyDay, side: THREE.BackSide, fog: false }),
  );
  scene.add(skyMesh);
  sun = new THREE.DirectionalLight(0xfff2d0, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);
  hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0x87b5e0, 180, 700);

  updateDayCycle(0);
}

export function updateDayCycle(dt) {
  S.timeHours = (S.timeHours + dt * (24 / CFG.DAY_SECONDS)) % 24;
  const h = S.timeHours;
  // Sun elevation: rises 6h, sets 19h.
  const ang = ((h - 6) / 13) * Math.PI; // 0..PI across the day
  const elev = Math.sin(ang);
  const dayF = clamp(elev * 2.2 + 0.25, 0, 1); // 1 = full day
  const duskF = clamp(1 - Math.abs(elev) * 3.2, 0, 1) * (h > 6 && h < 20 ? 1 : 0);
  const nightF = 1 - dayF;
  if (sun) {
    sun.position.set(Math.cos(ang) * 180, Math.max(elev, -0.25) * 220 + 30, 80);
    sun.intensity = 0.45 + dayF * 2.4;
    sun.color.copy(PALETTE.sunDay).lerp(PALETTE.sunNight, nightF);
    if (S.player) {
      sun.target.position.copy(S.player.mesh.position);
      sun.position.add(S.player.mesh.position);
    }
  }
  if (hemi) hemi.intensity = 0.5 + dayF * 0.6;
  const sky = new THREE.Color().copy(PALETTE.skyDay).lerp(PALETTE.skyNight, nightF);
  if (duskF > 0) sky.lerp(PALETTE.skyDusk, duskF * 0.75);
  if (skyMesh) skyMesh.material.color.copy(sky);
  if (S.scene && S.scene.fog) S.scene.fog.color.copy(sky);
  const lampGlow = nightF > 0.25 ? 1 : 0;
  for (const m of S.lamps) m.emissive.setHex(lampGlow ? 0xffdf8a : 0x000000);
  return { dayF, nightF, duskF };
}

export function isNight() {
  const h = S.timeHours;
  return h < 5.5 || h > 19.5;
}

// Circle-vs-AABB collision resolve. Returns the corrected position.
export function resolveCollisions(x, z, radius) {
  for (const c of S.colliders) {
    const nx = clamp(x, c.minX, c.maxX);
    const nz = clamp(z, c.minZ, c.maxZ);
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * radius;
        z = nz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration.
        const pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.minX - radius;
        else if (m === pr) x = c.maxX + radius;
        else if (m === pt) z = c.minZ - radius;
        else z = c.maxZ + radius;
      }
    }
  }
  return { x, z };
}

export function roadCenters() {
  const out = [];
  for (let i = -CFG.GRID; i <= CFG.GRID; i++) out.push(i * CFG.PITCH);
  return out;
}

// A random point on a road lane, away from the given spot.
export function randomRoadPoint(awayFrom, minDist = 30) {
  for (let tries = 0; tries < 30; tries++) {
    const horizontal = Math.random() < 0.5;
    const c = pick(roadCenters());
    const along = rand(-CFG.CITY_R + 20, CFG.CITY_R - 20);
    const lane = pick([-CFG.LANE, CFG.LANE]);
    const x = horizontal ? along : c + lane;
    const z = horizontal ? c + lane : along;
    if (!awayFrom || Math.hypot(x - awayFrom.x, z - awayFrom.z) >= minDist) {
      return { x, z, heading: horizontal ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? Math.PI : 0) };
    }
  }
  return { x: 0, z: -CFG.PITCH, heading: 0 };
}
