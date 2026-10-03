"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, RefreshCw, Download, CheckCircle2 } from "lucide-react";
import { api } from "./api-client";
type RecordData = Record<string, any>;
const stateLabels: Record<string, string> = {
  QUEUED: "Queued",
  SUBMITTING: "Sending to provider",
  PENDING: "Generating",
  OUTPUT_READY: "Checking media",
  SUCCEEDED: "Ready",
  CANCELED: "Canceled before submission",
  FAILED: "Failed — check cost review",
  UNKNOWN: "Outcome unknown — needs review",
};
const active = ["QUEUED", "SUBMITTING", "PENDING", "OUTPUT_READY"];
export default function GeneratedMediaPanel({
  base,
  role,
  onAssetsChanged,
}: {
  base: string;
  role: string;
  onAssetsChanged: () => Promise<void>;
}) {
  const [status, setStatus] = useState<RecordData | null>(null),
    [jobs, setJobs] = useState<RecordData[]>([]),
    [content, setContent] = useState<RecordData[]>([]),
    [images, setImages] = useState<RecordData[]>([]);
  const [kind, setKind] = useState("image"),
    [sourceAssetIds, setSourceAssetIds] = useState<string[]>([]),
    [imageSize, setImageSize] = useState("1024x1024"),
    [imageQuality, setImageQuality] = useState("medium"),
    [imageBackground, setImageBackground] = useState("opaque"),
    [voice, setVoice] = useState("alloy"),
    [voiceFormat, setVoiceFormat] = useState("wav"),
    [voiceSpeed, setVoiceSpeed] = useState(1),
    [prompt, setPrompt] = useState(""),
    [rightsNote, setRightsNote] = useState(""),
    [rights, setRights] = useState(false),
    [acceptedCost, setAcceptedCost] = useState(false);
  const [contentId, setContentId] = useState(""),
    [sceneId, setSceneId] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const mounted = useRef(true),
    lock = useRef(false),
    pending = useRef<{ payload: string; key: string } | null>(null),
    seenAssets = useRef(new Set<string>());
  const canWrite = ["OWNER", "ADMIN", "EDITOR", "CREATOR"].includes(role);
  const model = status?.models.find((m: RecordData) => m.kind === kind);
  const pricing = sourceAssetIds.length && kind === "image" ? model?.imageEdit : model;
  const selectedContent = content.find((c) => c.id === contentId);
  const load = useCallback(async () => {
    try {
      const [configuration, history, drafts, assets] = await Promise.all([
        api(`${base}/media-generations/status`),
        api(`${base}/media-generations?take=50`),
        api(`${base}/content?take=100`),
        api(`${base}/assets?kind=IMAGE&take=100`),
      ]);
      if (!mounted.current) return;
      setStatus(configuration);
      setJobs(history.items);
      setContent(drafts.items);
      setImages(assets.items);
      const newAssets = history.items.filter(
        (j: RecordData) => j.assetId && !seenAssets.current.has(j.assetId),
      );
      history.items.forEach((j: RecordData) => {
        if (j.assetId) seenAssets.current.add(j.assetId);
      });
      if (newAssets.length) await onAssetsChanged();
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    }
  }, [base, onAssetsChanged]);
  useEffect(() => {
    mounted.current = true;
    void load();
    const timer = setInterval(load, 4000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load]);
  useEffect(() => {
    setAcceptedCost(false);
  }, [
    kind,
    sourceAssetIds,
    pricing?.estimatedCostUsd,
    pricing?.credits,
    model?.model,
  ]);
  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || !model || !pricing || !rights || !acceptedCost) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const request = {
      kind,
      model: model.model,
      prompt,
      rightsConfirmed: true,
      rightsNote,
      maxCostUsd: pricing.estimatedCostUsd,
      ...(kind === "image"
        ? {
            options: {
              image: {
                size: imageSize,
                quality: imageQuality,
                background: imageBackground,
              },
            },
          }
        : kind === "voice"
          ? {
              options: {
                voice: {
                  voice,
                  responseFormat: voiceFormat,
                  speed: voiceSpeed,
                },
              },
            }
          : {}),
      ...(sourceAssetIds.length && kind === "image"
        ? { sourceAssetIds }
        : {}),
      ...(selectedContent && sceneId
        ? {
            target: {
              contentId,
              revision: selectedContent.revision,
              sceneId,
              component: kind === "voice" ? "narration" : "visual",
            },
          }
        : {}),
    };
    const payload = JSON.stringify({ request, maxCredits: pricing.credits });
    if (pending.current?.payload !== payload)
      pending.current = { payload, key: crypto.randomUUID() };
    try {
      await api(`${base}/media-generations`, "POST", {
        requestKey: pending.current.key,
        ...JSON.parse(payload),
      });
      pending.current = null;
      setNotice(
        "Generation queued. You can leave this page; progress is saved.",
      );
      setPrompt("");
      setAcceptedCost(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function act(job: RecordData, action: "cancel" | "attach") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api(
        `${base}/media-generations/${job.id}/${action}`,
        "POST",
        action === "attach" ? { revision: job.request.target.revision } : {},
      );
      setNotice(
        action === "attach"
          ? "Media attached to the saved scene. Review and approve the new draft revision."
          : result.state === "CANCELED"
            ? "Canceled before submission. Reserved credits were released."
            : "Cancellation requested. The provider may still finish and charge for this job.",
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section
      className="panel generated-panel"
      aria-labelledby="generated-media-heading"
    >
      <div className="section-top">
        <div>
          <p className="eyebrow">MAKE YOUR NEXT ASSET</p>
          <h2 id="generated-media-heading">Generate media</h2>
          <p className="muted">
            Create an image, short clip or AI voice, then review it in your
            private library.
          </p>
        </div>
        <button
          type="button"
          className="button"
          onClick={load}
          disabled={busy}
          aria-label="Refresh generations"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {error && (
        <div role="alert" className="alert error">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="alert success">
          {notice}
        </div>
      )}
      {!status ? (
        <p role="status">Loading generation settings…</p>
      ) : !status.models.length ? (
        <div className="alert">
          Media generation is not configured. Ask your administrator to enable a
          provider, model and price. You can still upload your own assets.
        </div>
      ) : (
        <>
          {(!status.workerOnline || !status.storageConfigured) && (
            <div className="alert">
              Generation is temporarily unavailable. Your administrator needs to
              check the media worker and private storage.
            </div>
          )}
          {canWrite ? (
            <form onSubmit={generate} className="generation-form">
              <div className="form-grid">
                <label>
                  Media to generate
                  <select
                    value={kind}
                    disabled={busy}
                    onChange={(e) => {
                      setKind(e.target.value);
                      setSourceAssetIds([]);
                    }}
                  >
                    <option
                      value="image"
                      disabled={
                        !status.models.some(
                          (m: RecordData) => m.kind === "image",
                        )
                      }
                    >
                      Image
                    </option>
                    <option
                      value="video"
                      disabled={
                        !status.models.some(
                          (m: RecordData) => m.kind === "video",
                        )
                      }
                    >
                      Video clip
                    </option>
                    <option
                      value="voice"
                      disabled={
                        !status.models.some(
                          (m: RecordData) => m.kind === "voice",
                        )
                      }
                    >
                      AI voice
                    </option>
                  </select>
                </label>
                <div className="generation-preset">
                  <span className="field-help">Provider preset</span>
                  <strong>
                    {model?.model || "Choose an available media type"}
                  </strong>
                  <span className="muted">
                    {kind === "image"
                      ? `One ${imageSize.replace("x", " × ")} PNG · ${imageQuality} quality · ${imageBackground} background`
                      : kind === "video"
                        ? "One 4-second portrait clip · 720 × 1280"
                        : `${voice} voice · ${voiceFormat.toUpperCase()} · ${voiceSpeed}× speed · label shared audio as AI-generated`}
                  </span>
                </div>
              </div>
              {kind === "image" && model?.options && (
                <div className="form-grid">
                  <label>
                    Image size
                    <select
                      value={imageSize}
                      onChange={(e) => setImageSize(e.target.value)}
                      disabled={busy}
                    >
                      {model.options.sizes.map((value: string) => (
                        <option key={value} value={value}>
                          {value.replace("x", " × ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Quality
                    <select
                      value={imageQuality}
                      onChange={(e) => setImageQuality(e.target.value)}
                      disabled={busy}
                    >
                      {model.options.qualities.map((value: string) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Background
                    <select
                      value={imageBackground}
                      onChange={(e) => setImageBackground(e.target.value)}
                      disabled={busy}
                    >
                      {model.options.backgrounds.map((value: string) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              {kind === "voice" && model?.options && (
                <div className="form-grid">
                  <label>
                    Voice
                    <select
                      value={voice}
                      onChange={(e) => setVoice(e.target.value)}
                      disabled={busy}
                    >
                      {model.options.voices.map((value: string) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Audio format
                    <select
                      value={voiceFormat}
                      onChange={(e) => setVoiceFormat(e.target.value)}
                      disabled={busy}
                    >
                      {model.options.responseFormats.map((value: string) => (
                        <option key={value} value={value}>
                          {value.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Speed ({voiceSpeed}×)
                    <input
                      type="range"
                      min={model.options.speed.min}
                      max={model.options.speed.max}
                      step={model.options.speed.step}
                      value={voiceSpeed}
                      onChange={(e) => setVoiceSpeed(Number(e.target.value))}
                      disabled={busy}
                    />
                  </label>
                </div>
              )}
              {kind === "image" && model?.imageEdit && (
                <label>
                  Reference images (optional, up to {model.imageEdit.maxSourceImages})
                  <select
                    multiple
                    value={sourceAssetIds}
                    size={Math.min(5, Math.max(2, images.length))}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions).map(
                        (option) => option.value,
                      );
                      setSourceAssetIds(
                        selected.slice(0, model.imageEdit.maxSourceImages),
                      );
                    }}
                    disabled={busy}
                  >
                    {images
                      .filter((asset) => asset.bytes <= 8 * 1024 * 1024)
                      .map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name}
                        </option>
                      ))}
                  </select>
                  <span className="field-help">
                    Select none for text-only generation. Reference order is
                    preserved in the provider request.
                  </span>
                </label>
              )}
              <label>
                {kind === "voice" ? "Narration text" : "Describe your media"}
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  required
                  maxLength={4000}
                  rows={4}
                  disabled={busy}
                  placeholder={
                    kind === "voice"
                      ? "Write the exact words to speak…"
                      : "Describe the subject, setting, style and composition…"
                  }
                />
              </label>
              <div className="form-grid">
                <label>
                  Target content (optional)
                  <select
                    value={contentId}
                    onChange={(e) => {
                      setContentId(e.target.value);
                      setSceneId("");
                    }}
                    disabled={busy}
                  >
                    <option value="">Save to asset library</option>
                    {content
                      .filter((c) => c.scenes?.length)
                      .map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.title}
                        </option>
                      ))}
                  </select>
                </label>
                {selectedContent && (
                  <label>
                    Target scene
                    <select
                      value={sceneId}
                      onChange={(e) => setSceneId(e.target.value)}
                      required
                      disabled={busy}
                    >
                      <option value="">Choose a scene</option>
                      {selectedContent.scenes.map(
                        (s: RecordData, i: number) => (
                          <option key={s.id} value={s.id}>
                            {i + 1}. {s.purpose || "Scene"}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                )}
              </div>
              {selectedContent && (
                <p className="field-help">
                  Targets revision {selectedContent.revision}. Only this scene’s{" "}
                  {kind === "voice" ? "narration" : "visual"} changes when you
                  choose Attach. Later edits are protected.
                </p>
              )}
              <label>
                Generation rights note
                <input
                  value={rightsNote}
                  onChange={(e) => setRightsNote(e.target.value)}
                  required
                  maxLength={1000}
                  disabled={busy}
                  placeholder="Record ownership, licenses and any required consent"
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={rights}
                  onChange={(e) => setRights(e.target.checked)}
                  disabled={busy}
                />
                I have the rights and consent needed for this generation.
              </label>
              {model && pricing && (
                <div className="generation-cost">
                  <strong>
                    Estimated provider cost: $
                    {pricing.estimatedCostUsd.toFixed(4)}
                  </strong>
                  <p>
                    {status.billingMode === "credits"
                      ? `${pricing.credits} credits reserved now; charged when validated media is delivered.`
                      : "Self-hosted: provider charges are billed to your configured provider account."}{" "}
                    USD estimates are set by your administrator and do not
                    enforce a provider spending cap.
                  </p>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={acceptedCost}
                      onChange={(e) => setAcceptedCost(e.target.checked)}
                      disabled={busy}
                    />
                    I accept this estimate and the credit charge shown above.
                  </label>
                  <p className="field-help">
                    An uncertain provider outcome keeps reserved credits under
                    review. Canceling after submission does not guarantee a
                    refund.
                  </p>
                </div>
              )}
              <div className="upload-action">
                <button
                  className="button primary"
                  disabled={
                    busy ||
                    !model ||
                    !pricing ||
                    !rights ||
                    !acceptedCost ||
                    !prompt.trim() ||
                    !rightsNote.trim() ||
                    !status.workerOnline ||
                    !status.storageConfigured
                  }
                >
                  <Sparkles size={17} />
                  {busy ? "Saving request…" : "Start generation"}
                </button>
                <span className="muted">
                  Review generated media before publishing.
                </span>
              </div>
            </form>
          ) : (
            <p className="muted">
              Your role can view generation history. A creator or editor can
              generate media.
            </p>
          )}
        </>
      )}
      <div className="generation-history">
        <h3>Recent generations</h3>
        {!jobs.length ? (
          <p className="muted">
            No generations yet. Your saved jobs will appear here.
          </p>
        ) : (
          jobs.map((job) => (
            <article
              key={job.id}
              className="generation-job"
              aria-label={`Generation: ${job.request.prompt}`}
            >
              <div className="section-top">
                <span className="pill">{job.request.kind}</span>
                <strong role="status">
                  {stateLabels[job.state] || job.state}
                </strong>
              </div>
              <p className="generation-prompt">{job.request.prompt}</p>
              <p className="field-help">
                {job.request.model} · {new Date(job.createdAt).toLocaleString()}{" "}
                · {job.quotedCredits} credits quoted · provider cost{" "}
                {job.actualCostUsd === null
                  ? "not reported"
                  : `$${job.actualCostUsd.toFixed(4)}`}
              </p>
              {job.error && <p className="alert">{job.error}</p>}
              {job.cancellationNotice && (
                <p className="field-help">{job.cancellationNotice}</p>
              )}
              {job.assetId && (
                <div className="generated-preview">
                  {job.request.kind === "image" ? (
                    <img
                      src={`/api${base}/assets/${job.assetId}/file`}
                      alt={`Generated image: ${job.request.prompt}`}
                      loading="lazy"
                    />
                  ) : job.request.kind === "video" ? (
                    <video
                      controls
                      preload="metadata"
                      aria-label="Generated video preview"
                      src={`/api${base}/assets/${job.assetId}/file`}
                    />
                  ) : (
                    <>
                      <p className="field-help">AI-generated voice</p>
                      <audio
                        controls
                        preload="metadata"
                        aria-label="Generated voice preview"
                        src={`/api${base}/assets/${job.assetId}/file`}
                      />
                    </>
                  )}
                </div>
              )}
              <div className="upload-action">
                {job.assetId && (
                  <a
                    className="button"
                    href={`/api${base}/assets/${job.assetId}/file?download=1`}
                  >
                    <Download size={16} />
                    Download generated media
                  </a>
                )}
                {canWrite &&
                  job.state === "SUCCEEDED" &&
                  job.request.target &&
                  !job.attachedRevision && (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => act(job, "attach")}
                    >
                      <CheckCircle2 size={16} />
                      Attach to saved scene
                    </button>
                  )}
                {job.attachedRevision && (
                  <span className="muted">
                    Attached at revision {job.attachedRevision}
                  </span>
                )}
                {canWrite &&
                  active.includes(job.state) &&
                  !job.cancellationRequestedAt && (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => act(job, "cancel")}
                    >
                      {job.state === "QUEUED"
                        ? "Cancel generation"
                        : "Request cancellation"}
                    </button>
                  )}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
