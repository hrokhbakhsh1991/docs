import { proxyIntegrationsApiGet } from "@/integrations/proxy-integrations-api.server";
import { proxyIntegrationsApiPatch } from "@/integrations/proxy-integrations-api.server";

export async function GET(
  req: Request,
  context: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
  const { workspaceId } = await context.params;
  return proxyIntegrationsApiGet(
    req,
    `/workspaces/${encodeURIComponent(workspaceId)}/exposure/surfaces`,
  );
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ workspaceId: string; surfaceKey: string }> },
): Promise<Response> {
  const { workspaceId, surfaceKey } = await context.params;
  const body = await req.text();
  return proxyIntegrationsApiPatch(
    req,
    `/workspaces/${encodeURIComponent(workspaceId)}/exposure/surfaces/${encodeURIComponent(surfaceKey)}`,
    body,
  );
}
