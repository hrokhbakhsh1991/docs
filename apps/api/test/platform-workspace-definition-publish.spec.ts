import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";
import {
  DEFAULT_WORKSPACE_COMMERCE_CONFIG,
  stripWorkspacePluginToDefinitionPayload,
  type WorkspaceDefinitionPayload,
} from "@app-tour/workspace-sdk/metadata";
import { computeWorkspaceDefinitionPayloadChecksum } from "@app-tour/workspace-sdk/metadata/checksum";

import { assertPlatformOpsOwnerRole } from "../src/platform/assert-platform-ops-role.ts";
import { createPlatformWorkspaceDefinition } from "../src/platform/create-platform-workspace-definition.ts";
import {
  PLATFORM_AUDIT_ACTION_WORKSPACE_DEFINITION_PUBLISHED,
} from "../src/platform/platform-audit-logger.ts";
import {
  PlatformDefinitionConflict,
  PlatformForbidden,
  PlatformRendererNotAllowed,
  PlatformValidation,
} from "../src/platform/platform.errors.ts";
import {
  getPlatformWorkspaceDefinitionVersion,
  publishPlatformWorkspaceDefinitionVersion,
} from "../src/platform/publish-platform-workspace-definition-version.ts";
import type { WorkspaceDefinitionVersionRow } from "../src/workspace-metadata/workspace-definition.repository.ts";
import { WorkspaceDefinitionRepository } from "../src/workspace-metadata/workspace-definition.repository.ts";

function buildStarterPayload(definitionId: string): WorkspaceDefinitionPayload {
  const payload = stripWorkspacePluginToDefinitionPayload(getStarterWorkspacePlugin());
  return { ...payload, id: definitionId };
}

function buildStarterPayloadWithDefaultCommerce(definitionId: string): WorkspaceDefinitionPayload {
  return {
    ...buildStarterPayload(definitionId),
    commerce: DEFAULT_WORKSPACE_COMMERCE_CONFIG,
  };
}

class InMemoryWorkspaceDefinitionRepository extends WorkspaceDefinitionRepository {
  readonly definitions = new Map<
    string,
    { readonly id: string; readonly displayName: string; status: string }
  >();
  readonly versions = new Map<string, WorkspaceDefinitionVersionRow>();

  constructor() {
    super({} as never);
  }

  override async createDefinition(input: {
    readonly id: string;
    readonly displayName: string;
  }): Promise<{ readonly id: string; readonly displayName: string; readonly status: string }> {
    if (this.definitions.has(input.id)) {
      const error = new Error("unique") as Error & { code?: string };
      error.code = "P2002";
      throw error;
    }
    const row = { id: input.id, displayName: input.displayName, status: "draft" };
    this.definitions.set(input.id, row);
    return row;
  }

  override async getDefinitionById(
    definitionId: string
  ): Promise<{ readonly id: string; readonly displayName: string; readonly status: string } | null> {
    return this.definitions.get(definitionId) ?? null;
  }

  override async getNextVersionNumber(definitionId: string): Promise<number> {
    let max = 0;
    for (const key of this.versions.keys()) {
      const [id, versionRaw] = key.split(":");
      if (id !== definitionId) continue;
      const version = Number.parseInt(versionRaw ?? "0", 10);
      if (version > max) max = version;
    }
    return max + 1;
  }

  override async getVersion(
    definitionId: string,
    version: number
  ): Promise<WorkspaceDefinitionVersionRow | null> {
    return this.versions.get(`${definitionId}:${version}`) ?? null;
  }

  override async createPublishedVersion(
    _tx: unknown,
    input: {
      definitionId: string;
      version: number;
      payload: unknown;
      checksum: string;
      pluginApiVersion?: number;
      createdByPlatformOpsUserId?: string | null;
    }
  ): Promise<WorkspaceDefinitionVersionRow> {
    const row: WorkspaceDefinitionVersionRow = {
      id: randomUUID(),
      definitionId: input.definitionId,
      version: input.version,
      pluginApiVersion: input.pluginApiVersion ?? 1,
      payload: input.payload,
      checksum: input.checksum,
      publishedAt: new Date("2026-06-21T12:00:00.000Z"),
    };
    this.versions.set(`${input.definitionId}:${input.version}`, row);
    return row;
  }
}

