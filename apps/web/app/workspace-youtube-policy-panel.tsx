"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api-client";

type Rules = {
  revision: string; platform: "YouTube"; format: "Video";
  titleMaxCharacters: number; descriptionMaxUtf8Bytes: number;
  allowedPrivacyStatuses: string[]; requireSyntheticMediaDeclaration: boolean;
};
type Policy = { revision: number; rules: Rules; deploymentRules: Rules;
  needsReview: boolean; updatedAt: string | null };
type Draft = { title: string; description: string; visibility: string[]; synthetic: boolean };
const visibilityOptions = ["private", "unlisted", "public"];
function draftFrom(policy: Policy): Draft {
  const rules = policy.needsReview ? policy.deploymentRules : policy.rules;
  return { title: String(rules.titleMaxCharacters), description: String(rules.descriptionMaxUtf8Bytes),
    visibility: [...rules.allowedPrivacyStatuses].sort(), synthetic: rules.requireSyntheticMediaDeclaration };
}

export default function WorkspaceYoutubePolicyPanel({ base, role, onDirtyChange }: {
  base: string; role: string; onDirtyChange?: (dirty: boolean) => void;
}) {
  const canManage = ["OWNER", "ADMIN"].includes(role);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const request = useRef(0);

  const load = useCallback(async () => {
    if (!canManage) return;
    const sequence = ++request.current;
    setBusy(true); setError(""); setNotice(""); setAcknowledged(false); setPolicy(null);
    try {
      const current: Policy = await api(base + "/youtube-policy");
      if (sequence !== request.current) return;
      setPolicy(current); setDraft(draftFrom(current)); setConflict(false);
    } catch (err) {
      if (sequence === request.current) setError((err as Error).message);
    } finally { if (sequence === request.current) setBusy(false); }
  }, [base, canManage]);
  useEffect(() => {
    void load();
    return () => { request.current++; };
  }, [load]);

  const dirty = !!policy && !!draft && (policy.needsReview ||
    JSON.stringify(draft) !== JSON.stringify(draftFrom(policy)));
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);
  if (!canManage) return null;
  let validation = "";
  if (policy && draft) {
    const title = Number(draft.title), description = Number(draft.description);
    if (!Number.isInteger(title) || title < 1 || title > policy.deploymentRules.titleMaxCharacters)
      validation = `Title limit must be a whole number from 1 to ${policy.deploymentRules.titleMaxCharacters}.`;
    else if (!Number.isInteger(description) || description < 1 || description > policy.deploymentRules.descriptionMaxUtf8Bytes)
      validation = `Description limit must be a whole number from 1 to ${policy.deploymentRules.descriptionMaxUtf8Bytes}.`;
    else if (!draft.visibility.length) validation = "Allow at least one visibility option.";
  }
  function edit(change: Partial<Draft>) {
    setDraft((current) => current ? { ...current, ...change } : null);
    setAcknowledged(false); setNotice("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!policy || !draft || !dirty || !acknowledged || validation || conflict || busy) return;
    const sequence = ++request.current;
    setBusy(true); setError(""); setNotice("");
    const baseline = policy.needsReview ? policy.deploymentRules : policy.rules;
    try {
      const saved: Policy = await api(base + "/youtube-policy", "PUT", {
        expectedRevision: policy.revision,
        rules: { ...baseline, titleMaxCharacters: Number(draft.title),
          descriptionMaxUtf8Bytes: Number(draft.description),
          allowedPrivacyStatuses: draft.visibility, requireSyntheticMediaDeclaration: draft.synthetic },
      });
      if (sequence !== request.current) return;
      setPolicy(saved); setDraft(draftFrom(saved)); setAcknowledged(false);
      setNotice(`Policy saved at revision ${saved.revision}. Existing upload reviews must be renewed before new sends.`);
    } catch (err) {
      if (sequence !== request.current) return;
      const failure = err as Error & { status?: number };
      setAcknowledged(false);
      if (failure.status === 409) {
        setConflict(true);
        setError("Another update changed this policy. Your edits are still shown. Discard edits and reload the current rules, then review your changes again.");
      } else {
        if (failure.status === 403 || failure.status === 404) setPolicy(null);
        setError(failure.message);
      }
    } finally { if (sequence === request.current) setBusy(false); }
  }

  return <section className="panel workspace-youtube-policy" aria-label="Workspace YouTube policy" aria-busy={busy}>
    <div className="social-panel-heading">
      <div><h2>YouTube upload rules</h2><p>Set workspace limits within the deployment bounds. Owners and admins can update these rules.</p></div>
      <button className="button" disabled={busy} onClick={() => void load()}>
        {dirty || conflict ? "Discard edits and reload" : "Reload rules"}
      </button>
    </div>
    {error && <div className="alert error" role="alert">{error}</div>}
    {notice && <div className="inline-notice" role="status">{notice}</div>}
    {busy && !policy && <p role="status">Loading YouTube upload rules…</p>}
    {policy && draft && <form onSubmit={(event) => void save(event)}>
      <p>{policy.revision === 0 ? "Using deployment defaults · revision 0" : `Saved revision ${policy.revision}`}</p>
      {policy.needsReview && <div className="alert" role="status">Saved rules need review against the deployment bounds. Deployment defaults are shown below; check them before saving.</div>}
      <p>Changing these rules requires new reviews for affected uploads and schedules. Uploads already handed off may continue.</p>
      <fieldset className="youtube-policy-fields" disabled={busy}>
        <legend>Metadata and declarations</legend>
        <div className="form-grid">
          <label>Title length limit
            <input type="number" min={1} max={policy.deploymentRules.titleMaxCharacters} step={1} required
              value={draft.title} onChange={(event) => edit({ title: event.target.value })} />
            <small>Deployment maximum: {policy.deploymentRules.titleMaxCharacters}.</small>
          </label>
          <label>Description size limit (UTF-8 bytes)
            <input type="number" min={1} max={policy.deploymentRules.descriptionMaxUtf8Bytes} step={1} required
              value={draft.description} onChange={(event) => edit({ description: event.target.value })} />
            <small>Deployment maximum: {policy.deploymentRules.descriptionMaxUtf8Bytes}. Some characters use multiple bytes.</small>
          </label>
        </div>
        <fieldset className="youtube-policy-visibility"><legend>Allowed visibility</legend>
          {visibilityOptions.map((status) => <label className="review-ack" key={status}>
            <input type="checkbox" checked={draft.visibility.includes(status)}
              disabled={!policy.deploymentRules.allowedPrivacyStatuses.includes(status)}
              onChange={(event) => edit({ visibility: event.target.checked
                ? [...draft.visibility, status].sort() : draft.visibility.filter((item) => item !== status) })} />
            {status[0].toUpperCase() + status.slice(1)}
            {!policy.deploymentRules.allowedPrivacyStatuses.includes(status) && " (unavailable in this deployment)"}
          </label>)}
        </fieldset>
        <label className="review-ack"><input type="checkbox" checked={draft.synthetic}
          disabled={policy.deploymentRules.requireSyntheticMediaDeclaration}
          onChange={(event) => edit({ synthetic: event.target.checked })} />
          Only allow uploads declared as realistic synthetic or altered media
        </label>
        <p>Declarations must stay accurate. When enabled, videos without that declaration cannot proceed.
          {policy.deploymentRules.requireSyntheticMediaDeclaration && " This restriction is required by the deployment."}</p>
        {validation && <p className="alert error" role="alert">{validation}</p>}
        <label className="review-ack"><input type="checkbox" checked={acknowledged} disabled={!dirty || !!validation || conflict}
          onChange={(event) => setAcknowledged(event.target.checked)} />
          I reviewed these rules and understand existing upload reviews and scheduled posts may need review again.
        </label>
        <button className="button primary" type="submit" disabled={!dirty || !acknowledged || !!validation || conflict}>Save upload rules</button>
      </fieldset>
    </form>}
  </section>;
}
