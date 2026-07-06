#!/usr/bin/env node
/**
 * R-08 extension — DTCG platform + workspace slices must match generated CSS.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pkgRoot = path.join(REPO_ROOT, "packages/design-tokens");

for (const script of [
  "./scripts/generate-dtcg-primitives.mjs",
  "./scripts/generate-dtcg-theme.mjs",
  "./scripts/generate-workspace-dtcg-css.mjs",
]) {
  const r = spawnSync("node", [script, "--check"], {
    cwd: pkgRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (r.status !== 0) {
    console.error(`guard-dtcg-css-sync: FAIL (${script})`);
    console.error(`${r.stdout ?? ""}${r.stderr ?? ""}`.trim());
    process.exit(1);
  }
}

console.log("guard-dtcg-css-sync: PASS");
