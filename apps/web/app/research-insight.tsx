"use client";
import { parseResearchInsight, ResearchInsight, searchIntents } from "../../../packages/core/research-insight";

const labels: Record<string, string> = {
  subject: "Competitor / subject", contentTheme: "Observed content theme", format: "Observed format",
  positioning: "Observed positioning", opportunity: "Proposed opportunity", differentiation: "How we will differentiate",
  query: "Search query / topic", intent: "Proposed search intent", keywords: "Candidate keywords",
  questions: "Candidate questions", answerAngle: "Proposed answer angle", assumptions: "Assumptions and limits",
};
const maximums: Record<string, number> = { subject: 160, contentTheme: 300, format: 120, positioning: 500,
  opportunity: 500, differentiation: 500, query: 200, answerAngle: 500, assumptions: 500 };
export function emptyResearchInsight(category: "COMPETITOR" | "SEARCH"): ResearchInsight {
  return category === "COMPETITOR" ? { kind: category, subject: "", contentTheme: "", format: "", positioning: "",
    opportunity: "", differentiation: "", assumptions: "" } : { kind: category, query: "", intent: "INFORMATIONAL",
    keywords: [""], questions: [""], answerAngle: "", assumptions: "" };
}

export function ResearchInsightEditor({ category, value, onChange }: {
  category: string; value: ResearchInsight | null; onChange: (value: ResearchInsight | null) => void;
}) {
  if (category !== "COMPETITOR" && category !== "SEARCH") return null;
  return <div className="research-insight">
    <label className="review-ack"><input type="checkbox" checked={!!value} onChange={event => onChange(event.target.checked ? emptyResearchInsight(category) : null)} />Add structured {category === "COMPETITOR" ? "competitor" : "search"} insight</label>
    <p className="small-copy">Record your interpretation of this source. Keep uncertainty explicit. {category === "COMPETITOR" ? "Identify differentiation without copying competitor content." : "Candidate questions and intent are hypotheses; they do not establish search demand or rankings."} Changing category clears this optional insight.</p>
    {value && Object.entries(value).filter(([key]) => key !== "kind").map(([key, field]) => {
      const update = (next: string | string[]) => onChange({ ...value, [key]: next } as ResearchInsight);
      return <label key={key}>{labels[key]}{key === "intent"
        ? <select aria-label={labels[key]} value={String(field)} onChange={event => update(event.target.value)}>{searchIntents.map(intent => <option key={intent} value={intent}>{intent[0] + intent.slice(1).toLowerCase()}</option>)}</select>
        : <textarea aria-label={labels[key]} required rows={key === "keywords" || key === "questions" ? 3 : 2} maxLength={maximums[key] || (key === "keywords" ? 647 : 1004)}
          value={Array.isArray(field) ? field.join("\n") : field} onChange={event => update(Array.isArray(field) ? event.target.value.split("\n") : event.target.value)} />}
        {key === "keywords" && <small>One per line; 1–8 keywords, at most 80 characters each.</small>}
        {key === "questions" && <small>One per line; 1–5 questions, at most 200 characters each.</small>}
      </label>;
    })}
  </div>;
}

export function ResearchInsightView({ value, category }: { value: unknown; category: string }) {
  let insight: ResearchInsight | null;
  try { insight = parseResearchInsight(value, category); }
  catch { return <p role="note">Structured insight could not be read. Correct it before using this evidence.</p>; }
  if (!insight) return <p className="field-help">No structured insight recorded for this observation.</p>;
  return <section className="research-insight" aria-label="Structured research insight">
    <h3>{insight.kind === "COMPETITOR" ? "Competitor insight" : "Search insight"}</h3>
    <p className="field-help">Manual analyst interpretation · retain assumptions. {insight.kind === "COMPETITOR" ? "Use opportunities to differentiate; do not copy competitor content." : "Proposed search intent and topics, without measured demand or ranking claims."}</p>
    <dl className="research-facts">{Object.entries(insight).filter(([key]) => key !== "kind").map(([key, field]) => <div key={key}>
      <dt>{labels[key]}</dt><dd>{Array.isArray(field) ? <ul>{field.map((item, index) => <li key={index}>{item}</li>)}</ul> : field}</dd>
    </div>)}</dl>
  </section>;
}
