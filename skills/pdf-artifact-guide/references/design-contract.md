# PDF Design Contract

Read this for designed, multi-page, client-facing, or print-ready PDFs.

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

## Print Rules

- A4 is the default for European/client reports unless the user asks otherwise.
- Use stable margins and page headers/footers.
- Keep body text around 10-12pt equivalent and line length readable.
- Use `break-inside: avoid` for small tables, risk cards, and decision blocks.
- Pair every status color with a text label.

## Anti-Slop Bans

- No purple gradients, decorative blobs, centered body copy, tiny tables, or
  dark backgrounds that print poorly.
- No raw data dump in a PDF when XLSX would serve the detail better.
- No page-break-sensitive headings immediately before a page boundary.

## Review Loop

Render PNG first. Fix blocker/major issues, then rerender affected pages.
Normal loop budget is 1-3 iterations; after that, simplify layout rather than
adding more micro-fixes.
