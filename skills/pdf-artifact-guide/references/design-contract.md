# PDF Design Contract

Read this for designed, multi-page, client-facing, or print-ready PDFs.

The design is yours: palette, typography, grid, cover, page format and margins
are all decisions you make. Only the running page footer is not — Chromium
cannot number pages from CSS, so the renderer prints it for you.

## HTML/CSS Token Block

Define a closed token layer at the top of the stylesheet:

```css
:root {
  --color-ink: #172033;
  --color-muted: #64748b;
  --color-paper: #f8fafc;
  --color-surface: #ffffff;
  --color-accent: #0f766e;
  --color-warning: #b45309;
  --color-danger: #b91c1c;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --type-body: 11pt;
  --type-small: 9pt;
  --type-title: 24pt;
}
```

Use raw values in the token block, then reference variables elsewhere.

## The page box

Declare the page you designed, explicitly:

```css
@page {
  size: A4;
  margin: 18mm 20mm 20mm;
}
```

The renderer reads that rule and prints with exactly that format, orientation
and margins — the value is executed by the print API rather than by CSS, which
is what makes the running footer and the pagination check possible.

- A4 is the default for European/client reports unless the user asks otherwise.
- Keep at least **14mm bottom margin**: a thin footer with the document title
  and `n / total` is printed into it. A tighter value is raised for you and
  reported as a finding, so state a workable one yourself.
- Never build your own page footer, header or page counter in the body. It
  cannot know the page number and it drifts with the content.

## Print baseline

A baseline stylesheet is injected ahead of yours. It already handles:

- `break-after: avoid-page` on headings and `break-before: avoid-page` on the
  block that follows one
- `thead { display: table-header-group }` so table headers repeat after a break
- `orphans: 3; widows: 3`
- unbreakable rows, list items, figures, blockquotes and code blocks
- `table-layout: fixed` plus wrapping cells so a long value cannot push the
  table past the column

Build on it. Override whatever your design genuinely needs — it is a floor,
not a straitjacket. Utilities: `.tpm-keep` (never split), `.tpm-page-break`
(start a new page), `.tpm-no-break-after`.

## Print Rules

- Keep body text around 10-12pt equivalent and line length readable.
- Pair every status color with a text label.
- Nothing may exceed the text column — no element wider than 100%, no
  unwrappable long strings.

## Anti-Slop Bans

- No purple gradients, decorative blobs, centered body copy, tiny tables, or
  dark backgrounds that print poorly.
- No raw data dump in a PDF when XLSX would serve the detail better.
- No viewport units (`vh`/`vw`), `position: fixed`, or any layout that assumes
  a scrolling viewport. Paged output has none.
- No `break-before: page` used to fix spacing — it produces half-empty pages.

## Review Loop

For a hand-driven `render_html` workflow, preview with `format: "pdf-preview"`,
never with `format: "png"`. The PNG preview is one continuous image in which
page breaks do not exist; `pdf-preview` paginates exactly like the final PDF,
returns a contact sheet of the real pages, and reports pagination defects
(stranded headings, content past the column, carried-over single lines,
near-empty pages) as text — so the check works on text-only models too.

Fix blocker/major issues, then preview again. Normal loop budget is 1-3
iterations; after that, simplify the layout rather than adding more
micro-fixes. Save with `format: "pdf"` once the preview is clean.
