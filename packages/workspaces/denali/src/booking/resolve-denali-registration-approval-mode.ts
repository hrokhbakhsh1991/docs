/**
 * Pure Denali tour policy — public registration approval mode.
 *
 * Operator SoT is wizard checkbox `requiresManualAdminApproval`.
 * Persist also writes `pricing.registrationApproval` so pricing-path readers stay aligned.
 * Missing both → manual (safe default for screened club tours).
 */

export type DenaliRegistrationApprovalMode = "manual" | "auto";

function readCanonicalPath(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== "object" || Array.isArray(acc)) {
      return undefined;
    }
    return (acc as Record<string, unknown>)[key];
  }, data);
}

function asDataRoot(tourCanonical: unknown): Record<string, unknown> | null {
  if (tourCanonical === null || typeof tourCanonical !== "object" || Array.isArray(tourCanonical)) {
    return null;
  }
  const root = tourCanonical as Record<string, unknown>;
  const nested = root.data;
  if (nested !== null && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return root;
}

function readExplicitApprovalMode(
  raw: unknown
): DenaliRegistrationApprovalMode | "invalid" | null {
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }
  if (normalized === "auto") {
    return "auto";
  }
  if (normalized === "manual") {
    return "manual";
  }
  return "invalid";
}

/**
 * Wizard stores booleans or `"true"` / `"false"` strings.
 * `null` = flag never saved (fail closed at the resolver).
 */
export function denaliRegistrationApprovalFromManualFlag(
  requiresManualAdminApproval: unknown
): DenaliRegistrationApprovalMode | null {
  if (requiresManualAdminApproval === true || requiresManualAdminApproval === "true") {
    return "manual";
  }
  if (requiresManualAdminApproval === false || requiresManualAdminApproval === "false") {
    return "auto";
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Write `pricing.registrationApproval` from the operator checkbox on wizard persist. */
export function applyDenaliRegistrationApprovalFromOperatorFlag(
  data: Record<string, unknown>
): void {
  const derived = denaliRegistrationApprovalFromManualFlag(data.requiresManualAdminApproval);
  if (derived === null) {
    return;
  }
  const existing = data.pricing;
  const pricing = isRecord(existing) ? existing : {};
  data.pricing = { ...pricing, registrationApproval: derived };
}

/**
 * Resolve public registration approval mode from tour canonical.
 * Accepts either full canonical document (`{ data: {...} }`) or bare `data` object.
 */
export function resolveDenaliRegistrationApprovalMode(
  tourCanonical: unknown
): DenaliRegistrationApprovalMode {
  const data = asDataRoot(tourCanonical);
  if (data === null) {
    return "manual";
  }
  const explicit = readExplicitApprovalMode(
    readCanonicalPath(data, "pricing.registrationApproval") ??
      readCanonicalPath(data, "pricingPayment.registrationApproval")
  );
  if (explicit === "invalid") {
    return "manual";
  }
  if (explicit !== null) {
    return explicit;
  }
  return denaliRegistrationApprovalFromManualFlag(data.requiresManualAdminApproval) ?? "manual";
}
