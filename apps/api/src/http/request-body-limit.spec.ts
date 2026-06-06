import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { resolveHttpMaxBodyBytes } from "./request-body-limit";

describe("resolveHttpMaxBodyBytes", () => {
  const previous = process.env.HTTP_MAX_BODY_BYTES;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.HTTP_MAX_BODY_BYTES;
    } else {
      process.env.HTTP_MAX_BODY_BYTES = previous;
    }
  });

  it("defaults to 256 KiB when unset", () => {
    delete process.env.HTTP_MAX_BODY_BYTES;
    assert.equal(resolveHttpMaxBodyBytes(), 256 * 1024);
  });

  it("honors HTTP_MAX_BODY_BYTES override", () => {
    process.env.HTTP_MAX_BODY_BYTES = "4096";
    assert.equal(resolveHttpMaxBodyBytes(), 4096);
  });

  it("falls back when env is invalid", () => {
    process.env.HTTP_MAX_BODY_BYTES = "0";
    assert.equal(resolveHttpMaxBodyBytes(), 256 * 1024);
    process.env.HTTP_MAX_BODY_BYTES = "nope";
    assert.equal(resolveHttpMaxBodyBytes(), 256 * 1024);
  });
});
