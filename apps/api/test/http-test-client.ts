import type { IncomingMessage, ServerResponse } from "node:http";
import http, { type Server } from "node:http";
import { after, before } from "node:test";

export type HttpTestJsonOptions = {
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
};

export type HttpTestJsonResult<T extends Record<string, unknown> = Record<string, unknown>> = {
  readonly status: number;
  readonly body: T;
};

type RequestListener = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

export type HttpTestClient = {
  readonly requestJson: <T extends Record<string, unknown> = Record<string, unknown>>(
    method: string,
    path: string,
    options?: HttpTestJsonOptions
  ) => Promise<HttpTestJsonResult<T>>;
};

async function closeTestServer(server: Server): Promise<void> {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

/**
 * One HTTP server per describe — avoids per-request listen/close churn and stray keep-alive handles
 * that keep the Node test runner alive after assertions pass.
 */
export function installHttpTestClient(createListener: () => RequestListener): HttpTestClient {
  let server: Server;
  let port = 0;

  before(async () => {
    server = http.createServer(createListener());
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("http-test-client: no listen address");
    }
    port = addr.port;
  });

  after(async () => {
    await closeTestServer(server);
  });

  async function requestJson<T extends Record<string, unknown>>(
    method: string,
    path: string,
    options?: HttpTestJsonOptions
  ): Promise<HttpTestJsonResult<T>> {
    const payload = options?.body === undefined ? undefined : JSON.stringify(options.body);
    return new Promise<HttpTestJsonResult<T>>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path,
          method,
          headers: {
            Connection: "close",
            ...options?.headers,
            ...(payload
              ? {
                  "Content-Type": "application/json",
                  "Content-Length": String(Buffer.byteLength(payload)),
                }
              : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk as Buffer));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            let body = {} as T;
            if (text.length > 0) {
              try {
                body = JSON.parse(text) as T;
              } catch (parseError) {
                reject(parseError);
                return;
              }
            }
            resolve({ status: res.statusCode ?? 0, body });
          });
        }
      );
      req.on("error", reject);
      if (payload !== undefined) {
        req.write(payload);
      }
      req.end();
    });
  }

  return { requestJson };
}
