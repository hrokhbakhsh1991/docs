import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const API_ROOT = process.cwd();

describe("main-host-env.spec.ts", () => {
  it("binds the API listener to HOST when provided", () => {
    const source = readFileSync(resolve(API_ROOT, "src/main.ts"), "utf8");

    assert.match(source, /const host = process\.env\.HOST\?\.trim\(\) \|\| "0\.0\.0\.0"/);
    assert.match(source, /server\.listen\(port, host,/);
    assert.match(source, /event: "server\.start", port, host/);
  });
});
