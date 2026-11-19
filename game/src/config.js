// Palmera Heat — shared tuning, palette and city layout.
// Every number the rest of the game agrees on lives here, so the city,
// the traffic, the missions and the minimap all describe the same place.

export const SAVE_KEY = 'palmera-heat-save-v1';
export const GAME_TITLE = 'PALMERA HEAT';

// --- City grid -------------------------------------------------------------
// Roads run every 64 units; blocks sit between them. The grid is square,
// the beach and the ocean lie to the east (positive x).
export const CITY = {
  half: 330,
  roadSpacing: 64,
  roadWidth: 14,
  sidewalk: 5,
  blockSize: 50,
  roads: [-320, -256, -192, -128, -64, 0, 64, 128, 192, 256, 320],
  beachRoadX: 352,
  beachX: 336,
  sandX: 344,
  oceanX: 398,
  groundMinX: -450,
  groundMaxX: 750,
  groundMinZ: -450,
  groundMaxZ: 450,
};

// Block centres sit halfway between neighbouring roads.
export const BLOCK_CENTERS = [-288, -224, -160, -96, -32, 32, 96, 160, 224, 288];

// --- Landmarks (block centres, or beach coordinates) -----------------------
export const LANDMARKS = {
  casino: { x: 96, z: -96, name: 'Meridian Casino' },
  garage: { x: -96, z: 96, name: "Theo's Garage" },
  apartment: { x: -32, z: -160, name: "Lena's Apartment" },
  safehouse: { x: 160, z: 160, name: "Mara's Safehouse" },
  stadium: { x: -224, z: -224, name: 'Palmera Bowl' },
  park: { x: 224, z: -224, name: 'Coral Gardens' },
  policeStation: { x: -160, z: 32, name: 'Palmera PD' },
  hospital: { x: 32, z: 224, name: 'St. Selma Hospital' },
  marina: { x: 372, z: 224, name: 'Sunset Marina' },
  lighthouse: { x: 372, z: -288, name: 'North Point Light' },
  boardwalk: { x: 352, z: 0, name: 'Boardwalk' },
  plaza: { x: 32, z: -32, name: 'Meridian Plaza' },
};

// Blocks that hold a landmark instead of ordinary buildings.
export const LANDMARK_BLOCKS = new Set([
  '96,-96', '-96,96', '-32,-160', '160,160', '-224,-224',
  '224,-224', '-160,32', '32,224', '32,-32', '160,-96',
]);

// --- Sun-soaked palette ----------------------------------------------------
export const PALETTE = {
  sky: 0x8fd2ef,
  fog: 0xcfe9f4,
  sun: 0xfff2d0,
  sunIntensity: 2.6,
  hemiSky: 0xbfe3ff,
  hemiGround: 0x8a7a5a,
  hemiIntensity: 1.1,
  grass: 0x86b364,
  grassDry: 0xa8bd6a,
  asphalt: 0x3d4148,
  sidewalk: 0xd9cfb8,
  sand: 0xecd9a0,
  ocean: 0x2f9bc4,
  oceanDeep: 0x1b6ea6,
  building: [
    0xf2e3c9, 0xe8b4a0, 0x9fc8c0, 0xd9a441, 0xf5f0e6,
    0xc96f5a, 0x7fb3d5, 0xe6d8b8, 0xb7a6d9, 0x8fbc8f,
  ],
  downtown: [0xdfe8ee, 0xc7d6e2, 0xe8e2d4, 0xb9cdd6],
  casinoGlass: 0x2e6f8e,
  casinoGold: 0xe8b93c,
};

// --- Player / vehicle tuning ----------------------------------------------
export const PLAYER = {
  walkSpeed: 6.5,
  sprintSpeed: 10.5,
  radius: 0.7,
  maxHealth: 100,
  jumpSpeed: 8.5,
  gravity: 22,
};

export const CAR = {
  maxSpeed: 34,
  sportMaxSpeed: 42,
  accel: 16,
  brake: 30,
  reverseMax: 10,
  steerRate: 1.9,
  radius: 2.3,
  maxHealth: 100,
};

export const WANTED = {
  maxStars: 5,
  heatPerStar: 200,
  steal: 120,
  hitPed: 150,
  killPed: 260,
  shoot: 70,
  killCop: 420,
  ramCop: 160,
  decayHidden: 9,
  decaySeen: 2,
  bustedSeconds: 2.5,
};

export const CAR_COLORS = [
  0xc23b2e, 0x2e6fc2, 0xe8c33c, 0x3aa655, 0xe8e8e8, 0x222222,
  0xd97b2e, 0x7a4fb0, 0x38b8b0, 0xb03a6b, 0x8a9a5b, 0x4a5d7a,
];

export const PED_SHIRTS = [
  0xe85d4a, 0x4a90e8, 0xf2c14e, 0x7bc47f, 0xe8e8e8, 0x9b59b6,
  0x1abc9c, 0xe67e22, 0x34495e, 0xf1948a, 0x5dade2, 0x58d68d,
];

export const PED_SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
export const PED_PANTS = [0x2c3e50, 0x5d6d7e, 0x6e2c00, 0x1a5276, 0x4d5656];

// Mission rewards and story beats live in missions.js; this is the cash the
// player starts with and what a bust or a hospital visit costs.
export const ECONOMY = {
  startCash: 250,
  bustedFine: 200,
  wastedBill: 150,
  taxiFare: 0,
};
