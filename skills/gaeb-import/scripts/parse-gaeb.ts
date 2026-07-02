import { context, output } from '@tensorpm/sdk';

import {
  type GaebCategory,
  type GaebItem,
  type GaebMergeReport,
  type GaebParseResult,
  mergeGaebResults,
  parseGaebXml,
} from './lib/gaebParser.ts';

type Inputs = {
  file_path: string;
  base_file?: string;
  mode?: 'summary' | 'items';
  offset?: number;
  limit?: number;
  include_long_text?: boolean;
};

const GAEB_EXT_RE = /\.(x8\d[a-z]*|xml|d8\d|p8\d)$/i;
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;
const MARKDOWN_ROW_CAP = 500;

const inputs = context.inputs as Inputs;
const projectRoot = Deno.env.get('TPM_PROJECT_ROOT');
const outPath = Deno.env.get('TPM_OUT_PATH');

if (!projectRoot || !outPath) {
  throw new Error('Missing TensorPM project/run environment.');
}

const rel = assertProjectRelative(inputs.file_path, 'file_path');
if (!rel.startsWith('gaeb/')) {
  throw new Error(
    `file_path must be inside the project's gaeb/ folder (got: ${rel}). ` +
      'Move the GAEB file into gaeb/ and retry — the skill can only read that folder.',
  );
}
if (!GAEB_EXT_RE.test(rel)) {
  throw new Error(
    `file_path must be a GAEB file (.x81/.x83/.x84 …, or .xml-wrapped GAEB), got: ${rel}`,
  );
}

let result = parseGaebXml(await readGaebFile(rel));
let mergeReport: GaebMergeReport | null = null;

if (inputs.base_file) {
  // Bid workflow: file_path is the X84, base_file the original X83.
  // The merge joins by OZ deterministically — the model never matches rows.
  const baseRel = assertProjectRelative(inputs.base_file, 'base_file');
  if (!baseRel.startsWith('gaeb/')) {
    throw new Error(`base_file must be inside the project's gaeb/ folder (got: ${baseRel}).`);
  }
  const base = parseGaebXml(await readGaebFile(baseRel));
  const merged = mergeGaebResults(base, result);
  result = merged.result;
  mergeReport = merged.report;
}

const mode = inputs.mode === 'items' ? 'items' : 'summary';

if (mode === 'items') {
  const offset = clampInt(inputs.offset ?? 0, 0, Number.MAX_SAFE_INTEGER);
  const limit = clampInt(inputs.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT);
  const page = result.items.slice(offset, offset + limit).map((item) =>
    compactItem(item, inputs.include_long_text === true),
  );
  output({
    mode,
    file: rel,
    ...(inputs.base_file ? { base_file: inputs.base_file, merge: mergeReport } : {}),
    offset,
    limit,
    total_items: result.items.length,
    has_more: offset + limit < result.items.length,
    currency: result.meta.currency,
    items: page,
  });
} else {
  // Full item list + human-readable overview go to artifacts; output.json
  // stays compact because it is fed back into the model context.
  const outDir = outPath.replace(/\/output\.json$/, '');
  await Deno.writeTextFile(
    `${outDir}/gaeb-items.json`,
    JSON.stringify(
      { file: rel, meta: result.meta, items: result.items },
      null,
      1,
    ),
  );
  await Deno.writeTextFile(`${outDir}/gaeb-summary.md`, buildMarkdown(rel, result));

  output({
    mode,
    file: rel,
    ...(inputs.base_file ? { base_file: inputs.base_file, merge: mergeReport } : {}),
    meta: result.meta,
    oz_mask: result.ozMask,
    counts: result.counts,
    totals: result.totals,
    categories: result.categories.map(compactCategory),
    warnings: result.warnings.slice(0, 25),
    artifacts: ['gaeb-items.json', 'gaeb-summary.md'],
    next_step:
      'Fetch positions page-wise with mode="items" (offset/limit) and propose ' +
      'material items from them; never retype numbers from memory.',
  });
}

/* ------------------------------------------------------------------ */

function compactCategory(c: GaebCategory): Record<string, unknown> {
  return {
    oz: c.oz,
    label: c.label,
    items: c.itemCount,
    total: c.fileTotal,
    children: c.children.map(compactCategory),
  };
}

