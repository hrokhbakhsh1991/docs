import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { assertTenantOwnsObjectKey } from "./assert-tenant-object-key-scope";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

describe("assertTenantOwnsObjectKey", () => {
  it("accepts tenant-root and receipt-scoped object keys", () => {
    assert.doesNotThrow(() => assertTenantOwnsObjectKey(`${TENANT_ID}/avatar.png`, TENANT_ID));
    assert.doesNotThrow(() =>
      assertTenantOwnsObjectKey(`receipts/${TENANT_ID}/proof.jpg`, TENANT_ID)
    );
  });

  it("rejects keys outside the tenant scope", () => {
    assert.throws(() =>
      assertTenantOwnsObjectKey("00000000-0000-4000-8000-000000000002/avatar.png", TENANT_ID)
    );
  });

  it("keeps accepted-key comments product-generic", () => {
    const source = readFileSync(new URL("./assert-tenant-object-key-scope.ts", import.meta.url), {
      encoding: "utf8",
    });
    assert.doesNotMatch(source, /denali tour photos/);
    assert.match(source, /workspace media/);
  });
});
