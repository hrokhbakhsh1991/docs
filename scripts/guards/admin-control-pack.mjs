#!/usr/bin/env node
/**
 * CTL-CORE v2 — admin surface control pack (always-on).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ADMIN_CONTROL_STEPS } from "./lib/admin-control-steps.mjs";
import {
  exitCodeForPackResult,
  runControlPack,
} from "./lib/run-control-pack.mjs";

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const ci = process.argv.includes("--ci");
  const result = runControlPack({
    pack: "admin-control-pack",
    steps: ADMIN_CONTROL_STEPS,
    ci,
  });
  process.exit(exitCodeForPackResult(result));
}
