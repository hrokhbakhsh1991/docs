import {
  getWorkspaceRuleCell,
  type WorkspaceRuleSet,
} from "@app-tour/workspace-sdk/registry";

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

export class RuleEngine {
  private readonly cellIndex: RuleCellIndex;
  private readonly scopeCacheByTenant = new Map<string, Map<string, RuleEngineScope>>();

  private constructor(
    private readonly ruleSet: WorkspaceRuleSet,
    private readonly fieldEngine: FieldRegistryEngine,
    private readonly scopePolicy: RuleEngineScopePolicy,
  ) {
    this.cellIndex = new RuleCellIndex(ruleSet);
  }

  static tryCreate(
    ruleSet: WorkspaceRuleSet,
    fieldEngine: FieldRegistryEngine,
    scopePolicy: RuleEngineScopePolicy = DEFAULT_RULE_ENGINE_SCOPE_POLICY,
  ): PlatformResult<RuleEngine> {
    if (!getWorkspaceRuleCell(ruleSet, ruleSet.defaultCellId)) {
      return platformFail(
        "INVALID_RULE_SET",
        `defaultCellId "${ruleSet.defaultCellId}" is not in ruleSet.cells`,
      );
    }

    const overrideFieldIds = ruleSet.cells.flatMap((cell) =>
      cell.fieldOverrides.map((override) => override.fieldId),
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
    scopePolicy?: RuleEngineScopePolicy,
  ): RuleEngine {
    return unwrapPlatformResult(RuleEngine.tryCreate(ruleSet, fieldEngine, scopePolicy));
  }

  createScope(context: RuleContextResolution): RuleEngineScope {
    return this.scopeFor(context);
  }

  private scopeFor(context: RuleContextResolution): RuleEngineScope {
    const normalized = normalizeRuleContext(context);
    const scopeKey = buildRuleContextScopeKey(normalized, this.ruleSet.matrixDimensions);
    const tenantId = normalized.tenantId;

    let tenantCache = this.scopeCacheByTenant.get(tenantId);
    if (tenantCache == null) {
      tenantCache = new Map<string, RuleEngineScope>();
      this.scopeCacheByTenant.set(tenantId, tenantCache);
    }

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
      this.scopePolicy,
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
