"use client";
import { api } from "./api-client";
import {
  SaveFailure,
  useRevisionPersistence,
} from "./use-revision-persistence";
type Draft = Record<string, any>;
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
export function useDraftPersistence(options: Options) {
  const eligible =
    options.editable && !!options.item?.id && options.item.status === "DRAFT";
  const persistence = useRevisionPersistence<Draft, Draft>({
    scope: options.scope,
    payload: options.draft,
    dirty: options.dirty,
    canSave:
      options.editable && !!options.item && options.item.status !== "ARCHIVED",
    automatic: eligible,
    creation: !options.item?.id,
    busy: options.busy,
    onSaved: options.onSaved,
    async write(payload, automatic, isCurrent) {
      const { base, item } = options;
      const row = await api(
        base + "/content" + (item?.id ? `/${item.id}` : ""),
        item?.id ? "PUT" : "POST",
        {
          ...payload,
          ...(item?.id ? { revision: item.revision } : {}),
          ...(automatic ? { autosave: true } : {}),
        },
        AbortSignal.timeout(20000),
      );
      if (!isCurrent()) return;
      let detail: Draft;
      try {
        detail = await api(
          base + `/content/${row.id}`,
          "GET",
          undefined,
          AbortSignal.timeout(20000),
        );
      } catch {
        throw new SaveFailure(
          "uncertain",
          "The save could not be confirmed. Your local edits are kept. Export them and check the saved content before trying again.",
        );
      }
      if (detail.item.revision !== row.revision)
        throw new SaveFailure(
          "conflict",
          "Content changed again after saving. Your local edits are kept. Export them before reloading the latest revision.",
        );
      return detail;
    },
  });
  return { ...persistence, eligible };
}
