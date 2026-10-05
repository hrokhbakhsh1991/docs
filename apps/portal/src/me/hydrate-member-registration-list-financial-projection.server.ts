import type { MemberRegistrationItem } from "./fetch-member-registrations.server";
import { resolveMemberFinancialProjection } from "./resolve-member-financial-projection";

type FetchRegistrationDetail = (registrationId: string) => Promise<MemberRegistrationItem | null>;

/**
 * The list response is a read model and may contain a complete but stale
 * financial projection. Re-read every approved row from the owned detail
 * projection, which resolves all financial display fields from the current
 * canonical payment state. Pending/waitlisted rows do not have a final
 * financial state and stay one-shot.
 */
export async function hydrateMemberRegistrationListFinancialProjection(
  items: readonly MemberRegistrationItem[],
  fetchDetail: FetchRegistrationDetail
): Promise<MemberRegistrationItem[]> {
  const candidates = items.filter((item) => item.status === "approved");
  if (candidates.length === 0) {
    return [...items];
  }

  const details = await Promise.all(
    candidates.map(async (item) => [item.id, await fetchDetail(item.id)] as const)
  );
  const byId = new Map(details);

  return items.map((item) => {
    const detail = byId.get(item.id);
    if (detail === null || detail === undefined) {
      return item;
    }
    return {
      ...item,
      // Do not retain stale list values when detail explicitly clears them.
      ...resolveMemberFinancialProjection(detail),
    };
  });
}
