"use client";
import { parseResearchInsight, ResearchInsight, searchIntents, communitySignals, insightCategories } from "../../../packages/core/research-insight";

const labels: Record<string, string> = {
  subject: "Competitor / subject", contentTheme: "Observed content theme", format: "Observed format",
  positioning: "Observed positioning", opportunity: "Proposed opportunity", differentiation: "How we will differentiate",
  query: "Search query / topic", intent: "Proposed search intent", keywords: "Candidate keywords",
  questions: "Candidate questions", answerAngle: "Proposed answer angle", assumptions: "Assumptions and limits",
  segment: "Audience segment", observedNeed: "Observed audience need", interests: "Observed interests",
  painPoints: "Observed pain points", proposedResponse: "Proposed response / content test",
  channelContext: "Community context", signal: "Community signal", topic: "Observed topic", observation: "Observed interaction theme",
};
const maximums: Record<string, number> = { subject: 160, contentTheme: 300, format: 120, positioning: 500,
  opportunity: 500, differentiation: 500, query: 200, answerAngle: 500, assumptions: 500,
  segment: 160, observedNeed: 500, proposedResponse: 500, channelContext: 160, topic: 200, observation: 500 };
const lists: Record<string, { count: number; length: number }> = {
  keywords: { count: 8, length: 80 }, questions: { count: 5, length: 200 },
  interests: { count: 5, length: 160 }, painPoints: { count: 5, length: 200 },
};
const guidance: Record<ResearchInsight["kind"], string> = {
  COMPETITOR: "Identify differentiation without copying competitor content.",
  SEARCH: "Candidate questions and intent are hypotheses; they do not establish search demand or rankings.",
  AUDIENCE: "Describe only this source's observed need. Optional lists can stay empty; do not infer population-wide interests or frequency.",
  COMMUNITY: "Use authorized, de-identified interaction themes. Omit personal identifiers and private message text. A signal does not establish frequency or sentiment.",
};
const displayKind = (kind: string) => kind[0] + kind.slice(1).toLowerCase();
const fieldLabel = (kind: string, key: string) => kind === "AUDIENCE" && key === "questions" ? "Observed audience questions" : labels[key];
export function emptyResearchInsight(category: ResearchInsight["kind"]): ResearchInsight {
  if (category === "AUDIENCE") return { kind: category, segment: "", observedNeed: "", interests: [], questions: [], painPoints: [], proposedResponse: "", assumptions: "" };
  if (category === "COMMUNITY") return { kind: category, channelContext: "", signal: "QUESTION", topic: "", observation: "", proposedResponse: "", assumptions: "" };
  return category === "COMPETITOR" ? { kind: category, subject: "", contentTheme: "", format: "", positioning: "",
    opportunity: "", differentiation: "", assumptions: "" } : { kind: category, query: "", intent: "INFORMATIONAL",
    keywords: [""], questions: [""], answerAngle: "", assumptions: "" };
}

export function ResearchInsightEditor({ category, value, onChange }: {
  category: string; value: ResearchInsight | null; onChange: (value: ResearchInsight | null) => void;
}) {
  if (!insightCategories.some(kind => kind === category)) return null;
  const kind = category as ResearchInsight["kind"];
  return <div className="research-insight">
    <label className="review-ack"><input type="checkbox" checked={!!value} onChange={event => onChange(event.target.checked ? emptyResearchInsight(kind) : null)} />Add structured {kind.toLowerCase()} insight</label>
    <p className="small-copy">Record your interpretation of this source. Keep uncertainty explicit. {guidance[kind]} Changing category clears this optional insight.</p>
    {value && Object.entries(value).filter(([key]) => key !== "kind").map(([key, field]) => {
      const update = (next: string | string[]) => onChange({ ...value, [key]: next } as ResearchInsight);
      const name = fieldLabel(value.kind, key), list = lists[key], optional = value.kind === "AUDIENCE" && !!list;
      const options = key === "intent" ? searchIntents : key === "signal" ? communitySignals : null;
      return <label key={key}>{name}{options
        ? <select aria-label={name} value={String(field)} onChange={event => update(event.target.value)}>{options.map(option => <option key={option} value={option}>{displayKind(option).replaceAll("_", " ")}</option>)}</select>
        : <textarea aria-label={name} required={!optional} rows={list ? 3 : 2} maxLength={maximums[key] || (list ? list.count * (list.length + 1) - 1 : 500)}
          value={Array.isArray(field) ? field.join("\n") : field} onChange={event => update(Array.isArray(field) ? (event.target.value === "" ? [] : event.target.value.split("\n")) : event.target.value)} />}
        {list && <small>{optional ? "Optional; leave blank when not observed. " : ""}One per line; {optional ? "0" : "1"}–{list.count} items, at most {list.length} characters each.</small>}
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
    <h3>{displayKind(insight.kind)} insight</h3>
    <p className="field-help">Manual analyst interpretation · retain assumptions. {guidance[insight.kind]}</p>
    <dl className="research-facts">{Object.entries(insight).filter(([key]) => key !== "kind").map(([key, field]) => <div key={key}>
      <dt>{fieldLabel(insight.kind, key)}</dt><dd>{Array.isArray(field) ? field.length ? <ul>{field.map((item, index) => <li key={index}>{item}</li>)}</ul> : "Not recorded" : field}</dd>
    </div>)}</dl>
  </section>;
}
