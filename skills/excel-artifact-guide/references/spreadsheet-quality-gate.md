# Spreadsheet Quality Gate

Read this for budget trackers, financial models, editable calculations, or
workbooks that support management decisions.

## Workbook Semantics

- Separate `Summary`, `Inputs` or `Assumptions`, `Data`, and `Calculations`
  when the workbook is more than a simple export.
- Inputs should be visually distinct from formulas. Use a light fill for
  editable input cells and avoid making formulas look editable.
- Do not hardcode assumptions inside formulas. Put rates, quantities, dates,
  and percentages in named input/assumption cells.
- Keep one formula pattern per calculated column where practical.

## Formula Rules

- Prefer formulas only when user editability matters. Otherwise compute stable
  values in code.
- Formula references must target existing sheets and ranges.
- Use explicit units in headers and labels.
- Do not promise pivot tables, slicers, macros, rich charts, or recalculated
  cached formula values from the current vendored `@tensorpm/xlsx` path.

## Reconciliation

Before finalizing, compare:

- Summary totals vs detail row aggregates.
- Row counts vs source item counts.
- Budget planned/actual/forecast totals vs visible source values.
- Dates, currencies, priorities, and status labels across sheets.

## Recalculation Limit

If a host workflow with Excel or LibreOffice recalculation is available, run it
and scan for `#REF!`, `#DIV/0!`, `#VALUE!`, `#N/A`, and `#NAME?`. In the
current TensorPM Deno sandbox, that recalculation engine is not guaranteed;
state this as a review limit and still validate formula strings and references
as far as possible.
