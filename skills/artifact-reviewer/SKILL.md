---
name: artifact-reviewer
description: Use this skill when reviewing, auditing, visually checking, scoring, or improving generated TensorPM artifacts and deliverables, including PowerPoint decks, Excel workbooks, Word documents, PDF reports, previews, Folien, Tabellen, Berichte, Protokolle, Druckversionen, structured diagnostics, render-and-critique loops, artifact QA, quality gates, and acceptance review.
version: 0.1.3
---

# Artifact Reviewer

Use this instruction-only skill for an independent quality review of generated
artifacts. The default output is a review, not a regenerated artifact.

For visual QA, formula/reconciliation checks, or repeated review loops, make a
second `describe_skill` call with
`referencePath: "references/structured-diagnostics.md"` and use
`selectedReference.content` as the deferred diagnostics checklist.

## Review Stance

- Judge the artifact against the user's original request, the available
  TensorPM source data, and the relevant format-specific quality gate.
- Use the user's language for the review unless they ask otherwise.
- Findings come first. Do not start with praise or a general summary.
- Do not rewrite or regenerate the artifact unless the user explicitly asks
  for fixes after the review.
- Be explicit about review evidence. If the artifact cannot be opened,
  rendered, or staged, state that limitation and review only what is available.

## Workflow

1. Identify artifact type, original user request, intended audience, and
   whether the artifact is draft, internal, or client-facing.
2. If the matching format guide is installed, call `describe_skill` for it and
   use its Quality Gate as part of the acceptance criteria:
   - `powerpoint-artifact-guide` for `.pptx`
   - `excel-artifact-guide` for `.xlsx`
   - `word-artifact-guide` for `.docx`
   - `pdf-artifact-guide` for `.pdf`
3. Gather evidence before judging. Prefer structured diagnostics over generic
   taste comments:
   - For HTML/PDF reports, prefer a `render_html` PNG preview when source HTML
     is available.
   - For attached or project files, stage them with `execute_code` `files` and
     inspect only the needed metadata/structure. Do not dump raw rows or full
     document text into chat.
   - For generated code snippets, review layout constants, output file naming,
     data aggregation, and library constraints.
4. Compare artifact content with the request and source data. Check counts,
   totals, dates, owners, units, currencies, status labels, and assumptions.
5. Return a severity-ranked review using the format below.
6. If running an iterative review loop, cap normal review/fix cycles at 1-3
   passes unless the user asks for exhaustive polishing.
7. If the user asks to fix issues, make the smallest targeted correction,
   regenerate or rerender as needed, and run the review gate again.

## Severity Scale

- **Blocker**: do not share; core request, file validity, data correctness, or
  severe layout/readability is broken.
- **Major**: usable only after fixing a specific content, reconciliation,
  structure, or layout issue.
- **Minor**: noticeable issue that does not change the core decision or use
  case.
- **Polish**: optional improvement with low risk.

## Review Output

Use this compact structure:

```markdown
Verdict: Go | Go after fixes | No-go

Findings
- [Blocker|Major|Minor|Polish] Specific issue. Evidence: ... Fix: ...

Checks Passed
- ...

Review Limits
- ...
```

For structured evidence, include exact cells, pages, slides, sections, or code
constants when available.

If there are no blocker or major findings, say that clearly in the verdict and
still list any residual risk or unchecked evidence.

## Format-Specific Checks

### PowerPoint

- Slide count fits the use case and audience.
- Each slide title states a takeaway.
- Slides are not overloaded with dense paragraphs, tiny tables, or ambiguous
  charts.
- Dates, units, owners, risk labels, and assumptions are visible.
- Visual hierarchy and spacing are consistent enough for the audience.

### Excel

- Summary totals reconcile with detail rows.
- Formulas are intentional, valid, and reference the right sheets/ranges.
- Editable inputs, calculations, raw data, and assumptions are separated.
- Dates, currencies, units, statuses, and priorities are consistent.
- The workbook is not just a raw dump unless the user requested an export.

### Word

- Required sections are present and ordered logically.
- Decisions and action items are separated from background narrative.
- Tables have clear headers and are not too wide for a normal page.
- Owners, due dates, statuses, names, and assumptions match source data.
- The document remains editable with semantic headings and normal text.

### PDF

- Designed PDFs have a visual preview check when available.
- Text is readable, not clipped, and not overlapping.
- Page breaks do not split key headings or tables awkwardly.
- Headers, footers, dates, source notes, and page-level context are consistent.
- Status colors also have text labels and print legibly.

## Gotchas

- Do not approve an artifact because it "looks plausible" if the totals,
  counts, or source facts were not checked.
- Do not use a generation guide as a substitute for review evidence.
- Do not ask for a new artifact when a targeted fix is enough.
- Do not bury blockers under style suggestions.
- If the active model cannot inspect images, do not claim visual validation;
  describe the limitation and ask for a vision-capable review if needed.
