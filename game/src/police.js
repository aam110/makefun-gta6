// The law: wanted stars 1–5, patrol cars that chase and ram, foot cops that
// run you down and arrest you, heat that cools off when you break line of
// sight, and the BUSTED screen when they finally grab you.

import * as THREE from 'three';
import { MAX_WANTED, WANTED_LABEL, clamp, distXZ, pick, rand, angleDiff } from './config.js';
import { makeCar, driveCar, removeCar } from './vehicles.js';
import { createPersonMesh } from './pedestrians.js';
import { randomRoadPoint, collideCircle } from './world.js';

export function setWanted(G, level, reason) {
  const next = clamp(Math.round(level), 0, MAX_WANTED);
  if (next === G.wanted) return;
  const rose = next > G.wanted;
  G.wanted = next;
  G.unseenTimer = 0;
  if (next > 0) {
    G.hud.flashWanted();
    G.audio.wantedUp();
    if (rose) G.hud.notify(reason ? `${reason} — ${'★'.repeat(next)} ${WANTED_LABEL[next]}` : `${'★'.repeat(next)} ${WANTED_LABEL[next]}`, 'bad');
  } else if (rose === false && next === 0) {
    G.hud.notify('You lost them. The heat is off.', 'good');
  }
  G.hud.updateStars();
}

export function addWanted(G, amount, reason) {
  if (G.wanted >= MAX_WANTED) return;
  setWanted(G, G.wanted + amount, reason);
}

// Crimes the world reports through G.events (drained once per frame by main).
export function handleCrimeEvents(G) {
  for (const e of G.events) {
    if (e.type === 'steal') addWanted(G, 1, 'Grand theft auto');
    else if (e.type === 'pedDown') addWanted(G, 1, 'Pedestrian down');
    else if (e.type === 'shotFired') {
      // gunfire draws attention fast when cops are already around
      if (G.wanted > 0) G.unseenTimer = 0;
      else if (Math.random() < 0.6) addWanted(G, 1, 'Shots fired');
      else G.hud.notify('Someone heard that…', 'bad');
    } else if (e.type === 'explosion') addWanted(G, 1, 'Explosion');
    else if (e.type === 'crash' && G.wanted > 0) G.unseenTimer = 0;
  }
}

function spawnPatrolCar(G) {
  const p = G.player;
  const spot = randomRoadPoint(G, p.x, p.z, 55, 110);
  const heading = Math.atan2(-(p.x - spot.x), -(p.z - spot.z));
  const car = makeCar(G, 'police', spot.x, spot.z, heading, { driver: 'police' });
  car.ai = { mode: 'chase', ramCooldown: 0 };
  G.cops.push({ kind: 'car', car, arrestTimer: 0, shootTimer: rand(0.5, 1.5) });
  return car;
}

function spawnFootCop(G) {
  const p = G.player;
  const spot = randomRoadPoint(G, p.x, p.z, 18, 45);
  const parts = createPersonMesh(0x1a3a8a, pick([0xf2c49b, 0xc98d5e, 0x8a5a3b]), { cop: true, pants: 0x141c33 });
  parts.group.position.set(spot.x, 0, spot.z);
  G.scene.add(parts.group);
  const cop = {
    kind: 'foot', ...parts,
    x: spot.x, z: spot.z, heading: 0,
    walkPhase: rand(6), arrestTimer: 0, shootTimer: rand(0.8, 2), dead: false,
  };
  G.cops.push(cop);
  return cop;
}

function removeCop(G, cop) {
  if (cop.kind === 'car') {
    if (!cop.car.dead) removeCar(G, cop.car);
  } else {
    G.scene.remove(cop.group);
  }
  const i = G.cops.indexOf(cop);
  if (i !== -1) G.cops.splice(i, 1);
}

export function clearAllCops(G) {
  for (const cop of [...G.cops]) removeCop(G, cop);
  G.wanted = 0;
  G.hud.updateStars();
}

