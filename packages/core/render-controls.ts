import LineBreaker from "linebreak";
import { outlineScript } from "./render-scripts";
import { isCjkTag } from "./render-cjk";

export const RENDER_CONTROLS = /[\u200b\u200c\u200d\u2060]/u;
const joiner = /[\u200c\u200d]/u;
const virama =
  /[\u094d\u09cd\u0acd\u0a4d\u0b4d\u0bcd\u0c4d\u0ccd\u0d4d\u0dca\u17d2\u1039]/u;
const graphemes = new Intl.Segmenter("und", { granularity: "grapheme" });
const words = new Intl.Segmenter("und", { granularity: "word" });
const dictionaryScript =
  /[\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Tibetan}]/u;
const scriptTag = (value: string) => {
  const tag = outlineScript(value)?.tag;
  return tag && !isCjkTag(tag) ? tag : null;
};

// Validate original complete overlays/cues, never a wrapped line fragment.
// Accepted controls remain in stored Unicode and SRT. No normalization/stripping.
export function renderControlSupportIssue(
  text: string,
  label = "Rendered text",
) {
  const characters = Array.from(text);
  const error = () =>
    `${label} contains shaping or word-break control characters outside current acceptance. Preserve the original text and attach it as an image until that coverage is verified.`;
  for (let i = 0; i < characters.length; i++) {
    const control = characters[i];
    if (!RENDER_CONTROLS.test(control)) continue;
    const left = characters[i - 1] || "",
      right = characters[i + 1] || "";
    if (!left || RENDER_CONTROLS.test(left) || RENDER_CONTROLS.test(right))
      return error();
    if (control === "\u200b" || control === "\u2060") {
      if (!right || /\p{Mark}/u.test(right)) return error();
      const before =
        characters
          .slice(0, i)
          .reverse()
          .find((c) => !/\s/u.test(c)) || "";
      const after = characters.slice(i + 1).find((c) => !/\s/u.test(c)) || "";
      if (!scriptTag(before) || scriptTag(before) !== scriptTag(after))
        return error();
      continue;
    }
    const tag = scriptTag(left);
    if (!tag || !/[\p{Letter}\p{Mark}]/u.test(left)) return error();
    if (right) {
      if (tag !== scriptTag(right) || !/[\p{Letter}\p{Mark}]/u.test(right))
        return error();
      if (
        virama.test(right) &&
        (tag === "khmr" || (control === "\u200c" && tag !== "mlym"))
      )
        return error();
    } else if (!virama.test(left) && tag !== "tibt") return error();
  }
  return null;
}

// ICU may split Sinhala or ZWNJ conjuncts into several graphemes. Keep the
// adjacent script cluster together for font selection without absorbing Latin/CJK.
export function renderFontUnits(text: string) {
  const units: string[] = [];
  for (const { segment } of graphemes.segment(text)) {
    const previous = units.at(-1);
    const tag = previous && scriptTag(previous);
    if (
      previous &&
      tag &&
      tag === scriptTag(segment) &&
      (joiner.test(previous.slice(-1)) || joiner.test(segment[0] || ""))
    )
      units[units.length - 1] += segment;
    else units.push(segment);
  }
  return units;
}

export function controlLineBreakUnits(text: string) {
  if (!RENDER_CONTROLS.test(text)) return null;
  const ends = new Set<number>();
  let consumed = 0;
  for (const unit of renderFontUnits(text)) {
    consumed += unit.length;
    ends.add(consumed);
  }
  const protectedWords = Array.from(words.segment(text))
    .filter(
      (w) =>
        w.isWordLike &&
        (dictionaryScript.test(w.segment) || joiner.test(w.segment)),
    )
    .map((w) => [w.index, w.index + w.segment.length]);
  const cuts = new Set<number>();
  const breaker = new LineBreaker(text);
  let br;
  while ((br = breaker.nextBreak())) cuts.add(br.position);
  // Keep existing ICU dictionary boundaries for enabled SEA scripts; do not
  // introduce a cut before a control, combining mark, punctuation or whitespace.
  for (const w of words.segment(text)) {
    const at = w.index + w.segment.length;
    if (
      dictionaryScript.test(w.segment) &&
      dictionaryScript.test(text.slice(at, at + 1))
    )
      cuts.add(at);
  }
  const units: string[] = [];
  let last = 0;
  for (const at of [...cuts].sort((a, b) => a - b)) {
    if (
      at !== text.length &&
      (!ends.has(at) ||
        protectedWords.some(([a, b]) => at > a && at < b) ||
        /[\u2060\u200d]$/u.test(text.slice(0, at)) ||
        /^[\u200b\u2060\u200d]/u.test(text.slice(at)))
    )
      continue;
    units.push(text.slice(last, at));
    last = at;
  }
  if (last < text.length) units.push(text.slice(last));
  return units;
}
