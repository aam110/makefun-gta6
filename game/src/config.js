// Solmar Bay — shared configuration and mutable game state.
// Every system imports CFG (tuning) and S (the live world) from here, so the
// modules stay decoupled: main.js wires them together, nothing else imports main.
import * as THREE from 'three';

export const CFG = {
  // City layout: a 9x9 grid of roads; blocks sit between them.
  PITCH: 54,            // road centre to road centre
  ROAD_W: 14,           // asphalt width
  BLOCK: 40,            // block width (PITCH - ROAD_W)
  GRID: 4,              // roads at -4..4 * PITCH
  CITY_R: 243,          // half-extent of the drivable city
  LANE: 3.5,            // lane offset from a road centre line
  // Player
  WALK_SPEED: 7,
  SPRINT_SPEED: 11.5,
  PLAYER_RADIUS: 0.7,
  PLAYER_HEALTH: 100,
  // Cars
  CAR_ACCEL: 16,
  CAR_MAX_SPEED: 34,    // sport cars go faster (see CAR_TYPES)
  CAR_REVERSE: 12,
  CAR_TURN: 1.9,
  CAR_RADIUS: 1.9,
  // Wanted / police
  WANTED_MAX: 5,
  BUST_TIME: 1.6,
  // World clock: one full day lasts 8 real minutes.
  DAY_SECONDS: 480,
  START_HOUR: 10.2,
  // Traffic / crowd
  TRAFFIC_COUNT: 14,
  PED_COUNT: 26,
  // Save
  SAVE_KEY: 'solmar-bay-save-v1',
};

// Sun-soaked coastal palette.
export const PALETTE = {
  skyDay: new THREE.Color(0x87b5e0),
  skyDusk: new THREE.Color(0xf2a35e),
  skyNight: new THREE.Color(0x0b1026),
  sunDay: new THREE.Color(0xfff2d0),
  sunNight: new THREE.Color(0x8fa8ff),
  asphalt: 0x2e3138,
  sidewalk: 0x9a938a,
  sand: 0xe8d29a,
  ocean: 0x1d6f8f,
  grass: 0x5d8a4a,
};

// Car archetypes: [body length, width, height, top speed, accel factor, colours]
export const CAR_TYPES = {
  sedan:  { len: 4.4, wid: 2.0, h: 0.85, top: 30, acc: 1.0, colors: [0xb03a2e, 0x2e6fb0, 0xd8d8d8, 0x3a3f44, 0x7fb069] },
  taxi:   { len: 4.4, wid: 2.0, h: 0.85, top: 30, acc: 1.0, colors: [0xf2c200] },
  sport:  { len: 4.2, wid: 2.0, h: 0.7,  top: 40, acc: 1.45, colors: [0xc21807, 0x1565c0, 0xffd600, 0x111111] },
  van:    { len: 5.2, wid: 2.1, h: 1.5,  top: 24, acc: 0.8, colors: [0xe8e8e8, 0x607d8b, 0x8d6e63] },
  truck:  { len: 6.4, wid: 2.3, h: 1.6,  top: 22, acc: 0.7, colors: [0x9e9e9e, 0x4e342e, 0x37474f] },
  police: { len: 4.5, wid: 2.0, h: 0.85, top: 36, acc: 1.25, colors: [0x11151c] },
};

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, rate: 0.32, mag: 12, reserve: 96, spread: 0.012, range: 90, auto: false, kick: 0.35 },
  smg:    { name: 'SMG',    damage: 18, rate: 0.09, mag: 30, reserve: 180, spread: 0.045, range: 70, auto: true,  kick: 0.18 },
};

