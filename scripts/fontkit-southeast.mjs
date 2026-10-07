/*
 * Copyright © 2011,2012,2013  Google, Inc.
 *
 *  This is part of HarfBuzz, a text shaping library.
 *
 * Permission is hereby granted, without written agreement and without
 * license or royalty fees, to use, copy, modify, and distribute this
 * software and its documentation for any purpose, provided that the
 * above copyright notice and the following two paragraphs appear in
 * all copies of this software.
 *
 * IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE TO ANY PARTY FOR
 * DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES
 * ARISING OUT OF THE USE OF THIS SOFTWARE AND ITS DOCUMENTATION, EVEN
 * IF THE COPYRIGHT HOLDER HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH
 * DAMAGE.
 *
 * THE COPYRIGHT HOLDER SPECIFICALLY DISCLAIMS ANY WARRANTIES, INCLUDING,
 * BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
 * FITNESS FOR A PARTICULAR PURPOSE.  THE SOFTWARE PROVIDED HEREUNDER IS
 * ON AN "AS IS" BASIS, AND THE COPYRIGHT HOLDER HAS NO OBLIGATION TO
 * PROVIDE MAINTENANCE, SUPPORT, UPDATES, ENHANCEMENTS, OR MODIFICATIONS.
 *
 * Google Author(s): Behdad Esfahbod
 */
