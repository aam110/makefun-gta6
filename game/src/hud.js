// HUD: stars, money, clock, district, compass, objective panel, health/armor
// bars, weapon + ammo, speedometer, hints, notifications, story dialogs, and
// the rotating circular minimap (roads pre-rendered once, blips drawn live).

import { CITY_HALF, ROAD_COORDS, ROAD_HALF, BEACH_Z, WATER_Z, WEAPONS, fmtMoney, fmtClock, districtAt, headingToCompass, clamp, distXZ, TAU } from './config.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'), stars: $('stars'), money: $('money'), clock: $('clock'), district: $('district'),
    compass: $('compass'), objective: $('objective'), objTitle: document.querySelector('#objective .obj-title'),
    objText: document.querySelector('#objective .obj-text'), objDist: document.querySelector('#objective .obj-dist'),
    healthFill: $('health-fill'), armorFill: $('armor-fill'), weaponBox: $('weapon-box'),
    speedo: $('speedo'), speedNum: $('speed-num'), carName: $('car-name'),
    crosshair: $('crosshair'), hint: $('hint'), notifyStack: $('notify-stack'),
    dialog: $('dialog'), dlgName: document.querySelector('#dialog .dlg-name'),
    dlgText: document.querySelector('#dialog .dlg-text'),
    wantedFlash: $('wanted-flash'), minimap: $('minimap'),
  };
  const mm = el.minimap.getContext('2d');
  const MM = 220; // minimap canvas size
  const RANGE = 130; // world units shown across the minimap diameter

  // Pre-render the static road map once (offscreen), then blit + rotate.
  const base = document.createElement('canvas');
  base.width = MM; base.height = MM;
  {
    const g = base.getContext('2d');
    const s = MM / (CITY_HALF * 2 + 40);
    const toPx = (v) => (v + CITY_HALF + 20) * s;
    g.fillStyle = '#1d2b22';
    g.fillRect(0, 0, MM, MM);
    // sea + sand at the south edge
    g.fillStyle = '#e8d29a';
    g.fillRect(0, toPx(BEACH_Z), MM, toPx(WATER_Z) - toPx(BEACH_Z));
    g.fillStyle = '#1e6f9e';
    g.fillRect(0, toPx(WATER_Z), MM, MM - toPx(WATER_Z));
    // blocks
    g.fillStyle = '#2c3644';
    for (let i = 0; i < ROAD_COORDS.length - 1; i++) {
      for (let j = 0; j < ROAD_COORDS.length - 1; j++) {
        const x0 = ROAD_COORDS[i] + ROAD_HALF + 2;
        const x1 = ROAD_COORDS[i + 1] - ROAD_HALF - 2;
        const z0 = ROAD_COORDS[j] + ROAD_HALF + 2;
        const z1 = ROAD_COORDS[j + 1] - ROAD_HALF - 2;
        if (z0 > BEACH_Z) continue;
        g.fillRect(toPx(x0), toPx(z0), toPx(x1) - toPx(x0), toPx(z1) - toPx(z0));
      }
    }
    // roads
    g.strokeStyle = '#565d68';
    g.lineWidth = ROAD_HALF * 2 * s;
    for (const c of ROAD_COORDS) {
      g.beginPath(); g.moveTo(toPx(c), 0); g.lineTo(toPx(c), MM); g.stroke();
      g.beginPath(); g.moveTo(0, toPx(c)); g.lineTo(MM, toPx(c)); g.stroke();
    }
  }

  const H = {
    dialogQueue: [],
    dialogCb: null,
    dialogActive: false,
    hiding: false,
    arrest01: 0,
    notifyTimers: [],

    show() { el.hud.classList.remove('hidden'); },
    hide() { el.hud.classList.add('hidden'); },

    updateStars() {
      let html = '';
      for (let i = 0; i < 5; i++) html += `<span class="${i < G.wanted ? '' : 'off'}">★</span>`;
      el.stars.innerHTML = html;
    },
    flashWanted() {
      el.wantedFlash.classList.add('hot');
      setTimeout(() => el.wantedFlash.classList.remove('hot'), 450);
    },
    flashDamage() {
      el.wantedFlash.classList.add('hot');
      setTimeout(() => el.wantedFlash.classList.remove('hot'), 220);
    },
    setHiding(v) { this.hiding = v; },
    setArrestWarning(v) { this.arrest01 = v; },

    setHint(html) {
      if (!html) { el.hint.classList.add('hidden'); return; }
      el.hint.innerHTML = html;
      el.hint.classList.remove('hidden');
    },

    notify(text, kind = '') {
      const div = document.createElement('div');
      div.className = 'notify' + (kind ? ' ' + kind : '');
      div.textContent = text;
      el.notifyStack.appendChild(div);
      while (el.notifyStack.children.length > 3) el.notifyStack.removeChild(el.notifyStack.firstChild);
      setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 4200);
    },

    showMissionTitle(title) {
      this.notify(`— ${title} —`, '');
    },

    showDialog(lines, onDone) {
      this.dialogQueue = [...lines];
      this.dialogCb = onDone || null;
      this.dialogActive = true;
      this.advanceDialog(true);
      el.dialog.classList.remove('hidden');
    },
    advanceDialog(first = false) {
      if (!this.dialogActive) return;
      if (!first) G.audio.click();
      const line = this.dialogQueue.shift();
      if (!line) {
        this.dialogActive = false;
        el.dialog.classList.add('hidden');
        const cb = this.dialogCb;
        this.dialogCb = null;
        if (cb) cb();
        return;
      }
      el.dlgName.textContent = line[0];
      el.dlgText.textContent = line[1];
    },

    update(dt) {
      const p = G.player;
      el.money.textContent = fmtMoney(p.money);
      el.clock.textContent = fmtClock(G.hour);
      el.district.textContent = districtAt(p.x, p.z) + (this.hiding ? ' · HIDING…' : '');
      const comp = headingToCompass(G.cameraRig.yaw);
      el.compass.innerHTML = `&lt; <b>${comp}</b> &gt;`;
      el.healthFill.style.width = `${clamp(p.health, 0, 100)}%`;
      el.armorFill.style.width = `${clamp(p.armor, 0, 100)}%`;
      const w = WEAPONS[p.weapon];
      const reloading = p.reloading ? ' — RELOADING' : '';
      el.weaponBox.innerHTML = `${w.name} &nbsp;<span class="ammo">${p.ammoInMag} / ${p.reserve[p.weapon]}</span>${reloading}`;
      // objective
      const obj = G.modules.missions.missionObjective(G);
      if (obj) {
        el.objective.classList.remove('hidden');
        el.objTitle.textContent = obj.title;
        el.objText.textContent = obj.text;
        if (obj.dist && obj.x !== undefined) {
          const d = Math.round(distXZ(p.x, p.z, obj.x, obj.z));
          el.objDist.textContent = `${d}m away`;
        } else el.objDist.textContent = '';
      } else el.objective.classList.add('hidden');
      // speedometer
      if (!p.onFoot && p.car) {
        el.speedo.classList.remove('hidden');
        el.speedNum.textContent = String(Math.round(Math.abs(p.car.speed) * 3.6));
        el.carName.textContent = p.car.name;
      } else el.speedo.classList.add('hidden');
      // crosshair when aiming or firing on foot / driving
      const aiming = G.input.rightDown || G.input.mouseDown;
      el.crosshair.classList.toggle('hidden', !aiming);
      // arrest warning vignette
      if (this.arrest01 > 0) {
        el.wantedFlash.classList.add('hot');
        this.setHint('<b>RUN!</b> The cops are grabbing you…');
      }
      this.drawMinimap();
    },

    drawMinimap() {
      const p = G.player;
      const heading = G.cameraRig.yaw;
      mm.save();
      mm.clearRect(0, 0, MM, MM);
      // circular clip
      mm.beginPath();
      mm.arc(MM / 2, MM / 2, MM / 2 - 1, 0, TAU);
      mm.clip();
      mm.fillStyle = '#101623';
      mm.fillRect(0, 0, MM, MM);
      // rotate the world so the player's heading is up
      mm.translate(MM / 2, MM / 2);
      mm.rotate(heading);
      const scale = MM / RANGE;
      const worldToMap = (x, z) => [ (x - p.x) * scale, (z - p.z) * scale ];
      // blit the static base map, scaled and aligned so world (p.x, p.z) lands at the centre
      const baseScale = (CITY_HALF * 2 + 40) / RANGE;
      const bw = MM * baseScale;
      mm.drawImage(base, -bw / 2 - p.x * scale, -bw / 2 - p.z * scale, bw, bw);
      // mission marker / start
      const obj = G.modules.missions.missionObjective(G);
      if (obj && obj.x !== undefined) {
        const [mx, mz] = worldToMap(obj.x, obj.z);
        mm.fillStyle = '#ffd23e';
        mm.beginPath();
        mm.arc(mx, mz, 7, 0, TAU);
        mm.fill();
        mm.strokeStyle = '#111';
        mm.lineWidth = 2;
        mm.stroke();
      }
      // cars (white dots), cops (flashing blue/red), enemies (red)
      for (const car of G.cars) {
        if (car.dead) continue;
        const d = distXZ(car.x, car.z, p.x, p.z);
        if (d > RANGE * 0.6) continue;
        const [mx, mz] = worldToMap(car.x, car.z);
        if (car.driver === 'police') {
          mm.fillStyle = Math.floor(G.elapsed * 5) % 2 === 0 ? '#3a6bff' : '#ff3a3a';
          mm.beginPath(); mm.arc(mx, mz, 5, 0, TAU); mm.fill();
        } else if (car === p.car) continue;
        else {
          mm.fillStyle = 'rgba(255,255,255,0.75)';
          mm.fillRect(mx - 2, mz - 2, 4, 4);
        }
      }
      for (const cop of G.cops) {
        if (cop.kind !== 'foot') continue;
        const d = distXZ(cop.x, cop.z, p.x, p.z);
        if (d > RANGE * 0.6) continue;
        const [mx, mz] = worldToMap(cop.x, cop.z);
        mm.fillStyle = '#3a6bff';
        mm.beginPath(); mm.arc(mx, mz, 4, 0, TAU); mm.fill();
      }
      for (const e of G.enemies) {
        if (e.dead) continue;
        const [mx, mz] = worldToMap(e.x, e.z);
        mm.fillStyle = '#ff3a3a';
        mm.beginPath(); mm.arc(mx, mz, 4.5, 0, TAU); mm.fill();
      }
      // player arrow (centre, pointing up = heading)
      mm.fillStyle = '#fff';
      mm.strokeStyle = '#111';
      mm.lineWidth = 2;
      mm.beginPath();
      mm.moveTo(0, -9);
      mm.lineTo(6, 7);
      mm.lineTo(-6, 7);
      mm.closePath();
      mm.fill();
      mm.stroke();
      mm.restore();
      // north tick on the rim
      mm.save();
      mm.translate(MM / 2, MM / 2);
      mm.rotate(heading);
      mm.fillStyle = '#ffd23e';
      mm.font = 'bold 13px sans-serif';
      mm.textAlign = 'center';
      mm.fillText('N', 0, -MM / 2 + 16);
      mm.restore();
    },
  };
  G.hud = H;
  return H;
}
