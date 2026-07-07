import { proxyIntegrationsApiGet } from "@/integrations/proxy-integrations-api.server";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const connectionId = url.searchParams.get("connectionId") ?? "";
  const eventType = url.searchParams.get("eventType") ?? "";
  const query = new URLSearchParams({ connectionId, eventType });

  return proxyIntegrationsApiGet(req, `/exposure/engine-preview?${query.toString()}`);
}
