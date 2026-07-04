# Structured Diagnostics

Read this before visual QA, formula/reconciliation review, or repeated
review/fix loops.

## Principle

Prefer diagnostics with locations and thresholds over generic visual comments.
A good finding names where the issue is, what evidence proves it, and what fix
is smallest.

## Visual Diagnostics

When visual evidence is available, check:

- Text clipped, overflowing, or visually too small.
- Elements overlapping or stacked too tightly.
- Margins below the format guide threshold.
- Gaps that are visibly inconsistent.
- Low contrast text or status chips.
- Page/slide breaks splitting headings, tables, or decision blocks.
- Leftover placeholders, lorem text, generic titles, or empty source notes.

If only code is available, inspect layout constants, element bounds, table row
limits, font sizes, color tokens, and output paths. State that pixel-level
visual validation was not possible.

## Spreadsheet Diagnostics

Check and report exact sheet/cell/column locations where possible:

- Summary totals vs detail aggregates.
- Formula references to missing sheets/ranges.
- Formula error strings: `#REF!`, `#DIV/0!`, `#VALUE!`, `#N/A`, `#NAME?`.
- Hardcoded assumptions hidden inside formulas.
- Inconsistent units, currencies, dates, statuses, or priority labels.

If recalculation is unavailable, say so and validate formula strings and
visible aggregates as far as possible.

## Iteration Policy

Use 1-3 review/fix cycles for normal work. Stop earlier when a full pass finds
no blocker or major issues. If issues persist after three cycles, recommend
simplifying the layout or narrowing the artifact scope rather than continuing
small cosmetic edits.
