/**
 * P5-A-N-009 — workspace definition bind/clear audit reuse
 * @see docs/phase-18/platform-metadata-cutover-pilot.mdoc (AUD-01..02)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  PLATFORM_AUDIT_ACTION_TENANT_DEFINITION_ASSIGNED,
  PLATFORM_AUDIT_ACTION_TENANT_DEFINITION_CLEARED,
} from "../src/platform/platform-audit-logger.ts";
import { PlatformTenantRepository } from "../src/platform/platform-tenant.repository.ts";
import { updatePlatformTenantWorkspaceDefinition } from "../src/platform/update-platform-tenant-workspace-definition.ts";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

type CapturedAudit = { readonly action: string };

function createAuditCapturingPrisma(): {
  prisma: {
    workspaceDefinition: { findUnique: () => Promise<{ displayName: string }> };
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  };
  events: CapturedAudit[];
} {
  const events: CapturedAudit[] = [];
  const prisma = {
    workspaceDefinition: {
      findUnique: async () => ({ displayName: "Denali Tour Ops" }),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        tenant: {
          update: async () => ({}),
        },
        platformAuditEvent: {
          create: async (input: { data: { action: string } }) => {
            events.push({ action: input.data.action });
          },
        },
      }),
  };
  return { prisma, events };
}

function tenantRepositoryWith(input: {
  id: string;
  workspaceDefinitionId: string | null;
  workspaceDefinitionVersion: number | null;
}): PlatformTenantRepository {
  return new PlatformTenantRepository({
    tenant: {
      findUnique: async () => ({
        id: input.id,
        subdomain: "audit-club",
        workspaceType: "denali",
        status: "active",
        createdAt: new Date("2026-06-22T12:00:00.000Z"),
        offboardingStartedAt: null,
        scheduledDeletionAt: null,
        workspaceDefinitionId: input.workspaceDefinitionId,
        workspaceDefinitionVersion: input.workspaceDefinitionVersion,
      }),
    },
  } as never);
}

describe("platform-tenant-workspace-definition-audit (P5-A AUD)", () => {
  it("AUD-01 assign emits TENANT_DEFINITION_ASSIGNED only", async () => {
    const tenantId = "00000000-0000-4000-8000-000000000040";
    const { prisma, events } = createAuditCapturingPrisma();

    await updatePlatformTenantWorkspaceDefinition({
      tenantId,
      actorId: "ops-assign",
      patch: { definitionId: "denali-tour-ops", definitionVersion: 1 },
      tenantRepository: tenantRepositoryWith({
        id: tenantId,
        workspaceDefinitionId: null,
        workspaceDefinitionVersion: null,
      }),
      definitionRepository: {
        getPublishedVersion: async () => ({
          id: "00000000-0000-4000-8000-000000000099",
          definitionId: "denali-tour-ops",
          version: 1,
          pluginApiVersion: 1,
          payload: {},
          checksum: "test",
          publishedAt: new Date("2026-06-22T12:00:00.000Z"),
        }),
      } as never,
      prisma: prisma as never,
    });

    assert.equal(events.length, 1);
    assert.equal(events[0]?.action, PLATFORM_AUDIT_ACTION_TENANT_DEFINITION_ASSIGNED);
  });

  it("AUD-02 clear emits TENANT_DEFINITION_CLEARED only", async () => {
    const tenantId = "00000000-0000-4000-8000-000000000041";
    const { prisma, events } = createAuditCapturingPrisma();

    await updatePlatformTenantWorkspaceDefinition({
      tenantId,
      actorId: "ops-clear",
      patch: { definitionId: null },
      tenantRepository: tenantRepositoryWith({
        id: tenantId,
        workspaceDefinitionId: "denali-tour-ops",
        workspaceDefinitionVersion: 1,
      }),
      prisma: prisma as never,
    });

    assert.equal(events.length, 1);
    assert.equal(events[0]?.action, PLATFORM_AUDIT_ACTION_TENANT_DEFINITION_CLEARED);
  });

  it("AUD-03 update service uses frozen audit action constants only", () => {
    const source = readFileSync(
      join(apiRoot, "src/platform/update-platform-tenant-workspace-definition.ts"),
      "utf8"
    );
    assert.match(source, /PLATFORM_AUDIT_ACTION_TENANT_DEFINITION_ASSIGNED/);
    assert.match(source, /PLATFORM_AUDIT_ACTION_TENANT_DEFINITION_CLEARED/);
    assert.doesNotMatch(source, /action:\s*["']TENANT_DEFINITION_/);
  });
});
