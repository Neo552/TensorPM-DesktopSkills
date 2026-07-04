# PowerPoint Design Contract

Read this before creating external, executive, sales, client-facing, or
visually polished decks.

## Direction

Choose one content-specific aesthetic direction before writing code. Examples:
operational command center, restrained board memo, construction-site field
brief, premium client proposal, or risk escalation pack. Do not produce a
generic corporate deck that would fit any topic.

## Closed Tokens

Define constants once and reuse them:

```ts
const COLORS = {
  ink: "172033",
  muted: "64748B",
  paper: "F8FAFC",
  surface: "FFFFFF",
  accent: "0F766E",
  warning: "B45309",
  danger: "B91C1C",
  success: "15803D",
};
const TYPE = { title: 34, section: 22, body: 16, small: 11 };
const SPACE = { xs: 0.08, sm: 0.16, md: 0.32, lg: 0.48, xl: 0.72 };
```

Use one dominant visual color at roughly 60-70% visual weight, one supporting
neutral, and one sharp accent. Use semantic colors only for semantics.

## Anti-Slop Bans

- No purple-on-white gradients, random gradient blobs, decorative accent lines
  under every title, centered body text, or equal-weight palettes.
- Do not rely on default Arial/Calibri styling. If runtime font support is
  limited, compensate with stronger layout, hierarchy, spacing, and motif.
- Do not use identical bullet-card layouts on every slide.
- Do not add charts without numeric source data and labeled units.

## Motif

Pick one repeated motif and reuse it sparingly: milestone rail, status strip,
decision ladder, risk heat band, workstream lane, or budget variance marker.

## Review

For critical decks, ask `artifact-reviewer` to check rendered or structural
evidence. If no PPTX renderer is available, state that visual review is limited
to layout constants, slide density, and generated code structure.
