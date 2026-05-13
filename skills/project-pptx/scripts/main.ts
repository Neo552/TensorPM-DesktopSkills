import PptxGenJS from "@tensorpm/pptx";
import { context, output } from "@tensorpm/sdk";

type DeckLayout = "wide" | "standard";
type SlideLayout =
  | "title"
  | "section"
  | "bullets"
  | "two-column"
  | "table"
  | "metrics"
  | "quote"
  | "blank";

interface ThemeInput {
  fontFace?: string;
  backgroundColor?: string;
  textColor?: string;
  primaryColor?: string;
  accentColor?: string;
  mutedColor?: string;
}

interface TableInput {
  headers?: string[];
  rows?: string[][];
}

interface MetricInput {
  label?: string;
  value?: string;
  note?: string;
}

interface ElementInput {
  type?: "text" | "bullets" | "table" | "metric" | "shape";
  text?: string;
  items?: string[];
  rows?: string[][];
  label?: string;
  value?: string;
  note?: string;
  shape?: "rect" | "roundRect" | "line";
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  fontSize?: number;
  color?: string;
  fill?: string;
  bold?: boolean;
  italic?: boolean;
}

interface SlideInput {
  layout?: SlideLayout;
  title?: string;
  subtitle?: string;
  notes?: string;
  backgroundColor?: string;
  bullets?: string[];
  left?: string[];
  right?: string[];
  table?: TableInput;
  metrics?: MetricInput[];
  quote?: string;
  attribution?: string;
  elements?: ElementInput[];
}

interface DeckInput {
  filename?: string;
  title?: string;
  subtitle?: string;
  layout?: DeckLayout;
  theme?: ThemeInput;
  slides?: SlideInput[];
}

interface Theme {
  fontFace: string;
  backgroundColor: string;
  textColor: string;
  primaryColor: string;
  accentColor: string;
  mutedColor: string;
}

const rawInputs = (context.inputs ?? {}) as DeckInput;
const layout = rawInputs.layout === "standard" ? "standard" : "wide";
const canvas = layout === "standard"
  ? { w: 10, h: 7.5 }
  : { w: 13.333, h: 7.5 };

const theme: Theme = {
  fontFace: safeText(rawInputs.theme?.fontFace, "Calibri"),
  backgroundColor: color(rawInputs.theme?.backgroundColor, "F8FAFC"),
  textColor: color(rawInputs.theme?.textColor, "0F172A"),
  primaryColor: color(rawInputs.theme?.primaryColor, "1D4ED8"),
  accentColor: color(rawInputs.theme?.accentColor, "14B8A6"),
  mutedColor: color(rawInputs.theme?.mutedColor, "64748B"),
};

const slides = normalizeSlides(rawInputs);
const deckTitle = safeText(rawInputs.title, slides[0]?.title ?? "Presentation");
const deckSubtitle = safeText(rawInputs.subtitle, "");
const filename = normalizeFilename(rawInputs.filename ?? deckTitle);

const pres = new PptxGenJS();
pres.layout = layout === "standard" ? "LAYOUT_4X3" : "LAYOUT_WIDE";
pres.author = "TensorPM";
pres.company = "TensorPM";
pres.subject = deckSubtitle || deckTitle;
pres.title = deckTitle;
pres.lang = "en-US";

for (const spec of slides) {
  const slide = pres.addSlide();
  slide.background = { color: color(spec.backgroundColor, theme.backgroundColor) };

  if (safeText(spec.notes, "")) {
    slide.addNotes(safeText(spec.notes, ""));
  }

  renderLayout(slide, spec);
  for (const element of spec.elements ?? []) {
    renderElement(slide, element);
  }
}

const bytes = await pres.write({ outputType: "uint8array" });
const outDir = `${Deno.env.get("TPM_RUN_DIR") ?? "."}/out`;
try {
  Deno.mkdirSync(outDir, { recursive: true });
} catch {
  // The sandbox normally creates this directory before execution.
}
Deno.writeFileSync(`${outDir}/${filename}`, bytes as Uint8Array);

console.log(`pptx ok: ${filename} (${(bytes as Uint8Array).byteLength} bytes, ${slides.length} slides)`);
output({ artifact: filename, slideCount: slides.length, title: deckTitle });

