import type { WorkspaceHttpMethod } from "./workspace-http-method";

/** Declarative urban HTTP inventory — consumed by host guards (Phase 10.3 S3). */
export const URBAN_HTTP_ROUTE_MANIFEST: readonly {
  readonly method: WorkspaceHttpMethod;
  readonly path: string;
}[] = [
  { method: "GET", path: "/urban/settings" },
  { method: "PATCH", path: "/urban/settings" },
  { method: "GET", path: "/urban/catalog" },
  { method: "GET", path: "/urban/catalog/:tourId" },
  { method: "POST", path: "/urban/registrations" },
] as const;
