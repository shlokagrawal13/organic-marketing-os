import { open } from "node:fs/promises";
import { delimiter } from "node:path";
import { createHash } from "node:crypto";
import { create, type Font } from "fontkit";
import {
  hasDevanagariText,
  devanagariMixSupportIssue,
  renderedSceneText,
  type RenderOptions,
  type Scene,
} from "./media";

export const MAX_RENDER_FONT_BYTES = 16 * 1024 * 1024;
export const DEFAULT_RENDER_FONT_PATH =
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";

// Only these controlled messages may be exposed in render history.
export class RenderFontError extends Error {}
type FontFace = Font;
type InspectedFont = {
  bytes: Buffer;
  face: FontFace;
  coverage: Map<number, boolean>;
};
export type RenderFontPlan = {
  fonts: Buffer[];
  fontHashes: string[];
  selectFontIndex: (text: string) => number;
  shapeText: (
    text: string,
    fontIndex: number,
  ) => {
    unitsPerEm: number;
    ascent: number;
    descent: number;
    advanceWidth: number;
    paths: { path: string; x: number; y: number; scale?: number }[];
  };
  measureText: (
    text: string,
    fontIndex: number,
  ) => {
    width: number;
    height: number;
  };
};
const sha256 = (value: Buffer) =>
  createHash("sha256").update(value).digest("hex");
const textKey = (text: string) => text.replace(/\s+/gu, " ").trim();

function configuredFontPaths(
  primary = process.env.RENDER_FONT_PATH || DEFAULT_RENDER_FONT_PATH,
  fallback = process.env.RENDER_FONT_FALLBACK_PATHS || "",
) {
  const paths = [primary, ...fallback.split(delimiter)]
    .map((path) => path.trim())
    .filter(Boolean);
  return [...new Set(paths)];
}

export async function readRenderFont(
  path = process.env.RENDER_FONT_PATH || DEFAULT_RENDER_FONT_PATH,
) {
  try {
    const file = await open(path, "r");
    try {
      const info = await file.stat();
      if (!info.isFile() || info.size < 12 || info.size > MAX_RENDER_FONT_BYTES)
        throw new RenderFontError(
          "The configured render font must be a font file between 12 bytes and 16 MiB. Ask an administrator to check the render font configuration.",
        );
      const bytes = Buffer.alloc(info.size + 1);
      let length = 0;
      while (length < bytes.length) {
        const { bytesRead } = await file.read(
          bytes,
          length,
          bytes.length - length,
          null,
        );
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length !== info.size)
        throw new RenderFontError(
          "The configured render font changed while being loaded. Retry after the administrator finishes updating it.",
        );
      return bytes.subarray(0, length);
    } finally {
      await file.close();
    }
  } catch (error) {
    if (error instanceof RenderFontError) throw error;
    throw new RenderFontError(
      "The configured render font could not be read. Ask an administrator to check the render font configuration.",
    );
  }
}

export async function readRenderFonts() {
  return Promise.all(configuredFontPaths().map((path) => readRenderFont(path)));
}

function inspectFont(bytes: Buffer): InspectedFont {
  if (
    bytes.length < 12 ||
    bytes.length > MAX_RENDER_FONT_BYTES ||
    (bytes.readUInt32BE(0) !== 0x00010000 &&
      bytes.toString("ascii", 0, 4) !== "OTTO")
  )
    throw new RenderFontError(
      "The configured render font must be a single TrueType or OpenType font, at most 16 MiB. Font collections and web fonts are not supported.",
    );
  const face = create(bytes);
  if (!("hasGlyphForCodePoint" in face) || !face.numGlyphs)
    throw new Error("No single font face");
  return { bytes, face: face as FontFace, coverage: new Map() };
}

function hasGlyph(font: InspectedFont, point: number) {
  if (!font.coverage.has(point))
    font.coverage.set(point, font.face.hasGlyphForCodePoint(point));
  return font.coverage.get(point);
}

function missingFromFont(font: InspectedFont, text: string) {
  const missing = new Set<number>();
  // Match the renderer's whitespace collapsing; layout controls need no glyph.
  for (const character of textKey(text)) {
    const point = character.codePointAt(0)!;
    if (!hasGlyph(font, point)) missing.add(point);
    if (missing.size === 8) break;
  }
  return missing;
}

