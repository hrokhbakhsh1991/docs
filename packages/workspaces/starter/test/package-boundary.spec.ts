import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_JSON = join(PACKAGE_ROOT, "package.json");

const ALLOWED_RUNTIME_DEPS = new Set([
  "@app-tour/workspace-sdk",
  "@app-tour/platform-core",
  "@app-tour/design-tokens",
]);

describe("P3-E-WS-01 package boundary", () => {
  it("depends only on workspace-sdk, platform-core, and design-tokens", () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const deps = Object.keys(pkg.dependencies ?? {});
    assert.deepEqual(new Set(deps), ALLOWED_RUNTIME_DEPS);
  });

  it("does not depend on apps/*", () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as {
      dependencies?: Record<string, string>;
    };
    for (const name of Object.keys(pkg.dependencies ?? {})) {
      assert.ok(!name.startsWith("@apps/"), `forbidden app dependency: ${name}`);
    }
  });
});
