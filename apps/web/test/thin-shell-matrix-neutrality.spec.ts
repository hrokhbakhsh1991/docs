/**
 * Thin Shell Phase 4u — no Denali-shaped matrix hard-codes in hand-written shell.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const MOUNTAIN_MATRIX =
  /category\s*:\s*["']mountain["']|duration\s*:\s*["']single_day["']/;

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walkTsFiles(full, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    if (name.includes(".generated.")) continue;
    if (/\.spec\.(ts|tsx)$/.test(name)) continue;
    out.push(full);
  }
  return out;
}

describe("thin-shell-matrix-neutrality — Phase 4u", () => {
  it("TS-4U-01 hand-written wizard host has no mountain/single_day matrix hard-code", () => {
    const host = readFileSync(join(WEB_ROOT, "src/wizard/workspace-wizard-host.tsx"), "utf8");
    assert.doesNotMatch(host, MOUNTAIN_MATRIX);
    assert.match(host, /defaultCellId/);
  });

  it("TS-4U-02 hand-written apps/web src+app has no mountain matrix literal pair in wizard path", () => {
    const hits: string[] = [];
    for (const root of ["src", "app"]) {
      for (const file of walkTsFiles(join(WEB_ROOT, root))) {
        if (!file.includes(`${join("wizard")}`) && !file.includes(`${join("tours")}`)) {
          continue;
        }
        const source = readFileSync(file, "utf8");
        source.split(/\r?\n/).forEach((line, index) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
          if (MOUNTAIN_MATRIX.test(line)) {
            hits.push(`${file.replace(WEB_ROOT + "/", "")}:${index + 1}:${trimmed}`);
          }
        });
      }
    }
    assert.deepEqual(hits, []);
  });
});
