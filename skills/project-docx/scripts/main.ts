import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "@tensorpm/docx";
import { context, output } from "@tensorpm/sdk";

interface RunSpec {
  text?: string;
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
}

interface BlockSpec {
  type?: "heading" | "paragraph" | "bullets" | "table" | "pageBreak";
  text?: string;
  level?: number;
  runs?: RunSpec[];
  items?: string[];
  rows?: string[][];
}

interface Inputs {
  filename?: string;
  title?: string;
  creator?: string;
  blocks?: BlockSpec[];
}

const inputs = (context.inputs ?? {}) as Inputs;
const blocks = Array.isArray(inputs.blocks) && inputs.blocks.length > 0
  ? inputs.blocks.slice(0, 200)
  : [{ type: "paragraph", text: "Document" }];
const title = text(inputs.title, "Document");
const filename = filenameFor(inputs.filename ?? title, ".docx");

const children: Array<Paragraph | Table> = [];
for (const block of blocks) {
  switch (block.type) {
    case "heading":
      children.push(new Paragraph({
        text: text(block.text, ""),
        heading: heading(block.level),
      }));
      break;
    case "bullets":
      for (const item of (block.items ?? []).slice(0, 100)) {
        children.push(new Paragraph({
          children: [new TextRun(text(item, ""))],
          bullet: { level: 0 },
        }));
      }
      break;
    case "table":
      children.push(renderTable(block.rows ?? []));
      break;
    case "pageBreak":
      children.push(new Paragraph({ children: [new PageBreak()] }));
      break;
    case "paragraph":
    default:
      children.push(new Paragraph({
        children: renderRuns(block),
        alignment: AlignmentType.LEFT,
      }));
      break;
  }
}

const doc = new Document({
  creator: text(inputs.creator, "TensorPM"),
  title,
  sections: [{
    properties: {},
    children,
  }],
});

const blob = await Packer.toBlob(doc);
const bytes = new Uint8Array(await blob.arrayBuffer());
const outDir = `${Deno.env.get("TPM_RUN_DIR") ?? "."}/out`;
try {
  Deno.mkdirSync(outDir, { recursive: true });
} catch {
  // Created by TensorPM in normal skill execution.
}
Deno.writeFileSync(`${outDir}/${filename}`, bytes);
console.log(`docx ok: ${filename} (${bytes.byteLength} bytes, ${blocks.length} blocks)`);
output({ artifact: filename, blockCount: blocks.length, title });

function renderRuns(block: BlockSpec): TextRun[] {
  const runs = Array.isArray(block.runs) && block.runs.length > 0
    ? block.runs
    : [{ text: block.text ?? "" }];
  return runs.map((run) => new TextRun({
    text: text(run.text, ""),
    bold: run.bold === true,
    italics: run.italics === true,
    underline: run.underline === true ? {} : undefined,
  }));
}

function renderTable(rows: string[][]): Table {
  const tableRows = rows.slice(0, 80).map((row) => new TableRow({
    children: row.slice(0, 12).map((cell) => new TableCell({
      width: { size: Math.floor(100 / Math.max(1, row.length)), type: WidthType.PERCENTAGE },
      children: [new Paragraph(text(cell, ""))],
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows.length > 0 ? tableRows : [new TableRow({
      children: [new TableCell({ children: [new Paragraph(" ")] })],
    })],
  });
}

function heading(level: unknown): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  const safe = typeof level === "number" ? Math.max(1, Math.min(6, Math.floor(level))) : 1;
  return [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ][safe - 1];
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
