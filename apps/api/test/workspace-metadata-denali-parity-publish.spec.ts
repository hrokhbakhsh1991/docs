/**
 * P5-B-N-006 — golden metadata path (RP-01..04)
 * @see docs/phase-18/platform-denali-operator-parity.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { PlatformWizardEngine } from "@app-tour/platform-core";
import {
  denaliPluginForWizardEngine,
  projectDenaliWizardFormToCanonicalIngressData,
} from "@app-tour/workspace-denali";
import { createCanonicalDocument } from "@app-tour/workspace-sdk";

import {
  assertTourPublishLifecycleOnUpdate,
} from "../src/canonical/assert-tour-publish-lifecycle-gate.ts";
import { PlatformTenantRepository } from "../src/platform/platform-tenant.repository.ts";
import { runValidationModePublishGate } from "../src/tours/resolve-validation-mode.ts";
import { resolveWorkspacePluginForType } from "../src/workspace/resolve-workspace-plugin.ts";
import { resolveWorkspacePluginForTenantContext } from "../src/workspace/resolve-workspace-plugin-for-tenant-context.ts";
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

const DENALI_RULE_CONTEXT = {
  tenantId: TENANT_ID,
  dimensions: { category: "mountain", duration: "single_day" },
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
        subdomain: "metadata-golden-club",
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

async function resolveMetadataDenaliPluginForTenant() {
  return resolveWorkspacePluginForTenantContext(TENANT_ID, "denali", {
    tenantRepository: buildDenaliTenantRepository(),
    loadPublishedVersion: buildDenaliSeedLoadPublishedVersion(),
  });
}

function visibleFieldIds(plan: ReturnType<PlatformWizardEngine["buildRenderPlan"]>): readonly (readonly string[])[] {
  return plan.map((step) => step.fields.map((field) => field.fieldId));
}

function compositeIds(plan: ReturnType<PlatformWizardEngine["buildRenderPlan"]>): readonly string[] {
  const ids: string[] = [];
  for (const step of plan) {
    for (const field of step.fields) {
      const compositeId = field.uiHints?.compositeId;
      if (compositeId) {
        ids.push(compositeId);
      }
    }
  }
  return ids;
}

afterEach(() => {
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value !== undefined) {
      env[key] = value;
    } else {
      delete env[key];
    }
  }
});

describe("workspace-metadata-denali-parity-publish (P5-B RP-01..04)", () => {
  it("RP-01 flag+binding+denali-v1.json validates golden publish-ready tour", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    delete env.WORKSPACE_METADATA_TENANT_ALLOWLIST;

    const seed = loadDenaliSeedExport();
    const packagePlugin = resolveWorkspacePluginForType("denali");
    const metadataPlugin = await resolveMetadataDenaliPluginForTenant();
    assert.deepEqual(metadataPlugin.fieldRegistry, seed.payload.fieldRegistry);
    assert.equal(metadataPlugin.validation, packagePlugin.validation);

    const form = loadGoldenForm("tour-publish-ready.json");
    (form.basicInfo as Record<string, unknown>).publishStatus = "active";
    const projected = projectDenaliWizardFormToCanonicalIngressData(form);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: Object.keys(projected),
      data: projected,
    });

    assert.equal(runValidationModePublishGate(metadataPlugin, document, "publish"), null);
    assert.equal(runValidationModePublishGate(packagePlugin, document, "publish"), null);
  });

  it("RP-02 render plan field ids match package on metadata tenant path", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    delete env.WORKSPACE_METADATA_TENANT_ALLOWLIST;

    const metadataPlugin = await resolveMetadataDenaliPluginForTenant();
    const packagePlugin = resolveWorkspacePluginForType("denali");

    const packagePlan = PlatformWizardEngine.create(
      denaliPluginForWizardEngine(packagePlugin)
    ).buildRenderPlan(DENALI_RULE_CONTEXT);
    const metadataPlan = PlatformWizardEngine.create(
      denaliPluginForWizardEngine(metadataPlugin)
    ).buildRenderPlan(DENALI_RULE_CONTEXT);

    assert.deepEqual(visibleFieldIds(metadataPlan), visibleFieldIds(packagePlan));
  });

  it("RP-03 compositeId match on metadata tenant path", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    delete env.WORKSPACE_METADATA_TENANT_ALLOWLIST;

    const metadataPlugin = await resolveMetadataDenaliPluginForTenant();
    const packagePlugin = resolveWorkspacePluginForType("denali");

    const packagePlan = PlatformWizardEngine.create(
      denaliPluginForWizardEngine(packagePlugin)
    ).buildRenderPlan(DENALI_RULE_CONTEXT);
    const metadataPlan = PlatformWizardEngine.create(
      denaliPluginForWizardEngine(metadataPlugin)
    ).buildRenderPlan(DENALI_RULE_CONTEXT);

    assert.deepEqual(compositeIds(metadataPlan), compositeIds(packagePlan));
    assert.ok(compositeIds(packagePlan).some((id) => id.startsWith("denali.")));
  });

  it("RP-04 golden publishStatus draft→active transition on metadata path", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    delete env.WORKSPACE_METADATA_TENANT_ALLOWLIST;

    const metadataPlugin = await resolveMetadataDenaliPluginForTenant();
    assert.ok(metadataPlugin.lifecycle);

    const golden = loadGoldenForm("tour-publish-ready.json");
    const projected = projectDenaliWizardFormToCanonicalIngressData(golden);
    const beforeData = { ...projected, publishStatus: "draft" };
    const afterData = { ...projected, publishStatus: "active" };
    const before = createCanonicalDocument({
      schemaVersion: 1,
      roots: Object.keys(beforeData),
      data: beforeData,
    });
    const after = createCanonicalDocument({
      schemaVersion: 1,
      roots: Object.keys(afterData),
      data: afterData,
    });

    assert.doesNotThrow(() =>
      assertTourPublishLifecycleOnUpdate({
        workspaceType: "denali",
        lifecycle: metadataPlugin.lifecycle!,
        before,
        after,
      })
    );
  });
});
