"use client";
import { useEffect, useRef, useState } from "react";
import { api, download } from "./api-client";

type Settings = {
  id: string;
  name: string;
  timezone: string;
  settingsRevision: number;
};
export default function WorkspaceSettings({
  base,
  editable,
  onDirtyChange,
  onBusyChange,
  onSaved,
}: {
  base: string;
  editable: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  onSaved: (settings: Settings) => void;
}) {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [draft, setDraft] = useState({ name: "", timezone: "" });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const [latest, setLatest] = useState<Settings | null>(null);
  const [notice, setNotice] = useState("");
  const mounted = useRef(false),
    flight = useRef(false);
  const dirty =
    !!saved && (draft.name !== saved.name || draft.timezone !== saved.timezone);
  const protectedEdits = dirty || uncertain || conflicted;
  useEffect(() => {
    onDirtyChange(protectedEdits);
  }, [protectedEdits, onDirtyChange]);
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(() => {
    mounted.current = true;
    void read();
    return () => {
      mounted.current = false;
      onDirtyChange(false);
      onBusyChange(false);
    };
  }, []);
  function checked(value: Settings) {
    if (
      !value ||
      value.id !== base.split("/").at(-1) ||
      typeof value.name !== "string" ||
      typeof value.timezone !== "string" ||
      !Number.isSafeInteger(value.settingsRevision) ||
      value.settingsRevision < 0
    )
      throw new Error("The saved workspace settings could not be confirmed.");
    return value;
  }
  function adopt(value: Settings) {
    checked(value);
    setSaved(value);
    setDraft({ name: value.name, timezone: value.timezone });
    setUncertain(false);
    setConflicted(false);
    setLatest(null);
    onSaved(value);
  }
  async function reviewConflict() {
    if (flight.current || !conflicted || !saved || !editable) return;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      const value = checked(
        await api(base, "GET", undefined, AbortSignal.timeout(20000)),
      );
      if (mounted.current) {
        setLatest(value);
        setError("");
      }
    } catch {
      if (mounted.current)
        setError(
          "Could not review the latest settings. Your local edits are kept. Try again.",
        );
    } finally {
      flight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function acceptReviewedRevision() {
    if (!latest || !saved || !conflicted || busy || flight.current) return;
    setSaved(latest);
    setLatest(null);
    setConflicted(false);
    setError("");
    setNotice("Latest revision reviewed. Your draft is not saved yet.");
    onSaved(latest);
  }
  async function read() {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setLatest(null);
    try {
      const value = await api(
        base,
        "GET",
        undefined,
        AbortSignal.timeout(20000),
      );
      if (mounted.current) adopt(value);
    } catch {
      if (mounted.current)
        setError(
          "Could not load the latest settings. Your local edits are kept. Try reloading again.",
        );
    } finally {
      flight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (
      flight.current ||
      !saved ||
      !editable ||
      !dirty ||
      uncertain ||
      conflicted
    )
      return;
    flight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const value = await api(
        base,
        "PATCH",
        { ...draft, expectedRevision: saved.settingsRevision },
        AbortSignal.timeout(20000),
      );
      if (!mounted.current) return;
      adopt(value);
      setNotice("Workspace settings saved.");
    } catch (e) {
      if (!mounted.current) return;
      const status = (e as Error & { status?: number }).status;
      const unknown = !status || status >= 500;
      setUncertain(unknown);
      setConflicted(status === 409);
      setLatest(null);
      setError(
        unknown
          ? "The save could not be confirmed. It may have completed. Your local edits are kept; no retry was sent. Export them, then reload the latest settings before saving again."
          : status === 409
            ? "Workspace settings changed in another session. Your local edits are kept. Review the latest values or export them before reloading."
            : `Settings were not saved. Your local edits are kept; no retry was sent. ${(e as Error).message}`,
      );
    } finally {
      flight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="panel" aria-label="Workspace details">
      <h3>Workspace details</h3>
      <p>Changes are saved only when you choose Save workspace.</p>
      <form onSubmit={save}>
        <label>
          Name
          <input
            name="name"
            value={draft.name}
            minLength={2}
            maxLength={100}
            required
            disabled={!editable || busy || !saved}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label>
          Timezone
          <input
            name="timezone"
            value={draft.timezone}
            required
            disabled={!editable || busy || !saved}
            onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
          />
        </label>
        <p role="status" aria-label="Workspace settings status">
          {busy
            ? "Updating workspace settings…"
            : uncertain
              ? "Save unconfirmed. Reload before saving again."
              : conflicted
                ? "Settings conflict. Review or reload before saving again."
                : dirty
                  ? "Unsaved settings changes."
                  : notice ||
                    (saved
                      ? "No unsaved settings changes."
                      : "Settings are unavailable.")}
        </p>
        {error && <p role="alert">{error}</p>}
        {conflicted && (
          <div aria-label="Settings conflict review">
            <button
              type="button"
              className="button"
              disabled={busy || !editable}
              onClick={() => void reviewConflict()}
            >
              Review latest settings
            </button>
            {latest && saved && (
              <div>
                <p>
                  Review each value before accepting revision{" "}
                  {latest.settingsRevision}. Nothing is saved by this step.
                </p>
                <p>
                  Name: previously saved “{saved.name}”; latest “{latest.name}”;
                  your draft “{draft.name}”.
                </p>
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    setDraft((current) => ({ ...current, name: latest.name }))
                  }
                >
                  Use latest name
                </button>
                <p>
                  Timezone: previously saved “{saved.timezone}”; latest “
                  {latest.timezone}”; your draft “{draft.timezone}”.
                </p>
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      timezone: latest.timezone,
                    }))
                  }
                >
                  Use latest timezone
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={acceptReviewedRevision}
                >
                  Accept reviewed revision
                </button>
              </div>
            )}
          </div>
        )}
        <div className="button-row">
          <button
            type="submit"
            className="button primary"
            disabled={!editable || busy || !dirty || uncertain || conflicted}
          >
            Save workspace
          </button>
          <button
            type="button"
            className="button"
            disabled={!saved}
            onClick={() =>
              download("workspace-settings-local.json", {
                workspaceId: saved?.id,
                settings: draft,
                savedSettings: { name: saved?.name, timezone: saved?.timezone },
                savedRevision: saved?.settingsRevision,
                saveUnconfirmed: uncertain,
                settingsConflict: conflicted,
                reviewedLatest: latest && {
                  name: latest.name,
                  timezone: latest.timezone,
                  revision: latest.settingsRevision,
                },
              })
            }
          >
            Export local settings
          </button>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => {
              if (
                !protectedEdits ||
                confirm(
                  "Discard local settings edits and reload the latest saved settings? Export first if you need to keep them.",
                )
              )
                void read();
            }}
          >
            Reload settings
          </button>
        </div>
      </form>
    </section>
  );
}
