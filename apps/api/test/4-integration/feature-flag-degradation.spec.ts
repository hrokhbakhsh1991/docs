/**
 * 4-integration — per-tenant Advanced Rule Engine degradation (DEC-014).
 *
 * Proves:
 *   - Tenant A with `theme.featureFlags.advancedRuleEngine: false` uses Basic Validation
 *     (missing basics.title succeeds — variant "basic")
 *   - Tenant B with default/advanced flag keeps full RuleEngine (same body → 400)
 *   - No global 503 during concurrent burst; B unaffected while A degraded
 *   - Mid-load DB flag flip: A switches to basic without process restart
 *
 * Flag location: Postgres `tenants.theme.featureFlags.advancedRuleEngine` (default true).
 *
 * Run:
 *   DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db' \
 *   DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db' \
 *   STORAGE_DRIVER=prisma NODE_ENV=test \
 *     pnpm --filter @apps/api exec node --import tsx --test \
 *     test/4-integration/feature-flag-degradation.spec.ts
 *
 * @see docs/phase-5/appendices/feature-flag-degradation.md
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-014
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import type { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../../src/app";
import { CanonicalTourService } from "../../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../../src/canonical/legacy-canonical-adapter";
import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { updateTenantRegistryRow } from "../../src/tenant/update-tenant-registry-row";
import { TourStorageDbAdapter } from "../../src/db/tour-storage.adapter";
import { createTourStorageRepository } from "../../src/storage/create-tour-storage";
import { ToursService } from "../../src/tours/tours.service";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

/** Invalid under advanced rules — basics.title required in default variant. */
const ADVANCED_INVALID_BODY = {
  schemaVersion: 1,
  roots: ["basics", "details"],
  data: {
    basics: {},
    details: { summary: "feature-flag-degradation" },
  },
} as const;

const VALID_TOUR_BODY = {
  data: {
    basics: { title: "feature-flag-valid" },
    details: { summary: "ok" },
  },
} as const;

const BURST_REQUEST_COUNT = 12;
const FLAG_FLIP_AT_REQUEST = 6;

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "feature-flag-degradation",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-feature-flag",
  };
}

async function postTour(
  listener: ReturnType<typeof createRequestListener>,
  tenantId: string,
  body: unknown
): Promise<{ status: number; body: { id?: string; error?: string; code?: string } }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("feature-flag-degradation: no listen address"));
        return;
      }
      const payload = JSON.stringify(body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: "/tours",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(Buffer.byteLength(payload)),
            ...authHeaders(tenantId),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            server.close();
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: raw.length > 0 ? JSON.parse(raw) : {},
            });
          });
        }
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      req.write(payload);
      req.end();
    });
  });
}

function validBodyWithTitle(title: string): typeof VALID_TOUR_BODY {
  return {
    data: { basics: { title }, details: { summary: "ok" } },
  };
}

