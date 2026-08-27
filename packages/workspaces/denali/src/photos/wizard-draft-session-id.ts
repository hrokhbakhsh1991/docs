import { createClientSafeUuid } from "@app-tour/draft-engine";

/** Matches API `tour-wizard-photos` header validation (RFC 4122 UUID). */
export const DENALI_WIZARD_DRAFT_SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDenaliWizardDraftSessionId(value: string): boolean {
  return DENALI_WIZARD_DRAFT_SESSION_ID_PATTERN.test(value.trim());
}

/** Stable wizard draft session id for MinIO object keys — always UUID-shaped. */
export function createDenaliWizardDraftSessionId(): string {
  return createClientSafeUuid();
}
