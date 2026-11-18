// Rio on foot: WASD movement relative to the camera, sprint, jump, walk
// animation, aiming with the mouse, and the smooth third-person camera rig
// (closer on foot, pulled back and behind the car while driving).

import * as THREE from 'three';
import { clamp, lerp, angleLerp, angleDiff, distXZ, TAU } from './config.js';
import { createPersonMesh } from './pedestrians.js';
import { collideCircle } from './world.js';
import { moveAxes, isDown, wasPressed } from './input.js';
import { tryEnterCar, exitCar, nearestCar, driveCar } from './vehicles.js';
import { fireWeapon, reloadWeapon, finishReload, switchWeapon, aimPoint } from './combat.js';

export function createPlayer(G, jacketColor) {
  const parts = createPersonMesh(jacketColor, 0xf2c49b, { pants: 0x232830, hair: 0x2a1d12 });
  parts.group.position.set(G.player.x, 0, G.player.z);
  G.scene.add(parts.group);
  Object.assign(G.player, parts);
  G.player.walkPhase = 0;
  G.player.jumpV = 0;
  G.player.y = 0;
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;

  // weapon switching + reload (both modes)
  if (wasPressed(input, 'Digit1')) switchWeapon(G, 'pistol');
  if (wasPressed(input, 'Digit2')) switchWeapon(G, 'smg');
  if (wasPressed(input, 'KeyR')) reloadWeapon(G);
  if (p.reloading && G.elapsed >= p.reloadEndsAt) finishReload(G);
  // keep per-weapon magazine state
  p.magState[p.weapon] = p.ammoInMag;

  if (!p.onFoot && p.car) {
    updateDriving(G, dt);
    return;
  }
  updateOnFoot(G, dt);
}

function updateOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  const cam = G.cameraRig;

  // camera yaw follows the mouse (pointer lock) or auto-follows movement
  if (input.locked) {
    cam.yaw -= input.mouseDX * 0.0026;
    cam.pitch = clamp(cam.pitch + input.mouseDY * 0.0022, -0.15, 0.9);
  }
  const axes = moveAxes(input);
  const sprint = isDown(input, 'ShiftLeft', 'ShiftRight');
  const speed = sprint ? 9.5 : 5.2;
  const moving = axes.x !== 0 || axes.y !== 0;

  // aiming: right mouse held, or firing — Rio faces the mouse aim point
  const aiming = input.rightDown || input.mouseDown;
  if (aiming) {
    const aim = aimPoint(G);
    const want = Math.atan2(-(aim.x - p.x), -(aim.z - p.z));
    p.heading = angleLerp(p.heading, want, Math.min(1, dt * 14));
  } else if (moving) {
    const moveAngle = Math.atan2(axes.x, axes.y);
    const want = cam.yaw + moveAngle;
    p.heading = angleLerp(p.heading, want, Math.min(1, dt * 10));
    cam.yaw = angleLerp(cam.yaw, p.heading, Math.min(1, dt * 1.2));
  }

  if (moving) {
    const dirAngle = cam.yaw + Math.atan2(axes.x, axes.y);
    const mx = -Math.sin(dirAngle);
    const mz = -Math.cos(dirAngle);
    const pos = { x: p.x + mx * speed * dt, z: p.z + mz * speed * dt };
    collideCircle(G, pos, 0.55);
    p.x = pos.x;
    p.z = pos.z;
    p.walkPhase += dt * speed * 2.4;
    const swing = Math.sin(p.walkPhase) * (sprint ? 0.95 : 0.6);
    p.legL.rotation.x = swing;
    p.legR.rotation.x = -swing;
    p.armL.rotation.x = aiming ? -1.2 : -swing * 0.7;
    p.armR.rotation.x = aiming ? -1.2 : swing * 0.7;
  } else {
    p.legL.rotation.x = lerp(p.legL.rotation.x, 0, dt * 10);
    p.legR.rotation.x = lerp(p.legR.rotation.x, 0, dt * 10);
    p.armL.rotation.x = lerp(p.armL.rotation.x, aiming ? -1.2 : 0, dt * 10);
    p.armR.rotation.x = lerp(p.armR.rotation.x, aiming ? -1.2 : 0, dt * 10);
  }

  // jump
  if (wasPressed(input, 'Space') && p.y <= 0.01) p.jumpV = 6.5;
  if (p.y > 0 || p.jumpV > 0) {
    p.jumpV -= 18 * dt;
    p.y = Math.max(0, p.y + p.jumpV * dt);
    if (p.y === 0) p.jumpV = 0;
  }

  // shooting: SMG fires while held; pistol fires on each click. A click is
  // an edge event (mouseClicked), so a quick click still fires even when
  // frames are slow — requiring mouseDown too would drop clicks between frames.
  const w = G.player.weapon;
  const wantsFire = w === 'smg' ? input.mouseDown : input.mouseClicked;
  if (wantsFire) fireWeapon(G);

  // enter / steal car
  if (wasPressed(input, 'KeyF')) {
    if (!tryEnterCar(G)) G.hud.notify('No car nearby — get closer', 'bad');
  }
  const near = nearestCar(G, p.x, p.z, 4.2);
  if (near) {
    const label = near.driver === 'traffic' || near.driver === 'police'
      ? `Press F to carjack the ${near.name}`
      : `Press F to enter the ${near.name}`;
    G.hud.setHint(`<b>F</b> — ${label}`);
  } else if (G.mission.active === false) {
    const m = G.modules.missions.currentMission(G);
    if (m && distXZ(p.x, p.z, m.start.x, m.start.z) < 12) G.hud.setHint('Walk into the <b>yellow beam</b> to start the mission');
    else G.hud.setHint('');
  } else G.hud.setHint('');

  p.group.position.set(p.x, p.y, p.z);
  p.group.rotation.y = p.heading;
  G.audio.setEngine(0, false);
}

