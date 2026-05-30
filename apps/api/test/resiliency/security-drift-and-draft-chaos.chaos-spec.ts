/**
 * Chaos tests for JWT capability drift vs live ALS eviction and draft-engine
 * 3-way merge collision matrices.
 */
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { test } from "node:test";
import {
  createDefaultDraftMigratorRegistry,
  CURRENT_DRAFT_SCHEMA_VERSION,
  type DraftSnapshot,
  type DraftStoragePort,
} from "@repo/shared-contracts";

import { AbilityAction } from "../../src/common/casl/ability-actions";
import { AbilitiesGuard } from "../../src/common/casl/abilities.guard";
import { CheckAbilities } from "../../src/common/casl/check-abilities.decorator";
import { RequireCapability } from "../../src/common/casl/require-capability.decorator";
import { WorkspaceAbilityFactoryService } from "../../src/common/casl/workspace-ability.factory.service";
import { UserRole } from "../../src/common/auth/user-role.enum";
import type { RequestContextService } from "../../src/common/request-context/request-context.service";
import type { LoggerService } from "../../src/common/logger/logger.service";
import { DraftConflictException } from "../../src/modules/draft-engine/draft-conflict.exception";
import { DraftEngineFacade } from "../../src/modules/draft-engine/draft-engine.facade";
import { DefaultDraftConflictResolver } from "../../src/modules/draft-engine/domain/default-draft-conflict-resolver";
import { deterministicDraftMerge } from "../../src/modules/draft-engine/domain/deterministic-draft-merge";
import { CapabilityGuard } from "../../src/modules/identity/guards/capability.guard";
import type { AuditLogService } from "../../src/common/audit/audit-log.service";
import { DraftScopeResolver } from "../../src/modules/draft-engine/storage/draft-scope.resolver";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN_USER = "44444444-4444-4444-8444-444444444444";
const WORKSPACE_ID = TENANT_ID;

/** Serializes draft upserts to mirror optimistic concurrency under parallel conflict resolution. */
function createAtomicStatementGate() {
  let tail = Promise.resolve();
  return {
    run<T>(fn: () => Promise<T> | T): Promise<T> {
      const next = tail.then(fn, fn);
      tail = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },
  };
}

class ConcurrentDraftStore implements DraftStoragePort {
  private row: DraftSnapshot | null = null;
  private readonly gate = createAtomicStatementGate();

  constructor(initial?: DraftSnapshot) {
    this.row = initial ?? null;
  }

  getSnapshot(): DraftSnapshot | null {
    return this.row ? { ...this.row, data: structuredClone(this.row.data) } : null;
  }

  async find(): Promise<DraftSnapshot | null> {
    return this.row ? { ...this.row, data: structuredClone(this.row.data) } : null;
  }

  async upsert(_scope: unknown, snapshot: DraftSnapshot): Promise<DraftSnapshot> {
    return this.gate.run(async () => {
      if (this.row == null) {
        if (snapshot.version !== 0) {
          throw new DraftConflictException({
            data: snapshot.data,
            version: 0,
            schemaVersion: snapshot.schemaVersion,
            lastModified: snapshot.lastModified,
          });
        }
        this.row = { ...snapshot, version: 1 };
        return { ...this.row, data: structuredClone(this.row.data) };
      }
      if (this.row.version !== snapshot.version) {
        throw new DraftConflictException(this.row);
      }
      this.row = {
        ...snapshot,
        version: this.row.version + 1,
        lastModified: Date.now(),
        data: structuredClone(snapshot.data),
      };
      return { ...this.row, data: structuredClone(this.row.data) };
    });
  }

  async upgradeSchemaInPlace(): Promise<DraftSnapshot | null> {
    return null;
  }

  async delete(): Promise<void> {
    this.row = null;
  }
}

function createDraftFacade(store: ConcurrentDraftStore): DraftEngineFacade {
  const scopeResolver = {
    resolveOrThrow: () => ({
      workspaceId: WORKSPACE_ID,
      userId: ADMIN_USER,
      draftKey: "denali-create",
    }),
  } as unknown as DraftScopeResolver;

  const requestContext = {
    tryGetCorrelationId: () => "chaos-trace",
    tryGetRequestId: () => "chaos-trace",
    resolveEffectiveTenantId: () => WORKSPACE_ID,
  } as unknown as RequestContextService;

  return new DraftEngineFacade(
    store as never,
    scopeResolver,
    createDefaultDraftMigratorRegistry(),
    { logEvent: async () => undefined } as unknown as AuditLogService,
    { insert: async () => undefined } as never,
    requestContext,
    new DefaultDraftConflictResolver(),
  );
}

