// Palmera Heat — the story: five missions, one arc.
// Mara Voss comes home to Palmera City to find her old crew scattered and
// the Meridian Syndicate squeezing every street. With Theo the mechanic and
// Lena the hacker, she drives, steals and fights her way to the syndicate's
// boss, Vera Castellan — and burns the whole operation down.
//
// Each mission is a list of steps. A step completes when its condition is
// met; the manager moves the beacon, the minimap blip and the objective
// text. Fail states (wasted, busted, timer out) offer a retry.

import * as THREE from 'three';
import { LANDMARKS } from './config.js';
import { Car } from './vehicles.js';

export const MISSIONS = [
  {
    id: 0,
    title: 'HOMECOMING HEAT',
    giver: 'Theo Brandt',
    brief: 'Mara is back in Palmera after three years away. Theo needs a driver — steal a car and get to his garage.',
    reward: 500,
    steps: [
      { type: 'enterCar', text: 'Steal a car — walk up to one and press E', say: ['Mara', 'Three years gone. Palmera still smells like salt and gasoline.'] },
      { type: 'driveTo', pos: { x: LANDMARKS.garage.x + 14, z: LANDMARKS.garage.z }, r: 10, text: "Drive to Theo's Garage", say: ['Theo', 'Mara! About time. Get over here — I\'ve got work for the best wheelwoman in the city.'] },
      { type: 'talk', npc: 'theo', pos: { x: LANDMARKS.garage.x - 8, z: LANDMARKS.garage.z + 12 }, r: 4, text: 'Talk to Theo (press E)', say: ['Theo', 'The Meridian Syndicate runs this town now. Vera Castellan. We take her down, street by street.'] },
    ],
  },
  {
    id: 1,
    title: 'THE LEDGER RUN',
    giver: 'Lena Kaur',
    brief: 'Lena has the syndicate\'s courier route. Pick her up, grab the three dead drops, and shake the cops.',
    reward: 800,
    steps: [
      { type: 'driveTo', pos: { x: LANDMARKS.apartment.x, z: LANDMARKS.apartment.z + 16 }, r: 10, text: "Drive to Lena's Apartment", say: ['Lena', 'Mara, I\'m in. The courier drops are all over the east side — come get me.'] },
      { type: 'talk', npc: 'lena', pos: { x: LANDMARKS.apartment.x, z: LANDMARKS.apartment.z + 16 }, r: 4, text: 'Pick up Lena (press E)' },
      { type: 'collect', items: [
        { x: 160, z: -32 }, { x: 224, z: 96 }, { x: 96, z: 160 },
      ], text: 'Collect the 3 dead drops (drive through them)', say: ['Lena', 'Three drops, three ledgers. Grab them all and the syndicate\'s books are ours.'] },
      { type: 'escape', text: 'Lose the cops — break line of sight until the heat is off', say: ['Lena', 'PD is on us! Lose them, Mara — lose them now!'] },
      { type: 'driveTo', pos: { x: LANDMARKS.safehouse.x, z: LANDMARKS.safehouse.z + 12 }, r: 10, text: 'Get back to the Safehouse', say: ['Lena', 'We did it. Vera\'s whole operation, in three little notebooks.'] },
    ],
  },
  {
    id: 2,
    title: 'NEON TIDE',
    giver: 'Theo Brandt',
    brief: 'The syndicate\'s street crew challenged Theo\'s garage to a boardwalk race. Beat the clock through four checkpoints.',
    reward: 1200,
    steps: [
      { type: 'enterCar', text: 'Get in a car — the race starts at the Boardwalk', say: ['Theo', 'Their crew thinks they own the boardwalk. Show them what a real driver does.'] },
      { type: 'race', checkpoints: [
        { x: 352, z: -160 }, { x: 352, z: 160 }, { x: 224, z: 224 }, { x: 0, z: 224 },
      ], time: 150, text: 'Race! Hit every checkpoint before the clock runs out' },
      { type: 'driveTo', pos: { x: LANDMARKS.garage.x + 14, z: LANDMARKS.garage.z }, r: 10, text: 'Bring the car home to the Garage', say: ['Theo', 'That\'s my girl. The whole boardwalk saw it — the syndicate crew is finished.'] },
    ],
  },
  {
    id: 3,
    title: 'THE MERIDIAN JOB',
    giver: 'Lena Kaur',
    brief: 'The casino vault holds Vera\'s blackmail files. Walk in, take the case, and get out while the whole city hunts you.',
    reward: 2000,
    steps: [
      { type: 'goto', pos: { x: LANDMARKS.casino.x, z: LANDMARKS.casino.z + 22 }, r: 8, text: 'Reach the Meridian Casino entrance', say: ['Lena', 'The case is in the lobby vault. Security is light — Vera never thought anyone would dare.'] },
      { type: 'grab', pos: { x: LANDMARKS.casino.x, z: LANDMARKS.casino.z + 22 }, r: 4, text: 'Grab the vault case (press E)' },
      { type: 'escape', text: 'Escape with the case — lose the 3-star wanted level', say: ['Lena', 'Alarms everywhere! Every cop in Palmera is coming. Run!'] },
      { type: 'driveTo', pos: { x: LANDMARKS.safehouse.x, z: LANDMARKS.safehouse.z + 12 }, r: 10, text: 'Get the case to the Safehouse', say: ['Mara', 'We have everything. Vera\'s empire ends tonight.'] },
    ],
  },
  {
    id: 4,
    title: 'HEATWAVE',
    giver: 'Mara Voss',
    brief: 'Vera Castellan is fleeing Palmera in her armoured limo. Run her down, end the Meridian Syndicate, and vanish into the sunset.',
    reward: 5000,
    steps: [
      { type: 'chase', text: "Hunt Vera's limo — smash it until it burns", say: ['Vera', 'You think you can take my city, little driver? Come and try.'] },
      { type: 'escape', text: 'Lose the heat — the whole PD is after you', say: ['Theo', 'She\'s done. Now disappear, Mara. The marina, go!'] },
      { type: 'driveTo', pos: { x: LANDMARKS.marina.x, z: LANDMARKS.marina.z }, r: 12, text: 'Escape to Sunset Marina', say: ['Mara', 'Palmera is ours again. Time to watch the sunset.'] },
    ],
  },
];

