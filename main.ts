// Palmera Heat — the gta6-01 entry program (Node 22, standard library only).
//
// What it does: copy this repository's game/ (the playable static game) and
// screenshots/ (four renders of the game itself) into the output directory,
// then write dossier.json with make.fun's own library, exactly the summary
// the sealed scorer rebuilds and compares byte for byte.
//
// The grader runs this program twice in a fresh container with no network,
// a read-only copy of the repository and a writable /output; both runs must
// write identical bytes. Nothing here depends on time, randomness or the
// environment beyond the output directory, so the output is deterministic.
//
// Local check:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(name: string): void {
  const from = join(repoRoot, name);
  const to = join(outDir, name);
  if (!existsSync(from)) return;
  // Start clean so a stale file from an earlier run can never survive.
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree('game');
copyTree('screenshots');

// The gate's caps from the competition kit (reference/gate.json): only
// text_max_bytes shapes the dossier's bytes; the rest make this program
// fail exactly where the scorer would refuse the entry.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
