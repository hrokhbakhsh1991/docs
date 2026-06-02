import type { DenaliLegacySchemaSite } from "@repo/denali-domain";

/** Stable Sentry / log triage codes for Denali wizard production failures. */
export const DenaliProductionErrorCode = {
  FACTORY_HYDRATION_PARITY_MISMATCH: "DENALI_FACTORY_HYDRATION_PARITY_MISMATCH",
  CREATE_TOUR_WIRE_CONTRACT_VIOLATION: "DENALI_CREATE_TOUR_WIRE_CONTRACT_VIOLATION",
  UNKNOWN_CANONICAL_PATH: "DENALI_UNKNOWN_CANONICAL_PATH",
  FATAL_PROJECTION_REGISTRY_ROOT: "DENALI_FATAL_PROJECTION_REGISTRY_ROOT",
  FATAL_PROJECTION_SUBMIT_KEYS: "DENALI_FATAL_PROJECTION_SUBMIT_KEYS",
  FATAL_PROJECTION_BUILD_FAILED: "DENALI_FATAL_PROJECTION_BUILD_FAILED",
  DRAFT_SANITIZE_REGISTRY_ROOT: "DENALI_DRAFT_SANITIZE_REGISTRY_ROOT",
} as const;

export type DenaliProductionErrorCode =
  (typeof DenaliProductionErrorCode)[keyof typeof DenaliProductionErrorCode];

/** Base for production-grade Denali failures (always thrown — never env-gated). */
export abstract class DenaliProductionError extends Error {
  abstract readonly code: DenaliProductionErrorCode;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Factory baseline merge diverged from expected overlay-aware hydration. */
export class HydrationParityError extends DenaliProductionError {
  readonly code = DenaliProductionErrorCode.FACTORY_HYDRATION_PARITY_MISMATCH;

  constructor(message = DenaliProductionErrorCode.FACTORY_HYDRATION_PARITY_MISMATCH) {
    super(message);
  }
}

/** POST /tours wire body failed shared contract validation. */
export class CreateTourWireContractError extends DenaliProductionError {
  readonly code = DenaliProductionErrorCode.CREATE_TOUR_WIRE_CONTRACT_VIOLATION;
  readonly issueSummary: string;

  constructor(message: string, issueSummary: string) {
    super(message);
    this.issueSummary = issueSummary;
  }
}

/** Registry canonical path is not registered (drift / typo). */
export class DenaliUnknownCanonicalPathError extends DenaliProductionError {
  readonly code = DenaliProductionErrorCode.UNKNOWN_CANONICAL_PATH;
  readonly canonicalPath: string;

  constructor(
    canonicalPath: string,
    message = `Unknown Denali canonical path: ${canonicalPath}`,
  ) {
    super(message);
    this.canonicalPath = canonicalPath;
  }
}

/** Submit prune/projection violates registry contracts (thrown in all environments). */
export class FatalProjectionError extends DenaliProductionError {
  readonly code: DenaliProductionErrorCode;
  readonly offendingKeys: readonly string[];

  constructor(
    code: DenaliProductionErrorCode,
    message: string,
    offendingKeys: readonly string[] = [],
  ) {
    super(message);
    this.code = code;
    this.offendingKeys = offendingKeys;
  }
}

/** Re-export for web callers that catch legacy-schema guard failures. */
export type { DenaliLegacySchemaSite };

export { DenaliLegacySchemaForbiddenError } from "@repo/denali-domain";
