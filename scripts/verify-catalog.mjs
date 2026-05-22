#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const args = parseArgs(process.argv.slice(2));
const root = process.cwd();
const catalogPath = path.join(root, 'catalog.json');
const tarballDir = path.resolve(args.tarballs ?? tmpdir());
const maxMacosMin = args.maxMacosMin ?? '13.0';

const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
assert(catalog.schemaVersion === 1, 'catalog.schemaVersion must be 1');
assert(Array.isArray(catalog.skills), 'catalog.skills must be an array');

const seenIds = new Set();
for (const entry of catalog.skills) {
  verifyEntry(entry);
}

console.log(`Verified ${catalog.skills.length} catalog skill(s).`);

function verifyEntry(entry) {
  assertString(entry.id, 'skill id');
  assert(!seenIds.has(entry.id), `duplicate skill id: ${entry.id}`);
  seenIds.add(entry.id);
  assert(/^[a-z0-9._-]+$/i.test(entry.id), `invalid skill id: ${entry.id}`);
  assertString(entry.version, `${entry.id}.version`);
  assertString(entry.description, `${entry.id}.description`);
  assertPayload(entry);
  assertPermissions(entry);

  const tarballPath = path.join(tarballDir, path.basename(new URL(entry.payload.url).pathname));
  const tarball = readFileSync(tarballPath);
  const sha256 = createHash('sha256').update(tarball).digest('hex');
  assert(
    sha256 === entry.payload.sha256,
    `${entry.id}: sha256 mismatch for ${tarballPath} (catalog=${entry.payload.sha256}, actual=${sha256})`,
  );
  assert(
    tarball.length === entry.payload.size,
    `${entry.id}: size mismatch for ${tarballPath} (catalog=${entry.payload.size}, actual=${tarball.length})`,
  );

  const extractDir = mkdtempSync(path.join(tmpdir(), `tpm-skill-${entry.id}-`));
  try {
    execFileSync('tar', ['-xzf', tarballPath, '-C', extractDir], { stdio: 'pipe' });
    verifyExtractedSkill(entry, extractDir);
  } finally {
    rmSync(extractDir, { recursive: true, force: true });
  }
}

function assertPayload(entry) {
  assert(entry.payload && typeof entry.payload === 'object', `${entry.id}: missing payload`);
  assertString(entry.payload.url, `${entry.id}.payload.url`);
  assert(entry.payload.url.startsWith('https://'), `${entry.id}: payload.url must use https://`);
  assert(
    entry.payload.url.includes(`/releases/download/${entry.id}-v${entry.version}/`),
    `${entry.id}: payload.url should point at release tag ${entry.id}-v${entry.version}`,
  );
  assertString(entry.payload.sha256, `${entry.id}.payload.sha256`);
  assert(/^[0-9a-f]{64}$/.test(entry.payload.sha256), `${entry.id}: invalid payload sha256`);
  assert(
    Number.isInteger(entry.payload.size) && entry.payload.size > 0,
    `${entry.id}: payload.size must be a positive integer`,
  );
}

function assertPermissions(entry) {
  const perms = entry.permissions;
  assert(perms && typeof perms === 'object', `${entry.id}: missing permissions`);
  if (entry.platforms !== undefined) {
    assert(Array.isArray(entry.platforms), `${entry.id}: platforms must be an array`);
    for (const platform of entry.platforms) {
      assert(
        platform === 'darwin' || platform === 'linux' || platform === 'win32',
        `${entry.id}: unsupported platform ${platform}`,
      );
    }
  }
  if (perms.network !== 'none') {
    assert(Array.isArray(perms.network), `${entry.id}: permissions.network must be "none" or array`);
    for (const host of perms.network) {
      assertString(host, `${entry.id}.permissions.network[]`);
      assert(/^[a-z0-9.-]+:\d+$/i.test(host), `${entry.id}: invalid network host ${host}`);
    }
  }
  if (perms.run !== 'none') {
    assert(Array.isArray(perms.run), `${entry.id}: permissions.run must be "none" or array`);
    for (const grant of perms.run) {
      assertString(grant, `${entry.id}.permissions.run[]`);
      assert(
        grant === 'system:afconvert' || grant.startsWith('skill:assets/bin/'),
        `${entry.id}: unsupported run grant ${grant}`,
      );
    }
  }
}

function verifyExtractedSkill(entry, extractDir) {
  const skillMdPath = path.join(extractDir, 'SKILL.md');
  const skillMd = readFileSync(skillMdPath, 'utf8');
  const frontmatter = readFrontmatter(skillMd, entry.id);
  assert(
    scalar(frontmatter, 'name') === entry.id,
    `${entry.id}: SKILL.md name must match catalog id`,
  );
  assert(
    scalar(frontmatter, 'version') === entry.version,
    `${entry.id}: SKILL.md version must match catalog version`,
  );

  if (Array.isArray(entry.permissions.run)) {
    for (const grant of entry.permissions.run) {
      if (!grant.startsWith('skill:')) continue;
      const rel = grant.slice('skill:'.length);
      const target = path.resolve(extractDir, ...rel.split('/').filter(Boolean));
      assert(
        target === extractDir || target.startsWith(`${extractDir}${path.sep}`),
        `${entry.id}: run target escapes skill payload: ${grant}`,
      );
      const stat = lstatSync(target);
      assert(!stat.isSymbolicLink(), `${entry.id}: run target must not be a symlink: ${grant}`);
      assert(stat.isFile(), `${entry.id}: run target must be a regular file: ${grant}`);
      assert((stat.mode & 0o111) !== 0, `${entry.id}: run target must be executable: ${grant}`);
      if (entry.platforms?.includes('darwin') && rel.endsWith('/whisper-cli')) {
        verifyMacWhisperCli(entry, target);
      }
    }
  }
}

function verifyMacWhisperCli(entry, binaryPath) {
  if (process.platform !== 'darwin') {
    console.warn(`${entry.id}: skipping macOS binary runtime checks on ${process.platform}`);
    return;
  }
  const fileOutput = execFileSync('file', [binaryPath], { encoding: 'utf8' });
  assert(fileOutput.includes('Mach-O 64-bit executable arm64'), `${entry.id}: whisper-cli is not arm64 Mach-O`);
  const otoolOutput = execFileSync('otool', ['-l', binaryPath], { encoding: 'utf8' });
  const minos = otoolOutput.match(/\bminos\s+([0-9.]+)/)?.[1];
  assert(minos, `${entry.id}: could not read macOS deployment target from whisper-cli`);
  assert(
    compareDottedVersions(minos, maxMacosMin) <= 0,
    `${entry.id}: whisper-cli minos ${minos} exceeds max allowed ${maxMacosMin}`,
  );
  const helpRun = spawnSync(binaryPath, ['-h'], { encoding: 'utf8', timeout: 10_000 });
  assert(helpRun.error === undefined, `${entry.id}: whisper-cli -h failed: ${helpRun.error?.message}`);
  const help = `${helpRun.stdout ?? ''}\n${helpRun.stderr ?? ''}`;
  assert(help.includes('usage:') && help.includes('whisper-cli'), `${entry.id}: whisper-cli -h output is unexpected`);
}

function readFrontmatter(markdown, id) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  assert(match, `${id}: SKILL.md is missing frontmatter`);
  return match[1];
}

function scalar(frontmatter, key) {
  return frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? null;
}

function compareDottedVersions(a, b) {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--tarballs') {
      out.tarballs = argv[++i];
    } else if (arg === '--max-macos-min') {
      out.maxMacosMin = argv[++i];
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return out;
}
