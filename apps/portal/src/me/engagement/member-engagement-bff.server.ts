import type { EngagementMemberSummaryHttpResponse } from "@app-tour/engagement-http-contracts";

import { fetchEngagementUpstream } from "./fetch-engagement-upstream.server";

export type MemberEngagementSummaryView = EngagementMemberSummaryHttpResponse & {
  readonly enabled: true;
};

export type MemberEngagementDisabledView = {
  readonly enabled: false;
};

export type MemberEngagementBffResult =
  | { readonly ok: true; readonly view: MemberEngagementSummaryView }
  | { readonly ok: false; readonly code: string; readonly status: number }
  | { readonly ok: true; readonly view: MemberEngagementDisabledView };

export async function fetchMemberEngagementSummary(host: string): Promise<MemberEngagementBffResult> {
  const response = await fetchEngagementUpstream(host, "/engagement/me/summary");
  if (response.status === 404 || response.status === 403) {
    return { ok: true, view: { enabled: false } };
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { code?: string };
    return {
      ok: false,
      code: payload.code ?? "ENGAGEMENT_FETCH_FAILED",
      status: response.status,
    };
  }
  const summary = (await response.json()) as EngagementMemberSummaryHttpResponse;
  return { ok: true, view: { ...summary, enabled: true } };
}
