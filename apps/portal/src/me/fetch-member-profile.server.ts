import { cookies } from "next/headers";

import type { MemberProfileViewPayload } from "./member-profile-types";

export async function fetchMemberProfile(host: string): Promise<MemberProfileViewPayload | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");
  if (cookieHeader.length === 0) {
    return null;
  }

  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  let res: Response;
  try {
    res = await fetch(`${protocol}://${host}/api/me/profile`, {
      method: "GET",
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!res.ok) {
    return null;
  }

  const payload = (await res.json()) as MemberProfileViewPayload;
  if (payload.ok !== true) {
    return null;
  }

  return payload;
}
