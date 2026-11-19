// Palmera Heat — the HUD: stars, cash, health, objective, minimap.
// The minimap is a 2D canvas: the road grid is pre-rendered once, then each
// frame draws the player arrow, the mission blip, police blips and the
// mission-start marker. Banners, subtitles and the damage vignette are DOM.

import { CITY, LANDMARKS } from './config.js';

const MAP_SIZE = 190;
const MAP_RANGE = 460; // world units across the whole minimap

export class HUD {
  constructor() {
    this.el = {};
    const ids = [
      'hud', 'stars', 'cash', 'health-fill', 'health-text', 'weapon-name',
      'obj-panel', 'obj-title', 'obj-text', 'obj-timer',
      'minimap', 'speedo', 'speed-value', 'crosshair', 'prompt',
      'banner', 'banner-title', 'banner-sub', 'subtitle', 'subtitle-who',
      'subtitle-text', 'vignette', 'wanted-flash', 'mission-card',
      'mission-card-title', 'mission-card-brief', 'mission-card-giver',
      'toast', 'gear',
    ];
    for (const id of ids) this.el[id] = document.getElementById(id);
    this.mapCtx = this.el.minimap.getContext('2d');
    this.mapBase = this._renderMapBase();
    this.bannerTimer = null;
    this.subtitleTimer = null;
    this.cardTimer = null;
    this.toastTimer = null;
    this.lastCash = -1;
    this.lastStars = -1;
  }

