import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { deriveTourProjections } from "../src/canonical/projection-sync";
import { persistNewTourAtomically } from "../src/canonical/atomic-canonical-tour-persist";
import {
  clearPreTransactionValidationGate,
  runPreTransactionValidation,
} from "../src/canonical/pre-transaction-validation";
import { integrationTenantId } from "./test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

describe("deriveTourProjections (unit)", () => {
  it("maps basics.title and schemaVersion to projection fields", () => {
    const projections = deriveTourProjections({
      schemaVersion: 2,
      roots: ["basics"],
      data: { basics: { title: "My Tour" } },
    });
    assert.equal(projections.title, "My Tour");
    assert.equal(projections.schemaVersion, 2);
  });
});

describe(
  "canonical projection sync (integration)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = integrationTenantId();
    let admin: PrismaClient;

    before(async () => {
      admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `p53-${tenantId.slice(0, 8)}`,
          workspaceType: "starter",
          theme: {},
        },
      });
    });

    after(async () => {
      await admin.outboxEvent.deleteMany({ where: { tenantId } });
      await admin.tour.deleteMany({ where: { tenantId } });
      await admin.tenant.delete({ where: { id: tenantId } });
      await admin.$disconnect();
    });

    it("persists title and schema_version on tours row in atomic TX", async () => {
      let result;
      try {
        const canonical = await runPreTransactionValidation({
          body: {
            data: {
              basics: { title: "Projected title" },
              details: { summary: "x" },
            },
          },
          tenantId,
          workspaceType: "starter",
        });
        result = await persistNewTourAtomically({ tenantId, canonical });
      } finally {
        clearPreTransactionValidationGate();
      }

      const row = await admin.tour.findUnique({
        where: { tenantId_id: { tenantId, id: result.id } },
      });
      assert.equal(row?.title, "Projected title");
      assert.equal(row?.schemaVersion, 1);
    });
  }
);
