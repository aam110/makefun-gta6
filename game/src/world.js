// CAYO BRAVO — world.js: builds the 3D island city: golden-hour sky and sun,
// grid streets with markings, dense varied buildings, beach, sea, palms,
// lamps, the El Faro lighthouse and the marina. All geometry is procedural.

import * as THREE from 'three';
import { WORLD, mulberry32 } from './config.js';

const SUNSET_TOP = 0x2e1a5e;    // dusk violet zenith
const SUNSET_MID = 0xff7a3c;    // burning orange horizon
const SUNSET_LOW = 0xffc46b;    // molten gold at the sun line

export function buildSunsetSky(scene, rng) {
  // Big gradient dome: vertex colours blend violet -> orange -> gold.
  const geo = new THREE.SphereGeometry(900, 24, 16);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(SUNSET_TOP);
  const mid = new THREE.Color(SUNSET_MID);
  const low = new THREE.Color(SUNSET_LOW);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 900;
    if (y > 0.25) c.copy(top).lerp(mid, 1 - Math.min(1, (y - 0.25) / 0.55));
    else c.copy(mid).lerp(low, Math.max(0, (0.25 - y) / 0.5));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  scene.add(dome);

  // The sun itself: a glowing disc low over the sea (west).
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(55, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false }),
  );
  sun.position.set(-820, 95, -120);
  sun.lookAt(0, 60, 0);
  scene.add(sun);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(75, 24),
    new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.3, fog: false }),
  );
  glow.position.copy(sun.position).add(new THREE.Vector3(4, 0, 0));
  glow.lookAt(0, 60, 0);
  scene.add(glow);

  // A few warm clouds: small flat ellipses far out near the dome, so they read
  // as distant clouds instead of giant pink blobs (and stay cheap to shade).
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffb08a, transparent: true, opacity: 0.5, fog: false });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rng() * 0.7;
    const r = 700 + rng() * 120;
    const w = 50 + rng() * 50;
    const cloud = new THREE.Mesh(new THREE.CircleGeometry(w / 2, 16), cloudMat);
    cloud.scale.y = 0.25;
    cloud.position.set(Math.cos(a) * r, 300 + rng() * 90, Math.sin(a) * r);
    cloud.lookAt(0, 40, 0);
    scene.add(cloud);
  }
}

export function buildGoldenHourLights(scene) {
  // Low warm sun from the west: long shadows, saturated bounce.
  const sun = new THREE.DirectionalLight(0xffb066, 2.6);
  sun.position.set(-320, 130, -90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  const fill = new THREE.HemisphereLight(0x8a5cff, 0x3a1e12, 1.3);
  scene.add(fill);
  const bounce = new THREE.DirectionalLight(0xff9a6b, 0.8);
  bounce.position.set(200, 60, 200);
  scene.add(bounce);
  return sun;
}

function canvasTexture(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildingTexture(base, litRatio, rng) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const cols = 6, rows = 14;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? (rng() < 0.6 ? '#ffd76b' : '#ffe9a8') : '#1d1428';
      g.fillRect(8 + x * 19, 10 + y * 17, 12, 10);
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h - 14, w, 14);
  });
}

function roadTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#45424f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a3742';
    for (let i = 0; i < 260; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    g.fillStyle = '#ffd21f'; g.fillRect(w / 2 - 2, 0, 4, h);
    g.fillStyle = '#e8e8e8'; g.fillRect(6, 0, 3, h); g.fillRect(w - 9, 0, 3, h);
  });
}

