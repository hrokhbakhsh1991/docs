/**
 * CQ-1C — Prisma commercial quote persistence + tenant isolation.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import type { CreateCommercialQuoteVersionInput } from "@app-tour/finance-core/domain";

import { disconnectPrisma, getPrismaAdmin } from "../src/db/prisma";
import { PrismaCommercialQuoteRepository } from "../src/workspace-finance/infrastructure/prisma-commercial-quote.repository";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());

function quoteInput(
  tenantId: string,
  registrationId: string,
  overrides: Partial<CreateCommercialQuoteVersionInput> = {}
): CreateCommercialQuoteVersionInput {
  return {
    tenantId,
    registrationId,
    grossMinor: "5000000",
    payableMinor: "5000000",
    currency: "IRR",
    source: "tour_canonical",
    ...overrides,
  };
}

describe(
  "commercial-quote-prisma.postgres.spec.ts — CQ-1C",
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
            subdomain: `cq-a-${tenantA.slice(0, 8)}`,
            workspaceType: "denali",
            theme: {},
          },
          {
            id: tenantB,
            subdomain: `cq-b-${tenantB.slice(0, 8)}`,
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

    it("CQ-DB-01: persist quote and reload", async () => {
      const registrationId = randomUUID();
      const writer = new PrismaCommercialQuoteRepository();
      const created = await writer.createVersion(quoteInput(tenantA, registrationId));

      const reader = new PrismaCommercialQuoteRepository();
      const active = await reader.getActive(tenantA, registrationId);

      assert.ok(active !== null);
      assert.equal(active.id, created.id);
      assert.equal(active.payableMinor, "5000000");
      assert.equal(active.status, "FROZEN");
    });

    it("CQ-DB-02: supersede survives restart", async () => {
      const registrationId = randomUUID();
      const writer = new PrismaCommercialQuoteRepository();
      const v1 = await writer.createVersion(quoteInput(tenantA, registrationId));
      await writer.markSuperseded(tenantA, v1.id);
      await writer.createVersion(
        quoteInput(tenantA, registrationId, {
          payableMinor: "4200000",
          source: "operator_override",
          supersedesVersionId: v1.id,
        })
      );

      const reader = new PrismaCommercialQuoteRepository();
      const chain = await reader.getChain(tenantA, registrationId);
      assert.equal(chain.length, 2);
      assert.equal(chain[0]?.status, "SUPERSEDED");
      assert.equal(chain[0]?.payableMinor, "5000000");
      assert.equal(chain[1]?.status, "FROZEN");
      assert.equal(chain[1]?.payableMinor, "4200000");
    });

    it("CQ-DB-03: lock survives restart", async () => {
      const registrationId = randomUUID();
      const writer = new PrismaCommercialQuoteRepository();
      await writer.createVersion(quoteInput(tenantA, registrationId));
      await writer.lockChain(tenantA, registrationId);

      const reader = new PrismaCommercialQuoteRepository();
      const active = await reader.getActive(tenantA, registrationId);
      assert.equal(active?.status, "LOCKED");

      await assert.rejects(
        () =>
          reader.createVersion(
            quoteInput(tenantA, registrationId, { payableMinor: "1000000", source: "operator_override" })
          ),
        /COMMERCIAL_QUOTE_CHAIN_LOCKED/
      );
    });

    it("CQ-DB-04: tenant isolation", async () => {
      const registrationId = randomUUID();
      const writer = new PrismaCommercialQuoteRepository();
      const created = await writer.createVersion(quoteInput(tenantA, registrationId));

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

describe("commercial-quote-prisma.postgres.spec.ts skip marker", { skip: hasDatabase }, () => {
  it("CQ-DB-REQUIRES_DATABASE", () => {
    assert.ok(true);
  });
});
