---
name: powerpoint-artifact-guide
description: Use this skill any time PowerPoint, PPTX, deck, slides, Folien, presentation, Statusdeck, steering committee deck, stakeholder update, client deck, roadmap, executive summary, slide design, visual polish, or presentation QA is involved as input or output.
version: 0.1.3
---

# PowerPoint Artifact Guide

Use this instruction-only skill for professional `.pptx` decks. It supplies the
deck-planning and slide-design guidance; generate the actual file with
`execute_code` and the vendored `@tensorpm/pptx` library.

For client-facing, executive, sales, or visually polished decks, make a second
`describe_skill` call with `referencePath: "references/design-contract.md"` and
use `selectedReference.content` as the deferred design contract. Keep this
deferred for simple internal exports.

## Workflow

1. Identify audience, decision/use case, expected speaking time, and whether
   the deck is for live presentation or async reading.
2. Use the user's language for the deck unless they ask otherwise.
3. Commit to a content-specific design direction before code: one dominant
   color, one repeated visual motif, and a closed token palette.
4. Create a slide outline before code. Each slide needs one takeaway sentence,
   not just a topic label.
5. Select only the TensorPM project data needed for those takeaways. Do not
   dump the full project context into slides.
6. Generate the deck with `@tensorpm/pptx`, using stable layout constants for
   margins, grid columns, title bands, and footer positions.
7. Validate the quality gate below before finalizing. For high-stakes or
   external decks, use `artifact-reviewer` for a fresh review pass when it is
   installed.

## Deck Structure Defaults

- **Executive/status deck**: title, executive summary, current state, schedule
  or milestone view, risks/blockers, decisions needed, next steps.
- **Steering deck**: title, decision framing, options/tradeoffs, impact,
  recommendation, implementation plan, open risks.
- **Roadmap deck**: title, timeline, workstreams, dependencies, milestones,
  risk/assumption register, next review.
- **Client update**: title, progress since last update, completed work,
  upcoming work, blockers requiring client input, budget/scope notes.

Keep most decks between 5 and 12 slides unless the user asks for a long appendix.
Move dense backup material to appendix slides.

## Slide Design Defaults

- Use widescreen 16:9 (`LAYOUT_WIDE`).
- Use one visible message per slide. Titles should read like conclusions:
  "Permitting is the critical-path risk", not "Risks".
- Use a consistent grid: outer margin about 0.45-0.6 in, aligned title,
  content region, and small footer/date if needed.
- Use a restrained palette: dark text on light background, one accent color,
  and semantic colors only where they carry meaning (risk, warning, success).
- Avoid generic "AI deck" defaults: equal-weight palettes, purple gradients,
  centered body text, title accent lines, and default Arial/Calibri styling.
- Body text should usually be 14-22 pt; titles 26-38 pt. Avoid tiny table text.
- Prefer diagrams, timelines, cards, and simple comparison tables over long
  bullet lists.
- Put source/assumption notes in small footer text only when they matter.

## Content Patterns

- **Summary slide**: 3-5 concise bullets, each with a status/impact phrase.
- **Timeline slide**: horizontal months/weeks, milestone markers, dependencies,
  and critical path callout if known.
- **Risk slide**: risk, impact, owner, mitigation, decision needed. Avoid
  vague "monitor" mitigations.
- **Budget slide**: planned vs actual, variance, cause, forecast, next action.
- **Decision slide**: decision question, options, tradeoff, recommendation,
  deadline/owner.
- **Chart slide**: only when numeric source data exists. Use simple bar, line,
  or stacked bar charts; label axes/units and explain the takeaway in the title.

## Quality Gate

Before finalizing, check:

- Slide count fits the request and audience.
- Every slide title is unique and states a takeaway.
- No slide has more than one dense table or more than 5-7 bullets.
- Dates, currencies, units, and status labels are explicit.
- Any estimates or missing inputs are labeled.
- Colors and font sizes come from named constants, not scattered raw values.
- The artifact is written with `outputPath(title, "pptx")` and a descriptive
  project-derived title.

## Code Guidance

Use this import shape:

```ts
import pptxgen from "@tensorpm/pptx";
import { outputPath, project } from "@tensorpm/sdk";
```

Prefer writing bytes explicitly:

```ts
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
// add slides...
const bytes = await pres.write({ outputType: "uint8array" });
Deno.writeFileSync(outputPath(`${project.get()?.name ?? "Projekt"} Statusdeck`, "pptx"), bytes);
```

Define constants for slide width/height, margins, and colors near the top of
the snippet. Reuse helper functions for title/footer/status chips rather than
positioning every element ad hoc.

## Gotchas

- Do not create a deck by pasting a report into slides. Summarize and design
  for scanning.
- Do not overuse tables. If a table needs more than about 7 rows or 5 columns,
  split it, summarize it, or move it to Excel/DOCX.
- Do not invent charts from incomplete data. If data is missing, state the
  assumption or ask for it.
- PptxGenJS cannot reliably tell you whether text visually overflows. Prevent
  overflow by bounding bullet counts, using concise text, and splitting slides.
- If the user provides a corporate template, be transparent: the current
  sandbox can generate new decks but does not edit existing `.pptx` templates.
- If a template/html-to-PPTX pipeline is available in a future runtime, prefer
  it for brand fidelity. In the current TensorPM sandbox, use direct PptxGenJS
  layout constants and state that template editing is not supported.
