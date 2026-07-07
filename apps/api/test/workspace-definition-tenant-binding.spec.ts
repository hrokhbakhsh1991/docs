import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";
import { stripWorkspacePluginToDefinitionPayload } from "@app-tour/workspace-sdk/metadata";

import { PlatformTenantRepository } from "../src/platform/platform-tenant.repository.ts";
import { updatePlatformTenantWorkspaceDefinition } from "../src/platform/update-platform-tenant-workspace-definition.ts";
import {
  resolveWorkspacePluginForTenantById,
  toTenantWorkspaceMetadataBinding,
} from "../src/workspace-metadata/read-tenant-workspace-metadata-binding.ts";

describe("toTenantWorkspaceMetadataBinding", () => {
  it("returns null when definition id absent", () => {
    assert.equal(
      toTenantWorkspaceMetadataBinding({
        workspaceDefinitionId: null,
        workspaceDefinitionVersion: null,
      }),
      null
    );
  });

  it("maps tenant columns", () => {
    assert.deepEqual(
      toTenantWorkspaceMetadataBinding({
        workspaceDefinitionId: "denali-tour-ops",
        workspaceDefinitionVersion: 1,
      }),
      { definitionId: "denali-tour-ops", definitionVersion: 1 }
    );
  });
});

describe("resolveWorkspacePluginForTenantById", () => {
  it("uses tenant binding when metadata enabled", async () => {
    const env = process.env as Record<string, string | undefined>;
    env.WORKSPACE_METADATA_ENABLED = "true";
    const tenantId = "00000000-0000-4000-8000-000000000010";
    const overlay = getStarterWorkspacePlugin();
    const payload = stripWorkspacePluginToDefinitionPayload(overlay);
    const repository = new PlatformTenantRepository({
      tenant: {
        findUnique: async () => ({
          id: tenantId,
          subdomain: "meta-club",
          workspaceType: "starter",
          status: "active",
          createdAt: new Date("2026-06-21T12:00:00.000Z"),
          offboardingStartedAt: null,
          scheduledDeletionAt: null,
          workspaceDefinitionId: "starter-shell",
          workspaceDefinitionVersion: 1,
        }),
      },
    } as never);

    const plugin = await resolveWorkspacePluginForTenantById(tenantId, {
      tenantRepository: repository,
      loadPublishedVersion: async () => ({
        id: "00000000-0000-4000-8000-000000000099",
        definitionId: "starter-shell",
        version: 1,
        pluginApiVersion: 1,
        payload,
        checksum: "test",
        publishedAt: new Date("2026-06-21T12:00:00.000Z"),
      }),
    });
    assert.equal(plugin.fieldRegistry, payload.fieldRegistry);
    assert.equal(plugin.validation, overlay.validation);
    delete env.WORKSPACE_METADATA_ENABLED;
  });
});

describe("updatePlatformTenantWorkspaceDefinition", () => {
  it("returns null when clearing binding", async () => {
    const tenantId = "00000000-0000-4000-8000-000000000011";
    const tenantRepository = new PlatformTenantRepository({
      tenant: {
        findUnique: async () => ({
          id: tenantId,
          subdomain: "clear-club",
          workspaceType: "starter",
          status: "active",
          createdAt: new Date("2026-06-21T12:00:00.000Z"),
          offboardingStartedAt: null,
          scheduledDeletionAt: null,
          workspaceDefinitionId: "starter-shell",
          workspaceDefinitionVersion: 1,
        }),
      },
    } as never);

    const prisma = {
      workspaceDefinition: {
        findUnique: async () => null,
      },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          tenant: {
            update: async () => ({}),
          },
          platformAuditEvent: {
            create: async () => ({}),
          },
        }),
    };

    const result = await updatePlatformTenantWorkspaceDefinition({
      tenantId,
      actorId: "ops-1",
      patch: { definitionId: null },
      tenantRepository,
      prisma: prisma as never,
    });
    assert.equal(result, null);
  });
});
