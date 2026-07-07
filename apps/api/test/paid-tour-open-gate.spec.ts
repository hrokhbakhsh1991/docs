/**
 * P5-E-N-004 — paid tour OPEN commerce gate (FIN-01)
 * @see docs/phase-18/platform-registrations-finance-tranche.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import type { WorkspaceCommerceConfig } from "@app-tour/workspace-sdk/metadata";

import { CanonicalTourService } from "../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../src/canonical/legacy-canonical-adapter";
import { createApiAbility } from "../src/casl/api-ability";
import { TourStorageDbAdapter } from "../src/db/tour-storage.adapter";
import {
  assertPaidTourOpenCommerceGate,
  assertPaidTourOpenCommerceGateOnPublishTransition,
  isPaidTourOpenGateBlockedError,
} from "../src/registrations/assert-paid-tour-open-gate.ts";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import type { Tour } from "../src/storage/tour-storage.interface";
import { ToursService } from "../src/tours/tours.service.ts";
import { URBAN_SMOKE_TENANT_ID } from "./fixtures/urban-demo-tenant";

const URBAN_GOLDEN_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/workspaces/urban/test/fixtures/golden"
);

const GATEWAY_COMMERCE: WorkspaceCommerceConfig = Object.freeze({
  paymentMode: "gateway",
  gatewayProvider: "zibal",
  currency: "IRR",
});

const OFFLINE_COMMERCE: WorkspaceCommerceConfig = Object.freeze({
  paymentMode: "offline_receipt",
  gatewayProvider: null,
  currency: "IRR",
});

function loadUrbanGolden(name: string) {
  return JSON.parse(readFileSync(join(URBAN_GOLDEN_DIR, name), "utf8")) as {
    schemaVersion: number;
    roots: string[];
    data: Record<string, unknown>;
  };
}

function urbanAbility(): ReturnType<typeof createApiAbility> {
  return createApiAbility({
    userId: "fin-01-urban",
    tenantId: URBAN_SMOKE_TENANT_ID,
    role: "owner",
    status: "ACTIVE",
    workspaceId: "ws-fin-01",
  });
}

class UpdateCountingRepository extends InMemoryTourRepository {
  updateCalls = 0;

  override async updateIfRowVersion(input: {
    tenantId: string;
    id: string;
    canonical: Tour["canonical"];
    expectedRowVersion: number;
  }): Promise<Tour> {
    this.updateCalls += 1;
    return super.updateIfRowVersion(input);
  }
}

describe("paid-tour-open-gate (P5-E FIN-01)", () => {
  const originalLift = process.env.P5_D_GATEWAY_ACTIVATION_ENABLED;
  const priorStorageDriver = process.env.STORAGE_DRIVER;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    delete process.env.P5_D_GATEWAY_ACTIVATION_ENABLED;
  });

  after(() => {
    if (originalLift === undefined) {
      delete process.env.P5_D_GATEWAY_ACTIVATION_ENABLED;
    } else {
      process.env.P5_D_GATEWAY_ACTIVATION_ENABLED = originalLift;
    }
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
  });

  it("FIN-01 allows offline_receipt commerce on OPEN path (PC-07)", () => {
    assert.doesNotThrow(() => assertPaidTourOpenCommerceGate(OFFLINE_COMMERCE));
  });

  it("FIN-01b blocks gateway commerce until P5-D lift", () => {
    assert.throws(
      () => assertPaidTourOpenCommerceGate(GATEWAY_COMMERCE),
      (error: unknown) => {
        assert.ok(isPaidTourOpenGateBlockedError(error));
        assert.equal(error.statusCode, 403);
        return true;
      }
    );
  });

  it("FIN-01c allows gateway when P5_D_GATEWAY_ACTIVATION_ENABLED=true", () => {
    process.env.P5_D_GATEWAY_ACTIVATION_ENABLED = "true";
    assert.doesNotThrow(() =>
      assertPaidTourOpenCommerceGate({
        paymentMode: "gateway",
        gatewayProvider: "stripe",
        currency: "USD",
      })
    );
    delete process.env.P5_D_GATEWAY_ACTIVATION_ENABLED;
  });

  it("FIN-01d publish transition helper skips non-publish PATCH", () => {
    const golden = loadUrbanGolden("urban-tour-publish-ready.json");
    const tour = golden.data.tour as Record<string, unknown>;
    const draft = {
      schemaVersion: 1,
      roots: golden.roots,
      data: { tour: { ...tour, status: "draft", publishStatus: "draft" } },
    };
    const stillDraft = {
      schemaVersion: 1,
      roots: golden.roots,
      data: { tour: { ...tour, status: "draft", publishStatus: "draft", title: "Renamed" } },
    };

    assert.doesNotThrow(() =>
      assertPaidTourOpenCommerceGateOnPublishTransition({
        workspaceType: "urban",
        before: draft,
        after: stillDraft,
        commerce: GATEWAY_COMMERCE,
      })
    );
  });

  it("FIN-01e updateTour publish blocks gateway commerce before persist", async () => {
    const counting = new UpdateCountingRepository();
    const golden = loadUrbanGolden("urban-tour-publish-ready.json");
    const tour = golden.data.tour as Record<string, unknown>;
    const canonicalService = new CanonicalTourService(
      new TourStorageDbAdapter(counting),
      new LegacyCanonicalAdapter()
    );
    const service = new ToursService(canonicalService, {
      resolveCommerce: async () => GATEWAY_COMMERCE,
    });

    const created = await canonicalService.writeTour({
      ability: urbanAbility(),
      tenantId: URBAN_SMOKE_TENANT_ID,
      workspaceType: "urban",
      body: golden,
    });

    await assert.rejects(
      () =>
        service.updateTour(
          {
            userId: "fin-01-urban",
            tenantId: URBAN_SMOKE_TENANT_ID,
            role: "owner",
            status: "ACTIVE",
            workspaceId: "ws-fin-01",
          } satisfies TenantAuthContext,
          created.id,
          {
            rowVersion: created.rowVersion,
            data: { tour: { ...tour, status: "published", publishStatus: "published" } },
          }
        ),
      (error: unknown) => {
        assert.ok(isPaidTourOpenGateBlockedError(error));
        return true;
      }
    );

    assert.equal(counting.updateCalls, 0);
  });

  it("FIN-01f updateTour publish allows offline_receipt commerce", async () => {
    const counting = new UpdateCountingRepository();
    const golden = loadUrbanGolden("urban-tour-publish-ready.json");
    const tour = golden.data.tour as Record<string, unknown>;
    const canonicalService = new CanonicalTourService(
      new TourStorageDbAdapter(counting),
      new LegacyCanonicalAdapter()
    );
    const service = new ToursService(canonicalService, {
      resolveCommerce: async () => OFFLINE_COMMERCE,
    });

    const created = await canonicalService.writeTour({
      ability: urbanAbility(),
      tenantId: URBAN_SMOKE_TENANT_ID,
      workspaceType: "urban",
      body: golden,
    });

    const published = await service.updateTour(
      {
        userId: "fin-01-urban",
        tenantId: URBAN_SMOKE_TENANT_ID,
        role: "owner",
        status: "ACTIVE",
        workspaceId: "ws-fin-01",
      } satisfies TenantAuthContext,
      created.id,
      {
        rowVersion: created.rowVersion,
        data: { tour: { ...tour, status: "published", publishStatus: "published" } },
      }
    );

    assert.equal(counting.updateCalls, 1);
    const storedTour = (published.canonical.data as { tour?: { publishStatus?: string } }).tour;
    assert.equal(storedTour?.publishStatus, "published");
  });
});
