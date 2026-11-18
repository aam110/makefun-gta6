// localStorage save / load. Plain JSON, versioned, defensive against bad data.

import { SAVE_KEY, START_MONEY, START_POS } from './config.js';

export function defaultSave() {
  return {
    version: 1,
    money: START_MONEY,
    missionIndex: 0,
    missionsDone: 0,
    x: START_POS.x,
    z: START_POS.z,
    heading: Math.PI,
    health: 100,
    armor: 0,
    wanted: 0,
    hour: 17.5,
    jacket: '#18b7a6',
    smgUnlocked: false,
    smgReserve: 0,
    savedAt: Date.now(),
  };
}

export function hasSave() {
  try { return localStorage.getItem(SAVE_KEY) !== null; } catch { return false; }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || data.version !== 1) return null;
    return { ...defaultSave(), ...data };
  } catch { return null; }
}

export function writeSave(state) {
  try {
    const data = { ...defaultSave(), ...state, version: 1, savedAt: Date.now() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch {}
}