function mockExecutionContext(handler: object): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => handler.constructor,
    switchToHttp: () => ({
      getRequest: () => ({ method: "PATCH", path: "/api/v2/workspaces/users/u1/role" }),
    }),
  } as ExecutionContext;
}

/**
 * Simulates JWT context after owner revoked admin membership in DB while the bearer token
 * remains unexpired (caps claim + Admin role still present on the token).
 */
function createEvictedAdminRequestContext(): RequestContextService {
  return {
    getRole: () => UserRole.Admin,
    tryGetRole: () => UserRole.Admin,
    getUserId: () => ADMIN_USER,
    tryGetUserId: () => ADMIN_USER,
    getTenantId: () => TENANT_ID,
    tryGetJwtCapabilitySnapshot: () => ["module.finance", "tour.update.tripDetails"],
    tryGetWorkspaceMembershipStatus: () => "SUSPENDED",
    tryGetWorkspaceCapabilities: () => [],
    tryGetAbilityLabels: () => [],
    tryGetTenantEnabledModules: () => ["finance", "form_builder"],
    tryGetMembershipMetadata: () => null,
  } as unknown as RequestContextService;
}

class EvictedAdminController {
  @RequireCapability("module.finance")
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "UserMembership"))
  patchUserRole() {
    return { ok: true };
  }
}

const SERVER_DRAFT_V5: DraftSnapshot = {
  data: {
    form: {
      basicInfo: { title: "Server baseline", tourType: "HIKE" },
      timing: { startDate: "2026-06-01" },
    },
    currentStepIndex: 2,
    railLayoutVersion: 2,
    registryLayoutVersion: 2,
  },
  version: 5,
  schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
  lastModified: 5_000,
};

const OPERATOR_A_CLIENT_V2: DraftSnapshot = {
  data: {
    form: {
      basicInfo: { title: "Operator A title" },
      timing: { endDate: "2026-06-15" },
    },
    currentStepIndex: 3,
    railLayoutVersion: 3,
    registryLayoutVersion: 1,
  },
  version: 2,
  schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
  lastModified: 6_000,
};

const OPERATOR_B_CLIENT_V2: DraftSnapshot = {
  data: {
    form: {
      basicInfo: { title: "Operator B title" },
      notes: { internal: "operator-b-notes" },
    },
    currentStepIndex: 4,
    railLayoutVersion: 1,
    registryLayoutVersion: 4,
  },
  version: 2,
  schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
  lastModified: 5_500,
};

test("Angle 4: Live Admin Eviction and Token Drift Verification", async (t) => {
  await t.test(
    "CapabilityGuard passes stale JWT caps while AbilitiesGuard rejects live SUSPENDED eviction",
    () => {
      const handler = EvictedAdminController.prototype.patchUserRole;
      const reflector = new Reflector();
      const requestContext = createEvictedAdminRequestContext();
      const executionContext = mockExecutionContext(handler);

      const capabilityGuard = new CapabilityGuard(reflector, requestContext);
      assert.equal(capabilityGuard.canActivate(executionContext), true);

      const abilitiesGuard = new AbilitiesGuard(
        reflector,
        new WorkspaceAbilityFactoryService(requestContext),
        requestContext,
        {
          info: () => undefined,
          warn: () => undefined,
          debug: () => undefined,
          error: () => undefined,
        } as unknown as LoggerService,
      );

      assert.throws(
        () => abilitiesGuard.canActivate(executionContext),
        (error: unknown) => {
          if (!(error instanceof ForbiddenException)) {
            return false;
          }
          const body = error.getResponse() as { error?: { code?: string } };
          assert.equal(body.error?.code, "AUTH_FORBIDDEN_ABILITY");
          assert.equal(error.getStatus(), 403);
          return true;
        },
      );
    },
  );
});

