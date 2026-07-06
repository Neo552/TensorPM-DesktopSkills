---
name: presentation-deck
description: Unlocks the deck_author and deck_author_edit tools — generate and edit any kind of PowerPoint presentation (status report, pitch, overview, proposal, review, kickoff) from the TensorPM project. A planner builds the narrative from the project graph (invents nothing), an art director commits to a design, then the deck is freely composed, sandbox-rendered and auto-repaired.
version: 0.2.1
permissions:
  tensorpm:
    action_items: read
    decisions: read
    history: read
  network: []
  project_files:
    read: []
    write:
      - exports/presentation-deck/**
  run: []
  ai_provider: user_default
---

# Presentation Deck (PPTX)

When this skill is installed in the project, two tools become available: **`deck_author`**
(new deck) and **`deck_author_edit`** (change an existing deck). They produce a polished 16:9
PowerPoint for any purpose — a status report for the client, an investor pitch, a project
overview, a proposal, a review — driven by what you ask for.

You no longer orchestrate this yourself: a planner pulls the content from the project, an art
director decides the design, and the tool composes the layout, renders it in the sandbox and
auto-repairs errors. TensorPM saves the `.pptx` under `exports/presentation-deck/` and stores a
per-project edit record so later `deck_author_edit` calls can recompose the same deck. You steer
with two levers.

## Create a deck — `deck_author`

- **`intent`** (required) — the **content** lever: the purpose + focus. E.g. "investor pitch,
  focus on market and traction" or "status report for the client, focus on delay and open
  approvals". This drives what story gets told.
- **`designBrief`** (optional) — the **design** lever: tone, brand colours (hex), visual
  language. E.g. "bold, high contrast, full-bleed accent, brand colour 1F3A5F". Leave it empty to
  let the art director decide.
- **`audience`** (optional) — who the deck is for (e.g. "client", "investors", "project team").
  Steers tone and structure.

The result includes a **`deckId`**, the saved path (`savedTo` under
`exports/presentation-deck/`), and the slide/chart counts. Remember the `deckId` — you need it
to make changes.

## Edit a deck — `deck_author_edit`

- **`deckId`** (required) — from a previous `deck_author` result.
- **`instruction`** (required) — the change in words, e.g. "bigger title", "budget as a grouped
  bar chart", "remove slide 3", "accent colour 2E7D32".

The deck is recomposed from the previous script and saved under the same `deckId`. Only works for
decks created with `deck_author`.

## Principles

- **Invent no data.** Content is pulled only from the project graph; if something is missing (no
  milestones/risks), that slide is dropped rather than padded.
- **Steer with `intent` and `designBrief`, not micro-management.** Describe the purpose and the
  desired effect; the tool chooses the narrative, the slide archetypes and the layout.
- **Iterate** via `deck_author_edit` — no need to rebuild from scratch.
- There is **no** separate render or content step and no `execute_code` calls for this deck:
  everything runs through the two tools above.
