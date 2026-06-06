/**
 * 4-integration — schema version compatibility for legacy canonical payloads.
 *
 * Legacy tours may arrive with schemaVersion=1 and incomplete `data`. The write path
 * must either default-fill missing roots (when `data` is omitted) or return a structured
 * 4xx — never an unhandled 500 that would crash RuleEngine validation.
 *
 * Acceptable outcomes today (Phase 5):
 *   - 201 with {@link defaultCanonicalData} fills (basics.title, details.summary)
 *   - 400 VALIDATION_FAILURE (CANONICAL_VALIDATION_FAILED / plugin rule violations)
 *
 * Stale `schemaVersion` → SCHEMA_VERSION_MISMATCH (workspace current is 1 for starter).
 * PATCH /tours/:id uses the same pre-TX gate after merge (DEC-078 / SV-PATCH-01, SV-PATCH-05, SV-PATCH-09).
 *
 * STORAGE_DRIVER=memory — no Postgres required.
 *
 * @see apps/api/src/tours/canonical-validation.ts — defaultCanonicalData
 * @see apps/api/test/canonical-validate-before-persist.spec.ts
 */
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";

import { PlatformWizardEngine } from "@app-tour/platform-core";
import { createCanonicalDocument, type CanonicalDocument } from "@app-tour/workspace-sdk";
import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";

import { createRequestListener } from "../../src/app";
import { CanonicalTourService } from "../../src/canonical/canonical-tour.service";
import { resetValidationWorkerPoolForTests } from "../../src/canonical/validation-worker-pool";
import { LegacyCanonicalAdapter } from "../../src/canonical/legacy-canonical-adapter";
import { ValidationFailure } from "../../src/canonical/validation-failure";
import { createApiAbility } from "../../src/casl/api-ability";
import { InMemoryTourRepository } from "../../src/storage/in-memory-tour.repository";
import { TourStorageDbAdapter } from "../../src/db/tour-storage.adapter";
import { ToursService } from "../../src/tours/tours.service";
import { integrationTenantId } from "../test-helpers";

type JsonResponse = {
  readonly status: number;
  readonly body: {
    readonly id?: string;
    readonly tenantId?: string;
    readonly canonical?: CanonicalDocument;
    readonly error?: string;
    readonly code?: string;
  };
};

/** Phase 6 hook — not emitted by Phase 5 write path; test accepts if introduced. */
const STRUCTURED_REJECT_CODES = new Set(["VALIDATION_FAILURE", "SCHEMA_VERSION_MISMATCH"]);

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "schema-compat-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-schema-compat",
  };
}

type PatchJsonResponse = JsonResponse & {
  readonly body: JsonResponse["body"] & { readonly rowVersion?: number };
};

async function postTour(
  listener: ReturnType<typeof createRequestListener>,
  tenantId: string,
  body: unknown
): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
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

