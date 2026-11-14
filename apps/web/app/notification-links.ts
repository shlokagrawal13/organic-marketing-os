export type NotificationLinkTarget =
  | { kind: "content"; id: string }
  | { kind: "render"; id: string }
  | { kind: "review"; id: string }
  | { kind: "publications" }
  | { kind: "media" }
  | { kind: "billing" };

/** Resolve a persisted link into a same-workspace UI target. */
export function resolveNotificationLink(
  base: string,
  link: string | null | undefined,
): NotificationLinkTarget | null {
  if (!link) return null;
  const normalizedBase = base.replace(/\/+$/, "");
  let target: URL;
  try {
    target = new URL(link, "https://organic-notification.invalid");
  } catch {
    return null;
  }
  if (target.origin !== "https://organic-notification.invalid") return null;

  const prefix = `${normalizedBase}/`;
  if (!target.pathname.startsWith(prefix)) return null;
  const segments = target.pathname.slice(prefix.length).split("/");
  if (
    segments.some((segment) => !segment || segment === "." || segment === "..")
  )
    return null;

  if (segments.length === 2 && segments[0] === "content")
    return { kind: "content", id: segments[1] };
  if (segments.length === 2 && segments[0] === "renders")
    return { kind: "render", id: segments[1] };
  if (segments.length === 2 && segments[0] === "reviews")
    return { kind: "review", id: segments[1] };
  if (segments.length === 1 && segments[0] === "publications")
    return { kind: "publications" };
  if (segments.length === 1 && segments[0] === "media")
    return { kind: "media" };
  if (segments.length === 1 && segments[0] === "billing")
    return { kind: "billing" };
  return null;
}
