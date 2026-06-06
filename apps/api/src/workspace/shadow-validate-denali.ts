/**
 * REQ-P6-024 — optional dual-validate diff in non-production only.
 * Production boot must never enable {@link SHADOW_VALIDATE_DENALI_ENV}.
 */
export const SHADOW_VALIDATE_DENALI_ENV = "SHADOW_VALIDATE_DENALI" as const;

export function isShadowValidateDenaliEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env[SHADOW_VALIDATE_DENALI_ENV]?.trim().toLowerCase() === "true";
}

/** Throws when production config would enable shadow validate (fail-closed). */
export function assertShadowValidateDenaliProductionSafety(): void {
  if (
    process.env.NODE_ENV === "production" &&
    process.env[SHADOW_VALIDATE_DENALI_ENV]?.trim().toLowerCase() === "true"
  ) {
    throw new Error("SHADOW_VALIDATE_DENALI_FORBIDDEN_IN_PRODUCTION");
  }
}