async function patchTour(
  listener: ReturnType<typeof createRequestListener>,
  tenantId: string,
  tourId: string,
  body: unknown
): Promise<PatchJsonResponse> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
        return;
      }
      const payload = JSON.stringify(body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: `/tours/${tourId}`,
          method: "PATCH",
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

async function seedTourForPatch(
  listener: ReturnType<typeof createRequestListener>,
  tenantId: string,
  store: InMemoryTourRepository,
  body: unknown = {
    schemaVersion: 1,
    roots: ["basics", "details"],
    data: { basics: { title: "PATCH seed tour" }, details: { summary: "seed" } },
  }
): Promise<{ readonly id: string; readonly rowVersion: number }> {
  const res = await postTour(listener, tenantId, body);
  assert.equal(res.status, 201, "seed tour must succeed before PATCH cases");
  const tour = (await store.listByTenant(tenantId)).find((row) => row.id === res.body.id);
  assert.ok(tour, "seed tour must be readable from store");
  return { id: tour.id, rowVersion: tour.rowVersion };
}

function assertNotInternalError(res: JsonResponse, label: string): void {
  assert.notEqual(
    res.status,
    500,
    `${label}: legacy payload must not produce HTTP 500 internal_error`
  );
  assert.notEqual(
    res.body.error,
    "internal_error",
    `${label}: response must not be generic internal_error`
  );
}

function assertDefaultFillSuccess(res: JsonResponse, tenantId: string, label: string): void {
  assert.equal(res.status, 201, `${label}: expected default-fill persist`);
  assert.equal(res.body.tenantId, tenantId);
  assert.ok(res.body.id);
  const basics = res.body.canonical?.data?.basics as { title?: string } | undefined;
  const details = res.body.canonical?.data?.details as { summary?: string } | undefined;
  assert.equal(basics?.title, "Untitled tour", `${label}: basics.title default-filled`);
  assert.equal(details?.summary, "", `${label}: details.summary default-filled`);
  assert.equal(res.body.canonical?.schemaVersion, 1);
}

function assertStructuredReject(res: JsonResponse, label: string): void {
  assert.equal(res.status, 400, `${label}: expected structured 4xx rejection`);
  assert.ok(
    res.body.code !== undefined && STRUCTURED_REJECT_CODES.has(res.body.code),
    `${label}: expected VALIDATION_FAILURE or SCHEMA_VERSION_MISMATCH, got ${res.body.code ?? "none"}`
  );
  assert.ok(
    res.body.error?.startsWith("CANONICAL_VALIDATION_FAILED") ||
      res.body.code === "SCHEMA_VERSION_MISMATCH",
    `${label}: error must describe validation or schema version mismatch`
  );
}

describe("4-integration — schema version compatibility (memory)", () => {
  const tenantId = integrationTenantId();
  const store = new InMemoryTourRepository();
  let listener: ReturnType<typeof createRequestListener>;
  let toursService: ToursService;
  let canonicalService: CanonicalTourService;
  const priorStorageDriver = process.env.STORAGE_DRIVER;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    canonicalService = new CanonicalTourService(
      new TourStorageDbAdapter(store),
      new LegacyCanonicalAdapter()
    );
    toursService = new ToursService(canonicalService);
    listener = createRequestListener({ toursService });
  });

  after(async () => {
    await resetValidationWorkerPoolForTests();
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
  });

  it("POST /tours: schemaVersion=1 with omitted data default-fills and returns 201", async () => {
    const beforeCount = (await store.listByTenant(tenantId)).length;

    const res = await postTour(listener, tenantId, { schemaVersion: 1 });
    assertNotInternalError(res, "omitted-data");
    assertDefaultFillSuccess(res, tenantId, "omitted-data");

    const afterCount = (await store.listByTenant(tenantId)).length;
    assert.equal(afterCount, beforeCount + 1);
  });

  it("POST /tours: empty body default-fills via schemaVersion=1 implicit default", async () => {
    const res = await postTour(listener, tenantId, {});
    assertNotInternalError(res, "empty-body");
    assertDefaultFillSuccess(res, tenantId, "empty-body");
  });

  it("POST /tours: schemaVersion below workspace current returns SCHEMA_VERSION_MISMATCH", async () => {
    const beforeCount = (await store.listByTenant(tenantId)).length;

    const res = await postTour(listener, tenantId, {
      schemaVersion: 2,
      roots: ["basics", "details"],
      data: { basics: { title: "Future schema rev" }, details: { summary: "" } },
    });
    assertNotInternalError(res, "stale-schema-rev");
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "SCHEMA_VERSION_MISMATCH");
    assert.match(res.body.error ?? "", /SCHEMA_VERSION_MISMATCH/);

    const afterCount = (await store.listByTenant(tenantId)).length;
    assert.equal(afterCount, beforeCount, "mismatch must not persist");
  });

  it("POST /tours: legacy basics-only roots persist without 500", async () => {
    const res = await postTour(listener, tenantId, {
      schemaVersion: 1,
      roots: ["basics"],
      data: { basics: { title: "Legacy basics-only tour" } },
    });
    assertNotInternalError(res, "basics-only-roots");
    assert.equal(res.status, 201);
    assert.equal(
      (res.body.canonical?.data?.basics as { title?: string } | undefined)?.title,
      "Legacy basics-only tour"
    );
    assert.equal(res.body.canonical?.schemaVersion, 1);
  });

  it("POST /tours: partial data missing details root rejects with structured 400", async () => {
    const beforeCount = (await store.listByTenant(tenantId)).length;

    const res = await postTour(listener, tenantId, {
      schemaVersion: 1,
      data: { basics: { title: "Legacy partial — no details root" } },
    });
    assertNotInternalError(res, "partial-missing-details");
    assertStructuredReject(res, "partial-missing-details");

    const afterCount = (await store.listByTenant(tenantId)).length;
    assert.equal(afterCount, beforeCount, "reject path must not persist");
  });

  it("POST /tours: explicit empty data object rejects cleanly (no default-fill)", async () => {
    const res = await postTour(listener, tenantId, {
      schemaVersion: 1,
      data: {},
    });
    assertNotInternalError(res, "explicit-empty-data");
    assertStructuredReject(res, "explicit-empty-data");
  });

  it("PATCH /tours/:id SV-PATCH-01: stale schemaVersion returns SCHEMA_VERSION_MISMATCH (SV-01 parity)", async () => {
    const seeded = await seedTourForPatch(listener, tenantId, store);
    const before = await store.getById(seeded.id, tenantId);
    assert.ok(before);

    const res = await patchTour(listener, tenantId, seeded.id, {
      rowVersion: seeded.rowVersion,
      schemaVersion: 2,
      data: { basics: { title: "Future rev on PATCH" }, details: { summary: "" } },
    });
    assertNotInternalError(res, "patch-stale-schema-rev");
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "SCHEMA_VERSION_MISMATCH");
    assert.match(res.body.error ?? "", /SCHEMA_VERSION_MISMATCH/);

    const after = await store.getById(seeded.id, tenantId);
    assert.ok(after);
    assert.equal(after.canonical.schemaVersion, 1);
    assert.equal(
      (after.canonical.data?.basics as { title?: string } | undefined)?.title,
      "PATCH seed tour",
      "mismatch PATCH must not mutate stored canonical"
    );
  });

  it("PATCH /tours/:id SV-PATCH-09: merge + explicit stale schemaVersion rejects before persist", async () => {
    const seeded = await seedTourForPatch(listener, tenantId, store);

    const res = await patchTour(listener, tenantId, seeded.id, {
      rowVersion: seeded.rowVersion,
      schemaVersion: 2,
      data: { basics: { title: "Only title patch" } },
    });
    assertNotInternalError(res, "patch-sv-09-merge-stale");
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "SCHEMA_VERSION_MISMATCH");

    const after = await store.getById(seeded.id, tenantId);
    assert.ok(after);
    assert.equal(after.rowVersion, seeded.rowVersion);
  });

  it("PATCH /tours/:id SV-PATCH-05: partial data missing details root rejects with structured 400", async () => {
    const seeded = await seedTourForPatch(listener, tenantId, store);
    const beforeCount = (await store.listByTenant(tenantId)).length;

    const res = await patchTour(listener, tenantId, seeded.id, {
      rowVersion: seeded.rowVersion,
      schemaVersion: 1,
      data: { basics: { title: "PATCH partial — no details root" } },
    });
    assertNotInternalError(res, "patch-partial-missing-details");
    assertStructuredReject(res, "patch-partial-missing-details");

    assert.equal((await store.listByTenant(tenantId)).length, beforeCount);
    const after = await store.getById(seeded.id, tenantId);
    assert.ok(after);
    assert.equal(
      (after.canonical.data?.basics as { title?: string } | undefined)?.title,
      "PATCH seed tour"
    );
  });

  it("PATCH /tours/:id SV-PATCH-OK: valid merge updates title and returns 200", async () => {
    const seeded = await seedTourForPatch(listener, tenantId, store);

    const res = await patchTour(listener, tenantId, seeded.id, {
      rowVersion: seeded.rowVersion,
      data: {
        basics: { title: "PATCH merged title" },
        details: { summary: "merged summary" },
      },
    });
    assertNotInternalError(res, "patch-valid-merge");
    assert.equal(res.status, 200);
    assert.equal(res.body.id, seeded.id);
    assert.equal(res.body.rowVersion, seeded.rowVersion + 1);
    assert.equal(
      (res.body.canonical?.data?.basics as { title?: string } | undefined)?.title,
      "PATCH merged title"
    );
    assert.equal(res.body.canonical?.schemaVersion, 1);
  });

  it("POST /tours: legacy payload missing required basics.title rejects via plugin rules", async () => {
    const res = await postTour(listener, tenantId, {
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: {},
        details: { summary: "ok" },
      },
    });
    assertNotInternalError(res, "missing-required-title");
    assertStructuredReject(res, "missing-required-title");
  });

  it("CanonicalTourService.writeTour: default-fill path matches HTTP behavior", async () => {
    const ability = createApiAbility({
      userId: "schema-compat-user",
      tenantId,
      role: "admin",
      status: "ACTIVE",
      workspaceId: "ws-schema-compat",
    });

    const record = await canonicalService.writeTour({
      ability,
      tenantId,
      workspaceType: "starter",
      body: { schemaVersion: 1 },
    });

    const basics = record.canonical.data?.basics as { title?: string } | undefined;
    const details = record.canonical.data?.details as { summary?: string } | undefined;
    assert.equal(basics?.title, "Untitled tour");
    assert.equal(details?.summary, "");
    assert.equal(record.canonical.schemaVersion, 1);
  });

  it("CanonicalTourService.updateTour: stale schemaVersion throws before persist (SV-PATCH service parity)", async () => {
    const ability = createApiAbility({
      userId: "schema-compat-user",
      tenantId,
      role: "admin",
      status: "ACTIVE",
      workspaceId: "ws-schema-compat",
    });

    const created = await canonicalService.writeTour({
      ability,
      tenantId,
      workspaceType: "starter",
      body: {
        schemaVersion: 1,
        roots: ["basics", "details"],
        data: { basics: { title: "Service seed" }, details: { summary: "svc" } },
      },
    });

    await assert.rejects(
      () =>
        canonicalService.updateTour({
          ability,
          tenantId,
          tourId: created.id,
          workspaceType: "starter",
          body: {
            rowVersion: created.rowVersion,
            schemaVersion: 2,
            data: { basics: { title: "Stale rev" }, details: { summary: "" } },
          },
        }),
      (error: unknown) => {
        assert.match(
          error instanceof Error ? error.message : String(error),
          /SCHEMA_VERSION_MISMATCH/
        );
        return true;
      }
    );
  });

  it("CanonicalTourService.writeTour: partial legacy data throws ValidationFailure not 500", async () => {
    const ability = createApiAbility({
      userId: "schema-compat-user",
      tenantId,
      role: "admin",
      status: "ACTIVE",
      workspaceId: "ws-schema-compat",
    });

    await assert.rejects(
      () =>
        canonicalService.writeTour({
          ability,
          tenantId,
          workspaceType: "starter",
          body: {
            schemaVersion: 1,
            data: { basics: { title: "Direct partial legacy" } },
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof ValidationFailure, "must throw ValidationFailure");
        assert.match(error.message, /CANONICAL_VALIDATION_FAILED/);
        return true;
      }
    );
  });

  it("RuleEngine validateCanonical completes on legacy documents without crashing", () => {
    const engine = PlatformWizardEngine.create(getStarterWorkspacePlugin());
    const ruleContext = {
      tenantId,
      dimensions: { variant: "default" as const },
    };

    const legacyBasicsOnly = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics"],
      data: { basics: { title: "RuleEngine legacy subset" } },
    });
    const basicsOnlyResult = engine.validateCanonical(legacyBasicsOnly, ruleContext);
    assert.equal(basicsOnlyResult.ok, true, "basics-only legacy doc must validate cleanly");

    const legacyMissingTitle = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: { basics: {}, details: { summary: "" } },
    });
    const missingTitleResult = engine.validateCanonical(legacyMissingTitle, ruleContext);
    assert.equal(
      missingTitleResult.ok,
      false,
      "missing required field must return validation result, not throw"
    );
    assert.ok(missingTitleResult.violations.length > 0);
  });
});
