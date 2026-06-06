import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import { PassThrough } from "node:stream";
import { describe, it } from "node:test";

import { hashIdempotentRequest } from "../http/http-idempotency";
import { readRequestBodyRaw } from "../http/json";
import { readTourRequestBody } from "./read-tour-request-body";

function mockRequest(chunks: readonly Buffer[]): IncomingMessage {
  const stream = new PassThrough();
  const req = stream as unknown as IncomingMessage;
  req.headers = {};
  queueMicrotask(() => {
    for (const chunk of chunks) {
      stream.write(chunk);
    }
    stream.end();
  });
  return req;
}

describe("readTourRequestBody (DEC-100)", () => {
  it("returns rawBody identical to readRequestBodyRaw for idempotency hash", async () => {
    const req = mockRequest([Buffer.from('{"data":{"basics":{"title":"t"}}}')]);
    const { rawBody, parsedBody } = await readTourRequestBody(req);
    assert.equal(rawBody, await readRequestBodyRaw(mockRequest([Buffer.from(rawBody)])));
    assert.deepEqual(parsedBody, { data: { basics: { title: "t" } } });
  });

  it("preserves hashIdempotentRequest contract on rawBody", async () => {
    const payload = '{"tenantId":"tenant-a","data":{"basics":{"title":"Hash"}}}';
    const req = mockRequest([Buffer.from(payload)]);
    const { rawBody } = await readTourRequestBody(req);
    assert.equal(
      hashIdempotentRequest("POST", "/tours", rawBody),
      hashIdempotentRequest("POST", "/tours", payload)
    );
  });
});
