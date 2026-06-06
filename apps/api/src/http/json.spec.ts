import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { PassThrough } from "node:stream";
import { afterEach, describe, it } from "node:test";

import { ResponseTooLargeError } from "./http-response-size-budget";
import { readRequestBodyRaw, parseJsonBody, MalformedJsonBodyError, sendJson } from "./json";
import { RequestBodyTooLargeError } from "./request-body-limit";

function mockRequest(options: {
  readonly contentLength?: string;
  readonly chunks: readonly Buffer[];
}): IncomingMessage {
  const stream = new PassThrough();
  const req = stream as unknown as IncomingMessage;
  req.headers =
    options.contentLength === undefined ? {} : { "content-length": options.contentLength };
  queueMicrotask(() => {
    for (const chunk of options.chunks) {
      stream.write(chunk);
    }
    stream.end();
  });
  return req;
}

describe("readRequestBodyRaw body limit", () => {
  const previous = process.env.HTTP_MAX_BODY_BYTES;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.HTTP_MAX_BODY_BYTES;
    } else {
      process.env.HTTP_MAX_BODY_BYTES = previous;
    }
  });

  it("accepts bodies within the limit", async () => {
    process.env.HTTP_MAX_BODY_BYTES = "16";
    const body = await readRequestBodyRaw(mockRequest({ chunks: [Buffer.from('{"ok":true}')] }));
    assert.equal(body, '{"ok":true}');
  });

  it("rejects Content-Length above max without buffering overflow", async () => {
    process.env.HTTP_MAX_BODY_BYTES = "4";
    await assert.rejects(
      () =>
        readRequestBodyRaw(
          mockRequest({
            contentLength: "5",
            chunks: [Buffer.from("tiny")],
          })
        ),
      (error: unknown) => {
        assert.ok(error instanceof RequestBodyTooLargeError);
        assert.equal(error.maxBytes, 4);
        return true;
      }
    );
  });

  it("rejects chunked streams that exceed max mid-read", async () => {
    process.env.HTTP_MAX_BODY_BYTES = "3";
    await assert.rejects(
      () =>
        readRequestBodyRaw(
          mockRequest({
            chunks: [Buffer.from("ab"), Buffer.from("cd")],
          })
        ),
      RequestBodyTooLargeError
    );
  });
});

describe("parseJsonBody (DEC-092)", () => {
  it("returns {} for empty body", () => {
    assert.deepEqual(parseJsonBody(""), {});
    assert.deepEqual(parseJsonBody("   "), {});
  });

  it("throws MalformedJsonBodyError on syntax errors", () => {
    assert.throws(() => parseJsonBody("{bad"), MalformedJsonBodyError);
  });
});

function mockResponse(): ServerResponse & { body?: string; statusCode?: number } {
  return {
    statusCode: 200,
    setHeader() {},
    end(payload: string) {
      this.body = payload;
    },
  } as ServerResponse & { body?: string; statusCode?: number };
}

describe("sendJson response size budget (DEC-129)", () => {
  const previous = process.env.HTTP_MAX_RESPONSE_BYTES;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.HTTP_MAX_RESPONSE_BYTES;
    } else {
      process.env.HTTP_MAX_RESPONSE_BYTES = previous;
    }
  });

  it("sends payloads within the budget", () => {
    const res = mockResponse();
    sendJson(res, 200, { ok: true });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, '{"ok":true}');
  });

  it("rejects serialized payloads over HTTP_MAX_RESPONSE_BYTES", () => {
    process.env.HTTP_MAX_RESPONSE_BYTES = "8";
    const res = mockResponse();
    assert.throws(
      () => sendJson(res, 200, { data: "0123456789" }),
      (error: unknown) => {
        assert.ok(error instanceof ResponseTooLargeError);
        assert.equal(error.maxBytes, 8);
        return true;
      }
    );
  });

  it("checks pre-serialized strings without re-stringify", () => {
    process.env.HTTP_MAX_RESPONSE_BYTES = "4";
    const res = mockResponse();
    assert.throws(() => sendJson(res, 200, '{"too":"long"}'), ResponseTooLargeError);
  });
});
