import { NextResponse } from "next/server";

/**
 * Keep unknown portal API paths inside the API error contract.
 *
 * Without this fallback, an unmatched App Router API path can bubble into the
 * global error boundary and return an HTML 500 response. Existing concrete
 * routes take precedence over this catch-all route.
 */
export function GET(): NextResponse {
  return NextResponse.json(
    { ok: false, error: { code: "NOT_FOUND", message: "API route not found" } },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

export const POST = GET;
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
