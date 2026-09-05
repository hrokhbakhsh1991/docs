import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolveTourOpsApiBaseUrl } from "@/env";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

export type MemberTourExecutionSummary = {
  readonly tourId: string;
  readonly state: string;
  readonly scheduledMeetingAt: string | null;
  readonly meetingLocation: string | null;
  readonly registrationId: string;
  readonly guestLabel: string;
  readonly paymentStatus: string;
  readonly insuranceStatus: string | null;
  readonly attendanceStatus: string | null;
  readonly tourLeaderDisplayName: string | null;
};

export async function fetchMemberTourExecutionSummary(
  host: string,
  tourId: string,
): Promise<MemberTourExecutionSummary | null> {
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return null;
  }
  const trimmedTourId = tourId.trim();
  if (trimmedTourId.length === 0) {
    return null;
  }
  const res = await fetch(
    `${resolveTourOpsApiBaseUrl()}/member/tours/${encodeURIComponent(trimmedTourId)}/execution-summary`,
    {
      method: "GET",
      headers,
      cache: "no-store",
    },
  );
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    return null;
  }
  const payload = (await res.json().catch(() => null)) as MemberTourExecutionSummary | null;
  if (payload === null || typeof payload.state !== "string") {
    return null;
  }
  void bootstrap;
  return payload;
}
