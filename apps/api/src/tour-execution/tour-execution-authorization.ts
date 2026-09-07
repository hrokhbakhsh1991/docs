import type { TenantAuthContext } from "@app-tour/workspace-sdk";

export class TourExecutionNotFoundError extends Error {
  constructor() {
    super("TOUR_EXECUTION_NOT_FOUND");
  }
}

export class TourExecutionForbiddenError extends Error {
  constructor() {
    super("TOUR_EXECUTION_FORBIDDEN");
  }
}

export class TourExecutionVersionConflictError extends Error {
  constructor() {
    super("TOUR_EXECUTION_VERSION_CONFLICT");
  }
}

export class TourExecutionInvalidTransitionError extends Error {
  constructor(
    readonly from: string,
    readonly to: string,
  ) {
    super("TOUR_EXECUTION_INVALID_TRANSITION");
  }
}

export class TourExecutionInvalidStateError extends Error {
  constructor(readonly state: string) {
    super("TOUR_EXECUTION_INVALID_STATE");
  }
}

export function isAdminOrOwner(role: string): boolean {
  return role === "admin" || role === "owner";
}

export function canReadTourExecution(auth: TenantAuthContext): boolean {
  return auth.role === "admin" || auth.role === "owner" || auth.role === "viewer";
}

export function canMutateTourExecution(
  auth: TenantAuthContext,
  execution: { readonly tourLeaderUserId: string | null },
): boolean {
  if (isAdminOrOwner(auth.role)) {
    return true;
  }
  if (auth.role === "viewer") {
    return false;
  }
  return execution.tourLeaderUserId === auth.userId;
}

export function assertTourExecutionRead(auth: TenantAuthContext): void {
  if (!canReadTourExecution(auth)) {
    throw new TourExecutionForbiddenError();
  }
}

export function assertTourExecutionMutate(
  auth: TenantAuthContext,
  execution: { readonly tourLeaderUserId: string | null },
): void {
  if (auth.role === "viewer") {
    throw new TourExecutionForbiddenError();
  }
  if (!canMutateTourExecution(auth, execution)) {
    throw new TourExecutionForbiddenError();
  }
}

export function assertTourExecutionAdmin(auth: TenantAuthContext): void {
  if (!isAdminOrOwner(auth.role)) {
    throw new TourExecutionForbiddenError();
  }
}
