"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, ExternalLink, Plus } from "lucide-react";
import { api } from "./api-client";
import { parseResearchInsight, ResearchInsight } from "../../../packages/core/research-insight";
import { ResearchInsightEditor, ResearchInsightView } from "./research-insight";

type Category = "INDUSTRY" | "AUDIENCE" | "COMPETITOR" | "SEARCH" | "SEASONAL" | "COMMUNITY";
type TemporalScope = "CURRENT" | "HISTORICAL" | "EVERGREEN" | "EMERGING" | "EXPIRED";
type ResearchRecord = {
  id: string; organizationId: string; revision: number; title: string; category: Category;
  temporalScope: TemporalScope; summary: string; sourceUrl: string | null;
  sourceLabel: string | null; observedAt: string | null; market: string; language: string;
  provenance: "MANUAL"; collectedAt: string; updatedAt: string;
  reviewStatus: "UNREVIEWED" | "ACCEPTED" | "REJECTED";
  reviewedAt: string | null; reviewedBy: string | null; reviewNote: string | null;
  freshness: "MISSING" | "STALE" | "CURRENT"; freshnessReason: string;
  expiresAt: string | null; eligibleForStrategy: boolean;
  insight: ResearchInsight | null;
  insightIssue: string | null;
};
type Draft = {
  title: string; category: Category; temporalScope: TemporalScope; summary: string;
  sourceUrl: string; sourceLabel: string; observedAt: string; market: string; language: string;
  authorizedSource: boolean;
  insight: ResearchInsight | null;
};
const categories: Category[] = ["INDUSTRY", "AUDIENCE", "COMPETITOR", "SEARCH", "SEASONAL", "COMMUNITY"];
const scopes: TemporalScope[] = ["CURRENT", "HISTORICAL", "EVERGREEN", "EMERGING", "EXPIRED"];
const emptyDraft: Draft = { title: "", category: "INDUSTRY", temporalScope: "CURRENT", summary: "",
  sourceUrl: "", sourceLabel: "", observedAt: "", market: "", language: "", authorizedSource: false, insight: null };
function label(value: string) { return value[0] + value.slice(1).toLowerCase(); }
function dateLabel(value: string | null) { return value ? new Date(value).toLocaleString() : "Not supplied"; }
function currentEvidence(item: ResearchRecord, now: number): ResearchRecord {
  if (item.freshness === "CURRENT" && item.expiresAt && new Date(item.expiresAt).getTime() <= now) {
    return { ...item, freshness: "STALE", eligibleForStrategy: false,
      freshnessReason: "The 30-day observation window has ended. Reload or update the evidence before accepting it." };
  }
  return item;
}
function sourceLink(value: string | null) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}
function draftFrom(item: ResearchRecord): Draft {
  return { title: item.title, category: item.category, temporalScope: item.temporalScope,
    summary: item.summary, sourceUrl: item.sourceUrl || "", sourceLabel: item.sourceLabel || "",
    observedAt: localDate(item.observedAt), market: item.market, language: item.language, authorizedSource: false, insight: item.insight ?? null };
}

