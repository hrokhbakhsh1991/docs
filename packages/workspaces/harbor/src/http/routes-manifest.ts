import type { WorkspaceHttpMethod } from "@app-tour/workspace-sdk";

export const HARBOR_HTTP_ROUTE_MANIFEST: readonly {
  readonly method: WorkspaceHttpMethod;
  readonly path: string;
}[] = [
  { method: "GET", path: "/harbor/catalog" },
  { method: "GET", path: "/harbor/catalog/:tourId" },
  { method: "POST", path: "/harbor/registrations" },
] as const;
