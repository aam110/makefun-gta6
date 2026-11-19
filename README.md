# Palmera Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/aam110/makefun-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/aam110/makefun-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Palmera Heat** is a complete open-world crime game in the browser, built for the [make.fun](https://make.fun) **gta6-01 — Make GTA 6** competition. It runs entirely offline from static files: a Three.js city, a five-mission story, traffic, pedestrians, police chases, combat, a minimap HUD and a save — no network request, no build step.

## The game

Sun, salt, and stolen cars. **Mara Voss**, the best getaway driver Palmera City ever had, comes home after three years away to find the **Meridian Syndicate** squeezing every street. With **Theo Brandt**, a garage mechanic, and **Lena Kaur**, a hacker with the syndicate's books, she drives, steals and fights her way to the syndicate's boss, **Vera Castellan** — and burns the whole operation down.

### Story — five missions

1. **Homecoming Heat** — Steal a car and reach Theo's Garage.
2. **The Ledger Run** — Pick up Lena, grab three dead drops, lose the cops.
3. **Neon Tide** — A timed boardwalk race against the syndicate's street crew.
4. **The Meridian Job** — Walk into the Meridian Casino, take the vault case, escape a 3-star wanted level.
5. **Heatwave** — Run Vera Castellan's armoured limo off the road and vanish into the sunset at Sunset Marina.

### Systems

- **Open city** — a seeded procedural grid city: 100+ buildings, palm avenues, a beach, ocean, marina, lighthouse, stadium, park, casino tower, police station and hospital.
- **On foot and by car** — run, sprint, jump, punch and shoot on foot; steal any parked or slow car and drive with arcade handling, handbrake drifts and a horn.
- **Traffic and pedestrians** — cars follow road lanes and turn at intersections; pedestrians stroll the sidewalks and flee from gunfire.
- **Wanted level and police** — 0–5 stars from heat: stealing, assault, gunfire and killing a cop all raise it. Police cars chase and ram; foot cops hunt on foot from two stars up. Break line of sight to cool off; get caught standing still and it's BUSTED.
- **Combat** — pistol with crosshair aiming, car ramming, explosions, health and damage.
- **HUD with minimap** — wanted stars, cash, health, mission objective with timer, speedometer, and a live circular minimap with mission, police and target blips.
- **Start screen, pause menu, save** — new game / continue, how-to-play, pause with save and mission restart; progress auto-saves and persists in localStorage.
- **Sound** — fully synthesized WebAudio: engine hum, sirens, gunshots, explosions, pickups, and a synthwave bassline. No audio files.
- **Staging hooks** — `?shot=cover|drive|chase|mission&seed=N` arranges a composed, deterministic scene for screenshots.

## How to play

Serve `game/` with any static server and open `index.html` in desktop Chrome:

```sh
node serve.ts
# then open http://localhost:8080
```

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse | Look (click to lock the pointer) |
| Arrow keys | Turn camera |
| Shift | Sprint |
| Space | Jump / handbrake |
| E | Steal / exit car · interact |
| Left click | Shoot |
| F | Punch |
| H | Horn |
| M | Mute |
| Esc / P | Pause |

Follow the golden **M** on the minimap to start the next story mission. Your safehouse heals you and saves the game.

## Layout

```
game/
  index.html            page shell, HUD, screens, import map
  css/style.css         HUD and menu styling
  vendor/three.module.min.js   Three.js 0.160.0 (vendored, minified)
  src/
    main.js             bootstrap, loop, screens, game events
    config.js           tuning, palette, city layout, landmarks
    rng.js              seeded RNG (deterministic city)
    city.js             procedural city, ground plan, collision
    vehicles.js         car factory, driving physics, traffic AI
    pedestrians.js      pedestrians and foot cops
    player.js           Mara on foot, combat, car entry
    police.js           wanted system and police chase AI
    missions.js         the five-mission story arc
    hud.js              HUD, minimap, banners, subtitles
    camera.js           third-person chase camera
    effects.js          particles, explosions, flashes
    audio.js            synthesized WebAudio sound
    input.js            keyboard and mouse
    save.js             localStorage save/load
    staging.js          deterministic screenshot staging
main.ts                 the entry program: copies game/ + screenshots/,
                        writes dossier.json with vendor/makefun-game.ts
screenshots/            four real renders of the game
```

## Originality

Everything in Palmera Heat is invented for this entry: the city of Palmera, its characters (Mara Voss, Theo Brandt, Lena Kaur, Vera Castellan), its story, its names, its art and its synthesized music. Nothing is taken from Rockstar Games' Grand Theft Auto series or any other commercial game.

## License

MIT — see [LICENSE](LICENSE).