export function buildCityGround(scene) {
  // Sidewalk base for the whole island.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2 + 80, WORLD.half * 2 + 80),
    new THREE.MeshStandardMaterial({ color: 0x9a7f6a, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Roads: dark strips on the grid, with centre lines.
  const roadTex = roadTexture();
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95 });
  const lines = [];
  for (let v = -240; v <= 240; v += WORLD.roadGap) lines.push(v);
  for (const v of lines) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, WORLD.half * 2), roadMat);
    ns.rotation.x = -Math.PI / 2; ns.position.set(v, 0.05, 0); ns.receiveShadow = true;
    scene.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.half * 2, WORLD.roadWidth), roadMat);
    ew.rotation.x = -Math.PI / 2; ew.position.set(0, 0.05, v); ew.receiveShadow = true;
    scene.add(ew);
  }
  // Crosswalk stripes at the central intersections, merged into one mesh.
  const crossMat = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.9 });
  const stripeGeos = [];
  for (const cx of [-120, 0, 120]) for (const cz of [-120, 0, 120]) {
    for (let i = -2; i <= 2; i++) {
      const g = new THREE.PlaneGeometry(2.2, 11);
      g.rotateX(-Math.PI / 2);
      g.translate(cx + i * 2.6, 0.09, cz - 8.5);
      stripeGeos.push(g);
    }
  }
  scene.add(new THREE.Mesh(mergeGeometries(stripeGeos), crossMat));
}

// Merge indexed BufferGeometries (already transformed) into one geometry.
export function mergeGeometries(geos) {
  let vCount = 0, iCount = 0;
  for (const g of geos) { vCount += g.attributes.position.count; iCount += g.index.count; }
  const positions = new Float32Array(vCount * 3);
  const normals = new Float32Array(vCount * 3);
  const uvs = new Float32Array(vCount * 2);
  const indices = new Uint32Array(iCount);
  let vo = 0, io = 0;
  for (const g of geos) {
    positions.set(g.attributes.position.array, vo * 3);
    normals.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uvs.set(g.attributes.uv.array, vo * 2);
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i++) indices[io + i] = idx[i] + vo;
    io += idx.length;
    vo += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  out.setIndex(new THREE.BufferAttribute(indices, 1));
  return out;
}

export function buildBeachAndSea(scene, rng) {
  // Sand band on the west edge.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(55, WORLD.half * 2 + 80),
    new THREE.MeshStandardMaterial({ color: 0xf2d29a, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(WORLD.beachX - 12, 0.04, 0);
  sand.receiveShadow = true;
  scene.add(sand);
  // Sea: big shimmering plane west of the sand.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(420, WORLD.half * 2 + 400),
    new THREE.MeshStandardMaterial({ color: 0x1a6f9e, roughness: 0.25, metalness: 0.35 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(WORLD.seaX - 190, -0.4, 0);
  scene.add(sea);
  // Boardwalk along the sand edge.
  const walk = new THREE.Mesh(
    new THREE.PlaneGeometry(8, WORLD.half * 2),
    new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 1 }),
  );
  walk.rotation.x = -Math.PI / 2;
  walk.position.set(WORLD.beachX + 16, 0.08, 0);
  walk.receiveShadow = true;
  scene.add(walk);
  // Beach umbrellas + towels: little colour pops (instanced poles + tops).
  const umbCols = [0xff2f92, 0x2fdcff, 0xffd21f, 0x37e06a, 0xff7a1a];
  const umbSpots = [];
  for (let i = 0; i < 26; i++) {
    umbSpots.push([WORLD.beachX - 30 + rng() * 34, -280 + rng() * 560, umbCols[i % umbCols.length]]);
  }
  const dummy = new THREE.Object3D();
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.6, 5);
  poleGeo.translate(0, 1.3, 0);
  const poles = new THREE.InstancedMesh(poleGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff }), umbSpots.length);
  const topGeo = new THREE.ConeGeometry(2.4, 0.9, 8);
  const tops = new THREE.InstancedMesh(topGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), umbSpots.length);
  const tmpColor = new THREE.Color();
  umbSpots.forEach(([x, z, col], i) => {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 2.8;
    dummy.updateMatrix();
    tops.setMatrixAt(i, dummy.matrix);
    tops.setColorAt(i, tmpColor.setHex(col));
  });
  tops.castShadow = true;
  scene.add(poles);
  scene.add(tops);
}

