// The HUD: wanted stars, health, money, weapon, clock, speed, objective,
// rotating circular minimap, notifications, banners and every overlay screen.
import { CFG, MISSIONS, S, fmtMoney, fmtClock, clamp } from './config.js';
import { isReloading } from './combat.js';

let els = {};
let mapStatic = null;
let notifTimer = null;
let bannerTimer = null;
let callbacks = {};

function $(id) { return document.getElementById(id); }

function buildStaticMap() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const span = CFG.CITY_R * 2 + 120;
  const px = (v) => ((v + span / 2) / span) * 512;
  // Ground.
  g.fillStyle = '#6f7d5a';
  g.fillRect(0, 0, 512, 512);
  // Ocean + beach (south).
  g.fillStyle = '#1d6f8f';
  g.fillRect(0, px(CFG.CITY_R + 40), 512, 512 - px(CFG.CITY_R + 40));
  g.fillStyle = '#e8d29a';
  g.fillRect(0, px(CFG.CITY_R - 6), 512, px(CFG.CITY_R + 40) - px(CFG.CITY_R - 6));
  // City slab.
  g.fillStyle = '#8d8578';
  g.fillRect(px(-CFG.CITY_R - 15), px(-CFG.CITY_R - 15), px(CFG.CITY_R + 15) - px(-CFG.CITY_R - 15), px(CFG.CITY_R + 15) - px(-CFG.CITY_R - 15));
  // Blocks.
  g.fillStyle = '#a89a88';
  for (let ix = -CFG.GRID; ix < CFG.GRID; ix++) {
    for (let iz = -CFG.GRID; iz < CFG.GRID; iz++) {
      const cx = ix * CFG.PITCH + CFG.PITCH / 2;
      const cz = iz * CFG.PITCH + CFG.PITCH / 2;
      g.fillRect(px(cx - CFG.BLOCK / 2), px(cz - CFG.BLOCK / 2), px(cx + CFG.BLOCK / 2) - px(cx - CFG.BLOCK / 2), px(cz + CFG.BLOCK / 2) - px(cz - CFG.BLOCK / 2));
    }
  }
  // Harbor (east).
  g.fillStyle = '#7d8c99';
  g.fillRect(px(140), px(-CFG.CITY_R), px(CFG.CITY_R) - px(140), px(CFG.CITY_R) - px(-CFG.CITY_R));
  // Roads.
  g.strokeStyle = '#2e3138';
  g.lineWidth = 7;
  for (let i = -CFG.GRID; i <= CFG.GRID; i++) {
    const c = i * CFG.PITCH;
    g.beginPath(); g.moveTo(px(-CFG.CITY_R - 15), px(c)); g.lineTo(px(CFG.CITY_R + 15), px(c)); g.stroke();
    g.beginPath(); g.moveTo(px(c), px(-CFG.CITY_R - 15)); g.lineTo(px(c), px(CFG.CITY_R + 15)); g.stroke();
  }
  // Plaza.
  g.fillStyle = '#b8b0a0';
  g.beginPath(); g.arc(px(0), px(0), 9, 0, Math.PI * 2); g.fill();
  mapStatic = c;
}

