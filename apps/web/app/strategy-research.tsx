"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "./api-client";
import { ResearchInsightView } from "./research-insight";

const omissionLabels: Record<string, string> = { reviewRequired: "not accepted", unauthorized: "not authorized",
  unsupportedProvenance: "unsupported provenance", timeScope: "historical time scope", expired: "expired", invalidSource: "incomplete or invalid" };
function ResearchCoverage({ context }: { context: any }) {
  const coverage = context.coverage;
  if (!coverage) return <p className="field-help">Coverage counts were not recorded or could not be read for this job. They have not been reconstructed from the current library.</p>;
  const capture = coverage.capture;
  return <section aria-label="Research coverage" className="research-coverage">
    <h4>Research coverage</h4>
    <p className="field-help">At capture: {capture.examined} matching record{capture.examined === 1 ? "" : "s"} examined · {capture.eligible} eligible · {capture.captured} captured.</p>
    <p className="field-help">{capture.candidateWindowTruncated ? "More matching records existed beyond the latest 100; those older records were not assessed." : "Counts describe the matching records examined at capture."} These are input counts, not a measure of research quality or relevance.</p>
    {Object.values(capture.rejected).some(value => Number(value) > 0) && <p className="field-help">Excluded at capture: {Object.entries(capture.rejected).filter(([, value]) => Number(value) > 0).map(([key, value]) => `${value} ${omissionLabels[key]}`).join(" · ")}.</p>}
    {(capture.omitted.sourceLimit > 0 || capture.omitted.byteBudget > 0) && <p className="field-help">Eligible sources omitted: {capture.omitted.sourceLimit} at the 10-source limit · {capture.omitted.byteBudget} at the context size limit.</p>}
    <ul>{coverage.availableByCategory.map((item: any) => <li key={item.category}>
      {item.category}: {item.sources} usable source{item.sources === 1 ? "" : "s"} at generation check{item.sources === 0 ? " — evidence gap; label assumptions" : ""}
    </li>)}</ul>
    {context.excluded?.length > 0 && <p className="field-help">{context.excluded.length} captured source(s) became stale, changed or unavailable before generation. Capture counts remain historical.</p>}
  </section>;
}

export default function StrategyResearch({ base, jobId, available }: { base: string; jobId: string; available: boolean }) {
  const [context, setContext] = useState<any>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => { generation.current++; setContext(null); setError(""); setBusy(false);
    return () => { generation.current++; }; }, [base, jobId]);
  async function load() {
    const sequence = ++generation.current; setBusy(true); setError("");
    try {
      const trace = await api(`${base}/ai/jobs/${jobId}/trace`);
      if (sequence === generation.current) setContext(trace.frozenContext?.brand?.research || { status: "MISSING", reason: "LEGACY_NOT_CAPTURED", evidence: [] });
    } catch (err) { if (sequence === generation.current) { setContext(null); setError((err as Error).message); } }
    finally { if (sequence === generation.current) setBusy(false); }
  }
  return <section aria-label="Strategy research context" className="research-review">
    <button className="button" disabled={!available || busy} onClick={() => void load()}>{busy ? "Loading research context…" : "View research sources"}</button>
    {error && <p role="alert" className="alert error">{error}</p>}
    {context && <div>
      {context.selection ? <p aria-label="Captured research selection" className="field-help">Captured filters · Categories: {context.selection.categories.join(", ") || "All"} · Market: {context.selection.market || "All"} · Language: {context.selection.language || "All"}</p>
        : <p className="field-help">Research filters were not recorded or could not be read for this job.</p>}
      <h4>{context.evidence.length ? `${context.evidence.length} reviewed source${context.evidence.length === 1 ? "" : "s"} selected` : "No usable research evidence"}</h4>
      <p className="field-help">{context.checkedAt ? `Checked ${new Date(context.checkedAt).toLocaleString()}. ` : "This older job has no captured research. "}Manual observations are checked before provider requests; sources are not fetched or independently verified. Check the job result before using its recommendations.</p>
      {context.evidence.length === 0 && <p className="field-help">Recommendations must treat current research as missing and label assumptions. Add and review evidence before requesting a new strategy.</p>}
      <ResearchCoverage context={context} />
      <ul>{context.evidence.map((item: any) => <li key={item.id}>
        <strong>{item.title}</strong>{" · revision "}{item.revision}<br />
        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceLabel}</a>
        <p className="field-help">Manual · observed {new Date(item.observedAt).toLocaleString()} · freshness window ends {new Date(item.expiresAt).toLocaleString()}</p>
        {item.summaryTruncated && <p className="field-help">A bounded excerpt of this observation was supplied.</p>}
        <ResearchInsightView value={item.insight} category={item.category} />
      </li>)}</ul>
      {!context.coverage && context.excluded?.length > 0 && <p className="field-help">{context.excluded.length} captured observation(s) excluded after becoming stale, changing or losing acceptance.</p>}
    </div>}
  </section>;
}
