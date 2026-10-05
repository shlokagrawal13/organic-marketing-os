import { open } from "node:fs/promises";
import { create } from "fontkit";
import { renderedSceneText, type RenderOptions, type Scene } from "./media";

export const MAX_RENDER_FONT_BYTES = 16 * 1024 * 1024;
export const DEFAULT_RENDER_FONT_PATH =
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";

// Only these controlled messages may be exposed in render history.
export class RenderFontError extends Error {}

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

export function assertRenderFontCoverage(
  bytes: Buffer,
  scenes: Scene[],
  options: Pick<RenderOptions, "captions">,
) {
  if (
    bytes.length < 12 ||
    bytes.length > MAX_RENDER_FONT_BYTES ||
    (bytes.readUInt32BE(0) !== 0x00010000 &&
      bytes.toString("ascii", 0, 4) !== "OTTO")
  )
    throw new RenderFontError(
      "The configured render font must be a single TrueType or OpenType font, at most 16 MiB. Font collections and web fonts are not supported.",
    );
  try {
    const font = create(bytes);
    if (!("hasGlyphForCodePoint" in font) || !font.numGlyphs)
      throw new Error("No single font face");
    const coverage = new Map<number, boolean>();
    for (const scene of scenes) {
      for (const { text, label } of renderedSceneText(scene, options)) {
        const missing = new Set<number>();
        // Match the renderer's whitespace collapsing; layout controls need no glyph.
        for (const character of text.replace(/\s+/gu, " ").trim()) {
          const point = character.codePointAt(0)!;
          if (!coverage.has(point))
            coverage.set(point, font.hasGlyphForCodePoint(point));
          if (!coverage.get(point)) missing.add(point);
          if (missing.size === 8) break;
        }
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
  } catch (error) {
    if (error instanceof RenderFontError) throw error;
    throw new RenderFontError(
      "The configured render font could not be inspected. Ask an administrator to configure a valid TrueType or OpenType font.",
    );
  }
}
