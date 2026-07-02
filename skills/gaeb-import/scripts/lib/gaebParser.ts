/**
 * Read-only parser for GAEB DA XML bills of quantities (Leistungsverzeichnisse).
 *
 * Supported: GAEB DA XML 3.1/3.2/3.3, phases X80–X86 incl. Z variants
 * (namespace-agnostic via local names). GAEB 90 (.d81–.d86) and GAEB 2000
 * (.p81–.p86) are detected and rejected with a descriptive error.
 *
 * Design rules (see docs/gaeb-format-reference.md):
 * - RNoPart/RNoIndex are strings, never numbers (leading zeros are significant).
 * - The full OZ is the RNoPart path of enclosing BoQCtgy elements + the
 *   item's RNoPart (+ RNoIndex), joined with '.'.
 * - All numbers use the XML decimal-point format; values are parsed strictly
 *   and anomalies are reported as warnings instead of throwing.
 * - Received totals are never "corrected": file totals and computed totals
 *   are reported side by side.
 */

// Bundled fast-xml-parser 5.9.3 (MIT) — see THIRD_PARTY_NOTICES.md.
// @ts-ignore: vendored plain-JS module without type declarations
import { XMLParser } from '../vendor/fast-xml-parser.mjs';

export interface GaebBkdnLevel {
  type: string; // Lot | BoQLevel | Item | Index
  length: number | null;
  numeric: boolean;
}

export interface GaebCategory {
  rNoPart: string;
  oz: string;
  label: string;
  /** Total from the file (price phases), verbatim string, if present. */
  fileTotal: number | null;
  itemCount: number;
  children: GaebCategory[];
}

export interface GaebItem {
  kind: 'item' | 'markup';
  id: string | null;
  oz: string;
  rNoPart: string;
  rNoIndex: string | null;
  /** OZ of the immediate enclosing category (Titel), null at BoQ root. */
  categoryOz: string | null;
  /** Labels of enclosing categories, outermost first. */
  categoryPath: string[];
  shortText: string;
  longText: string | null;
  qty: number | null;
  qu: string | null;
  qtyTBD: boolean;
  lumpSum: boolean;
  provis: 'WithTotal' | 'WithoutTotal' | null;
  alnGroupNo: string | null;
  alnSerNo: string | null;
  notAppl: boolean;
  notOffered: boolean;
  refRNo: string | null;
  /** Unit price (price phases). */
  up: number | null;
  /** Item total (price phases). */
  it: number | null;
  /** MarkupItem only: base amount and percentage. */
  itMarkup: number | null;
  markupPcnt: number | null;
  /** Number of bidder text complement slots in the description. */
  bidderComplements: number;
  /** False for variants that do not count towards the bid sum. */
  inTotal: boolean;
}

export interface GaebMergeReport {
  /** Base positions that received a price from the overlay. */
  matched: number;
  /** Overlay OZs with no counterpart in the base LV (appended to items). */
  overlayOnly: string[];
  /** Base item OZs that stayed unpriced after the merge. */
  stillUnpriced: string[];
}

