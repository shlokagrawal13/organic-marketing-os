"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api-client";

type Render = { id: string; contentRevision: number; status: string; approvedAt: string | null; hasOutput: boolean; createdAt: string };
type Intent = { id: string; contentRevision: number; renderId: string | null; status: string; createdAt: string; externallySubmitted: false };
type Channel = { id: string; provider: string; accountLabel: string; externalAccountId: string; scopes: string[]; revokedAt: string | null; refreshPendingAt: string | null; tokenExpiresAt: string | null; refreshTokenExpiresAt: string | null };
type Preview = { intentId: string; snippet: { title: string; description: string }; policyVersion: string; externallySubmitted: false };
type Review = { id: string; connectionId: string; metadata: { snippet: { title: string; description: string }; status: { privacyStatus: string; selfDeclaredMadeForKids: boolean; containsSyntheticMedia: boolean } }; expiresAt: string; reviewedAt: string; policyVersion: string };
type Choice = "" | "yes" | "no";
type Attempt = { id: string; status: string; outcomeCode: string | null; providerPostId: string | null; canCheckStatus: boolean; createdAt: string; completedAt: string | null };
type Schedule = { id: string; status: string; dueAt: string; outcomeCode: string | null; attemptId: string | null; completedAt: string | null };

export default function YoutubePolicyReview({ base, contentId, revision, onNavigate }: {
  base: string; contentId: string; revision: number; onNavigate: (view: string) => void;
}) {
  const [renders, setRenders] = useState<Render[]>([]);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [renderId, setRenderId] = useState("");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [canSchedule, setCanSchedule] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [schedulePhrase, setSchedulePhrase] = useState("");
  const [scheduleAck, setScheduleAck] = useState(false);
  const [canPublish, setCanPublish] = useState(false);
  const [canReconcile, setCanReconcile] = useState(false);
  const [publishPhrase, setPublishPhrase] = useState("");
  const [publishAck, setPublishAck] = useState(false);
  const [connectionId, setConnectionId] = useState("");
  const [privacyStatus, setPrivacyStatus] = useState("");
  const [madeForKids, setMadeForKids] = useState<Choice>("");
  const [syntheticMedia, setSyntheticMedia] = useState<Choice>("");
  const [metadataAck, setMetadataAck] = useState(false);
  const [audienceAck, setAudienceAck] = useState(false);
  const [syntheticAck, setSyntheticAck] = useState(false);
  const [rightsAck, setRightsAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const path = base + "/publication-intents";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, i, c] = await Promise.all([
        api(base + `/renders?contentId=${contentId}`),
        api(base + `/publication-intents?contentId=${contentId}`),
        api(base + "/social-connections"),
      ]);
      const eligible = (r as Render[]).filter((item) => item.contentRevision === revision && item.status === "SUCCEEDED" && item.approvedAt && item.hasOutput);
      setRenders(eligible);
      setRenderId((old) => eligible.some((item) => item.id === old) ? old : eligible[0]?.id || "");
      setIntents(i as Intent[]);
      setChannels(c);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [base, contentId, revision]);
  useEffect(() => { void load(); }, [load]);

  async function open(saved: Intent) {
    setBusy(true);
    setError("");
    setNotice("");
    setIntent(null);
    setPreview(null);
    setReview(null);
    setAttempt(null);
    setSchedule(null);
    setCanSchedule(false);
    setCanPublish(false);
    setCanReconcile(false);
    setPublishPhrase("");
    setPublishAck(false);
    try {
      const [state, scheduleState] = await Promise.all([
        api(path + `/${saved.id}/youtube-attempt`),
        api(path + `/${saved.id}/youtube-schedule`),
      ]);
      let nextPreview: Preview | null = null;
      if (saved.contentRevision === revision && saved.status === "PREPARED") {
        try { nextPreview = await api(path + `/${saved.id}/youtube-policy-preview`); }
        catch { setNotice("This preparation is no longer eligible for a new upload. Its saved attempt status is still shown below."); }
      }
      let nextReview: Review | null = null;
      try {
        nextReview = await api(path + `/${saved.id}/youtube-policy-review`);
      } catch (err) {
        if ((err as Error & { status?: number }).status !== 404) throw err;
      }
      setIntent(saved);
      setPreview(nextPreview);
      setReview(nextReview);
      setAttempt(state.attempt);
      setSchedule(scheduleState.schedule);
      setCanSchedule(scheduleState.canSchedule);
      setCanPublish(state.canPublish);
      setCanReconcile(state.canReconcile);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function prepare() {
    if (!renderId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved: Intent = await api(path, "POST", { contentId, revision, renderId, requestKey: crypto.randomUUID() });
      setIntents((rows) => [saved, ...rows]);
      const nextPreview = await api(path + `/${saved.id}/youtube-policy-preview`);
      setIntent(saved);
      setPreview(nextPreview);
      setReview(null);
      setAttempt(null);
      setSchedule(null);
      setCanSchedule(false);
      setScheduleTime("");
      setSchedulePhrase("");
      setScheduleAck(false);
      setCanPublish(false);
      setCanReconcile(false);
      setPublishPhrase("");
      setPublishAck(false);
      setConnectionId("");
      setPrivacyStatus("");
      setMadeForKids("");
      setSyntheticMedia("");
      setMetadataAck(false);
      setAudienceAck(false);
      setSyntheticAck(false);
      setRightsAck(false);
      setNotice("Preparation created for this approved revision and render. Nothing was posted.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveReview() {
    if (!intent || !preview || !connectionId || !privacyStatus || !madeForKids || !syntheticMedia || !metadataAck || !audienceAck || !syntheticAck || !rightsAck) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved: Review = await api(path + `/${intent.id}/youtube-policy-review`, "POST", {
        connectionId, privacyStatus,
        selfDeclaredMadeForKids: madeForKids === "yes",
        containsSyntheticMedia: syntheticMedia === "yes",
        metadataReviewed: true, audienceReviewed: true, syntheticMediaReviewed: true,
        rightsAndPlatformRulesReviewed: true,
      });
      setReview(saved);
      const state = await api(path + `/${intent.id}/youtube-attempt`);
      setAttempt(state.attempt);
      setCanPublish(state.canPublish);
      setCanReconcile(state.canReconcile);
      const scheduleState = await api(path + `/${intent.id}/youtube-schedule`);
      setSchedule(scheduleState.schedule);
      setCanSchedule(scheduleState.canSchedule);
      setNotice("Policy review saved for this exact video, revision and channel. Nothing was posted.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshAttempt() {
    if (!intent) return;
    setBusy(true); setError("");
    try {
      const [state, scheduleState] = await Promise.all([
        api(path + `/${intent.id}/youtube-attempt`),
        api(path + `/${intent.id}/youtube-schedule`),
      ]);
      setAttempt(state.attempt);
      setCanPublish(state.canPublish);
      setCanReconcile(state.canReconcile);
      setSchedule(scheduleState.schedule);
      setCanSchedule(scheduleState.canSchedule);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  async function publish() {
    if (!intent || !review || !canPublish || attempt || reviewExpired ||
      schedule?.status === "SCHEDULED" || schedule?.status === "CLAIMED" ||
      publishPhrase !== "PUBLISH TO YOUTUBE" || !publishAck) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const saved: Attempt = await api(path + `/${intent.id}/youtube-dispatch`, "POST", {
        connectionId: review.connectionId, requestKey: crypto.randomUUID(),
        confirmation: "PUBLISH_TO_YOUTUBE",
      });
      setAttempt(saved);
      if (saved.status === "UNKNOWN" && saved.canCheckStatus) setCanReconcile(true);
      setNotice(saved.status === "CONFIRMED" ? "YouTube confirmed this upload." :
        "Upload outcome needs review. Do not submit another video.");
    } catch (err) {
      setError((err as Error).message);
      // A lost response may follow a successful external send. Read the ledger;
      // never replay a media POST automatically from the client.
      try {
        const state = await api(path + `/${intent.id}/youtube-attempt`);
        setAttempt(state.attempt);
        setCanPublish(state.canPublish);
        setCanReconcile(state.canReconcile);
      } catch {}
    } finally { setBusy(false); setPublishPhrase(""); setPublishAck(false); }
  }

  async function createSchedule() {
    if (!intent || !review || !canSchedule || attempt || schedule || reviewExpired ||
        schedulePhrase !== "SCHEDULE YOUTUBE UPLOAD" || !scheduleAck || !scheduleTime) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const when = new Date(scheduleTime);
      if (!Number.isFinite(when.getTime())) throw new Error("Choose a valid future time.");
      const saved: Schedule = await api(path + `/${intent.id}/youtube-schedule`, "POST", {
        connectionId: review.connectionId, requestKey: crypto.randomUUID(),
        scheduledAt: when.toISOString(), confirmation: "SCHEDULE_YOUTUBE_UPLOAD",
      });
      setSchedule(saved);
      setNotice("Schedule saved for this reviewed video. No upload has started.");
    } catch (err) {
      setError((err as Error).message);
      try {
        const state = await api(path + `/${intent.id}/youtube-schedule`);
        setSchedule(state.schedule);
      } catch {}
    } finally { setBusy(false); setSchedulePhrase(""); setScheduleAck(false); }
  }

  async function cancelSchedule() {
    if (!intent || schedule?.status !== "SCHEDULED") return;
    setBusy(true); setError(""); setNotice("");
    try {
      const saved: Schedule = await api(path + `/${intent.id}/youtube-schedule/cancel`, "POST");
      setSchedule(saved);
      setNotice("Future upload canceled. No upload was started by this schedule.");
    } catch (err) {
      setError((err as Error).message);
      try { setSchedule((await api(path + `/${intent.id}/youtube-schedule`)).schedule); } catch {}
    } finally { setBusy(false); }
  }

  async function checkStatus() {
    if (!intent || !attempt?.canCheckStatus || !canReconcile) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const state = await api(path + `/${intent.id}/youtube-attempt/${attempt.id}/check-status`, "POST");
      setAttempt(state.attempt);
      setNotice(state.attempt?.status === "CONFIRMED" ? "YouTube confirmed this upload." :
        "The upload is still uncertain. Do not submit another video.");
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  const activeChannels = channels.filter((channel) => channel.provider === "YOUTUBE" && !channel.revokedAt && !channel.refreshPendingAt &&
    Boolean(channel.tokenExpiresAt && Date.parse(channel.tokenExpiresAt) > Date.now()) &&
    (!channel.refreshTokenExpiresAt || Date.parse(channel.refreshTokenExpiresAt) > Date.now()) &&
    channel.scopes.includes("https://www.googleapis.com/auth/youtube.upload"));
  const reviewExpired = Boolean(review && Date.parse(review.expiresAt) <= Date.now());
  return <section id="youtube-upload-review" className="panel policy-review" aria-label="YouTube publication review">
    <h3>YouTube upload review</h3>
    <p>Prepare the approved video and review its upload settings. Sending requires a separate explicit confirmation when live posting is enabled.</p>
    {error && <div className="alert error" role="alert">{error}</div>}
    {notice && <div className="inline-notice" role="status">{notice}</div>}
    {loading ? <p>Loading approved renders and channels…</p> : <>
      <label>Approved render for revision {revision}
        <select value={renderId} onChange={(event) => { setRenderId(event.target.value); setIntent(null); setPreview(null); setReview(null); }}>
          {renders.length === 0 && <option value="">No approved render available</option>}
          {renders.map((item) => <option key={item.id} value={item.id}>{new Date(item.createdAt).toLocaleString()} · {item.id.slice(0, 8)}</option>)}
        </select>
      </label>
      {renders.length === 0 && <p>Finish and approve a video render of this exact content revision first.</p>}
      <button className="button" disabled={busy || !renderId} onClick={() => void prepare()}>Create new upload preparation</button>
      {intents.length > 0 && <div className="policy-saved">
        <h4>Existing and historical preparations</h4>
        {intents.slice(0, 50).map((row) =>
          <button key={row.id} className="button" disabled={busy} onClick={() => void open(row)}>
            Open {new Date(row.createdAt).toLocaleString()} · revision {row.contentRevision} · {row.status} · {row.id.slice(0, 8)}
          </button>)}
      </div>}
      {intent && (preview || review || attempt || schedule) && <div className="policy-saved">
        <h4>Exact upload metadata</h4>
        <p>Preparation {intent.id.slice(0, 8)} · revision {intent.contentRevision} · {intent.status}</p>
        {preview ? <>
          <p>Rule {preview.policyVersion}</p>
          <label>Title<input readOnly value={preview.snippet.title} /></label>
          <label>Description<textarea readOnly rows={5} value={preview.snippet.description} /></label>
        </> : <p>This preparation is historical. Its current upload status remains available below; it cannot start a new upload.</p>}
        {review ? <div className="alert" role="status">
          <b>{reviewExpired ? "Review expired" : "Review saved"}</b> for {channels.find((c) => c.id === review.connectionId)?.accountLabel || "selected channel"}.<br />
          Privacy: {review.metadata.status.privacyStatus}; made for kids: {review.metadata.status.selfDeclaredMadeForKids ? "yes" : "no"}; realistic synthetic media: {review.metadata.status.containsSyntheticMedia ? "yes" : "no"}.<br />
          {reviewExpired ? "Create a new preparation and review to continue." : `Expires ${new Date(review.expiresAt).toLocaleString()}.`}
        </div> : preview ? <>
          <label>Channel
            <select value={connectionId} onChange={(event) => setConnectionId(event.target.value)}>
              <option value="">Select a connected channel</option>
              {activeChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.accountLabel}</option>)}
            </select>
          </label>
          {activeChannels.length === 0 && <p>No eligible channel is connected. <button className="text-button" onClick={() => onNavigate("integrations")}>Open Connections</button></p>}
          <label>Visibility
            <select value={privacyStatus} onChange={(event) => setPrivacyStatus(event.target.value)}>
              <option value="">Choose visibility</option><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option>
            </select>
          </label>
          <label>Is this video made for kids?
            <select value={madeForKids} onChange={(event) => setMadeForKids(event.target.value as Choice)}><option value="">Choose yes or no</option><option value="yes">Yes</option><option value="no">No</option></select>
          </label>
          <label>Does it contain realistic synthetic or altered media?
            <select value={syntheticMedia} onChange={(event) => setSyntheticMedia(event.target.value as Choice)}><option value="">Choose yes or no</option><option value="yes">Yes</option><option value="no">No</option></select>
          </label>
          <label className="review-ack"><input type="checkbox" checked={metadataAck} onChange={(e) => setMetadataAck(e.target.checked)} />I checked the exact title and description above.</label>
          <label className="review-ack"><input type="checkbox" checked={audienceAck} onChange={(e) => setAudienceAck(e.target.checked)} />I checked the child-audience declaration.</label>
          <label className="review-ack"><input type="checkbox" checked={syntheticAck} onChange={(e) => setSyntheticAck(e.target.checked)} />I checked the realistic synthetic-media declaration.</label>
          <label className="review-ack"><input type="checkbox" checked={rightsAck} onChange={(e) => setRightsAck(e.target.checked)} />I checked usage rights and current YouTube rules for this video.</label>
          <button className="button primary" disabled={busy || !connectionId || !privacyStatus || !madeForKids || !syntheticMedia || !metadataAck || !audienceAck || !syntheticAck || !rightsAck} onClick={() => void saveReview()}>Save policy review</button>
        </> : null}
        {review && <div className="policy-saved">
          <h4>Upload status</h4>
          {schedule && <div className="alert" role="status">
            <p>Scheduled upload: <b>{schedule.status.replaceAll("_", " ")}</b> · {new Date(schedule.dueAt).toLocaleString()}{schedule.outcomeCode ? ` · ${schedule.outcomeCode}` : ""}</p>
            {schedule.status === "CLAIMED" && <p>The scheduled send may be in progress. Do not start another upload.</p>}
            {schedule.status === "NEEDS_REVIEW" && <p>The due send is uncertain or blocked. Review the attempt and channel manually; it will not retry automatically.</p>}
            {schedule.status === "SCHEDULED" && <button className="button" disabled={busy} onClick={() => void cancelSchedule()}>Cancel future upload</button>}
            <button className="button" disabled={busy} onClick={() => void refreshAttempt()}>Refresh schedule and attempt</button>
          </div>}
          {attempt ? <>
            <p>Status: <b>{attempt.status}</b>{attempt.providerPostId ? ` · YouTube video ${attempt.providerPostId}` : ""}</p>
            {attempt.status === "UNKNOWN" && <p>The video may already exist. Do not create another upload attempt. {attempt.canCheckStatus ? "Check the saved upload session for a receipt." : "A manual channel review is needed."}</p>}
            {attempt.status === "SUBMITTING" && <p>An upload is in progress or interrupted. Refresh the status before taking any action.</p>}
            <button className="button" disabled={busy} onClick={() => void refreshAttempt()}>Refresh local status</button>
            {attempt.status === "UNKNOWN" && attempt.canCheckStatus && canReconcile &&
              <button className="button" disabled={busy} onClick={() => void checkStatus()}>Check saved YouTube session status</button>}
          </> : schedule ? <p>{schedule.status === "SCHEDULED" ? "The reviewed upload is queued for the selected time." : schedule.status === "CLAIMED" ? "The scheduled upload is being checked or sent. Refresh its status before taking further action." : "This preparation has a closed schedule. Prepare and review a new upload before scheduling again."}</p> : canPublish && preview && !reviewExpired ? <>
            <p>This sends the approved render to {channels.find((c) => c.id === review.connectionId)?.accountLabel || "the reviewed channel"} ({channels.find((c) => c.id === review.connectionId)?.externalAccountId || "channel unavailable"}) with the visibility and declarations shown above. YouTube publishing cannot be undone here.</p>
            <p className="youtube-upload-notice">By clicking &apos;upload,&apos; you certify that the content you are uploading complies with the YouTube Terms of Service (including the YouTube Community Guidelines) at <a className="youtube-terms-desktop" href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">https://www.youtube.com/t/terms</a><a className="youtube-terms-mobile" href="http://m.youtube.com/terms" target="_blank" rel="noreferrer">http://m.youtube.com/terms</a>. Please be sure not to violate others&apos; copyright or privacy rights.</p>
            <label>Type PUBLISH TO YOUTUBE to confirm
              <input value={publishPhrase} onChange={(event) => setPublishPhrase(event.target.value)} autoComplete="off" />
            </label>
            <label className="review-ack"><input type="checkbox" checked={publishAck} onChange={(event) => setPublishAck(event.target.checked)} />I approve sending this exact video to the reviewed channel now.</label>
            <button className="button primary" disabled={busy || publishPhrase !== "PUBLISH TO YOUTUBE" || !publishAck} onClick={() => void publish()}>Publish reviewed video to YouTube</button>
          </> : <p>Live YouTube posting is not available for this account or deployment. The policy review remains saved; no video was sent.</p>}
          {!attempt && !schedule && preview && !reviewExpired && canSchedule && <div className="policy-saved">
            <h4>Schedule this reviewed upload</h4>
            <p>The reviewed channel, visibility and declarations above will be used at the chosen time. The worker rechecks approval, authorization and current policy before sending. A canceled or uncertain schedule will not retry automatically.</p>
            <label>Local date and time (one minute to 24 hours ahead, before review and channel access expire)
              <input type="datetime-local" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} />
            </label>
            <p className="youtube-upload-notice">By scheduling this upload, you certify that this content complies with the YouTube Terms of Service (including the YouTube Community Guidelines) at <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">https://www.youtube.com/t/terms</a>, and does not violate others&apos; copyright or privacy rights.</p>
            <label>Type SCHEDULE YOUTUBE UPLOAD to confirm
              <input value={schedulePhrase} onChange={(event) => setSchedulePhrase(event.target.value)} autoComplete="off" />
            </label>
            <label className="review-ack"><input type="checkbox" checked={scheduleAck} onChange={(event) => setScheduleAck(event.target.checked)} />I approve sending this exact video to the reviewed channel at the chosen time.</label>
            <button className="button primary" disabled={busy || !scheduleTime || schedulePhrase !== "SCHEDULE YOUTUBE UPLOAD" || !scheduleAck} onClick={() => void createSchedule()}>Schedule reviewed YouTube upload</button>
          </div>}
        </div>}
      </div>}
    </>}
  </section>;
}
