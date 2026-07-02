#!/usr/bin/env node
/**
 * PF-1.9.2 — plugin-host bootstrap must not hard-import workspace packages (generated only).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REGISTER = path.join(REPO_ROOT, "packages/workspace-plugin-host/src/register.ts");

/** @type {string[]} */
const violations = [];
const source = fs.readFileSync(REGISTER, "utf8");

if (/@app-tour\/workspace-(denali|urban|starter)/.test(source)) {
  violations.push("register.ts imports workspace product package directly");
}

if (!source.includes("registerWorkspaceRegistrationTransportInitializersFromManifest")) {
  violations.push("register.ts must call registerWorkspaceRegistrationTransportInitializersFromManifest()");
}

if (!source.includes("registerWorkspaceRegistrationFlowPluginsFromManifest")) {
  violations.push("register.ts must call registerWorkspaceRegistrationFlowPluginsFromManifest()");
}

if (violations.length > 0) {
  console.error("guard-guest-frozen-shell: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-guest-frozen-shell: PASS");
