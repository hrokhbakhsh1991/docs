import { readValidationQueueDepthTotal } from "./validation-queue-monitor";

/** Sum of pending validation tasks across all tenants (SCAL-LIM / DEC-108). */
export function getTotalValidationQueueDepth(): number {
  return readValidationQueueDepthTotal();
}
