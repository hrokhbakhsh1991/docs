/**
 * P5-B-N-010 — publish integration on metadata path (E2E-01..03)
 * @see docs/phase-18/platform-denali-operator-parity.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  projectDenaliWizardFormToCanonicalIngressData,
} from "@app-tour/workspace-denali";
import { createCanonicalDocument } from "@app-tour/workspace-sdk";

import {
  assertTourPublishLifecycleOnUpdate,
} from "../src/canonical/assert-tour-publish-lifecycle-gate.ts";
import { PlatformTenantRepository } from "../src/platform/platform-tenant.repository.ts";
import {
  resolveValidationMode,
  runValidationModePublishGate,
} from "../src/tours/resolve-validation-mode.ts";
import { resolveWorkspacePluginForTenantContext } from "../src/workspace/resolve-workspace-plugin-for-tenant-context.ts";
import { resolveWorkspacePluginForType } from "../src/workspace/resolve-workspace-plugin.ts";
import {
  captureMarketingRevalidateFetch,
  drainScheduledRevalidate,
  mockMarketingRevalidateEnv,
  restoreMarketingRevalidateEnv,
} from "./club-catalog-publish-test-helpers.ts";
import { loadDenaliSeedExport } from "./lib/workspace-metadata-parity-helpers.ts";

const GOLDEN_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/workspaces/denali/test/fixtures/golden"
);

const TENANT_ID = "00000000-0000-4000-8000-000000000030";
const DENALI_BINDING = {
  workspaceDefinitionId: "denali-tour-ops",
  workspaceDefinitionVersion: 1,
} as const;

const env = process.env as Record<string, string | undefined>;
const envSnapshot = {
  WORKSPACE_METADATA_ENABLED: env.WORKSPACE_METADATA_ENABLED,
  WORKSPACE_METADATA_TENANT_ALLOWLIST: env.WORKSPACE_METADATA_TENANT_ALLOWLIST,
};

function loadGoldenForm(filename: string): Record<string, unknown> {
  const raw = JSON.parse(readFileSync(join(GOLDEN_DIR, filename), "utf8")) as Record<
    string,
    unknown
  >;
  const { _templateOverlay: _ignored, ...form } = raw;
  return form;
}

function buildDenaliTenantRepository() {
  return new PlatformTenantRepository({
    tenant: {
      findUnique: async () => ({
        id: TENANT_ID,
        subdomain: "metadata-publish-club",
        workspaceType: "denali",
        status: "active",
        createdAt: new Date("2026-06-21T12:00:00.000Z"),
        offboardingStartedAt: null,
        scheduledDeletionAt: null,
        ...DENALI_BINDING,
      }),
    },
  } as never);
}

function buildDenaliSeedLoadPublishedVersion() {
  const seed = loadDenaliSeedExport();
  return async () => ({
    id: "00000000-0000-4000-8000-000000000031",
    definitionId: seed.definitionId,
    version: seed.version,
    pluginApiVersion: 1,
    payload: seed.payload,
    checksum: seed.checksum,
    publishedAt: new Date("2026-06-21T12:00:00.000Z"),
  });
}

function metadataValidationDeps() {
  return {
    tenantRepository: buildDenaliTenantRepository(),
    loadPublishedVersion: buildDenaliSeedLoadPublishedVersion(),
  };
}

async function resolveMetadataDenaliPluginForTenant() {
  return resolveWorkspacePluginForTenantContext(TENANT_ID, "denali", metadataValidationDeps());
}

function withPublishStatus(
  form: Record<string, unknown>,
  publishStatus: "draft" | "active"
): Record<string, unknown> {
  const basicInfo = form.basicInfo as Record<string, unknown>;
  return {
    ...form,
    basicInfo: {
      ...basicInfo,
      publishStatus,
    },
  };
}

function canonicalFromGoldenForm(form: Record<string, unknown>) {
  const projected = projectDenaliWizardFormToCanonicalIngressData(form);
  projected.publishStatus = (form.basicInfo as { publishStatus?: string }).publishStatus ?? "draft";
  return createCanonicalDocument({
    schemaVersion: 1,
    roots: Object.keys(projected),
    data: projected,
  });
}

afterEach(() => {
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value !== undefined) {
      env[key] = value;
    } else {
      delete env[key];
    }
  }
  restoreMarketingRevalidateEnv({ url: undefined, secret: undefined });
});

describe("denali-metadata-path-publish-integration (P5-B E2E-01..03)", () => {
  it("E2E-01 create→publish on metadata path", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    delete env.WORKSPACE_METADATA_TENANT_ALLOWLIST;

    const golden = loadGoldenForm("tour-publish-ready.json");
    const draftDoc = canonicalFromGoldenForm(withPublishStatus(golden, "draft"));
    const publishDoc = canonicalFromGoldenForm(withPublishStatus(golden, "active"));

    const metadataPlugin = await resolveMetadataDenaliPluginForTenant();
    const packagePlugin = await resolveWorkspacePluginForType("denali");
    assert.equal(metadataPlugin.validation, packagePlugin.validation);

    assert.equal(
      runValidationModePublishGate(
        metadataPlugin,
        draftDoc,
        resolveValidationMode({ tenantId: TENANT_ID, workspaceType: "denali", body: {} }, draftDoc)
      ),
      null
    );
    assert.equal(
      runValidationModePublishGate(
        metadataPlugin,
        publishDoc,
        resolveValidationMode({ tenantId: TENANT_ID, workspaceType: "denali", body: {} }, publishDoc)
      ),
      null
    );
    assert.equal(
      runValidationModePublishGate(metadataPlugin, publishDoc, "publish"),
      runValidationModePublishGate(packagePlugin, publishDoc, "publish")
    );

    assert.ok(metadataPlugin.lifecycle);
    assert.doesNotThrow(() =>
      assertTourPublishLifecycleOnUpdate({
        workspaceType: "denali",
        lifecycle: metadataPlugin.lifecycle!,
        before: draftDoc,
        after: publishDoc,
      })
    );
  });

  it("E2E-02 metadata publish still schedules marketing catalog revalidate (P4)", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    delete env.WORKSPACE_METADATA_TENANT_ALLOWLIST;

    const prior = mockMarketingRevalidateEnv({
      url: "http://marketing.test",
      secret: "test-secret",
    });
    const capture = captureMarketingRevalidateFetch();

    try {
      const golden = loadGoldenForm("tour-publish-ready.json");
      const draftDoc = canonicalFromGoldenForm(withPublishStatus(golden, "draft"));
      const publishDoc = canonicalFromGoldenForm(withPublishStatus(golden, "active"));

      const { maybeScheduleMarketingCatalogRevalidate } =
        await import("../src/marketing/maybe-schedule-marketing-catalog-revalidate.ts");
      maybeScheduleMarketingCatalogRevalidate({
        workspaceType: "denali",
        before: draftDoc,
        after: publishDoc,
        tenantId: TENANT_ID,
      });
      await drainScheduledRevalidate();
      assert.equal(capture.calls.length, 1);
      assert.match(capture.calls[0]!.url, /\/api\/revalidate$/);
      const payload = JSON.parse(capture.calls[0]!.body) as { tenantId: string };
      assert.equal(payload.tenantId, TENANT_ID);
    } finally {
      capture.restore();
      restoreMarketingRevalidateEnv(prior);
    }
  });

  it("E2E-03 offline_receipt paymentMode unchanged on metadata publish path", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    delete env.WORKSPACE_METADATA_TENANT_ALLOWLIST;

    const golden = loadGoldenForm("tour-publish-ready.json");
    assert.equal(
      (golden.pricingPayment as { paymentMode?: string }).paymentMode,
      "offline_receipt"
    );

    const publishDoc = canonicalFromGoldenForm(withPublishStatus(golden, "active"));
    const pricing = publishDoc.data.pricing as { paymentMode?: string } | undefined;
    assert.equal(pricing?.paymentMode, "offline_receipt");

    const metadataPlugin = await resolveMetadataDenaliPluginForTenant();
    const packagePlugin = await resolveWorkspacePluginForType("denali");
    assert.equal(metadataPlugin.validation, packagePlugin.validation);
    assert.equal(
      runValidationModePublishGate(metadataPlugin, publishDoc, "publish"),
      null
    );
  });
});
