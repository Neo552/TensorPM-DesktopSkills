---
name: pdf-artifact-guide
description: Unlocks pdf_author and pdf_author_edit to create and revise professional print-ready PDF reports, status packs, risk reports, and fixed-layout client deliverables from the TensorPM project. A planner structures only sourced facts, a print design director defines the editorial system, an HTML author composes the report, Chromium renders it, and an independent structural/visual reviewer drives automatic repair. Also guides targeted PDF stamping, merging, splitting, and edits.
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
      - exports/pdf-artifact-guide/**
  run: []
  ai_provider: user_default
---

# PDF Report Author

When this skill is installed and trusted, **`pdf_author`** creates a designed
print-ready report and **`pdf_author_edit`** revises a report created by that
tool.

The backend owns the full quality loop: a planner derives the report narrative
from the project graph, a print design director defines page/type/table systems,
an HTML author composes the report, Chromium renders the PDF, and a fresh
reviewer checks PDF validity, print-source structure, and a visual preview.
Render or review failures are fed back to the author for bounded repair.

## Create — `pdf_author`

- **`intent`** (required) — report kind, purpose, and focus, for example
  "printable client status pack with milestones, risks, and decisions".
- **`audience`** (optional) — intended readers; steers density and emphasis.
- **`designBrief`** (optional) — brand colour, tone, typography, page format,
  or visual language. Leave empty to let the print design director decide.

The result includes a **`publicationId`**, saved path under
`exports/pdf-artifact-guide/`, page count, repair-attempt count, and a compact
summary. Keep the `publicationId` for later changes.

## Edit — `pdf_author_edit`

- **`publicationId`** (required) — returned by `pdf_author`.
- **`instruction`** (required) — the exact content or design change.

The stored HTML source is revised, rerendered, reviewed, and repaired again.
This edit path only works for reports created with `pdf_author`.

## Targeted existing-PDF operations

Use **`@tensorpm/pdf`** (`pdf-lib`) through `execute_code` for stamping, adding
text at known coordinates, merging/splitting pages, embedding images, or other
targeted edits to staged PDFs. Use `render_html` directly only when the user
explicitly wants to control/provide the HTML or needs a one-off preview.

Do not use `pdf-lib` as a flowing report layout engine. It does not provide
automatic wrapping, pagination, or page-break management.

## Principles

- Use only project-graph facts; label assumptions and missing inputs visibly.
- Use A4 for European/client reports unless the user requests another format.
- Keep typography, margins, headers/footers, dates, and source notes consistent.
- Pair status colour with text labels and keep the design print-safe.
- Use `pdf_author_edit` for iterative report changes instead of rebuilding.
- For a review-only request, use `artifact-reviewer`; do not silently regenerate.

For unusual manual PDF design work, load
`references/design-contract.md` through `describe_skill` and apply that contract
to the `render_html` workflow.
