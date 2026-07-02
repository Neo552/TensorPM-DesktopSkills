# GAEB format reference (condensed implementation notes)

Condensed from primary sources (official Fachdokumentation GAEB DA XML 3.3
2023-01, official XSDs, BVBS certification files), researched 2026-07-02.
Full sources listed at the bottom.

## Format families

| Family | Extensions | Status | Parser support |
|---|---|---|---|
| GAEB DA XML 3.1/3.2/3.3 | `.x80`–`.x89` (+ Z variants) | dominant since ~2013 | **supported** |
| GAEB 90 | `.d81`–`.d86` | legacy, still seen from small/old senders | detected, rejected |
| GAEB 2000 | `.p81`–`.p86` | rare transitional format | detected, rejected |

Phases: X81 Leistungsbeschreibung · X83 Angebotsaufforderung · X84
Angebotsabgabe · X86 Auftragserteilung (+ X82, X85, X89, Z variants). The
authoritative phase is `<Award><DP>`, **not** the file extension.

## XML structure essentials

- Root: `<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/DA{phase}/{version}">`.
  3.0 and 3.1 share namespace `…/200407`; version disambiguates via
  `GAEBInfo/Version`. Parse namespace-agnostically (local names).
- Skeleton: `GAEB → GAEBInfo | PrjInfo | Award → (DP, AwardInfo, OWN, CTR,
  AddText, BoQ → (BoQInfo, BoQBody))`.
- `BoQInfo/BoQBkdn` defines the OZ mask: `Type ∈ {Lot, BoQLevel, Item,
  Index}`, `Length` (sum ≤ 14), `Num`. Max 5 hierarchy levels incl. Lot,
  Index always 1 char.
- `BoQBody` recurses: `BoQCtgy` (attr `RNoPart`, label `LblTx`) contains a
  nested `BoQBody`; the innermost level holds `Itemlist → Item | MarkupItem`.
- **OZ** = concatenated `RNoPart` of enclosing `BoQCtgy`s + item `RNoPart`
  (+ `RNoIndex`), display-joined with `.`. `RNoPart` is a **string** (leading
  zeros significant, chars `[0-9A-Za-z_ ]`); ASCII sort = normative order.
- Item content: `Qty`, `QU`, `Description → CompleteText → (OutlineText
  [short], DetailTxt [long, legally binding])`. Texts are rich markup
  (`p`/`span`/`br`/tables/`image`); `TextComplement` = fill-in slots
  (`Kind="Bidder"` ones must be answered in the X84).
- Prices (price phases): `UP` (unit price, 3 decimals), `UPComp1..6`
  (breakdown, sum = UP), `IT` (item total, 2 decimals), `DiscountPcnt`.
  `Totals` on `BoQCtgy`/`BoQInfo`: `Total`, `VAT`, `VATAmount`, `TotalGross`…
- Numbers: XML decimal-point format, no thousands separators.

## Position types (child elements of Item, XSD-verified)

| Type | Marker | Counts toward bid sum? |
|---|---|---|
| Normal | – | yes |
| Grundposition | `ALNGroupNo` + `ALNSerNo=0` | yes |
| Alternativ-/Wahlposition | `ALNGroupNo` + `ALNSerNo=1–9` | **no** (unit price only) |
| Bedarfsposition mit GB | `Provis=WithTotal` | yes |
| Bedarfsposition ohne GB | `Provis=WithoutTotal` | **no** |
| Zuschlagsposition | element `MarkupItem` (X84: `ITMarkup`, `Markup` %, `IT`) | yes (`IT`) |
| Pauschale | `LumpSumItem=Yes` (no qty / qty=1) | yes |
| Freie Menge | `QtyTBD=Yes` (X83: no `Qty` allowed; bidder fills it) | yes after bid |
| Stundenlohn / Schwerpunkt | `HourIt` / `KeyIt` | yes |
| Entfällt / Nicht angeboten | `NotAppl` / `NotOffered` (X84) | no |
| Leit-/Unterbeschreibung | `SumDescr` / `SubDescr`+`SubDNo` | sub carries prices |
| Bezugsposition | `RefRNo` / `RefPerfNo` (mutually exclusive) | yes |
| Nachtrag | `CONo` + `COStatus` | depends on status |

## X81 / X83 / X84 / X86 differences

- **X83**: full structure + texts + quantities, **prices forbidden by schema**.
- **X84**: "price skeleton" — same `BoQCtgy` tree, items contain almost only
  `UP`/`IT` (+ bidder text complements). **No separate bidder price block.**
  Item `ID` attributes DIFFER between X83 and X84 → merge via OZ path only.
- **X81**: texts, usually no prices. **X86**: everything incl. prices,
  `Accepted`/`ProvisAccpt` markers for awarded alternatives/provisionals.

## Practice pitfalls

- Encoding: UTF-8 (± BOM); legacy exporters ship Windows-1252 mislabeled as
  UTF-8 → fatal-UTF-8 decode with 1252 fallback.
- Wrong extension ↔ content (`.x83` with GAEB-90 content); sniff content.
- Schema violations are normal in the wild (duplicate OZ, missing qty,
  foreign-namespace elements). Parse tolerantly, collect warnings, never
  hard-validate against XSD.
- Rounding: GB = round(qty × UP, 2) commercially, but sums differ between
  AVA programs; report differences, never "fix" received totals.
- Files >10 MB with embedded images exist; X84 ≈ 7 % of X83 size.

## Sources

- Fachdokumentation GAEB DA XML 3.3 (2023-01): https://www.gaeb.de/wp-content/uploads/2023/09/Fachdokumentation_GAEB-DA-XML_3.3_2023-01.pdf
- Official XSDs: https://www.gaeb.de/en/service/downloads/gaeb-dataexchange/ (free; mirrored e.g. in remsfal/remsfal-backend)
- BVBS certification files: https://www.bvbs.de/zertifizierungen/
- Das Freie GAEB Buch (GAEB 90/2000 internals): https://www.bvbs.de/wp-content/uploads/2018/07/Das-Freie-GAEB-Buch.pdf
- Dangl IT, "The GAEB Data Formats in Detail": https://www.dangl-it.com/articles/the-gaeb-data-formats-in-detail/
- pyGAEB (MIT reference implementation, Python): https://github.com/frameIQ/pygaeb
