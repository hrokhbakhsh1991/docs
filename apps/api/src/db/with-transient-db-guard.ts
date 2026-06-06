import {
  assertDbCircuitClosed,
  recordDbTransientFailure,
  recordDbTransientSuccess,
} from "./db-circuit-breaker";
import { asTransientDbServiceUnavailableError, isTransientDbError } from "./transient-db-error";

/**
 * Circuit check + transient classification at idempotent outer boundaries (DEC-094).
 * Does not retry inside open transactions — classification only.
 */
export async function withTransientDbGuard<T>(run: () => Promise<T>): Promise<T> {
  assertDbCircuitClosed();
  try {
    const result = await run();
    recordDbTransientSuccess();
    return result;
  } catch (error) {
    if (isTransientDbError(error)) {
      recordDbTransientFailure();
      throw asTransientDbServiceUnavailableError(error);
    }
    throw error;
  }
}
