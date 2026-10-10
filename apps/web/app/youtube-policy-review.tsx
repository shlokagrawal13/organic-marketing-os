"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api-client";

type Render = { id: string; contentRevision: number; status: string; approvedAt: string | null; hasOutput: boolean; createdAt: string };
type Intent = { id: string; contentRevision: number; renderId: string | null; status: string; createdAt: string; externallySubmitted: false };
type Channel = { id: string; provider: string; accountLabel: string; scopes: string[]; revokedAt: string | null; refreshPendingAt: string | null; tokenExpiresAt: string | null; refreshTokenExpiresAt: string | null };
type Preview = { intentId: string; snippet: { title: string; description: string }; policyVersion: string; externallySubmitted: false };
type Review = { id: string; connectionId: string; metadata: { snippet: { title: string; description: string }; status: { privacyStatus: string; selfDeclaredMadeForKids: boolean; containsSyntheticMedia: boolean } }; expiresAt: string; reviewedAt: string; policyVersion: string };
type Choice = "" | "yes" | "no";

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
      setIntents((i as Intent[]).filter((item) => item.contentRevision === revision && item.status === "PREPARED"));
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
    try {
      const nextPreview = await api(path + `/${saved.id}/youtube-policy-preview`);
      let nextReview: Review | null = null;
      try {
        nextReview = await api(path + `/${saved.id}/youtube-policy-review`);
      } catch (err) {
        if ((err as Error & { status?: number }).status !== 404) throw err;
      }
      setIntent(saved);
      setPreview(nextPreview);
      setReview(nextReview);
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
      setNotice("Policy review saved for this exact video, revision and channel. Nothing was posted.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const activeChannels = channels.filter((channel) => channel.provider === "YOUTUBE" && !channel.revokedAt && !channel.refreshPendingAt &&
    Boolean(channel.tokenExpiresAt && Date.parse(channel.tokenExpiresAt) > Date.now()) &&
    (!channel.refreshTokenExpiresAt || Date.parse(channel.refreshTokenExpiresAt) > Date.now()) &&
    channel.scopes.includes("https://www.googleapis.com/auth/youtube.upload"));
  const reviewExpired = Boolean(review && Date.parse(review.expiresAt) <= Date.now());
  return <section id="youtube-upload-review" className="panel policy-review" aria-label="YouTube publication review">
    <h3>YouTube upload review</h3>
    <p>Prepare the approved video and review its upload settings. This does not schedule or send a video to YouTube.</p>
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
      {intents.filter((row) => row.renderId === renderId).length > 0 && <div className="policy-saved">
        <h4>Existing preparations</h4>
        {intents.filter((row) => row.renderId === renderId).slice(0, 5).map((row) =>
          <button key={row.id} className="button" disabled={busy} onClick={() => void open(row)}>
            Open {new Date(row.createdAt).toLocaleString()} · {row.id.slice(0, 8)}
          </button>)}
      </div>}
      {intent && preview && <div className="policy-saved">
        <h4>Exact upload metadata</h4>
        <p>Preparation {intent.id.slice(0, 8)} · Rule {preview.policyVersion}</p>
        <label>Title<input readOnly value={preview.snippet.title} /></label>
        <label>Description<textarea readOnly rows={5} value={preview.snippet.description} /></label>
        {review ? <div className="alert" role="status">
          <b>{reviewExpired ? "Review expired" : "Review saved"}</b> for {channels.find((c) => c.id === review.connectionId)?.accountLabel || "selected channel"}.<br />
          Privacy: {review.metadata.status.privacyStatus}; made for kids: {review.metadata.status.selfDeclaredMadeForKids ? "yes" : "no"}; realistic synthetic media: {review.metadata.status.containsSyntheticMedia ? "yes" : "no"}.<br />
          {reviewExpired ? "Create a new preparation and review to continue." : `Expires ${new Date(review.expiresAt).toLocaleString()}.`} No video was posted.
        </div> : <>
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
          <button className="button primary" disabled={busy || !connectionId || !privacyStatus || !madeForKids || !syntheticMedia || !metadataAck || !audienceAck || !syntheticAck} onClick={() => void saveReview()}>Save policy review</button>
        </>}
      </div>}
    </>}
  </section>;
}
