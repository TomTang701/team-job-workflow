export type Route =
  | { page: "auth" }
  | { page: "workspaces" }
  | { page: "members"; workspaceId: number }
  | { page: "board"; workspaceId: number }
  | { page: "application-new"; workspaceId: number }
  | { page: "application-detail"; workspaceId: number; applicationId: number }
  | { page: "not-found" };

function positiveInteger(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseRoute(hash: string): Route {
  const segments = hash.replace(/^#/, "").split("/").filter(Boolean);
  if (segments.length === 1 && segments[0] === "auth") return { page: "auth" };
  if (segments.length === 1 && segments[0] === "workspaces") return { page: "workspaces" };

  const workspaceId = segments[0] === "workspaces" ? positiveInteger(segments[1]) : null;
  if (!workspaceId) return { page: "not-found" };
  if (segments.length === 3 && segments[2] === "members") return { page: "members", workspaceId };
  if (segments.length === 3 && segments[2] === "board") return { page: "board", workspaceId };
  if (segments.length === 4 && segments[2] === "applications" && segments[3] === "new") return { page: "application-new", workspaceId };

  const applicationId = segments[0] === "workspaces" && segments[2] === "applications" ? positiveInteger(segments[3]) : null;
  if (segments.length === 4 && applicationId) return { page: "application-detail", workspaceId, applicationId };
  return { page: "not-found" };
}

export function routeHash(path: string): string {
  return `#${path}`;
}
