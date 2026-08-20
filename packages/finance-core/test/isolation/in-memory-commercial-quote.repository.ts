/**
 * Test-only in-memory CommercialQuoteRepositoryPort (CQ-1A).
 * Not production-equivalent to Prisma RLS persistence.
 */
import { randomUUID } from "node:crypto";

import {
  selectActiveCommercialQuote,
  type CommercialQuoteVersion,
  type CreateCommercialQuoteVersionInput,
} from "../../src/domain/commercial-quote";
import type { CommercialQuoteRepositoryPort } from "../../src/ports/commercial-quote-repository.port";

type StoredQuote = CommercialQuoteVersion;

let quotesById = new Map<string, StoredQuote>();

export function resetInMemoryCommercialQuoteRepositoryForTests(): void {
  quotesById = new Map();
}

function listChain(tenantId: string, registrationId: string): StoredQuote[] {
  return [...quotesById.values()]
    .filter((row) => row.tenantId === tenantId && row.registrationId === registrationId)
    .sort((a, b) => a.versionNumber - b.versionNumber);
}

function cloneQuote(row: StoredQuote): StoredQuote {
  return { ...row };
}

export class InMemoryCommercialQuoteRepository implements CommercialQuoteRepositoryPort {
  async createVersion(input: CreateCommercialQuoteVersionInput): Promise<CommercialQuoteVersion> {
    const chain = listChain(input.tenantId, input.registrationId);
    if (chain.some((row) => row.status === "LOCKED")) {
      throw new Error("COMMERCIAL_QUOTE_CHAIN_LOCKED");
    }

    const versionNumber =
      chain.length === 0 ? 1 : Math.max(...chain.map((row) => row.versionNumber)) + 1;

    const row: StoredQuote = {
      id: randomUUID(),
      tenantId: input.tenantId,
      registrationId: input.registrationId,
      versionNumber,
      status: "FROZEN",
      grossMinor: input.grossMinor,
      payableMinor: input.payableMinor,
      currency: input.currency,
      source: input.source,
      calculationVersion: input.calculationVersion ?? "quote-v1",
      supersedesVersionId: input.supersedesVersionId ?? null,
      createdAt: input.createdAt ?? new Date().toISOString(),
      ...(input.tourId !== undefined ? { tourId: input.tourId } : {}),
    };

    quotesById.set(row.id, row);
    return cloneQuote(row);
  }

  async getChain(tenantId: string, registrationId: string): Promise<readonly CommercialQuoteVersion[]> {
    return listChain(tenantId, registrationId).map(cloneQuote);
  }

  async getActive(tenantId: string, registrationId: string): Promise<CommercialQuoteVersion | null> {
    const active = selectActiveCommercialQuote(listChain(tenantId, registrationId));
    return active === null ? null : cloneQuote(active);
  }

  async markSuperseded(tenantId: string, versionId: string): Promise<CommercialQuoteVersion> {
    const existing = quotesById.get(versionId);
    if (existing === undefined || existing.tenantId !== tenantId) {
      throw new Error("COMMERCIAL_QUOTE_NOT_FOUND");
    }
    if (existing.status !== "FROZEN") {
      throw new Error("COMMERCIAL_QUOTE_NOT_SUPERSEDABLE");
    }

    const updated: StoredQuote = {
      ...existing,
      status: "SUPERSEDED",
    };
    quotesById.set(versionId, updated);
    return cloneQuote(updated);
  }

  async lockChain(tenantId: string, registrationId: string): Promise<readonly CommercialQuoteVersion[]> {
    const chain = listChain(tenantId, registrationId);
    const active = selectActiveCommercialQuote(chain);
    if (active === null) {
      throw new Error("COMMERCIAL_QUOTE_NOT_FOUND");
    }
    if (active.status === "LOCKED") {
      return chain.map(cloneQuote);
    }
    if (active.status !== "FROZEN") {
      throw new Error("COMMERCIAL_QUOTE_NOT_LOCKABLE");
    }

    const locked: StoredQuote = {
      ...active,
      status: "LOCKED",
    };
    quotesById.set(active.id, locked);
    return listChain(tenantId, registrationId).map(cloneQuote);
  }
}