function renderLayout(slide: any, spec: SlideInput): void {
  switch (spec.layout ?? "bullets") {
    case "title":
      addAccentBar(slide, 0.55, canvas.h - 0.65, canvas.w - 1.1, 0.09);
      addText(slide, safeText(spec.title, deckTitle), 0.7, 1.45, canvas.w - 1.4, 1.3, {
        fontSize: 42,
        bold: true,
      });
      addText(slide, safeText(spec.subtitle, deckSubtitle), 0.75, 2.9, canvas.w - 1.5, 1.15, {
        fontSize: 19,
        color: theme.mutedColor,
      });
      break;

    case "section":
      addAccentBar(slide, 0.75, 1.25, 0.11, 4.9);
      addText(slide, safeText(spec.title, "Section"), 1.15, 2.35, canvas.w - 2.1, 0.85, {
        fontSize: 34,
        bold: true,
      });
      addText(slide, safeText(spec.subtitle, ""), 1.18, 3.25, canvas.w - 2.1, 0.75, {
        fontSize: 18,
        color: theme.mutedColor,
      });
      break;

    case "two-column":
      renderTitle(slide, spec.title);
      renderBulletList(slide, spec.left ?? [], 0.75, 1.65, (canvas.w - 1.9) / 2, 4.9);
      renderBulletList(
        slide,
        spec.right ?? [],
        1.15 + (canvas.w - 1.9) / 2,
        1.65,
        (canvas.w - 1.9) / 2,
        4.9,
      );
      break;

    case "table":
      renderTitle(slide, spec.title);
      renderTable(slide, spec.table, 0.75, 1.55, canvas.w - 1.5, 5.35);
      break;

    case "metrics":
      renderTitle(slide, spec.title);
      renderMetrics(slide, spec.metrics ?? [], 0.7, 1.65, canvas.w - 1.4, 3.8);
      break;

    case "quote":
      addText(slide, safeText(spec.quote, spec.title ?? ""), 1.2, 1.65, canvas.w - 2.4, 2.4, {
        fontSize: 30,
        italic: true,
        color: theme.primaryColor,
      });
      addText(slide, safeText(spec.attribution, spec.subtitle ?? ""), 1.25, 4.25, canvas.w - 2.5, 0.55, {
        fontSize: 16,
        color: theme.mutedColor,
      });
      break;

    case "blank":
      break;

    case "bullets":
    default:
      renderTitle(slide, spec.title);
      renderBulletList(slide, spec.bullets ?? [], 0.85, 1.55, canvas.w - 1.7, 5.3);
      break;
  }
}

function renderElement(slide: any, element: ElementInput): void {
  const x = dim(element.x, 0.7, canvas.w);
  const y = dim(element.y, 1.0, canvas.h);
  const w = dim(element.w, canvas.w - x - 0.7, canvas.w - x);
  const h = dim(element.h, 0.7, canvas.h - y);

  switch (element.type) {
    case "text":
      addText(slide, safeText(element.text, ""), x, y, w, h, {
        fontSize: dim(element.fontSize, 18, 72),
        color: color(element.color, theme.textColor),
        bold: element.bold === true,
        italic: element.italic === true,
      });
      break;

    case "bullets":
      renderBulletList(slide, element.items ?? [], x, y, w, h, {
        fontSize: dim(element.fontSize, 18, 48),
        color: color(element.color, theme.textColor),
      });
      break;

    case "table":
      renderTable(slide, { rows: element.rows ?? [] }, x, y, w, h);
      break;

    case "metric":
      renderMetricCard(slide, {
        label: element.label,
        value: element.value,
        note: element.note,
      }, x, y, w, h, color(element.fill, "FFFFFF"));
      break;

    case "shape":
      renderShape(slide, element, x, y, w, h);
      break;
  }
}

function renderTitle(slide: any, title?: string): void {
  addText(slide, safeText(title, ""), 0.55, 0.42, canvas.w - 1.1, 0.75, {
    fontSize: 28,
    bold: true,
  });
  addAccentBar(slide, 0.57, 1.22, 1.45, 0.07);
}

function renderBulletList(
  slide: any,
  items: string[],
  x: number,
  y: number,
  w: number,
  h: number,
  options: { fontSize?: number; color?: string } = {},
): void {
  const cleanItems = items.map((item) => safeText(item, "")).filter(Boolean).slice(0, 12);
  if (cleanItems.length === 0) {
    addText(slide, " ", x, y, w, h, { fontSize: options.fontSize ?? 18 });
    return;
  }

  slide.addText(cleanItems.map((item) => ({
    text: item,
    options: {
      bullet: { indent: 18 },
      hanging: 4,
      breakLine: true,
    },
  })), {
    x,
    y,
    w,
    h,
    margin: 0.05,
    valign: "top",
    breakLine: false,
    fontFace: theme.fontFace,
    fontSize: options.fontSize ?? 18,
    color: color(options.color, theme.textColor),
    fit: "shrink",
  });
}