  _renderMapBase() {
    const canvas = document.createElement('canvas');
    canvas.width = MAP_SIZE;
    canvas.height = MAP_SIZE;
    const ctx = canvas.getContext('2d');
    const toMap = (x, z) => [
      ((x + MAP_RANGE / 2) / MAP_RANGE) * MAP_SIZE,
      ((z + MAP_RANGE / 2) / MAP_RANGE) * MAP_SIZE,
    ];
    // Land.
    ctx.fillStyle = '#274b2f';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    // Ocean.
    const [ox] = toMap(CITY.oceanX, 0);
    const grad = ctx.createLinearGradient(ox, 0, MAP_SIZE, 0);
    grad.addColorStop(0, '#3fb3d9');
    grad.addColorStop(1, '#155a8a');
    ctx.fillStyle = grad;
    ctx.fillRect(ox, 0, MAP_SIZE - ox, MAP_SIZE);
    // Sand.
    const [sx] = toMap(CITY.beachX, 0);
    ctx.fillStyle = '#d9c078';
    ctx.fillRect(sx, 0, ox - sx, MAP_SIZE);
    // Roads.
    ctx.strokeStyle = '#4a4f57';
    ctx.lineWidth = 3;
    for (const r of CITY.roads) {
      const [x1] = toMap(r, 0);
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, MAP_SIZE);
      ctx.stroke();
      const [, z1] = toMap(0, r);
      ctx.beginPath();
      ctx.moveTo(0, z1);
      ctx.lineTo(MAP_SIZE, z1);
      ctx.stroke();
    }
    const [bx] = toMap(CITY.beachRoadX, 0);
    ctx.beginPath();
    ctx.moveTo(bx, 0);
    ctx.lineTo(bx, MAP_SIZE);
    ctx.stroke();
    // Park.
    const [pkx, pkz] = toMap(LANDMARKS.park.x, LANDMARKS.park.z);
    ctx.fillStyle = '#3f8f3a';
    ctx.fillRect(pkx - 8, pkz - 8, 16, 16);
    return { canvas, toMap };
  }

  show() {
    this.el.hud.classList.remove('hidden');
  }

  hide() {
    this.el.hud.classList.add('hidden');
  }

  showBanner(title, sub, ms = 3000) {
    this.el['banner-title'].textContent = title;
    this.el['banner-sub'].textContent = sub || '';
    this.el.banner.classList.remove('hidden');
    this.el.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => {
      this.el.banner.classList.remove('show');
      this.el.banner.classList.add('hidden');
    }, ms);
  }

  showSubtitle(who, text, ms = 4000) {
    this.el['subtitle-who'].textContent = who;
    this.el['subtitle-text'].textContent = text;
    this.el.subtitle.classList.remove('hidden');
    clearTimeout(this.subtitleTimer);
    this.subtitleTimer = setTimeout(() => this.el.subtitle.classList.add('hidden'), ms);
  }

  missionCard(title, brief, giver) {
    this.el['mission-card-title'].textContent = title;
    this.el['mission-card-brief'].textContent = brief;
    this.el['mission-card-giver'].textContent = giver ? `— ${giver}` : '';
    this.el['mission-card'].classList.remove('hidden');
    this.el['mission-card'].classList.add('show');
    clearTimeout(this.cardTimer);
    this.cardTimer = setTimeout(() => {
      this.el['mission-card'].classList.remove('show');
      this.el['mission-card'].classList.add('hidden');
    }, 5200);
  }

  showToast(text, ms = 2600) {
    this.el.toast.textContent = text;
    this.el.toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.add('hidden'), ms);
  }

  setPrompt(text) {
    if (text) {
      this.el.prompt.textContent = text;
      this.el.prompt.classList.remove('hidden');
    } else {
      this.el.prompt.classList.add('hidden');
    }
  }

  flashDamage() {
    this.el.vignette.classList.remove('flash');
    void this.el.vignette.offsetWidth;
    this.el.vignette.classList.add('flash');
    if (this.el['wanted-flash']) {
      this.el['wanted-flash'].classList.add('show');
      setTimeout(() => this.el['wanted-flash'].classList.remove('show'), 300);
    }
  }

  update(dt, world) {
    const { player, police, missions } = world;

    // Wanted stars.
    const stars = police.stars;
    if (stars !== this.lastStars) {
      this.lastStars = stars;
      let html = '';
      for (let i = 0; i < 5; i++) {
        html += `<span class="star ${i < stars ? 'lit' : ''}">★</span>`;
      }
      this.el.stars.innerHTML = html;
      this.el.stars.classList.toggle('hot', stars > 0);
    }

    // Cash.
    const cash = Math.round(world.cash);
    if (cash !== this.lastCash) {
      this.lastCash = cash;
      this.el.cash.textContent = `$${cash.toLocaleString('en-US')}`;
    }

    // Health.
    const hp = Math.max(0, Math.round(player.health));
    this.el['health-fill'].style.width = `${hp}%`;
    this.el['health-fill'].classList.toggle('low', hp < 30);
    this.el['health-text'].textContent = `${hp}`;
    this.el['weapon-name'].textContent = player.inCar ? 'DRIVING' : 'PISTOL ∞';

    // Objective panel.
    if (missions.state === 'active' && missions.mission) {
      this.el['obj-panel'].classList.remove('hidden');
      this.el['obj-title'].textContent = missions.mission.title;
      this.el['obj-text'].textContent = missions.currentText;
      const step = missions.step;
      if (step && step.type === 'race') {
        const t = Math.max(0, missions.timer);
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60).toString().padStart(2, '0');
        this.el['obj-timer'].textContent = `${m}:${s}`;
        this.el['obj-timer'].classList.remove('hidden');
        this.el['obj-timer'].classList.toggle('urgent', t < 20);
      } else {
        this.el['obj-timer'].classList.add('hidden');
      }
    } else if (missions.state === 'free') {
      this.el['obj-panel'].classList.remove('hidden');
      const next = world.nextMission;
      this.el['obj-title'].textContent = next ? 'FREE ROAM' : 'PALMERA CITY';
      this.el['obj-text'].textContent = next
        ? `Next mission: ${next.title} — drive to the yellow M on the map`
        : 'Story complete — Palmera is yours. Enjoy the city.';
      this.el['obj-timer'].classList.add('hidden');
    } else {
      this.el['obj-panel'].classList.add('hidden');
    }

    // Speedometer.
    if (player.inCar && player.car) {
      this.el.speedo.classList.remove('hidden');
      const kmh = Math.round(Math.abs(player.car.speed) * 3.6);
      this.el['speed-value'].textContent = `${kmh}`;
      this.el.gear.textContent = player.car.speed < -0.5 ? 'R' : 'D';
      this.el.crosshair.classList.add('hidden');
    } else {
      this.el.speedo.classList.add('hidden');
      this.el.crosshair.classList.remove('hidden');
    }

    this._drawMinimap(world);
  }

  _drawMinimap(world) {
    const ctx = this.mapCtx;
    const { canvas, toMap } = this.mapBase;
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    // Clip to a circle.
    ctx.save();
    ctx.beginPath();
    ctx.arc(MAP_SIZE / 2, MAP_SIZE / 2, MAP_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    const p = world.player.pos;
    // Pan the base map so the player stays centred.
    const [pcx, pcz] = toMap(p.x, p.z);
    const ox = MAP_SIZE / 2 - pcx;
    const oy = MAP_SIZE / 2 - pcz;
    ctx.drawImage(canvas, ox, oy);
    const blip = (x, z) => {
      const [bx, bz] = toMap(x, z);
      return [bx + ox, bz + oy];
    };

    // Mission-start marker (M) when free roaming.
    if (world.missions.state === 'free' && world.missionStartPos) {
      const [mx, mz] = blip(world.missionStartPos.x, world.missionStartPos.z);
      ctx.fillStyle = '#ffd24d';
      ctx.font = 'bold 15px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('M', mx, mz);
    }

    // Mission target blip.
    const target = world.missions.targetPos;
    if (world.missions.state === 'active' && target) {
      const [tx, tz] = blip(target.x, target.z);
      const pulse = 6 + Math.sin(world.time * 5) * 1.5;
      ctx.fillStyle = '#ffd24d';
      ctx.beginPath();
      ctx.moveTo(tx, tz - pulse);
      ctx.lineTo(tx + pulse * 0.7, tz);
      ctx.lineTo(tx, tz + pulse);
      ctx.lineTo(tx - pulse * 0.7, tz);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#7a5b00';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Police blips (flashing red/blue).
    const policeColor = Math.floor(world.time * 4) % 2 === 0 ? '#ff4444' : '#4488ff';
    ctx.fillStyle = policeColor;
    for (const car of world.police.cars) {
      if (car.dead) continue;
      const [cx, cz] = blip(car.pos.x, car.pos.z);
      ctx.beginPath();
      ctx.arc(cx, cz, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vera's limo blip (red diamond).
    if (world.missions.targetCar && !world.missions.targetCar.dead) {
      const [lx, lz] = blip(world.missions.targetCar.pos.x, world.missions.targetCar.pos.z);
      ctx.fillStyle = '#ff2222';
      ctx.beginPath();
      ctx.moveTo(lx, lz - 6);
      ctx.lineTo(lx + 5, lz);
      ctx.lineTo(lx, lz + 6);
      ctx.lineTo(lx - 5, lz);
      ctx.closePath();
      ctx.fill();
    }

    // Player arrow (rotates with heading).
    const heading = world.player.inCar && world.player.car
      ? world.player.car.heading
      : world.player.heading;
    ctx.save();
    ctx.translate(MAP_SIZE / 2, MAP_SIZE / 2);
    ctx.rotate(heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
    // Rim.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(MAP_SIZE / 2, MAP_SIZE / 2, MAP_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
