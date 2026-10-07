# Fontkit shaping patch

## CI-fix own native acceptance — 2026-10-07

The exact 28-file fix is published at ca7d7a34eddd791df55f0996c41b77d27179db9e. Its own Actions 37608908118 passed all 144 unit cases, including the older Ubuntu Noto Myanmar mark offset and Bengali/Gujarati opt-in isolation, plus 7 HTTP, 7 browser and 5 recovery/config cases. CJS/ESM/outlines independently matched HarfBuzz 8.3.0. Local dual-font/clean-install receipts remain separate. The previous original U run failed and is excluded from pass evidence. Pending statements below are historical. Default-disabled opt-ins and all documented device/font/joiner/control/production gaps remain.


## EDITOR-01U native CI follow-up

NotoSansMyanmar 2.001 from Ubuntu fonts-noto-core 20201225-2 exposed a valid base carrying a nonzero ligature component without being a MultipleSubst output. The corrected backward search follows [HarfBuzz 8.3.0 MarkBasePosFormat1](https://github.com/harfbuzz/harfbuzz/blob/8.3.0/src/OT/Layout/GPOS/MarkBasePosFormat1.hh): stop at an unmultiplied base, preserve consecutive multiplied-output boundaries, and allow covered bases. The first MultipleSubst output is marked multiplied too. The original complete U patch remains an explicitly accepted migration input; unknown/partial inputs still fail. Both font sets passed the whole 144-case suite, 65560 clean-export independent references and 180 new-script exports/540 timed decoded frames. All outline and scene cache revisions were bumped again to fontkit-outlines-v3-context-mark-base-coverage and mos-render-8-mark-base-coverage. Public original U CI failed; fixed-source publication and own native CI remain pending. Historical U design below is retained.


EDITOR-01U extends the reviewed Fontkit **2.0.4** CJS/ESM postinstall. The renderer continues to use Fontkit outlines and FFmpeg/librsvg; HarfBuzz/Python remains a test oracle. Dependency versions and lockfile records are unchanged.

`scripts/patch-fontkit.mjs` reverses only the exact reviewed additions and checks the original upstream SHA-256 for each export. It accepts pristine upstream, complete R, complete T or complete U bytes; partial, unexpected and version-changed inputs fail. Every export is validated before any write, and repeated installs are idempotent. Both Docker install stages copy the helper/data before installation. Docker execution itself is not claimed.

The prior null-anchor, GDEF mark-filtering/precedence and Sinhala mark-width fixes remain. U adds:

- Thai/Lao Sara Am decomposition to Nikhahit plus AA and reordering across above-base marks. Only the Nikhahit derived from Sara Am is moved. Font selection checks the derived glyph coverage too.
- OpenType chained-context backtrack arrays are nearest-first. The engine's forward matcher reverses copied glyph/class/coverage arrays; it never mutates font tables.
- Contextual multiple substitution advances over inserted outputs. Multiplied base glyphs remain eligible for mark-to-base attachment. Expanded Myanmar stacking tests reproduced unbounded insertion and missing mark offsets before these fixes.
- A dedicated Myanmar orthographic-unit machine, modern/legacy tag preference, kinzi/medial-Ra/pre-vowel reordering, individually staged basic features within each unit, presentation features across the run and mark widths before GPOS. Basic units are found before locl/ccmp. Substitution metadata is copied before assigning positions. Reordering preserves variation-selector association. This is bounded acceptance with the pinned NotoSansMyanmar font, not acceptance of every Myanmar font/language.
- Tibetan U+0F71 uses the modern USE CMBlw category. Broken USE clusters insert their dotted circle before the first non-repha mark. Consonant/subjoined/vowel combinations, split-vowel forms and an isolated split-vowel cluster are independently referenced.

Runtime script/font runs remain complete graphemes; explicit layout tags keep a font that covers several scripts from shaping the full overlay as one script. A shaped `.notdef` fails before cache/storage. ICU word segmentation keeps dictionary words intact for Thai/Lao/Khmer/Myanmar/Tibetan and attaches punctuation, including Tibetan tsheg, to the preceding unit. Oversized dictionary words reduce font size or fail with the readable-size error. The existing grapheme fallback remains for other scripts. This is a conservative word policy, not full Unicode line-break or device readability acceptance.

The shared backtracking/substitution fixes can change any outline shaping or Fontkit measurement. Therefore U changes every outline revision to `fontkit-outlines-v2-shared-context-southeast-tibetan` and the scene cache version to `mos-render-7-context-shaping`. Previously stored scene renders are not reused under the new version. Source text, SRT, asset/private-output ownership and provider receipts retain their existing semantics.

The media process helper uses stream UTF-8 decoding so a multibyte character spanning pipe chunks is preserved. Its 500000-character stdout and bounded stderr/timeouts remain. Large test references are requested in batches of 100.

## Data reproduction and sources

`scripts/fontkit-myanmar.machine` records the Myanmar grammar. `scripts/fontkit-myanmar-data.json` stores the reviewed category ranges and compiled automaton. `node scripts/generate-fontkit-myanmar.mjs` reproduces and compares the automaton offline using the already installed dfa compiler. All 42 category columns, including unused codes, are explicit. Production installation uses checked data directly and never runs the compiler or reference engine.

Primary algorithm/data sources:

- [HarfBuzz 8.3.0 Myanmar shaper](https://github.com/harfbuzz/harfbuzz/blob/8.3.0/src/hb-ot-shaper-myanmar.cc) and [syllable grammar](https://github.com/harfbuzz/harfbuzz/blob/8.3.0/src/hb-ot-shaper-myanmar-machine.rl).
- [HarfBuzz 8.3.0 Indic category table](https://github.com/harfbuzz/harfbuzz/blob/8.3.0/src/hb-ot-shaper-indic-table.cc), generated from Unicode 15.1 Indic category/position/block data. Myanmar base/Extended-A/Extended-B, joiner-range and variation-selector category ranges are retained.
- [HarfBuzz 8.3.0 Thai/Lao processing](https://github.com/harfbuzz/harfbuzz/blob/8.3.0/src/hb-ot-shaper-thai.cc) and [USE data](https://github.com/harfbuzz/harfbuzz/blob/8.3.0/src/hb-ot-shaper-use-table.hh).
- [Microsoft Myanmar development](https://learn.microsoft.com/en-us/typography/script-development/myanmar), [Thai](https://learn.microsoft.com/en-us/typography/script-development/thai), [Tibetan](https://learn.microsoft.com/en-us/typography/script-development/tibetan) and [OpenType GSUB](https://learn.microsoft.com/en-us/typography/opentype/spec/gsub).

The HarfBuzz copyright/permission notice for the adapted Myanmar logic is included in `scripts/fontkit-southeast.mjs`. Diagnostic font bytes, temporary probes, install trees and raw logs remain outside the source checkpoint. Acceptance evidence is in `docs/qa/southeast-batch-evidence.json`.

## EDITOR-01V locale use

V retains the exact guarded Fontkit 2.0.4 CJS/ESM patch. Application font runs supply saved OpenType CJK language tags, shape CJK text with NFC without changing source Unicode/SRT, and keep adjacent common punctuation in context. This does not replace the Indic/SEA shaper. Clean full/production installs and independent comparisons must establish V acceptance; U native CI remains evidence for U only. See `docs/CJK_RENDERING.md`.