function renderTable(slide: any, table: TableInput | undefined, x: number, y: number, w: number, h: number): void {
  const headers = (table?.headers ?? []).map((cell) => safeText(cell, "")).filter(Boolean);
  const rows = (table?.rows ?? []).slice(0, 12).map((row) => row.map((cell) => safeText(cell, "")));
  const tableRows: any[] = [];

  if (headers.length > 0) {
    tableRows.push(headers.map((cell) => ({
      text: cell,
      options: {
        bold: true,
        color: "FFFFFF",
        fill: { color: theme.primaryColor },
      },
    })));
  }
  tableRows.push(...rows);

  if (tableRows.length === 0) {
    return;
  }

  slide.addTable(tableRows, {
    x,
    y,
    w,
    h,
    fontFace: theme.fontFace,
    fontSize: 11,
    color: theme.textColor,
    margin: 0.06,
    valign: "mid",
    border: { type: "solid", color: "CBD5E1", pt: 0.7 },
  });
}

function renderMetrics(slide: any, metrics: MetricInput[], x: number, y: number, w: number, h: number): void {
  const clean = metrics.slice(0, 6);
  if (clean.length === 0) return;

  const gap = 0.16;
  const cols = Math.min(clean.length, 3);
  const rows = Math.ceil(clean.length / cols);
  const cardW = (w - gap * (cols - 1)) / cols;
  const cardH = Math.min(1.65, (h - gap * (rows - 1)) / rows);

  clean.forEach((metric, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    renderMetricCard(
      slide,
      metric,
      x + col * (cardW + gap),
      y + row * (cardH + gap),
      cardW,
      cardH,
      "FFFFFF",
    );
  });
}

function renderMetricCard(
  slide: any,
  metric: MetricInput,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
): void {
  slide.addShape(shapeType("roundRect"), {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: "CBD5E1", transparency: 10 },
  });
  addText(slide, safeText(metric.value, ""), x + 0.18, y + 0.18, w - 0.36, 0.45, {
    fontSize: 24,
    bold: true,
    color: theme.primaryColor,
  });
  addText(slide, safeText(metric.label, ""), x + 0.18, y + 0.75, w - 0.36, 0.35, {
    fontSize: 12,
    bold: true,
    color: theme.textColor,
  });
  addText(slide, safeText(metric.note, ""), x + 0.18, y + 1.12, w - 0.36, Math.max(0.28, h - 1.2), {
    fontSize: 10,
    color: theme.mutedColor,
  });
}

function renderShape(slide: any, element: ElementInput, x: number, y: number, w: number, h: number): void {
  const shape = element.shape ?? "rect";
  slide.addShape(shapeType(shape), {
    x,
    y,
    w,
    h,
    fill: shape === "line" ? undefined : { color: color(element.fill, theme.accentColor), transparency: 20 },
    line: { color: color(element.color, theme.primaryColor), pt: shape === "line" ? 2 : 1 },
  });
}

function addText(
  slide: any,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  options: Record<string, unknown> = {},
): void {
  if (!text) return;
  slide.addText(text, {
    x,
    y,
    w,
    h,
    margin: 0.02,
    valign: "mid",
    fontFace: theme.fontFace,
    fontSize: 16,
    color: theme.textColor,
    fit: "shrink",
    ...options,
  });
}

function addAccentBar(slide: any, x: number, y: number, w: number, h: number): void {
  slide.addShape(shapeType("rect"), {
    x,
    y,
    w,
    h,
    fill: { color: theme.accentColor },
    line: { color: theme.accentColor },
  });
}

function normalizeSlides(input: DeckInput): SlideInput[] {
  const given = Array.isArray(input.slides) ? input.slides : [];
  const normalized = given.slice(0, 30).map((slide) => ({
    ...slide,
    layout: slide.layout ?? "bullets",
  }));

  if (normalized.length > 0) {
    return normalized;
  }

  return [{
    layout: "title",
    title: safeText(input.title, "Presentation"),
    subtitle: safeText(input.subtitle, ""),
  }];
}

function normalizeFilename(name: string): string {
  const base = safeText(name, "presentation")
    .replace(/\.pptx$/i, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "presentation";
  return `${base}.pptx`;
}

function safeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function color(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim().replace(/^#/, "").toUpperCase();
  return /^[0-9A-F]{6}$/.test(cleaned) ? cleaned : fallback;
}

function dim(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(value, max));
}

function shapeType(name: string): any {
  const source = (PptxGenJS as any).ShapeType ?? {};
  return source[name] ?? name;
}
