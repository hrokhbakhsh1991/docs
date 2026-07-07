import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("tenant domain schema", () => {
  it("insert domain row model in prisma", () => {
    const schema = readFileSync(
      new URL("../prisma/schema.prisma", import.meta.url),
      "utf8"
    );
    assert.match(schema, /model TenantDomain/);
    assert.match(schema, /tenant_domains/);
    assert.match(schema, /cnameTarget/);
  });
});
