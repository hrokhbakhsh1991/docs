import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

type ProxyInput = {
  readonly req: Request;
  readonly sessionToken: string;
  readonly tourId: string;
  readonly pathSuffix: string;
  readonly method: "GET" | "POST" | "PATCH" | "PUT";
  readonly body?: unknown;
};

export async function proxyTourExecutionRequest(input: ProxyInput): Promise<Response> {
  const apiBase = resolveTourOpsApiBaseUrl();
  const incoming = new URL(input.req.url);
  const backendRes = await operatorApiFetch(
    `${apiBase}/tours/${encodeURIComponent(input.tourId)}/execution${input.pathSuffix}`,
    {
      method: input.method,
      headers: {
        Authorization: `Bearer ${input.sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
        ...(input.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
      cache: "no-store",
    },
  );
  const payload = await backendRes.json().catch(() => ({}));
  return Response.json(payload, { status: backendRes.status });
}
