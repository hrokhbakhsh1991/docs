import type { WorkspaceHttpMethod } from "@app-tour/workspace-sdk";

export const CERT_CLUB_HTTP_ROUTE_MANIFEST: readonly {
  readonly method: WorkspaceHttpMethod;
  readonly path: string;
}[] = [
  { method: "GET", path: "/cert-club/catalog" },
  { method: "GET", path: "/cert-club/catalog/:tourId" },
  { method: "POST", path: "/cert-club/registrations" },
] as const;
