import { cookies } from "next/headers";

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

  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  let res: Response;
  try {
    res = await fetch(
      `${protocol}://${host}/api/me/registrations/${encodeURIComponent(registrationId)}/receipt`,
      {
        method: "GET",
        headers: { cookie: cookieHeader },
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
