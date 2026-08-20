/**
 * Prisma + tenant RLS implementation of {@link CommercialQuoteRepositoryPort} (CQ-1C / CQ-2C).
 */
import type { FinanceCommercialQuote } from "@prisma/client";

import {
  selectActiveCommercialQuote,
  type CommercialQuoteSource,
  type CommercialQuoteStatus,
  type CommercialQuoteVersion,
  type CreateCommercialQuoteVersionInput,
  type MemberDiscountQuoteMetadata,
} from "@app-tour/finance-core/domain";
import type { CommercialQuoteRepositoryPort } from "@app-tour/finance-core/ports";

import { withTenantRls } from "../../db/with-tenant-rls";

function mapMemberDiscountMetadata(row: FinanceCommercialQuote): MemberDiscountQuoteMetadata | undefined {
  if (
    row.memberDiscountPercentageApplied === null ||
    row.memberDiscountMinor === null ||
    row.memberDiscountMemberUserId === null ||
    row.memberDiscountMembershipReference === null
  ) {
    return undefined;
  }
  return {
    percentageApplied: row.memberDiscountPercentageApplied,
    discountMinor: row.memberDiscountMinor,
    memberUserId: row.memberDiscountMemberUserId,
    membershipReference: row.memberDiscountMembershipReference,
  };
}

function mapCommercialQuoteRow(row: FinanceCommercialQuote): CommercialQuoteVersion {
  const memberDiscount = mapMemberDiscountMetadata(row);
  return {
    id: row.id,
    tenantId: row.tenantId,
    registrationId: row.registrationId,
    versionNumber: row.versionNumber,
    status: row.status as CommercialQuoteStatus,
    grossMinor: row.grossMinor,
    payableMinor: row.payableMinor,
    currency: row.currency,
    source: row.source as CommercialQuoteSource,
    calculationVersion: row.calculationVersion,
    supersedesVersionId: row.supersedesVersionId,
    createdAt: row.createdAt.toISOString(),
    ...(memberDiscount !== undefined ? { memberDiscount } : {}),
  };
}

function memberDiscountCreateFields(
  memberDiscount: MemberDiscountQuoteMetadata | undefined
): Pick<
  FinanceCommercialQuote,
  | "memberDiscountPercentageApplied"
  | "memberDiscountMinor"
  | "memberDiscountMemberUserId"
  | "memberDiscountMembershipReference"
> {
  if (memberDiscount === undefined) {
    return {
      memberDiscountPercentageApplied: null,
      memberDiscountMinor: null,
      memberDiscountMemberUserId: null,
      memberDiscountMembershipReference: null,
    };
  }
  return {
    memberDiscountPercentageApplied: memberDiscount.percentageApplied,
    memberDiscountMinor: memberDiscount.discountMinor,
    memberDiscountMemberUserId: memberDiscount.memberUserId,
    memberDiscountMembershipReference: memberDiscount.membershipReference,
  };
}

async function loadChain(
  tenantId: string,
  registrationId: string
): Promise<CommercialQuoteVersion[]> {
  return withTenantRls(tenantId, async (tx) => {
    const rows = await tx.financeCommercialQuote.findMany({
      where: { tenantId, registrationId },
      orderBy: { versionNumber: "asc" },
    });
    return rows.map(mapCommercialQuoteRow);
  });
}

export class PrismaCommercialQuoteRepository implements CommercialQuoteRepositoryPort {
  async createVersion(input: CreateCommercialQuoteVersionInput): Promise<CommercialQuoteVersion> {
    const tenantId = input.tenantId.trim();
    const registrationId = input.registrationId.trim();

    return withTenantRls(tenantId, async (tx) => {
      const existing = await tx.financeCommercialQuote.findMany({
        where: { tenantId, registrationId },
        select: { versionNumber: true, status: true },
      });
      if (existing.some((row) => row.status === "LOCKED")) {
        throw new Error("COMMERCIAL_QUOTE_CHAIN_LOCKED");
      }

      const versionNumber =
        existing.length === 0
          ? 1
          : Math.max(...existing.map((row) => row.versionNumber)) + 1;

      const created = await tx.financeCommercialQuote.create({
        data: {
          tenantId,
          registrationId,
          versionNumber,
          status: "FROZEN",
          grossMinor: input.grossMinor,
          payableMinor: input.payableMinor,
          currency: input.currency.toUpperCase(),
          source: input.source,
          calculationVersion: input.calculationVersion ?? "quote-v1",
          supersedesVersionId: input.supersedesVersionId ?? null,
          ...memberDiscountCreateFields(input.memberDiscount),
          ...(input.createdAt !== undefined ? { createdAt: new Date(input.createdAt) } : {}),
        },
      });
      return mapCommercialQuoteRow(created);
    });
  }

  async getActive(tenantId: string, registrationId: string): Promise<CommercialQuoteVersion | null> {
    const chain = await loadChain(tenantId.trim(), registrationId.trim());
    const active = selectActiveCommercialQuote(chain);
    return active ?? null;
  }

  async getChain(
    tenantId: string,
    registrationId: string
  ): Promise<readonly CommercialQuoteVersion[]> {
    return loadChain(tenantId.trim(), registrationId.trim());
  }

  async markSuperseded(tenantId: string, versionId: string): Promise<CommercialQuoteVersion> {
    const normalizedTenantId = tenantId.trim();
    return withTenantRls(normalizedTenantId, async (tx) => {
      const existing = await tx.financeCommercialQuote.findFirst({
        where: { id: versionId.trim(), tenantId: normalizedTenantId },
      });
      if (existing === null) {
        throw new Error("COMMERCIAL_QUOTE_NOT_FOUND");
      }
      if (existing.status !== "FROZEN") {
        throw new Error("COMMERCIAL_QUOTE_NOT_SUPERSEDABLE");
      }

      const updated = await tx.financeCommercialQuote.update({
        where: { id: existing.id },
        data: { status: "SUPERSEDED" },
      });
      return mapCommercialQuoteRow(updated);
    });
  }

  async lockChain(
    tenantId: string,
    registrationId: string
  ): Promise<readonly CommercialQuoteVersion[]> {
    const normalizedTenantId = tenantId.trim();
    const normalizedRegistrationId = registrationId.trim();

    return withTenantRls(normalizedTenantId, async (tx) => {
      const rows = await tx.financeCommercialQuote.findMany({
        where: {
          tenantId: normalizedTenantId,
          registrationId: normalizedRegistrationId,
        },
        orderBy: { versionNumber: "asc" },
      });
      const chain = rows.map(mapCommercialQuoteRow);
      const active = selectActiveCommercialQuote(chain);
      if (active === null) {
        throw new Error("COMMERCIAL_QUOTE_NOT_FOUND");
      }
      if (active.status === "LOCKED") {
        return chain;
      }
      if (active.status !== "FROZEN") {
        throw new Error("COMMERCIAL_QUOTE_NOT_LOCKABLE");
      }

      await tx.financeCommercialQuote.update({
        where: { id: active.id },
        data: { status: "LOCKED" },
      });

      const reloaded = await tx.financeCommercialQuote.findMany({
        where: {
          tenantId: normalizedTenantId,
          registrationId: normalizedRegistrationId,
        },
        orderBy: { versionNumber: "asc" },
      });
      return reloaded.map(mapCommercialQuoteRow);
    });
  }
}
