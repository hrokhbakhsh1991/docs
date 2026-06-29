import { proxyIntegrationsApiGet } from "@/integrations/proxy-integrations-api.server";

export async function GET(
  req: Request,
  context: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
  const { workspaceId } = await context.params;
  return proxyIntegrationsApiGet(
    req,
    `/workspaces/${encodeURIComponent(workspaceId)}/exposure/catalog`,
  );
}
