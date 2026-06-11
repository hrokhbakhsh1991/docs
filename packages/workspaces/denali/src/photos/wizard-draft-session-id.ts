/** Matches API `tour-wizard-photos` header validation (RFC 4122 UUID). */
export const DENALI_WIZARD_DRAFT_SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDenaliWizardDraftSessionId(value: string): boolean {
  return DENALI_WIZARD_DRAFT_SESSION_ID_PATTERN.test(value.trim());
}

function formatUuidV4(bytes: Uint8Array): string {
  const normalized = bytes.slice();
  normalized[6] = (normalized[6]! & 0x0f) | 0x40;
  normalized[8] = (normalized[8]! & 0x3f) | 0x80;
  const hex = Array.from(normalized, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Stable wizard draft session id for MinIO object keys — always UUID-shaped. */
export function createDenaliWizardDraftSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return formatUuidV4(bytes);
  }
  throw new Error("DENALI_WIZARD_SESSION_ID_UNAVAILABLE");
}
