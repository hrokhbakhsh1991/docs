import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const portalRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("portal middleware — P8-1-N-003", () => {
  it("P8-SES-04 middleware.ts exists with matcher", () => {
    const path = join(portalRoot, "middleware.ts");
    assert.ok(existsSync(path));
    const source = readFileSync(path, "utf8");
    assert.match(source, /export function middleware/);
    assert.match(source, /export const config/);
    assert.match(source, /matcher:/);
    assert.match(source, /sessionTenantMatchesHost/);
    assert.match(source, /\/api\/me\//);
    assert.match(source, /\/me\//);
  });
});