function compactItem(i: GaebItem, includeLongText: boolean): Record<string, unknown> {
  const flags: string[] = [];
  if (i.kind === 'markup') flags.push('markup');
  if (i.lumpSum) flags.push('lump_sum');
  if (i.qtyTBD) flags.push('qty_tbd');
  if (i.provis === 'WithTotal') flags.push('provisional');
  if (i.provis === 'WithoutTotal') flags.push('provisional_no_total');
  if (i.alnSerNo !== null && i.alnSerNo !== '0') flags.push('alternative');
  if (i.alnSerNo === '0') flags.push('base_position');
  if (i.notAppl) flags.push('not_applicable');
  if (i.notOffered) flags.push('not_offered');
  if (i.bidderComplements > 0) flags.push(`bidder_inputs:${i.bidderComplements}`);

  // TensorPM clamps negative monetary values to 0, but negative prices are
  // legitimate GAEB (Nachlass positions) — keep them out of save_args and
  // surface them in the notes instead of silently zeroing them.
  const negativeNotes: string[] = [];
  const up = i.up !== null && i.up < 0 ? (negativeNotes.push(`EP ${i.up}`), null) : i.up;
  const it = i.it !== null && i.it < 0 ? (negativeNotes.push(`GB ${i.it}`), null) : i.it;
  if (negativeNotes.length > 0) flags.push('negative_price');

  const notes = [
    ...(flags.length > 0 ? [`GAEB: ${flags.join(', ')}`] : []),
    ...(negativeNotes.length > 0 ? [`Negativbeträge (Nachlass): ${negativeNotes.join(', ')}`] : []),
  ];

  return {
    oz: i.oz,
    category_oz: i.categoryOz,
    in_total: i.inTotal,
    ...(flags.length > 0 ? { flags } : {}),
    /** Verbatim arguments for material_save_item — do not retype values. */
    save_args: {
      positionRef: i.oz,
      name: i.shortText,
      ...(i.qty !== null ? { quantity: i.qty } : {}),
      ...(i.qu !== null ? { unit: i.qu } : {}),
      ...(up !== null ? { unitPriceAmount: up } : {}),
      ...(it !== null ? { estimatedCostAmount: it } : {}),
      ...(includeLongText && i.longText ? { description: i.longText } : {}),
      ...(notes.length > 0 ? { notes: notes.join(' | ') } : {}),
    },
  };
}

function buildMarkdown(rel: string, r: GaebParseResult): string {
  const lines: string[] = [];
  lines.push(`# GAEB-Import: ${r.meta.boqName ?? rel}`);
  lines.push('');
  lines.push(
    `Datei: \`${rel}\` · GAEB DA XML ${r.meta.version ?? '?'} · Phase X${r.meta.phase ?? '?'} · ` +
      `Währung ${r.meta.currency ?? '?'} · ${r.counts.items} Positionen in ${r.counts.categories} Bereichen`,
  );
  if (r.totals.fileTotal !== null || r.totals.computedTotal !== null) {
    lines.push(
      `Summe laut Datei: ${r.totals.fileTotal ?? '–'} · rechnerisch: ${r.totals.computedTotal ?? '–'}`,
    );
  }
  lines.push('');
  lines.push('| OZ | Kurztext | Menge | Einheit | EP | GB |');
  lines.push('|---|---|---:|---|---:|---:|');
  for (const item of r.items.slice(0, MARKDOWN_ROW_CAP)) {
    const marker = item.inTotal ? '' : ' *';
    lines.push(
      `| ${item.oz}${marker} | ${item.shortText.replace(/\|/g, '\\|').slice(0, 80)} | ` +
        `${item.qty ?? ''} | ${item.qu ?? ''} | ${item.up ?? ''} | ${item.it ?? ''} |`,
    );
  }
  if (r.items.length > MARKDOWN_ROW_CAP) {
    lines.push('');
    lines.push(`… ${r.items.length - MARKDOWN_ROW_CAP} weitere Positionen (siehe gaeb-items.json).`);
  }
  lines.push('');
  lines.push('`*` = zählt nicht zur Angebotssumme (Alternative/Bedarf ohne GB/entfällt).');
  if (r.warnings.length > 0) {
    lines.push('');
    lines.push('## Hinweise');
    for (const w of r.warnings) lines.push(`- ${w}`);
  }
  return lines.join('\n');
}

async function readGaebFile(relPath: string): Promise<string> {
  const bytes = await Deno.readFile(`${projectRoot!.replace(/\/+$/, '')}/${relPath}`);
  return decodeGaeb(bytes);
}

function decodeGaeb(bytes: Uint8Array): string {
  try {
    return stripBom(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    // Legacy exporters occasionally ship Windows-1252 despite a UTF-8 prolog.
    return stripBom(new TextDecoder('windows-1252').decode(bytes));
  }
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function clampInt(value: number, min: number, max: number): number {
  const n = Math.trunc(Number.isFinite(value) ? value : min);
  return Math.min(Math.max(n, min), max);
}

function assertProjectRelative(value: string | undefined, label: string): string {
  if (!value || typeof value !== 'string') {
    throw new Error(`${label} is required.`);
  }
  const normalized = value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
  const parts = normalized.split('/');
  if (parts.length === 0 || parts.some((part) => part === '.' || part === '..' || part === '')) {
    throw new Error(`${label} must be a project-relative path without . or .. segments.`);
  }
  return parts.join('/');
}
