#!/usr/bin/env node
/**
 * CTL-CORE v2 — portal surface control pack (always-on, hard block).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  exitCodeForPackResult,
  runControlPack,
} from "./lib/run-control-pack.mjs";
import { PORTAL_CONTROL_STEPS } from "./lib/portal-control-steps.mjs";

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const ci = process.argv.includes("--ci");
  const result = runControlPack({
    pack: "portal-control-pack",
    steps: PORTAL_CONTROL_STEPS,
    ci,
  });
  process.exit(exitCodeForPackResult(result));
}
