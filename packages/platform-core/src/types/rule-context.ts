export interface RuleContext {
  readonly dimensions: Readonly<Record<string, string>>;
  /** Optional explicit cell — for tests */
  readonly forceCellId?: string;
}
