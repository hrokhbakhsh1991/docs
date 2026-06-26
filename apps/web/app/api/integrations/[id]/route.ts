import {
  proxyIntegrationsApiDelete,
  proxyIntegrationsApiGet,
  proxyIntegrationsApiPatch,
} from "@/integrations/proxy-integrations-api.server";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;
  return proxyIntegrationsApiGet(req, `/integrations/${encodeURIComponent(id)}`);
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;
  const body = await req.text();
  return proxyIntegrationsApiPatch(req, `/integrations/${encodeURIComponent(id)}`, body);
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;
  return proxyIntegrationsApiDelete(req, `/integrations/${encodeURIComponent(id)}`);
}
