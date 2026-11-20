// CAYO BRAVO — shared constants, catalogues and the seeded random generator.
// Every name, place and vehicle here is original, invented for this game.

export const WORLD = {
  half: 300,            // playable half-extent in metres (600 x 600 city)
  roadGap: 60,          // grid spacing between streets
  roadWidth: 14,
  beachX: -255,         // west of this line: sand, then sea
  seaX: -295,
  sunsetHour: 18.07,    // golden hour start (18:04)
};

export const DISTRICTS = [
  { name: 'PUERTO ARENA', street: 'Arena Boulevard', x0: -300, x1: -180, z0: -300, z1: 300, heat: 12 },
  { name: 'MERCADO VIEJO', street: 'Calle del Mercado', x0: -180, x1: -60, z0: -300, z1: -40, heat: 28 },
  { name: 'BARRIO LUMBRE', street: 'Lumbre Avenue', x0: -180, x1: -60, z0: -40, z1: 300, heat: 41 },
  { name: 'ALTAVISTA', street: 'Torre Central', x0: -60, x1: 120, z0: -300, z1: 60, heat: 22 },
  { name: 'CORAL ROW', street: 'Coral Row', x0: -60, x1: 120, z0: 60, z1: 300, heat: 35 },
  { name: 'MARINA DEL SOL', street: 'Marina Esplanade', x0: 120, x1: 300, z0: -300, z1: 0, heat: 18 },
  { name: 'EL FARO', street: 'Faro Point Road', x0: 120, x1: 300, z0: 0, z1: 300, heat: 30 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return DISTRICTS[0];
}

// Deterministic RNG so every screenshot run stages the same city.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const VEHICLE_MODELS = [
  { name: 'VELAR STORM GT', body: 0xff5a1a, top: 62, accel: 26, grip: 2.6, kind: 'sport' },
  { name: 'COMETA S', body: 0x2fdcff, top: 55, accel: 22, grip: 2.4, kind: 'sport' },
  { name: 'BRISA COUPE', body: 0xffd21f, top: 48, accel: 19, grip: 2.2, kind: 'coupe' },
  { name: 'MARLIN SEDAN', body: 0xe8e8e8, top: 42, accel: 16, grip: 2.0, kind: 'sedan' },
  { name: 'LOBO PICKUP', body: 0x37e06a, top: 44, accel: 17, grip: 2.0, kind: 'truck' },
  { name: 'TIBURON GT', body: 0xc02fff, top: 58, accel: 24, grip: 2.5, kind: 'sport' },
  { name: 'SOL TAXI', body: 0xffc21f, top: 40, accel: 15, grip: 2.0, kind: 'sedan' },
  { name: 'CBPD INTERCEPTOR', body: 0xf2f2f2, top: 58, accel: 25, grip: 2.8, kind: 'police' },
];

export const WEAPONS = [
  { name: 'FISTS', ammo: Infinity, damage: 12, rate: 0.45, range: 2.6, auto: false },
  { name: 'P9', ammo: 72, damage: 22, rate: 0.28, range: 90, auto: false },
  { name: 'VIPER SMG', ammo: 150, damage: 14, rate: 0.09, range: 70, auto: true },
  { name: 'BREAKER 12G', ammo: 18, damage: 55, rate: 0.85, range: 30, auto: false },
  { name: 'LONGBOW', ammo: 24, damage: 90, rate: 1.1, range: 160, auto: false },
];

export const CREW = [
  { key: 'z', name: 'Nadia Kestrel', role: 'DRIVER', ability: 'SWAP PLATES', color: '#ff7a1a', initial: 'N', cooldown: 45,
    lines: ["Plates swapped — they lost the car, Río.", 'Fresh plates. Drive like you mean it.'] },
  { key: 'x', name: 'Tomás Ibarra', role: 'MECHANIC', ability: 'QUICK FIX', color: '#37e06a', initial: 'T', cooldown: 60,
    lines: ['Patched her up — good as new, boss.', 'Engine purrs again. Go get them.'] },
  { key: 'c', name: 'Selma Okafor', role: 'LOOKOUT', ability: 'EYES OUT', color: '#c02fff', initial: 'S', cooldown: 40,
    lines: ['Eyes up — I marked every unit on your map.', 'I see them all. Thread the gaps.'] },
];

export const RANKS = [
  { name: 'STREET RAT', rp: 0 }, { name: 'RUNNER', rp: 500 }, { name: 'HUSTLER', rp: 1200 },
  { name: 'FIXER', rp: 2600 }, { name: 'SHOT CALLER', rp: 5200 }, { name: 'KING OF CAYO', rp: 9000 },
];

export const RADIO_STATIONS = [
  { name: 'BRAVO 101.5', genre: 'Island Heat', track: 'Island Heat · Los Rayos del Sol', tempo: 112, scale: [0, 3, 5, 7, 10] },
  { name: 'SOL FM 88.2', genre: 'Sunset Groove', track: 'Marina Lights · Vela Roja', tempo: 96, scale: [0, 2, 4, 7, 9] },
  { name: 'ONDA 96.7', genre: 'Night Drive', track: 'Neon Tide · DJ Coral', tempo: 124, scale: [0, 3, 5, 6, 10] },
];

export const POLICE_CALLSIGNS = [
  'FALCON-7', 'VIPER-12', 'CORAL-9', 'TIDE-44', 'GECKO-21', 'MARLIN-3',
  'REEF-18', 'SOL-5', 'BRAVO-2', 'DUNE-31', 'ORCA-8', 'SIREN-27',
];
export const POLICE_TACTICS = ['RAMMING', 'FLANKING', 'CHASING', 'ROADBLOCK', 'SPOTLIGHT', 'MARKSMAN'];

export const PLAYER_NAME = 'Dario "Río" Voss';
export const CITY_NAME = 'CAYO BRAVO';
export const SAVE_KEY = 'cayobravo-save-';
export const SETTINGS_KEY = 'cayobravo-settings';

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2D(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
export function formatMoney(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
export function formatClock(hourFloat) {
  const h = Math.floor(hourFloat) % 24;
  const m = Math.floor((hourFloat % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
