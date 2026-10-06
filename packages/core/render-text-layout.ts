import type { RenderTextArea } from "./render-text-placement";
import { RenderFontError, type RenderFontPlan } from "./render-font";

const graphemes = new Intl.Segmenter("und", { granularity: "grapheme" });
export const RENDER_TEXT_LINE_SPACING = 6;

export function layoutRenderText(
  text: string,
  label: string,
  plan: RenderFontPlan,
  width: number,
  height: number,
  baseSize: number,
  area?: RenderTextArea,
) {
  const fontIndex = plan.selectFontIndex(text);
  const normalized = text.replace(/\s+/gu, " ").trim();
  const measurements = new Map<string, { width: number; height: number }>();
  const measure = (line: string) => {
    if (!measurements.has(line))
      measurements.set(line, plan.measureText(line, fontIndex));
    return measurements.get(line)!;
  };
  const maxWidth = area ? area.right - area.left - 24 : width * 0.84;
  const maxHeight = area ? area.bottom - area.top - 24 : height * 0.28;
  for (let fontSize = Math.max(18, baseSize); fontSize >= 16; fontSize--) {
    // Leave room for FreeType's per-glyph pixel rounding, not only EM metrics.
    const fits = (line: string) =>
      measure(line).width * fontSize + Array.from(line).length <= maxWidth;
    const lines: string[] = [];
    let line = "",
      oversized = false;
    for (const word of normalized.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (fits(candidate)) {
        line = candidate;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      for (const { segment } of graphemes.segment(word)) {
        if (line && !fits(line + segment)) {
          lines.push(line);
          line = "";
        }
        if (!fits(segment)) {
          oversized = true;
          break;
        }
        line += segment;
      }
      if (oversized) break;
    }
    if (line) lines.push(line);
    const lineHeight = Math.max(
      0,
      ...lines.map((value) => measure(value).height * fontSize + 2),
    );
    const blockHeight =
      lines.length * lineHeight +
      Math.max(0, lines.length - 1) * RENDER_TEXT_LINE_SPACING;
    if (!oversized && blockHeight <= maxHeight)
      return { text: lines.join("\n"), fontSize, fontIndex };
  }
  throw new RenderFontError(
    `${label.slice(0, 120)} cannot fit the render text area at the minimum readable font size. Shorten the text or split it into more scenes or caption cues.`,
  );
}
