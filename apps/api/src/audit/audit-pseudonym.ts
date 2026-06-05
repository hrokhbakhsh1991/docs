import { createHmac } from "node:crypto";

import { isProductionAuthMode } from "../tenant-kernel/auth-env";

export const AUDIT_PSEUDONYM_KEY_REQUIRED = "AUDIT_PSEUDONYM_KEY_REQUIRED";

function readAuditPseudonymKey(): string {
  const fromEnv = process.env.AUDIT_PSEUDONYM_KEY?.trim() ?? process.env.LOG_HASH_KEY?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv;
  }
  if (process.env.NODE_ENV === "test") {
    return "test-audit-pseudonym-key";
  }
  if (isProductionAuthMode()) {
    throw new Error(AUDIT_PSEUDONYM_KEY_REQUIRED);
  }
  return "dev-audit-pseudonym-key";
}

/**
 * Tenant-scoped HMAC pseudonym for audit `actor_id` — LOG-COL-03 / DEC-034.
 * Raw user ids must not be stored alongside tenant_id + entity_id in audit rows.
 */
export function pseudonymizeAuditActorId(actorId: string, tenantId: string): string {
  const normalizedActor = actorId.trim();
  const normalizedTenant = tenantId.trim();
  if (normalizedActor.length === 0) {
    throw new Error("AUDIT_ACTOR_ID_REQUIRED");
  }
  if (normalizedTenant.length === 0) {
    throw new Error("AUDIT_TENANT_ID_REQUIRED");
  }
  return createHmac("sha256", readAuditPseudonymKey())
    .update(`${normalizedTenant}\0${normalizedActor}`)
    .digest("hex");
}
