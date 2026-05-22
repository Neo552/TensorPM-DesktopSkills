# TensorPM Desktop Skills

Skill catalog endpoint for the **TensorPM desktop app**. The app fetches
`catalog.json` from this repo to discover installable desktop skills. TensorPM
can also consume customer-authored catalogs via `TPM_REMOTE_CATALOG_URL`.

This repo is **not** the Claude Code marketplace — that lives at
[`Neo552/TensorPM-Skill`](https://github.com/Neo552/TensorPM-Skill). Different
consumer, different runtime, different format.

## How the app uses this repo

1. The app fetches `catalog.json` from this repo at
   `https://raw.githubusercontent.com/Neo552/TensorPM-DesktopSkills/main/catalog.json`.
2. The user installs a skill via the FileExplorer (`Skills` folder → right-click
   → *Install from catalog…*).
3. The app downloads the tarball from the catalog entry's `payload.url` —
   each release is published as a GitHub Release asset on this repo.
4. The downloaded tarball's bytes are sha256-verified against the catalog
   entry before unpacking, then extracted into the project's `skills/<id>/`
   folder.

## Catalog schema

`catalog.json` is the source of truth. Shape:

```json
{
  "schemaVersion": 1,
  "updatedAt": "ISO-8601 timestamp",
  "skills": [
    {
      "id": "<skill-id>",
      "version": "MAJOR.MINOR.PATCH",
      "label": "Display name",
      "description": "One-line description",
      "minTensorPMVersion": "1.0.0",
      "platforms": ["darwin"],
      "permissions": { /* mirrors the SKILL.md permissions block */ },
      "payload": {
        "url": "https://github.com/.../releases/download/<tag>/<file>.tar.gz",
        "sha256": "64-hex-char digest of the tarball",
        "size": 3331
      },
      "homepage": "https://github.com/.../skills/<skill-id>"
    }
  ]
}
```

`platforms` is optional. Omit it for cross-platform skills, or set it to a
subset of `darwin`, `linux`, and `win32` to make TensorPM block installs on
unsupported hosts. Use `["darwin"]` for macOS-only skills.

Schema is MIT-licensed (see `LICENSE`) — derived independently, **not**
based on Anthropic's `marketplace.json` (which has no LICENSE and is
treated as Anthropic IP).

## Skill source layout

Each skill lives under `skills/<id>/`. A skill is either:

- **Runnable** — declares a `runtime.engine: deno` block plus a `scripts:`
  dictionary in its SKILL.md frontmatter. The agent invokes individual
  operations via `execute_code` skill mode (`skillId + scriptId`).
- **Instruction-only** — has no `scripts:` block. The agent calls
  `describe_skill` to read the SKILL.md body, then writes an ad-hoc
  `execute_code` call that follows the instructions.

Customers can publish their own skills and point the app at this or any other
catalog URL via the `TPM_REMOTE_CATALOG_URL` env var.

## Publishing a new skill version

1. Place skill source under `skills/<id>/` with a valid `SKILL.md`.
2. Bump `version:` in `skills/<id>/SKILL.md`.
3. Tar the skill folder:
   ```bash
   cd skills/<id>
   tar -czf /tmp/<id>-<version>.tar.gz .
   ```
4. Create a GitHub Release tagged `<id>-v<version>` and upload the tarball:
   ```bash
   gh release create <id>-v<version> /tmp/<id>-<version>.tar.gz \
     --title "<id> v<version>" \
     --notes "Release notes here"
   ```
5. Compute sha256 + size, append the entry to `catalog.json`, and commit:
   ```bash
   shasum -a 256 /tmp/<id>-<version>.tar.gz
   stat -f%z /tmp/<id>-<version>.tar.gz
   ```
6. Verify the catalog entry against the local release tarball before pushing:
   ```bash
   node scripts/verify-catalog.mjs --tarballs /tmp
   ```
   For macOS native skills, this also checks that declared `skill:assets/bin/...`
   targets are executable, that `whisper-cli -h` starts, and that the Mach-O
   deployment target is not newer than macOS 13.0 by default.

Clients fetch `catalog.json` on demand, with an ETag-cached layer in the
app's userData dir, so updates propagate within minutes of the commit
landing on `main`.

## License

- **Catalog schema + this README**: MIT (see `LICENSE`).
- **Individual skills**: each skill's `LICENSE` / frontmatter license governs
  that skill's source.
