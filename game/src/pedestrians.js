// Pedestrians: low-poly people strolling the sidewalks, turning at corners,
// and sprinting away from gunfire, crashes and explosions. Run one over and
// the law notices — the wanted system listens for it.

import * as THREE from 'three';
import { PALETTE, ROAD_COORDS, SIDEWALK_HALF, chance, clamp, pick, rand, distXZ, TAU } from './config.js';
import { collideCircle } from './world.js';

const PED_COUNT = 26;

export function createPersonMesh(shirtColor, skinColor, opts = {}) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const pants = new THREE.MeshLambertMaterial({ color: opts.pants ?? 0x2a2d34 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), shirt);
  torso.position.y = 1.12;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  g.add(head);
  // hair cap
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 6, 0, TAU, 0, 1.4),
    new THREE.MeshLambertMaterial({ color: opts.hair ?? pick([0x1a1512, 0x4a2f1d, 0x8a6a3b, 0x222222]) }));
  hair.position.y = 1.76;
  g.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.26), pants);
  legL.position.set(-0.17, 0.38, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.22), shirt);
  armL.position.set(-0.42, 1.15, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  g.add(armR);
  if (opts.hat) {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.14, 10),
      new THREE.MeshLambertMaterial({ color: opts.hat }));
    hat.position.y = 1.94;
    g.add(hat);
  }
  if (opts.cop) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.16, 10),
      new THREE.MeshLambertMaterial({ color: 0x1a2a55 }));
    cap.position.y = 1.95;
    g.add(cap);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    badge.position.set(0.16, 1.3, 0.19);
    g.add(badge);
  }
  return { group: g, legL, legR, armL, armR, torso, head };
}

function sidewalkStart(G) {
  const vertical = Math.random() < 0.5;
  const road = pick(ROAD_COORDS);
  const side = Math.random() < 0.5 ? -1 : 1;
  const along = rand(-160, 160);
  return {
    x: vertical ? road + side * (SIDEWALK_HALF - 0.7) : along,
    z: vertical ? along : road + side * (SIDEWALK_HALF - 0.7),
    axis: vertical ? 'z' : 'x',
    dir: Math.random() < 0.5 ? 1 : -1,
  };
}

export function spawnPed(G, x, z, opts = {}) {
  const parts = createPersonMesh(pick(PALETTE.pedShirt), pick(PALETTE.pedSkin), {
    hat: chance(0.25) ? pick(PALETTE.car) : null,
  });
  parts.group.position.set(x, 0, z);
  G.scene.add(parts.group);
  const s = opts.at ? { axis: 'z', dir: 1 } : sidewalkStart(G);
  const ped = {
    ...parts,
    x, z,
    axis: s.axis, dir: s.dir,
    heading: 0,
    speed: rand(1.4, 2.2),
    walkPhase: rand(TAU),
    state: 'walk',       // walk | flee | down
    fleeTime: 0,
    fleeX: 0, fleeZ: 0,
    downTime: 0,
    dead: false,
  };
  if (opts.fleeFrom) {
    ped.state = 'flee';
    ped.fleeTime = opts.fleeTime ?? 5;
    ped.fleeX = opts.fleeFrom.x;
    ped.fleeZ = opts.fleeFrom.z;
  }
  G.peds.push(ped);
  return ped;
}

export function initPedestrians(G) {
  for (let i = 0; i < PED_COUNT; i++) {
    const s = sidewalkStart(G);
    spawnPed(G, s.x, s.z, { at: true });
    const ped = G.peds[G.peds.length - 1];
    ped.axis = s.axis;
    ped.dir = s.dir;
  }
}

// Danger! Everyone nearby runs away from (x, z).
export function scarePeds(G, x, z, radius) {
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    if (distXZ(ped.x, ped.z, x, z) < radius) {
      ped.state = 'flee';
      ped.fleeTime = rand(4, 8);
      ped.fleeX = x;
      ped.fleeZ = z;
    }
  }
}

export function knockPedDown(G, ped, byPlayer) {
  if (ped.state === 'down') return;
  ped.state = 'down';
  ped.downTime = 6;
  ped.group.rotation.x = -Math.PI / 2;
  ped.group.position.y = 0.3;
  G.fx.burst(ped.x, 1, ped.z, 0xffffff, 6, 2.5, { life: 0.4 });
  if (byPlayer) {
    G.events.push({ type: 'pedDown', x: ped.x, z: ped.z });
    G.hud.notify('Pedestrian down! The cops saw that.', 'bad');
  }
}

