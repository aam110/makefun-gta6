// Save / load through localStorage. Stores money, story progress, the
// player's spot, health, weapon and time of day — nothing else leaves the machine.
import { CFG, S } from './config.js';

export function hasSave() {
  try { return !!localStorage.getItem(CFG.SAVE_KEY); } catch { return false; }
}

export function saveGame() {
  if (!S.player) return false;
  try {
    const p = S.player;
    const data = {
      v: 1,
      money: p.money,
      health: p.health,
      missionIndex: S.missionIndex,
      storyDone: S.storyDone,
      timeHours: S.timeHours,
      x: p.mesh.position.x,
      z: p.mesh.position.z,
      heading: p.heading,
      weapon: p.weapon,
      ammo: p.ammo,
      stats: S.stats,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(CFG.SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return null;
    return d;
  } catch { return null; }
}

export function applySave(d) {
  const p = S.player;
  p.money = d.money ?? 0;
  p.health = d.health ?? CFG.PLAYER_HEALTH;
  S.missionIndex = d.missionIndex ?? 0;
  S.storyDone = !!d.storyDone;
  S.timeHours = d.timeHours ?? CFG.START_HOUR;
  p.mesh.position.set(d.x ?? 0, 0, d.z ?? 0);
  p.heading = d.heading ?? 0;
  p.weapon = d.weapon ?? 'pistol';
  p.ammo = d.ammo ?? { pistol: { mag: 12, res: 96 }, smg: { mag: 30, res: 120 } };
  Object.assign(S.stats, d.stats ?? {});
}

export function clearSave() {
  try { localStorage.removeItem(CFG.SAVE_KEY); } catch { /* noop */ }
}
