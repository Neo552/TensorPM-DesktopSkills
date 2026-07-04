---
name: pdf-artifact-guide
description: Use this skill any time PDF, Druckversion, fixed-layout report, printable status pack, client-ready PDF, PDF export, render_html preview, stamped/merged PDF, visual QA, page-break review, or print-ready deliverable is involved.
version: 0.1.3
---

# PDF Artifact Guide

Use this instruction-only skill for professional PDF deliverables. Choose the
rendering path deliberately: `render_html` for designed reports, `@tensorpm/pdf`
for simple generated pages or targeted PDF operations.

For client-facing, designed, multi-page, or print-ready PDFs, make a second
`describe_skill` call with `referencePath: "references/design-contract.md"` and
use `selectedReference.content` as the deferred design contract.

## Tool Choice

- Use **`render_html`** for polished multi-page reports, dashboards, printable
  packs, and anything with layout, wrapping, repeated headers/footers, charts,
  or rich styling.
- Use **`@tensorpm/pdf`** (`pdf-lib`) for simple generated pages, stamping,
  adding text to known coordinates, merging/splitting pages, embedding images,
  or targeted edits.
- Do not use `pdf-lib` as if it were a layout engine. If you choose it for a
  report, you must implement text wrapping, pagination, and page-break logic.

## HTML to PDF Workflow

1. Plan the document: page size, audience, sections, source data, assumptions,
   and validation checks.
2. Use the user's language for the PDF unless they ask otherwise.
3. Build self-contained HTML/CSS with print styles. Avoid external network
   assets.
4. First call `render_html` with `format: "png"` to preview layout. Inspect
   the image when the active model supports vision.
5. Iterate until text is readable, sections do not overlap, page breaks are
   acceptable, and the visual hierarchy is clear. Cap normal self-review at
   1-3 iterations; if issues persist, simplify the layout.
6. Call `render_html` with `format: "pdf"` and a descriptive file name.
7. For high-stakes external PDFs, use `artifact-reviewer` for a fresh review
   pass when it is installed.

## Report Structure Defaults

- Title page or title band with project name, report purpose, and date.
- Executive summary with 3-6 key points.
- Status/milestone section with dates and current state.
- Risks/issues section with impact, owner, mitigation, and escalation.
- Decisions/next steps section with owners and deadlines.
- Assumptions/source notes when data is incomplete or estimated.

## Layout Defaults

- Use A4 for European/client reports unless the user asks otherwise; use Letter
  only when appropriate for the audience.
- Use consistent margins, page header/footer, and section spacing.
- Keep body text readable in print, usually 10-12 pt equivalent.
- Use tables for registers and comparisons, but avoid cramped tables.
- Use status colors sparingly and always pair color with text labels.
- Avoid background-heavy designs that print poorly.
- Use named CSS custom properties for color, spacing, and type scale; avoid
  scattered raw values after the token block.

## Quality Gate

Before finalizing, check:

- A PNG preview was rendered first for designed reports when available.
- Text is readable, not clipped, and not overlapping.
- Page breaks do not split key tables or section headings awkwardly.
- Margins, gaps, and contrast were checked against the design contract where
  applicable.
- Headers/footers, dates, units, and source notes are consistent.
- Color-coded statuses also have text labels.
- The final PDF uses a descriptive project-derived file name.

## pdf-lib Code Guidance

Use this import shape for simple/generated PDFs:

```ts
import { PDFDocument, StandardFonts, rgb } from "@tensorpm/pdf";
import { outputPath, project } from "@tensorpm/sdk";
```

Write bytes directly:

```ts
const pdf = await PDFDocument.create();
const page = pdf.addPage([595, 842]); // A4 points
const font = await pdf.embedFont(StandardFonts.Helvetica);
page.drawText(project.get()?.name ?? "Project", { x: 56, y: 780, size: 18, font, color: rgb(0, 0, 0) });
const bytes = await pdf.save();
Deno.writeFileSync(outputPath(`${project.get()?.name ?? "Projekt"} Report`, "pdf"), bytes);
```

## Gotchas

- Always preview designed PDFs via `render_html` PNG before final export when
  possible. PDFs are expensive to fix after the user sees layout mistakes.
- Do not rely on color alone for risk/status semantics.
- Do not invent missing data. Put assumptions in a visible section.
- Keep page counts reasonable; move large raw tables to XLSX.
- If editing an existing attached PDF, ensure the file is staged and available
  to the sandbox or use the appropriate project-file workflow.
