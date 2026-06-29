import { proxyIntegrationsApiPost } from "@/integrations/proxy-integrations-api.server";

export async function POST(req: Request): Promise<Response> {
  const body = await req.text();
  return proxyIntegrationsApiPost(req, "/exposure/diff", body);
}
