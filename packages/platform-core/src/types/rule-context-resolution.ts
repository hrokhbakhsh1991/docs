import type { RuleContext } from "./rule-context";

/** Internal resolution input — `forceCellId` is test-only; not on public {@link RuleContext}. */
export interface RuleContextResolution extends RuleContext {
  readonly forceCellId?: string;
}
