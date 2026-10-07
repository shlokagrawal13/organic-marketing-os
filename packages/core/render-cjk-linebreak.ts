import LineBreaker from "linebreak";
import { CJK_CHARACTERS } from "./render-cjk";
const graphemes = new Intl.Segmenter("und", { granularity: "grapheme" });
const words = new Intl.Segmenter("und", { granularity: "word" });
const dictionaryScript =
  /[\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Tibetan}]/u;
// Pinned UAX #14 baseline with conservative Japanese strict non-starters and
// Korean word protection. Never fall back to arbitrary cluster splits.
const nonStarter =
  /^[\p{Pe}\p{Pf}、。，．？！：；・ー々〻ゝゞヽヾぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶㇰ-ㇿ\uff9e\uff9f]/u;
const nonEnding = /[\p{Ps}\p{Pi}]$/u;
export function cjkLineBreakUnits(text: string) {
  if (!CJK_CHARACTERS.test(text)) return null;
  const ends = new Set(
    Array.from(graphemes.segment(text), (g) => g.index + g.segment.length),
  );
  const protectedWords = Array.from(words.segment(text))
    .filter((w) => w.isWordLike && dictionaryScript.test(w.segment))
    .map((w) => [w.index, w.index + w.segment.length]);
  const breaker = new LineBreaker(text),
    units: string[] = [];
  let last = 0,
    br;
  while ((br = breaker.nextBreak())) {
    const at = br.position;
    if (at !== text.length) {
      if (!ends.has(at) || protectedWords.some(([a, b]) => at > a && at < b))
        continue;
      const before = text.slice(0, at).trimEnd(),
        after = text.slice(at).trimStart();
      if (nonEnding.test(before) || nonStarter.test(after)) continue;
      if (
        !/\s$/u.test(text.slice(0, at)) &&
        /[\p{Letter}\p{Number}]$/u.test(before) &&
        /^[\p{Letter}\p{Number}]/u.test(after) &&
        (/\p{Script=Hangul}$/u.test(before) ||
          /^\p{Script=Hangul}/u.test(after))
      )
        continue;
    }
    units.push(text.slice(last, at));
    last = at;
  }
  if (last < text.length) units.push(text.slice(last));
  return units;
}
