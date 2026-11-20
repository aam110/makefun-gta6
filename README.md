[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/aam110/makefun-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/aam110/makefun-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# CAYO BRAVO — an open-world crime game

One island. One crew. One last sunset before the Harbormaster owns it all.

**Cayo Bravo** is a complete open-world crime game in the spirit of GTA 6, playable
offline in a desktop browser from its own files — no network, no build step, just
`node serve.ts` and open http://localhost:8080. Built with Three.js (vendored),
every model, texture and sound is procedural: nothing is loaded from the internet.

## The story

Dario "Río" Voss, ex-boat racer, is back on Cayo Bravo — a sun-baked island city of
beach boulevards, neon towers and a lighthouse on the point. Don Aurelio Salas, the
Harbormaster, is buying the island pier by pier. Río rebuilds his crew — **Nadia
Kestrel** (driver), **Tomás Ibarra** (mechanic) and **Selma Okafor** (lookout) — and
runs 8 staged story missions to take it back, from a first light at the marina to a
5-star manhunt and a boat sailing into the sunset.

## What's in the game

- **A living island city** — 600×600 m of grid streets with markings, a dense
  downtown skyline, low beach blocks, palms, a boardwalk, umbrellas, a marina with
  moored boats and the El Faro lighthouse — all under golden-hour sunset light with
  long shadows and a violet-orange sky.
- **Driving + on foot** — arcade car physics with handbrake drifts, enter/exit any
  car, jack traffic cars (the driver flees and the CBPD notices), 8 named vehicle
  models with condition and damage smoke.
- **Traffic & pedestrians** — 26 cruising cars that brake for each other, 42
  islanders strolling the sidewalks and the beach, fleeing when shots ring out.
- **Police that hunt** — 1–5 wanted stars, named CBPD units with live tactics
  (RAMMING, FLANKING, ROADBLOCK, SPOTLIGHT, MARKSMAN), roadblocks at 3★, the AIR-1
  helicopter with a spotlight at 4★, and a real line-of-sight manhunt: break sight
  to cool the heat down.
- **Combat** — fists plus 4 firearms (P9, Viper SMG, Breaker 12G, Longbow) with ammo,
  reloads, tracers, muzzle flashes and raycast hits on peds and cars.
- **8 staged story missions** — drive, reach, wreck, eliminate and escape stages,
  each with a mission card (stage x/y, objective, NEXT objective), a beacon marking
  the target, timers, dialogue with character portraits, pay and RP rewards.
- **Crew abilities** — Z Swap Plates (−1 wanted), X Quick Fix (repair), C Eyes Out
  (blind ground units) — each with a cooldown.
- **Progression** — 6 ranks from STREET RAT to KING OF CAYO with an RP bar, money,
  health/armour, and a dense HUD: mission card, police response panel, weapon slots,
  crew buttons, rank, wanted stars, speedometer + vehicle name + condition, radio
  station, district name and a live street minimap.
- **Save / menus / sound** — title screen (NEW GAME / LOAD GAME / SETTINGS / HOW TO
  PLAY), 3 localStorage save slots, pause menu, settings (volume, sensitivity,
  quality, radio), and fully procedural WebAudio: engine hum, a generative radio
  with 3 stations, sirens, gunshots and mission stingers.

## Controls

| Keys | Action |
| --- | --- |
| W A S D | Drive / walk |
| Space | Handbrake |
| Shift | Run (on foot) |
| E | Enter / exit / jack a car |
| F | Punch |
| Mouse + click | Aim / shoot |
| 1–5 | Switch weapon · R reload |
| Z / X / C | Crew abilities |
| M | Next radio station |
| P / Esc | Pause |

## Screenshots

The 4 screenshots in `screenshots/` are real renders of the game, staged through
URL params that set up live game states (`?shot=chase`, `?shot=drive`,
`?shot=roadblock`, `?shot=mission` — see `shots.json` and `game/src/shots.js`).

## Source layout

One clear job per file under `game/src/`: `config.js` (catalogues), `world.js`
(city + sunset), `vehicles.js` (cars + physics), `traffic.js`, `pedestrians.js`,
`police.js` (wanted + pursuit), `missions.js` (8 story missions), `combat.js`,
`hud.js` (panels + minimap), `save.js`, `audio.js` (procedural WebAudio),
`effects.js` (particles), `input.js`, `player.js` (on-foot + camera), `shots.js`
(screenshot staging), `main.js` (entry + menus + game loop).

## License

MIT — see `LICENSE`. All names, characters, places and story are original.
