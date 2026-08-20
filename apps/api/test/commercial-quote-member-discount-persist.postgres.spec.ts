/**
 * CQ-2C — Prisma member discount metadata persistence.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { buildMemberDiscountQuoteMetadata } from "@app-tour/finance-core/domain";
import type { CreateCommercialQuoteVersionInput } from "@app-tour/finance-core/domain";

import { disconnectPrisma, getPrismaAdmin } from "../src/db/prisma";
import { PrismaCommercialQuoteRepository } from "../src/workspace-finance/infrastructure/prisma-commercial-quote.repository";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());

const MEMBER_USER = "00000000-0000-4000-8000-000000000201";

function memberDiscountQuoteInput(
  tenantId: string,
  registrationId: string
): CreateCommercialQuoteVersionInput {
  return {
    tenantId,
    registrationId,
    grossMinor: "10000000",
    payableMinor: "8000000",
    currency: "IRR",
    source: "member_discount",
    memberDiscount: buildMemberDiscountQuoteMetadata({
      tenantId,
      memberUserId: MEMBER_USER,
      percentageApplied: 20,
      discountMinor: "2000000",
    }),
  };
}

describe(
  "commercial-quote-member-discount-persist.postgres.spec.ts — CQ-2C",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const priorDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      const admin = getPrismaAdmin();
      await admin.tenant.createMany({
        data: [
          {
            id: tenantA,
            subdomain: `cq-md-a-${tenantA.slice(0, 8)}`,
            workspaceType: "denali",
            theme: {},
          },
          {
            id: tenantB,
            subdomain: `cq-md-b-${tenantB.slice(0, 8)}`,
            workspaceType: "denali",
            theme: {},
          },
        ],
      });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorDriver;
      const admin = getPrismaAdmin();
      await admin.financeCommercialQuote.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await admin.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
      await disconnectPrisma();
    });

    it("CQ-DISC-PERSIST-01: create member discount quote and reload", async () => {
      const registrationId = randomUUID();
      const writer = new PrismaCommercialQuoteRepository();
      const created = await writer.createVersion(memberDiscountQuoteInput(tenantA, registrationId));

      const reader = new PrismaCommercialQuoteRepository();
      const active = await reader.getActive(tenantA, registrationId);

      assert.ok(active !== null);
      assert.equal(active.id, created.id);
      assert.equal(active.source, "member_discount");
      assert.equal(active.grossMinor, "10000000");
      assert.equal(active.payableMinor, "8000000");
      assert.equal(active.memberDiscount?.percentageApplied, 20);
      assert.equal(active.memberDiscount?.discountMinor, "2000000");
      assert.equal(active.memberDiscount?.memberUserId, MEMBER_USER);
    });

    it("CQ-DISC-PERSIST-02: metadata survives repository reload", async () => {
      const registrationId = randomUUID();
      const writer = new PrismaCommercialQuoteRepository();
      await writer.createVersion(memberDiscountQuoteInput(tenantA, registrationId));

      const chain = await new PrismaCommercialQuoteRepository().getChain(tenantA, registrationId);
      const quote = chain[0];
      assert.ok(quote !== undefined);
      assert.equal(
        quote.memberDiscount?.membershipReference,
        `userTenant:${tenantA}:${MEMBER_USER}`
      );
    });

    it("CQ-DISC-PERSIST-03: tenant isolation", async () => {
      const registrationId = randomUUID();
      const writer = new PrismaCommercialQuoteRepository();
      const created = await writer.createVersion(memberDiscountQuoteInput(tenantA, registrationId));

      const reader = new PrismaCommercialQuoteRepository();
      assert.equal(await reader.getActive(tenantB, registrationId), null);
      assert.deepEqual(await reader.getChain(tenantB, registrationId), []);
      await assert.rejects(
        () => reader.markSuperseded(tenantB, created.id),
        /COMMERCIAL_QUOTE_NOT_FOUND/
      );
    });
  }
);

describe("commercial-quote-member-discount-persist.postgres.spec.ts skip marker", {
  skip: hasDatabase,
}) {
  it("CQ-DISC-PERSIST-REQUIRES_DATABASE", () => {
    assert.ok(true);
  });
});
