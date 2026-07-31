import type { IncomingMessage, ServerResponse } from "node:http";

import type { CanonicalDocument } from "../canonical/canonical-document";
import type { TenantAuthContext } from "../auth/auth-context";

/** Product-neutral HTTP host surface shared by workspace-owned route handlers. */
export interface WorkspaceProductHttpHostBasePorts {
  readonly runWithHttpRequestContext: <T>(
    req: IncomingMessage,
    auth: TenantAuthContext,
    fn: () => Promise<T>,
    options?: { readonly rateLimit?: "read" | "write" },
  ) => Promise<T>;
  readonly sendJson: (res: ServerResponse, status: number, body: unknown) => void;
  readonly sendHttpError: (
    res: ServerResponse,
    status: number,
    body: { readonly error: string; readonly code: string },
  ) => void;
  readonly handleHttpError: (res: ServerResponse, error: unknown) => void;
  readonly resolveWorkspaceTypeForTenant: (tenantId: string) => Promise<string>;
}

/** Host-injected exposure resolver — implemented in apps/api (DG-1.2). */
export type WorkspaceExposureResolverInput<TCoordinate> = {
  readonly tenantId: string;
  readonly tourId: string;
  readonly canonical: CanonicalDocument;
  readonly coordinate: TCoordinate;
};

export interface WorkspaceExposureResolverPort<TCoordinate> {
  resolveVisibleFieldIds(
    input: WorkspaceExposureResolverInput<TCoordinate>,
  ): Promise<readonly string[]>;
}

export type WorkspaceTourRecord<TCanonical = CanonicalDocument> = {
  readonly id: string;
  readonly createdAt: string;
  readonly canonical: TCanonical;
};

export type WorkspaceTourListPageResult<TCanonical = CanonicalDocument> = {
  readonly items: readonly WorkspaceTourRecord<TCanonical>[];
};

/** Host-injected tour read port — Prisma adapter lives in apps/api (DG-1.2). */
export interface WorkspaceTourStorePort<TCanonical = CanonicalDocument> {
  listPage(
    where: { readonly tenantId: string },
    page: { readonly limit: number },
  ): Promise<WorkspaceTourListPageResult<TCanonical>>;
  findFirst(where: {
    readonly tenantId: string;
    readonly id: string;
  }): Promise<WorkspaceTourRecord<TCanonical> | null>;
}
