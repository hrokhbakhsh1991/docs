import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

describe("db-seed logging hygiene (LOG-COL-05)", () => {
  it("uses structured logger without tenant UUID or console", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "db-seed.ts"),
      "utf8"
    );
    assert.doesNotMatch(source, /console\.(log|error)/);
    assert.doesNotMatch(source, /tenant\.id/);
    assert.match(source, /event:\s*"db\.seed\.tenant"/);
    assert.match(source, /subdomain:\s*tenant\.subdomain/);
    assert.match(source, /seedDenaliOperatorIdentity/);
  });
});
