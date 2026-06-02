export interface RuleContext {
  /** Non-empty tenant/workspace isolation boundary (required for cache keying). */
  readonly tenantId: string;
  readonly dimensions: Readonly<Record<string, string>>;
  /** Optional explicit cell — for tests */
  readonly forceCellId?: string;
}
