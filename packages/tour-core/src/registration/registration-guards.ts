import { readCapacityAtPath } from "../capacity/capacity-definition.port";
import { readFiniteCapacityNumber } from "../capacity/read-finite-capacity";

/** Structural canonical shape — tour-core does not import SDK CanonicalDocument. */
export type ReadonlyCanonicalShape = {
  readonly data: unknown;
};

/** Trim + lower-case workspace type id for case-tolerant gates. */
export function normalizeWorkspaceTypeKey(workspaceType: string): string {
  return workspaceType.trim().toLowerCase();
}

export function assertWorkspaceTypeOrThrow(
  workspaceType: string,
  expectedWorkspaceType: string,
  createError: () => Error,
): void {
  if (workspaceType !== expectedWorkspaceType) {
    throw createError();
  }
}

/** Shared "tour not published" validation error shape used by guest registration flows. */
export function createTourNotPublishedValidationError(
  tourIdField: string = "tourId",
): Error & { details: Record<string, string[]> } {
  const err = new Error("ZOD_VALIDATION_FAILED") as Error & {
    details: Record<string, string[]>;
  };
  err.details = { [tourIdField]: ["TOUR_NOT_PUBLISHED"] };
  return err;
}

/** Shared "tour departure missing" validation error (booking create gate). */
export function createTourDepartureNotSetValidationError(
  tourIdField: string = "tourId",
): Error & { details: Record<string, string[]> } {
  const err = new Error("ZOD_VALIDATION_FAILED") as Error & {
    details: Record<string, string[]>;
  };
  err.details = { [tourIdField]: ["TOUR_DEPARTURE_NOT_SET"] };
  return err;
}

/** @deprecated Use {@link readFiniteCapacityNumber} from capacity module. */
export { readFiniteCapacityNumber };

/**
 * Read capacity from canonical `data` by nested path (DG-3.1).
 * Product packages pass their capacity path (e.g. `["capacityMax"]` or `["tour", "capacity"]`).
 */
export function readWorkspaceCanonicalCapacityByPath(
  canonical: ReadonlyCanonicalShape,
  path: readonly string[],
): number | null {
  return readCapacityAtPath(canonical.data, path);
}

export type WorkspacePublishedTourLoadParams<TTour, TCanonical> = {
  readonly findFirst: () => Promise<TTour | null>;
  readonly isPublished: (canonical: TCanonical) => boolean;
  readonly getCanonical: (tour: TTour) => TCanonical;
};

/** Load tour when present and published; otherwise null (catalog get). */
export async function loadWorkspaceTourIfPublished<TTour, TCanonical>(
  params: WorkspacePublishedTourLoadParams<TTour, TCanonical>,
): Promise<TTour | null> {
  const tour = await params.findFirst();
  if (tour === null || !params.isPublished(params.getCanonical(tour))) {
    return null;
  }
  return tour;
}

/** Load published tour or throw shared not-published validation error (registration). */
export async function requireWorkspacePublishedTour<TTour, TCanonical>(
  params: WorkspacePublishedTourLoadParams<TTour, TCanonical>,
): Promise<TTour> {
  const tour = await loadWorkspaceTourIfPublished(params);
  if (tour === null) {
    throw createTourNotPublishedValidationError();
  }
  return tour;
}

/** Shared guest-registration email shape (DG-3.4). */
export const WORKSPACE_REGISTRATION_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Shared guest-registration phone allowlist (DG-3.4). */
export const WORKSPACE_REGISTRATION_PHONE_PATTERN = /^[\d+\-().\s]*$/;

export type AssertWorkspaceRegistrationContactBasicsParams = {
  readonly email?: string | null;
  /** When true, empty email is invalid. When false, empty is ok; non-empty still validated. */
  readonly emailRequired: boolean;
  readonly fullName: string;
  readonly phone?: string;
  readonly partySize?: number;
  /**
   * When true, `partySize` must be a finite integer ≥ 1.
   * When false, validation runs only if `partySize !== undefined`.
   */
  readonly partySizeRequired: boolean;
  readonly capacity: number | null;
  /** When true and capacity is set, reject partySize above capacity. */
  readonly enforcePartySizeCapacity: boolean;
  readonly createInvalidError: () => Error;
};

/**
 * Shared registration contact + partySize gates (DG-3.4).
 * Product-specific fields (notes, nationalId, transport, …) stay in workspace packages.
 */
export function assertWorkspaceRegistrationContactBasics(
  params: AssertWorkspaceRegistrationContactBasicsParams,
): void {
  const email = params.email?.trim() ?? "";
  if (params.emailRequired || email.length > 0) {
    if (
      email.length < 3 ||
      email.length > 320 ||
      !WORKSPACE_REGISTRATION_EMAIL_PATTERN.test(email)
    ) {
      throw params.createInvalidError();
    }
  }

  const fullName = params.fullName.trim();
  if (fullName.length < 1 || fullName.length > 200) {
    throw params.createInvalidError();
  }

  if (params.phone !== undefined) {
    const phone = params.phone.trim();
    if (phone.length > 32 || !WORKSPACE_REGISTRATION_PHONE_PATTERN.test(phone)) {
      throw params.createInvalidError();
    }
  }

  if (params.partySizeRequired || params.partySize !== undefined) {
    const partySize = params.partySize;
    if (partySize === undefined || !Number.isInteger(partySize) || partySize < 1) {
      throw params.createInvalidError();
    }
    if (
      params.enforcePartySizeCapacity &&
      params.capacity !== null &&
      partySize > params.capacity
    ) {
      throw params.createInvalidError();
    }
  }
}
