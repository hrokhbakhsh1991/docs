import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  getSettingsResourcesRepository,
  resetSettingsResourcesRepositorySingletonForTests,
} from "../../settings/create-settings-resources-repository";
import { resetSettingsResourcesRepositoryForTests } from "../../settings/in-memory-settings-resources.repository";

import { resolveDeliveryReferenceDisplayValues } from "./resolve-delivery-reference-display-values";

describe("resolveDeliveryReferenceDisplayValues", () => {
  const previousStorageDriver = process.env.STORAGE_DRIVER;

  afterEach(() => {
    resetSettingsResourcesRepositorySingletonForTests();
    resetSettingsResourcesRepositoryForTests();
    if (previousStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = previousStorageDriver;
    }
  });

  it("resolves denali destination ids from tenant catalog", async () => {
    process.env.STORAGE_DRIVER = "memory";
    const tenantId = "tenant-delivery-catalog";
    const repo = getSettingsResourcesRepository();
    const region = await repo.createRegion(tenantId, { name: "Alborz" });
    const destination = await repo.createDestination(tenantId, {
      regionId: region.id,
      name: "Damavand",
    });

    const values = await resolveDeliveryReferenceDisplayValues({
      tenantId,
      workspaceType: "denali",
      providerId: "telegram",
      payload: {
        tenantId,
        destinationId: destination.id,
      },
      eligibleFieldIds: ["denali.destination"],
      definitions: [
        {
          id: "denali.destination",
          workspaceType: "denali",
          canonicalPath: "destinationId",
          kind: "text",
          version: 1,
        },
      ],
    });

    assert.deepEqual(values, {
      destinationId: "Damavand",
    });
  });

  it("returns an empty map for non-denali workspaces", async () => {
    process.env.STORAGE_DRIVER = "memory";
    const values = await resolveDeliveryReferenceDisplayValues({
      tenantId: "tenant-a",
      workspaceType: "starter",
      providerId: "telegram",
      payload: { destinationId: "dest-1" },
      eligibleFieldIds: ["denali.destination"],
      definitions: [],
    });

    assert.deepEqual(values, {});
  });

  it("returns an empty map when the provider does not declare reference display fields", async () => {
    process.env.STORAGE_DRIVER = "memory";
    const values = await resolveDeliveryReferenceDisplayValues({
      tenantId: "tenant-a",
      workspaceType: "denali",
      providerId: "email",
      payload: { destinationId: "dest-1" },
      eligibleFieldIds: ["denali.destination"],
      definitions: [
        {
          id: "denali.destination",
          workspaceType: "denali",
          canonicalPath: "destinationId",
          kind: "text",
          version: 1,
        },
      ],
    });

    assert.deepEqual(values, {});
  });
});