// The story: courier Rio Vale, fixer Mara, gangs Vultures vs Harbor Kings.
export const MISSIONS = [
  {
    id: 'first-run', title: 'First Run', pay: 250,
    brief: 'Mara: "Rio, a parcel waits at the downtown courier desk. Bring it to the Harbor Kings. No detours."',
    steps: [
      { kind: 'goto', label: 'Pick up the parcel downtown', x: 54, z: -54, radius: 6, interact: 'Take the parcel' },
      { kind: 'goto', label: 'Deliver it to the harbor contact', x: 216, z: 27, radius: 6, interact: 'Hand over the parcel' },
    ],
  },
  {
    id: 'hot-wheels', title: 'Hot Wheels', pay: 400,
    brief: 'Mara: "The Vultures parked a cherry-red sport car near the plaza. Steal it, bring it to the chop shop. The alarm will scream — drive fast."',
    steps: [
      { kind: 'steal', label: 'Steal the marked sport car', x: 59, z: 27, radius: 5 },
      { kind: 'deliver-car', label: 'Deliver the car to the chop shop', x: -216, z: -54, radius: 8 },
    ],
  },
  {
    id: 'harbor-heat', title: 'Harbor Heat', pay: 700,
    brief: 'Mara: "Vultures are shaking down the docks. Clear them out and grab their crate. The Kings will remember this."',
    steps: [
      { kind: 'goto', label: 'Reach the harbor docks', x: 216, z: 108, radius: 10 },
      { kind: 'kill', label: 'Clear out the Vultures', x: 216, z: 108, count: 4 },
      { kind: 'goto', label: 'Grab the crate and take it to Mara', x: 216, z: 108, radius: 5, interact: 'Grab the crate' },
      { kind: 'goto', label: 'Bring the crate to Mara', x: -54, z: -108, radius: 6, interact: 'Deliver the crate' },
    ],
  },
  {
    id: 'heat-wave', title: 'Heat Wave', pay: 1000,
    brief: 'Mara: "The whole bay is looking for you now. Lose the heat, then lie low at the safehouse. Do NOT get caught."',
    steps: [
      { kind: 'escape', label: 'Lose the police (get your wanted level to 0)' },
      { kind: 'goto', label: 'Reach the safehouse', x: -108, z: 162, radius: 7 },
    ],
  },
  {
    id: 'bay-showdown', title: 'Bay Showdown', pay: 1500,
    brief: 'Mara: "Kestrel himself is at the plaza with his crew. End this, Rio — and Solmar Bay is yours."',
    steps: [
      { kind: 'goto', label: 'Go to the plaza', x: 0, z: 0, radius: 12 },
      { kind: 'kill', label: 'Take down Kestrel and his crew', x: 0, z: 0, count: 8, boss: true },
    ],
  },
];

// ---- small math helpers -------------------------------------------------
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function fmtMoney(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
export function fmtClock(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// ---- live game state ----------------------------------------------------
// main.js fills in scene/camera/renderer; systems read and mutate the rest.
export const S = {
  scene: null, camera: null, renderer: null,
  started: false, paused: false, over: false, overKind: null,
  storyDone: false,
  timeHours: CFG.START_HOUR,
  colliders: [],        // {minX,maxX,minZ,maxZ}
  lamps: [],            // lamp head materials (glow at night)
  headlightMeshes: [],  // emissive headlight cones, lit at night
  traffic: [],          // AI cars
  peds: [],             // pedestrians
  policeCars: [],
  footCops: [],
  enemies: [],
  pickups: [],
  parked: [],           // stealable parked cars (incl. mission target)
  particles: [],
  tracers: [],
  player: null,         // set by player.js
  wanted: 0,
  wantedHeat: 0,        // fractional heat; whole stars shown
  lastSeenAt: -99,
  elapsed: 0,
  shake: 0,
  missionIndex: 0,      // next mission to start (0..5); 5 = story done
  mission: null,        // active mission runtime state
  missionCar: null,     // the marked car for Hot Wheels
  beacon: null,         // current objective beacon mesh
  blips: [],            // minimap blips: {x, z, color, pulse}
  interactTarget: null, // {label, fn} when player is near something usable
  shotMode: null,       // ?shot= cover|drive|chase|mission
  muted: false,
  stats: { shots: 0, hits: 0, kills: 0, carsStolen: 0, missionsDone: 0 },
};
