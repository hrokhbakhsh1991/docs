import { cookies } from "next/headers";

import { resolvePortalSelfFetchOrigin } from "./resolve-portal-self-fetch-origin";

import type { MemberRegistrationItem } from "@/me/fetch-member-registrations.server";

type MemberRegistrationDetailBffResponse = {
  readonly ok?: boolean;
  readonly data?: MemberRegistrationItem;
};

/** SSR — owned registration by id (not mine-list scan). Preserves paymentDueAt from upstream. */
export async function fetchMemberRegistrationById(
  host: string,
  registrationId: string
): Promise<MemberRegistrationItem | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");
  if (cookieHeader.length === 0) {
    return null;
  }

  const { origin, ingressHost } = resolvePortalSelfFetchOrigin(host);
  try {
    const res = await fetch(
      `${origin}/api/me/registrations/${encodeURIComponent(registrationId)}`,
      {
        method: "GET",
        headers: {
          cookie: cookieHeader,
          "x-forwarded-host": ingressHost,
        },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      return null;
    }
    const payload = (await res.json()) as MemberRegistrationDetailBffResponse;
    if (payload.ok !== true || payload.data === undefined) {
      return null;
    }
    const row = payload.data;
    if (typeof row.paymentDueAt === "string" && row.paymentDueAt.length > 0) {
      return { ...row, paymentDueAt: row.paymentDueAt };
    }
    return row;
  } catch {
    return null;
  }
}
