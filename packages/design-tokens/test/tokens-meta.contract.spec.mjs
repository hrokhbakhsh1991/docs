import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const META_PATH = path.join(PKG_ROOT, "tokens.meta.json");
const meta = JSON.parse(fs.readFileSync(META_PATH, "utf8"));

describe("tokens.meta.json contract", () => {
  it("uses schemaVersion 1", () => {
    assert.equal(meta.schemaVersion, 1);
  });

  it("registers shared CSS variables for validate-design-tokens", () => {
    assert.ok(Array.isArray(meta.sharedVariables));
    assert.ok(meta.sharedVariables.length >= 10);
  });

  it("forbids denali-branded token name patterns", () => {
    const patterns = meta.forbiddenPatterns ?? [];
    assert.ok(patterns.some((p) => String(p).toLowerCase().includes("denali")));
  });
});
