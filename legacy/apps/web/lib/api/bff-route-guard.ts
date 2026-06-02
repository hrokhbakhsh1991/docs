import { NextResponse } from "next/server";

import { readSessionToken } from "@/lib/api/bff-proxy";

export function requireBffSession(): NextResponse | null {
  if (!readSessionToken()) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  return null;
}
