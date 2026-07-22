/**
 * Wave H.a — platform Tour Ops API base; urban product path removed.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const WEB_ROOT = join(import.meta.dirname, "..");

function listTsFiles(dir) {
  /** @type {string[]} */
  const files = [];
  if (!existsSync(dir)) {
    return files;
  }
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      files.push(...listTsFiles(abs));
      continue;
    }
    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(abs);
    }
  }
  return files;
}

describe("wave-h-platform-tour-ops-api-base.spec.ts — Wave H.a", () => {
  it("H.a-01 urban-api-base.ts is deleted", () => {
    assert.equal(existsSync(join(WEB_ROOT, "src/urban/urban-api-base.ts")), false);
  });

  it("H.a-02 platform tour-ops-api-base owns guest-surface-host re-export", () => {
    const source = readFileSync(join(WEB_ROOT, "src/platform/tour-ops-api-base.ts"), "utf8");
    assert.match(source, /@app-tour\/guest-surface-host/);
    assert.match(source, /buildPublicTenantHeaders/);
    assert.match(source, /resolveTourOpsApiBaseUrl/);
  });

  it("H.a-03 no production src/app imports @/urban/urban-api-base", () => {
    for (const abs of [...listTsFiles(join(WEB_ROOT, "src")), ...listTsFiles(join(WEB_ROOT, "app"))]) {
      const source = readFileSync(abs, "utf8");
      assert.doesNotMatch(
        source,
        /@\/urban\/urban-api-base|urban\/urban-api-base/,
        abs.slice(WEB_ROOT.length + 1)
      );
    }
  });
});
