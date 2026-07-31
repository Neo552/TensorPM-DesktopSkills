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

An instruction-only skill may also unlock a trusted backend authoring tool in
newer TensorPM versions. `presentation-deck`, `word-artifact-guide`, and
`pdf-artifact-guide` use this pattern: installation/trust is the capability
gate, while planning, authoring, rendering, review, and repair execute in the
desktop backend rather than as a downloadable script.

Customers can publish their own skills and point the app at this or any other
catalog URL via the `TPM_REMOTE_CATALOG_URL` env var.

## Publishing a new skill version

1. Place skill source under `skills/<id>/` with a valid `SKILL.md`.
2. Bump `version:` in `skills/<id>/SKILL.md` and in the `catalog.json` entry.
3. Publish:
   ```bash
   node scripts/publish-skill.mjs <id> --notes "Release notes here"
   ```
   This packs a deterministic tarball, creates the `<id>-v<version>` GitHub
   Release, uploads the asset, confirms the published URL serves the expected
   bytes, and only then rewrites the `payload` block in `catalog.json`.
   Add `--dry-run` to preview.
4. Review the `catalog.json` diff, then commit and push.

**Do not publish by hand.** The asset must exist before `catalog.json` points at
it. Publishing the catalog first produced a live catalog referencing release
assets that were never uploaded — every install of those skills failed with a
404, and nothing in the repo flagged it.

### Verification

```bash
node scripts/verify-catalog.mjs --remote   # downloads every published payload, checks sha256/size
node scripts/verify-reproducible.mjs       # every payload rebuilds byte-for-byte from source
node scripts/verify-catalog.mjs --tarballs /tmp   # offline: check against locally built tarballs
```

Both `--remote` and the reproducibility check run in CI on every push and PR to
`main`, plus daily — an asset can disappear long after the commit that added it.

For macOS native skills, verification also checks that declared
`skill:assets/bin/...` targets are executable, that `whisper-cli -h` starts, and
that the Mach-O deployment target is not newer than macOS 13.0 by default.

Payloads are packed by `scripts/pack-skill.mjs`, which writes the ustar archive
directly instead of shelling out to `tar`. `catalog.json` pins a sha256, so if a
release asset is ever lost the tarball has to be rebuildable byte-for-byte;
plain `tar -czf` bakes in filesystem mtimes and cannot do that.

Clients fetch `catalog.json` on demand, with an ETag-cached layer in the
app's userData dir, so updates propagate within minutes of the commit
landing on `main`.

## Office artifact evals

The `evals/office-artifacts/` folder contains trigger and output-quality eval
fixtures for the Office/document guidance skills:

- `trigger-queries.json` checks that format-specific prompts load the right
  instruction skill and avoid unrelated skills.
- `output-quality-tasks.json` defines artifact-generation/review tasks with
  weighted rubrics.
- `rubric.md` documents the scoring procedure.

Validate the eval fixture shape with:

```bash
node scripts/verify-office-artifact-evals.mjs
```

## License

- **Catalog schema + this README**: MIT (see `LICENSE`).
- **Individual skills**: each skill's `LICENSE` / frontmatter license governs
  that skill's source.
