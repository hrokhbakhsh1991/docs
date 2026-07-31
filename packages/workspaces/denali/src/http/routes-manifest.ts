import type { WorkspaceHttpMethod } from "@app-tour/workspace-sdk";

/** Declarative denali public catalog HTTP inventory — marketing app (ADR-MKT-002). */
export const CATALOG_HTTP_ROUTE_MANIFEST: readonly {
  readonly method: WorkspaceHttpMethod;
  readonly path: string;
}[] = [
  { method: "GET", path: "/denali/catalog" },
  { method: "GET", path: "/denali/catalog/:tourId" },
  { method: "GET", path: "/denali/dashboard/tours/:tourId" },
  { method: "GET", path: "/denali/reminders/feed" },
  { method: "POST", path: "/denali/registrations" },
] as const;

/** Compat — SoT is `@app-tour/finance-http` (Phase 1.4 Commit 2). */
export { FINANCE_HTTP_ROUTE_MANIFEST } from "@app-tour/finance-http";
