import { parseMultiLevelTenantHost, tryParseCustomApexHost } from "@app-tour/tenant-kernel";
import { NextRequest, NextResponse } from "next/server";

import { resolveOperatorAdminRootRedirect } from "@/admin/resolve-operator-admin-root-redirect";
import { resolveRequestHost } from "@/auth/resolve-request-host";
import { isOperatorAdminHost } from "@/tenant/operator-admin-host";
import {
  normalizeHostHeader,
  readPlatformRootDomainWeb,
  readWebReservedHostLabels,
} from "@/tenant/platform-host-env";

/**
 * Temporary ingress debug — remove after host classification is confirmed on VPS.
 * Compares BFF host resolution vs middleware (Host header only).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
  }

  const rawHost = request.headers.get("host");
  const rawForwardedHost = request.headers.get("x-forwarded-host");

  const middlewareHost = rawHost ?? request.nextUrl.host ?? "";
  const detectedHost = resolveRequestHost(request);
  const platformRootDomain = readPlatformRootDomainWeb();
  const reservedLabels = readWebReservedHostLabels();

  const normalizedDetectedHost = normalizeHostHeader(detectedHost);
  const normalizedMiddlewareHost = normalizeHostHeader(middlewareHost);

  const parseOutcome = parseMultiLevelTenantHost(
    normalizedDetectedHost,
    platformRootDomain,
    reservedLabels
  );

  const middlewareParseOutcome = parseMultiLevelTenantHost(
    normalizedMiddlewareHost,
    platformRootDomain,
    reservedLabels
  );

  return NextResponse.json({
    headers: {
      host: rawHost,
      xForwardedHost: rawForwardedHost,
    },
    detectedHost,
    middlewareHost,
    normalizedDetectedHost,
    normalizedMiddlewareHost,
    platformRootDomain,
    reservedLabels: [...reservedLabels],
    parseOutcome,
    middlewareParseOutcome,
    customApex: tryParseCustomApexHost(normalizedDetectedHost, platformRootDomain, reservedLabels),
    isOperatorAdminHost: isOperatorAdminHost(detectedHost),
    isOperatorAdminHostMiddlewareStyle: isOperatorAdminHost(middlewareHost),
    operatorAdminRootRedirect: resolveOperatorAdminRootRedirect({
      pathname: "/",
      host: middlewareHost,
    }),
  });
}
