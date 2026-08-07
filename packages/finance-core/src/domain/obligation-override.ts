/**
 * Pure helpers — registration obligation override / zero detection (phase 5).
 */

export const OBLIGATION_OVERRIDE_INTAKE_KEY = "obligationOverride" as const;

export type ObligationOverrideIntake = {
  readonly obligationMinor: string;
  readonly reason?: string;
  readonly setAt: string;
  readonly setByUserId: string;
};

export function isZeroObligationMinor(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) {
    return false;
  }
  try {
    return BigInt(digits) === BigInt(0);
  } catch {
    return false;
  }
}

export function readObligationOverrideFromIntake(
  intake: Readonly<Record<string, unknown>> | undefined | null
): ObligationOverrideIntake | null {
  if (intake === null || intake === undefined) {
    return null;
  }
  const raw = intake[OBLIGATION_OVERRIDE_INTAKE_KEY];
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const obligationMinor =
    typeof record.obligationMinor === "string" ? record.obligationMinor.trim() : "";
  if (!/^\d+$/.test(obligationMinor)) {
    return null;
  }
  const setAt = typeof record.setAt === "string" ? record.setAt.trim() : "";
  const setByUserId = typeof record.setByUserId === "string" ? record.setByUserId.trim() : "";
  if (setAt.length === 0 || setByUserId.length === 0) {
    return null;
  }
  const reason =
    typeof record.reason === "string" && record.reason.trim().length > 0
      ? record.reason.trim()
      : undefined;
  return {
    obligationMinor,
    setAt,
    setByUserId,
    ...(reason !== undefined ? { reason } : {}),
  };
}

export function buildObligationOverrideIntakeValue(input: {
  readonly obligationMinor: string;
  readonly reason?: string;
  readonly setAt: string;
  readonly setByUserId: string;
}): ObligationOverrideIntake {
  const obligationMinor = input.obligationMinor.trim();
  if (!/^\d+$/.test(obligationMinor)) {
    throw new Error("ZOD_VALIDATION_FAILED: obligationMinor must be a minor-unit integer string");
  }
  return {
    obligationMinor,
    setAt: input.setAt,
    setByUserId: input.setByUserId,
    ...(input.reason !== undefined && input.reason.trim().length > 0
      ? { reason: input.reason.trim() }
      : {}),
  };
}
