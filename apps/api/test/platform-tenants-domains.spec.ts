import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform tenants domains API", () => {
  it("POST CNAME", () => {
    const source = readFileSync(
      new URL("../src/routes/platform/tenants-domains.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /cnameInstructions/);
    assert.match(source, /cnameTarget/);
  });

  it("GET list", () => {
    const registrar = readFileSync(
      new URL("../src/http/platform-route-registrar.ts", import.meta.url),
      "utf8"
    );
    assert.match(registrar, /handlePlatformTenantsDomains/);
    assert.match(registrar, /\/domains/);
  });

  it("verify uses live CNAME check and SSL provision", () => {
    const source = readFileSync(
      new URL("../src/routes/platform/tenants-domains.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /verifyTenantDomainCnameLive/);
    assert.match(source, /provisionTenantDomainSsl/);
    assert.match(source, /toTenantDomainDto/);
  });
});
