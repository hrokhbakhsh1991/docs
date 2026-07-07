import { proxyPlatformApi } from "@/platform/proxy-platform-api.server";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "1970-01-01T00:00:00.000Z";
  const to = url.searchParams.get("to") ?? "2099-12-31T23:59:59.999Z";
  const upstream = await proxyPlatformApi(
    req,
    `/platform/v1/audit/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  );
  const buffer = await upstream.arrayBuffer();
  const headers = new Headers();
  const cd = upstream.headers.get("content-disposition");
  const ct = upstream.headers.get("content-type");
  if (cd) headers.set("Content-Disposition", cd);
  headers.set("Content-Type", ct ?? "text/csv; charset=utf-8");
  return new Response(buffer, { status: upstream.status, headers });
}
