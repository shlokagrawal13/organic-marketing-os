import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  copyFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { runProcess } from "../packages/core/media";
import { readRenderFont } from "../packages/core/render-font";

test("Fontkit postinstall is idempotent and rejects partial/unknown/version inputs without modifying another export", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "mos-fontkit-patch-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const root = join(dir, "node_modules/fontkit"),
    script = join(dir, "scripts/patch-fontkit.mjs");
  await mkdir(join(root, "dist"), { recursive: true });
  await mkdir(join(dir, "scripts"));
  await copyFile("scripts/patch-fontkit.mjs", script);
  const originals = await Promise.all(
    ["main.cjs", "module.mjs"].map((name) =>
      readFile(`node_modules/fontkit/dist/${name}`, "utf8"),
    ),
  );
  const paths = [join(root, "dist/main.cjs"), join(root, "dist/module.mjs")];
  for (let i = 0; i < 2; i++) await writeFile(paths[i], originals[i]);
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ version: "2.0.4" }),
  );
  for (let i = 0; i < 2; i++) await runProcess(process.execPath, [script]);
  assert.deepEqual(
    await Promise.all(paths.map((path) => readFile(path, "utf8"))),
    originals,
  );
  for (const modified of [
    originals[1] + "\n// unreviewed mutation\n",
    originals[1].replace(
      "                    if (!baseAnchor || !markRecord.markAnchor) return false;\n",
      "",
    ),
  ]) {
    assert.notEqual(modified, originals[1]);
    await writeFile(paths[1], modified);
    await assert.rejects(
      runProcess(process.execPath, [script]),
      /input differs|unexpected partial patch/,
    );
    assert.equal(await readFile(paths[0], "utf8"), originals[0]);
    assert.equal(await readFile(paths[1], "utf8"), modified);
  }
  await writeFile(paths[1], originals[1]);
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ version: "2.0.5" }),
  );
  await assert.rejects(
    runProcess(process.execPath, [script]),
    /Review the Fontkit shaping patch/,
  );
  assert.deepEqual(
    await Promise.all(paths.map((path) => readFile(path, "utf8"))),
    originals,
  );
});

test("OpenType mark filtering supports both coverage formats, supersedes attachment class and respects IgnoreMarks in CJS/ESM", async () => {
  const path =
    process.env.TEST_KANNADA_FONT_PATH ||
    "/usr/share/fonts/truetype/noto/NotoSansKannada-Regular.ttf";
  const bytes = await readRenderFont(path);
  const { create } = await import("fontkit");
  for (const face of [
    create(bytes),
    createRequire(import.meta.url)("fontkit").create(bytes),
  ] as any[]) {
    face.layout("ಕ್ಷಿ");
    const Iterator =
      face._layoutEngine.engine.GSUBProcessor.glyphIterator.constructor;
    for (const coverage of [
      { version: 1, glyphs: [50] },
      { version: 2, rangeRecords: [{ start: 49, end: 51 }] },
    ]) {
      const font = { GDEF: { markGlyphSetsDef: { coverage: [coverage] } } };
      const glyph = {
        id: 50,
        isMark: true,
        isBase: false,
        isLigature: false,
        markAttachmentType: 1,
        _font: font,
      };
      const options = {
        flags: { useMarkFilteringSet: true },
        markAttachmentType: 99,
        markFilteringSet: 0,
      };
      const iterator = new Iterator([glyph], options);
      assert.equal(
        Boolean(iterator.shouldIgnore(glyph)),
        false,
        "included mark overrides different attachment class",
      );
      assert.equal(
        Boolean(iterator.shouldIgnore({ ...glyph, id: 70 })),
        true,
        "mark outside the set is skipped",
      );
      assert.equal(
        Boolean(
          iterator.shouldIgnore({ ...glyph, isMark: false, isBase: true }),
        ),
        false,
      );
      iterator.reset({
        ...options,
        flags: { useMarkFilteringSet: true, ignoreMarks: true },
      });
      assert.equal(
        Boolean(iterator.shouldIgnore({ ...glyph, _font: {} })),
        true,
        "IgnoreMarks supersedes filtering even without mark-set data",
      );
      iterator.reset({ ...options, markFilteringSet: 1 });
      assert.throws(
        () => iterator.shouldIgnore(glyph),
        /Invalid OpenType mark filtering set/,
      );
      iterator.reset({ flags: {}, markAttachmentType: 99 });
      assert.equal(
        Boolean(iterator.shouldIgnore(glyph)),
        true,
        "attachment class remains active without a filtering set",
      );
    }
  }
});
