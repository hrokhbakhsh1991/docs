export type WorkspaceHttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export const ENGAGEMENT_HTTP_ROUTE_MANIFEST: readonly {
  readonly method: WorkspaceHttpMethod;
  readonly path: string;
}[] = [
  { method: "GET", path: "/engagement/me/summary" },
  { method: "GET", path: "/engagement/me/points" },
  { method: "GET", path: "/engagement/me/badges" },
  { method: "GET", path: "/engagement/operator/overview" },
  { method: "GET", path: "/engagement/operator/policy" },
  { method: "GET", path: "/engagement/operator/members/:userId" },
  { method: "POST", path: "/engagement/operator/members/:userId/adjust" },
  { method: "POST", path: "/engagement/operator/members/:userId/reverse" },
] as const;
