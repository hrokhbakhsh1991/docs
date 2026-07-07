/**
 * P15-W-B3 — static contract for manual draft-unification smoke runner
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_JSON = join(WEB_ROOT, "package.json");
const SMOKE_SCRIPT = join(WEB_ROOT, "scripts/denali-draft-unification-smoke.mjs");

describe("denali-draft-unification-smoke-contract.spec.ts — P15-W-B3", () => {
  it("B3-01 smoke script covers tombstone, 409, two-tab, and flat-edit probes", () => {
    const source = readFileSync(SMOKE_SCRIPT, "utf8");
    assert.match(source, /SMOKE_BASE_URL/);
    assert.match(source, /SMOKE_EXPECT_UNIFICATION_ON/);
    assert.match(source, /TOMBSTONE_RESURRECTION/);
    assert.match(source, /draft-conflict-server-reloaded/);
    assert.match(source, /runTwoTabConflict/);
    assert.match(source, /runFlatEditSmoke/);
    assert.match(source, /stale PATCH API returns 409/);
  });

  it("B3-02 package.json exposes off/on smoke runner scripts", () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as {
      scripts?: Record<string, string>;
    };
    assert.match(
      pkg.scripts?.["smoke:denali-draft-unification"] ?? "",
      /denali-draft-unification-smoke\.mjs/
    );
    assert.match(
      pkg.scripts?.["smoke:denali-draft-unification:on"] ?? "",
      /SMOKE_EXPECT_UNIFICATION_ON=true/
    );
  });

  it("B3-03 package.json exposes memory-stack standalone runners", () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as {
      scripts?: Record<string, string>;
    };
    assert.match(
      pkg.scripts?.["smoke:denali-draft-unification:standalone"] ?? "",
      /smoke-denali-draft-unification-run\.mjs/
    );
    assert.match(
      pkg.scripts?.["smoke:denali-draft-unification:standalone:on"] ?? "",
      /SMOKE_EXPECT_UNIFICATION_ON=true/
    );
    assert.match(
      pkg.scripts?.["smoke:denali-draft-unification:standalone:on"] ?? "",
      /SMOKE_FORCE_FRESH_SERVERS=1/
    );
  });
});
