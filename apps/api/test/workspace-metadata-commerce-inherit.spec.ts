/**
 * P5-C-N-004 — tenant binding inherits workspace commerce config
 * @see docs/phase-18/platform-workspace-commerce.mdoc
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  DEFAULT_WORKSPACE_COMMERCE_CONFIG,
  stripWorkspacePluginToDefinitionPayload,
} from "@app-tour/workspace-sdk/metadata";
import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";

import { isWorkspaceMetadataEnabled } from "../src/workspace-metadata/is-workspace-metadata-enabled.ts";
import {
  DENALI_FROZEN_COMMERCE_CONFIG,
  resolveWorkspaceCommerceConfigForTenant,
  resolveWorkspaceCommerceFromBinding,
} from "../src/workspace-metadata/resolve-workspace-commerce-for-tenant.ts";

const env = process.env as Record<string, string | undefined>;
const envSnapshot = { WORKSPACE_METADATA_ENABLED: env.WORKSPACE_METADATA_ENABLED };

afterEach(() => {
  if (envSnapshot.WORKSPACE_METADATA_ENABLED !== undefined) {
    env.WORKSPACE_METADATA_ENABLED = envSnapshot.WORKSPACE_METADATA_ENABLED;
  } else {
    delete env.WORKSPACE_METADATA_ENABLED;
  }
});

describe("workspace-metadata-commerce-inherit (P5-C N-004)", () => {
  it("returns package default when metadata flag off", async () => {
    delete env.WORKSPACE_METADATA_ENABLED;
    assert.equal(isWorkspaceMetadataEnabled(), false);
    const commerce = await resolveWorkspaceCommerceConfigForTenant({
      workspaceType: "starter",
      metadataBinding: { definitionId: "starter-v1", definitionVersion: 1 },
    });
    assert.deepEqual(commerce, DEFAULT_WORKSPACE_COMMERCE_CONFIG);
  });

  it("inherits commerce block from bound definition payload", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    const overlay = getStarterWorkspacePlugin();
    const payload = {
      ...stripWorkspacePluginToDefinitionPayload(overlay),
      commerce: {
        paymentMode: "gateway" as const,
        gatewayProvider: "zibal" as const,
        currency: "IRR",
      },
    };

    const commerce = await resolveWorkspaceCommerceConfigForTenant({
      workspaceType: "starter",
      metadataBinding: { definitionId: "starter-v1", definitionVersion: 2 },
      loadPublishedVersion: async () => ({
        id: "00000000-0000-4000-8000-000000000002",
        definitionId: "starter-v1",
        version: 2,
        pluginApiVersion: 1,
        payload,
        checksum: "abc",
        publishedAt: new Date("2026-06-21T12:00:00.000Z"),
      }),
    });

    assert.equal(commerce.paymentMode, "gateway");
    assert.equal(commerce.gatewayProvider, "zibal");
  });

  it("merges default commerce when published row omits commerce block", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    const payload = stripWorkspacePluginToDefinitionPayload(getStarterWorkspacePlugin());

    const commerce = await resolveWorkspaceCommerceConfigForTenant({
      workspaceType: "starter",
      metadataBinding: { definitionId: "starter-v1" },
      loadPublishedVersion: async () => ({
        id: "00000000-0000-4000-8000-000000000003",
        definitionId: "starter-v1",
        version: 1,
        pluginApiVersion: 1,
        payload,
        checksum: "abc",
        publishedAt: new Date("2026-06-21T12:00:00.000Z"),
      }),
    });

    assert.deepEqual(commerce, DEFAULT_WORKSPACE_COMMERCE_CONFIG);
  });

  it("denali workspace always resolves offline_receipt regardless of binding", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    const commerce = await resolveWorkspaceCommerceFromBinding({
      workspaceType: "denali",
      metadataBinding: { definitionId: "denali-tour-ops", definitionVersion: 1 },
      payloadCommerce: {
        paymentMode: "gateway",
        gatewayProvider: "stripe",
        currency: "IRR",
      },
    });
    assert.deepEqual(commerce, DENALI_FROZEN_COMMERCE_CONFIG);
  });

  it("dev registry tenant resolves commerce without platform DB row", async () => {
    delete env.WORKSPACE_METADATA_ENABLED;
    const { readTenantWorkspaceMetadataBinding } = await import(
      "../src/workspace-metadata/read-tenant-workspace-metadata-binding.ts"
    );
    const binding = await readTenantWorkspaceMetadataBinding(
      "00000000-0000-4000-8000-000000000001",
      {
        tenantRepository: {
          getById: async () => null,
        } as never,
      }
    );
    assert.ok(binding);
    assert.equal(binding!.workspaceType, "starter");
    assert.equal(binding!.metadataBinding, null);

    const commerce = await resolveWorkspaceCommerceConfigForTenant({
      workspaceType: binding!.workspaceType,
      tenantId: "00000000-0000-4000-8000-000000000001",
      metadataBinding: binding!.metadataBinding,
    });
    assert.deepEqual(commerce, DEFAULT_WORKSPACE_COMMERCE_CONFIG);
  });
});