test("Angle 5: Complex 3-Way Merge Collision Matrix on Draft Engine", async (t) => {
  const resolver = new DefaultDraftConflictResolver();

  await t.test("DraftConflictResolverPort applies LWW and envelope version rules for operator A vs server v5", () => {
    const mergeResult = resolver.resolveMergeConflict(OPERATOR_A_CLIENT_V2, SERVER_DRAFT_V5);

    assert.equal(mergeResult.merged.version, 5);
    assert.equal(mergeResult.hadConflicts, true);

    const mergedData = mergeResult.merged.data as {
      currentStepIndex: number;
      railLayoutVersion: number;
      registryLayoutVersion: number;
      form: {
        basicInfo: { title: string; tourType: string };
        timing: { startDate: string; endDate: string };
      };
    };

    assert.equal(mergedData.currentStepIndex, 3);
    assert.equal(mergedData.railLayoutVersion, 3);
    assert.equal(mergedData.registryLayoutVersion, 2);
    assert.equal(mergedData.form.basicInfo.title, "Operator A title");
    assert.equal(mergedData.form.basicInfo.tourType, undefined);
    assert.equal(mergedData.form.timing.startDate, undefined);
    assert.equal(mergedData.form.timing.endDate, "2026-06-15");

    const titleConflict = mergeResult.conflicts.find((c) => c.path === "data.form.basicInfo");
    assert.ok(titleConflict);
    assert.equal(titleConflict.resolution, "client");
  });

  await t.test("deterministic merge matrix resolves operator B leaf conflicts with lastModified LWW", () => {
    const mergeResult = deterministicDraftMerge(OPERATOR_B_CLIENT_V2, SERVER_DRAFT_V5);
    const mergedData = mergeResult.merged.data as {
      currentStepIndex: number;
      form: { basicInfo: { title: string }; notes: { internal: string } };
    };

    assert.equal(mergeResult.merged.version, 5);
    assert.equal(mergedData.currentStepIndex, 4);
    assert.equal(mergedData.form.basicInfo.title, "Operator B title");
    assert.equal(mergedData.form.notes.internal, "operator-b-notes");
  });

  await t.test("resolveConflictForMember persists consolidated snapshot at guard version 6", async () => {
    const store = new ConcurrentDraftStore(SERVER_DRAFT_V5);
    const facade = createDraftFacade(store);

    const saved = await facade.resolveConflictForMember(WORKSPACE_ID, "denali-create", {
      data: OPERATOR_A_CLIENT_V2.data,
      version: OPERATOR_A_CLIENT_V2.version,
      schemaVersion: OPERATOR_A_CLIENT_V2.schemaVersion,
      lastModified: OPERATOR_A_CLIENT_V2.lastModified,
    });

    assert.equal(saved.version, 6);
    assert.equal(
      (saved.data as { form: { basicInfo: { title: string } } }).form.basicInfo.title,
      "Operator A title",
    );
    assert.equal((saved.data as { currentStepIndex: number }).currentStepIndex, 3);

    const persisted = store.getSnapshot();
    assert.ok(persisted);
    assert.equal(persisted.version, 6);
  });

  await t.test(
    "two operators submitting stale v2 payloads simultaneously do not crash and leave a safe snapshot",
    async () => {
      const store = new ConcurrentDraftStore(SERVER_DRAFT_V5);
      const facade = createDraftFacade(store);

      const outcomes = await Promise.allSettled([
        facade.resolveConflictForMember(WORKSPACE_ID, "denali-create", {
          data: OPERATOR_A_CLIENT_V2.data,
          version: OPERATOR_A_CLIENT_V2.version,
          schemaVersion: OPERATOR_A_CLIENT_V2.schemaVersion,
          lastModified: OPERATOR_A_CLIENT_V2.lastModified,
        }),
        facade.resolveConflictForMember(WORKSPACE_ID, "denali-create", {
          data: OPERATOR_B_CLIENT_V2.data,
          version: OPERATOR_B_CLIENT_V2.version,
          schemaVersion: OPERATOR_B_CLIENT_V2.schemaVersion,
          lastModified: OPERATOR_B_CLIENT_V2.lastModified,
        }),
      ]);

      const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
      const rejected = outcomes.filter((o) => o.status === "rejected");

      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      assert.ok(fulfilled[0]?.status === "fulfilled" && fulfilled[0].value.version === 6);
      assert.ok(
        rejected[0]?.status === "rejected" &&
          rejected[0].reason instanceof DraftConflictException,
      );

      const finalSnapshot = store.getSnapshot();
      assert.ok(finalSnapshot);
      assert.equal(finalSnapshot.version, 6);
      assert.ok(
        ["Operator A title", "Operator B title"].includes(
          (finalSnapshot.data as { form: { basicInfo: { title: string } } }).form.basicInfo.title,
        ),
      );
    },
  );
});
