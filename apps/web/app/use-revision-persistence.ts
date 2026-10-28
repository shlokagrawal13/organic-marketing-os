"use client";
import { useEffect, useRef, useState } from "react";

export type SaveFailureKind = "error" | "conflict" | "uncertain";
export class SaveFailure extends Error {
  constructor(
    public kind: SaveFailureKind,
    message: string,
  ) {
    super(message);
  }
}
type Options<Payload, Saved> = {
  scope: string;
  payload: Payload;
  dirty: boolean;
  canSave: boolean;
  automatic: boolean;
  creation: boolean;
  busy: boolean;
  write: (
    payload: Payload,
    automatic: boolean,
    isCurrent: () => boolean,
  ) => Promise<Saved | undefined>;
  onSaved: (saved: Saved, unchanged: boolean) => void;
};

// Shared serialization and failure policy; transports retain their own tenant,
// revision and state checks. Cancellation discards responses, never assumes rollback.
export function useRevisionPersistence<Payload, Saved>(
  options: Options<Payload, Saved>,
) {
  const latest = useRef(options);
  latest.current = options;
  const mounted = useRef(true);
  const flight = useRef<object | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<{
    kind: SaveFailureKind;
    message: string;
  } | null>(null);
  const [saved, setSaved] = useState(false);
  const signature = JSON.stringify(options.payload);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setFailure(null);
    setSaved(false);
  }, [options.scope]);

  async function save(automatic = false) {
    const current = latest.current;
    if (
      flight.current ||
      !current.canSave ||
      current.busy ||
      failure?.kind === "conflict" ||
      failure?.kind === "uncertain"
    )
      return;
    if (automatic && (!current.dirty || !current.automatic || failure)) return;
    const ticket = {};
    flight.current = ticket;
    const scope = current.scope;
    const payload: Payload = JSON.parse(JSON.stringify(current.payload));
    const isCurrent = () => mounted.current && latest.current.scope === scope;
    let acknowledged = false;
    setSaving(true);
    setFailure(null);
    setSaved(false);
    try {
      const result = await current.write(payload, automatic, isCurrent);
      if (!isCurrent() || result === undefined) return;
      acknowledged = true;
      latest.current.onSaved(
        result,
        JSON.stringify(latest.current.payload) === JSON.stringify(payload),
      );
      setSaved(true);
    } catch (e) {
      if (!isCurrent()) return;
      const status = (e as Error & { status?: number }).status;
      const kind =
        e instanceof SaveFailure
          ? e.kind
          : status === 409
            ? "conflict"
            : acknowledged || (current.creation && (!status || status >= 500))
              ? "uncertain"
              : "error";
      setFailure({
        kind,
        message:
          e instanceof SaveFailure
            ? e.message
            : kind === "conflict"
              ? "A newer revision or content state exists. Your local edits are kept. Export them before reloading the latest revision."
              : kind === "uncertain"
                ? "The save could not be confirmed. Your local edits are kept. Export them and check the saved content before trying again."
                : `Autosave paused. Your local edits are kept. ${(e as Error).message}`,
      });
    } finally {
      if (flight.current === ticket) {
        flight.current = null;
        if (mounted.current) setSaving(false);
      }
    }
  }
  useEffect(() => {
    if (
      !options.automatic ||
      !options.dirty ||
      options.busy ||
      saving ||
      failure
    )
      return;
    const timer = setTimeout(() => {
      void save(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [
    options.scope,
    signature,
    options.dirty,
    options.busy,
    options.automatic,
    saving,
    failure,
  ]);
  return { saving, failure, saved, save };
}
