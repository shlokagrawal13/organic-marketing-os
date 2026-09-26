"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Layers3,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "./api-client";
export function BrandMark() {
  return (
    <span className="brandmark" aria-hidden="true">
      m
    </span>
  );
}
export function AuthUI({
  onDone,
  initialMode = "register",
  resetToken,
}: {
  onDone: () => void;
  initialMode?: string;
  resetToken?: string;
}) {
  const [mode, setMode] = useState(resetToken ? "reset" : initialMode),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (mode === "forgot") {
        const r = await api("/auth/forgot-password", "POST", {
          email: values.email,
        });
        setNotice(r.message);
      } else if (mode === "reset") {
        await api("/auth/reset-password", "POST", {
          token: resetToken,
          password: values.password,
        });
        setNotice("Password updated. Sign in to continue.");
        setMode("login");
        history.replaceState(null, "", "/");
      } else {
        await api(`/auth/${mode}`, "POST", values);
        onDone();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <aside className="auth-story">
        <div className="wordmark">
          <BrandMark />
          organic<span className="wordmark-sub">MARKETING OS</span>
        </div>
        <div className="auth-story-main">
          <span className="eyebrow">FROM FIRST IDEA TO NEXT CHAPTER</span>
          <h1>
            A workspace for
            <br />
            your brand’s
            <br />
            <em>next move.</em>
          </h1>
          <p>
            Bring your brand, creative work and marketing decisions together.
          </p>
          <div className="journey">
            <div>
              <span>01</span>
              <div>
                <b>Understand your brand</b>
                <small>A shared source of truth for your business.</small>
              </div>
            </div>
            <div>
              <span>02</span>
              <div>
                <b>Turn plans into content</b>
                <small>Create, refine and review in one place.</small>
              </div>
            </div>
            <div>
              <span>03</span>
              <div>
                <b>Learn from real results</b>
                <small>Connect your channels when you’re ready.</small>
              </div>
            </div>
          </div>
        </div>
        <footer>
          <ShieldCheck size={16} /> Your work. Your approval. Your control.
        </footer>
      </aside>
      <section className="auth-form-side">
        <div className="auth-top">
          <span>ALREADY HAVE A WORKSPACE?</span>
          <button
            className="text-button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
              setNotice("");
            }}
          >
            {mode === "login" ? "Create account" : "Sign in"}{" "}
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="auth-form-wrap">
          <div className="icon-tile">
            <Layers3 size={24} />
          </div>
          <span className="eyebrow muted">LET’S GET TO WORK</span>
          <h2>
            {mode === "register"
              ? "Make room for better marketing."
              : mode === "login"
                ? "Welcome back."
                : mode === "forgot"
                  ? "Reset your password."
                  : "Choose a new password."}
          </h2>
          <p>
            {mode === "register"
              ? "Create your account, then tell us about your business."
              : mode === "login"
                ? "Pick up where you left off."
                : "Use the email address associated with your account."}
          </p>
          <form onSubmit={submit}>
            {mode === "register" && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={100}
                  required
                  placeholder="Shyam Gupta"
                />
              </label>
            )}
            {mode !== "reset" && (
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                />
              </label>
            )}
            {mode !== "forgot" && (
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={mode === "login" ? 1 : 12}
                  maxLength={128}
                  required
                  placeholder={
                    mode === "login"
                      ? "Your password"
                      : "At least 12 characters"
                  }
                />
              </label>
            )}
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            {notice && (
              <div className="alert" role="status">
                {notice}
              </div>
            )}
            <button className="button primary wide" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "register"
                  ? "Create your account"
                  : mode === "login"
                    ? "Sign in"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Update password"}
              <ArrowRight size={18} />
            </button>
            {mode === "login" && (
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setNotice("");
                  setError("");
                }}
              >
                Forgot password?
              </button>
            )}
          </form>
          <div className="auth-foot">
            <Check size={16} /> No credit card needed to set up your workspace.
          </div>
        </div>
      </section>
    </main>
  );
}
export function WorkspaceSetup({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(
        "/organizations",
        "POST",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="setup">
      <div className="wordmark">
        <BrandMark />
        organic
      </div>
      <section className="panel setup-panel">
        <span className="eyebrow">YOUR FIRST WORKSPACE</span>
        <h1>Give your brand a home.</h1>
        <p>
          Keep each business’s content, people and brand knowledge together.
        </p>
        <form onSubmit={submit}>
          <label>
            Workspace name
            <input
              name="name"
              minLength={2}
              maxLength={100}
              required
              placeholder="Your business or brand"
            />
          </label>
          <label>
            Timezone
            <select
              name="timezone"
              defaultValue={
                Intl.DateTimeFormat().resolvedOptions().timeZone ||
                "Asia/Kolkata"
              }
            >
              {Array.from(
                new Set([
                  Intl.DateTimeFormat().resolvedOptions().timeZone,
                  "Asia/Kolkata",
                  "UTC",
                  "America/New_York",
                  "America/Los_Angeles",
                  "Europe/London",
                  "Asia/Dubai",
                  "Asia/Singapore",
                  "Australia/Sydney",
                ]),
              ).map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </label>
          {error && (
            <div role="alert" className="alert error">
              {error}
            </div>
          )}
          <button disabled={busy} className="button primary wide">
            {busy ? "Creating…" : "Create workspace"}
            <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}
