// Palmera Heat — the wanted system and the Palmera PD.
// Crimes add heat; heat maps to 0–5 stars. Police cars spawn on nearby roads
// and chase the player, ramming to stop the car. At two stars and above, foot
// cops join the hunt. Heat bleeds off when no officer can see the player.
// Get caught standing still next to a cop and it is over: BUSTED.

import { Car } from './vehicles.js';
import { WANTED, CAR } from './config.js';

export class PoliceManager {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.heat = 0;
    this.cars = [];
    this.bustedTimer = 0;
    this.spawnTimer = 0;
    this.sirenLevel = 0;
  }

  get stars() {
    if (this.heat <= 0) return 0;
    return Math.min(WANTED.maxStars, Math.ceil(this.heat / WANTED.heatPerStar));
  }

  setStars(n) {
    this.heat = n <= 0 ? 0 : (n - 1) * WANTED.heatPerStar + 100;
    if (n <= 0) this.clearAll();
  }

  addHeat(amount, _reason) {
    this.heat = Math.min(WANTED.maxStars * WANTED.heatPerStar, this.heat + amount);
  }

  clearAll() {
    for (const car of this.cars) car.remove();
    this.cars = [];
    this.bustedTimer = 0;
  }

  /** How close the nearest officer is (for the siren and the heat decay). */
  nearestOfficerDist(playerPos, peds) {
    let best = Infinity;
    for (const car of this.cars) {
      if (car.dead) continue;
      best = Math.min(best, Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z));
    }
    for (const cop of peds.cops) {
      if (cop.dead) continue;
      best = Math.min(best, Math.hypot(cop.pos.x - playerPos.x, cop.pos.z - playerPos.z));
    }
    return best;
  }

  _spawnPoliceCar(playerPos) {
    const p = this.city.randomRoadPoint(this.rng, playerPos, 60, 130);
    const car = new Car(this.scene, 'police', 0xf5f5f0, p.x, p.z, Math.atan2(playerPos.x - p.x, playerPos.z - p.z));
    car.driver = 'police';
    car.speed = 12;
    this.cars.push(car);
    return car;
  }

  update(dt, world) {
    const playerPos = world.player.pos;
    const stars = this.stars;

    // Heat decay: fast when hidden, slow while the chase is on.
    const nearest = this.nearestOfficerDist(playerPos, world.peds);
    const seen = nearest < 55;
    if (this.heat > 0) {
      this.heat = Math.max(0, this.heat - (seen ? WANTED.decaySeen : WANTED.decayHidden) * dt);
      if (this.heat <= 0) {
        this.clearAll();
        world.peds.clearCops();
        world.hud.showBanner('CLEAN GETAWAY', 'The heat is off. For now.', 2600);
      }
    }

    // Siren volume follows the nearest police car.
    let nearestCar = Infinity;
    for (const car of this.cars) {
      if (!car.dead) nearestCar = Math.min(nearestCar, Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z));
    }
    this.sirenLevel = nearestCar === Infinity ? 0 : Math.max(0, 1 - nearestCar / 120);
    world.audio.setSiren(this.sirenLevel, dt);

    // Spawn pressure: more stars, more cars.
    if (stars > 0) {
      const wantCars = Math.min(2 + stars, 6);
      const alive = this.cars.filter((c) => !c.dead).length;
      this.spawnTimer -= dt;
      if (alive < wantCars && this.spawnTimer <= 0) {
        this.spawnTimer = 2.2;
        this._spawnPoliceCar(playerPos);
      }
      // Foot cops from two stars up.
      const wantCops = stars >= 2 ? Math.min(stars, 4) : 0;
      if (world.peds.cops.length < wantCops && this.spawnTimer <= 0.4) {
        world.peds.spawnCopNear(playerPos);
      }
    }

    // Chase AI: steer at the player's predicted position, ram on contact.
    const playerCar = world.player.inCar ? world.player.car : null;
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      // Flash the light bar.
      if (car.lightbar) {
        const phase = Math.floor(world.time * 6) % 2 === 0;
        car.lightbar.children[0].material.color.setHex(phase ? 0xff2222 : 0x661111);
        car.lightbar.children[1].material.color.setHex(phase ? 0x112266 : 0x2266ff);
      }
      if (car.dead) {
        // Burnt-out husks get towed away after a while.
        car.deadTime = (car.deadTime || 0) + dt;
        if (car.deadTime > 25) {
          car.remove();
          this.cars.splice(i, 1);
        }
        continue;
      }
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const targetHeading = Math.atan2(dx / dist, dz / dist);
      let diff = targetHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 2.2));
      const throttle = dist > 4 ? 1 : 0.4;
      const result = car.drive(dt, throttle, steer, false, world.city.colliders);
      if (result === 'crash' && Math.random() < 0.5) {
        car.heading += 0.6;
      }
      // Ram the player's car. Damage is on a cooldown per police car: without
      // it, sustained contact would drain the player's car every single frame.
      if (playerCar && !playerCar.dead) {
        const d = Math.hypot(car.pos.x - playerCar.pos.x, car.pos.z - playerCar.pos.z);
        if (d < CAR.radius * 2) {
          const impact = Math.abs(car.speed - playerCar.speed) + 4;
          const now = world.time;
          if (impact > 5 && now - (car.lastRam || 0) > 0.8) {
            car.lastRam = now;
            world.audio.crash();
            world.effects.sparks(playerCar.pos.x, 1, playerCar.pos.z);
            if (playerCar.damage(impact * 0.9)) world.onCarDestroyed(playerCar, false);
            if (car.damage(impact * 0.4)) world.onCarDestroyed(car, false);
          }
          const push = 2.2;
          playerCar.pos.x += ((playerCar.pos.x - car.pos.x) / (d || 1)) * push * dt * 8;
          playerCar.pos.z += ((playerCar.pos.z - car.pos.z) / (d || 1)) * push * dt * 8;
        }
      }
      // A police car that falls too far behind despawns; one that gets lost
      // too far away is replaced by a fresh spawn nearer the action.
      if (dist > 260) {
        car.remove();
        this.cars.splice(i, 1);
      }
    }

    // BUSTED: standing still (or on foot, slow) next to an officer.
    if (stars > 0) {
      const slow = world.player.inCar ? Math.abs(world.player.car.speed) < 1.5 : true;
      const onFoot = !world.player.inCar;
      if ((slow || onFoot) && nearest < 7) {
        this.bustedTimer += dt;
        if (this.bustedTimer > WANTED.bustedSeconds) {
          this.bustedTimer = 0;
          world.onPlayerBusted();
        }
      } else {
        this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
      }
    }
  }
}
