import http from "node:http";
import https from "node:https";
import { Readable } from "node:stream";

import {
  assertSafeOutboundUrl,
  parseAndValidateUrl,
  type SafeOutboundUrlAgent,
} from "./assert-safe-outbound-url";
import { EgressUrlForbiddenError } from "./egress-url-forbidden.error";

export type PinnedEgressRequestInit = RequestInit & {
  /** Validate and pin without dispatching HTTP (SSRF gate only). */
  egressCoupledValidateOnly?: boolean;
};

function pinnedEgressSignature(url: URL): string {
  return `${url.protocol}//${url.host}${url.pathname}${url.search}`;
}

function authoritativeHostHeader(pinned: SafeOutboundUrlAgent): string {
  const defaultPort = pinned.protocol === "https:" ? 443 : 80;
  return pinned.port === defaultPort ? pinned.hostname : `${pinned.hostname}:${pinned.port}`;
}

function assertAgentHijackingDetected(): never {
  throw new Error("EGRESS_AGENT_HIJACKING_DETECTED");
}

function assertRequestBoundToPinnedSnapshot(
  targetUrl: string,
  pinned: SafeOutboundUrlAgent,
  options?: PinnedEgressRequestInit,
): void {
  const reparsed = parseAndValidateUrl(targetUrl);
  if (pinnedEgressSignature(reparsed) !== pinnedEgressSignature(pinned.url)) {
    assertAgentHijackingDetected();
  }

  if (options?.headers) {
    const headers = new Headers(options.headers);
    for (const headerName of ["host", "Host", "HOST"] as const) {
      const suppliedHost = headers.get(headerName);
      if (suppliedHost && suppliedHost.toLowerCase() !== authoritativeHostHeader(pinned).toLowerCase()) {
        assertAgentHijackingDetected();
      }
    }
  }
}

function buildCoupledRequestHeaders(
  pinned: SafeOutboundUrlAgent,
  options?: PinnedEgressRequestInit,
): Record<string, string | string[]> {
  const headers = new Headers(options?.headers);
  headers.set("Host", authoritativeHostHeader(pinned));
  headers.delete("host");
  return Object.fromEntries(headers.entries());
}

async function readRequestBody(body: BodyInit | null | undefined): Promise<Buffer | undefined> {
  if (body === undefined || body === null) {
    return undefined;
  }
  if (typeof body === "string") {
    return Buffer.from(body);
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }
  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  }
  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  if (typeof body === "object" && body !== null && Symbol.asyncIterator in body) {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new EgressUrlForbiddenError("EGRESS_URL_UNSUPPORTED_REQUEST_BODY");
}

function executeCoupledHttpRequest(
  pinned: SafeOutboundUrlAgent,
  options?: PinnedEgressRequestInit,
): Promise<Response> {
  const requestPath = `${pinned.url.pathname}${pinned.url.search}`;
  const method = (options?.method ?? "GET").toUpperCase();
  const headers = buildCoupledRequestHeaders(pinned, options);
  const transport = pinned.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    void readRequestBody(options?.body)
      .then((payload) => {
        const request = transport.request(
          {
            protocol: pinned.protocol,
            hostname: pinned.hostname,
            port: pinned.port,
            path: requestPath,
            method,
            headers,
            agent: pinned.agent,
            signal: options?.signal ?? undefined,
          },
          (incoming) => {
            const responseChunks: Buffer[] = [];
            incoming.on("data", (chunk: Buffer) => responseChunks.push(chunk));
            incoming.on("end", () => {
              resolve(
                new Response(Buffer.concat(responseChunks), {
                  status: incoming.statusCode ?? 500,
                  statusText: incoming.statusMessage ?? "",
                  headers: incoming.headers as HeadersInit,
                }),
              );
            });
            incoming.on("error", reject);
          },
        );

        request.on("error", reject);
        if (payload && payload.length > 0) {
          request.write(payload);
        }
        request.end();
      })
      .catch(reject);
  });
}

/**
 * Validates an outbound URL, pins DNS/IP at connect time, and dispatches HTTP(S) on the
 * exact validated snapshot. Host is force-bound; destination drift aborts the pipeline.
 */
export async function fetchWithPinnedEgress(
  targetUrl: string,
  options?: PinnedEgressRequestInit,
): Promise<Response> {
  parseAndValidateUrl(targetUrl);
  const pinned = await assertSafeOutboundUrl(targetUrl);
  assertRequestBoundToPinnedSnapshot(targetUrl, pinned, options);

  if (options?.egressCoupledValidateOnly) {
    return new Response(null, { status: 204, statusText: "Egress Validated" });
  }

  return executeCoupledHttpRequest(pinned, options);
}
