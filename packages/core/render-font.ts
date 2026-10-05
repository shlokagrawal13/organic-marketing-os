import { open } from "node:fs/promises";
import { delimiter } from "node:path";
import { createHash } from "node:crypto";
import { create } from "fontkit";
import { renderedSceneText, type RenderOptions, type Scene } from "./media";

export const MAX_RENDER_FONT_BYTES = 16 * 1024 * 1024;
export const DEFAULT_RENDER_FONT_PATH =
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";

// Only these controlled messages may be exposed in render history.
export class RenderFontError extends Error {}
type FontFace = ReturnType<typeof create> & {
  hasGlyphForCodePoint: (codePoint: number) => boolean;
  numGlyphs: number;
};
type InspectedFont = {
  bytes: Buffer;
  face: FontFace;
  coverage: Map<number, boolean>;
};
export type RenderFontPlan = {
  fonts: Buffer[];
  fontHashes: string[];
  selectFontIndex: (text: string) => number;
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
    for (const scene of scenes) {
      for (const { text, label } of renderedSceneText(scene, options)) {
        const key = textKey(text);
        if (!key) continue;
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
    return {
      fonts: bytes,
      fontHashes: bytes.map(sha256),
      selectFontIndex: (text: string) => selections.get(textKey(text)) ?? 0,
    };
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