// Palms are instanced: one trunk mesh + one leaf mesh for the whole island,
// so hundreds of palms cost two draw calls instead of hundreds.
export function buildPalmInstances(scene, spots) {
  const dummy = new THREE.Object3D();
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 7, 6);
  trunkGeo.translate(0, 3.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo,
    new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 }), spots.length);
  const leafGeo = new THREE.ConeGeometry(0.9, 5.2, 4);
  const leaves = new THREE.InstancedMesh(leafGeo,
    new THREE.MeshStandardMaterial({ color: 0x2fae4e, roughness: 0.9, side: THREE.DoubleSide }), spots.length * 5);
  let li = 0;
  spots.forEach(([x, z, s, tilt], i) => {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, 0, tilt);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + i;
      dummy.position.set(x + Math.cos(a) * 1.5 * s, 7 * s, z + Math.sin(a) * 1.5 * s);
      dummy.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      leaves.setMatrixAt(li++, dummy.matrix);
    }
  });
  trunks.castShadow = true;
  leaves.castShadow = true;
  scene.add(trunks);
  scene.add(leaves);
}

const FACADE_COLORS = ['#e86a92', '#ff9a3c', '#2fdcff', '#ffd21f', '#8a5cff', '#37e06a',
  '#f2ead8', '#ff5a3c', '#4a7dff', '#e8e8e8', '#c02fff', '#ffb08a'];

export function buildBuildings(scene, rng, colliders) {
  // One building per block cell, taller near Altavista (downtown), low near the beach.
  const downtown = { x: 30, z: -120 };
  for (let gx = -240; gx < 240; gx += WORLD.roadGap) {
    for (let gz = -240; gz < 240; gz += WORLD.roadGap) {
      const cx = gx + WORLD.roadGap / 2, cz = gz + WORLD.roadGap / 2;
      if (cx < WORLD.beachX + 30) continue; // beach stays open
      if (rng() < 0.12) { // plaza / parking lot instead of a building
        const lot = new THREE.Mesh(new THREE.PlaneGeometry(40, 40),
          new THREE.MeshStandardMaterial({ color: 0x6b6b78, roughness: 1 }));
        lot.rotation.x = -Math.PI / 2; lot.position.set(cx, 0.06, cz);
        lot.receiveShadow = true;
        scene.add(lot);
        continue;
      }
      const dDowntown = Math.hypot(cx - downtown.x, cz - downtown.z);
      const tall = Math.max(0, 1 - dDowntown / 260);
      const h = 8 + rng() * 14 + tall * tall * (40 + rng() * 55);
      const w = 26 + rng() * 14, d = 26 + rng() * 14;
      const tex = buildingTexture(FACADE_COLORS[Math.floor(rng() * FACADE_COLORS.length)], 0.45 + rng() * 0.3, rng);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(cx, h / 2, cz);
      b.castShadow = true; b.receiveShadow = true;
      scene.add(b);
      // Rooftop box / AC unit for silhouette variety.
      if (rng() < 0.6) {
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 2.4, d * 0.4),
          new THREE.MeshStandardMaterial({ color: 0x5a4a5a, roughness: 1 }));
        roof.position.set(cx + (rng() - 0.5) * w * 0.3, h + 1.2, cz + (rng() - 0.5) * d * 0.3);
        roof.castShadow = true;
        scene.add(roof);
      }
      // Neon sign strip on some towers.
      if (h > 30 && rng() < 0.5) {
        const neon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, d * 0.7),
          new THREE.MeshBasicMaterial({ color: [0xff2f92, 0x2fdcff, 0xffd21f][Math.floor(rng() * 3)] }));
        neon.position.set(cx + w / 2 + 0.3, h * 0.75, cz);
        scene.add(neon);
      }
      colliders.push({ x: cx, z: cz, hw: w / 2 + 1, hd: d / 2 + 1 });
    }
  }
}

