"use client";
import type { SaveFailureKind } from "./use-revision-persistence";
export default function BrandSaveStatus({
  saving,
  saved,
  failure,
  editable,
  created,
  dirty,
  busy,
  onExport,
  onReload,
}: {
  saving: boolean;
  saved: boolean;
  failure: { kind: SaveFailureKind; message: string } | null;
  editable: boolean;
  created: boolean;
  dirty: boolean;
  busy: boolean;
  onExport: () => void;
  onReload: () => void;
}) {
  let status =
    "Autosave is on for Brand Brain and Creative DNA. Both save together.";
  if (!editable) status = "Read-only access. Changes cannot be saved.";
  else if (!created) status = "Save brand knowledge once to enable autosave.";
  else if (dirty)
    status = "Unsaved changes — autosave in 2 seconds after editing stops.";
  else if (saved) status = "All brand changes saved.";
  if (failure) status = "Brand autosave paused";
  if (busy && !saving) status = "Updating brand knowledge…";
  if (saving) status = "Saving brand knowledge…";
  return (
    <section className="panel" aria-label="Brand save status">
      <p role="status" aria-live="polite">
        {status}
      </p>
      {saving && (
        <p>
          A save already in progress may still finish if you leave this editor.
        </p>
      )}
      {failure && (
        <div className="alert error" role="alert">
          {failure.message}
        </div>
      )}
      <div className="button-row">
        <button className="button" onClick={onExport}>
          Export local brand edits
        </button>
        <button className="button" disabled={busy} onClick={onReload}>
          Reload latest brand knowledge
        </button>
      </div>
    </section>
  );
}
