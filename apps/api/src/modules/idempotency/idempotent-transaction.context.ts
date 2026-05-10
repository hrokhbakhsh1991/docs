import { AsyncLocalStorage } from "node:async_hooks";
import type { EntityManager } from "typeorm";

/**
 * Binds the TypeORM {@link EntityManager} from {@link IdempotencyService.executeWithIdempotency}
 * for the duration of the idempotent handler (controller → service → save).
 * When set, {@link ToursService} uses repositories from this manager so tour rows and
 * idempotency keys commit in one PostgreSQL transaction.
 */
const idempotentManagerStorage = new AsyncLocalStorage<EntityManager>();

export function runWithIdempotentEntityManager<T>(
  manager: EntityManager,
  fn: () => T | Promise<T>
): Promise<T> {
  return idempotentManagerStorage.run(manager, async () => await Promise.resolve(fn()));
}

/** Returns the transactional EntityManager when inside {@link runWithIdempotentEntityManager}, else `undefined`. */
export function getIdempotentEntityManager(): EntityManager | undefined {
  return idempotentManagerStorage.getStore();
}
