/**
 * Process-wide in-memory commercial quote store (CQ-1B).
 * Prisma persistence lands in a later phase — memory driver + pre-migration host path.
 */
import { randomUUID } from "node:crypto";

import {
  selectActiveCommercialQuote,
  type CommercialQuoteVersion,
  type CreateCommercialQuoteVersionInput,
} from "@app-tour/finance-core/domain";

type StoredQuote = CommercialQuoteVersion;

const quotesById = new Map<string, StoredQuote>();

export function resetFinanceCommercialQuoteStoreForTests(): void {
  quotesById.clear();
}

function listChain(tenantId: string, registrationId: string): StoredQuote[] {
  return [...quotesById.values()]
    .filter((row) => row.tenantId === tenantId && row.registrationId === registrationId)
    .sort((a, b) => a.versionNumber - b.versionNumber);
}

function cloneQuote(row: StoredQuote): StoredQuote {
  return { ...row };
}

export function createCommercialQuoteVersion(
  input: CreateCommercialQuoteVersionInput
): CommercialQuoteVersion {
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

export function getCommercialQuoteChain(
  tenantId: string,
  registrationId: string
): readonly CommercialQuoteVersion[] {
  return listChain(tenantId, registrationId).map(cloneQuote);
}

export function getActiveCommercialQuote(
  tenantId: string,
  registrationId: string
): CommercialQuoteVersion | null {
  const active = selectActiveCommercialQuote(listChain(tenantId, registrationId));
  return active === null ? null : cloneQuote(active);
}

export function markCommercialQuoteSuperseded(
  tenantId: string,
  versionId: string
): CommercialQuoteVersion {
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

export function lockCommercialQuoteChain(
  tenantId: string,
  registrationId: string
): readonly CommercialQuoteVersion[] {
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
