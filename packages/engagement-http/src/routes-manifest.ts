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
  { method: "GET", path: "/engagement/operator/badges" },
  { method: "POST", path: "/engagement/operator/badges" },
  { method: "PATCH", path: "/engagement/operator/badges/:code" },
  { method: "GET", path: "/engagement/operator/levels" },
  { method: "POST", path: "/engagement/operator/levels" },
  { method: "PATCH", path: "/engagement/operator/levels/:code" },
  { method: "GET", path: "/engagement/operator/award-rules" },
  { method: "POST", path: "/engagement/operator/award-rules" },
  { method: "PATCH", path: "/engagement/operator/award-rules/:ruleId" },
  { method: "GET", path: "/engagement/operator/audit-log" },
  { method: "GET", path: "/engagement/operator/catalog" },
] as const;
