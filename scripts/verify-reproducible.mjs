#!/usr/bin/env node
/**
 * Check that catalog payloads can be rebuilt from this repo byte-for-byte.
 *
 * This guards the recovery path. `catalog.json` pins a sha256, so if a release
 * asset is ever lost or a release is retagged, the only clean fix is to rebuild
 * the identical tarball. That is impossible for anything packed with a plain
 * `tar -czf`, which bakes in filesystem mtimes.
 *
 * Entries listed in LEGACY_UNREPRODUCIBLE predate scripts/pack-skill.mjs and are
 * reported but not fatal. They leave the list on their own: the next version
 * published through scripts/publish-skill.mjs matches, and the entry can be
 * deleted from the list below.
 *
 *   node scripts/verify-reproducible.mjs
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { packSkill } from './pack-skill.mjs';

/** id@version pairs packed before deterministic packing existed. Do not add to this list. */
const LEGACY_UNREPRODUCIBLE = new Set([
  'gaeb-import@0.1.0',
  'meeting-transcriber@0.1.1',
  'excel-artifact-guide@0.1.3',
  'artifact-reviewer@0.1.3',
  'presentation-deck@0.2.1',
]);

const root = process.cwd();
const catalog = JSON.parse(readFileSync(path.join(root, 'catalog.json'), 'utf8'));
const outDir = mkdtempSync(path.join(tmpdir(), 'tpm-repro-'));

const failures = [];
const legacy = [];
const skipped = [];
let checked = 0;

for (const entry of catalog.skills) {
  const key = `${entry.id}@${entry.version}`;
  const skillDir = path.join(root, 'skills', entry.id);

  if (!existsSync(skillDir)) {
    skipped.push(`${key} (no source in this repo)`);
    continue;
  }

  let built;
  try {
    built = packSkill(root, entry.id, outDir);
  } catch (err) {
    (LEGACY_UNREPRODUCIBLE.has(key) ? legacy : failures).push(`${key}: pack failed — ${err.message}`);
    continue;
  }

  if (built.version !== entry.version) {
    // Source has moved on past the published version. Not this check's problem —
    // verify-catalog.mjs --remote covers whether the published entry is intact.
    skipped.push(`${key} (source is at ${built.version})`);
    continue;
  }

  checked++;
  if (built.sha256 !== entry.payload.sha256) {
    const msg =
      `${key}: rebuild sha256 ${built.sha256} ≠ catalog ${entry.payload.sha256}. ` +
      `Repack with scripts/publish-skill.mjs so the payload is reproducible.`;
    (LEGACY_UNREPRODUCIBLE.has(key) ? legacy : failures).push(msg);
  } else if (LEGACY_UNREPRODUCIBLE.has(key)) {
    legacy.push(`${key}: now reproducible — remove it from LEGACY_UNREPRODUCIBLE.`);
  }
}

for (const line of skipped) console.log(`skip  ${line}`);
for (const line of legacy) console.warn(`warn  ${line}`);

if (failures.length > 0) {
  console.error(`\nNon-reproducible catalog payload(s):\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}

console.log(`\nChecked ${checked} payload(s) for reproducibility, ${legacy.length} legacy warning(s).`);
