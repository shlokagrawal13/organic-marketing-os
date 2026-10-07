// Locale belongs to saved per-render options; never infer it from shared Han.
export const CJK_LANGUAGES = ["zh-Hans", "zh-Hant", "ja", "ko"] as const;
export type CjkLanguage = (typeof CJK_LANGUAGES)[number];
export const CJK_LANGUAGE_LABELS: Record<CjkLanguage, string> = {
  "zh-Hans": "Chinese (Simplified)",
  "zh-Hant": "Chinese (Traditional)",
  ja: "Japanese",
  ko: "Korean",
};
export const CJK_CHARACTERS =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f\u3099-\u309c\u30a0\u30fb\u30fc\uff01-\uff60\uff9e\uff9f]/u;
export const CJK_ENVIRONMENTS = [
  "RENDER_HAN_ENABLED",
  "RENDER_HIRAGANA_ENABLED",
  "RENDER_KATAKANA_ENABLED",
  "RENDER_HANGUL_ENABLED",
] as const;
export const isCjkTag = (tag: string) => ["hani", "kana", "hang"].includes(tag);
export function cjkLanguageTag(language?: CjkLanguage) {
  return language
    ? { "zh-Hans": "ZHS", "zh-Hant": "ZHT", ja: "JAN", ko: "KOR" }[language]
    : undefined;
}
export function cjkTextIssue(
  text: string,
  label: string,
  language?: CjkLanguage,
) {
  if (!CJK_CHARACTERS.test(text)) return null;
  if (!language || !CJK_LANGUAGES.includes(language))
    return (
      label +
      " contains CJK text. Choose Chinese (Simplified/Traditional), Japanese or Korean for this render so regional glyphs are selected explicitly."
    );
  if (/[\ufe00-\ufe0f\u{e0100}-\u{e01ef}]/u.test(text))
    return (
      label +
      " contains CJK variation sequences outside current font acceptance. Preserve the original text and attach it as an image."
    );
  if (
    /[\p{Script=Hiragana}\p{Script=Katakana}\u3099-\u309c\u30fc\uff9e\uff9f]/u.test(
      text,
    ) &&
    language !== "ja"
  )
    return (
      label +
      " contains Japanese kana. Choose Japanese for this render or place other CJK languages in separate exports."
    );
  if (/\p{Script=Hangul}/u.test(text) && language !== "ko")
    return (
      label +
      " contains Korean Hangul. Choose Korean for this render or place other CJK languages in separate exports."
    );
  return null;
}