export function buildStreetProps(scene, rng, colliders) {
  // Palms lining the beach boulevard and scattered through plazas (instanced).
  const palmSpots = [];
  for (let z = -280; z <= 280; z += 22) {
    palmSpots.push([WORLD.beachX + 20, z + (rng() - 0.5) * 6, 1 + rng() * 0.5, (rng() - 0.5) * 0.22]);
    if (rng() < 0.7) palmSpots.push([WORLD.beachX - 8, z + 11, 0.9 + rng() * 0.4, (rng() - 0.5) * 0.22]);
  }
  for (let i = 0; i < 40; i++) {
    palmSpots.push([-200 + rng() * 420, -260 + rng() * 520, 0.8 + rng() * 0.5, (rng() - 0.5) * 0.22]);
  }
  buildPalmInstances(scene, palmSpots);
  // Street lamps along the main avenues (instanced poles + heads).
  const lampSpots = [];
  for (const av of [-180, -60, 60, 180]) {
    for (let z = -240; z <= 240; z += 60) lampSpots.push([av + 8, z]);
  }
  const dummy = new THREE.Object3D();
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.2, 8, 5);
  poleGeo.translate(0, 4, 0);
  const poles = new THREE.InstancedMesh(poleGeo,
    new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 0.6, metalness: 0.6 }), lampSpots.length);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }), lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 8.2;
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
  });
  poles.castShadow = true;
  scene.add(poles);
  scene.add(heads);
  // El Faro lighthouse at the south-east point.
  const light = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.2, 34, 10),
    new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.8 }));
  tower.position.y = 17; tower.castShadow = true;
  light.add(tower);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.9, 5, 10),
    new THREE.MeshStandardMaterial({ color: 0xff2f4e, roughness: 0.8 }));
  band.position.y = 22;
  light.add(band);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  lamp.position.y = 35.5;
  light.add(lamp);
  light.position.set(262, 0, 262);
  scene.add(light);
  colliders.push({ x: 262, z: 262, hw: 5, hd: 5 });
  // Marina piers on the east edge.
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 46), pierMat);
    pier.position.set(286, 0.6, -180 + i * 90);
    pier.castShadow = true;
    scene.add(pier);
  }
  // Moored boats: simple hulls with masts.
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 0.6, metalness: 0.6 });
  for (let i = 0; i < 7; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 9),
      new THREE.MeshStandardMaterial({ color: [0xffffff, 0xffd21f, 0x2fdcff][i % 3], roughness: 0.7 }));
    hull.position.y = 0.6;
    boat.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 8, 5), mastMat);
    mast.position.y = 5;
    boat.add(mast);
    boat.position.set(278 + (i % 2) * 8, 0, -220 + i * 62);
    boat.rotation.y = (rng() - 0.5) * 0.4;
    scene.add(boat);
  }
}

// Mission beacon: a tall light pillar + ring marking the current objective.
export function createMissionBeacon(scene) {
  const group = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 30;
  group.add(pillar);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 4.6, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);
  group.visible = false;
  scene.add(group);
  return group;
}

export function buildWorld(scene, seed) {
  const rng = mulberry32(seed);
  const colliders = [];
  scene.fog = new THREE.Fog(0xff8a4a, 180, 700);
  buildSunsetSky(scene, rng);
  const sun = buildGoldenHourLights(scene);
  buildCityGround(scene);
  buildBeachAndSea(scene, rng);
  buildBuildings(scene, rng, colliders);
  buildStreetProps(scene, rng, colliders);
  const beacon = createMissionBeacon(scene);
  return { colliders, beacon, sun };
}

// Simple AABB collision resolve for a circle (player / car) against buildings.
export function resolveBuildingCollision(colliders, x, z, radius) {
  for (const c of colliders) {
    const dx = x - c.x, dz = z - c.z;
    const px = c.hw + radius - Math.abs(dx);
    const pz = c.hd + radius - Math.abs(dz);
    if (px > 0 && pz > 0) {
      if (px < pz) x = c.x + Math.sign(dx || 1) * (c.hw + radius);
      else z = c.z + Math.sign(dz || 1) * (c.hd + radius);
      return { x, z, hit: true };
    }
  }
  return { x, z, hit: false };
}
