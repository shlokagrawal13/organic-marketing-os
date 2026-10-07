// Reviewed Fontkit 2.0.4 Node fixes: permitted null GPOS anchors, OpenType
// mark-filtering sets and Sinhala mark advances before GPOS.
// OpenType GPOS types 4/5/6 permit missing attachment points for a mark class:
// https://learn.microsoft.com/en-us/typography/opentype/spec/gpos
// Skip only that inapplicable lookup; do not invent an anchor/offset or disable
// GPOS features. Mark filtering uses GDEF and overrides attachment classes while
// IgnoreMarks takes precedence (OpenType common formats, LookupFlag):
// https://learn.microsoft.com/en-us/typography/opentype/spec/chapter2
// Sinhala retains Indic GSUB; zero GDEF-mark advances before GPOS, matching the
// HarfBuzz 8.3.0 USE mark-width policy, without a broad shaper replacement:
// https://github.com/harfbuzz/harfbuzz/blob/8.3.0/src/hb-ot-shaper-use.cc
// Exact upstream hashes make upgrades fail for explicit review.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { southeastReplacements } from "./fontkit-southeast.mjs";

const root = new URL("../node_modules/fontkit/", import.meta.url);
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
if (pkg.version !== "2.0.4")
  throw new Error(
    "Review the Fontkit shaping patch before changing its version.",
  );
const upstream = {
  "dist/main.cjs":
    "1cac5f3c126952095df9cb84bd2bef8230c7133ee1aeb119b2de85d3053fd245",
  "dist/module.mjs":
    "3dde5aab2c79c239598211256ff26d460da28ca098d314b063b8554c13ee2e57",
};
const guard =
  "                    if (!baseAnchor || !markRecord.markAnchor) return false;\n";
const anchors = [
  "table.baseArray[baseIndex][markRecord.class]",
  "ligAttach[compIndex][markRecord.class]",
  "table.mark2Array[mark2Index][markRecord.class]",
];
const replacements = [
  [
    "this.glyphIterator.reset(lookup.flags);",
    "this.glyphIterator.reset({...lookup.flags, markFilteringSet: lookup.markFilteringSet});",
  ],
  [
    "this.glyphIterator.reset(lookup.flags, this.glyphIterator.index);",
    "this.glyphIterator.reset({...lookup.flags, markFilteringSet: lookup.markFilteringSet}, this.glyphIterator.index);",
  ],
  [
    "    shouldIgnore(glyph) {\n",
    `    shouldIgnore(glyph) {
        if (this.flags.useMarkFilteringSet && glyph.isMark && !this.flags.ignoreMarks) {
            const coverage = glyph._font.GDEF?.markGlyphSetsDef?.coverage[this.options.markFilteringSet];
            if (!coverage || (coverage.version !== 1 && coverage.version !== 2)) throw new Error("Invalid OpenType mark filtering set.");
            const included = coverage.version === 1 ? coverage.glyphs.includes(glyph.id) : coverage.rangeRecords.some(range => range.start <= glyph.id && glyph.id <= range.end);
            if (!included) return true;
        }
`,
  ],
  [
    "this.markAttachmentType && glyph.isMark && glyph.markAttachmentType !== this.markAttachmentType",
    "!this.flags.useMarkFilteringSet && this.markAttachmentType && glyph.isMark && glyph.markAttachmentType !== this.markAttachmentType",
  ],
  [
    "this.shaper.zeroMarkWidths === 'BEFORE_GPOS'",
    "(this.shaper.zeroMarkWidths === 'BEFORE_GPOS' || this.plan.script === 'sinh')",
  ],
];
const digest = (s) => createHash("sha256").update(s).digest("hex");
const pending = [];
for (const [path, hash] of Object.entries(upstream)) {
  const url = new URL(path, root);
  const current = await readFile(url, "utf8");
  const additions = southeastReplacements(current);
  const previousUAdditions = southeastReplacements(current, {
    previousU: true,
  });
  let original;
  for (const candidate of [additions, previousUAdditions]) {
    let input = current;
    for (const [before, after] of [...candidate].reverse())
      input = input.split(after).join(before);
    for (const [before, after] of replacements)
      input = input.split(after).join(before);
    input = input.split(guard).join("");
    if (digest(input) === hash) {
      original = input;
      break;
    }
  }
  if (!original)
    throw new Error(`Fontkit patch input differs from reviewed bytes: ${path}`);
  let legacy = original;
  for (const anchor of anchors) {
    const needle = `                    let baseAnchor = ${anchor};\n`;
    if (legacy.split(needle).length !== 2)
      throw new Error(`Fontkit patch anchor changed: ${anchor}`);
    legacy = legacy.replace(needle, needle + guard);
  }
  let patched = legacy;
  for (const [before, after] of replacements) {
    if (patched.split(before).length !== 2)
      throw new Error(`Fontkit patch target changed: ${path}`);
    patched = patched.replace(before, after);
  }
  const previous = patched;
  let previousU = previous;
  for (const [before, after] of previousUAdditions)
    previousU = previousU.replace(before, after);
  for (const [before, after] of additions) {
    if (patched.split(before).length !== 2)
      throw new Error(`Fontkit Southeast Asian patch target changed: ${path}`);
    patched = patched.replace(before, after);
  }
  // Accept pristine bytes, the complete prior R patch, or this complete patch.
  // Reject partial/mutated inputs rather than silently completing unknown edits.
  if (![original, legacy, previous, previousU, patched].includes(current))
    throw new Error(`Fontkit has an unexpected partial patch: ${path}`);
  pending.push({ url, patched, changed: current !== patched });
}
// Validate every export before any write. This is idempotent on repeat installs.
for (const { url, patched, changed } of pending)
  if (changed) await writeFile(fileURLToPath(url), patched);
console.log(
  "Fontkit 2.0.4 Node shaping patches verified (CJS/ESM: null anchors, mark filtering, Sinhala marks, Southeast Asian/Tibetan shaping).",
);
