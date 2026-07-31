import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { buildDenaliTenantWizardTemplatePayload } from "@app-tour/workspace-denali";

import { resetSettingsConfigRepositoryForTests } from "../settings/in-memory-settings-config.repository";
import { resetSettingsConfigRepositorySingletonForTests } from "../settings/create-settings-config-repository";
import {
  buildExposureSelectableFieldCatalog,
  exposureSelectableFieldIds,
} from "./exposure-field-catalog";
import {
  assertExposureSelectedFieldsAllowed,
  ExposureCatalogFieldNotAllowedError,
  resolveTenantExposureSelectableCatalog,
} from "./exposure-catalog.service";
import { PUBLISHED_WIZARD_TEMPLATE_EXPOSURE_CATALOG_SOURCE } from "./exposure-profile";

const TENANT_ID = "00000000-0000-4000-8000-000000000099";

describe("resolveTenantExposureSelectableCatalog", () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    resetSettingsConfigRepositorySingletonForTests();
  });

  after(() => {
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
    resetSettingsConfigRepositorySingletonForTests();
  });

  it("falls back to deliverable seed when tenant has no wizard template", async () => {
    resetSettingsConfigRepositoryForTests();
    resetSettingsConfigRepositorySingletonForTests();

    const catalog = await resolveTenantExposureSelectableCatalog({
      tenantId: TENANT_ID,
      workspaceType: "denali",
    });

    assert.deepEqual(
      catalog.fields.map((field) => field.id),
      (await buildExposureSelectableFieldCatalog("denali")).map((field) => field.id)
    );
    assert.equal(catalog.source, "registry_deliverable_migration_seed");
  });

  it("uses published wizard template when tenant config exists", async () => {
    resetSettingsConfigRepositoryForTests();
    resetSettingsConfigRepositorySingletonForTests();

    const { getSettingsConfigRepository } =
      await import("../settings/create-settings-config-repository");
    const repo = getSettingsConfigRepository();
    const payload = buildDenaliTenantWizardTemplatePayload();
    await repo.seed({
      tenantId: TENANT_ID,
      configKey: "wizard_template",
      configVersion: 1,
      payload,
      updatedAt: new Date().toISOString(),
    });

    const catalog = await resolveTenantExposureSelectableCatalog({
      tenantId: TENANT_ID,
      workspaceType: "denali",
    });

    assert.equal(catalog.source, PUBLISHED_WIZARD_TEMPLATE_EXPOSURE_CATALOG_SOURCE);
    assert.ok(catalog.fields.length > (await buildExposureSelectableFieldCatalog("denali")).length);
    assert.ok(catalog.fields.some((field) => field.canonicalPath === "transport.mode"));
  });

  it("rejects selected field ids outside tenant catalog", async () => {
    const deliverableIds = new Set(await exposureSelectableFieldIds("denali"));
    assert.throws(
      () => assertExposureSelectedFieldsAllowed(["not-a-real-field"], deliverableIds),
      ExposureCatalogFieldNotAllowedError
    );
  });
});
