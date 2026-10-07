import { resolve } from "node:path";
import type { CjkLanguage } from "../../packages/core/render-cjk";
import metadata from "./cjk-fonts.json";
export const CJK_BATCH_FIXTURES = [
  {
    key: "sc",
    language: "zh-Hans",
    name: "Simplified Chinese",
    tag: "hani",
    title: "新产品「精彩生活」",
    caption: "欢迎体验，品质生活。",
    texts: [
      "中国",
      "中文简体",
      "新产品",
      "欢迎体验",
      "骨直令羽",
      "门里云台",
      "「精彩生活」",
      "价格１２３．４５",
      "𠀋",
    ],
  },
  {
    key: "tc",
    language: "zh-Hant",
    name: "Traditional Chinese",
    tag: "hani",
    title: "新產品「精彩生活」",
    caption: "歡迎體驗，品質生活。",
    texts: [
      "中國",
      "中文繁體",
      "新產品",
      "歡迎體驗",
      "骨直令羽",
      "門裏雲臺",
      "「精彩生活」",
      "價格１２３．４５",
      "𠀋",
    ],
  },
  {
    key: "jp",
    language: "ja",
    name: "Japanese",
    tag: "kana",
    title: "新商品「こんにちは」",
    caption: "毎日を、もっと楽しく。",
    texts: [
      "こんにちは",
      "カタカナ",
      "ぱぴぷぺぽ",
      "か\u3099き\u3099く\u3099け\u3099こ\u3099",
      "は\u309aひ\u309aふ\u309aへ\u309aほ\u309a",
      "ｶﾞｷﾞｸﾞｹﾞｺﾞ",
      "ﾊﾟﾋﾟﾌﾟﾍﾟﾎﾟ",
      "パーティー",
      "きゃきゅきょ",
      "がっこう",
      "「あいうえお」",
      "アー。",
    ],
  },
  {
    key: "kr",
    language: "ko",
    name: "Korean",
    tag: "hang",
    title: "신제품「즐거운 생활」",
    caption: "매일을 더 즐겁게 만드세요.",
    texts: [
      "한국어",
      "신제품",
      "즐거운 생활",
      "한글",
      "가",
      "가각간",
      "각",
      "한〮",
      "한〯",
      "ᄓᅡ",
      "「한국어」",
      "한 글",
    ],
  },
] as const;
export type CjkFixture = (typeof CJK_BATCH_FIXTURES)[number];
export function cjkFontPath(key: keyof typeof metadata) {
  return (
    process.env["TEST_CJK_" + key.toUpperCase() + "_FONT_PATH"] ||
    resolve(".local/test-cjk-fonts", metadata[key].file)
  );
}
export function cjkTexts(sample: CjkFixture) {
  const texts: string[] = [...sample.texts];
  if (sample.key === "sc" || sample.key === "tc") {
    for (let point = 0x4e00; point < 0x4f00; point++) {
      texts.push(
        String.fromCodePoint(point),
        "「" + String.fromCodePoint(point) + "」，",
      );
    }
    for (const point of [0x20000, 0x2000b, 0x2a6df])
      texts.push(String.fromCodePoint(point));
  } else if (sample.key === "jp") {
    for (const [from, to] of [
      [0x3041, 0x3096],
      [0x30a1, 0x30fa],
      [0xff66, 0xff9d],
    ]) {
      for (let point = from; point <= to; point++)
        texts.push(
          String.fromCodePoint(point),
          "あ" + String.fromCodePoint(point) + "。",
        );
    }
    for (const base of "かきくけこさしすせそたちつてとはひふへほカキクケコサシスセソタチツテトハヒフヘホ")
      for (const mark of ["\u3099", "\u309a"]) texts.push(base + mark);
  } else {
    // All 11,172 modern syllables, plus all LV Jamo combinations and sampled tails.
    for (let point = 0xac00; point <= 0xd7a3; point++)
      texts.push(String.fromCodePoint(point));
    for (let lead = 0x1100; lead <= 0x1112; lead++)
      for (let vowel = 0x1161; vowel <= 0x1175; vowel++) {
        texts.push(String.fromCodePoint(lead, vowel));
        for (const tail of [0x11a8, 0x11ab, 0x11af, 0x11c2])
          texts.push(String.fromCodePoint(lead, vowel, tail));
      }
  }
  return [...new Set(texts)];
}
export const cjkOptions = (language: CjkLanguage) => ({
  captions: false,
  cjkLanguage: language,
});
