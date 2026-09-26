"use client";
import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Brain,
  Palette,
  CalendarDays,
  FolderOpen,
  Lightbulb,
  BarChart3,
  Plug,
  Settings,
  Activity,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Sparkles,
  Check,
  ChevronRight,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  Search,
  Users,
  Download,
  RotateCcw,
  ShieldCheck,
  ChevronDown,
  CheckCircle2,
  Clock3,
  PenLine,
  Layers3,
  Film,
  Image as ImageIcon,
} from "lucide-react";
import { api, download } from "./api-client";
import { BrandMark } from "./auth-ui";
import ContentWorkspace from "./content-workspace";
import Team from "./team";
import MediaWorkspace from "./media-workspace";
import OperationsWorkspace from "./operations-workspace";
import CreditsWorkspace from "./credits-workspace";
type Any = Record<string, any>;
const initialProfile = {
  name: "",
  businessType: "",
  industry: "",
  website: "",
  products: "",
  pricing: "",
  offers: "",
  audience: "",
  problems: "",
  benefits: "",
  usp: "",
  competitors: "",
  market: "",
  languages: "English",
  goals: "",
  platforms: [] as string[],
};
const initialDna = {
  voice: "",
  vocabulary: "",
  avoid: "",
  humor: "",
  storytelling: "",
  visualStyle: "",
  colors: [] as string[],
  typography: "",
  editingStyle: "",
  pacing: "",
  music: "",
  captionStyle: "",
  thumbnailStyle: "",
  hookStyle: "",
  ctaStyle: "",
};
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
export function Empty({
  icon: Icon = Layers3,
  title,
  children,
  action,
}: {
  icon?: any;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={25} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Field({
  name,
  label,
  value,
  onChange,
  placeholder,
  area = false,
  required = false,
  type = "text",
}: Any) {
  return (
    <label>
      {label}
      {area ? (
        <textarea
          name={name}
          value={value || ""}
          onChange={(e) => onChange(name, e.target.value)}
          placeholder={placeholder}
          maxLength={4000}
          required={required}
        />
      ) : (
        <input
          name={name}
          type={type}
          value={value || ""}
          onChange={(e) => onChange(name, e.target.value)}
          placeholder={placeholder}
          maxLength={500}
          required={required}
        />
      )}
    </label>
  );
}
export default function Workspace({
  session,
  onReload,
}: {
  session: Any;
  onReload: () => void;
}) {
  const [navVersion, setNavVersion] = useState(0),
    [contentDirty, setContentDirty] = useState(false);
  const [orgId, setOrgId] = useState(session.memberships[0].organizationId),
    [view, setView] = useState("dashboard"),
    [navOpen, setNavOpen] = useState(false),
    [dark, setDark] = useState(false);
  const [brain, setBrain] = useState<Any | null>(null),
    [progress, setProgress] = useState<Any>({ percent: 0, steps: [] }),
    [activity, setActivity] = useState<Any[]>([]),
    [versions, setVersions] = useState<Any[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const member = session.memberships.find(
      (m: Any) => m.organizationId === orgId,
    ),
    org = member.organization,
    editable = ["OWNER", "ADMIN", "EDITOR"].includes(member.role),
    admin = ["OWNER", "ADMIN"].includes(member.role);
  const [profile, setProfile] = useState<Any>(initialProfile),
    [dna, setDna] = useState<Any>(initialDna),
    [dirty, setDirty] = useState(false);
  const base = `/workspaces/${orgId}`;
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [b, a, v] = await Promise.all([
        api(base + "/brand"),
        api(base + "/activity"),
        api(base + "/brand/versions"),
      ]);
      setBrain(b.brain);
      setProgress(b.progress);
      setProfile({ ...initialProfile, name: org.name, ...b.brain?.profile });
      setDna({ ...initialDna, ...b.brain?.creativeDna });
      setActivity(a);
      setVersions(v);
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [base, org.name]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const value = localStorage.getItem("organic-theme") === "dark";
    setDark(value);
    document.documentElement.dataset.theme = value ? "dark" : "light";
  }, []);
  useEffect(() => {
    function protect(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);
  useEffect(() => {
    const timer = setInterval(
      () => api("/auth/renew", "POST").catch(() => {}),
      6 * 3600000,
    );
    return () => clearInterval(timer);
  }, []);
  function go(next: string) {
    if (contentDirty && !confirm("Discard unsaved content changes?")) return;
    setContentDirty(false);
    setNavVersion((v) => v + 1);
    setView(next);
    setNavOpen(false);
    setError("");
    setNotice("");
  }
  function theme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("organic-theme", next ? "dark" : "light");
  }
  async function action(fn: () => Promise<any>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    await action(async () => {
      const r = await api(base + "/brand", "PUT", {
        profile,
        creativeDna: dna,
        revision: brain?.revision || 0,
      });
      setBrain(r.brain);
      setProgress(r.progress);
      setDirty(false);
      setVersions(await api(base + "/brand/versions"));
      setActivity(await api(base + "/activity"));
    }, "Brand knowledge saved.");
  }
  function updateProfile(key: string, value: any) {
    setProfile((p) => ({ ...p, [key]: value }));
    setDirty(true);
  }
  function updateDna(key: string, value: any) {
    setDna((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }
  const items = [
    { id: "dashboard", label: "Command center", icon: LayoutDashboard },
    { id: "brand", label: "Brand Brain", icon: Brain },
    { id: "dna", label: "Creative DNA", icon: Palette },
    { id: "create", label: "Create with AI", icon: Sparkles },
    { id: "content", label: "Content library", icon: FolderOpen },
    { id: "assets", label: "Asset library", icon: ImageIcon },
    { id: "video", label: "Video studio", icon: Film },
    { id: "campaigns", label: "Campaigns", icon: Lightbulb },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "analytics", label: "Performance", icon: BarChart3 },
    { id: "activity", label: "Activity", icon: Activity },
    ...(admin
      ? [
          { id: "operations", label: "Workspace health", icon: ShieldCheck },
          { id: "credits", label: "Credits & usage", icon: Activity },
        ]
      : []),
  ];
  const titles: Any = {
    dashboard: "Command center",
    brand: "Brand Brain",
    dna: "Creative DNA",
    activity: "Activity",
    settings: "Workspace settings",
    integrations: "Connections",
    create: "Create with AI",
    content: "Content library",
    campaigns: "Campaigns",
    calendar: "Calendar",
    analytics: "Performance",
    assets: "Asset library",
    video: "Video studio",
    operations: "Workspace health",
    credits: "Credits & usage",
  };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {navOpen && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}
      <aside className={`sidebar ${navOpen ? "open" : ""}`}>
        <div className="wordmark">
          <BrandMark />
          organic
          <button
            className="mobile-close icon-button"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-avatar">
            {org.name.slice(0, 1).toUpperCase()}
          </span>
          <label>
            <span className="sr-only">Active workspace</span>
            <select
              value={orgId}
              onChange={(e) => {
                if (
                  (dirty || contentDirty) &&
                  !confirm("Discard unsaved workspace changes?")
                )
                  return;
                setOrgId(e.target.value);
                go("dashboard");
              }}
            >
              {session.memberships.map((m: Any) => (
                <option key={m.organizationId} value={m.organizationId}>
                  {m.organization.name}
                </option>
              ))}
            </select>
            <small>{member.role.toLowerCase()} workspace</small>
          </label>
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? "active" : ""}`}
              onClick={() => go(id)}
              aria-current={view === id ? "page" : undefined}
            >
              <Icon size={19} />
              {label}
              {id === "brand" && brain && (
                <Check size={14} className="nav-end" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="brand-progress">
            <div>
              <span>Your brand foundation</span>
              <b>{progress.percent}%</b>
            </div>
            <progress value={progress.percent} max={100} />
            <button onClick={() => go("brand")}>
              Continue setup <ArrowRight size={14} />
            </button>
          </div>
          <button
            className={`nav-item ${view === "integrations" ? "active" : ""}`}
            onClick={() => go("integrations")}
          >
            <Plug size={19} />
            Connections
          </button>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => go("settings")}
          >
            <Settings size={19} />
            Settings
          </button>
          <div className="sidebar-user">
            <span className="user-avatar">{session.user.name.slice(0, 1)}</span>
            <div>
              <b>{session.user.name}</b>
              <small>{session.user.email}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              title="Sign out"
              onClick={() =>
                action(async () => {
                  await api("/auth/logout", "POST");
                  onReload();
                }, "")
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>{titles[view]}</strong>
          </div>
          <div className="topbar-right">
            <span className="timezone">{org.timezone}</span>
            <button
              className="icon-button"
              onClick={theme}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <span className="user-avatar small">
              {session.user.name.slice(0, 1)}
            </span>
          </div>
        </header>
        <main id="main" className="main-content">
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button className="text-button" onClick={() => setError("")}>
                Dismiss
              </button>
            </div>
          )}
          {notice && (
            <div className="toast" role="status">
              <CheckCircle2 size={18} />
              {notice}
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="page-loading" role="status">
              Loading workspace…
            </div>
          ) : (
            <>
              {[
                "create",
                "content",
                "campaigns",
                "calendar",
                "analytics",
              ].includes(view) && (
                <ContentWorkspace
                  key={`${base}:${view}:${navVersion}`}
                  base={base}
                  view={view}
                  role={member.role}
                  onNavigate={go}
                  onDirtyChange={setContentDirty}
                />
              )}
              {["assets", "video"].includes(view) && (
                <MediaWorkspace
                  key={`${base}:${view}:${navVersion}`}
                  base={base}
                  role={member.role}
                  view={view}
                  onNavigate={go}
                />
              )}
              {view === "operations" && admin && (
                <OperationsWorkspace base={base} />
              )}
              {view === "credits" && admin && (
                <CreditsWorkspace
                  key={base}
                  base={base}
                  organizationId={orgId}
                />
              )}
              {view === "dashboard" && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow muted">
                        YOUR MARKETING, ALL TOGETHER
                      </span>
                      <h1>
                        Let’s make your next move,{" "}
                        {session.user.name.split(" ")[0]}.
                      </h1>
                      <p>
                        {profile.goals ||
                          "A clear brand foundation is the start of every good marketing decision."}
                      </p>
                    </div>
                    <button
                      className="button primary"
                      onClick={() => go(brain ? "create" : "brand")}
                    >
                      <Plus size={18} />
                      {brain ? "Create with AI" : "Set up your brand"}
                    </button>
                  </div>
                  <div className="dashboard-grid">
                    <section className="focus-panel">
                      <div className="section-label">
                        <Sparkles size={18} />
                        YOUR NEXT BEST STEP{" "}
                        <span>
                          {Math.min(
                            4,
                            progress.steps.filter((s: Any) => s.done).length +
                              1,
                          )
                            .toString()
                            .padStart(2, "0")}{" "}
                          / 04
                        </span>
                      </div>
                      <h2>
                        {progress.percent === 100
                          ? "Your foundation is in place."
                          : "Good marketing starts with knowing your business."}
                      </h2>
                      <p>
                        {progress.percent === 100
                          ? "Keep your business knowledge current as your products and audience evolve. Your saved profile provides context for future AI work."
                          : "Give your workspace the context behind your business. Start with your offer, your audience and what makes your brand different."}
                      </p>
                      <button
                        className="button lime"
                        onClick={() =>
                          go(progress.percent === 100 ? "create" : "brand")
                        }
                      >
                        {progress.percent === 100
                          ? "Create with your brand"
                          : "Build your Brand Brain"}
                        <ArrowRight size={17} />
                      </button>
                      <div className="focus-foot">
                        <ShieldCheck size={15} /> You stay in control of every
                        important decision.
                      </div>
                    </section>
                    <section className="panel setup-checklist">
                      <div className="section-top">
                        <h3>Your foundation</h3>
                        <span className="pill">
                          {progress.percent}% complete
                        </span>
                      </div>
                      <p>A little context goes a long way.</p>
                      {progress.steps.map((s: Any, i: number) => (
                        <button
                          key={s.label}
                          onClick={() => go(i === 3 ? "dna" : "brand")}
                        >
                          <span
                            className={`step-check ${s.done ? "done" : ""}`}
                          >
                            {s.done ? <Check size={13} /> : i + 1}
                          </span>
                          <span>{s.label}</span>
                          <ChevronRight size={15} />
                        </button>
                      ))}
                    </section>
                  </div>
                  <div className="metrics">
                    <section className="metric">
                      <span>Brand knowledge</span>
                      <b>{brain ? "Saved" : "Not set up"}</b>
                      <small>
                        {brain
                          ? `Revision ${brain.revision} · ${new Date(brain.updatedAt).toLocaleDateString()}`
                          : "Tell us about your business"}
                      </small>
                    </section>
                    <section className="metric">
                      <span>Creative identity</span>
                      <b>
                        {dna.voice && dna.visualStyle
                          ? "Defined"
                          : "Needs your input"}
                      </b>
                      <small>Voice, visuals and creative rules</small>
                    </section>
                    <section className="metric">
                      <span>Channel performance</span>
                      <b>—</b>
                      <small>No connected analytics source</small>
                    </section>
                  </div>
                  <div className="dashboard-grid bottom-grid">
                    <section className="panel">
                      <div className="section-top">
                        <h3>Recent activity</h3>
                        <button
                          className="text-button"
                          onClick={() => go("activity")}
                        >
                          View all <ArrowUpRight size={15} />
                        </button>
                      </div>
                      <ActivityList rows={activity.slice(0, 4)} />
                    </section>
                    <section className="panel brand-summary">
                      <div className="section-top">
                        <h3>Brand at a glance</h3>
                        <Brain size={19} />
                      </div>
                      {brain ? (
                        <>
                          <h2>{profile.name}</h2>
                          <p>{profile.usp || profile.products}</p>
                          <div className="tag-row">
                            {profile.platforms.map((p: string) => (
                              <span key={p} className="pill">
                                {p}
                              </span>
                            ))}
                          </div>
                          <button
                            className="text-button"
                            onClick={() => go("brand")}
                          >
                            Open Brand Brain <ArrowRight size={16} />
                          </button>
                        </>
                      ) : (
                        <Empty icon={Brain} title="Your brand belongs here">
                          Add your audience, offer and positioning to bring this
                          workspace to life.
                        </Empty>
                      )}
                    </section>
                  </div>
                </>
              )}
              {(view === "brand" || view === "dna") && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow muted">
                        THE CONTEXT BEHIND EVERY CREATIVE DECISION
                      </span>
                      <h1>{titles[view]}</h1>
                      <p>
                        {view === "brand"
                          ? "A living source of truth for what you do and who you serve."
                          : "The voice, visuals and creative rules that make your work yours."}
                      </p>
                    </div>
                    <span className="pill">
                      {dirty
                        ? "Unsaved changes"
                        : brain
                          ? `Saved · revision ${brain.revision}`
                          : "Not saved yet"}
                    </span>
                  </div>
                  <form className="brand-form" onSubmit={save}>
                    <fieldset disabled={!editable || busy}>
                      <div className="form-main">
                        {view === "brand" ? (
                          <>
                            <section className="panel">
                              <div className="form-section-heading">
                                <span>01</span>
                                <div>
                                  <h3>The business</h3>
                                  <p>
                                    Start with what your customers should
                                    understand.
                                  </p>
                                </div>
                              </div>
                              <div className="form-grid">
                                <Field
                                  name="name"
                                  label="Brand name"
                                  value={profile.name}
                                  onChange={updateProfile}
                                  required
                                />
                                <Field
                                  name="website"
                                  label="Website"
                                  type="url"
                                  value={profile.website}
                                  onChange={updateProfile}
                                  placeholder="https://yourbrand.com"
                                />
                                <Field
                                  name="businessType"
                                  label="Business type"
                                  value={profile.businessType}
                                  onChange={updateProfile}
                                  placeholder="SaaS, creator, local business…"
                                />
                                <Field
                                  name="industry"
                                  label="Industry"
                                  value={profile.industry}
                                  onChange={updateProfile}
                                  placeholder="Your category"
                                />
                              </div>
                              <Field
                                name="products"
                                label="Products and services"
                                value={profile.products}
                                onChange={updateProfile}
                                area
                                placeholder="What do you offer, and how does it help?"
                              />
                              <Field
                                name="usp"
                                label="What makes you different?"
                                value={profile.usp}
                                onChange={updateProfile}
                                area
                                placeholder="Specific strengths, proof points and positioning"
                              />
                              <details>
                                <summary>
                                  Pricing, offers and competitors
                                </summary>
                                <div className="form-grid">
                                  <Field
                                    name="pricing"
                                    label="Pricing"
                                    value={profile.pricing}
                                    onChange={updateProfile}
                                    area
                                  />
                                  <Field
                                    name="offers"
                                    label="Current offers"
                                    value={profile.offers}
                                    onChange={updateProfile}
                                    area
                                  />
                                </div>
                                <Field
                                  name="competitors"
                                  label="Competitors"
                                  value={profile.competitors}
                                  onChange={updateProfile}
                                  area
                                  placeholder="Names, websites and what you do differently"
                                />
                              </details>
                            </section>
                            <section className="panel">
                              <div className="form-section-heading">
                                <span>02</span>
                                <div>
                                  <h3>The people you serve</h3>
                                  <p>Write about real needs and problems.</p>
                                </div>
                              </div>
                              <Field
                                name="audience"
                                label="Target audience"
                                value={profile.audience}
                                onChange={updateProfile}
                                area
                              />
                              <div className="form-grid">
                                <Field
                                  name="problems"
                                  label="Customer problems"
                                  value={profile.problems}
                                  onChange={updateProfile}
                                  area
                                />
                                <Field
                                  name="benefits"
                                  label="Benefits you provide"
                                  value={profile.benefits}
                                  onChange={updateProfile}
                                  area
                                />
                                <Field
                                  name="market"
                                  label="Location / market"
                                  value={profile.market}
                                  onChange={updateProfile}
                                  placeholder="India, global, a specific city…"
                                />
                                <Field
                                  name="languages"
                                  label="Languages"
                                  value={profile.languages}
                                  onChange={updateProfile}
                                />
                              </div>
                            </section>
                            <section className="panel">
                              <div className="form-section-heading">
                                <span>03</span>
                                <div>
                                  <h3>Where you want to go</h3>
                                  <p>
                                    Choose the outcomes that matter for your
                                    business.
                                  </p>
                                </div>
                              </div>
                              <Field
                                name="goals"
                                label="Marketing goals"
                                value={profile.goals}
                                onChange={updateProfile}
                                area
                                placeholder="For example: qualified leads, awareness, community growth"
                              />
                              <label>Focus platforms</label>
                              <div className="platform-options">
                                {platforms.map((p) => (
                                  <label className="check-option" key={p}>
                                    <input
                                      type="checkbox"
                                      checked={profile.platforms.includes(p)}
                                      onChange={(e) =>
                                        updateProfile(
                                          "platforms",
                                          e.target.checked
                                            ? [...profile.platforms, p]
                                            : profile.platforms.filter(
                                                (v: string) => v !== p,
                                              ),
                                        )
                                      }
                                    />
                                    {p}
                                  </label>
                                ))}
                              </div>
                            </section>
                          </>
                        ) : (
                          <>
                            <section className="panel">
                              <div className="form-section-heading">
                                <span>01</span>
                                <div>
                                  <h3>How your brand sounds</h3>
                                  <p>Give your content a recognizable voice.</p>
                                </div>
                              </div>
                              <Field
                                name="voice"
                                label="Brand voice and tone"
                                value={dna.voice}
                                onChange={updateDna}
                                area
                                placeholder="Helpful and direct. Confident without making exaggerated claims."
                              />
                              <div className="form-grid">
                                <Field
                                  name="vocabulary"
                                  label="Words and phrases to use"
                                  value={dna.vocabulary}
                                  onChange={updateDna}
                                  area
                                />
                                <Field
                                  name="avoid"
                                  label="Words and claims to avoid"
                                  value={dna.avoid}
                                  onChange={updateDna}
                                  area
                                />
                                <Field
                                  name="humor"
                                  label="Humor style"
                                  value={dna.humor}
                                  onChange={updateDna}
                                />
                                <Field
                                  name="hookStyle"
                                  label="Hook style"
                                  value={dna.hookStyle}
                                  onChange={updateDna}
                                />
                              </div>
                              <Field
                                name="storytelling"
                                label="Storytelling approach"
                                value={dna.storytelling}
                                onChange={updateDna}
                                area
                              />
                              <Field
                                name="ctaStyle"
                                label="Call-to-action style"
                                value={dna.ctaStyle}
                                onChange={updateDna}
                              />
                            </section>
                            <section className="panel">
                              <div className="form-section-heading">
                                <span>02</span>
                                <div>
                                  <h3>How your brand looks</h3>
                                  <p>Keep the creative direction consistent.</p>
                                </div>
                              </div>
                              <Field
                                name="visualStyle"
                                label="Visual identity"
                                value={dna.visualStyle}
                                onChange={updateDna}
                                area
                                placeholder="Composition, photography and visual references"
                              />
                              <div className="form-grid">
                                <Field
                                  name="typography"
                                  label="Typography"
                                  value={dna.typography}
                                  onChange={updateDna}
                                />
                                <label>
                                  Brand colors
                                  <div className="color-inputs">
                                    {[0, 1, 2].map((i) => (
                                      <input
                                        key={i}
                                        type="color"
                                        aria-label={`Brand color ${i + 1}`}
                                        value={
                                          dna.colors[i] ||
                                          ["#335be7", "#c8f34d", "#19221f"][i]
                                        }
                                        onChange={(e) => {
                                          const colors = [...dna.colors];
                                          while (colors.length < 3)
                                            colors.push(
                                              ["#335be7", "#c8f34d", "#19221f"][
                                                colors.length
                                              ],
                                            );
                                          colors[i] = e.target.value;
                                          updateDna("colors", colors);
                                        }}
                                      />
                                    ))}
                                  </div>
                                </label>
                                <Field
                                  name="captionStyle"
                                  label="Caption style"
                                  value={dna.captionStyle}
                                  onChange={updateDna}
                                />
                                <Field
                                  name="thumbnailStyle"
                                  label="Thumbnail style"
                                  value={dna.thumbnailStyle}
                                  onChange={updateDna}
                                />
                              </div>
                              <details>
                                <summary>Video and audio direction</summary>
                                <Field
                                  name="editingStyle"
                                  label="Editing style"
                                  value={dna.editingStyle}
                                  onChange={updateDna}
                                  area
                                />
                                <div className="form-grid">
                                  <Field
                                    name="pacing"
                                    label="Pacing"
                                    value={dna.pacing}
                                    onChange={updateDna}
                                  />
                                  <Field
                                    name="music"
                                    label="Music preferences"
                                    value={dna.music}
                                    onChange={updateDna}
                                  />
                                </div>
                              </details>
                            </section>
                          </>
                        )}
                      </div>
                    </fieldset>
                    <aside className="form-side">
                      <section className="panel">
                        <Brain size={25} />
                        <h3>
                          {view === "brand"
                            ? "Context that stays with you"
                            : "Keep it unmistakably yours"}
                        </h3>
                        <p>
                          {view === "brand"
                            ? "Your profile is saved to this workspace. You can update it as your business changes."
                            : "Creative DNA is stored separately from business knowledge so each can evolve intentionally."}
                        </p>
                        <button
                          className="button primary wide"
                          disabled={!editable || busy}
                        >
                          {busy ? "Saving…" : "Save brand"}
                          <Check size={16} />
                        </button>
                        {!editable && (
                          <small>Your role has read-only access.</small>
                        )}
                        <span className="save-note">
                          {dirty
                            ? "You have unsaved changes."
                            : "All saved changes are versioned."}
                        </span>
                      </section>
                      <section className="panel">
                        <div className="section-top">
                          <h3>Version history</h3>
                          <Clock3 size={16} />
                        </div>
                        {versions.length ? (
                          versions.slice(0, 5).map((v) => (
                            <div className="version-row" key={v.id}>
                              <div>
                                <b>Revision {v.revision}</b>
                                <small>
                                  {new Date(v.createdAt).toLocaleString()}
                                </small>
                              </div>
                              {editable && v.revision !== brain?.revision && (
                                <button
                                  type="button"
                                  className="icon-button"
                                  title={`Restore revision ${v.revision}`}
                                  aria-label={`Restore revision ${v.revision}`}
                                  onClick={() =>
                                    action(async () => {
                                      await api(
                                        base + `/brand/restore/${v.revision}`,
                                        "POST",
                                        { revision: brain?.revision },
                                      );
                                      await load();
                                    }, "Brand version restored.")
                                  }
                                >
                                  <RotateCcw size={16} />
                                </button>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="small-copy">
                            Your first save starts your version history.
                          </p>
                        )}
                      </section>
                    </aside>
                  </form>
                </>
              )}
              {view === "activity" && (
                <>
                  <div className="page-heading">
                    <div>
                      <h1>Workspace activity</h1>
                      <p>A record of changes across {org.name}.</p>
                    </div>
                    <button
                      className="button"
                      onClick={() =>
                        download("workspace-activity.json", activity)
                      }
                    >
                      <Download size={16} />
                      Export
                    </button>
                  </div>
                  <section className="panel">
                    <ActivityList rows={activity} />
                  </section>
                </>
              )}
              {view === "integrations" && (
                <>
                  <div className="page-heading">
                    <div>
                      <h1>Connections</h1>
                      <p>Bring your tools into the marketing workflow.</p>
                    </div>
                  </div>
                  <div className="alert">
                    AI providers are configured by your administrator. Social
                    publishing, generated media and billing integrations are not
                    available in this build.
                  </div>
                  <section className="panel connection-list">
                    <div>
                      <div className="connection-icon">
                        <Film size={22} />
                      </div>
                      <div>
                        <h3>Media library & video rendering</h3>
                        <p>
                          Upload your media, attach it to scenes, and render an
                          MP4 for review and download.
                        </p>
                      </div>
                      <button className="button" onClick={() => go("assets")}>
                        Open assets
                      </button>
                    </div>
                    {[
                      "AI text generation",
                      "Image & video generation",
                      "Social publishing",
                      "Performance analytics",
                      "Stripe billing",
                    ].map((label, i) => (
                      <div key={label}>
                        <div className="connection-icon">
                          {i === 0 ? (
                            <Sparkles size={22} />
                          ) : i === 2 ? (
                            <Plug size={22} />
                          ) : (
                            <Layers3 size={22} />
                          )}
                        </div>
                        <div>
                          <h3>{label}</h3>
                          <p>
                            {i === 0
                              ? "Text generation supports a primary and fallback provider; configure server credentials, model and rates."
                              : i === 2
                                ? "Requires official platform authorization and a publishing adapter."
                                : "Not implemented in the current foundation."}
                          </p>
                        </div>
                        <span className="pill">
                          {i === 0 ? "Server configuration" : "Not available"}
                        </span>
                      </div>
                    ))}
                  </section>
                </>
              )}
              {view === "settings" && (
                <>
                  <div className="page-heading">
                    <div>
                      <h1>Workspace settings</h1>
                      <p>Manage your business space and account.</p>
                    </div>
                    <button
                      className="button"
                      onClick={() =>
                        download("brand-export.json", {
                          organization: org,
                          brand: brain,
                          versions,
                        })
                      }
                    >
                      <Download size={16} />
                      Export brand data
                    </button>
                  </div>
                  <div className="settings-grid">
                    <section className="panel">
                      <h3>Workspace details</h3>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const data = Object.fromEntries(
                            new FormData(e.currentTarget),
                          );
                          action(async () => {
                            await api(base, "PATCH", data);
                            onReload();
                          }, "Workspace updated.");
                        }}
                      >
                        <label>
                          Name
                          <input
                            name="name"
                            defaultValue={org.name}
                            minLength={2}
                            maxLength={100}
                            required
                            disabled={!admin}
                          />
                        </label>
                        <label>
                          Timezone
                          <input
                            name="timezone"
                            defaultValue={org.timezone}
                            required
                            disabled={!admin}
                          />
                        </label>
                        <button
                          disabled={busy || !admin}
                          className="button primary"
                        >
                          Save workspace
                        </button>
                      </form>
                    </section>
                    <section className="panel">
                      <h3>Your account</h3>
                      <div className="account-row">
                        <span>Email</span>
                        <b>{session.user.email}</b>
                      </div>
                      <div className="account-row">
                        <span>Role</span>
                        <span className="pill">{member.role}</span>
                      </div>
                      <div className="account-row">
                        <span>Email verification</span>
                        <b>
                          {session.user.verifiedAt
                            ? "Verified"
                            : "Not verified"}
                        </b>
                      </div>
                      {!session.user.verifiedAt && (
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() =>
                            action(
                              () => api("/auth/request-verification", "POST"),
                              "Verification email sent.",
                            )
                          }
                        >
                          Send verification email
                        </button>
                      )}
                      <button
                        className="text-button"
                        onClick={() =>
                          action(async () => {
                            await api("/auth/logout-all", "POST");
                            onReload();
                          }, "")
                        }
                      >
                        Sign out of all devices
                      </button>
                    </section>
                  </div>
                  {admin && (
                    <Team base={base} owner={member.role === "OWNER"} />
                  )}
                </>
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>ORGANIC / MARKETING OS</span>
          <span>Your work, with intention.</span>
        </footer>
      </div>
    </div>
  );
}
function ActivityList({ rows }: { rows: Any[] }) {
  return rows.length ? (
    <div className="activity-list">
      {rows.map((row) => (
        <div key={row.id}>
          <span className="activity-icon">
            <Check size={15} />
          </span>
          <div>
            <b>
              {row.action
                .replaceAll(".", " ")
                .replace(/^./, (v: string) => v.toUpperCase())}
            </b>
            <small>{new Date(row.createdAt).toLocaleString()}</small>
          </div>
          {row.detail?.revision && (
            <span className="pill">v{row.detail.revision}</span>
          )}
        </div>
      ))}
    </div>
  ) : (
    <Empty icon={Activity} title="Your activity starts here">
      Changes to your workspace will appear as you work.
    </Empty>
  );
}
