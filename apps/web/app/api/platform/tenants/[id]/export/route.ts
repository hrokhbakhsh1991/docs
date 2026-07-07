import { proxyPlatformApi } from "@/platform/proxy-platform-api.server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const upstream = await proxyPlatformApi(req, `/platform/v1/tenants/${id}/export`, {
    method: "POST",
    body: "{}",
  });
  const buffer = await upstream.arrayBuffer();
  const headers = new Headers();
  const cd = upstream.headers.get("content-disposition");
  const ct = upstream.headers.get("content-type");
  if (cd) headers.set("Content-Disposition", cd);
  headers.set("Content-Type", ct ?? "application/zip");
  return new Response(buffer, { status: upstream.status, headers });
}