export function createRenderFontPlan(
  input: Buffer | Buffer[],
  scenes: Scene[],
  options: Pick<RenderOptions, "captions">,
) {
  const bytes = Array.isArray(input) ? input : [input];
  if (
    !bytes.length ||
    bytes.some(
      (font) => font.length < 12 || font.length > MAX_RENDER_FONT_BYTES,
    )
  )
    throw new RenderFontError(
      "The configured render font must be a single TrueType or OpenType font, at most 16 MiB. Font collections and web fonts are not supported.",
    );
  try {
    const fonts = bytes.map(inspectFont);
    const selections = new Map<string, number>();
    const graphemes = new Intl.Segmenter("und", { granularity: "grapheme" });
    // The -1 index identifies an outline overlay composed from script/font runs.
    // Never split a conjunct or combining cluster between fonts.
    const fontRuns = (text: string) => {
      const runs: { text: string; fontIndex: number; script: string }[] = [];
      for (const { segment } of graphemes.segment(text)) {
        const script = hasDevanagariText(segment)
          ? "deva"
          : /\p{Script=Latin}/u.test(segment)
            ? "latn"
            : /\p{Script=Greek}/u.test(segment)
              ? "grek"
              : /\p{Script=Cyrillic}/u.test(segment)
                ? "cyrl"
                : runs.at(-1)?.script || "latn";
        const previous = runs.at(-1);
        const preferred = previous?.script === script ? previous.fontIndex : -1;
        const covers = (font: InspectedFont) =>
          Array.from(segment).every((character) =>
            hasGlyph(font, character.codePointAt(0)!),
          );
        const index =
          preferred >= 0 && covers(fonts[preferred])
            ? preferred
            : fonts.findIndex(covers);
        if (index < 0)
          throw new RenderFontError(
            "The text uses a grapheme with glyphs missing from the configured render fonts. Configure a font covering the complete grapheme.",
          );
        if (previous?.fontIndex === index && previous.script === script)
          previous.text += segment;
        else runs.push({ text: segment, fontIndex: index, script });
      }
      return runs;
    };
    for (const scene of scenes) {
      for (const { text, label } of renderedSceneText(scene, options)) {
        const key = textKey(text);
        if (!key) continue;
        if (hasDevanagariText(text)) {
          const issue = devanagariMixSupportIssue(text, label.slice(0, 120));
          if (issue) throw new RenderFontError(issue);
          // Explicit script runs also shape correctly when a single font covers
          // both scripts; Fontkit must not infer one script for the whole line.
          fontRuns(key);
          selections.set(key, -1);
          continue;
        }
        const index = fonts.findIndex(
          (font) => !missingFromFont(font, text).size,
        );
        selections.set(key, index);
        if (index >= 0) continue;
        const missing = new Set<number>();
        for (const font of fonts)
          for (const point of missingFromFont(font, text)) missing.add(point);
        if (missing.size) {
          const codes = [...missing]
            .map((p) => `U+${p.toString(16).toUpperCase().padStart(4, "0")}`)
            .join(", ");
          throw new RenderFontError(
            `${label.slice(0, 120)} uses glyphs missing from the configured render font (${codes}). Replace the text, attach it as an image, or ask an administrator to configure a font that contains these glyphs.`,
          );
        }
      }
    }
    const plan: RenderFontPlan = {
      fonts: bytes,
      fontHashes: bytes.map(sha256),
      selectFontIndex: (text: string) => selections.get(textKey(text)) ?? 0,
      shapeText: (text: string, fontIndex: number) => {
        try {
          if (fontIndex === -1) {
            let advanceWidth = 0,
              ascent = 0,
              descent = 0;
            const paths: {
              path: string;
              x: number;
              y: number;
              scale: number;
            }[] = [];
            for (const item of fontRuns(text)) {
              const shaped = plan.shapeText(item.text, item.fontIndex);
              const unit = shaped.unitsPerEm;
              paths.push(
                ...shaped.paths.map((glyph) => ({
                  path: glyph.path,
                  x: advanceWidth + glyph.x / unit,
                  y: glyph.y / unit,
                  scale: 1 / unit,
                })),
              );
              advanceWidth += shaped.advanceWidth / unit;
              ascent = Math.max(ascent, shaped.ascent / unit);
              descent = Math.min(descent, shaped.descent / unit);
            }
            return { unitsPerEm: 1, ascent, descent, advanceWidth, paths };
          }
          const { face } = fonts[fontIndex];
          const run = face.layout(text);
          let advance = 0;
          const paths = run.glyphs.map((glyph, i) => {
            const position = run.positions[i];
            const item = {
              path: glyph.path.toSVG(),
              x: advance + position.xOffset,
              y: position.yOffset,
            };
            advance += position.xAdvance;
            return item;
          });
          return {
            unitsPerEm: face.unitsPerEm,
            ascent: face.ascent,
            descent: face.descent,
            advanceWidth: advance,
            paths,
          };
        } catch {
          throw new RenderFontError(
            "The configured render font could not shape the text. Ask an administrator to configure a valid TrueType or OpenType font.",
          );
        }
      },
      measureText: (text: string, fontIndex: number) => {
        try {
          if (fontIndex === -1) {
            const measures = fontRuns(text).map((run) =>
              plan.measureText(run.text, run.fontIndex),
            );
            const shaped = plan.shapeText(text, -1);
            return {
              width: measures.reduce((sum, measure) => sum + measure.width, 0),
              height: Math.max(
                shaped.ascent - shaped.descent,
                ...measures.map((measure) => measure.height),
              ),
            };
          }
          const { face } = fonts[fontIndex];
          const run = face.layout(text);
          let advance = 0,
            left = 0,
            right = 0;
          let top = face.ascent,
            bottom = face.descent;
          // Older FFmpeg builds do not apply all OpenType positioning. Bound
          // both the shaped run and unpositioned glyphs, including overhangs.
          for (const glyph of face.glyphsForString(text)) {
            const box = glyph.bbox;
            if (Number.isFinite(box.minX)) {
              left = Math.min(left, advance + box.minX);
              right = Math.max(right, advance + box.maxX);
              top = Math.max(top, box.maxY);
              bottom = Math.min(bottom, box.minY);
            }
            advance += glyph.advanceWidth;
          }
          const width =
            Math.max(advance, right - left, run.advanceWidth, run.bbox.width) /
            face.unitsPerEm;
          const height =
            Math.max(top - bottom, run.bbox.height) / face.unitsPerEm;
          if (
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width < 0 ||
            height <= 0
          )
            throw new Error("Invalid font metrics");
          return { width, height };
        } catch {
          throw new RenderFontError(
            "The configured render font could not be measured. Ask an administrator to configure a valid TrueType or OpenType font.",
          );
        }
      },
    };
    return plan;
  } catch (error) {
    if (error instanceof RenderFontError) throw error;
    throw new RenderFontError(
      "The configured render font could not be inspected. Ask an administrator to configure a valid TrueType or OpenType font.",
    );
  }
}

export function assertRenderFontCoverage(
  bytes: Buffer | Buffer[],
  scenes: Scene[],
  options: Pick<RenderOptions, "captions">,
) {
  createRenderFontPlan(bytes, scenes, options);
}