describe(
  "4-integration — feature flag degradation (Advanced Rule Engine → Basic Validation)",
  {
    skip: hasDatabase
      ? false
      : "DATABASE_URL required — Postgres integration for tenant theme flags (see apps/api/.env.example)",
    concurrency: false,
  },
  () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const runId = randomUUID().slice(0, 8);
    let admin: PrismaClient;
    let listener: ReturnType<typeof createRequestListener>;
    const priorStorageDriver = process.env.STORAGE_DRIVER;
    const priorMaxTourWrites = process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES = String(BURST_REQUEST_COUNT + 4);
      await disconnectPrisma();
      admin = getPrismaAdmin();

      await admin.tenant.create({
        data: {
          id: tenantA,
          subdomain: `ff-degrade-a-${runId}`,
          workspaceType: "starter",
          theme: {
            featureFlags: { advancedRuleEngine: false },
          },
        },
      });
      await admin.tenant.create({
        data: {
          id: tenantB,
          subdomain: `ff-degrade-b-${runId}`,
          workspaceType: "starter",
          theme: {
            featureFlags: { advancedRuleEngine: true },
          },
        },
      });

      const toursService = new ToursService(
        new CanonicalTourService(
          new TourStorageDbAdapter(createTourStorageRepository()),
          new LegacyCanonicalAdapter()
        )
      );
      listener = createRequestListener({ toursService });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorStorageDriver;
      if (priorMaxTourWrites === undefined) {
        delete process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES;
      } else {
        process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES = priorMaxTourWrites;
      }

      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
      );
      try {
        for (const tenantId of [tenantA, tenantB]) {
          await admin.auditEvent.deleteMany({ where: { tenantId } });
          await admin.outboxEvent.deleteMany({ where: { tenantId } });
          await admin.tour.deleteMany({ where: { tenantId } });
        }
        await admin.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
      } finally {
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
        );
      }
      await disconnectPrisma();
    });

    it("tenant A (degraded): invalid starter body succeeds via Basic Validation", async () => {
      const res = await postTour(listener, tenantA, ADVANCED_INVALID_BODY);
      assert.equal(
        res.status,
        201,
        `tenant A with advancedRuleEngine=false must accept missing basics.title; got ${res.status} ${JSON.stringify(res.body)}`
      );
      assert.ok(res.body.id);
    });

    it("tenant B (advanced): same invalid body fails with VALIDATION_FAILURE", async () => {
      const res = await postTour(listener, tenantB, ADVANCED_INVALID_BODY);
      assert.equal(res.status, 400);
      assert.equal(res.body.code, "VALIDATION_FAILURE");
      assert.ok(res.body.error?.startsWith("CANONICAL_VALIDATION_FAILED"));
    });

    it("both tenants accept valid body — no global service disable", async () => {
      const [resA, resB] = await Promise.all([
        postTour(listener, tenantA, validBodyWithTitle(`ff-a-valid-${runId}`)),
        postTour(listener, tenantB, validBodyWithTitle(`ff-b-valid-${runId}`)),
      ]);

      assert.equal(resA.status, 201, `tenant A valid POST must succeed; got ${resA.status}`);
      assert.equal(resB.status, 201, `tenant B valid POST must succeed; got ${resB.status}`);
      assert.notEqual(resA.body.id, resB.body.id);
    });

    it("concurrent burst: no 503; tenant B still rejects invalid while A degraded", async () => {
      const statusesA: number[] = [];
      const statusesB: number[] = [];

      const burst = Array.from({ length: BURST_REQUEST_COUNT }, (_, index) =>
        Promise.all([
          postTour(listener, tenantA, validBodyWithTitle(`ff-burst-a-${runId}-${index}`)).then(
            (r) => {
              statusesA.push(r.status);
              return r;
            }
          ),
          postTour(listener, tenantB, ADVANCED_INVALID_BODY).then((r) => {
            statusesB.push(r.status);
            return r;
          }),
        ])
      );

      await Promise.all(burst);

      assert.ok(
        statusesA.every((s) => s === 201),
        `tenant A burst must all succeed (basic path); got ${JSON.stringify(statusesA)}`
      );
      assert.ok(
        statusesB.every((s) => s === 400),
        `tenant B burst must all fail validation (advanced path); got ${JSON.stringify(statusesB)}`
      );
      assert.ok(
        !statusesA.includes(503) && !statusesB.includes(503),
        "degradation must not cause global 503 for either tenant"
      );
    });

    it("mid-load flag flip: tenant A switches from advanced to basic without restart", async () => {
      const flipTenant = integrationTenantId();
      const flipRunId = randomUUID().slice(0, 8);

      await admin.tenant.create({
        data: {
          id: flipTenant,
          subdomain: `ff-flip-${flipRunId}`,
          workspaceType: "starter",
          theme: {
            featureFlags: { advancedRuleEngine: true },
          },
        },
      });

      try {
        const preFlipStatuses: number[] = [];
        const postFlipStatuses: number[] = [];
        let flagFlipped = false;

        for (let i = 0; i < BURST_REQUEST_COUNT; i += 1) {
          if (i === FLAG_FLIP_AT_REQUEST && !flagFlipped) {
            await updateTenantRegistryRow(flipTenant, {
              theme: {
                featureFlags: { advancedRuleEngine: false },
              },
            });
            flagFlipped = true;
          }

          const res = await postTour(listener, flipTenant, ADVANCED_INVALID_BODY);
          if (i < FLAG_FLIP_AT_REQUEST) {
            preFlipStatuses.push(res.status);
          } else {
            postFlipStatuses.push(res.status);
          }
        }

        assert.ok(flagFlipped, "DB flag must be flipped during load loop");
        assert.ok(
          preFlipStatuses.every((s) => s === 400),
          `before flip: advanced rules must reject invalid body; got ${JSON.stringify(preFlipStatuses)}`
        );
        assert.ok(
          postFlipStatuses.every((s) => s === 201),
          `after flip: basic validation must accept invalid body; got ${JSON.stringify(postFlipStatuses)}`
        );
        assert.ok(
          !preFlipStatuses.includes(503) && !postFlipStatuses.includes(503),
          "flag flip must not cause 503"
        );

        const bRes = await postTour(listener, tenantB, ADVANCED_INVALID_BODY);
        assert.equal(
          bRes.status,
          400,
          "tenant B must remain on advanced validation while flip tenant degraded"
        );
      } finally {
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
        );
        try {
          await admin.auditEvent.deleteMany({ where: { tenantId: flipTenant } });
          await admin.outboxEvent.deleteMany({ where: { tenantId: flipTenant } });
          await admin.tour.deleteMany({ where: { tenantId: flipTenant } });
          await admin.tenant.delete({ where: { id: flipTenant } });
        } finally {
          await admin.$executeRawUnsafe(
            `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
          );
        }
      }
    });
  }
);