export interface GaebParseResult {
  meta: {
    format: 'gaeb-xml';
    namespace: string | null;
    version: string | null;
    phase: string | null;
    projectName: string | null;
    boqName: string | null;
    currency: string | null;
    program: string | null;
    date: string | null;
  };
  ozMask: GaebBkdnLevel[];
  categories: GaebCategory[];
  items: GaebItem[];
  totals: {
    fileTotal: number | null;
    /** Sum of item IT values with inTotal=true (2 decimals). */
    computedTotal: number | null;
  };
  counts: {
    categories: number;
    items: number;
    markupItems: number;
    priced: number;
    alternatives: number;
    provisWithoutTotal: number;
    bidderComplements: number;
  };
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/* preserveOrder node helpers                                          */
/* ------------------------------------------------------------------ */

type XAttrs = Record<string, string>;
/** fast-xml-parser preserveOrder node: { <tag>: XNode[], ':@'?: attrs } */
type XNode = Record<string, unknown>;

function tagOf(node: XNode): string | null {
  for (const key of Object.keys(node)) {
    if (key !== ':@' && key !== '#text') return key;
  }
  return null;
}

function attrsOf(node: XNode): XAttrs {
  return (node[':@'] as XAttrs | undefined) ?? {};
}

function childrenOf(node: XNode): XNode[] {
  const tag = tagOf(node);
  if (!tag) return [];
  const value = node[tag];
  return Array.isArray(value) ? (value as XNode[]) : [];
}

function findAll(nodes: XNode[], name: string): XNode[] {
  return nodes.filter((n) => tagOf(n) === name);
}

function findFirst(nodes: XNode[], name: string): XNode | null {
  return findAll(nodes, name)[0] ?? null;
}

/** Trimmed scalar text content of the first child element with `name`. */
function scalar(nodes: XNode[], name: string): string | null {
  const node = findFirst(nodes, name);
  if (!node) return null;
  const text = collectText(childrenOf(node)).trim();
  return text.length > 0 ? text : null;
}

function hasElement(nodes: XNode[], name: string): boolean {
  return findFirst(nodes, name) !== null;
}

/**
 * Flatten GAEB rich-text markup (p/span/br/div/ul/li/tr…) to plain text.
 * <br> and block elements become newlines; span fragments concatenate.
 */
function collectText(nodes: XNode[]): string {
  let out = '';
  for (const node of nodes) {
    if ('#text' in node) {
      out += String(node['#text']);
      continue;
    }
    const tag = tagOf(node);
    if (!tag) continue;
    if (tag === 'br') {
      out += '\n';
      continue;
    }
    const inner = collectText(childrenOf(node));
    if (tag === 'p' || tag === 'div' || tag === 'li' || tag === 'tr') {
      out += inner.trimEnd() + '\n';
    } else {
      out += inner;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* number parsing                                                      */
/* ------------------------------------------------------------------ */

const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

/** First non-empty line, capped for use as an item name. */
function firstLine(text: string | null): string | null {
  if (!text) return null;
  const line = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!line) return null;
  return line.length > 120 ? `${line.slice(0, 117)}...` : line;
}

function parseDecimal(
  raw: string | null,
  context: string,
  warnings: string[],
): number | null {
  if (raw === null) return null;
  const value = raw.trim();
  if (!DECIMAL_RE.test(value)) {
    warnings.push(`Unparsable number "${raw}" at ${context} — value ignored.`);
    return null;
  }
  return Number(value);
}

/* ------------------------------------------------------------------ */
/* format sniffing                                                     */
/* ------------------------------------------------------------------ */

export function sniffGaebFormat(
  text: string,
): 'gaeb-xml' | 'gaeb-90' | 'gaeb-2000' | 'unknown' {
  const head = text.slice(0, 4000);
  if (/<GAEB[\s>]/.test(head)) return 'gaeb-xml';
  if (/^\[\s*GAEB/m.test(head) || head.includes('[Zeichensatz]')) return 'gaeb-2000';
  // GAEB 90: fixed 80-char lines starting with a two-digit record type
  const lines = head.split(/\r?\n/).filter((l) => l.length > 0).slice(0, 5);
  if (lines.length > 0 && lines.every((l) => /^\d\d/.test(l))) return 'gaeb-90';
  return 'unknown';
}

/* ------------------------------------------------------------------ */
/* main parser                                                         */
/* ------------------------------------------------------------------ */

export function parseGaebXml(xmlText: string): GaebParseResult {
  const warnings: string[] = [];

  const format = sniffGaebFormat(xmlText);
  if (format === 'gaeb-90' || format === 'gaeb-2000') {
    throw new Error(
      `This file is ${format === 'gaeb-90' ? 'GAEB 90 (fixed-width text)' : 'GAEB 2000 (tag format)'}, ` +
        'not GAEB DA XML. Only GAEB DA XML (.x81/.x83/.x84 …) is supported. ' +
        'Ask the sender for a GAEB DA XML 3.2/3.3 export.',
    );
  }
  if (format !== 'gaeb-xml') {
    throw new Error('Not a GAEB file: no <GAEB> root element found.');
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    preserveOrder: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    removeNSPrefix: true,
  });
  const doc = parser.parse(xmlText) as XNode[];

  const gaeb = findFirst(doc, 'GAEB');
  if (!gaeb) {
    throw new Error('Malformed GAEB XML: <GAEB> root element missing after parse.');
  }
  const namespace = attrsOf(gaeb)['xmlns'] ?? null;
  const gaebChildren = childrenOf(gaeb);

  const gaebInfo = findFirst(gaebChildren, 'GAEBInfo');
  const prjInfo = findFirst(gaebChildren, 'PrjInfo');
  const award = findFirst(gaebChildren, 'Award');
  const awardChildren = award ? childrenOf(award) : [];
  const awardInfo = findFirst(awardChildren, 'AwardInfo');

  const boq = findFirst(awardChildren, 'BoQ');
  if (!boq) {
    throw new Error(
      'No <BoQ> (bill of quantities) found — the file may be a phase without an LV body.',
    );
  }
  const boqChildren = childrenOf(boq);
  const boqInfo = findFirst(boqChildren, 'BoQInfo');
  const boqInfoChildren = boqInfo ? childrenOf(boqInfo) : [];

  /* --- OZ mask --------------------------------------------------- */
  const ozMask: GaebBkdnLevel[] = findAll(boqInfoChildren, 'BoQBkdn').map((bkdn) => {
    const c = childrenOf(bkdn);
    return {
      type: scalar(c, 'Type') ?? 'Unknown',
      length: parseDecimal(scalar(c, 'Length'), 'BoQBkdn/Length', warnings),
      numeric: scalar(c, 'Num') === 'Yes',
    };
  });

  /* --- walk the category tree ------------------------------------ */
  const items: GaebItem[] = [];
  const seenOz = new Set<string>();
  let markupItems = 0;

  const walkBody = (
    bodyNode: XNode,
    ozParts: string[],
    labelPath: string[],
  ): { categories: GaebCategory[]; itemCount: number } => {
    const categories: GaebCategory[] = [];
    let itemCount = 0;

    for (const child of childrenOf(bodyNode)) {
      const tag = tagOf(child);
      if (tag === 'BoQCtgy') {
        const attrs = attrsOf(child);
        const rNoPart = attrs['RNoPart'] ?? '';
        const ctgyChildren = childrenOf(child);
        const label = collectText(
          childrenOf(findFirst(ctgyChildren, 'LblTx') ?? {}),
        ).trim();
        const nextOz = rNoPart ? [...ozParts, rNoPart] : ozParts;
        const innerBody = findFirst(ctgyChildren, 'BoQBody');
        const inner = innerBody
          ? walkBody(innerBody, nextOz, [...labelPath, label])
          : { categories: [], itemCount: 0 };
        const totalsNode = findFirst(ctgyChildren, 'Totals');
        const fileTotal = totalsNode
          ? parseDecimal(
              scalar(childrenOf(totalsNode), 'Total'),
              `Totals of category ${nextOz.join('.')}`,
              warnings,
            )
          : null;
        categories.push({
          rNoPart,
          oz: nextOz.join('.'),
          label,
          fileTotal,
          itemCount: inner.itemCount,
          children: inner.categories,
        });
        itemCount += inner.itemCount;
      } else if (tag === 'Itemlist') {
        for (const itemNode of childrenOf(child)) {
          const itemTag = tagOf(itemNode);
          if (itemTag !== 'Item' && itemTag !== 'MarkupItem') continue;
          const parsed = parseItem(
            itemNode,
            itemTag === 'MarkupItem' ? 'markup' : 'item',
            ozParts,
            ozParts.length > 0 ? ozParts.join('.') : null,
            labelPath,
            warnings,
          );
          if (seenOz.has(parsed.oz)) {
            warnings.push(`Duplicate OZ ${parsed.oz} — GAEB requires unique OZs.`);
          }
          seenOz.add(parsed.oz);
          if (parsed.kind === 'markup') markupItems += 1;
          items.push(parsed);
          itemCount += 1;
        }
      }
      // Remark / PerfDescr are intentionally skipped in v0.1.
    }
    return { categories, itemCount };
  };

  const boqBody = findFirst(boqChildren, 'BoQBody');
  const walked = boqBody
    ? walkBody(boqBody, [], [])
    : { categories: [], itemCount: 0 };
  if (!boqBody) warnings.push('BoQ has no BoQBody — empty bill of quantities.');

  /* --- totals ----------------------------------------------------- */
  const boqTotalsNode = findFirst(boqInfoChildren, 'Totals');
  const fileTotal = boqTotalsNode
    ? parseDecimal(
        scalar(childrenOf(boqTotalsNode), 'Total'),
        'BoQInfo/Totals/Total',
        warnings,
      )
    : null;

  const computedTotal = computeItemSum(items);
  warnTotalMismatch(fileTotal, computedTotal, warnings);

  return {
    meta: {
      format: 'gaeb-xml',
      namespace,
      version: gaebInfo ? scalar(childrenOf(gaebInfo), 'Version') : null,
      phase: award ? scalar(awardChildren, 'DP') : null,
      projectName: prjInfo
        ? (scalar(childrenOf(prjInfo), 'NamePrj') ?? scalar(childrenOf(prjInfo), 'LblPrj'))
        : null,
      boqName:
        scalar(boqInfoChildren, 'Name') ?? scalar(boqInfoChildren, 'LblBoQ'),
      currency:
        (prjInfo ? scalar(childrenOf(prjInfo), 'Cur') : null) ??
        (awardInfo ? scalar(childrenOf(awardInfo), 'Cur') : null),
      program: gaebInfo ? scalar(childrenOf(gaebInfo), 'ProgName') : null,
      date: gaebInfo ? scalar(childrenOf(gaebInfo), 'Date') : null,
    },
    ozMask,
    categories: walked.categories,
    items,
    totals: { fileTotal, computedTotal },
    counts: computeCounts(items, walked.categories),
    warnings,
  };
}

function computeCounts(
  items: GaebItem[],
  categories: GaebCategory[],
): GaebParseResult['counts'] {
  const countCategories = (cats: GaebCategory[]): number =>
    cats.reduce((n, c) => n + 1 + countCategories(c.children), 0);
  return {
    categories: countCategories(categories),
    items: items.filter((i) => i.kind === 'item').length,
    markupItems: items.filter((i) => i.kind === 'markup').length,
    priced: items.filter((i) => i.it !== null).length,
    alternatives: items.filter((i) => i.alnSerNo !== null && i.alnSerNo !== '0').length,
    provisWithoutTotal: items.filter((i) => i.provis === 'WithoutTotal').length,
    bidderComplements: items.reduce((n, i) => n + i.bidderComplements, 0),
  };
}

/** Sum of IT values of in-total items, commercially rounded to 2 decimals. */
function computeItemSum(items: GaebItem[]): number | null {
  if (!items.some((i) => i.it !== null)) return null;
  return (
    Math.round(
      items.reduce((sum, i) => sum + (i.inTotal && i.it !== null ? i.it : 0), 0) * 100,
    ) / 100
  );
}

function warnTotalMismatch(
  fileTotal: number | null,
  computedTotal: number | null,
  warnings: string[],
): void {
  if (fileTotal !== null && computedTotal !== null && Math.abs(fileTotal - computedTotal) > 0.01) {
    warnings.push(
      `File total ${fileTotal} differs from computed item sum ${computedTotal} ` +
        '(rounding differences between AVA programs are common — report, do not "fix").',
    );
  }
}

export function computeInTotal(
  item: Pick<GaebItem, 'alnSerNo' | 'provis' | 'notAppl' | 'notOffered'>,
): boolean {
  const isAlternative = item.alnSerNo !== null && item.alnSerNo !== '0';
  return (
    !isAlternative &&
    item.provis !== 'WithoutTotal' &&
    !item.notAppl &&
    !item.notOffered
  );
}

/**
 * Deterministic X83+X84 merge: the base LV (X83) provides structure, texts,
 * and quantities; the overlay (X84 bid) provides prices. Positions are
 * joined by OZ — never by file-internal IDs, which differ between phases.
 */
export function mergeGaebResults(
  base: GaebParseResult,
  overlay: GaebParseResult,
): { result: GaebParseResult; report: GaebMergeReport } {
  const warnings = [...base.warnings, ...overlay.warnings.map((w) => `[bid] ${w}`)];
  const overlayByOz = new Map(overlay.items.map((i) => [i.oz, i]));

  let matched = 0;
  const mergedItems: GaebItem[] = base.items.map((baseItem) => {
    const bid = overlayByOz.get(baseItem.oz);
    if (!bid) return { ...baseItem };
    overlayByOz.delete(baseItem.oz);
    if (bid.up !== null || bid.it !== null) matched += 1;
    const merged: GaebItem = {
      ...baseItem,
      // Freie Menge: the bidder fills the quantity in the X84.
      qty: baseItem.qtyTBD && bid.qty !== null ? bid.qty : baseItem.qty,
      up: bid.up ?? baseItem.up,
      it: bid.it ?? baseItem.it,
      itMarkup: bid.itMarkup ?? baseItem.itMarkup,
      markupPcnt: bid.markupPcnt ?? baseItem.markupPcnt,
      notOffered: baseItem.notOffered || bid.notOffered,
    };
    merged.inTotal = computeInTotal(merged);
    return merged;
  });

  const overlayOnly = [...overlayByOz.keys()];
  for (const oz of overlayOnly) {
    const orphan = overlayByOz.get(oz);
    if (orphan) mergedItems.push({ ...orphan });
    warnings.push(`Bid contains OZ ${oz} that does not exist in the base LV.`);
  }
  const stillUnpriced = mergedItems
    .filter((i) => i.kind === 'item' && i.it === null && i.up === null && i.inTotal)
    .map((i) => i.oz);
  if (stillUnpriced.length > 0) {
    warnings.push(
      `${stillUnpriced.length} base position(s) received no price from the bid ` +
        `(first: ${stillUnpriced.slice(0, 5).join(', ')}).`,
    );
  }

  // Category totals from the bid, applied onto the base tree by OZ.
  const overlayCtgyTotals = new Map<string, number>();
  const collectTotals = (cats: GaebCategory[]): void => {
    for (const c of cats) {
      if (c.fileTotal !== null) overlayCtgyTotals.set(c.oz, c.fileTotal);
      collectTotals(c.children);
    }
  };
  collectTotals(overlay.categories);
  const applyTotals = (cats: GaebCategory[]): GaebCategory[] =>
    cats.map((c) => ({
      ...c,
      fileTotal: overlayCtgyTotals.get(c.oz) ?? c.fileTotal,
      children: applyTotals(c.children),
    }));

  if (
    base.meta.currency &&
    overlay.meta.currency &&
    base.meta.currency !== overlay.meta.currency
  ) {
    warnings.push(
      `Currency mismatch: base LV is ${base.meta.currency}, bid is ${overlay.meta.currency}.`,
    );
  }

  const fileTotal = overlay.totals.fileTotal ?? base.totals.fileTotal;
  const computedTotal = computeItemSum(mergedItems);
  warnTotalMismatch(fileTotal, computedTotal, warnings);

  const categories = applyTotals(base.categories);
  const result: GaebParseResult = {
    meta: {
      ...base.meta,
      phase:
        base.meta.phase && overlay.meta.phase
          ? `${base.meta.phase}+${overlay.meta.phase}`
          : (base.meta.phase ?? overlay.meta.phase),
      currency: base.meta.currency ?? overlay.meta.currency,
    },
    ozMask: base.ozMask,
    categories,
    items: mergedItems,
    totals: { fileTotal, computedTotal },
    counts: computeCounts(mergedItems, categories),
    warnings,
  };
  return {
    result,
    report: { matched, overlayOnly, stillUnpriced },
  };
}

function parseItem(
  itemNode: XNode,
  kind: 'item' | 'markup',
  ozParts: string[],
  categoryOz: string | null,
  labelPath: string[],
  warnings: string[],
): GaebItem {
  const attrs = attrsOf(itemNode);
  const c = childrenOf(itemNode);
  const rNoPart = attrs['RNoPart'] ?? '';
  const rNoIndex = attrs['RNoIndex'] ?? null;
  const oz = [...ozParts, rNoPart].filter((p) => p.length > 0).join('.') +
    (rNoIndex ? `.${rNoIndex}` : '');

  const description = findFirst(c, 'Description');
  const complete = description
    ? findFirst(childrenOf(description), 'CompleteText')
    : null;
  const completeChildren = complete ? childrenOf(complete) : [];

  const outline = findFirst(completeChildren, 'OutlineText');
  const outlineText = outline ? collectText(childrenOf(outline)).trim() : '';

  const detail = findFirst(completeChildren, 'DetailTxt');
  const longText = detail ? collectText(childrenOf(detail)).trim() : null;

  // LVs with OutlCompl=DetailTxt carry no short texts — fall back to the
  // first long-text line so downstream item names are never empty.
  const shortText =
    outlineText.length > 0
      ? outlineText
      : (firstLine(longText) ?? `Position ${oz}`);

  let bidderComplements = 0;
  const countComplements = (nodes: XNode[]): void => {
    for (const node of nodes) {
      const tag = tagOf(node);
      if (tag === 'TextComplement' && attrsOf(node)['Kind'] !== 'Owner') {
        bidderComplements += 1;
      }
      if (tag) countComplements(childrenOf(node));
    }
  };
  if (detail) countComplements(childrenOf(detail));

  const provisRaw = scalar(c, 'Provis');
  const provis =
    provisRaw === 'WithTotal' || provisRaw === 'WithoutTotal' ? provisRaw : null;
  if (provisRaw && !provis) {
    warnings.push(`Unknown Provis value "${provisRaw}" at OZ ${oz}.`);
  }
  const alnSerNo = scalar(c, 'ALNSerNo');
  const notAppl = hasElement(c, 'NotAppl');
  const notOffered = hasElement(c, 'NotOffered');
  const inTotal = computeInTotal({ alnSerNo, provis, notAppl, notOffered });

  return {
    kind,
    id: attrs['ID'] ?? null,
    oz,
    rNoPart,
    rNoIndex,
    categoryOz,
    categoryPath: labelPath,
    shortText,
    longText: longText && longText.length > 0 ? longText : null,
    qty: parseDecimal(scalar(c, 'Qty'), `Qty of OZ ${oz}`, warnings),
    qu: scalar(c, 'QU'),
    qtyTBD: scalar(c, 'QtyTBD') === 'Yes',
    lumpSum: scalar(c, 'LumpSumItem') === 'Yes',
    provis,
    alnGroupNo: scalar(c, 'ALNGroupNo'),
    alnSerNo,
    notAppl,
    notOffered,
    refRNo: scalar(c, 'RefRNo'),
    up: parseDecimal(scalar(c, 'UP'), `UP of OZ ${oz}`, warnings),
    it: parseDecimal(scalar(c, 'IT'), `IT of OZ ${oz}`, warnings),
    itMarkup: parseDecimal(scalar(c, 'ITMarkup'), `ITMarkup of OZ ${oz}`, warnings),
    markupPcnt: parseDecimal(scalar(c, 'Markup'), `Markup of OZ ${oz}`, warnings),
    bidderComplements,
    inTotal,
  };
}
