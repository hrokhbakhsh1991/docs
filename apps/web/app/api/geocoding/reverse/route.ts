import { NextResponse } from "next/server";

import { reverseGeocode } from "@/lib/geocoding/geocoding-search";
import { clientIpFromRequest } from "@/lib/rate-limit/client-ip-from-request";
import { checkSlidingWindowRateLimit } from "@/lib/rate-limit/sliding-window-per-key";

const GEOCODING_RATE_LIMIT = 30;
const GEOCODING_RATE_WINDOW_MS = 60_000;

/** BFF reverse geocoding — coordinates to human-readable address. */
export async function GET(req: Request): Promise<NextResponse> {
  const ip = clientIpFromRequest(req);
  const rate = checkSlidingWindowRateLimit(`geocoding-reverse:${ip}`, {
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
        address: null,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      }
    );
  }

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ address: null });
  }

  const address = await reverseGeocode(lat, lon);
  return NextResponse.json({ address });
}
