/**
 * P4-A — CanonicalTourService + HTTP publish → catalog + revalidate
 * @see docs/phase-17/platform-club-catalog-publish.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import http from "node:http";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { createRequestListener } from "../src/app";
import { CanonicalTourService } from "../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../src/canonical/legacy-canonical-adapter";
import { createApiAbility } from "../src/casl/api-ability";
import { resetValidationEngineCacheForTests } from "../src/tours/canonical-validation-sync";
import { resetTenantRegistryCacheForTests } from "../src/tenant/tenant-registry-cache";
import { TourStorageDbAdapter } from "../src/db/tour-storage.adapter";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import { ToursService } from "../src/tours/tours.service";
import {
  OPERATOR_SMOKE_PARTICIPANT_TOUR_ID,
  OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
  captureMarketingRevalidateFetch,
  drainScheduledRevalidate,
  mockMarketingRevalidateEnv,
  restoreMarketingRevalidateEnv,
} from "./club-catalog-publish-test-helpers";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { URBAN_SMOKE_TENANT_ID } from "./fixtures/urban-demo-tenant";
import {
  installMemoryStorageDriverForDescribe,
  integrationTenantId,
  createTestToursService,
} from "./test-helpers";

const URBAN_GOLDEN_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/workspaces/urban/test/fixtures/golden"
);

function loadUrbanGolden(name: string): {
  schemaVersion: number;
  roots: string[];
  data: Record<string, unknown>;
} {
  return JSON.parse(readFileSync(join(URBAN_GOLDEN_DIR, name), "utf8")) as {
    schemaVersion: number;
    roots: string[];
    data: Record<string, unknown>;
  };
}

function urbanAbility(role: "owner" | "admin" = "owner") {
  return createApiAbility({
    userId: "p4-urban-user",
    tenantId: URBAN_SMOKE_TENANT_ID,
    role,
    status: "ACTIVE",
    workspaceId: "ws-p4-urban",
  });
}

async function getWorkspaceCatalog(
  listener: ReturnType<typeof createRequestListener>,
  path: "/urban/catalog" | "/denali/catalog",
  tenantId: string
): Promise<{ status: number; items: { id: string }[] }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
        return;
      }
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path,
          method: "GET",
          headers: { "x-tenant-id": tenantId },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk as Buffer));
          res.on("end", () => {
            server.close();
            const raw = Buffer.concat(chunks).toString("utf8");
            const body =
              raw.length > 0 ? (JSON.parse(raw) as { data?: { items?: { id: string }[] } }) : {};
            resolve({
              status: res.statusCode ?? 0,
              items: body.data?.items ?? [],
            });
          });
        }
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      req.end();
    });
  });
}

describe("club-catalog-publish-service (P4-A SV)", () => {
  installMemoryStorageDriverForDescribe();

  const priorWorkers = process.env.P5_VALIDATION_WORKERS_ENABLED;

  before(() => {
    delete process.env.DATABASE_URL;
    process.env.P5_VALIDATION_WORKERS_ENABLED = "false";
    resetValidationEngineCacheForTests();
  });

  after(() => {
    if (priorWorkers === undefined) {
      delete process.env.P5_VALIDATION_WORKERS_ENABLED;
    } else {
      process.env.P5_VALIDATION_WORKERS_ENABLED = priorWorkers;
    }
  });

  afterEach(() => {
    restoreMarketingRevalidateEnv({ url: undefined, secret: undefined });
    resetValidationEngineCacheForTests();
  });

  function createUrbanService() {
    const store = new InMemoryTourRepository();
    return {
      store,
      canonicalService: new CanonicalTourService(
        new TourStorageDbAdapter(store),
        new LegacyCanonicalAdapter()
      ),
    };
  }

  it("SV-01 updateTour urban draft→published schedules revalidate POST", async () => {
    const prior = mockMarketingRevalidateEnv({
      url: "http://marketing.test",
      secret: "test-secret",
    });
    const capture = captureMarketingRevalidateFetch();
    const { canonicalService } = createUrbanService();
    const golden = loadUrbanGolden("urban-tour-publish-ready.json");

    try {
      const created = await canonicalService.writeTour({
        ability: urbanAbility(),
        tenantId: URBAN_SMOKE_TENANT_ID,
        workspaceType: "urban",
        body: golden,
      });
      const tour = golden.data.tour as Record<string, unknown>;
      await canonicalService.updateTour({
        ability: urbanAbility(),
        tenantId: URBAN_SMOKE_TENANT_ID,
        tourId: created.id,
        workspaceType: "urban",
        body: {
          rowVersion: created.rowVersion,
          data: {
            tour: { ...tour, status: "published", publishStatus: "published" },
          },
        },
      });
      await drainScheduledRevalidate();
      assert.equal(capture.calls.length, 1);
      assert.match(capture.calls[0]!.url, /\/api\/revalidate$/);
      const payload = JSON.parse(capture.calls[0]!.body) as { tenantId: string };
      assert.equal(payload.tenantId, URBAN_SMOKE_TENANT_ID);
    } finally {
      capture.restore();
      restoreMarketingRevalidateEnv(prior);
    }
  });

  it("SV-02 writeTour urban draft create does not schedule", async () => {
    const prior = mockMarketingRevalidateEnv({
      url: "http://marketing.test",
      secret: "test-secret",
    });
    const capture = captureMarketingRevalidateFetch();
    const { canonicalService } = createUrbanService();

    try {
      await canonicalService.writeTour({
        ability: urbanAbility(),
        tenantId: URBAN_SMOKE_TENANT_ID,
        workspaceType: "urban",
        body: loadUrbanGolden("urban-tour-minimal.json"),
      });
      await drainScheduledRevalidate();
      assert.equal(capture.calls.length, 0);
    } finally {
      capture.restore();
      restoreMarketingRevalidateEnv(prior);
    }
  });

  it("SV-03 writeTour then publish schedules exactly one revalidate POST", async () => {
    const prior = mockMarketingRevalidateEnv({
      url: "http://marketing.test",
      secret: "test-secret",
    });
    const capture = captureMarketingRevalidateFetch();
    const { canonicalService } = createUrbanService();
    const golden = loadUrbanGolden("urban-tour-publish-ready.json");

    try {
      const created = await canonicalService.writeTour({
        ability: urbanAbility(),
        tenantId: URBAN_SMOKE_TENANT_ID,
        workspaceType: "urban",
        body: golden,
      });
      await drainScheduledRevalidate();
      assert.equal(capture.calls.length, 0);

      const tour = golden.data.tour as Record<string, unknown>;
      await canonicalService.updateTour({
        ability: urbanAbility(),
        tenantId: URBAN_SMOKE_TENANT_ID,
        tourId: created.id,
        workspaceType: "urban",
        body: {
          rowVersion: created.rowVersion,
          data: { tour: { ...tour, status: "published", publishStatus: "published" } },
        },
      });
      await drainScheduledRevalidate();
      assert.equal(capture.calls.length, 1);
    } finally {
      capture.restore();
      restoreMarketingRevalidateEnv(prior);
    }
  });

  it("SV-04 fetch failure still persists tour (fail-open side effect)", async () => {
    const prior = mockMarketingRevalidateEnv({
      url: "http://marketing.test",
      secret: "test-secret",
    });
    const capture = captureMarketingRevalidateFetch({ reject: true });
    const { store, canonicalService } = createUrbanService();
    const golden = loadUrbanGolden("urban-tour-publish-ready.json");

    try {
      const created = await canonicalService.writeTour({
        ability: urbanAbility(),
        tenantId: URBAN_SMOKE_TENANT_ID,
        workspaceType: "urban",
        body: golden,
      });
      const tour = golden.data.tour as Record<string, unknown>;
      const updated = await canonicalService.updateTour({
        ability: urbanAbility(),
        tenantId: URBAN_SMOKE_TENANT_ID,
        tourId: created.id,
        workspaceType: "urban",
        body: {
          rowVersion: created.rowVersion,
          data: { tour: { ...tour, status: "published", publishStatus: "published" } },
        },
      });
      assert.equal(
        (updated.canonical.data?.tour as { publishStatus?: string } | undefined)?.publishStatus,
        "published"
      );
      await drainScheduledRevalidate();
      assert.equal(capture.calls.length, 1);
      const stored = await store.getById(created.id, URBAN_SMOKE_TENANT_ID);
      assert.equal(
        (stored?.canonical.data?.tour as { publishStatus?: string } | undefined)?.publishStatus,
        "published"
      );
    } finally {
      capture.restore();
      restoreMarketingRevalidateEnv(prior);
    }
  });

  it("SV-05 starter workspace update does not schedule", async () => {
    const prior = mockMarketingRevalidateEnv({
      url: "http://marketing.test",
      secret: "test-secret",
    });
    const capture = captureMarketingRevalidateFetch();
    const tenantId = integrationTenantId();
    const store = new InMemoryTourRepository();
    const canonicalService = new CanonicalTourService(
      new TourStorageDbAdapter(store),
      new LegacyCanonicalAdapter()
    );

    try {
      const created = await canonicalService.writeTour({
        ability: createApiAbility({
          userId: "p4-starter",
          tenantId,
          role: "admin",
          status: "ACTIVE",
          workspaceId: "ws-starter",
        }),
        tenantId,
        workspaceType: "starter",
        body: {
          schemaVersion: 1,
          data: { basics: { title: "Starter tour" }, details: { summary: "ok" } },
        },
      });
      await drainScheduledRevalidate();
      assert.equal(capture.calls.length, 0);

      await canonicalService.updateTour({
        ability: createApiAbility({
          userId: "p4-starter",
          tenantId,
          role: "admin",
          status: "ACTIVE",
          workspaceId: "ws-starter",
        }),
        tenantId,
        tourId: created.id,
        workspaceType: "starter",
        body: {
          rowVersion: created.rowVersion,
          data: { basics: { title: "Starter tour updated" }, details: { summary: "ok" } },
        },
      });
      await drainScheduledRevalidate();
      assert.equal(capture.calls.length, 0);
    } finally {
      capture.restore();
      restoreMarketingRevalidateEnv(prior);
    }
  });

  it("SV-06 published→draft unpublish still schedules revalidate", async () => {
    const prior = mockMarketingRevalidateEnv({
      url: "http://marketing.test",
      secret: "test-secret",
    });
    const capture = captureMarketingRevalidateFetch();
    const { canonicalService } = createUrbanService();
    const golden = loadUrbanGolden("urban-tour-publish-ready.json");
    const tour = golden.data.tour as Record<string, unknown>;

    try {
      const created = await canonicalService.writeTour({
        ability: urbanAbility(),
        tenantId: URBAN_SMOKE_TENANT_ID,
        workspaceType: "urban",
        body: golden,
      });
      const published = await canonicalService.updateTour({
        ability: urbanAbility(),
        tenantId: URBAN_SMOKE_TENANT_ID,
        tourId: created.id,
        workspaceType: "urban",
        body: {
          rowVersion: created.rowVersion,
          data: { tour: { ...tour, status: "published", publishStatus: "published" } },
        },
      });
      await drainScheduledRevalidate();
      assert.equal(capture.calls.length, 1);
      capture.calls.length = 0;

      await canonicalService.updateTour({
        ability: urbanAbility(),
        tenantId: URBAN_SMOKE_TENANT_ID,
        tourId: published.id,
        workspaceType: "urban",
        body: {
          rowVersion: published.rowVersion,
          data: { tour: { ...tour, status: "draft", publishStatus: "draft" } },
        },
      });
      await drainScheduledRevalidate();
      assert.equal(capture.calls.length, 1);
    } finally {
      capture.restore();
      restoreMarketingRevalidateEnv(prior);
    }
  });
});

describe("club-catalog-publish-http (P4-A PW)", { concurrency: false }, () => {
  installMemoryStorageDriverForDescribe();

  const priorWorkers = process.env.P5_VALIDATION_WORKERS_ENABLED;

  before(() => {
    delete process.env.DATABASE_URL;
    process.env.P5_VALIDATION_WORKERS_ENABLED = "false";
    resetValidationEngineCacheForTests();
    resetTenantRegistryCacheForTests();
  });

  after(() => {
    if (priorWorkers === undefined) {
      delete process.env.P5_VALIDATION_WORKERS_ENABLED;
    } else {
      process.env.P5_VALIDATION_WORKERS_ENABLED = priorWorkers;
    }
  });

  beforeEach(() => {
    resetValidationEngineCacheForTests();
    resetTenantRegistryCacheForTests();
  });

  afterEach(() => {
    restoreMarketingRevalidateEnv({ url: undefined, secret: undefined });
    resetTenantRegistryCacheForTests();
  });

  function createDenaliListener() {
    const repo = new InMemoryTourRepository();
    repo.ensureOperatorSmokeSeedTour();
    return createRequestListener({
      toursService: createTestToursService(repo),
      tourStore: repo,
    });
  }

  it("PW-01 service publish then GET /urban/catalog lists tour", async () => {
    const prior = mockMarketingRevalidateEnv({
      url: "http://marketing.test",
      secret: "test-secret",
    });
    const capture = captureMarketingRevalidateFetch();
    const repo = new InMemoryTourRepository();
    const canonicalService = new CanonicalTourService(
      new TourStorageDbAdapter(repo),
      new LegacyCanonicalAdapter()
    );
    const listener = createRequestListener({
      toursService: new ToursService(canonicalService),
      tourStore: repo,
    });
    const golden = loadUrbanGolden("urban-tour-publish-ready.json");
    const tour = golden.data.tour as Record<string, unknown>;

    try {
      const created = await canonicalService.writeTour({
        ability: urbanAbility(),
        tenantId: URBAN_SMOKE_TENANT_ID,
        workspaceType: "urban",
        body: golden,
      });

      await canonicalService.updateTour({
        ability: urbanAbility(),
        tenantId: URBAN_SMOKE_TENANT_ID,
        tourId: created.id,
        workspaceType: "urban",
        body: {
          rowVersion: created.rowVersion,
          data: { tour: { ...tour, status: "published", publishStatus: "published" } },
        },
      });

      const catalog = await getWorkspaceCatalog(listener, "/urban/catalog", URBAN_SMOKE_TENANT_ID);
      assert.equal(catalog.status, 200);
      assert.ok(catalog.items.some((item) => item.id === created.id));
      await drainScheduledRevalidate();
      assert.equal(capture.calls.length, 1);
      const payload = JSON.parse(capture.calls[0]!.body) as { tenantId: string };
      assert.equal(payload.tenantId, URBAN_SMOKE_TENANT_ID);
    } finally {
      capture.restore();
      restoreMarketingRevalidateEnv(prior);
    }
  });

  it("PW-DN-01 GET /denali/catalog lists operator smoke published tour", async () => {
    const listener = createDenaliListener();
    const response = await getWorkspaceCatalog(
      listener,
      "/denali/catalog",
      OPERATOR_SMOKE.tenantId
    );
    assert.equal(response.status, 200);
    assert.equal(response.items.length, 4);
    assert.ok(response.items.some((item) => item.id === OPERATOR_SMOKE_PUBLISHED_TOUR_ID));
    assert.ok(response.items.some((item) => item.id === OPERATOR_SMOKE_PARTICIPANT_TOUR_ID));
  });
});
