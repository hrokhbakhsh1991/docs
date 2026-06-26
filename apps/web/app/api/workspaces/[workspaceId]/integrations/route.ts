import {
  proxyIntegrationsApiGet,
  proxyIntegrationsApiPost,
} from "@/integrations/proxy-integrations-api.server";

export async function GET(
  req: Request,
  context: { params: Promise<{ workspaceId: string }> }
): Promise<Response> {
  const { workspaceId } = await context.params;
  return proxyIntegrationsApiGet(
    req,
    `/workspaces/${encodeURIComponent(workspaceId)}/integrations`
  );
}

export async function POST(
  req: Request,
  context: { params: Promise<{ workspaceId: string }> }
): Promise<Response> {
  const { workspaceId } = await context.params;
  const body = await req.text();
  return proxyIntegrationsApiPost(
    req,
    `/workspaces/${encodeURIComponent(workspaceId)}/integrations`,
    body
  );
}
