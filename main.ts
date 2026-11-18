// Solmar Bay — entrypoint for the make.fun gta6-01 bounty (Node 22, stdlib only).
// The game is plain static files under game/ (Three.js, vendored) plus the four
// screenshots under screenshots/. This program hands the entry in: it copies
// both trees to the output directory and writes dossier.json with the kit's
// vendored buildDossier, exactly as the gate re-derives it. It is deterministic:
// run it twice and every byte matches.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Determinism check: run it into two directories and diff them —
// `diff -r out1 out2` must be empty. The game files are static and the
// dossier is derived only from their bytes, so nothing here varies by run.
// Play it locally with `node serve.ts` (http://localhost:8080).

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(name: string): void {
  const src = join(repoRoot, name);
  if (!existsSync(src)) return;
  cpSync(src, join(outDir, name), { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree('game');
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
copyTree('screenshots');

// The scorer's own caps (see the competition's reference/gate.json): only
// text_max_bytes shapes the dossier's bytes; the rest refuse an entry the
// scorer would refuse anyway (too many/large screenshots, too many game files).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

// A short summary on stderr only: the grader compares /output's bytes, so
// logging here can never change the entry, but it makes a local run legible.
const shotCount = existsSync(join(outDir, 'screenshots'))
  ? readdirSync(join(outDir, 'screenshots')).filter((f) => !f.startsWith('.')).length
  : 0;
console.error(`Solmar Bay handed in: game/ + ${shotCount} screenshot(s) + dossier.json (${dossier.length} bytes) -> ${outDir}`);
