/*
 * Copyright © 2007,2008,2009,2010 Red Hat, Inc.
 * Copyright © 2010,2011,2012,2013 Google, Inc.
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
 * FITNESS FOR A PARTICULAR PURPOSE. THE SOFTWARE PROVIDED HEREUNDER IS
 * ON AN "AS IS" BASIS, AND THE COPYRIGHT HOLDER HAS NO OBLIGATION TO
 * PROVIDE MAINTENANCE, SUPPORT, UPDATES, ENHANCEMENTS, OR MODIFICATIONS.
 */
// Bounded Fontkit 2.0.4 additions. Reference: HarfBuzz 8.3.0
// hb-ot-layout-gsubgpos.hh, hb-ot-shaper-indic.cc, hb-ot-shaper-use.cc.
// Exact whole-input and upstream hash guards live in patch-fontkit.mjs.
const manualZWJ =
  "['nukt','akhn','rphf','rkrf','pref','blwf','abvf','half','pstf','vatu','cjct','init','pres','abvs','blws','psts','haln','mark','mkmk']";
const originalMatch = `    match(sequenceIndex, sequence, fn, matched) {
        let pos = this.glyphIterator.index;
        let glyph = this.glyphIterator.increment(sequenceIndex);
        let idx = 0;
        while(idx < sequence.length && glyph && fn(sequence[idx], glyph)){
            if (matched) matched.push(this.glyphIterator.index);
            idx++;
            glyph = this.glyphIterator.next();
        }
        this.glyphIterator.index = pos;
        if (idx < sequence.length) return false;
        return matched || true;
    }`;
const controlMatch = `    mosContextMatch(callback, classChain = false) {
        const old = this.mosContext, oldClass = this.mosClassChain;
        this.mosContext = true; this.mosClassChain = classChain;
        try { return callback(); } finally { this.mosContext = old; this.mosClassChain = oldClass; }
    }
    match(sequenceIndex, sequence, fn, matched) {
        const iterator = this.glyphIterator, pos = iterator.index;
        const backwards = sequenceIndex < 0, context = !!this.mosContext;
        const values = backwards ? sequence.slice().reverse() : sequence;
        const indices = sequenceIndex === 1 ? [pos] : [];
        if (backwards) iterator.index = pos - 1;
        else if (context && sequenceIndex > 0 && this.mosInputIndices?.length) iterator.index = this.mosInputIndices.at(-1) + 1;
        else iterator.index = pos + sequenceIndex;
        const direction = backwards ? -1 : 1;
        let idx = 0;
        while(idx < values.length && iterator.cur) {
            const glyph = iterator.cur, point = glyph.codePoints[0];
            if (iterator.shouldIgnore(glyph)) { iterator.index += direction; continue; }
            if (fn(values[idx], glyph)) { indices.push(iterator.index); if(matched)matched.push(iterator.index); idx++; iterator.index += direction; continue; }
            // Default ignorables are MAYBE skipped: explicit glyph/class matches
            // above take precedence. Class-chain fast checks in HB 8.3.0 inspect
            // the first two following glyphs using the input feature policy.
            const contextZWJ = context && (!this.mosClassChain || backwards || idx >= Math.max(0, 3 - (this.mosInputIndices?.length || 1)));
            const skip = point === 0x200b || point === 0x2060 || (point === 0x200c && iterator.options.mosAutoZWJ) || (point === 0x200d && (contextZWJ || iterator.options.mosAutoZWJ));
            if (!skip) break;
            iterator.index += direction;
        }
        iterator.index = pos;
        if (idx < values.length) return false;
        if (!context && sequenceIndex >= 0) this.mosInputIndices = indices;
        return matched || true;
    }`;
