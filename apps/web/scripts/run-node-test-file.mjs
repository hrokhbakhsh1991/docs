#!/usr/bin/env node
/**
 * Node-only test:file wrapper — rejects Playwright-owned specs with a clear error.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyWebTestSpec,
  SpecKind,
} from "../../../scripts/lib/classify-web-test-spec.mjs";

const WEB_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("test:file: expected at least one spec path");
  process.exit(1);
}

const nodeSpecs = [];
const rejected = [];

for (const arg of args) {
  const normalized = arg.replace(/\\/g, "/").replace(/^\.\//, "");
  const webRelative = normalized.startsWith("test/")
    ? normalized
    : normalized.replace(/^apps\/web\//, "");
  const kind = classifyWebTestSpec(webRelative);
  if (kind === SpecKind.NODE_UNIT) {
    nodeSpecs.push(arg);
  } else {
    rejected.push({ arg, kind });
  }
}

if (rejected.length > 0) {
  console.error(
    "test:file: Playwright-owned specs cannot run under node:test — use test:runtime-sweep or the matching playwright config:"
  );
  for (const { arg, kind } of rejected) {
    console.error(`  - ${arg} (${kind})`);
  }
  if (nodeSpecs.length === 0) {
    process.exit(1);
  }
}

const result = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "--import",
    "./test/register-dom.mjs",
    "--test",
    "--test-force-exit",
    "--test-concurrency=1",
    ...nodeSpecs,
  ],
  {
    cwd: WEB_ROOT,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "test" },
  }
);

process.exit(result.status ?? 1);
