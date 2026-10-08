// Curated bounded joiner/control cases; keep valid failing inputs in this corpus.
// Halant/joiner and Sinhala sequences are independently checked against HarfBuzz.
const seeds = [
  ["Devanagari", "क", "्", "ष", "ि", "र"],
  ["Bengali", "ক", "্", "ষ", "ি", "র"],
  ["Gujarati", "ક", "્", "ષ", "િ", "ર"],
  ["Gurmukhi", "ਕ", "੍", "ਰ", "ਿ", "ਰ"],
  ["Odia", "କ", "୍", "ଷ", "ି", "ର"],
  ["Tamil", "க", "்", "ஷ", "ி", "ர"],
  ["Telugu", "క", "్", "ష", "ి", "ర"],
  ["Kannada", "ಕ", "್", "ಷ", "ಿ", "ರ"],
  ["Malayalam", "ക", "്", "ഷ", "ി", "ര"],
  ["Sinhala", "ක", "්", "ර", "ි", "ර"],
  ["Khmer", "ក", "្", "រ", "ី", "រ"],
  ["Myanmar", "က", "္", "က", "ိ", "ရ"],
  ["Tibetan", "ཀ", "", "ྲ", "ི", "ར"],
  ["Thai", "ก", "", "ำ", "่", "ร"],
  ["Lao", "ກ", "", "ຳ", "່", "ຣ"],
] as const;
export const CONTROL_FIXTURES = seeds.map(([name, a, h, b, v, ra]) => {
  const texts = [
    a + "\u200b" + a,
    a + "\u2060" + a,
    a + v + "\u200b" + a + v,
    a + v + "\u2060" + a + v,
  ];
  for (const j of ["\u200c", "\u200d"]) {
    texts.push(a + h + j + b, a + h + j + b + v);
    if (h) texts.push(a + h + j, ra + h + j + a, ra + h + j + a + v);
    else if (name === "Tibetan") texts.push(a + j, a + v + j);
  }
  if (h && name !== "Khmer")
    texts.push(
      a + "\u200d" + h + b,
      a + "\u200d" + h + b + v,
      ra + "\u200d" + h + a,
      ra + "\u200d" + h + a + v,
    );
  if (name === "Malayalam")
    texts.push(a + "\u200c" + h + b, a + "\u200c" + h + b + v);
  if (name === "Sinhala") {
    for (const cluster of [
      "ක්‍ක",
      "ක්‍ෂ",
      "ක්‍ර",
      "ක්‍ය",
      "ර්‍ක",
      "ශ්‍රී",
      "ත්‍ව",
      "ක‍්ර",
      "ක‍්ය",
      "ද්‍ධ",
      "න්‍ද",
      "න්‍ධ",
    ])
      for (const vowel of ["", "ි", "ී", "ෙ"]) texts.push(cluster + vowel);
  }
  const joined = a + h + "\u200d" + b;
  return {
    name,
    a,
    h,
    b,
    v,
    texts: [...new Set(texts)],
    title: joined + "\u200b" + a + "\u2060" + a,
    caption: a + h + "\u200c" + b + v + " " + joined + v,
  };
});
