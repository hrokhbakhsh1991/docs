import type { CanonicalDocument } from "../canonical/canonical-document";
import type { ActorRole, MembershipStatus } from "../auth/auth-context";
/** DTO returned by tour persistence APIs (not a DB entity). */
export type TourRecordDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly canonical: CanonicalDocument;
};

/** Body aligned with POST /tours (Phase 3.2 API). */
export type CreateTourPayload = {
  readonly schemaVersion?: number;
  readonly roots?: readonly string[];
  readonly data?: Readonly<Record<string, unknown>>;
};

/** Body aligned with PATCH /tours/{id} (Phase 9.3 / 12.2b). */
export type UpdateTourPayload = {
  readonly rowVersion: number;
  readonly schemaVersion?: number;
  readonly roots?: readonly string[];
  readonly data?: Readonly<Record<string, unknown>>;
};

/** Ingress header map for tour routes (TenantKernel). */
export type TourAuthHeaders = {
  readonly "x-tenant-id": string;
  readonly "x-authenticated-tenant-id": string;
  readonly "x-user-id": string;
  readonly "x-actor-role": ActorRole;
  readonly "x-membership-status": MembershipStatus;
  readonly "x-workspace-id": string;
};

export type TourClientError = {
  readonly status: number;
  readonly code: string;
  readonly message: string;
};

/**
 * Tour persistence port for apps (Phase 3). Implementations should return {@link SdkResult}
 * at the HTTP boundary and map failures to {@link TourClientError} for UI.
 */
export interface TourClient {
  createTour(payload: CreateTourPayload, auth: TourAuthHeaders): Promise<TourRecordDto>;
  getTour(id: string, auth: TourAuthHeaders): Promise<TourRecordDto | null>;
}

export function buildTourAuthHeaders(input: {
  readonly tenantId: string;
  readonly userId: string;
  readonly role: ActorRole;
  readonly status: MembershipStatus;
  readonly workspaceId: string;
}): TourAuthHeaders {
  return {
    "x-tenant-id": input.tenantId,
    "x-authenticated-tenant-id": input.tenantId,
    "x-user-id": input.userId,
    "x-actor-role": input.role,
    "x-membership-status": input.status,
    "x-workspace-id": input.workspaceId,
  };
}
