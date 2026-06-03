/**
 * Per-call resolution input — **not** stored on the engine.
 * Every `buildRenderPlan` / `validateCanonical` must pass a full context (no implicit session).
 */
export interface RuleContext {
  /** Non-empty tenant/workspace isolation boundary (required for cache keying and LRU scopes). */
  readonly tenantId: string;
  /** Only keys declared in `ruleSet.matrixDimensions`; unknown keys → `INVALID_RULE_CONTEXT`. */
  readonly dimensions: Readonly<Record<string, string>>;
}
