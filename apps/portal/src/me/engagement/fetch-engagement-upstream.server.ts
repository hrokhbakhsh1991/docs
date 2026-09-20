import { resolveTourOpsApiBaseUrl } from "@/env";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";

export async function fetchEngagementUpstream(
  host: string,
  path: string,
  query?: Record<string, string>,
): Promise<Response> {
  const headers = await buildMemberApiHeaders(host);
  const ingressHost = host.split(":")[0] ?? host;
  const url = new URL(`${resolveTourOpsApiBaseUrl()}${path}`);
  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }
  return fetch(url, {
    method: "GET",
    headers: {
      ...headers,
      host: ingressHost,
    },
    cache: "no-store",
  });
}
