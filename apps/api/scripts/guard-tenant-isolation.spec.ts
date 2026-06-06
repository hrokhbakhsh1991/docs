import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(scriptsDir, "..", "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

describe("guard-tenant-isolation CI pack (DEC-036)", () => {
  it("meta script references all three child guards", () => {
    const source = readFileSync(join(scriptsDir, "guard-tenant-isolation.mjs"), "utf8");
    assert.match(source, /guard-no-raw-queries\.mjs/);
    assert.match(source, /guard-rls-session-local\.mjs/);
    assert.match(source, /guard-no-id-only-tour-read\.mjs/);
  });

  it("package.json wires guard:tenant-isolation in pretest and phase-3:api-gate", () => {
    assert.match(packageJson.scripts.pretest ?? "", /guard:tenant-isolation/);
    assert.match(packageJson.scripts["phase-3:api-gate"] ?? "", /guard:tenant-isolation/);
    assert.equal(
      packageJson.scripts["guard:tenant-isolation"],
      "node ./scripts/guard-tenant-isolation.mjs"
    );
  });
});
