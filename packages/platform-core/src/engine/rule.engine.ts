import { getWorkspaceRuleCell, type WorkspaceRuleSet } from "@app-tour/workspace-sdk/registry";

import { PlatformCoreError } from "../errors/platform-core.error";
import {
  platformFail,
  platformOk,
  unwrapPlatformResult,
  type PlatformResult,
} from "../errors/platform-result";
import type { RuleContextResolution } from "../types/rule-context-resolution";
import { normalizeRuleContext } from "../utils/rule-context";
import { buildRuleContextScopeKey } from "../utils/rule-context-scope-key";
import { FieldRegistryEngine } from "./field-registry.engine";
import { RuleEngineScope } from "./rule-engine.scope";
import { RuleCellIndex } from "./rule-cell-index";
import {
  DEFAULT_RULE_ENGINE_SCOPE_POLICY,
  type RuleEngineScopePolicy,
} from "./rule-engine-scope-policy";

const MAX_SCOPE_CACHE_SIZE = 64;
const DEFAULT_MAX_TENANT_PARTITIONS = 128;

function readMaxTenantPartitions(): number {
  const raw = process.env.RULE_ENGINE_MAX_TENANT_PARTITIONS?.trim();
  if (raw === undefined || raw === "") {
    return DEFAULT_MAX_TENANT_PARTITIONS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_MAX_TENANT_PARTITIONS;
  }
  return parsed;
}

const MAX_TENANT_PARTITIONS = readMaxTenantPartitions();

export class RuleEngine {
  private readonly cellIndex: RuleCellIndex;
  private readonly scopeCacheByTenant = new Map<string, Map<string, RuleEngineScope>>();

  private constructor(
    private readonly ruleSet: WorkspaceRuleSet,
    private readonly fieldEngine: FieldRegistryEngine,
    private readonly scopePolicy: RuleEngineScopePolicy
  ) {
    this.cellIndex = new RuleCellIndex(ruleSet);
  }

  /**
   * Bootstrap: `defaultCellId` must exist in `ruleSet.cells`. Runtime resolution does not
   * silently fall back to it — unmatched dimensions → `RULE_CONTEXT_UNMATCHED` (see 1.3-rule-engine.md).
   */
  static tryCreate(
    ruleSet: WorkspaceRuleSet,
    fieldEngine: FieldRegistryEngine,
    scopePolicy: RuleEngineScopePolicy = DEFAULT_RULE_ENGINE_SCOPE_POLICY
  ): PlatformResult<RuleEngine> {
    if (!getWorkspaceRuleCell(ruleSet, ruleSet.defaultCellId)) {
      return platformFail(
        "INVALID_RULE_SET",
        `defaultCellId "${ruleSet.defaultCellId}" is not in ruleSet.cells`
      );
    }

    const overrideFieldIds = ruleSet.cells.flatMap((cell) =>
      cell.fieldOverrides.map((override) => override.fieldId)
    );
    const known = fieldEngine.tryAssertKnownFieldIds(overrideFieldIds);
    if (!known.ok) {
      return known;
    }

    try {
      return platformOk(new RuleEngine(ruleSet, fieldEngine, scopePolicy));
    } catch (error: unknown) {
      if (error instanceof PlatformCoreError) {
        return platformFail(error.code, error.message, error.details);
      }
      throw error;
    }
  }

  static create(
    ruleSet: WorkspaceRuleSet,
    fieldEngine: FieldRegistryEngine,
    scopePolicy?: RuleEngineScopePolicy
  ): RuleEngine {
    return unwrapPlatformResult(RuleEngine.tryCreate(ruleSet, fieldEngine, scopePolicy));
  }

  createScope(context: RuleContextResolution): RuleEngineScope {
    return this.scopeFor(context);
  }

  private tenantScopeCache(tenantId: string): Map<string, RuleEngineScope> {
    const existing = this.scopeCacheByTenant.get(tenantId);
    if (existing != null) {
      this.scopeCacheByTenant.delete(tenantId);
      this.scopeCacheByTenant.set(tenantId, existing);
      return existing;
    }

    if (this.scopeCacheByTenant.size >= MAX_TENANT_PARTITIONS) {
      const oldestTenant = this.scopeCacheByTenant.keys().next().value;
      if (oldestTenant != null) {
        this.scopeCacheByTenant.delete(oldestTenant);
      }
    }

    const tenantCache = new Map<string, RuleEngineScope>();
    this.scopeCacheByTenant.set(tenantId, tenantCache);
    return tenantCache;
  }

  private scopeFor(context: RuleContextResolution): RuleEngineScope {
    const normalized = normalizeRuleContext(context);
    const scopeKey = buildRuleContextScopeKey(normalized, this.ruleSet.matrixDimensions);
    const tenantId = normalized.tenantId;

    const tenantCache = this.tenantScopeCache(tenantId);

    const cached = tenantCache.get(scopeKey);
    if (cached != null) {
      tenantCache.delete(scopeKey);
      tenantCache.set(scopeKey, cached);
      return cached;
    }

    const scope = new RuleEngineScope(
      this.ruleSet,
      this.fieldEngine,
      this.cellIndex,
      normalized,
      this.scopePolicy
    );
    if (tenantCache.size >= MAX_SCOPE_CACHE_SIZE) {
      const oldest = tenantCache.keys().next().value;
      if (oldest != null) {
        tenantCache.delete(oldest);
      }
    }
    tenantCache.set(scopeKey, scope);
    return scope;
  }
}
