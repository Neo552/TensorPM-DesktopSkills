// Fixture smoke test for the GAEB parser. Run with: node tests/gaeb-import/run-fixtures.mjs
// (Node >= 23.6 strips the parser's TypeScript types natively.)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mergeGaebResults, parseGaebXml } from '../../skills/gaeb-import/scripts/lib/gaebParser.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures');

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'OK ' : 'FAIL'} ${label}: ${actual}${ok ? '' : ` (expected ${expected})`}`);
}

function run(file, assertions) {
  console.log(`\n=== ${file} ===`);
  const result = parseGaebXml(readFileSync(join(fixtures, file), 'utf-8'));
  console.log(
    `  version=${result.meta.version} phase=${result.meta.phase} ` +
      `project="${result.meta.projectName}" currency=${result.meta.currency}`,
  );
  assertions(result);
  if (result.warnings.length > 0) {
    console.log(`  warnings (${result.warnings.length}):`);
    for (const w of result.warnings.slice(0, 5)) console.log(`    - ${w}`);
  }
  return result;
}

// X83 3.3 — BVBS certification file: 12 categories, 27 items, no prices
run('bvbs_pruefdatei_3.3_bauausfuehrung.x83', (r) => {
  check('phase', r.meta.phase, '83');
  check('categories', r.counts.categories, 12);
  check('items', r.counts.items, 27);
  check('markup items', r.counts.markupItems, 1);
  check('priced items', r.counts.priced, 0);
  const first = r.items[0];
  check('first item has OZ', first.oz.length > 0, true);
  check('first item short text non-empty', first.shortText.length > 0, true);
  console.log(`  sample: OZ=${first.oz} qty=${first.qty} ${first.qu} "${first.shortText.slice(0, 60)}"`);
});

// X84 3.3 — price overlay for the X83 above (prices, no texts)
run('bvbs_pruefdatei_3.3_bauausfuehrung.x84', (r) => {
  check('phase', r.meta.phase, '84');
  check('has priced items', r.counts.priced > 0, true);
  check('computed total exists', r.totals.computedTotal !== null, true);
  const markup = r.items.find((i) => i.kind === 'markup');
  console.log(
    `  fileTotal=${r.totals.fileTotal} computedTotal=${r.totals.computedTotal} ` +
      `markupItem=${markup ? `${markup.oz} base=${markup.itMarkup} pcnt=${markup.markupPcnt}` : 'none'}`,
  );
});

// X81 3.3 — Leistungsbeschreibung (texts only)
run('gaeb_pruefdatei_3.3_texterstellung.x81', (r) => {
  check('phase', r.meta.phase, '81');
  check('has items', r.counts.items > 0, true);
});

// X83Z 3.2 — Zeitvertragsarbeiten variant WITH unit prices
run('gaebde_beispiel_83Z_3.2.x83z.xml', (r) => {
  check('has items', r.counts.items > 0, true);
  check('has UP prices', r.items.some((i) => i.up !== null), true);
});

// X83 + X84 merge — the BVBS pair joined by OZ
console.log('\n=== merge: X83 base + X84 bid ===');
{
  const base = parseGaebXml(
    readFileSync(join(fixtures, 'bvbs_pruefdatei_3.3_bauausfuehrung.x83'), 'utf-8'),
  );
  const bid = parseGaebXml(
    readFileSync(join(fixtures, 'bvbs_pruefdatei_3.3_bauausfuehrung.x84'), 'utf-8'),
  );
  const { result, report } = mergeGaebResults(base, bid);
  console.log(
    `  matched=${report.matched} overlayOnly=${report.overlayOnly.length} ` +
      `stillUnpriced=${report.stillUnpriced.length}`,
  );
  check('merged phase', result.meta.phase, '83+84');
  check('most positions priced', report.matched >= 20, true);
  check('computed total from merge', result.totals.computedTotal !== null, true);
  const sample = result.items.find((i) => i.up !== null && i.shortText.length > 0);
  check('merged item has text AND price', sample !== undefined, true);
  if (sample) {
    console.log(`  sample: OZ=${sample.oz} "${sample.shortText.slice(0, 50)}" UP=${sample.up} IT=${sample.it}`);
  }
  const fallbackNamed = result.items.every((i) => i.shortText.length > 0);
  check('no empty item names after merge', fallbackNamed, true);
  if (report.overlayOnly.length > 0) {
    console.log(`  overlayOnly: ${report.overlayOnly.slice(0, 5).join(', ')}`);
  }
  if (report.stillUnpriced.length > 0) {
    console.log(`  stillUnpriced: ${report.stillUnpriced.slice(0, 8).join(', ')}`);
  }
}

// category_oz + short-text fallback sanity on the X83
{
  const r = parseGaebXml(
    readFileSync(join(fixtures, 'bvbs_pruefdatei_3.3_bauausfuehrung.x83'), 'utf-8'),
  );
  console.log('\n=== item metadata ===');
  const withParent = r.items.filter((i) => i.categoryOz !== null);
  check('all items carry category_oz', withParent.length, r.items.length);
  check('category_oz is OZ prefix', r.items.every((i) => i.oz.startsWith(`${i.categoryOz}.`)), true);
  check('no empty item names', r.items.every((i) => i.shortText.length > 0), true);
}

console.log(failures === 0 ? '\nAll fixture checks passed.' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
