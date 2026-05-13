---
name: project-pptx
description: Generate a short PowerPoint (.pptx) deck summarising the current project — title, status snapshot, and top open action items. Use whenever the user asks for a presentation, slides, status deck, or PowerPoint.
version: 1.0.0
runtime:
  engine: deno
  entrypoint: scripts/main.ts
permissions:
  tensorpm:
    action_items: read
    decisions: read
    history: none
  network: none
  ai_provider: none
limits:
  cpu_seconds: 20
  memory_mb: 256
schema:
  input:
    type: object
    properties:
      audience:
        type: string
        description: Optional audience label printed on the title slide (e.g. "Steering Committee", "Sponsor review 2026-05"). Free text.
      maxItems:
        type: integer
        description: Max number of open action items to list on the "Next up" slide. Defaults to 5.
        minimum: 1
        maximum: 10
    required: []
  output:
    type: object
    properties:
      artifact:
        type: string
        description: Filename of the generated .pptx artifact.
      slideCount:
        type: integer
    required: [artifact, slideCount]
---

# project-pptx

Builds a small PowerPoint deck from the current TensorPM project. The deck
has three slides — title, status snapshot, and the top open action items —
and is generated entirely in-sandbox using the vendored PptxGenJS library
imported via `@tensorpm/pptx`.

The output is captured as a `.pptx` artifact and (when called from the
desktop chat agent) auto-copied into the project's `exports/project-pptx/`
folder so it shows up in the FileExplorer ready to open.

## When to use

Anytime the user asks for any of:

- "a PowerPoint of the project"
- "a status deck"
- "slides for the sponsor"
- "ein Pitch-Deck / eine Präsentation zum Projekt"

If the user wants something more elaborate (charts, custom layouts,
multi-section decks), fall back to `execute_code` with `@tensorpm/pptx`
directly.

## Notes

- The deck is intentionally minimal — three slides, no charts, no images.
  Speaker fills in colour and narrative; the skill carries the facts.
- Reads only `actionItems` and `decisions` from the project snapshot; no
  network, no AI re-entry.
