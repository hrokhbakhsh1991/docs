/**
 * Host adapter — commercial quote persistence (memory or Prisma + RLS).
 */

import type {
  CommercialQuoteRepositoryPort,
  CommercialQuoteVersion,
  CreateCommercialQuoteVersionInput,
} from "@app-tour/finance-core/ports";

import { resolveStorageDriver } from "../../storage/production-storage-driver-assert";
import {
  createCommercialQuoteVersion,
  getActiveCommercialQuote,
  getCommercialQuoteChain,
  lockCommercialQuoteChain,
  markCommercialQuoteSuperseded,
} from "../finance-commercial-quote-store";
import { PrismaCommercialQuoteRepository } from "./prisma-commercial-quote.repository";

function useMemoryCommercialQuoteStore(): boolean {
  return resolveStorageDriver() === "memory";
}

export class HostCommercialQuoteRepository implements CommercialQuoteRepositoryPort {
  private readonly prismaRepo = new PrismaCommercialQuoteRepository();

  createVersion(input: CreateCommercialQuoteVersionInput): Promise<CommercialQuoteVersion> {
    if (useMemoryCommercialQuoteStore()) {
      return Promise.resolve(createCommercialQuoteVersion(input));
    }
    return this.prismaRepo.createVersion(input);
  }

  getActive(tenantId: string, registrationId: string): Promise<CommercialQuoteVersion | null> {
    if (useMemoryCommercialQuoteStore()) {
      return Promise.resolve(getActiveCommercialQuote(tenantId, registrationId));
    }
    return this.prismaRepo.getActive(tenantId, registrationId);
  }

  getChain(tenantId: string, registrationId: string): Promise<readonly CommercialQuoteVersion[]> {
    if (useMemoryCommercialQuoteStore()) {
      return Promise.resolve(getCommercialQuoteChain(tenantId, registrationId));
    }
    return this.prismaRepo.getChain(tenantId, registrationId);
  }

  markSuperseded(tenantId: string, versionId: string): Promise<CommercialQuoteVersion> {
    if (useMemoryCommercialQuoteStore()) {
      return Promise.resolve(markCommercialQuoteSuperseded(tenantId, versionId));
    }
    return this.prismaRepo.markSuperseded(tenantId, versionId);
  }

  lockChain(
    tenantId: string,
    registrationId: string
  ): Promise<readonly CommercialQuoteVersion[]> {
    if (useMemoryCommercialQuoteStore()) {
      return Promise.resolve(lockCommercialQuoteChain(tenantId, registrationId));
    }
    return this.prismaRepo.lockChain(tenantId, registrationId);
  }
}
