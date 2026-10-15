import { proxyIntegrationsApiGet } from "@/integrations/proxy-integrations-api.server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  return proxyIntegrationsApiGet(
    req,
    `/integrations/${encodeURIComponent(id)}/telegram/diagnostics`
  );
}