export function updatePolice(G, dt) {
  const p = G.player;
  if (G.wanted <= 0) {
    // stand down: remaining units drive off / despawn
    if (G.cops.length > 0) {
      for (const cop of [...G.cops]) {
        if (cop.kind === 'car' && distXZ(cop.car.x, cop.car.z, p.x, p.z) > 70) removeCop(G, cop);
        else if (cop.kind === 'foot' && distXZ(cop.x, cop.z, p.x, p.z) > 50) removeCop(G, cop);
      }
      if (G.cops.length === 0) G.audio.setSiren(false);
    }
    return;
  }

  // ---- force size scales with wanted level ----
  const wantCars = G.wanted >= 4 ? 4 : G.wanted >= 2 ? 3 : 2;
  const wantFoot = p.onFoot ? Math.min(G.wanted, 4) : 0;
  let cars = 0;
  let foot = 0;
  for (const c of G.cops) {
    if (c.kind === 'car') cars++;
    else foot++;
  }
  if (cars < wantCars && p.car) spawnPatrolCar(G);
  if (cars < Math.min(wantCars, 2) && !p.car) spawnPatrolCar(G);
  if (foot < wantFoot) spawnFootCop(G);

  // ---- can any unit see the player? ----
  let seen = false;
  for (const cop of G.cops) {
    const cx = cop.kind === 'car' ? cop.car.x : cop.x;
    const cz = cop.kind === 'car' ? cop.car.z : cop.z;
    const seeRange = cop.kind === 'car' ? 65 : 42;
    if (distXZ(cx, cz, p.x, p.z) < seeRange) { seen = true; break; }
  }
  if (seen) G.unseenTimer = 0;
  else {
    G.unseenTimer += dt;
    if (G.unseenTimer > 10) {
      // heat cools one star at a time while hidden
      G.unseenTimer = 4; // then one star every 6s
      setWanted(G, G.wanted - 1);
      if (G.wanted > 0) G.hud.notify('Lose them… keep out of sight.', 'good');
    }
  }
  G.hud.setHiding(!seen && G.wanted > 0);

  // siren while any unit is near
  let sirenNear = false;
  for (const cop of G.cops) {
    const cx = cop.kind === 'car' ? cop.car.x : cop.x;
    const cz = cop.kind === 'car' ? cop.car.z : cop.z;
    if (distXZ(cx, cz, p.x, p.z) < 60) { sirenNear = true; break; }
  }
  G.audio.setSiren(sirenNear);

  // ---- unit behaviour ----
  for (const cop of [...G.cops]) {
    if (cop.kind === 'car') {
      const car = cop.car;
      if (car.dead) { removeCop(G, cop); continue; }
      // pursuit: aim at a point ahead of the player
      const px = p.car ? p.car.x : p.x;
      const pz = p.car ? p.car.z : p.z;
      const lead = p.car ? 0.55 : 0.25;
      const pvx = p.car ? -Math.sin(p.car.heading) * p.car.speed : 0;
      const pvz = p.car ? -Math.cos(p.car.heading) * p.car.speed : 0;
      const tx = px + pvx * lead;
      const tz = pz + pvz * lead;
      const wantHeading = Math.atan2(-(tx - car.x), -(tz - car.z));
      const dH = angleDiff(car.heading, wantHeading);
      const steer = clamp(dH * 2.4, -1, 1);
      const dist = distXZ(car.x, car.z, px, pz);
      // ram: full throttle, brake only when very close and slow
      let throttle = 1;
      if (dist < 4 && Math.abs(car.speed) > 12) throttle = 0.2;
      if (Math.abs(dH) > 1.2) throttle = 0.4;
      driveCar(G, car, dt, throttle, steer);
      // ramming the player on foot knocks them down (and hurts)
      if (p.onFoot && dist < 2.4 && Math.abs(car.speed) > 6) {
        G.modules.combat.hurtPlayer(G, 12, 'rammed');
        car.speed *= 0.5;
        G.fx.addShake(0.35);
      }
      // too far / stuck: teleport back into the hunt
      if (dist > 160) {
        const spot = randomRoadPoint(G, p.x, p.z, 45, 80);
        car.x = spot.x; car.z = spot.z;
        car.heading = Math.atan2(-(px - spot.x), -(pz - spot.z));
        car.speed = 20;
      }
      // foot cops shoot from the car at high wanted
      if (G.wanted >= 3 && dist < 30) {
        cop.shootTimer -= dt;
        if (cop.shootTimer <= 0) {
          cop.shootTimer = rand(1.2, 2.4);
          G.modules.combat.enemyShootAt(G, car.x, 1.4, car.z, 10);
        }
      }
      // player busted if a patrol car pins them on foot at low speed
      if (p.onFoot && dist < 3 && Math.abs(car.speed) < 2) {
        cop.arrestTimer += dt;
        if (cop.arrestTimer > 1.6) { G.modules.police.bustPlayer(G); return; }
      } else cop.arrestTimer = 0;
    } else {
      // foot cop: sprint at the player, arrest up close, shoot at 3+ stars
      const dx = p.x - cop.x;
      const dz = p.z - cop.z;
      const dist = Math.hypot(dx, dz) || 0.01;
      cop.heading = Math.atan2(-dx / dist, -dz / dist);
      const speed = 7.2;
      const pos = { x: cop.x - Math.sin(cop.heading) * speed * dt, z: cop.z - Math.cos(cop.heading) * speed * dt };
      collideCircle(G, pos, 0.5);
      cop.x = pos.x; cop.z = pos.z;
      cop.group.position.set(cop.x, 0, cop.z);
      cop.group.rotation.y = cop.heading;
      cop.walkPhase += dt * speed * 3.2;
      const swing = Math.sin(cop.walkPhase) * 0.85;
      cop.legL.rotation.x = swing;
      cop.legR.rotation.x = -swing;
      cop.armL.rotation.x = -swing * 0.8;
      cop.armR.rotation.x = swing * 0.8;
      if (dist > 220) { removeCop(G, cop); continue; }
      if (dist < 2.6 && p.onFoot) {
        cop.arrestTimer += dt;
        G.hud.setArrestWarning(cop.arrestTimer / 1.6);
        if (cop.arrestTimer > 1.6) { bustPlayer(G); return; }
      } else {
        cop.arrestTimer = 0;
        G.hud.setArrestWarning(0);
      }
      if (G.wanted >= 3 && dist < 34 && dist > 6) {
        cop.shootTimer -= dt;
        if (cop.shootTimer <= 0) {
          cop.shootTimer = rand(1.0, 2.0);
          G.modules.combat.enemyShootAt(G, cop.x, 1.5, cop.z, 8);
        }
      }
    }
  }
}

export function bustPlayer(G) {
  if (G.state !== 'playing') return;
  const fine = Math.min(G.player.money, 100 + G.wanted * 120);
  G.player.money -= fine;
  clearAllCops(G);
  G.audio.setSiren(false);
  G.audio.busted();
  G.endGame('busted', {
    title: 'BUSTED',
    sub: `The SBPD caught up with you. Fine paid: $${fine.toLocaleString('en-US')}. Your car was impounded — but Solmar Bay never sleeps, and neither do you.`,
  });
  // respawn outside the precinct, on foot
  const p = G.player;
  if (p.car) { const c = p.car; p.car = null; p.onFoot = true; p.group.visible = true; removeCar(G, c); }
  p.x = 8; p.z = -32;
  p.health = 100;
  p.armor = 0;
  G.hour = (G.hour + 2) % 24;
}
