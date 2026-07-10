---
name: word-artifact-guide
description: Unlocks document_author and document_author_edit to create and revise professional editable Word/DOCX reports, meeting minutes, decision memos, requirements documents, and risk reports from the TensorPM project. A planner structures only sourced project facts, a document design director defines the editorial system, then an author composes the DOCX and an independent reviewer drives automatic repair.
version: 0.2.0
permissions:
  tensorpm:
    action_items: read
    decisions: read
    history: read
  network: []
  project_files:
    read: []
    write:
      - exports/word-artifact-guide/**
  run: []
  ai_provider: user_default
---

# Word Document Author (DOCX)

When this skill is installed and trusted, two tools become available:
**`document_author`** creates an editable Word document and
**`document_author_edit`** revises a document created by that tool.

The backend owns the full quality loop: a content planner derives a structured
document plan from the project graph, a document design director commits to an
editorial system, an author writes the DOCX composition, and a fresh reviewer
checks DOCX structure plus a visual HTML proxy. Sandbox or review failures are
fed back to the author for bounded automatic repair. Nothing is invented.

## Create — `document_author`

- **`intent`** (required) — document kind, purpose, and focus, for example
  "client status report focused on schedule risk" or "meeting minutes with
  decisions and actions".
- **`audience`** (optional) — intended readers; steers detail, tone, and order.
- **`designBrief`** (optional) — formality, brand colour, typography, or layout
  constraints. Leave empty to let the design director decide.

The result includes a **`publicationId`**, the saved path under
`exports/word-artifact-guide/`, section count, repair-attempt count, and a
compact summary. Keep the `publicationId` for later changes.

## Edit — `document_author_edit`

- **`publicationId`** (required) — returned by `document_author`.
- **`instruction`** (required) — the exact change in natural language.

The stored authoring source is revised, rendered, reviewed, and repaired again.
This edit path only works for documents created with `document_author`; it does
not import or preserve arbitrary third-party DOCX templates, comments, or
tracked changes.

## Principles

- Use only project-graph facts. Missing inputs become visible assumptions.
- Prefer semantic headings, editable prose, lists, and compact tables.
- Keep decisions, actions, risks, and assumptions distinct from background.
- Use `document_author_edit` for iterative changes instead of rebuilding.
- For a review-only request, use `artifact-reviewer`; do not silently rewrite.
- Use `execute_code` with `@tensorpm/docx` only for a specialized DOCX operation
  that the author tools do not support.
