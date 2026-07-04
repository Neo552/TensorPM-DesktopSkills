---
name: word-artifact-guide
description: Use this skill any time Word, DOCX, document, Bericht, Protokoll, meeting summary, decision memo, requirements document, risk report, status narrative, editable client document, formal report, or document QA is involved.
version: 0.1.3
---

# Word Artifact Guide

Use this instruction-only skill for professional editable `.docx` documents.
It supplies document-structure and editorial guidance; generate the file with
`execute_code` and the vendored `@tensorpm/docx` library.

For formal, client-facing, long, or print-oriented documents, make a second
`describe_skill` call with
`referencePath: "references/document-structure-guide.md"` and use
`selectedReference.content` as the deferred structure guide.

## Workflow

1. Identify document purpose, audience, decision/action expected, and whether
   the document is formal/client-facing or internal.
2. Use the user's language for the document unless they ask otherwise.
3. Create an outline before code. Use headings that describe the content, not
   generic placeholders.
4. Pull only relevant TensorPM data. Summarize rather than serializing the
   whole project graph.
5. Generate a `.docx` with semantic headings, paragraphs, lists, and tables.
6. Validate the quality gate below before finalizing. For high-stakes or
   client-facing documents, use `artifact-reviewer` for an independent review
   pass when it is installed.

## Document Structure Defaults

- **Project/status report**: title, executive summary, current status,
  milestones, action items, risks/issues, decisions, next steps, assumptions.
- **Meeting summary**: meeting context, attendees if known, decisions,
  action items with owners/dates, discussion summary, open questions.
- **Decision memo**: decision required, background, options, tradeoffs,
  recommendation, impact, risks, next action.
- **Requirements document**: purpose, scope, requirements grouped by theme,
  constraints, acceptance criteria, open questions.
- **Risk report**: risk register summary, high-priority risks, mitigations,
  owners, dates, escalation needs.

## Editorial Defaults

- Start with a concise executive summary or purpose statement.
- Use short paragraphs; keep each paragraph focused on one idea.
- Use tables for comparisons, registers, owners/dates, and decision logs.
- Use bullets for scannable lists, not as a substitute for structure.
- Use consistent terminology from the TensorPM project.
- Mark assumptions, estimates, and missing inputs explicitly.
- End with concrete next steps when the document is action-oriented.

## Formatting Defaults

- Use semantic heading levels rather than manually styled bold paragraphs.
- Keep typography conservative and editable. Avoid embedding screenshots of
  text or tables.
- Prefer simple tables with clear headers and enough spacing.
- Include generated date/source context when useful.
- Do not over-style: Word documents should survive user editing.
- Keep prose left-aligned with style-based spacing; do not simulate spacing
  with empty paragraphs.

## Quality Gate

Before finalizing, check:

- Every requested section is present and in a logical order.
- Decisions and action items are separated from background narrative.
- Owners, due dates, statuses, and names match TensorPM source data.
- Assumptions, estimates, and missing inputs are labeled.
- Tables have clear headers and are not too wide for a Word page.
- The artifact is written with `outputPath(title, "docx")` and a descriptive
  project-derived title.

## Code Guidance

Use this import shape:

```ts
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from "@tensorpm/docx";
import { outputPath, project } from "@tensorpm/sdk";
```

Write bytes via Blob conversion:

```ts
const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun(project.get()?.name ?? "Project Report")],
      }),
      // more paragraphs/tables...
    ],
  }],
});
const blob = await Packer.toBlob(doc);
const bytes = new Uint8Array(await blob.arrayBuffer());
Deno.writeFileSync(outputPath(`${project.get()?.name ?? "Projekt"} Report`, "docx"), bytes);
```

## Gotchas

- The current vendored path generates new `.docx` files. Do not claim to edit
  an existing Word file or preserve tracked changes/templates unless another
  workflow is available.
- Do not write legal/contractual language as definitive advice. Present it as
  a draft for review when stakes are high.
- Do not bury important decisions in narrative paragraphs; use a decision table
  when decisions are central.
- Long unstructured documents are hard to review. Prefer clear sections,
  tables, and appendices.
- Validate action-item owner/date/status fields against TensorPM data before
  presenting them as facts.
