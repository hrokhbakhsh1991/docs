export interface FinanceMetricsPort {
  increment(
    name: string,
    labels?: Readonly<Record<string, string>>,
    amount?: number
  ): void;
}
