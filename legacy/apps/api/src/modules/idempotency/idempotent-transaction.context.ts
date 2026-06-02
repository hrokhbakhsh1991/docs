import { AsyncLocalStorage } from "node:async_hooks";
import type { EntityManager } from "typeorm";

export type IdempotentEntityManagerScope = {
  manager: EntityManager;
  /** HTTP `Idempotency-Key` when the request was wrapped by {@link IdempotencyInterceptor}. */
  idempotencyKey?: string;
};

/**
 * Binds the TypeORM {@link EntityManager} from {@link IdempotencyService.executeWithIdempotency}
 * for the duration of the idempotent handler (controller → service → save).
 * When set, {@link ToursService} uses repositories from this manager so tour rows and
 * idempotency keys commit in one PostgreSQL transaction.
 */
const idempotentManagerStorage = new AsyncLocalStorage<IdempotentEntityManagerScope>();

export function runWithIdempotentEntityManager<T>(
  manager: EntityManager,
  fn: () => T | Promise<T>,
  scope?: { idempotencyKey?: string }
): Promise<T> {
  return idempotentManagerStorage.run(
    { manager, idempotencyKey: scope?.idempotencyKey },
    async () => await Promise.resolve(fn())
  );
}

/** Returns the transactional EntityManager when inside {@link runWithIdempotentEntityManager}, else `undefined`. */
export function getIdempotentEntityManager(): EntityManager | undefined {
  return idempotentManagerStorage.getStore()?.manager;
}

/** HTTP idempotency key for the active financial / idempotent request, when provided by the interceptor. */
export function getFinancialIdempotencyKeyFromContext(): string | undefined {
  const key = idempotentManagerStorage.getStore()?.idempotencyKey;
  if (typeof key !== "string") {
    return undefined;
  }
  const t = key.trim();
  return t.length > 0 ? t : undefined;
}
