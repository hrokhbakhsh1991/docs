import { NextResponse } from "next/server";

import { clientIpFromRequest } from "@/lib/rate-limit/client-ip-from-request";
import { checkSlidingWindowRateLimit } from "@/lib/rate-limit/sliding-window-per-key";
import { searchGeocodingWithFallback } from "@/lib/geocoding/geocoding-search";

const GEOCODING_RATE_LIMIT = 30;
const GEOCODING_RATE_WINDOW_MS = 60_000;

/** BFF geocoding proxy — local mountain dictionary + multi-provider fallback (Neshan/Map.ir → Nominatim). */
export async function GET(req: Request): Promise<NextResponse> {
  const ip = clientIpFromRequest(req);
  const rate = checkSlidingWindowRateLimit(`geocoding:${ip}`, {
    limit: GEOCODING_RATE_LIMIT,
    windowMs: GEOCODING_RATE_WINDOW_MS,
  });

  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "GEOCODING_RATE_LIMITED",
          message: "Too many geocoding requests. Please wait before searching again.",
        },
        results: [],
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      },
    );
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchGeocodingWithFallback(q, { limit: 6 });
  return NextResponse.json({ results });
}
