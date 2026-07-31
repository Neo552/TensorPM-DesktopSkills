#!/usr/bin/env node
/**
 * Publish one skill version: pack → GitHub Release → catalog entry.
 *
 * The ordering is the point. Publishing by hand once produced a catalog on
 * `main` that pointed at release assets nobody had uploaded, which fails at
 * install time for every user with no signal anywhere earlier. This script
 * uploads the asset first and only rewrites `catalog.json` once the download
 * URL actually serves the expected bytes.
 *
 *   node scripts/publish-skill.mjs <skill-id> [--notes "..."] [--dry-run]
 *
 * Leaves the catalog.json change uncommitted — review and commit it yourself.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { packSkill } from './pack-skill.mjs';

const REPO = 'Neo552/TensorPM-DesktopSkills';

const args = process.argv.slice(2);
const skillId = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const notesIdx = args.indexOf('--notes');
const notes = notesIdx === -1 ? null : args[notesIdx + 1];

if (!skillId) {
  console.error('usage: node scripts/publish-skill.mjs <skill-id> [--notes "..."] [--dry-run]');
  process.exit(2);
}

const root = process.cwd();
const catalogPath = path.join(root, 'catalog.json');

try {
  await main();
} catch (err) {
  console.error(`publish-skill failed: ${err.message}`);
  process.exit(1);
}

async function main() {
  const built = packSkill(root, skillId, path.join(tmpdir(), 'tpm-skill-publish'));
  const tag = `${skillId}-v${built.version}`;
  const asset = path.basename(built.path);
  const url = `https://github.com/${REPO}/releases/download/${tag}/${asset}`;

  console.log(`${skillId} ${built.version}`);
  console.log(`  tarball ${built.path}`);
  console.log(`  sha256  ${built.sha256}`);
  console.log(`  size    ${built.size}`);
  console.log(`  tag     ${tag}`);

  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const entry = catalog.skills.find((s) => s.id === skillId);
  if (!entry) throw new Error(`No catalog entry for ${skillId} — add one before publishing`);
  if (entry.version !== built.version) {
    throw new Error(
      `catalog.json has ${skillId}@${entry.version} but SKILL.md says ${built.version}. ` +
        `Bump the catalog entry version first.`,
    );
  }

  if (dryRun) {
    console.log('\n--dry-run: no release created, catalog.json untouched.');
    return;
  }

  // 1. Asset first. Re-running after a partial failure must not error out, so
  //    an existing tag gets the asset uploaded (or replaced) instead.
  if (releaseExists(tag)) {
    console.log(`\nRelease ${tag} exists — uploading asset with --clobber`);
    gh(['release', 'upload', tag, built.path, '--clobber', '--repo', REPO]);
  } else {
    console.log(`\nCreating release ${tag}`);
    gh([
      'release', 'create', tag, built.path,
      '--repo', REPO,
      '--title', `${entry.label ?? skillId} v${built.version}`,
      '--notes', notes ?? `${entry.label ?? skillId} ${built.version}`,
    ]);
  }

  // 2. Only now is it safe to point the catalog at that URL. Confirm the
  //    published bytes rather than trusting that the upload did what it said.
  console.log('Verifying published asset…');
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Published asset is not reachable: ${url} — HTTP ${res.status}`);
  const published = Buffer.from(await res.arrayBuffer());
  if (published.length !== built.size) {
    throw new Error(`Published asset size ${published.length} ≠ built size ${built.size}`);
  }

  // 3. Catalog last.
  entry.payload = { url, sha256: built.sha256, size: built.size };
  catalog.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
  writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`Updated catalog.json entry for ${skillId}.`);

  console.log('\nNext: review the catalog.json diff, then commit and push.');
  console.log('CI re-verifies every published payload on push.');
}

function releaseExists(tag) {
  try {
    execFileSync('gh', ['release', 'view', tag, '--repo', REPO], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function gh(argv) {
  execFileSync('gh', argv, { stdio: 'inherit' });
}
