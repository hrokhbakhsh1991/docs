import { NextResponse } from "next/server";

import { buildIdentityBffHeadersAsync } from "@/auth/identity-bff-headers";
import { mapOperatorAuthBffCatchError } from "@/auth/operator-auth-bff-error";
import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

export async function GET(req: Request): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  let backendRes: Response;
  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    backendRes = await fetch(`${apiBase}/auth/ability-context`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        ...(await buildIdentityBffHeadersAsync(req)),
      },
    });
  } catch (error) {
    return mapOperatorAuthBffCatchError(error);
  }

  const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!backendRes.ok) {
    return NextResponse.json(payload, { status: backendRes.status });
  }

  return NextResponse.json(payload, { status: 200 });
}
