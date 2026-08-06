/**
 * Wave H.h — non-generated apps/web sources must not import @app-tour/workspace-denali.
 * Product reachability is via generated plugin loaders + wizardHost.ensureReady / Pattern B registries.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DENALI_IMPORT = /from\s+['"]@app-tour\/workspace-denali/;

function listTs(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) listTs(full, out);
    else if (/\.(ts|tsx)$/.test(ent.name) && !ent.name.includes(".generated.")) out.push(full);
  }
  return out;
}

describe("Wave H.h — denali import firewall", () => {
  it("H.h-01 no non-generated apps/web source imports @app-tour/workspace-denali", () => {
    const hits: string[] = [];
    for (const root of [join(WEB_ROOT, "src"), join(WEB_ROOT, "app")]) {
      for (const file of listTs(root)) {
        const rel = file.slice(WEB_ROOT.length + 1);
        if (DENALI_IMPORT.test(readFileSync(file, "utf8"))) hits.push(rel);
        DENALI_IMPORT.lastIndex = 0;
      }
    }
    assert.deepEqual(hits, []);
  });

  it("H.h-02 tours/exposure reach host adapters via Pattern B registry only", () => {
    for (const rel of [
      "src/tours/tour-clone-hydrate-logic.ts",
      "src/tours/tour-preset-prefill-logic.ts",
      "src/exposure/localize-exposure-catalog-fields.ts",
    ]) {
      const source = readFileSync(join(WEB_ROOT, rel), "utf8");
      assert.doesNotMatch(source, /@app-tour\/workspace-denali/);
      assert.match(source, /wizard-host-adapter-registry/);
      assert.doesNotMatch(source, /workspace-host-adapters\.generated/);
    }
  });
});
