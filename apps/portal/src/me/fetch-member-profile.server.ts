import { cache } from "react";

import { fetchMemberProfileUpstreamForHost } from "./fetch-member-profile-from-session.server";
import type { MemberProfileFetchResult } from "./member-profile-types";

export type { MemberProfileFetchResult } from "./member-profile-types";

/** PCMS-SEC-03 — `/me/*` SSR profile load via cookie-safe upstream (no loopback BFF self-fetch). */
export const fetchMemberProfile = cache(async function fetchMemberProfile(
  host: string
): Promise<MemberProfileFetchResult> {
  return fetchMemberProfileUpstreamForHost(host);
});
