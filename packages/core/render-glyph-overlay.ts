import { type RenderFontPlan, RenderFontError } from "./render-font";
import { RENDER_TEXT_LINE_SPACING } from "./render-text-layout";

// Only trusted font outlines and finite numbers enter SVG; user text never
// becomes XML, a font reference, a URL or a filter expression.
export function glyphOverlaySvg(
  text: string,
  plan: RenderFontPlan,
  fontIndex: number,
  fontSize: number,
  width: number,
  height: number,
  caption: boolean,
) {
  const lines = text.split("\n").map((line) => plan.shapeText(line, fontIndex));
  const scale = fontSize / lines[0].unitsPerEm;
  const lineHeight = (lines[0].ascent - lines[0].descent) * scale;
  const blockHeight =
    lines.length * lineHeight + (lines.length - 1) * RENDER_TEXT_LINE_SPACING;
  const top = caption ? height * 0.91 - blockHeight : height * 0.1;
  const blockWidth = Math.max(
    ...lines.map((line) => line.advanceWidth * scale),
  );
  if (
    ![scale, lineHeight, blockHeight, top, blockWidth].every(Number.isFinite) ||
    scale <= 0 ||
    top < 12 ||
    top + blockHeight + 12 > height ||
    blockWidth + 24 > width
  )
    throw new RenderFontError(
      "The shaped render text does not fit the output frame. Shorten the text or choose another font.",
    );
  const escape = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const paths = lines
    .flatMap((line, index) => {
      const left = (width - line.advanceWidth * scale) / 2;
      const baseline =
        top +
        line.ascent * scale +
        index * (lineHeight + RENDER_TEXT_LINE_SPACING);
      return line.paths.map((glyph) => {
        const x = left + glyph.x * scale,
          y = baseline - glyph.y * scale;
        if (![x, y].every(Number.isFinite))
          throw new RenderFontError(
            "The configured render font has invalid glyph positions.",
          );
        return `<path d="${escape(glyph.path)}" transform="translate(${x},${y}) scale(${scale},${-scale})"/>`;
      });
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect x="${(width - blockWidth) / 2 - 12}" y="${top - 12}" width="${blockWidth + 24}" height="${blockHeight + 24}" fill="black" fill-opacity="0.65"/><g fill="white">${paths}</g></svg>`;
}
