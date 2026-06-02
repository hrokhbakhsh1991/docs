/** TypeORM throws this when `@VersionColumn` / optimistic lock UPDATE matches zero rows. */
export function isOptimisticLockVersionMismatchError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "OptimisticLockVersionMismatchError"
  );
}
