#!/usr/bin/env node
/**
 * P3-ENTRY-02 — shell wizard must not use raw <input>; use @app-tour/ui-primitives/input.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scanDirs = ["app", "src"].map((d) => path.join(webRoot, d));

const failures = [];

for (const dir of scanDirs) {
  if (!fs.existsSync(dir)) {
    failures.push(`missing scan dir: ${dir}`);
    continue;
  }
  const r = spawnSync(
    "rg",
    ["-n", "<input\\b", dir, "-g", "*.tsx", "-g", "*.jsx"],
    { encoding: "utf8" },
  );
  const lines = (r.stdout ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > 0) {
    failures.push(...lines);
  }
}

if (failures.length > 0) {
  console.error("guard-no-raw-wizard-input: FAIL — use @app-tour/ui-primitives/input");
  for (const line of failures) {
    console.error(`  ${line}`);
  }
  process.exit(1);
}

console.log("guard-no-raw-wizard-input: PASS");
