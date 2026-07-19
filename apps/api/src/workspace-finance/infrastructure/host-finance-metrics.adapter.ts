import { metricsRegistry } from "../../observability/metrics";
import type { FinanceMetricsPort } from "../ports/finance-metrics.port";

/** Host adapter — forwards to the process metrics registry. */
export class HostFinanceMetricsAdapter implements FinanceMetricsPort {
  increment(
    name: string,
    labels?: Readonly<Record<string, string>>,
    amount = 1
  ): void {
    metricsRegistry.increment(name, labels, amount);
  }

  observe(
    name: string,
    value: number,
    labels?: Readonly<Record<string, string>>
  ): void {
    metricsRegistry.observe(name, value, labels);
  }
}
