#!/usr/bin/env node
/**
 * R-08 extension — DTCG platform.tokens.json must stay in sync with themes/light.css.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pkgRoot = path.join(REPO_ROOT, "packages/design-tokens");

const r = spawnSync("node", ["./scripts/generate-tokens.mjs"], {
  cwd: pkgRoot,
  encoding: "utf8",
  stdio: "pipe",
});
if (r.status !== 0) {
  console.error("guard-dtcg-css-sync: FAIL");
  console.error(`${r.stdout ?? ""}${r.stderr ?? ""}`.trim());
  process.exit(1);
}
console.log("guard-dtcg-css-sync: PASS");
