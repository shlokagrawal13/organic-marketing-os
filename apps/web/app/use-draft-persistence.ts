"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "./api-client";

type Draft = Record<string, any>;
type Failure = { kind: "error" | "conflict" | "uncertain"; message: string };
type Options = {
  base: string;
  scope: string;
  item: Draft | undefined;
  draft: Draft;
  dirty: boolean;
  editable: boolean;
  busy: boolean;
  onSaved: (detail: Draft, unchanged: boolean) => void;
};

// One write per editor. A later edit stays dirty and uses the acknowledged
// revision on the next save. Never retry an uncertain write automatically.
export function useDraftPersistence(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const mounted = useRef(true);
  const flight = useRef<object | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [saved, setSaved] = useState(false);
  const eligible =
    options.editable && !!options.item?.id && options.item.status === "DRAFT";

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
      !current.editable ||
      current.busy ||
      !current.item ||
      current.item.status === "ARCHIVED" ||
      failure?.kind === "conflict" ||
      failure?.kind === "uncertain"
    )
      return;
    if (
      automatic &&
      (!current.dirty ||
        !current.item.id ||
        current.item.status !== "DRAFT" ||
        failure)
    )
      return;
    const ticket = {};
    flight.current = ticket;
    const { base, scope } = current;
    const payload = JSON.parse(JSON.stringify(current.draft));
    const isCurrent = () => mounted.current && latest.current.scope === scope;
    let wrote = false;
    setSaving(true);
    setFailure(null);
    setSaved(false);
    try {
      const row = await api(
        base + "/content" + (current.item.id ? `/${current.item.id}` : ""),
        current.item.id ? "PUT" : "POST",
        {
          ...payload,
          ...(current.item.id ? { revision: current.item.revision } : {}),
          ...(automatic ? { autosave: true } : {}),
        },
        AbortSignal.timeout(20000),
      );
      wrote = true;
      if (!isCurrent()) return;
      const detail = await api(
        base + `/content/${row.id}`,
        "GET",
        undefined,
        AbortSignal.timeout(20000),
      );
      if (!isCurrent()) return;
      if (detail.item.revision !== row.revision) {
        setFailure({
          kind: "conflict",
          message:
            "Content changed again after saving. Your local edits are kept. Export them before reloading the latest revision.",
        });
        return;
      }
      const unchanged =
        JSON.stringify(latest.current.draft) === JSON.stringify(payload);
      latest.current.onSaved(detail, unchanged);
      setSaved(true);
    } catch (e) {
      if (!isCurrent()) return;
      const status = (e as Error & { status?: number }).status;
      const conflict = status === 409;
      const uncertain =
        wrote || (!current.item.id && (!status || status >= 500));
      setFailure({
        kind: conflict ? "conflict" : uncertain ? "uncertain" : "error",
        message: conflict
          ? "A newer revision or content state exists. Your local edits are kept. Export them before reloading the latest revision."
          : uncertain
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
    if (!eligible || !options.dirty || options.busy || saving || failure)
      return;
    const timer = setTimeout(() => {
      void save(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [
    options.scope,
    options.draft,
    options.dirty,
    options.busy,
    eligible,
    saving,
    failure,
  ]);

  return { saving, failure, save, saved, eligible };
}
