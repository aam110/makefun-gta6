// CAYO BRAVO — save.js: 3 save slots in localStorage plus settings.
// A save holds money, RP, mission progress, position, health and the clock.

import { SAVE_KEY, SETTINGS_KEY } from './config.js';

export function readSlot(slot) {
  try {
    const raw = localStorage.getItem(SAVE_KEY + slot);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function writeSlot(slot, data) {
  try {
    localStorage.setItem(SAVE_KEY + slot, JSON.stringify({ ...data, savedAt: Date.now() }));
    return true;
  } catch { return false; }
}

export function slotSummary(slot) {
  const s = readSlot(slot);
  if (!s) return null;
  const d = new Date(s.savedAt);
  return {
    mission: s.missionIndex + 1,
    money: s.money,
    rank: s.rankIndex,
    when: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
}

export function snapshotGame(G) {
  return {
    missionIndex: G.missions.index,
    missionStage: G.missions.stage,
    completed: G.missions.completed,
    money: G.player.money,
    rp: G.player.rp,
    rankIndex: G.player.rankIndex,
    health: G.player.health,
    armour: G.player.armour,
    wanted: 0,
    x: G.player.x,
    z: G.player.z,
    heading: G.player.heading,
    clock: G.clock,
    ammo: G.combat.ammo.slice(),
  };
}

export function applySnapshot(G, s) {
  G.missions.index = s.missionIndex;
  G.missions.stage = s.missionStage;
  G.missions.completed = s.completed;
  G.player.money = s.money;
  G.player.rp = s.rp;
  G.player.rankIndex = s.rankIndex;
  G.player.health = s.health;
  G.player.armour = s.armour;
  G.player.wanted = 0;
  G.player.x = s.x;
  G.player.z = s.z;
  G.player.heading = s.heading;
  G.player.mesh.position.set(s.x, 0, s.z);
  G.clock = s.clock;
  G.combat.ammo = s.ammo.slice();
}

export function readSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch { return {}; }
}

export function writeSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}
