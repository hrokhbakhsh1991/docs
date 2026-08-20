/**
 * Host adapter — commercial quote store (memory until Prisma table lands).
 */

import type {
  CommercialQuoteRepositoryPort,
  CommercialQuoteVersion,
  CreateCommercialQuoteVersionInput,
} from "@app-tour/finance-core/ports";

import {
  createCommercialQuoteVersion,
  getActiveCommercialQuote,
  getCommercialQuoteChain,
  lockCommercialQuoteChain,
  markCommercialQuoteSuperseded,
} from "../finance-commercial-quote-store";

export class HostCommercialQuoteRepository implements CommercialQuoteRepositoryPort {
  createVersion(input: CreateCommercialQuoteVersionInput): Promise<CommercialQuoteVersion> {
    return Promise.resolve(createCommercialQuoteVersion(input));
  }

  getActive(tenantId: string, registrationId: string): Promise<CommercialQuoteVersion | null> {
    return Promise.resolve(getActiveCommercialQuote(tenantId, registrationId));
  }

  getChain(tenantId: string, registrationId: string): Promise<readonly CommercialQuoteVersion[]> {
    return Promise.resolve(getCommercialQuoteChain(tenantId, registrationId));
  }

  markSuperseded(tenantId: string, versionId: string): Promise<CommercialQuoteVersion> {
    return Promise.resolve(markCommercialQuoteSuperseded(tenantId, versionId));
  }

  lockChain(
    tenantId: string,
    registrationId: string
  ): Promise<readonly CommercialQuoteVersion[]> {
    return Promise.resolve(lockCommercialQuoteChain(tenantId, registrationId));
  }
}
