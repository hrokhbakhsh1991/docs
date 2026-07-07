import { proxyIntegrationsApiPatch } from "@/integrations/proxy-integrations-api.server";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string; eventType: string }> },
): Promise<Response> {
  const { id, eventType } = await context.params;
  const body = await req.text();
  return proxyIntegrationsApiPatch(
    req,
    `/integrations/${encodeURIComponent(id)}/exposure-intents/${encodeURIComponent(eventType)}`,
    body,
  );
}
