import { decodeJwtCapabilitySnapshot } from "@repo/shared";

import type { LoggerService } from "../logger/logger.service";

/**
 * Logs when JWT `caps` claim diverges from DB-hydrated effective set (ALS remains authoritative).
 */
export function logJwtCapabilitySnapshotDriftIfNeeded(
  logger: LoggerService,
  input: {
    userId: string;
    tenantId: string;
    jwtCapsClaim: unknown;
    effectiveFromDb: readonly string[];
  },
): void {
  const jwtCaps = decodeJwtCapabilitySnapshot(input.jwtCapsClaim);
  if (jwtCaps.length === 0) {
    return;
  }

  const dbSet = new Set(input.effectiveFromDb);
  const jwtSet = new Set(
    jwtCaps
      .map((c) => c.trim())
      .filter((c) => c.length > 0),
  );

  const missingInJwt = input.effectiveFromDb.filter((c) => !jwtSet.has(c));
  const extraInJwt = [...jwtSet].filter((c) => !dbSet.has(c));

  if (missingInJwt.length === 0 && extraInJwt.length === 0) {
    return;
  }

  logger.warn("JWT capability snapshot drift (DB hydration authoritative)", {
    userId: input.userId,
    tenantId: input.tenantId,
    missing_in_jwt: missingInJwt,
    extra_in_jwt: extraInJwt,
  });
}
