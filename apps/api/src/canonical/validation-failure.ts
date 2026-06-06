import { getActiveTraceId } from "../observability/trace-request-context";
import { getActiveTenantId } from "../tenant/tenant-request-context";
import { hashTenantIdForLog } from "../observability/log-safety";

/**
 * Phase 5.2 — business-rule / schema validation failed before any DB transaction.
 * Must prevent tour persist and outbox enqueue (RULE-003).
 */
export class ValidationFailure extends Error {
  readonly code = "VALIDATION_FAILURE";
  tenant_id?: string;
  tenantId?: string;
  correlation_id?: string;
  correlationId?: string;

  constructor(
    message: string,
    readonly detail?: string
  ) {
    super(message);
    this.name = "ValidationFailure";
  }
}

/** OBS-ERR-03 — attach active tenant + trace ALS ids for support correlation. */
export function enrichValidationFailure(failure: ValidationFailure): ValidationFailure {
  const tenantId = getActiveTenantId();
  const correlationId = getActiveTraceId();
  if (tenantId !== undefined) {
    failure.tenant_id = tenantId;
    failure.tenantId = tenantId;
  }
  if (correlationId !== undefined) {
    failure.correlation_id = correlationId;
    failure.correlationId = correlationId;
  }
  return failure;
}

export function throwValidationFailure(message: string, detail?: string): never {
  throw enrichValidationFailure(new ValidationFailure(message, detail));
}

export function isValidationFailure(error: unknown): error is ValidationFailure {
  return error instanceof ValidationFailure;
}

/** LOG-COL-06 / DEC-038 — safe shared-stream fields only; never message/detail/raw tenant_id. */
export function toValidationFailureLogFields(failure: ValidationFailure): Record<string, unknown> {
  const tenantId = failure.tenant_id ?? failure.tenantId;
  const correlationId = failure.correlation_id ?? failure.correlationId;
  return {
    event: "client.validation_failed",
    error_code: failure.code,
    tenant_hash: hashTenantIdForLog(tenantId),
    correlation_id: correlationId,
  };
}
