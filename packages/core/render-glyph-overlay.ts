import type { RenderTextArea } from "./render-text-placement";
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
  area?: RenderTextArea,
) {
  const lines = text.split("\n").map((line) => plan.shapeText(line, fontIndex));
  const scale = fontSize / lines[0].unitsPerEm;
  const ascent = Math.max(...lines.map((line) => line.ascent));
  const descent = Math.min(...lines.map((line) => line.descent));
  const lineHeight = (ascent - descent) * scale;
  const blockHeight =
    lines.length * lineHeight + (lines.length - 1) * RENDER_TEXT_LINE_SPACING;
  const top = area
    ? caption
      ? area.bottom - 12 - blockHeight
      : area.top + 12
    : caption
      ? height * 0.91 - blockHeight
      : height * 0.1;
  const center = area ? (area.left + area.right) / 2 : width / 2;
  const blockWidth = Math.max(
    ...lines.map((line) => line.advanceWidth * scale),
  );
  // Fractional inset coordinates can round a recomputed edge a few ulps
  // above the identical bound. This subpixel tolerance is 0.0000001 px.
  const edgeTolerance = 1e-7;
  if (
    ![scale, lineHeight, blockHeight, top, blockWidth].every(Number.isFinite) ||
    scale <= 0 ||
    top < 12 - edgeTolerance ||
    top + blockHeight + 12 > height + edgeTolerance ||
    blockWidth + 24 > (area ? area.right - area.left : width) + edgeTolerance ||
    (area &&
      (top - 12 < area.top - edgeTolerance ||
        top + blockHeight + 12 > area.bottom + edgeTolerance))
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
      const left = center - (line.advanceWidth * scale) / 2;
      const baseline =
        top + ascent * scale + index * (lineHeight + RENDER_TEXT_LINE_SPACING);
      return line.paths.map((glyph) => {
        const x = left + glyph.x * scale,
          y = baseline - glyph.y * scale;
        if (![x, y].every(Number.isFinite))
          throw new RenderFontError(
            "The configured render font has invalid glyph positions.",
          );
        return `<path d="${escape(glyph.path)}" transform="translate(${x},${y}) scale(${scale * (glyph.scale ?? 1)},${-scale * (glyph.scale ?? 1)})"/>`;
      });
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect x="${center - blockWidth / 2 - 12}" y="${top - 12}" width="${blockWidth + 24}" height="${blockHeight + 24}" fill="black" fill-opacity="0.85"/><g fill="white">${paths}</g></svg>`;
}
