import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATE_JS = join(PKG_ROOT, "dist/acl/migrateDenaliCanonical.js");
const UI_LOGIC_JS = join(PKG_ROOT, "dist/ui/logic/denali-social-media-link-logic.js");
const FIELD_REGISTRY_JS = join(PKG_ROOT, "dist/field-registry/denaliFieldRegistryData.js");

describe("denali runtime dist (seed-safe CJS host/acl)", () => {
  it("DENALI-DIST-01 migrateDenaliCanonical stays CommonJS after dual tsc + UI merge", () => {
    const source = readFileSync(MIGRATE_JS, "utf8");
    assert.match(source, /^"use strict"/);
    assert.doesNotMatch(source, /^import\s/m);
    assert.match(source, /require\("\.\.\/field-registry\/denaliFieldRegistryData"\)/);
    assert.match(source, /require\("\.\.\/ui\/logic\/denali-social-media-link-logic"\)/);
  });

  it("DENALI-DIST-02 ui/logic consumed by migrateDenaliCanonical stays CommonJS (reverse-tsc would break)", () => {
    const source = readFileSync(UI_LOGIC_JS, "utf8");
    assert.match(source, /^"use strict"/);
    assert.doesNotMatch(source, /^import\s/m);
  });

  it("DENALI-DIST-03 host/acl runtime loads field registry via require", () => {
    const require = createRequire(import.meta.url);
    const mod = require(MIGRATE_JS) as { migrateDenaliCanonical: unknown };
    assert.equal(typeof mod.migrateDenaliCanonical, "function");
    assert.ok(readFileSync(FIELD_REGISTRY_JS, "utf8").includes("DENALI_FIELD_DEFINITIONS"));
  });
});
