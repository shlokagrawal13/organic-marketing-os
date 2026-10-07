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
  for (const name of ["fontkit-southeast.mjs", "fontkit-myanmar-data.json"])
    await copyFile(`scripts/${name}`, join(dir, "scripts", name));
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

test("Mark-to-base accepts unmultiplied bases and covered multiple outputs while preserving contiguous uncovered-output boundaries in CJS/ESM", async () => {
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
    const processor = face._layoutEngine.engine.GPOSProcessor;
    const Iterator = processor.glyphIterator.constructor;
    const table = {
      markCoverage: { version: 1, glyphs: [40] },
      baseCoverage: { version: 1, glyphs: [20] },
      markArray: [
        {
          class: 0,
          markAnchor: { version: 1, xCoordinate: 20, yCoordinate: 30 },
        },
      ],
      baseArray: [[{ version: 1, xCoordinate: 100, yCoordinate: 200 }]],
    };
    const glyph = (id: number, properties: object = {}) => ({
      id,
      isMark: false,
      isMultiplied: false,
      ligatureID: null,
      ligatureComponent: 0,
      ...properties,
    });
    const mark = glyph(40, { isMark: true });
    const cases = [
      {
        bases: [glyph(10), glyph(20, { ligatureID: 1, ligatureComponent: 1 })],
        attach: 1,
      },
      {
        bases: [
          glyph(10, { isMultiplied: true }),
          glyph(20, { isMultiplied: true, ligatureComponent: 1 }),
        ],
        attach: 1,
      },
      {
        bases: [
          glyph(20, { isMultiplied: true }),
          glyph(30, { isMultiplied: true, ligatureComponent: 1 }),
        ],
        attach: 0,
      },
      {
        bases: [
          glyph(20),
          glyph(30, { isMultiplied: true, ligatureComponent: 1 }),
        ],
        attach: null,
      },
      {
        bases: [
          glyph(20, { isMark: true, isMultiplied: true }),
          glyph(30, { isMultiplied: true, ligatureComponent: 1 }),
        ],
        attach: null,
      },
    ];
    for (const sample of cases) {
      processor.glyphs = [...sample.bases, { ...mark, markAttachment: null }];
      processor.positions = processor.glyphs.map(() => ({
        xAdvance: 0,
        yAdvance: 0,
        xOffset: 0,
        yOffset: 0,
      }));
      processor.glyphIterator = new Iterator(processor.glyphs);
      processor.glyphIterator.reset({ flags: {} }, 2);
      assert.equal(processor.applyLookup(4, table), sample.attach !== null);
      assert.equal(processor.glyphs[2].markAttachment, sample.attach);
      assert.deepEqual(
        [processor.positions[2].xOffset, processor.positions[2].yOffset],
        sample.attach === null ? [0, 0] : [80, 170],
      );
    }
  }
});

test("OpenType chained backtrack arrays are nearest-first in glyph/class/coverage formats, including skipped marks, without mutating font tables", async () => {
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
    const processor = face._layoutEngine.engine.GSUBProcessor;
    const Iterator = processor.glyphIterator.constructor;
    const coverage = (id: number) => ({ version: 1, glyphs: [id] });
    const classes = {
      version: 1,
      startGlyph: 10,
      classValueArray: Array.from({ length: 31 }, (_, i) => i + 10),
    };
    const rule = {
      backtrack: [20, 10],
      input: [],
      lookahead: [40],
      lookupRecords: [],
    };
    const tables = [
      { version: 1, coverage: coverage(30), chainRuleSets: [[rule]] },
      {
        version: 2,
        coverage: coverage(30),
        inputClassDef: classes,
        backtrackClassDef: classes,
        lookaheadClassDef: classes,
        chainClassSet: Object.assign([], { 30: [rule] }),
      },
      {
        version: 3,
        backtrackGlyphCount: 2,
        backtrackCoverage: [coverage(20), coverage(10)],
        inputGlyphCount: 1,
        inputCoverage: [coverage(30)],
        lookaheadCoverage: [coverage(40)],
        lookupRecords: [],
      },
    ];
    let applied = 0;
    processor.applyLookupList = () => {
      applied++;
      return true;
    };
    for (const table of tables) {
      const snapshot = JSON.stringify(table);
      for (const ids of [
        [10, 99, 20, 99, 30, 40],
        [20, 99, 10, 99, 30, 40],
      ]) {
        processor.glyphs = ids.map((id) => ({
          id,
          isMark: id === 99,
          features: { ccmp: true },
        }));
        processor.glyphIterator = new Iterator(processor.glyphs, {
          flags: { ignoreMarks: true },
        });
        processor.glyphIterator.index = 4;
        assert.equal(processor.applyChainingContext(table), ids[0] === 10);
        assert.equal(processor.glyphIterator.index, 4);
      }
      assert.equal(JSON.stringify(table), snapshot);
    }
    assert.equal(applied, 3);
  }
});