function makePublishDeps(repository: InMemoryWorkspaceDefinitionRepository) {
  const auditEvents: Array<Record<string, unknown>> = [];
  const prisma = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        workspaceDefinition: {
          update: async ({
            where,
            data,
          }: {
            where: { id: string };
            data: { status: string };
          }) => {
            const row = repository.definitions.get(where.id);
            if (row) {
              repository.definitions.set(where.id, { ...row, status: data.status });
            }
            return row;
          },
        },
        platformAuditEvent: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            auditEvents.push(data);
            return { id: randomUUID(), ...data };
          },
        },
      }),
  };
  return { prisma, auditEvents };
}

describe("platform-workspace-definition-publish", () => {
  it("PB-01 publishes v1 with checksum and audit event", async () => {
    const repository = new InMemoryWorkspaceDefinitionRepository();
    await repository.createDefinition({ id: "pb-club-v1", displayName: "PB Club" });
    const payload = buildStarterPayload("pb-club-v1");
    const expectedChecksum = computeWorkspaceDefinitionPayloadChecksum(
      buildStarterPayloadWithDefaultCommerce("pb-club-v1")
    );
    const { prisma, auditEvents } = makePublishDeps(repository);

    const published = await publishPlatformWorkspaceDefinitionVersion({
      definitionId: "pb-club-v1",
      payload,
      actorId: "ops-owner",
      repository,
      prisma: prisma as never,
    });

    assert.ok(published);
    assert.equal(published?.version, 1);
    assert.equal(published?.checksum, expectedChecksum);
    assert.equal(published?.definitionId, "pb-club-v1");
    assert.equal(repository.definitions.get("pb-club-v1")?.status, "published");
    assert.equal(auditEvents.length, 1);
    assert.equal(auditEvents[0]?.action, PLATFORM_AUDIT_ACTION_WORKSPACE_DEFINITION_PUBLISHED);
    assert.equal(auditEvents[0]?.entityId, "pb-club-v1");

    const stored = await getPlatformWorkspaceDefinitionVersion({
      definitionId: "pb-club-v1",
      version: 1,
      repository,
    });
    assert.ok(stored);
    assert.deepEqual(
      (stored.payload as WorkspaceDefinitionPayload).commerce,
      DEFAULT_WORKSPACE_COMMERCE_CONFIG
    );
  });

  it("API-01 publish without commerce merges default offline_receipt block", async () => {
    const repository = new InMemoryWorkspaceDefinitionRepository();
    await repository.createDefinition({ id: "pb-commerce-default", displayName: "Commerce Default" });
    const payload = buildStarterPayload("pb-commerce-default");
    assert.equal(payload.commerce, undefined);
    const { prisma } = makePublishDeps(repository);

    const published = await publishPlatformWorkspaceDefinitionVersion({
      definitionId: "pb-commerce-default",
      payload,
      actorId: "ops-owner",
      repository,
      prisma: prisma as never,
    });

    assert.ok(published);
    assert.equal(
      published?.checksum,
      computeWorkspaceDefinitionPayloadChecksum(buildStarterPayloadWithDefaultCommerce("pb-commerce-default"))
    );

    const stored = await repository.getVersion("pb-commerce-default", 1);
    assert.deepEqual(
      (stored?.payload as WorkspaceDefinitionPayload).commerce,
      DEFAULT_WORKSPACE_COMMERCE_CONFIG
    );
  });

  it("PB-02 keeps prior version immutable when publishing v2", async () => {
    const repository = new InMemoryWorkspaceDefinitionRepository();
    await repository.createDefinition({ id: "pb-immutable", displayName: "Immutable" });
    const payloadV1 = buildStarterPayload("pb-immutable");
    const { prisma } = makePublishDeps(repository);

    await publishPlatformWorkspaceDefinitionVersion({
      definitionId: "pb-immutable",
      payload: payloadV1,
      actorId: "ops-owner",
      repository,
      prisma: prisma as never,
    });

    const v1Before = await repository.getVersion("pb-immutable", 1);
    assert.ok(v1Before);

    const payloadV2 = {
      ...payloadV1,
      fieldRegistry: {
        ...payloadV1.fieldRegistry,
        fields: [
          ...payloadV1.fieldRegistry.fields,
          {
            id: "platform.photos",
            canonicalPath: "basics.pbExtra",
            stepId: payloadV1.wizard.roots[0] ?? "basics",
            kind: "text" as const,
            required: false,
          },
        ],
      },
    };

    const publishedV2 = await publishPlatformWorkspaceDefinitionVersion({
      definitionId: "pb-immutable",
      payload: payloadV2,
      actorId: "ops-owner",
      repository,
      prisma: prisma as never,
    });

    assert.equal(publishedV2?.version, 2);
    const v1After = await repository.getVersion("pb-immutable", 1);
    assert.deepEqual(v1After?.payload, v1Before?.payload);
    assert.equal(v1After?.checksum, v1Before?.checksum);
  });

  it("PB-03 rejects validation hooks in payload", async () => {
    const repository = new InMemoryWorkspaceDefinitionRepository();
    await repository.createDefinition({ id: "pb-hooks", displayName: "Hooks" });
    const payload = {
      ...buildStarterPayload("pb-hooks"),
      validation: { checkCapacity: () => true },
    };
    const { prisma } = makePublishDeps(repository);

    await assert.rejects(
      () =>
        publishPlatformWorkspaceDefinitionVersion({
          definitionId: "pb-hooks",
          payload,
          actorId: "ops-owner",
          repository,
          prisma: prisma as never,
        }),
      PlatformValidation
    );
  });

  it("PB-04 rejects non-allowlisted composite renderer ids", async () => {
    const repository = new InMemoryWorkspaceDefinitionRepository();
    await repository.createDefinition({ id: "pb-allowlist", displayName: "Allowlist" });
    const payload = buildStarterPayload("pb-allowlist");
    const badPayload = {
      ...payload,
      fieldRegistry: {
        ...payload.fieldRegistry,
        fields: [
          ...payload.fieldRegistry.fields,
          {
            id: "denali.secret-widget",
            canonicalPath: "basics.secret",
            stepId: payload.wizard.roots[0] ?? "basics",
            kind: "composite" as const,
            required: false,
          },
        ],
      },
    };
    const { prisma } = makePublishDeps(repository);

    await assert.rejects(
      () =>
        publishPlatformWorkspaceDefinitionVersion({
          definitionId: "pb-allowlist",
          payload: badPayload,
          actorId: "ops-owner",
          repository,
          prisma: prisma as never,
        }),
      (error: unknown) => {
        assert.ok(error instanceof PlatformRendererNotAllowed);
        assert.equal(error.rendererId, "denali.secret-widget");
        return true;
      }
    );
  });

  it("PB-05 owner-only publish rejects admin and support roles", () => {
    assert.throws(
      () => assertPlatformOpsOwnerRole({ actorId: "admin-1", roles: ["admin"] }),
      PlatformForbidden
    );
    assert.throws(
      () => assertPlatformOpsOwnerRole({ actorId: "support-1", roles: ["support"] }),
      PlatformForbidden
    );
    assert.equal(assertPlatformOpsOwnerRole({ actorId: "owner-1", roles: ["owner"] }), true);
  });

  it("PB-06 create definition returns conflict when id exists", async () => {
    const repository = new InMemoryWorkspaceDefinitionRepository();
    await createPlatformWorkspaceDefinition({
      id: "pb-conflict",
      displayName: "First",
      repository,
    });

    await assert.rejects(
      () =>
        createPlatformWorkspaceDefinition({
          id: "pb-conflict",
          displayName: "Second",
          repository,
        }),
      PlatformDefinitionConflict
    );
  });

  it("PB-07 get version returns stored payload snapshot", async () => {
    const repository = new InMemoryWorkspaceDefinitionRepository();
    await repository.createDefinition({ id: "pb-get", displayName: "Get" });
    const payload = buildStarterPayload("pb-get");
    const { prisma } = makePublishDeps(repository);

    await publishPlatformWorkspaceDefinitionVersion({
      definitionId: "pb-get",
      payload,
      actorId: "ops-owner",
      repository,
      prisma: prisma as never,
    });

    const row = await getPlatformWorkspaceDefinitionVersion({
      definitionId: "pb-get",
      version: 1,
      repository,
    });

    assert.ok(row);
    assert.equal(row?.definitionId, "pb-get");
    assert.equal(row?.version, 1);
    assert.equal((row?.payload as WorkspaceDefinitionPayload).id, "pb-get");
    assert.equal(row?.checksum, computeWorkspaceDefinitionPayloadChecksum(row?.payload as WorkspaceDefinitionPayload));
    assert.match(row?.checksum ?? "", /^[a-f0-9]{64}$/);
  });
});
