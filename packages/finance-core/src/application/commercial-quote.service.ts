/**
 * Commercial Quote application service — version lifecycle only (CQ-1A).
 * No invoice, payment, or live obligation wiring in this phase.
 */

import {
  assertCommercialQuoteChainNotLocked,
  assertCommercialQuoteMinor,
  COMMERCIAL_QUOTE_CALCULATION_VERSION,
  normalizeCommercialQuoteCurrency,
  type CommercialQuoteVersion,
  type CreateCommercialQuoteVersionInput,
} from "../domain/commercial-quote";
import type { CommercialQuoteRepositoryPort } from "../ports/commercial-quote-repository.port";

function normalizeCreateInput(
  input: CreateCommercialQuoteVersionInput
): CreateCommercialQuoteVersionInput {
  return {
    tenantId: input.tenantId.trim(),
    registrationId: input.registrationId.trim(),
    grossMinor: assertCommercialQuoteMinor(input.grossMinor, "grossMinor"),
    payableMinor: assertCommercialQuoteMinor(input.payableMinor, "payableMinor"),
    currency: normalizeCommercialQuoteCurrency(input.currency),
    source: input.source,
    calculationVersion: input.calculationVersion ?? COMMERCIAL_QUOTE_CALCULATION_VERSION,
    supersedesVersionId: input.supersedesVersionId ?? null,
    ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
    ...(input.tourId !== undefined ? { tourId: input.tourId.trim() } : {}),
  };
}

export class CommercialQuoteService {
  constructor(private readonly quotes: CommercialQuoteRepositoryPort) {}

  async getActiveQuote(
    tenantId: string,
    registrationId: string
  ): Promise<CommercialQuoteVersion | null> {
    return this.quotes.getActive(tenantId.trim(), registrationId.trim());
  }

  async getQuoteChain(
    tenantId: string,
    registrationId: string
  ): Promise<readonly CommercialQuoteVersion[]> {
    return this.quotes.getChain(tenantId.trim(), registrationId.trim());
  }

  /** First version on an empty, unlocked chain. */
  async createQuoteVersion(
    input: CreateCommercialQuoteVersionInput
  ): Promise<CommercialQuoteVersion> {
    const normalized = normalizeCreateInput(input);
    const chain = await this.quotes.getChain(normalized.tenantId, normalized.registrationId);
    assertCommercialQuoteChainNotLocked(chain);
    if (chain.length > 0) {
      throw new Error("COMMERCIAL_QUOTE_ALREADY_EXISTS");
    }
    return this.quotes.createVersion(normalized);
  }

  /** New immutable version; prior active → SUPERSEDED. Never mutates commercial fields on prior row. */
  async supersedeQuote(input: CreateCommercialQuoteVersionInput): Promise<CommercialQuoteVersion> {
    const normalized = normalizeCreateInput(input);
    const chain = await this.quotes.getChain(normalized.tenantId, normalized.registrationId);
    assertCommercialQuoteChainNotLocked(chain);

    const active = await this.quotes.getActive(normalized.tenantId, normalized.registrationId);
    if (active !== null) {
      await this.quotes.markSuperseded(normalized.tenantId, active.id);
    }

    return this.quotes.createVersion({
      ...normalized,
      supersedesVersionId: active?.id ?? null,
    });
  }

  async lockQuoteChain(
    tenantId: string,
    registrationId: string
  ): Promise<readonly CommercialQuoteVersion[]> {
    return this.quotes.lockChain(tenantId.trim(), registrationId.trim());
  }
}
