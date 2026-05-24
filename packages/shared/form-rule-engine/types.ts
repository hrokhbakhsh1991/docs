import type { LookupQuery, LookupResult } from "./lookupRegistry";

export type RulePredicate<TForm extends Record<string, unknown>> = (ctx: {
  form: TForm;
  readPath: (path: string) => unknown;
}) => boolean;

/**
 * Declarative field rule: visibility, required, autocomplete lookup, and dependency wiring.
 * Consumed by {@link FormRuleEngine} — no React or DOM assumptions.
 */
export type RuleConfig<TForm extends Record<string, unknown> = Record<string, unknown>> = {
  /** Dot path on the form model (`basicInfo.destinationId`, …). */
  path: string;
  visible?: boolean | RulePredicate<TForm>;
  required?: boolean | RulePredicate<TForm>;
  /**
   * Key registered on {@link LookupRegistry} (e.g. `destination.search`).
   * When set, the engine can run autocomplete queries for this field.
   */
  lookupProvider?: string;
  /**
   * Other form paths whose value changes should invalidate / refetch this field's lookup.
   */
  dependencies?: readonly string[];
};

export type EvaluatedFieldRule = {
  path: string;
  visible: boolean;
  required: boolean;
  lookupProvider?: string;
  dependencies: readonly string[];
};

export type LookupFetchStatus = "idle" | "loading" | "success" | "error";

export type LookupFieldState<TItem = unknown> = {
  status: LookupFetchStatus;
  items: TItem[];
  error?: string;
  /** Monotonic id so async callers can ignore stale responses. */
  requestId: number;
  /** Serialized dependency values used for the in-flight / last successful fetch. */
  dependencySnapshot: string;
  searchText: string;
};

export type LookupStateListener<TItem = unknown> = (state: LookupFieldState<TItem>) => void;

export type { LookupQuery, LookupResult };
