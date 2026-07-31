#!/usr/bin/env node
/**
 * Check that every published payload's *content* can be rebuilt from this repo.
 *
 * This guards the recovery path. `catalog.json` pins a sha256, so if a release
 * asset is lost or a tag is moved, the tarball has to be rebuildable from
 * source. It also catches the quieter failure: a published payload that no
 * longer matches the `skills/<id>/` tree it claims to come from.
 *
 * The comparison is on the *uncompressed tar*, not the `.tar.gz` digest.
 * gzip output is not portable — zlib's deflate differs between versions, so the
 * same source packed on macOS and on Linux produces different archive bytes
 * (CI caught exactly this). The tar content is byte-stable everywhere, and a
 * rebuild only costs a one-line catalog sha update, which publish-skill.mjs
 * does automatically.
 *
 * Entries in LEGACY_UNREPRODUCIBLE were packed with plain `tar -czf .` before
 * scripts/pack-skill.mjs existed; their archives carry `./` prefixes and
 * filesystem modes, so they never match. They leave the list on their own: the
 * next version published through publish-skill.mjs matches, and the entry can
 * be deleted below.
 *
 *   node scripts/verify-reproducible.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { gunzipSync } from 'node:zlib';

import { buildSkillTar } from './pack-skill.mjs';

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

const failures = [];
const legacy = [];
const skipped = [];
let checked = 0;

for (const entry of catalog.skills) {
  const key = `${entry.id}@${entry.version}`;
  const report = (msg) => (LEGACY_UNREPRODUCIBLE.has(key) ? legacy : failures).push(msg);

  if (!existsSync(path.join(root, 'skills', entry.id))) {
    skipped.push(`${key} (no source in this repo)`);
    continue;
  }

  let built;
  try {
    built = buildSkillTar(root, entry.id);
  } catch (err) {
    report(`${key}: pack failed — ${err.message}`);
    continue;
  }

  if (built.version !== entry.version) {
    // Source has moved past the published version. Not this check's problem —
    // verify-catalog.mjs --remote covers whether the published entry is intact.
    skipped.push(`${key} (source is at ${built.version})`);
    continue;
  }

  let publishedTar;
  try {
    const res = await fetch(entry.payload.url, { redirect: 'follow' });
    if (!res.ok) {
      // verify-catalog.mjs --remote reports this properly; don't duplicate the noise.
      skipped.push(`${key} (payload unreachable: HTTP ${res.status})`);
      continue;
    }
    publishedTar = gunzipSync(Buffer.from(await res.arrayBuffer()));
  } catch (err) {
    skipped.push(`${key} (download failed: ${err.message})`);
    continue;
  }

  checked++;
  if (!publishedTar.equals(built.tar)) {
    report(
      `${key}: published payload content does not match a rebuild from skills/${entry.id}/. ` +
        `Repack and republish with scripts/publish-skill.mjs.`,
    );
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
