# TensorPM Desktop Skills

Official skill catalog for the **TensorPM desktop app**. Skills are TypeScript
bundles that the app downloads on demand and runs inside its sandboxed Deno
runtime to do things like generate PowerPoint decks from project state.

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
      "id": "project-pptx",
      "version": "MAJOR.MINOR.PATCH",
      "label": "Display name",
      "description": "One-line description",
      "minTensorPMVersion": "1.0.0",
      "permissions": { /* mirrors the SKILL.md permissions block */ },
      "payload": {
        "url": "https://github.com/.../releases/download/<tag>/<file>.tar.gz",
        "sha256": "64-hex-char digest of the tarball",
        "size": 3331
      },
      "homepage": "https://github.com/.../skills/<id>"
    }
  ]
}
```

Schema is MIT-licensed (see `LICENSE`) — derived independently, **not**
based on Anthropic's `marketplace.json` (which has no LICENSE and is
treated as Anthropic IP).

## Skill source layout

Each skill lives under `skills/<id>/`:

```
skills/project-pptx/
├── SKILL.md          (Apache-2.0 Agent Skills format)
└── scripts/
    └── main.ts       (entrypoint, runs inside Deno sandbox)
```

The `SKILL.md` frontmatter follows the
[Agent Skills specification](https://agentskills.io/specification)
(Apache-2.0) so skills here can be cross-published to other Agent Skills
consumers later without rewriting.

## Releasing a new version

1. Bump `version:` in `skills/<id>/SKILL.md`.
2. Tar the skill folder:
   ```bash
   cd skills/<id>
   tar -czf /tmp/<id>-<version>.tar.gz .
   ```
3. Create a GitHub Release tagged `<id>-v<version>` and upload the tarball:
   ```bash
   gh release create <id>-v<version> /tmp/<id>-<version>.tar.gz \
     --title "<id> v<version>" \
     --notes "Release notes here"
   ```
4. Compute sha256 + size, update `catalog.json` with the new entry
   (replacing the prior version's row), and commit:
   ```bash
   shasum -a 256 /tmp/<id>-<version>.tar.gz
   stat -f%z /tmp/<id>-<version>.tar.gz
   ```

Clients fetch `catalog.json` on demand, with an ETag-cached layer in the
app's userData dir, so updates propagate within minutes of the commit
landing on `main`.

## License

- **Catalog schema + this README**: MIT (see `LICENSE`).
- **Individual skills**: each skill's `LICENSE` (when present) governs that
  skill's source. The shipped `project-pptx` skill is MIT.
