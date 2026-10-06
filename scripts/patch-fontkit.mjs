// Fontkit 2.0.4 Node exports dereference permitted null GPOS attachment anchors.
// OpenType GPOS types 4/5/6 permit missing attachment points for a mark class:
// https://learn.microsoft.com/en-us/typography/opentype/spec/gpos
// Skip only that inapplicable lookup; do not invent an anchor/offset or disable
// GPOS features. Exact upstream hashes make upgrades fail for explicit review.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = new URL("../node_modules/fontkit/", import.meta.url);
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
if (pkg.version !== "2.0.4")
  throw new Error(
    "Review the Fontkit null-anchor patch before changing its version.",
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
const digest = (s) => createHash("sha256").update(s).digest("hex");
const pending = [];
for (const [path, hash] of Object.entries(upstream)) {
  const url = new URL(path, root);
  const current = await readFile(url, "utf8");
  const original = current.split(guard).join("");
  if (digest(original) !== hash)
    throw new Error(`Fontkit patch input differs from reviewed bytes: ${path}`);
  let patched = original;
  for (const anchor of anchors) {
    const needle = `                    let baseAnchor = ${anchor};\n`;
    if (patched.split(needle).length !== 2)
      throw new Error(`Fontkit patch anchor changed: ${anchor}`);
    patched = patched.replace(needle, needle + guard);
  }
  if (current !== original && current !== patched)
    throw new Error(`Fontkit has an unexpected partial patch: ${path}`);
  pending.push({ url, patched, changed: current !== patched });
}
// Validate every export before any write. This is idempotent on repeat installs.
for (const { url, patched, changed } of pending)
  if (changed) await writeFile(fileURLToPath(url), patched);
console.log("Fontkit 2.0.4 Node GPOS null-anchor patch verified (CJS/ESM).");
