import type { WorkspaceHttpMethod } from "@app-tour/workspace-sdk";

export const CERT_EVENTS_HTTP_ROUTE_MANIFEST: readonly {
  readonly method: WorkspaceHttpMethod;
  readonly path: string;
}[] = [
  { method: "GET", path: "/cert-events/catalog" },
  { method: "GET", path: "/cert-events/catalog/:tourId" },
  { method: "POST", path: "/cert-events/registrations" },
] as const;
