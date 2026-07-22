/**
 * Wave H.c — apps/web/src/denali/ removed; catalog SoT in workspace-denali.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");

describe("Wave H.c — denali catalog shell removed", () => {
  it("H.c-01 apps/web/src/denali/ directory is absent", () => {
    assert.equal(existsSync(join(WEB_ROOT, "src/denali")), false);
  });

  it("H.c-02 package SoT uses SDK catalog path resolver", () => {
    const source = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/catalog/fetch-denali-catalog-tour.ts"),
      "utf8"
    );
    assert.match(source, /resolveCatalogTourApiPath/);
    assert.doesNotMatch(source, /\/denali\/catalog/);
  });

  it("H.c-03 no production apps/web imports of deleted denali-catalog-client", () => {
    const roots = [join(WEB_ROOT, "src"), join(WEB_ROOT, "app")];
    const needle = /denali-catalog-client|@\/denali\//;
    for (const root of roots) {
      if (!existsSync(root)) continue;
      const walk = (dir: string) => {
        for (const ent of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, ent.name);
          if (ent.isDirectory()) {
            walk(full);
            continue;
          }
          if (!/\.(ts|tsx)$/.test(ent.name) || ent.name.endsWith(".spec.ts")) continue;
          const text = readFileSync(full, "utf8");
          assert.equal(needle.test(text), false, full);
        }
      };
      walk(root);
    }
  });
});
