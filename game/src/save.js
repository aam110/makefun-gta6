// Palmera Heat — save game in localStorage.
// One versioned key holds cash, story progress, the player's position and
// lifetime stats. Saving never throws: a full or blocked store just means
// the save is skipped.

import { SAVE_KEY, ECONOMY } from './config.js';

export function defaultSave() {
  return {
    version: 1,
    cash: ECONOMY.startCash,
    nextMission: 0,
    completedMissions: [],
    storyComplete: false,
    player: { x: 0, z: 180, heading: Math.PI },
    health: 100,
    stats: { kills: 0, carsStolen: 0, missionsDone: 0, playSeconds: 0, busted: 0, wasted: 0 },
    savedAt: 0,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || typeof data.cash !== 'number') return null;
    const merged = defaultSave();
    merged.cash = data.cash;
    merged.nextMission = data.nextMission | 0;
    merged.completedMissions = Array.isArray(data.completedMissions) ? data.completedMissions : [];
    merged.storyComplete = !!data.storyComplete;
    if (data.player && typeof data.player.x === 'number') merged.player = data.player;
    if (typeof data.health === 'number') merged.health = data.health;
    if (data.stats) merged.stats = { ...merged.stats, ...data.stats };
    return merged;
  } catch (err) {
    return null;
  }
}

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      cash: Math.round(state.cash),
      nextMission: state.nextMission,
      completedMissions: state.completedMissions,
      storyComplete: state.storyComplete,
      player: {
        x: Math.round(state.player.x * 10) / 10,
        z: Math.round(state.player.z * 10) / 10,
        heading: state.player.heading,
      },
      health: Math.round(state.health),
      stats: state.stats,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (err) { /* ignore */ }
}

export function hasSave() {
  return loadSave() !== null;
}
