"use client";
import { useEffect, useRef, useState } from "react";
import { api, download } from "./api-client";

type Settings = { id: string; name: string; timezone: string };
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
  const [notice, setNotice] = useState("");
  const mounted = useRef(false),
    flight = useRef(false);
  const dirty =
    !!saved && (draft.name !== saved.name || draft.timezone !== saved.timezone);
  const protectedEdits = dirty || uncertain;
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
  function adopt(value: Settings) {
    if (
      !value ||
      value.id !== base.split("/").at(-1) ||
      typeof value.name !== "string" ||
      typeof value.timezone !== "string"
    )
      throw new Error("The saved workspace settings could not be confirmed.");
    setSaved(value);
    setDraft({ name: value.name, timezone: value.timezone });
    setUncertain(false);
    onSaved(value);
  }
  async function read() {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
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
    if (flight.current || !saved || !editable || !dirty || uncertain) return;
    flight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const value = await api(base, "PATCH", draft, AbortSignal.timeout(20000));
      if (!mounted.current) return;
      adopt(value);
      setNotice("Workspace settings saved.");
    } catch (e) {
      if (!mounted.current) return;
      const status = (e as Error & { status?: number }).status;
      const unknown = !status || status >= 500;
      setUncertain(unknown);
      setError(
        unknown
          ? "The save could not be confirmed. It may have completed. Your local edits are kept; no retry was sent. Export them, then reload the latest settings before saving again."
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
              : dirty
                ? "Unsaved settings changes."
                : notice ||
                  (saved
                    ? "No unsaved settings changes."
                    : "Settings are unavailable.")}
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="button-row">
          <button
            type="submit"
            className="button primary"
            disabled={!editable || busy || !dirty || uncertain}
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
                saveUnconfirmed: uncertain,
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
