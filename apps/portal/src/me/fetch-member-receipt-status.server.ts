import { cookies } from "next/headers";

import {
  parseMemberReceiptStatus,
  type MemberReceiptStatus,
} from "@/me/member-receipt-status";

export type { MemberReceiptStatus };

type ReceiptStatusBffResponse = {
  readonly ok?: boolean;
  readonly status?: MemberReceiptStatus;
};

/** SSR helper — same cookie forwarding as fetchMemberRegistrations. */
export async function fetchMemberReceiptStatus(
  host: string,
  registrationId: string
): Promise<MemberReceiptStatus> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");
  if (cookieHeader.length === 0) {
    return "none";
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
    return "none";
  }

  if (!res.ok) {
    return "none";
  }

  const payload = (await res.json()) as ReceiptStatusBffResponse;
  if (payload.ok !== true) {
    return "none";
  }
  return parseMemberReceiptStatus(payload.status);
}
