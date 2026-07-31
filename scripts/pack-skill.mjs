#!/usr/bin/env node
/**
 * Deterministic skill payload packer.
 *
 * Builds `<out>/<id>-<version>.tar.gz` from `skills/<id>/` so that the same
 * source tree always yields the same bytes — on macOS, on Linux, and on a
 * fresh clone. That matters because `catalog.json` pins a sha256: if a
 * release asset is ever lost, the tarball has to be rebuildable byte-for-byte
 * instead of forcing a catalog rewrite.
 *
 * Determinism comes from writing the ustar archive here rather than shelling
 * out to tar: BSD tar (macOS) and GNU tar (CI) disagree on the flags needed to
 * pin mtime/uid/gid, and filesystem mtimes differ per clone anyway.
 *
 *   node scripts/pack-skill.mjs <skill-id> [--out <dir>]
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, lstatSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { gzipSync } from 'node:zlib';

const BLOCK = 512;
/** Fixed timestamp for every entry. Any constant works; this one is arbitrary. */
const FIXED_MTIME = 1577836800; // 2020-01-01T00:00:00Z

/**
 * Build the uncompressed tar payload. These bytes are stable across machines
 * and OSes — it is pure buffer arithmetic here, with no filesystem metadata
 * and no platform library involved.
 *
 * The gzip wrapper around it is NOT portable: zlib's deflate output differs
 * between zlib versions, so the same source packed on macOS and on Linux
 * yields different `.tar.gz` bytes. Reproducibility is therefore asserted on
 * the tar content (see scripts/verify-reproducible.mjs), not on the archive
 * digest that catalog.json pins.
 */
export function buildSkillTar(root, skillId) {
  const skillDir = path.join(root, 'skills', skillId);
  const version = readSkillVersion(path.join(skillDir, 'SKILL.md'), skillId);

  const entries = collectEntries(skillDir);
  const chunks = [];
  for (const entry of entries) {
    chunks.push(tarHeader(entry));
    if (entry.type === 'file') {
      chunks.push(entry.body, padding(entry.body.length));
    }
  }
  // Two zero blocks terminate the archive, then pad to a 20-block boundary the
  // way tar implementations do.
  chunks.push(Buffer.alloc(BLOCK * 2));
  const tar = Buffer.concat(chunks);
  const padded = Buffer.concat([tar, Buffer.alloc(roundUp(tar.length, BLOCK * 20) - tar.length)]);

  return { version, tar: padded, tarSha256: createHash('sha256').update(padded).digest('hex') };
}

export function packSkill(root, skillId, outDir) {
  const { version, tar, tarSha256 } = buildSkillTar(root, skillId);
  const gz = gzipSync(tar, { level: 9 });

  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${skillId}-${version}.tar.gz`);
  writeFileSync(outPath, gz);

  return {
    skillId,
    version,
    path: outPath,
    size: gz.length,
    sha256: createHash('sha256').update(gz).digest('hex'),
    tarSha256,
  };
}

function collectEntries(skillDir) {
  const out = [];
  walk(skillDir, '');
  // Sorting by name is what makes the archive order independent of readdir order.
  out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return out;

  function walk(dir, prefix) {
    for (const name of readdirSync(dir)) {
      if (name === '.DS_Store') continue;
      const abs = path.join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      const stat = lstatSync(abs);
      if (stat.isSymbolicLink()) {
        throw new Error(`Symlinks are not allowed in skill payloads: ${rel}`);
      }
      if (stat.isDirectory()) {
        out.push({ name: `${rel}/`, type: 'dir', mode: 0o755 });
        walk(abs, rel);
      } else if (stat.isFile()) {
        // Normalize modes so a differing umask cannot change the digest; the
        // executable bit is the only one that carries meaning (run: grants).
        const mode = (stat.mode & 0o111) !== 0 ? 0o755 : 0o644;
        out.push({ name: rel, type: 'file', mode, body: readFileSync(abs) });
      } else {
        throw new Error(`Unsupported file type in skill payload: ${rel}`);
      }
    }
  }
}

function tarHeader(entry) {
  const header = Buffer.alloc(BLOCK);
  const { name, prefix } = splitName(entry.name);

  header.write(name, 0, 100, 'utf8');
  writeOctal(header, entry.mode, 100, 8);
  writeOctal(header, 0, 108, 8); // uid
  writeOctal(header, 0, 116, 8); // gid
  writeOctal(header, entry.type === 'file' ? entry.body.length : 0, 124, 12);
  writeOctal(header, FIXED_MTIME, 136, 12);
  header.write('        ', 148, 8, 'ascii'); // checksum placeholder
  header.write(entry.type === 'dir' ? '5' : '0', 156, 1, 'ascii');
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  // uname/gname deliberately left empty — they would otherwise leak the packer's account.
  writeOctal(header, 0, 329, 8); // devmajor
  writeOctal(header, 0, 337, 8); // devminor
  header.write(prefix, 345, 155, 'utf8');

  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(sum.toString(8).padStart(6, '0'), 148, 6, 'ascii');
  header.write('\0 ', 154, 2, 'ascii');
  return header;
}

function splitName(full) {
  if (Buffer.byteLength(full) <= 100) return { name: full, prefix: '' };
  const cut = full.lastIndexOf('/', 155);
  const prefix = cut > 0 ? full.slice(0, cut) : '';
  const name = cut > 0 ? full.slice(cut + 1) : full;
  if (Buffer.byteLength(name) > 100 || Buffer.byteLength(prefix) > 155) {
    throw new Error(`Path too long for ustar format: ${full}`);
  }
  return { name, prefix };
}

function writeOctal(buf, value, offset, length) {
  buf.write(value.toString(8).padStart(length - 1, '0'), offset, length - 1, 'ascii');
  buf.write('\0', offset + length - 1, 1, 'ascii');
}

function padding(length) {
  return Buffer.alloc(roundUp(length, BLOCK) - length);
}

function roundUp(value, multiple) {
  return Math.ceil(value / multiple) * multiple;
}

function readSkillVersion(skillMdPath, skillId) {
  const frontmatter = readFileSync(skillMdPath, 'utf8').match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) throw new Error(`${skillId}: SKILL.md is missing frontmatter`);
  const version = frontmatter[1].match(/^version:\s*(.+)$/m)?.[1]?.trim();
  if (!version) throw new Error(`${skillId}: SKILL.md frontmatter has no version`);
  const name = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  if (name !== skillId) throw new Error(`${skillId}: SKILL.md name is "${name}", expected "${skillId}"`);
  return version;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const skillId = args.find((a) => !a.startsWith('--'));
  const outIdx = args.indexOf('--out');
  const outDir = outIdx === -1 ? path.join(process.cwd(), 'dist') : path.resolve(args[outIdx + 1]);

  if (!skillId) {
    console.error('usage: node scripts/pack-skill.mjs <skill-id> [--out <dir>]');
    process.exit(2);
  }

  try {
    const result = packSkill(process.cwd(), skillId, outDir);
    console.log(result.path);
    console.log(`sha256 ${result.sha256}`);
    console.log(`size   ${result.size}`);
  } catch (err) {
    console.error(`pack-skill failed: ${err.message}`);
    process.exit(1);
  }
}
