"use client";

const issueLabels: Record<string, string> = {
  UNKNOWN_SOURCE: "Source was not in the captured research context",
  REVISION_MISMATCH: "Source revision does not match",
  EXPIRED_SOURCE: "Source freshness window ended",
  QUOTE_NOT_FOUND: "Quoted excerpt does not match the captured observation",
  QUOTE_TOO_SHORT: "Quoted excerpt is too short to check",
  MISSING_REFERENCES: "Research basis has no source reference",
  ASSUMPTION_REQUIRED: "Assumption needs a missing-data or test explanation",
  UNEXPECTED_REFERENCES: "An assumption cannot claim research references",
  DUPLICATE_REFERENCE: "Duplicate source reference",
  DUPLICATE_RECOMMENDATION: "Duplicate recommendation ID",
};
export default function StrategyRecommendations({ output, review }: { output: any; review: any }) {
  const citationReview = review?.citationReview;
  return <section aria-label="Recommendation source review" className="research-review strategy-references">
    <h3>Recommendations and evidence</h3>
    <p className="field-help">Checks match captured source IDs, revisions and exact excerpts. Review relevance, factual claims and assumptions yourself before approving.</p>
    {!citationReview || citationReview.status === "MISSING" ? <p className="alert" role="status">This result has no checked recommendation references. Generate a new strategy to review source-linked recommendations.</p>
      : !citationReview.passed && <p className="alert error" role="alert">Source reference checks blocked approval. Generate a corrected strategy.</p>}
    {output.recommendations?.map((item: any, index: number) => {
      const checked = citationReview?.recommendations?.find((row: any) => row.index === index && row.id === item.id);
      return <article key={`${index}:${item.id}`} className="research-review">
        <h4>{item.recommendation}</h4>
        <p><strong>{!checked ? "References not checked" : checked.status === "BLOCKED" ? "Reference checks blocked" : checked.status === "ASSUMPTION" ? "Assumption — evidence gap or proposed test" : "Source excerpt matched — review its relevance"}</strong></p>
        {item.assumption && <p>Assumptions or limits: {item.assumption}</p>}
        {checked?.issues?.length > 0 && <ul>{checked.issues.map((code: string) => <li key={code}>{issueLabels[code] || "Source reference could not be checked"}</li>)}</ul>}
        {checked?.references?.map((ref: any) => <blockquote key={ref.sourceId}>
          <p>{ref.quote}</p>
          <a href={ref.sourceUrl} target="_blank" rel="noopener noreferrer">{ref.sourceLabel}</a>{" · captured revision "}{ref.revision}
        </blockquote>)}
      </article>;
    })}
  </section>;
}
