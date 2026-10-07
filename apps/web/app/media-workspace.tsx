"use client";
import { CompositionGuides } from "./render-composition";
import { RenderReview } from "./render-review";
import {
  CJK_LANGUAGES,
  CJK_LANGUAGE_LABELS,
  type CjkLanguage,
} from "../../../packages/core/render-cjk";
import {
  INSET_TEXT_PLACEMENT,
  textPlacementLabel,
} from "../../../packages/core/render-text-placement";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload,
  Film,
  Image as ImageIcon,
  Music2,
  Search,
  Archive,
  RotateCcw,
  Download,
  Play,
  CheckCircle2,
  RefreshCw,
  FolderOpen,
  X,
} from "lucide-react";
import { api, uploadAsset } from "./api-client";
import GeneratedMediaPanel from "./generated-media-panel";
import {
  RENDER_PRESETS,
  renderPreset,
  renderDimensions,
  type RenderPresetId,
} from "../../../packages/core/render-presets";
type Any = Record<string, any>;
const canWrite = (role: string) =>
  ["OWNER", "ADMIN", "EDITOR", "CREATOR"].includes(role);
const size = (n: number) =>
  n >= 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(n / 1024)} KB`;
const assetUrl = (base: string, id: string) => `/api${base}/assets/${id}/file`;
export default function MediaWorkspace({
  base,
  role,
  view,
  onNavigate,
}: {
  base: string;
  role: string;
  view: string;
  onNavigate: (v: string) => void;
}) {
  if (view === "assets") return <AssetLibrary base={base} role={role} />;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FROM STORYBOARD TO SCREEN</p>
          <h1>Video studio</h1>
          <p>Turn your own visuals and audio into a finished video.</p>
        </div>
        <button className="button" onClick={() => onNavigate("content")}>
          <FolderOpen size={17} />
          Open content library
        </button>
      </div>
      <RenderPanel base={base} role={role} />
    </>
  );
}
function AssetLibrary({ base, role }: { base: string; role: string }) {
  const [showGeneration, setShowGeneration] = useState(false);
  const [items, setItems] = useState<Any[]>([]),
    [total, setTotal] = useState(0),
    [status, setStatus] = useState<Any | null>(null),
    [query, setQuery] = useState(""),
    [kind, setKind] = useState(""),
    [archived, setArchived] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [rights, setRights] = useState(false),
    [progress, setProgress] = useState(0),
    [editing, setEditing] = useState<Any | null>(null);
  const fileRef = useRef<HTMLInputElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    try {
      const [data, s] = await Promise.all([
        api(
          `${base}/assets?take=100&archived=${archived}&q=${encodeURIComponent(query)}${kind ? `&kind=${kind}` : ""}`,
        ),
        api(base + "/assets/status"),
      ]);
      if (current === generation.current) {
        setItems(data.items);
        setTotal(data.total);
        setStatus(s);
      }
    } catch (e) {
      if (current === generation.current) setError((e as Error).message);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [base, query, kind, archived]);
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => {
      clearTimeout(timer);
      generation.current++;
    };
  }, [load]);
  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || !rights) return;
    const form = e.currentTarget,
      data = new FormData(form);
    data.set("file", file);
    data.set("rightsConfirmed", "true");
    setBusy(true);
    setError("");
    setNotice("");
    setProgress(0);
    try {
      const result = await uploadAsset(base + "/assets", data, setProgress);
      setNotice(
        result.deduplicated
          ? result.asset.archivedAt
            ? "This file is already archived. Switch to Archived and restore it to use it again."
            : "This file already exists. The existing asset was kept."
          : "Asset uploaded and checked.",
      );
      setFile(null);
      setRights(false);
      form.reset();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function update(id: string, data: Any) {
    setBusy(true);
    setError("");
    try {
      await api(`${base}/assets/${id}`, "PATCH", data);
      dialog.current?.close();
      setEditing(null);
      await load();
      setNotice(
        data.archived === true
          ? "Asset archived. Existing content and renders keep their files."
          : "Asset updated.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR BRAND, READY TO CREATE</p>
          <h1>Asset library</h1>
          <p>A private home for your images, video clips and audio.</p>
        </div>
        <button className="button" onClick={load} disabled={busy}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="alert success" role="status">
          {notice}
        </div>
      )}
      {status && !status.available && (
        <div className="alert">
          Media storage is unavailable. Start the storage service, then refresh
          this page.
        </div>
      )}
      <div className="upload-action media-mode" aria-label="Add media">
        <button
          className={"button" + (!showGeneration ? " primary" : "")}
          aria-pressed={!showGeneration}
          onClick={() => setShowGeneration(false)}
        >
          Upload media
        </button>
        <button
          className={"button" + (showGeneration ? " primary" : "")}
          aria-pressed={showGeneration}
          onClick={() => setShowGeneration(true)}
        >
          Generate with AI
        </button>
      </div>
      {showGeneration && (
        <GeneratedMediaPanel base={base} role={role} onAssetsChanged={load} />
      )}
      {canWrite(role) && !showGeneration && (
        <form className="panel asset-upload" onSubmit={upload}>
          <div className="upload-intro">
            <div className="empty-icon">
              <Upload size={25} />
            </div>
            <h2>Bring your own assets</h2>
            <p>
              JPEG, PNG, WebP, H.264 MP4, MP3 or WAV. Up to 25 MB each;
              audio/video up to 180 seconds.
            </p>
          </div>
          <div className="upload-fields">
            <label>
              Choose media
              <input
                ref={fileRef}
                type="file"
                name="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,audio/mpeg,audio/wav,.wav"
                disabled={busy}
                onChange={(e) => {
                  const next = e.target.files?.[0] || null;
                  setError("");
                  if (next && next.size > 25 * 1024 * 1024) {
                    setError("Choose a file smaller than 25 MB.");
                    e.target.value = "";
                    setFile(null);
                  } else setFile(next);
                }}
              />
            </label>
            <div className="form-grid">
              <label>
                Tags
                <input
                  name="tags"
                  placeholder="product, launch, brand"
                  maxLength={400}
                />
              </label>
              <label>
                Source / rights note
                <input
                  name="rightsNote"
                  placeholder="Own photography, licensed music…"
                  maxLength={1000}
                />
              </label>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={rights}
                onChange={(e) => setRights(e.target.checked)}
              />
              I have permission to use this media.
            </label>
            <div className="upload-action">
              <button
                className="button primary"
                disabled={busy || !file || !rights || !status?.available}
              >
                <Upload size={17} />
                {busy
                  ? progress === 100
                    ? "Checking file…"
                    : `Uploading ${progress}%`
                  : "Upload asset"}
              </button>
              <span className="muted">
                {file
                  ? `${file.name} · ${size(file.size)}`
                  : "Files stay private to this workspace."}
              </span>
            </div>
            {busy && (
              <progress
                aria-label="Upload progress"
                value={progress}
                max={100}
              />
            )}
          </div>
        </form>
      )}
      <section className="media-library">
        <div className="library-toolbar media-toolbar">
          <label className="search-box">
            <Search size={17} />
            <input
              aria-label="Search assets"
              placeholder="Search name or exact tag"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">Asset type</span>
            <select
              aria-label="Asset type"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="">All media</option>
              <option value="IMAGE">Images</option>
              <option value="VIDEO">Videos</option>
              <option value="AUDIO">Audio</option>
            </select>
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            Archived
          </label>
          <span className="muted">
            {items.length} shown · {total} total
          </span>
        </div>
        {loading ? (
          <p className="page-loading" role="status">
            Loading assets…
          </p>
        ) : items.length ? (
          <div className="asset-grid">
            {items.map((asset) => (
              <article className="asset-card" key={asset.id}>
                <div
                  className={`asset-preview asset-${asset.kind.toLowerCase()}`}
                >
                  {asset.kind === "IMAGE" ? (
                    <img
                      src={assetUrl(base, asset.id)}
                      alt={asset.name}
                      loading="lazy"
                    />
                  ) : asset.kind === "VIDEO" ? (
                    <video
                      src={assetUrl(base, asset.id)}
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <>
                      <Music2 size={38} />
                      <audio
                        src={assetUrl(base, asset.id)}
                        controls
                        preload="none"
                      />
                    </>
                  )}
                </div>
                <div className="asset-card-body">
                  <div className="section-top">
                    <span className="pill">{asset.kind.toLowerCase()}</span>
                    <span className="muted">{size(asset.bytes)}</span>
                  </div>
                  <h3 title={asset.name}>{asset.name}</h3>
                  <p className="muted">
                    {asset.width
                      ? `${asset.width} × ${asset.height}`
                      : "Audio track"}
                    {asset.duration ? ` · ${asset.duration.toFixed(1)}s` : ""}
                  </p>
                  <div className="asset-tags">
                    {asset.tags.map((tag: string) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <div className="asset-actions">
                    <a
                      className="button"
                      href={assetUrl(base, asset.id) + "?download=1"}
                      aria-label={`Download ${asset.name}`}
                    >
                      <Download size={16} />
                    </a>
                    {canWrite(role) && (
                      <>
                        <button
                          className="button"
                          onClick={() => {
                            setEditing(asset);
                            dialog.current?.showModal();
                          }}
                          aria-label={`Edit ${asset.name}`}
                        >
                          Edit
                        </button>
                        <button
                          className="icon-button"
                          title={archived ? "Restore asset" : "Archive asset"}
                          aria-label={`${archived ? "Restore" : "Archive"} ${asset.name}`}
                          disabled={busy}
                          onClick={() =>
                            update(asset.id, { archived: !archived })
                          }
                        >
                          {archived ? (
                            <RotateCcw size={17} />
                          ) : (
                            <Archive size={17} />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty panel">
            <div className="empty-icon">
              <ImageIcon size={25} />
            </div>
            <h3>
              {query || kind ? "No matching assets" : "Your media starts here"}
            </h3>
            <p>
              {archived
                ? "Archived assets appear here and can be restored."
                : "Upload your product photos, clips or narration to use them in storyboard scenes."}
            </p>
          </div>
        )}
        <p className="field-help">
          Up to 100 matching assets are shown. Search to narrow results.
          Archiving hides an asset from new selections and keeps the original
          for existing work.
        </p>
      </section>
      <dialog
        ref={dialog}
        className="asset-dialog"
        onCancel={() => setEditing(null)}
      >
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              update(editing.id, {
                name: d.get("name"),
                tags: String(d.get("tags") || "")
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              });
            }}
          >
            <div className="section-top">
              <h2>Edit asset</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Close asset editor"
                onClick={() => {
                  dialog.current?.close();
                  setEditing(null);
                }}
              >
                <X size={19} />
              </button>
            </div>
            <label>
              Asset name
              <input
                name="name"
                defaultValue={editing.name}
                required
                maxLength={160}
              />
            </label>
            <label>
              Tags, separated by commas
              <input name="tags" defaultValue={editing.tags.join(", ")} />
            </label>
            <p className="field-help">
              {editing.rightsNote ||
                "Usage rights were confirmed when this file was uploaded."}
            </p>
            <button className="button primary" disabled={busy}>
              Save asset details
            </button>
          </form>
        )}
      </dialog>
    </>
  );
}
export function RenderPanel({
  base,
  role,
  content,
  dirty = false,
}: {
  base: string;
  role: string;
  content?: Any;
  dirty?: boolean;
}) {
  const [items, setItems] = useState<Any[]>([]),
    [videos, setVideos] = useState<Any[]>([]),
    [assets, setAssets] = useState<Any[]>([]),
    [status, setStatus] = useState<Any | null>(null),
    [selected, setSelected] = useState(""),
    [activeId, setActiveId] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [reviewed, setReviewed] = useState(false);
  const [options, setOptions] = useState({
    preset: undefined as RenderPresetId | undefined,
    aspect: "9:16",
    resolution: "720",
    captions: true,
    textPlacement: undefined as typeof INSET_TEXT_PLACEMENT | undefined,
    cjkLanguage: undefined as CjkLanguage | undefined,
    musicAssetId: null as string | null,
    musicVolume: 0.12,
    background: "#183c2b",
  });
  const current = content || videos.find((v) => v.id === selected),
    contentId = current?.id || "";
  const loadJobs = useCallback(async () => {
    setItems(
      await api(
        base + "/renders" + (contentId ? `?contentId=${contentId}` : ""),
      ),
    );
  }, [base, contentId]);
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      api(base + "/content?take=100"),
      api(base + "/assets?take=100"),
      api(base + "/assets/status"),
    ])
      .then(([c, a, s]) => {
        if (mounted) {
          const v = c.items.filter((row: Any) => row.format === "Video");
          setVideos(v);
          setAssets(a.items);
          setStatus(s);
          setSelected((old) => old || v[0]?.id || "");
        }
      })
      .catch((e) => mounted && setError(e.message))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [base]);
  useEffect(() => {
    loadJobs().catch((e) => setError(e.message));
    setActiveId("");
    setReviewed(false);
  }, [loadJobs, content?.revision, content?.status]);
  useEffect(() => {
    if (!items.some((j) => ["QUEUED", "RUNNING"].includes(j.status))) return;
    const timer = setInterval(
      () => loadJobs().catch((e) => setError(e.message)),
      1500,
    );
    return () => clearInterval(timer);
  }, [items, loadJobs]);
  const active = items.find((j) => j.id === activeId) || items[0];
  async function action(fn: () => Promise<any>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await fn();
      await loadJobs();
      if (result?.id) setActiveId(result.id);
      setReviewed(false);
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function option(key: string, value: any) {
    setOptions((o) => ({
      ...o,
      [key]: value,
      ...(["aspect", "resolution"].includes(key) ? { preset: undefined } : {}),
    }));
  }
  function selectPreset(id: string) {
    const preset = renderPreset(id);
    setOptions((o) => ({
      ...o,
      preset: preset?.id,
      ...(preset
        ? { aspect: preset.aspect, resolution: preset.resolution }
        : {}),
    }));
  }
  return (
    <section className="video-studio" aria-label="Video rendering">
      <div className="panel render-composer">
        <div className="section-top">
          <div>
            <h2>{content ? "Render this video" : "Create a render"}</h2>
            <p className="small-copy">
              A saved storyboard becomes an MP4 you can preview, review and
              download.
            </p>
          </div>
          <span
            className={`pill ${status?.renderWorkerOnline ? "connected" : ""}`}
          >
            {status?.renderWorkerOnline
              ? "Rendering available"
              : "Rendering paused"}
          </span>
        </div>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="alert success" role="status">
            {notice}
          </div>
        )}
        {loading ? (
          <p role="status">Loading video tools…</p>
        ) : (
          <>
            {!content && (
              <label>
                Video draft
                <select
                  aria-label="Video draft"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  <option value="">Select a saved video draft</option>
                  {videos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title} · revision {v.revision}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!current ? (
              <p className="field-help">
                Create and save a draft with the Video format and at least one
                storyboard scene in the Content library.
              </p>
            ) : (
              <>
                <div className="render-options">
                  <label>
                    Export preset
                    <select
                      value={options.preset || ""}
                      onChange={(e) => selectPreset(e.target.value)}
                    >
                      <option value="">Custom</option>
                      {RENDER_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label} · {preset.aspect}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Aspect ratio
                    <select
                      value={options.aspect}
                      onChange={(e) => option("aspect", e.target.value)}
                    >
                      <option value="9:16">Portrait · 9:16</option>
                      <option value="16:9">Landscape · 16:9</option>
                      <option value="1:1">Square · 1:1</option>
                    </select>
                  </label>
                  <label>
                    Resolution
                    <select
                      value={options.resolution}
                      onChange={(e) => option("resolution", e.target.value)}
                    >
                      <option value="720">720p</option>
                      <option value="1080">1080p</option>
                    </select>
                  </label>
                  <p className="field-help" role="status">
                    Export size: {renderDimensions(options).join(" × ")} px.
                    Presets set the export size. Review framing and platform
                    requirements before publishing.
                  </p>
                  <label>
                    Text placement
                    <select
                      value={options.textPlacement || ""}
                      onChange={(e) =>
                        option("textPlacement", e.target.value || undefined)
                      }
                    >
                      <option value="">Standard placement</option>
                      <option value={INSET_TEXT_PLACEMENT}>
                        Extra margins
                      </option>
                    </select>
                  </label>
                  <p className="field-help">
                    Extra margins move text further inside the frame. Vertical
                    exports leave more room on the right and bottom. Review the
                    exported video on your target platform.
                  </p>
                  <label>
                    Chinese, Japanese or Korean language
                    <select
                      value={options.cjkLanguage || ""}
                      onChange={(e) =>
                        option("cjkLanguage", e.target.value || undefined)
                      }
                    >
                      <option value="">
                        Choose for Chinese, Japanese or Korean text
                      </option>
                      {CJK_LANGUAGES.map((language) => (
                        <option key={language} value={language}>
                          {CJK_LANGUAGE_LABELS[language]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="field-help">
                    Choose the language of Chinese, Japanese or Korean text to
                    use the correct regional letter forms. Use separate exports
                    for different CJK languages.
                  </p>
                  <label>
                    Background colour
                    <input
                      type="color"
                      value={options.background}
                      onChange={(e) => option("background", e.target.value)}
                    />
                  </label>
                  <label>
                    Background music
                    <select
                      value={options.musicAssetId || ""}
                      onChange={(e) =>
                        option("musicAssetId", e.target.value || null)
                      }
                    >
                      <option value="">No background music</option>
                      {assets
                        .filter((a) => a.kind === "AUDIO")
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Music volume · {Math.round(options.musicVolume * 100)}%
                    <input
                      type="range"
                      min="0"
                      max="0.5"
                      step="0.01"
                      value={options.musicVolume}
                      onChange={(e) =>
                        option("musicVolume", Number(e.target.value))
                      }
                    />
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={options.captions}
                      onChange={(e) => option("captions", e.target.checked)}
                    />
                    Burn scene captions into video
                  </label>
                </div>
                <CompositionGuides
                  options={options}
                  label="Selected export composition"
                />
                <div className="render-summary">
                  <span>
                    <Film size={17} />
                    {current.scenes?.length || 0} scenes ·{" "}
                    {current.scenes?.reduce(
                      (n: number, s: Any) => n + s.duration,
                      0,
                    ) || 0}
                    s
                  </span>
                  <span>Saved revision {current.revision}</span>
                  <span>H.264 MP4 + AAC audio</span>
                </div>
                <p className="field-help">
                  Up to 12 scenes / 180 seconds. Uploaded clips loop or trim to
                  scene length and their original sound is muted. Attach a
                  narration asset to each scene; voiceover text is not spoken
                  automatically. Captions use manual cue timing when supplied,
                  otherwise the whole scene. Cut and Fade transitions are
                  supported.
                </p>
                {dirty && (
                  <div className="alert">
                    Save your scene changes before rendering.
                  </div>
                )}
                {!status?.available && (
                  <div className="alert">
                    Media storage is unavailable. Start the storage service and
                    refresh this page.
                  </div>
                )}
                {canWrite(role) && (
                  <button
                    className="button primary"
                    disabled={
                      busy ||
                      dirty ||
                      !current.id ||
                      !current.scenes?.length ||
                      !status?.available
                    }
                    onClick={() =>
                      action(
                        () =>
                          api(base + "/renders", "POST", {
                            contentId: current.id,
                            revision: current.revision,
                            options,
                            requestKey: crypto.randomUUID(),
                          }),
                        "Video queued. You can keep working while it renders.",
                      )
                    }
                  >
                    <Play size={17} />
                    Render video
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
      {items.length > 0 && (
        <div className="render-workspace">
          <section className="panel render-viewer">
            <div className="section-top">
              <h3>Render preview</h3>
              {active && (
                <span
                  className={`status status-${active.status.toLowerCase()}`}
                >
                  {active.status.toLowerCase()}
                </span>
              )}
            </div>
            {active && (
              <>
                <h3>{active.snapshot?.title || active.content?.title}</h3>
                <p className="field-help">
                  Revision {active.contentRevision} ·{" "}
                  {renderPreset(active.options.preset)?.label || "Custom"} ·{" "}
                  {active.options.aspect} ·{" "}
                  {renderDimensions(active.options).join(" × ")} px ·{" "}
                  {textPlacementLabel(active.options.textPlacement)} ·{" "}
                  {active.options.cjkLanguage &&
                    CJK_LANGUAGE_LABELS[
                      active.options.cjkLanguage as CjkLanguage
                    ] + " · "}
                  {active.reusedScenes}/{active.totalScenes} scenes reused
                </p>
                {active.stale && (
                  <div className="alert">
                    Content changed after this render. Create a new render to
                    approve the latest revision.
                  </div>
                )}
                <details className="saved-composition">
                  <summary>Saved render composition guides</summary>
                  <CompositionGuides
                    options={active.options}
                    label="Saved render composition"
                  />
                </details>
                {active.status === "SUCCEEDED" ? (
                  <>
                    <RenderReview
                      key={active.id}
                      base={base}
                      jobId={active.id}
                      scenes={active.snapshot?.scenes || []}
                      captions={active.options.captions}
                    />
                    <div className="render-downloads">
                      <a
                        className="button primary"
                        href={`/api${base}/renders/${active.id}/file/video?download=1`}
                      >
                        <Download size={16} />
                        Download MP4
                      </a>
                      <a
                        className="button"
                        href={`/api${base}/renders/${active.id}/file/captions`}
                      >
                        <Download size={16} />
                        Captions SRT
                      </a>
                      <a
                        className="button"
                        href={`/api${base}/renders/${active.id}/file/thumbnail?download=1`}
                        download="thumbnail.jpg"
                      >
                        Thumbnail
                      </a>
                    </div>
                    <p className="field-help">
                      {active.width} × {active.height} ·{" "}
                      {active.duration?.toFixed(1)}s ·{" "}
                      {size(active.outputBytes || 0)}. Preview exports may be
                      downloaded before approval.
                    </p>
                    {active.approvedAt ? (
                      <div className="alert success">
                        <CheckCircle2 size={17} />
                        This rendered video is approved.
                      </div>
                    ) : (
                      <div className="render-approval">
                        <h3>Final video approval</h3>
                        {active.stale ||
                        active.content?.status !== "APPROVED" ? (
                          <p className="field-help">
                            Approve the matching content revision in the Content
                            editor first.
                          </p>
                        ) : (
                          ["OWNER", "ADMIN", "EDITOR"].includes(role) && (
                            <>
                              <label className="check-label">
                                <input
                                  type="checkbox"
                                  checked={reviewed}
                                  onChange={(e) =>
                                    setReviewed(e.target.checked)
                                  }
                                />
                                I watched this video and checked its visuals,
                                audio, captions and usage rights.
                              </label>
                              <button
                                className="button"
                                disabled={!reviewed || busy}
                                onClick={() =>
                                  action(
                                    () =>
                                      api(
                                        `${base}/renders/${active.id}/approve`,
                                        "POST",
                                        { reviewed: true },
                                      ),
                                    "Rendered video approved.",
                                  )
                                }
                              >
                                Approve rendered video
                              </button>
                            </>
                          )
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="render-placeholder">
                    <Film size={38} />
                    <h3>{active.stage}</h3>
                    {["QUEUED", "RUNNING"].includes(active.status) && (
                      <>
                        <progress
                          aria-label="Render progress"
                          value={active.progress}
                          max={100}
                        />
                        <p>{active.progress}% complete</p>
                        {canWrite(role) && (
                          <button
                            className="button"
                            disabled={busy}
                            onClick={() =>
                              action(
                                () =>
                                  api(
                                    `${base}/renders/${active.id}/cancel`,
                                    "POST",
                                  ),
                                "Render canceled.",
                              )
                            }
                          >
                            Cancel render
                          </button>
                        )}
                      </>
                    )}
                    {active.error && <p role="alert">{active.error}</p>}
                    {["FAILED", "CANCELED"].includes(active.status) &&
                      canWrite(role) && (
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() =>
                            action(
                              () =>
                                api(
                                  `${base}/renders/${active.id}/retry`,
                                  "POST",
                                  { requestKey: crypto.randomUUID() },
                                ),
                              "Retry queued from the original saved snapshot.",
                            )
                          }
                        >
                          <RotateCcw size={16} />
                          Retry render
                        </button>
                      )}
                  </div>
                )}
              </>
            )}
          </section>
          <aside className="panel render-history">
            <div className="section-top">
              <h3>Render history</h3>
              <button
                className="icon-button"
                aria-label="Refresh renders"
                onClick={() => loadJobs().catch((e) => setError(e.message))}
              >
                <RefreshCw size={16} />
              </button>
            </div>
            <p className="field-help">
              Latest 50 renders. Each keeps its own saved scene plan.
            </p>
            {items.map((j) => (
              <button
                key={j.id}
                className={`render-history-item ${active?.id === j.id ? "selected" : ""}`}
                onClick={() => {
                  setActiveId(j.id);
                  setReviewed(false);
                }}
              >
                <Film size={19} />
                <span>
                  <b>{j.snapshot?.title || j.content?.title}</b>
                  <small>
                    Revision {j.contentRevision} ·{" "}
                    {new Date(j.createdAt).toLocaleString()}
                  </small>
                  <small>
                    {renderPreset(j.options.preset)?.label || "Custom"} ·{" "}
                    {renderDimensions(j.options).join(" × ")} px ·{" "}
                    {textPlacementLabel(j.options.textPlacement)}
                  </small>
                  <span className={`status status-${j.status.toLowerCase()}`}>
                    {j.approvedAt ? "approved" : j.status.toLowerCase()}
                  </span>
                </span>
              </button>
            ))}
          </aside>
        </div>
      )}
    </section>
  );
}
