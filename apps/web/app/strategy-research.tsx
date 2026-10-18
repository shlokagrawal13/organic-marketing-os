"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "./api-client";

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
      <h4>{context.evidence.length ? `${context.evidence.length} reviewed source${context.evidence.length === 1 ? "" : "s"} selected` : "No usable research evidence"}</h4>
      <p className="field-help">{context.checkedAt ? `Checked ${new Date(context.checkedAt).toLocaleString()}. ` : "This older job has no captured research. "}Manual observations are checked before provider requests; sources are not fetched or independently verified. Check the job result before using its recommendations.</p>
      {context.evidence.length === 0 && <p className="field-help">Recommendations must treat current research as missing and label assumptions. Add and review evidence before requesting a new strategy.</p>}
      <ul>{context.evidence.map((item: any) => <li key={item.id}>
        <strong>{item.title}</strong>{" · revision "}{item.revision}<br />
        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceLabel}</a>
        <p className="field-help">Manual · observed {new Date(item.observedAt).toLocaleString()} · freshness window ends {new Date(item.expiresAt).toLocaleString()}</p>
        {item.summaryTruncated && <p className="field-help">A bounded excerpt of this observation was supplied.</p>}
      </li>)}</ul>
      {context.excluded?.length > 0 && <p className="field-help">{context.excluded.length} captured observation(s) excluded after becoming stale, changing or losing acceptance.</p>}
    </div>}
  </section>;
}