export default function ResearchWorkspace({ base, role, onDirtyChange }: {
  base: string; role: string; onDirtyChange: (dirty: boolean) => void;
}) {
  const [items, setItems] = useState<ResearchRecord[]>([]);
  const [selectedRecord, setSelected] = useState<ResearchRecord | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const [writeDenied, setWriteDenied] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const request = useRef(0);
  const selected = selectedRecord ? currentEvidence(selectedRecord, now) : null;
  const visibleItems = items.map((item) => currentEvidence(item, now));
  const canEdit = !writeDenied && ["OWNER", "ADMIN", "EDITOR", "CREATOR"].includes(role);
  const canReview = !writeDenied && ["OWNER", "ADMIN", "EDITOR"].includes(role);
  const draftDirty = !!draft && JSON.stringify(draft) !== JSON.stringify(creating || !selected ? emptyDraft : draftFrom(selected));
  const dirty = draftDirty || !!reviewNote || reviewAcknowledged;

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => {
    const refreshTime = () => setNow(Date.now());
    const timer = setInterval(refreshTime, 15000);
    window.addEventListener("focus", refreshTime);
    document.addEventListener("visibilitychange", refreshTime);
    return () => {
      clearInterval(timer); window.removeEventListener("focus", refreshTime);
      document.removeEventListener("visibilitychange", refreshTime);
    };
  }, []);

  function clearForms() {
    setDraft(null); setCreating(false); setConflict(false);
    setReviewNote(""); setReviewAcknowledged(false);
  }
  function fail(err: unknown) {
    const failure = err as Error & { status?: number };
    setReviewAcknowledged(false);
    if (failure.status === 409) {
      setConflict(true);
      setError("Another update changed this research record. Your edits are still shown. Discard edits and reload the current record before saving or reviewing again.");
    } else {
      if (failure.status === 403 || failure.status === 404) {
        setWriteDenied(true); clearForms();
        if (failure.status === 404) { setSelected(null); setItems([]); }
      }
      setError(failure.message);
    }
  }
  const load = useCallback(async (preferredId?: string) => {
    const sequence = ++request.current;
    setBusy(true); setError(""); setNotice(""); setSelected(null);
    setDraft(null); setCreating(false); setConflict(false); setReviewNote(""); setReviewAcknowledged(false);
    try {
      const list: { items: ResearchRecord[] } = await api(base + "/research");
      if (sequence !== request.current) return;
      setItems(list.items); setLoaded(true);
      const id = list.items.find((item) => item.id === preferredId)?.id || list.items[0]?.id;
      if (id) {
        const detail: ResearchRecord = await api(`${base}/research/${id}`);
        if (sequence !== request.current) return;
        setSelected(detail);
      }
    } catch (err) {
      if (sequence !== request.current) return;
      setItems([]); setLoaded(false); setError((err as Error).message);
    } finally { if (sequence === request.current) setBusy(false); }
  }, [base]);
  useEffect(() => {
    void load();
    return () => { request.current++; };
  }, [load]);

  function discardAllowed() { return !dirty || confirm("Discard unsaved research changes?"); }
  async function select(id: string) {
    if (busy || !discardAllowed()) return;
    const sequence = ++request.current;
    setBusy(true); setError(""); setNotice(""); setSelected(null); clearForms();
    try {
      const detail: ResearchRecord = await api(`${base}/research/${id}`);
      if (sequence === request.current) setSelected(detail);
    } catch (err) { if (sequence === request.current) fail(err); }
    finally { if (sequence === request.current) setBusy(false); }
  }
  function create() {
    if (!canEdit || busy || !discardAllowed()) return;
    request.current++; clearForms(); setCreating(true); setDraft({ ...emptyDraft });
    setError(""); setNotice("");
  }
  function edit(change: Partial<Draft>) {
    setDraft((current) => current ? { ...current, ...change,
      ...(change.category && change.category !== current.category ? { insight: null } : {}),
      ...(Object.keys(change).some((key) => key !== "authorizedSource") ? { authorizedSource: false } : {}) } : null);
    setNotice("");
  }
  function keepSaved(saved: ResearchRecord) {
    setSelected(saved);
    setItems((current) => [saved, ...current.filter((item) => item.id !== saved.id)].slice(0, 100));
    clearForms();
  }
  let validation = "";
  if (draft?.observedAt) {
    const observed = new Date(draft.observedAt).getTime();
    if (!Number.isFinite(observed) || observed > Date.now()) validation = "Observed time must be a valid time in the past.";
  }
  if (draft?.insight) {
    try { parseResearchInsight(draft.insight, draft.category); }
    catch { validation = "Complete all insight fields within their limits; structured insights must fit within 6,000 UTF-8 bytes."; }
  }
  const unchanged = !!draft && !creating && !!selected && JSON.stringify({ ...draft, authorizedSource: false }) === JSON.stringify(draftFrom(selected));
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || !canEdit || !draft.authorizedSource || validation || conflict || busy || unchanged) return;
    const sequence = ++request.current;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = { ...draft, sourceUrl: draft.sourceUrl.trim() || null,
        sourceLabel: draft.sourceLabel.trim() || null,
        observedAt: draft.observedAt ? new Date(draft.observedAt).toISOString() : null };
      const saved: ResearchRecord = creating
        ? await api(base + "/research", "POST", data)
        : await api(`${base}/research/${selected!.id}`, "PUT", { ...data, expectedRevision: selected!.revision });
      if (sequence !== request.current) return;
      keepSaved(saved);
      setNotice(`Research saved at revision ${saved.revision}. Review is required before this evidence can be accepted.`);
    } catch (err) { if (sequence === request.current) fail(err); }
    finally { if (sequence === request.current) setBusy(false); }
  }
  async function review(decision: "ACCEPTED" | "REJECTED") {
    if (!selected || !canReview || !reviewAcknowledged || !reviewNote.trim() || draft || busy || conflict) return;
    const sequence = ++request.current;
    setBusy(true); setError(""); setNotice("");
    try {
      const saved: ResearchRecord = await api(`${base}/research/${selected.id}/review`, "POST", {
        expectedRevision: selected.revision, decision, note: reviewNote, sourcesReviewed: true,
      });
      if (sequence !== request.current) return;
      keepSaved(saved); setNotice(`Review saved: ${label(saved.reviewStatus).toLowerCase()} at revision ${saved.revision}.`);
    } catch (err) { if (sequence === request.current) fail(err); }
    finally { if (sequence === request.current) setBusy(false); }
  }

  return <div className="research-workspace" aria-busy={busy}>
    <div className="page-heading">
      <div><span className="eyebrow muted">SOURCE-BACKED KNOWLEDGE</span><h1>Research</h1>
        <p>Collect source references, record what you observed, and review the evidence with your team.</p></div>
      {canEdit && <button className="button primary" onClick={create} disabled={busy}><Plus size={16} />Add research</button>}
    </div>
    <div className="research-intro"><BookOpen size={20} aria-hidden="true" /><p>Manual evidence intake. Sources and observation times are entered by your team; links are not fetched or independently verified. New strategies can use up to 10 current, accepted observations. Changed or expired evidence is excluded before generation.</p></div>
    {error && <div className="alert error" role="alert">{error}</div>}
    {notice && <div className="inline-notice" role="status">{notice}</div>}
    <div className="research-toolbar">
      <p>{loaded ? `${items.length} saved ${items.length === 1 ? "record" : "records"} · Latest 100 shown` : "Workspace research"}</p>
      <button className="button" disabled={busy} onClick={() => void load(selected?.id)}>
        {dirty || conflict ? "Discard edits and reload" : "Reload research"}
      </button>
    </div>
    {busy && <p role="status">Loading research…</p>}
    <div className="research-layout">
      <section className="panel research-list" aria-label="Research records">
        <h2>Evidence library</h2>
        {loaded && !items.length && <div className="research-empty"><BookOpen size={26} aria-hidden="true" /><h3>No research yet</h3><p>Add an observation with an authorized source. Missing sources or dates stay visible as incomplete evidence.</p></div>}
        {visibleItems.length > 0 && <ul>{visibleItems.map((item) => <li key={item.id}>
          <button disabled={busy} aria-pressed={selected?.id === item.id && !creating}
            className="research-record" onClick={() => void select(item.id)}>
            <span className="research-record-category">{label(item.category)} · {label(item.temporalScope)}</span>
            <strong>{item.title}</strong>
            <span className="research-record-status">{label(item.reviewStatus)} · {label(item.freshness)} evidence</span>
          </button>
        </li>)}</ul>}
      </section>
      <section className="panel research-detail" aria-label="Research detail">
        {draft && canEdit ? <form onSubmit={(event) => void save(event)}>
          <div className="research-section-heading"><h2>{creating ? "Add research" : "Edit research"}</h2>
            <button className="button" type="button" disabled={busy} onClick={() => { if (discardAllowed()) { clearForms(); setConflict(conflict); } }}>Cancel editing</button></div>
          <p>Save one observation and one source reference. Editing a record clears its previous review.</p>
          <fieldset disabled={busy || conflict} className="research-fields"><legend className="sr-only">Research information</legend>
            <label>Research title<input required maxLength={160} value={draft.title} onChange={(event) => edit({ title: event.target.value })} /></label>
            <div className="form-grid"><label>Research category<select value={draft.category} onChange={(event) => edit({ category: event.target.value as Category })}>
              {categories.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
              <label>Topic time scope<select value={draft.temporalScope} onChange={(event) => edit({ temporalScope: event.target.value as TemporalScope })}>
                {scopes.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label></div>
            <label>Observation summary<textarea required maxLength={5000} rows={5} value={draft.summary} onChange={(event) => edit({ summary: event.target.value })} /></label>
            <label>Source URL<input type="url" maxLength={2048} value={draft.sourceUrl} placeholder="https://…" onChange={(event) => edit({ sourceUrl: event.target.value })} /></label>
            <label>Source label<input maxLength={200} value={draft.sourceLabel} placeholder="Publisher, report or page name" onChange={(event) => edit({ sourceLabel: event.target.value })} /></label>
            <label>Observed at (your local time)<input type="datetime-local" step={1} value={draft.observedAt} onChange={(event) => edit({ observedAt: event.target.value })} />
              <small>When you observed this evidence. The server separately records when it was collected.</small></label>
            <div className="form-grid"><label>Market<input maxLength={100} value={draft.market} onChange={(event) => edit({ market: event.target.value })} /></label>
              <label>Language<input maxLength={80} value={draft.language} onChange={(event) => edit({ language: event.target.value })} /></label></div>
            <p className="small-copy">A source URL, source label and observed time are required for acceptance. Evidence needs a fresh observation after 30 days; historical records remain historical context.</p>
            <ResearchInsightEditor category={draft.category} value={draft.insight} onChange={insight => edit({ insight })} />
            {validation && <p className="alert error" role="alert">{validation}</p>}
            <label className="review-ack"><input type="checkbox" checked={draft.authorizedSource} onChange={(event) => edit({ authorizedSource: event.target.checked })} />I am authorized to record this information and source.</label>
            <button className="button primary" type="submit" disabled={!draft.authorizedSource || !!validation || unchanged}>Save research</button>
          </fieldset>
        </form> : selected && !creating ? <>
          <div className="research-section-heading"><div><span className="eyebrow muted">{label(selected.category)} · Revision {selected.revision}</span><h2>{selected.title}</h2></div>
            {canEdit && <button className="button" disabled={busy || conflict} onClick={() => {
              if (!discardAllowed()) return;
              clearForms(); setDraft(draftFrom(selected)); setError(""); setNotice("");
            }}>Edit research</button>}</div>
          <div className="tag-row"><span className="pill">Review: {label(selected.reviewStatus)}</span><span className="pill">Evidence: {label(selected.freshness)}</span><span className="pill">{label(selected.temporalScope)}</span></div>
          <p className="research-summary">{selected.summary}</p>
          <ResearchInsightView value={selected.insight} category={selected.category} />
          {selected.insightIssue && <p role="alert" className="alert error">{selected.insightIssue}</p>}
          <div className="research-evidence-state" role="note"><strong>{selected.eligibleForStrategy ? "Evidence accepted and current" : selected.temporalScope === "HISTORICAL" ? "Historical context only" : "Evidence needs review or refresh"}</strong>
            <p>{selected.freshnessReason}</p><p>Acceptance records a team review and does not establish source accuracy. Eligible observations can be selected for a new strategy; previously queued jobs keep their captured versions.</p></div>
          <dl className="research-facts">
            <div><dt>Provenance</dt><dd>Manual · operator-entered source</dd></div>
            <div><dt>Source reference</dt><dd>{sourceLink(selected.sourceUrl) ? <a href={sourceLink(selected.sourceUrl)!} target="_blank" rel="noopener noreferrer">{selected.sourceLabel || selected.sourceUrl}<ExternalLink size={13} aria-label="opens in a new tab" /></a> : selected.sourceUrl ? "Source URL requires correction" : "No source URL supplied"}{selected.sourceLabel && !sourceLink(selected.sourceUrl) && <span>{selected.sourceLabel}</span>}</dd></div>
            <div><dt>Observed at · user declared</dt><dd>{dateLabel(selected.observedAt)}</dd></div>
            <div><dt>Collected at · server recorded</dt><dd>{dateLabel(selected.collectedAt)}</dd></div>
            <div><dt>Freshness window ends</dt><dd>{dateLabel(selected.expiresAt)}</dd></div>
            <div><dt>Market / language</dt><dd>{selected.market || "Market not supplied"} / {selected.language || "Language not supplied"}</dd></div>
          </dl>
          {selected.reviewedAt && <div className="research-review-receipt"><h3>Last review</h3><p>{label(selected.reviewStatus)} · {dateLabel(selected.reviewedAt)}</p><p className="research-summary">{selected.reviewNote}</p></div>}
          {canReview && <fieldset className="research-review research-fields" disabled={busy || conflict}>
            <legend>Review this evidence</legend>
            <p>Check the source, summary, observation time and any structured insight, including its assumptions and proposed differentiation. Acceptance requires complete evidence observed within the last 30 days and a topic that is not expired.</p>
            <label>Review note<textarea maxLength={2000} rows={3} value={reviewNote} onChange={(event) => { setReviewNote(event.target.value); setReviewAcknowledged(false); }} /></label>
            <label className="review-ack"><input type="checkbox" checked={reviewAcknowledged} onChange={(event) => setReviewAcknowledged(event.target.checked)} />I reviewed the source, observation time and summary for this record.</label>
            <div className="research-actions"><button className="button primary" disabled={!reviewAcknowledged || !reviewNote.trim() || selected.freshness !== "CURRENT" || selected.temporalScope === "EXPIRED" || !!selected.insightIssue} onClick={() => void review("ACCEPTED")}>Accept evidence</button>
              <button className="button" disabled={!reviewAcknowledged || !reviewNote.trim()} onClick={() => void review("REJECTED")}>Reject evidence</button></div>
          </fieldset>}
          {!canReview && <p className="small-copy">Owners, admins and editors can review evidence.</p>}
        </> : !busy && !draft && <div className="research-empty"><BookOpen size={28} aria-hidden="true" /><h2>Your research, with context</h2><p>Select a record to inspect its source, observation time and review status.</p></div>}
      </section>
    </div>
  </div>;
}
