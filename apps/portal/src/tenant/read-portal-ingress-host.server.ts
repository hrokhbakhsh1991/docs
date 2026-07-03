import { headers } from "next/headers";

import { resolvePortalIngressHostFromHeaders } from "./resolve-portal-ingress-host";

/** Server components — ingress host with reverse-proxy / custom-apex support. */
export async function readPortalIngressHost(fallback = "localhost:3003"): Promise<string> {
  const headerList = await headers();
  return resolvePortalIngressHostFromHeaders(headerList, fallback);
}
