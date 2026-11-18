// SOLMAR BAY — gta6-01 entrypoint (Node 22, standard library only).
// The game is the static game/ folder beside this file: index.html plus ES
// modules, Three.js vendored under game/vendor/, no build step, no network
// at runtime. This program hands it in: it copies game/ and screenshots/
// into the output directory and writes dossier.json, the summary the judge
// reads, using the vendored make.fun library.
//
// Play it locally first with `node serve.ts`, then http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The scorer's caps (reference/gate.json): only text_max_bytes shapes the
// dossier bytes; the rest refuse an entry the scorer would refuse — at most
// 4 screenshots, each at most 256 KiB; game/ at most 993 files and 48 MiB
// in all, no path under game/ longer than 1000 bytes.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
