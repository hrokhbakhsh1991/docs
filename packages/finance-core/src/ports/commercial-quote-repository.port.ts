/**
 * Commercial Quote persistence port (DEC-CQ-009).
 * Implementations live in host infrastructure or test isolation fakes.
 */

import type {
  CommercialQuoteVersion,
  CreateCommercialQuoteVersionInput,
} from "../domain/commercial-quote";

export type { CommercialQuoteVersion, CreateCommercialQuoteVersionInput };

export interface CommercialQuoteRepositoryPort {
  /** Insert immutable version row. Throws `COMMERCIAL_QUOTE_CHAIN_LOCKED` when chain locked. */
  createVersion(input: CreateCommercialQuoteVersionInput): Promise<CommercialQuoteVersion>;

  /** Latest non-superseded version for `(tenantId, registrationId)`, or null. */
  getActive(tenantId: string, registrationId: string): Promise<CommercialQuoteVersion | null>;

  /** Full version chain ordered by `versionNumber` ascending. */
  getChain(tenantId: string, registrationId: string): Promise<readonly CommercialQuoteVersion[]>;

  /**
   * Transition one FROZEN version to SUPERSEDED (status only — commercial fields unchanged).
   * Throws `COMMERCIAL_QUOTE_NOT_FOUND` on tenant/version mismatch.
   */
  markSuperseded(tenantId: string, versionId: string): Promise<CommercialQuoteVersion>;

  /**
   * Lock active FROZEN version → LOCKED. Idempotent when already locked.
   * Returns full chain after lock.
   */
  lockChain(tenantId: string, registrationId: string): Promise<readonly CommercialQuoteVersion[]>;
}
