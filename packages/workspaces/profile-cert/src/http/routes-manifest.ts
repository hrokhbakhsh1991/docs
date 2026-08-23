import type { WorkspaceHttpMethod } from "@app-tour/workspace-sdk";

export const PROFILE_CERT_HTTP_ROUTE_MANIFEST: readonly {
  readonly method: WorkspaceHttpMethod;
  readonly path: string;
}[] = [
  { method: "GET", path: "/profile-cert/catalog" },
  { method: "GET", path: "/profile-cert/catalog/:tourId" },
  { method: "POST", path: "/profile-cert/registrations" },
] as const;
