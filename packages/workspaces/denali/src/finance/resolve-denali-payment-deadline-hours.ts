/**
 * DP1-B — resolve payment deadline policy hours (DEN-PROD-01).
 */

const DEFAULT_POLICY_HOURS = 24;

export type ResolveDenaliPaymentDeadlineHoursInput = {
  readonly tourCanonical?: Readonly<Record<string, unknown>> | null;
  readonly workspacePolicyHours?: number | null;
  readonly workspaceManualNoExpiry?: boolean;
};

function readPricing(
  tourCanonical: Readonly<Record<string, unknown>> | null | undefined
): Readonly<Record<string, unknown>> | null {
  if (tourCanonical === null || tourCanonical === undefined) {
    return null;
  }
  const data = tourCanonical.data;
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    const pricing = (data as Record<string, unknown>).pricing;
    if (pricing !== null && typeof pricing === "object" && !Array.isArray(pricing)) {
      return pricing as Record<string, unknown>;
    }
  }
  const pricing = tourCanonical.pricing;
  if (pricing !== null && typeof pricing === "object" && !Array.isArray(pricing)) {
    return pricing as Record<string, unknown>;
  }
  return null;
}

export function resolveDenaliPaymentDeadlineHours(
  input: ResolveDenaliPaymentDeadlineHoursInput
): number | null {
  const pricing = readPricing(input.tourCanonical);
  const tourHours = pricing?.paymentDeadlineHours;

  if (tourHours === null && input.workspaceManualNoExpiry === true) {
    return null;
  }

  if (typeof tourHours === "number") {
    if (!Number.isInteger(tourHours) || tourHours <= 0) {
      throw new Error("paymentDeadlineHours must be a positive integer");
    }
    return tourHours;
  }

  if (typeof input.workspacePolicyHours === "number") {
    if (!Number.isInteger(input.workspacePolicyHours) || input.workspacePolicyHours <= 0) {
      throw new Error("workspacePolicyHours must be a positive integer");
    }
    return input.workspacePolicyHours;
  }

  if (tourHours === null && input.workspaceManualNoExpiry !== true) {
    return DEFAULT_POLICY_HOURS;
  }

  return DEFAULT_POLICY_HOURS;
}

export function computeDenaliPaymentDueAt(input: {
  readonly approvedAt: string;
  readonly policyHours: number;
}): string {
  const approvedMs = Date.parse(input.approvedAt);
  if (!Number.isFinite(approvedMs)) {
    throw new Error("approvedAt must be a valid ISO-8601 instant");
  }
  return new Date(approvedMs + input.policyHours * 3_600_000).toISOString();
}