const useBefore = `function $9b772791ccede8a5$var$setupSyllables(font, glyphs) {
    let syllable = 0;
    for (let [start, end, tags] of $9b772791ccede8a5$var$stateMachine.match(glyphs.map($9b772791ccede8a5$var$useCategory))){
        ++syllable;
        // Create shaper info
        for(let i = start; i <= end; i++)glyphs[i].shaperInfo = new $9b772791ccede8a5$var$USEInfo($9b772791ccede8a5$var$categories[$9b772791ccede8a5$var$useCategory(glyphs[i])], tags[0], syllable);
        // Assign rphf feature
        let limit = glyphs[start].shaperInfo.category === 'R' ? 1 : Math.min(3, end - start);
        for(let i = start; i < start + limit; i++)glyphs[i].features.rphf = true;
    }
}`;
export function controlReplacements(source) {
  const isMark = source.match(
    /this\.codePoints\.every\((\(0, \$[^)]+isMark\))\)/,
  )?.[1];
  if (!isMark) throw new Error("Fontkit Unicode mark helper changed.");
  const useAfter = `function $9b772791ccede8a5$var$setupSyllables(font, glyphs) {
    let syllable = 0;
    const filtered = [];
    for(let i = 0; i < glyphs.length; i++) {
        const point = glyphs[i].codePoints[0];
        glyphs[i].shaperInfo = new $9b772791ccede8a5$var$USEInfo($9b772791ccede8a5$var$categories[$9b772791ccede8a5$var$useCategory(glyphs[i])], 'non_cluster', 0);
        if(point === 0x200d || (point === 0x200c && i + 1 < glyphs.length && ${isMark}(glyphs[i+1].codePoints[0]))) continue;
        filtered.push(i);
    }
    for(let [a,b,tags] of $9b772791ccede8a5$var$stateMachine.match(filtered.map(i=>$9b772791ccede8a5$var$useCategory(glyphs[i])))) {
        const start = a === 0 ? 0 : filtered[a], end = b + 1 < filtered.length ? filtered[b+1] - 1 : glyphs.length - 1;
        ++syllable;
        for(let i=start; i<=end; i++)glyphs[i].shaperInfo = new $9b772791ccede8a5$var$USEInfo($9b772791ccede8a5$var$categories[$9b772791ccede8a5$var$useCategory(glyphs[i])], tags[0], syllable);
        const limit = glyphs[start].shaperInfo.category === 'R' ? 1 : Math.min(3,end-start);
        for(let i=start; i<start+limit; i++)glyphs[i].features.rphf=true;
    }
}`;
  const r = [
    [
      "            // Apply lookup subtables until one matches\n            for (let table of lookup.subTables){\n                if (this.applyLookup(lookup.lookupType, table)) break;\n            }\n        }",
      "            const mosBeforeLength = this.glyphs.length;\n            const mosSequence = lookupRecord.sequenceIndex;\n            for (let table of lookup.subTables){\n                if (this.applyLookup(lookup.lookupType, table)) break;\n            }\n            if(mosIndices) {\n                const delta = this.glyphs.length - mosBeforeLength;\n                if(delta > 0) {\n                    const inserted = Array.from({length:delta},(_,i)=>mosIndices[mosSequence]+i+1);\n                    mosIndices.splice(mosSequence+1,0,...inserted);\n                    for(let i=mosSequence+1+delta;i<mosIndices.length;i++)mosIndices[i]+=delta;\n                } else if(delta < 0) {\n                    mosIndices.splice(mosSequence+1,Math.min(-delta,mosIndices.length-mosSequence-1));\n                    for(let i=mosSequence+1;i<mosIndices.length;i++)mosIndices[i]+=delta;\n                }\n            }\n        }",
    ],
    [
      "function $9b772791ccede8a5$var$reorder(font, glyphs) {\n    let dottedCircle = font.glyphForCodePoint(0x25cc).id;\n    for(let start = 0, end = $9b772791ccede8a5$var$nextSyllable(glyphs, 0); start < glyphs.length; start = end, end = $9b772791ccede8a5$var$nextSyllable(glyphs, start)){\n        let i, j;\n        let info = glyphs[start].shaperInfo;\n        let type = info.syllableType;\n        // Only a few syllable types need reordering.\n        if (type !== 'virama_terminated_cluster' && type !== 'standard_cluster' && type !== 'broken_cluster') continue;\n        // Insert a dotted circle glyph in broken clusters.\n        if (type === 'broken_cluster' && dottedCircle) {\n            let g = new (0, $f22bb23c9fd478d8$export$2e2bcd8739ae039)(font, dottedCircle, [\n                0x25cc\n            ]);\n            g.shaperInfo = info;\n            // Insert after possible Repha.\n            for(i = start; i < end && glyphs[i].shaperInfo.category === 'R'; i++);\n            glyphs.splice(i, 0, g);\n            end++;\n        }\n        // Move things forward.\n        if (info.category === 'R' && end - start > 1) // Got a repha. Reorder it to after first base, before first halant.\n        for(i = start + 1; i < end; i++){\n            info = glyphs[i].shaperInfo;\n            if ($9b772791ccede8a5$var$isBase(info) || $9b772791ccede8a5$var$isHalant(glyphs[i])) {\n                // If we hit a halant, move before it; otherwise it's a base: move to it's\n                // place, and shift things in between backward.\n                if ($9b772791ccede8a5$var$isHalant(glyphs[i])) i--;\n                glyphs.splice(start, 0, ...glyphs.splice(start + 1, i - start), glyphs[i]);\n                break;\n            }\n        }\n        // Move things back.\n        for(i = start, j = end; i < end; i++){\n            info = glyphs[i].shaperInfo;\n            if ($9b772791ccede8a5$var$isBase(info) || $9b772791ccede8a5$var$isHalant(glyphs[i])) // If we hit a halant, move after it; otherwise it's a base: move to it's\n            // place, and shift things in between backward.\n            j = $9b772791ccede8a5$var$isHalant(glyphs[i]) ? i + 1 : i;\n            else if ((info.category === 'VPre' || info.category === 'VMPre') && j < i) glyphs.splice(j, 1, glyphs[i], ...glyphs.splice(j, i - j));\n        }\n    }\n}",
      "function $9b772791ccede8a5$var$reorder(font, glyphs) {\n    const P = new Set(['FAbv','FBlw','FPst','FMAbv','FMBlw','FMPst','MAbv','MBlw','MPst','MPre','VAbv','VBlw','VPst','VPre','VMAbv','VMBlw','VMPst','VMPre']);\n    const halant = g => ['H','HVM','IS'].includes(g.shaperInfo.category) && !g.isLigated;\n    const circle = font.glyphForCodePoint(0x25cc).id;\n    for(let start=0;start<glyphs.length;) {\n        let end=$9b772791ccede8a5$var$nextSyllable(glyphs,start);\n        const info=glyphs[start].shaperInfo;\n        if(!['virama_terminated_cluster','sakot_terminated_cluster','standard_cluster','symbol_cluster','broken_cluster'].includes(info.syllableType)){start=end;continue;}\n        if(info.syllableType==='broken_cluster'&&circle){\n            let at=start;while(at<end&&glyphs[at].shaperInfo.category==='R')at++;\n            const g=new (0, $f22bb23c9fd478d8$export$2e2bcd8739ae039)(font,circle,[0x25cc]);\n            g.shaperInfo={...info,category:'B'};glyphs.splice(at,0,g);end++;\n        }\n        if(glyphs[start].shaperInfo.category==='R'&&end-start>1){\n            for(let i=start+1;i<end;i++){\n                const post=P.has(glyphs[i].shaperInfo.category)||halant(glyphs[i]);\n                if(post||i===end-1){if(post)i--;const g=glyphs.splice(start,1)[0];glyphs.splice(i,0,g);break;}\n            }\n        }\n        let j=start;\n        for(let i=start;i<end;i++){\n            const g=glyphs[i];\n            if(halant(g))j=i+1;\n            else if(['VPre','VMPre'].includes(g.shaperInfo.category)&&!g.ligatureComponent&&j<i){glyphs.splice(i,1);glyphs.splice(j,0,g);}\n        }\n        start=end;\n    }\n}",
    ],
    [
      "    sinh: (0, $d203e6b9523d0071$export$2e2bcd8739ae039),",
      "    sinh: (0, $9b772791ccede8a5$export$2e2bcd8739ae039),",
    ],
    [
      "            else this._getBaseGlyph(glyph, characters);\n        }\n        return this._glyphs[glyph] || null;",
      "            else this._getBaseGlyph(glyph, characters);\n        }\n        const cached = this._glyphs[glyph] || null;\n        return cached && arguments.length > 1 ? Object.create(cached, {codePoints: {value: characters.slice(), writable: true, configurable: true}}) : cached;",
    ],
    [
      "    shouldIgnore(glyph) {\n",
      "    shouldIgnore(glyph) {\n        const point = glyph.codePoints[0];\n        if (this.options.mosGPOS && (point === 0x200b || point === 0x200c || point === 0x2060 || (point === 0x200d && this.options.mosAutoZWJ))) return true;\n",
    ],
    [
      "markFilteringSet: lookup.markFilteringSet}",
      `markFilteringSet: lookup.markFilteringSet, mosGPOS: !!this.positions, mosAutoZWJ: !${manualZWJ}.includes(this.currentFeature)}`,
    ],
    [
      " const glyph=processor.glyphs[index],previous=processor.glyphs[index-1];",
      " const glyph=processor.glyphs[index],previous=processor.glyphs[index-1];\n const point=glyph.codePoints[0];\n if(point===0x200b||point===0x200c||point===0x2060||(point===0x200d&&processor.glyphIterator.options.mosAutoZWJ))return true;",
    ],
    [
      "while(--baseGlyphIndex >= 0 && this.glyphs[baseGlyphIndex].isMark);",
      "while(--baseGlyphIndex >= 0 && (this.glyphs[baseGlyphIndex].isMark || this.glyphIterator.shouldIgnore(this.glyphs[baseGlyphIndex])));",
    ],
    [
      "            glyphs[i] = space;\n            positions[i].xAdvance = 0;\n            positions[i].yAdvance = 0;",
      "            glyphs[i] = space;\n            positions[i].xAdvance = 0;\n            positions[i].yAdvance = 0;\n            positions[i].xOffset = 0;\n            positions[i].yOffset = 0;",
    ],
    [
      "        let positioned = null;",
      "        for(let i=0;i<glyphRun.glyphs.length;i++)if([0x200b,0x200c,0x200d,0x2060].includes(glyphRun.glyphs[i].codePoints[0]))glyphRun.positions[i].xAdvance=0;\n        let positioned = null;",
    ],
    [
      "if(last<start){last=start;tags=['other'];}",
      "if(last<start){last=start;tags=['other'];}\n  if(last===start&&[5,6].includes(input[start]))tags=['other'];",
    ],
    [useBefore, useAfter],
    [
      "    let virama = font.glyphForCodePoint(indicConfig.virama).id;",
      "    if(plan.unicodeScript === 'Kannada')for(let i=0;i+2<glyphs.length;i++)if(glyphs[i].codePoints[0]===0x0cb0&&glyphs[i+1].codePoints[0]===0x0ccd&&glyphs[i+2].codePoints[0]===0x200d)[glyphs[i+1],glyphs[i+2]]=[glyphs[i+2],glyphs[i+1]];\n    let virama = font.glyphForCodePoint(indicConfig.virama).id;",
    ],
    [
      "while(newPos > start && !(glyphs[newPos].shaperInfo.category & ((0, $79e3b6f2c331d0bf$export$a513ea61a7bee91c).M | (0, $79e3b6f2c331d0bf$export$ca9599b2a300afc))))newPos--;",
      "while(newPos > start && (!(glyphs[newPos].shaperInfo.category & ((0, $79e3b6f2c331d0bf$export$a513ea61a7bee91c).M | (0, $79e3b6f2c331d0bf$export$ca9599b2a300afc))) || ($d203e6b9523d0071$var$isHalantOrCoeng(glyphs[newPos]) && glyphs[newPos+1]?.codePoints[0] === 0x200d)))newPos--;",
    ],
    [originalMatch, controlMatch],
    [
      "        const mosInputLength = this.glyphs.length;",
      "        const mosInputLength = this.glyphs.length;\n        const mosIndices = this.mosInputIndices?.slice();",
    ],
    [
      "            this.glyphIterator.increment(lookupRecord.sequenceIndex);",
      "            if(mosIndices?.[lookupRecord.sequenceIndex] !== undefined)this.glyphIterator.index=mosIndices[lookupRecord.sequenceIndex];\n            else this.glyphIterator.increment(lookupRecord.sequenceIndex);",
    ],
  ];
  for (const [method, back, input, look, extra] of [
    [
      "sequenceMatches",
      "rule.backtrack.length",
      "rule.input.length",
      "rule.lookahead",
      "",
    ],
    [
      "classSequenceMatches",
      "rule.backtrack.length",
      "rule.input.length",
      "rule.lookahead",
      ", table.lookaheadClassDef",
    ],
    [
      "coverageSequenceMatches",
      "table.backtrackGlyphCount",
      "table.inputGlyphCount",
      "table.lookaheadCoverage",
      "",
    ],
  ]) {
    const backArg =
      method === "classSequenceMatches" ? ", table.backtrackClassDef" : "";
    const backValues =
      method === "coverageSequenceMatches"
        ? "table.backtrackCoverage"
        : "rule.backtrack";
    const beforeBack = `this.${method}(-${back}, ${backValues}.slice().reverse()${backArg})`;
    const beforeLook = `this.${method}(${method === "coverageSequenceMatches" ? input : "1 + " + input}, ${look}${extra})`;
    const classFlag = method === "classSequenceMatches" ? ", true" : "";
    r.push(
      [beforeBack, `this.mosContextMatch(()=>${beforeBack}${classFlag})`],
      [beforeLook, `this.mosContextMatch(()=>${beforeLook}${classFlag})`],
    );
  }
  if (source.includes("$7ab494fe977143c6$var$useCategory")) {
    const symbols = [
      ["$9b772791ccede8a5$", "$7ab494fe977143c6$"],
      ["$79e3b6f2c331d0bf$", "$90a9d3398ee54fe5$"],
      ["$d203e6b9523d0071$", "$7826f90f6f0cecc9$"],
      ["$f22bb23c9fd478d8$", "$10e7b257e1a9a756$"],
    ];
    return r.map((pair) =>
      pair.map((value) =>
        symbols.reduce(
          (s, [before, after]) => s.split(before).join(after),
          value,
        ),
      ),
    );
  }
  return r;
}
