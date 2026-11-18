// SOLMAR BAY — shared constants, palette, districts and tiny math helpers.
// Every other module imports from here. Nothing here touches the DOM or Three.js.

export const TAU = Math.PI * 2;

// ---- City layout (units are roughly metres) ----
export const CITY_HALF = 180;          // playable square is [-180, 180] on x and z
export const ROAD_SPACING = 40;
export const ROAD_HALF = 6;            // asphalt is 12 wide
export const SIDEWALK_HALF = 9;        // sidewalk edge
export const LANE = 3;                 // lane offset from a road centre line
export const ROAD_COORDS = [-160, -120, -80, -40, 0, 40, 80, 120, 160];
export const BEACH_Z = 168;            // sand starts here (south edge)
export const WATER_Z = 205;            // sea starts here
export const DAY_LENGTH_MIN = 8;       // one real minute = 8 in-game minutes

// ---- Player / economy ----
export const START_MONEY = 150;
// South of the plaza on 1st Avenue — deliberately away from Mission 1's
// start marker (6, 26), so a new game never auto-starts the mission.
export const START_POS = { x: 6, z: 60 };
export const SAVE_KEY = 'solmar-bay-save-v1';

// ---- Palette ----
export const PALETTE = {
  asphalt: 0x2b2f38,
  sidewalk: 0x9aa0a8,
  ground: 0x3f6b4f,
  sand: 0xe8d29a,
  water: 0x1e6f9e,
  building: [0xd8d3c8, 0xc9b8a3, 0xa8b6c4, 0x8fa3b8, 0xb8a88f, 0x9fb0a0, 0xc4a4a4, 0x7d8aa0],
  downtown: [0x5b6b82, 0x7486a0, 0x4a5a70, 0x8fa0b5, 0x64748f, 0x3f4c63],
  car: [0xc23b3b, 0x2e7fd9, 0xf2c230, 0x35b06a, 0xe8e8e8, 0x22242a, 0x8a4fd3, 0xef7d1a, 0x18b7a6, 0xd94f8a],
  pedShirt: [0xe5484d, 0x2e7fd9, 0xf2a007, 0x35b06a, 0x8a4fd3, 0xef7d1a, 0x18b7a6, 0xe8e8e8, 0x5b6b82],
  pedSkin: [0xf2c49b, 0xc98d5e, 0x8a5a3b, 0xf7d7b0, 0x6b4426],
};

// ---- Weapons ----
export const WEAPONS = {
  pistol: { name: 'P9 Pistol', damage: 34, rate: 0.28, range: 60, spread: 0.012, mag: 12, reserveMax: 96, reload: 0.9, auto: false, tracer: 0xffe08a },
  smg: { name: 'VK-9 SMG', damage: 18, rate: 0.09, range: 45, spread: 0.045, mag: 30, reserveMax: 180, reload: 1.4, auto: true, tracer: 0x9fd8ff },
};

// ---- Wanted ----
export const WANTED_LABEL = ['', 'Heat', 'Heat', 'Manhunt', 'Manhunt', 'Lockdown'];
export const MAX_WANTED = 5;

// ---- Tiny math helpers ----
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export function angleLerp(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export const distXZ = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export function nearestRoadCoord(v) {
  let best = ROAD_COORDS[0];
  let bd = Infinity;
  for (const c of ROAD_COORDS) {
    const d = Math.abs(c - v);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
export function isOnRoad(x, z) {
  for (const c of ROAD_COORDS) {
    if (Math.abs(x - c) <= ROAD_HALF || Math.abs(z - c) <= ROAD_HALF) return true;
  }
  return false;
}
export function districtAt(x, z) {
  if (z >= BEACH_Z) return 'Solmar Beach';
  if (x >= 120) return 'Harbor District';
  if (Math.abs(x) <= 80 && Math.abs(z) <= 80) return 'Downtown';
  if (z <= -120) return 'North Hills';
  if (x <= -120) return 'West Suburbs';
  return 'Midtown';
}
export const fmtMoney = (n) => '$' + Math.floor(n).toLocaleString('en-US');
export function fmtClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
export function headingToCompass(heading) {
  // heading is radians, 0 = -z (north). Returns e.g. "N", "NE".
  const deg = (((-heading * 180) / Math.PI) % 360 + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}
