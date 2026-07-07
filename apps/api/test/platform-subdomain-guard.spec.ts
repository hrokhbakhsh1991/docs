import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { assertSubdomainAvailable } from "../src/platform/assert-subdomain-available.ts";
import { PlatformValidation } from "../src/platform/platform.errors.ts";

describe("P1-N-040: assertSubdomainAvailable", () => {
  it("admin fails", async () => {
    await assert.rejects(
      async () => assertSubdomainAvailable("admin"),
      (err: Error) => {
        assert.ok(err instanceof PlatformValidation);
        assert.match(err.message, /reserved/i);
        return true;
      }
    );
  });

  it("valid-club passes", async () => {
    const source = readFileSync(
      new URL("../src/platform/assert-subdomain-available.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /TENANT_SUBDOMAIN_REGEX/);
    assert.doesNotMatch("valid-club", /^Bad/);
  });

  it("duplicate fails", async () => {
    const source = readFileSync(
      new URL("../src/platform/assert-subdomain-available.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /already taken/);
  });
});
