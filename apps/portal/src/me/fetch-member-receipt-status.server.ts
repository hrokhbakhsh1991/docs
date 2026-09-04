import { cookies } from "next/headers";

import { resolvePortalSelfFetchOrigin } from "./resolve-portal-self-fetch-origin";

import {
  emptyMemberReceiptPanel,
  parseMemberReceiptPanel,
  type MemberReceiptPanel,
} from "@/me/member-receipt-status";

export type { MemberReceiptPanel };

/** SSR helper — same cookie forwarding as fetchMemberRegistrations. */
export async function fetchMemberReceiptPanel(
  host: string,
  registrationId: string
): Promise<MemberReceiptPanel> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");
  if (cookieHeader.length === 0) {
    return emptyMemberReceiptPanel();
  }

  const { origin, ingressHost } = resolvePortalSelfFetchOrigin(host);
  let res: Response;
  try {
    res = await fetch(
      `${origin}/api/me/registrations/${encodeURIComponent(registrationId)}/receipt`,
      {
        method: "GET",
        headers: {
          cookie: cookieHeader,
          "x-forwarded-host": ingressHost,
        },
        cache: "no-store",
      }
    );
  } catch {
    return emptyMemberReceiptPanel();
  }

  if (!res.ok) {
    return emptyMemberReceiptPanel();
  }

  const payload = (await res.json()) as { ok?: boolean } & Record<string, unknown>;
  if (payload.ok !== true) {
    return emptyMemberReceiptPanel();
  }
  return parseMemberReceiptPanel(payload);
}
