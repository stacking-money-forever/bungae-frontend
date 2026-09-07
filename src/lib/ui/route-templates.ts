/**
 * Route normalization for privacy-safe telemetry and boundary messaging.
 * Entity ids are reduced to a generic `[id]` segment; already-templated
 * segments keep their param name. Nothing here ever receives raw query
 * strings, tokens, or body payloads.
 */

const STATIC_SEGMENTS = new Set([
  "meetups",
  "new",
  "join",
  "waitlist",
  "quorum-decision",
  "quorum-update",
  "hub",
  "chat",
  "check-in",
  "success",
  "attendance",
  "safety-cancel",
  "feedback",
  "connections",
  "select",
  "matched",
  "auth",
  "my-meetups",
  "notifications",
  "profile",
  "blocks",
  "withdrawal",
  "no-show-appeals",
  "incidents",
  "filters",
  "locations",
]);

/** `/meetups/abc123` → `/meetups/[id]`; `/meetups/[meetupId]` keeps its name. */
export function toRouteTemplate(pathname: string): string {
  if (pathname === "/" || pathname === "") {
    return "/";
  }

  return `/${pathname
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) =>
      segment.startsWith("[") && segment.endsWith("]")
        ? segment
        : STATIC_SEGMENTS.has(segment)
          ? segment
          : "[id]",
    )
    .join("/")}`;
}
