---
name: gaeb-import
description: Parse German GAEB bills of quantities (Leistungsverzeichnis, .x81/.x83/.x84) deterministically and stage their positions for review as project material items with position references, quantities, and unit prices.
version: 0.1.0
runtime:
  engine: deno
permissions:
  tensorpm:
    action_items: none
    decisions: none
    history: none
  network: []
  project_files:
    read:
      - gaeb/**
    write: []
  run: []
  ai_provider: none
limits:
  cpu_seconds: 120
  memory_mb: 512
file_triggers:
  - script: parse
    label: GAEB-LV einlesen (Übersicht)
    extensions: [x81, x82, x83, x83z, x84, x84z, x85, x86, xml]
    file_input: file_path
    inputs:
      mode: summary
scripts:
  parse:
    entrypoint: scripts/parse-gaeb.ts
    description: Parse a GAEB DA XML bill of quantities. mode=summary returns the LV overview (structure, counts, totals, warnings) and writes gaeb-items.json + gaeb-summary.md artifacts; mode=items returns positions page-wise for staging into the project.
    schema:
      input:
        type: object
        properties:
          file_path:
            type: string
            description: Project-relative path under gaeb/, e.g. "gaeb/Ausschreibung.x83". Also accepts .xml-wrapped GAEB XML. For bids, pass the X84 here.
          base_file:
            type: string
            description: Optional original X83 under gaeb/. When set, file_path is treated as the bid (X84) and merged onto this base LV by OZ — texts and quantities from the X83, prices from the X84.
          mode:
            type: string
            enum: [summary, items]
            description: summary (default) = overview + artifacts. items = one page of positions.
          offset:
            type: number
            description: First position index for mode=items (default 0).
          limit:
            type: number
            description: Positions per page for mode=items (default 40, max 100).
          include_long_text:
            type: boolean
            description: Include full position long texts in mode=items (larger output).
        required: [file_path]
      output:
        type: object
        properties:
          mode:
            type: string
        required: [mode]
---



# GAEB Import

Reads German construction bills of quantities (GAEB DA XML 3.1/3.2/3.3 — phases
X80–X86 including Z variants) and produces exact, deterministic position data.
GAEB 90 (`.d81`–`.d86`) and GAEB 2000 (`.p81`–`.p86`) files are detected and
rejected with a clear message (ask the sender for a GAEB DA XML export).

## Workflow

0. GAEB files must live in the project's `gaeb/` folder (the skill's read
   permission is limited to that folder). If the user's file is elsewhere,
   ask them to move or re-drop it into `gaeb/` first.
1. Run `parse` with `mode=summary` first. Present the user the overview:
   project/BoQ name, phase, position count, category tree, totals, and all
   warnings. The artifacts `gaeb-summary.md` (human-readable LV table) and
   `gaeb-items.json` (full parsed data) are exported for the user.
2. **Bids (X84):** never parse an X84 on its own when the original X83 exists
   in `gaeb/` — call `parse` with `file_path` = X84 and `base_file` = X83.
   The skill joins prices onto texts/quantities by OZ deterministically and
   reports `merge` statistics (`matched`, `overlayOnly`, `stillUnpriced`).
   Present those to the user; do not match positions yourself.
3. Only after the user confirms the import, stage positions into the project:
   fetch pages via `mode=items` (`offset`/`limit`).
4. **Idempotent staging:** before creating items, list the existing material
   items once and build a `positionRef → id` map. For each GAEB position with
   an existing `positionRef`, pass that `id` (update); otherwise create.
   Re-importing an LV or Nachtrag must never produce duplicates.
5. Each position in `mode=items` carries `save_args` — **pass it verbatim as
   the `material_save_item` arguments**. You only add `id` (for updates) and
   `parentItemId` (hierarchy). Never retype quantities, prices, or position
   references, and never invent values for fields `save_args` omits.

## Hierarchy

Create one parent material item per category (Titel) first, using the
category `oz` as `positionRef` and its label as `name` (categories come from
the `mode=summary` tree). Then pass the created parent ids as `parentItemId`
for their positions (`category_oz` names each position's direct parent).

## Semantics to respect

- `in_total: false` positions (alternatives, provisional-without-total,
  not-applicable, not-offered) do **not** count towards the bid sum. Either
  skip them or import them with a clear note — ask the user for their
  preference when they exist.
- `flags` explains special position types: `markup` (Zuschlagsposition),
  `lump_sum` (Pauschale), `qty_tbd` (Freie Menge — bidder fills the quantity),
  `alternative`/`base_position` (Wahl-/Grundposition), `provisional`
  (Bedarfsposition), `bidder_inputs:<n>` (text complements the bidder must
  fill in), `negative_price` (Nachlass — the negative amount is kept out of
  `save_args` and documented in its `notes` instead, because TensorPM clamps
  negative amounts to 0).
- File totals and computed totals may differ by rounding between AVA tools;
  report differences, do not "correct" them.
