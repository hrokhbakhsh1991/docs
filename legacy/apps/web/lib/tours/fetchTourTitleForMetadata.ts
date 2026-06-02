import { headers } from "next/headers";

import { BFF } from "@/lib/api-paths";
import { readSessionToken } from "@/lib/api/bff-proxy";
import { SESSION_TOKEN_COOKIE } from "@/lib/auth/session-cookie";

/**
 * Best-effort tour title for `generateMetadata` on authenticated `/tours/[id]`.
 * Falls back to null when session or upstream is unavailable (client sets document title after load).
 */
export async function fetchTourTitleForMetadata(tourId: string): Promise<string | null> {
  const id = tourId.trim();
  if (!id) {
    return null;
  }

  const token = readSessionToken();
  if (!token) {
    return null;
  }

  const headerStore = headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (!host) {
    return null;
  }
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  try {
    const res = await fetch(`${protocol}://${host}${BFF.tour(id)}`, {
      headers: {
        cookie: `${SESSION_TOKEN_COOKIE}=${encodeURIComponent(token)}`,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as { title?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    return title.length > 0 ? title : null;
  } catch {
    return null;
  }
}
