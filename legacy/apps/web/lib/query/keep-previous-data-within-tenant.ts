import type { DefaultError, PlaceholderDataFunction, QueryKey } from "@tanstack/react-query";

/**
 * Like `keepPreviousData`, but drops prior rows when the active workspace tenant segment
 * is absent from the previous query key (prevents cross-tenant list flashes on switch).
 */
export function keepPreviousDataWithinTenant<
  TQueryFnData = unknown,
  TError = DefaultError,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  tenantId: string | null | undefined,
): PlaceholderDataFunction<TQueryFnData, TError, TQueryData, TQueryKey> {
  const scoped = tenantId?.trim() ?? "";
  return (previousData, previousQuery) => {
    if (!scoped || previousData === undefined || !previousQuery) {
      return undefined;
    }
    const key = previousQuery.queryKey;
    if (Array.isArray(key) && key.includes(scoped)) {
      return previousData;
    }
    return undefined;
  };
}
