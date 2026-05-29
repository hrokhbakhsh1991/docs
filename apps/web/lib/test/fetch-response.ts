/** Minimal `Response` for Jest jsdom when `globalThis.Response` is missing. */
export function createJsonResponse(
  body: unknown,
  status = 200,
  contentType = "application/json",
): Response {
  const bodyText = typeof body === "string" ? body : JSON.stringify(body);

  if (typeof globalThis.Response !== "undefined") {
    return new globalThis.Response(bodyText, {
      status,
      headers: { "Content-Type": contentType },
    });
  }

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? contentType : null,
    },
    json: async () => JSON.parse(bodyText) as unknown,
    text: async () => bodyText,
  } as unknown as Response;
}

export function createTextResponse(body: string, status = 200): Response {
  if (typeof globalThis.Response !== "undefined") {
    return new globalThis.Response(body, { status });
  }

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => {
      throw new SyntaxError("Unexpected token");
    },
    text: async () => body,
  } as unknown as Response;
}
