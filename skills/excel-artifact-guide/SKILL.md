---
name: excel-artifact-guide
description: Use this skill any time Excel, XLSX, spreadsheet, Tabelle, Arbeitsmappe, workbook, budget tracker, milestone schedule, risk register, action-item export, formulas, editable calculation model, reconciliation, or spreadsheet QA is involved.
version: 0.1.3
---

# Excel Artifact Guide

Use this instruction-only skill for professional `.xlsx` workbooks. It supplies
workbook architecture and data-quality guidance; generate the file with
`execute_code` and the vendored `@tensorpm/xlsx` (`write-excel-file`) library.

For budget, finance, formulas, editable models, or QA-sensitive workbooks, make
a second `describe_skill` call with
`referencePath: "references/spreadsheet-quality-gate.md"` and use
`selectedReference.content` as the deferred quality gate.

## Workflow

1. Identify the workbook purpose: export, tracker, model, register, or
   management summary.
2. Use the user's language for sheet names and labels unless they ask otherwise.
3. Define sheets before code: summary, input/raw data, calculations, detail
   tables, and notes/assumptions as needed.
4. Decide which cells should be editable by the user later. Use formulas only
   where editability matters; otherwise compute stable values in code.
5. Generate the workbook, then run the quality gate below. For external or
   decision-critical workbooks, use `artifact-reviewer` for an independent
   reconciliation pass when it is installed.
6. Write the final artifact with `outputPath(title, "xlsx")` and keep stdout
   to a concise summary.

## Workbook Structure Defaults

- **Summary**: high-level status, totals, key variances, and links/labels for
  the detail sheets.
- **Data**: raw or normalized TensorPM export. Do not mix raw inputs with
  calculated management fields in the same section.
- **Calculations**: formulas and intermediate fields when the user needs an
  editable model.
- **Register sheets**: one table per domain, e.g. Action Items, Risks,
  Milestones, Budget.
- **Assumptions**: source date, filters, missing data, estimates, and any
  manual follow-up required.

Use short, stable sheet names under Excel's practical 31-character limit.

## Table Design Defaults

- First row: bold, high-contrast headers with clear labels.
- Freeze-like visual design: repeat important context columns rather than
  creating ultra-wide tables.
- Use explicit units in headers: `Budget EUR`, `Duration days`, `Due date`.
- Normalize dates to ISO or a clear locale format; do not mix formats.
- Keep status/priority values consistent with TensorPM terms.
- Include IDs only when useful for reconciliation; otherwise keep user-facing
  names and descriptions readable.
- Use consistent spreadsheet semantics: input cells, calculated cells, and
  assumptions should be visually distinguishable.

## Calculation Guidance

- Prefer code-computed values for fixed reports.
- Prefer formulas for editable models where the user may change quantities,
  rates, dates, or assumptions.
- When using formulas or conditional formatting, run a tiny sandbox smoke case
  first if the exact schema is uncertain. The bundled library supports formula
  cell types and formatting features, but the generated workbook is still the
  source of truth.
- Do not promise pivot tables, slicers, macros, or rich Excel charts from the
  current vendored `@tensorpm/xlsx` path.

## Quality Gate

Before finalizing, check:

- Summary totals reconcile with detail rows.
- Row counts match the selected TensorPM source data.
- Formula cells are intentional and use valid references.
- No formula should hide hardcoded business assumptions; put assumptions in
  visible input/assumption cells.
- Dates, currencies, units, and statuses are consistently formatted.
- Assumptions and missing inputs are visible on a sheet, not only in chat.
- The artifact is written with `outputPath(title, "xlsx")` and a descriptive
  project-derived title.

## Code Guidance

Use this import shape:

```ts
import writeXlsxFile from "@tensorpm/xlsx";
import { outputPath, project } from "@tensorpm/sdk";
```

Write bytes via Blob conversion:

```ts
const workbook = await writeXlsxFile([
  {
    sheet: "Summary",
    data: [
      [
        { value: "Metric", fontWeight: "bold", backgroundColor: "#E2E8F0" },
        { value: "Value", fontWeight: "bold", backgroundColor: "#E2E8F0" },
      ],
      ["Open items", openCount],
    ],
  },
]);
const bytes = new Uint8Array(await (await workbook.toBlob()).arrayBuffer());
Deno.writeFileSync(outputPath(`${project.get()?.name ?? "Projekt"} Workbook`, "xlsx"), bytes);
```

## Gotchas

- The sandbox path is write-oriented. Do not claim to edit existing Excel
  workbooks or preserve a company `.xlsx` template unless a separate workflow
  exists.
- Avoid burying assumptions in formulas. Add an assumptions sheet.
- Do not dump raw rows to stdout. Aggregate in code and return a concise
  summary.
- If the user needs polished charts, consider a PPTX or rendered PDF report
  alongside the workbook, or be explicit about the current XLSX limitations.
- Validate numbers against the source data before presenting conclusions.
