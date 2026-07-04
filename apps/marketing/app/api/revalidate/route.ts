import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { buildMarketingCatalogCacheTag, buildMarketingSeoCacheTag } from "@/catalog/catalog-fetch-options";

export const dynamic = "force-dynamic";

type RevalidateBody = {
  readonly tenantId?: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.MARKETING_REVALIDATE_SECRET?.trim();
  if (secret === undefined || secret.length === 0) {
    return NextResponse.json({ error: "MARKETING_REVALIDATE_NOT_CONFIGURED" }, { status: 503 });
  }

  const provided = request.headers.get("x-marketing-revalidate-secret")?.trim();
  if (provided !== secret) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 401 });
  }

  let body: RevalidateBody;
  try {
    body = (await request.json()) as RevalidateBody;
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const tenantId = body.tenantId?.trim() ?? "";
  if (tenantId.length === 0) {
    return NextResponse.json({ error: "TENANT_ID_REQUIRED" }, { status: 400 });
  }

  const catalogTag = buildMarketingCatalogCacheTag(tenantId);
  const seoTag = buildMarketingSeoCacheTag(tenantId);
  revalidateTag(catalogTag);
  revalidateTag(seoTag);

  return NextResponse.json({ revalidated: true, tags: [catalogTag, seoTag] });
}
