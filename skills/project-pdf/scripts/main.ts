import { PDFDocument, StandardFonts, rgb } from "@tensorpm/pdf";
import { context, output } from "@tensorpm/sdk";

interface ElementSpec {
  type?: "text" | "rect" | "line";
  text?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  fontSize?: number;
  color?: string;
  fill?: string;
  bold?: boolean;
}

interface PageSpec {
  size?: "letter" | "a4";
  backgroundColor?: string;
  elements?: ElementSpec[];
}

interface Inputs {
  filename?: string;
  title?: string;
  pages?: PageSpec[];
}

const inputs = (context.inputs ?? {}) as Inputs;
const pages = Array.isArray(inputs.pages) && inputs.pages.length > 0
  ? inputs.pages.slice(0, 100)
  : [{ elements: [{ type: "text", text: "PDF", x: 72, y: 720, fontSize: 24, bold: true }] }];
const title = text(inputs.title, "Document");
const filename = filenameFor(inputs.filename ?? title, ".pdf");

const pdf = await PDFDocument.create();
pdf.setTitle(title);
pdf.setProducer("TensorPM");
pdf.setCreator("TensorPM");

const regular = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

for (const spec of pages) {
  const pageSize = spec.size === "a4" ? [595.28, 841.89] : [612, 792];
  const page = pdf.addPage(pageSize as [number, number]);
  const { width, height } = page.getSize();
  const bg = parseColor(spec.backgroundColor);
  if (bg) {
    page.drawRectangle({ x: 0, y: 0, width, height, color: bg });
  }

  for (const element of spec.elements ?? []) {
    const x = dim(element.x, 72, width);
    const y = dim(element.y, height - 72, height);
    const w = dim(element.w, 240, width);
    const h = dim(element.h, 24, height);
    const stroke = parseColor(element.color) ?? rgb(0.05, 0.1, 0.2);
    const fill = parseColor(element.fill);

    switch (element.type) {
      case "rect":
        page.drawRectangle({
          x,
          y,
          width: w,
          height: h,
          color: fill ?? undefined,
          borderColor: stroke,
          borderWidth: 1,
        });
        break;
      case "line":
        page.drawLine({
          start: { x, y },
          end: { x: x + w, y: y + h },
          color: stroke,
          thickness: 1.5,
        });
        break;
      case "text":
      default:
        page.drawText(text(element.text, ""), {
          x,
          y,
          size: dim(element.fontSize, 12, 80),
          font: element.bold === true ? bold : regular,
          color: stroke,
          maxWidth: w,
          lineHeight: dim(element.fontSize, 12, 80) * 1.25,
        });
        break;
    }
  }
}

const bytes = await pdf.save();
const outDir = `${Deno.env.get("TPM_RUN_DIR") ?? "."}/out`;
try {
  Deno.mkdirSync(outDir, { recursive: true });
} catch {
  // Created by TensorPM in normal skill execution.
}
Deno.writeFileSync(`${outDir}/${filename}`, bytes);
console.log(`pdf ok: ${filename} (${bytes.byteLength} bytes, ${pages.length} pages)`);
output({ artifact: filename, pageCount: pages.length, title });

function parseColor(value: unknown): ReturnType<typeof rgb> | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/^#/, "");
  if (!/^[0-9A-Fa-f]{6}$/.test(cleaned)) return null;
  const n = Number.parseInt(cleaned, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function dim(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(value, max));
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function filenameFor(value: string, ext: string): string {
  const base = text(value, "document")
    .replace(new RegExp(`${ext}$`, "i"), "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "document";
  return `${base}${ext}`;
}