export function updatePedestrians(G, dt) {
  const p = G.player;
  for (const ped of [...G.peds]) {
    if (ped.state === 'down') {
      ped.downTime -= dt;
      if (ped.downTime <= 0) {
        G.scene.remove(ped.group);
        G.peds.splice(G.peds.indexOf(ped), 1);
        const s = sidewalkStart(G);
        spawnPed(G, s.x, s.z, { at: true });
        const np = G.peds[G.peds.length - 1];
        np.axis = s.axis; np.dir = s.dir;
      }
      continue;
    }
    let speed = ped.speed;
    if (ped.state === 'flee') {
      speed = 6.5;
      ped.fleeTime -= dt;
      // run directly away from the scare point
      const dx = ped.x - ped.fleeX;
      const dz = ped.z - ped.fleeZ;
      const d = Math.hypot(dx, dz) || 1;
      ped.heading = Math.atan2(-dx / d, -dz / d);
      if (ped.fleeTime <= 0) {
        ped.state = 'walk';
        // rejoin the nearest sidewalk line
        ped.axis = Math.abs(dx) > Math.abs(dz) ? 'x' : 'z';
        ped.dir = (ped.axis === 'x' ? dx : dz) > 0 ? 1 : -1;
      }
    } else {
      // stroll along the sidewalk; turn at intersections sometimes
      const alongCoord = ped.axis === 'z' ? ped.z : ped.x;
      let nearCross = false;
      for (const c of ROAD_COORDS) {
        if (Math.abs(alongCoord - c) < 1.4) { nearCross = true; break; }
      }
      if (nearCross && chance(dt * 1.2)) {
        const newAxis = ped.axis === 'z' ? 'x' : 'z';
        const newDir = Math.random() < 0.5 ? 1 : -1;
        let road = ROAD_COORDS[0];
        let bd = Infinity;
        for (const c of ROAD_COORDS) {
          const d = Math.abs(c - alongCoord);
          if (d < bd) { bd = d; road = c; }
        }
        const side = Math.random() < 0.5 ? -1 : 1;
        ped.axis = newAxis;
        ped.dir = newDir;
        if (newAxis === 'x') ped.z = road + side * (SIDEWALK_HALF - 0.7);
        else ped.x = road + side * (SIDEWALK_HALF - 0.7);
      }
      if (Math.abs(ped.x) > 170 || Math.abs(ped.z) > 170) ped.dir *= -1;
      ped.heading = ped.axis === 'z'
        ? (ped.dir === 1 ? Math.PI : 0)
        : (ped.dir === 1 ? -Math.PI / 2 : Math.PI / 2);
    }
    const fx = -Math.sin(ped.heading);
    const fz = -Math.cos(ped.heading);
    const pos = { x: ped.x + fx * speed * dt, z: ped.z + fz * speed * dt };
    collideCircle(G, pos, 0.5);
    ped.x = pos.x;
    ped.z = pos.z;
    ped.group.position.set(ped.x, 0, ped.z);
    ped.group.rotation.y = ped.heading;
    // walk-cycle swing
    ped.walkPhase += dt * speed * 3.4;
    const swing = Math.sin(ped.walkPhase) * (ped.state === 'flee' ? 0.9 : 0.55);
    ped.legL.rotation.x = swing;
    ped.legR.rotation.x = -swing;
    ped.armL.rotation.x = -swing * 0.8;
    ped.armR.rotation.x = swing * 0.8;
    ped.group.position.y = Math.abs(Math.sin(ped.walkPhase)) * 0.06;
    // run over by a fast car?
    for (const car of G.cars) {
      if (car.dead || Math.abs(car.speed) < 4) continue;
      if (distXZ(ped.x, ped.z, car.x, car.z) < 2.0) {
        knockPedDown(G, ped, car.driver === 'player');
        if (car.driver === 'player') car.speed *= 0.85;
        break;
      }
    }
  }
  // keep the crowd topped up near the player
  if (G.peds.length < PED_COUNT) {
    const s = sidewalkStart(G);
    spawnPed(G, s.x, s.z, { at: true });
    const np = G.peds[G.peds.length - 1];
    np.axis = s.axis; np.dir = s.dir;
  }
  void p;
  void clamp;
}
