import { NextResponse } from "next/server";

import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { validateSessionToken } from "@/auth/validate-session-token";

export async function GET(req: Request): Promise<NextResponse> {
  const token = readSessionTokenFromRequest(req);
  const validation = await validateSessionToken(token);
  if (validation.status !== "valid") {
    return NextResponse.json(
      { ok: false, error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    user_id: validation.userId,
    tenant_id: validation.tenantId,
    role: validation.role ?? null,
    ...(validation.workspaceId !== undefined ? { workspace_id: validation.workspaceId } : {}),
  });
}
