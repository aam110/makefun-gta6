# Solmar Bay — Make GTA 6

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/aam110/makefun-gta6/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/aam110/makefun-gta6/reward.svg)](https://make.fun/c/gta6-01)

A [make.fun](https://make.fun/c/gta6-01) entry for **gta6-01** — an original
open-world crime game. 100% original fiction: no GTA or Rockstar content.

## The game

**Solmar Bay** — a fictional coastal city at sunset. Courier **Rio Vale** is
dragged into a gang war between the **Vultures** and the **Harbor Kings** by
fixer **Mara**. On foot and behind the wheel, across downtown, the harbour,
the beach boardwalk and the plaza.

- **Living 3D city** — 9×9 street grid, ~60 lit buildings, downtown towers,
  harbour cranes, pier + ferris wheel, plaza fountain, full collision.
- **Traffic & pedestrians** — 14 AI cars following lanes, 26 pedestrians who
  flee gunfire, crashes and explosions.
- **Steal cars** — press F: the driver bails and runs, the car is yours.
- **Wanted 1–5 + police** — patrol cars ram and chase, foot cops pursue and
  bust you (fine + respawn), shootouts at 3 stars and up; stars cool down
  after 10 seconds unseen.
- **5 story missions** — First Delivery → Hot Wheels → Harbor Trouble →
  The Long Way Home → Bay Showdown (boss Kestrel, 260 HP), $250–$1,500 each.
- **Combat** — pistol & SMG (mag/reload/ammo), drive-by shooting, enemies
  shoot back, health + armor, cash/health/armor/ammo pickups, exploding cars.
- **HUD + minimap** — stars, cash, game clock, district, compass, objective
  panel, health/armor bars, weapon + ammo, speedometer, rotating circular
  minimap (roads, player, flashing police, objectives, enemies).
- **Menu + save** — start screen (New/Continue, 5 jacket colours), localStorage
  save/load, pause menu, Busted/Wasted/Complete screens.
- **Polish** — day → dusk → night cycle, particles/skid marks/exhaust smoke,
  100% synthetic WebAudio sound (engine, sirens, gunfire, pickups), smooth
  third-person + driving cameras, screen shake.

## Controls

WASD move/drive · Mouse aim · Click shoot · F steal car / enter car ·
R reload · Shift sprint · Esc pause.

## Run it

```sh
node serve.ts
```

Then open the local page in a desktop browser. Screenshots in `screenshots/`
were rendered from the real game code (Playwright, 1280×720).

## Entry

- Competition: gta6-01 ("Make GTA 6"), $1,666 escrow, 100 paid places
- Entrant: [@silowek](https://make.fun) · GitHub: [aam110](https://github.com/aam110)
- Built with Muse; Three.js 0.160.0 vendored under `game/vendor/`
- License: MIT — see LICENSE
