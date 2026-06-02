import {
  getWorkspaceRuleCell,
  type WorkspaceRuleSet,
} from "@app-tour/workspace-sdk";

import { PlatformCoreError } from "../errors/platform-core.error";
import type { EffectiveFieldState } from "../types/effective-field-state";
import type { RuleContext } from "../types/rule-context";
import { normalizeRuleContext } from "../utils/rule-context";
import { buildRuleContextDimensionKey } from "../utils/rule-context-scope-key";
import { assertRuleContextTenantId } from "../utils/rule-context-tenant";
import { FieldRegistryEngine } from "./field-registry.engine";
import { RuleEngineScope } from "./rule-engine.scope";
import { RuleCellIndex } from "./rule-cell-index";

const MAX_SCOPE_CACHE_SIZE = 64;

export class RuleEngine {
  private readonly cellIndex: RuleCellIndex;
  /** Per-tenant LRU scope caches — eviction never crosses tenant boundaries. */
  private readonly scopeCacheByTenant = new Map<string, Map<string, RuleEngineScope>>();

  constructor(
    private readonly ruleSet: WorkspaceRuleSet,
    private readonly fieldEngine: FieldRegistryEngine,
  ) {
    if (!getWorkspaceRuleCell(ruleSet, ruleSet.defaultCellId)) {
      throw new PlatformCoreError(
        "INVALID_RULE_SET",
        `defaultCellId "${ruleSet.defaultCellId}" is not in ruleSet.cells`,
      );
    }

    const overrideFieldIds = ruleSet.cells.flatMap((cell) =>
      cell.fieldOverrides.map((override) => override.fieldId),
    );
    fieldEngine.assertKnownFieldIds(overrideFieldIds);
    this.cellIndex = new RuleCellIndex(ruleSet);
  }

  createScope(context: RuleContext): RuleEngineScope {
    return this.scopeFor(context);
  }

  resolveCellId(context: RuleContext): string {
    return this.scopeFor(context).resolveCellId();
  }

  resolveEffectiveField(fieldId: string, context: RuleContext): EffectiveFieldState {
    return this.scopeFor(context).resolveEffectiveField(fieldId);
  }

  listEffectiveFields(context: RuleContext): readonly EffectiveFieldState[] {
    const scope = this.scopeFor(context);
    return this.fieldEngine
      .listAll()
      .map((entry) => scope.resolveEffectiveField(entry.id))
      .filter((state) => !state.hidden);
  }

  private scopeFor(context: RuleContext): RuleEngineScope {
    const normalized = normalizeRuleContext(context);
    const tenantId = assertRuleContextTenantId(normalized);
    const dimensionKey = buildRuleContextDimensionKey(
      normalized,
      this.ruleSet.matrixDimensions,
    );

    let tenantCache = this.scopeCacheByTenant.get(tenantId);
    if (tenantCache == null) {
      tenantCache = new Map<string, RuleEngineScope>();
      this.scopeCacheByTenant.set(tenantId, tenantCache);
    }

    const cached = tenantCache.get(dimensionKey);
    if (cached != null) {
      tenantCache.delete(dimensionKey);
      tenantCache.set(dimensionKey, cached);
      return cached;
    }

    const scope = new RuleEngineScope(this.ruleSet, this.fieldEngine, this.cellIndex, normalized);
    if (tenantCache.size >= MAX_SCOPE_CACHE_SIZE) {
      const oldest = tenantCache.keys().next().value;
      if (oldest != null) {
        tenantCache.delete(oldest);
      }
    }
    tenantCache.set(dimensionKey, scope);
    return scope;
  }
}
