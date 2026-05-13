import writeXlsxFile from "@tensorpm/xlsx";
import { context, output } from "@tensorpm/sdk";

type CellPrimitive = string | number | boolean | null;

interface CellObject {
  value?: CellPrimitive;
  formula?: string;
  format?: string;
  fontWeight?: string;
  fontStyle?: string;
  backgroundColor?: string;
  textColor?: string;
  align?: string;
  columnSpan?: number;
}

interface SheetSpec {
  name?: string;
  rows?: Array<Array<CellPrimitive | CellObject>>;
}

interface Inputs {
  filename?: string;
  sheets?: SheetSpec[];
}

const inputs = (context.inputs ?? {}) as Inputs;
const sheets = normalizeSheets(inputs.sheets);
const filename = filenameFor(inputs.filename ?? "workbook", ".xlsx");

const workbook = await writeXlsxFile(sheets.map((sheet) => ({
  sheet: sheet.name,
  data: sheet.rows,
})));
const blob = await workbook.toBlob();
const bytes = new Uint8Array(await blob.arrayBuffer());
const outDir = `${Deno.env.get("TPM_RUN_DIR") ?? "."}/out`;
try {
  Deno.mkdirSync(outDir, { recursive: true });
} catch {
  // Created by TensorPM in normal skill execution.
}
Deno.writeFileSync(`${outDir}/${filename}`, bytes);
console.log(`xlsx ok: ${filename} (${bytes.byteLength} bytes, ${sheets.length} sheets)`);
output({ artifact: filename, sheetCount: sheets.length });

function normalizeSheets(value: unknown): Array<{ name: string; rows: any[][] }> {
  const raw = Array.isArray(value) ? value.slice(0, 20) as SheetSpec[] : [];
  const sheets = raw.map((sheet, index) => ({
    name: sheetName(sheet.name, index),
    rows: normalizeRows(sheet.rows),
  })).filter((sheet) => sheet.rows.length > 0);

  return sheets.length > 0 ? sheets : [{
    name: "Sheet 1",
    rows: [["Value"], ["Workbook"]],
  }];
}

function normalizeRows(rows: unknown): any[][] {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 5000).map((row) => {
    if (!Array.isArray(row)) return [];
    return row.slice(0, 100).map(normalizeCell);
  });
}

function normalizeCell(cell: unknown): unknown {
  if (cell === null || typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean") {
    return cell;
  }
  if (typeof cell !== "object") return String(cell ?? "");

  const c = cell as CellObject;
  const value = typeof c.formula === "string" && c.formula.trim()
    ? { value: c.formula.trim(), type: "Formula" }
    : { value: c.value ?? null };

  return {
    ...value,
    format: stringOrUndefined(c.format),
    fontWeight: stringOrUndefined(c.fontWeight),
    fontStyle: stringOrUndefined(c.fontStyle),
    backgroundColor: cssColor(c.backgroundColor),
    textColor: cssColor(c.textColor),
    align: stringOrUndefined(c.align),
    columnSpan: positiveInt(c.columnSpan),
  };
}

function sheetName(value: unknown, index: number): string {
  const base = typeof value === "string" && value.trim() ? value.trim() : `Sheet ${index + 1}`;
  return base.replace(/[\[\]:*?/\\]/g, " ").slice(0, 31).trim() || `Sheet ${index + 1}`;
}

function filenameFor(value: string, ext: string): string {
  const base = (typeof value === "string" && value.trim() ? value.trim() : "workbook")
    .replace(new RegExp(`${ext}$`, "i"), "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "workbook";
  return `${base}${ext}`;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function positiveInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 1
    ? Math.floor(value)
    : undefined;
}

function cssColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(cleaned)) return cleaned;
  if (/^[0-9A-Fa-f]{6}$/.test(cleaned)) return `#${cleaned}`;
  return undefined;
}