// Reviewable Fontkit 2.0.4 bundle additions. HarfBuzz is a reference, not a runtime dependency.
// Myanmar grammar/reordering: https://github.com/harfbuzz/harfbuzz/tree/8.3.0/src
// Thai/Lao preprocessing: hb-ot-shaper-thai.cc. Tibetan 0F71: modern USE CMBlw.
import { readFileSync } from "node:fs";
const data = JSON.parse(
  readFileSync(new URL("./fontkit-myanmar-data.json", import.meta.url), "utf8"),
);
const template = String.raw`const mosMyanmarCategories = CATEGORIES;
const mosMyanmarMachine = MACHINE;
function mosMyanmarCategory(g) {
 const u=g.codePoints[0];
 if(u===0x25cc)return 11;
 for(const start in mosMyanmarCategories) {
  const table=mosMyanmarCategories[start],i=u-Number(start);
  if(i>=0&&i<table.length)return table[i];
 }
 return 0;
}
function mosMyanmarSetup(font,glyphs) {
 const input=glyphs.map(mosMyanmarCategory), d=mosMyanmarMachine;
 let serial=0;
 for(let start=0;start<input.length;) {
  let state=1,last=-1,tags=[];
  for(let i=start;i<input.length;i++) {
   state=d.stateTable[state][input[i]];
   if(!state)break;
   if(d.accepting[state]){last=i;tags=d.tags[state];}
  }
  if(last<start){last=start;tags=['other'];}
  const type=tags.includes('consonant')?'consonant':tags.includes('broken')?'broken':'other';
  for(let i=start;i<=last;i++)glyphs[i].shaperInfo={category:input[i],syllable:serial,type};
  serial++;start=last+1;
 }
}
function mosMyanmarReorder(font,glyphs) {
 for(let start=0;start<glyphs.length;) {
  let end=start+1;const info=glyphs[start].shaperInfo;
  while(end<glyphs.length&&glyphs[end].shaperInfo.syllable===info.syllable)end++;
  if(info.type==='other'){start=end;continue;}
  if(info.type==='broken') {
   const id=font.glyphForCodePoint(0x25cc).id;
   if(!id)throw new Error('Myanmar broken cluster requires a dotted-circle glyph.');
   const g=new GLYPHINFO(font,id,[0x25cc],glyphs[start].features);
   g.shaperInfo={...info,category:11};
   let at=start;
   if(end-start>=3&&glyphs[start].shaperInfo.category===15&&glyphs[start+1].shaperInfo.category===32&&glyphs[start+2].shaperInfo.category===4)at+=3;
   glyphs.splice(at,0,g);end++;
  }
  const categories=glyphs.slice(start,end).map(g=>g.shaperInfo.category);
  const kinzi=categories.length>=3&&categories[0]===15&&categories[1]===32&&categories[2]===4;
  let base=0;
  for(let i=kinzi?3:0;i<categories.length;i++)if([1,2,10,11,15,18].includes(categories[i])&&!glyphs[start+i].isLigated){base=i;break;}
  let pos=3;
  const part=glyphs.slice(start,end);
  for(let i=0;i<part.length;i++) {
   const c=categories[i];let p;
   if(kinzi&&i<3)p=3;
   else if(i<base)p=1;
   else if(i===base)p=2;
   else if(c===36)p=1;
   else if(c===22)p=0;
   else if(c===40)p=part[i-1].shaperInfo.position;
   else if(pos===3&&c===21){pos=5;p=pos;}
   else if(pos===5&&c===9)p=4;
   else if(pos===5&&c===21)p=pos;
   else if(pos===5&&c!==9){pos=6;p=pos;}
   else p=pos;
   part[i].shaperInfo={...part[i].shaperInfo,position:p};
  }
  part.sort((a,b)=>a.shaperInfo.position-b.shaperInfo.position);
  const left=part.filter(g=>g.shaperInfo.position===0);
  if(left.length>1) {
   left.reverse();let first=0;
   for(let j=0;j<left.length;j++)if(left[j].shaperInfo.category===22){left.splice(first,j-first+1,...left.slice(first,j+1).reverse());first=j+1;}
   part.splice(0,left.length,...left);
  }
  glyphs.splice(start,end-start,...part);start=end;
 }
}
// Apply the basic features to orthographic units, as required by Myanmar
// shaping. Presentation/GPOS features keep the normal whole-run processing.
function mosMyanmarApplyStage(processor,glyphs,stage) {
 if(!stage.every(tag=>['locl','ccmp','rphf','pref','blwf','pstf'].includes(tag)))return false;
 for(let start=0;start<glyphs.length;) {
  let end=start+1;const serial=glyphs[start].shaperInfo.syllable;
  while(end<glyphs.length&&glyphs[end].shaperInfo.syllable===serial)end++;
  const part=glyphs.slice(start,end);
  processor.applyFeatures(stage,part);
  glyphs.splice(start,end-start,...part);
  start+=part.length;
 }
 return true;
}
class mosMyanmarShaper extends DEFAULTSHAPER {
 static zeroMarkWidths='BEFORE_GPOS';
 static planFeatures(plan) {
  plan.addStage(mosMyanmarSetup);
  plan.addStage(['locl','ccmp']);
  plan.addStage(mosMyanmarReorder);
  for(const tag of ['rphf','pref','blwf','pstf'])plan.addStage([tag]);
  plan.addStage(['pres','abvs','blws','psts']);
 }
}
`;
const thaiLao = String.raw`
function mosThaiLaoText(text) {
 const chars=Array.from(text);
 for(let i=0;i<chars.length;i++) {
  const u=chars[i].codePointAt(0);
  if(u!==0x0e33 && u!==0x0eb3)continue;
  const nik=String.fromCodePoint(u+0x1a),aa=String.fromCodePoint(u-1);
  let start=i;
  while(start>0) {
   const c=chars[start-1].codePointAt(0)&~0x80;
   if(c===0xe31||c===0xe3b||(c>=0xe34&&c<=0xe37)||(c>=0xe47&&c<=0xe4e))start--;
   else break;
  }
  chars.splice(i,1,aa);chars.splice(start,0,nik);i++;
 }
 return chars.join('');
}
`;
export function southeastReplacements(source) {
  const universal = source.match(/tibt: \(0, (\$[\w$]+)\)/)?.[1];
  const defaultShaper = source.match(
    /\((\$[\w$]+), "zeroMarkWidths", 'AFTER_GPOS'\)/,
  )?.[1];
  const glyphInfo = source.match(
    /this.glyphInfos = glyphRun.glyphs.map\(\(glyph\)=>new \(0, (\$[\w$]+)\)/,
  )?.[1];
  const shaperMap = source.match(/const \$[\w$]+ = \{\n    arab: \(0,/)?.[0];
  if (!universal || !defaultShaper || !glyphInfo || !shaperMap)
    throw new Error("Reviewed Fontkit shaper symbols changed.");
  const useCategory = universal.replace(
    "$export$2e2bcd8739ae039",
    "$var$useCategory",
  );
  const block = template
    .replace("CATEGORIES", JSON.stringify(data.categories))
    .replace("MACHINE", JSON.stringify(data.machine))
    .replace("DEFAULTSHAPER", defaultShaper)
    .replace("GLYPHINFO", glyphInfo);
  return [
    ["glyphs.splice(++i, 0, g);", "glyphs.splice(i, 0, g);"],
    [
      "processor.applyFeatures(stage, glyphs, positions);",
      "if (positions || !['mym2', 'mymr'].includes(this.script) || !mosMyanmarApplyStage(processor, glyphs, stage)) processor.applyFeatures(stage, glyphs, positions);",
    ],
    [
      "var glyphs = this.font.glyphsForString(string);",
      "var glyphs = this.font.glyphsForString(mosThaiLaoText(string));",
    ],
    [
      "this.sequenceMatches(-rule.backtrack.length, rule.backtrack)",
      "this.sequenceMatches(-rule.backtrack.length, rule.backtrack.slice().reverse())",
    ],
    [
      "this.classSequenceMatches(-rule.backtrack.length, rule.backtrack, table.backtrackClassDef)",
      "this.classSequenceMatches(-rule.backtrack.length, rule.backtrack.slice().reverse(), table.backtrackClassDef)",
    ],
    [
      "this.coverageSequenceMatches(-table.backtrackGlyphCount, table.backtrackCoverage)",
      "this.coverageSequenceMatches(-table.backtrackGlyphCount, table.backtrackCoverage.slice().reverse())",
    ],
    [
      "        let glyphIndex = this.glyphIterator.index;\n",
      "        let glyphIndex = this.glyphIterator.index;\n        const mosInputLength = this.glyphs.length;\n",
    ],
    [
      "        this.glyphIterator.reset(options, glyphIndex);\n        return true;",
      "        this.glyphIterator.reset(options, glyphIndex + Math.max(0, this.glyphs.length - mosInputLength));\n        return true;",
    ],
    [
      "this.glyphs[baseGlyphIndex].ligatureComponent > 0",
      "(this.glyphs[baseGlyphIndex].ligatureComponent > 0 && !this.glyphs[baseGlyphIndex].isMultiplied)",
    ],
    [
      `function ${useCategory}(glyph) {`,
      `function ${useCategory}(glyph) {\n    if (glyph.codePoints[0] === 0x0f71) return 11; // CMBlw`,
    ],
    [
      `    tibt: (0, ${universal}),`,
      `    mym2: mosMyanmarShaper,\n    mymr: mosMyanmarShaper,\n    tibt: (0, ${universal}),`,
    ],
    [shaperMap, block + "\n" + thaiLao + "\n" + shaperMap],
  ];
}