export const HUD = {
  init(cb) {
    callbacks = cb;
    els = {
      money: $('hud-money'), healthFill: $('health-fill'), healthText: $('health-text'),
      stars: $('hud-stars'), weapon: $('hud-weapon'), ammo: $('hud-ammo'),
      clock: $('hud-clock'), speed: $('hud-speed'), objective: $('hud-objective'),
      objTitle: $('obj-title'), objText: $('obj-text'), objDist: $('obj-dist'),
      prompt: $('hud-prompt'), crosshair: $('crosshair'), minimap: $('minimap'),
      notif: $('hud-notif'), banner: $('banner'), bannerTitle: $('banner-title'),
      bannerText: $('banner-text'), vignette: $('hurt-vignette'),
      startScreen: $('start-screen'), pauseScreen: $('pause-screen'),
      overScreen: $('over-screen'), overTitle: $('over-title'), overText: $('over-text'),
      completeScreen: $('complete-screen'),
      btnStart: $('btn-start'), btnContinue: $('btn-continue'),
      btnResume: $('btn-resume'), btnSave: $('btn-save'), btnRestart: $('btn-restart'),
      btnRetry: $('btn-retry'), btnFree: $('btn-free'), btnKeepPlaying: $('btn-keep-playing'),
      btnMute: $('btn-mute'), saveMsg: $('save-msg'),
    };
    buildStaticMap();
    els.btnStart?.addEventListener('click', () => callbacks.onStart?.(false));
    els.btnContinue?.addEventListener('click', () => callbacks.onStart?.(true));
    els.btnResume?.addEventListener('click', () => callbacks.onResume?.());
    els.btnSave?.addEventListener('click', () => { if (callbacks.onSave?.()) { els.saveMsg.textContent = 'Game saved.'; setTimeout(() => { els.saveMsg.textContent = ''; }, 2500); } });
    els.btnRestart?.addEventListener('click', () => callbacks.onRestart?.());
    els.btnRetry?.addEventListener('click', () => callbacks.onRetry?.());
    els.btnFree?.addEventListener('click', () => callbacks.onFreeRoam?.());
    els.btnKeepPlaying?.addEventListener('click', () => callbacks.onKeepPlaying?.());
    els.btnMute?.addEventListener('click', () => callbacks.onMute?.());
  },

  showStart(hasSave) {
    els.startScreen.classList.remove('hidden');
    if (els.btnContinue) els.btnContinue.style.display = hasSave ? '' : 'none';
  },
  hideStart() { els.startScreen.classList.add('hidden'); },
  showPause() { els.pauseScreen.classList.remove('hidden'); },
  hidePause() { els.pauseScreen.classList.add('hidden'); },
  showOver(kind) {
    els.overTitle.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
    els.overTitle.style.color = kind === 'busted' ? '#5aa2ff' : '#ff4d4d';
    els.overText.textContent = kind === 'busted'
      ? 'The Solmar Bay PD caught up with Rio. The crew posted bail — but the mission is blown.'
      : 'Rio went down in the streets of Solmar Bay. The crew patched him up — but the mission is blown.';
    els.overScreen.classList.remove('hidden');
  },
  hideOver() { els.overScreen.classList.add('hidden'); },
  showStoryComplete() {
    els.completeScreen.classList.remove('hidden');
  },
  hideComplete() { els.completeScreen.classList.add('hidden'); },

  notify(text, color = '#ffffff') {
    const div = document.createElement('div');
    div.className = 'notif';
    div.style.borderLeftColor = color;
    div.textContent = text;
    els.notif.appendChild(div);
    while (els.notif.children.length > 3) els.notif.removeChild(els.notif.firstChild);
    setTimeout(() => { div.classList.add('fade'); setTimeout(() => div.remove(), 600); }, 4200);
  },

  banner(title, text, ms = 5000) {
    els.bannerTitle.textContent = title;
    els.bannerText.textContent = text;
    els.banner.classList.remove('hidden');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => els.banner.classList.add('hidden'), ms);
  },

  setPrompt(text) {
    if (!text) { els.prompt.classList.add('hidden'); return; }
    els.prompt.textContent = text;
    els.prompt.classList.remove('hidden');
  },

  update(dt) {
    const p = S.player;
    if (!p) return;
    els.money.textContent = fmtMoney(p.money);
    const hp = Math.max(0, Math.round(p.health));
    els.healthFill.style.width = hp + '%';
    els.healthFill.style.background = hp > 50 ? '#2ecc71' : hp > 25 ? '#f1c40f' : '#e74c3c';
    els.healthText.textContent = hp;
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < CFG.WANTED_MAX; i++) stars += i < S.wanted ? '★' : '☆';
    els.stars.textContent = stars;
    els.stars.style.color = S.wanted >= 4 ? '#ff4d4d' : S.wanted > 0 ? '#ffd23f' : '#888888';
    els.stars.classList.toggle('flash', S.wanted >= 4);
    // Weapon.
    const wName = p.weapon === 'smg' ? 'SMG' : 'PISTOL';
    const ammo = p.ammo[p.weapon];
    els.weapon.textContent = wName;
    els.ammo.textContent = isReloading() ? 'RELOADING…' : ammo.mag + ' / ' + ammo.res;
    els.clock.textContent = fmtClock(S.timeHours);
    if (!p.onFoot && p.car) {
      els.speed.textContent = Math.round(Math.abs(p.car.speed) * 3.6) + ' km/h';
      els.speed.classList.remove('hidden');
    } else els.speed.classList.add('hidden');
    // Objective.
    if (S.mission) {
      const step = S.mission.def.steps[S.mission.step];
      els.objTitle.textContent = S.mission.def.title.toUpperCase();
      let label = step ? step.label : '';
      if (step && step.kind === 'kill') label += ' (' + (S.mission.killsLeft ?? step.count) + ' left)';
      els.objText.textContent = label;
      if (step && step.x !== undefined) {
        const d = Math.round(Math.hypot(p.mesh.position.x - step.x, p.mesh.position.z - step.z));
        els.objDist.textContent = d + ' m';
      } else els.objDist.textContent = '';
      els.objective.classList.remove('hidden');
    } else if (S.storyDone) {
      els.objTitle.textContent = 'FREE ROAM';
      els.objText.textContent = 'Solmar Bay is yours. Explore, steal, survive.';
      els.objDist.textContent = '';
      els.objective.classList.remove('hidden');
    } else {
      els.objective.classList.add('hidden');
    }
    // Hurt vignette.
    els.vignette.style.opacity = String(clamp(p.hurtFlash, 0, 1) * 0.75 + (p.health < 30 ? 0.25 : 0));
    this.drawMinimap();
  },

  drawMinimap() {
    const cv = els.minimap;
    if (!cv) return;
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const p = S.player;
    if (!p) return;
    const px = p.mesh.position.x, pz = p.mesh.position.z;
    const heading = p.onFoot ? p.heading : (p.car ? p.car.heading : p.heading);
    g.clearRect(0, 0, W, H);
    // Rotating map: the player stays up, the world turns under them.
    g.save();
    g.beginPath();
    g.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#20242a';
    g.fillRect(0, 0, W, H);
    g.translate(W / 2, H / 2);
    g.rotate(heading - Math.PI); // player's forward ends up at the top
    const span = CFG.CITY_R * 2 + 120;
    const view = 230; // world units across the minimap
    const k = W / view; // px per world unit
    // Static map image aligned to world coords: map pixel = world * (512/span).
    const mpp = 512 / span; // map px per world unit
    const imgWorld = 512 / mpp; // world units the whole image covers
    g.drawImage(mapStatic, (-span / 2 - px) * k, (-span / 2 - pz) * k, imgWorld * k, imgWorld * k);
    // Blips (world -> rotated local).
    const blip = (x, z, color, r = 5, ring = false) => {
      const lx = (x - px) * k, lz = (z - pz) * k;
      if (Math.hypot(lx, lz) > W / 2) return;
      g.fillStyle = color;
      g.beginPath();
      g.arc(lx, lz, r, 0, Math.PI * 2);
      g.fill();
      if (ring) {
        g.strokeStyle = '#ffffff';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(lx, lz, r + 2.5, 0, Math.PI * 2);
        g.stroke();
      }
    };
    // Mission target.
    if (S.mission) {
      const step = S.mission.def.steps[S.mission.step];
      if (step && step.x !== undefined) {
        const pulse = 5 + Math.sin(S.elapsed * 5) * 1.5;
        blip(step.x, step.z, '#ffd23f', pulse, true);
      }
    }
    // Mission car.
    if (S.missionCar && !S.missionCar.dead) {
      blip(S.missionCar.mesh.position.x, S.missionCar.mesh.position.z, '#ff9f1c', 4, true);
    }
    // Police.
    const copColor = Math.floor(S.elapsed * 4) % 2 === 0 ? '#ff3b30' : '#2f7bff';
    for (const pc of S.policeCars) blip(pc.car.mesh.position.x, pc.car.mesh.position.z, copColor, 4);
    for (const c of S.footCops) if (!c.dead) blip(c.mesh.position.x, c.mesh.position.z, '#2f7bff', 3);
    // Enemies.
    for (const e of S.enemies) if (!e.dead) blip(e.mesh.position.x, e.mesh.position.z, '#ff3b30', 4);
    g.restore();
    // North marker (screen space: north sits opposite the heading).
    g.fillStyle = '#ffffff';
    g.font = 'bold 11px sans-serif';
    g.textAlign = 'center';
    g.fillText('N', W / 2 - Math.sin(heading) * (W / 2 - 14), H / 2 + Math.cos(heading) * (W / 2 - 14) + 4);
    // Player arrow (screen space, always up).
    g.save();
    g.translate(W / 2, H / 2);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#111111';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(6, 6);
    g.lineTo(-6, 6);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    // Ring.
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    g.stroke();
  },
};
