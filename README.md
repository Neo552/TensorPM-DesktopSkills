# TensorPM Desktop Skills

Skill catalog endpoint for the **TensorPM desktop app**. The app fetches
`catalog.json` from this repo to discover installable skills. The catalog is
intentionally empty by default — TensorPM is a customer-authored skill
platform, not a curator of bundled domain skills.

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
      "id": "pptx-generator",
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

Each skill lives under `skills/<id>/`. Skills may be runnable TensorPM skills
with a Deno `runtime` block, or instruction-only Agent Skills that guide the
chat agent via `describe_skill` + `execute_code`.

The catalog is currently **empty** — TensorPM is a skill platform for customer-
authored domain skills, not a curator of bundled Office/document skills.
Customers publish their own skills and point the app at this (or any other)
catalog URL.

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

Clients fetch `catalog.json` on demand, with an ETag-cached layer in the
app's userData dir, so updates propagate within minutes of the commit
landing on `main`.

## License

- **Catalog schema + this README**: MIT (see `LICENSE`).
- **Individual skills**: each skill's `LICENSE` / frontmatter license governs
  that skill's source.
