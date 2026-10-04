"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Copy,
  Sparkles,
  Search,
  Check,
  CheckCircle2,
  Clock3,
  MessageSquare,
  FileText,
  CalendarDays,
  FolderOpen,
  Download,
  RotateCcw,
  Archive,
  ChevronLeft,
  ChevronRight,
  TriangleAlert,
  X,
  Play,
  Layers3,
  BarChart3,
} from "lucide-react";
import { api, download } from "./api-client";
import { RenderPanel } from "./media-workspace";
import { CaptionEditor } from "./caption-editor";
import {
  sceneTimeline as timeline,
  timelineTime,
} from "../../../packages/core/captions";
type Any = Record<string, any>;
const draftFields = [
  "title",
  "platform",
  "format",
  "hook",
  "body",
  "cta",
  "scenes",
  "campaignId",
  "plannedAt",
];
const emptyDraft = {
  title: "",
  platform: "LinkedIn",
  format: "Text",
  hook: "",
  body: "",
  cta: "",
  scenes: [],
  campaignId: null,
  plannedAt: null,
};
const pick = (item: Any) =>
  Object.fromEntries(
    draftFields.map((k) => [
      k,
      item[k] ?? emptyDraft[k as keyof typeof emptyDraft],
    ]),
  );
const platforms = [
  "Instagram",
  "Facebook",
  "YouTube",
  "LinkedIn",
  "X",
  "Telegram",
  "Pinterest",
  "TikTok",
];
function Status({ value }: { value: string }) {
  return (
    <span className={`status status-${value.toLowerCase()}`}>
      {value.toLowerCase().replaceAll("_", " ")}
    </span>
  );
}
function Blank({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Layers3 size={23} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
const inputTime = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export default function ContentWorkspace({
  base,
  view,
  role,
  onNavigate,
  onDirtyChange,
}: {
  base: string;
  view: string;
  role: string;
  onNavigate: (v: string) => void;
  onDirtyChange: (v: boolean) => void;
}) {
  const [items, setItems] = useState<Any[]>([]),
    [assets, setAssets] = useState<Any[]>([]),
    [total, setTotal] = useState(0),
    [campaigns, setCampaigns] = useState<Any[]>([]),
    [jobs, setJobs] = useState<Any[]>([]),
    [aiStatus, setAiStatus] = useState<Any>({ configured: false, usage: [] }),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [detail, setDetail] = useState<Any | null>(null),
    [draft, setDraft] = useState<Any>(emptyDraft),
    [dirty, setDirty] = useState(false),
    [filter, setFilter] = useState("All"),
    [query, setQuery] = useState(""),
    [ack, setAck] = useState(false),
    [comment, setComment] = useState(""),
    [rejection, setRejection] = useState("");
  const [prompt, setPrompt] = useState(""),
    [task, setTask] = useState("content"),
    [scenePrompt, setScenePrompt] = useState(""),
    [month, setMonth] = useState(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    );
  const campaignDialog = useRef<HTMLDialogElement>(null);
  const editable = ["OWNER", "ADMIN", "EDITOR", "CREATOR"].includes(role),
    approver = ["OWNER", "ADMIN", "EDITOR"].includes(role);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, ca, j, s, a] = await Promise.all([
        api(base + "/content?take=100"),
        api(base + "/campaigns"),
        api(base + "/ai/jobs"),
        api(base + "/ai/status"),
        api(base + "/assets?take=100"),
      ]);
      setItems(c.items);
      setTotal(c.total);
      setCampaigns(ca);
      setJobs(j);
      setAiStatus(s);
      setAssets(a.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [base]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    setDetail(null);
    setDirty(false);
    setError("");
    setNotice("");
  }, [view]);
  useEffect(() => {
    if (!jobs.some((j) => ["QUEUED", "RUNNING"].includes(j.status))) return;
    const timer = setInterval(async () => {
      try {
        setJobs(await api(base + "/ai/jobs"));
        setAiStatus(await api(base + "/ai/status"));
      } catch {}
    }, 2000);
    return () => clearInterval(timer);
  }, [base, jobs]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function run(fn: () => Promise<any>, message = "") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit(k: string, v: any) {
    setDraft((d) => ({ ...d, [k]: v }));
    setDirty(true);
    setAck(false);
  }
  async function open(id: string) {
    const data = await api(base + `/content/${id}`);
    setDetail(data);
    setDraft(pick(data.item));
    setDirty(false);
    setAck(false);
  }
  function create(initial: Any = emptyDraft) {
    setDraft(pick(initial));
    setDetail({
      item: { id: null, status: "DRAFT", revision: 0 },
      versions: [],
      comments: [],
      quality: null,
    });
    setDirty(true);
    setAck(false);
  }
  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    await run(async () => {
      const saved = await api(
        base + "/content" + (detail?.item.id ? `/${detail.item.id}` : ""),
        detail?.item.id ? "PUT" : "POST",
        {
          ...draft,
          ...(detail?.item.id ? { revision: detail.item.revision } : {}),
        },
      );
      await open(saved.id);
      await load();
    }, "Draft saved.");
  }
  async function transition(action: string, extra: Any = {}) {
    await run(
      async () => {
        await api(base + `/content/${detail?.item.id}/${action}`, "POST", {
          revision: detail?.item.revision,
          ...extra,
        });
        await open(detail!.item.id);
        await load();
      },
      action === "approve"
        ? "Content approved."
        : action === "review"
          ? "Content sent for review."
          : action === "reject"
            ? "Draft returned with feedback."
            : "Content archived.",
    );
  }
  async function generate(kind: string, text: string, scene?: Any) {
    await run(async () => {
      await api(base + "/ai/jobs", "POST", {
        requestKey: crypto.randomUUID(),
        task: kind,
        prompt: text,
        ...(scene ? { scene } : {}),
        ...(aiStatus.credits?.mode === "credits"
          ? { maxCredits: aiStatus.credits.prices[kind] }
          : {}),
      });
      setJobs(await api(base + "/ai/jobs"));
    }, "Generation queued. You can keep working while it runs.");
  }
  async function reviewAgentJob(job: Any, decision: "approve" | "reject") {
    const note =
      decision === "reject"
        ? window.prompt("What should be corrected before generating again?")
        : "Human review completed in the workspace.";
    if (decision === "reject" && note === null) return;
    await run(
      async () => {
        await api(base + `/ai/jobs/${job.id}/review`, "POST", {
          decision,
          note: note || undefined,
        });
        setJobs(await api(base + "/ai/jobs"));
      },
      decision === "approve"
        ? "Agent result approved."
        : "Agent result rejected.",
    );
  }
  const visible = items.filter(
    (i) =>
      (filter === "All" || i.status === filter) &&
      (!query ||
        `${i.title} ${i.body}`.toLowerCase().includes(query.toLowerCase())),
  );
  return (
    <div className="content-workspace">
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="inline-notice" role="status">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      )}
      {detail ? (
        <>
          <div className="editor-top">
            <button
              className="text-button"
              onClick={() => {
                if (!dirty || confirm("Discard unsaved content changes?"))
                  setDetail(null);
              }}
            >
              <ArrowLeft size={17} />
              Back to content
            </button>
            <div>
              <Status value={detail.item.status} />
              <span className="muted">
                {dirty ? "Unsaved changes" : `Revision ${detail.item.revision}`}
              </span>
            </div>
          </div>
          <div className="page-heading">
            <div>
              <h1>
                {detail.item.id ? "Content editor" : "A new idea starts here."}
              </h1>
              <p>
                Shape the message, plan its timing and get it ready for review.
              </p>
            </div>
            <div className="button-row">
              <button
                className="button"
                onClick={() => download("content-draft.json", draft)}
              >
                <Download size={16} />
                Export
              </button>
              <button
                className="button primary"
                disabled={
                  busy || !editable || detail.item.status === "ARCHIVED"
                }
                onClick={() => save()}
              >
                {busy ? "Saving…" : "Save draft"}
                <Check size={16} />
              </button>
            </div>
          </div>
          <div className="editor-layout">
            <form className="editor-fields" onSubmit={save}>
              <fieldset
                disabled={
                  !editable || busy || detail.item.status === "ARCHIVED"
                }
              >
                <section className="panel">
                  <label>
                    Content title
                    <input
                      value={draft.title}
                      onChange={(e) => edit("title", e.target.value)}
                      maxLength={160}
                      required
                      placeholder="Give this idea a useful name"
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Platform
                      <select
                        value={draft.platform}
                        onChange={(e) => edit("platform", e.target.value)}
                      >
                        {platforms.map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Format
                      <select
                        value={draft.format}
                        onChange={(e) => edit("format", e.target.value)}
                      >
                        {["Text", "Image", "Carousel", "Video"].map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    Hook
                    <textarea
                      value={draft.hook}
                      onChange={(e) => edit("hook", e.target.value)}
                      maxLength={1000}
                      placeholder="The opening that earns attention"
                      rows={2}
                    />
                  </label>
                  <label>
                    Content / script
                    <textarea
                      className="copy-editor"
                      value={draft.body}
                      onChange={(e) => edit("body", e.target.value)}
                      maxLength={20000}
                      placeholder="Write the useful part. Be specific and stay true to your brand."
                    />
                  </label>
                  <label>
                    Call to action
                    <input
                      value={draft.cta}
                      onChange={(e) => edit("cta", e.target.value)}
                      maxLength={1000}
                      placeholder="What should the reader do next?"
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Campaign
                      <select
                        value={draft.campaignId || ""}
                        onChange={(e) =>
                          edit("campaignId", e.target.value || null)
                        }
                      >
                        <option value="">No campaign</option>
                        {campaigns.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Planned date and time
                      <input
                        type="datetime-local"
                        value={inputTime(draft.plannedAt)}
                        onChange={(e) =>
                          edit(
                            "plannedAt",
                            e.target.value
                              ? new Date(e.target.value).toISOString()
                              : null,
                          )
                        }
                      />
                    </label>
                  </div>
                  <p className="field-help">
                    Times use {Intl.DateTimeFormat().resolvedOptions().timeZone}
                    . Planning a date does not schedule a social publication.
                  </p>
                </section>
                {draft.format === "Video" && (
                  <section className="panel storyboard">
                    <div className="section-top">
                      <h3>Storyboard</h3>
                      <span className="pill">
                        {draft.scenes.reduce(
                          (a: number, s: Any) => a + s.duration,
                          0,
                        )}{" "}
                        seconds
                      </span>
                    </div>
                    <p className="small-copy">
                      Edit one scene at a time. Select uploaded media, save the
                      storyboard, then render your video below.
                    </p>
                    <div className="scene-timeline">
                      {timeline<Any & { duration: number }>(draft.scenes).map(
                        ({ scene, index, start, end }) => (
                          <a href={`#scene-${scene.id}`} key={scene.id}>
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            {timelineTime(start)}–{timelineTime(end)}
                          </a>
                        ),
                      )}
                    </div>
                    {draft.scenes.map((s: Any, index: number) => {
                      const change = (k: string, v: any) =>
                        edit(
                          "scenes",
                          draft.scenes.map((s: Any, i: number) =>
                            i === index ? { ...s, [k]: v } : s,
                          ),
                        );
                      return (
                        <div
                          className="scene-card"
                          id={`scene-${s.id}`}
                          key={s.id}
                        >
                          <div className="section-top">
                            <div>
                              <h3>Scene {index + 1}</h3>
                              <small>
                                {timelineTime(
                                  draft.scenes
                                    .slice(0, index)
                                    .reduce(
                                      (total: number, scene: Any) =>
                                        total + (Number(scene.duration) || 0),
                                      0,
                                    ),
                                )}{" "}
                                start
                              </small>
                            </div>
                            <div className="scene-actions">
                              <button
                                type="button"
                                className="icon-button"
                                aria-label={`Move scene ${index + 1} earlier`}
                                disabled={index === 0}
                                onClick={() => {
                                  const scenes = [...draft.scenes];
                                  [scenes[index - 1], scenes[index]] = [
                                    scenes[index],
                                    scenes[index - 1],
                                  ];
                                  edit("scenes", scenes);
                                }}
                              >
                                <ArrowUp size={16} />
                              </button>
                              <button
                                type="button"
                                className="icon-button"
                                aria-label={`Move scene ${index + 1} later`}
                                disabled={index === draft.scenes.length - 1}
                                onClick={() => {
                                  const scenes = [...draft.scenes];
                                  [scenes[index], scenes[index + 1]] = [
                                    scenes[index + 1],
                                    scenes[index],
                                  ];
                                  edit("scenes", scenes);
                                }}
                              >
                                <ArrowDown size={16} />
                              </button>
                              <button
                                type="button"
                                className="icon-button"
                                aria-label={`Duplicate scene ${index + 1}`}
                                disabled={draft.scenes.length >= 12}
                                onClick={() => {
                                  const scenes = [...draft.scenes];
                                  scenes.splice(index + 1, 0, {
                                    ...s,
                                    id: crypto.randomUUID(),
                                    purpose: s.purpose
                                      ? `${s.purpose} copy`
                                      : "Scene copy",
                                  });
                                  edit("scenes", scenes);
                                }}
                              >
                                <Copy size={16} />
                              </button>
                              <button
                                type="button"
                                className="icon-button"
                                aria-label={`Remove scene ${index + 1}`}
                                onClick={() =>
                                  edit(
                                    "scenes",
                                    draft.scenes.filter(
                                      (_: any, i: number) => i !== index,
                                    ),
                                  )
                                }
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="form-grid">
                            <label>
                              Scene purpose
                              <input
                                value={s.purpose}
                                onChange={(e) =>
                                  change("purpose", e.target.value)
                                }
                              />
                            </label>
                            <label>
                              Duration (seconds)
                              <input
                                type="number"
                                min={1}
                                max={60}
                                step="0.001"
                                value={s.duration}
                                onChange={(e) =>
                                  change("duration", Number(e.target.value))
                                }
                              />
                            </label>
                          </div>
                          <label>
                            Voiceover
                            <textarea
                              value={s.voiceover}
                              onChange={(e) =>
                                change("voiceover", e.target.value)
                              }
                            />
                          </label>
                          <div className="form-grid scene-assets">
                            <label>
                              Visual asset
                              <select
                                value={s.visualAssetId || ""}
                                onChange={(e) =>
                                  change(
                                    "visualAssetId",
                                    e.target.value || null,
                                  )
                                }
                              >
                                <option value="">
                                  Colour background / text card
                                </option>
                                {assets
                                  .filter((a) => a.kind !== "AUDIO")
                                  .map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.name}
                                    </option>
                                  ))}
                                {s.visualAssetId &&
                                  !assets.some(
                                    (a) => a.id === s.visualAssetId,
                                  ) && (
                                    <option value={s.visualAssetId}>
                                      Unavailable / archived asset — replace it
                                    </option>
                                  )}
                              </select>
                            </label>
                            <label>
                              Narration audio
                              <select
                                value={s.audioAssetId || ""}
                                onChange={(e) =>
                                  change("audioAssetId", e.target.value || null)
                                }
                              >
                                <option value="">No narration audio</option>
                                {assets
                                  .filter((a) => a.kind === "AUDIO")
                                  .map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.name}
                                    </option>
                                  ))}
                                {s.audioAssetId &&
                                  !assets.some(
                                    (a) => a.id === s.audioAssetId,
                                  ) && (
                                    <option value={s.audioAssetId}>
                                      Unavailable / archived audio — replace it
                                    </option>
                                  )}
                              </select>
                            </label>
                          </div>
                          <label>
                            Visual framing
                            <select
                              value={s.visualFit || "contain"}
                              disabled={!s.visualAssetId}
                              onChange={(e) =>
                                change("visualFit", e.target.value)
                              }
                            >
                              <option value="contain">
                                Fit — show whole visual
                              </option>
                              <option value="cover">
                                Fill — crop to frame
                              </option>
                            </select>
                          </label>
                          <p className="field-help">
                            Fit keeps the whole image or video with background
                            borders. Fill crops from the center to fill the
                            frame. The preview below shows the original asset;
                            render to check framing.
                          </p>
                          <label>
                            Camera motion
                            <select
                              value={s.cameraMotion || "static"}
                              disabled={
                                assets.find((a) => a.id === s.visualAssetId)
                                  ?.kind !== "IMAGE"
                              }
                              onChange={(e) =>
                                change("cameraMotion", e.target.value)
                              }
                            >
                              <option value="static">Static</option>
                              <option value="slow-zoom">Slow zoom in</option>
                            </select>
                          </label>
                          <p className="field-help">
                            Images only. Slow zoom enlarges the framed image
                            from the center by up to 8%, including Fit borders.
                            Text stays fixed. Render to preview the motion.
                          </p>
                          {s.visualAssetId && (
                            <div className="scene-asset-preview">
                              {assets.find((a) => a.id === s.visualAssetId)
                                ?.kind === "IMAGE" ? (
                                <img
                                  src={`/api${base}/assets/${s.visualAssetId}/file`}
                                  alt={`Visual for scene ${index + 1}`}
                                />
                              ) : (
                                <video
                                  src={`/api${base}/assets/${s.visualAssetId}/file`}
                                  controls
                                  preload="metadata"
                                />
                              )}
                            </div>
                          )}
                          <p className="field-help">
                            Upload media in the Asset library first. The latest
                            100 active assets are listed. Narration audio is
                            trimmed or padded with silence to the scene
                            duration; voiceover text remains a script.
                          </p>
                          <label>
                            Visual direction
                            <textarea
                              value={s.visual}
                              onChange={(e) => change("visual", e.target.value)}
                            />
                          </label>
                          <div className="form-grid">
                            <label>
                              On-screen text
                              <input
                                value={s.onScreenText}
                                onChange={(e) =>
                                  change("onScreenText", e.target.value)
                                }
                              />
                            </label>
                            <label>
                              Caption
                              <input
                                value={s.caption}
                                disabled={Boolean(s.captionCues?.length)}
                                onChange={(e) =>
                                  change("caption", e.target.value)
                                }
                              />
                            </label>
                          </div>
                          <CaptionEditor
                            duration={s.duration}
                            cues={s.captionCues || []}
                            onChange={(cues) => change("captionCues", cues)}
                          />
                          <details>
                            <summary>Transitions, music and scene CTA</summary>
                            <div className="form-grid">
                              {["transition", "music", "sfx", "cta"].map(
                                (k) => (
                                  <label key={k}>
                                    {k === "sfx"
                                      ? "Sound effects"
                                      : k === "cta"
                                        ? "Scene CTA"
                                        : k[0].toUpperCase() + k.slice(1)}
                                    <input
                                      value={s[k]}
                                      onChange={(e) =>
                                        change(k, e.target.value)
                                      }
                                    />
                                  </label>
                                ),
                              )}
                            </div>
                          </details>
                          {aiStatus.configured && (
                            <div className="scene-ai">
                              <label>
                                Rewrite direction
                                <input
                                  value={scenePrompt}
                                  onChange={(e) =>
                                    setScenePrompt(e.target.value)
                                  }
                                  placeholder="Make this scene more energetic"
                                />
                              </label>
                              <button
                                type="button"
                                className="button"
                                disabled={busy || scenePrompt.length < 10}
                                onClick={() =>
                                  generate("scene", scenePrompt, s)
                                }
                              >
                                <Sparkles size={16} />
                                Rewrite this scene
                                {aiStatus.credits?.mode === "credits"
                                  ? ` · ${aiStatus.credits.prices.scene} credits`
                                  : ""}
                              </button>
                            </div>
                          )}
                          {jobs
                            .filter(
                              (j) =>
                                j.task === "scene" &&
                                j.status === "SUCCEEDED" &&
                                (!j.agentRun ||
                                  j.agentRun.state === "APPROVED") &&
                                j.input.scene?.id === s.id,
                            )
                            .slice(0, 1)
                            .map((j) => (
                              <button
                                type="button"
                                key={j.id}
                                className="button"
                                onClick={() =>
                                  edit(
                                    "scenes",
                                    draft.scenes.map((old: Any) =>
                                      old.id === s.id
                                        ? {
                                            ...j.output,
                                            id: old.id,
                                            visualAssetId:
                                              old.visualAssetId || null,
                                            audioAssetId:
                                              old.audioAssetId || null,
                                            captionCues: [],
                                            visualFit:
                                              old.visualFit || "contain",
                                            cameraMotion:
                                              old.cameraMotion || "static",
                                          }
                                        : old,
                                    ),
                                  )
                                }
                              >
                                Apply latest scene rewrite (clears timed
                                captions)
                              </button>
                            ))}
                        </div>
                      );
                    })}
                    <button
                      className="button"
                      type="button"
                      onClick={() =>
                        edit("scenes", [
                          ...draft.scenes,
                          {
                            id: crypto.randomUUID(),
                            purpose: "",
                            duration: 5,
                            voiceover: "",
                            visual: "",
                            onScreenText: "",
                            caption: "",
                            transition: "Cut",
                            music: "",
                            sfx: "",
                            cta: "",
                          },
                        ])
                      }
                    >
                      <Plus size={17} />
                      Add scene
                    </button>
                  </section>
                )}
              </fieldset>
            </form>
            <aside className="editor-aside">
              <section className="panel">
                <div className="section-top">
                  <h3>Review & approval</h3>
                  <CheckCircle2 size={18} />
                </div>
                {dirty ? (
                  <p className="small-copy">
                    Save your changes to run the structural checks. Edits reset
                    previous approval.
                  </p>
                ) : (
                  detail.quality?.checks.map((c: Any) => (
                    <div className={`quality-row ${c.severity}`} key={c.label}>
                      {c.severity === "pass" ? (
                        <Check size={15} />
                      ) : (
                        <TriangleAlert size={15} />
                      )}
                      <span>{c.label}</span>
                    </div>
                  ))
                )}
                {detail.item.id && detail.item.status === "DRAFT" && (
                  <button
                    className="button primary wide"
                    disabled={
                      busy || dirty || !editable || !detail.quality?.passed
                    }
                    onClick={() => transition("review")}
                  >
                    Request review
                  </button>
                )}
                {detail.item.status === "REVIEW" && approver && (
                  <>
                    <label className="review-ack">
                      <input
                        type="checkbox"
                        checked={ack}
                        onChange={(e) => setAck(e.target.checked)}
                      />
                      I reviewed the facts, usage rights, brand fit and platform
                      requirements.
                    </label>
                    <button
                      className="button primary wide"
                      disabled={busy || dirty || !ack}
                      onClick={() =>
                        transition("approve", { factsAndRightsReviewed: true })
                      }
                    >
                      Approve this revision
                    </button>
                    <label className="reject-label">
                      Changes needed
                      <textarea
                        value={rejection}
                        onChange={(e) => setRejection(e.target.value)}
                        placeholder="Explain what should change"
                      />
                    </label>
                    <button
                      className="button wide"
                      disabled={busy || dirty || rejection.trim().length < 3}
                      onClick={() =>
                        transition("reject", { feedback: rejection })
                      }
                    >
                      Return with feedback
                    </button>
                  </>
                )}
                {detail.item.status === "APPROVED" && (
                  <div className="alert">
                    Approved for this revision. Export the content to publish
                    manually. Automatic publishing is not connected.
                  </div>
                )}
              </section>
              {detail.item.id && (
                <section className="panel">
                  <h3>Feedback</h3>
                  {detail.comments.map((c: Any) => (
                    <div className="comment" key={c.id}>
                      <b>{c.authorName}</b>
                      <p>{c.text}</p>
                      <small>{new Date(c.createdAt).toLocaleString()}</small>
                    </div>
                  ))}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(async () => {
                        await api(
                          base + `/content/${detail.item.id}/comments`,
                          "POST",
                          { text: comment },
                        );
                        setComment("");
                        await open(detail.item.id);
                      }, "Comment added.");
                    }}
                  >
                    <label>
                      <span className="sr-only">Add a comment</span>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        required
                        maxLength={4000}
                        placeholder="Add feedback for your team"
                      />
                    </label>
                    <button
                      disabled={busy || !comment.trim() || dirty}
                      className="button"
                    >
                      Add comment
                    </button>
                  </form>
                </section>
              )}
              {detail.versions.length > 0 && (
                <section className="panel">
                  <h3>History</h3>
                  {detail.versions.slice(0, 6).map((v: Any) => (
                    <div className="version-row" key={v.id}>
                      <div>
                        <b>Revision {v.revision}</b>
                        <small>
                          {new Date(v.createdAt).toLocaleDateString()}
                        </small>
                      </div>
                      {editable && v.revision !== detail.item.revision && (
                        <button
                          className="icon-button"
                          aria-label={`Restore content revision ${v.revision}`}
                          disabled={busy || dirty}
                          onClick={() =>
                            run(async () => {
                              await api(
                                base +
                                  `/content/${detail.item.id}/restore/${v.revision}`,
                                "POST",
                                { revision: detail.item.revision },
                              );
                              await open(detail.item.id);
                              await load();
                            }, "Earlier revision restored as a draft.")
                          }
                        >
                          <RotateCcw size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </section>
              )}
              {detail.item.id &&
                editable &&
                detail.item.status !== "ARCHIVED" && (
                  <button
                    className="text-button danger"
                    disabled={dirty || busy}
                    onClick={() => transition("archive")}
                  >
                    <Archive size={16} />
                    Archive content
                  </button>
                )}
            </aside>
          </div>
          {draft.format === "Video" && (
            <RenderPanel
              base={base}
              role={role}
              content={
                detail.item.id
                  ? { ...detail.item, scenes: draft.scenes }
                  : { id: null, scenes: draft.scenes, revision: 0 }
              }
              dirty={dirty}
            />
          )}
        </>
      ) : (
        <>
          {(view === "content" || view === "calendar") && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow muted">FROM IDEA TO APPROVED</span>
                  <h1>
                    {view === "calendar"
                      ? "Your content calendar"
                      : "Content library"}
                  </h1>
                  <p>
                    {view === "calendar"
                      ? "A plan for what comes next. Dates here do not trigger publishing."
                      : "Create, refine and review the work behind your marketing."}
                  </p>
                </div>
                <div className="button-row">
                  <button
                    className="button"
                    onClick={() => onNavigate("create")}
                  >
                    <Sparkles size={16} />
                    Create with AI
                  </button>
                  <button
                    className="button primary"
                    disabled={!editable}
                    onClick={() => create()}
                  >
                    <Plus size={17} />
                    New draft
                  </button>
                </div>
              </div>
              {view === "content" ? (
                <section className="panel library-panel">
                  <div className="library-toolbar">
                    <div
                      className="filter-tabs"
                      role="group"
                      aria-label="Content status"
                    >
                      {["All", "DRAFT", "REVIEW", "APPROVED"].map((s) => (
                        <button
                          key={s}
                          className={filter === s ? "selected" : ""}
                          aria-pressed={filter === s}
                          onClick={() => setFilter(s)}
                        >
                          {s === "All"
                            ? "All content"
                            : s[0] + s.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                    <label className="search-box">
                      <Search size={17} />
                      <span className="sr-only">Search content</span>
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search your content"
                      />
                    </label>
                  </div>
                  {loading ? (
                    <p className="page-loading">Loading content…</p>
                  ) : visible.length ? (
                    <div className="content-table-wrap">
                      <table className="content-table">
                        <thead>
                          <tr>
                            <th>Content</th>
                            <th>Platform</th>
                            <th>Status</th>
                            <th>Planned for</th>
                            <th>
                              <span className="sr-only">Open</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((item) => (
                            <tr key={item.id}>
                              <td>
                                <button
                                  onClick={() => run(() => open(item.id))}
                                >
                                  <span
                                    className={`format-icon ${item.format.toLowerCase()}`}
                                  >
                                    {item.format === "Video" ? (
                                      <Play size={17} />
                                    ) : (
                                      <FileText size={17} />
                                    )}
                                  </span>
                                  <span>
                                    <b>{item.title}</b>
                                    <small>
                                      {item.format}
                                      {item.campaign?.name
                                        ? ` · ${item.campaign.name}`
                                        : ""}
                                    </small>
                                  </span>
                                </button>
                              </td>
                              <td>{item.platform}</td>
                              <td>
                                <Status value={item.status} />
                              </td>
                              <td>
                                {item.plannedAt ? (
                                  new Date(item.plannedAt).toLocaleDateString()
                                ) : (
                                  <span className="muted">Not planned</span>
                                )}
                              </td>
                              <td>
                                <button
                                  className="icon-button"
                                  aria-label={`Open ${item.title}`}
                                  onClick={() => run(() => open(item.id))}
                                >
                                  <ArrowRight size={17} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Blank
                      title={
                        query
                          ? "No matching content"
                          : "Your next great idea starts here"
                      }
                    >
                      Create your first draft or use your Brand Brain to
                      generate one with AI.
                    </Blank>
                  )}
                  <div className="table-foot">
                    {visible.length} shown · {total} total{" "}
                    {total > 100 && "· Showing the latest 100 items"}
                  </div>
                </section>
              ) : (
                <section className="panel calendar-panel">
                  <div className="section-top">
                    <div className="button-row">
                      <button
                        className="icon-button"
                        aria-label="Previous month"
                        onClick={() =>
                          setMonth(
                            new Date(
                              month.getFullYear(),
                              month.getMonth() - 1,
                              1,
                            ),
                          )
                        }
                      >
                        <ChevronLeft size={19} />
                      </button>
                      <h2>
                        {month.toLocaleDateString(undefined, {
                          month: "long",
                          year: "numeric",
                        })}
                      </h2>
                      <button
                        className="icon-button"
                        aria-label="Next month"
                        onClick={() =>
                          setMonth(
                            new Date(
                              month.getFullYear(),
                              month.getMonth() + 1,
                              1,
                            ),
                          )
                        }
                      >
                        <ChevronRight size={19} />
                      </button>
                    </div>
                    <span className="pill">
                      {Intl.DateTimeFormat().resolvedOptions().timeZone}
                    </span>
                  </div>
                  <div className="calendar-scroll">
                    <div className="calendar-grid">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (d) => (
                          <div className="day-label" key={d}>
                            {d}
                          </div>
                        ),
                      )}
                      {Array.from(
                        {
                          length:
                            Math.ceil(
                              (month.getDay() +
                                new Date(
                                  month.getFullYear(),
                                  month.getMonth() + 1,
                                  0,
                                ).getDate()) /
                                7,
                            ) * 7,
                        },
                        (_, i) => {
                          const day = new Date(
                            month.getFullYear(),
                            month.getMonth(),
                            i - month.getDay() + 1,
                          );
                          const same = day.getMonth() === month.getMonth();
                          const dayItems = items.filter(
                            (item) =>
                              item.plannedAt &&
                              new Date(item.plannedAt).toDateString() ===
                                day.toDateString(),
                          );
                          return (
                            <div
                              className={`calendar-day ${same ? "" : "outside"} ${day.toDateString() === new Date().toDateString() ? "today" : ""}`}
                              key={i}
                            >
                              <span>{day.getDate()}</span>
                              {dayItems.map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => run(() => open(item.id))}
                                >
                                  <small>{item.platform}</small>
                                  <b>{item.title}</b>
                                </button>
                              ))}
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                  <p className="field-help">
                    Add a planned date in any content draft to see it here.
                  </p>
                </section>
              )}
            </>
          )}
          {view === "campaigns" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Campaigns</h1>
                  <p>
                    Give each group of content a purpose and a shared direction.
                  </p>
                </div>
                <button
                  className="button primary"
                  disabled={!editable}
                  onClick={() => campaignDialog.current?.showModal()}
                >
                  <Plus size={17} />
                  New campaign
                </button>
              </div>
              <div className="campaign-grid">
                {campaigns.map((c) => (
                  <section className="panel campaign-card" key={c.id}>
                    <div className="section-top">
                      <span className="icon-tile">
                        <FolderOpen size={22} />
                      </span>
                      <span className="pill">
                        {c._count.content} content items
                      </span>
                    </div>
                    <h2>{c.name}</h2>
                    <p>{c.goal}</p>
                    {c.audience && (
                      <div className="campaign-detail">
                        <span>AUDIENCE</span>
                        {c.audience}
                      </div>
                    )}
                    {c.description && <p>{c.description}</p>}
                    <div className="campaign-dates">
                      {c.startsAt
                        ? new Date(c.startsAt).toLocaleDateString()
                        : "Start not set"}{" "}
                      —{" "}
                      {c.endsAt
                        ? new Date(c.endsAt).toLocaleDateString()
                        : "End not set"}
                    </div>
                    <button
                      className="text-button"
                      onClick={() =>
                        create({ ...emptyDraft, campaignId: c.id })
                      }
                    >
                      Add a draft <ArrowRight size={16} />
                    </button>
                  </section>
                ))}
              </div>
              {!campaigns.length && !loading && (
                <section className="panel">
                  <Blank title="Start with a shared goal">
                    Create a campaign, then link drafts to keep the work
                    connected.
                  </Blank>
                </section>
              )}
              <dialog ref={campaignDialog} className="modal">
                <div className="section-top">
                  <h2>Create a campaign</h2>
                  <button
                    className="icon-button"
                    aria-label="Close campaign dialog"
                    onClick={() => campaignDialog.current?.close()}
                  >
                    <X size={20} />
                  </button>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const values = Object.fromEntries(
                      new FormData(e.currentTarget),
                    );
                    run(async () => {
                      await api(base + "/campaigns", "POST", {
                        ...values,
                        startsAt: values.startsAt
                          ? new Date(values.startsAt as string).toISOString()
                          : null,
                        endsAt: values.endsAt
                          ? new Date(values.endsAt as string).toISOString()
                          : null,
                      });
                      campaignDialog.current?.close();
                      await load();
                    }, "Campaign created.");
                  }}
                >
                  <label>
                    Campaign name
                    <input name="name" required minLength={2} maxLength={160} />
                  </label>
                  <label>
                    Goal
                    <textarea
                      name="goal"
                      required
                      minLength={3}
                      maxLength={4000}
                    />
                  </label>
                  <label>
                    Audience
                    <input name="audience" maxLength={4000} />
                  </label>
                  <label>
                    Campaign brief
                    <textarea name="description" maxLength={4000} />
                  </label>
                  <div className="form-grid">
                    <label>
                      Start date
                      <input type="date" name="startsAt" />
                    </label>
                    <label>
                      End date
                      <input type="date" name="endsAt" />
                    </label>
                  </div>
                  {error && <div className="alert error">{error}</div>}
                  <button className="button primary" disabled={busy}>
                    Create campaign
                  </button>
                </form>
              </dialog>
            </>
          )}
          {view === "create" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow muted">
                    YOUR BRAND CONTEXT, PUT TO WORK
                  </span>
                  <h1>Create with AI</h1>
                  <p>
                    Start with what you want to achieve. Review every result
                    before using it.
                  </p>
                </div>
              </div>
              <section className="panel ai-composer">
                <div className="section-top">
                  <span className="ai-label">
                    <Sparkles size={20} />
                    Marketing assistant
                  </span>
                  <span className="pill">
                    {aiStatus.configured
                      ? "Provider configured"
                      : "Provider not configured"}
                  </span>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    generate(task, prompt);
                  }}
                >
                  <label className="sr-only" htmlFor="ai-prompt">
                    What would you like to create?
                  </label>
                  <textarea
                    id="ai-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    minLength={10}
                    maxLength={4000}
                    required
                    placeholder="Create a 30-second Instagram Reel introducing our new product…"
                  />
                  <div className="ai-controls">
                    <label>
                      <span className="sr-only">Generation type</span>
                      <select
                        value={task}
                        onChange={(e) => setTask(e.target.value)}
                      >
                        <option value="content">Content & script</option>
                        <option value="strategy">Marketing strategy</option>
                      </select>
                    </label>
                    <button
                      disabled={busy || !editable || !aiStatus.configured}
                      className="button primary"
                    >
                      <Sparkles size={16} />
                      Generate
                      {aiStatus.credits?.mode === "credits"
                        ? ` · ${aiStatus.credits.prices[task]} credits`
                        : ""}
                    </button>
                  </div>
                  <p className="field-help">
                    {aiStatus.credits?.mode === "credits" &&
                      `${aiStatus.credits.available} credits available; ${aiStatus.credits.reserved} reserved. The displayed quote is reserved when queued; interrupted provider usage requires review. `}
                    Generation uses the configured provider account. Cost
                    depends on its model and usage. Generated claims and advice
                    need your review.
                  </p>
                </form>
                {!aiStatus.configured && (
                  <div className="alert">
                    Ask your administrator to configure an AI provider and
                    model. You can create and review drafts manually while this
                    is being connected.
                  </div>
                )}
                {aiStatus.configured && !aiStatus.workerActive && (
                  <div className="alert error">
                    The generation worker is not responding. Queued requests
                    will wait until it restarts.
                  </div>
                )}
              </section>
              <div className="section-heading">
                <h2>Generation history</h2>
                <span className="muted">{jobs.length} recent requests</span>
              </div>
              <div className="job-list">
                {jobs
                  .filter((j) => j.task !== "scene")
                  .map((j) => (
                    <section className="panel job-card" key={j.id}>
                      <div className="section-top">
                        <div>
                          <h3>
                            {j.output?.title ||
                              (j.task === "strategy"
                                ? "Marketing strategy"
                                : "Content generation")}
                          </h3>
                          <small className="muted">
                            {new Date(j.createdAt).toLocaleString()} · {j.task}
                          </small>
                        </div>
                        <Status value={j.status} />
                      </div>
                      <p>{j.input.prompt}</p>
                      {j.agentRun && (
                        <div className="field-help">
                          Agent graph {j.agentRun.graphVersion} ·{" "}
                          {j.agentRun._count.steps} durable steps ·{" "}
                          <Status value={j.agentRun.state} />
                        </div>
                      )}
                      {j.error && <div className="alert error">{j.error}</div>}
                      {j.status === "QUEUED" && editable && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await api(
                                base + `/ai/jobs/${j.id}/cancel`,
                                "POST",
                              );
                              setJobs(await api(base + "/ai/jobs"));
                            }, "Queued generation canceled.")
                          }
                        >
                          Cancel request
                        </button>
                      )}
                      {j.output && (
                        <>
                          {j.agentRun?.finalReview?.findings?.length > 0 && (
                            <details>
                              <summary>
                                Agent critique and compliance findings
                              </summary>
                              <ul>
                                {j.agentRun.finalReview.findings.map(
                                  (finding: Any, index: number) => (
                                    <li key={index}>
                                      <b>{finding.severity}:</b> {finding.label}
                                    </li>
                                  ),
                                )}
                              </ul>
                            </details>
                          )}
                          {j.task === "strategy" ? (
                            <div className="strategy-result">
                              <p>{j.output.positioning}</p>
                              <div className="pillar-grid">
                                {j.output.pillars.map((p: Any) => (
                                  <div key={p.name}>
                                    <h3>{p.name}</h3>
                                    <p>{p.purpose}</p>
                                  </div>
                                ))}
                              </div>
                              <h3>Content ideas</h3>
                              {j.output.ideas.map((idea: Any, i: number) => (
                                <div className="idea-row" key={i}>
                                  <div>
                                    <b>{idea.title}</b>
                                    <p>{idea.hook}</p>
                                    <small>
                                      {idea.platform} · {idea.purpose}
                                    </small>
                                  </div>
                                  <button
                                    className="button"
                                    disabled={!editable}
                                    onClick={() =>
                                      create({
                                        ...emptyDraft,
                                        title: idea.title,
                                        platform: platforms.includes(
                                          idea.platform,
                                        )
                                          ? idea.platform
                                          : "LinkedIn",
                                        hook: idea.hook,
                                        cta: idea.cta,
                                      })
                                    }
                                  >
                                    Use idea
                                  </button>
                                </div>
                              ))}
                              <p>
                                <b>Cadence:</b> {j.output.cadence}
                              </p>
                              <details>
                                <summary>Assumptions and experiments</summary>
                                <ul>
                                  {j.output.assumptions.map((s: string) => (
                                    <li key={s}>{s}</li>
                                  ))}
                                </ul>
                                <ul>
                                  {j.output.experiments.map((s: string) => (
                                    <li key={s}>{s}</li>
                                  ))}
                                </ul>
                              </details>
                            </div>
                          ) : (
                            <div className="generated-copy">
                              <b>{j.output.hook}</b>
                              <p>{j.output.body}</p>
                              <p>{j.output.cta}</p>
                              {j.output.scenes?.length > 0 && (
                                <span className="pill">
                                  {j.output.scenes.length} storyboard scenes
                                </span>
                              )}
                            </div>
                          )}
                          <div className="button-row">
                            {j.task === "content" && (
                              <button
                                className="button primary"
                                disabled={
                                  !editable ||
                                  (j.agentRun &&
                                    j.agentRun.state !== "APPROVED")
                                }
                                onClick={() =>
                                  create({ ...emptyDraft, ...j.output })
                                }
                              >
                                Review as a draft <ArrowRight size={16} />
                              </button>
                            )}
                            {j.agentRun?.state === "AWAITING_REVIEW" &&
                              approver && (
                                <>
                                  <button
                                    className="button primary"
                                    disabled={
                                      busy ||
                                      j.agentRun.finalReview?.passed === false
                                    }
                                    onClick={() => reviewAgentJob(j, "approve")}
                                  >
                                    <Check size={16} /> Approve agent result
                                  </button>
                                  <button
                                    className="button"
                                    disabled={busy}
                                    onClick={() => reviewAgentJob(j, "reject")}
                                  >
                                    <X size={16} /> Reject
                                  </button>
                                </>
                              )}
                            {j.agentRun && (
                              <button
                                className="button"
                                onClick={() =>
                                  run(async () => {
                                    const trace = await api(
                                      base + `/ai/jobs/${j.id}/trace`,
                                    );
                                    download(`agent-trace-${j.id}.json`, trace);
                                  }, "Agent trace exported.")
                                }
                              >
                                <Download size={16} /> Agent trace
                              </button>
                            )}
                            <button
                              className="button"
                              onClick={() =>
                                download(`${j.task}-${j.id}.json`, j.output)
                              }
                            >
                              <Download size={16} />
                              Export
                            </button>
                          </div>
                        </>
                      )}
                    </section>
                  ))}
              </div>
              {!jobs.length && !loading && (
                <Blank title="Your first request goes here">
                  Save your Brand Brain first so generated work reflects your
                  business.
                </Blank>
              )}
            </>
          )}
          {view === "analytics" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Performance & usage</h1>
                  <p>
                    Real workspace activity. External channel performance
                    appears only when a source is connected.
                  </p>
                </div>
                <button
                  className="button"
                  onClick={() =>
                    download("workspace-report.json", {
                      content: items,
                      aiUsage: aiStatus.usage,
                      generatedAt: new Date().toISOString(),
                      limit: 100,
                    })
                  }
                >
                  <Download size={16} />
                  Export report
                </button>
              </div>
              <div className="metrics">
                <section className="metric">
                  <span>Content in workspace</span>
                  <b>{total}</b>
                  <small>Excludes archived content</small>
                </section>
                <section className="metric">
                  <span>Approved drafts</span>
                  <b>{items.filter((i) => i.status === "APPROVED").length}</b>
                  <small>Among the latest 100 items</small>
                </section>
                <section className="metric">
                  <span>AI provider calls</span>
                  <b>{aiStatus.usage.length}</b>
                  <small>Latest 100 logged attempts</small>
                </section>
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <h3>Content workflow</h3>
                  {items.length ? (
                    <div className="workflow-chart">
                      {["DRAFT", "REVIEW", "APPROVED"].map((s) => {
                        const n = items.filter((i) => i.status === s).length;
                        return (
                          <div key={s}>
                            <span>{s.toLowerCase()}</span>
                            <div>
                              <i
                                style={{
                                  width: `${(n / items.length) * 100}%`,
                                }}
                              />
                            </div>
                            <b>{n}</b>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Blank title="No content activity yet">
                      Create your first draft to see your workflow here.
                    </Blank>
                  )}
                </section>
                <section className="panel">
                  <Blank title="Channel data is unavailable">
                    Connect an authorized analytics source before tracking
                    reach, engagement, followers or revenue.
                  </Blank>
                </section>
              </div>
              <section className="panel usage-panel">
                <h3>AI usage history</h3>
                {aiStatus.usage.length ? (
                  <div className="content-table-wrap">
                    <table className="content-table">
                      <thead>
                        <tr>
                          <th>Provider / model</th>
                          <th>Route policy</th>
                          <th>Tokens in / out</th>
                          <th>Result</th>
                          <th>Estimated cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiStatus.usage.map((u: Any) => (
                          <tr key={u.id}>
                            <td>
                              {u.provider} / {u.model}
                              {u.fallback && <small> · fallback</small>}
                            </td>
                            <td>
                              {u.qualityTier || "legacy"}
                              {u.retryCount > 0 && (
                                <small> · retry {u.retryCount}</small>
                              )}
                            </td>
                            <td>
                              {u.inputTokens ?? "—"} / {u.outputTokens ?? "—"}
                            </td>
                            <td>
                              {u.success ? "Succeeded" : "Failed"}
                              {u.failureCode && (
                                <small> · {u.failureCode}</small>
                              )}
                              {u.unknownOutcome && (
                                <small>
                                  {" "}
                                  · provider charge requires review
                                </small>
                              )}
                            </td>
                            <td>
                              {u.estimatedCostUsd == null
                                ? "Rates unavailable"
                                : `$${u.estimatedCostUsd.toFixed(5)}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>No provider calls have been recorded.</p>
                )}
                <p className="field-help">
                  Cost estimates use configured model rates and returned token
                  counts. Your provider invoice is authoritative.
                </p>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
