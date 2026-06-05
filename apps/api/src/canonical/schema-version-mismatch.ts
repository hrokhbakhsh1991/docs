import { getActiveTraceId } from "../observability/trace-request-context";
import { getActiveTenantId } from "../tenant/tenant-request-context";
import { hashTenantIdForLog } from "../observability/log-safety";

/**
 * Client `schemaVersion` disagrees with workspace current revision (Phase 6 prep).
 */
export class SchemaVersionMismatchError extends Error {
  readonly code = "SCHEMA_VERSION_MISMATCH" as const;
  tenant_id?: string;
  tenantId?: string;
  correlation_id?: string;
  correlationId?: string;

  constructor(
    readonly requestedVersion: number,
    readonly currentVersion: number
  ) {
    super(
      `SCHEMA_VERSION_MISMATCH: requested ${requestedVersion}, workspace current ${currentVersion}`
    );
    this.name = "SchemaVersionMismatchError";
  }
}

export function isSchemaVersionMismatchError(error: unknown): error is SchemaVersionMismatchError {
  return error instanceof SchemaVersionMismatchError;
}

function enrichSchemaVersionMismatch(
  error: SchemaVersionMismatchError
): SchemaVersionMismatchError {
  const tenantId = getActiveTenantId();
  const correlationId = getActiveTraceId();
  if (tenantId !== undefined) {
    error.tenant_id = tenantId;
    error.tenantId = tenantId;
  }
  if (correlationId !== undefined) {
    error.correlation_id = correlationId;
    error.correlationId = correlationId;
  }
  return error;
}

export function throwSchemaVersionMismatch(
  requestedVersion: number,
  currentVersion: number
): never {
  throw enrichSchemaVersionMismatch(
    new SchemaVersionMismatchError(requestedVersion, currentVersion)
  );
}

/** LOG-COL-07 / DEC-038 — safe shared-stream fields only; never version text/raw tenant_id. */
export function toSchemaVersionMismatchLogFields(
  error: SchemaVersionMismatchError
): Record<string, unknown> {
  const tenantId = error.tenant_id ?? error.tenantId;
  const correlationId = error.correlation_id ?? error.correlationId;
  return {
    event: "client.schema_version_mismatch",
    error_code: error.code,
    tenant_hash: hashTenantIdForLog(tenantId),
    correlation_id: correlationId,
  };
}
