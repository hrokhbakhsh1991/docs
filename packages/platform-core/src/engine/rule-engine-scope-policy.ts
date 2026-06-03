/**
 * Injectable scope policy for rule resolution (tests may allow forceCellId).
 * Production uses the default — forceCellId is always denied.
 */
export type RuleEngineScopePolicy = {
  readonly allowForceCellId?: boolean;
};

export const DEFAULT_RULE_ENGINE_SCOPE_POLICY: RuleEngineScopePolicy = Object.freeze({});