function updateDriving(G, dt) {
  const p = G.player;
  const car = p.car;
  const input = G.input;
  const cam = G.cameraRig;

  if (input.locked) {
    cam.yaw -= input.mouseDX * 0.0026;
    cam.pitch = clamp(cam.pitch + input.mouseDY * 0.0022, -0.1, 0.7);
  }
  const axes = moveAxes(input);
  const handbrake = isDown(input, 'Space');
  const boost = isDown(input, 'ShiftLeft', 'ShiftRight');
  let throttle = axes.y;
  if (boost && throttle > 0) throttle = 1.35;
  driveCar(G, car, dt, throttle, -axes.x, handbrake);
  p.x = car.x;
  p.z = car.z;
  p.heading = car.heading;
  // camera drifts behind the car
  if (!input.locked) cam.yaw = angleLerp(cam.yaw, car.heading, Math.min(1, dt * 1.6));

  // drive-by: shoot toward the mouse aim point from the car
  if (p.weapon === 'smg' ? input.mouseDown : input.mouseClicked) fireWeapon(G);

  // exit
  if (wasPressed(input, 'KeyF')) exitCar(G);
  // horn
  if (wasPressed(input, 'KeyH')) G.audio.horn();

  G.hud.setHint('<b>F</b> — exit car &nbsp;·&nbsp; <b>CLICK</b> — drive-by &nbsp;·&nbsp; <b>SPACE</b> — handbrake');
  G.audio.setEngine(clamp(Math.abs(car.speed) / car.spec.topSpeed, 0, 1), true);
}

// ---- Camera rig ----

export function createCameraRig() {
  return {
    yaw: Math.PI, pitch: 0.32, dist: 8.5,
    pos: new THREE.Vector3(0, 6, 20),
    look: new THREE.Vector3(),
    shakeX: 0, shakeY: 0,
  };
}

export function updateCamera(G, dt) {
  const p = G.player;
  const cam = G.cameraRig;
  const inCar = !p.onFoot && p.car;
  const wantDist = inCar ? 11.5 : 8;
  cam.dist = lerp(cam.dist, wantDist, Math.min(1, dt * 3));
  const height = inCar ? 4.4 : 3.4;
  const tx = p.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
  const tz = p.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
  const ty = (p.y || 0) + height + Math.sin(cam.pitch) * cam.dist * 0.6;
  // keep the camera out of buildings and above the ground
  const pos = { x: tx, z: tz };
  collideCircle(G, pos, 0.8);
  const target = new THREE.Vector3(pos.x, Math.max(ty, 1.6), pos.z);
  const snap = G.cameraSnapped ? 1 : Math.min(1, dt * 5);
  G.cameraSnapped = false;
  cam.pos.lerp(target, snap);
  // shake
  const sh = G.fx.shake;
  const shX = (Math.random() - 0.5) * sh * 0.5;
  const shY = (Math.random() - 0.5) * sh * 0.5;
  G.camera.position.set(cam.pos.x + shX, cam.pos.y + shY, cam.pos.z);
  const lookTarget = new THREE.Vector3(p.x, (p.y || 0) + (inCar ? 1.6 : 1.5), p.z);
  cam.look.lerp(lookTarget, Math.min(1, dt * 10));
  G.camera.lookAt(cam.look);
  void TAU;
}
