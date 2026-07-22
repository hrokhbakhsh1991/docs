/**
 * Wave I.2 — shell production source must not statically import @app-tour/workspace-starter.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(WEB_ROOT, "src");
const FORBIDDEN = /from\s+["']@app-tour\/workspace-starter["']/;

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name.includes(".generated.")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkTsFiles(full, out);
      continue;
    }
    if (name.endsWith(".ts") || name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("Wave I.2 — SDK starter shell", () => {
  it("I.2-01 apps/web/src has no static workspace-starter imports", () => {
    const hits: string[] = [];
    for (const file of walkTsFiles(SRC)) {
      if (file.endsWith("workspace-theme-css.d.ts")) continue;
      const text = readFileSync(file, "utf8");
      if (FORBIDDEN.test(text)) {
        hits.push(file.slice(WEB_ROOT.length + 1));
      }
    }
    assert.deepEqual(hits, []);
  });

  it("I.2-02 bootstrap + builder resolve starter from workspace-sdk", () => {
    const surfaces = [
      "src/bootstrap/workspace-plugins.ts",
      "src/bootstrap/resolve-bootstrap-workspace-plugin.client.ts",
      "src/platform/workspace-builder/builder-draft-state.ts",
      "src/platform/workspace-builder/build-preview-plugin-from-draft.ts",
    ];
    for (const rel of surfaces) {
      const text = readFileSync(join(WEB_ROOT, rel), "utf8");
      assert.match(text, /getStarterWorkspacePlugin/);
      assert.match(text, /@app-tour\/workspace-sdk/);
      assert.doesNotMatch(text, FORBIDDEN);
    }
  });
});
