[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/aam110/makefun-gta6/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/aam110/makefun-gta6/reward.svg)](https://make.fun/bounty/gta6-01)

# Solmar Bay — an open-world crime game

Entry for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01) (gta6-01).

Rio Vale came to Solmar Bay to drive parcels. Fixer Mara has other plans: the
Vultures are squeezing the docks, the Harbor Kings want their streets back, and
the bay's police want Rio. Steal cars, run missions, lose the heat — and take
the city.

## The game

A complete open-world crime game in the browser — plain static files, no build
step, no network requests, fully offline. Three.js (vendored) renders a
sun-soaked coastal city; every sound is synthesized live with WebAudio.

- **The city** — a 9×9 road grid with four districts: downtown towers, the
  harbor docks, the beach boardwalk and the central plaza; a full day–dusk–night
  cycle with street lights and headlights after dark.
- **On foot and by car** — third-person movement, sprinting, and arcade driving
  with six car types (sedan, taxi, sport, van, truck, police).
- **Traffic and pedestrians** — 14 AI cars cruising the grid, turning at
  intersections and braking for the car ahead; 26 pedestrians strolling the
  sidewalks who flee gunfire and near-misses.
- **Steal cars** — walk up to any parked or stopped car and press **F**.
- **Wanted level 1–5** — pursuit cars that chase and ram, foot cops that arrest
  (or shoot at high wanted), a roadblock at five stars, heat that decays once
  you stay out of sight.
- **Five story missions** ($250–$1,500) — deliveries, a car theft, a harbor
  shootout, a police escape and a final showdown with gang boss Kestrel.
- **Combat** — pistol and SMG, hitscan shooting with wall blocking, drive-by
  shooting from the car, gang enemies with health bars and return fire,
  health/ammo/cash pickups.
- **HUD** — wanted stars, health, money, weapon/ammo, clock, speedometer,
  mission objective with distance, and a rotating circular minimap with live
  blips for the objective, police and enemies.
- **Start screen, pause, save** — progress (money, missions, position, time of
  day) saves to localStorage automatically and from the pause menu; Busted /
  Wasted screens with mission retry.

## Controls

| Key | Action |
|-----|--------|
| W A S D / arrows | Move / drive |
| Mouse drag | Look around |
| Mouse click | Shoot (hold for SMG) |
| Shift | Sprint |
| F | Steal / exit car |
| E | Interact |
| R | Reload |
| 1 / 2 | Pistol / SMG |
| P / Esc | Pause |
| M | Mute |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Or serve `game/` with any static HTTP server and open `index.html`.

## Layout

```
game/
  index.html            page, HUD, overlays
  src/
    main.js             entry point, game loop, camera
    config.js           tuning, story data, shared state
    world.js            city generation, day/night cycle
    vehicles.js         car builds + arcade driving physics
    traffic.js          AI traffic + parked cars
    pedestrians.js      sidewalk walkers (+ person builder)
    player.js           Rio: on-foot movement, stealing, health
    police.js           wanted level, pursuit, arrests
    combat.js           weapons, gang AI, pickups
    missions.js         the five-mission story
    hud.js              HUD, minimap, banners, overlays
    effects.js          particles, tracers, beacons, shake
    audio.js            synthetic WebAudio sound
    save.js             localStorage save/load
    shots.js            staged screenshot modes (?shot=...)
    input.js            keyboard + mouse
  vendor/
    three.module.min.js Three.js 0.160.0 (MIT)
main.ts                 entrypoint: copies game/ + screenshots/ to /output,
                        writes dossier.json with vendor/makefun-game.ts
screenshots/            4 staged renders of the game (1280×720)
```

## Screenshots

Staged modes, all real renders of the game's own code:

- `1-cover.jpg` — dusk chase, wanted ★★★, mission objective live
- `2-drive.jpg` — morning cruise on the beach road
- `3-chase.jpg` — night pursuit, wanted ★★★★
- `4-mission.jpg` — harbor shootout on foot

Capture them with `?shot=cover|drive|chase|mission` (see `shots.json`).

## License

MIT — see [LICENSE](LICENSE). An original game: its city, characters, names,
story, art and sounds are all new, with no affiliation to any commercial title.
