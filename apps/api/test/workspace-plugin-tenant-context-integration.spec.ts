import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";
import { stripWorkspacePluginToDefinitionPayload } from "@app-tour/workspace-sdk/metadata";

import { PlatformTenantRepository } from "../src/platform/platform-tenant.repository.ts";
import {
  buildValidationEngineCacheKey,
  invalidateValidationEngineCacheForTenant,
  resolveMetadataFingerprintForEngineCache,
  resetValidationEngineCacheForTests,
} from "../src/tours/canonical-validation-sync.ts";
import { resolveWorkspacePluginForType } from "../src/workspace/resolve-workspace-plugin.ts";
import { resolveWorkspacePluginForTenantContext } from "../src/workspace/resolve-workspace-plugin-for-tenant-context.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const readSource = (relativePath: string): string =>
  readFileSync(join(repoRoot, relativePath), "utf8");

const env = process.env as Record<string, string | undefined>;
const envSnapshot = { WORKSPACE_METADATA_ENABLED: env.WORKSPACE_METADATA_ENABLED };

afterEach(() => {
  resetValidationEngineCacheForTests();
  if (envSnapshot.WORKSPACE_METADATA_ENABLED !== undefined) {
    env.WORKSPACE_METADATA_ENABLED = envSnapshot.WORKSPACE_METADATA_ENABLED;
  } else {
    delete env.WORKSPACE_METADATA_ENABLED;
  }
});

describe("resolveWorkspacePluginForTenantContext (P3-A-N-011)", () => {
  it("IG-01 flag off → fieldRegistry matches package denali", async () => {
    delete env.WORKSPACE_METADATA_ENABLED;
    const tenantId = "00000000-0000-4000-8000-000000000020";
    const plugin = await resolveWorkspacePluginForTenantContext(tenantId, "denali");
    const packagePlugin = await resolveWorkspacePluginForType("denali");
    assert.deepEqual(plugin.fieldRegistry, packagePlugin.fieldRegistry);
    assert.equal(plugin.id, packagePlugin.id);
  });

  it("IG-02 flag off → validation hooks preserved on package plugin", async () => {
    delete env.WORKSPACE_METADATA_ENABLED;
    const plugin = await resolveWorkspacePluginForTenantContext(
      "00000000-0000-4000-8000-000000000021",
      "starter"
    );
    const packagePlugin = await resolveWorkspacePluginForType("starter");
    assert.equal(typeof plugin.validation?.checkCapacity, "function");
    assert.equal(plugin.validation, packagePlugin.validation);
  });

  it("IG-07 tenant binding + flag → fieldRegistry from metadata payload", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    const tenantId = "00000000-0000-4000-8000-000000000022";
    const overlay = getStarterWorkspacePlugin();
    const payload = stripWorkspacePluginToDefinitionPayload(overlay);
    payload.fieldRegistry = {
      version: payload.fieldRegistry.version,
      fields: [
        ...payload.fieldRegistry.fields,
        {
          id: "basics.metadataExtra",
          canonicalPath: "basics.metadataExtra",
          kind: "text",
          required: false,
          stepId: "basics",
        },
      ],
    };
    const repository = new PlatformTenantRepository({
      tenant: {
        findUnique: async () => ({
          id: tenantId,
          subdomain: "ingress-club",
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

    const loadPublishedVersion = async () => ({
      id: "00000000-0000-4000-8000-000000000099",
      definitionId: "starter-shell",
      version: 1,
      pluginApiVersion: 1,
      payload,
      checksum: "test",
      publishedAt: new Date("2026-06-21T12:00:00.000Z"),
    });

    const plugin = await resolveWorkspacePluginForTenantContext(tenantId, "starter", {
      tenantRepository: repository,
      loadPublishedVersion,
    });
    const packagePlugin = await resolveWorkspacePluginForType("starter");
    assert.notDeepEqual(plugin.fieldRegistry.fields, packagePlugin.fieldRegistry.fields);
    assert.equal(plugin.fieldRegistry, payload.fieldRegistry);
  });
});

describe("P0 ingress wiring (P3-A-N-012 static asserts)", () => {
  it("IG-03 canonical-validation-sync imports tenant context resolve", async () => {
    const source = readSource("src/tours/canonical-validation-sync.ts");
    assert.match(source, /resolveWorkspacePluginForTenantContext/);
  });

  it("IG-04 build-clone-tour-body imports tenant context resolve", async () => {
    const source = readSource("src/tours/build-clone-tour-body.ts");
    assert.match(source, /resolveWorkspacePluginForTenantContext/);
  });

  it("IG-05 wizard-template-catalog imports tenant context resolve", async () => {
    const source = readSource("src/settings/wizard-template-catalog.ts");
    assert.match(source, /resolveWorkspacePluginForTenantContext/);
  });
});

describe("validation engine cache fingerprint (P3-A-N-011)", () => {
  it("IG-06 flag on + binding → cache key includes definition fingerprint", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    const tenantId = "00000000-0000-4000-8000-000000000023";
    const repository = new PlatformTenantRepository({
      tenant: {
        findUnique: async () => ({
          id: tenantId,
          subdomain: "cache-club",
          workspaceType: "denali",
          status: "active",
          createdAt: new Date("2026-06-21T12:00:00.000Z"),
          offboardingStartedAt: null,
          scheduledDeletionAt: null,
          workspaceDefinitionId: "denali-tour-ops",
          workspaceDefinitionVersion: 2,
        }),
      },
    } as never);

    const fingerprint = await resolveMetadataFingerprintForEngineCache(tenantId, {
      tenantRepository: repository,
    });
    assert.equal(fingerprint, "denali-tour-ops:2");
    const key = buildValidationEngineCacheKey(tenantId, "denali", "default", fingerprint);
    assert.match(key, /denali-tour-ops:2$/);
  });

  it("IG-08 invalidateValidationEngineCacheForTenant allows new fingerprint key", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    const tenantId = "00000000-0000-4000-8000-000000000024";
    let pinnedVersion: number | null = 1;
    const repository = new PlatformTenantRepository({
      tenant: {
        findUnique: async () => ({
          id: tenantId,
          subdomain: "cache-bust-club",
          workspaceType: "denali",
          status: "active",
          createdAt: new Date("2026-06-21T12:00:00.000Z"),
          offboardingStartedAt: null,
          scheduledDeletionAt: null,
          workspaceDefinitionId: "denali-tour-ops",
          workspaceDefinitionVersion: pinnedVersion,
        }),
      },
    } as never);

    const fingerprintBefore = await resolveMetadataFingerprintForEngineCache(tenantId, {
      tenantRepository: repository,
    });
    assert.equal(fingerprintBefore, "denali-tour-ops:1");

    invalidateValidationEngineCacheForTenant(tenantId);
    pinnedVersion = 2;
    const fingerprintAfter = await resolveMetadataFingerprintForEngineCache(tenantId, {
      tenantRepository: repository,
    });
    assert.equal(fingerprintAfter, "denali-tour-ops:2");
    assert.notEqual(
      buildValidationEngineCacheKey(tenantId, "denali", "default", fingerprintBefore),
      buildValidationEngineCacheKey(tenantId, "denali", "default", fingerprintAfter)
    );
  });
});
