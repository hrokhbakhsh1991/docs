export interface FinanceMetricsPort {
  increment(
    name: string,
    labels?: Readonly<Record<string, string>>,
    amount?: number
  ): void;

  /** Optional gauge observe — host adapter implements; tests may no-op. */
  observe?(
    name: string,
    value: number,
    labels?: Readonly<Record<string, string>>
  ): void;
}
