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
export function outlinePipelineRevision(texts: string[]) {
  // T changes the shaping engine. Invalidate prior Indic cache entries, including
  // legacy scripts affected by OpenType lookup filtering. Plain paths are unchanged.
  const used = OUTLINE_SCRIPTS.filter((script) =>
    texts.some((text) => script.pattern.test(text)),
  );
  if (used.some((script) => !["deva", "beng", "gujr"].includes(script.tag)))
    return "fontkit-outlines-v1-indic-registry-mark-filter-sinhala";
  if (used.some((script) => script.tag === "gujr"))
    return "fontkit-outlines-v2-gujarati-script-font-runs";
  if (used.some((script) => script.tag === "beng"))
    return "fontkit-outlines-v2-bengali-script-font-runs";
  return "fontkit-outlines-v4-ltr-script-font-runs";
}
