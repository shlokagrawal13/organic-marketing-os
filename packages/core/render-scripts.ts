import { CJK_CHARACTERS, type CjkLanguage } from "./render-cjk";
// One registry defines opt-ins, Unicode policy and outline font-run boundaries.
// Common/inherited punctuation follows adjacent runs; controls remain blocked.
export const OUTLINE_SCRIPTS = [
  {
    name: "Devanagari",
    tag: "deva",
    unicode: "Devanagari",
    environment: "RENDER_DEVANAGARI_ENABLED",
    testFontEnvironment: "TEST_DEVANAGARI_FONT_PATH",
    fontFile: "NotoSansDevanagari-Regular.ttf",
    pattern: /\p{Script=Devanagari}/u,
  },
  {
    name: "Bengali",
    tag: "beng",
    unicode: "Bengali",
    environment: "RENDER_BENGALI_ENABLED",
    testFontEnvironment: "TEST_BENGALI_FONT_PATH",
    fontFile: "NotoSansBengali-Regular.ttf",
    pattern: /\p{Script=Bengali}/u,
  },
  {
    name: "Gujarati",
    tag: "gujr",
    unicode: "Gujarati",
    environment: "RENDER_GUJARATI_ENABLED",
    testFontEnvironment: "TEST_GUJARATI_FONT_PATH",
    fontFile: "NotoSansGujarati-Regular.ttf",
    pattern: /\p{Script=Gujarati}/u,
  },
  {
    name: "Gurmukhi",
    tag: "guru",
    unicode: "Gurmukhi",
    environment: "RENDER_GURMUKHI_ENABLED",
    testFontEnvironment: "TEST_GURMUKHI_FONT_PATH",
    fontFile: "NotoSansGurmukhi-Regular.ttf",
    pattern: /\p{Script=Gurmukhi}/u,
  },
  {
    name: "Odia",
    tag: "orya",
    unicode: "Oriya",
    environment: "RENDER_ODIA_ENABLED",
    testFontEnvironment: "TEST_ODIA_FONT_PATH",
    fontFile: "NotoSansOriya-Regular.ttf",
    pattern: /\p{Script=Oriya}/u,
  },
  {
    name: "Tamil",
    tag: "taml",
    unicode: "Tamil",
    environment: "RENDER_TAMIL_ENABLED",
    testFontEnvironment: "TEST_TAMIL_FONT_PATH",
    fontFile: "NotoSansTamil-Regular.ttf",
    pattern: /\p{Script=Tamil}/u,
  },
  {
    name: "Telugu",
    tag: "telu",
    unicode: "Telugu",
    environment: "RENDER_TELUGU_ENABLED",
    testFontEnvironment: "TEST_TELUGU_FONT_PATH",
    fontFile: "NotoSansTelugu-Regular.ttf",
    pattern: /\p{Script=Telugu}/u,
  },
  {
    name: "Kannada",
    tag: "knda",
    unicode: "Kannada",
    environment: "RENDER_KANNADA_ENABLED",
    testFontEnvironment: "TEST_KANNADA_FONT_PATH",
    fontFile: "NotoSansKannada-Regular.ttf",
    pattern: /\p{Script=Kannada}/u,
  },
  {
    name: "Malayalam",
    tag: "mlym",
    unicode: "Malayalam",
    environment: "RENDER_MALAYALAM_ENABLED",
    testFontEnvironment: "TEST_MALAYALAM_FONT_PATH",
    fontFile: "NotoSansMalayalam-Regular.ttf",
    pattern: /\p{Script=Malayalam}/u,
  },
  {
    name: "Sinhala",
    tag: "sinh",
    unicode: "Sinhala",
    environment: "RENDER_SINHALA_ENABLED",
    testFontEnvironment: "TEST_SINHALA_FONT_PATH",
    fontFile: "NotoSansSinhala-Regular.ttf",
    pattern: /\p{Script=Sinhala}/u,
  },
  {
    name: "Thai",
    tag: "thai",
    unicode: "Thai",
    environment: "RENDER_THAI_ENABLED",
    testFontEnvironment: "TEST_THAI_FONT_PATH",
    fontFile: "NotoSansThai-Regular.ttf",
    pattern: /\p{Script=Thai}/u,
  },
  {
    name: "Lao",
    tag: "lao ",
    unicode: "Lao",
    environment: "RENDER_LAO_ENABLED",
    testFontEnvironment: "TEST_LAO_FONT_PATH",
    fontFile: "NotoSansLao-Regular.ttf",
    pattern: /\p{Script=Lao}/u,
  },
  {
    name: "Khmer",
    tag: "khmr",
    unicode: "Khmer",
    environment: "RENDER_KHMER_ENABLED",
    testFontEnvironment: "TEST_KHMER_FONT_PATH",
    fontFile: "NotoSansKhmer-Regular.ttf",
    pattern: /\p{Script=Khmer}/u,
  },
  {
    name: "Myanmar",
    tag: "mymr",
    unicode: "Myanmar",
    environment: "RENDER_MYANMAR_ENABLED",
    testFontEnvironment: "TEST_MYANMAR_FONT_PATH",
    fontFile: "NotoSansMyanmar-Regular.ttf",
    pattern: /\p{Script=Myanmar}/u,
  },
  {
    name: "Tibetan",
    tag: "tibt",
    unicode: "Tibetan",
    environment: "RENDER_TIBETAN_ENABLED",
    testFontEnvironment: "TEST_TIBETAN_FONT_PATH",
    fontFile: "NotoSerifTibetan-Regular.ttf",
    pattern: /\p{Script=Tibetan}/u,
  },
  {
    name: "CJK Han",
    tag: "hani",
    unicode: "Han",
    environment: "RENDER_HAN_ENABLED",
    testFontEnvironment: "TEST_CJK_SC_FONT_PATH",
    fontFile: "NotoSansCJKsc-Regular.otf",
    pattern: /\p{Script=Han}/u,
  },
  {
    name: "Japanese Hiragana",
    tag: "kana",
    unicode: "Hiragana",
    environment: "RENDER_HIRAGANA_ENABLED",
    testFontEnvironment: "TEST_CJK_JP_FONT_PATH",
    fontFile: "NotoSansCJKjp-Regular.otf",
    pattern: /\p{Script=Hiragana}/u,
  },
  {
    name: "Japanese Katakana",
    tag: "kana",
    unicode: "Katakana",
    environment: "RENDER_KATAKANA_ENABLED",
    testFontEnvironment: "TEST_CJK_JP_FONT_PATH",
    fontFile: "NotoSansCJKjp-Regular.otf",
    pattern: /\p{Script=Katakana}/u,
  },
  {
    name: "Korean Hangul",
    tag: "hang",
    unicode: "Hangul",
    environment: "RENDER_HANGUL_ENABLED",
    testFontEnvironment: "TEST_CJK_KR_FONT_PATH",
    fontFile: "NotoSansCJKkr-Regular.otf",
    pattern: /\p{Script=Hangul}/u,
  },
] as const;
export const OUTLINE_UNICODE_CLASS = OUTLINE_SCRIPTS.map(
  (script) => `\\p{Script=${script.unicode}}`,
).join("");
const devanagariRun = /[\u0900-\u097f\p{Script=Devanagari}]/u;
export function outlineScript(text: string) {
  // Retain the existing shared-danda run boundary without requiring Hindi opt-in.
  return OUTLINE_SCRIPTS.find((script) =>
    (script.tag === "deva" ? devanagariRun : script.pattern).test(text),
  );
}
export function outlinePipelineRevision(
  texts: string[],
  language?: CjkLanguage,
) {
  if (texts.some((text) => CJK_CHARACTERS.test(text)))
    return (
      "fontkit-outlines-v1-cjk-locale-uax14:" + (language || "unspecified")
    );
  // U's CI follow-up fixes common coverage-sensitive mark-to-base attachment. Every
  // outline script must invalidate prior shaping, including the ten legacy scripts.
  return "fontkit-outlines-v3-context-mark-base-coverage";
}
export function outlineLayoutTags(tag: string): string | string[] {
  const modern: Record<string, string[]> = {
    deva: ["dev2", "deva"],
    beng: ["bng2", "beng"],
    gujr: ["gjr2", "gujr"],
    guru: ["gur2", "guru"],
    orya: ["ory2", "orya"],
    taml: ["tml2", "taml"],
    telu: ["tel2", "telu"],
    knda: ["knd2", "knda"],
    mlym: ["mlm2", "mlym"],
    mymr: ["mym2", "mymr"],
  };
  return modern[tag] || tag;
}
