"use client";
import { useEffect, useRef, useState } from "react";
import { api, download } from "./api-client";

type Settings = {
  id: string;
  name: string;
  timezone: string;
  settingsRevision: number;
};
type LocalSettingsExport = {
  settings: { name: string; timezone: string };
  savedSettings: { name: string; timezone: string };
  savedRevision: number;
  saveUnconfirmed: boolean;
  settingsConflict: boolean;
};
const backupPrefix = "organic-settings-draft-v1:";
function parseLocalExport(
  raw: unknown,
  workspaceId: string,
): LocalSettingsExport {
  if (!raw || typeof raw !== "object")
    throw new Error("Invalid settings export.");
  const item = raw as Record<string, unknown>;
  if (item.workspaceId !== workspaceId)
    throw new Error("This settings export belongs to another workspace.");
  const fields = (value: unknown): value is LocalSettingsExport["settings"] =>
    !!value &&
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).name === "string" &&
    (value as { name: string }).name.length <= 100 &&
    typeof (value as Record<string, unknown>).timezone === "string" &&
    (value as { timezone: string }).timezone.length <= 256;
  if (
    !fields(item.settings) ||
    !fields(item.savedSettings) ||
    !Number.isSafeInteger(item.savedRevision) ||
    (item.savedRevision as number) < 0 ||
    typeof item.saveUnconfirmed !== "boolean" ||
    typeof item.settingsConflict !== "boolean"
  )
    throw new Error("Invalid settings export.");
  return item as LocalSettingsExport;
}
export default function WorkspaceSettings({
  base,
  userId,
  editable,
  onDirtyChange,
  onBusyChange,
  onSaved,
}: {
  base: string;
  userId: string;
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
  const [localBackup, setLocalBackup] = useState<LocalSettingsExport | null>(
    null,
  );
  const mounted = useRef(false),
    flight = useRef(false),
    edited = useRef(false);
  const backupKey = `${backupPrefix}${userId}:${base.split("/").at(-1)}`;
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
    const onSignOut = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== userId) return;
      edited.current = false;
      clearLocalBackup();
    };
    window.addEventListener("organic-settings-signout", onSignOut);
    return () =>
      window.removeEventListener("organic-settings-signout", onSignOut);
  }, [userId, backupKey]);
  useEffect(() => {
    mounted.current = true;
    try {
      const raw = localStorage.getItem(backupKey);
      if (raw && raw.length <= 65536) {
        const parsed = parseLocalExport(
          JSON.parse(raw),
          base.split("/").at(-1)!,
        );
        setLocalBackup(parsed);
      }
    } catch {
      // A malformed or unavailable browser store never blocks server settings.
      try {
        localStorage.removeItem(backupKey);
      } catch {}
    }
    void read();
    return () => {
      mounted.current = false;
      onDirtyChange(false);
      onBusyChange(false);
    };
  }, []);
  useEffect(() => {
    if (!edited.current || !saved || !editable) return;
    const backup = {
      workspaceId: saved.id,
      settings: { name: draft.name, timezone: draft.timezone },
      savedSettings: { name: saved.name, timezone: saved.timezone },
      savedRevision: saved.settingsRevision,
      saveUnconfirmed: uncertain,
      settingsConflict: conflicted,
    };
    try {
      if (protectedEdits)
        localStorage.setItem(backupKey, JSON.stringify(backup));
      else localStorage.removeItem(backupKey);
    } catch {
      // Manual export remains available if browser storage is disabled/full.
    }
  }, [
    backupKey,
    draft,
    saved,
    uncertain,
    conflicted,
    protectedEdits,
    editable,
  ]);
  function clearLocalBackup() {
    try {
      localStorage.removeItem(backupKey);
    } catch {}
    setLocalBackup(null);
  }
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
  function adopt(value: Settings, discardBackup = true) {
    checked(value);
    setSaved(value);
    setDraft({ name: value.name, timezone: value.timezone });
    setUncertain(false);
    setConflicted(false);
    setLatest(null);
    edited.current = false;
    if (discardBackup) clearLocalBackup();
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
  async function importLocal(file: File) {
    if (flight.current || !saved || !editable) return;
    if (
      (protectedEdits || localBackup) &&
      !confirm(
        "Replace the current local settings draft? Export it first if you need to keep it.",
      )
    )
      return;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      if (!file.size || file.size > 65536)
        throw new Error(
          "Settings export must be a nonempty JSON file under 64 KB.",
        );
      const imported = parseLocalExport(
        JSON.parse(await file.text()),
        saved.id,
      );
      const current = checked(
        await api(base, "GET", undefined, AbortSignal.timeout(20000)),
      );
      if (!mounted.current) return;
      const needsReview =
        imported.savedRevision !== current.settingsRevision ||
        imported.saveUnconfirmed ||
        imported.settingsConflict;
      setDraft({
        name: imported.settings.name,
        timezone: imported.settings.timezone,
      });
      edited.current = true;
      setLocalBackup(null);
      setSaved(
        needsReview
          ? {
              ...current,
              name: imported.savedSettings.name,
              timezone: imported.savedSettings.timezone,
              settingsRevision: imported.savedRevision,
            }
          : current,
      );
      setLatest(needsReview ? current : null);
      setConflicted(needsReview);
      setUncertain(false);
      setNotice(
        needsReview
          ? "Draft imported. Review the latest server values before saving."
          : "Draft imported locally. Choose Save workspace when ready.",
      );
      onSaved(current);
    } catch (error) {
      if (mounted.current)
        setError(
          error instanceof SyntaxError
            ? "Invalid settings export. Your current local edits are kept."
            : `${(error as Error).message} Your current local edits are kept.`,
        );
    } finally {
      flight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function recoverLocalBackup() {
    if (!localBackup || !saved || flight.current || !editable) return;
    const backup = localBackup;
    if (
      protectedEdits &&
      !confirm("Replace the current settings draft with the browser backup?")
    )
      return;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      const current = checked(
        await api(base, "GET", undefined, AbortSignal.timeout(20000)),
      );
      if (!mounted.current) return;
      const needsReview =
        backup.savedRevision !== current.settingsRevision ||
        backup.saveUnconfirmed ||
        backup.settingsConflict;
      edited.current = true;
      setDraft({
        name: backup.settings.name,
        timezone: backup.settings.timezone,
      });
      setSaved(
        needsReview
          ? {
              ...current,
              name: backup.savedSettings.name,
              timezone: backup.savedSettings.timezone,
              settingsRevision: backup.savedRevision,
            }
          : current,
      );
      setLatest(needsReview ? current : null);
      setConflicted(needsReview);
      setUncertain(false);
      setLocalBackup(null);
      setNotice(
        needsReview
          ? "Browser draft recovered. Review the latest server values before saving."
          : "Browser draft recovered locally. Choose Save workspace when ready.",
      );
      onSaved(current);
    } catch {
      if (mounted.current)
        setError(
          "Could not check the latest settings. Your browser backup is kept; try recovery again.",
        );
    } finally {
      flight.current = false;
      if (mounted.current) setBusy(false);
    }
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
      if (mounted.current) {
        adopt(value, !!saved);
      }
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
      <p>
        Unsaved settings are backed up in this browser for this account and
        workspace. Recovery requires your choice; saving or signing out clears
        the backup.
      </p>
      <form onSubmit={save}>
        <label>
          Name
          <input
            name="name"
            value={draft.name}
            minLength={2}
            maxLength={100}
            required
            disabled={!editable || busy || !saved || !!localBackup}
            onChange={(e) => {
              edited.current = true;
              setDraft({ ...draft, name: e.target.value });
            }}
          />
        </label>
        <label>
          Timezone
          <input
            name="timezone"
            value={draft.timezone}
            required
            disabled={!editable || busy || !saved || !!localBackup}
            onChange={(e) => {
              edited.current = true;
              setDraft({ ...draft, timezone: e.target.value });
            }}
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
        {localBackup && saved && editable && (
          <div role="group" aria-label="Browser settings draft backup">
            <p>
              A local settings draft from this account and workspace is
              available. Review it before any server save.
            </p>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => void recoverLocalBackup()}
            >
              Recover browser draft
            </button>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={clearLocalBackup}
            >
              Discard browser draft
            </button>
          </div>
        )}
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
          <label>
            Import local settings JSON
            <input
              type="file"
              accept=".json,application/json"
              disabled={!editable || !saved || busy}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void importLocal(file);
              }}
            />
          </label>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => {
              if (
                !(protectedEdits || localBackup) ||
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
