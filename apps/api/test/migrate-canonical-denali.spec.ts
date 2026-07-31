import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";
import {
  DENALI_CURRENT_CANONICAL_SCHEMA_VERSION,
  LEGACY_TRIP_DETAILS_SOT_ROOT,
} from "@app-tour/workspace-denali";

import {
  buildLegacyTripDetailsCanonicalEnvelope,
  isLegacyTripDetailsSchemaVersion,
  migrateWorkspaceCanonicalForTenant,
  parseMigrateCanonicalTenantAllowlist,
  workspaceSupportsCanonicalMigration,
} from "../src/canonical/migrate-canonical-workspace.service";
import { integrationTenantId } from "./test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const GOLDEN_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/workspaces/denali/test/fixtures/golden"
);

describe("migrate-canonical-denali.spec.ts (REQ-P6-017, RULE-P6-010)", () => {
  it("parseMigrateCanonicalTenantAllowlist splits comma-separated UUIDs", () => {
    const allowlist = parseMigrateCanonicalTenantAllowlist("a,b , c");
    assert.deepEqual([...allowlist], ["a", "b", "c"]);
  });

  it("buildLegacyTripDetailsCanonicalEnvelope stages trip_details under single root", () => {
    const legacy = { basicInfo: { title: "legacy-only" } };
    const envelope = buildLegacyTripDetailsCanonicalEnvelope(legacy);
    assert.equal(isLegacyTripDetailsSchemaVersion(envelope.schemaVersion), true);
    assert.deepEqual(envelope.roots, [LEGACY_TRIP_DETAILS_SOT_ROOT]);
  });

  it("workspaceSupportsCanonicalMigration is true for denali only", () => {
    assert.equal(workspaceSupportsCanonicalMigration("denali"), true);
    assert.equal(workspaceSupportsCanonicalMigration("urban"), false);
  });

  it("PSR-4b-defaults: migrateWorkspaceCanonicalForTenant requires workspaceType", async () => {
    await assert.rejects(
      () =>
        migrateWorkspaceCanonicalForTenant({} as never, "tenant-x", {
          allowlist: new Set(["tenant-x"]),
        }),
      /MIGRATE_CANONICAL_WORKSPACE_TYPE_REQUIRED/,
    );
  });
});

describe("migrate-canonical-denali integration", { skip: !hasDatabase, concurrency: false }, () => {
  const allowlistedTenantId = integrationTenantId();
  const controlTenantId = integrationTenantId();
  let admin: PrismaClient;

  before(async () => {
    admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
    const legacy = JSON.parse(
      readFileSync(join(GOLDEN_DIR, "tour-minimal.json"), "utf8")
    ) as Record<string, unknown>;
    const envelope = buildLegacyTripDetailsCanonicalEnvelope(legacy);

    await admin.tenant.createMany({
      data: [
        {
          id: allowlistedTenantId,
          subdomain: `p68-${allowlistedTenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
        {
          id: controlTenantId,
          subdomain: `p68c-${controlTenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
      ],
    });

    await admin.tour.createMany({
      data: [
        {
          tenantId: allowlistedTenantId,
          canonical: envelope as object,
          schemaVersion: envelope.schemaVersion,
          title: null,
        },
        {
          tenantId: controlTenantId,
          canonical: envelope as object,
          schemaVersion: envelope.schemaVersion,
          title: null,
        },
      ],
    });
  });

  after(async () => {
    await admin.$executeRawUnsafe(
      `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
    );
    try {
      for (const tenantId of [allowlistedTenantId, controlTenantId]) {
        await admin.auditEvent.deleteMany({ where: { tenantId } });
        await admin.outboxEvent.deleteMany({ where: { tenantId } });
        await admin.tour.deleteMany({ where: { tenantId } });
        await admin.tenant.delete({ where: { id: tenantId } });
      }
    } finally {
      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
      );
    }
    await admin.$disconnect();
  });

  it("allowlisted tenant migrates trip_details envelope to canonical_data single SoT", async () => {
    const allowlist = new Set([allowlistedTenantId]);
    const result = await migrateWorkspaceCanonicalForTenant(admin, allowlistedTenantId, {
      allowlist,
      workspaceType: "denali",
    });

    assert.equal(result.migratedTourIds.length, 1);

    const row = await admin.tour.findFirst({
      where: { tenantId: allowlistedTenantId },
    });
    assert.ok(row);
    assert.equal(row.schemaVersion, DENALI_CURRENT_CANONICAL_SCHEMA_VERSION);

    const canonical = row.canonical as Record<string, unknown>;
    const data = canonical.data as Record<string, unknown>;
    assert.equal(data[LEGACY_TRIP_DETAILS_SOT_ROOT], undefined);
    assert.equal(canonical.roots.includes(LEGACY_TRIP_DETAILS_SOT_ROOT), false);
    assert.equal(data.title, "Test");
  });

  it("non-allowlisted tenant remains on legacy envelope", async () => {
    const allowlist = new Set([allowlistedTenantId]);
    const result = await migrateWorkspaceCanonicalForTenant(admin, controlTenantId, {
      allowlist,
      workspaceType: "denali",
    });

    assert.equal(result.migratedTourIds.length, 0);

    const row = await admin.tour.findFirst({
      where: { tenantId: controlTenantId },
    });
    assert.ok(row);
    assert.equal(row.schemaVersion, 0);
    const canonical = row.canonical as Record<string, unknown>;
    assert.deepEqual(canonical.roots, [LEGACY_TRIP_DETAILS_SOT_ROOT]);
  });

  it("RULE-P6-010: post-migrate row has no dual-write staging root", async () => {
    const row = await admin.tour.findFirst({
      where: { tenantId: allowlistedTenantId },
    });
    assert.ok(row);
    const canonical = row.canonical as {
      roots?: readonly string[];
      data?: Record<string, unknown>;
    };
    assert.equal(canonical.data?.[LEGACY_TRIP_DETAILS_SOT_ROOT], undefined);
    assert.equal(canonical.roots?.includes(LEGACY_TRIP_DETAILS_SOT_ROOT), false);
  });
});
