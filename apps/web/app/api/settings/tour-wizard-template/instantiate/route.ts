import { NextResponse } from "next/server";

import { proxyBffPost, readSessionToken } from "@/lib/api/bff-proxy";

export async function POST(req: Request): Promise<NextResponse> {
  if (!readSessionToken()) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const seedDraft = url.searchParams.get("seedDraft");
  const query = seedDraft != null && seedDraft !== "" ? `?seedDraft=${encodeURIComponent(seedDraft)}` : "";

  return proxyBffPost(req, `/api/v2/settings/tour-wizard-template/instantiate${query}`);
}