function makeBeacon() {
  const group = new THREE.Group();
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd24d, transparent: true, opacity: 0.38,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  column.position.y = 30;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd24d, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 2.4, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd24d }),
  );
  arrow.rotation.x = Math.PI;
  arrow.position.y = 9;
  group.add(column, ring, arrow);
  group.userData.ring = ring;
  group.userData.arrow = arrow;
  return group;
}

function makeCheckpointRing() {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.5, 0.35, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0x38e08b }),
  );
  ring.position.y = 3;
  return ring;
}

function makePickupMarker() {
  const group = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x38e08b }),
  );
  box.position.y = 1.2;
  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 1.8, 5, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x38e08b, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }),
  );
  glow.position.y = 2.5;
  group.add(box, glow);
  group.userData.box = box;
  return group;
}

export class MissionManager {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.activeIndex = -1;
    this.stepIndex = 0;
    this.state = 'free'; // free | active | passed | failed
    this.beacon = makeBeacon();
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.checkpointMesh = null;
    this.pickupMeshes = [];
    this.targetCar = null;
    this.targetCarDriver = null;
    this.timer = 0;
    this.collected = 0;
    this.currentText = '';
    this.currentTitle = '';
    this.npcMarkers = new Map();
    this._buildNpcs();
  }

  _buildNpcs() {
    // Theo stands by his garage, Lena by her apartment. Simple figures with
    // a floating marker so the player can find them.
    const makeNpc = (shirt, x, z) => {
      const group = new THREE.Group();
      const torso = new THREE.Mesh(
        new THREE.BoxGeometry(0.66, 0.8, 0.36),
        new THREE.MeshLambertMaterial({ color: shirt }),
      );
      torso.position.y = 1.12;
      torso.castShadow = true;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 12, 10),
        new THREE.MeshLambertMaterial({ color: 0xe0ac69 }),
      );
      head.position.y = 1.8;
      const legs = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.74, 0.3),
        new THREE.MeshLambertMaterial({ color: 0x2c3e50 }),
      );
      legs.position.y = 0.37;
      const marker = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 1, 4),
        new THREE.MeshBasicMaterial({ color: 0x38e08b }),
      );
      marker.rotation.x = Math.PI;
      marker.position.y = 3.2;
      group.add(torso, head, legs, marker);
      group.position.set(x, 0, z);
      group.userData.marker = marker;
      this.scene.add(group);
      return group;
    };
    this.npcMarkers.set('theo', makeNpc(0x2e6fc2, LANDMARKS.garage.x - 8, LANDMARKS.garage.z + 12));
    this.npcMarkers.set('lena', makeNpc(0x9b59b6, LANDMARKS.apartment.x, LANDMARKS.apartment.z + 16));
  }

  get mission() {
    return this.activeIndex >= 0 ? MISSIONS[this.activeIndex] : null;
  }

  get step() {
    const m = this.mission;
    return m ? m.steps[this.stepIndex] : null;
  }

  get targetPos() {
    const s = this.step;
    if (!s) return null;
    if (s.pos) return s.pos;
    if (s.type === 'collect' && this.pickupMeshes.length > 0) {
      const p = this.pickupMeshes.find((m) => m.visible);
      return p ? { x: p.position.x, z: p.position.z } : null;
    }
    if (s.type === 'race' && this.checkpointMesh) {
      return { x: this.checkpointMesh.position.x, z: this.checkpointMesh.position.z };
    }
    if (s.type === 'chase' && this.targetCar) {
      return { x: this.targetCar.pos.x, z: this.targetCar.pos.z };
    }
    return null;
  }

  startMission(index, world) {
    this.activeIndex = index;
    this.stepIndex = 0;
    this.state = 'active';
    this.collected = 0;
    const m = this.mission;
    this.currentTitle = m.title;
    world.hud.missionCard(m.title, m.brief, m.giver);
    world.audio.missionPass();
    this._enterStep(world);
  }

  _enterStep(world) {
    const s = this.step;
    if (!s) return;
    this.currentText = s.text;
    if (s.say) world.hud.showSubtitle(s.say[0], s.say[1], 5000);
    this._clearStepMeshes();
    if (s.type === 'collect') {
      for (const item of s.items) {
        const marker = makePickupMarker();
        marker.position.set(item.x, 0, item.z);
        this.scene.add(marker);
        this.pickupMeshes.push(marker);
      }
    }
    if (s.type === 'race') {
      this.timer = s.time;
      this.raceIndex = 0;
      this.checkpointMesh = makeCheckpointRing();
      const cp = s.checkpoints[0];
      this.checkpointMesh.position.set(cp.x, 0, cp.z);
      this.scene.add(this.checkpointMesh);
    }
    if (s.type === 'chase') {
      this._spawnLimo(world);
    }
    if (s.type === 'escape') {
      // The escape steps start hot: the city is already hunting Mara.
      const want = this.activeIndex === 3 ? 3 : this.activeIndex === 4 ? 4 : 2;
      world.police.setStars(want);
    }
    if (s.type === 'grab') {
      const marker = makePickupMarker();
      marker.position.set(s.pos.x, 0, s.pos.z);
      this.scene.add(marker);
      this.pickupMeshes.push(marker);
    }
    this._placeBeacon();
  }

  _spawnLimo(world) {
    const start = { x: 64, z: -192 };
    const limo = new Car(this.scene, 'limo', 0x111111, start.x, start.z, 0);
    limo.driver = 'target';
    this.targetCar = limo;
    this.targetCarDriver = {
      axis: 'z', road: 64, dir: 1, targetSpeed: 17, turning: 0,
      turnFrom: 0, turnTo: 0, turnX: 0, turnZ: 0,
    };
    limo.speed = 17;
    world.hud.showSubtitle('Vera', 'My limo is faster than your little stolen car, Mara.', 4000);
  }

  _clearStepMeshes() {
    for (const m of this.pickupMeshes) this.scene.remove(m);
    this.pickupMeshes = [];
    if (this.checkpointMesh) {
      this.scene.remove(this.checkpointMesh);
      this.checkpointMesh = null;
    }
  }

  _placeBeacon() {
    const target = this.targetPos;
    if (target) {
      this.beacon.visible = true;
      this.beacon.position.set(target.x, 0, target.z);
    } else {
      this.beacon.visible = false;
    }
  }

  _nextStep(world) {
    this.stepIndex++;
    if (this.stepIndex >= this.mission.steps.length) {
      this._completeMission(world);
      return;
    }
    this._enterStep(world);
    world.audio.pickup();
  }

  _completeMission(world) {
    const m = this.mission;
    this.state = 'passed';
    this.beacon.visible = false;
    this._clearStepMeshes();
    if (this.targetCar) {
      this.targetCar.remove();
      this.targetCar = null;
    }
    world.onMissionPassed(m);
  }

  failMission(world, reason) {
    if (this.state !== 'active') return;
    this.state = 'failed';
    this.beacon.visible = false;
    this._clearStepMeshes();
    if (this.targetCar) {
      this.targetCar.remove();
      this.targetCar = null;
    }
    world.onMissionFailed(reason);
  }

  retry(world) {
    if (this.activeIndex < 0) return;
    this.state = 'active';
    this.stepIndex = 0;
    this.collected = 0;
    this._enterStep(world);
  }

  /** The player pressed E near something mission-related. */
  tryInteract(world) {
    if (this.state !== 'active') return false;
    const s = this.step;
    const p = world.player.pos;
    if ((s.type === 'talk' || s.type === 'grab') && s.pos) {
      const d = Math.hypot(p.x - s.pos.x, p.z - s.pos.z);
      if (d < (s.r || 4) + 1) {
        if (s.type === 'grab') {
          world.audio.pickup();
          world.hud.showSubtitle('Mara', 'Got the case. Time to run.', 3000);
        }
        this._nextStep(world);
        return true;
      }
    }
    return false;
  }

  update(dt, world) {
    // Animate the beacon, NPC markers and pickup markers.
    const t = world.time;
    if (this.beacon.visible) {
      this.beacon.userData.arrow.position.y = 9 + Math.sin(t * 2.2) * 1.2;
      this.beacon.userData.arrow.rotation.y += dt;
      const s = 1 + Math.sin(t * 3) * 0.08;
      this.beacon.userData.ring.scale.set(s, s, s);
    }
    for (const npc of this.npcMarkers.values()) {
      npc.userData.marker.position.y = 3.2 + Math.sin(t * 2 + npc.position.x) * 0.3;
      npc.userData.marker.rotation.y += dt * 1.5;
    }
    for (const m of this.pickupMeshes) {
      if (!m.visible) continue;
      m.userData.box.rotation.y += dt * 2;
      m.userData.box.position.y = 1.2 + Math.sin(t * 2.5) * 0.25;
    }
    if (this.checkpointMesh) {
      this.checkpointMesh.rotation.y += dt * 0.8;
    }
    // Drive Vera's limo along the roads, fleeing the player.
    if (this.targetCar && !this.targetCar.dead) {
      this._driveLimo(dt, world);
    }

    if (this.state !== 'active') return;
    const s = this.step;
    const p = world.player.pos;
    switch (s.type) {
      case 'enterCar':
        if (world.player.inCar) this._nextStep(world);
        break;
      case 'goto':
      case 'driveTo': {
        const d = Math.hypot(p.x - s.pos.x, p.z - s.pos.z);
        if (d < s.r) this._nextStep(world);
        break;
      }
      case 'talk':
      case 'grab':
        // Completed by tryInteract (E key).
        break;
      case 'collect': {
        for (const m of this.pickupMeshes) {
          if (!m.visible) continue;
          const d = Math.hypot(p.x - m.position.x, p.z - m.position.z);
          if (d < 4) {
            m.visible = false;
            this.collected++;
            world.audio.pickup();
            world.hud.showSubtitle('Lena', `Drop ${this.collected} of ${s.items.length} secured.`, 2200);
            this.currentText = `Collect the dead drops — ${this.collected}/${s.items.length}`;
            this._placeBeacon();
            if (this.collected >= s.items.length) this._nextStep(world);
          }
        }
        break;
      }
      case 'race': {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.failMission(world, 'Out of time — the syndicate crew takes the boardwalk.');
          break;
        }
        const cp = s.checkpoints[this.raceIndex];
        const d = Math.hypot(p.x - cp.x, p.z - cp.z);
        if (d < 7) {
          world.audio.pickup();
          this.raceIndex++;
          if (this.raceIndex >= s.checkpoints.length) {
            this._nextStep(world);
          } else {
            const next = s.checkpoints[this.raceIndex];
            this.checkpointMesh.position.set(next.x, 0, next.z);
            this.currentText = `Race! Checkpoint ${this.raceIndex + 1} of ${s.checkpoints.length}`;
            this._placeBeacon();
          }
        }
        break;
      }
      case 'chase': {
        if (this.targetCar && this.targetCar.dead) {
          world.hud.showSubtitle('Vera', 'No... my city...', 3000);
          this._nextStep(world);
        }
        break;
      }
      case 'escape': {
        if (world.police.stars === 0) this._nextStep(world);
        break;
      }
      default:
        break;
    }
  }

  _driveLimo(dt, world) {
    const limo = this.targetCar;
    const d = this.targetCarDriver;
    const playerPos = world.player.pos;
    // Flee: keep driving; turn away from the player at intersections.
    const coord = d.axis === 'x' ? limo.pos.x : limo.pos.z;
    let nextRoad = null;
    for (const r of [-320, -256, -192, -128, -64, 0, 64, 128, 192, 256, 320]) {
      const dist = (r - coord) * d.dir;
      if (dist > 0 && (nextRoad === null || dist < Math.abs(nextRoad - coord))) nextRoad = r;
    }
    if (d.turning > 0) {
      d.turning -= dt;
      const k = 1 - Math.max(0, d.turning) / 0.9;
      limo.heading = d.turnFrom + (d.turnTo - d.turnFrom) * k;
      limo.pos.x += (d.turnX - limo.pos.x) * Math.min(1, dt * 2.2);
      limo.pos.z += (d.turnZ - limo.pos.z) * Math.min(1, dt * 2.2);
    } else if (nextRoad !== null && Math.abs(coord - nextRoad) < 1.2) {
      // Turn away from the player when possible.
      const away = d.axis === 'x'
        ? (playerPos.z > limo.pos.z ? -1 : 1)
        : (playerPos.x > limo.pos.x ? 1 : -1);
      const side = Math.random() < 0.7 ? away : -away;
      const newAxis = d.axis === 'x' ? 'z' : 'x';
      let newHeading = Math.round((limo.heading + side * Math.PI / 2) / (Math.PI / 2)) * (Math.PI / 2);
      const newDir = newAxis === 'x'
        ? (Math.sin(newHeading) > 0 ? 1 : -1)
        : (Math.cos(newHeading) > 0 ? 1 : -1);
      const laneOffset = newAxis === 'x' ? (newDir > 0 ? 3.5 : -3.5) : (newDir > 0 ? -3.5 : 3.5);
      d.turning = 0.9;
      d.turnFrom = limo.heading;
      d.turnTo = newHeading;
      if (newAxis === 'x') {
        d.turnX = limo.pos.x;
        d.turnZ = nextRoad + laneOffset;
      } else {
        d.turnX = nextRoad + laneOffset;
        d.turnZ = limo.pos.z;
      }
      d.axis = newAxis;
      d.road = nextRoad;
      d.dir = newDir;
    }
    const f = limo.forward();
    limo.pos.x += f.x * limo.speed * dt;
    limo.pos.z += f.z * limo.speed * dt;
    if (d.axis === 'x') {
      const lane = d.road + (d.dir > 0 ? 3.5 : -3.5);
      limo.pos.z += (lane - limo.pos.z) * Math.min(1, dt * 1.5);
    } else {
      const lane = d.road + (d.dir > 0 ? -3.5 : 3.5);
      limo.pos.x += (lane - limo.pos.x) * Math.min(1, dt * 1.5);
    }
    limo.mesh.rotation.y = limo.heading;
    limo.spinWheels(dt);
    this._placeBeacon();
  }
}
